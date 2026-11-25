import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  CloudRain,
  Eye,
  Flame,
  Lock,
  Map as MapIcon,
  Monitor,
  QrCode,
  Radio,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Terminal,
  Trophy,
  Unlock,
  Volume2,
  VolumeX,
  Wind,
  X,
  ZapOff,
} from 'lucide-react';
import {
  ClientGameState,
  getColorDef,
  getTaskDef,
  ParsedQrAction,
  PLAYER_COLORS,
  PlayerColorId,
  PublicAlignment,
  SabotageKind,
  SKELD_ROOMS,
  SkeldTaskDef,
  StationActivityEvent,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { SkeldTaskIconBadge } from './PrintedQrCards';
import { QrScannerModal, QrScanValidationResult } from './QrScannerModal';
import { RoleSplashModal } from './RoleSplashModal';
import { SkeldTaskModal } from './tasks/SkeldTaskModal';
import { haptics } from '../utils/haptics';
import { soundEngine } from '../utils/sound';

interface PlayerHudProps {
  state: ClientGameState;
  playerToken: string;
  killedAlertTrigger: number;
  meetingAlertTrigger: number;
  sabotageAlertTrigger: number;
  missionStartedTrigger: number;
  shieldBlockedEvent?: {
    seq: number;
    targetId?: string;
    targetName?: string;
    guardianId?: string;
  } | null;
  sheriffActionEvent?: {
    seq: number;
    hit: boolean;
    targetName?: string;
    sheriffName?: string;
  } | null;
  onUpdateState: (next: ClientGameState) => void;
  onLeaveSession: () => void;
}

type ScanMode = 'AUTO' | 'KILL' | 'INVESTIGATE' | 'SHERIFF';

interface ForensicBanner {
  targetName: string;
  targetColor: PlayerColorId;
  reportedAlignment: PublicAlignment;
}

type StationModalState =
  | {
      kind: 'ADMIN_MAP';
      roomActivity: Record<string, number>;
      expiresAt: number;
    }
  | {
      kind: 'SECURITY_FEED';
      feed: StationActivityEvent[];
      expiresAt: number;
    };

export const PlayerHud: React.FC<PlayerHudProps> = ({
  state,
  playerToken,
  killedAlertTrigger,
  meetingAlertTrigger,
  sabotageAlertTrigger,
  missionStartedTrigger,
  shieldBlockedEvent,
  sheriffActionEvent,
  onUpdateState,
  onLeaveSession,
}) => {
  const [scannerMode, setScannerMode] = useState<ScanMode | null>(null);
  const [activeTask, setActiveTask] = useState<SkeldTaskDef | null>(null);
  const [showRoleSplash, setShowRoleSplash] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalUnlocked, setTerminalUnlocked] = useState(false);
  const [showKilledModal, setShowKilledModal] = useState(false);
  const [deadBodyFound, setDeadBodyFound] = useState<{
    victimName: string;
    victimColor: PlayerColorId;
  } | null>(null);
  const [reportingBody, setReportingBody] = useState(false);
  const [voteNowBusy, setVoteNowBusy] = useState(false);
  const [forensicResult, setForensicResult] = useState<ForensicBanner | null>(null);
  const [stationModal, setStationModal] = useState<StationModalState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [nowMs, setNowMs] = useState(Date.now());
  const [localKillRemaining, setLocalKillRemaining] = useState(state.self.killCooldownRemainingSec);
  const [localScanRemaining, setLocalScanRemaining] = useState(state.self.scanCooldownRemainingSec);
  const [localSabotageRemaining, setLocalSabotageRemaining] = useState(
    state.self.sabotageCooldownRemainingSec ?? 0,
  );
  const [localShieldRemaining, setLocalShieldRemaining] = useState(
    state.self.shieldCooldownRemainingSec ?? 0,
  );
  const [localVentRemaining, setLocalVentRemaining] = useState(
    state.self.ventCooldownRemainingSec ?? 0,
  );
  const [sabotageBusy, setSabotageBusy] = useState(false);
  const [shieldBusy, setShieldBusy] = useState(false);
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostRoom, setGhostRoom] = useState<string>(SKELD_ROOMS[0]);
  const [colorBusy, setColorBusy] = useState(false);
  const prevPhaseRef = useRef(state.phase);
  const roleSplashShownRef = useRef(false);
  const lastVisualAlertIdRef = useRef<string | null>(null);
  const serverSkewMsRef = useRef(state.serverTime - Date.now());

  // Sync cooldowns & clock offset from server snapshot and tick smoothly
  useEffect(() => {
    serverSkewMsRef.current = state.serverTime - Date.now();
    setLocalKillRemaining(state.self.killCooldownRemainingSec);
    setLocalScanRemaining(state.self.scanCooldownRemainingSec);
    setLocalSabotageRemaining(state.self.sabotageCooldownRemainingSec ?? 0);
    setLocalShieldRemaining(state.self.shieldCooldownRemainingSec ?? 0);
    setLocalVentRemaining(state.self.ventCooldownRemainingSec ?? 0);
  }, [
    state.self.killCooldownRemainingSec,
    state.self.scanCooldownRemainingSec,
    state.self.sabotageCooldownRemainingSec,
    state.self.shieldCooldownRemainingSec,
    state.self.ventCooldownRemainingSec,
    state.serverTime,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setLocalKillRemaining((k) => Math.max(0, k - 1));
      setLocalScanRemaining((s) => Math.max(0, s - 1));
      setLocalSabotageRemaining((sb) => Math.max(0, sb - 1));
      setLocalShieldRemaining((sh) => Math.max(0, sh - 1));
      setLocalVentRemaining((v) => Math.max(0, v - 1));
      setStationModal((prev) => (prev && now >= prev.expiresAt ? null : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.phase !== 'MEETING' || !state.meeting?.revealEndsAt) return;
    setNowMs(Date.now());
    const fastTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 200);
    return () => clearInterval(fastTimer);
  }, [state.phase, state.meeting?.revealEndsAt]);

  // Show "YOU HAVE BEEN KILLED" modal immediately when killed
  useEffect(() => {
    if (killedAlertTrigger > 0) {
      soundEngine.playKillAlert();
      haptics.event('killed');
      setActiveTask(null);
      setScannerMode(null);
      setDeadBodyFound(null);
      setStationModal(null);
      setShowKilledModal(true);
    }
  }, [killedAlertTrigger]);

  // Play klaxon when Emergency Meeting begins
  useEffect(() => {
    if (meetingAlertTrigger > 0) {
      soundEngine.playEmergencyAlarm();
      haptics.event('alarm');
      setActiveTask(null);
      setScannerMode(null);
      setDeadBodyFound(null);
      setStationModal(null);
    }
  }, [meetingAlertTrigger]);

  // Play sabotage alarm
  useEffect(() => {
    if (sabotageAlertTrigger > 0) {
      if (state.activeSabotage?.kind === 'REACTOR' || state.activeSabotage?.kind === 'O2') {
        soundEngine.playMeltdownAlarm();
      } else {
        soundEngine.playSabotageAlarm();
      }
      haptics.event('sabotage');
    }
  }, [sabotageAlertTrigger, state.activeSabotage?.kind]);

  // Guardian Shield deflection sound/toast for target & guardian
  useEffect(() => {
    if (!shieldBlockedEvent) return;
    if (
      state.self.playerId === shieldBlockedEvent.targetId ||
      state.self.playerId === shieldBlockedEvent.guardianId
    ) {
      soundEngine.playShieldBlock();
      haptics.notify('success');
      setToastMsg(
        state.self.playerId === shieldBlockedEvent.targetId
          ? 'Your Guardian Aegis Shield deflected an Impostor strike!'
          : `Your Aegis Shield saved ${shieldBlockedEvent.targetName || 'a teammate'}!`,
      );
    }
  }, [shieldBlockedEvent, state.self.playerId]);

  // Sheriff shot sound effect
  useEffect(() => {
    if (!sheriffActionEvent) return;
    soundEngine.playSheriffShot(sheriffActionEvent.hit);
    haptics.impact('heavy');
  }, [sheriffActionEvent]);

  // Visual Task public alert toast
  useEffect(() => {
    if (
      state.phase === 'PLAYING' &&
      state.settings.visualTaskAlerts &&
      state.recentVisualAlert &&
      state.recentVisualAlert.id !== lastVisualAlertIdRef.current
    ) {
      lastVisualAlertIdRef.current = state.recentVisualAlert.id;
      setToastMsg(
        `Visual Task Alert: ${state.recentVisualAlert.playerName} completed ${state.recentVisualAlert.taskName} in ${state.recentVisualAlert.room}.`,
      );
    }
  }, [state.phase, state.settings.visualTaskAlerts, state.recentVisualAlert]);

  useEffect(() => {
    if (
      state.activeSabotage?.kind === 'BLACKOUT' &&
      activeTask &&
      activeTask.id !== 'fix-wiring'
    ) {
      haptics.notify('warning');
      setActiveTask(null);
      const codeHint = state.settings.hideManualCodes ? '' : ' (WIR1)';
      setToastMsg(`Power Blackout! Scan Fix Wiring${codeHint} to restore power first.`);
    }
  }, [state.activeSabotage?.kind, activeTask, state.settings.hideManualCodes]);

  // Trigger Role Reveal Splash ONLY ONCE at mission start (never again after meetings!)
  useEffect(() => {
    if (state.phase === 'LOBBY') {
      roleSplashShownRef.current = false;
      setShowRoleSplash(false);
    } else if (state.phase === 'ENDED') {
      setShowRoleSplash(false);
    }

    if (state.phase !== 'PLAYING') {
      setShowTerminal(false);
      setTerminalUnlocked(false);
      setDeadBodyFound(null);
      setStationModal(null);
    }

    if (
      !roleSplashShownRef.current &&
      state.phase === 'PLAYING' &&
      (prevPhaseRef.current === 'LOBBY' || missionStartedTrigger > 0)
    ) {
      roleSplashShownRef.current = true;
      setShowRoleSplash(true);
    }

    prevPhaseRef.current = state.phase;
  }, [missionStartedTrigger, state.phase]);

  const isImpostorTeam =
    state.self.secretRole === 'IMPOSTOR' || state.self.secretRole === 'SHAPESHIFTER';
  const isInvestigator = state.self.secretRole === 'INVESTIGATOR';
  const isSheriff = state.self.secretRole === 'SHERIFF';
  const isGuardian = state.self.secretRole === 'GUARDIAN_ANGEL';
  const isJester = state.self.secretRole === 'JESTER';
  const isCrewTeam = !isImpostorTeam && !isJester;

  const didPlayerWin =
    state.winner === 'JESTER'
      ? isJester
      : state.winner === 'IMPOSTORS'
        ? isImpostorTeam
        : isCrewTeam;
  const myColor = getColorDef(state.self.color);

  // Play victory or defeat sound & haptics when game ends
  useEffect(() => {
    if (state.phase === 'ENDED') {
      if (state.winner === 'JESTER' && isJester) {
        soundEngine.playJesterWin();
        haptics.notify('success');
      } else if (didPlayerWin) {
        soundEngine.playVictory();
        haptics.notify('success');
      } else {
        soundEngine.playDefeat();
        haptics.notify('error');
      }
    }
  }, [state.phase, state.winner, isJester, didPlayerWin]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const toggleMute = () => {
    haptics.selection();
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const effectiveNowMs = nowMs + serverSkewMsRef.current;

  const signalJamLeftSec =
    state.activeSabotage?.kind === 'SIGNAL_JAM' && state.activeSabotage.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - effectiveNowMs) / 1000))
      : 0;

  const crisisLeftSec =
    (state.activeSabotage?.kind === 'REACTOR' || state.activeSabotage?.kind === 'O2') &&
    state.activeSabotage.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - effectiveNowMs) / 1000))
      : 0;

  const handleQrDetected = async (parsed: ParsedQrAction): Promise<QrScanValidationResult> => {
    const mode = scannerMode || 'AUTO';

    if (parsed.kind === 'JOIN') {
      return {
        valid: false,
        error: 'That is a Join Lobby QR. Scan a Task, Player Back, or Emergency QR.',
      };
    }

    if (parsed.kind === 'REJOIN') {
      return {
        valid: false,
        error: 'That is a Rejoin QR code. Leave your current mission first to rejoin.',
      };
    }

    if (parsed.sessionCode && parsed.sessionCode !== state.sessionCode) {
      return {
        valid: false,
        error: `That QR code belongs to session ${parsed.sessionCode}, not ${state.sessionCode}.`,
      };
    }

    if (parsed.kind === 'TASK') {
      if (state.activeSabotage?.kind === 'BLACKOUT') {
        const codeHint = state.settings.hideManualCodes ? '' : ' (WIR1)';
        if (parsed.task.id !== 'fix-wiring') {
          return {
            valid: false,
            error: `Power Blackout active! Scan Fix Wiring${codeHint} to restore power first.`,
          };
        }
        if (!state.self.alive) {
          return {
            valid: false,
            error: `Power Blackout active! Only alive players can restore Fix Wiring${codeHint}.`,
          };
        }
      }
      setScannerMode(null);
      setActiveTask(parsed.task);
      return { valid: true };
    }

    if (parsed.kind === 'STATION') {
      try {
        const res = await fetch(`/api/sessions/${state.sessionCode}/station-scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({ stationId: parsed.station.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScannerMode(null);
        onUpdateState(data.state);
        const outcome = data.outcome;
        if (outcome.kind === 'ADMIN_MAP') {
          haptics.notify('success');
          setStationModal({
            kind: 'ADMIN_MAP',
            roomActivity: outcome.roomActivity,
            expiresAt: Date.now() + 12_000,
          });
        } else if (outcome.kind === 'SECURITY_FEED') {
          haptics.notify('success');
          setStationModal({
            kind: 'SECURITY_FEED',
            feed: outcome.feed,
            expiresAt: Date.now() + 12_000,
          });
        } else if (outcome.kind === 'VENT_RELAY') {
          if (outcome.activated) {
            haptics.notify('success');
          } else {
            haptics.notify('warning');
          }
          showToast(outcome.message);
        }
        return { valid: true };
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Station terminal rejected.',
        };
      }
    }

    if (parsed.kind === 'MEETING') {
      if (state.activeSabotage?.kind === 'SIGNAL_JAM' && signalJamLeftSec > 0) {
        return {
          valid: false,
          error: `Signal Jam active! Emergency Meetings are disabled for ${signalJamLeftSec}s.`,
        };
      }
      if (
        (state.activeSabotage?.kind === 'REACTOR' || state.activeSabotage?.kind === 'O2') &&
        crisisLeftSec > 0
      ) {
        return {
          valid: false,
          error: `Cannot call Emergency Meeting during an active ${state.activeSabotage.kind} crisis!`,
        };
      }
      try {
        const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/call`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${playerToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScannerMode(null);
        onUpdateState(data.state);
        return { valid: true };
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Unable to call meeting.',
        };
      }
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
        setScannerMode(null);
        onUpdateState(data.state);

        const outcome = data.outcome;
        if (outcome.kind === 'KILL_EXECUTED') {
          soundEngine.playKillAlert();
          haptics.impact('heavy');
          showToast(`Eliminated ${outcome.victimName} (${getColorDef(outcome.victimColor).label}).`);
        } else if (outcome.kind === 'SHIELD_BLOCKED') {
          soundEngine.playShieldBlock();
          haptics.notify('warning');
          showToast(
            `Blocked! ${outcome.targetName} was protected by a Guardian Aegis Shield (10s recharge).`,
          );
        } else if (outcome.kind === 'SHERIFF_KILL') {
          soundEngine.playSheriffShot(true);
          haptics.impact('heavy');
          showToast(
            `Justice Shot! Eliminated Impostor ${outcome.targetName} (${getColorDef(outcome.targetColor).label}).`,
          );
        } else if (outcome.kind === 'SHERIFF_MISFIRE') {
          soundEngine.playSheriffShot(false);
          haptics.notify('error');
          showToast(
            `Misfire! ${outcome.targetName} was NOT an Impostor — you were eliminated!`,
          );
        } else if (outcome.kind === 'DEAD_BODY_FOUND') {
          soundEngine.playClick();
          haptics.notify('warning');
          setDeadBodyFound({
            victimName: outcome.victimName,
            victimColor: outcome.victimColor,
          });
        } else if (outcome.kind === 'INVESTIGATE_RESULT') {
          soundEngine.playInvestigateScan();
          haptics.notify('success');
          setForensicResult({
            targetName: outcome.targetName,
            targetColor: outcome.targetColor,
            reportedAlignment: outcome.reportedAlignment,
          });
        } else if (outcome.kind === 'ID_CHECK') {
          haptics.impact('light');
          showToast(
            `${outcome.targetName} (${getColorDef(outcome.targetColor).label}) is ${
              outcome.alive ? 'alive' : 'dead'
            }.`,
          );
        }
        return { valid: true };
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Scan action failed.',
        };
      }
    }

    return { valid: false, error: 'Unrecognized QR code.' };
  };

  const handleTriggerSabotage = async (kind: SabotageKind) => {
    soundEngine.playClick();
    haptics.impact('heavy');
    setSabotageBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/sabotage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      haptics.notify('warning');
      onUpdateState(data.state);
      showToast(
        kind === 'BLACKOUT'
          ? `Power Blackout triggered! Tasks locked until Fix Wiring${state.settings.hideManualCodes ? '' : ' (WIR1)'} is repaired.`
          : kind === 'SIGNAL_JAM'
            ? 'Signal Jam triggered! Emergency Meetings disabled for 60s.'
            : kind === 'REACTOR'
              ? 'Reactor Meltdown triggered! Crew must sync both Reactor stations.'
              : 'O2 Depletion triggered! Crew must clear O2 Filter & Empty Chute.',
      );
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to trigger sabotage.');
    } finally {
      setSabotageBusy(false);
    }
  };

  const handleDeployShield = async (targetPlayerId: string) => {
    soundEngine.playClick();
    haptics.impact('medium');
    setShieldBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/shield`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ targetPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      soundEngine.playShieldBlock();
      haptics.notify('success');
      onUpdateState(data.state);
      setTerminalUnlocked(false);
      setShowTerminal(false);
      showToast(`Aegis Shield deployed on ${data.targetName} for 35s!`);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to deploy Aegis Shield.');
    } finally {
      setShieldBusy(false);
    }
  };

  const handleUseGhostPower = async (power: 'GHOST_PING' | 'GHOST_FLICKER') => {
    soundEngine.playClick();
    haptics.impact('medium');
    setGhostBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/ghost-power`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ power, room: ghostRoom }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      haptics.notify('success');
      onUpdateState(data.state);
      showToast(data.message);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Ghost power unavailable.');
    } finally {
      setGhostBusy(false);
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
      haptics.notify('success');
      onUpdateState(data.state);
      if (data.powerRestored) {
        soundEngine.playTaskSuccess();
        showToast('Grid power restored at Electrical! All tasks unlocked.');
      } else if (data.sabotageCleared === 'REACTOR') {
        soundEngine.playTaskSuccess();
        showToast('Reactor Meltdown stabilized!');
      } else if (data.sabotageCleared === 'O2') {
        soundEngine.playTaskSuccess();
        showToast('O2 Reserves stabilized!');
      } else if (data.meltdownProgress) {
        soundEngine.playClick();
        showToast(
          `Crisis Station 1/2 synced! Partner must finish the 2nd station within 15s.`,
        );
      } else {
        showToast(
          isImpostorTeam || isJester
            ? `Task station verified (${taskToSubmit.name}).`
            : `Completed ${taskToSubmit.name}!`,
        );
      }
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Could not submit task.');
    }
  };

  const handleMarkHere = async () => {
    soundEngine.playClick();
    haptics.impact('heavy');
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/arrive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      haptics.notify('success');
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  const handleSwitchLobbyColor = async (colorId: PlayerColorId) => {
    if (colorBusy || colorId === state.self.color) return;
    soundEngine.playClick();
    haptics.selection();
    setColorBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/player/color`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ color: colorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to switch suit color.');
    } finally {
      setColorBusy(false);
    }
  };

  const handleReportDeadBody = async () => {
    if (!deadBodyFound || reportingBody) return;
    soundEngine.playClick();
    haptics.impact('heavy');
    setReportingBody(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/scan-player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({
          targetColor: deadBodyFound.victimColor,
          mode: 'REPORT',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeadBodyFound(null);
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to report dead body.');
    } finally {
      setReportingBody(false);
    }
  };

  const handleVoteNow = async () => {
    if (voteNowBusy) return;
    soundEngine.playClick();
    haptics.impact('medium');
    setVoteNowBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/meeting/vote-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      haptics.notify('success');
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Vote Now failed.');
    } finally {
      setVoteNowBusy(false);
    }
  };

  const handleCastVote = async (target: string) => {
    soundEngine.playClick();
    haptics.impact('medium');
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
      haptics.notify('success');
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Vote failed.');
    }
  };

  const discussionLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.discussionEndsAt - effectiveNowMs) / 1000))
    : 0;
  const votingLeftSec = state.meeting
    ? Math.max(0, Math.ceil((state.meeting.votingEndsAt - effectiveNowMs) / 1000))
    : 0;
  const revealLeftSec =
    state.meeting?.stage === 'VOTING' && state.meeting.revealEndsAt
      ? Math.max(0, Math.ceil((state.meeting.revealEndsAt - effectiveNowMs) / 1000))
      : 0;

  return (
    <div
      className={`min-h-dvh bg-[#0B0F17] text-slate-100 flex flex-col ${
        state.phase === 'PLAYING'
          ? 'pb-[calc(5.75rem+env(safe-area-inset-bottom))]'
          : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'
      }`}
    >
      {/* Compact Mobile Telemetry Bar (<= 15% cap) */}
      <header className="sticky top-0 z-30 min-h-14 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] bg-[#0F1520]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-3">
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
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
              <span>{myColor.label}</span>
              <span aria-hidden="true">·</span>
              <span className={state.self.alive ? 'text-emerald-400' : 'text-red-400'}>
                {state.self.alive ? 'Alive' : 'Ghost'}
              </span>
              {state.self.rejoinCode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-cyan-300">ID {state.self.rejoinCode}</span>
                </>
              )}
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
      <div className="h-1.5 bg-slate-900 w-full overflow-hidden">
        <motion.div
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${state.taskProgress.percentage}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-4 mt-3 bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 px-4 py-2.5 rounded-xl text-xs font-medium"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN PHASE VIEW */}
      <main className="flex-1 max-w-xl w-full mx-auto py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] space-y-4">
        <AnimatePresence mode="wait">
          {/* LOBBY WAITING ROOM */}
          {state.phase === 'LOBBY' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 pt-2"
            >
              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-6 text-center space-y-3">
                <CrewmateAvatar color={state.self.color} size={84} animate className="mx-auto" />
                <h1 className="font-display text-3xl font-bold text-white">
                  Ready in {myColor.label} Suit
                </h1>
                <p className="text-sm text-slate-300">
                  Put your printed <span className="font-bold text-white">{myColor.label}</span> QR badge on your back. Waiting for host to launch mission{' '}
                  <span className="font-mono font-bold text-cyan-300">{state.sessionCode}</span>.
                </p>
                {state.self.rejoinCode && (
                  <div className="pt-2 border-t border-white/10 text-xs text-slate-300">
                    Your Rejoin Code:{' '}
                    <span className="font-mono font-bold text-cyan-300 tracking-widest">
                      {state.self.rejoinCode}
                    </span>{' '}
                    <span className="text-slate-400">(use if you refresh)</span>
                  </div>
                )}
              </div>

              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-medium text-slate-400">
                  Switch Suit Color (Updates Crew Manifest Live)
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_COLORS.map((c) => {
                    const claimedBy = state.players.find((p) => p.color === c.id);
                    const isMine = c.id === state.self.color;
                    const isTakenOther = Boolean(claimedBy && !isMine);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isTakenOther || colorBusy}
                        onClick={() => handleSwitchLobbyColor(c.id)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isMine
                            ? 'bg-cyan-500/20 border-cyan-400'
                            : isTakenOther
                              ? 'bg-slate-950/40 border-white/5 opacity-35 cursor-not-allowed'
                              : 'bg-slate-950/60 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <CrewmateAvatar color={c.id} size={28} />
                        <span className="text-[11px] font-medium text-slate-200 truncate w-full text-center">
                          {isMine ? 'You' : isTakenOther ? claimedBy?.name : c.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-medium text-slate-400">
                  Crewmates in Lobby ({state.players.length}/12)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {state.players.map((p, idx) => (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                    >
                      <CrewmateAvatar color={p.color} size={28} />
                      <span className="text-xs font-medium text-white truncate">{p.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  haptics.impact('light');
                  onLeaveSession();
                }}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-400"
              >
                Leave Lobby
              </button>
            </motion.div>
          )}

          {/* ACTIVE GAMEPLAY — PLAIN CREWMEMBER STEALTH HUD (IDENTICAL FOR ALL ROLES) */}
          {state.phase === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Neutral Crewmate Station Brief */}
              <div className="rounded-2xl p-4 border bg-[#151C28] border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400">Station Clearance</div>
                    <div className="font-display text-3xl font-bold tracking-wide text-emerald-400">
                      CREWMATE
                    </div>
                  </div>
                  {!state.self.alive && (
                    <span className="text-xs font-mono font-bold text-red-300 bg-red-500/20 px-2.5 py-1 rounded-lg">
                      GHOST MODE
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Scan Skeld Task QR codes around the area to complete assignments, scan fallen crewmates to report bodies, or scan Cafeteria EMRG for a meeting.
                </p>
              </div>

              {/* Active Sabotage Alert Banner */}
              <AnimatePresence>
                {state.activeSabotage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={`border-2 rounded-2xl p-4 space-y-3 ${
                      state.activeSabotage.kind === 'REACTOR' || state.activeSabotage.kind === 'O2'
                        ? 'bg-red-600/20 border-red-500 animate-pulse'
                        : 'bg-amber-500/15 border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {state.activeSabotage.kind === 'BLACKOUT' ? (
                        <ZapOff className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                      ) : state.activeSabotage.kind === 'SIGNAL_JAM' ? (
                        <Radio className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                      ) : state.activeSabotage.kind === 'REACTOR' ? (
                        <Flame className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      ) : (
                        <Wind className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`font-display text-2xl font-bold leading-none ${
                              state.activeSabotage.kind === 'REACTOR' ||
                              state.activeSabotage.kind === 'O2'
                                ? 'text-red-300'
                                : 'text-amber-200'
                            }`}
                          >
                            {state.activeSabotage.kind === 'BLACKOUT' && 'POWER BLACKOUT!'}
                            {state.activeSabotage.kind === 'SIGNAL_JAM' && 'COMMS SIGNAL JAM!'}
                            {state.activeSabotage.kind === 'REACTOR' && 'REACTOR MELTDOWN!'}
                            {state.activeSabotage.kind === 'O2' && 'O2 DEPLETION!'}
                          </div>
                          {(state.activeSabotage.kind === 'REACTOR' ||
                            state.activeSabotage.kind === 'O2') && (
                            <span className="font-mono text-lg font-bold text-white bg-red-600/60 px-2.5 py-0.5 rounded-lg tabular-nums">
                              {crisisLeftSec}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-100/90 mt-1.5 leading-relaxed">
                          {state.activeSabotage.kind === 'BLACKOUT' &&
                            `All regular tasks are disabled. Anyone alive can scan Fix Wiring${state.settings.hideManualCodes ? '' : ' (WIR1)'} in Electrical to restore power!`}
                          {state.activeSabotage.kind === 'SIGNAL_JAM' &&
                            `Emergency Meeting button is jammed for ${signalJamLeftSec}s. Body reports still work.`}
                          {state.activeSabotage.kind === 'REACTOR' &&
                            `Co-op Crisis: Complete Start Reactor${state.settings.hideManualCodes ? '' : ' (RCT9)'} AND Unlock Manifolds${state.settings.hideManualCodes ? '' : ' (MNF1)'} within 15s! (${(state.activeSabotage.clearedStations || []).length}/2 synced)`}
                          {state.activeSabotage.kind === 'O2' &&
                            `Co-op Crisis: Complete Clean O2 Filter${state.settings.hideManualCodes ? '' : ' (OXY6)'} AND Empty Chute${state.settings.hideManualCodes ? '' : ' (GRB3)'} within 15s! (${(state.activeSabotage.clearedStations || []).length}/2 synced)`}
                        </p>
                      </div>
                    </div>

                    {(state.activeSabotage.kind === 'BLACKOUT' ||
                      state.activeSabotage.kind === 'REACTOR' ||
                      state.activeSabotage.kind === 'O2') &&
                      state.self.alive && (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impact('medium');
                            setScannerMode('AUTO');
                          }}
                          className={`w-full min-h-[44px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                            state.activeSabotage.kind === 'BLACKOUT'
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                              : 'bg-red-500 hover:bg-red-400 text-white'
                          }`}
                        >
                          <QrCode className="w-4 h-4" />
                          <span>
                            {state.activeSabotage.kind === 'BLACKOUT'
                              ? 'Scan Fix Wiring QR to Restore Power'
                              : 'Scan Crisis Station QR Now'}
                          </span>
                        </button>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ghost Power Deck (Only visible when dead — never leaks roles while alive!) */}
              {!state.self.alive && (
                <div className="bg-[#12192A] border border-fuchsia-400/35 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-fuchsia-300" />
                      <span className="font-display text-xl font-bold text-white">
                        Ghost Power Deck
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
                      Energy {state.self.ghostEnergy}/100
                    </span>
                  </div>

                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, state.self.ghostEnergy)}%` }}
                    />
                  </div>

                  {isGuardian ? (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300">
                        Guardian Angel Ghost Shield (50 Energy · 35s protection):
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {state.players
                          .filter((p) => p.alive && p.playerId !== state.self.playerId)
                          .map((target) => (
                            <button
                              key={target.playerId}
                              type="button"
                              disabled={
                                shieldBusy ||
                                localShieldRemaining > 0 ||
                                state.self.ghostEnergy < 50
                              }
                              onClick={() => handleDeployShield(target.playerId)}
                              className="p-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-45 border border-cyan-400/40 flex items-center gap-2 text-left"
                            >
                              <CrewmateAvatar color={target.color} size={24} />
                              <span className="text-xs font-semibold text-white truncate">
                                {target.name}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300">
                        {isCrewTeam
                          ? 'Crew Ghost Beacon (40 Energy): Send an anonymous pulse to Admin Map & TV.'
                          : 'Phantom Sensor Flicker (45 Energy): Trigger a decoy ping on Admin Map & Security.'}
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={ghostRoom}
                          onChange={(e) => setGhostRoom(e.target.value)}
                          className="flex-1 min-h-[42px] px-3 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                        >
                          {SKELD_ROOMS.map((room) => (
                            <option key={room} value={room}>
                              {room}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            ghostBusy ||
                            state.self.ghostEnergy < (isCrewTeam ? 40 : 45)
                          }
                          onClick={() =>
                            handleUseGhostPower(isCrewTeam ? 'GHOST_PING' : 'GHOST_FLICKER')
                          }
                          className="min-h-[42px] px-3.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-45 text-slate-950 font-bold text-xs whitespace-nowrap"
                        >
                          {isCrewTeam ? 'Send Ping (40)' : 'Flicker (45)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Task List (Identical Label for All Roles) */}
              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-white">
                    Assigned Skeld Tasks
                  </h2>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {state.self.assignedTasks.filter((t) => t.completed).length}/
                    {state.self.assignedTasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {state.activeSabotage?.kind === 'BLACKOUT' &&
                    state.self.alive &&
                    !state.self.assignedTasks.some((t) => t.taskId === 'fix-wiring') && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl border-2 border-amber-400/70 bg-amber-500/15 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <SkeldTaskIconBadge taskId="fix-wiring" size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-amber-200">
                              Emergency Repair: Fix Wiring
                            </div>
                            <div className="text-xs text-amber-100/80 mt-0.5">
                              Electrical · Available to anyone alive during Blackout
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
                          REPAIR POWER
                        </span>
                      </motion.div>
                    )}

                  {state.self.assignedTasks.map((item, idx) => {
                    const def = getTaskDef(item.taskId);
                    const isBlackoutWiring =
                      state.activeSabotage?.kind === 'BLACKOUT' &&
                      state.self.alive &&
                      item.taskId === 'fix-wiring';
                    return (
                      <motion.div
                        key={item.taskId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isBlackoutWiring
                            ? 'bg-amber-500/15 border-amber-400/70'
                            : item.completed
                              ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70'
                              : 'bg-slate-950/60 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <SkeldTaskIconBadge taskId={item.taskId} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-white flex items-center gap-2">
                              <span
                                className={
                                  isBlackoutWiring
                                    ? 'text-amber-200'
                                    : item.completed
                                      ? 'line-through text-emerald-300'
                                      : ''
                                }
                              >
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
                        </div>

                        {isBlackoutWiring ? (
                          <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
                            {item.completed ? 'RE-SCAN TO RESTORE' : 'REPAIR POWER'}
                          </span>
                        ) : item.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="font-mono text-xs text-slate-400 shrink-0">
                            Scan QR
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

        {/* EMERGENCY MEETING & VOTING PHASE */}
        {state.phase === 'MEETING' && state.meeting && (
          <motion.div
            key="meeting"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="space-y-4"
          >
            <div className="bg-red-600/20 border-2 border-red-500 rounded-2xl p-4 text-center space-y-1.5">
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="flex items-center justify-center gap-2 text-red-400 font-display text-3xl font-bold"
              >
                <ShieldAlert className="w-7 h-7" />
                <span>EMERGENCY MEETING</span>
              </motion.div>
              <p className="text-sm text-white">
                {state.meeting.reason === 'BODY_REPORTED'
                  ? `${state.meeting.reporterName} found ${state.meeting.victimName} (${getColorDef(state.meeting.victimColor || 'red').label}) killed.`
                  : `${state.meeting.reporterName} called an Emergency Meeting!`}
              </p>

              {state.meeting.verdictMessage ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 py-3 px-4 rounded-xl bg-slate-950/85 border border-white/10 space-y-2"
                >
                  {state.meeting.ejectedPlayer && (
                    <div className="flex flex-col items-center gap-1.5">
                      <CrewmateAvatar
                        color={state.meeting.ejectedPlayer.color}
                        alive={false}
                        size={48}
                      />
                      {state.meeting.ejectedPlayer.playerId === state.self.playerId && (
                        <div className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
                          YOU WERE VOTED OUT &amp; KILLED — ENTERING GHOST MODE
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-amber-300 font-semibold text-sm">
                    {state.meeting.verdictMessage}
                  </div>
                </motion.div>
              ) : state.meeting.stage === 'GATHERING' ? (
                <div className="font-mono text-xs text-amber-300 tabular-nums pt-1">
                  HEAD TO MEETING TABLE · {state.meeting.arrivedCount} / {state.meeting.totalAliveCount} ALIVE HERE
                </div>
              ) : state.meeting.stage === 'DISCUSSION' ? (
                <div className="font-mono text-xs text-red-200 tabular-nums pt-1">
                  DISCUSSION PHASE · VOTING OPENS IN {discussionLeftSec}s
                </div>
              ) : state.meeting.stage === 'VOTING' && state.meeting.revealEndsAt ? (
                <div className="font-mono text-xs text-amber-300 font-bold tabular-nums pt-1">
                  ALL VOTES LOCKED · REVEALING RESULTS IN {revealLeftSec}s
                </div>
              ) : (
                <div className="font-mono text-xs text-red-200 tabular-nums pt-1">
                  VOTING OPEN · {votingLeftSec}s REMAINING
                </div>
              )}
            </div>

            {/* GATHERING CHECK-IN STAGE: Players tap HERE! when they reach the meeting table */}
            {state.meeting.stage === 'GATHERING' && (
              <div className="space-y-3">
                {state.self.alive ? (
                  !state.self.hasArrived ? (
                    <motion.button
                      type="button"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleMarkHere}
                      className="w-full min-h-[64px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-3xl font-bold tracking-wide shadow-lg"
                    >
                      HERE!
                    </motion.button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 text-center"
                    >
                      <div className="font-bold text-sm text-emerald-300">
                        You checked in as HERE!
                      </div>
                      <div className="text-xs text-emerald-100/80 mt-1">
                        Discussion starts automatically once all alive crewmates reach the table.
                      </div>
                    </motion.div>
                  )
                ) : (
                  <div className="bg-[#151C28] border border-white/10 rounded-xl p-3 text-center text-xs text-slate-400">
                    You are Dead. Waiting for alive players to gather at the table.
                  </div>
                )}

                <div className="space-y-2">
                  {state.players.map((p, idx) => (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
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
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* DISCUSSION, VOTING & VERDICT (WITH VOTE REVEAL) */}
            {state.meeting.stage !== 'GATHERING' && (
              <div className="space-y-2.5">
                {/* Vote Now bar during Discussion */}
                {state.meeting.stage === 'DISCUSSION' && state.self.alive && (
                  <div className="pb-1">
                    {!state.self.hasVotedNow ? (
                      <motion.button
                        type="button"
                        disabled={voteNowBusy}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVoteNow}
                        className="w-full min-h-[50px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-between gap-2 shadow-lg"
                      >
                        <span>Vote Now (Skip Discussion)</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950/15 tabular-nums">
                          {state.meeting.voteNowCount}/{state.meeting.totalAliveCount}
                        </span>
                      </motion.button>
                    ) : (
                      <div className="w-full px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2">
                        <span>Agreed to Vote Now — Waiting for remaining crew...</span>
                        <span className="font-mono font-bold tabular-nums">
                          {state.meeting.voteNowCount}/{state.meeting.totalAliveCount}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 3-Second Countdown Banner Once All Votes Are In */}
                {state.meeting.stage === 'VOTING' && state.meeting.revealEndsAt && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-red-500/20 to-amber-500/20 border-2 border-amber-400/80 p-4 text-center shadow-lg space-y-1.5"
                  >
                    <div className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
                      All Votes Locked
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-sm font-semibold text-white">
                        Revealing voting results in
                      </span>
                      <motion.span
                        key={revealLeftSec}
                        initial={{ scale: 1.45, opacity: 0.4 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-display text-2xl font-bold tabular-nums shadow"
                      >
                        {revealLeftSec}
                      </motion.span>
                    </div>
                  </motion.div>
                )}

                {state.players.map((p, idx) => {
                  const colorDef = getColorDef(p.color);
                  const canVoteTarget =
                    state.meeting?.stage === 'VOTING' &&
                    state.self.alive &&
                    !state.self.hasVoted &&
                    p.alive;
                  const votersForPlayer = state.meeting?.voteBreakdown?.byTarget[p.playerId] || [];

                  return (
                    <motion.button
                      key={p.playerId}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      whileTap={canVoteTarget ? { scale: 0.98 } : undefined}
                      disabled={!canVoteTarget}
                      onClick={() => handleCastVote(p.playerId)}
                      className={`w-full min-h-[58px] px-4 py-3 rounded-xl border flex flex-col gap-2 text-left ${
                        !p.alive
                          ? 'bg-red-950/20 border-red-500/20 opacity-65'
                          : canVoteTarget
                            ? 'bg-[#151C28] hover:bg-[#1E293B] border-white/15 cursor-pointer'
                            : 'bg-[#151C28] border-white/10 opacity-90'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between gap-3">
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
                          {state.meeting?.stage === 'DISCUSSION' && p.hasVotedNow ? (
                            <span className="px-2 py-1 rounded-md bg-amber-400/20 text-amber-300 font-bold">
                              VOTE NOW
                            </span>
                          ) : state.meeting?.stage === 'VOTING' && p.hasVoted ? (
                            <span className="text-emerald-400 font-bold">I VOTED</span>
                          ) : canVoteTarget ? (
                            <span className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold">
                              Vote
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Smaller voter icons shown in real time below target icon during Voting & Verdict */}
                      {votersForPlayer.length > 0 && (
                        <div
                          className="w-full pt-2 border-t border-white/10 flex items-center flex-wrap gap-1.5"
                          aria-label={
                            state.settings.anonymousVotes
                              ? `Anonymous votes for ${p.name}: ${votersForPlayer.length}`
                              : `Votes for ${p.name}: ${votersForPlayer.map((v) => v.name).join(', ')}`
                          }
                        >
                          {votersForPlayer.map((voter) =>
                            state.settings.anonymousVotes ? (
                              <span
                                key={voter.playerId}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 border border-white/15 text-[10px] font-mono text-slate-300"
                              >
                                Anon
                              </span>
                            ) : (
                              <motion.span
                                key={voter.playerId}
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                                title={`${voter.name} (${getColorDef(voter.color).label})`}
                                className="inline-flex items-center justify-center rounded-full bg-slate-950/85 border border-white/15 p-1"
                              >
                                <CrewmateAvatar color={voter.color} size={22} />
                              </motion.span>
                            ),
                          )}
                        </div>
                      )}
                    </motion.button>
                  );
                })}

                {/* Skip Vote button & real-time skipper icons during VOTING and VERDICT */}
                {state.meeting.stage === 'VOTING' && state.self.alive && !state.self.hasVoted ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCastVote('SKIP')}
                    className="w-full min-h-[50px] px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-white font-bold text-sm flex flex-col gap-2 text-left"
                  >
                    <div className="w-full flex items-center justify-between">
                      <span>Skip Vote</span>
                      <span className="text-xs font-normal text-slate-300">Do not eject anyone</span>
                    </div>
                    {(state.meeting.voteBreakdown?.skipped.length || 0) > 0 && (
                      <div className="w-full pt-2 border-t border-white/10 flex items-center flex-wrap gap-1.5">
                        {state.meeting.voteBreakdown!.skipped.map((voter) =>
                          state.settings.anonymousVotes ? (
                            <span
                              key={voter.playerId}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 border border-white/15 text-[10px] font-mono text-slate-300"
                            >
                              Anon
                            </span>
                          ) : (
                            <motion.span
                              key={voter.playerId}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                              title={`${voter.name} (${getColorDef(voter.color).label})`}
                              className="inline-flex items-center justify-center rounded-full bg-slate-950/85 border border-white/15 p-1"
                            >
                              <CrewmateAvatar color={voter.color} size={22} />
                            </motion.span>
                          ),
                        )}
                      </div>
                    )}
                  </motion.button>
                ) : (state.meeting.stage === 'VOTING' || state.meeting.stage === 'VERDICT') &&
                  state.meeting.voteBreakdown ? (
                  <div className="px-4 py-3 rounded-xl bg-[#151C28] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Skipped Votes</span>
                      <span className="font-mono text-slate-400">
                        {state.meeting.voteBreakdown.skipped.length}
                      </span>
                    </div>
                    {state.meeting.voteBreakdown.skipped.length > 0 ? (
                      <div className="flex items-center flex-wrap gap-1.5">
                        {state.meeting.voteBreakdown.skipped.map((voter) =>
                          state.settings.anonymousVotes ? (
                            <span
                              key={voter.playerId}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 border border-white/15 text-[10px] font-mono text-slate-300"
                            >
                              Anon
                            </span>
                          ) : (
                            <motion.span
                              key={voter.playerId}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                              title={`${voter.name} (${getColorDef(voter.color).label})`}
                              className="inline-flex items-center justify-center rounded-full bg-slate-950/85 border border-white/15 p-1"
                            >
                              <CrewmateAvatar color={voter.color} size={22} />
                            </motion.span>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">No crewmates skipped.</div>
                    )}
                  </div>
                ) : null}

                {state.meeting.stage === 'VOTING' && state.self.hasVoted && !state.meeting.revealEndsAt && (
                  <div className="text-center text-xs font-mono text-emerald-400 py-2">
                    Vote locked. Waiting for remaining alive crewmates...
                  </div>
                )}

                {!state.self.alive && state.meeting.stage !== 'VERDICT' && (
                  <div className="text-center text-xs text-slate-400 py-2">
                    You are a Ghost. Observe the meeting silently without voting.
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* VICTORY / GAME OVER SCREEN (FLASHY WIN vs DREARY LOSE BY TEAM) */}
        {state.phase === 'ENDED' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="space-y-4 pt-2"
          >
            {didPlayerWin ? (
              <div
                className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center border-2 shadow-2xl ${
                  state.winner === 'CREWMATES'
                    ? 'bg-gradient-to-br from-emerald-950/90 via-cyan-950/75 to-amber-950/50 border-amber-300/80 shadow-[0_0_55px_rgba(16,185,129,0.35)]'
                    : 'bg-gradient-to-br from-red-950/95 via-rose-950/80 to-amber-950/60 border-amber-400/85 shadow-[0_0_55px_rgba(239,68,68,0.4)]'
                }`}
              >
                {/* Sweeping celebratory sheen */}
                <motion.div
                  aria-hidden="true"
                  animate={{ x: ['-130%', '220%'] }}
                  transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                />

                {/* Animated confetti sparks */}
                {[
                  { left: '10%', top: '14%', color: '#FBBF24', delay: 0 },
                  { left: '24%', top: '76%', color: '#38BDF8', delay: 0.3 },
                  { left: '48%', top: '10%', color: '#34D399', delay: 0.6 },
                  { left: '76%', top: '18%', color: '#F472B6', delay: 0.2 },
                  { left: '88%', top: '70%', color: '#FBBF24', delay: 0.5 },
                  { left: '62%', top: '82%', color: '#22D3EE', delay: 0.8 },
                ].map((spark, idx) => (
                  <motion.span
                    key={idx}
                    aria-hidden="true"
                    animate={{
                      y: [0, -14, 0],
                      scale: [0.85, 1.35, 0.85],
                      opacity: [0.4, 1, 0.4],
                      rotate: [0, 180, 360],
                    }}
                    transition={{
                      duration: 2.1 + idx * 0.2,
                      delay: spark.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      left: spark.left,
                      top: spark.top,
                      backgroundColor: spark.color,
                    }}
                    className="pointer-events-none absolute w-2.5 h-2.5 rounded-sm shadow-[0_0_12px_currentColor]"
                  />
                ))}

                <div className="relative z-10 space-y-4">
                  <motion.div
                    animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-300/80 text-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.45)] mx-auto"
                  >
                    <Trophy className="w-8 h-8" />
                  </motion.div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {state.winner === 'JESTER'
                          ? 'JESTER SOLO VICTORY'
                          : state.winner === 'IMPOSTORS'
                            ? 'IMPOSTORS PREVAIL'
                            : isInvestigator
                              ? 'INVESTIGATOR & CREW VICTORY'
                              : 'CREWMATES VICTORY'}
                      </span>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <h1
                      className={`font-display text-6xl font-bold tracking-wider mt-1 drop-shadow-[0_4px_20px_rgba(255,255,255,0.28)] ${
                        state.winner === 'JESTER'
                          ? 'bg-gradient-to-r from-fuchsia-200 via-amber-200 to-pink-200 bg-clip-text text-transparent'
                          : state.winner === 'CREWMATES'
                            ? 'bg-gradient-to-r from-emerald-200 via-amber-200 to-cyan-200 bg-clip-text text-transparent'
                            : 'bg-gradient-to-r from-red-200 via-amber-200 to-rose-200 bg-clip-text text-transparent'
                      }`}
                    >
                      VICTORY
                    </h1>
                  </div>

                  {/* Celebrating Winning Team Avatars */}
                  <div className="flex items-center justify-center flex-wrap gap-3 py-1">
                    {state.players
                      .filter((p) => {
                        if (state.winner === 'JESTER') {
                          return p.revealedRole === 'JESTER';
                        }
                        const pImp =
                          p.revealedRole === 'IMPOSTOR' || p.revealedRole === 'SHAPESHIFTER';
                        const pJes = p.revealedRole === 'JESTER';
                        return state.winner === 'IMPOSTORS' ? pImp : !pImp && !pJes;
                      })
                      .map((winnerPlayer, idx) => (
                        <motion.div
                          key={winnerPlayer.playerId}
                          animate={{ y: [0, -8, 0] }}
                          transition={{
                            duration: 1.2,
                            delay: idx * 0.14,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="flex flex-col items-center gap-1"
                        >
                          <CrewmateAvatar color={winnerPlayer.color} alive size={46} />
                          <span className="text-[11px] font-semibold text-white/90 max-w-[68px] truncate">
                            {winnerPlayer.name}
                          </span>
                        </motion.div>
                      ))}
                  </div>

                  <p className="text-sm font-medium text-white/90 max-w-md mx-auto">
                    {state.winReason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center border border-slate-700/70 bg-gradient-to-b from-[#13161E] via-[#0D0F15] to-[#08090D] shadow-2xl">
                {/* Dreary falling ash / rain streaks */}
                {[
                  { left: '12%', delay: 0, dur: 3.4 },
                  { left: '28%', delay: 0.9, dur: 4.1 },
                  { left: '46%', delay: 0.4, dur: 3.7 },
                  { left: '64%', delay: 1.3, dur: 4.3 },
                  { left: '82%', delay: 0.7, dur: 3.5 },
                  { left: '91%', delay: 1.8, dur: 4.0 },
                ].map((streak, idx) => (
                  <motion.span
                    key={idx}
                    aria-hidden="true"
                    animate={{ y: [-30, 260], opacity: [0, 0.25, 0] }}
                    transition={{
                      duration: streak.dur,
                      delay: streak.delay,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    style={{ left: streak.left }}
                    className="pointer-events-none absolute top-0 w-px h-10 bg-gradient-to-b from-transparent via-slate-400/50 to-transparent"
                  />
                ))}

                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center gap-2 text-slate-500 font-mono text-xs uppercase tracking-[0.24em]">
                    <CloudRain className="w-4 h-4 text-slate-500" />
                    <span>
                      {state.winner === 'JESTER'
                        ? 'THE JESTER OUTSMARTED EVERYONE'
                        : state.winner === 'IMPOSTORS'
                          ? isInvestigator
                            ? 'INVESTIGATOR & CREW DEFEATED'
                            : 'CREWMATES DEFEATED'
                          : 'IMPOSTORS DEFEATED'}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="relative grayscale-[45%] brightness-75 opacity-80">
                      <CrewmateAvatar
                        color={state.self.color}
                        alive={false}
                        ghost
                        size={74}
                      />
                    </div>
                    <h1 className="font-display text-6xl font-bold tracking-widest text-slate-400/90">
                      DEFEAT
                    </h1>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-slate-800 text-xs font-mono text-red-400/80">
                    <Skull className="w-3.5 h-3.5" />
                    <span>
                      {state.winner === 'JESTER'
                        ? 'THE JESTER WAS VOTED OUT'
                        : state.winner === 'IMPOSTORS'
                          ? 'IMPOSTORS TOOK CONTROL OF THE SKELD'
                          : 'CREWMATES OUTLASTED THE SABOTAGE'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                    {state.winReason}
                  </p>
                </div>
              </div>
            )}

            {/* Match Awards */}
            {state.awards && state.awards.length > 0 && (
              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Award className="w-4 h-4" />
                  <span>Match Awards</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.awards.map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 flex items-center gap-2.5"
                    >
                      <CrewmateAvatar color={a.playerColor} size={30} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-200 truncate">
                          {a.title} · {a.playerName}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">{a.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-Game Timeline */}
            {state.timeline && state.timeline.length > 0 && (
              <div className="bg-[#151C28] border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <Clock className="w-4 h-4" />
                  <span>Mission Timeline</span>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {state.timeline.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/5 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{ev.title}</div>
                        {ev.detail && <div className="text-[11px] text-slate-400">{ev.detail}</div>}
                      </div>
                      <span className="font-mono text-[10px] text-cyan-300 shrink-0 tabular-nums">
                        +{ev.elapsedSec}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`rounded-2xl p-4 space-y-2.5 border ${
                didPlayerWin
                  ? 'bg-[#151C28] border-white/15'
                  : 'bg-[#0F1218] border-slate-800/80 opacity-85'
              }`}
            >
              <div className="text-xs font-semibold text-slate-400">Final Crew Debrief</div>
              {state.players.map((p, idx) => (
                <motion.div
                  key={p.playerId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    didPlayerWin
                      ? 'bg-slate-950/60 border-white/5'
                      : 'bg-black/40 border-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={didPlayerWin ? '' : 'grayscale-[30%] opacity-80'}>
                      <CrewmateAvatar color={p.color} alive={p.alive} size={32} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">{getColorDef(p.color).label}</div>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      p.revealedRole === 'IMPOSTOR' || p.revealedRole === 'SHAPESHIFTER'
                        ? 'text-red-400'
                        : p.revealedRole === 'JESTER'
                          ? 'text-fuchsia-400'
                          : p.revealedRole === 'SHERIFF'
                            ? 'text-amber-300'
                            : p.revealedRole === 'INVESTIGATOR' || p.revealedRole === 'GUARDIAN_ANGEL'
                              ? 'text-cyan-300'
                              : 'text-emerald-400'
                    }`}
                  >
                    {p.revealedRole === 'GUARDIAN_ANGEL' ? 'GUARDIAN ANGEL' : p.revealedRole}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* IDENTICAL BOTTOM THUMB-ZONE ACTION BAR FOR ALL ROLES */}
      {state.phase === 'PLAYING' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F1520]/95 backdrop-blur-md border-t border-white/10 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <div className="max-w-xl mx-auto flex gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptics.impact('medium');
                setScannerMode('AUTO');
              }}
              className="flex-1 min-h-[50px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
            >
              <QrCode className="w-5 h-5" />
              <span>Scan QR</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                soundEngine.playClick();
                haptics.impact('light');
                setTerminalUnlocked(false);
                setShowTerminal(true);
              }}
              className="min-w-[132px] min-h-[50px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Terminal className="w-5 h-5 text-slate-300" />
              <span>Terminal</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* START-OF-GAME ROLE REVEAL SPLASH SCREEN */}
      <AnimatePresence>
        {showRoleSplash && state.phase === 'PLAYING' && (
          <RoleSplashModal
            secretRole={state.self.secretRole}
            selfName={state.self.name}
            selfColor={state.self.color}
            teammates={state.self.teammates}
            onDismiss={() => setShowRoleSplash(false)}
          />
        )}
      </AnimatePresence>

      {/* PRIVATE PERSONAL TERMINAL MODAL (PRIVACY LOCKED BY DEFAULT) */}
      <AnimatePresence>
        {showTerminal && state.phase === 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center pt-[env(safe-area-inset-top)] sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] sm:max-h-[92dvh] overflow-y-auto bg-[#151C28] border border-white/15 rounded-t-3xl sm:rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0F1520]">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white leading-none">
                      Personal Ship Terminal
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Shield screen before unlocking private clearance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptics.impact('light');
                    setTerminalUnlocked(false);
                    setShowTerminal(false);
                  }}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
                  aria-label="Close terminal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
                {!terminalUnlocked ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center">
                      <Lock className="w-7 h-7 text-cyan-300" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-display text-2xl font-bold text-white">
                        Privacy Lock Engaged
                      </div>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Make sure no nearby player can see your screen before unlocking your private role tools, cooldowns, and sabotages.
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        soundEngine.playClick();
                        haptics.impact('medium');
                        setTerminalUnlocked(true);
                      }}
                      className="w-full min-h-[50px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Unlock Private Clearance</span>
                    </motion.button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div
                      className={`p-4 rounded-xl border ${
                        isImpostorTeam
                          ? 'bg-red-950/35 border-red-500/40'
                          : isSheriff
                            ? 'bg-amber-950/35 border-amber-500/40'
                            : isJester
                              ? 'bg-fuchsia-950/35 border-fuchsia-500/40'
                              : isInvestigator || isGuardian
                                ? 'bg-cyan-950/35 border-cyan-500/40'
                                : 'bg-emerald-950/25 border-emerald-500/35'
                      }`}
                    >
                      <div className="text-xs text-slate-400">Private Role</div>
                      <div
                        className={`font-display text-3xl font-bold ${
                          isImpostorTeam
                            ? 'text-red-400'
                            : isSheriff
                              ? 'text-amber-400'
                              : isJester
                                ? 'text-fuchsia-400'
                                : isInvestigator || isGuardian
                                  ? 'text-cyan-300'
                                  : 'text-emerald-400'
                        }`}
                      >
                        {state.self.secretRole === 'GUARDIAN_ANGEL'
                          ? 'GUARDIAN ANGEL'
                          : state.self.secretRole}
                      </div>

                      {state.self.teammates.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-500/20 text-xs text-red-200">
                          Partner:{' '}
                          {state.self.teammates
                            .map((t) => `${t.name} (${getColorDef(t.color).label} · ${t.role})`)
                            .join(', ')}
                        </div>
                      )}
                    </div>

                    {isImpostorTeam && state.self.alive && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
                          <span className="text-xs text-slate-300">Kill QR Module</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              localKillRemaining > 0 ? 'text-amber-300' : 'text-red-400'
                            }`}
                          >
                            {localKillRemaining > 0
                              ? `Recharging (${localKillRemaining}s)`
                              : 'Ready — Use Scan QR on Crewmate'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
                          <span className="text-xs text-slate-300">Airlock Vent Relay (VNT3)</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              localVentRemaining > 0 ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {localVentRemaining > 0
                              ? `Cooling (${localVentRemaining}s)`
                              : 'Ready — Scan VNT3 (-6s Cooldown)'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-red-300">Sabotage Systems</span>
                            <span className="font-mono text-slate-400 tabular-nums">
                              {state.activeSabotage
                                ? 'Active'
                                : localSabotageRemaining > 0
                                  ? `Cooldown ${localSabotageRemaining}s`
                                  : 'Ready'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              disabled={
                                sabotageBusy ||
                                Boolean(state.activeSabotage) ||
                                localSabotageRemaining > 0
                              }
                              onClick={() => {
                                handleTriggerSabotage('BLACKOUT');
                                setTerminalUnlocked(false);
                                setShowTerminal(false);
                              }}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-45 border border-amber-400/40 text-amber-200 font-semibold text-xs flex items-center justify-center gap-2"
                            >
                              <ZapOff className="w-4 h-4 shrink-0" />
                              <span>Kill Power</span>
                            </button>
                            <button
                              type="button"
                              disabled={
                                sabotageBusy ||
                                Boolean(state.activeSabotage) ||
                                localSabotageRemaining > 0
                              }
                              onClick={() => {
                                handleTriggerSabotage('SIGNAL_JAM');
                                setTerminalUnlocked(false);
                                setShowTerminal(false);
                              }}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 disabled:opacity-45 border border-red-400/40 text-red-200 font-semibold text-xs flex items-center justify-center gap-2"
                            >
                              <Radio className="w-4 h-4 shrink-0" />
                              <span>Signal Jam (60s)</span>
                            </button>
                            <button
                              type="button"
                              disabled={
                                sabotageBusy ||
                                Boolean(state.activeSabotage) ||
                                localSabotageRemaining > 0
                              }
                              onClick={() => {
                                handleTriggerSabotage('REACTOR');
                                setTerminalUnlocked(false);
                                setShowTerminal(false);
                              }}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 disabled:opacity-45 border border-rose-400/50 text-rose-200 font-semibold text-xs flex items-center justify-center gap-2"
                            >
                              <Flame className="w-4 h-4 shrink-0" />
                              <span>Reactor Crisis</span>
                            </button>
                            <button
                              type="button"
                              disabled={
                                sabotageBusy ||
                                Boolean(state.activeSabotage) ||
                                localSabotageRemaining > 0
                              }
                              onClick={() => {
                                handleTriggerSabotage('O2');
                                setTerminalUnlocked(false);
                                setShowTerminal(false);
                              }}
                              className="min-h-[48px] px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-45 border border-cyan-400/40 text-cyan-200 font-semibold text-xs flex items-center justify-center gap-2"
                            >
                              <Wind className="w-4 h-4 shrink-0" />
                              <span>O2 Depletion</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isSheriff && state.self.alive && (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-between">
                          <span className="text-xs text-slate-300">Justice Scan</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              localScanRemaining > 0 ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {localScanRemaining > 0
                              ? `Recharging (${localScanRemaining}s)`
                              : 'Ready — Use Scan QR on Suspect'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 border border-white/5 rounded-xl p-3">
                          Scanning an Impostor eliminates them immediately. Misfiring on an innocent Crewmate or Jester eliminates YOU instead.
                        </p>
                      </div>
                    )}

                    {isGuardian && state.self.alive && (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/30 flex items-center justify-between">
                          <span className="text-xs text-slate-300">Aegis Shield (35s)</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              localShieldRemaining > 0 ? 'text-amber-300' : 'text-cyan-300'
                            }`}
                          >
                            {localShieldRemaining > 0
                              ? `Recharging (${localShieldRemaining}s)`
                              : 'Ready — Select Ally Below'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {state.players
                            .filter((p) => p.alive && p.playerId !== state.self.playerId)
                            .map((ally) => (
                              <button
                                key={ally.playerId}
                                type="button"
                                disabled={shieldBusy || localShieldRemaining > 0}
                                onClick={() => handleDeployShield(ally.playerId)}
                                className="p-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-45 border border-cyan-400/40 flex items-center gap-2 text-left"
                              >
                                <CrewmateAvatar color={ally.color} size={26} />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">
                                    {ally.name}
                                  </div>
                                  <div className="text-[10px] text-cyan-300 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    <span>Shield</span>
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {isJester && state.self.alive && (
                      <div className="p-3 rounded-xl bg-fuchsia-950/35 border border-fuchsia-400/30 text-xs text-fuchsia-200 leading-relaxed">
                        You are The Jester (Neutral Solo). Fake tasks and act suspicious—if the crew votes to eject you in a meeting, YOU win immediately!
                      </div>
                    )}

                    {isInvestigator && state.self.alive && (
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
                        <span className="text-xs text-slate-300">Forensic Scanner</span>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            localScanRemaining > 0 ? 'text-amber-300' : 'text-cyan-300'
                          }`}
                        >
                          {localScanRemaining > 0
                            ? `Recharging (${localScanRemaining}s)`
                            : 'Ready — Use Scan QR on Player'}
                        </span>
                      </div>
                    )}

                    {state.self.secretRole === 'CREWMATE' && (
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-300 leading-relaxed">
                        You are a Crewmate. Finish your assigned tasks and report any dead bodies using Scan QR.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        haptics.impact('light');
                        setTerminalUnlocked(false);
                        setShowTerminal(false);
                      }}
                      className="w-full min-h-[46px] rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lock &amp; Hide Screen</span>
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR SCANNER MODAL */}
      <AnimatePresence>
        {scannerMode && (
          <QrScannerModal
            title="Skeld QR Scanner"
            subtitle={
              state.settings.hideManualCodes
                ? 'Scan a physical Task QR, Player back badge, or Cafeteria button.'
                : 'Scan any Task QR, Player back badge, or Cafeteria EMRG button.'
            }
            accentColor="emerald"
            hideManualCodes={Boolean(state.settings.hideManualCodes)}
            onDetected={handleQrDetected}
            onClose={() => setScannerMode(null)}
          />
        )}
      </AnimatePresence>

      {/* SKELD TASK MINI-GAME MODAL */}
      <AnimatePresence>
        {activeTask && (
          <SkeldTaskModal
            task={activeTask}
            isBlackoutRepair={
              activeTask.id === 'fix-wiring' && state.activeSabotage?.kind === 'BLACKOUT'
            }
            isImpostor={isImpostorTeam}
            onComplete={handleTaskComplete}
            onClose={() => setActiveTask(null)}
          />
        )}
      </AnimatePresence>

      {/* INVESTIGATOR FORENSIC SCAN RESULT MODAL */}
      <AnimatePresence>
        {forensicResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] overflow-y-auto bg-[#151C28] border-2 border-cyan-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-center gap-2 text-cyan-300 font-mono text-xs font-bold">
                <Eye className="w-4 h-4" />
                <span>FORENSIC SCAN RESULT</span>
              </div>

              <CrewmateAvatar color={forensicResult.targetColor} size={86} animate className="mx-auto" />

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
                onClick={() => {
                  haptics.impact('light');
                  setForensicResult(null);
                }}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm"
              >
                Close Readout
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DEAD BODY FOUND — CALL EMERGENCY MEETING PROMPT */}
      <AnimatePresence>
        {deadBodyFound && state.phase === 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] overflow-y-auto bg-[#1B0D12] border-2 border-red-500 rounded-2xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-center gap-2 text-red-400 font-mono text-xs font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>DEAD BODY FOUND</span>
              </div>

              <CrewmateAvatar color={deadBodyFound.victimColor} alive={false} size={86} className="mx-auto" />

              <div>
                <div className="font-display text-3xl font-bold text-white">
                  {deadBodyFound.victimName}
                </div>
                <div className="text-sm text-slate-300 mt-0.5">
                  Suit Color:{' '}
                  <span className="font-bold text-white">
                    {getColorDef(deadBodyFound.victimColor).label}
                  </span>{' '}
                  · Eliminated
                </div>
              </div>

              <motion.button
                type="button"
                disabled={reportingBody}
                whileTap={{ scale: 0.97 }}
                onClick={handleReportDeadBody}
                className="w-full min-h-[54px] py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-display text-2xl font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg"
              >
                <ShieldAlert className="w-5 h-5" />
                <span>{reportingBody ? 'CALLING MEETING...' : 'CALL EMERGENCY MEETING'}</span>
              </motion.button>

              <button
                type="button"
                disabled={reportingBody}
                onClick={() => {
                  haptics.impact('light');
                  setDeadBodyFound(null);
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs"
              >
                Dismiss (Do Not Report)
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YOU HAVE BEEN KILLED FULL-SCREEN ALERT */}
      <AnimatePresence>
        {showKilledModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1B0609]/95 backdrop-blur-md flex items-center justify-center pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] px-5"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -3, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2.5rem)] overflow-y-auto bg-[#24090D] border-2 border-red-500 rounded-2xl p-6 text-center space-y-5 shadow-2xl"
            >
              {/* Cracked Visor + Skull Vector Emblem */}
              <motion.svg
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                width="92"
                height="92"
                viewBox="0 0 96 96"
                fill="none"
                className="mx-auto"
              >
                <circle cx="48" cy="48" r="44" fill="#7F1D1D" stroke="#EF4444" strokeWidth="4" />
                <path
                  d="M28 45C28 32 37 24 48 24C59 24 68 32 68 45C68 54 62 60 58 62V70H38V62C34 60 28 54 28 45Z"
                  fill="#FEE2E2"
                />
                <circle cx="40" cy="45" r="5" fill="#7F1D1D" />
                <circle cx="56" cy="45" r="5" fill="#7F1D1D" />
                <path d="M22 26L74 70" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" />
              </motion.svg>

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
                onClick={() => {
                  haptics.impact('light');
                  setShowKilledModal(false);
                }}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
              >
                Enter Ghost Mode
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STATION TERMINAL MODAL (12-SECOND ADMIN MAP TABLE / SECURITY FEED) */}
      <AnimatePresence>
        {stationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] overflow-y-auto bg-[#151C28] border-2 border-cyan-400/70 rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold">
                  {stationModal.kind === 'ADMIN_MAP' ? (
                    <MapIcon className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  <span>
                    {stationModal.kind === 'ADMIN_MAP'
                      ? 'ADMIN MAP TABLE · LIVE RADAR'
                      : 'SECURITY TERMINAL · CAM LOGS'}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                  {Math.max(0, Math.ceil((stationModal.expiresAt - nowMs) / 1000))}s
                </span>
              </div>

              {stationModal.kind === 'ADMIN_MAP' ? (
                <div className="grid grid-cols-2 gap-2">
                  {SKELD_ROOMS.map((room) => {
                    const count = stationModal.roomActivity[room] || 0;
                    return (
                      <div
                        key={room}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between ${
                          count > 0
                            ? 'bg-emerald-950/50 border-emerald-400/50 text-white'
                            : 'bg-slate-950/60 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold truncate">{room}</span>
                        <span
                          className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded tabular-nums ${
                            count > 0 ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stationModal.feed.length === 0 ? (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No recent camera or visual alerts recorded.
                    </div>
                  ) : (
                    stationModal.feed.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs"
                      >
                        <div className="font-semibold text-white">{ev.label}</div>
                        <div className="text-[11px] font-mono text-cyan-300 mt-0.5">{ev.room}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setStationModal(null)}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Close Readout
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
