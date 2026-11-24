import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  getActiveSessionCodes,
  getDbMode,
  getSession,
  initDatabase,
  sanitizeSessionCode,
} from './server/db.ts';
import {
  advanceSessionTimers,
  castMeetingVote,
  completePlayerTask,
  createGameSession,
  forceStartMeetingDiscussion,
  joinGameSession,
  kickPlayerFromLobby,
  markPlayerArrived,
  processPlayerBackScan,
  projectForHost,
  projectForPlayer,
  resetMissionToLobby,
  startMission,
  triggerEmergencyButton,
  updateHostPublicUrl,
  updateSessionSettings,
} from './server/gameEngine.ts';
import {
  PLAYER_COLORS,
  PlayerColorId,
  SKELD_TASKS,
  SkeldTaskId,
} from './src/shared/skeldData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

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
  role: 'HOST' | 'PLAYER';
  token: string;
  playerId?: string;
}

const clientsBySession = new Map<string, Set<WsClientMeta>>();

async function broadcastSessionState(sessionCode: string, event?: { type: string; payload?: unknown; targetPlayerId?: string }) {
  const session = await getSession(sessionCode);
  if (!session) return;
  const group = clientsBySession.get(sessionCode);
  if (!group) return;

  const lanUrls = getLanUrls(PORT);

  for (const client of group) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    if (event) {
      if (!event.targetPlayerId || event.targetPlayerId === client.playerId) {
        client.ws.send(JSON.stringify(event));
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
  app.use(express.json({ limit: '64kb' }));

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

  // Player actions
  app.post('/api/sessions/:code/tasks/complete', async (req, res) => {
    try {
      const code = sanitizeSessionCode(req.params.code);
      const playerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const { taskId } = req.body as { taskId?: string };
      if (!code || !playerToken || typeof taskId !== 'string' || !SKELD_TASKS.some((t) => t.id === taskId)) {
        return res.status(400).json({ error: 'Invalid task submission.' });
      }
      const { session, wasCrewTask } = await completePlayerTask(code, playerToken, taskId as SkeldTaskId);
      await broadcastSessionState(code);
      res.json({
        wasCrewTask,
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
        mode === 'KILL' || mode === 'INVESTIGATE' || mode === 'REPORT' ? mode : 'AUTO';

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
      } else if (outcome.kind === 'BODY_REPORTED') {
        await broadcastSessionState(code, {
          type: 'meeting:alert',
          payload: {
            reason: 'BODY_REPORTED',
            victimName: outcome.victimName,
            victimColor: outcome.victimColor,
          },
        });
      } else {
        await broadcastSessionState(code);
      }

      res.json({
        outcome: {
          kind: outcome.kind,
          ...(outcome.kind === 'KILL_EXECUTED'
            ? { victimName: outcome.victimName, victimColor: outcome.victimColor }
            : {}),
          ...(outcome.kind === 'BODY_REPORTED'
            ? { victimName: outcome.victimName, victimColor: outcome.victimColor }
            : {}),
          ...(outcome.kind === 'INVESTIGATE_RESULT'
            ? {
                targetName: outcome.targetName,
                targetColor: outcome.targetColor,
                reportedAlignment: outcome.reportedAlignment,
              }
            : {}),
          ...(outcome.kind === 'ID_CHECK'
            ? {
                targetName: outcome.targetName,
                targetColor: outcome.targetColor,
                alive: outcome.alive,
              }
            : {}),
        },
        state: projectForPlayer(outcome.session, playerToken),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Scan action rejected.' });
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
        };

        if (msg.type === 'subscribe') {
          const code = sanitizeSessionCode(msg.sessionCode);
          if (!code || typeof msg.token !== 'string') return;
          const session = await getSession(code);
          if (!session) {
            ws.send(JSON.stringify({ type: 'error', error: 'Session not found.' }));
            return;
          }

          const role = msg.role === 'HOST' ? 'HOST' : 'PLAYER';
          let playerId: string | undefined;

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
            playerId = found.playerId;
            found.connected = true;
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
            await broadcastSessionState(code);
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
        if (session) {
          const stillOnline = Array.from(clientsBySession.get(clientMeta.sessionCode) || []).some(
            (c) => c.playerId === clientMeta!.playerId,
          );
          if (!stillOnline) {
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
        const changed = await advanceSessionTimers(code);
        if (changed) {
          await broadcastSessionState(code);
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
