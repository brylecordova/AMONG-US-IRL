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
  LogOut,
  QrCode,
  Radio,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Terminal,
  Trophy,
  Unlock,
  Video,
  Volume2,
  VolumeX,
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
  REACTOR_OVERRIDE_SHORT_CODE,
  SabotageKind,
  SkeldTaskDef,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { SkeldTaskIconBadge } from './PrintedQrCards';
import { QrScannerModal, QrScanValidationResult } from './QrScannerModal';
import { RoleSplashModal } from './RoleSplashModal';
import { SecurityMonitorModal } from './SecurityMonitorModal';
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
  crewPresenceEvent?: {
    seq: number;
    kind: 'LEFT' | 'REJOINED';
    playerId: string;
    playerName: string;
    playerColor: PlayerColorId;
    phase?: string;
  } | null;
  androidLeaveTrigger?: number;
  securityWatcherCount: number;
  securityLatestFrame: { targetPlayerId: string; imageBase64: string; ts: number } | null;
  securityTargetStatus: {
    targetPlayerId: string;
    busy: boolean;
    offline: boolean;
    lostReason: string | null;
  } | null;
  securityJammed: boolean;
  securityForceClosedSeq: number;
  securityErrorEvent?: { seq: number; message: string } | null;
  onSendWsMessage: (msg: Record<string, unknown>) => void;
  onScannerOpenChange?: (open: boolean) => void;
  onClearSecurityFeedState: () => void;
  onUpdateState: (next: ClientGameState) => void;
  onBeginEjectLeave?: () => void;
  onLeaveSession: () => void;
}

type ScanMode = 'AUTO' | 'KILL' | 'INVESTIGATE' | 'SHERIFF';

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
  sabotageAlertTrigger,
  missionStartedTrigger,
  shieldBlockedEvent,
  sheriffActionEvent,
  crewPresenceEvent,
  androidLeaveTrigger,
  securityWatcherCount,
  securityLatestFrame,
  securityTargetStatus,
  securityJammed,
  securityForceClosedSeq,
  securityErrorEvent,
  onSendWsMessage,
  onScannerOpenChange,
  onClearSecurityFeedState,
  onUpdateState,
  onBeginEjectLeave,
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
  const [showReactorHoldModal, setShowReactorHoldModal] = useState(false);
  const [showReactorArmedModal, setShowReactorArmedModal] = useState(false);
  const [holdingReactor, setHoldingReactor] = useState(false);
  const [showSecurityMonitor, setShowSecurityMonitor] = useState(false);
  const [selectedSecurityTargetId, setSelectedSecurityTargetId] = useState<string | null>(null);
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
  const [sabotageBusy, setSabotageBusy] = useState(false);
  const [shieldBusy, setShieldBusy] = useState(false);
  const [reactorActionBusy, setReactorActionBusy] = useState(false);
  const [colorBusy, setColorBusy] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [ejectingLeave, setEjectingLeave] = useState(false);
  const [activePresenceAlert, setActivePresenceAlert] = useState<{
    seq: number;
    kind: 'LEFT' | 'REJOINED';
    playerId: string;
    playerName: string;
    playerColor: PlayerColorId;
    phase?: string;
  } | null>(null);
  const prevPhaseRef = useRef(state.phase);
  const roleSplashShownRef = useRef(false);
  const lastVisualAlertIdRef = useRef<string | null>(null);
  const lastPresenceSeqRef = useRef<number>(0);
  const presenceTimerRef = useRef<number | null>(null);
  const ejectTriggeredRef = useRef(false);
  const ejectTimerRef = useRef<number | null>(null);
  const serverSkewMsRef = useRef(state.serverTime - Date.now());
  const holdingReactorRef = useRef(false);
  const prevReactorActiveRef = useRef(state.activeSabotage?.kind === 'REACTOR');
  const prevShieldedRef = useRef(false);

  // Sync cooldowns & clock offset from server snapshot and tick smoothly
  useEffect(() => {
    serverSkewMsRef.current = state.serverTime - Date.now();
    setLocalKillRemaining(state.self.killCooldownRemainingSec);
    setLocalScanRemaining(state.self.scanCooldownRemainingSec);
    setLocalSabotageRemaining(state.self.sabotageCooldownRemainingSec ?? 0);
    setLocalShieldRemaining(state.self.shieldCooldownRemainingSec ?? 0);
  }, [
    state.self.killCooldownRemainingSec,
    state.self.scanCooldownRemainingSec,
    state.self.sabotageCooldownRemainingSec,
    state.self.shieldCooldownRemainingSec,
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
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const reactorNeedsFastTick =
      state.phase === 'PLAYING' && state.activeSabotage?.kind === 'REACTOR';
    const shieldNeedsFastTick =
      state.phase === 'PLAYING' && state.self.alive && state.self.shieldedUntil > 0;
    const meetingNeedsFastTick = state.phase === 'MEETING' && Boolean(state.meeting?.revealEndsAt);
    if (!reactorNeedsFastTick && !shieldNeedsFastTick && !meetingNeedsFastTick) return;
    setNowMs(Date.now());
    const fastTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => clearInterval(fastTimer);
  }, [
    state.phase,
    state.self.alive,
    state.self.shieldedUntil,
    state.meeting?.revealEndsAt,
    state.activeSabotage?.kind,
  ]);

  const sendReactorHold = async (holding: boolean) => {
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/reactor/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ holding }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.state) {
        onUpdateState(data.state);
      }
      if (data.stabilized) {
        holdingReactorRef.current = false;
        setHoldingReactor(false);
        setShowReactorHoldModal(false);
        soundEngine.playTaskSuccess();
        haptics.notify('success');
      }
    } catch {
      // Heartbeat / release error ignored; server TTL auto-releases stale holds
    }
  };

  // Close & release Reactor Hold modal when meltdown clears, phase changes, or player dies
  useEffect(() => {
    const isReactorActive =
      state.phase === 'PLAYING' && state.activeSabotage?.kind === 'REACTOR';
    if (prevReactorActiveRef.current && !isReactorActive && state.phase === 'PLAYING') {
      soundEngine.playTaskSuccess();
      haptics.notify('success');
      setToastMsg('Reactor Meltdown stabilized!');
    }
    prevReactorActiveRef.current = isReactorActive;

    if (!isReactorActive || !state.self.alive) {
      if (holdingReactorRef.current) {
        holdingReactorRef.current = false;
        setHoldingReactor(false);
      }
      setShowReactorHoldModal(false);
    }
  }, [state.phase, state.activeSabotage?.kind, state.self.alive]);

  // Heartbeat & exact 5s completion trigger while player is holding Reactor Override
  useEffect(() => {
    if (!holdingReactor || !showReactorHoldModal || state.activeSabotage?.kind !== 'REACTOR') {
      return;
    }
    const heartbeat = setInterval(() => {
      void sendReactorHold(true);
    }, 750);

    let completionTimer: ReturnType<typeof setTimeout> | null = null;
    if (state.activeSabotage.dualHoldStartedAt) {
      const effectiveNow = Date.now() + serverSkewMsRef.current;
      const remainingMs = Math.max(
        60,
        state.activeSabotage.dualHoldStartedAt + 5050 - effectiveNow,
      );
      completionTimer = setTimeout(() => {
        void sendReactorHold(true);
      }, remainingMs);
    }

    return () => {
      clearInterval(heartbeat);
      if (completionTimer) clearTimeout(completionTimer);
    };
  }, [
    holdingReactor,
    showReactorHoldModal,
    state.activeSabotage?.kind,
    state.activeSabotage?.dualHoldStartedAt,
  ]);

  // Report scanner open/closed state for browser fallback camera coordination
  useEffect(() => {
    onScannerOpenChange?.(Boolean(scannerMode));
  }, [scannerMode, onScannerOpenChange]);

  // Show "YOU HAVE BEEN KILLED" modal immediately when killed
  useEffect(() => {
    if (killedAlertTrigger > 0) {
      soundEngine.playKillAlert();
      haptics.event('killed');
      setActiveTask(null);
      setScannerMode(null);
      setDeadBodyFound(null);
      setShowReactorHoldModal(false);
      setShowSecurityMonitor(false);
      setSelectedSecurityTargetId(null);
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
      setShowReactorHoldModal(false);
      setShowSecurityMonitor(false);
      setSelectedSecurityTargetId(null);
    }
  }, [meetingAlertTrigger]);

  // Play sabotage alarm
  useEffect(() => {
    if (sabotageAlertTrigger > 0) {
      if (state.activeSabotage?.kind === 'REACTOR') {
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

    if (state.phase !== 'PLAYING' || !state.self.alive) {
      setShowTerminal(false);
      setTerminalUnlocked(false);
      setDeadBodyFound(null);
      setShowReactorHoldModal(false);
      setShowReactorArmedModal(false);
      setShowSecurityMonitor(false);
      setSelectedSecurityTargetId(null);
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
  }, [missionStartedTrigger, state.phase, state.self.alive]);

  useEffect(() => {
    if (securityForceClosedSeq > 0) {
      setShowSecurityMonitor(false);
      setSelectedSecurityTargetId(null);
    }
  }, [securityForceClosedSeq]);

  useEffect(() => {
    if (securityErrorEvent?.message) {
      haptics.notify('warning');
      setToastMsg(securityErrorEvent.message);
    }
  }, [securityErrorEvent]);

  // Show crew departure / rejoin banner when another player leaves or reconnects
  useEffect(() => {
    if (!crewPresenceEvent || crewPresenceEvent.seq === lastPresenceSeqRef.current) return;
    lastPresenceSeqRef.current = crewPresenceEvent.seq;
    if (crewPresenceEvent.playerId === state.self.playerId) return;

    setActivePresenceAlert(crewPresenceEvent);
    soundEngine.playClick();
    haptics.impact('light');

    if (presenceTimerRef.current !== null) {
      window.clearTimeout(presenceTimerRef.current);
    }
    presenceTimerRef.current = window.setTimeout(() => {
      setActivePresenceAlert(null);
      presenceTimerRef.current = null;
    }, 4500);
  }, [crewPresenceEvent, state.self.playerId]);

  const finishEjectLeave = () => {
    if (ejectTimerRef.current !== null) {
      window.clearTimeout(ejectTimerRef.current);
      ejectTimerRef.current = null;
    }
    setEjectingLeave(false);
    onLeaveSession();
  };

  const beginEjectAndLeave = () => {
    if (ejectTriggeredRef.current) return;
    ejectTriggeredRef.current = true;

    setConfirmLeaveOpen(false);
    setActiveTask(null);
    setScannerMode(null);
    setShowTerminal(false);
    setShowSecurityMonitor(false);
    setShowReactorHoldModal(false);
    setShowReactorArmedModal(false);
    onBeginEjectLeave?.();

    fetch(`/api/sessions/${state.sessionCode}/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${playerToken}`,
      },
      keepalive: true,
    }).catch(() => {});

    soundEngine.playEjectionWhoosh();
    haptics.impact('heavy');
    setEjectingLeave(true);

    ejectTimerRef.current = window.setTimeout(() => {
      finishEjectLeave();
    }, 2350);
  };

  useEffect(() => {
    if (androidLeaveTrigger && androidLeaveTrigger > 0) {
      beginEjectAndLeave();
    }
  }, [androidLeaveTrigger]);

  useEffect(() => {
    return () => {
      if (presenceTimerRef.current !== null) {
        window.clearTimeout(presenceTimerRef.current);
      }
      if (ejectTimerRef.current !== null) {
        window.clearTimeout(ejectTimerRef.current);
      }
    };
  }, []);

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

  const isShielded =
    state.phase === 'PLAYING' &&
    state.self.alive &&
    state.self.shieldedUntil > effectiveNowMs;

  const shieldLeftSec = isShielded
    ? Math.max(0, Math.ceil((state.self.shieldedUntil - effectiveNowMs) / 1000))
    : 0;

  useEffect(() => {
    if (isShielded && !prevShieldedRef.current) {
      soundEngine.playShieldBlock();
      haptics.notify('success');
    }
    prevShieldedRef.current = isShielded;
  }, [isShielded]);

  useEffect(() => {
    if (!state.self.reactorArmed || !state.self.alive || state.activeSabotage) {
      setShowReactorArmedModal(false);
    }
  }, [state.self.reactorArmed, state.self.alive, state.activeSabotage]);

  const signalJamLeftSec =
    state.activeSabotage?.kind === 'SIGNAL_JAM' && state.activeSabotage.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - effectiveNowMs) / 1000))
      : 0;

  const crisisLeftSec =
    state.activeSabotage?.kind === 'REACTOR' && state.activeSabotage.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - effectiveNowMs) / 1000))
      : 0;

  const startReactorHold = () => {
    if (!state.self.alive || state.activeSabotage?.kind !== 'REACTOR') return;
    if (holdingReactorRef.current) return;
    holdingReactorRef.current = true;
    setHoldingReactor(true);
    haptics.impact('heavy');
    soundEngine.playClick();
    void sendReactorHold(true);
  };

  const stopReactorHold = () => {
    if (!holdingReactorRef.current) return;
    holdingReactorRef.current = false;
    setHoldingReactor(false);
    haptics.impact('light');
    void sendReactorHold(false);
  };

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

    if (parsed.kind === 'REACTOR_OVERRIDE') {
      try {
        const res = await fetch(`/api/sessions/${state.sessionCode}/reactor/scan`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${playerToken}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScannerMode(null);
        onUpdateState(data.state);
        const outcome = data.outcome;
        if (outcome.kind === 'MELTDOWN_ARMED') {
          soundEngine.playClick();
          haptics.impact('medium');
          setShowReactorArmedModal(true);
        } else if (outcome.kind === 'OPEN_HOLD_PANEL') {
          haptics.impact('medium');
          setShowReactorHoldModal(true);
        } else {
          haptics.impact('light');
          showToast(outcome.message || 'Reactor core nominal — no meltdown active.');
        }
        return { valid: true };
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Reactor Override rejected.',
        };
      }
    }

    if (parsed.kind === 'SECURITY_CAM') {
      if (!state.self.alive) {
        return {
          valid: false,
          error: 'Ghosts cannot access live Security Camera monitors.',
        };
      }
      if (state.activeSabotage?.kind === 'SIGNAL_JAM' && signalJamLeftSec > 0) {
        return {
          valid: false,
          error: `Comms Signal Jam active! Security cameras are offline for ${signalJamLeftSec}s.`,
        };
      }
      setScannerMode(null);
      onClearSecurityFeedState();
      setSelectedSecurityTargetId(null);
      setShowSecurityMonitor(true);
      onSendWsMessage({ type: 'security:open' });
      haptics.impact('medium');
      return { valid: true };
    }

    if (parsed.kind === 'MEETING') {
      if (state.activeSabotage?.kind === 'SIGNAL_JAM' && signalJamLeftSec > 0) {
        return {
          valid: false,
          error: `Signal Jam active! Emergency Meetings are disabled for ${signalJamLeftSec}s.`,
        };
      }
      if (state.activeSabotage?.kind === 'REACTOR' && crisisLeftSec > 0) {
        return {
          valid: false,
          error: 'Cannot call Emergency Meeting during an active Reactor Meltdown!',
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
          : 'Signal Jam triggered! Emergency Meetings disabled for 60s.',
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

  const handleTriggerArmedMeltdown = async () => {
    if (reactorActionBusy) return;
    soundEngine.playClick();
    haptics.impact('heavy');
    setReactorActionBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/reactor/trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      soundEngine.playMeltdownAlarm();
      haptics.notify('warning');
      setShowReactorArmedModal(false);
      setTerminalUnlocked(false);
      setShowTerminal(false);
      onUpdateState(data.state);
      showToast('Critical Reactor Meltdown triggered remotely!');
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to trigger Reactor Meltdown.');
    } finally {
      setReactorActionBusy(false);
    }
  };

  const handleCancelArmedMeltdown = async () => {
    if (reactorActionBusy) return;
    soundEngine.playClick();
    haptics.impact('light');
    setReactorActionBusy(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/reactor/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowReactorArmedModal(false);
      onUpdateState(data.state);
      showToast('Armed Reactor Meltdown cancelled.');
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to cancel armed Meltdown.');
    } finally {
      setReactorActionBusy(false);
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
      data-shielded={isShielded ? 'true' : 'false'}
      className={`relative min-h-dvh text-slate-100 flex flex-col transition-colors duration-300 ${
        isShielded ? 'bg-[#171406]' : 'bg-[#0B0F17]'
      } ${
        state.phase === 'PLAYING'
          ? 'pb-[calc(5.75rem+env(safe-area-inset-bottom))]'
          : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'
      }`}
    >
      {/* Full-Screen Golden-Yellow Guardian Shield Glow */}
      <AnimatePresence>
        {isShielded && (
          <motion.div
            key="guardian-shield-aura"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.72, 1, 0.72] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none fixed inset-0 z-40 border-[4px] border-yellow-400/90 shadow-[inset_0_0_58px_rgba(250,204,21,0.72)] bg-gradient-to-b from-yellow-400/18 via-transparent to-amber-400/18"
          />
        )}
      </AnimatePresence>

      {/* Compact Mobile Telemetry Bar (<= 15% cap) */}
      <header
        className={`sticky top-0 z-30 min-h-14 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md border-b flex items-center justify-between gap-3 transition-colors duration-300 ${
          isShielded
            ? 'bg-[#1D1908]/95 border-yellow-400/70 shadow-[0_4px_24px_rgba(250,204,21,0.3)]'
            : 'bg-[#0F1520]/95 border-white/10'
        }`}
      >
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
          <button
            type="button"
            onClick={() => {
              haptics.impact('light');
              setConfirmLeaveOpen(true);
            }}
            className="min-h-[44px] px-2.5 rounded-xl bg-red-500/12 hover:bg-red-500/22 border border-red-500/30 flex items-center justify-center gap-1.5 text-red-200 text-xs font-bold transition-colors"
            aria-label="Leave Lobby"
            title="Leave Lobby"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
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
        {activePresenceAlert && (
          <motion.div
            key={activePresenceAlert.seq}
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="fixed top-[calc(4.1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md pointer-events-auto"
          >
            <div
              className={`rounded-2xl border px-3.5 py-2.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ${
                activePresenceAlert.kind === 'LEFT'
                  ? 'bg-[#170F16]/95 border-red-500/45 shadow-[0_10px_30px_rgba(239,68,68,0.22)]'
                  : 'bg-[#0C1924]/95 border-cyan-400/50 shadow-[0_10px_30px_rgba(34,211,238,0.22)]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CrewmateAvatar
                  color={activePresenceAlert.playerColor}
                  alive={activePresenceAlert.kind === 'REJOINED'}
                  size={32}
                />
                <div className="min-w-0">
                  <div
                    className={`font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
                      activePresenceAlert.kind === 'LEFT' ? 'text-red-300' : 'text-cyan-300'
                    }`}
                  >
                    {activePresenceAlert.kind === 'LEFT' ? 'Airlock Departure' : 'Crew Tether Restored'}
                  </div>
                  <div className="text-xs text-white font-semibold truncate">
                    {activePresenceAlert.playerName}{' '}
                    <span className="font-normal text-slate-300">
                      {activePresenceAlert.kind === 'LEFT'
                        ? activePresenceAlert.phase === 'LOBBY' || activePresenceAlert.phase === 'ENDED'
                          ? 'left the lobby.'
                          : 'left the mission.'
                        : activePresenceAlert.phase === 'LOBBY'
                          ? 'rejoined the lobby.'
                          : 'rejoined the mission.'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePresenceAlert(null)}
                className="min-w-[32px] min-h-[32px] rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
                aria-label="Dismiss crew alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  setConfirmLeaveOpen(true);
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
              {/* Guardian Angel Aegis Shield Visual Cue */}
              <AnimatePresence>
                {isShielded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="rounded-2xl p-3.5 border-2 border-yellow-400/85 bg-gradient-to-r from-yellow-500/25 via-amber-400/15 to-yellow-500/25 shadow-[0_0_28px_rgba(250,204,21,0.35)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-yellow-400/25 border border-yellow-300/70 flex items-center justify-center text-yellow-200 shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-lg font-bold text-yellow-200 leading-tight">
                          AEGIS SHIELD ACTIVE
                        </div>
                        <div className="text-[11px] text-yellow-100/85">
                          Protected by Guardian Angel — next lethal strike deflected
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-base font-bold text-yellow-950 bg-yellow-300 px-2.5 py-1 rounded-lg tabular-nums shrink-0">
                      {shieldLeftSec}s
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Security Camera Active ("Being Watched") Quirk Indicator */}
              <AnimatePresence>
                {securityWatcherCount > 0 &&
                  state.self.alive &&
                  state.activeSabotage?.kind !== 'SIGNAL_JAM' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="rounded-2xl p-3.5 border-2 border-red-500/80 bg-red-950/40 shadow-[0_0_24px_rgba(239,68,68,0.28)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center text-red-300 shrink-0">
                          <Video className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-lg font-bold text-red-200 leading-tight flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span>SECURITY CAM ACTIVE</span>
                          </div>
                          <div className="text-[11px] text-red-100/85">
                            Another player is viewing your rear camera feed live
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-white bg-red-600 px-2 py-1 rounded-lg shrink-0">
                        REC
                      </span>
                    </motion.div>
                  )}
              </AnimatePresence>

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
                  Scan Skeld Task QR codes to complete assignments, scan Security Cams to check player feeds, scan fallen crewmates to report bodies, or scan Cafeteria EMRG.
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
                      state.activeSabotage.kind === 'REACTOR'
                        ? 'bg-red-600/20 border-red-500 animate-pulse'
                        : 'bg-amber-500/15 border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {state.activeSabotage.kind === 'BLACKOUT' ? (
                        <ZapOff className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                      ) : state.activeSabotage.kind === 'SIGNAL_JAM' ? (
                        <Radio className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                      ) : (
                        <Flame className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`font-display text-2xl font-bold leading-none ${
                              state.activeSabotage.kind === 'REACTOR'
                                ? 'text-red-300'
                                : 'text-amber-200'
                            }`}
                          >
                            {state.activeSabotage.kind === 'BLACKOUT' && 'POWER BLACKOUT!'}
                            {state.activeSabotage.kind === 'SIGNAL_JAM' && 'COMMS SIGNAL JAM!'}
                            {state.activeSabotage.kind === 'REACTOR' && 'REACTOR MELTDOWN!'}
                          </div>
                          {state.activeSabotage.kind === 'REACTOR' && (
                            <span className="font-mono text-lg font-bold text-white bg-red-600/60 px-2.5 py-0.5 rounded-lg tabular-nums">
                              {crisisLeftSec}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-100/90 mt-1.5 leading-relaxed">
                          {state.activeSabotage.kind === 'BLACKOUT' &&
                            `All regular tasks are disabled. Anyone alive can scan Fix Wiring${state.settings.hideManualCodes ? '' : ' (WIR1)'} in Electrical to restore power!`}
                          {state.activeSabotage.kind === 'SIGNAL_JAM' &&
                            `Emergency Meeting button & Security Cameras are jammed for ${signalJamLeftSec}s. Body reports still work.`}
                          {state.activeSabotage.kind === 'REACTOR' &&
                            `2 alive players must scan the Reactor Override QR${state.settings.hideManualCodes ? '' : ` (${REACTOR_OVERRIDE_SHORT_CODE})`} and hold the button together for 5s! (${(state.activeSabotage.reactorHolders || []).length}/2 holding)`}
                        </p>
                      </div>
                    </div>

                    {(state.activeSabotage.kind === 'BLACKOUT' ||
                      state.activeSabotage.kind === 'REACTOR') &&
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
                              : 'Scan Reactor Override QR Now'}
                          </span>
                        </button>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>

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

            <button
              type="button"
              onClick={() => {
                haptics.impact('light');
                setConfirmLeaveOpen(true);
              }}
              className="w-full min-h-[46px] rounded-xl bg-red-500/12 hover:bg-red-500/22 border border-red-500/35 text-red-200 font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Lobby</span>
            </button>
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
                          </div>
                          {state.self.reactorArmed && !state.activeSabotage ? (
                            <div className="p-3.5 rounded-xl bg-red-950/50 border-2 border-red-400/70 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-red-200 flex items-center gap-1.5">
                                  <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                                  <span>Reactor Meltdown Armed</span>
                                </span>
                                <span className="font-mono text-[11px] text-amber-300">
                                  {localSabotageRemaining > 0
                                    ? `Ready in ${localSabotageRemaining}s`
                                    : 'Ready to Detonate'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={reactorActionBusy || localSabotageRemaining > 0}
                                  onClick={handleTriggerArmedMeltdown}
                                  className="min-h-[44px] px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-45 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                                >
                                  <Flame className="w-4 h-4 shrink-0" />
                                  <span>
                                    {localSabotageRemaining > 0
                                      ? `Wait ${localSabotageRemaining}s`
                                      : 'Trigger Meltdown'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={reactorActionBusy}
                                  onClick={handleCancelArmedMeltdown}
                                  className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-45 text-slate-200 font-semibold text-xs"
                                >
                                  Cancel Armed
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2">
                              <span className="text-rose-300 font-semibold">Critical Reactor Meltdown:</span>{' '}
                              Scan the physical Reactor Override QR{state.settings.hideManualCodes ? '' : ` (${REACTOR_OVERRIDE_SHORT_CODE})`} to arm a remote trigger, then detonate it from anywhere else or cancel.
                            </p>
                          )}
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

                    {isGuardian && (
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
                ? 'Scan a Task QR, Security Cams, Player badge, or Cafeteria button.'
                : 'Scan a Task QR, Security CAMS, Player badge, or Cafeteria EMRG.'
            }
            accentColor="emerald"
            hideManualCodes={Boolean(state.settings.hideManualCodes)}
            onDetected={handleQrDetected}
            onClose={() => setScannerMode(null)}
          />
        )}
      </AnimatePresence>

      {/* SECURITY ROOM 15 FPS CCTV MONITOR MODAL */}
      <AnimatePresence>
        {showSecurityMonitor && state.phase === 'PLAYING' && state.self.alive && (
          <SecurityMonitorModal
            players={state.players}
            selfPlayerId={state.self.playerId}
            jammed={securityJammed || state.activeSabotage?.kind === 'SIGNAL_JAM'}
            selectedTargetId={selectedSecurityTargetId}
            latestFrame={securityLatestFrame}
            targetBusy={
              Boolean(
                selectedSecurityTargetId &&
                  securityTargetStatus?.targetPlayerId === selectedSecurityTargetId &&
                  securityTargetStatus.busy,
              )
            }
            targetOffline={
              Boolean(
                selectedSecurityTargetId &&
                  securityTargetStatus?.targetPlayerId === selectedSecurityTargetId &&
                  securityTargetStatus.offline,
              )
            }
            targetLostReason={
              selectedSecurityTargetId &&
              securityTargetStatus?.targetPlayerId === selectedSecurityTargetId
                ? securityTargetStatus.lostReason
                : null
            }
            onSelectTarget={(targetPlayerId) => {
              onClearSecurityFeedState();
              setSelectedSecurityTargetId(targetPlayerId);
              onSendWsMessage({ type: 'security:select', targetPlayerId });
            }}
            onClose={() => {
              setShowSecurityMonitor(false);
              setSelectedSecurityTargetId(null);
              onClearSecurityFeedState();
              onSendWsMessage({ type: 'security:close' });
            }}
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

      {/* REACTOR MELTDOWN 2-PLAYER 5-SECOND SIMULTANEOUS HOLD MODAL */}
      <AnimatePresence>
        {showReactorHoldModal &&
          state.phase === 'PLAYING' &&
          state.activeSabotage?.kind === 'REACTOR' &&
          state.self.alive && (() => {
            const holders = state.activeSabotage.reactorHolders || [];
            const dualStartedAt = state.activeSabotage.dualHoldStartedAt;
            const holdElapsedMs =
              dualStartedAt && holders.length >= 2
                ? Math.min(5000, Math.max(0, effectiveNowMs - dualStartedAt))
                : 0;
            const holdPct = Math.min(100, (holdElapsedMs / 5000) * 100);
            const holdSec = (holdElapsedMs / 1000).toFixed(1);

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/88 backdrop-blur-sm flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] overflow-y-auto bg-[#151C28] border-2 border-red-500/80 rounded-2xl p-5 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold">
                      <Flame className="w-4 h-4 animate-pulse" />
                      <span>REACTOR MELTDOWN OVERRIDE</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-white bg-red-600/70 px-2.5 py-0.5 rounded-lg tabular-nums">
                      {crisisLeftSec}s
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Two alive players must scan this QR and <strong className="text-white">press &amp; hold</strong> the override clamp at the exact same time for <strong className="text-emerald-300">5.0 seconds</strong> to stop the meltdown.
                  </p>

                  {/* Live Dual-Hold Status */}
                  <div className="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300">
                        Operators Holding:{' '}
                        <strong className={holders.length >= 2 ? 'text-emerald-400' : 'text-amber-300'}>
                          {holders.length}/2
                        </strong>
                      </span>
                      <span className="text-emerald-300 font-bold tabular-nums">
                        {holdSec}s / 5.0s
                      </span>
                    </div>

                    <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-100 ${
                          holders.length >= 2 ? 'bg-emerald-400' : 'bg-amber-400/50'
                        }`}
                        style={{ width: `${holdPct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 min-h-[28px]">
                      {holders.length === 0 ? (
                        <span className="text-[11px] text-slate-400">
                          No one holding yet — press and hold below!
                        </span>
                      ) : (
                        holders.map((h) => (
                          <span
                            key={h.playerId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-xs font-semibold text-emerald-200"
                          >
                            <CrewmateAvatar color={h.color} size={18} />
                            <span>{h.playerId === state.self.playerId ? 'You' : h.name}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Press & Hold Button */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startReactorHold();
                    }}
                    onPointerUp={stopReactorHold}
                    onPointerCancel={stopReactorHold}
                    onPointerLeave={stopReactorHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`w-full min-h-[84px] rounded-2xl border-2 font-display text-2xl font-bold tracking-wide flex flex-col items-center justify-center gap-1 select-none touch-none transition-all ${
                      holdingReactor
                        ? holders.length >= 2
                          ? 'bg-emerald-500 border-emerald-200 text-slate-950 scale-[0.98] shadow-[0_0_28px_rgba(16,185,129,0.5)]'
                          : 'bg-amber-400 border-amber-200 text-slate-950 scale-[0.98]'
                        : 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-lg'
                    }`}
                  >
                    <span>
                      {holdingReactor
                        ? holders.length >= 2
                          ? 'STABILIZING — KEEP HOLDING!'
                          : 'HOLDING — NEED 2ND PLAYER!'
                        : 'PRESS & HOLD TO OVERRIDE'}
                    </span>
                    <span className="text-[11px] font-sans font-semibold opacity-90">
                      {holdingReactor
                        ? 'Do not lift your finger until 5.0s completes'
                        : 'Hold continuously for 5 seconds with a teammate'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopReactorHold();
                      setShowReactorHoldModal(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs"
                  >
                    Close Panel
                  </button>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* IMPOSTOR ARMED REACTOR OVERRIDE REMOTE TRIGGER / CANCEL MODAL */}
      <AnimatePresence>
        {showReactorArmedModal &&
          state.phase === 'PLAYING' &&
          state.self.alive &&
          state.self.reactorArmed &&
          !state.activeSabotage && (
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
                className="w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] overflow-y-auto bg-[#151C28] border-2 border-red-500/80 rounded-2xl p-5 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold">
                    <Flame className="w-4 h-4 animate-pulse" />
                    <span>REACTOR OVERRIDE ARMED</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {localSabotageRemaining > 0 ? `Cooldown ${localSabotageRemaining}s` : 'Standby'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Meltdown did <strong className="text-white">NOT</strong> start yet! Move away from the Reactor so nobody suspects you, then tap{' '}
                  <strong className="text-red-300">Trigger Meltdown</strong> remotely—or cancel if you changed your mind.
                </p>

                <button
                  type="button"
                  disabled={reactorActionBusy || localSabotageRemaining > 0}
                  onClick={handleTriggerArmedMeltdown}
                  className="w-full min-h-[54px] rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-45 text-white font-display text-2xl font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg"
                >
                  <Flame className="w-5 h-5" />
                  <span>
                    {localSabotageRemaining > 0
                      ? `RECHARGING (${localSabotageRemaining}s)`
                      : 'TRIGGER MELTDOWN NOW'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={reactorActionBusy}
                    onClick={() => {
                      haptics.impact('light');
                      setShowReactorArmedModal(false);
                      showToast('Reactor Meltdown stays armed in your Terminal.');
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-semibold text-xs"
                  >
                    Hide &amp; Use Terminal
                  </button>
                  <button
                    type="button"
                    disabled={reactorActionBusy}
                    onClick={handleCancelArmedMeltdown}
                    className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-red-200 font-semibold text-xs"
                  >
                    Cancel Armed
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* LEAVE LOBBY CONFIRMATION POPUP (SKELD AIRLOCK EJECTION) */}
      <AnimatePresence>
        {confirmLeaveOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              haptics.impact('light');
              setConfirmLeaveOpen(false);
            }}
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0E1420] border-2 border-red-500/45 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.22)]"
            >
              {/* Top Airlock Hazard Bar */}
              <div className="h-2 w-full bg-[repeating-linear-gradient(-45deg,#ef4444,#ef4444_10px,#1e1b24_10px,#1e1b24_20px)]" />

              {/* Space Viewport Banner */}
              <div className="relative bg-[#050811] border-b border-white/10 px-5 py-4 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-70">
                  <span className="absolute top-2.5 left-6 w-1 h-1 rounded-full bg-white/80" />
                  <span className="absolute top-6 left-20 w-0.5 h-0.5 rounded-full bg-cyan-300/80" />
                  <span className="absolute bottom-3 left-12 w-1 h-1 rounded-full bg-white/50" />
                  <span className="absolute top-3 right-12 w-1 h-1 rounded-full bg-cyan-200/90" />
                  <span className="absolute bottom-4 right-24 w-0.5 h-0.5 rounded-full bg-white/70" />
                  <span className="absolute top-9 right-5 w-1 h-1 rounded-full bg-red-300/70" />
                </div>

                <div className="relative flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/15 border border-red-400/35 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-red-300">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Airlock Override</span>
                    </div>
                    <div className="font-mono text-[11px] text-cyan-300/90 tracking-wider">
                      VESSEL // {state.sessionCode}
                    </div>
                  </div>

                  <motion.div
                    animate={{ y: [0, -4, 0], rotate: [-4, 4, -4] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="shrink-0 pr-1"
                  >
                    <CrewmateAvatar
                      color={state.self.color}
                      alive={state.self.alive}
                      ghost={!state.self.alive}
                      size={46}
                    />
                  </motion.div>
                </div>
              </div>

              {/* Body & Actions */}
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <h3 className="font-display text-2xl font-black tracking-wide text-white uppercase">
                    {state.phase === 'LOBBY' ? 'Eject From Lobby?' : 'Abandon Mission?'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {state.phase === 'LOBBY' ? (
                      <>
                        Ready to step out the airlock of{' '}
                        <span className="font-mono font-bold text-cyan-300">{state.sessionCode}</span>?
                        Your saved auto-rejoin tether will be cleared.
                      </>
                    ) : (
                      <>
                        Leaving <span className="font-mono font-bold text-cyan-300">{state.sessionCode}</span>{' '}
                        mid-flight will disconnect you from the crew and clear your saved auto-rejoin tether.
                      </>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impact('light');
                      setConfirmLeaveOpen(false);
                    }}
                    className="min-h-[46px] rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-cyan-400/25 text-slate-100 font-bold text-xs tracking-wide uppercase transition-colors"
                  >
                    Stay Aboard
                  </button>
                  <button
                    type="button"
                    onClick={beginEjectAndLeave}
                    className="min-h-[46px] rounded-xl bg-red-600 hover:bg-red-500 border border-red-400/40 text-white font-black text-xs tracking-wide uppercase shadow-[0_0_20px_rgba(239,68,68,0.35)] transition-colors"
                  >
                    Eject &amp; Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN SKELD SPACE EJECTION ANIMATION */}
      <AnimatePresence>
        {ejectingLeave && (
          <motion.div
            key="skeld-space-ejection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[90] bg-[#03050B] overflow-hidden flex flex-col items-center justify-center select-none"
          >
            {/* Deep Starfield */}
            <div className="pointer-events-none absolute inset-0">
              {[
                { top: '8%', left: '12%', size: 2, opacity: 0.8, dur: 2.8 },
                { top: '14%', left: '68%', size: 3, opacity: 0.9, dur: 2.2 },
                { top: '21%', left: '34%', size: 2, opacity: 0.65, dur: 3.1 },
                { top: '27%', left: '88%', size: 2, opacity: 0.85, dur: 2.4 },
                { top: '34%', left: '19%', size: 3, opacity: 0.75, dur: 2.6 },
                { top: '42%', left: '54%', size: 2, opacity: 0.55, dur: 3.3 },
                { top: '53%', left: '78%', size: 3, opacity: 0.9, dur: 2.1 },
                { top: '61%', left: '15%', size: 2, opacity: 0.7, dur: 2.9 },
                { top: '68%', left: '43%', size: 2, opacity: 0.8, dur: 2.5 },
                { top: '76%', left: '84%', size: 3, opacity: 0.85, dur: 2.3 },
                { top: '83%', left: '28%', size: 2, opacity: 0.6, dur: 3.0 },
                { top: '90%', left: '61%', size: 2, opacity: 0.75, dur: 2.7 },
              ].map((star, idx) => (
                <motion.span
                  key={idx}
                  aria-hidden="true"
                  initial={{ x: 0, opacity: star.opacity * 0.6 }}
                  animate={{ x: [-8, -68], opacity: [star.opacity * 0.6, star.opacity, star.opacity * 0.5] }}
                  transition={{ duration: star.dur, repeat: Infinity, ease: 'linear' }}
                  style={{
                    top: star.top,
                    left: star.left,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                  }}
                  className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]"
                />
              ))}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08)_0%,rgba(3,5,11,0.85)_68%)]" />
            </div>

            {/* Airlock Upper & Lower Blast Doors */}
            <motion.div
              aria-hidden="true"
              initial={{ y: 0 }}
              animate={{ y: '-100%' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute top-0 inset-x-0 h-1/2 z-30 bg-[#121826] border-b-4 border-red-500/70 flex flex-col justify-end"
            >
              <div className="h-2.5 w-full bg-[repeating-linear-gradient(-45deg,#ef4444,#ef4444_12px,#111827_12px,#111827_24px)] opacity-80" />
            </motion.div>
            <motion.div
              aria-hidden="true"
              initial={{ y: 0 }}
              animate={{ y: '100%' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute bottom-0 inset-x-0 h-1/2 z-30 bg-[#121826] border-t-4 border-red-500/70 flex flex-col justify-start"
            >
              <div className="h-2.5 w-full bg-[repeating-linear-gradient(-45deg,#ef4444,#ef4444_12px,#111827_12px,#111827_24px)] opacity-80" />
            </motion.div>

            {/* Drifting & Tumbling Ejected Crewmate */}
            <motion.div
              aria-hidden="true"
              initial={{ x: '-55vw', y: 12, rotate: -15, scale: 1.05, opacity: 1 }}
              animate={{
                x: '65vw',
                y: [-8, -28, 6, -16],
                rotate: [0, 260, 540, 760],
                scale: [1.05, 0.96, 0.78, 0.52],
                opacity: [1, 1, 0.95, 0.7],
              }}
              transition={{ duration: 2.15, ease: [0.18, 0.7, 0.4, 1] }}
              className="relative z-20 mb-8 drop-shadow-[0_0_28px_rgba(255,255,255,0.22)]"
            >
              <CrewmateAvatar
                color={state.self.color}
                alive={state.self.alive}
                ghost={!state.self.alive}
                size={84}
              />
            </motion.div>

            {/* Classic Ejection Caption */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="relative z-20 text-center px-6 space-y-2"
            >
              <div className="font-display text-4xl sm:text-5xl font-bold tracking-wide text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {state.self.name} was ejected.
              </div>
              <div className="font-mono text-xs tracking-[0.24em] uppercase text-cyan-300/80">
                Airlock Sealed · Vessel {state.sessionCode}
              </div>
            </motion.div>

            <button
              type="button"
              onClick={finishEjectLeave}
              className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono uppercase tracking-wider text-slate-200 transition-colors"
            >
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
