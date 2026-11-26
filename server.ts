import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  getActiveSessionCodes,
  getDbMode,
  getSession,
  initDatabase,
  sanitizeSessionCode,
} from './server/db.ts';
import {
  advanceSessionTimers,
  agreeVoteNow,
  cancelArmedReactorMeltdown,
  castGuardianShield,
  castMeetingVote,
  changePlayerColorInLobby,
  completePlayerTask,
  createGameSession,
  forceStartMeetingDiscussion,
  joinGameSession,
  kickPlayerFromLobby,
  leaveGameSession,
  markPlayerArrived,
  processPlayerBackScan,
  projectForHost,
  projectForPlayer,
  rejoinGameSession,
  resetMissionToLobby,
  scanReactorOverrideQr,
  startMission,
  triggerArmedReactorMeltdown,
  triggerEmergencyButton,
  triggerSabotage,
  updateHostPublicUrl,
  updateReactorHold,
  updateSessionSettings,
} from './server/gameEngine.ts';
import {
  PLAYER_COLORS,
  PlayerColorId,
  SabotageKind,
  SKELD_TASKS,
  SkeldTaskId,
} from './src/shared/skeldData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const APK_DIR = path.resolve(process.cwd(), 'public-apk');
const CANONICAL_APK_NAME = 'among-us-irl.apk';
const APK_META_NAME = 'apk-meta.json';
const MAX_APK_BYTES = 125 * 1024 * 1024;

function resolveSafeApkPath(fileName: string): string {
  const baseName = path.basename(fileName);
  if (!baseName || baseName !== fileName || baseName.includes('..')) {
    throw new Error('Invalid APK file path.');
  }
  const resolved = path.resolve(APK_DIR, baseName);
  if (!resolved.startsWith(APK_DIR + path.sep)) {
    throw new Error('Path escapes APK directory.');
  }
  return resolved;
}

function isValidApkHeader(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

function findHostedApkFile(): { filePath: string; originalFileName: string } | null {
  if (!fs.existsSync(APK_DIR)) return null;
  const canonicalPath = resolveSafeApkPath(CANONICAL_APK_NAME);
  if (fs.existsSync(canonicalPath)) {
    return { filePath: canonicalPath, originalFileName: CANONICAL_APK_NAME };
  }
  const entries = fs
    .readdirSync(APK_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.apk'))
    .map((entry) => {
      const safePath = resolveSafeApkPath(entry.name);
      return {
        name: entry.name,
        filePath: safePath,
        mtimeMs: fs.statSync(safePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (entries.length === 0) return null;
  return { filePath: entries[0].filePath, originalFileName: entries[0].name };
}

interface ApkMetaFile {
  originalFileName?: string;
  sha256?: string;
  updatedAt?: string;
  sizeBytes?: number;
}

function getApkStatus() {
  const hosted = findHostedApkFile();
  if (!hosted) {
    return {
      available: false,
      fileName: CANONICAL_APK_NAME,
      sizeBytes: 0,
      downloadPath: '/download/among-us-irl.apk',
    };
  }
  const stat = fs.statSync(hosted.filePath);
  const metaPath = resolveSafeApkPath(APK_META_NAME);
  let meta: ApkMetaFile = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as ApkMetaFile;
    } catch {
      meta = {};
    }
  }
  const sha256 =
    meta.sha256 && meta.sizeBytes === stat.size
      ? meta.sha256
      : crypto.createHash('sha256').update(fs.readFileSync(hosted.filePath)).digest('hex');

  return {
    available: true,
    fileName: CANONICAL_APK_NAME,
    originalFileName: meta.originalFileName || hosted.originalFileName,
    sizeBytes: stat.size,
    sha256,
    updatedAt: meta.updatedAt || stat.mtime.toISOString(),
    downloadPath: '/download/among-us-irl.apk',
  };
}

function resolveTlsCredentials(): { key: Buffer; cert: Buffer } | null {
  const keyPath = process.env.SSL_KEY_FILE?.trim() || path.resolve(process.cwd(), 'certs', 'key.pem');
  const certPath = process.env.SSL_CERT_FILE?.trim() || path.resolve(process.cwd(), 'certs', 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
  return null;
}

let activeProtocol: 'http' | 'https' = 'http';

function getLanUrls(port: number, protocol: 'http' | 'https' = activeProtocol): string[] {
  const urls: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const addrs = nets[name];
    if (!addrs) continue;
    for (const net of addrs) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`${protocol}://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

function resolveRequestOrigin(req: express.Request, protocol: 'http' | 'https'): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  const protoHeader = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const hostHeader = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.headers.host;
  if (hostHeader) {
    const proto = protoHeader || (hostHeader.includes('localhost') || hostHeader.startsWith('127.') ? protocol : req.protocol);
    return `${proto}://${hostHeader}`;
  }
  const lan = getLanUrls(PORT, protocol)[0];
  return lan || `${protocol}://localhost:${PORT}`;
}

interface WsClientMeta {
  ws: WebSocket;
  sessionCode: string;
  role: 'HOST' | 'PLAYER' | 'PUBLIC';
  token: string;
  playerId?: string;
}

const clientsBySession = new Map<string, Set<WsClientMeta>>();
// sessionCode -> Map<watcherPlayerId, targetPlayerId>
const securityWatchersBySession = new Map<string, Map<string, string>>();

function sendToPlayerSockets(sessionCode: string, playerId: string, data: unknown) {
  const group = clientsBySession.get(sessionCode);
  if (!group) return;
  const serialized = JSON.stringify(data);
  for (const client of group) {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      client.role === 'PLAYER' &&
      client.playerId === playerId
    ) {
      client.ws.send(serialized);
    }
  }
}

function getTargetWatcherIds(sessionCode: string, targetPlayerId: string): string[] {
  const watcherMap = securityWatchersBySession.get(sessionCode);
  if (!watcherMap) return [];
  const watchers: string[] = [];
  for (const [watcherId, targetId] of watcherMap.entries()) {
    if (targetId === targetPlayerId) {
      watchers.push(watcherId);
    }
  }
  return watchers;
}

function syncTargetCaptureState(sessionCode: string, targetPlayerId: string) {
  const watcherCount = getTargetWatcherIds(sessionCode, targetPlayerId).length;
  sendToPlayerSockets(sessionCode, targetPlayerId, {
    type: 'security:capture',
    payload: {
      active: watcherCount > 0,
      watcherCount,
    },
  });
}

function clearWatcher(sessionCode: string, watcherPlayerId: string) {
  const watcherMap = securityWatchersBySession.get(sessionCode);
  if (!watcherMap) return;
  const prevTargetId = watcherMap.get(watcherPlayerId);
  if (!prevTargetId) return;
  watcherMap.delete(watcherPlayerId);
  if (watcherMap.size === 0) {
    securityWatchersBySession.delete(sessionCode);
  }
  syncTargetCaptureState(sessionCode, prevTargetId);
}

function reconcileSecurityStateWithSession(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
) {
  const watcherMap = securityWatchersBySession.get(session.sessionCode);
  if (!watcherMap || watcherMap.size === 0) return;

  if (session.phase !== 'PLAYING' || session.activeSabotage?.kind === 'SIGNAL_JAM') {
    const affectedTargets = new Set<string>();
    const affectedWatchers = new Set<string>();
    for (const [watcherId, targetId] of watcherMap.entries()) {
      affectedWatchers.add(watcherId);
      affectedTargets.add(targetId);
    }
    securityWatchersBySession.delete(session.sessionCode);

    for (const targetId of affectedTargets) {
      sendToPlayerSockets(session.sessionCode, targetId, {
        type: 'security:capture',
        payload: { active: false, watcherCount: 0 },
      });
    }
    const isJammed = session.phase === 'PLAYING' && session.activeSabotage?.kind === 'SIGNAL_JAM';
    for (const watcherId of affectedWatchers) {
      sendToPlayerSockets(session.sessionCode, watcherId, {
        type: isJammed ? 'security:jammed' : 'security:ended',
        payload: {
          message: isJammed
            ? 'Comms Signal Jam active — Security cameras offline!'
            : 'Security monitor disconnected.',
        },
      });
    }
    return;
  }

  const affectedTargets = new Set<string>();
  for (const [watcherId, targetId] of Array.from(watcherMap.entries())) {
    const watcher = session.players.find((p) => p.playerId === watcherId);
    const target = session.players.find((p) => p.playerId === targetId);
    if (!watcher || !watcher.alive || !target || !target.alive) {
      watcherMap.delete(watcherId);
      affectedTargets.add(targetId);
      if (watcher && !watcher.alive) {
        sendToPlayerSockets(session.sessionCode, watcherId, {
          type: 'security:ended',
          payload: { message: 'Security monitor closed — only alive players can view feeds.' },
        });
      } else if (watcher && (!target || !target.alive)) {
        sendToPlayerSockets(session.sessionCode, watcherId, {
          type: 'security:target_lost',
          payload: { targetPlayerId: targetId, reason: 'DECEASED' },
        });
      }
    }
  }
  if (watcherMap.size === 0) {
    securityWatchersBySession.delete(session.sessionCode);
  }
  for (const targetId of affectedTargets) {
    syncTargetCaptureState(session.sessionCode, targetId);
  }
}

function buildPublicSummary(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    sessionCode: session.sessionCode,
    phase: session.phase,
    takenColors: session.players.map((p) => p.color),
    playerCount: session.players.length,
  };
}

interface BroadcastEvent {
  type: string;
  payload?: unknown;
  targetPlayerId?: string;
}

async function broadcastSessionState(
  sessionCode: string,
  event?: BroadcastEvent | BroadcastEvent[],
) {
  const session = await getSession(sessionCode);
  if (!session) return;
  reconcileSecurityStateWithSession(session);
  const group = clientsBySession.get(sessionCode);
  if (!group) return;

  const lanUrls = getLanUrls(PORT);
  const publicSummary = buildPublicSummary(session);
  const events = event ? (Array.isArray(event) ? event : [event]) : [];

  for (const client of group) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    if (client.role === 'PUBLIC') {
      client.ws.send(
        JSON.stringify({
          type: 'state:public',
          payload: publicSummary,
        }),
      );
      continue;
    }

    for (const ev of events) {
      if (!ev.targetPlayerId || ev.targetPlayerId === client.playerId) {
        client.ws.send(JSON.stringify(ev));
      }
    }

    if (client.role === 'HOST' && client.token === session.hostToken) {
      client.ws.send(
        JSON.stringify({
          type: 'state:host',
          payload: projectForHost(session, lanUrls),
        }),
      );
    } else if (client.role === 'PLAYER') {
      const projection = projectForPlayer(session, client.token);
      if (projection) {
        client.ws.send(
          JSON.stringify({
            type: 'state:player',
            payload: projection,
          }),
        );
      } else {
        client.ws.send(JSON.stringify({ type: 'player:removed' }));
      }
    }
  }
}

async function main() {
  await initDatabase();
  const tlsCreds = resolveTlsCredentials();
  const serverProtocol: 'http' | 'https' = tlsCreds ? 'https' : 'http';
  activeProtocol = serverProtocol;

  const app = express();
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Name');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  // Public local download route for the Android companion APK
  app.get('/download/among-us-irl.apk', (req, res) => {
    const hosted = findHostedApkFile();
    if (!hosted) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Android APK has not been uploaded yet.' });
      }
      res.status(404).type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Android App Not Hosted Yet — AMONG-US IRL</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0B0F17; color: #F1F5F9; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 440px; width: 100%; background: #151C28; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 20px; color: #FFFFFF; }
    p { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #94A3B8; }
    code { background: #090D14; color: #67E8F9; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Android APK Not Hosted Yet</h1>
    <p>Ask the Host PC to drop <code>among-us-irl.apk</code> into the local <code>public-apk/</code> folder or drag-and-drop it into the <strong>Android Companion App</strong> card on Mission Control.</p>
    <p>Once uploaded, reload this link or scan the Download App QR code again.</p>
  </div>
</body>
</html>`);
      return;
    }

    const stat = fs.statSync(hosted.filePath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="among-us-irl.apk"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(hosted.filePath).pipe(res);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      dbMode: getDbMode(),
      protocol: serverProtocol,
      lanUrls: getLanUrls(PORT, serverProtocol),
    });
  });

  // Create a new Host game session
  app.post('/api/sessions', async (req, res) => {
    try {
      const origin = resolveRequestOrigin(req, serverProtocol);
      const { session, hostToken } = await createGameSession(origin);
      res.json({
        sessionCode: session.sessionCode,
        hostToken,
        state: projectForHost(session, getLanUrls(PORT, serverProtocol)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create session.' });
    }
  });

  // Fetch public lobby info (safe summary before joining)
  app.get('/api/sessions/:code/public', async (req, res) => {
    const code = sanitizeSessionCode(req.params.code);
    if (!code) return res.status(400).json({ error: 'Invalid session code format.' });
    const session = await getSession(code);
    if (!session) return res.status(404).json({ error: 'Mission session not found.' });

    res.json({
      sessionCode: session.sessionCode,
      phase: session.phase,
      takenColors: session.players.map((p) => p.color),
      playerCount: session.players.length,
    });
  });

  // Fetch authenticated host state
  app.get('/api/sessions/:code/host', async (req, res) => {
    const code = sanitizeSessionCode(req.params.code);
    const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!code || !hostToken) return res.status(401).json({ error: 'Missing session credentials.' });

    const session = await getSession(code);
    if (!session || session.hostToken !== hostToken) {
      return res.status(403).json({ error: 'Invalid host credentials.' });
    }
    res.json({ state: projectForHost(session, getLanUrls(PORT)) });
  });

  // Fetch authenticated player state
  app.get('/api/sessions/:code/player', async (req, res) => {
    const code = sanitizeSessionCode(req.params.code);
    const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!code || !playerToken) return res.status(401).json({ error: 'Missing player credentials.' });

    const session = await getSession(code);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const state = projectForPlayer(session, playerToken);
    if (!state) return res.status(403).json({ error: 'Player token is no longer valid.' });
    res.json({ state });
  });

  // Join session as smartphone player
  app.post('/api/sessions/:code/join', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      if (!code) return res.status(400).json({ error: 'Invalid session code.' });

      const { name, color } = req.body as { name?: unknown; color?: unknown };
      const { session, player } = await joinGameSession(code, name, color);
      await broadcastSessionState(session.sessionCode);

      res.json({
        playerToken: player.playerToken,
        state: projectForPlayer(session, player.playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to join mission.' });
    }
  });

  // Rejoin an active or lobby session using unique Lobby-Player Rejoin Code
  app.post('/api/sessions/:code/rejoin', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      if (!code) return res.status(400).json({ error: 'Invalid session code.' });

      const { rejoinCode } = req.body as { rejoinCode?: unknown };
      const { session, player } = await rejoinGameSession(code, rejoinCode);
      await broadcastSessionState(session.sessionCode, {
        type: 'player:rejoined',
        payload: {
          playerId: player.playerId,
          name: player.name,
          color: player.color,
          phase: session.phase,
        },
      });

      res.json({
        playerToken: player.playerToken,
        state: projectForPlayer(session, player.playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to rejoin mission.' });
    }
  });

  // Voluntary Leave Lobby / Eject from session
  app.post('/api/sessions/:code/leave', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) return res.status(401).json({ error: 'Unauthorized.' });

      const { session, departed } = await leaveGameSession(code, playerToken);
      if (departed && session) {
        clearWatcher(code, departed.playerId);
        const watchersOfDeparted = getTargetWatcherIds(code, departed.playerId);
        for (const watcherId of watchersOfDeparted) {
          sendToPlayerSockets(code, watcherId, {
            type: 'security:target_offline',
            payload: { targetPlayerId: departed.playerId },
          });
        }
        await broadcastSessionState(code, {
          type: 'player:left',
          payload: {
            playerId: departed.playerId,
            name: departed.name,
            color: departed.color,
            phase: session.phase,
          },
        });
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to leave session.' });
    }
  });

  // Switch player suit color in real time while in LOBBY
  app.post('/api/sessions/:code/player/color', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) return res.status(401).json({ error: 'Unauthorized.' });

      const { color } = req.body as { color?: unknown };
      const session = await changePlayerColorInLobby(code, playerToken, color);
      await broadcastSessionState(code);
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to switch suit color.' });
    }
  });

  // Host actions
  app.post('/api/sessions/:code/host/settings', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });

      const session = await updateSessionSettings(code, hostToken, req.body);
      await broadcastSessionState(code);
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update settings.' });
    }
  });

  app.post('/api/sessions/:code/host/url', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { publicUrl } = req.body as { publicUrl?: string };
      if (!code || !hostToken || typeof publicUrl !== 'string') {
        return res.status(400).json({ error: 'Invalid URL payload.' });
      }
      const session = await updateHostPublicUrl(code, hostToken, publicUrl);
      await broadcastSessionState(code);
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update URL.' });
    }
  });

  app.post('/api/sessions/:code/host/kick', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { playerId } = req.body as { playerId?: string };
      if (!code || !hostToken || typeof playerId !== 'string') {
        return res.status(400).json({ error: 'Invalid kick request.' });
      }
      const session = await kickPlayerFromLobby(code, hostToken, playerId);
      await broadcastSessionState(code);
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove player.' });
    }
  });

  app.post('/api/sessions/:code/host/start', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });
      const session = await startMission(code, hostToken);
      await broadcastSessionState(code, { type: 'mission:started' });
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to start mission.' });
    }
  });

  app.post('/api/sessions/:code/host/reset', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });
      const session = await resetMissionToLobby(code, hostToken);
      await broadcastSessionState(code, { type: 'mission:reset' });
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to reset lobby.' });
    }
  });

  app.post('/api/sessions/:code/host/start-discussion', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });
      const session = await forceStartMeetingDiscussion(code, hostToken);
      await broadcastSessionState(code);
      res.json({ state: projectForHost(session, getLanUrls(PORT)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to start discussion.' });
    }
  });

  // Host APK management (local public-apk/ folder + Mission Control drag-and-drop)
  app.get('/api/sessions/:code/host/apk', async (req, res) => {
    const code = sanitizeSessionCode(req.params.code);
    const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!code || !hostToken) return res.status(401).json({ error: 'Missing host credentials.' });
    const session = await getSession(code);
    if (!session || session.hostToken !== hostToken) {
      return res.status(403).json({ error: 'Invalid host credentials.' });
    }
    res.json({ status: getApkStatus() });
  });

  app.post(
    '/api/sessions/:code/host/apk',
    express.raw({
      type: ['application/vnd.android.package-archive', 'application/octet-stream'],
      limit: '125mb',
    }),
    async (req, res) => {
      try {
        const code = sanitizeSessionCode(req.params.code);
        const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
        if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });

        const session = await getSession(code);
        if (!session || session.hostToken !== hostToken) {
          return res.status(403).json({ error: 'Invalid host credentials.' });
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: 'Empty APK upload payload.' });
        }
        if (req.body.length > MAX_APK_BYTES) {
          return res.status(413).json({ error: 'APK exceeds maximum 125 MB size limit.' });
        }
        if (!isValidApkHeader(req.body)) {
          return res
            .status(400)
            .json({ error: 'Invalid file format. Please upload a compiled Android .apk package.' });
        }

        fs.mkdirSync(APK_DIR, { recursive: true });
        let decodedHeaderName = CANONICAL_APK_NAME;
        if (typeof req.headers['x-file-name'] === 'string') {
          try {
            decodedHeaderName = decodeURIComponent(req.headers['x-file-name']);
          } catch {
            decodedHeaderName = req.headers['x-file-name'];
          }
        }
        const rawHeaderName = path.basename(decodedHeaderName).slice(0, 120);
        const originalFileName = rawHeaderName.toLowerCase().endsWith('.apk')
          ? rawHeaderName
          : CANONICAL_APK_NAME;

        const sha256 = crypto.createHash('sha256').update(req.body).digest('hex');
        const tmpPath = resolveSafeApkPath(`${CANONICAL_APK_NAME}.tmp`);
        const finalPath = resolveSafeApkPath(CANONICAL_APK_NAME);
        const metaPath = resolveSafeApkPath(APK_META_NAME);

        fs.writeFileSync(tmpPath, req.body);
        fs.renameSync(tmpPath, finalPath);
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              originalFileName,
              sha256,
              sizeBytes: req.body.length,
              updatedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        );

        res.json({ status: getApkStatus() });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to store uploaded APK.',
        });
      }
    },
  );

  app.delete('/api/sessions/:code/host/apk', async (req, res) => {
    const code = sanitizeSessionCode(req.params.code);
    const hostToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!code || !hostToken) return res.status(401).json({ error: 'Unauthorized.' });
    const session = await getSession(code);
    if (!session || session.hostToken !== hostToken) {
      return res.status(403).json({ error: 'Invalid host credentials.' });
    }

    if (fs.existsSync(APK_DIR)) {
      for (const entry of fs.readdirSync(APK_DIR, { withFileTypes: true })) {
        if (entry.isFile() && (entry.name.toLowerCase().endsWith('.apk') || entry.name === APK_META_NAME)) {
          fs.unlinkSync(resolveSafeApkPath(entry.name));
        }
      }
    }
    res.json({ status: getApkStatus() });
  });

  // Player actions
  app.post('/api/sessions/:code/sabotage', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { kind } = req.body as { kind?: unknown };
      if (!code || !playerToken || (kind !== 'BLACKOUT' && kind !== 'SIGNAL_JAM')) {
        return res.status(400).json({ error: 'Invalid sabotage request.' });
      }
      const session = await triggerSabotage(code, playerToken, kind as SabotageKind);
      await broadcastSessionState(code, {
        type: 'sabotage:alert',
        payload: { kind },
      });
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Sabotage rejected.' });
    }
  });

  app.post('/api/sessions/:code/tasks/complete', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { taskId } = req.body as { taskId?: string };
      if (!code || !playerToken || typeof taskId !== 'string' || !SKELD_TASKS.some((t) => t.id === taskId)) {
        return res.status(400).json({ error: 'Invalid task submission.' });
      }
      const {
        session,
        wasCrewTask,
        powerRestored,
        sabotageCleared,
        visualAlertBroadcast,
      } = await completePlayerTask(code, playerToken, taskId as SkeldTaskId);

      const events: BroadcastEvent[] = [];
      if (sabotageCleared) {
        events.push({ type: 'sabotage:cleared', payload: { kind: sabotageCleared } });
      }
      if (visualAlertBroadcast && session.recentVisualAlert) {
        events.push({ type: 'visual:task', payload: session.recentVisualAlert });
      }

      await broadcastSessionState(code, events.length > 0 ? events : undefined);
      res.json({
        wasCrewTask,
        powerRestored,
        sabotageCleared,
        visualAlertBroadcast,
        state: projectForPlayer(session, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to complete task.' });
    }
  });

  app.post('/api/sessions/:code/scan-player', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { targetColor, mode } = req.body as { targetColor?: string; mode?: string };
      if (
        !code ||
        !playerToken ||
        typeof targetColor !== 'string' ||
        !PLAYER_COLORS.some((c) => c.id === targetColor)
      ) {
        return res.status(400).json({ error: 'Invalid player badge scan.' });
      }
      const validMode =
        mode === 'KILL' || mode === 'INVESTIGATE' || mode === 'SHERIFF' || mode === 'REPORT'
          ? mode
          : 'AUTO';

      const outcome = await processPlayerBackScan(
        code,
        playerToken,
        targetColor as PlayerColorId,
        validMode,
      );

      if (outcome.kind === 'KILL_EXECUTED') {
        await broadcastSessionState(code, {
          type: 'player:killed',
          targetPlayerId: outcome.victimId,
          payload: { victimName: outcome.victimName, victimColor: outcome.victimColor },
        });
      } else if (outcome.kind === 'SHIELD_BLOCKED') {
        await broadcastSessionState(code, {
          type: 'shield:blocked',
          payload: {
            targetId: outcome.targetId,
            targetName: outcome.targetName,
            targetColor: outcome.targetColor,
            guardianId: outcome.guardianId,
          },
        });
      } else if (outcome.kind === 'SHERIFF_KILL') {
        await broadcastSessionState(code, [
          {
            type: 'player:killed',
            targetPlayerId: outcome.targetId,
            payload: { victimName: outcome.targetName, victimColor: outcome.targetColor },
          },
          {
            type: 'sheriff:action',
            payload: {
              hit: true,
              targetName: outcome.targetName,
              targetColor: outcome.targetColor,
            },
          },
        ]);
      } else if (outcome.kind === 'SHERIFF_MISFIRE') {
        await broadcastSessionState(code, [
          {
            type: 'player:killed',
            targetPlayerId: outcome.sheriffId,
            payload: { victimName: outcome.sheriffName, victimColor: outcome.sheriffColor },
          },
          {
            type: 'sheriff:action',
            payload: {
              hit: false,
              sheriffName: outcome.sheriffName,
              sheriffColor: outcome.sheriffColor,
              targetName: outcome.targetName,
              targetColor: outcome.targetColor,
            },
          },
        ]);
      } else if (outcome.kind === 'BODY_REPORTED') {
        await broadcastSessionState(code, {
          type: 'meeting:alert',
          payload: {
            reason: 'BODY_REPORTED',
            victimName: outcome.victimName,
            victimColor: outcome.victimColor,
          },
        });
      } else if (outcome.kind !== 'DEAD_BODY_FOUND') {
        await broadcastSessionState(code);
      }

      const { session: outcomeSession, ...publicOutcome } = outcome;
      res.json({
        outcome: publicOutcome,
        state: projectForPlayer(outcomeSession, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Scan action rejected.' });
    }
  });

  app.post('/api/sessions/:code/shield', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { targetPlayerId } = req.body as { targetPlayerId?: unknown };
      if (!code || !playerToken || typeof targetPlayerId !== 'string' || !targetPlayerId.trim()) {
        return res.status(400).json({ error: 'Invalid shield target.' });
      }
      const { session, targetName, targetColor } = await castGuardianShield(
        code,
        playerToken,
        targetPlayerId.trim(),
      );
      await broadcastSessionState(code, {
        type: 'shield:deployed',
        payload: { targetName, targetColor },
      });
      res.json({
        targetName,
        targetColor,
        state: projectForPlayer(session, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to deploy Aegis Shield.' });
    }
  });

  app.post('/api/sessions/:code/reactor/scan', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const outcome = await scanReactorOverrideQr(code, playerToken);

      res.json({
        outcome: {
          kind: outcome.kind,
          triggered: outcome.triggered,
          message: outcome.message,
        },
        state: projectForPlayer(outcome.session, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reactor scan rejected.' });
    }
  });

  app.post('/api/sessions/:code/reactor/trigger', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      const session = await triggerArmedReactorMeltdown(code, playerToken);
      await broadcastSessionState(code, {
        type: 'sabotage:alert',
        payload: { kind: 'REACTOR' },
      });
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to trigger Reactor Meltdown.' });
    }
  });

  app.post('/api/sessions/:code/reactor/cancel', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      const session = await cancelArmedReactorMeltdown(code, playerToken);
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to cancel armed Meltdown.' });
    }
  });

  app.post('/api/sessions/:code/reactor/hold', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      const { holding } = req.body as { holding?: boolean };
      const { session, stabilized } = await updateReactorHold(
        code,
        playerToken,
        Boolean(holding),
      );

      if (stabilized) {
        await broadcastSessionState(code, {
          type: 'sabotage:cleared',
          payload: { kind: 'REACTOR' },
        });
      } else {
        await broadcastSessionState(code);
      }

      res.json({
        stabilized,
        state: projectForPlayer(session, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update Reactor Override.' });
    }
  });

  app.post('/api/sessions/:code/meeting/call', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) return res.status(401).json({ error: 'Unauthorized.' });

      const session = await triggerEmergencyButton(code, playerToken);
      await broadcastSessionState(code, {
        type: 'meeting:alert',
        payload: { reason: 'EMERGENCY_BUTTON' },
      });
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to call meeting.' });
    }
  });

  app.post('/api/sessions/:code/meeting/arrive', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) return res.status(401).json({ error: 'Unauthorized.' });

      const { session } = await markPlayerArrived(code, playerToken);
      await broadcastSessionState(code);
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Check-in failed.' });
    }
  });

  app.post('/api/sessions/:code/meeting/vote-now', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!code || !playerToken) return res.status(401).json({ error: 'Unauthorized.' });

      const { session, skippedDiscussion } = await agreeVoteNow(code, playerToken);
      await broadcastSessionState(code);
      res.json({ state: projectForPlayer(session, playerToken), skippedDiscussion });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Vote Now failed.' });
    }
  });

  app.post('/api/sessions/:code/meeting/vote', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { target } = req.body as { target?: string };
      if (!code || !playerToken || typeof target !== 'string') {
        return res.status(400).json({ error: 'Invalid vote payload.' });
      }
      const session = await castMeetingVote(code, playerToken, target);
      await broadcastSessionState(code);
      res.json({ state: projectForPlayer(session, playerToken) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Vote rejected.' });
    }
  });

  // Vite dev middleware or production dist
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = tlsCreds
    ? https.createServer(tlsCreds, app)
    : http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let clientMeta: WsClientMeta | null = null;

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          sessionCode?: string;
          role?: string;
          token?: string;
          targetPlayerId?: string;
          imageBase64?: string;
          busy?: boolean;
        };

        if (msg.type === 'subscribe') {
          const code = sanitizeSessionCode(msg.sessionCode);
          if (!code) return;
          const session = await getSession(code);
          if (!session) {
            ws.send(JSON.stringify({ type: 'error', error: 'Session not found.' }));
            return;
          }

          const role =
            msg.role === 'HOST' ? 'HOST' : msg.role === 'PUBLIC' ? 'PUBLIC' : 'PLAYER';
          let playerId: string | undefined;
          let rejoinedEvent:
            | {
                type: 'player:rejoined';
                payload: {
                  playerId: string;
                  name: string;
                  color: string;
                  phase: string;
                };
              }
            | undefined;

          if (role === 'PUBLIC') {
            clientMeta = { ws, sessionCode: code, role: 'PUBLIC', token: '' };
            if (!clientsBySession.has(code)) {
              clientsBySession.set(code, new Set());
            }
            clientsBySession.get(code)!.add(clientMeta);
            ws.send(
              JSON.stringify({
                type: 'state:public',
                payload: buildPublicSummary(session),
              }),
            );
            return;
          }

          if (typeof msg.token !== 'string') return;

          if (role === 'HOST') {
            if (msg.token !== session.hostToken) {
              ws.send(JSON.stringify({ type: 'error', error: 'Invalid host token.' }));
              return;
            }
          } else {
            const found = session.players.find((p) => p.playerToken === msg.token);
            if (!found) {
              ws.send(JSON.stringify({ type: 'player:removed' }));
              return;
            }
            const wasDisconnected = !found.connected;
            playerId = found.playerId;
            found.connected = true;
            if (wasDisconnected) {
              rejoinedEvent = {
                type: 'player:rejoined',
                payload: {
                  playerId: found.playerId,
                  name: found.name,
                  color: found.color,
                  phase: session.phase,
                },
              };
            }
          }

          clientMeta = { ws, sessionCode: code, role, token: msg.token, playerId };
          if (!clientsBySession.has(code)) {
            clientsBySession.set(code, new Set());
          }
          clientsBySession.get(code)!.add(clientMeta);

          if (role === 'HOST') {
            ws.send(
              JSON.stringify({
                type: 'state:host',
                payload: projectForHost(session, getLanUrls(PORT)),
              }),
            );
          } else {
            await broadcastSessionState(code, rejoinedEvent);
            if (playerId) {
              const activeWatchers = getTargetWatcherIds(code, playerId).length;
              ws.send(
                JSON.stringify({
                  type: 'security:capture',
                  payload: {
                    active:
                      session.phase === 'PLAYING' &&
                      session.activeSabotage?.kind !== 'SIGNAL_JAM' &&
                      activeWatchers > 0,
                    watcherCount: activeWatchers,
                  },
                }),
              );
            }
          }
          return;
        }

        if (!clientMeta || clientMeta.role !== 'PLAYER' || !clientMeta.playerId) {
          return;
        }

        const { sessionCode, playerId } = clientMeta;

        if (msg.type === 'security:open') {
          const session = await getSession(sessionCode);
          if (!session || session.phase !== 'PLAYING') {
            ws.send(
              JSON.stringify({
                type: 'security:error',
                payload: { error: 'Security monitors are only active during gameplay.' },
              }),
            );
            return;
          }
          const watcher = session.players.find((p) => p.playerId === playerId);
          if (!watcher || !watcher.alive) {
            ws.send(
              JSON.stringify({
                type: 'security:error',
                payload: { error: 'Only alive crewmates can operate Security Monitors.' },
              }),
            );
            return;
          }
          if (session.activeSabotage?.kind === 'SIGNAL_JAM') {
            clearWatcher(sessionCode, playerId);
            ws.send(
              JSON.stringify({
                type: 'security:jammed',
                payload: { message: 'Comms Signal Jam active — Security cameras offline!' },
              }),
            );
            return;
          }
          ws.send(JSON.stringify({ type: 'security:ready', payload: { ok: true } }));
          return;
        }

        if (msg.type === 'security:select') {
          const targetId = typeof msg.targetPlayerId === 'string' ? msg.targetPlayerId.trim() : '';
          const session = await getSession(sessionCode);
          if (!session || session.phase !== 'PLAYING') {
            clearWatcher(sessionCode, playerId);
            ws.send(
              JSON.stringify({
                type: 'security:ended',
                payload: { message: 'Security session ended.' },
              }),
            );
            return;
          }
          if (session.activeSabotage?.kind === 'SIGNAL_JAM') {
            clearWatcher(sessionCode, playerId);
            ws.send(
              JSON.stringify({
                type: 'security:jammed',
                payload: { message: 'Comms Signal Jam active — Security cameras offline!' },
              }),
            );
            return;
          }
          const watcher = session.players.find((p) => p.playerId === playerId);
          if (!watcher || !watcher.alive) {
            clearWatcher(sessionCode, playerId);
            ws.send(
              JSON.stringify({
                type: 'security:ended',
                payload: { message: 'Only alive crewmates can view security feeds.' },
              }),
            );
            return;
          }
          if (!targetId) {
            clearWatcher(sessionCode, playerId);
            return;
          }
          const target = session.players.find((p) => p.playerId === targetId);
          if (!target || target.playerId === playerId) {
            ws.send(
              JSON.stringify({
                type: 'security:error',
                payload: { error: 'Select another crewmate to view their rear camera.' },
              }),
            );
            return;
          }
          if (!target.alive) {
            clearWatcher(sessionCode, playerId);
            ws.send(
              JSON.stringify({
                type: 'security:target_lost',
                payload: { targetPlayerId: target.playerId, reason: 'DECEASED' },
              }),
            );
            return;
          }

          let watcherMap = securityWatchersBySession.get(sessionCode);
          if (!watcherMap) {
            watcherMap = new Map<string, string>();
            securityWatchersBySession.set(sessionCode, watcherMap);
          }
          const prevTargetId = watcherMap.get(playerId);
          watcherMap.set(playerId, target.playerId);

          if (prevTargetId && prevTargetId !== target.playerId) {
            syncTargetCaptureState(sessionCode, prevTargetId);
          }
          syncTargetCaptureState(sessionCode, target.playerId);

          const targetOnline = Array.from(clientsBySession.get(sessionCode) || []).some(
            (c) =>
              c.role === 'PLAYER' &&
              c.playerId === target.playerId &&
              c.ws.readyState === WebSocket.OPEN,
          );
          if (!targetOnline) {
            ws.send(
              JSON.stringify({
                type: 'security:target_offline',
                payload: { targetPlayerId: target.playerId },
              }),
            );
          }
          return;
        }

        if (msg.type === 'security:close') {
          clearWatcher(sessionCode, playerId);
          return;
        }

        if (msg.type === 'security:frame') {
          const b64 = typeof msg.imageBase64 === 'string' ? msg.imageBase64 : '';
          if (b64.length < 16 || b64.length > 180_000 || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
            return;
          }
          const watcherIds = getTargetWatcherIds(sessionCode, playerId);
          if (watcherIds.length === 0) return;

          const session = await getSession(sessionCode);
          if (
            !session ||
            session.phase !== 'PLAYING' ||
            session.activeSabotage?.kind === 'SIGNAL_JAM'
          ) {
            return;
          }
          const sender = session.players.find((p) => p.playerId === playerId);
          if (!sender || !sender.alive) return;

          const framePacket = {
            type: 'security:frame',
            payload: {
              targetPlayerId: playerId,
              imageBase64: b64,
              ts: Date.now(),
            },
          };
          for (const watcherId of watcherIds) {
            sendToPlayerSockets(sessionCode, watcherId, framePacket);
          }
          return;
        }

        if (msg.type === 'security:scanner_busy') {
          const watcherIds = getTargetWatcherIds(sessionCode, playerId);
          if (watcherIds.length === 0) return;
          const busyPacket = {
            type: 'security:target_busy',
            payload: {
              targetPlayerId: playerId,
              busy: Boolean(msg.busy),
            },
          };
          for (const watcherId of watcherIds) {
            sendToPlayerSockets(sessionCode, watcherId, busyPacket);
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', async () => {
      if (!clientMeta) return;
      const group = clientsBySession.get(clientMeta.sessionCode);
      if (group) {
        group.delete(clientMeta);
        if (group.size === 0) {
          clientsBySession.delete(clientMeta.sessionCode);
        }
      }
      if (clientMeta.role === 'PLAYER' && clientMeta.playerId) {
        const session = await getSession(clientMeta.sessionCode);
        const stillOnline = Array.from(clientsBySession.get(clientMeta.sessionCode) || []).some(
          (c) => c.playerId === clientMeta!.playerId,
        );
        if (!stillOnline) {
          clearWatcher(clientMeta.sessionCode, clientMeta.playerId);
          const watchersOfDisconnected = getTargetWatcherIds(
            clientMeta.sessionCode,
            clientMeta.playerId,
          );
          for (const watcherId of watchersOfDisconnected) {
            sendToPlayerSockets(clientMeta.sessionCode, watcherId, {
              type: 'security:target_offline',
              payload: { targetPlayerId: clientMeta.playerId },
            });
          }
          if (session) {
            const p = session.players.find((pl) => pl.playerId === clientMeta!.playerId);
            if (p) {
              p.connected = false;
              await broadcastSessionState(clientMeta.sessionCode);
            }
          }
        }
      }
    });
  });

  // Authoritative 1s game clock loop for meetings & verdicts
  setInterval(async () => {
    try {
      const codes = await getActiveSessionCodes();
      for (const code of codes) {
        const { changed, event } = await advanceSessionTimers(code);
        if (changed) {
          await broadcastSessionState(code, event);
        }
      }
    } catch {
      // Keep tick loop resilient
    }
  }, 1000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Skeld IRL running on ${serverProtocol}://0.0.0.0:${PORT}`);
    const lans = getLanUrls(PORT, serverProtocol);
    if (lans.length > 0) {
      console.log(`[SERVER] Local network URLs for smartphones: ${lans.join(', ')}`);
    }
  });
}

main().catch((err) => {
  console.error('[FATAL] Failed to boot server:', err);
  process.exit(1);
});
