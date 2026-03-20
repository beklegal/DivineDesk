import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { z } from "zod";
import ws from "ws";
import type {
  AttendanceRecord,
  Church,
  ChurchBranch,
  ChurchBilling,
  ChurchSubscriptionPaymentRecord,
  ChurchEvent,
  Donation,
  Member,
  User,
  UserRole,
} from "../../shared/api.js";
import { createSeedDatabase } from "./seed.js";
import {
  createPrimaryBranch,
  findChurchBranch,
  getChurchBranches,
  resolvePrimaryBranchId,
} from "../lib/branches.js";
import { ensureChurchBilling } from "../lib/billing.js";

type EntityStatus = "active" | "inactive" | "suspended";

export interface StoredChurch extends Church {
  status: EntityStatus;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  churchId?: string | null;
  branchId?: string | null;
  status: EntityStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export interface DivineDeskDatabase {
  meta: {
    version: number;
    createdAt: string;
    lastUpdated: string;
  };
  churches: StoredChurch[];
  branches: ChurchBranch[];
  users: StoredUser[];
  members: Member[];
  donations: Donation[];
  events: ChurchEvent[];
  attendance: AttendanceRecord[];
  subscriptionPayments: ChurchSubscriptionPaymentRecord[];
}

const dateString = z.string().min(1);
const statusSchema = z.enum(["active", "inactive", "suspended"]);
const churchSizeSchema = z.enum(["small", "medium", "large"]);
const userRoleSchema = z.enum([
  "super_admin",
  "admin",
  "branch_admin",
  "staff",
  "member",
]);
const billingStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "suspended",
]);
const subscriptionPaymentMethodSchema = z.enum([
  "paystack",
  "bank_transfer",
  "mobile_money",
  "cash",
  "manual",
]);
const subscriptionPaymentSourceSchema = z.enum([
  "manual",
  "paystack_verify",
  "paystack_webhook",
]);
const branchStatusSchema = z.enum(["active", "inactive"]);

const billingSchema = z.object({
  provider: z.literal("paystack"),
  planKey: z.enum(["starter", "growth", "enterprise", "custom"]),
  planName: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.enum(["USD", "NGN"]),
  interval: z.literal("monthly"),
  status: billingStatusSchema,
  billingEmail: z.string().optional(),
  startedAt: dateString,
  renewalDate: dateString.optional(),
  trialEndsAt: dateString.optional(),
  customerCode: z.string().optional(),
  subscriptionCode: z.string().optional(),
  planCode: z.string().optional(),
  authorizationCode: z.string().optional(),
  lastPaymentReference: z.string().optional(),
  lastPaymentAt: dateString.optional(),
});

const churchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  size: churchSizeSchema,
  totalMembers: z.number().nonnegative(),
  monthlyDonations: z.number().nonnegative(),
  weeklyAttendance: z.number().nonnegative(),
  createdAt: dateString,
  lastUpdated: dateString,
  status: statusSchema,
  adminName: z.string().optional(),
  adminEmail: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  primaryBranchId: z.string().optional(),
  billing: billingSchema.optional(),
});

const branchSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean(),
  status: branchStatusSchema,
  createdAt: dateString,
  createdByUserId: z.string().optional(),
});

const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  role: userRoleSchema,
  churchId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  status: statusSchema,
  createdAt: dateString,
  lastLoginAt: dateString.optional(),
});

const memberSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  branchId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  ministryGroup: z.string(),
  joinDate: dateString,
  status: z.enum(["active", "inactive", "visitor"]),
  notes: z.string(),
});

const donationSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  branchId: z.string().optional(),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  amount: z.number().nonnegative(),
  type: z.enum(["tithe", "offering", "special_gift"]),
  date: dateString,
  notes: z.string(),
});

const eventSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  branchId: z.string().optional(),
  name: z.string().min(1),
  date: dateString,
  time: z.string().min(1),
  location: z.string().min(1),
  description: z.string(),
  type: z.enum(["service", "event", "meeting"]),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  maxAttendees: z.number().nonnegative().optional(),
  registeredAttendees: z.number().nonnegative(),
});

const attendanceSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  branchId: z.string().optional(),
  eventId: z.string().min(1),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  attended: z.boolean(),
  checkinTime: dateString.optional(),
  checkoutTime: dateString.optional(),
});

const subscriptionPaymentSchema = z.object({
  id: z.string().min(1),
  churchId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.enum(["USD", "NGN"]),
  method: subscriptionPaymentMethodSchema,
  source: subscriptionPaymentSourceSchema,
  paidAt: dateString,
  periodStart: dateString,
  periodEnd: dateString,
  reference: z.string().optional(),
  notes: z.string().optional(),
  recordedAt: dateString,
  recordedByUserId: z.string().min(1),
  recordedByName: z.string().optional(),
});

const databaseSchema = z.object({
  meta: z.object({
    version: z.number().int().positive(),
    createdAt: dateString,
    lastUpdated: dateString,
  }),
  churches: z.array(churchSchema),
  branches: z.array(branchSchema).default([]),
  users: z.array(userSchema),
  members: z.array(memberSchema),
  donations: z.array(donationSchema),
  events: z.array(eventSchema),
  attendance: z.array(attendanceSchema),
  subscriptionPayments: z.array(subscriptionPaymentSchema).default([]),
});

const DEFAULT_DATA_DIRECTORY = path.resolve(process.cwd(), "server", "data");
const DEFAULT_DATA_FILE = path.join(DEFAULT_DATA_DIRECTORY, "divinedesk-db.json");
const CONFIGURED_DATA_DIRECTORY = process.env.DIVINEDESK_DATA_DIRECTORY?.trim();
const DATA_DIRECTORY = CONFIGURED_DATA_DIRECTORY
  ? path.resolve(CONFIGURED_DATA_DIRECTORY)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), "divinedesk-data")
    : DEFAULT_DATA_DIRECTORY;
const DATA_FILE = path.join(DATA_DIRECTORY, "divinedesk-db.json");
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEMO_CHURCH_PREFIX = "church-demo-";
const DEMO_USER_PREFIX = "user-demo-";
const APP_STATE_TABLE = "divinedesk_app_state";
const APP_STATE_ROW_ID = 1;

let databaseCache: DivineDeskDatabase | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

function normalizeOptionalEnvironmentValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getExternalDatabaseUrl() {
  return (
    normalizeOptionalEnvironmentValue(process.env.DIVINEDESK_DATABASE_URL) ??
    normalizeOptionalEnvironmentValue(process.env.DATABASE_URL_UNPOOLED) ??
    normalizeOptionalEnvironmentValue(process.env.POSTGRES_URL_NON_POOLING) ??
    normalizeOptionalEnvironmentValue(process.env.DATABASE_URL) ??
    normalizeOptionalEnvironmentValue(process.env.POSTGRES_URL)
  );
}

const EXTERNAL_DATABASE_URL = getExternalDatabaseUrl();
const USE_EXTERNAL_DATABASE = Boolean(EXTERNAL_DATABASE_URL);

interface ExternalDatabaseQueryClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: R[];
    rowCount?: number | null;
  }>;
}

interface ExternalDatabasePool {
  query: ExternalDatabaseQueryClient["query"];
  connect(): Promise<ExternalDatabasePoolClient>;
  end(): Promise<void>;
}

interface ExternalDatabasePoolClient extends ExternalDatabaseQueryClient {
  release(): void;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseDate(value: string): Date {
  return new Date(value);
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function isWithinDays(value: string, days: number) {
  const parsed = parseDate(value);
  if (!isValidDate(parsed)) {
    return false;
  }

  return Date.now() - parsed.getTime() <= days * DAY_IN_MS;
}

function calculateWeeklyAttendance(
  church: StoredChurch,
  events: ChurchEvent[],
  attendance: AttendanceRecord[],
) {
  const rankedEvents = [...events]
    .sort((left, right) => parseDate(right.date).getTime() - parseDate(left.date).getTime())
    .slice(0, 4);

  const attendanceCounts = rankedEvents
    .map((event) => {
      const recorded = attendance.filter(
        (entry) => entry.eventId === event.id && entry.attended,
      ).length;

      return recorded || event.registeredAttendees || 0;
    })
    .filter((count) => count > 0);

  if (attendanceCounts.length === 0) {
    return church.weeklyAttendance ?? 0;
  }

  return Math.round(
    attendanceCounts.reduce((total, value) => total + value, 0) /
      attendanceCounts.length,
  );
}

function normalizeBranchStructure(database: DivineDeskDatabase) {
  const branches = database.churches.flatMap((church) => {
    const churchBranches = getChurchBranches(database.branches, church.id).map((branch) => ({
      ...branch,
      status: branch.status ?? "active",
    }));

    if (churchBranches.length === 0) {
      churchBranches.push(
        createPrimaryBranch({
          churchId: church.id,
          createdAt: church.createdAt,
          email: church.email ?? church.adminEmail,
          phone: church.phone,
          address: church.address,
        }),
      );
    }

    const primaryBranchId =
      resolvePrimaryBranchId(
        {
          id: church.id,
          primaryBranchId: church.primaryBranchId,
        },
        churchBranches,
      ) ?? churchBranches[0].id;

    return churchBranches.map((branch) => ({
      ...branch,
      isPrimary: branch.id === primaryBranchId,
    }));
  });

  const churches = database.churches.map((church) => ({
    ...church,
    primaryBranchId:
      resolvePrimaryBranchId(
        {
          id: church.id,
          primaryBranchId: church.primaryBranchId,
        },
        branches,
      ) ?? church.primaryBranchId,
  }));

  const getFallbackBranchId = (churchId: string) => {
    const church = churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      return undefined;
    }

    return (
      resolvePrimaryBranchId(
        {
          id: church.id,
          primaryBranchId: church.primaryBranchId,
        },
        branches,
      ) ?? getChurchBranches(branches, churchId)[0]?.id
    );
  };

  const users = database.users.map((user) => {
    if (!user.churchId || user.role === "super_admin") {
      return {
        ...user,
        branchId: null,
      };
    }

    const validBranch = findChurchBranch(branches, user.churchId, user.branchId);

    if (user.role === "branch_admin") {
      return {
        ...user,
        branchId: validBranch?.id ?? getFallbackBranchId(user.churchId) ?? null,
      };
    }

    return {
      ...user,
      branchId: validBranch?.id ?? null,
    };
  });

  const members = database.members.map((member) => ({
    ...member,
    branchId:
      findChurchBranch(branches, member.churchId, member.branchId)?.id ??
      getFallbackBranchId(member.churchId),
  }));

  const donations = database.donations.map((donation) => ({
    ...donation,
    branchId:
      findChurchBranch(branches, donation.churchId, donation.branchId)?.id ??
      members.find((member) => member.id === donation.memberId)?.branchId ??
      getFallbackBranchId(donation.churchId),
  }));

  const events = database.events.map((event) => ({
    ...event,
    branchId:
      findChurchBranch(branches, event.churchId, event.branchId)?.id ??
      getFallbackBranchId(event.churchId),
  }));

  const attendance = database.attendance.map((entry) => ({
    ...entry,
    branchId:
      findChurchBranch(branches, entry.churchId, entry.branchId)?.id ??
      events.find((event) => event.id === entry.eventId)?.branchId ??
      members.find((member) => member.id === entry.memberId)?.branchId ??
      getFallbackBranchId(entry.churchId),
  }));

  return {
    ...database,
    churches,
    branches,
    users,
    members,
    donations,
    events,
    attendance,
    subscriptionPayments: database.subscriptionPayments ?? [],
  };
}

function stripDemoData(database: DivineDeskDatabase) {
  const subscriptionPayments = database.subscriptionPayments ?? [];
  const demoChurchIds = new Set(
    database.churches
      .filter((church) => church.id.startsWith(DEMO_CHURCH_PREFIX))
      .map((church) => church.id),
  );

  if (demoChurchIds.size === 0) {
    return database;
  }

  return {
    ...database,
    churches: database.churches.filter((church) => !demoChurchIds.has(church.id)),
    branches: database.branches.filter((branch) => !demoChurchIds.has(branch.churchId)),
    users: database.users.filter(
      (user) =>
        !user.id.startsWith(DEMO_USER_PREFIX) &&
        !(user.churchId && demoChurchIds.has(user.churchId)),
    ),
    members: database.members.filter((member) => !demoChurchIds.has(member.churchId)),
    donations: database.donations.filter((donation) => !demoChurchIds.has(donation.churchId)),
    events: database.events.filter((event) => !demoChurchIds.has(event.churchId)),
    attendance: database.attendance.filter((entry) => !demoChurchIds.has(entry.churchId)),
    subscriptionPayments: subscriptionPayments.filter(
      (payment) => !demoChurchIds.has(payment.churchId),
    ),
  };
}

function normalizeDatabase(database: DivineDeskDatabase) {
  const withoutDemoData = stripDemoData(database);
  const withBranches = normalizeBranchStructure(withoutDemoData);
  const now = new Date().toISOString();

  const churches = withBranches.churches.map((church) => {
    const billing = ensureChurchBilling(church);
    const churchMembers = withBranches.members.filter(
      (member) => member.churchId === church.id,
    );
    const churchDonations = withBranches.donations.filter(
      (donation) => donation.churchId === church.id,
    );
    const rollingMonthlyDonations = churchDonations
      .filter((donation) => isWithinDays(donation.date, 31))
      .reduce((total, donation) => total + donation.amount, 0);
    const churchEvents = withBranches.events.filter((event) => event.churchId === church.id);
    const churchAttendance = withBranches.attendance.filter(
      (entry) => entry.churchId === church.id,
    );
    const weeklyAttendance = calculateWeeklyAttendance(
      church,
      churchEvents,
      churchAttendance,
    );

    const summaryChanged =
      church.totalMembers !== churchMembers.length ||
      church.monthlyDonations !== rollingMonthlyDonations ||
      church.weeklyAttendance !== weeklyAttendance;

    return {
      ...church,
      billing,
      totalMembers: churchMembers.length,
      monthlyDonations: rollingMonthlyDonations,
      weeklyAttendance,
      lastUpdated: summaryChanged ? now : church.lastUpdated,
    };
  });

  return {
    ...withBranches,
    churches,
    meta: {
      ...withBranches.meta,
      lastUpdated: now,
    },
  };
}

function parseDatabasePayload(payload: unknown) {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  return normalizeDatabase(databaseSchema.parse(parsed) as DivineDeskDatabase);
}

async function loadInitialDatabaseSnapshot() {
  try {
    const bundledContents = await fs.readFile(DEFAULT_DATA_FILE, "utf8");
    return parseDatabasePayload(bundledContents);
  } catch {
    return normalizeDatabase(createSeedDatabase());
  }
}

async function createExternalDatabasePool() {
  if (!EXTERNAL_DATABASE_URL) {
    throw new Error("External database URL is not configured");
  }

  const PoolConstructor = Pool as unknown as {
    new (config: { connectionString: string }): ExternalDatabasePool;
  };

  return new PoolConstructor({
    connectionString: EXTERNAL_DATABASE_URL,
  });
}

async function withExternalDatabaseClient<T>(
  work: (pool: ExternalDatabasePool) => Promise<T>,
) {
  const pool = await createExternalDatabasePool();

  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

async function ensureExternalDatabaseSchema(client: ExternalDatabaseQueryClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${APP_STATE_TABLE} (
      id SMALLINT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureExternalDatabaseRow(client: ExternalDatabaseQueryClient) {
  await ensureExternalDatabaseSchema(client);

  const existing = await client.query(
    `SELECT 1 FROM ${APP_STATE_TABLE} WHERE id = $1`,
    [APP_STATE_ROW_ID],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return;
  }

  const initialDatabase = await loadInitialDatabaseSnapshot();

  await client.query(
    `INSERT INTO ${APP_STATE_TABLE} (id, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [APP_STATE_ROW_ID, JSON.stringify(initialDatabase)],
  );
}

async function readDatabaseFromExternalStore() {
  return withExternalDatabaseClient(async (pool) => {
    await ensureExternalDatabaseRow(pool);

    const result = await pool.query<{ payload: unknown }>(
      `SELECT payload FROM ${APP_STATE_TABLE} WHERE id = $1`,
      [APP_STATE_ROW_ID],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Application state row is missing");
    }

    return parseDatabasePayload(row.payload);
  });
}

async function updateDatabaseInExternalStore<T>(
  updater: (database: DivineDeskDatabase) => Promise<T> | T,
) {
  return withExternalDatabaseClient(async (pool) => {
    const client = await pool.connect();

    try {
      await ensureExternalDatabaseSchema(client);
      await client.query("BEGIN");

      const initialDatabase = await loadInitialDatabaseSnapshot();

      await client.query(
        `INSERT INTO ${APP_STATE_TABLE} (id, payload)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [APP_STATE_ROW_ID, JSON.stringify(initialDatabase)],
      );

      const result = await client.query<{ payload: unknown }>(
        `SELECT payload FROM ${APP_STATE_TABLE} WHERE id = $1 FOR UPDATE`,
        [APP_STATE_ROW_ID],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Application state row is missing");
      }

      const workingCopy = parseDatabasePayload(row.payload);
      const updateResult = await updater(workingCopy);
      const normalized = normalizeDatabase(workingCopy);

      await client.query(
        `UPDATE ${APP_STATE_TABLE}
         SET payload = $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [APP_STATE_ROW_ID, JSON.stringify(normalized)],
      );

      await client.query("COMMIT");
      return updateResult;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialDatabase = await loadInitialDatabaseSnapshot();
    await fs.writeFile(DATA_FILE, JSON.stringify(initialDatabase, null, 2), "utf8");
    databaseCache = clone(initialDatabase);
  }
}

async function loadDatabaseInternal() {
  if (databaseCache) {
    return clone(databaseCache);
  }

  await ensureDataFile();

  const fileContents = await fs.readFile(DATA_FILE, "utf8");
  const parsed = databaseSchema.parse(JSON.parse(fileContents)) as DivineDeskDatabase;
  const normalized = normalizeDatabase(parsed);
  const normalizedContents = JSON.stringify(normalized, null, 2);

  if (fileContents.trim() !== normalizedContents) {
    await fs.writeFile(DATA_FILE, normalizedContents, "utf8");
  }

  databaseCache = clone(normalized);
  return clone(normalized);
}

async function persistDatabase(database: DivineDeskDatabase) {
  databaseCache = clone(database);
  await fs.writeFile(DATA_FILE, JSON.stringify(database, null, 2), "utf8");
}

export async function readDatabase() {
  if (USE_EXTERNAL_DATABASE) {
    return readDatabaseFromExternalStore();
  }

  return loadDatabaseInternal();
}

export async function updateDatabase<T>(
  updater: (database: DivineDeskDatabase) => Promise<T> | T,
) {
  if (USE_EXTERNAL_DATABASE) {
    return updateDatabaseInExternalStore(updater);
  }

  const runUpdate = async () => {
    const workingCopy = await loadDatabaseInternal();
    const result = await updater(workingCopy);
    const normalized = normalizeDatabase(workingCopy);
    await persistDatabase(normalized);
    return result;
  };

  const resultPromise = writeQueue.then(runUpdate, runUpdate);
  writeQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );

  return resultPromise;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toPublicUser(user: StoredUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.churchId ? { churchId: user.churchId } : {}),
    ...(user.branchId ? { branchId: user.branchId } : {}),
  };
}

export function toPublicChurch(church: StoredChurch | null | undefined): Church | null {
  return church ? { ...church } : null;
}
