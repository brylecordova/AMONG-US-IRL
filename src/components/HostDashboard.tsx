import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Printer,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  ZapOff,
} from 'lucide-react';
import {
  buildMeetingQrPayload,
  buildPlayerQrPayload,
  buildTaskQrPayload,
  GameSettings,
  getColorDef,
  HostGameState,
  PLAYER_COLORS,
  SKELD_TASKS,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { QrCodeImg } from './QrCodeImg';
import { soundEngine } from '../utils/sound';

interface HostDashboardProps {
  state: HostGameState;
  hostToken: string;
  onUpdateState: (next: HostGameState) => void;
  onExitHost: () => void;
}

type HostTab = 'CONTROL' | 'PRINT' | 'RULES';
type PrintFilter = 'ALL' | 'PLAYERS_ALL' | 'PLAYERS_JOINED' | 'TASKS' | 'MEETING';

export const HostDashboard: React.FC<HostDashboardProps> = ({
  state,
  hostToken,
  onUpdateState,
  onExitHost,
}) => {
  const [activeTab, setActiveTab] = useState<HostTab>('CONTROL');
  const [printFilter, setPrintFilter] = useState<PrintFilter>('ALL');
  const [urlInput, setUrlInput] = useState(state.publicUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(soundEngine.isMuted());

  const joinUrl = `${state.publicUrl}/?join=${state.sessionCode}`;

  const callHostApi = async (path: string, body?: unknown) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/host/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      if (data.state) {
        onUpdateState(data.state);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const savePublicUrl = async (customUrl: string) => {
    await callHostApi('url', { publicUrl: customUrl });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 1800);
  };

  const updateSettings = (patch: Partial<GameSettings>) => {
    callHostApi('settings', patch);
  };

  const toggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const aliveCount = state.players.filter((p) => p.alive).length;
  const deadCount = state.players.length - aliveCount;

  const playersToPrint =
    printFilter === 'PLAYERS_JOINED'
      ? PLAYER_COLORS.filter((c) => state.players.some((p) => p.color === c.id))
      : PLAYER_COLORS;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones */}
      <header className="no-print sticky top-0 z-30 bg-[#0F1520]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={onExitHost}
            className="font-display text-2xl font-bold tracking-wide text-white whitespace-nowrap hover:text-cyan-300 transition-colors"
          >
            SKELD IRL
          </button>
        </div>

        <nav className="order-3 sm:order-2 w-full sm:w-auto flex items-center gap-5 text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('CONTROL')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'CONTROL'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Mission Control
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRINT')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'PRINT'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Print QR Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RULES')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'RULES'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Rules & Balance
          </button>
        </nav>

        <div className="order-2 sm:order-3 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="min-w-[40px] min-h-[40px] rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {state.phase === 'LOBBY' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => callHostApi('start')}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm whitespace-nowrap shrink-0"
            >
              Launch Mission
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => callHostApi('reset')}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Lobby</span>
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="no-print mx-auto mt-4 max-w-4xl w-full px-6">
          <div className="bg-red-500/15 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: MISSION CONTROL */}
      {activeTab === 'CONTROL' && (
        <main className="no-print max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Join QR & Port Forwarding Host Address */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">Join Mission QR</h2>
                  <p className="text-xs text-slate-400">
                    Scan with any smartphone browser
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tracking-widest text-cyan-300 tabular-nums">
                  {state.sessionCode}
                </span>
              </div>

              <div className="flex justify-center py-2">
                <QrCodeImg value={joinUrl} size={220} alt={`Join session ${state.sessionCode}`} />
              </div>

              <div className="text-center font-mono text-xs text-slate-300 break-all bg-slate-950/70 px-3 py-2 rounded-lg border border-white/5">
                {joinUrl}
              </div>

              {/* Port Forwarding / LAN Address Switcher */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Host Address (LAN or Port-Forwarded URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                    placeholder="http://192.168.1.50:3000"
                  />
                  <button
                    type="button"
                    onClick={() => savePublicUrl(urlInput)}
                    className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    {urlSaved ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{urlSaved ? 'Saved' : 'Update QR'}</span>
                  </button>
                </div>
                {state.lanUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {state.lanUrls.map((lan) => (
                      <button
                        key={lan}
                        type="button"
                        onClick={() => {
                          setUrlInput(lan);
                          savePublicUrl(lan);
                        }}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-cyan-300"
                      >
                        Use {lan}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/10">
                <span>Storage Engine</span>
                <span className="font-mono text-slate-200">
                  {state.dbMode === 'mongodb' ? 'MongoDB Connected' : 'Local Persistent Store'}
                </span>
              </div>
            </div>
          </section>

          {/* Right Column: Live Telemetry, Meeting Alert, Ship Manifest */}
          <section className="lg:col-span-8 space-y-6">
            {/* Global Task Progress & Phase Telemetry */}
            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {state.phase === 'LOBBY' && 'Pre-Launch Ship Manifest'}
                    {state.phase === 'PLAYING' && 'Mission Active — Crew Telemetry'}
                    {state.phase === 'MEETING' && 'Emergency Meeting In Progress'}
                    {state.phase === 'ENDED' &&
                      (state.winner === 'CREWMATES' ? 'Victory — Crewmates Win' : 'Defeat — Impostors Win')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {state.players.length} Players Joined · {aliveCount} Alive · {deadCount} Eliminated ·{' '}
                    {state.settings.impostorCount === 2
                      ? '2 Impostors (1 Shapeshifter)'
                      : '1 Impostor'}{' '}
                    · {state.settings.investigatorCount} Investigator
                    {state.settings.investigatorCount === 1 ? '' : 's'}
                  </p>
                </div>

                {state.phase !== 'LOBBY' && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Tasks</div>
                    <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                      {state.taskProgress.percentage}%
                    </div>
                  </div>
                )}
              </div>

              {/* Task Progress Bar */}
              <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${state.taskProgress.percentage}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              {/* Active Sabotage Banner */}
              <AnimatePresence>
                {state.phase === 'PLAYING' && state.activeSabotage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 flex items-center gap-3 animate-pulse"
                  >
                    {state.activeSabotage.kind === 'BLACKOUT' ? (
                      <ZapOff className="w-6 h-6 text-amber-300 shrink-0" />
                    ) : (
                      <Radio className="w-6 h-6 text-amber-300 shrink-0" />
                    )}
                    <div>
                      <div className="font-display text-xl font-bold text-amber-200">
                        {state.activeSabotage.kind === 'BLACKOUT'
                          ? 'SABOTAGE: POWER BLACKOUT'
                          : 'SABOTAGE: COMMS SIGNAL JAM'}
                      </div>
                      <div className="text-xs text-amber-100/80 mt-0.5">
                        {state.activeSabotage.kind === 'BLACKOUT'
                          ? 'All tasks are locked until an alive player scans and completes Fix Wiring (WIR1).'
                          : 'Emergency Meeting button (EMRG) is disabled for 60 seconds.'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Meeting Banner */}
              <AnimatePresence>
                {state.phase === 'MEETING' && state.meeting && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="bg-red-500/15 border border-red-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-7 h-7 text-red-400 shrink-0 animate-pulse" />
                      <div>
                        <div className="font-display text-xl font-bold text-white">
                          {state.meeting.reason === 'BODY_REPORTED'
                            ? `Dead Body Reported: ${state.meeting.victimName}`
                            : `Emergency Meeting Called by ${state.meeting.reporterName}`}
                        </div>
                        <div className="text-xs text-red-200 mt-0.5 font-mono tabular-nums">
                          {state.meeting.verdictMessage
                            ? state.meeting.verdictMessage
                            : state.meeting.stage === 'GATHERING'
                              ? `Gathering at Table (HERE!): ${state.meeting.arrivedCount} / ${state.meeting.totalAliveCount} Alive`
                              : `Votes Cast: ${state.meeting.votesCastCount} / ${state.meeting.totalAliveCount}`}
                        </div>
                      </div>
                    </div>
                    {state.meeting.stage === 'GATHERING' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => callHostApi('start-discussion')}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap"
                      >
                        Start Discussion Now
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* End Game Banner */}
              {state.phase === 'ENDED' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-xl p-4 border ${
                    state.winner === 'CREWMATES'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-500/15 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="font-display text-2xl font-bold">
                    {state.winner === 'CREWMATES' ? 'CREWMATES VICTORY' : 'IMPOSTORS VICTORY'}
                  </div>
                  <p className="text-sm mt-1">{state.winReason}</p>
                </motion.div>
              )}
            </div>

            {/* Player Roster Grid */}
            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span>Crew Manifest ({state.players.length}/12)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('PRINT')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-cyan-300 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print QR Badges & Tasks</span>
                </button>
              </div>

              {state.players.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-xl">
                  <p className="text-sm text-slate-300">No players connected yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Have players scan the Join Mission QR code with their smartphone camera.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {state.players.map((p, idx) => {
                    const colorDef = getColorDef(p.color);
                    return (
                      <motion.div
                        key={p.playerId}
                        layout
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          p.alive
                            ? 'bg-slate-950/60 border-white/10'
                            : 'bg-red-950/20 border-red-500/25 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CrewmateAvatar color={p.color} alive={p.alive} animate={p.alive} size={40} />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-white truncate">
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <span>{colorDef.label}</span>
                              <span aria-hidden="true">·</span>
                              <span className={p.alive ? 'text-emerald-400' : 'text-red-400'}>
                                {p.alive ? 'Alive' : 'Killed'}
                              </span>
                            </div>
                            {p.rejoinCode && (
                              <div className="text-[11px] font-mono text-cyan-300/90 mt-0.5">
                                Rejoin: {p.rejoinCode}
                              </div>
                            )}
                            {p.revealedRole && (
                              <div className="text-[11px] font-mono font-bold text-amber-300 mt-0.5">
                                {p.revealedRole}
                              </div>
                            )}
                          </div>
                        </div>
                        {state.phase === 'LOBBY' && (
                          <button
                            type="button"
                            onClick={() => callHostApi('kick', { playerId: p.playerId })}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            aria-label={`Remove ${p.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* TAB 2: PRINT QR STUDIO */}
      {activeTab === 'PRINT' && (
        <main className="max-w-7xl w-full mx-auto p-6 space-y-6">
          <div className="no-print bg-[#151C28] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Printable QR Studio</h2>
              <p className="text-xs text-slate-400">
                Print player back badges (for kills, Investigator scans, and body reports) and all 16 Skeld task cards.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['ALL', 'All Cards'],
                  ['PLAYERS_ALL', '12 Suit Back Badges'],
                  ['PLAYERS_JOINED', 'Joined Players Only'],
                  ['TASKS', '16 Skeld Tasks'],
                  ['MEETING', 'Emergency Button'],
                ] as Array<[PrintFilter, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrintFilter(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    printFilter === id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sheets</span>
              </button>
            </div>
          </div>

          <div className="print-only-sheet space-y-8">
            {/* Player Back QR Badges */}
            {(printFilter === 'ALL' ||
              printFilter === 'PLAYERS_ALL' ||
              printFilter === 'PLAYERS_JOINED') && (
              <section className="space-y-4">
                <h3 className="font-display text-xl font-bold text-white print:text-slate-900">
                  Player Back Badges — Wear on Back ({playersToPrint.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                  {playersToPrint.map((color) => {
                    const joinedPlayer = state.players.find((p) => p.color === color.id);
                    return (
                      <div
                        key={color.id}
                        className="print-card bg-white text-slate-900 rounded-2xl border-2 border-slate-300 p-5 flex flex-col items-center text-center gap-3"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            SESSION {state.sessionCode}
                          </span>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                            CODE: {color.code}
                          </span>
                        </div>
                        <QrCodeImg
                          value={buildPlayerQrPayload(state.sessionCode, color.id)}
                          size={200}
                          alt={`${color.label} back badge QR`}
                        />
                        <div className="flex items-center gap-3">
                          <CrewmateAvatar color={color.id} size={42} />
                          <div className="text-left">
                            <div className="font-display text-2xl font-bold leading-none">
                              {color.label.toUpperCase()} SUIT
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {joinedPlayer ? `Assigned: ${joinedPlayer.name}` : 'Back Badge · Kill / Scan / Report'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 16 Skeld Task Cards */}
            {(printFilter === 'ALL' || printFilter === 'TASKS') && (
              <section className="space-y-4">
                <h3 className="font-display text-xl font-bold text-white print:text-slate-900">
                  The Skeld Task Station Cards (16 Tasks)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-3">
                  {SKELD_TASKS.map((task) => (
                    <div
                      key={task.id}
                      className="print-card bg-white text-slate-900 rounded-2xl border-2 border-slate-300 p-4 flex flex-col items-center text-center gap-2.5"
                    >
                      <div className="w-full flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
                        <span>{task.room}</span>
                        <span>{task.tier}</span>
                      </div>
                      <QrCodeImg
                        value={buildTaskQrPayload(state.sessionCode, task.id)}
                        size={155}
                        alt={`${task.name} QR`}
                      />
                      <div>
                        <div className="font-display text-xl font-bold leading-tight">
                          {task.name}
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-600 mt-0.5">
                          MANUAL CODE: {task.shortCode}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Emergency Meeting Cafeteria Button */}
            {(printFilter === 'ALL' || printFilter === 'MEETING') && (
              <section className="space-y-4">
                <h3 className="font-display text-xl font-bold text-white print:text-slate-900">
                  Cafeteria Emergency Meeting Station
                </h3>
                <div className="max-w-sm print-card bg-white text-slate-900 rounded-2xl border-4 border-red-600 p-6 flex flex-col items-center text-center gap-3">
                  <div className="font-display text-2xl font-bold text-red-600">
                    EMERGENCY MEETING BUTTON
                  </div>
                  <QrCodeImg
                    value={buildMeetingQrPayload(state.sessionCode)}
                    size={190}
                    alt="Emergency Meeting QR"
                  />
                  <div className="font-mono text-xs font-bold text-slate-700">
                    CAFETERIA · MANUAL CODE: EMRG
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      {/* TAB 3: RULES & BALANCE */}
      {activeTab === 'RULES' && (
        <main className="no-print max-w-3xl w-full mx-auto p-6">
          <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <span>Mission Rules & Role Balance</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {state.phase === 'LOBBY'
                    ? 'Adjust rules before launching the mission.'
                    : 'Settings are locked while a mission is active. Reset lobby to modify.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Impostor Count */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-sm font-semibold text-white">Impostors</div>
                <p className="text-xs text-slate-400">
                  With 2 Impostors, one is automatically designated as the Shapeshifter (reads as Crewmate on Investigator scans).
                </p>
                <div className="flex gap-2 pt-1">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={state.phase !== 'LOBBY'}
                      onClick={() => updateSettings({ impostorCount: cnt })}
                      className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-bold ${
                        state.settings.impostorCount === cnt
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-800 text-slate-300'
                      } disabled:opacity-60`}
                    >
                      {cnt} {cnt === 2 ? '(+Shapeshifter)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigator Count */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-sm font-semibold text-white">Investigators</div>
                <p className="text-xs text-slate-400">
                  Can scan alive players’ back QRs to inspect their suit color and role alignment.
                </p>
                <div className="flex gap-2 pt-1">
                  {[0, 1, 2].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={state.phase !== 'LOBBY'}
                      onClick={() => updateSettings({ investigatorCount: cnt })}
                      className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-bold ${
                        state.settings.investigatorCount === cnt
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      } disabled:opacity-60`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasks Per Player */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Tasks Per Player</span>
                  <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    {state.settings.tasksPerPlayer}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  disabled={state.phase !== 'LOBBY'}
                  value={state.settings.tasksPerPlayer}
                  onChange={(e) => updateSettings({ tasksPerPlayer: Number(e.target.value) })}
                  className="w-full accent-emerald-400"
                />
              </div>

              {/* Kill Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Kill Cooldown</span>
                  <span className="font-mono text-sm font-bold text-red-400 tabular-nums">
                    {state.settings.killCooldownSec}s
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  disabled={state.phase !== 'LOBBY'}
                  value={state.settings.killCooldownSec}
                  onChange={(e) => updateSettings({ killCooldownSec: Number(e.target.value) })}
                  className="w-full accent-red-500"
                />
              </div>

              {/* Investigator Scan Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Investigator Scan Cooldown</span>
                  <span className="font-mono text-sm font-bold text-cyan-400 tabular-nums">
                    {state.settings.scanCooldownSec}s
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  disabled={state.phase !== 'LOBBY'}
                  value={state.settings.scanCooldownSec}
                  onChange={(e) => updateSettings({ scanCooldownSec: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Sabotage Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Sabotage Cooldown</span>
                  <span className="font-mono text-sm font-bold text-orange-400 tabular-nums">
                    {state.settings.sabotageCooldownSec ?? 30}s
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  disabled={state.phase !== 'LOBBY'}
                  value={state.settings.sabotageCooldownSec ?? 30}
                  onChange={(e) => updateSettings({ sabotageCooldownSec: Number(e.target.value) })}
                  className="w-full accent-orange-400"
                />
              </div>

              {/* Discussion & Voting Time */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Voting Time</span>
                  <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                    {state.settings.votingSec}s
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={120}
                  step={10}
                  disabled={state.phase !== 'LOBBY'}
                  value={state.settings.votingSec}
                  onChange={(e) => updateSettings({ votingSec: Number(e.target.value) })}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-white/10 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-white">Confirm Ejects</div>
                <div className="text-xs text-slate-400">
                  Reveal whether the voted-out player was an Impostor after meetings.
                </div>
              </div>
              <input
                type="checkbox"
                disabled={state.phase !== 'LOBBY'}
                checked={state.settings.confirmEjects}
                onChange={(e) => updateSettings({ confirmEjects: e.target.checked })}
                className="w-5 h-5 accent-cyan-400"
              />
            </label>
          </div>
        </main>
      )}
    </div>
  );
};
