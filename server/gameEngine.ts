import crypto from 'crypto';
import {
  ClientGameState,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  getColorDef,
  HostGameState,
  MeetingSummary,
  MeetingVoterBadge,
  MeetingVoteReveal,
  PLAYER_COLORS,
  PlayerColorId,
  PublicAlignment,
  PublicPlayer,
  SabotageKind,
  SecretRole,
  SKELD_TASKS,
  SkeldTaskId,
  TaskProgress,
} from '../src/shared/skeldData.ts';
import {
  getDbMode,
  getSession,
  saveSession,
  StoredMeeting,
  StoredPlayer,
  StoredSession,
} from './db.ts';

function randomToken(bytes = 20): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

function generateRejoinCode(existingPlayers: StoredPlayer[]): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const taken = new Set(existingPlayers.map((p) => p.rejoinCode));
  for (let attempt = 0; attempt < 100; attempt++) {
    let out = '';
    for (let i = 0; i < 5; i++) {
      out += chars[crypto.randomInt(0, chars.length)];
    }
    if (!taken.has(out)) return out;
  }
  return randomToken(3).toUpperCase();
}

function sanitizePlayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 1 || cleaned.length > 16) return null;
  return cleaned;
}

function sanitizeSettings(raw: Partial<GameSettings> | undefined, existing: GameSettings): GameSettings {
  const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, Math.round(val)));
  };

  return {
    impostorCount: raw?.impostorCount === 2 ? 2 : raw?.impostorCount === 1 ? 1 : existing.impostorCount,
    investigatorCount: clamp(raw?.investigatorCount, 0, 3, existing.investigatorCount),
    tasksPerPlayer: clamp(raw?.tasksPerPlayer, 2, 12, existing.tasksPerPlayer),
    killCooldownSec: clamp(raw?.killCooldownSec, 5, 90, existing.killCooldownSec),
    scanCooldownSec: clamp(raw?.scanCooldownSec, 5, 90, existing.scanCooldownSec),
    sabotageCooldownSec: clamp(
      raw?.sabotageCooldownSec,
      10,
      90,
      existing.sabotageCooldownSec ?? DEFAULT_GAME_SETTINGS.sabotageCooldownSec,
    ),
    discussionSec: clamp(raw?.discussionSec, 0, 120, existing.discussionSec),
    votingSec: clamp(raw?.votingSec, 15, 180, existing.votingSec),
    confirmEjects: typeof raw?.confirmEjects === 'boolean' ? raw.confirmEjects : existing.confirmEjects,
    hideManualCodes:
      typeof raw?.hideManualCodes === 'boolean'
        ? raw.hideManualCodes
        : (existing.hideManualCodes ?? false),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function computeTaskProgress(session: StoredSession): TaskProgress {
  let total = 0;
  let completed = 0;
  for (const p of session.players) {
    if (p.secretRole === 'CREWMATE' || p.secretRole === 'INVESTIGATOR') {
      total += p.assignedTasks.length;
      completed += p.assignedTasks.filter((t) => t.completed).length;
    }
  }
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percentage };
}

function projectMeeting(session: StoredSession, meeting: StoredMeeting | null): MeetingSummary | null {
  if (!meeting) return null;
  const alivePlayers = session.players.filter((p) => p.alive);
  const aliveIds = new Set(alivePlayers.map((p) => p.playerId));
  const arrivedIds = meeting.arrivedPlayerIds || [];
  const arrivedCount = arrivedIds.filter((id) => aliveIds.has(id)).length;
  const voteNowIds = meeting.voteNowPlayerIds || [];
  const voteNowCount = voteNowIds.filter((id) => aliveIds.has(id)).length;
  const stage = meeting.stage || 'DISCUSSION';

  let voteBreakdown: MeetingVoteReveal | undefined;
  if (stage === 'VERDICT') {
    const byTarget: Record<string, MeetingVoterBadge[]> = {};
    const skipped: MeetingVoterBadge[] = [];
    for (const [voterId, targetId] of Object.entries(meeting.votes)) {
      const voter = session.players.find((p) => p.playerId === voterId);
      if (!voter) continue;
      const badge: MeetingVoterBadge = {
        playerId: voter.playerId,
        name: voter.name,
        color: voter.color,
      };
      if (targetId === 'SKIP') {
        skipped.push(badge);
      } else {
        if (!byTarget[targetId]) byTarget[targetId] = [];
        byTarget[targetId].push(badge);
      }
    }
    voteBreakdown = { byTarget, skipped };
  }

  return {
    id: meeting.id,
    stage,
    reason: meeting.reason,
    reporterId: meeting.reporterId,
    reporterName: meeting.reporterName,
    reporterColor: meeting.reporterColor,
    victimName: meeting.victimName,
    victimColor: meeting.victimColor,
    startedAt: meeting.startedAt,
    discussionEndsAt: meeting.discussionEndsAt,
    votingEndsAt: meeting.votingEndsAt,
    verdictEndsAt: meeting.verdictEndsAt,
    arrivedCount,
    voteNowCount,
    votesCastCount: Object.keys(meeting.votes).length,
    totalAliveCount: alivePlayers.length,
    ...(voteBreakdown ? { voteBreakdown } : {}),
    ejectedPlayer: meeting.ejectedPlayer ?? null,
    verdictMessage: meeting.verdictMessage,
  };
}

function projectPublicPlayers(session: StoredSession, includeRejoinCodes = false): PublicPlayer[] {
  const revealAll = session.phase === 'ENDED';
  const arrivedSet = new Set(session.meeting?.arrivedPlayerIds || []);
  const voteNowSet = new Set(session.meeting?.voteNowPlayerIds || []);
  return session.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    color: p.color,
    alive: p.alive,
    connected: p.connected,
    hasArrived: arrivedSet.has(p.playerId),
    hasVotedNow: voteNowSet.has(p.playerId),
    hasVoted: Boolean(session.meeting?.votes[p.playerId]),
    ...(includeRejoinCodes ? { rejoinCode: p.rejoinCode } : {}),
    ...(revealAll
      ? { revealedRole: p.secretRole }
      : !p.alive && session.settings.confirmEjects && session.meeting?.ejectedPlayer?.playerId === p.playerId
        ? { revealedRole: p.secretRole }
        : {}),
  }));
}

export function projectForPlayer(session: StoredSession, playerToken: string): ClientGameState | null {
  const self = session.players.find((p) => p.playerToken === playerToken);
  if (!self) return null;

  const now = Date.now();
  const isImpostorTeam = self.secretRole === 'IMPOSTOR' || self.secretRole === 'SHAPESHIFTER';
  const teammates = isImpostorTeam
    ? session.players
        .filter((p) => p.playerId !== self.playerId && (p.secretRole === 'IMPOSTOR' || p.secretRole === 'SHAPESHIFTER'))
        .map((p) => ({ playerId: p.playerId, name: p.name, color: p.color, role: p.secretRole }))
    : [];

  const killElapsed = Math.floor((now - self.lastKillAt) / 1000);
  const scanElapsed = Math.floor((now - self.lastScanAt) / 1000);
  const sabotageCooldownSec = session.settings.sabotageCooldownSec ?? DEFAULT_GAME_SETTINGS.sabotageCooldownSec;
  const sabotageElapsed = session.lastSabotageAt ? Math.floor((now - session.lastSabotageAt) / 1000) : sabotageCooldownSec;
  const arrivedSet = new Set(session.meeting?.arrivedPlayerIds || []);
  const voteNowSet = new Set(session.meeting?.voteNowPlayerIds || []);

  return {
    sessionCode: session.sessionCode,
    phase: session.phase,
    settings: session.settings,
    players: projectPublicPlayers(session, false),
    self: {
      playerId: self.playerId,
      rejoinCode: self.rejoinCode || '',
      name: self.name,
      color: self.color,
      alive: self.alive,
      connected: self.connected,
      hasArrived: arrivedSet.has(self.playerId),
      hasVotedNow: voteNowSet.has(self.playerId),
      hasVoted: Boolean(session.meeting?.votes[self.playerId]),
      secretRole: self.secretRole,
      assignedTasks: self.assignedTasks,
      killCooldownRemainingSec:
        isImpostorTeam && session.phase === 'PLAYING'
          ? Math.max(0, session.settings.killCooldownSec - killElapsed)
          : 0,
      scanCooldownRemainingSec:
        self.secretRole === 'INVESTIGATOR' && session.phase === 'PLAYING'
          ? Math.max(0, session.settings.scanCooldownSec - scanElapsed)
          : 0,
      sabotageCooldownRemainingSec:
        isImpostorTeam && session.phase === 'PLAYING' && !session.activeSabotage
          ? Math.max(0, sabotageCooldownSec - sabotageElapsed)
          : 0,
      teammates,
      ...(session.phase === 'ENDED' ? { revealedRole: self.secretRole } : {}),
    },
    taskProgress: computeTaskProgress(session),
    activeSabotage: session.activeSabotage ?? null,
    meeting: projectMeeting(session, session.meeting),
    winner: session.winner,
    winReason: session.winReason,
    serverTime: now,
  };
}

export function projectForHost(session: StoredSession, lanUrls: string[]): HostGameState {
  return {
    sessionCode: session.sessionCode,
    phase: session.phase,
    settings: session.settings,
    players: projectPublicPlayers(session, true),
    taskProgress: computeTaskProgress(session),
    activeSabotage: session.activeSabotage ?? null,
    meeting: projectMeeting(session, session.meeting),
    winner: session.winner,
    winReason: session.winReason,
    serverTime: Date.now(),
    publicUrl: session.publicUrl,
    lanUrls,
    dbMode: getDbMode(),
  };
}

export async function createGameSession(publicUrl: string): Promise<{
  session: StoredSession;
  hostToken: string;
}> {
  let code = generateSessionCode();
  while (await getSession(code)) {
    code = generateSessionCode();
  }
  const hostToken = randomToken(24);
  const now = Date.now();
  const session: StoredSession = {
    sessionCode: code,
    hostToken,
    publicUrl,
    phase: 'LOBBY',
    settings: { ...DEFAULT_GAME_SETTINGS },
    players: [],
    activeSabotage: null,
    lastSabotageAt: 0,
    meeting: null,
    winner: null,
    winReason: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveSession(session);
  return { session, hostToken };
}

export async function updateHostPublicUrl(
  sessionCode: string,
  hostToken: string,
  publicUrl: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');
  const trimmed = publicUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+$/i.test(trimmed)) {
    throw new Error('URL must start with http:// or https://');
  }
  session.publicUrl = trimmed;
  await saveSession(session);
  return session;
}

export async function updateSessionSettings(
  sessionCode: string,
  hostToken: string,
  partialSettings: Partial<GameSettings>,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');
  if (session.phase !== 'LOBBY') throw new Error('Settings can only be changed in the lobby.');

  session.settings = sanitizeSettings(partialSettings, session.settings);
  await saveSession(session);
  return session;
}

export async function joinGameSession(
  sessionCode: string,
  rawName: unknown,
  rawColor: unknown,
): Promise<{ session: StoredSession; player: StoredPlayer }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Mission session code not found.');
  if (session.phase !== 'LOBBY') {
    throw new Error('Mission is already in progress. Wait for the lobby to reset.');
  }

  const name = sanitizePlayerName(rawName);
  if (!name) throw new Error('Player name must be 1–16 characters.');

  if (typeof rawColor !== 'string' || !PLAYER_COLORS.some((c) => c.id === rawColor)) {
    throw new Error('Invalid crewmate suit color.');
  }
  const color = rawColor as PlayerColorId;

  if (session.players.some((p) => p.color === color)) {
    throw new Error(`The ${getColorDef(color).label} suit is already claimed.`);
  }
  if (session.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Another crewmate already uses that callsign.');
  }
  if (session.players.length >= 12) {
    throw new Error('Ship manifest is full (max 12 players).');
  }

  const player: StoredPlayer = {
    playerId: randomToken(8),
    playerToken: randomToken(24),
    rejoinCode: generateRejoinCode(session.players),
    name,
    color,
    secretRole: 'CREWMATE',
    alive: true,
    assignedTasks: [],
    lastKillAt: 0,
    lastScanAt: 0,
    connected: true,
  };

  session.players.push(player);
  await saveSession(session);
  return { session, player };
}

export async function rejoinGameSession(
  sessionCode: string,
  rawRejoinCode: unknown,
): Promise<{ session: StoredSession; player: StoredPlayer }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Mission session code not found.');
  if (typeof rawRejoinCode !== 'string') {
    throw new Error('Enter your 5-character Player Rejoin Code.');
  }
  const cleaned = rawRejoinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) {
    throw new Error('Enter your 5-character Player Rejoin Code.');
  }

  const player = session.players.find((p) => (p.rejoinCode || '').toUpperCase() === cleaned);
  if (!player) {
    throw new Error('Player Rejoin Code not recognized in this session.');
  }

  player.connected = true;
  await saveSession(session);
  return { session, player };
}

export async function changePlayerColorInLobby(
  sessionCode: string,
  playerToken: string,
  rawColor: unknown,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'LOBBY') {
    throw new Error('Suit colors can only be changed while in the lobby.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');

  if (typeof rawColor !== 'string' || !PLAYER_COLORS.some((c) => c.id === rawColor)) {
    throw new Error('Invalid crewmate suit color.');
  }
  const nextColor = rawColor as PlayerColorId;
  if (player.color === nextColor) return session;

  if (session.players.some((p) => p.playerId !== player.playerId && p.color === nextColor)) {
    throw new Error(`The ${getColorDef(nextColor).label} suit is already claimed.`);
  }

  player.color = nextColor;
  await saveSession(session);
  return session;
}

export async function kickPlayerFromLobby(
  sessionCode: string,
  hostToken: string,
  targetPlayerId: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');
  if (session.phase !== 'LOBBY') throw new Error('Cannot remove players mid-mission.');

  session.players = session.players.filter((p) => p.playerId !== targetPlayerId);
  await saveSession(session);
  return session;
}

export async function startMission(
  sessionCode: string,
  hostToken: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');
  if (session.phase !== 'LOBBY') throw new Error('Mission already started.');

  const totalPlayers = session.players.length;
  const minPlayers = session.settings.impostorCount === 2 ? 4 : 2;
  if (totalPlayers < minPlayers) {
    throw new Error(
      session.settings.impostorCount === 2
        ? 'Need at least 4 players to launch a 2-Impostor mission.'
        : 'Need at least 2 players to launch a mission.',
    );
  }

  const effectiveImpostors =
    session.settings.impostorCount === 2 && totalPlayers >= 4 ? 2 : 1;

  const shuffledPlayers = shuffle(session.players);
  const now = Date.now();

  // Assign Impostors (if 2 impostors, 1 is automatically Shapeshifter!)
  const impostorIds = new Set<string>();
  const shapeshifterIds = new Set<string>();
  for (let i = 0; i < effectiveImpostors; i++) {
    const chosen = shuffledPlayers[i];
    if (i === 1 && effectiveImpostors === 2) {
      shapeshifterIds.add(chosen.playerId);
    } else {
      impostorIds.add(chosen.playerId);
    }
  }

  // Assign Investigators from remaining crewmates
  const remainingCrew = shuffledPlayers.slice(effectiveImpostors);
  const maxInvestigators = Math.min(session.settings.investigatorCount, remainingCrew.length);
  const investigatorIds = new Set<string>(
    remainingCrew.slice(0, maxInvestigators).map((p) => p.playerId),
  );

  // Assign balanced tasks from SKELD_TASKS
  const commonTasks = SKELD_TASKS.filter((t) => t.tier === 'COMMON');
  const sharedCommon = shuffle(commonTasks).slice(0, Math.min(2, session.settings.tasksPerPlayer));
  const otherTasks = SKELD_TASKS.filter((t) => t.tier !== 'COMMON');

  for (const player of session.players) {
    if (shapeshifterIds.has(player.playerId)) {
      player.secretRole = 'SHAPESHIFTER';
    } else if (impostorIds.has(player.playerId)) {
      player.secretRole = 'IMPOSTOR';
    } else if (investigatorIds.has(player.playerId)) {
      player.secretRole = 'INVESTIGATOR';
    } else {
      player.secretRole = 'CREWMATE';
    }

    player.alive = true;
    // Initial cooldown half-length at mission start so players spread out first
    const halfKillMs = Math.floor((session.settings.killCooldownSec * 1000) / 2);
    const halfScanMs = Math.floor((session.settings.scanCooldownSec * 1000) / 2);
    player.lastKillAt = now - halfKillMs;
    player.lastScanAt = now - halfScanMs;

    const neededOther = Math.max(0, session.settings.tasksPerPlayer - sharedCommon.length);
    const pickedIds: SkeldTaskId[] = [
      ...sharedCommon.map((t) => t.id),
      ...shuffle(otherTasks)
        .slice(0, neededOther)
        .map((t) => t.id),
    ];

    player.assignedTasks = pickedIds.map((taskId) => ({
      taskId,
      completed: false,
    }));
  }

  session.phase = 'PLAYING';
  session.activeSabotage = null;
  session.lastSabotageAt = 0;
  session.meeting = null;
  session.winner = null;
  session.winReason = null;

  await saveSession(session);
  return session;
}

export async function resetMissionToLobby(
  sessionCode: string,
  hostToken: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');

  session.phase = 'LOBBY';
  session.activeSabotage = null;
  session.lastSabotageAt = 0;
  session.meeting = null;
  session.winner = null;
  session.winReason = null;
  for (const player of session.players) {
    player.alive = true;
    player.secretRole = 'CREWMATE';
    player.assignedTasks = [];
    player.lastKillAt = 0;
    player.lastScanAt = 0;
  }
  await saveSession(session);
  return session;
}

function evaluateWinConditions(session: StoredSession): boolean {
  if (session.phase === 'ENDED') return true;

  const progress = computeTaskProgress(session);
  if (progress.total > 0 && progress.completed >= progress.total) {
    session.phase = 'ENDED';
    session.activeSabotage = null;
    session.meeting = null;
    session.winner = 'CREWMATES';
    session.winReason = 'All Skeld station tasks have been completed.';
    return true;
  }

  const aliveImpostors = session.players.filter(
    (p) => p.alive && (p.secretRole === 'IMPOSTOR' || p.secretRole === 'SHAPESHIFTER'),
  ).length;
  const aliveCrew = session.players.filter(
    (p) => p.alive && (p.secretRole === 'CREWMATE' || p.secretRole === 'INVESTIGATOR'),
  ).length;

  if (aliveImpostors === 0 && session.players.length > 0) {
    session.phase = 'ENDED';
    session.activeSabotage = null;
    session.meeting = null;
    session.winner = 'CREWMATES';
    session.winReason = 'All Impostors have been eliminated from The Skeld.';
    return true;
  }

  if (aliveImpostors >= aliveCrew && aliveImpostors > 0) {
    session.phase = 'ENDED';
    session.activeSabotage = null;
    session.meeting = null;
    session.winner = 'IMPOSTORS';
    session.winReason = 'Impostors reached crew parity and seized control of the ship.';
    return true;
  }

  return false;
}

export async function triggerSabotage(
  sessionCode: string,
  playerToken: string,
  kind: SabotageKind,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Sabotages can only be triggered during active gameplay.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');
  if (!player.alive) throw new Error('Eliminated Impostors cannot trigger sabotages.');
  if (player.secretRole !== 'IMPOSTOR' && player.secretRole !== 'SHAPESHIFTER') {
    throw new Error('Only Impostors can trigger ship sabotages.');
  }

  const now = Date.now();
  if (session.activeSabotage) {
    if (
      session.activeSabotage.kind === 'SIGNAL_JAM' &&
      session.activeSabotage.expiresAt &&
      now >= session.activeSabotage.expiresAt
    ) {
      session.activeSabotage = null;
    } else {
      throw new Error(
        session.activeSabotage.kind === 'BLACKOUT'
          ? 'Power Blackout is already active.'
          : 'Signal Jam is already active.',
      );
    }
  }

  const cooldownSec = session.settings.sabotageCooldownSec ?? DEFAULT_GAME_SETTINGS.sabotageCooldownSec;
  if (session.lastSabotageAt) {
    const elapsedSec = Math.floor((now - session.lastSabotageAt) / 1000);
    if (elapsedSec < cooldownSec) {
      throw new Error(`Sabotage module recharging: ${cooldownSec - elapsedSec}s remaining.`);
    }
  }

  session.activeSabotage =
    kind === 'SIGNAL_JAM'
      ? { kind: 'SIGNAL_JAM', startedAt: now, expiresAt: now + 60_000 }
      : { kind: 'BLACKOUT', startedAt: now };
  session.lastSabotageAt = now;

  await saveSession(session);
  return session;
}

export async function completePlayerTask(
  sessionCode: string,
  playerToken: string,
  taskId: SkeldTaskId,
): Promise<{ session: StoredSession; wasCrewTask: boolean; powerRestored: boolean }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Tasks can only be completed during active gameplay.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');

  let powerRestored = false;
  if (session.activeSabotage?.kind === 'BLACKOUT') {
    const codeHint = session.settings.hideManualCodes ? '' : ' (WIR1)';
    if (taskId !== 'fix-wiring') {
      throw new Error(
        `Power Blackout active! Tasks are locked until an alive player scans Fix Wiring${codeHint} and restores power.`,
      );
    }
    if (!player.alive) {
      throw new Error(
        `Power Blackout active! Ghosts cannot restore ship power — an alive player must complete Fix Wiring${codeHint}.`,
      );
    }
    session.activeSabotage = null;
    session.lastSabotageAt = Date.now();
    powerRestored = true;
  }

  const taskItem = player.assignedTasks.find((t) => t.taskId === taskId);
  if (!taskItem) {
    if (powerRestored) {
      await saveSession(session);
    }
    return { session, wasCrewTask: false, powerRestored };
  }

  if (!taskItem.completed) {
    taskItem.completed = true;
    evaluateWinConditions(session);
    await saveSession(session);
  } else if (powerRestored) {
    await saveSession(session);
  }

  const isCrew = player.secretRole === 'CREWMATE' || player.secretRole === 'INVESTIGATOR';
  return { session, wasCrewTask: isCrew, powerRestored };
}

export type ScanBackOutcome =
  | {
      kind: 'KILL_EXECUTED';
      session: StoredSession;
      victimId: string;
      victimName: string;
      victimColor: PlayerColorId;
    }
  | {
      kind: 'DEAD_BODY_FOUND';
      session: StoredSession;
      victimName: string;
      victimColor: PlayerColorId;
    }
  | {
      kind: 'BODY_REPORTED';
      session: StoredSession;
      victimName: string;
      victimColor: PlayerColorId;
    }
  | {
      kind: 'INVESTIGATE_RESULT';
      session: StoredSession;
      targetName: string;
      targetColor: PlayerColorId;
      reportedAlignment: PublicAlignment;
    }
  | {
      kind: 'ID_CHECK';
      session: StoredSession;
      targetName: string;
      targetColor: PlayerColorId;
      alive: boolean;
    };

export async function processPlayerBackScan(
  sessionCode: string,
  playerToken: string,
  targetColorId: PlayerColorId,
  mode: 'AUTO' | 'KILL' | 'INVESTIGATE' | 'REPORT',
): Promise<ScanBackOutcome> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Player QR scanning is only active during gameplay.');
  }

  const scanner = session.players.find((p) => p.playerToken === playerToken);
  if (!scanner) throw new Error('Player session invalid.');
  if (!scanner.alive) {
    throw new Error('Ghosts cannot kill, investigate, or report bodies.');
  }

  const target = session.players.find((p) => p.color === targetColorId);
  if (!target) {
    throw new Error(`No player in this session wears the ${getColorDef(targetColorId).label} suit.`);
  }
  if (target.playerId === scanner.playerId) {
    throw new Error('You cannot scan your own back badge.');
  }

  // 1. Dead body scan: first show "Call Emergency Meeting" button; only trigger meeting when mode === 'REPORT'
  if (!target.alive) {
    if (mode !== 'REPORT') {
      return {
        kind: 'DEAD_BODY_FOUND',
        session,
        victimName: target.name,
        victimColor: target.color,
      };
    }

    const now = Date.now();
    session.phase = 'MEETING';
    session.activeSabotage = null;
    session.meeting = {
      id: randomToken(8),
      stage: 'GATHERING',
      reason: 'BODY_REPORTED',
      reporterId: scanner.playerId,
      reporterName: scanner.name,
      reporterColor: scanner.color,
      victimName: target.name,
      victimColor: target.color,
      startedAt: now,
      discussionEndsAt: 0,
      votingEndsAt: 0,
      arrivedPlayerIds: [],
      voteNowPlayerIds: [],
      votes: {},
    };
    await saveSession(session);
    return {
      kind: 'BODY_REPORTED',
      session,
      victimName: target.name,
      victimColor: target.color,
    };
  }

  if (mode === 'REPORT') {
    throw new Error(`${target.name} (${getColorDef(target.color).label}) is still alive!`);
  }

  const now = Date.now();
  const isImpostor =
    scanner.secretRole === 'IMPOSTOR' || scanner.secretRole === 'SHAPESHIFTER';

  // 2. Impostor Kill
  if (isImpostor && (mode === 'KILL' || mode === 'AUTO')) {
    if (target.secretRole === 'IMPOSTOR' || target.secretRole === 'SHAPESHIFTER') {
      throw new Error('Cannot eliminate a fellow Impostor.');
    }
    const elapsedSec = Math.floor((now - scanner.lastKillAt) / 1000);
    if (elapsedSec < session.settings.killCooldownSec) {
      const remaining = session.settings.killCooldownSec - elapsedSec;
      throw new Error(`Kill module recharging: ${remaining}s remaining.`);
    }

    target.alive = false;
    scanner.lastKillAt = now;
    evaluateWinConditions(session);
    await saveSession(session);

    return {
      kind: 'KILL_EXECUTED',
      session,
      victimId: target.playerId,
      victimName: target.name,
      victimColor: target.color,
    };
  }

  // 3. Investigator Forensic Scan
  if (scanner.secretRole === 'INVESTIGATOR' && (mode === 'INVESTIGATE' || mode === 'AUTO')) {
    const elapsedSec = Math.floor((now - scanner.lastScanAt) / 1000);
    if (elapsedSec < session.settings.scanCooldownSec) {
      const remaining = session.settings.scanCooldownSec - elapsedSec;
      throw new Error(`Forensic scanner recharging: ${remaining}s remaining.`);
    }

    scanner.lastScanAt = now;
    // Shapeshifter deceives Investigator scans by reading as CREWMATE!
    const reportedAlignment: PublicAlignment =
      target.secretRole === 'IMPOSTOR' ? 'IMPOSTOR' : 'CREWMATE';

    await saveSession(session);
    return {
      kind: 'INVESTIGATE_RESULT',
      session,
      targetName: target.name,
      targetColor: target.color,
      reportedAlignment,
    };
  }

  // 4. Standard Crewmate safe ID check
  return {
    kind: 'ID_CHECK',
    session,
    targetName: target.name,
    targetColor: target.color,
    alive: target.alive,
  };
}

export async function triggerEmergencyButton(
  sessionCode: string,
  playerToken: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Emergency Meetings can only be called during active play.');
  }

  const caller = session.players.find((p) => p.playerToken === playerToken);
  if (!caller) throw new Error('Player session invalid.');
  if (!caller.alive) throw new Error('Ghosts cannot call an Emergency Meeting.');

  const now = Date.now();
  if (session.activeSabotage?.kind === 'SIGNAL_JAM') {
    const expiresAt = session.activeSabotage.expiresAt || 0;
    if (now < expiresAt) {
      const remaining = Math.ceil((expiresAt - now) / 1000);
      throw new Error(`Signal Jam active! Emergency Meetings are disabled for ${remaining}s.`);
    }
    session.activeSabotage = null;
  }

  session.phase = 'MEETING';
  session.activeSabotage = null;
  session.meeting = {
    id: randomToken(8),
    stage: 'GATHERING',
    reason: 'EMERGENCY_BUTTON',
    reporterId: caller.playerId,
    reporterName: caller.name,
    reporterColor: caller.color,
    startedAt: now,
    discussionEndsAt: 0,
    votingEndsAt: 0,
    arrivedPlayerIds: [],
    voteNowPlayerIds: [],
    votes: {},
  };
  await saveSession(session);
  return session;
}

function beginDiscussionStage(session: StoredSession): void {
  if (!session.meeting || session.meeting.stage !== 'GATHERING') return;
  const now = Date.now();
  session.meeting.voteNowPlayerIds = [];
  if (session.settings.discussionSec <= 0) {
    session.meeting.stage = 'VOTING';
    session.meeting.discussionEndsAt = now;
    session.meeting.votingEndsAt = now + session.settings.votingSec * 1000;
  } else {
    session.meeting.stage = 'DISCUSSION';
    session.meeting.discussionEndsAt = now + session.settings.discussionSec * 1000;
    session.meeting.votingEndsAt =
      now + (session.settings.discussionSec + session.settings.votingSec) * 1000;
  }
}

export async function markPlayerArrived(
  sessionCode: string,
  playerToken: string,
): Promise<{ session: StoredSession; startedDiscussion: boolean }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'MEETING' || !session.meeting) {
    throw new Error('No emergency meeting is active.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');
  if (!player.alive) throw new Error('Dead crewmates do not need to check in.');

  if (session.meeting.stage !== 'GATHERING') {
    return { session, startedDiscussion: false };
  }

  if (!session.meeting.arrivedPlayerIds) {
    session.meeting.arrivedPlayerIds = [];
  }
  if (!session.meeting.arrivedPlayerIds.includes(player.playerId)) {
    session.meeting.arrivedPlayerIds.push(player.playerId);
  }

  const alivePlayers = session.players.filter((p) => p.alive);
  const allArrived = alivePlayers.every((p) =>
    session.meeting!.arrivedPlayerIds.includes(p.playerId),
  );

  let startedDiscussion = false;
  if (allArrived) {
    beginDiscussionStage(session);
    startedDiscussion = true;
  }

  await saveSession(session);
  return { session, startedDiscussion };
}

export async function forceStartMeetingDiscussion(
  sessionCode: string,
  hostToken: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.hostToken !== hostToken) throw new Error('Unauthorized host token.');
  if (session.phase !== 'MEETING' || !session.meeting) {
    throw new Error('No meeting is active.');
  }

  beginDiscussionStage(session);
  await saveSession(session);
  return session;
}

export async function agreeVoteNow(
  sessionCode: string,
  playerToken: string,
): Promise<{ session: StoredSession; skippedDiscussion: boolean }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'MEETING' || !session.meeting) {
    throw new Error('No emergency meeting is active.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');
  if (!player.alive) throw new Error('Dead crewmates cannot vote to skip discussion.');

  if (session.meeting.stage !== 'DISCUSSION') {
    return { session, skippedDiscussion: false };
  }

  if (!session.meeting.voteNowPlayerIds) {
    session.meeting.voteNowPlayerIds = [];
  }
  if (!session.meeting.voteNowPlayerIds.includes(player.playerId)) {
    session.meeting.voteNowPlayerIds.push(player.playerId);
  }

  const alivePlayers = session.players.filter((p) => p.alive);
  const allAgreed = alivePlayers.every((p) =>
    session.meeting!.voteNowPlayerIds!.includes(p.playerId),
  );

  if (allAgreed) {
    const now = Date.now();
    session.meeting.stage = 'VOTING';
    session.meeting.discussionEndsAt = now;
    session.meeting.votingEndsAt = now + session.settings.votingSec * 1000;
  }

  await saveSession(session);
  return { session, skippedDiscussion: allAgreed };
}

function finalizeMeetingVotes(session: StoredSession): void {
  const meeting = session.meeting;
  if (!meeting || meeting.verdictEndsAt) return;

  meeting.stage = 'VERDICT';

  const tally = new Map<string, number>();
  for (const voteTarget of Object.values(meeting.votes)) {
    tally.set(voteTarget, (tally.get(voteTarget) || 0) + 1);
  }

  let topTarget: string | null = null;
  let topCount = 0;
  let isTie = false;

  for (const [target, count] of tally.entries()) {
    if (count > topCount) {
      topCount = count;
      topTarget = target;
      isTie = false;
    } else if (count === topCount) {
      isTie = true;
    }
  }

  const now = Date.now();

  if (!topTarget || isTie || topTarget === 'SKIP') {
    meeting.ejectedPlayer = null;
    meeting.verdictMessage = isTie
      ? 'Vote tied. No one was ejected.'
      : 'Crew skipped the vote. No one was ejected.';
    meeting.verdictEndsAt = now + 7500;
    return;
  }

  const ejected = session.players.find((p) => p.playerId === topTarget && p.alive);
  if (!ejected) {
    meeting.ejectedPlayer = null;
    meeting.verdictMessage = 'No valid target ejected.';
    meeting.verdictEndsAt = now + 7500;
    return;
  }

  ejected.alive = false;
  const isImp = ejected.secretRole === 'IMPOSTOR' || ejected.secretRole === 'SHAPESHIFTER';
  meeting.ejectedPlayer = {
    playerId: ejected.playerId,
    name: ejected.name,
    color: ejected.color,
    ...(session.settings.confirmEjects ? { revealedRole: ejected.secretRole } : {}),
  };

  if (session.settings.confirmEjects) {
    const aliveImps = session.players.filter(
      (p) => p.alive && (p.secretRole === 'IMPOSTOR' || p.secretRole === 'SHAPESHIFTER'),
    ).length;
    meeting.verdictMessage = isImp
      ? `${ejected.name} was an Impostor. ${aliveImps} Impostor${aliveImps === 1 ? '' : 's'} remaining.`
      : `${ejected.name} was not an Impostor. ${aliveImps} Impostor${aliveImps === 1 ? '' : 's'} remaining.`;
  } else {
    meeting.verdictMessage = `${ejected.name} was ejected.`;
  }

  meeting.verdictEndsAt = now + 7500;
}

export async function castMeetingVote(
  sessionCode: string,
  playerToken: string,
  targetPlayerIdOrSkip: string,
): Promise<StoredSession> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'MEETING' || !session.meeting) {
    throw new Error('No emergency meeting is active.');
  }
  if (session.meeting.stage === 'GATHERING') {
    throw new Error('Wait until all alive crewmates press HERE! at the meeting table.');
  }
  if (session.meeting.verdictEndsAt) {
    throw new Error('Voting has already concluded.');
  }

  const now = Date.now();
  if (session.meeting.stage === 'DISCUSSION' && now < session.meeting.discussionEndsAt) {
    const waitSec = Math.ceil((session.meeting.discussionEndsAt - now) / 1000);
    throw new Error(`Discussion phase active. Voting opens in ${waitSec}s.`);
  }

  const voter = session.players.find((p) => p.playerToken === playerToken);
  if (!voter) throw new Error('Player session invalid.');
  if (!voter.alive) throw new Error('Dead crewmates cannot cast votes.');
  if (session.meeting.votes[voter.playerId]) {
    throw new Error('Your vote is already locked in.');
  }

  if (targetPlayerIdOrSkip !== 'SKIP') {
    const target = session.players.find((p) => p.playerId === targetPlayerIdOrSkip && p.alive);
    if (!target) throw new Error('Selected vote target is not alive.');
  }

  session.meeting.votes[voter.playerId] = targetPlayerIdOrSkip;

  const aliveCount = session.players.filter((p) => p.alive).length;
  if (Object.keys(session.meeting.votes).length >= aliveCount) {
    finalizeMeetingVotes(session);
  }

  await saveSession(session);
  return session;
}

export async function advanceSessionTimers(sessionCode: string): Promise<boolean> {
  const session = await getSession(sessionCode);
  if (!session) return false;

  const now = Date.now();

  if (session.phase === 'PLAYING') {
    if (
      session.activeSabotage?.kind === 'SIGNAL_JAM' &&
      session.activeSabotage.expiresAt &&
      now >= session.activeSabotage.expiresAt
    ) {
      session.activeSabotage = null;
      session.lastSabotageAt = now;
      await saveSession(session);
      return true;
    }
    return false;
  }

  if (session.phase !== 'MEETING' || !session.meeting) return false;

  // Do not run discussion/voting countdowns while players are physically walking to the table
  if (session.meeting.stage === 'GATHERING') return false;

  let changed = false;

  if (session.meeting.stage === 'DISCUSSION' && now >= session.meeting.discussionEndsAt) {
    session.meeting.stage = 'VOTING';
    changed = true;
  }

  if (!session.meeting.verdictEndsAt && now >= session.meeting.votingEndsAt) {
    finalizeMeetingVotes(session);
    changed = true;
  } else if (session.meeting.verdictEndsAt && now >= session.meeting.verdictEndsAt) {
    const ended = evaluateWinConditions(session);
    if (!ended) {
      session.phase = 'PLAYING';
      session.meeting = null;
      session.lastSabotageAt = now;
      // Reset cooldowns cleanly after a meeting
      for (const p of session.players) {
        p.lastKillAt = now;
        p.lastScanAt = now;
      }
    }
    changed = true;
  }

  if (changed) {
    await saveSession(session);
  }
  return changed;
}
