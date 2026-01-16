import { sql, relations } from "drizzle-orm";
import { pgTable, serial, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Events - Top level container for conferences
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("draft"),
  privacyMode: text("privacy_mode").notNull().default("strict"),
  retainAudio: boolean("retain_audio").notNull().default(false),
  allowQuotes: boolean("allow_quotes").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sessions - Breakout sessions within an event
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  topic: text("topic"),
  discussionGuide: jsonb("discussion_guide"),
  agendaPhases: jsonb("agenda_phases"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("pending"),
  privacyMode: text("privacy_mode"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Tables - Individual roundtables within a session
export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  tableNumber: integer("table_number").notNull(),
  topic: text("topic"),
  joinCode: varchar("join_code", { length: 8 }).notNull().unique(),
  status: text("status").notNull().default("inactive"),
  lastActivityAt: timestamp("last_activity_at"),
  lastAudioAt: timestamp("last_audio_at"),
  lastTranscriptAt: timestamp("last_transcript_at"),
  lastSummaryAt: timestamp("last_summary_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Facilitators - Temporary session-based identities
export const facilitators = pgTable("facilitators", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSeenAt: timestamp("last_seen_at"),
});

// Transcripts - De-identified conversation segments
export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  speakerTag: text("speaker_tag"),
  content: text("content").notNull(),
  originalContent: text("original_content"),
  confidenceScore: integer("confidence_score"),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Transcript lines - verbatim timecoded evidence
export const transcriptLines = pgTable("transcript_lines", {
  id: serial("id").primaryKey(),
  transcriptId: integer("transcript_id").notNull().references(() => transcripts.id, { onDelete: "cascade" }),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  speakerTag: text("speaker_tag"),
  content: text("content").notNull(),
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  redacted: boolean("redacted").notNull().default(false),
  piiTags: jsonb("pii_tags"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Summaries - AI-generated rolling summaries
export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("rolling"),
  content: text("content").notNull(),
  themes: jsonb("themes"),
  actionItems: jsonb("action_items"),
  openQuestions: jsonb("open_questions"),
  sentimentScore: integer("sentiment_score"),
  sentimentConfidence: integer("sentiment_confidence"),
  missingAngles: jsonb("missing_angles"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Evidence links - maps insights to verbatim lines
export const evidenceLinks = pgTable("evidence_links", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").references(() => summaries.id, { onDelete: "cascade" }),
  transcriptLineId: integer("transcript_line_id").references(() => transcriptLines.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Quote bank - curated transcript clips
export const quoteBank = pgTable("quote_bank", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  transcriptLineId: integer("transcript_line_id").references(() => transcriptLines.id, { onDelete: "set null" }),
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  governance: text("governance").notNull().default("internal"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Nudges - Admin-initiated messages to facilitators
export const nudges = pgTable("nudges", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  tableId: integer("table_id").references(() => tables.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  sentAt: timestamp("sent_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
});

export const nudgeDeliveries = pgTable("nudge_deliveries", {
  id: serial("id").primaryKey(),
  nudgeId: integer("nudge_id").notNull().references(() => nudges.id, { onDelete: "cascade" }),
  facilitatorId: integer("facilitator_id").references(() => facilitators.id, { onDelete: "set null" }),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playbooks = pgTable("playbooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playbookSteps = pgTable("playbook_steps", {
  id: serial("id").primaryKey(),
  playbookId: integer("playbook_id").notNull().references(() => playbooks.id, { onDelete: "cascade" }),
  offsetMinutes: integer("offset_minutes").notNull(),
  type: text("type").notNull().default("nudge"),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
});

export const playbookRuns = pgTable("playbook_runs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  playbookId: integer("playbook_id").notNull().references(() => playbooks.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  endedAt: timestamp("ended_at"),
});

export const redactionTasks = pgTable("redaction_tasks", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  summaryId: integer("summary_id").references(() => summaries.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  inputText: text("input_text").notNull(),
  redactedText: text("redacted_text"),
  reviewer: text("reviewer"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  tableId: integer("table_id").references(() => tables.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const exports = pgTable("exports", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  payload: jsonb("payload"),
  status: text("status").notNull().default("queued"),
  requestedBy: text("requested_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  tableId: integer("table_id").references(() => tables.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const openQuestions = pgTable("open_questions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  votes: integer("votes").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const parkingLotItems = pgTable("parking_lot_items", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const goldenNuggets = pgTable("golden_nuggets", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const summaryTranslations = pgTable("summary_translations", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").notNull().references(() => summaries.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const attendeeFeedback = pgTable("attendee_feedback", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  rating: integer("rating"),
  comments: text("comments"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const digestSubscriptions = pgTable("digest_subscriptions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  topic: text("topic"),
  contact: text("contact").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Audit logs - compliance trail
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Investigations + collections for Explore tab
export const investigations = pgTable("investigations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  query: text("query").notNull(),
  filters: jsonb("filters"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const collectionItems = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  transcriptLineId: integer("transcript_line_id").references(() => transcriptLines.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Chat models for AI integrations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const eventsRelations = relations(events, ({ many }) => ({
  sessions: many(sessions),
  nudges: many(nudges),
  shareLinks: many(shareLinks),
  exports: many(exports),
  actionItems: many(actionItems),
  openQuestions: many(openQuestions),
  redactionTasks: many(redactionTasks),
  attendeeFeedback: many(attendeeFeedback),
  digestSubscriptions: many(digestSubscriptions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  event: one(events, { fields: [sessions.eventId], references: [events.id] }),
  tables: many(tables),
  nudges: many(nudges),
  playbookRuns: many(playbookRuns),
  exports: many(exports),
  actionItems: many(actionItems),
  openQuestions: many(openQuestions),
  redactionTasks: many(redactionTasks),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  session: one(sessions, { fields: [tables.sessionId], references: [sessions.id] }),
  facilitators: many(facilitators),
  transcripts: many(transcripts),
  summaries: many(summaries),
  nudges: many(nudges),
  actionItems: many(actionItems),
  parkingLotItems: many(parkingLotItems),
  goldenNuggets: many(goldenNuggets),
}));

export const facilitatorsRelations = relations(facilitators, ({ one }) => ({
  table: one(tables, { fields: [facilitators.tableId], references: [tables.id] }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  table: one(tables, { fields: [transcripts.tableId], references: [tables.id] }),
}));

export const transcriptLinesRelations = relations(transcriptLines, ({ one, many }) => ({
  transcript: one(transcripts, { fields: [transcriptLines.transcriptId], references: [transcripts.id] }),
  table: one(tables, { fields: [transcriptLines.tableId], references: [tables.id] }),
  evidenceLinks: many(evidenceLinks),
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  table: one(tables, { fields: [summaries.tableId], references: [tables.id] }),
  translations: many(summaryTranslations),
}));

export const nudgesRelations = relations(nudges, ({ one, many }) => ({
  event: one(events, { fields: [nudges.eventId], references: [events.id] }),
  session: one(sessions, { fields: [nudges.sessionId], references: [sessions.id] }),
  table: one(tables, { fields: [nudges.tableId], references: [tables.id] }),
  deliveries: many(nudgeDeliveries),
}));

export const evidenceLinksRelations = relations(evidenceLinks, ({ one }) => ({
  summary: one(summaries, { fields: [evidenceLinks.summaryId], references: [summaries.id] }),
  transcriptLine: one(transcriptLines, { fields: [evidenceLinks.transcriptLineId], references: [transcriptLines.id] }),
}));

export const quoteBankRelations = relations(quoteBank, ({ one }) => ({
  table: one(tables, { fields: [quoteBank.tableId], references: [tables.id] }),
  transcriptLine: one(transcriptLines, { fields: [quoteBank.transcriptLineId], references: [transcriptLines.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  event: one(events, { fields: [auditLogs.entityId], references: [events.id] }),
}));

export const investigationsRelations = relations(investigations, ({ one }) => ({
  event: one(events, { fields: [investigations.eventId], references: [events.id] }),
}));

export const collectionsRelations = relations(collections, ({ many, one }) => ({
  event: one(events, { fields: [collections.eventId], references: [events.id] }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, { fields: [collectionItems.collectionId], references: [collections.id] }),
  transcriptLine: one(transcriptLines, { fields: [collectionItems.transcriptLineId], references: [transcriptLines.id] }),
}));

export const nudgeDeliveriesRelations = relations(nudgeDeliveries, ({ one }) => ({
  nudge: one(nudges, { fields: [nudgeDeliveries.nudgeId], references: [nudges.id] }),
  facilitator: one(facilitators, { fields: [nudgeDeliveries.facilitatorId], references: [facilitators.id] }),
}));

export const playbooksRelations = relations(playbooks, ({ many }) => ({
  steps: many(playbookSteps),
  runs: many(playbookRuns),
}));

export const playbookStepsRelations = relations(playbookSteps, ({ one }) => ({
  playbook: one(playbooks, { fields: [playbookSteps.playbookId], references: [playbooks.id] }),
}));

export const playbookRunsRelations = relations(playbookRuns, ({ one }) => ({
  playbook: one(playbooks, { fields: [playbookRuns.playbookId], references: [playbooks.id] }),
  session: one(sessions, { fields: [playbookRuns.sessionId], references: [sessions.id] }),
}));

export const redactionTasksRelations = relations(redactionTasks, ({ one }) => ({
  event: one(events, { fields: [redactionTasks.eventId], references: [events.id] }),
  session: one(sessions, { fields: [redactionTasks.sessionId], references: [sessions.id] }),
  summary: one(summaries, { fields: [redactionTasks.summaryId], references: [summaries.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  event: one(events, { fields: [shareLinks.eventId], references: [events.id] }),
  session: one(sessions, { fields: [shareLinks.sessionId], references: [sessions.id] }),
  table: one(tables, { fields: [shareLinks.tableId], references: [tables.id] }),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  event: one(events, { fields: [exports.eventId], references: [events.id] }),
  session: one(sessions, { fields: [exports.sessionId], references: [sessions.id] }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  event: one(events, { fields: [actionItems.eventId], references: [events.id] }),
  session: one(sessions, { fields: [actionItems.sessionId], references: [sessions.id] }),
  table: one(tables, { fields: [actionItems.tableId], references: [tables.id] }),
}));

export const openQuestionsRelations = relations(openQuestions, ({ one }) => ({
  event: one(events, { fields: [openQuestions.eventId], references: [events.id] }),
  session: one(sessions, { fields: [openQuestions.sessionId], references: [sessions.id] }),
}));

export const parkingLotRelations = relations(parkingLotItems, ({ one }) => ({
  table: one(tables, { fields: [parkingLotItems.tableId], references: [tables.id] }),
}));

export const goldenNuggetsRelations = relations(goldenNuggets, ({ one }) => ({
  table: one(tables, { fields: [goldenNuggets.tableId], references: [tables.id] }),
}));

export const summaryTranslationsRelations = relations(summaryTranslations, ({ one }) => ({
  summary: one(summaries, { fields: [summaryTranslations.summaryId], references: [summaries.id] }),
}));

export const attendeeFeedbackRelations = relations(attendeeFeedback, ({ one }) => ({
  event: one(events, { fields: [attendeeFeedback.eventId], references: [events.id] }),
  session: one(sessions, { fields: [attendeeFeedback.sessionId], references: [sessions.id] }),
}));

export const digestSubscriptionsRelations = relations(digestSubscriptions, ({ one }) => ({
  event: one(events, { fields: [digestSubscriptions.eventId], references: [events.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

// Zod schemas
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertTableSchema = createInsertSchema(tables).omit({ id: true, createdAt: true });
export const insertFacilitatorSchema = createInsertSchema(facilitators).omit({ id: true, joinedAt: true });
export const insertTranscriptSchema = createInsertSchema(transcripts).omit({ id: true, timestamp: true });
export const insertTranscriptLineSchema = createInsertSchema(transcriptLines).omit({ id: true, createdAt: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });
export const insertEvidenceLinkSchema = createInsertSchema(evidenceLinks).omit({ id: true, createdAt: true });
export const insertQuoteBankSchema = createInsertSchema(quoteBank).omit({ id: true, createdAt: true });
export const insertNudgeSchema = createInsertSchema(nudges).omit({ id: true, sentAt: true });
export const insertNudgeDeliverySchema = createInsertSchema(nudgeDeliveries).omit({ id: true, createdAt: true });
export const insertPlaybookSchema = createInsertSchema(playbooks).omit({ id: true, createdAt: true });
export const insertPlaybookStepSchema = createInsertSchema(playbookSteps).omit({ id: true });
export const insertPlaybookRunSchema = createInsertSchema(playbookRuns).omit({ id: true, startedAt: true });
export const insertRedactionTaskSchema = createInsertSchema(redactionTasks).omit({ id: true, createdAt: true });
export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({ id: true, createdAt: true });
export const insertExportSchema = createInsertSchema(exports).omit({ id: true, createdAt: true });
export const insertActionItemSchema = createInsertSchema(actionItems).omit({ id: true, createdAt: true });
export const insertOpenQuestionSchema = createInsertSchema(openQuestions).omit({ id: true, createdAt: true });
export const insertParkingLotSchema = createInsertSchema(parkingLotItems).omit({ id: true, createdAt: true });
export const insertGoldenNuggetSchema = createInsertSchema(goldenNuggets).omit({ id: true, createdAt: true });
export const insertSummaryTranslationSchema = createInsertSchema(summaryTranslations).omit({ id: true, createdAt: true });
export const insertAttendeeFeedbackSchema = createInsertSchema(attendeeFeedback).omit({ id: true, createdAt: true });
export const insertDigestSubscriptionSchema = createInsertSchema(digestSubscriptions).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertInvestigationSchema = createInsertSchema(investigations).omit({ id: true, createdAt: true });
export const insertCollectionSchema = createInsertSchema(collections).omit({ id: true, createdAt: true });
export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({ id: true, createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

// Types
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Table = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Facilitator = typeof facilitators.$inferSelect;
export type InsertFacilitator = z.infer<typeof insertFacilitatorSchema>;
export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type TranscriptLine = typeof transcriptLines.$inferSelect;
export type InsertTranscriptLine = z.infer<typeof insertTranscriptLineSchema>;
export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type EvidenceLink = typeof evidenceLinks.$inferSelect;
export type InsertEvidenceLink = z.infer<typeof insertEvidenceLinkSchema>;
export type QuoteBank = typeof quoteBank.$inferSelect;
export type InsertQuoteBank = z.infer<typeof insertQuoteBankSchema>;
export type Nudge = typeof nudges.$inferSelect;
export type InsertNudge = z.infer<typeof insertNudgeSchema>;
export type NudgeDelivery = typeof nudgeDeliveries.$inferSelect;
export type InsertNudgeDelivery = z.infer<typeof insertNudgeDeliverySchema>;
export type Playbook = typeof playbooks.$inferSelect;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
export type PlaybookStep = typeof playbookSteps.$inferSelect;
export type InsertPlaybookStep = z.infer<typeof insertPlaybookStepSchema>;
export type PlaybookRun = typeof playbookRuns.$inferSelect;
export type InsertPlaybookRun = z.infer<typeof insertPlaybookRunSchema>;
export type RedactionTask = typeof redactionTasks.$inferSelect;
export type InsertRedactionTask = z.infer<typeof insertRedactionTaskSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ExportJob = typeof exports.$inferSelect;
export type InsertExportJob = z.infer<typeof insertExportSchema>;
export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type OpenQuestion = typeof openQuestions.$inferSelect;
export type InsertOpenQuestion = z.infer<typeof insertOpenQuestionSchema>;
export type ParkingLotItem = typeof parkingLotItems.$inferSelect;
export type InsertParkingLotItem = z.infer<typeof insertParkingLotSchema>;
export type GoldenNugget = typeof goldenNuggets.$inferSelect;
export type InsertGoldenNugget = z.infer<typeof insertGoldenNuggetSchema>;
export type SummaryTranslation = typeof summaryTranslations.$inferSelect;
export type InsertSummaryTranslation = z.infer<typeof insertSummaryTranslationSchema>;
export type AttendeeFeedback = typeof attendeeFeedback.$inferSelect;
export type InsertAttendeeFeedback = z.infer<typeof insertAttendeeFeedbackSchema>;
export type DigestSubscription = typeof digestSubscriptions.$inferSelect;
export type InsertDigestSubscription = z.infer<typeof insertDigestSubscriptionSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Investigation = typeof investigations.$inferSelect;
export type InsertInvestigation = z.infer<typeof insertInvestigationSchema>;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
