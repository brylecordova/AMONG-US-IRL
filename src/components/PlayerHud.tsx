import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  QrCode,
  Search,
  ShieldAlert,
  Skull,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ClientGameState,
  getColorDef,
  getTaskDef,
  ParsedQrAction,
  PlayerColorId,
  PublicAlignment,
  SkeldTaskDef,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { QrScannerModal } from './QrScannerModal';
import { SkeldTaskModal } from './tasks/SkeldTaskModal';
import { soundEngine } from '../utils/sound';

interface PlayerHudProps {
  state: ClientGameState;
  playerToken: string;
  killedAlertTrigger: number;
  meetingAlertTrigger: number;
  onUpdateState: (next: ClientGameState) => void;
  onLeaveSession: () => void;
}

type ScanMode = 'AUTO' | 'KILL' | 'INVESTIGATE';

interface ForensicBanner {
  targetName: string;
  targetColor: PlayerColorId;
  reportedAlignment: PublicAlignment;
}

export const PlayerHud: React.FC<PlayerHudProps> = ({
  state,
  playerToken,
  killedAlertTrigger,
  meetingAlertTrigger,
  onUpdateState,
  onLeaveSession,
}) => {
  const [scannerMode, setScannerMode] = useState<ScanMode | null>(null);
  const [activeTask, setActiveTask] = useState<SkeldTaskDef | null>(null);
  const [showKilledModal, setShowKilledModal] = useState(false);
  const [forensicResult, setForensicResult] = useState<ForensicBanner | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [nowMs, setNowMs] = useState(Date.now());
  const [localKillRemaining, setLocalKillRemaining] = useState(state.self.killCooldownRemainingSec);
  const [localScanRemaining, setLocalScanRemaining] = useState(state.self.scanCooldownRemainingSec);

  // Sync cooldowns from server snapshot and tick every second smoothly
  useEffect(() => {
    setLocalKillRemaining(state.self.killCooldownRemainingSec);
    setLocalScanRemaining(state.self.scanCooldownRemainingSec);
  }, [state.self.killCooldownRemainingSec, state.self.scanCooldownRemainingSec, state.serverTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
      setLocalKillRemaining((k) => Math.max(0, k - 1));
      setLocalScanRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Show "YOU HAVE BEEN KILLED" modal immediately when killed
  useEffect(() => {
    if (killedAlertTrigger > 0) {
      soundEngine.playKillAlert();
      setActiveTask(null);
      setScannerMode(null);
      setShowKilledModal(true);
    }
  }, [killedAlertTrigger]);

  // Play klaxon when Emergency Meeting begins
  useEffect(() => {
    if (meetingAlertTrigger > 0) {
      soundEngine.playEmergencyAlarm();
      setActiveTask(null);
      setScannerMode(null);
    }
  }, [meetingAlertTrigger]);

  // Play victory sound when game ends
  useEffect(() => {
    if (state.phase === 'ENDED') {
      soundEngine.playVictory();
    }
  }, [state.phase]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const toggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const isImpostorTeam =
    state.self.secretRole === 'IMPOSTOR' || state.self.secretRole === 'SHAPESHIFTER';
  const isInvestigator = state.self.secretRole === 'INVESTIGATOR';
  const myColor = getColorDef(state.self.color);

  const handleQrDetected = async (parsed: ParsedQrAction) => {
    const mode = scannerMode || 'AUTO';
    setScannerMode(null);

    if (parsed.sessionCode && parsed.sessionCode !== state.sessionCode) {
      showToast(`That QR code belongs to session ${parsed.sessionCode}, not ${state.sessionCode}.`);
      return;
    }

    if (parsed.kind === 'TASK') {
      setActiveTask(parsed.task);
      return;
    }

    if (parsed.kind === 'MEETING') {
      try {
        const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/call`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${playerToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onUpdateState(data.state);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to call meeting.');
      }
      return;
    }

    if (parsed.kind === 'PLAYER') {
      try {
        const res = await fetch(`/api/sessions/${state.sessionCode}/scan-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({
            targetColor: parsed.color.id,
            mode: mode === 'AUTO' ? 'AUTO' : mode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onUpdateState(data.state);

        const outcome = data.outcome;
        if (outcome.kind === 'KILL_EXECUTED') {
          soundEngine.playKillAlert();
          showToast(`Eliminated ${outcome.victimName} (${getColorDef(outcome.victimColor).label}).`);
        } else if (outcome.kind === 'INVESTIGATE_RESULT') {
          soundEngine.playInvestigateScan();
          setForensicResult({
            targetName: outcome.targetName,
            targetColor: outcome.targetColor,
            reportedAlignment: outcome.reportedAlignment,
          });
        } else if (outcome.kind === 'ID_CHECK') {
          showToast(
            `${outcome.targetName} (${getColorDef(outcome.targetColor).label}) is ${
              outcome.alive ? 'alive' : 'dead'
            }.`,
          );
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Scan action failed.');
      }
    }
  };

  const handleTaskComplete = async () => {
    if (!activeTask) return;
    const taskToSubmit = activeTask;
    setActiveTask(null);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/tasks/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ taskId: taskToSubmit.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateState(data.state);
      showToast(
        isImpostorTeam
          ? `Practiced ${taskToSubmit.name} (fake cover task).`
          : `Completed ${taskToSubmit.name}!`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not submit task.');
    }
  };

  const handleMarkHere = async () => {
    soundEngine.playClick();
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/arrive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateState(data.state);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  const handleCastVote = async (target: string) => {
    soundEngine.playClick();
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateState(data.state);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Vote failed.');
    }
  };

  const discussionLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.discussionEndsAt - nowMs) / 1000))
    : 0;
  const votingLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.votingEndsAt - nowMs) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col pb-28">
      {/* Compact Mobile Telemetry Bar (<= 15% cap) */}
      <header className="sticky top-0 z-30 h-14 bg-[#0F1520]/95 backdrop-blur-md border-b border-white/10 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CrewmateAvatar
            color={state.self.color}
            alive={state.self.alive}
            ghost={!state.self.alive}
            size={34}
          />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-white truncate leading-tight">
              {state.self.name}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>{myColor.label}</span>
              <span aria-hidden="true">·</span>
              <span className={state.self.alive ? 'text-emerald-400' : 'text-red-400'}>
                {state.self.alive ? 'Alive' : 'Ghost'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Tasks</div>
            <div className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              {state.taskProgress.percentage}%
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Global Task Progress Strip */}
      <div className="h-1.5 bg-slate-900 w-full">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${state.taskProgress.percentage}%` }}
        />
      </div>

      {toastMsg && (
        <div className="mx-4 mt-3 bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 px-4 py-2.5 rounded-xl text-xs font-medium">
          {toastMsg}
        </div>
      )}

      {/* MAIN PHASE VIEW */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        {/* LOBBY WAITING ROOM */}
        {state.phase === 'LOBBY' && (
          <div className="space-y-4 pt-2">
            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6 text-center space-y-3">
              <CrewmateAvatar color={state.self.color} size={84} className="mx-auto" />
              <h1 className="font-display text-3xl font-bold text-white">
                Ready in {myColor.label} Suit
              </h1>
              <p className="text-sm text-slate-300">
                Put your printed <span className="font-bold text-white">{myColor.label}</span> QR badge on your back. Waiting for host to launch mission{' '}
                <span className="font-mono font-bold text-cyan-300">{state.sessionCode}</span>.
              </p>
            </div>

            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="text-xs font-medium text-slate-400">
                Crewmates in Lobby ({state.players.length}/12)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {state.players.map((p) => (
                  <div
                    key={p.playerId}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                  >
                    <CrewmateAvatar color={p.color} size={28} />
                    <span className="text-xs font-medium text-white truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onLeaveSession}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-400"
            >
              Leave Lobby
            </button>
          </div>
        )}

        {/* ACTIVE GAMEPLAY */}
        {state.phase === 'PLAYING' && (
          <>
            {/* Secret Role Card */}
            <div
              className={`rounded-2xl p-4 border ${
                isImpostorTeam
                  ? 'bg-red-950/30 border-red-500/40'
                  : isInvestigator
                    ? 'bg-cyan-950/30 border-cyan-500/40'
                    : 'bg-[#151C28] border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">Classified Role</div>
                  <div
                    className={`font-display text-3xl font-bold tracking-wide ${
                      isImpostorTeam
                        ? 'text-red-400'
                        : isInvestigator
                          ? 'text-cyan-300'
                          : 'text-emerald-400'
                    }`}
                  >
                    {state.self.secretRole}
                  </div>
                </div>
                {!state.self.alive && (
                  <span className="text-xs font-mono font-bold text-red-300 bg-red-500/20 px-2.5 py-1 rounded-lg">
                    GHOST MODE
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {state.self.secretRole === 'CREWMATE' &&
                  'Scan Skeld Task QR codes around the area to finish your tasks, or scan dead bodies to report.'}
                {state.self.secretRole === 'INVESTIGATOR' &&
                  'Complete tasks and scan alive players’ back QRs to inspect their suit color and alignment.'}
                {state.self.secretRole === 'IMPOSTOR' &&
                  'Scan Crewmates’ back QRs to eliminate them. Blend in at task stations to avoid suspicion.'}
                {state.self.secretRole === 'SHAPESHIFTER' &&
                  'You are the Shapeshifter Impostor: Investigator scans detect you as a Crewmate!'}
              </p>

              {state.self.teammates.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-red-500/20 text-xs text-red-200">
                  Partner Impostor:{' '}
                  {state.self.teammates
                    .map((t) => `${t.name} (${getColorDef(t.color).label} · ${t.role})`)
                    .join(', ')}
                </div>
              )}
            </div>

            {/* Assigned Task List */}
            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">
                  {isImpostorTeam ? 'Cover Task List (Fake)' : 'Assigned Skeld Tasks'}
                </h2>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {state.self.assignedTasks.filter((t) => t.completed).length}/
                  {state.self.assignedTasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {state.self.assignedTasks.map((item) => {
                  const def = getTaskDef(item.taskId);
                  return (
                    <div
                      key={item.taskId}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        item.completed
                          ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70'
                          : 'bg-slate-950/60 border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white flex items-center gap-2">
                          <span className={item.completed ? 'line-through text-emerald-300' : ''}>
                            {def.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{def.room}</span>
                          <span aria-hidden="true">·</span>
                          <span>{def.tier}</span>
                          {def.isVisual && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-cyan-300">Visual</span>
                            </>
                          )}
                        </div>
                      </div>

                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="font-mono text-xs text-slate-400 shrink-0">
                          Scan QR
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* EMERGENCY MEETING & VOTING PHASE */}
        {state.phase === 'MEETING' && state.meeting && (
          <div className="space-y-4">
            <div className="bg-red-600/20 border-2 border-red-500 rounded-2xl p-4 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-red-400 font-display text-3xl font-bold">
                <ShieldAlert className="w-7 h-7" />
                <span>EMERGENCY MEETING</span>
              </div>
              <p className="text-sm text-white">
                {state.meeting.reason === 'BODY_REPORTED'
                  ? `${state.meeting.reporterName} found ${state.meeting.victimName} (${getColorDef(state.meeting.victimColor || 'red').label}) killed.`
                  : `${state.meeting.reporterName} called an Emergency Meeting!`}
              </p>

              {state.meeting.verdictMessage ? (
                <div className="mt-2 py-2 px-3 rounded-xl bg-slate-950/80 text-amber-300 font-semibold text-sm">
                  {state.meeting.verdictMessage}
                </div>
              ) : state.meeting.stage === 'GATHERING' ? (
                <div className="font-mono text-xs text-amber-300 tabular-nums pt-1">
                  HEAD TO MEETING TABLE · {state.meeting.arrivedCount} / {state.meeting.totalAliveCount} ALIVE HERE
                </div>
              ) : (
                <div className="font-mono text-xs text-red-200 tabular-nums pt-1">
                  {discussionLeftSec > 0
                    ? `DISCUSSION PHASE · VOTING OPENS IN ${discussionLeftSec}s`
                    : `VOTING OPEN · ${votingLeftSec}s REMAINING`}
                </div>
              )}
            </div>

            {/* GATHERING CHECK-IN STAGE: Players tap HERE! when they reach the meeting table */}
            {state.meeting.stage === 'GATHERING' && (
              <div className="space-y-3">
                {state.self.alive ? (
                  !state.self.hasArrived ? (
                    <button
                      type="button"
                      onClick={handleMarkHere}
                      className="w-full min-h-[64px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-display text-3xl font-bold tracking-wide shadow-lg transition-transform"
                    >
                      HERE!
                    </button>
                  ) : (
                    <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 text-center">
                      <div className="font-bold text-sm text-emerald-300">
                        You checked in as HERE!
                      </div>
                      <div className="text-xs text-emerald-100/80 mt-1">
                        Discussion starts automatically once all alive crewmates reach the table.
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-[#151C28] border border-white/10 rounded-xl p-3 text-center text-xs text-slate-400">
                    You are Dead. Waiting for alive players to gather at the table.
                  </div>
                )}

                <div className="space-y-2">
                  {state.players.map((p) => (
                    <div
                      key={p.playerId}
                      className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 ${
                        !p.alive
                          ? 'bg-red-950/20 border-red-500/20 opacity-55'
                          : p.hasArrived
                            ? 'bg-emerald-950/25 border-emerald-500/35'
                            : 'bg-[#151C28] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CrewmateAvatar color={p.color} alive={p.alive} size={36} />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                          <div className="text-xs text-slate-400">{getColorDef(p.color).label}</div>
                        </div>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold shrink-0 ${
                          !p.alive
                            ? 'text-red-400'
                            : p.hasArrived
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                        }`}
                      >
                        {!p.alive ? 'DEAD' : p.hasArrived ? 'HERE!' : 'WALKING...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DISCUSSION & VOTING STAGE */}
            {state.meeting.stage !== 'GATHERING' && !state.meeting.verdictMessage && (
              <div className="space-y-2.5">
                {state.players.map((p) => {
                  const colorDef = getColorDef(p.color);
                  const canVoteTarget =
                    state.self.alive &&
                    !state.self.hasVoted &&
                    discussionLeftSec === 0 &&
                    p.alive;
                  return (
                    <button
                      key={p.playerId}
                      type="button"
                      disabled={!canVoteTarget}
                      onClick={() => handleCastVote(p.playerId)}
                      className={`w-full min-h-[58px] px-4 py-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-transform active:scale-[0.99] ${
                        !p.alive
                          ? 'bg-red-950/20 border-red-500/20 opacity-55'
                          : canVoteTarget
                            ? 'bg-[#151C28] hover:bg-[#1E293B] border-white/15 cursor-pointer'
                            : 'bg-[#151C28] border-white/10 opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CrewmateAvatar color={p.color} alive={p.alive} size={38} />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span>{colorDef.label}</span>
                            <span aria-hidden="true">·</span>
                            <span className={p.alive ? 'text-emerald-400' : 'text-red-400'}>
                              {p.alive ? 'Alive' : 'Dead'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-mono shrink-0">
                        {p.hasVoted ? (
                          <span className="text-emerald-400 font-bold">VOTED</span>
                        ) : canVoteTarget ? (
                          <span className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold">
                            Vote
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                {state.self.alive && !state.self.hasVoted && discussionLeftSec === 0 && (
                  <button
                    type="button"
                    onClick={() => handleCastVote('SKIP')}
                    className="w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                  >
                    Skip Vote
                  </button>
                )}

                {state.self.hasVoted && (
                  <div className="text-center text-xs font-mono text-emerald-400 py-2">
                    Vote locked. Waiting for remaining alive crewmates...
                  </div>
                )}

                {!state.self.alive && (
                  <div className="text-center text-xs text-slate-400 py-2">
                    You are a Ghost. Observe the meeting silently without voting.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VICTORY / GAME OVER SCREEN */}
        {state.phase === 'ENDED' && (
          <div className="space-y-4 pt-2">
            <div
              className={`rounded-2xl p-6 text-center border-2 ${
                state.winner === 'CREWMATES'
                  ? 'bg-emerald-950/35 border-emerald-400'
                  : 'bg-red-950/35 border-red-500'
              }`}
            >
              <h1 className="font-display text-4xl font-bold text-white">
                {state.winner === 'CREWMATES' ? 'CREWMATES WIN' : 'IMPOSTORS WIN'}
              </h1>
              <p className="text-sm text-slate-200 mt-2">{state.winReason}</p>
            </div>

            <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-400">Final Crew Debrief</div>
              {state.players.map((p) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <CrewmateAvatar color={p.color} alive={p.alive} size={32} />
                    <div>
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">{getColorDef(p.color).label}</div>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      p.revealedRole === 'IMPOSTOR' || p.revealedRole === 'SHAPESHIFTER'
                        ? 'text-red-400'
                        : p.revealedRole === 'INVESTIGATOR'
                          ? 'text-cyan-300'
                          : 'text-emerald-400'
                    }`}
                  >
                    {p.revealedRole}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM THUMB-ZONE ACTION BAR */}
      {state.phase === 'PLAYING' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F1520]/95 backdrop-blur-md border-t border-white/10 p-3">
          <div className="max-w-xl mx-auto flex gap-2.5">
            <button
              type="button"
              onClick={() => setScannerMode('AUTO')}
              className="flex-1 min-h-[50px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-transform"
            >
              <QrCode className="w-5 h-5" />
              <span>{state.self.alive ? 'Scan Task / Body' : 'Scan Task QR'}</span>
            </button>

            {state.self.alive && isInvestigator && (
              <button
                type="button"
                disabled={localScanRemaining > 0}
                onClick={() => setScannerMode('INVESTIGATE')}
                className="flex-1 min-h-[50px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-400 active:scale-[0.98] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-transform"
              >
                <Search className="w-5 h-5" />
                <span className="tabular-nums">
                  {localScanRemaining > 0 ? `Scan (${localScanRemaining}s)` : 'Investigate'}
                </span>
              </button>
            )}

            {state.self.alive && isImpostorTeam && (
              <button
                type="button"
                disabled={localKillRemaining > 0}
                onClick={() => setScannerMode('KILL')}
                className="flex-1 min-h-[50px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-400 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform"
              >
                <Skull className="w-5 h-5" />
                <span className="tabular-nums">
                  {localKillRemaining > 0 ? `Kill (${localKillRemaining}s)` : 'Kill QR'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* QR SCANNER MODAL */}
      {scannerMode && (
        <QrScannerModal
          title={
            scannerMode === 'KILL'
              ? 'Impostor Kill Scanner'
              : scannerMode === 'INVESTIGATE'
                ? 'Forensic Investigator Scanner'
                : 'Skeld QR Scanner'
          }
          subtitle={
            scannerMode === 'KILL'
              ? 'Scan an alive Crewmate’s back QR code to eliminate them.'
              : scannerMode === 'INVESTIGATE'
                ? 'Scan any alive player’s back QR to reveal their suit color and alignment.'
                : 'Scan a Task QR, a dead player’s back QR to report, or the Emergency Button.'
          }
          accentColor={
            scannerMode === 'KILL' ? 'red' : scannerMode === 'INVESTIGATE' ? 'cyan' : 'emerald'
          }
          onDetected={handleQrDetected}
          onClose={() => setScannerMode(null)}
        />
      )}

      {/* SKELD TASK MINI-GAME MODAL */}
      {activeTask && (
        <SkeldTaskModal
          task={activeTask}
          isFakeTask={isImpostorTeam}
          onComplete={handleTaskComplete}
          onClose={() => setActiveTask(null)}
        />
      )}

      {/* INVESTIGATOR FORENSIC SCAN RESULT MODAL */}
      {forensicResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#151C28] border-2 border-cyan-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 text-cyan-300 font-mono text-xs font-bold">
              <Eye className="w-4 h-4" />
              <span>FORENSIC SCAN RESULT</span>
            </div>

            <CrewmateAvatar color={forensicResult.targetColor} size={86} className="mx-auto" />

            <div>
              <div className="font-display text-3xl font-bold text-white">
                {forensicResult.targetName}
              </div>
              <div className="text-sm text-slate-300 mt-0.5">
                Suit Color:{' '}
                <span className="font-bold text-white">
                  {getColorDef(forensicResult.targetColor).label}
                </span>
              </div>
            </div>

            <div
              className={`py-3 px-4 rounded-xl border font-display text-2xl font-bold ${
                forensicResult.reportedAlignment === 'IMPOSTOR'
                  ? 'bg-red-500/20 border-red-500 text-red-300'
                  : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              }`}
            >
              {forensicResult.reportedAlignment === 'IMPOSTOR'
                ? 'DETECTED: IMPOSTOR'
                : 'DETECTED: CREWMATE'}
            </div>

            <button
              type="button"
              onClick={() => setForensicResult(null)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm"
            >
              Close Readout
            </button>
          </div>
        </div>
      )}

      {/* YOU HAVE BEEN KILLED FULL-SCREEN ALERT */}
      {showKilledModal && (
        <div className="fixed inset-0 z-50 bg-[#1B0609]/95 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-sm bg-[#24090D] border-2 border-red-500 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
            {/* Cracked Visor + Skull Vector Emblem */}
            <svg width="92" height="92" viewBox="0 0 96 96" fill="none" className="mx-auto">
              <circle cx="48" cy="48" r="44" fill="#7F1D1D" stroke="#EF4444" strokeWidth="4" />
              <path
                d="M28 45C28 32 37 24 48 24C59 24 68 32 68 45C68 54 62 60 58 62V70H38V62C34 60 28 54 28 45Z"
                fill="#FEE2E2"
              />
              <circle cx="40" cy="45" r="5" fill="#7F1D1D" />
              <circle cx="56" cy="45" r="5" fill="#7F1D1D" />
              <path d="M22 26L74 70" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />
            </svg>

            <div>
              <h2 className="font-display text-4xl font-bold text-red-400 tracking-wide">
                YOU HAVE BEEN KILLED
              </h2>
              <p className="text-sm text-red-100/90 mt-2 leading-relaxed">
                Stay silent! Leave your back QR badge visible so another crewmate can scan and report your body.
              </p>
            </div>

            <div className="bg-black/35 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                As a Ghost, you can still scan and complete your remaining Skeld tasks to help Crewmates win.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowKilledModal(false)}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
            >
              Enter Ghost Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
