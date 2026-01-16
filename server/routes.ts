import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { storage } from "./storage";
import crypto from "crypto";
import { speechToText, convertWebmToWav } from "./replit_integrations/audio/client";

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

      if (!audio || audio.length < 100) {
        return res.json({ success: true, transcription: null, message: "No audio data" });
      }

      // Decode base64 audio and transcribe using Replit AI Integration
      try {
        const audioBuffer = Buffer.from(audio, "base64");
        
        // Convert WebM to WAV for better transcription accuracy
        let wavBuffer: Buffer;
        try {
          wavBuffer = await convertWebmToWav(audioBuffer);
        } catch (conversionError) {
          console.log("WebM conversion failed, using original format:", conversionError);
          wavBuffer = audioBuffer;
        }

        // Use the speechToText function which uses gpt-4o-mini-transcribe
        const transcriptText = await speechToText(wavBuffer, "wav");

        if (transcriptText && transcriptText.trim().length > 0) {
          // Store the transcript
          await storage.createTranscript({
            tableId,
            content: transcriptText,
            speakerTag: null, // De-identified
          });

          // Generate or update rolling summary
          await generateRollingSummary(tableId);

          res.json({ success: true, transcription: transcriptText });
        } else {
          res.json({ success: true, transcription: null, message: "No speech detected" });
        }
      } catch (transcriptionError) {
        console.error("Transcription error:", transcriptionError);
        // Don't fail the request, just return without transcription
        res.json({ success: true, transcription: null, error: "Transcription failed" });
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  // Helper function to generate rolling summary from all transcripts
  async function generateRollingSummary(tableId: number) {
    try {
      const transcripts = await storage.getTranscriptsByTable(tableId);
      if (transcripts.length === 0) return;

      const conversationText = transcripts.map((t) => t.content).join("\n\n");
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert facilitator analyzing a roundtable discussion. Summarize the conversation and extract key themes, action items, and open questions.

Return a JSON object with:
- "summary": a 2-3 sentence summary of the discussion so far
- "themes": array of 3-5 key themes/topics being discussed
- "actionItems": array of any action items or next steps mentioned
- "openQuestions": array of unresolved questions or topics needing more discussion

Keep the summary concise and focused on the most important points.`,
          },
          {
            role: "user",
            content: conversationText,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 800,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      // Create or update the summary
      await storage.createSummary({
        tableId,
        content: result.summary || "",
        themes: result.themes || [],
        actionItems: result.actionItems || [],
        openQuestions: result.openQuestions || [],
      });
    } catch (error) {
      console.error("Error generating rolling summary:", error);
    }
  }

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

  // Get aggregated summary for a session
  app.get("/api/sessions/:id/aggregated-summary", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const sessionTables = await storage.getTablesBySession(sessionId);
      const tableSummaries: Array<{
        tableId: number;
        tableNumber: number;
        topic: string | null;
        summary: { content: string; themes: string[]; actionItems: string[]; openQuestions: string[] } | null;
      }> = [];

      for (const table of sessionTables) {
        const latestSummary = await storage.getLatestSummary(table.id);
        tableSummaries.push({
          tableId: table.id,
          tableNumber: table.tableNumber,
          topic: table.topic,
          summary: latestSummary ? {
            content: latestSummary.content,
            themes: (latestSummary.themes as string[]) || [],
            actionItems: (latestSummary.actionItems as string[]) || [],
            openQuestions: (latestSummary.openQuestions as string[]) || [],
          } : null,
        });
      }

      const summariesWithContent = tableSummaries.filter(ts => ts.summary !== null);

      if (summariesWithContent.length === 0) {
        return res.json({
          sessionName: session.name,
          topic: session.topic,
          tableSummaries,
          totalTables: 0,
          themesWithFrequency: [],
          keyQuestions: [],
          keyInsights: [],
          overallSummary: "No discussion summaries available yet.",
          detailedThemes: [],
          notableQuotes: [],
          deeperInsights: [],
        });
      }

      const summaryText = summariesWithContent.map(ts => 
        `Table ${ts.tableNumber} (${ts.topic || 'General Discussion'}):\n` +
        `Content: ${ts.summary?.content || 'No content'}\n` +
        `Themes: ${(ts.summary?.themes || []).join(', ')}\n` +
        `Action Items: ${(ts.summary?.actionItems || []).join(', ')}\n` +
        `Open Questions: ${(ts.summary?.openQuestions || []).join(', ')}`
      ).join('\n\n');

      try {
        const totalTables = summariesWithContent.length;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert facilitator synthesizing insights from ${totalTables} roundtable discussions. Analyze the summaries and create a comprehensive aggregated view.

Return a JSON object with these fields:

1. "themesWithFrequency": array of objects with:
   - "theme": the theme name
   - "frequency": how many tables mentioned this (number)
   - "prevalence": "High" (>60%), "Medium" (30-60%), or "Low" (<30%)
   
2. "keyQuestions": array of 3-5 most important unanswered questions that emerged

3. "keyInsights": array of 4-6 key insights or takeaways from the discussions

4. "overallSummary": a 3-4 sentence executive summary of the session

5. "detailedThemes": array of objects with:
   - "theme": theme name
   - "description": 2-3 sentence detailed explanation of this theme
   - "keyPoints": array of 2-3 specific points discussed under this theme

6. "notableQuotes": array of 3-5 interesting or impactful statements/ideas that were discussed (paraphrased for privacy)

7. "deeperInsights": array of 2-3 objects with:
   - "insight": a deeper analytical observation
   - "analysis": 2-3 sentence AI analysis explaining why this matters or what it implies
   - "recommendation": optional actionable suggestion based on this insight`,
            },
            {
              role: "user",
              content: `Session: ${session.name}\nTopic: ${session.topic || 'General Discussion'}\nTotal Tables: ${totalTables}\n\nTable Summaries:\n${summaryText}`,
            },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2500,
        });

        const result = JSON.parse(response.choices[0]?.message?.content || "{}");

        res.json({
          sessionName: session.name,
          topic: session.topic,
          tableSummaries,
          totalTables,
          themesWithFrequency: result.themesWithFrequency || [],
          keyQuestions: result.keyQuestions || [],
          keyInsights: result.keyInsights || [],
          overallSummary: result.overallSummary || "Summary generation complete.",
          detailedThemes: result.detailedThemes || [],
          notableQuotes: result.notableQuotes || [],
          deeperInsights: result.deeperInsights || [],
        });
      } catch (aiError) {
        console.error("AI aggregation error:", aiError);
        res.json({
          sessionName: session.name,
          topic: session.topic,
          tableSummaries,
          totalTables: summariesWithContent.length,
          themesWithFrequency: [],
          keyQuestions: [],
          keyInsights: [],
          overallSummary: "Unable to generate aggregated summary at this time.",
          detailedThemes: [],
          notableQuotes: [],
          deeperInsights: [],
        });
      }
    } catch (error) {
      console.error("Error fetching session aggregated summary:", error);
      res.status(500).json({ error: "Failed to fetch aggregated summary" });
    }
  });

  // Get aggregated summary for an event
  app.get("/api/events/:id/aggregated-summary", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const eventSessions = await storage.getSessionsByEvent(eventId);
      const sessionSummaries: Array<{
        sessionId: number;
        sessionName: string;
        topic: string | null;
        tableCount: number;
        aggregatedThemes: string[];
        aggregatedActionItems: string[];
        aggregatedOpenQuestions: string[];
        overallSummary: string;
      }> = [];

      for (const session of eventSessions) {
        const sessionTables = await storage.getTablesBySession(session.id);
        const tableSummaryContents: Array<{ content: string; themes: string[]; actionItems: string[]; openQuestions: string[] }> = [];
        
        for (const table of sessionTables) {
          const latestSummary = await storage.getLatestSummary(table.id);
          if (latestSummary) {
            tableSummaryContents.push({
              content: latestSummary.content,
              themes: (latestSummary.themes as string[]) || [],
              actionItems: (latestSummary.actionItems as string[]) || [],
              openQuestions: (latestSummary.openQuestions as string[]) || [],
            });
          }
        }

        if (tableSummaryContents.length === 0) {
          sessionSummaries.push({
            sessionId: session.id,
            sessionName: session.name,
            topic: session.topic,
            tableCount: sessionTables.length,
            aggregatedThemes: [],
            aggregatedActionItems: [],
            aggregatedOpenQuestions: [],
            overallSummary: "No discussion summaries available.",
          });
        } else {
          const allThemes = tableSummaryContents.flatMap(s => s.themes);
          const allActionItems = tableSummaryContents.flatMap(s => s.actionItems);
          const allOpenQuestions = tableSummaryContents.flatMap(s => s.openQuestions);
          
          sessionSummaries.push({
            sessionId: session.id,
            sessionName: session.name,
            topic: session.topic,
            tableCount: sessionTables.length,
            aggregatedThemes: [...new Set(allThemes)].slice(0, 5),
            aggregatedActionItems: [...new Set(allActionItems)].slice(0, 5),
            aggregatedOpenQuestions: [...new Set(allOpenQuestions)].slice(0, 5),
            overallSummary: tableSummaryContents.map(s => s.content).join(' ').slice(0, 500),
          });
        }
      }

      const sessionsWithContent = sessionSummaries.filter(ss => ss.aggregatedThemes.length > 0 || ss.aggregatedActionItems.length > 0);
      const totalSessions = eventSessions.length;
      const totalTables = sessionSummaries.reduce((sum, ss) => sum + ss.tableCount, 0);

      if (sessionsWithContent.length === 0) {
        return res.json({
          eventName: event.name,
          description: event.description,
          sessionSummaries,
          totalSessions,
          totalTables,
          themesWithFrequency: [],
          keyQuestions: [],
          keyInsights: [],
          overallSummary: "No session summaries available yet.",
          detailedThemes: [],
          notableQuotes: [],
          deeperInsights: [],
        });
      }

      const sessionText = sessionsWithContent.map(ss => 
        `Session: ${ss.sessionName} (${ss.topic || 'General'})\n` +
        `Tables: ${ss.tableCount}\n` +
        `Themes: ${ss.aggregatedThemes.join(', ')}\n` +
        `Action Items: ${ss.aggregatedActionItems.join(', ')}\n` +
        `Open Questions: ${ss.aggregatedOpenQuestions.join(', ')}\n` +
        `Summary: ${ss.overallSummary}`
      ).join('\n\n');

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert conference organizer synthesizing insights from ${totalSessions} sessions with ${totalTables} tables at an event. Create a comprehensive synthesis.

Return a JSON object with these fields:

1. "themesWithFrequency": array of objects with:
   - "theme": the theme name
   - "frequency": how many sessions mentioned this (number)
   - "prevalence": "High" (>60%), "Medium" (30-60%), or "Low" (<30%)
   
2. "keyQuestions": array of 3-5 most important strategic questions for follow-up

3. "keyInsights": array of 4-6 key insights or takeaways from the entire event

4. "overallSummary": a 3-4 sentence executive summary of the event

5. "detailedThemes": array of objects with:
   - "theme": theme name
   - "description": 2-3 sentence detailed explanation
   - "keyPoints": array of 2-3 specific points discussed
   - "sessions": which sessions this theme appeared in

6. "notableQuotes": array of 3-5 interesting or impactful statements/ideas (paraphrased for privacy)

7. "deeperInsights": array of 2-3 objects with:
   - "insight": a deeper analytical observation about the event
   - "analysis": 2-3 sentence AI analysis explaining the significance
   - "recommendation": actionable suggestion for organizers/attendees`,
            },
            {
              role: "user",
              content: `Event: ${event.name}\nDescription: ${event.description || 'Conference event'}\nTotal Sessions: ${totalSessions}\nTotal Tables: ${totalTables}\n\nSession Summaries:\n${sessionText}`,
            },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2500,
        });

        const result = JSON.parse(response.choices[0]?.message?.content || "{}");

        res.json({
          eventName: event.name,
          description: event.description,
          sessionSummaries,
          totalSessions,
          totalTables,
          themesWithFrequency: result.themesWithFrequency || [],
          keyQuestions: result.keyQuestions || [],
          keyInsights: result.keyInsights || [],
          overallSummary: result.overallSummary || "Event summary generation complete.",
          detailedThemes: result.detailedThemes || [],
          notableQuotes: result.notableQuotes || [],
          deeperInsights: result.deeperInsights || [],
        });
      } catch (aiError) {
        console.error("AI aggregation error:", aiError);
        res.json({
          eventName: event.name,
          description: event.description,
          sessionSummaries,
          totalSessions,
          totalTables,
          themesWithFrequency: [],
          keyQuestions: [],
          keyInsights: [],
          overallSummary: "Unable to generate event summary at this time.",
          detailedThemes: [],
          notableQuotes: [],
          deeperInsights: [],
        });
      }
    } catch (error) {
      console.error("Error fetching event aggregated summary:", error);
      res.status(500).json({ error: "Failed to fetch aggregated summary" });
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
