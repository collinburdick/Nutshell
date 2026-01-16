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
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Sessions - Breakout sessions within an event
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  topic: text("topic"),
  discussionGuide: jsonb("discussion_guide"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("pending"),
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

// Summaries - AI-generated rolling summaries
export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("rolling"),
  content: text("content").notNull(),
  themes: jsonb("themes"),
  actionItems: jsonb("action_items"),
  openQuestions: jsonb("open_questions"),
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
  acknowledgedAt: timestamp("acknowledged_at"),
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
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  event: one(events, { fields: [sessions.eventId], references: [events.id] }),
  tables: many(tables),
  nudges: many(nudges),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  session: one(sessions, { fields: [tables.sessionId], references: [sessions.id] }),
  facilitators: many(facilitators),
  transcripts: many(transcripts),
  summaries: many(summaries),
  nudges: many(nudges),
}));

export const facilitatorsRelations = relations(facilitators, ({ one }) => ({
  table: one(tables, { fields: [facilitators.tableId], references: [tables.id] }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  table: one(tables, { fields: [transcripts.tableId], references: [tables.id] }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  table: one(tables, { fields: [summaries.tableId], references: [tables.id] }),
}));

export const nudgesRelations = relations(nudges, ({ one }) => ({
  event: one(events, { fields: [nudges.eventId], references: [events.id] }),
  session: one(sessions, { fields: [nudges.sessionId], references: [sessions.id] }),
  table: one(tables, { fields: [nudges.tableId], references: [tables.id] }),
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
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });
export const insertNudgeSchema = createInsertSchema(nudges).omit({ id: true, sentAt: true });
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
export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Nudge = typeof nudges.$inferSelect;
export type InsertNudge = z.infer<typeof insertNudgeSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
