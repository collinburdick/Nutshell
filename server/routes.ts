import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { storage } from "./storage";
import crypto from "crypto";
import { speechToText, convertWebmToWav } from "./replit_integrations/audio/client";

const openai = new OpenAI({
  apiKey: process.env.SlalomOpenAIAPIKey,
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "nutshell2026";
const adminTokens = new Map<string, { createdAt: Date }>();
const nudgeRateLimit = new Map<string, number>();
const NUDGE_RATE_LIMIT_MS = 30000;
const BROADCAST_RATE_LIMIT_MS = 60000;

function generateShareToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function getHealthState(lastAudioAt: Date | null): "active" | "degraded" | "offline" {
  if (!lastAudioAt) return "offline";
  const diffMs = Date.now() - lastAudioAt.getTime();
  if (diffMs <= 60000) return "active";
  if (diffMs <= 180000) return "degraded";
  return "offline";
}

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

function canSendNudge(key: string, limitMs: number): boolean {
  const lastSentAt = nudgeRateLimit.get(key);
  if (!lastSentAt) return true;
  return Date.now() - lastSentAt >= limitMs;
}

function markNudgeSent(key: string) {
  nudgeRateLimit.set(key, Date.now());
}

function parseCsvRows(rawCsv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < rawCsv.length; i++) {
    const char = rawCsv[i];
    if (char === '"') {
      if (inQuotes && rawCsv[i + 1] === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (currentField.length || currentRow.length) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      }
      continue;
    }
    currentField += char;
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.length > 0));
}

function buildQrSheetHtml(title: string, rows: Array<{ tableNumber: number; topic: string | null; joinCode: string }>, baseUrl: string) {
  const tableCards = rows
    .map(
      (row) => `
      <div class="card" data-code="${row.joinCode}" data-url="${baseUrl}?code=${row.joinCode}">
        <div class="card-header">
          <div class="table-number">Table ${row.tableNumber}</div>
          <div class="code">${row.joinCode}</div>
        </div>
        ${row.topic ? `<div class="topic">${row.topic}</div>` : ""}
        <div class="qr"></div>
        <div class="hint">Scan or enter code in the Nutshell app</div>
      </div>
    `
    )
    .join("\n");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} QR Sheet</title>
      <style>
        body { font-family: "Helvetica Neue", Arial, sans-serif; background: #f7f4ef; margin: 0; padding: 32px; color: #1b1b1b; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        p { margin-top: 0; color: #4b4b4b; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .card { background: #ffffff; border-radius: 16px; padding: 16px; border: 1px solid #e3ded6; box-shadow: 0 8px 20px rgba(0,0,0,0.06); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .table-number { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #8b6b3f; }
        .code { font-weight: 700; font-size: 18px; letter-spacing: 0.2em; }
        .topic { font-size: 13px; margin-bottom: 8px; color: #3f3a35; }
        .qr { display: flex; justify-content: center; align-items: center; margin: 8px 0; min-height: 140px; }
        .hint { font-size: 11px; color: #6b6b6b; text-align: center; }
        @media print { body { padding: 12px; } .card { break-inside: avoid; } }
      </style>
    </head>
    <body>
      <h1>${title} QR Sheet</h1>
      <p>Print these codes for facilitators to join quickly.</p>
      <div class="grid">
        ${tableCards}
      </div>
      <script src="https://unpkg.com/qr-code-styling@1.6.0/lib/qr-code-styling.js"></script>
      <script>
        document.querySelectorAll(".card").forEach(card => {
          const code = card.dataset.code;
          const url = card.dataset.url || code;
          const qrContainer = card.querySelector(".qr");
          if (!window.QRCodeStyling || !qrContainer) {
            qrContainer.textContent = code;
            return;
          }
          const qrCode = new QRCodeStyling({
            width: 140,
            height: 140,
            data: url,
            dotsOptions: { color: "#1b1b1b", type: "rounded" },
            cornersSquareOptions: { color: "#8b6b3f", type: "extra-rounded" },
            cornersDotOptions: { color: "#8b6b3f", type: "dot" },
            backgroundOptions: { color: "#ffffff" }
          });
          qrCode.append(qrContainer);
        });
      </script>
    </body>
  </html>`;
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

  app.get("/api/ping", (_req: Request, res: Response) => {
    res.json({ ok: true, now: Date.now() });
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

      const facilitators = await storage.getFacilitatorsByTable(table.id);
      const activeCount = facilitators.filter((f) => f.isActive).length;
      if (activeCount >= 2) {
        return res.status(409).json({ error: "Table already has two active devices" });
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
        agendaPhases: session?.agendaPhases || [],
        status: table.status,
      });
    } catch (error) {
      console.error("Error fetching table:", error);
      res.status(500).json({ error: "Failed to fetch table" });
    }
  });

  app.get("/api/tables/:id/health", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const table = await storage.getTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      const health = getHealthState(table.lastAudioAt ? new Date(table.lastAudioAt) : null);
      res.json({
        status: health,
        lastAudioAt: table.lastAudioAt,
        lastTranscriptAt: table.lastTranscriptAt,
        lastSummaryAt: table.lastSummaryAt,
      });
    } catch (error) {
      console.error("Error fetching table health:", error);
      res.status(500).json({ error: "Failed to fetch table health" });
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
          sentimentScore: null,
          sentimentConfidence: null,
          missingAngles: [],
          updatedAt: null,
        });
      }

      res.json({
        content: summary.content,
        themes: summary.themes || [],
        actionItems: summary.actionItems || [],
        openQuestions: summary.openQuestions || [],
        sentimentScore: summary.sentimentScore ?? null,
        sentimentConfidence: summary.sentimentConfidence ?? null,
        missingAngles: summary.missingAngles || [],
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
      await Promise.all(
        nudges.map(async (nudge) => {
          await storage.recordNudgeDelivery({ nudgeId: nudge.id, deliveredAt: new Date() });
          if (!nudge.deliveredAt) {
            await storage.updateNudge(nudge.id, { deliveredAt: new Date() });
          }
        })
      );
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
      await storage.recordNudgeDelivery({ nudgeId, acknowledgedAt: new Date() });
      await storage.updateNudge(nudgeId, { openedAt: new Date() });
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
      await storage.updateTable(tableId, { lastActivityAt: new Date(), lastAudioAt: new Date() });

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
          const transcript = await storage.createTranscript({
            tableId,
            content: transcriptText,
            speakerTag: null, // De-identified
          });
          await storage.createTranscriptLine({
            transcriptId: transcript.id,
            tableId,
            speakerTag: null,
            content: transcriptText,
            startMs: null,
            endMs: null,
            redacted: false,
            piiTags: [],
          });
          await storage.updateTable(tableId, { lastTranscriptAt: new Date() });

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
            content: `You are an expert facilitator analyzing a roundtable discussion. Summarize the conversation and extract key themes, action items, open questions, sentiment, and missing angles.

Return a JSON object with:
- "summary": a 2-3 sentence summary of the discussion so far
- "themes": array of 3-5 key themes/topics being discussed
- "actionItems": array of any action items or next steps mentioned
- "openQuestions": array of unresolved questions or topics needing more discussion
- "sentimentScore": number from -100 (very negative) to 100 (very positive)
- "sentimentConfidence": number from 0 to 100
- "missingAngles": array of 2-4 angles or perspectives that have not been addressed

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
        sentimentScore: result.sentimentScore ?? null,
        sentimentConfidence: result.sentimentConfidence ?? null,
        missingAngles: result.missingAngles || [],
      });
      await storage.updateTable(tableId, { lastSummaryAt: new Date() });
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

  app.get("/api/tables/:id/closing-script", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const transcripts = await storage.getTranscriptsByTable(tableId);
      if (transcripts.length === 0) {
        return res.json({ script: "Thank you for the discussion. We'll share a summary shortly." });
      }
      const conversationText = transcripts.map((t) => t.content).join("\n");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Create a brief closing script that a facilitator can read aloud. Keep it 3-4 sentences and friendly.",
          },
          { role: "user", content: conversationText },
        ],
        max_completion_tokens: 300,
      });
      const script = response.choices[0]?.message?.content || "Thanks everyone for your insights today.";
      res.json({ script });
    } catch (error) {
      console.error("Error generating closing script:", error);
      res.status(500).json({ error: "Failed to generate closing script" });
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
      await storage.updateTable(tableId, { lastSummaryAt: new Date() });

      const table = await storage.getTable(tableId);
      const session = table ? await storage.getSession(table.sessionId) : undefined;
      const eventId = session?.eventId;
      if (eventId) {
        await Promise.all(
          (actionItems || []).map((item: string) =>
            storage.createActionItem({
              eventId,
              sessionId: table?.sessionId,
              tableId,
              text: item,
              status: "open",
            })
          )
        );
        await Promise.all(
          (openQuestions || []).map((question: string) =>
            storage.createOpenQuestion({
              eventId,
              sessionId: table?.sessionId,
              question,
            })
          )
        );
      }

      await storage.updateTable(tableId, { status: "completed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error finalizing session:", error);
      res.status(500).json({ error: "Failed to finalize session" });
    }
  });

  // Parking lot items
  app.get("/api/tables/:id/parking-lot", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const items = await storage.listParkingLotItems(tableId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching parking lot items:", error);
      res.status(500).json({ error: "Failed to fetch parking lot items" });
    }
  });

  app.post("/api/tables/:id/parking-lot", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const { text } = req.body;
      const item = await storage.createParkingLotItem({ tableId, text });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating parking lot item:", error);
      res.status(500).json({ error: "Failed to create parking lot item" });
    }
  });

  // Golden nuggets
  app.get("/api/tables/:id/golden-nuggets", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const items = await storage.listGoldenNuggets(tableId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching golden nuggets:", error);
      res.status(500).json({ error: "Failed to fetch golden nuggets" });
    }
  });

  app.post("/api/tables/:id/golden-nuggets", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const { text } = req.body;
      const item = await storage.createGoldenNugget({ tableId, text });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating golden nugget:", error);
      res.status(500).json({ error: "Failed to create golden nugget" });
    }
  });

  // Summary translations
  app.post("/api/summaries/:id/translate", async (req: Request, res: Response) => {
    try {
      const summaryId = parseInt(req.params.id);
      const { language } = req.body;
      const summary = await storage.getSummary(summaryId);
      if (!summary) {
        return res.status(404).json({ error: "Summary not found" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Translate the following summary accurately and keep bullet formatting." },
          { role: "user", content: `Language: ${language}\n\n${summary.content}` },
        ],
        max_completion_tokens: 800,
      });
      const translated = response.choices[0]?.message?.content || summary.content;
      const translation = await storage.createSummaryTranslation({
        summaryId,
        language,
        content: translated,
      });
      res.status(201).json(translation);
    } catch (error) {
      console.error("Error translating summary:", error);
      res.status(500).json({ error: "Failed to translate summary" });
    }
  });

  // Action items by event
  app.get("/api/events/:id/action-items", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const items = await storage.listActionItemsByEvent(eventId);
      const tables = await storage.getAllTables();
      const sessions = await storage.getSessionsByEvent(eventId);
      const tableMap = new Map(tables.map((table) => [table.id, table]));
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));
      const queries = items.map((item) => item.text.split(" ").slice(0, 6).join(" "));
      const evidenceBatch = await storage.getEvidenceBatch(eventId, queries);
      const evidenceMap = new Map(evidenceBatch.map((item) => [item.query, item]));
      const withEvidence = await Promise.all(
        items.map(async (item) => {
          const query = item.text.split(" ").slice(0, 6).join(" ");
          const evidence = evidenceMap.get(query);
          const topLine = evidence?.topLine ?? undefined;
          const table = topLine?.tableId ? tableMap.get(topLine.tableId) : item.tableId ? tableMap.get(item.tableId) : undefined;
          const session = table ? sessionMap.get(table.sessionId) : item.sessionId ? sessionMap.get(item.sessionId) : undefined;
          const tags = item.text
            .toLowerCase()
            .split(/\W+/)
            .filter((word) => word.length > 4)
            .slice(0, 3);
          return {
            ...item,
            evidenceCount: evidence?.count ?? 0,
            evidenceLineId: topLine?.id ?? null,
            evidencePreview: topLine?.content ?? null,
            evidenceSpeaker: topLine?.speakerTag ?? null,
            evidenceAt: topLine?.createdAt ?? null,
            tableNumber: table?.tableNumber ?? null,
            sessionName: session?.name ?? null,
            tags,
          };
        })
      );
      const withMerge = withEvidence.map((item) => {
        const mergeCandidates = withEvidence
          .filter((other) => other.id !== item.id && item.tags?.some((tag) => other.tags?.includes(tag)))
          .slice(0, 3)
          .map((other) => other.id);
        return { ...item, mergeCandidates };
      });
      res.json(withMerge);
    } catch (error) {
      console.error("Error fetching action items:", error);
      res.status(500).json({ error: "Failed to fetch action items" });
    }
  });

  // Transcript lines (evidence stream)
  app.get("/api/events/:id/transcript-lines", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string, 10) : undefined;
      const tableId = req.query.tableId ? parseInt(req.query.tableId as string, 10) : undefined;
      const query = req.query.q ? String(req.query.q) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const lines = await storage.getTranscriptLinesByEvent(eventId, { sessionId, tableId, query, limit, offset });
      const shouldAudit = req.query.audit !== "false";
      if (shouldAudit) {
        await storage.createAuditLog({
          actor: "admin",
          action: "view_transcript_lines",
          entityType: "event",
          entityId: eventId,
          metadata: { sessionId, tableId, query, limit, offset },
        });
      }
      res.json(lines);
    } catch (error) {
      console.error("Error fetching transcript lines:", error);
      res.status(500).json({ error: "Failed to fetch transcript lines" });
    }
  });

  app.get("/api/events/:id/transcript-lines/count", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string, 10) : undefined;
      const tableId = req.query.tableId ? parseInt(req.query.tableId as string, 10) : undefined;
      const query = req.query.q ? String(req.query.q) : undefined;
      const count = await storage.countTranscriptLinesByEvent(eventId, { sessionId, tableId, query });
      res.json({ count });
    } catch (error) {
      console.error("Error counting transcript lines:", error);
      res.status(500).json({ error: "Failed to count transcript lines" });
    }
  });

  app.get("/api/transcript-lines/:id/context", async (req: Request, res: Response) => {
    try {
      const lineId = parseInt(req.params.id);
      const beforeSeconds = req.query.before ? parseInt(req.query.before as string, 10) : 30;
      const afterSeconds = req.query.after ? parseInt(req.query.after as string, 10) : 30;
      const lines = await storage.getTranscriptContext(lineId, beforeSeconds, afterSeconds);
      const eventId = req.query.eventId ? parseInt(req.query.eventId as string, 10) : undefined;
      if (eventId) {
        await storage.createAuditLog({
          actor: "admin",
          action: "view_transcript_context",
          entityType: "event",
          entityId: eventId,
          metadata: { lineId, beforeSeconds, afterSeconds },
        });
      }
      res.json(lines);
    } catch (error) {
      console.error("Error fetching transcript context:", error);
      res.status(500).json({ error: "Failed to fetch transcript context" });
    }
  });

  // Evidence links
  app.get("/api/summaries/:id/evidence", async (req: Request, res: Response) => {
    try {
      const summaryId = parseInt(req.params.id);
      const links = await storage.getEvidenceLinksBySummary(summaryId);
      res.json(links);
    } catch (error) {
      console.error("Error fetching evidence links:", error);
      res.status(500).json({ error: "Failed to fetch evidence links" });
    }
  });

  app.post("/api/evidence-links", async (req: Request, res: Response) => {
    try {
      const link = await storage.createEvidenceLink(req.body);
      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating evidence link:", error);
      res.status(500).json({ error: "Failed to create evidence link" });
    }
  });

  // Quote bank
  app.get("/api/events/:id/quotes", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const quotes = await storage.listQuotesByEventDetailed(eventId);
      res.json(
        quotes.map((row) => ({
          id: row.quote.id,
          tableId: row.quote.tableId,
          governance: row.quote.governance,
          startMs: row.quote.startMs,
          endMs: row.quote.endMs,
          createdAt: row.quote.createdAt,
          sessionName: row.session.name,
          tableNumber: row.table.tableNumber,
          transcriptLineId: row.quote.transcriptLineId,
          speakerTag: row.line?.speakerTag ?? null,
          content: row.line?.content ?? null,
          lineAt: row.line?.createdAt ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", async (req: Request, res: Response) => {
    try {
      const table = req.body.tableId ? await storage.getTable(req.body.tableId) : undefined;
      const session = table ? await storage.getSession(table.sessionId) : undefined;
      const event = session ? await storage.getEvent(session.eventId) : undefined;
      if (event && !event.allowQuotes) {
        return res.status(403).json({ error: "Quotes are disabled for this event." });
      }
      if (req.body.endMs !== null && req.body.endMs !== undefined && (req.body.startMs === null || req.body.startMs === undefined)) {
        return res.status(400).json({ error: "startMs is required when endMs is provided." });
      }
      const quote = await storage.createQuote(req.body);
      await storage.createAuditLog({
        actor: "admin",
        action: "create_quote",
        entityType: "quote",
        entityId: quote.id,
        metadata: { tableId: quote.tableId, governance: quote.governance },
      });
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  app.patch("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const quoteId = parseInt(req.params.id);
      const existing = await storage.getQuote(quoteId);
      if (!existing) {
        return res.status(404).json({ error: "Quote not found" });
      }
      const table = await storage.getTable(existing.tableId);
      const session = table ? await storage.getSession(table.sessionId) : undefined;
      const event = session ? await storage.getEvent(session.eventId) : undefined;
      if (event && !event.allowQuotes) {
        return res.status(403).json({ error: "Quotes are disabled for this event." });
      }
      const quote = await storage.updateQuote(quoteId, req.body);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found after update" });
      }
      await storage.createAuditLog({
        actor: "admin",
        action: "update_quote",
        entityType: "quote",
        entityId: quote.id,
        metadata: { governance: quote.governance },
      });
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  // Audit logs
  app.get("/api/events/:id/audit-logs", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const logs = await storage.listAuditLogs(eventId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Nudge stats by event (inline table indicators)
  app.get("/api/events/:id/nudge-stats", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const stats = await storage.getNudgeStatsByEvent(eventId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching event nudge stats:", error);
      res.status(500).json({ error: "Failed to fetch event nudge stats" });
    }
  });

  // Explore investigations + collections
  app.get("/api/events/:id/investigations", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const investigations = await storage.listInvestigations(eventId);
      res.json(investigations);
    } catch (error) {
      console.error("Error fetching investigations:", error);
      res.status(500).json({ error: "Failed to fetch investigations" });
    }
  });

  app.post("/api/events/:id/investigations", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const investigation = await storage.createInvestigation({ ...req.body, eventId });
      res.status(201).json(investigation);
    } catch (error) {
      console.error("Error creating investigation:", error);
      res.status(500).json({ error: "Failed to create investigation" });
    }
  });

  app.get("/api/events/:id/collections", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const collections = await storage.listCollections(eventId);
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  app.post("/api/events/:id/collections", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const collection = await storage.createCollection({ ...req.body, eventId });
      res.status(201).json(collection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  app.post("/api/collections/:id/items", async (req: Request, res: Response) => {
    try {
      const collectionId = parseInt(req.params.id);
      const item = await storage.addCollectionItem({ ...req.body, collectionId });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding collection item:", error);
      res.status(500).json({ error: "Failed to add collection item" });
    }
  });

  // Golden nuggets by event
  app.get("/api/events/:id/golden-nuggets", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const nuggets = await storage.listGoldenNuggetsByEvent(eventId);
      res.json(nuggets);
    } catch (error) {
      console.error("Error fetching golden nuggets:", error);
      res.status(500).json({ error: "Failed to fetch golden nuggets" });
    }
  });

  // Open questions board
  app.get("/api/events/:id/open-questions", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const questions = await storage.listOpenQuestionsByEvent(eventId);
      const tables = await storage.getAllTables();
      const sessions = await storage.getSessionsByEvent(eventId);
      const tableMap = new Map(tables.map((table) => [table.id, table]));
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));
      const queries = questions.map((question) => question.question.split(" ").slice(0, 6).join(" "));
      const evidenceBatch = await storage.getEvidenceBatch(eventId, queries);
      const evidenceMap = new Map(evidenceBatch.map((item) => [item.query, item]));
      const withEvidence = await Promise.all(
        questions.map(async (question) => {
          const query = question.question.split(" ").slice(0, 6).join(" ");
          const evidence = evidenceMap.get(query);
          const topLine = evidence?.topLine ?? undefined;
          const table = topLine?.tableId ? tableMap.get(topLine.tableId) : undefined;
          const session = table ? sessionMap.get(table.sessionId) : undefined;
          return {
            ...question,
            evidenceCount: evidence?.count ?? 0,
            evidenceLineId: topLine?.id ?? null,
            evidencePreview: topLine?.content ?? null,
            evidenceSpeaker: topLine?.speakerTag ?? null,
            evidenceAt: topLine?.createdAt ?? null,
            tableId: topLine?.tableId ?? null,
            tableNumber: table?.tableNumber ?? null,
            sessionName: session?.name ?? null,
          };
        })
      );
      res.json(withEvidence);
    } catch (error) {
      console.error("Error fetching open questions:", error);
      res.status(500).json({ error: "Failed to fetch open questions" });
    }
  });

  app.post("/api/events/:id/open-questions", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const question = await storage.createOpenQuestion({ eventId, question: req.body.question });
      res.status(201).json(question);
    } catch (error) {
      console.error("Error creating open question:", error);
      res.status(500).json({ error: "Failed to create open question" });
    }
  });

  app.get("/api/events/:id/pii-indicators", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const indicators = await storage.getPiiIndicatorsByEvent(eventId);
      res.json(indicators);
    } catch (error) {
      console.error("Error fetching PII indicators:", error);
      res.status(500).json({ error: "Failed to fetch PII indicators" });
    }
  });

  app.get("/api/events/:id/transcript-completeness", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const tables = await storage.getAllTables();
      const sessions = await storage.getSessionsByEvent(eventId);
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));
      const tableMap = new Map(
        tables
          .filter((table) => sessionMap.has(table.sessionId))
          .map((table) => [table.id, table])
      );
      const aggregates = await storage.getTranscriptCompletenessByEvent(eventId);
      const enriched = await Promise.all(
        aggregates.map(async (agg) => {
          const table = tableMap.get(agg.tableId);
          const session = table ? sessionMap.get(table.sessionId) : undefined;
          const scheduledMinutes =
            session?.startTime && session?.endTime
              ? Math.max(1, Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000))
              : null;
          const capturedMinutes =
            agg.firstAt && agg.lastAt
              ? Math.max(1, Math.round((agg.lastAt.getTime() - agg.firstAt.getTime()) / 60000))
              : 0;
          const timestamps = await storage.getTranscriptLineTimestampsByTable(agg.tableId);
          let gapCount = 0;
          for (let i = 1; i < timestamps.length; i += 1) {
            const prev = timestamps[i - 1];
            const next = timestamps[i];
            const gapMs = next.getTime() - prev.getTime();
            if (gapMs > 120000) gapCount += 1;
          }
          return {
            tableId: agg.tableId,
            tableNumber: table?.tableNumber ?? null,
            sessionName: session?.name ?? null,
            scheduledMinutes,
            capturedMinutes,
            gapCount,
            lastTranscriptAt: agg.lastAt,
          };
        })
      );
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching transcript completeness:", error);
      res.status(500).json({ error: "Failed to fetch transcript completeness" });
    }
  });

  app.get("/api/events/:id/hot-tables", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const sinceMinutes = req.query.window ? parseInt(req.query.window as string, 10) : 5;
      const rows = await storage.getHotTablesByEvent(eventId, sinceMinutes);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching hot tables:", error);
      res.status(500).json({ error: "Failed to fetch hot tables" });
    }
  });

  app.get("/api/events/:id/pulse-timeline", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const bucketMinutes = req.query.bucket ? parseInt(req.query.bucket as string, 10) : 15;
      const buckets = new Map<string, { ts: string; total: number; count: number; confidence: number }>();
      summaries.forEach((summary) => {
        if (summary.sentimentScore === null || summary.sentimentConfidence === null) return;
        const ts = summary.createdAt;
        const rounded = new Date(ts);
        rounded.setMinutes(Math.floor(rounded.getMinutes() / bucketMinutes) * bucketMinutes, 0, 0);
        const key = rounded.toISOString();
        const entry = buckets.get(key) || { ts: key, total: 0, count: 0, confidence: 0 };
        entry.total += summary.sentimentScore || 0;
        entry.confidence += summary.sentimentConfidence || 0;
        entry.count += 1;
        buckets.set(key, entry);
      });
      const timeline = Array.from(buckets.values())
        .map((entry) => ({
          timestamp: entry.ts,
          averageSentiment: Math.round(entry.total / entry.count),
          averageConfidence: Math.round(entry.confidence / entry.count),
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const labeled = timeline.map((entry, index) => {
        if (index === 0) return { ...entry, label: null };
        const delta = entry.averageSentiment - timeline[index - 1].averageSentiment;
        if (Math.abs(delta) >= 15) {
          return {
            ...entry,
            label: delta > 0 ? "Sentiment lift" : "Sentiment drop",
          };
        }
        return { ...entry, label: null };
      });
      res.json(labeled);
    } catch (error) {
      console.error("Error fetching pulse timeline:", error);
      res.status(500).json({ error: "Failed to fetch pulse timeline" });
    }
  });

  app.get("/api/events/:id/sentiment-heatmap", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const tables = await storage.getAllTables();
      const sessions = await storage.getSessionsByEvent(eventId);
      const tableMap = new Map(tables.map((table) => [table.id, table]));
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));
      const latestByTable = new Map<number, typeof summaries[number]>();
      summaries.forEach((summary) => {
        const existing = latestByTable.get(summary.tableId);
        if (!existing || existing.createdAt < summary.createdAt) {
          latestByTable.set(summary.tableId, summary);
        }
      });
      const heatmap = Array.from(latestByTable.entries()).map(([tableId, summary]) => {
        const table = tableMap.get(tableId);
        const session = table ? sessionMap.get(table.sessionId) : undefined;
        return {
          tableId,
          tableNumber: table?.tableNumber ?? null,
          sessionId: session?.id ?? null,
          sessionName: session?.name ?? null,
          sentimentScore: summary.sentimentScore,
          sentimentConfidence: summary.sentimentConfidence,
          updatedAt: summary.createdAt,
        };
      });
      res.json(heatmap);
    } catch (error) {
      console.error("Error fetching sentiment heatmap:", error);
      res.status(500).json({ error: "Failed to fetch sentiment heatmap" });
    }
  });

  app.get("/api/events/:id/consensus", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const themeStats = new Map<string, { values: number[]; count: number }>();
      summaries.forEach((summary) => {
        const themes = (summary.themes as string[]) || [];
        themes.forEach((theme) => {
          const entry = themeStats.get(theme) || { values: [], count: 0 };
          if (summary.sentimentScore !== null) {
            entry.values.push(summary.sentimentScore);
          }
          entry.count += 1;
          themeStats.set(theme, entry);
        });
      });
      const scored = Array.from(themeStats.entries()).map(([theme, entry]) => {
        const avg = entry.values.length
          ? entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length
          : 0;
        const variance = entry.values.length
          ? entry.values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / entry.values.length
          : 0;
        return { theme, count: entry.count, variance: Math.round(variance), avg: Math.round(avg) };
      });
      const consensus = scored
        .filter((item) => item.count > 1)
        .sort((a, b) => a.variance - b.variance)
        .slice(0, 3);
      const controversy = scored
        .filter((item) => item.count > 1)
        .sort((a, b) => b.variance - a.variance)
        .slice(0, 3);
      res.json({ consensus, controversy });
    } catch (error) {
      console.error("Error fetching consensus insights:", error);
      res.status(500).json({ error: "Failed to fetch consensus insights" });
    }
  });

  app.get("/api/events/:id/theme-clusters", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const themeCounts = new Map<string, number>();
      summaries.forEach((summary) => {
        const themes = (summary.themes as string[]) || [];
        themes.forEach((theme) => {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
        });
      });
      const clusters = new Map<string, { cluster: string; themes: string[]; count: number }>();
      Array.from(themeCounts.entries()).forEach(([theme, count]) => {
        const key = theme.split(" ")[0]?.toLowerCase() || "other";
        const entry = clusters.get(key) || { cluster: key, themes: [], count: 0 };
        entry.themes.push(theme);
        entry.count += count;
        clusters.set(key, entry);
      });
      res.json(Array.from(clusters.values()).sort((a, b) => b.count - a.count).slice(0, 12));
    } catch (error) {
      console.error("Error fetching theme clusters:", error);
      res.status(500).json({ error: "Failed to fetch theme clusters" });
    }
  });

  app.post("/api/open-questions/:id/upvote", async (req: Request, res: Response) => {
    try {
      const questionId = parseInt(req.params.id);
      const question = await storage.upvoteOpenQuestion(questionId);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      res.json(question);
    } catch (error) {
      console.error("Error upvoting question:", error);
      res.status(500).json({ error: "Failed to upvote question" });
    }
  });

  // Table handoff
  app.post("/api/tables/:id/handoff", async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      const table = await storage.getTable(tableId);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      await storage.deactivateFacilitatorsByTable(tableId);
      const facilitator = await storage.createFacilitator(tableId, req.body.deviceName);
      res.json({ tableId, token: facilitator.token, joinCode: table.joinCode });
    } catch (error) {
      console.error("Error handing off table:", error);
      res.status(500).json({ error: "Failed to hand off table" });
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

  app.patch("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.updateEvent(eventId, req.body);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
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

  app.patch("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.updateSession(sessionId, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
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
      const key = req.body.tableId ? `table:${req.body.tableId}` : `session:${req.body.sessionId || "unknown"}`;
      if (!canSendNudge(key, NUDGE_RATE_LIMIT_MS)) {
        return res.status(429).json({ error: "Nudge rate limit exceeded. Try again shortly." });
      }
      const nudge = await storage.createNudge(req.body);
      markNudgeSent(key);
      res.status(201).json(nudge);
    } catch (error) {
      console.error("Error creating nudge:", error);
      res.status(500).json({ error: "Failed to create nudge" });
    }
  });

  app.get("/api/nudges/stats", async (req: Request, res: Response) => {
    try {
      const tableId = req.query.tableId ? parseInt(req.query.tableId as string, 10) : null;
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string, 10) : null;

      if (tableId) {
        const stats = await storage.getNudgeStatsByTable(tableId);
        return res.json(stats);
      }
      if (sessionId) {
        const stats = await storage.getNudgeStatsBySession(sessionId);
        return res.json(stats);
      }
      return res.status(400).json({ error: "tableId or sessionId is required" });
    } catch (error) {
      console.error("Error fetching nudge stats:", error);
      res.status(500).json({ error: "Failed to fetch nudge stats" });
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

  // Event table health (for dashboard left rail)
  app.get("/api/events/:id/table-health", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const sessions = await storage.getSessionsByEvent(eventId);
      const result: Array<{
        id: number;
        sessionId: number;
        tableNumber: number;
        topic: string | null;
        status: string;
        lastAudioAt: Date | null;
        sessionName: string;
      }> = [];
      for (const session of sessions) {
        const tables = await storage.getTablesBySession(session.id);
        tables.forEach((table) => {
          result.push({
            id: table.id,
            sessionId: table.sessionId,
            tableNumber: table.tableNumber,
            topic: table.topic,
            status: getHealthState(table.lastAudioAt ? new Date(table.lastAudioAt) : null),
            lastAudioAt: table.lastAudioAt,
            sessionName: session.name,
          });
        });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching table health:", error);
      res.status(500).json({ error: "Failed to fetch table health" });
    }
  });

  // Admin alerts - tables with no usable audio
  app.get("/api/admin/alerts", async (req: Request, res: Response) => {
    try {
      const thresholdSec = parseInt(req.query.thresholdSec as string, 10) || 60;
      const allTables = await storage.getAllTables();
      const now = Date.now();
      const staleTables = allTables.filter((table) => {
        if (!table.lastAudioAt) return true;
        const diffMs = now - new Date(table.lastAudioAt).getTime();
        return diffMs > thresholdSec * 1000;
      });
      res.json({ thresholdSec, tables: staleTables });
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Broadcast nudge to all tables in a session
  app.post("/api/sessions/:id/broadcast-nudge", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { type, message, priority } = req.body;
      const key = `broadcast:${sessionId}`;
      if (!canSendNudge(key, BROADCAST_RATE_LIMIT_MS)) {
        return res.status(429).json({ error: "Broadcast rate limit exceeded. Try again shortly." });
      }
      const tables = await storage.getTablesBySession(sessionId);
      
      const nudges = await Promise.all(
        tables.map(table => 
          storage.createNudge({ tableId: table.id, sessionId, type, message, priority })
        )
      );
      markNudgeSent(key);
      
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
      const event = await storage.getEvent(session.eventId);
      const allowQuotes = event?.allowQuotes ?? false;

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
          notableQuotes: allowQuotes ? result.notableQuotes || [] : [],
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

  app.post("/api/sessions/:id/tables/import-csv", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { csv } = req.body;
      if (!csv || typeof csv !== "string") {
        return res.status(400).json({ error: "CSV content is required" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const rows = parseCsvRows(csv);
      const errors: Array<{ row: number; message: string }> = [];
      const createdTables = [];
      let nextTableNumber = 1;

      const existingTables = await storage.getTablesBySession(sessionId);
      if (existingTables.length > 0) {
        const maxExisting = Math.max(...existingTables.map((t) => t.tableNumber));
        nextTableNumber = maxExisting + 1;
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0) continue;

        let tableNumber: number | null = null;
        let topic = "";

        if (row.length === 1) {
          topic = row[0];
        } else {
          const parsedNumber = parseInt(row[0], 10);
          if (!Number.isNaN(parsedNumber)) {
            tableNumber = parsedNumber;
            topic = row.slice(1).join(",").trim();
          } else {
            topic = row.join(",").trim();
          }
        }

        if (!topic) {
          errors.push({ row: i + 1, message: "Missing topic" });
          continue;
        }

        const numberToUse = tableNumber ?? nextTableNumber++;
        const created = await storage.createTable({
          sessionId,
          tableNumber: numberToUse,
          topic,
          status: "inactive",
        });
        createdTables.push(created);
      }

      res.status(201).json({
        created: createdTables.length,
        errors,
        tables: createdTables,
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  app.get("/api/sessions/:id/qr-sheet", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).send("Session not found");
      }
      const tables = await storage.getTablesBySession(sessionId);
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const html = buildQrSheetHtml(session.name, tables, baseUrl);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Error generating QR sheet:", error);
      res.status(500).send("Failed to generate QR sheet");
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
      const allowQuotes = event.allowQuotes ?? false;

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
          notableQuotes: allowQuotes ? result.notableQuotes || [] : [],
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

  // Event theme map
  app.get("/api/events/:id/theme-map", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const themeCounts = new Map<string, number>();
      summaries.forEach((summary) => {
        const themes = (summary.themes as string[]) || [];
        themes.forEach((theme) => {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
        });
      });
      const themeMap = Array.from(themeCounts.entries())
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      res.json({ eventName: event.name, themes: themeMap });
    } catch (error) {
      console.error("Error fetching theme map:", error);
      res.status(500).json({ error: "Failed to fetch theme map" });
    }
  });

  // Event sentiment pulse
  app.get("/api/events/:id/pulse", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      if (summaries.length === 0) {
        return res.json({ averageSentiment: null, averageConfidence: null, samples: 0 });
      }
      const scored = summaries.filter((summary) => summary.sentimentScore !== null && summary.sentimentConfidence !== null);
      if (scored.length === 0) {
        return res.json({ averageSentiment: null, averageConfidence: null, samples: 0 });
      }
      const totalSentiment = scored.reduce((sum, s) => sum + (s.sentimentScore || 0), 0);
      const totalConfidence = scored.reduce((sum, s) => sum + (s.sentimentConfidence || 0), 0);
      res.json({
        averageSentiment: Math.round(totalSentiment / scored.length),
        averageConfidence: Math.round(totalConfidence / scored.length),
        samples: scored.length,
      });
    } catch (error) {
      console.error("Error fetching pulse:", error);
      res.status(500).json({ error: "Failed to fetch pulse" });
    }
  });

  // Redaction tasks
  app.get("/api/redaction-tasks", async (req: Request, res: Response) => {
    try {
      const eventId = req.query.eventId ? parseInt(req.query.eventId as string, 10) : undefined;
      const tasks = await storage.getPendingRedactionTasks(eventId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching redaction tasks:", error);
      res.status(500).json({ error: "Failed to fetch redaction tasks" });
    }
  });

  app.post("/api/redaction-tasks", async (req: Request, res: Response) => {
    try {
      const task = await storage.createRedactionTask(req.body);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating redaction task:", error);
      res.status(500).json({ error: "Failed to create redaction task" });
    }
  });

  app.patch("/api/redaction-tasks/:id", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.updateRedactionTask(taskId, req.body);
      if (!task) {
        return res.status(404).json({ error: "Redaction task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating redaction task:", error);
      res.status(500).json({ error: "Failed to update redaction task" });
    }
  });

  // Share links
  app.post("/api/share-links", async (req: Request, res: Response) => {
    try {
      const token = generateShareToken();
      const link = await storage.createShareLink({ ...req.body, token });
      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  app.get("/api/share/:token", async (req: Request, res: Response) => {
    try {
      const link = await storage.getShareLinkByToken(req.params.token);
      if (!link) {
        return res.status(404).json({ error: "Share link not found" });
      }
      if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ error: "Share link expired" });
      }
      const sanitize = (summary: any) => {
        if (link.role !== "sponsor") return summary;
        return {
          id: summary.id,
          tableId: summary.tableId,
          content: summary.content,
          themes: summary.themes,
          actionItems: summary.actionItems,
          openQuestions: [],
        };
      };
      if (link.eventId) {
        const summaries = await storage.getAllSummariesForEvent(link.eventId);
        return res.json({ role: link.role, summaries: summaries.map(sanitize) });
      }
      if (link.sessionId) {
        const summaries = await storage.getAllSummariesForSession(link.sessionId);
        return res.json({ role: link.role, summaries: summaries.map(sanitize) });
      }
      res.json({ role: link.role, summaries: [] });
    } catch (error) {
      console.error("Error fetching share link:", error);
      res.status(500).json({ error: "Failed to fetch share link" });
    }
  });

  // Exports
  app.post("/api/exports", async (req: Request, res: Response) => {
    try {
      const job = await storage.createExportJob(req.body);
      await storage.createAuditLog({
        actor: req.body.requestedBy || "admin",
        action: "export_requested",
        entityType: "export",
        entityId: job.id,
        metadata: {
          destination: job.destination,
          eventId: job.eventId,
          sessionId: job.sessionId,
        },
      });
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating export job:", error);
      res.status(500).json({ error: "Failed to create export job" });
    }
  });

  app.patch("/api/exports/:id", async (req: Request, res: Response) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.updateExportJob(jobId, req.body);
      if (!job) {
        return res.status(404).json({ error: "Export job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error updating export job:", error);
      res.status(500).json({ error: "Failed to update export job" });
    }
  });

  // Attendee feedback
  app.post("/api/attendee/feedback", async (req: Request, res: Response) => {
    try {
      const feedback = await storage.createAttendeeFeedback(req.body);
      res.status(201).json(feedback);
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  // Digest subscriptions
  app.post("/api/events/:id/digest-subscribe", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const { contact, topic } = req.body;
      const subscription = await storage.createDigestSubscription({ eventId, contact, topic });
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating digest subscription:", error);
      res.status(500).json({ error: "Failed to create digest subscription" });
    }
  });

  // Search transcripts
  app.get("/api/events/:id/search", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const query = (req.query.q as string) || "";
      if (!query.trim()) {
        return res.json({ results: [] });
      }
      const results = await storage.searchTranscripts(eventId, query.trim());
      res.json({ results });
    } catch (error) {
      console.error("Error searching transcripts:", error);
      res.status(500).json({ error: "Failed to search transcripts" });
    }
  });

  // Ask Nutshell Q&A
  app.post("/api/events/:id/ask", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const { question } = req.body;
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const context = summaries.map((s) => s.content).join("\n\n").slice(0, 12000);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Answer the question using the event summaries. Be concise and de-identified." },
          { role: "user", content: `Question: ${question}\n\nSummaries:\n${context}` },
        ],
        max_completion_tokens: 600,
      });
      res.json({ answer: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error answering question:", error);
      res.status(500).json({ error: "Failed to answer question" });
    }
  });

  // Insight Pack generator
  app.get("/api/events/:id/insight-pack", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const context = summaries.map((s) => s.content).join("\n\n").slice(0, 12000);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Create a branded executive summary with top themes and action items. Return in markdown." },
          { role: "user", content: `Event: ${event.name}\n\n${context}` },
        ],
        max_completion_tokens: 1200,
      });
      res.json({ title: `${event.name} Insight Pack`, content: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating insight pack:", error);
      res.status(500).json({ error: "Failed to generate insight pack" });
    }
  });

  // Follow-up recommendations
  app.get("/api/events/:id/recommendations", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const context = summaries.map((s) => s.content).join("\n\n").slice(0, 12000);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Suggest 5 follow-up session topics based on these summaries." },
          { role: "user", content: context },
        ],
        max_completion_tokens: 400,
      });
      res.json({ recommendations: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // Recap generator
  app.get("/api/events/:id/recap", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const format = (req.query.format as string) || "text";
      const summaries = await storage.getAllSummariesForEvent(eventId);
      const content = summaries.map((s) => s.content).join("\n\n").slice(0, 12000);
      if (format === "html") {
        return res.send(`<html><body><h1>Event Recap</h1><pre>${content}</pre></body></html>`);
      }
      res.json({ content });
    } catch (error) {
      console.error("Error generating recap:", error);
      res.status(500).json({ error: "Failed to generate recap" });
    }
  });

  // Translate event summary
  app.post("/api/events/:id/translate-summary", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const { language } = req.body;
      const summary = await storage.getAllSummariesForEvent(eventId);
      const content = summary.map((s) => s.content).join("\n\n").slice(0, 8000);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Translate the following event summary accurately." },
          { role: "user", content: `Language: ${language}\n\n${content}` },
        ],
        max_completion_tokens: 1200,
      });
      res.json({ translation: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error translating summary:", error);
      res.status(500).json({ error: "Failed to translate summary" });
    }
  });

  // Playbooks
  app.get("/api/playbooks", async (_req: Request, res: Response) => {
    try {
      const playbooks = await storage.getPlaybooks();
      res.json(playbooks);
    } catch (error) {
      console.error("Error fetching playbooks:", error);
      res.status(500).json({ error: "Failed to fetch playbooks" });
    }
  });

  app.post("/api/playbooks", async (req: Request, res: Response) => {
    try {
      const playbook = await storage.createPlaybook(req.body);
      res.status(201).json(playbook);
    } catch (error) {
      console.error("Error creating playbook:", error);
      res.status(500).json({ error: "Failed to create playbook" });
    }
  });

  app.post("/api/playbooks/seed-defaults", async (_req: Request, res: Response) => {
    try {
      const existing = await storage.getPlaybooks();
      if (existing.length > 0) {
        return res.json({ created: 0, playbooks: existing });
      }

      const workshop45 = await storage.createPlaybook({
        name: "45-min Workshop",
        description: "Structured 45-minute session with time warnings and prompt shifts.",
        durationMinutes: 45,
      });
      const roundtable90 = await storage.createPlaybook({
        name: "90-min Roundtable",
        description: "Extended roundtable with two prompt shifts and wrap-up nudges.",
        durationMinutes: 90,
      });

      const steps = [
        { playbookId: workshop45.id, offsetMinutes: 20, message: "Shift to next prompt", priority: "normal" },
        { playbookId: workshop45.id, offsetMinutes: 35, message: "5 minutes remaining", priority: "urgent" },
        { playbookId: workshop45.id, offsetMinutes: 40, message: "Please wrap up and capture takeaways", priority: "urgent" },
        { playbookId: roundtable90.id, offsetMinutes: 30, message: "Check in: capture emerging themes", priority: "normal" },
        { playbookId: roundtable90.id, offsetMinutes: 60, message: "Shift to final prompt", priority: "normal" },
        { playbookId: roundtable90.id, offsetMinutes: 85, message: "5 minutes remaining", priority: "urgent" },
      ];

      const createdSteps = await Promise.all(steps.map((step) => storage.createPlaybookStep(step)));
      res.json({ created: 2, playbooks: [workshop45, roundtable90], steps: createdSteps });
    } catch (error) {
      console.error("Error seeding playbooks:", error);
      res.status(500).json({ error: "Failed to seed playbooks" });
    }
  });

  app.get("/api/playbooks/:id/steps", async (req: Request, res: Response) => {
    try {
      const playbookId = parseInt(req.params.id);
      const steps = await storage.getPlaybookSteps(playbookId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching playbook steps:", error);
      res.status(500).json({ error: "Failed to fetch playbook steps" });
    }
  });

  app.post("/api/playbooks/:id/steps", async (req: Request, res: Response) => {
    try {
      const playbookId = parseInt(req.params.id);
      const step = await storage.createPlaybookStep({ ...req.body, playbookId });
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating playbook step:", error);
      res.status(500).json({ error: "Failed to create playbook step" });
    }
  });

  app.post("/api/sessions/:id/playbook/start", async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { playbookId } = req.body;
      const playbook = await storage.getPlaybook(playbookId);
      if (!playbook) {
        return res.status(404).json({ error: "Playbook not found" });
      }
      const steps = await storage.getPlaybookSteps(playbookId);
      const tables = await storage.getTablesBySession(sessionId);
      const session = await storage.getSession(sessionId);

      const run = await storage.createPlaybookRun({ sessionId, playbookId });
      const now = Date.now();

      const nudges = await Promise.all(
        steps.flatMap((step) =>
          tables.map((table) =>
            storage.createNudge({
              eventId: session?.eventId,
              sessionId,
              tableId: table.id,
              type: "playbook",
              message: step.message,
              priority: step.priority,
              scheduledAt: new Date(now + step.offsetMinutes * 60000),
            })
          )
        )
      );

      res.status(201).json({ run, nudges: nudges.flat() });
    } catch (error) {
      console.error("Error starting playbook:", error);
      res.status(500).json({ error: "Failed to start playbook" });
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
