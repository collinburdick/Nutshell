import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { storage } from "./storage";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "nutshell2026";
const adminTokens = new Map<string, { createdAt: Date }>();

function generateAdminToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function validateAdminToken(token: string): boolean {
  const session = adminTokens.get(token);
  if (!session) return false;
  const hoursSinceCreation = (Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin authentication
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Invalid password" });
      }
      const token = generateAdminToken();
      adminTokens.set(token, { createdAt: new Date() });
      res.json({ token });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const valid = validateAdminToken(token);
      res.json({ valid });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/admin/logout", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      adminTokens.delete(token);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Join session with code
  app.post("/api/join", async (req: Request, res: Response) => {
    try {
      const { joinCode } = req.body;

      if (!joinCode || joinCode.length !== 6) {
        return res.status(400).json({ error: "Invalid session code" });
      }

      const table = await storage.getTableByJoinCode(joinCode);
      if (!table) {
        return res.status(404).json({ error: "Session not found" });
      }

      const facilitator = await storage.createFacilitator(table.id, req.body.deviceName);

      await storage.updateTable(table.id, { status: "active" });

      res.json({
        tableId: table.id,
        token: facilitator.token,
      });
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ error: "Failed to join session" });
    }
  });

  // Get table details
  app.get("/api/tables/:id", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const table = await storage.getTable(tableId);

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      const session = await storage.getSession(table.sessionId);

      res.json({
        id: table.id,
        tableNumber: table.tableNumber,
        topic: table.topic,
        sessionName: session?.name || "Session",
        discussionGuide: session?.discussionGuide || [],
        status: table.status,
      });
    } catch (error) {
      console.error("Error fetching table:", error);
      res.status(500).json({ error: "Failed to fetch table" });
    }
  });

  // Get table summary
  app.get("/api/tables/:id/summary", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const summary = await storage.getLatestSummary(tableId);

      if (!summary) {
        return res.json({
          content: "",
          themes: [],
          actionItems: [],
          openQuestions: [],
          updatedAt: null,
        });
      }

      res.json({
        content: summary.content,
        themes: summary.themes || [],
        actionItems: summary.actionItems || [],
        openQuestions: summary.openQuestions || [],
        updatedAt: summary.createdAt,
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  // Get pending nudges
  app.get("/api/tables/:id/nudges", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const nudges = await storage.getPendingNudges(tableId);
      res.json(nudges);
    } catch (error) {
      console.error("Error fetching nudges:", error);
      res.status(500).json({ error: "Failed to fetch nudges" });
    }
  });

  // Acknowledge nudge
  app.post("/api/nudges/:id/acknowledge", async (req: Request, res: Response) => {
    try {
      const nudgeId = parseInt(req.params.id);
      await storage.acknowledgeNudge(nudgeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error acknowledging nudge:", error);
      res.status(500).json({ error: "Failed to acknowledge nudge" });
    }
  });

  // Submit audio for transcription and summarization
  app.post("/api/tables/:id/audio", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const { token, audio } = req.body;

      const facilitator = await storage.getFacilitatorByToken(token);
      if (!facilitator || facilitator.tableId !== tableId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await storage.updateFacilitatorActivity(facilitator.id);
      await storage.updateTable(tableId, { lastActivityAt: new Date() });

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  // Get wrap-up data
  app.get("/api/tables/:id/wrapup", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const transcripts = await storage.getTranscriptsByTable(tableId);
      const summaries = await storage.getSummariesByTable(tableId);

      let takeaways: string[] = [];
      let actionItems: string[] = [];
      let openQuestions: string[] = [];

      if (summaries.length > 0) {
        const latestSummary = summaries[0];
        actionItems = (latestSummary.actionItems as string[]) || [];
        openQuestions = (latestSummary.openQuestions as string[]) || [];
      }

      if (transcripts.length > 0) {
        const conversationText = transcripts.map((t) => t.content).join("\n");

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert facilitator summarizing a roundtable discussion. Extract the top 3 key takeaways from the conversation. Be concise and actionable. Return a JSON object with a "takeaways" array of 3 strings.`,
              },
              {
                role: "user",
                content: conversationText,
              },
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 500,
          });

          const result = JSON.parse(response.choices[0]?.message?.content || "{}");
          takeaways = result.takeaways || [];
        } catch (aiError) {
          console.error("AI error:", aiError);
          takeaways = ["Summary generation in progress..."];
        }
      } else {
        takeaways = ["No discussion recorded", "Session was empty", "No insights generated"];
        actionItems = actionItems.length > 0 ? actionItems : ["No action items recorded"];
        openQuestions = openQuestions.length > 0 ? openQuestions : ["No questions captured"];
      }

      res.json({
        takeaways,
        actionItems,
        openQuestions,
      });
    } catch (error) {
      console.error("Error generating wrap-up:", error);
      res.status(500).json({ error: "Failed to generate wrap-up" });
    }
  });

  // Finalize session
  app.post("/api/tables/:id/finalize", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const { token, takeaways, actionItems, openQuestions } = req.body;

      const facilitator = await storage.getFacilitatorByToken(token);
      if (!facilitator || facilitator.tableId !== tableId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await storage.createSummary({
        tableId,
        type: "final",
        content: takeaways.join("\n\n"),
        themes: [],
        actionItems,
        openQuestions,
      });

      await storage.updateTable(tableId, { status: "completed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error finalizing session:", error);
      res.status(500).json({ error: "Failed to finalize session" });
    }
  });

  // Admin routes for event management
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      const event = await storage.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.get("/api/events/:id/sessions", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const sessions = await storage.getSessionsByEvent(eventId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/events/:id/sessions", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const session = await storage.createSession({ ...req.body, eventId });
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id/tables", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const tables = await storage.getTablesBySession(sessionId);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  app.post("/api/sessions/:id/tables", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const table = await storage.createTable({ ...req.body, sessionId });
      res.status(201).json(table);
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  // Admin nudge routes
  app.post("/api/nudges", async (req: Request, res: Response) => {
    try {
      const nudge = await storage.createNudge(req.body);
      res.status(201).json(nudge);
    } catch (error) {
      console.error("Error creating nudge:", error);
      res.status(500).json({ error: "Failed to create nudge" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  // Get single session
  app.get("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Admin monitoring - get all active tables across all events
  app.get("/api/admin/active-tables", async (req: Request, res: Response) => {
    try {
      const activeTables = await storage.getAllActiveTables();
      res.json(activeTables);
    } catch (error) {
      console.error("Error fetching active tables:", error);
      res.status(500).json({ error: "Failed to fetch active tables" });
    }
  });

  // Broadcast nudge to all tables in a session
  app.post("/api/sessions/:id/broadcast-nudge", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { type, message, priority } = req.body;
      const tables = await storage.getTablesBySession(sessionId);
      
      const nudges = await Promise.all(
        tables.map(table => 
          storage.createNudge({ tableId: table.id, sessionId, type, message, priority })
        )
      );
      
      res.status(201).json({ count: nudges.length, nudges });
    } catch (error) {
      console.error("Error broadcasting nudge:", error);
      res.status(500).json({ error: "Failed to broadcast nudge" });
    }
  });

  // Seed demo data for testing
  app.post("/api/seed-demo", async (req: Request, res: Response) => {
    try {
      const event = await storage.createEvent({
        name: "Tech Conference 2026",
        description: "Annual technology conference",
        status: "active",
      });

      const session = await storage.createSession({
        eventId: event.id,
        name: "Future of AI in Business",
        topic: "How will AI transform business operations in the next 5 years?",
        discussionGuide: [
          "What AI tools are you currently using in your work?",
          "What are the biggest barriers to AI adoption?",
          "How do you see AI changing your industry?",
        ],
        status: "active",
      });

      const table = await storage.createTable({
        sessionId: session.id,
        tableNumber: 1,
        topic: "AI in Customer Service",
        status: "inactive",
      });

      res.json({
        event,
        session,
        table,
        joinCode: table.joinCode,
      });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
