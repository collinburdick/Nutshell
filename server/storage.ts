import { db } from "./db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import {
  events, sessions, tables, facilitators, transcripts, summaries, nudges,
  type Event, type InsertEvent,
  type Session, type InsertSession,
  type Table, type InsertTable,
  type Facilitator, type InsertFacilitator,
  type Transcript, type InsertTranscript,
  type Summary, type InsertSummary,
  type Nudge, type InsertNudge,
} from "@shared/schema";
import { randomBytes } from "crypto";

function generateJoinCode(): string {
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export interface IStorage {
  // Events
  getEvent(id: number): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  createEvent(data: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<void>;

  // Sessions
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByEvent(eventId: number): Promise<Session[]>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: number, data: Partial<InsertSession>): Promise<Session | undefined>;

  // Tables
  getTable(id: number): Promise<Table | undefined>;
  getTableByJoinCode(joinCode: string): Promise<Table | undefined>;
  getTablesBySession(sessionId: number): Promise<Table[]>;
  createTable(data: Omit<InsertTable, "joinCode">): Promise<Table>;
  updateTable(id: number, data: Partial<InsertTable>): Promise<Table | undefined>;

  // Facilitators
  getFacilitator(id: number): Promise<Facilitator | undefined>;
  getFacilitatorByToken(token: string): Promise<Facilitator | undefined>;
  getFacilitatorsByTable(tableId: number): Promise<Facilitator[]>;
  createFacilitator(tableId: number, deviceName?: string): Promise<Facilitator>;
  updateFacilitatorActivity(id: number): Promise<void>;

  // Transcripts
  getTranscriptsByTable(tableId: number): Promise<Transcript[]>;
  createTranscript(data: InsertTranscript): Promise<Transcript>;

  // Summaries
  getLatestSummary(tableId: number): Promise<Summary | undefined>;
  getSummariesByTable(tableId: number): Promise<Summary[]>;
  createSummary(data: InsertSummary): Promise<Summary>;

  // Nudges
  getPendingNudges(tableId: number): Promise<Nudge[]>;
  createNudge(data: InsertNudge): Promise<Nudge>;
  acknowledgeNudge(id: number): Promise<void>;

  // Admin
  getAllActiveTables(): Promise<Array<Table & { sessionName: string; eventName: string }>>;

  // Aggregated summaries
  getAllSummariesForSession(sessionId: number): Promise<Summary[]>;
  getAllSummariesForEvent(eventId: number): Promise<Summary[]>;
}

export class DatabaseStorage implements IStorage {
  // Events
  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getAllEvents(): Promise<Event[]> {
    return db.select().from(events).orderBy(desc(events.createdAt));
  }

  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(data).returning();
    return event;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return event;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Sessions
  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionsByEvent(eventId: number): Promise<Session[]> {
    return db.select().from(sessions).where(eq(sessions.eventId, eventId)).orderBy(sessions.startTime);
  }

  async createSession(data: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(data).returning();
    return session;
  }

  async updateSession(id: number, data: Partial<InsertSession>): Promise<Session | undefined> {
    const [session] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return session;
  }

  // Tables
  async getTable(id: number): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table;
  }

  async getTableByJoinCode(joinCode: string): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.joinCode, joinCode.toUpperCase()));
    return table;
  }

  async getTablesBySession(sessionId: number): Promise<Table[]> {
    return db.select().from(tables).where(eq(tables.sessionId, sessionId)).orderBy(tables.tableNumber);
  }

  async createTable(data: Omit<InsertTable, "joinCode">): Promise<Table> {
    const joinCode = generateJoinCode();
    const [table] = await db.insert(tables).values({ ...data, joinCode }).returning();
    return table;
  }

  async updateTable(id: number, data: Partial<InsertTable>): Promise<Table | undefined> {
    const [table] = await db.update(tables).set(data).where(eq(tables.id, id)).returning();
    return table;
  }

  // Facilitators
  async getFacilitator(id: number): Promise<Facilitator | undefined> {
    const [facilitator] = await db.select().from(facilitators).where(eq(facilitators.id, id));
    return facilitator;
  }

  async getFacilitatorByToken(token: string): Promise<Facilitator | undefined> {
    const [facilitator] = await db.select().from(facilitators).where(eq(facilitators.token, token));
    return facilitator;
  }

  async getFacilitatorsByTable(tableId: number): Promise<Facilitator[]> {
    return db.select().from(facilitators).where(eq(facilitators.tableId, tableId));
  }

  async createFacilitator(tableId: number, deviceName?: string): Promise<Facilitator> {
    const token = generateToken();
    const [facilitator] = await db.insert(facilitators).values({
      tableId,
      token,
      deviceName,
      isActive: true,
    }).returning();
    return facilitator;
  }

  async updateFacilitatorActivity(id: number): Promise<void> {
    await db.update(facilitators).set({ lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(facilitators.id, id));
  }

  // Transcripts
  async getTranscriptsByTable(tableId: number): Promise<Transcript[]> {
    return db.select().from(transcripts).where(eq(transcripts.tableId, tableId)).orderBy(transcripts.timestamp);
  }

  async createTranscript(data: InsertTranscript): Promise<Transcript> {
    const [transcript] = await db.insert(transcripts).values(data).returning();
    return transcript;
  }

  // Summaries
  async getLatestSummary(tableId: number): Promise<Summary | undefined> {
    const [summary] = await db.select().from(summaries)
      .where(eq(summaries.tableId, tableId))
      .orderBy(desc(summaries.createdAt))
      .limit(1);
    return summary;
  }

  async getSummariesByTable(tableId: number): Promise<Summary[]> {
    return db.select().from(summaries).where(eq(summaries.tableId, tableId)).orderBy(desc(summaries.createdAt));
  }

  async createSummary(data: InsertSummary): Promise<Summary> {
    const [summary] = await db.insert(summaries).values(data).returning();
    return summary;
  }

  // Nudges
  async getPendingNudges(tableId: number): Promise<Nudge[]> {
    return db.select().from(nudges)
      .where(and(eq(nudges.tableId, tableId), isNull(nudges.acknowledgedAt)))
      .orderBy(nudges.sentAt);
  }

  async createNudge(data: InsertNudge): Promise<Nudge> {
    const [nudge] = await db.insert(nudges).values(data).returning();
    return nudge;
  }

  async acknowledgeNudge(id: number): Promise<void> {
    await db.update(nudges).set({ acknowledgedAt: sql`CURRENT_TIMESTAMP` }).where(eq(nudges.id, id));
  }

  // Admin
  async getAllActiveTables(): Promise<Array<Table & { sessionName: string; eventName: string }>> {
    const result = await db
      .select({
        id: tables.id,
        sessionId: tables.sessionId,
        tableNumber: tables.tableNumber,
        topic: tables.topic,
        joinCode: tables.joinCode,
        status: tables.status,
        lastActivityAt: tables.lastActivityAt,
        createdAt: tables.createdAt,
        sessionName: sessions.name,
        eventName: events.name,
      })
      .from(tables)
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .innerJoin(events, eq(sessions.eventId, events.id))
      .where(eq(tables.status, "active"))
      .orderBy(desc(tables.lastActivityAt));
    return result;
  }

  // Aggregated summaries
  async getAllSummariesForSession(sessionId: number): Promise<Summary[]> {
    const sessionTables = await db.select().from(tables).where(eq(tables.sessionId, sessionId));
    if (sessionTables.length === 0) return [];
    
    const tableIds = sessionTables.map(t => t.id);
    const allSummaries = await db.select().from(summaries)
      .where(sql`${summaries.tableId} IN ${tableIds}`)
      .orderBy(desc(summaries.createdAt));
    return allSummaries;
  }

  async getAllSummariesForEvent(eventId: number): Promise<Summary[]> {
    const eventSessions = await db.select().from(sessions).where(eq(sessions.eventId, eventId));
    if (eventSessions.length === 0) return [];
    
    const sessionIds = eventSessions.map(s => s.id);
    const eventTables = await db.select().from(tables)
      .where(sql`${tables.sessionId} IN ${sessionIds}`);
    if (eventTables.length === 0) return [];
    
    const tableIds = eventTables.map(t => t.id);
    const allSummaries = await db.select().from(summaries)
      .where(sql`${summaries.tableId} IN ${tableIds}`)
      .orderBy(desc(summaries.createdAt));
    return allSummaries;
  }
}

export const storage = new DatabaseStorage();
