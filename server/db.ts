import fs from 'fs';
import path from 'path';
import { Collection, Db, MongoClient } from 'mongodb';
import type {
  ActiveSabotage,
  AssignedTask,
  GamePhase,
  GameSettings,
  MatchTimelineEvent,
  MeetingStage,
  PlayerAward,
  PlayerColorId,
  PlayerMatchStats,
  SecretRole,
  StationActivityEvent,
  VisualTaskAlert,
  WinnerTeam,
} from '../src/shared/skeldData.ts';

export interface StoredPlayer {
  playerId: string;
  playerToken: string;
  rejoinCode: string;
  name: string;
  color: PlayerColorId;
  secretRole: SecretRole;
  alive: boolean;
  assignedTasks: AssignedTask[];
  lastKillAt: number;
  lastScanAt: number;
  lastShieldAt?: number;
  shieldedUntil?: number;
  shieldedBy?: string;
  reactorArmed?: boolean;
  stats?: PlayerMatchStats;
  connected: boolean;
}

export interface StoredMeeting {
  id: string;
  stage: MeetingStage;
  reason: 'BODY_REPORTED' | 'EMERGENCY_BUTTON';
  reporterId: string;
  reporterName: string;
  reporterColor: PlayerColorId;
  victimName?: string;
  victimColor?: PlayerColorId;
  startedAt: number;
  discussionEndsAt: number;
  votingEndsAt: number;
  revealEndsAt?: number;
  verdictEndsAt?: number;
  arrivedPlayerIds: string[];
  voteNowPlayerIds?: string[];
  votes: Record<string, string>;
  ejectedPlayer?: {
    playerId: string;
    name: string;
    color: PlayerColorId;
    revealedRole?: SecretRole;
  } | null;
  verdictMessage?: string;
}

export interface StoredSession {
  sessionCode: string;
  hostToken: string;
  publicUrl: string;
  phase: GamePhase;
  settings: GameSettings;
  players: StoredPlayer[];
  activeSabotage: ActiveSabotage | null;
  lastSabotageAt: number;
  meeting: StoredMeeting | null;
  winner: WinnerTeam | null;
  winReason: string | null;
  missionStartedAt?: number;
  jesterEjectedWinnerId?: string | null;
  activityFeed?: Array<StationActivityEvent & { actorId?: string }>;
  recentVisualAlert?: VisualTaskAlert | null;
  timeline?: MatchTimelineEvent[];
  awards?: PlayerAward[];
  createdAt: number;
  updatedAt: number;
}

const LOCAL_DATA_DIR = path.resolve(process.cwd(), '.skeld-data');
const LOCAL_SESSIONS_FILE = path.join(LOCAL_DATA_DIR, 'sessions.json');

let sessionsCollection: Collection<StoredSession> | null = null;
let dbMode: 'mongodb' | 'local-fallback' = 'local-fallback';

const memoryCache = new Map<string, StoredSession>();

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
}

function loadLocalFileIntoCache(): void {
  try {
    ensureLocalDir();
    if (fs.existsSync(LOCAL_SESSIONS_FILE)) {
      const raw = fs.readFileSync(LOCAL_SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, StoredSession>;
      for (const [code, session] of Object.entries(parsed)) {
        memoryCache.set(code, session);
      }
    }
  } catch (err) {
    console.warn('[DB] Failed to read local fallback store:', err);
  }
}

function flushCacheToLocalFile(): void {
  try {
    ensureLocalDir();
    const obj: Record<string, StoredSession> = {};
    for (const [code, session] of memoryCache.entries()) {
      obj[code] = session;
    }
    const tmpFile = `${LOCAL_SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmpFile, LOCAL_SESSIONS_FILE);
  } catch (err) {
    console.warn('[DB] Failed to write local fallback store:', err);
  }
}

export async function initDatabase(): Promise<'mongodb' | 'local-fallback'> {
  const configuredUri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || 'skeld_irl';

  if (!configuredUri) {
    sessionsCollection = null;
    dbMode = 'local-fallback';
    loadLocalFileIntoCache();
    console.log('[DB] MONGODB_URI not configured; active with persistent local JSON store (.skeld-data/sessions.json)');
    return dbMode;
  }

  try {
    const client = new MongoClient(configuredUri, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
    });
    await client.connect();
    const db: Db = client.db(dbName);
    await db.command({ ping: 1 });

    sessionsCollection = db.collection<StoredSession>('sessions');
    await sessionsCollection.createIndex({ sessionCode: 1 }, { unique: true });
    await sessionsCollection.createIndex({ updatedAt: -1 });

    dbMode = 'mongodb';
    console.log(`[DB] Connected to MongoDB (${dbName})`);
    return dbMode;
  } catch {
    sessionsCollection = null;
    dbMode = 'local-fallback';
    loadLocalFileIntoCache();
    console.log('[DB] MongoDB not reachable; active with persistent local JSON store (.skeld-data/sessions.json)');
    return dbMode;
  }
}

export function getDbMode(): 'mongodb' | 'local-fallback' {
  return dbMode;
}

export function sanitizeSessionCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(cleaned)) return null;
  return cleaned;
}

export async function getSession(sessionCode: string): Promise<StoredSession | null> {
  const validCode = sanitizeSessionCode(sessionCode);
  if (!validCode) return null;

  if (memoryCache.has(validCode)) {
    return memoryCache.get(validCode) || null;
  }

  if (sessionsCollection) {
    const doc = await sessionsCollection.findOne(
      { sessionCode: validCode },
      { projection: { _id: 0 } },
    );
    if (doc) {
      memoryCache.set(validCode, doc);
      return doc;
    }
  }

  return null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  session.updatedAt = Date.now();
  memoryCache.set(session.sessionCode, session);

  if (sessionsCollection) {
    await sessionsCollection.updateOne(
      { sessionCode: session.sessionCode },
      { $set: session },
      { upsert: true },
    );
  } else {
    flushCacheToLocalFile();
  }
}

export async function getActiveSessionCodes(): Promise<string[]> {
  if (sessionsCollection && memoryCache.size === 0) {
    const docs = await sessionsCollection
      .find({ phase: { $in: ['PLAYING', 'MEETING'] } }, { projection: { sessionCode: 1, _id: 0 } })
      .toArray();
    for (const d of docs) {
      await getSession(d.sessionCode);
    }
  }
  return Array.from(memoryCache.keys());
}
