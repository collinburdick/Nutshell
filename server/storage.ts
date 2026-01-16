import { db } from "./db";
import { eq, desc, and, isNull, sql, gte, lte, asc, inArray } from "drizzle-orm";
import {
  events, sessions, tables, facilitators, transcripts, summaries, nudges,
  playbooks, playbookSteps, playbookRuns, redactionTasks, shareLinks, exports,
  actionItems, parkingLotItems, goldenNuggets, summaryTranslations, attendeeFeedback,
  nudgeDeliveries, openQuestions, digestSubscriptions,
  transcriptLines, evidenceLinks, quoteBank, auditLogs, investigations, collections, collectionItems,
  type Event, type InsertEvent,
  type Session, type InsertSession,
  type Table, type InsertTable,
  type Facilitator, type InsertFacilitator,
  type Transcript, type InsertTranscript,
  type Summary, type InsertSummary,
  type Nudge, type InsertNudge,
  type NudgeDelivery, type InsertNudgeDelivery,
  type Playbook, type InsertPlaybook,
  type PlaybookStep, type InsertPlaybookStep,
  type PlaybookRun, type InsertPlaybookRun,
  type RedactionTask, type InsertRedactionTask,
  type ShareLink, type InsertShareLink,
  type ExportJob, type InsertExportJob,
  type ActionItem, type InsertActionItem,
  type OpenQuestion, type InsertOpenQuestion,
  type ParkingLotItem, type InsertParkingLotItem,
  type GoldenNugget, type InsertGoldenNugget,
  type SummaryTranslation, type InsertSummaryTranslation,
  type AttendeeFeedback, type InsertAttendeeFeedback,
  type DigestSubscription, type InsertDigestSubscription,
  type TranscriptLine, type InsertTranscriptLine,
  type EvidenceLink, type InsertEvidenceLink,
  type QuoteBank, type InsertQuoteBank,
  type AuditLog, type InsertAuditLog,
  type Investigation, type InsertInvestigation,
  type Collection, type InsertCollection,
  type CollectionItem, type InsertCollectionItem,
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
  getAllTables(): Promise<Table[]>;
  createTable(data: Omit<InsertTable, "joinCode">): Promise<Table>;
  updateTable(id: number, data: Partial<InsertTable>): Promise<Table | undefined>;

  // Facilitators
  getFacilitator(id: number): Promise<Facilitator | undefined>;
  getFacilitatorByToken(token: string): Promise<Facilitator | undefined>;
  getFacilitatorsByTable(tableId: number): Promise<Facilitator[]>;
  createFacilitator(tableId: number, deviceName?: string): Promise<Facilitator>;
  updateFacilitatorActivity(id: number): Promise<void>;
  deactivateFacilitatorsByTable(tableId: number): Promise<void>;

  // Transcripts
  getTranscriptsByTable(tableId: number): Promise<Transcript[]>;
  createTranscript(data: InsertTranscript): Promise<Transcript>;
  searchTranscripts(eventId: number, query: string): Promise<Transcript[]>;
  createTranscriptLine(data: InsertTranscriptLine): Promise<TranscriptLine>;
  getTranscriptLine(id: number): Promise<TranscriptLine | undefined>;
  getTranscriptLinesByIds(ids: number[]): Promise<TranscriptLine[]>;
  getTranscriptLinesByEvent(
    eventId: number,
    filters?: { sessionId?: number; tableId?: number; query?: string; limit?: number; offset?: number }
  ): Promise<TranscriptLine[]>;
  getTranscriptContext(lineId: number, beforeSeconds: number, afterSeconds: number): Promise<TranscriptLine[]>;
  countTranscriptLinesByEvent(
    eventId: number,
    filters?: { sessionId?: number; tableId?: number; query?: string }
  ): Promise<number>;
  getTranscriptLineTimestampsByTable(tableId: number): Promise<Date[]>;
  getEvidenceBatch(
    eventId: number,
    queries: string[]
  ): Promise<Array<{ query: string; count: number; topLine: TranscriptLine | null }>>;

  // Summaries
  getLatestSummary(tableId: number): Promise<Summary | undefined>;
  getSummariesByTable(tableId: number): Promise<Summary[]>;
  createSummary(data: InsertSummary): Promise<Summary>;
  getSummary(id: number): Promise<Summary | undefined>;

  // Evidence + quotes
  createEvidenceLink(data: InsertEvidenceLink): Promise<EvidenceLink>;
  getEvidenceLinksBySummary(summaryId: number): Promise<EvidenceLink[]>;
  createQuote(data: InsertQuoteBank): Promise<QuoteBank>;
  getQuote(id: number): Promise<QuoteBank | undefined>;
  updateQuote(id: number, data: Partial<InsertQuoteBank>): Promise<QuoteBank | undefined>;
  listQuotesByEvent(eventId: number): Promise<QuoteBank[]>;
  listQuotesByEventDetailed(eventId: number): Promise<Array<{ quote: QuoteBank; line: TranscriptLine | null; table: Table; session: Session }>>;

  // Nudges
  getPendingNudges(tableId: number): Promise<Nudge[]>;
  createNudge(data: InsertNudge): Promise<Nudge>;
  acknowledgeNudge(id: number): Promise<void>;
  getNudgeStatsByTable(tableId: number): Promise<{ sent: number; acknowledged: number; pending: number; delivered: number; opened: number }>;
  getNudgeStatsBySession(sessionId: number): Promise<{ sent: number; acknowledged: number; pending: number; delivered: number; opened: number }>;
  recordNudgeDelivery(data: InsertNudgeDelivery): Promise<NudgeDelivery>;
  updateNudge(id: number, data: Partial<InsertNudge>): Promise<Nudge | undefined>;
  getNudgeStatsByEvent(eventId: number): Promise<Array<{ tableId: number; sent: number; delivered: number; opened: number; acknowledged: number }>>;

  // Admin
  getAllActiveTables(): Promise<Array<Table & { sessionName: string; eventName: string }>>;

  // Aggregated summaries
  getAllSummariesForSession(sessionId: number): Promise<Summary[]>;
  getAllSummariesForEvent(eventId: number): Promise<Summary[]>;

  // Transcript intelligence
  getPiiIndicatorsByEvent(eventId: number): Promise<Array<{ tableId: number; redactedCount: number; totalCount: number }>>;
  getTranscriptCompletenessByEvent(eventId: number): Promise<Array<{ tableId: number; firstAt: Date | null; lastAt: Date | null; lineCount: number }>>;
  getHotTablesByEvent(eventId: number, sinceMinutes: number): Promise<Array<{ tableId: number; lineCount: number }>>;

  // Playbooks
  getPlaybooks(): Promise<Playbook[]>;
  getPlaybook(id: number): Promise<Playbook | undefined>;
  createPlaybook(data: InsertPlaybook): Promise<Playbook>;
  createPlaybookStep(data: InsertPlaybookStep): Promise<PlaybookStep>;
  getPlaybookSteps(playbookId: number): Promise<PlaybookStep[]>;
  createPlaybookRun(data: InsertPlaybookRun): Promise<PlaybookRun>;

  // Privacy & exports
  createRedactionTask(data: InsertRedactionTask): Promise<RedactionTask>;
  getPendingRedactionTasks(eventId?: number): Promise<RedactionTask[]>;
  updateRedactionTask(id: number, data: Partial<InsertRedactionTask>): Promise<RedactionTask | undefined>;
  createShareLink(data: InsertShareLink): Promise<ShareLink>;
  getShareLinkByToken(token: string): Promise<ShareLink | undefined>;
  createExportJob(data: InsertExportJob): Promise<ExportJob>;
  updateExportJob(id: number, data: Partial<InsertExportJob>): Promise<ExportJob | undefined>;

  // Facilitator highlights
  createActionItem(data: InsertActionItem): Promise<ActionItem>;
  listActionItemsByEvent(eventId: number): Promise<ActionItem[]>;
  listGoldenNuggetsByEvent(eventId: number): Promise<GoldenNugget[]>;
  createOpenQuestion(data: InsertOpenQuestion): Promise<OpenQuestion>;
  listOpenQuestionsByEvent(eventId: number): Promise<OpenQuestion[]>;
  upvoteOpenQuestion(id: number): Promise<OpenQuestion | undefined>;
  createParkingLotItem(data: InsertParkingLotItem): Promise<ParkingLotItem>;
  listParkingLotItems(tableId: number): Promise<ParkingLotItem[]>;
  createGoldenNugget(data: InsertGoldenNugget): Promise<GoldenNugget>;
  listGoldenNuggets(tableId: number): Promise<GoldenNugget[]>;
  createSummaryTranslation(data: InsertSummaryTranslation): Promise<SummaryTranslation>;
  getSummaryTranslations(summaryId: number): Promise<SummaryTranslation[]>;

  // Attendee feedback
  createAttendeeFeedback(data: InsertAttendeeFeedback): Promise<AttendeeFeedback>;

  // Digest subscriptions
  createDigestSubscription(data: InsertDigestSubscription): Promise<DigestSubscription>;

  // Audit logs
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  listAuditLogs(eventId: number): Promise<AuditLog[]>;

  // Explore
  createInvestigation(data: InsertInvestigation): Promise<Investigation>;
  listInvestigations(eventId: number): Promise<Investigation[]>;
  createCollection(data: InsertCollection): Promise<Collection>;
  listCollections(eventId: number): Promise<Collection[]>;
  addCollectionItem(data: InsertCollectionItem): Promise<CollectionItem>;
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

  async getAllTables(): Promise<Table[]> {
    return db.select().from(tables);
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

  async deactivateFacilitatorsByTable(tableId: number): Promise<void> {
    await db.update(facilitators).set({ isActive: false }).where(eq(facilitators.tableId, tableId));
  }

  // Transcripts
  async getTranscriptsByTable(tableId: number): Promise<Transcript[]> {
    return db.select().from(transcripts).where(eq(transcripts.tableId, tableId)).orderBy(transcripts.timestamp);
  }

  async createTranscript(data: InsertTranscript): Promise<Transcript> {
    const [transcript] = await db.insert(transcripts).values(data).returning();
    return transcript;
  }

  async searchTranscripts(eventId: number, query: string): Promise<Transcript[]> {
    const normalized = query.trim();
    const result = await db
      .select({ transcript: transcripts })
      .from(transcripts)
      .innerJoin(tables, eq(transcripts.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.eventId, eventId),
          normalized.length >= 3
            ? sql`to_tsvector('english', ${transcripts.content}) @@ plainto_tsquery('english', ${normalized})`
            : sql`${transcripts.content} ILIKE ${"%" + normalized + "%"}`
        )
      )
      .orderBy(desc(transcripts.timestamp))
      .limit(200);
    return result.map((row) => row.transcript);
  }

  async createTranscriptLine(data: InsertTranscriptLine): Promise<TranscriptLine> {
    const [line] = await db.insert(transcriptLines).values(data).returning();
    return line;
  }

  async getTranscriptLine(id: number): Promise<TranscriptLine | undefined> {
    const [line] = await db.select().from(transcriptLines).where(eq(transcriptLines.id, id));
    return line;
  }

  async getTranscriptLinesByIds(ids: number[]): Promise<TranscriptLine[]> {
    if (!ids.length) return [];
    return db.select().from(transcriptLines).where(inArray(transcriptLines.id, ids));
  }

  async getTranscriptLinesByEvent(
    eventId: number,
    filters?: { sessionId?: number; tableId?: number; query?: string; limit?: number; offset?: number }
  ): Promise<TranscriptLine[]> {
    const conditions = [eq(sessions.eventId, eventId)];
    if (filters?.sessionId) {
      conditions.push(eq(sessions.id, filters.sessionId));
    }
    if (filters?.tableId) {
      conditions.push(eq(tables.id, filters.tableId));
    }
    if (filters?.query) {
      const query = filters.query.trim();
      if (query.length >= 3) {
        conditions.push(
          sql`to_tsvector('english', ${transcriptLines.content}) @@ plainto_tsquery('english', ${query})`
        );
      } else {
        conditions.push(sql`${transcriptLines.content} ILIKE ${"%" + query + "%"}`);
      }
    }
    let query = db
      .select({ line: transcriptLines })
      .from(transcriptLines)
      .innerJoin(tables, eq(transcriptLines.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(and(...conditions))
      .orderBy(desc(transcriptLines.createdAt));
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    const limit = filters?.limit ?? 500;
    const result = await query.limit(limit);
    return result.map((row) => row.line);
  }

  async getTranscriptContext(lineId: number, beforeSeconds: number, afterSeconds: number): Promise<TranscriptLine[]> {
    const line = await this.getTranscriptLine(lineId);
    if (!line) return [];
    if (line.startMs !== null && line.startMs !== undefined) {
      const startMs = line.startMs - beforeSeconds * 1000;
      const endMs = line.startMs + afterSeconds * 1000;
      return db
        .select()
        .from(transcriptLines)
        .where(
          and(
            eq(transcriptLines.tableId, line.tableId),
            gte(transcriptLines.startMs, startMs),
            lte(transcriptLines.startMs, endMs)
          )
        )
        .orderBy(asc(transcriptLines.startMs));
    }
    const start = new Date(line.createdAt.getTime() - beforeSeconds * 1000);
    const end = new Date(line.createdAt.getTime() + afterSeconds * 1000);
    return db
      .select()
      .from(transcriptLines)
      .where(and(eq(transcriptLines.tableId, line.tableId), gte(transcriptLines.createdAt, start), lte(transcriptLines.createdAt, end)))
      .orderBy(transcriptLines.createdAt);
  }

  async countTranscriptLinesByEvent(
    eventId: number,
    filters?: { sessionId?: number; tableId?: number; query?: string }
  ): Promise<number> {
    const conditions = [eq(sessions.eventId, eventId)];
    if (filters?.sessionId) {
      conditions.push(eq(sessions.id, filters.sessionId));
    }
    if (filters?.tableId) {
      conditions.push(eq(tables.id, filters.tableId));
    }
    if (filters?.query) {
      const query = filters.query.trim();
      if (query.length >= 3) {
        conditions.push(
          sql`to_tsvector('english', ${transcriptLines.content}) @@ plainto_tsquery('english', ${query})`
        );
      } else {
        conditions.push(sql`${transcriptLines.content} ILIKE ${"%" + query + "%"}`);
      }
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptLines)
      .innerJoin(tables, eq(transcriptLines.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(and(...conditions));
    return count || 0;
  }

  async getTranscriptLineTimestampsByTable(tableId: number): Promise<Date[]> {
    const result = await db
      .select({ createdAt: transcriptLines.createdAt })
      .from(transcriptLines)
      .where(eq(transcriptLines.tableId, tableId))
      .orderBy(asc(transcriptLines.createdAt));
    return result.map((row) => row.createdAt);
  }

  async getEvidenceBatch(
    eventId: number,
    queries: string[]
  ): Promise<Array<{ query: string; count: number; topLine: TranscriptLine | null }>> {
    const normalized = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
    if (!normalized.length) return [];
    const termsSql = sql`ARRAY[${sql.join(normalized.map((term) => sql`${term}`), sql`, `)}]::text[]`;
    const result = await db.execute(sql`
      select
        term as query,
        coalesce(cnt.count, 0) as count,
        top_line.id as top_line_id
      from unnest(${termsSql}) as term
      left join lateral (
        select count(*) as count
        from ${transcriptLines} tl
        inner join ${tables} t on tl.table_id = t.id
        inner join ${sessions} s on t.session_id = s.id
        where s.event_id = ${eventId}
          and (
            case
              when length(term) < 3 then tl.content ilike '%' || term || '%'
              else to_tsvector('english', tl.content) @@ plainto_tsquery('english', term)
            end
          )
      ) cnt on true
      left join lateral (
        select tl.id
        from ${transcriptLines} tl
        inner join ${tables} t on tl.table_id = t.id
        inner join ${sessions} s on t.session_id = s.id
        where s.event_id = ${eventId}
          and (
            case
              when length(term) < 3 then tl.content ilike '%' || term || '%'
              else to_tsvector('english', tl.content) @@ plainto_tsquery('english', term)
            end
          )
        order by tl.created_at desc
        limit 1
      ) top_line on true
    `);
    const rows = (result as { rows: Array<{ query: string; count: number; top_line_id: number | null }> }).rows;
    const ids = rows.map((row) => row.top_line_id).filter((id): id is number => !!id);
    const lines = await this.getTranscriptLinesByIds(ids);
    const lineMap = new Map(lines.map((line) => [line.id, line]));
    return rows.map((row) => ({
      query: row.query,
      count: Number(row.count) || 0,
      topLine: row.top_line_id ? lineMap.get(row.top_line_id) ?? null : null,
    }));
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

  async getSummary(id: number): Promise<Summary | undefined> {
    const [summary] = await db.select().from(summaries).where(eq(summaries.id, id));
    return summary;
  }

  async createEvidenceLink(data: InsertEvidenceLink): Promise<EvidenceLink> {
    const [link] = await db.insert(evidenceLinks).values(data).returning();
    return link;
  }

  async getEvidenceLinksBySummary(summaryId: number): Promise<EvidenceLink[]> {
    return db.select().from(evidenceLinks).where(eq(evidenceLinks.summaryId, summaryId));
  }

  async createQuote(data: InsertQuoteBank): Promise<QuoteBank> {
    const [quote] = await db.insert(quoteBank).values(data).returning();
    return quote;
  }

  async getQuote(id: number): Promise<QuoteBank | undefined> {
    const [quote] = await db.select().from(quoteBank).where(eq(quoteBank.id, id));
    return quote;
  }

  async updateQuote(id: number, data: Partial<InsertQuoteBank>): Promise<QuoteBank | undefined> {
    const [quote] = await db.update(quoteBank).set(data).where(eq(quoteBank.id, id)).returning();
    return quote;
  }

  async listQuotesByEvent(eventId: number): Promise<QuoteBank[]> {
    const result = await db
      .select({ quote: quoteBank })
      .from(quoteBank)
      .innerJoin(tables, eq(quoteBank.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(eq(sessions.eventId, eventId))
      .orderBy(desc(quoteBank.createdAt));
    return result.map((row) => row.quote);
  }

  async listQuotesByEventDetailed(eventId: number): Promise<Array<{ quote: QuoteBank; line: TranscriptLine | null; table: Table; session: Session }>> {
    const result = await db
      .select({
        quote: quoteBank,
        line: transcriptLines,
        table: tables,
        session: sessions,
      })
      .from(quoteBank)
      .innerJoin(tables, eq(quoteBank.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .leftJoin(transcriptLines, eq(quoteBank.transcriptLineId, transcriptLines.id))
      .where(eq(sessions.eventId, eventId))
      .orderBy(desc(quoteBank.createdAt));
    return result;
  }

  // Nudges
  async getPendingNudges(tableId: number): Promise<Nudge[]> {
    return db.select().from(nudges)
      .where(and(
        eq(nudges.tableId, tableId),
        isNull(nudges.acknowledgedAt),
        sql`${nudges.scheduledAt} is null or ${nudges.scheduledAt} <= CURRENT_TIMESTAMP`
      ))
      .orderBy(nudges.sentAt);
  }

  async createNudge(data: InsertNudge): Promise<Nudge> {
    const [nudge] = await db.insert(nudges).values(data).returning();
    return nudge;
  }

  async acknowledgeNudge(id: number): Promise<void> {
    await db.update(nudges).set({ acknowledgedAt: sql`CURRENT_TIMESTAMP` }).where(eq(nudges.id, id));
  }

  async getNudgeStatsByTable(tableId: number): Promise<{ sent: number; acknowledged: number; pending: number; delivered: number; opened: number }> {
    const [{ count: sent }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(eq(nudges.tableId, tableId));
    const [{ count: acknowledged }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.tableId, tableId), sql`${nudges.acknowledgedAt} is not null`));
    const [{ count: pending }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.tableId, tableId), isNull(nudges.acknowledgedAt)));
    const [{ count: delivered }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.tableId, tableId), sql`${nudges.deliveredAt} is not null`));
    const [{ count: opened }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.tableId, tableId), sql`${nudges.openedAt} is not null`));
    return { sent, acknowledged, pending, delivered, opened };
  }

  async getNudgeStatsBySession(sessionId: number): Promise<{ sent: number; acknowledged: number; pending: number; delivered: number; opened: number }> {
    const [{ count: sent }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(eq(nudges.sessionId, sessionId));
    const [{ count: acknowledged }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.sessionId, sessionId), sql`${nudges.acknowledgedAt} is not null`));
    const [{ count: pending }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.sessionId, sessionId), isNull(nudges.acknowledgedAt)));
    const [{ count: delivered }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.sessionId, sessionId), sql`${nudges.deliveredAt} is not null`));
    const [{ count: opened }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nudges)
      .where(and(eq(nudges.sessionId, sessionId), sql`${nudges.openedAt} is not null`));
    return { sent, acknowledged, pending, delivered, opened };
  }

  async recordNudgeDelivery(data: InsertNudgeDelivery): Promise<NudgeDelivery> {
    const [delivery] = await db.insert(nudgeDeliveries).values(data).returning();
    return delivery;
  }

  async updateNudge(id: number, data: Partial<InsertNudge>): Promise<Nudge | undefined> {
    const [nudge] = await db.update(nudges).set(data).where(eq(nudges.id, id)).returning();
    return nudge;
  }

  async getNudgeStatsByEvent(eventId: number): Promise<Array<{ tableId: number; sent: number; delivered: number; opened: number; acknowledged: number }>> {
    const rows = await db
      .select({
        tableId: nudges.tableId,
        sent: sql<number>`count(*)`,
        delivered: sql<number>`count(${nudges.deliveredAt})`,
        opened: sql<number>`count(${nudges.openedAt})`,
        acknowledged: sql<number>`count(${nudges.acknowledgedAt})`,
      })
      .from(nudges)
      .where(eq(nudges.eventId, eventId))
      .groupBy(nudges.tableId);
    return rows.filter((row) => row.tableId !== null) as Array<{ tableId: number; sent: number; delivered: number; opened: number; acknowledged: number }>;
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
        lastAudioAt: tables.lastAudioAt,
        lastTranscriptAt: tables.lastTranscriptAt,
        lastSummaryAt: tables.lastSummaryAt,
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

  async getPiiIndicatorsByEvent(eventId: number): Promise<Array<{ tableId: number; redactedCount: number; totalCount: number }>> {
    const result = await db
      .select({
        tableId: transcriptLines.tableId,
        redactedCount: sql<number>`sum(case when ${transcriptLines.redacted} then 1 else 0 end)`,
        totalCount: sql<number>`count(*)`,
      })
      .from(transcriptLines)
      .innerJoin(tables, eq(transcriptLines.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(eq(sessions.eventId, eventId))
      .groupBy(transcriptLines.tableId);
    return result;
  }

  async getTranscriptCompletenessByEvent(eventId: number): Promise<Array<{ tableId: number; firstAt: Date | null; lastAt: Date | null; lineCount: number }>> {
    const result = await db
      .select({
        tableId: transcriptLines.tableId,
        firstAt: sql<Date>`min(${transcriptLines.createdAt})`,
        lastAt: sql<Date>`max(${transcriptLines.createdAt})`,
        lineCount: sql<number>`count(*)`,
      })
      .from(transcriptLines)
      .innerJoin(tables, eq(transcriptLines.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(eq(sessions.eventId, eventId))
      .groupBy(transcriptLines.tableId);
    return result;
  }

  async getHotTablesByEvent(eventId: number, sinceMinutes: number): Promise<Array<{ tableId: number; lineCount: number }>> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const result = await db
      .select({
        tableId: transcriptLines.tableId,
        lineCount: sql<number>`count(*)`,
      })
      .from(transcriptLines)
      .innerJoin(tables, eq(transcriptLines.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(and(eq(sessions.eventId, eventId), gte(transcriptLines.createdAt, since)))
      .groupBy(transcriptLines.tableId)
      .orderBy(sql`count(*) desc`)
      .limit(10);
    return result;
  }

  // Playbooks
  async getPlaybooks(): Promise<Playbook[]> {
    return db.select().from(playbooks).orderBy(desc(playbooks.createdAt));
  }

  async getPlaybook(id: number): Promise<Playbook | undefined> {
    const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, id));
    return playbook;
  }

  async createPlaybook(data: InsertPlaybook): Promise<Playbook> {
    const [playbook] = await db.insert(playbooks).values(data).returning();
    return playbook;
  }

  async createPlaybookStep(data: InsertPlaybookStep): Promise<PlaybookStep> {
    const [step] = await db.insert(playbookSteps).values(data).returning();
    return step;
  }

  async getPlaybookSteps(playbookId: number): Promise<PlaybookStep[]> {
    return db.select().from(playbookSteps).where(eq(playbookSteps.playbookId, playbookId)).orderBy(playbookSteps.offsetMinutes);
  }

  async createPlaybookRun(data: InsertPlaybookRun): Promise<PlaybookRun> {
    const [run] = await db.insert(playbookRuns).values(data).returning();
    return run;
  }

  // Privacy & exports
  async createRedactionTask(data: InsertRedactionTask): Promise<RedactionTask> {
    const [task] = await db.insert(redactionTasks).values(data).returning();
    return task;
  }

  async getPendingRedactionTasks(eventId?: number): Promise<RedactionTask[]> {
    if (eventId) {
      return db
        .select()
        .from(redactionTasks)
        .where(and(eq(redactionTasks.status, "pending"), eq(redactionTasks.eventId, eventId)))
        .orderBy(desc(redactionTasks.createdAt));
    }
    return db.select().from(redactionTasks).where(eq(redactionTasks.status, "pending")).orderBy(desc(redactionTasks.createdAt));
  }

  async updateRedactionTask(id: number, data: Partial<InsertRedactionTask>): Promise<RedactionTask | undefined> {
    const [task] = await db.update(redactionTasks).set(data).where(eq(redactionTasks.id, id)).returning();
    return task;
  }

  async createShareLink(data: InsertShareLink): Promise<ShareLink> {
    const [link] = await db.insert(shareLinks).values(data).returning();
    return link;
  }

  async getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token));
    return link;
  }

  async createExportJob(data: InsertExportJob): Promise<ExportJob> {
    const [job] = await db.insert(exports).values(data).returning();
    return job;
  }

  async updateExportJob(id: number, data: Partial<InsertExportJob>): Promise<ExportJob | undefined> {
    const [job] = await db.update(exports).set(data).where(eq(exports.id, id)).returning();
    return job;
  }

  // Facilitator highlights
  async createActionItem(data: InsertActionItem): Promise<ActionItem> {
    const [item] = await db.insert(actionItems).values(data).returning();
    return item;
  }

  async listActionItemsByEvent(eventId: number): Promise<ActionItem[]> {
    return db.select().from(actionItems).where(eq(actionItems.eventId, eventId)).orderBy(desc(actionItems.createdAt));
  }

  async listGoldenNuggetsByEvent(eventId: number): Promise<GoldenNugget[]> {
    const result = await db
      .select({ nugget: goldenNuggets })
      .from(goldenNuggets)
      .innerJoin(tables, eq(goldenNuggets.tableId, tables.id))
      .innerJoin(sessions, eq(tables.sessionId, sessions.id))
      .where(eq(sessions.eventId, eventId))
      .orderBy(desc(goldenNuggets.createdAt));
    return result.map((row) => row.nugget);
  }

  async createOpenQuestion(data: InsertOpenQuestion): Promise<OpenQuestion> {
    const [question] = await db.insert(openQuestions).values(data).returning();
    return question;
  }

  async listOpenQuestionsByEvent(eventId: number): Promise<OpenQuestion[]> {
    return db.select().from(openQuestions).where(eq(openQuestions.eventId, eventId)).orderBy(desc(openQuestions.votes));
  }

  async upvoteOpenQuestion(id: number): Promise<OpenQuestion | undefined> {
    const [question] = await db
      .update(openQuestions)
      .set({ votes: sql`${openQuestions.votes} + 1` })
      .where(eq(openQuestions.id, id))
      .returning();
    return question;
  }

  async createParkingLotItem(data: InsertParkingLotItem): Promise<ParkingLotItem> {
    const [item] = await db.insert(parkingLotItems).values(data).returning();
    return item;
  }

  async listParkingLotItems(tableId: number): Promise<ParkingLotItem[]> {
    return db.select().from(parkingLotItems).where(eq(parkingLotItems.tableId, tableId)).orderBy(desc(parkingLotItems.createdAt));
  }

  async createGoldenNugget(data: InsertGoldenNugget): Promise<GoldenNugget> {
    const [item] = await db.insert(goldenNuggets).values(data).returning();
    return item;
  }

  async listGoldenNuggets(tableId: number): Promise<GoldenNugget[]> {
    return db.select().from(goldenNuggets).where(eq(goldenNuggets.tableId, tableId)).orderBy(desc(goldenNuggets.createdAt));
  }

  async createSummaryTranslation(data: InsertSummaryTranslation): Promise<SummaryTranslation> {
    const [translation] = await db.insert(summaryTranslations).values(data).returning();
    return translation;
  }

  async getSummaryTranslations(summaryId: number): Promise<SummaryTranslation[]> {
    return db.select().from(summaryTranslations).where(eq(summaryTranslations.summaryId, summaryId)).orderBy(desc(summaryTranslations.createdAt));
  }

  // Attendee feedback
  async createAttendeeFeedback(data: InsertAttendeeFeedback): Promise<AttendeeFeedback> {
    const [feedback] = await db.insert(attendeeFeedback).values(data).returning();
    return feedback;
  }

  async createDigestSubscription(data: InsertDigestSubscription): Promise<DigestSubscription> {
    const [subscription] = await db.insert(digestSubscriptions).values(data).returning();
    return subscription;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async listAuditLogs(eventId: number): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.entityId, eventId)).orderBy(desc(auditLogs.createdAt));
  }

  async createInvestigation(data: InsertInvestigation): Promise<Investigation> {
    const [investigation] = await db.insert(investigations).values(data).returning();
    return investigation;
  }

  async listInvestigations(eventId: number): Promise<Investigation[]> {
    return db.select().from(investigations).where(eq(investigations.eventId, eventId)).orderBy(desc(investigations.createdAt));
  }

  async createCollection(data: InsertCollection): Promise<Collection> {
    const [collection] = await db.insert(collections).values(data).returning();
    return collection;
  }

  async listCollections(eventId: number): Promise<Collection[]> {
    return db.select().from(collections).where(eq(collections.eventId, eventId)).orderBy(desc(collections.createdAt));
  }

  async addCollectionItem(data: InsertCollectionItem): Promise<CollectionItem> {
    const [item] = await db.insert(collectionItems).values(data).returning();
    return item;
  }
}

export const storage = new DatabaseStorage();
