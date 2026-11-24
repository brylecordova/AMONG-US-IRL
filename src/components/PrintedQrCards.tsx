import React from 'react';
import {
  Activity,
  Atom,
  Cable,
  Compass,
  CreditCard,
  Crosshair,
  Disc3,
  Eye,
  FlaskConical,
  Fuel,
  Gauge,
  Grid3x3,
  Siren,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wind,
  Zap,
} from 'lucide-react';
import {
  buildMeetingQrPayload,
  buildPlayerQrPayload,
  buildTaskQrPayload,
  PlayerColorDef,
  PlayerColorId,
  SkeldTaskDef,
  SkeldTaskId,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { QrCodeImg } from './QrCodeImg';

interface TaskTheme {
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  accentHex: string;
  softBgHex: string;
  darkQrHex: string;
  cardBorderClass: string;
  badgeTextHex: string;
  quirkLabel: string;
  renderQuirk: () => React.ReactNode;
}

export const TASK_THEMES: Record<SkeldTaskId, TaskTheme> = {
  'fix-wiring': {
    Icon: Cable,
    accentHex: '#EAB308',
    softBgHex: '#FEFCE8',
    darkQrHex: '#1C1917',
    cardBorderClass: 'border-amber-500',
    badgeTextHex: '#422006',
    quirkLabel: '440V JUNCTION · MATCH 4 WIRES',
    renderQuirk: () => (
      <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-slate-900">
        <span className="h-1.5 flex-1 rounded-full bg-red-500" />
        <span className="h-1.5 flex-1 rounded-full bg-blue-500" />
        <span className="h-1.5 flex-1 rounded-full bg-yellow-400" />
        <span className="h-1.5 flex-1 rounded-full bg-pink-500" />
      </div>
    ),
  },
  'swipe-card': {
    Icon: CreditCard,
    accentHex: '#0D9488',
    softBgHex: '#F0FDFA',
    darkQrHex: '#042F2E',
    cardBorderClass: 'border-teal-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'ADMIN READER · STEADY SWIPE',
    renderQuirk: () => (
      <div className="w-full h-3 rounded bg-slate-800 flex items-center px-2 justify-between">
        <span className="w-8 h-1 rounded bg-amber-300" />
        <span className="text-[8px] font-mono font-bold text-emerald-300 tracking-wider">
          ID OK ▸
        </span>
      </div>
    ),
  },
  'clear-asteroids': {
    Icon: Crosshair,
    accentHex: '#DC2626',
    softBgHex: '#FEF2F2',
    darkQrHex: '#1E1B18',
    cardBorderClass: 'border-red-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'TURRET HUD · 20 TARGETS',
    renderQuirk: () => (
      <div className="w-full flex items-center justify-center gap-2 text-[9px] font-mono font-bold text-red-700 bg-red-100 rounded py-0.5 border border-red-300">
        <span>⌖ LOCK</span>
        <span>·</span>
        <span>020/020</span>
        <span>·</span>
        <span>WEAPONS</span>
      </div>
    ),
  },
  'download-upload': {
    Icon: UploadCloud,
    accentHex: '#0284C7',
    softBgHex: '#F0F9FF',
    darkQrHex: '#0C4A6E',
    cardBorderClass: 'border-sky-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'PACKET UPLINK · 100% SYNC',
    renderQuirk: () => (
      <div className="w-full bg-sky-100 border border-sky-300 rounded-full h-2.5 overflow-hidden p-0.5">
        <div className="h-full w-3/4 rounded-full bg-sky-600" />
      </div>
    ),
  },
  'fuel-engines': {
    Icon: Fuel,
    accentHex: '#EA580C',
    softBgHex: '#FFF7ED',
    darkQrHex: '#271206',
    cardBorderClass: 'border-orange-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'HIGH OCTANE · HOLD NOZZLE',
    renderQuirk: () => (
      <div className="w-full flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6].map((bar) => (
          <span
            key={bar}
            className={`h-2 flex-1 rounded-sm ${bar <= 5 ? 'bg-orange-500' : 'bg-orange-200'}`}
          />
        ))}
        <span className="text-[8px] font-mono font-bold text-orange-800 ml-1">FULL</span>
      </div>
    ),
  },
  'medbay-scan': {
    Icon: Activity,
    accentHex: '#059669',
    softBgHex: '#ECFDF5',
    darkQrHex: '#022C22',
    cardBorderClass: 'border-emerald-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'BIOMETRIC PAD · 98.6°F OK',
    renderQuirk: () => (
      <svg viewBox="0 0 120 18" className="w-full h-4" fill="none">
        <rect width="120" height="18" rx="4" fill="#064E3B" />
        <path
          d="M4 9 H32 L38 4 L44 15 L50 2 L56 14 L62 9 H116"
          stroke="#34D399"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  'inspect-sample': {
    Icon: FlaskConical,
    accentHex: '#7C3AED',
    softBgHex: '#F5F3FF',
    darkQrHex: '#2E1065',
    cardBorderClass: 'border-violet-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'CENTRIFUGE · SPOT THE ANOMALY',
    renderQuirk: () => (
      <div className="flex items-center justify-center gap-2 py-0.5">
        {[false, false, true, false, false].map((anomaly, i) => (
          <span
            key={i}
            className={`w-2.5 h-4 rounded-b-full border ${
              anomaly
                ? 'bg-red-500 border-red-800'
                : 'bg-sky-300 border-sky-700'
            }`}
          />
        ))}
      </div>
    ),
  },
  'prime-shields': {
    Icon: ShieldCheck,
    accentHex: '#2563EB',
    softBgHex: '#EFF6FF',
    darkQrHex: '#172554',
    cardBorderClass: 'border-blue-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'DEFLECTOR ARRAY · HEX NODES',
    renderQuirk: () => (
      <div className="flex items-center justify-center gap-1.5">
        {[true, false, true, true, false, true].map((active, i) => (
          <span
            key={i}
            className={`w-3 h-2.5 rounded-sm border ${
              active ? 'bg-blue-500 border-blue-800' : 'bg-red-400 border-red-700'
            }`}
          />
        ))}
      </div>
    ),
  },
  'start-reactor': {
    Icon: Atom,
    accentHex: '#4F46E5',
    softBgHex: '#EEF2FF',
    darkQrHex: '#1E1B4B',
    cardBorderClass: 'border-indigo-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'CORE SEQUENCE · 5 STAGES',
    renderQuirk: () => (
      <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
          <span
            key={cell}
            className={`w-2.5 h-1.5 rounded-xs ${
              cell === 1 || cell === 4 || cell === 8 ? 'bg-cyan-400' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>
    ),
  },
  'unlock-manifolds': {
    Icon: Grid3x3,
    accentHex: '#475569',
    softBgHex: '#F8FAFC',
    darkQrHex: '#0F172A',
    cardBorderClass: 'border-slate-700',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'PRESSURE LOCK · TAP 1 → 10',
    renderQuirk: () => (
      <div className="flex items-center justify-center gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <span
            key={num}
            className="w-3.5 h-3.5 rounded-xs bg-slate-200 border border-slate-400 text-[7px] font-mono font-bold text-slate-800 flex items-center justify-center"
          >
            {num}
          </span>
        ))}
      </div>
    ),
  },
  'align-engine': {
    Icon: Gauge,
    accentHex: '#B45309',
    softBgHex: '#FFFBEB',
    darkQrHex: '#271705',
    cardBorderClass: 'border-amber-700',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'THRUSTER GIMBAL · LOCK 0.0°',
    renderQuirk: () => (
      <div className="w-full flex items-center justify-between px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-[8px] font-mono font-bold text-amber-900">
        <span>-15°</span>
        <span className="text-emerald-700">┼ 0.0° ┼</span>
        <span>+15°</span>
      </div>
    ),
  },
  'empty-garbage': {
    Icon: Trash2,
    accentHex: '#65A30D',
    softBgHex: '#F7FEE7',
    darkQrHex: '#1A2E05',
    cardBorderClass: 'border-lime-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'AIRLOCK CHUTE · PULL LEVER',
    renderQuirk: () => (
      <div
        className="w-full h-2.5 rounded border border-lime-700"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #84CC16 0px, #84CC16 6px, #1E293B 6px, #1E293B 12px)',
        }}
      />
    ),
  },
  'calibrate-distributor': {
    Icon: Disc3,
    accentHex: '#0891B2',
    softBgHex: '#ECFEFF',
    darkQrHex: '#083344',
    cardBorderClass: 'border-cyan-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'PHASE TIMING · 3 RINGS',
    renderQuirk: () => (
      <div className="flex items-center justify-center gap-2">
        {['#FACC15', '#38BDF8', '#4ADE80'].map((ring, idx) => (
          <span
            key={idx}
            className="w-3.5 h-3.5 rounded-full border-2 bg-slate-900 flex items-center justify-center"
            style={{ borderColor: ring }}
          >
            <span className="w-1 h-1 rounded-full bg-white" />
          </span>
        ))}
      </div>
    ),
  },
  'divert-power': {
    Icon: Zap,
    accentHex: '#D97706',
    softBgHex: '#FEF3C7',
    darkQrHex: '#291503',
    cardBorderClass: 'border-amber-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'BREAKER BUS · MAX OUTPUT',
    renderQuirk: () => (
      <div className="w-full flex items-center justify-center gap-1.5">
        {[true, true, false, true].map((on, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded-xs text-[7px] font-mono font-bold border ${
              on
                ? 'bg-amber-400 border-amber-700 text-slate-950'
                : 'bg-slate-200 border-slate-400 text-slate-600'
            }`}
          >
            {on ? 'ON' : 'OFF'}
          </span>
        ))}
      </div>
    ),
  },
  'clean-o2-filter': {
    Icon: Wind,
    accentHex: '#16A34A',
    softBgHex: '#F0FDF4',
    darkQrHex: '#052E16',
    cardBorderClass: 'border-green-600',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'O2 INTAKE · CLEAR LEAVES',
    renderQuirk: () => (
      <div className="w-full flex flex-col gap-0.5 px-2">
        <span className="h-0.5 w-full bg-green-700/60 rounded" />
        <span className="h-0.5 w-full bg-green-700/60 rounded" />
        <span className="h-0.5 w-full bg-green-700/60 rounded" />
      </div>
    ),
  },
  'chart-course': {
    Icon: Compass,
    accentHex: '#1D4ED8',
    softBgHex: '#EFF6FF',
    darkQrHex: '#0F172A',
    cardBorderClass: 'border-blue-700',
    badgeTextHex: '#FFFFFF',
    quirkLabel: 'NAV VECTOR · 4 BEACONS',
    renderQuirk: () => (
      <div className="w-full flex items-center justify-between px-3 py-0.5 rounded bg-slate-900 text-[8px] font-mono font-bold text-cyan-300">
        <span>★</span>
        <span className="text-slate-500">┄┄</span>
        <span>★</span>
        <span className="text-slate-500">┄┄</span>
        <span>★</span>
        <span className="text-slate-500">┄┄</span>
        <span>▸</span>
      </div>
    ),
  },
};

const SUIT_QUIRKS: Record<PlayerColorId, { serial: string; motto: string }> = {
  red: { serial: 'SUIT #01', motto: 'ORIGINAL SUSPECT' },
  blue: { serial: 'SUIT #02', motto: 'BRIDGE NAVIGATOR' },
  green: { serial: 'SUIT #03', motto: 'O2 BOTANIST' },
  pink: { serial: 'SUIT #04', motto: 'SHIELDS SPECIALIST' },
  orange: { serial: 'SUIT #05', motto: 'ENGINE FUEL TECH' },
  yellow: { serial: 'SUIT #06', motto: 'HIGH-VIS REACTOR' },
  black: { serial: 'SUIT #07', motto: 'STEALTH OPS' },
  white: { serial: 'SUIT #08', motto: 'MEDBAY OFFICER' },
  purple: { serial: 'SUIT #09', motto: 'COMMS ANALYST' },
  brown: { serial: 'SUIT #10', motto: 'CARGO HANDLER' },
  cyan: { serial: 'SUIT #11', motto: 'SCANNER CLEARANCE' },
  lime: { serial: 'SUIT #12', motto: 'CHUTE ENGINEER' },
};

export const SkeldTaskIconBadge: React.FC<{
  taskId: SkeldTaskId;
  size?: 'sm' | 'lg';
}> = ({ taskId, size = 'lg' }) => {
  const theme = TASK_THEMES[taskId];
  const Icon = theme.Icon;

  if (size === 'sm') {
    return (
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/15"
        style={{ backgroundColor: theme.accentHex, color: theme.badgeTextHex }}
      >
        <Icon className="w-4 h-4" />
      </span>
    );
  }

  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-black/15"
      style={{ backgroundColor: theme.accentHex, color: theme.badgeTextHex }}
    >
      <Icon className="w-6 h-6" />
    </div>
  );
};

export const PrintedTaskQrCard: React.FC<{
  sessionCode: string;
  task: SkeldTaskDef;
  hideManualCodes: boolean;
}> = ({ sessionCode, task, hideManualCodes }) => {
  const theme = TASK_THEMES[task.id];

  return (
    <div
      className={`print-card rounded-2xl border-[3px] ${theme.cardBorderClass} overflow-hidden flex flex-col text-slate-900 shadow-sm`}
      style={{ backgroundColor: theme.softBgHex }}
    >
      {/* Top Station Strip with Large Identifying Icon */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-black/10"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <SkeldTaskIconBadge taskId={task.id} size="lg" />
          <div className="min-w-0 text-left">
            <div className="font-display text-xl font-bold leading-none text-slate-900 truncate">
              {task.name}
            </div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mt-1">
              {task.room} · {task.tier}
            </div>
          </div>
        </div>
        {task.isVisual && (
          <span
            title="Visual Task"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-100 border border-cyan-400 text-[9px] font-mono font-bold text-cyan-900 shrink-0"
          >
            <Eye className="w-3 h-3" />
            <span>VIS</span>
          </span>
        )}
      </div>

      {/* Crisp QR Area framed with subtle corner ticks */}
      <div className="p-3.5 print:p-3 flex-1 flex flex-col items-center justify-center gap-2.5 print:gap-2">
        <div
          className="relative p-1.5 rounded-xl bg-white border-2 shadow-xs"
          style={{ borderColor: theme.accentHex }}
        >
          <div className="w-[148px] h-[148px] print:w-[216px] print:h-[216px]">
            <QrCodeImg
              value={buildTaskQrPayload(sessionCode, task.id)}
              renderSize={360}
              responsive
              darkColor={theme.darkQrHex}
              alt={`${task.name} QR`}
              className="!p-0.5"
            />
          </div>
        </div>

        {/* Task-specific visual quirk widget */}
        <div className="w-full px-1">{theme.renderQuirk()}</div>

        <div className="w-full flex items-center justify-between gap-2 pt-0.5 text-[9px] font-mono font-bold text-slate-600">
          <span className="truncate">{theme.quirkLabel}</span>
          {!hideManualCodes && (
            <span
              className="px-1.5 py-0.5 rounded text-white shrink-0"
              style={{ backgroundColor: theme.darkQrHex }}
            >
              {task.shortCode}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const PrintedPlayerBadgeCard: React.FC<{
  sessionCode: string;
  color: PlayerColorDef;
  joinedPlayerName?: string;
  hideManualCodes: boolean;
}> = ({ sessionCode, color, joinedPlayerName, hideManualCodes }) => {
  const quirk = SUIT_QUIRKS[color.id];

  return (
    <div
      className="print-card bg-white text-slate-900 rounded-2xl overflow-hidden flex flex-col shadow-sm print:max-w-[5.75in] print:w-full print:mx-auto"
      style={{ border: `4px solid ${color.hex}` }}
    >
      {/* Suit Color Header Plate */}
      <div
        className="px-4 py-2.5 print:py-2 flex items-center justify-between gap-2"
        style={{ backgroundColor: color.hex, color: color.textOnSuit }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-extrabold tracking-widest opacity-90">
            {quirk.serial}
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/20">
            {quirk.motto}
          </span>
        </div>
        {!hideManualCodes && (
          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-white text-slate-900">
            {color.code}
          </span>
        )}
      </div>

      {/* Visor Accent Strip */}
      <div className="h-2 print:h-1.5 w-full" style={{ backgroundColor: color.shade }} />

      {/* Center QR */}
      <div className="p-4 print:py-2.5 print:px-5 flex flex-col items-center text-center gap-3 print:gap-2">
        <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
          <span>SESSION {sessionCode}</span>
          <span>WEAR ON BACK</span>
        </div>

        <div
          className="p-2 print:p-1.5 rounded-xl bg-white border-2"
          style={{ borderColor: color.shade }}
        >
          <div className="w-[190px] h-[190px] print:w-[272px] print:h-[272px]">
            <QrCodeImg
              value={buildPlayerQrPayload(sessionCode, color.id)}
              renderSize={440}
              responsive
              alt={`${color.label} back badge QR`}
              className="!p-0"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <CrewmateAvatar color={color.id} size={42} />
            <div className="text-left min-w-0">
              <div className="font-display text-2xl print:text-3xl font-bold leading-none text-slate-900">
                {color.label.toUpperCase()} SUIT
              </div>
              <div className="text-xs text-slate-600 mt-0.5 truncate">
                {joinedPlayerName ? `Crewmate: ${joinedPlayerName}` : 'Kill · Scan · Report'}
              </div>
            </div>
          </div>
          <span
            className="w-4 h-8 rounded-full shrink-0 border border-black/15"
            style={{ backgroundColor: color.hex }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
};

export const PrintedEmergencyQrCard: React.FC<{
  sessionCode: string;
  hideManualCodes: boolean;
}> = ({ sessionCode, hideManualCodes }) => {
  return (
    <div className="max-w-sm print:max-w-[5.75in] print:w-full print:mx-auto print-card bg-white text-slate-900 rounded-2xl border-4 border-red-600 overflow-hidden shadow-sm">
      {/* Caution Hazard Stripe Top */}
      <div
        className="h-4 w-full border-b-2 border-slate-900"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #EF4444 0px, #EF4444 12px, #FACC15 12px, #FACC15 24px)',
        }}
      />

      <div className="p-6 print:p-5 flex flex-col items-center text-center gap-3.5 print:gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-full bg-red-600 border-4 border-slate-900 text-white flex items-center justify-center shadow-sm">
            <Siren className="w-6 h-6" />
          </span>
          <div className="text-left">
            <div className="font-display text-2xl print:text-3xl font-bold text-red-600 leading-none">
              EMERGENCY MEETING
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-600 mt-1">
              CAFETERIA · PRESS IN CASE OF SUSPICION
            </div>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-red-50 border-2 border-red-500">
          <div className="w-[190px] h-[190px] print:w-[272px] print:h-[272px]">
            <QrCodeImg
              value={buildMeetingQrPayload(sessionCode)}
              renderSize={440}
              responsive
              darkColor="#450A0A"
              alt="Emergency Meeting QR"
              className="!p-0.5"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-700 pt-1">
          <span>SESSION {sessionCode}</span>
          {!hideManualCodes && (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white">CODE: EMRG</span>
          )}
        </div>
      </div>

      {/* Caution Hazard Stripe Bottom */}
      <div
        className="h-4 w-full border-t-2 border-slate-900"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #EF4444 0px, #EF4444 12px, #FACC15 12px, #FACC15 24px)',
        }}
      />
    </div>
  );
};
