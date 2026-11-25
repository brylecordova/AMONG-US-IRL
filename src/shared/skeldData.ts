export type TaskTier = 'COMMON' | 'SHORT' | 'LONG';

export type SkeldTaskId =
  | 'fix-wiring'
  | 'swipe-card'
  | 'clear-asteroids'
  | 'download-upload'
  | 'fuel-engines'
  | 'medbay-scan'
  | 'inspect-sample'
  | 'prime-shields'
  | 'start-reactor'
  | 'unlock-manifolds'
  | 'align-engine'
  | 'empty-garbage'
  | 'calibrate-distributor'
  | 'divert-power'
  | 'clean-o2-filter'
  | 'chart-course';

export interface SkeldTaskDef {
  id: SkeldTaskId;
  name: string;
  room: string;
  tier: TaskTier;
  isVisual: boolean;
  shortCode: string;
  instruction: string;
}

export const SKELD_TASKS: SkeldTaskDef[] = [
  {
    id: 'fix-wiring',
    name: 'Fix Wiring',
    room: 'Electrical',
    tier: 'COMMON',
    isVisual: false,
    shortCode: 'WIR1',
    instruction: 'Connect each colored wire on the left to its matching terminal on the right.',
  },
  {
    id: 'swipe-card',
    name: 'Swipe Card',
    room: 'Admin',
    tier: 'COMMON',
    isVisual: false,
    shortCode: 'CRD2',
    instruction: 'Pull your ID card from the wallet and swipe smoothly across the reader at steady speed.',
  },
  {
    id: 'clear-asteroids',
    name: 'Clear Asteroids',
    room: 'Weapons',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'AST3',
    instruction: 'Tap approaching asteroids inside the targeting viewport to destroy 20 targets.',
  },
  {
    id: 'download-upload',
    name: 'Upload Data',
    room: 'Cafeteria / Admin',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'DAT4',
    instruction: 'Initiate packet transfer from ship storage and hold connection until upload reaches 100%.',
  },
  {
    id: 'fuel-engines',
    name: 'Fuel Engines',
    room: 'Storage / Engine',
    tier: 'LONG',
    isVisual: false,
    shortCode: 'FUL5',
    instruction: 'Hold the fuel nozzle to fill the gas canister, then pour fuel into the engine manifold.',
  },
  {
    id: 'medbay-scan',
    name: 'Submit Scan',
    room: 'MedBay',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'MED6',
    instruction: 'Step onto the MedBay scanner pad and complete a full biometric body sweep.',
  },
  {
    id: 'inspect-sample',
    name: 'Inspect Sample',
    room: 'MedBay',
    tier: 'LONG',
    isVisual: false,
    shortCode: 'SMP7',
    instruction: 'Run the centrifuge analyzer and select the anomalous crimson reagent tube.',
  },
  {
    id: 'prime-shields',
    name: 'Prime Shields',
    room: 'Shields',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'SHD8',
    instruction: 'Tap all red hexagonal deflector nodes to prime the hull shield array.',
  },
  {
    id: 'start-reactor',
    name: 'Start Reactor',
    room: 'Reactor',
    tier: 'LONG',
    isVisual: false,
    shortCode: 'RCT9',
    instruction: 'Memorize the 5-stage light sequence on the left monitor and replicate it on the keypad.',
  },
  {
    id: 'unlock-manifolds',
    name: 'Unlock Manifolds',
    room: 'Reactor',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'MNF1',
    instruction: 'Tap numbered manifold switches in strict ascending order from 1 to 10.',
  },
  {
    id: 'align-engine',
    name: 'Align Engine Output',
    room: 'Upper Engine',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'ALN2',
    instruction: 'Adjust the thruster pitch slider until engine alignment locks on the 0.0° center line.',
  },
  {
    id: 'empty-garbage',
    name: 'Empty Chute',
    room: 'O2 / Storage',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'GRB3',
    instruction: 'Pull and hold the airlock chute lever until all debris clears the hatch.',
  },
  {
    id: 'calibrate-distributor',
    name: 'Calibrate Distributor',
    room: 'Electrical',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'CAL4',
    instruction: 'Lock each of the 3 rotating phase rings precisely as its contact aligns with the marker.',
  },
  {
    id: 'divert-power',
    name: 'Divert Power',
    room: 'Electrical',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'PWR5',
    instruction: 'Slide the illuminated power breaker to max output, then toggle the destination breaker.',
  },
  {
    id: 'clean-o2-filter',
    name: 'Clean O2 Filter',
    room: 'O2',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'OXY6',
    instruction: 'Pull all trapped leaves out of the intake grille into the left vacuum chute.',
  },
  {
    id: 'chart-course',
    name: 'Chart Course',
    room: 'Navigation',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'NAV7',
    instruction: 'Pilot the starship icon sequentially across all 4 navigation beacons to the exit vector.',
  },
];

export type PlayerColorId =
  | 'red'
  | 'blue'
  | 'green'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'black'
  | 'white'
  | 'purple'
  | 'brown'
  | 'cyan'
  | 'lime';

export interface PlayerColorDef {
  id: PlayerColorId;
  label: string;
  hex: string;
  shade: string;
  code: string;
  textOnSuit: string;
}

export const PLAYER_COLORS: PlayerColorDef[] = [
  { id: 'red', label: 'Red', hex: '#C51111', shade: '#7A0838', code: 'RED', textOnSuit: '#FFFFFF' },
  { id: 'blue', label: 'Blue', hex: '#132ED1', shade: '#09158E', code: 'BLU', textOnSuit: '#FFFFFF' },
  { id: 'green', label: 'Green', hex: '#117F2D', shade: '#0A4D2E', code: 'GRN', textOnSuit: '#FFFFFF' },
  { id: 'pink', label: 'Pink', hex: '#ED54BA', shade: '#AB2BAD', code: 'PNK', textOnSuit: '#0F172A' },
  { id: 'orange', label: 'Orange', hex: '#EF7D0D', shade: '#B33E15', code: 'ORG', textOnSuit: '#0F172A' },
  { id: 'yellow', label: 'Yellow', hex: '#F5F557', shade: '#C28722', code: 'YLW', textOnSuit: '#0F172A' },
  { id: 'black', label: 'Black', hex: '#3F474E', shade: '#1E1F26', code: 'BLK', textOnSuit: '#FFFFFF' },
  { id: 'white', label: 'White', hex: '#D6E0F0', shade: '#8394BF', code: 'WHT', textOnSuit: '#0F172A' },
  { id: 'purple', label: 'Purple', hex: '#6B2FBB', shade: '#3B177C', code: 'PRP', textOnSuit: '#FFFFFF' },
  { id: 'brown', label: 'Brown', hex: '#71491E', shade: '#5E2615', code: 'BRN', textOnSuit: '#FFFFFF' },
  { id: 'cyan', label: 'Cyan', hex: '#38FEDC', shade: '#24A8BE', code: 'CYN', textOnSuit: '#0F172A' },
  { id: 'lime', label: 'Lime', hex: '#50EF39', shade: '#15A742', code: 'LIM', textOnSuit: '#0F172A' },
];

export type StationId = 'admin-table' | 'security-cams' | 'vent-relay';

export interface StationDef {
  id: StationId;
  name: string;
  room: string;
  shortCode: string;
  accentHex: string;
  description: string;
}

export const STATION_CARDS: StationDef[] = [
  {
    id: 'admin-table',
    name: 'Admin Map Table',
    room: 'Admin',
    shortCode: 'ADM1',
    accentHex: '#10B981',
    description: 'View live anonymous occupancy across all Skeld rooms for 12 seconds.',
  },
  {
    id: 'security-cams',
    name: 'Security Terminal',
    room: 'Security',
    shortCode: 'SEC2',
    accentHex: '#06B6D4',
    description: 'Inspect an anonymized rolling feed of recent station & visual task alerts.',
  },
  {
    id: 'vent-relay',
    name: 'Airlock Vent Relay',
    room: 'MedBay / Electrical',
    shortCode: 'VNT3',
    accentHex: '#EF4444',
    description: 'Impostors scrub their latest Security trail and shave 6s off cooldowns. Sealed for Crew.',
  },
];

export const SKELD_ROOMS = [
  'Cafeteria',
  'Weapons',
  'O2',
  'Navigation',
  'Shields',
  'Storage',
  'Electrical',
  'Upper Engine',
  'Reactor',
  'MedBay',
  'Security',
  'Admin',
] as const;

export function normalizeSkeldRoom(rawRoom: string): string {
  const lower = rawRoom.toLowerCase();
  if (lower.includes('cafeteria')) return 'Cafeteria';
  if (lower.includes('weapons')) return 'Weapons';
  if (lower.includes('o2')) return 'O2';
  if (lower.includes('navigation')) return 'Navigation';
  if (lower.includes('shields')) return 'Shields';
  if (lower.includes('storage')) return 'Storage';
  if (lower.includes('electrical')) return 'Electrical';
  if (lower.includes('engine')) return 'Upper Engine';
  if (lower.includes('reactor')) return 'Reactor';
  if (lower.includes('medbay')) return 'MedBay';
  if (lower.includes('security')) return 'Security';
  if (lower.includes('admin')) return 'Admin';
  return 'Cafeteria';
}

export type SecretRole =
  | 'CREWMATE'
  | 'INVESTIGATOR'
  | 'SHERIFF'
  | 'GUARDIAN_ANGEL'
  | 'JESTER'
  | 'IMPOSTOR'
  | 'SHAPESHIFTER';
export type PublicAlignment = 'CREWMATE' | 'IMPOSTOR';
export type WinnerTeam = 'CREWMATES' | 'IMPOSTORS' | 'JESTER';
export type GamePhase = 'LOBBY' | 'PLAYING' | 'MEETING' | 'ENDED';
export type SabotageKind = 'BLACKOUT' | 'SIGNAL_JAM' | 'REACTOR' | 'O2';

export interface ActiveSabotage {
  kind: SabotageKind;
  startedAt: number;
  expiresAt?: number;
  clearedStations?: SkeldTaskId[];
  clearedByIds?: string[];
  syncWindowEndsAt?: number;
}

export interface GameSettings {
  impostorCount: 1 | 2;
  investigatorCount: number;
  sheriffCount: number;
  guardianAngelCount: number;
  jesterCount: number;
  tasksPerPlayer: number;
  killCooldownSec: number;
  scanCooldownSec: number;
  sabotageCooldownSec: number;
  discussionSec: number;
  votingSec: number;
  confirmEjects: boolean;
  hideManualCodes: boolean;
  anonymousVotes: boolean;
  turboMode: boolean;
  visualTaskAlerts: boolean;
  hostVoiceAnnouncer: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  impostorCount: 1,
  investigatorCount: 1,
  sheriffCount: 1,
  guardianAngelCount: 1,
  jesterCount: 0,
  tasksPerPlayer: 4,
  killCooldownSec: 25,
  scanCooldownSec: 20,
  sabotageCooldownSec: 30,
  discussionSec: 30,
  votingSec: 60,
  confirmEjects: true,
  hideManualCodes: false,
  anonymousVotes: false,
  turboMode: false,
  visualTaskAlerts: true,
  hostVoiceAnnouncer: true,
};

export interface AssignedTask {
  taskId: SkeldTaskId;
  completed: boolean;
}

export interface PlayerMatchStats {
  tasksCompleted: number;
  kills: number;
  sabotagesTriggered: number;
  sabotagesSaved: number;
  shieldsBlocked: number;
  sheriffHits: number;
  sheriffMisfires: number;
  meetingsCalled: number;
  ventsUsed: number;
}

export interface StationActivityEvent {
  id: string;
  room: string;
  label: string;
  kind: 'TASK' | 'VISUAL' | 'STATION' | 'SABOTAGE' | 'GHOST_PING' | 'GHOST_FLICKER' | 'VENT';
  timestamp: number;
}

export interface VisualTaskAlert {
  id: string;
  playerName: string;
  playerColor: PlayerColorId;
  taskName: string;
  room: string;
  timestamp: number;
}

export interface MatchTimelineEvent {
  id: string;
  timestamp: number;
  elapsedSec: number;
  kind:
    | 'MISSION_START'
    | 'TASK_VISUAL'
    | 'KILL'
    | 'SHIELD_BLOCKED'
    | 'SHERIFF_HIT'
    | 'SHERIFF_MISFIRE'
    | 'SABOTAGE'
    | 'SABOTAGE_CLEARED'
    | 'MEETING'
    | 'EJECTED'
    | 'GAME_END';
  title: string;
  detail?: string;
  accentColor?: PlayerColorId;
}

export interface PlayerAward {
  id: string;
  title: string;
  description: string;
  playerId: string;
  playerName: string;
  playerColor: PlayerColorId;
  badgeTone: 'emerald' | 'cyan' | 'amber' | 'red' | 'fuchsia';
}

export type MeetingStage = 'GATHERING' | 'DISCUSSION' | 'VOTING' | 'VERDICT';

export interface PublicPlayer {
  playerId: string;
  name: string;
  color: PlayerColorId;
  alive: boolean;
  connected: boolean;
  hasArrived: boolean;
  hasVotedNow?: boolean;
  hasVoted: boolean;
  revealedRole?: SecretRole;
  rejoinCode?: string;
  stats?: PlayerMatchStats;
}

export interface SelfPlayer extends PublicPlayer {
  rejoinCode: string;
  secretRole: SecretRole;
  assignedTasks: AssignedTask[];
  killCooldownRemainingSec: number;
  scanCooldownRemainingSec: number;
  sabotageCooldownRemainingSec: number;
  shieldCooldownRemainingSec: number;
  ventCooldownRemainingSec: number;
  shieldedUntil: number;
  ghostEnergy: number;
  teammates: Array<{ playerId: string; name: string; color: PlayerColorId; role: SecretRole }>;
}

export interface MeetingVoterBadge {
  playerId: string;
  name: string;
  color: PlayerColorId;
}

export interface MeetingVoteReveal {
  byTarget: Record<string, MeetingVoterBadge[]>;
  skipped: MeetingVoterBadge[];
}

export interface MeetingSummary {
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
  arrivedCount: number;
  voteNowCount: number;
  votesCastCount: number;
  totalAliveCount: number;
  voteBreakdown?: MeetingVoteReveal;
  ejectedPlayer?: {
    playerId: string;
    name: string;
    color: PlayerColorId;
    revealedRole?: SecretRole;
  } | null;
  verdictMessage?: string;
}

export interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface ClientGameState {
  sessionCode: string;
  phase: GamePhase;
  settings: GameSettings;
  players: PublicPlayer[];
  self: SelfPlayer;
  taskProgress: TaskProgress;
  activeSabotage: ActiveSabotage | null;
  meeting: MeetingSummary | null;
  winner: WinnerTeam | null;
  winReason: string | null;
  recentVisualAlert?: VisualTaskAlert | null;
  timeline?: MatchTimelineEvent[];
  awards?: PlayerAward[];
  serverTime: number;
}

export interface HostGameState {
  sessionCode: string;
  phase: GamePhase;
  settings: GameSettings;
  players: PublicPlayer[];
  taskProgress: TaskProgress;
  activeSabotage: ActiveSabotage | null;
  meeting: MeetingSummary | null;
  winner: WinnerTeam | null;
  winReason: string | null;
  roomActivity: Record<string, number>;
  activityFeed: StationActivityEvent[];
  recentVisualAlert?: VisualTaskAlert | null;
  timeline: MatchTimelineEvent[];
  awards: PlayerAward[];
  serverTime: number;
  publicUrl: string;
  lanUrls: string[];
  dbMode: 'mongodb' | 'local-fallback';
}

export type ParsedQrAction =
  | { kind: 'TASK'; sessionCode?: string; task: SkeldTaskDef }
  | { kind: 'STATION'; sessionCode?: string; station: StationDef }
  | { kind: 'PLAYER'; sessionCode?: string; color: PlayerColorDef }
  | { kind: 'MEETING'; sessionCode?: string }
  | { kind: 'JOIN'; sessionCode: string; serverOrigin?: string }
  | { kind: 'REJOIN'; sessionCode: string; rejoinCode: string; serverOrigin?: string };

export function buildTaskQrPayload(sessionCode: string, taskId: SkeldTaskId): string {
  return `SKELD|TASK|${sessionCode.toUpperCase()}|${taskId}`;
}

export function buildStationQrPayload(sessionCode: string, stationId: StationId): string {
  return `SKELD|STATION|${sessionCode.toUpperCase()}|${stationId}`;
}

export function buildPlayerQrPayload(sessionCode: string, colorId: PlayerColorId): string {
  return `SKELD|PLAYER|${sessionCode.toUpperCase()}|${colorId}`;
}

export function buildMeetingQrPayload(sessionCode: string): string {
  return `SKELD|MEETING|${sessionCode.toUpperCase()}|CAFETERIA`;
}

export function buildRejoinUrl(
  publicUrl: string,
  sessionCode: string,
  rejoinCode: string,
): string {
  const base = publicUrl.replace(/\/+$/, '');
  return `${base}/?join=${encodeURIComponent(sessionCode.toUpperCase())}&rejoin=${encodeURIComponent(rejoinCode.toUpperCase())}`;
}

export function parseQrOrManualInput(rawInput: string): ParsedQrAction | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Check Join / Rejoin URL (?join=CODE&rejoin=REJOIN)
  if (trimmed.includes('join=') || trimmed.includes('rejoin=')) {
    try {
      const url = new URL(trimmed);
      const code = url.searchParams.get('join')?.trim().toUpperCase();
      const rejoin = url.searchParams.get('rejoin')?.trim().toUpperCase();
      const serverOrigin = url.origin;
      if (
        code &&
        /^[A-Z0-9]{4,8}$/.test(code) &&
        rejoin &&
        /^[A-Z0-9]{4,10}$/.test(rejoin)
      ) {
        return { kind: 'REJOIN', sessionCode: code, rejoinCode: rejoin, serverOrigin };
      }
      if (code && /^[A-Z0-9]{4,8}$/.test(code)) {
        return { kind: 'JOIN', sessionCode: code, serverOrigin };
      }
    } catch {
      const matchOrigin = trimmed.match(/^(https?:\/\/[^/?#]+)/i);
      const matchJoin = trimmed.match(/join=([A-Z0-9]{4,8})/i);
      const matchRejoin = trimmed.match(/rejoin=([A-Z0-9]{4,10})/i);
      if (matchJoin && matchRejoin) {
        return {
          kind: 'REJOIN',
          sessionCode: matchJoin[1].toUpperCase(),
          rejoinCode: matchRejoin[1].toUpperCase(),
          serverOrigin: matchOrigin ? matchOrigin[1] : undefined,
        };
      }
      if (matchJoin) {
        return {
          kind: 'JOIN',
          sessionCode: matchJoin[1].toUpperCase(),
          serverOrigin: matchOrigin ? matchOrigin[1] : undefined,
        };
      }
    }
  }

  // Check structured QR format: SKELD|TYPE|SESSION|TARGET
  if (trimmed.toUpperCase().startsWith('SKELD|')) {
    const parts = trimmed.split('|');
    const kind = parts[1]?.toUpperCase();
    const sessionCode = parts[2]?.toUpperCase();
    const target = parts[3]?.toLowerCase();

    if (kind === 'REJOIN' && sessionCode && parts[3]) {
      const rejoinCode = parts[3].trim().toUpperCase();
      if (/^[A-Z0-9]{4,8}$/.test(sessionCode) && /^[A-Z0-9]{4,10}$/.test(rejoinCode)) {
        return { kind: 'REJOIN', sessionCode, rejoinCode };
      }
    }
    if (kind === 'TASK' && target) {
      const task = SKELD_TASKS.find((t) => t.id === target);
      if (task) return { kind: 'TASK', sessionCode, task };
    }
    if (kind === 'STATION' && target) {
      const station = STATION_CARDS.find((s) => s.id === target);
      if (station) return { kind: 'STATION', sessionCode, station };
    }
    if (kind === 'PLAYER' && target) {
      const color = PLAYER_COLORS.find((c) => c.id === target);
      if (color) return { kind: 'PLAYER', sessionCode, color };
    }
    if (kind === 'MEETING') {
      return { kind: 'MEETING', sessionCode };
    }
  }

  // Check manual short codes (e.g., WIR1, ADM1, RED, EMRG)
  const upper = trimmed.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (upper === 'EMRG' || upper === 'MEET' || upper === 'CAFETERIA') {
    return { kind: 'MEETING' };
  }

  const stationByShort = STATION_CARDS.find(
    (s) => s.shortCode === upper || s.id.toUpperCase() === upper,
  );
  if (stationByShort) {
    return { kind: 'STATION', station: stationByShort };
  }

  const taskByShort = SKELD_TASKS.find(
    (t) => t.shortCode === upper || t.id.toUpperCase() === upper,
  );
  if (taskByShort) {
    return { kind: 'TASK', task: taskByShort };
  }

  const colorByCode = PLAYER_COLORS.find(
    (c) => c.code === upper || c.id.toUpperCase() === upper || `P-${c.code}` === upper,
  );
  if (colorByCode) {
    return { kind: 'PLAYER', color: colorByCode };
  }

  return null;
}

export function getColorDef(colorId: PlayerColorId): PlayerColorDef {
  return PLAYER_COLORS.find((c) => c.id === colorId) || PLAYER_COLORS[0];
}

export function getTaskDef(taskId: SkeldTaskId): SkeldTaskDef {
  return SKELD_TASKS.find((t) => t.id === taskId) || SKELD_TASKS[0];
}

export function getStationDef(stationId: StationId): StationDef {
  return STATION_CARDS.find((s) => s.id === stationId) || STATION_CARDS[0];
}
