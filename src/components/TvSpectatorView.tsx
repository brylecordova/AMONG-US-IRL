import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Award,
  Clock,
  Eye,
  Flame,
  MonitorOff,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  ZapOff,
} from 'lucide-react';
import {
  getColorDef,
  HostGameState,
  normalizeSkeldRoom,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { GalacticBackdrop } from './GalacticBackdrop';
import { QrCodeImg } from './QrCodeImg';

interface TvSpectatorViewProps {
  state: HostGameState;
  muted: boolean;
  busy: boolean;
  onToggleMute: () => void;
  onExitTv: () => void;
  onStartMission: () => void;
  onStartDiscussion: () => void;
  onResetLobby: () => void;
}

const SKELD_MAP_LAYOUT: Array<{ room: string; zone: string }> = [
  { room: 'Reactor', zone: 'Port Aft' },
  { room: 'Upper Engine', zone: 'Port Bow' },
  { room: 'MedBay', zone: 'Mid-Port' },
  { room: 'Cafeteria', zone: 'Central Hub' },
  { room: 'Weapons', zone: 'Starboard Bow' },
  { room: 'O2', zone: 'Life Support' },
  { room: 'Security', zone: 'Cams Bay' },
  { room: 'Electrical', zone: 'Power Grid' },
  { room: 'Storage', zone: 'Cargo Hold' },
  { room: 'Admin', zone: 'Command' },
  { room: 'Shields', zone: 'Deflectors' },
  { room: 'Navigation', zone: 'Helm' },
];

export const TvSpectatorView: React.FC<TvSpectatorViewProps> = ({
  state,
  muted,
  busy,
  onToggleMute,
  onExitTv,
  onStartMission,
  onStartDiscussion,
  onResetLobby,
}) => {
  const [nowMs, setNowMs] = useState(Date.now());
  const skewRef = React.useRef(state.serverTime - Date.now());

  useEffect(() => {
    skewRef.current = state.serverTime - Date.now();
  }, [state.serverTime]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitTv();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExitTv]);

  const effectiveNow = nowMs + skewRef.current;
  const alivePlayers = state.players.filter((p) => p.alive);
  const deadPlayers = state.players.filter((p) => !p.alive);
  const joinUrl = `${state.publicUrl}/?join=${state.sessionCode}`;

  const sabotageLeftSec =
    state.activeSabotage?.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - effectiveNow) / 1000))
      : 0;
  const discussionLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.discussionEndsAt - effectiveNow) / 1000))
    : 0;
  const votingLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.votingEndsAt - effectiveNow) / 1000))
    : 0;
  const revealLeftSec =
    state.meeting?.revealEndsAt
      ? Math.max(0, Math.ceil((state.meeting.revealEndsAt - effectiveNow) / 1000))
      : 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-50 bg-[#040712] text-slate-100 flex flex-col overflow-y-auto">
        <GalacticBackdrop />

        {/* Big-Screen Broadcast Top Bar */}
        <header className="relative z-20 px-6 py-3.5 bg-[#070B16]/85 backdrop-blur-md border-b border-white/12 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="font-display text-3xl font-bold tracking-wider text-white">
              AMONG-US IRL
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
              TV SPECTATOR · {state.sessionCode}
            </span>
          </div>

          {/* Live Task Meter */}
          <div className="flex-1 max-w-md min-w-[200px] space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 uppercase tracking-wider">Total Tasks</span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {state.taskProgress.percentage}%
              </span>
            </div>
            <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-white/15">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${state.taskProgress.percentage}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-white/10 text-xs font-mono tabular-nums">
              <span className="text-emerald-400 font-bold">{alivePlayers.length} Alive</span>
              <span className="text-slate-600">·</span>
              <span className="text-red-400 font-bold">{deadPlayers.length} Fallen</span>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              className="min-w-[40px] min-h-[40px] rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-200"
              aria-label={muted ? 'Unmute TV audio' : 'Mute TV audio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onExitTv}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <MonitorOff className="w-4 h-4" />
              <span>Exit TV Mode</span>
            </button>
          </div>
        </header>

        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {/* TV LOBBY BOARDING STAGE */}
            {state.phase === 'LOBBY' && (
              <motion.div
                key="tv-lobby"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
              >
                <div className="lg:col-span-5 bg-[#101726]/85 backdrop-blur-md border border-white/15 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <div className="text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">
                    Scan With Smartphone Camera
                  </div>
                  <div className="font-mono text-4xl font-bold tracking-[0.2em] text-white tabular-nums">
                    {state.sessionCode}
                  </div>
                  <div className="mx-auto w-fit p-3 rounded-2xl bg-slate-950/70 border border-cyan-400/30">
                    <QrCodeImg value={joinUrl} size={230} alt="Join Session QR" />
                  </div>
                  <div className="font-mono text-xs text-slate-400 break-all">{joinUrl}</div>
                  <button
                    type="button"
                    disabled={busy || state.players.length < (state.settings.impostorCount === 2 ? 4 : 2)}
                    onClick={onStartMission}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-bold text-sm transition-colors"
                  >
                    Launch Mission ({state.players.length}/12)
                  </button>
                </div>

                <div className="lg:col-span-7 bg-[#101726]/85 backdrop-blur-md border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-3xl font-bold text-white flex items-center gap-2.5">
                      <Users className="w-6 h-6 text-cyan-400" />
                      <span>Crew Boarding Manifest ({state.players.length}/12)</span>
                    </h2>
                    <span className="text-xs font-mono text-slate-400">
                      {state.settings.impostorCount} Imp · {state.settings.sheriffCount} Sheriff · {state.settings.guardianAngelCount} Angel
                    </span>
                  </div>

                  {state.players.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 border border-dashed border-white/15 rounded-2xl">
                      Waiting for players to scan the Join QR code...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {state.players.map((p) => (
                        <div
                          key={p.playerId}
                          className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center gap-3"
                        >
                          <CrewmateAvatar color={p.color} animate size={42} />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                            <div className="text-xs text-slate-400">{getColorDef(p.color).label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TV ACTIVE GAMEPLAY: SKELD SECTOR MAP + SECURITY FEED + SABOTAGE SIRENS */}
            {state.phase === 'PLAYING' && (
              <motion.div
                key="tv-playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Critical Sabotage Banner */}
                {state.activeSabotage && (
                  <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`rounded-2xl border-2 p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl ${
                      state.activeSabotage.kind === 'REACTOR'
                        ? 'bg-red-950/85 border-red-500 animate-pulse'
                        : 'bg-amber-950/80 border-amber-400'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {state.activeSabotage.kind === 'REACTOR' ? (
                        <Flame className="w-10 h-10 text-red-400 shrink-0" />
                      ) : state.activeSabotage.kind === 'BLACKOUT' ? (
                        <ZapOff className="w-10 h-10 text-amber-300 shrink-0" />
                      ) : (
                        <Radio className="w-10 h-10 text-amber-300 shrink-0" />
                      )}
                      <div>
                        <div className="font-display text-3xl font-bold text-white tracking-wide">
                          {state.activeSabotage.kind === 'REACTOR' && 'CRITICAL: REACTOR MELTDOWN'}
                          {state.activeSabotage.kind === 'BLACKOUT' && 'SHIP POWER BLACKOUT'}
                          {state.activeSabotage.kind === 'SIGNAL_JAM' && 'COMMS SIGNAL JAMMED'}
                        </div>
                        <div className="text-sm text-slate-200 mt-0.5">
                          {state.activeSabotage.kind === 'REACTOR' &&
                            (() => {
                              const holders = state.activeSabotage.reactorHolders || [];
                              const holdSec =
                                state.activeSabotage.dualHoldStartedAt && holders.length >= 2
                                  ? Math.min(
                                      5,
                                      Math.max(
                                        0,
                                        (effectiveNow - state.activeSabotage.dualHoldStartedAt) / 1000,
                                      ),
                                    )
                                  : 0;
                              return holders.length >= 2
                                ? `2/2 Crew Holding Reactor Override — Stabilizing (${holdSec.toFixed(1)}s / 5.0s)!`
                                : `2 alive players must scan the Reactor Override QR & hold together for 5s (${holders.length}/2 holding).`;
                            })()}
                          {state.activeSabotage.kind === 'BLACKOUT' &&
                            'Repair Fix Wiring in Electrical to restore ship power.'}
                          {state.activeSabotage.kind === 'SIGNAL_JAM' &&
                            'Cafeteria Emergency Meeting button temporarily jammed.'}
                        </div>
                      </div>
                    </div>

                    {(state.activeSabotage.kind === 'REACTOR' ||
                      state.activeSabotage.kind === 'SIGNAL_JAM') && (
                      <div className="font-mono text-4xl font-bold text-white tabular-nums px-4 py-2 rounded-xl bg-black/50 border border-white/15">
                        {sabotageLeftSec}s
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Visual Task Broadcast Banner */}
                <AnimatePresence>
                  {state.recentVisualAlert && state.settings.visualTaskAlerts && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-2xl bg-cyan-950/75 border border-cyan-400/60 px-5 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-cyan-300 shrink-0" />
                        <CrewmateAvatar color={state.recentVisualAlert.playerColor} size={30} />
                        <span className="text-sm font-semibold text-white">
                          Visual Scan Confirmed:{' '}
                          <span className="text-cyan-300">{state.recentVisualAlert.playerName}</span>{' '}
                          performed <span className="text-emerald-300">{state.recentVisualAlert.taskName}</span> in{' '}
                          {state.recentVisualAlert.room}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Anonymous Skeld Sector Map */}
                  <div className="lg:col-span-8 bg-[#101726]/85 backdrop-blur-md border border-white/15 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-400" />
                        <span>Skeld Sector Telemetry (Anonymous)</span>
                      </h2>
                      <span className="text-xs font-mono text-slate-400">75s Rolling Activity</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {SKELD_MAP_LAYOUT.map(({ room, zone }) => {
                        const count = state.roomActivity[room] || 0;
                        const isVisualRoom =
                          state.recentVisualAlert &&
                          normalizeSkeldRoom(state.recentVisualAlert.room) === room;
                        const isCrisisRoom =
                          (state.activeSabotage?.kind === 'REACTOR' && room === 'Reactor') ||
                          (state.activeSabotage?.kind === 'BLACKOUT' && room === 'Electrical');

                        return (
                          <div
                            key={room}
                            className={`rounded-2xl p-3.5 border transition-colors ${
                              isCrisisRoom
                                ? 'bg-red-950/60 border-red-400/80'
                                : isVisualRoom
                                  ? 'bg-cyan-950/55 border-cyan-400/80'
                                  : count > 0
                                    ? 'bg-emerald-950/40 border-emerald-400/50'
                                    : 'bg-slate-950/65 border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-display text-lg font-bold text-white leading-tight">
                                  {room}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 uppercase">
                                  {zone}
                                </div>
                              </div>
                              <span
                                className={`min-w-[28px] h-7 px-1.5 rounded-lg font-mono text-xs font-bold flex items-center justify-center tabular-nums ${
                                  count > 0
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'bg-white/5 text-slate-500'
                                }`}
                              >
                                {count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Crew Roster Strip (No Secrets Shown!) */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2.5">
                      {state.players.map((p) => (
                        <div
                          key={p.playerId}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                            p.alive
                              ? 'bg-slate-950/70 border-white/10'
                              : 'bg-red-950/30 border-red-500/30 opacity-60'
                          }`}
                        >
                          <CrewmateAvatar color={p.color} alive={p.alive} size={24} />
                          <span className="text-xs font-semibold text-white">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Security & Sensor Log */}
                  <div className="lg:col-span-4 bg-[#101726]/85 backdrop-blur-md border border-white/15 rounded-3xl p-6 flex flex-col space-y-3">
                    <h2 className="font-display text-2xl font-bold text-white">Security Feed</h2>
                    <div className="flex-1 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {state.activityFeed.length === 0 ? (
                        <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-white/10 rounded-xl">
                          No recent station activity detected.
                        </div>
                      ) : (
                        state.activityFeed.map((ev) => (
                          <div
                            key={ev.id}
                            className={`p-3 rounded-xl border text-xs space-y-0.5 ${
                              ev.kind === 'SABOTAGE'
                                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                                : ev.kind === 'VISUAL'
                                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100'
                                  : 'bg-slate-950/65 border-white/10 text-slate-200'
                            }`}
                          >
                            <div className="font-semibold">{ev.label}</div>
                            <div className="text-[10px] font-mono text-slate-400">{ev.room}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TV MEETING & ANIMATED SPACE EJECTION CUTSCENE */}
            {state.phase === 'MEETING' && state.meeting && (
              <motion.div
                key="tv-meeting"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {state.meeting.stage === 'VERDICT' ? (
                  <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-400/40 bg-[#050814]/90 p-10 min-h-[380px] flex flex-col items-center justify-center text-center shadow-2xl">
                    {/* Animated Airlock Ejection Cutscene */}
                    {state.meeting.ejectedPlayer ? (
                      <div className="w-full space-y-6">
                        <div className="relative h-36 w-full overflow-hidden flex items-center justify-center">
                          <motion.div
                            initial={{ x: -240, rotate: -25, scale: 1.15, opacity: 1 }}
                            animate={{ x: 320, rotate: 420, scale: 0.45, opacity: 0.15 }}
                            transition={{ duration: 4.5, ease: 'easeInOut' }}
                            className="inline-flex"
                          >
                            <CrewmateAvatar
                              color={state.meeting.ejectedPlayer.color}
                              alive
                              size={96}
                            />
                          </motion.div>
                        </div>
                        <motion.h2
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="font-display text-4xl sm:text-5xl font-bold text-white tracking-wide"
                        >
                          {state.meeting.verdictMessage}
                        </motion.h2>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <AlertTriangle className="w-12 h-12 text-amber-300 mx-auto" />
                        <h2 className="font-display text-4xl sm:text-5xl font-bold text-amber-200">
                          {state.meeting.verdictMessage || 'No one was ejected.'}
                        </h2>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#101726]/90 backdrop-blur-md border-2 border-red-500/60 rounded-3xl p-6 space-y-5 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-9 h-9 text-red-400" />
                        <div>
                          <h2 className="font-display text-4xl font-bold text-white leading-none">
                            {state.meeting.reason === 'BODY_REPORTED'
                              ? `BODY REPORTED: ${state.meeting.victimName}`
                              : `EMERGENCY MEETING — ${state.meeting.reporterName}`}
                          </h2>
                          <div className="text-sm font-mono text-red-200 mt-1 tabular-nums">
                            {state.meeting.stage === 'GATHERING' &&
                              `GATHERING AT TABLE · ${state.meeting.arrivedCount}/${state.meeting.totalAliveCount} CHECKED IN`}
                            {state.meeting.stage === 'DISCUSSION' &&
                              `DISCUSSION · VOTING OPENS IN ${discussionLeftSec}s · VOTE NOW ${state.meeting.voteNowCount}/${state.meeting.totalAliveCount}`}
                            {state.meeting.stage === 'VOTING' &&
                              (state.meeting.revealEndsAt
                                ? `ALL VOTES LOCKED · REVEALING IN ${revealLeftSec}s`
                                : `VOTING OPEN · ${votingLeftSec}s LEFT · ${state.meeting.votesCastCount}/${state.meeting.totalAliveCount} VOTED`)}
                          </div>
                        </div>
                      </div>

                      {state.meeting.stage === 'GATHERING' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={onStartDiscussion}
                          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm"
                        >
                          Start Discussion Now
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {state.players.map((p) => {
                        const voters = state.meeting?.voteBreakdown?.byTarget[p.playerId] || [];
                        return (
                          <div
                            key={p.playerId}
                            className={`p-3.5 rounded-2xl border space-y-2 ${
                              !p.alive
                                ? 'bg-red-950/25 border-red-500/20 opacity-55'
                                : 'bg-slate-950/75 border-white/12'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <CrewmateAvatar color={p.color} alive={p.alive} size={42} />
                                <div className="min-w-0">
                                  <div className="font-semibold text-base text-white truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {getColorDef(p.color).label} · {p.alive ? 'Alive' : 'Dead'}
                                  </div>
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold">
                                {state.meeting?.stage === 'GATHERING' && p.alive && (
                                  <span className={p.hasArrived ? 'text-emerald-400' : 'text-amber-300'}>
                                    {p.hasArrived ? 'HERE!' : 'WALKING'}
                                  </span>
                                )}
                                {state.meeting?.stage === 'VOTING' && p.hasVoted && (
                                  <span className="text-emerald-400">I VOTED</span>
                                )}
                              </span>
                            </div>

                            {voters.length > 0 && (
                              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                                {voters.map((v) =>
                                  state.settings.anonymousVotes ? (
                                    <span
                                      key={v.playerId}
                                      className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/15 text-[10px] font-mono text-slate-300"
                                    >
                                      Anon
                                    </span>
                                  ) : (
                                    <span
                                      key={v.playerId}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-200"
                                    >
                                      <CrewmateAvatar color={v.color} size={16} />
                                      <span>{v.name}</span>
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TV ENDED STAGE: CELEBRATION + AWARDS + TIMELINE + FULL DEBRIEF */}
            {state.phase === 'ENDED' && (
              <motion.div
                key="tv-ended"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div
                  className={`rounded-3xl border-2 p-8 text-center space-y-3 shadow-2xl ${
                    state.winner === 'JESTER'
                      ? 'bg-fuchsia-950/80 border-fuchsia-400'
                      : state.winner === 'CREWMATES'
                        ? 'bg-emerald-950/80 border-emerald-400'
                        : 'bg-red-950/80 border-red-500'
                  }`}
                >
                  <div className="inline-flex items-center gap-2 text-amber-300 font-mono text-xs font-bold uppercase tracking-[0.25em]">
                    <Sparkles className="w-4 h-4" />
                    <span>Mission Debrief</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h1 className="font-display text-6xl font-bold text-white tracking-wider">
                    {state.winner === 'JESTER'
                      ? 'JESTER SOLO VICTORY'
                      : state.winner === 'CREWMATES'
                        ? 'CREWMATES VICTORY'
                        : 'IMPOSTORS VICTORY'}
                  </h1>
                  <p className="text-base text-slate-200 max-w-2xl mx-auto">{state.winReason}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onResetLobby}
                      className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-bold text-sm inline-flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Return to Lobby</span>
                    </button>
                  </div>
                </div>

                {/* Player Awards */}
                {state.awards.length > 0 && (
                  <div className="bg-[#101726]/85 border border-white/15 rounded-3xl p-6 space-y-4">
                    <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                      <Award className="w-6 h-6 text-amber-300" />
                      <span>Match Awards</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {state.awards.map((a) => (
                        <div
                          key={a.id}
                          className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/10 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
                            <span className="font-display text-lg font-bold text-amber-200">
                              {a.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CrewmateAvatar color={a.playerColor} size={28} />
                            <span className="text-sm font-semibold text-white truncate">
                              {a.playerName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-snug">{a.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Timeline */}
                  <div className="lg:col-span-5 bg-[#101726]/85 border border-white/15 rounded-3xl p-6 space-y-3">
                    <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      <span>Mission Timeline</span>
                    </h2>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {state.timeline.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 flex items-start justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">{ev.title}</div>
                            {ev.detail && <div className="text-slate-400 mt-0.5">{ev.detail}</div>}
                          </div>
                          <span className="font-mono text-[11px] text-cyan-300 shrink-0 tabular-nums">
                            +{ev.elapsedSec}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full Role Reveal */}
                  <div className="lg:col-span-7 bg-[#101726]/85 border border-white/15 rounded-3xl p-6 space-y-3">
                    <h2 className="font-display text-2xl font-bold text-white">Full Crew Roles</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {state.players.map((p) => (
                        <div
                          key={p.playerId}
                          className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CrewmateAvatar color={p.color} alive={p.alive} size={34} />
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-white truncate">
                                {p.name}
                              </div>
                              <div className="text-xs text-slate-400">{getColorDef(p.color).label}</div>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
                            {p.revealedRole}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
};
