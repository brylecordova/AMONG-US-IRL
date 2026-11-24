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
    instruction: 'Pull your ID card from the wallet and swipe smoothly across the reader.',
  },
  {
    id: 'clear-asteroids',
    name: 'Clear Asteroids',
    room: 'Weapons',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'AST3',
    instruction: 'Tap approaching asteroids inside the targeting viewport to destroy targets.',
  },
  {
    id: 'download-upload',
    name: 'Upload Data',
    room: 'Cafeteria / Admin',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'DAT4',
    instruction: 'Initiate packet transfer from ship storage until upload reaches 100%.',
  },
  {
    id: 'fuel-engines',
    name: 'Fuel Engines',
    room: 'Storage / Engine',
    tier: 'LONG',
    isVisual: false,
    shortCode: 'FUL5',
    instruction: 'Hold the fuel nozzle to fill the gas canister, then pour into the engine manifold.',
  },
  {
    id: 'medbay-scan',
    name: 'Submit Scan',
    room: 'MedBay',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'MED6',
    instruction: 'Hold the biometric pad to complete a full body scan.',
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
    instruction: 'Memorize the light sequence and replicate it on the keypad.',
  },
  {
    id: 'unlock-manifolds',
    name: 'Unlock Manifolds',
    room: 'Reactor',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'MNF1',
    instruction: 'Tap numbered manifold switches in ascending order from 1 to 10.',
  },
  {
    id: 'align-engine',
    name: 'Align Engine Output',
    room: 'Upper Engine',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'ALN2',
    instruction: 'Adjust thruster pitch until engine alignment locks on the 0.0 deg center line.',
  },
  {
    id: 'empty-garbage',
    name: 'Empty Chute',
    room: 'O2 / Storage',
    tier: 'SHORT',
    isVisual: true,
    shortCode: 'GRB3',
    instruction: 'Hold the airlock chute lever until all debris clears the hatch.',
  },
  {
    id: 'calibrate-distributor',
    name: 'Calibrate Distributor',
    room: 'Electrical',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'CAL4',
    instruction: 'Lock each of the 3 rotating phase rings as its contact passes the marker.',
  },
  {
    id: 'divert-power',
    name: 'Divert Power',
    room: 'Electrical',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'PWR5',
    instruction: 'Raise the illuminated power slider to max output, then flip the main breaker.',
  },
  {
    id: 'clean-o2-filter',
    name: 'Clean O2 Filter',
    room: 'O2',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'OXY6',
    instruction: 'Tap each trapped leaf on the intake grille to vacuum it into the chute.',
  },
  {
    id: 'chart-course',
    name: 'Chart Course',
    room: 'Navigation',
    tier: 'SHORT',
    isVisual: false,
    shortCode: 'NAV7',
    instruction: 'Tap the 4 navigation beacons in sequence to plot the exit vector.',
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

export type SecretRole = 'CREWMATE' | 'INVESTIGATOR' | 'IMPOSTOR' | 'SHAPESHIFTER';
export type PublicAlignment = 'CREWMATE' | 'IMPOSTOR';
export type GamePhase = 'LOBBY' | 'PLAYING' | 'MEETING' | 'ENDED';
export type SabotageKind = 'BLACKOUT' | 'SIGNAL_JAM';
export type MeetingStage = 'GATHERING' | 'DISCUSSION' | 'VOTING' | 'VERDICT';

export interface ActiveSabotage {
  kind: SabotageKind;
  startedAt: number;
  expiresAt?: number;
}

export interface GameSettings {
  impostorCount: 1 | 2;
  investigatorCount: number;
  tasksPerPlayer: number;
  killCooldownSec: number;
  scanCooldownSec: number;
  sabotageCooldownSec: number;
  discussionSec: number;
  votingSec: number;
  confirmEjects: boolean;
  hideManualCodes?: boolean;
}

export interface AssignedTask {
  taskId: SkeldTaskId;
  completed: boolean;
}

export interface PublicPlayer {
  playerId: string;
  name: string;
  color: PlayerColorId;
  alive: boolean;
  connected: boolean;
  hasArrived: boolean;
  hasVoted: boolean;
  revealedRole?: SecretRole;
  rejoinCode?: string;
}

export interface SelfPlayer extends PublicPlayer {
  rejoinCode: string;
  secretRole: SecretRole;
  assignedTasks: AssignedTask[];
  killCooldownRemainingSec: number;
  scanCooldownRemainingSec: number;
  sabotageCooldownRemainingSec: number;
  teammates: Array<{ playerId: string; name: string; color: PlayerColorId; role: SecretRole }>;
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
  verdictEndsAt?: number;
  arrivedCount: number;
  votesCastCount: number;
  totalAliveCount: number;
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
  winner: 'CREWMATES' | 'IMPOSTORS' | null;
  winReason: string | null;
  serverTime: number;
}

export type ParsedQrAction =
  | { kind: 'TASK'; sessionCode?: string; task: SkeldTaskDef }
  | { kind: 'PLAYER'; sessionCode?: string; color: PlayerColorDef }
  | { kind: 'MEETING'; sessionCode?: string }
  | { kind: 'JOIN'; sessionCode: string; serverOrigin?: string };

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function buildWsUrl(httpBaseUrl: string): string {
  const normalized = normalizeServerUrl(httpBaseUrl);
  if (normalized.startsWith('https://')) {
    return `${normalized.replace(/^https:\/\//i, 'wss://')}/ws`;
  }
  return `${normalized.replace(/^http:\/\//i, 'ws://')}/ws`;
}

export function parseQrOrManualInput(rawInput: string): ParsedQrAction | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Check Join URL (?join=CODE) and extract server origin if present
  if (trimmed.includes('join=')) {
    const matchOrigin = trimmed.match(/^(https?:\/\/[^/?#]+)/i);
    const matchCode = trimmed.match(/[?&]join=([A-Z0-9]{4,8})/i);
    if (matchCode) {
      return {
        kind: 'JOIN',
        sessionCode: matchCode[1].toUpperCase(),
        serverOrigin: matchOrigin ? matchOrigin[1] : undefined,
      };
    }
  }

  // Structured QR format: SKELD|TYPE|SESSION|TARGET
  if (trimmed.toUpperCase().startsWith('SKELD|')) {
    const parts = trimmed.split('|');
    const kind = parts[1]?.toUpperCase();
    const sessionCode = parts[2]?.toUpperCase();
    const target = parts[3]?.toLowerCase();

    if (kind === 'TASK' && target) {
      const task = SKELD_TASKS.find((t) => t.id === target);
      if (task) return { kind: 'TASK', sessionCode, task };
    }
    if (kind === 'PLAYER' && target) {
      const color = PLAYER_COLORS.find((c) => c.id === target);
      if (color) return { kind: 'PLAYER', sessionCode, color };
    }
    if (kind === 'MEETING') {
      return { kind: 'MEETING', sessionCode };
    }
  }

  // Manual short codes (e.g., WIR1, RED, EMRG)
  const upper = trimmed.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (upper === 'EMRG' || upper === 'MEET' || upper === 'CAFETERIA') {
    return { kind: 'MEETING' };
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
