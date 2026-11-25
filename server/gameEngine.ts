import crypto from 'crypto';
import {
  ClientGameState,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  getColorDef,
  getTaskDef,
  HostGameState,
  MatchTimelineEvent,
  MeetingSummary,
  MeetingVoterBadge,
  MeetingVoteReveal,
  normalizeSkeldRoom,
  PLAYER_COLORS,
  PlayerAward,
  PlayerColorId,
  PlayerMatchStats,
  PublicAlignment,
  PublicPlayer,
  SabotageKind,
  SecretRole,
  SKELD_ROOMS,
  SKELD_TASKS,
  SkeldTaskId,
  STATION_CARDS,
  StationActivityEvent,
  StationId,
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

function emptyStats(): PlayerMatchStats {
  return {
    tasksCompleted: 0,
    kills: 0,
    sabotagesTriggered: 0,
    sabotagesSaved: 0,
    shieldsBlocked: 0,
    sheriffHits: 0,
    sheriffMisfires: 0,
    meetingsCalled: 0,
    ventsUsed: 0,
  };
}

function ensureStats(player: StoredPlayer): PlayerMatchStats {
  if (!player.stats) {
    player.stats = emptyStats();
  }
  return player.stats;
}

function isCrewAligned(role: SecretRole): boolean {
  return (
    role === 'CREWMATE' ||
    role === 'INVESTIGATOR' ||
    role === 'SHERIFF' ||
    role === 'GUARDIAN_ANGEL'
  );
}

function isImpostorAligned(role: SecretRole): boolean {
  return role === 'IMPOSTOR' || role === 'SHAPESHIFTER';
}

function effectiveCooldownSec(baseSec: number, settings: GameSettings): number {
  if (!settings.turboMode) return baseSec;
  return Math.max(5, Math.round(baseSec * 0.7));
}

function sanitizeSettings(raw: Partial<GameSettings> | undefined, existing: GameSettings): GameSettings {
  const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, Math.round(val)));
  };

  return {
    impostorCount: raw?.impostorCount === 2 ? 2 : raw?.impostorCount === 1 ? 1 : existing.impostorCount,
    investigatorCount: clamp(raw?.investigatorCount, 0, 3, existing.investigatorCount ?? 1),
    sheriffCount: clamp(raw?.sheriffCount, 0, 2, existing.sheriffCount ?? 1),
    guardianAngelCount: clamp(raw?.guardianAngelCount, 0, 2, existing.guardianAngelCount ?? 1),
    jesterCount: clamp(raw?.jesterCount, 0, 1, existing.jesterCount ?? 0),
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
    anonymousVotes:
      typeof raw?.anonymousVotes === 'boolean'
        ? raw.anonymousVotes
        : (existing.anonymousVotes ?? false),
    turboMode:
      typeof raw?.turboMode === 'boolean' ? raw.turboMode : (existing.turboMode ?? false),
    visualTaskAlerts:
      typeof raw?.visualTaskAlerts === 'boolean'
        ? raw.visualTaskAlerts
        : (existing.visualTaskAlerts ?? true),
    hostVoiceAnnouncer:
      typeof raw?.hostVoiceAnnouncer === 'boolean'
        ? raw.hostVoiceAnnouncer
        : (existing.hostVoiceAnnouncer ?? true),
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

function pushActivity(
  session: StoredSession,
  entry: {
    room: string;
    label: string;
    kind: StationActivityEvent['kind'];
    actorId?: string;
  },
): void {
  if (!session.activityFeed) session.activityFeed = [];
  session.activityFeed.unshift({
    id: randomToken(5),
    room: normalizeSkeldRoom(entry.room),
    label: entry.label,
    kind: entry.kind,
    actorId: entry.actorId,
    timestamp: Date.now(),
  });
  if (session.activityFeed.length > 28) {
    session.activityFeed = session.activityFeed.slice(0, 28);
  }
}

function pushTimeline(
  session: StoredSession,
  kind: MatchTimelineEvent['kind'],
  title: string,
  detail?: string,
  accentColor?: PlayerColorId,
): void {
  if (!session.timeline) session.timeline = [];
  const now = Date.now();
  const base = session.missionStartedAt || now;
  session.timeline.push({
    id: randomToken(5),
    timestamp: now,
    elapsedSec: Math.max(0, Math.round((now - base) / 1000)),
    kind,
    title,
    ...(detail ? { detail } : {}),
    ...(accentColor ? { accentColor } : {}),
  });
}

function computeRoomActivity(session: StoredSession, now: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const room of SKELD_ROOMS) {
    counts[room] = 0;
  }
  const cutoff = now - 75_000;
  for (const ev of session.activityFeed || []) {
    if (ev.timestamp >= cutoff) {
      const r = normalizeSkeldRoom(ev.room);
      counts[r] = (counts[r] || 0) + 1;
    }
  }
  return counts;
}

function sanitizeActivityFeed(session: StoredSession): StationActivityEvent[] {
  return (session.activityFeed || []).slice(0, 12).map((ev) => ({
    id: ev.id,
    room: ev.room,
    label: ev.label,
    kind: ev.kind,
    timestamp: ev.timestamp,
  }));
}

function computeMatchAwards(session: StoredSession): PlayerAward[] {
  const awards: PlayerAward[] = [];
  const players = session.players;
  if (players.length === 0) return awards;

  if (session.winner === 'JESTER') {
    const jester = players.find((p) => p.secretRole === 'JESTER');
    if (jester) {
      awards.push({
        id: 'fools-gold',
        title: "Fool's Gold",
        description: 'Convinced the entire crew to vote out The Jester.',
        playerId: jester.playerId,
        playerName: jester.name,
        playerColor: jester.color,
        badgeTone: 'fuchsia',
      });
    }
  }

  const sheriffHero = [...players]
    .filter((p) => (p.stats?.sheriffHits || 0) > 0)
    .sort((a, b) => (b.stats?.sheriffHits || 0) - (a.stats?.sheriffHits || 0))[0];
  if (sheriffHero) {
    awards.push({
      id: 'sharpshooter',
      title: 'Sharpshooter',
      description: `Eliminated ${sheriffHero.stats?.sheriffHits} Impostor threat via Justice Scan.`,
      playerId: sheriffHero.playerId,
      playerName: sheriffHero.name,
      playerColor: sheriffHero.color,
      badgeTone: 'amber',
    });
  } else {
    const misfire = players.find((p) => (p.stats?.sheriffMisfires || 0) > 0);
    if (misfire) {
      awards.push({
        id: 'quick-draw',
        title: 'Trigger-Happy',
        description: 'Fired a Sheriff Justice Scan on an innocent suit.',
        playerId: misfire.playerId,
        playerName: misfire.name,
        playerColor: misfire.color,
        badgeTone: 'amber',
      });
    }
  }

  const guardianHero = [...players]
    .filter((p) => (p.stats?.shieldsBlocked || 0) > 0)
    .sort((a, b) => (b.stats?.shieldsBlocked || 0) - (a.stats?.shieldsBlocked || 0))[0];
  if (guardianHero) {
    awards.push({
      id: 'guardian-spirit',
      title: 'Guardian Spirit',
      description: `Deflected ${guardianHero.stats?.shieldsBlocked} lethal attack${(guardianHero.stats?.shieldsBlocked || 0) === 1 ? '' : 's'} with Aegis Shield.`,
      playerId: guardianHero.playerId,
      playerName: guardianHero.name,
      playerColor: guardianHero.color,
      badgeTone: 'cyan',
    });
  }

  const taskMaster = [...players]
    .filter((p) => isCrewAligned(p.secretRole) && (p.stats?.tasksCompleted || 0) > 0)
    .sort((a, b) => (b.stats?.tasksCompleted || 0) - (a.stats?.tasksCompleted || 0))[0];
  if (taskMaster) {
    awards.push({
      id: 'taskmaster',
      title: 'Taskmaster',
      description: `Completed ${taskMaster.stats?.tasksCompleted} Skeld station assignments.`,
      playerId: taskMaster.playerId,
      playerName: taskMaster.name,
      playerColor: taskMaster.color,
      badgeTone: 'emerald',
    });
  }

  const topImp = [...players]
    .filter(
      (p) =>
        isImpostorAligned(p.secretRole) &&
        ((p.stats?.kills || 0) > 0 || (p.stats?.sabotagesTriggered || 0) > 0),
    )
    .sort(
      (a, b) =>
        (b.stats?.kills || 0) * 2 +
        (b.stats?.sabotagesTriggered || 0) -
        ((a.stats?.kills || 0) * 2 + (a.stats?.sabotagesTriggered || 0)),
    )[0];
  if (topImp) {
    awards.push({
      id: 'master-saboteur',
      title: 'Shadow Operative',
      description: `${topImp.stats?.kills || 0} kill${(topImp.stats?.kills || 0) === 1 ? '' : 's'} · ${topImp.stats?.sabotagesTriggered || 0} sabotage${(topImp.stats?.sabotagesTriggered || 0) === 1 ? '' : 's'}.`,
      playerId: topImp.playerId,
      playerName: topImp.name,
      playerColor: topImp.color,
      badgeTone: 'red',
    });
  }

  const emergencyHero = [...players]
    .filter((p) => (p.stats?.sabotagesSaved || 0) > 0)
    .sort((a, b) => (b.stats?.sabotagesSaved || 0) - (a.stats?.sabotagesSaved || 0))[0];
  if (emergencyHero && !awards.some((a) => a.playerId === emergencyHero.playerId)) {
    awards.push({
      id: 'first-responder',
      title: 'First Responder',
      description: `Stabilized ${emergencyHero.stats?.sabotagesSaved} ship crisis event${(emergencyHero.stats?.sabotagesSaved || 0) === 1 ? '' : 's'}.`,
      playerId: emergencyHero.playerId,
      playerName: emergencyHero.name,
      playerColor: emergencyHero.color,
      badgeTone: 'amber',
    });
  }

  if (awards.length < 3) {
    const caller = [...players]
      .filter((p) => (p.stats?.meetingsCalled || 0) > 0)
      .sort((a, b) => (b.stats?.meetingsCalled || 0) - (a.stats?.meetingsCalled || 0))[0];
    if (caller && !awards.some((a) => a.playerId === caller.playerId)) {
      awards.push({
        id: 'town-crier',
        title: 'Watchdog',
        description: `Called ${caller.stats?.meetingsCalled} Emergency Meeting${(caller.stats?.meetingsCalled || 0) === 1 ? '' : 's'}.`,
        playerId: caller.playerId,
        playerName: caller.name,
        playerColor: caller.color,
        badgeTone: 'cyan',
      });
    }
  }

  return awards.slice(0, 5);
}

export function computeTaskProgress(session: StoredSession): TaskProgress {
  let total = 0;
  let completed = 0;
  for (const p of session.players) {
    if (isCrewAligned(p.secretRole)) {
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
  if (stage === 'VOTING' || stage === 'VERDICT') {
    const byTarget: Record<string, MeetingVoterBadge[]> = {};
    const skipped: MeetingVoterBadge[] = [];
    let anonIndex = 1;
    for (const [voterId, targetId] of Object.entries(meeting.votes)) {
      const voter = session.players.find((p) => p.playerId === voterId);
      if (!voter) continue;
      const badge: MeetingVoterBadge = session.settings.anonymousVotes
        ? {
            playerId: `anon-${anonIndex++}`,
            name: 'Anonymous',
            color: 'white',
          }
        : {
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
    ...(meeting.revealEndsAt ? { revealEndsAt: meeting.revealEndsAt } : {}),
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
      ? { revealedRole: p.secretRole, stats: ensureStats(p) }
      : !p.alive && session.settings.confirmEjects && session.meeting?.ejectedPlayer?.playerId === p.playerId
        ? { revealedRole: p.secretRole }
        : {}),
  }));
}

export function projectForPlayer(session: StoredSession, playerToken: string): ClientGameState | null {
  const self = session.players.find((p) => p.playerToken === playerToken);
  if (!self) return null;

  const now = Date.now();
  const isImpostorTeam = isImpostorAligned(self.secretRole);
  const teammates = isImpostorTeam
    ? session.players
        .filter((p) => p.playerId !== self.playerId && isImpostorAligned(p.secretRole))
        .map((p) => ({ playerId: p.playerId, name: p.name, color: p.color, role: p.secretRole }))
    : [];

  const killCooldown = effectiveCooldownSec(session.settings.killCooldownSec, session.settings);
  const scanCooldown = effectiveCooldownSec(session.settings.scanCooldownSec, session.settings);
  const sabCooldown = effectiveCooldownSec(
    session.settings.sabotageCooldownSec ?? DEFAULT_GAME_SETTINGS.sabotageCooldownSec,
    session.settings,
  );
  const shieldCooldown = effectiveCooldownSec(30, session.settings);
  const ventCooldown = effectiveCooldownSec(20, session.settings);

  const killElapsed = Math.floor((now - self.lastKillAt) / 1000);
  const scanElapsed = Math.floor((now - self.lastScanAt) / 1000);
  const sabotageElapsed = session.lastSabotageAt ? Math.floor((now - session.lastSabotageAt) / 1000) : sabCooldown;
  const shieldElapsed = self.lastShieldAt ? Math.floor((now - self.lastShieldAt) / 1000) : shieldCooldown;
  const ventElapsed = self.lastVentAt ? Math.floor((now - self.lastVentAt) / 1000) : ventCooldown;

  const arrivedSet = new Set(session.meeting?.arrivedPlayerIds || []);
  const voteNowSet = new Set(session.meeting?.voteNowPlayerIds || []);

  const activeVisualAlert =
    session.recentVisualAlert && now - session.recentVisualAlert.timestamp <= 10_000
      ? session.recentVisualAlert
      : null;

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
          ? Math.max(0, killCooldown - killElapsed)
          : 0,
      scanCooldownRemainingSec:
        (self.secretRole === 'INVESTIGATOR' || self.secretRole === 'SHERIFF') &&
        session.phase === 'PLAYING'
          ? Math.max(0, scanCooldown - scanElapsed)
          : 0,
      sabotageCooldownRemainingSec:
        isImpostorTeam && session.phase === 'PLAYING' && !session.activeSabotage
          ? Math.max(0, sabCooldown - sabotageElapsed)
          : 0,
      shieldCooldownRemainingSec:
        self.secretRole === 'GUARDIAN_ANGEL' && session.phase === 'PLAYING'
          ? Math.max(0, shieldCooldown - shieldElapsed)
          : 0,
      ventCooldownRemainingSec:
        isImpostorTeam && session.phase === 'PLAYING'
          ? Math.max(0, ventCooldown - ventElapsed)
          : 0,
      shieldedUntil: self.shieldedUntil && self.shieldedUntil > now ? self.shieldedUntil : 0,
      ghostEnergy: self.ghostEnergy ?? 0,
      teammates,
      ...(session.phase === 'ENDED' ? { revealedRole: self.secretRole, stats: ensureStats(self) } : {}),
    },
    taskProgress: computeTaskProgress(session),
    activeSabotage: session.activeSabotage ?? null,
    meeting: projectMeeting(session, session.meeting),
    winner: session.winner,
    winReason: session.winReason,
    recentVisualAlert: activeVisualAlert,
    ...(session.phase === 'ENDED'
      ? {
          timeline: session.timeline || [],
          awards: session.awards || [],
        }
      : {}),
    serverTime: now,
  };
}

export function projectForHost(session: StoredSession, lanUrls: string[]): HostGameState {
  const now = Date.now();
  const activeVisualAlert =
    session.recentVisualAlert && now - session.recentVisualAlert.timestamp <= 12_000
      ? session.recentVisualAlert
      : null;

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
    roomActivity: computeRoomActivity(session, now),
    activityFeed: sanitizeActivityFeed(session),
    recentVisualAlert: activeVisualAlert,
    timeline: session.timeline || [],
    awards: session.awards || [],
    serverTime: now,
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
    activityFeed: [],
    recentVisualAlert: null,
    timeline: [],
    awards: [],
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
    lastShieldAt: 0,
    lastVentAt: 0,
    shieldedUntil: 0,
    ghostEnergy: 0,
    stats: emptyStats(),
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

  // Assign special roles from remaining non-Impostors (configurable in Rules & Balance)
  const remainingPool = shuffledPlayers.slice(effectiveImpostors);
  let cursor = 0;

  // Jester only spawns when enough crew parity exists so Crew doesn't auto-lose turn 0
  const maxCrewParitySafeJester =
    totalPlayers - effectiveImpostors - 1 > effectiveImpostors ? 1 : 0;
  const effectiveJesters = Math.min(
    session.settings.jesterCount ?? 0,
    maxCrewParitySafeJester,
    Math.max(0, remainingPool.length - cursor),
  );
  const jesterIds = new Set<string>(
    remainingPool.slice(cursor, cursor + effectiveJesters).map((p) => p.playerId),
  );
  cursor += effectiveJesters;

  const effectiveSheriffs = Math.min(
    session.settings.sheriffCount ?? 1,
    Math.max(0, remainingPool.length - cursor),
  );
  const sheriffIds = new Set<string>(
    remainingPool.slice(cursor, cursor + effectiveSheriffs).map((p) => p.playerId),
  );
  cursor += effectiveSheriffs;

  const effectiveGuardians = Math.min(
    session.settings.guardianAngelCount ?? 1,
    Math.max(0, remainingPool.length - cursor),
  );
  const guardianIds = new Set<string>(
    remainingPool.slice(cursor, cursor + effectiveGuardians).map((p) => p.playerId),
  );
  cursor += effectiveGuardians;

  const effectiveInvestigators = Math.min(
    session.settings.investigatorCount ?? 1,
    Math.max(0, remainingPool.length - cursor),
  );
  const investigatorIds = new Set<string>(
    remainingPool.slice(cursor, cursor + effectiveInvestigators).map((p) => p.playerId),
  );

  // Assign balanced tasks from SKELD_TASKS
  const effectiveTaskCount = session.settings.turboMode
    ? Math.max(2, session.settings.tasksPerPlayer - 1)
    : session.settings.tasksPerPlayer;
  const commonTasks = SKELD_TASKS.filter((t) => t.tier === 'COMMON');
  const sharedCommon = shuffle(commonTasks).slice(0, Math.min(2, effectiveTaskCount));
  const otherTasks = SKELD_TASKS.filter((t) => t.tier !== 'COMMON');

  const killCooldown = effectiveCooldownSec(session.settings.killCooldownSec, session.settings);
  const scanCooldown = effectiveCooldownSec(session.settings.scanCooldownSec, session.settings);
  const shieldCooldown = effectiveCooldownSec(30, session.settings);

  for (const player of session.players) {
    if (shapeshifterIds.has(player.playerId)) {
      player.secretRole = 'SHAPESHIFTER';
    } else if (impostorIds.has(player.playerId)) {
      player.secretRole = 'IMPOSTOR';
    } else if (jesterIds.has(player.playerId)) {
      player.secretRole = 'JESTER';
    } else if (sheriffIds.has(player.playerId)) {
      player.secretRole = 'SHERIFF';
    } else if (guardianIds.has(player.playerId)) {
      player.secretRole = 'GUARDIAN_ANGEL';
    } else if (investigatorIds.has(player.playerId)) {
      player.secretRole = 'INVESTIGATOR';
    } else {
      player.secretRole = 'CREWMATE';
    }

    player.alive = true;
    player.shieldedUntil = 0;
    player.shieldedBy = undefined;
    player.ghostEnergy = 0;
    player.stats = emptyStats();
    player.lastKillAt = now - Math.floor((killCooldown * 1000) / 2);
    player.lastScanAt = now - Math.floor((scanCooldown * 1000) / 2);
    player.lastShieldAt = now - Math.floor((shieldCooldown * 1000) / 2);
    player.lastVentAt = 0;

    const neededOther = Math.max(0, effectiveTaskCount - sharedCommon.length);
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
  session.missionStartedAt = now;
  session.lastGhostTickAt = now;
  session.jesterEjectedWinnerId = null;
  session.activityFeed = [];
  session.recentVisualAlert = null;
  session.timeline = [];
  session.awards = [];

  pushTimeline(
    session,
    'MISSION_START',
    'Mission Launched',
    `${totalPlayers} crew boarded · ${effectiveImpostors} Impostor${effectiveImpostors > 1 ? 's' : ''}${effectiveJesters > 0 ? ' · Jester active' : ''}`,
  );

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
  session.jesterEjectedWinnerId = null;
  session.activityFeed = [];
  session.recentVisualAlert = null;
  session.timeline = [];
  session.awards = [];
  for (const player of session.players) {
    player.alive = true;
    player.secretRole = 'CREWMATE';
    player.assignedTasks = [];
    player.lastKillAt = 0;
    player.lastScanAt = 0;
    player.lastShieldAt = 0;
    player.lastVentAt = 0;
    player.shieldedUntil = 0;
    player.shieldedBy = undefined;
    player.ghostEnergy = 0;
    player.stats = emptyStats();
  }
  await saveSession(session);
  return session;
}

function finalizeMatchEnd(
  session: StoredSession,
  winner: 'CREWMATES' | 'IMPOSTORS' | 'JESTER',
  winReason: string,
): boolean {
  session.phase = 'ENDED';
  session.activeSabotage = null;
  session.meeting = null;
  session.winner = winner;
  session.winReason = winReason;
  session.awards = computeMatchAwards(session);
  pushTimeline(
    session,
    'GAME_END',
    winner === 'JESTER'
      ? 'Jester Solo Victory!'
      : winner === 'CREWMATES'
        ? 'Crewmates Victory'
        : 'Impostors Victory',
    winReason,
  );
  return true;
}

function evaluateWinConditions(session: StoredSession): boolean {
  if (session.phase === 'ENDED') return true;

  if (session.jesterEjectedWinnerId) {
    const jester = session.players.find((p) => p.playerId === session.jesterEjectedWinnerId);
    session.jesterEjectedWinnerId = null;
    return finalizeMatchEnd(
      session,
      'JESTER',
      `${jester?.name || 'The Jester'} tricked the crew into ejecting them!`,
    );
  }

  const progress = computeTaskProgress(session);
  if (progress.total > 0 && progress.completed >= progress.total) {
    return finalizeMatchEnd(
      session,
      'CREWMATES',
      'All Skeld station tasks have been completed.',
    );
  }

  const aliveImpostors = session.players.filter(
    (p) => p.alive && isImpostorAligned(p.secretRole),
  ).length;
  const aliveCrew = session.players.filter(
    (p) => p.alive && isCrewAligned(p.secretRole),
  ).length;

  if (aliveImpostors === 0 && session.players.length > 0) {
    return finalizeMatchEnd(
      session,
      'CREWMATES',
      'All Impostors have been eliminated from The Skeld.',
    );
  }

  if (aliveImpostors >= aliveCrew && aliveImpostors > 0) {
    return finalizeMatchEnd(
      session,
      'IMPOSTORS',
      'Impostors reached crew parity and seized control of the ship.',
    );
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
  if (!isImpostorAligned(player.secretRole)) {
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
      throw new Error(`Sabotage (${session.activeSabotage.kind}) is already active.`);
    }
  }

  const cooldownSec = effectiveCooldownSec(
    session.settings.sabotageCooldownSec ?? DEFAULT_GAME_SETTINGS.sabotageCooldownSec,
    session.settings,
  );
  if (session.lastSabotageAt) {
    const elapsedSec = Math.floor((now - session.lastSabotageAt) / 1000);
    if (elapsedSec < cooldownSec) {
      throw new Error(`Sabotage module recharging: ${cooldownSec - elapsedSec}s remaining.`);
    }
  }

  const crisisDurationMs = session.settings.turboMode ? 35_000 : 45_000;
  if (kind === 'SIGNAL_JAM') {
    session.activeSabotage = { kind: 'SIGNAL_JAM', startedAt: now, expiresAt: now + 60_000 };
  } else if (kind === 'REACTOR') {
    session.activeSabotage = {
      kind: 'REACTOR',
      startedAt: now,
      expiresAt: now + crisisDurationMs,
      clearedStations: [],
      clearedByIds: [],
    };
  } else if (kind === 'O2') {
    session.activeSabotage = {
      kind: 'O2',
      startedAt: now,
      expiresAt: now + crisisDurationMs,
      clearedStations: [],
      clearedByIds: [],
    };
  } else {
    session.activeSabotage = { kind: 'BLACKOUT', startedAt: now };
  }

  session.lastSabotageAt = now;
  ensureStats(player).sabotagesTriggered += 1;

  const label =
    kind === 'BLACKOUT'
      ? 'Power Blackout initiated'
      : kind === 'SIGNAL_JAM'
        ? 'Comms Signal Jam initiated'
        : kind === 'REACTOR'
          ? 'Reactor Meltdown triggered!'
          : 'O2 Depletion triggered!';
  pushActivity(session, {
    room: kind === 'BLACKOUT' ? 'Electrical' : kind === 'REACTOR' ? 'Reactor' : kind === 'O2' ? 'O2' : 'Admin',
    label,
    kind: 'SABOTAGE',
  });
  pushTimeline(session, 'SABOTAGE', label);

  await saveSession(session);
  return session;
}

export async function completePlayerTask(
  sessionCode: string,
  playerToken: string,
  taskId: SkeldTaskId,
): Promise<{
  session: StoredSession;
  wasCrewTask: boolean;
  powerRestored: boolean;
  sabotageCleared: SabotageKind | null;
  meltdownProgress?: { clearedCount: number; needed: number };
  visualAlertBroadcast: boolean;
}> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Tasks can only be completed during active gameplay.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');

  const now = Date.now();
  const taskDef = getTaskDef(taskId);
  let powerRestored = false;
  let sabotageCleared: SabotageKind | null = null;
  let meltdownProgress: { clearedCount: number; needed: number } | undefined;

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
    session.lastSabotageAt = now;
    powerRestored = true;
    sabotageCleared = 'BLACKOUT';
    ensureStats(player).sabotagesSaved += 1;
    pushTimeline(session, 'SABOTAGE_CLEARED', 'Power Grid Restored', 'Fix Wiring completed at Electrical');
  } else if (session.activeSabotage?.kind === 'REACTOR' || session.activeSabotage?.kind === 'O2') {
    const sab = session.activeSabotage;
    const isReactorPair = sab.kind === 'REACTOR' && (taskId === 'start-reactor' || taskId === 'unlock-manifolds');
    const isO2Pair = sab.kind === 'O2' && (taskId === 'clean-o2-filter' || taskId === 'empty-garbage');

    if (isReactorPair || isO2Pair) {
      if (!player.alive) {
        throw new Error('Ghosts cannot stabilize critical Reactor or O2 emergencies.');
      }

      if (sab.syncWindowEndsAt && now > sab.syncWindowEndsAt) {
        sab.clearedStations = [];
        sab.clearedByIds = [];
      }

      const clearedStations = new Set<SkeldTaskId>(sab.clearedStations || []);
      const clearedByIds = new Set<string>(sab.clearedByIds || []);
      clearedStations.add(taskId);
      clearedByIds.add(player.playerId);

      sab.clearedStations = Array.from(clearedStations);
      sab.clearedByIds = Array.from(clearedByIds);
      sab.syncWindowEndsAt = now + 15_000;

      const aliveCount = session.players.filter((p) => p.alive).length;
      const clearedNow =
        clearedStations.size >= 2 || (aliveCount >= 2 && clearedByIds.size >= 2);

      if (clearedNow) {
        sabotageCleared = sab.kind;
        session.activeSabotage = null;
        session.lastSabotageAt = now;
        ensureStats(player).sabotagesSaved += 1;
        pushTimeline(
          session,
          'SABOTAGE_CLEARED',
          sabotageCleared === 'REACTOR' ? 'Reactor Meltdown Stabilized' : 'O2 Reserves Restored',
          'Emergency dual-station sync completed',
        );
      } else {
        meltdownProgress = { clearedCount: clearedStations.size, needed: 2 };
      }
    }
  }

  let visualAlertBroadcast = false;
  const isCrew = isCrewAligned(player.secretRole);
  const taskItem = player.assignedTasks.find((t) => t.taskId === taskId);

  // Record anonymized room activity for Admin / Security / TV Sector Map (for all living roles, including Impostor fake tasks!)
  if (player.alive) {
    if (taskDef.isVisual && session.settings.visualTaskAlerts && isCrew) {
      pushActivity(session, {
        room: taskDef.room,
        label: `Visual scan confirmed: ${taskDef.name}`,
        kind: 'VISUAL',
        actorId: player.playerId,
      });
      session.recentVisualAlert = {
        id: randomToken(5),
        playerName: player.name,
        playerColor: player.color,
        taskName: taskDef.name,
        room: normalizeSkeldRoom(taskDef.room),
        timestamp: now,
      };
      visualAlertBroadcast = true;
      pushTimeline(
        session,
        'TASK_VISUAL',
        `${player.name} completed Visual Task`,
        `${taskDef.name} (${taskDef.room})`,
        player.color,
      );
    } else {
      pushActivity(session, {
        room: taskDef.room,
        label: `Station ping in ${normalizeSkeldRoom(taskDef.room)}`,
        kind: 'TASK',
        actorId: player.playerId,
      });
    }
  }

  if (!taskItem) {
    if (sabotageCleared || meltdownProgress || visualAlertBroadcast) {
      await saveSession(session);
    }
    return {
      session,
      wasCrewTask: false,
      powerRestored,
      sabotageCleared,
      meltdownProgress,
      visualAlertBroadcast,
    };
  }

  if (!taskItem.completed) {
    taskItem.completed = true;
    if (!player.alive) {
      player.ghostEnergy = Math.min(100, (player.ghostEnergy ?? 0) + 25);
    }
    if (isCrew) {
      ensureStats(player).tasksCompleted += 1;
      evaluateWinConditions(session);
    }
    await saveSession(session);
  } else if (sabotageCleared || meltdownProgress || visualAlertBroadcast) {
    await saveSession(session);
  }

  return {
    session,
    wasCrewTask: isCrew,
    powerRestored,
    sabotageCleared,
    meltdownProgress,
    visualAlertBroadcast,
  };
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
      kind: 'SHIELD_BLOCKED';
      session: StoredSession;
      targetId: string;
      targetName: string;
      targetColor: PlayerColorId;
      guardianId?: string;
    }
  | {
      kind: 'SHERIFF_KILL';
      session: StoredSession;
      targetId: string;
      targetName: string;
      targetColor: PlayerColorId;
    }
  | {
      kind: 'SHERIFF_MISFIRE';
      session: StoredSession;
      sheriffId: string;
      sheriffName: string;
      sheriffColor: PlayerColorId;
      targetName: string;
      targetColor: PlayerColorId;
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
  mode: 'AUTO' | 'KILL' | 'INVESTIGATE' | 'SHERIFF' | 'REPORT',
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
    ensureStats(scanner).meetingsCalled += 1;
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
    pushTimeline(
      session,
      'MEETING',
      `Body Reported: ${target.name}`,
      `Reported by ${scanner.name}`,
      target.color,
    );
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
  const isImpostor = isImpostorAligned(scanner.secretRole);
  const killCooldown = effectiveCooldownSec(session.settings.killCooldownSec, session.settings);
  const scanCooldown = effectiveCooldownSec(session.settings.scanCooldownSec, session.settings);

  // 2. Impostor Kill (with Guardian Angel Aegis Shield check)
  if (isImpostor && (mode === 'KILL' || mode === 'AUTO')) {
    if (isImpostorAligned(target.secretRole)) {
      throw new Error('Cannot eliminate a fellow Impostor.');
    }
    const elapsedSec = Math.floor((now - scanner.lastKillAt) / 1000);
    if (elapsedSec < killCooldown) {
      const remaining = killCooldown - elapsedSec;
      throw new Error(`Kill module recharging: ${remaining}s remaining.`);
    }

    // Check Guardian Angel Aegis Shield!
    if (target.shieldedUntil && now < target.shieldedUntil) {
      const guardianId = target.shieldedBy;
      target.shieldedUntil = 0;
      target.shieldedBy = undefined;
      if (guardianId) {
        const guardian = session.players.find((p) => p.playerId === guardianId);
        if (guardian) {
          ensureStats(guardian).shieldsBlocked += 1;
        }
      }
      // Partial 10s cooldown reset for blocked attack
      const partialElapsed = Math.max(0, killCooldown - 10) * 1000;
      scanner.lastKillAt = now - partialElapsed;

      pushTimeline(
        session,
        'SHIELD_BLOCKED',
        `Aegis Shield Blocked Attack!`,
        `${target.name}'s Guardian Shield deflected an Impostor strike`,
        target.color,
      );
      await saveSession(session);
      return {
        kind: 'SHIELD_BLOCKED',
        session,
        targetId: target.playerId,
        targetName: target.name,
        targetColor: target.color,
        guardianId,
      };
    }

    target.alive = false;
    target.ghostEnergy = 40;
    scanner.lastKillAt = now;
    ensureStats(scanner).kills += 1;
    pushTimeline(
      session,
      'KILL',
      `${target.name} Eliminated`,
      `${getColorDef(target.color).label} suit fallen`,
      target.color,
    );
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

  // 3. Sheriff Justice Scan
  if (scanner.secretRole === 'SHERIFF' && (mode === 'SHERIFF' || mode === 'AUTO')) {
    const elapsedSec = Math.floor((now - scanner.lastScanAt) / 1000);
    if (elapsedSec < scanCooldown) {
      const remaining = scanCooldown - elapsedSec;
      throw new Error(`Justice badge recharging: ${remaining}s remaining.`);
    }

    scanner.lastScanAt = now;
    if (isImpostorAligned(target.secretRole)) {
      target.alive = false;
      target.ghostEnergy = 40;
      ensureStats(scanner).sheriffHits += 1;
      pushTimeline(
        session,
        'SHERIFF_HIT',
        `Sheriff Eliminated ${target.name}`,
        `${scanner.name} struck an Impostor`,
        target.color,
      );
      evaluateWinConditions(session);
      await saveSession(session);
      return {
        kind: 'SHERIFF_KILL',
        session,
        targetId: target.playerId,
        targetName: target.name,
        targetColor: target.color,
      };
    }

    // Misfire on Crewmate or Jester -> Sheriff self-eliminates!
    scanner.alive = false;
    scanner.ghostEnergy = 40;
    ensureStats(scanner).sheriffMisfires += 1;
    pushTimeline(
      session,
      'SHERIFF_MISFIRE',
      `Sheriff Misfired (${scanner.name})`,
      `Scanned ${target.name} (${getColorDef(target.color).label}) who was not an Impostor`,
      scanner.color,
    );
    evaluateWinConditions(session);
    await saveSession(session);
    return {
      kind: 'SHERIFF_MISFIRE',
      session,
      sheriffId: scanner.playerId,
      sheriffName: scanner.name,
      sheriffColor: scanner.color,
      targetName: target.name,
      targetColor: target.color,
    };
  }

  // 4. Investigator Forensic Scan
  if (scanner.secretRole === 'INVESTIGATOR' && (mode === 'INVESTIGATE' || mode === 'AUTO')) {
    const elapsedSec = Math.floor((now - scanner.lastScanAt) / 1000);
    if (elapsedSec < scanCooldown) {
      const remaining = scanCooldown - elapsedSec;
      throw new Error(`Forensic scanner recharging: ${remaining}s remaining.`);
    }

    scanner.lastScanAt = now;
    // Shapeshifter & Jester read as CREWMATE on Investigator scans!
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

  // 5. Standard Crewmate / Guardian / Jester safe ID check
  return {
    kind: 'ID_CHECK',
    session,
    targetName: target.name,
    targetColor: target.color,
    alive: target.alive,
  };
}

export async function castGuardianShield(
  sessionCode: string,
  playerToken: string,
  targetPlayerId: string,
): Promise<{ session: StoredSession; targetName: string; targetColor: PlayerColorId }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Aegis Shield can only be deployed during active gameplay.');
  }

  const guardian = session.players.find((p) => p.playerToken === playerToken);
  if (!guardian) throw new Error('Player session invalid.');
  if (guardian.secretRole !== 'GUARDIAN_ANGEL') {
    throw new Error('Only the Guardian Angel can deploy an Aegis Shield.');
  }

  const now = Date.now();
  const cooldownSec = effectiveCooldownSec(30, session.settings);
  if (guardian.lastShieldAt) {
    const elapsed = Math.floor((now - guardian.lastShieldAt) / 1000);
    if (elapsed < cooldownSec) {
      throw new Error(`Aegis Shield recharging: ${cooldownSec - elapsed}s remaining.`);
    }
  }

  if (!guardian.alive) {
    const energy = guardian.ghostEnergy ?? 0;
    if (energy < 50) {
      throw new Error(`Need 50 Ghost Energy to deploy Ghost Shield (${energy}/50). Complete ghost tasks to recharge.`);
    }
    guardian.ghostEnergy = energy - 50;
  }

  const target = session.players.find((p) => p.playerId === targetPlayerId && p.alive);
  if (!target) throw new Error('Select a living crewmate to shield.');
  if (target.playerId === guardian.playerId) {
    throw new Error('Guardian Angel cannot shield themselves.');
  }

  target.shieldedUntil = now + 35_000;
  target.shieldedBy = guardian.playerId;
  guardian.lastShieldAt = now;

  await saveSession(session);
  return { session, targetName: target.name, targetColor: target.color };
}

export type StationScanOutcome =
  | {
      kind: 'ADMIN_MAP';
      session: StoredSession;
      roomActivity: Record<string, number>;
    }
  | {
      kind: 'SECURITY_FEED';
      session: StoredSession;
      feed: StationActivityEvent[];
    }
  | {
      kind: 'VENT_RELAY';
      session: StoredSession;
      activated: boolean;
      cooldownShavedSec: number;
      scrubbedTrail: boolean;
      message: string;
    };

export async function processStationScan(
  sessionCode: string,
  playerToken: string,
  stationId: StationId,
): Promise<StationScanOutcome> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Station terminals are only active during gameplay.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');

  const station = STATION_CARDS.find((s) => s.id === stationId);
  if (!station) throw new Error('Unknown Skeld station terminal.');

  const now = Date.now();

  if (stationId === 'admin-table') {
    if (player.alive) {
      pushActivity(session, {
        room: 'Admin',
        label: 'Admin Map Table accessed',
        kind: 'STATION',
        actorId: player.playerId,
      });
      await saveSession(session);
    }
    return {
      kind: 'ADMIN_MAP',
      session,
      roomActivity: computeRoomActivity(session, now),
    };
  }

  if (stationId === 'security-cams') {
    if (player.alive) {
      pushActivity(session, {
        room: 'Security',
        label: 'Security cameras reviewed',
        kind: 'STATION',
        actorId: player.playerId,
      });
      await saveSession(session);
    }
    return {
      kind: 'SECURITY_FEED',
      session,
      feed: sanitizeActivityFeed(session),
    };
  }

  // Airlock Vent Relay (VNT3)
  if (!player.alive || !isImpostorAligned(player.secretRole)) {
    return {
      kind: 'VENT_RELAY',
      session,
      activated: false,
      cooldownShavedSec: 0,
      scrubbedTrail: false,
      message: 'Ventilation Grate Sealed — Crew Access Denied.',
    };
  }

  const ventCooldown = effectiveCooldownSec(20, session.settings);
  if (player.lastVentAt) {
    const elapsed = Math.floor((now - player.lastVentAt) / 1000);
    if (elapsed < ventCooldown) {
      throw new Error(`Airlock Vent cooling down: ${ventCooldown - elapsed}s remaining.`);
    }
  }

  // Scrub latest actorId activity trail & shave 6s from kill and sabotage cooldowns
  let scrubbedTrail = false;
  if (session.activityFeed) {
    const idx = session.activityFeed.findIndex((ev) => ev.actorId === player.playerId);
    if (idx !== -1) {
      session.activityFeed.splice(idx, 1);
      scrubbedTrail = true;
    }
  }

  player.lastKillAt = Math.min(now, player.lastKillAt - 6000);
  if (session.lastSabotageAt) {
    session.lastSabotageAt = Math.min(now, session.lastSabotageAt - 6000);
  }
  player.lastVentAt = now;
  ensureStats(player).ventsUsed += 1;

  await saveSession(session);
  return {
    kind: 'VENT_RELAY',
    session,
    activated: true,
    cooldownShavedSec: 6,
    scrubbedTrail,
    message: scrubbedTrail
      ? 'Vented! Latest Security trail scrubbed & cooldowns reduced by 6s.'
      : 'Vented! Kill and Sabotage cooldowns reduced by 6s.',
  };
}

export async function useGhostPower(
  sessionCode: string,
  playerToken: string,
  power: 'GHOST_PING' | 'GHOST_FLICKER',
  room: string,
): Promise<{ session: StoredSession; message: string }> {
  const session = await getSession(sessionCode);
  if (!session) throw new Error('Session not found.');
  if (session.phase !== 'PLAYING') {
    throw new Error('Ghost Powers are only active during gameplay.');
  }

  const player = session.players.find((p) => p.playerToken === playerToken);
  if (!player) throw new Error('Player session invalid.');
  if (player.alive) throw new Error('Only Ghost players can trigger Ghost Powers.');

  const normalizedRoom = normalizeSkeldRoom(room);
  const energy = player.ghostEnergy ?? 0;

  if (power === 'GHOST_PING') {
    if (!isCrewAligned(player.secretRole)) {
      throw new Error('Only Crew ghosts can send a luminous Admin Ping.');
    }
    if (energy < 40) {
      throw new Error(`Need 40 Ghost Energy (${energy}/40). Complete ghost tasks to recharge.`);
    }
    player.ghostEnergy = energy - 40;
    pushActivity(session, {
      room: normalizedRoom,
      label: `Ghost beacon pulse in ${normalizedRoom}`,
      kind: 'GHOST_PING',
    });
    await saveSession(session);
    return {
      session,
      message: `Sent Ghost Ping pulse to ${normalizedRoom} on Admin Map & TV!`,
    };
  }

  if (isCrewAligned(player.secretRole)) {
    throw new Error('Only Impostor or Jester ghosts can trigger Sensor Flicker.');
  }
  if (energy < 45) {
    throw new Error(`Need 45 Ghost Energy (${energy}/45). Complete ghost tasks to recharge.`);
  }
  player.ghostEnergy = energy - 45;
  pushActivity(session, {
    room: normalizedRoom,
    label: `Phantom motion spike in ${normalizedRoom}`,
    kind: 'GHOST_FLICKER',
  });
  await saveSession(session);
  return {
    session,
    message: `Triggered phantom Sensor Flicker in ${normalizedRoom}!`,
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
  if (session.activeSabotage) {
    if (session.activeSabotage.kind === 'SIGNAL_JAM') {
      const expiresAt = session.activeSabotage.expiresAt || 0;
      if (now < expiresAt) {
        const remaining = Math.ceil((expiresAt - now) / 1000);
        throw new Error(`Signal Jam active! Emergency Meetings are disabled for ${remaining}s.`);
      }
      session.activeSabotage = null;
    } else if (session.activeSabotage.kind === 'REACTOR' || session.activeSabotage.kind === 'O2') {
      throw new Error(
        `Cannot call Emergency Meeting during an active ${session.activeSabotage.kind} crisis!`,
      );
    }
  }

  session.phase = 'MEETING';
  session.activeSabotage = null;
  ensureStats(caller).meetingsCalled += 1;
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
  pushTimeline(
    session,
    'MEETING',
    `Emergency Meeting Called`,
    `Initiated by ${caller.name}`,
    caller.color,
  );
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

function finalizeMeetingVotes(session: StoredSession): { ejected: boolean; jesterWon: boolean } {
  const meeting = session.meeting;
  if (!meeting || meeting.verdictEndsAt) return { ejected: false, jesterWon: false };

  delete meeting.revealEndsAt;
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
    meeting.verdictEndsAt = now + 7000;
    pushTimeline(session, 'EJECTED', meeting.verdictMessage);
    return { ejected: false, jesterWon: false };
  }

  const ejected = session.players.find((p) => p.playerId === topTarget && p.alive);
  if (!ejected) {
    meeting.ejectedPlayer = null;
    meeting.verdictMessage = 'No valid target ejected.';
    meeting.verdictEndsAt = now + 7000;
    return { ejected: false, jesterWon: false };
  }

  ejected.alive = false;
  ejected.ghostEnergy = 40;
  const isImp = isImpostorAligned(ejected.secretRole);
  const isJester = ejected.secretRole === 'JESTER';

  if (isJester) {
    session.jesterEjectedWinnerId = ejected.playerId;
  }

  meeting.ejectedPlayer = {
    playerId: ejected.playerId,
    name: ejected.name,
    color: ejected.color,
    ...(session.settings.confirmEjects ? { revealedRole: ejected.secretRole } : {}),
  };

  if (session.settings.confirmEjects) {
    const aliveImps = session.players.filter(
      (p) => p.alive && isImpostorAligned(p.secretRole),
    ).length;
    if (isJester) {
      meeting.verdictMessage = `${ejected.name} was The Jester!`;
    } else {
      meeting.verdictMessage = isImp
        ? `${ejected.name} was an Impostor. ${aliveImps} Impostor${aliveImps === 1 ? '' : 's'} remaining.`
        : `${ejected.name} was not an Impostor. ${aliveImps} Impostor${aliveImps === 1 ? '' : 's'} remaining.`;
    }
  } else {
    meeting.verdictMessage = `${ejected.name} was ejected.`;
  }

  pushTimeline(
    session,
    'EJECTED',
    `${ejected.name} Ejected`,
    meeting.verdictMessage,
    ejected.color,
  );
  meeting.verdictEndsAt = now + 7500;
  return { ejected: true, jesterWon: isJester };
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
  if (session.meeting.revealEndsAt) {
    throw new Error('All votes are locked. Revealing results...');
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
    session.meeting.revealEndsAt = now + 3000;
    session.meeting.votingEndsAt = session.meeting.revealEndsAt;
  }

  await saveSession(session);
  return session;
}

export async function advanceSessionTimers(
  sessionCode: string,
): Promise<{ changed: boolean; event?: { type: string; payload?: unknown } }> {
  const session = await getSession(sessionCode);
  if (!session) return { changed: false };

  const now = Date.now();

  if (session.phase === 'PLAYING') {
    let changed = false;

    // Passive +5 Ghost Energy every 5s for ghosts
    if (!session.lastGhostTickAt || now - session.lastGhostTickAt >= 5000) {
      session.lastGhostTickAt = now;
      for (const p of session.players) {
        if (!p.alive && (p.ghostEnergy ?? 0) < 100) {
          p.ghostEnergy = Math.min(100, (p.ghostEnergy ?? 0) + 5);
          changed = true;
        }
        if (p.shieldedUntil && now >= p.shieldedUntil) {
          p.shieldedUntil = 0;
          p.shieldedBy = undefined;
          changed = true;
        }
      }
    }

    if (
      session.activeSabotage?.kind === 'SIGNAL_JAM' &&
      session.activeSabotage.expiresAt &&
      now >= session.activeSabotage.expiresAt
    ) {
      session.activeSabotage = null;
      session.lastSabotageAt = now;
      await saveSession(session);
      return {
        changed: true,
        event: { type: 'sabotage:cleared', payload: { kind: 'SIGNAL_JAM' } },
      };
    }

    if (
      (session.activeSabotage?.kind === 'REACTOR' || session.activeSabotage?.kind === 'O2') &&
      session.activeSabotage.expiresAt &&
      now >= session.activeSabotage.expiresAt
    ) {
      const kind = session.activeSabotage.kind;
      finalizeMatchEnd(
        session,
        'IMPOSTORS',
        kind === 'REACTOR'
          ? 'Reactor meltdown reached critical mass before stabilization.'
          : 'Ship oxygen reserves completely depleted.',
      );
      await saveSession(session);
      return {
        changed: true,
        event: { type: 'game:ended', payload: { winner: session.winner, winReason: session.winReason } },
      };
    }

    if (changed) {
      await saveSession(session);
    }
    return { changed };
  }

  if (session.phase !== 'MEETING' || !session.meeting) return { changed: false };

  // Do not run discussion/voting countdowns while players are physically walking to the table
  if (session.meeting.stage === 'GATHERING') return { changed: false };

  let changed = false;
  let emittedEvent: { type: string; payload?: unknown } | undefined;

  if (session.meeting.stage === 'DISCUSSION' && now >= session.meeting.discussionEndsAt) {
    session.meeting.stage = 'VOTING';
    changed = true;
  }

  const voteDeadline = session.meeting.revealEndsAt ?? session.meeting.votingEndsAt;
  if (!session.meeting.verdictEndsAt && now >= voteDeadline) {
    const verdict = finalizeMeetingVotes(session);
    emittedEvent = {
      type: 'meeting:verdict',
      payload: {
        ejected: verdict.ejected,
        ejectedName: session.meeting.ejectedPlayer?.name ?? null,
        verdictMessage: session.meeting.verdictMessage,
        jesterWon: verdict.jesterWon,
      },
    };
    changed = true;
  } else if (session.meeting.verdictEndsAt && now >= session.meeting.verdictEndsAt) {
    const ended = evaluateWinConditions(session);
    if (!ended) {
      session.phase = 'PLAYING';
      session.meeting = null;
      session.lastSabotageAt = now;
      for (const p of session.players) {
        p.lastKillAt = now;
        p.lastScanAt = now;
      }
    } else {
      emittedEvent = {
        type: 'game:ended',
        payload: { winner: session.winner, winReason: session.winReason },
      };
    }
    changed = true;
  }

  if (changed) {
    await saveSession(session);
  }
  return { changed, event: emittedEvent };
}
