import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClientGameState,
  getColorDef,
  getTaskDef,
  ParsedQrAction,
  PLAYER_COLORS,
  PlayerColorId,
  PublicAlignment,
  SabotageKind,
  SkeldTaskDef,
} from '../skeldShared';
import { AnimatedCrewmate } from '../components/AnimatedCrewmate';
import { NativeQrScannerModal } from '../components/NativeQrScannerModal';
import { RoleSplashOverlay } from '../components/RoleSplashOverlay';
import { TaskMiniGamesModal } from '../components/TaskMiniGamesModal';
import { haptics } from '../haptics';

interface GameHudScreenProps {
  serverUrl: string;
  playerToken: string;
  state: ClientGameState;
  killedAlertTrigger: number;
  meetingAlertTrigger: number;
  sabotageAlertTrigger: number;
  missionStartedTrigger: number;
  onUpdateState: (next: ClientGameState) => void;
  onLeaveSession: () => void;
}

interface ForensicResult {
  targetName: string;
  targetColor: PlayerColorId;
  reportedAlignment: PublicAlignment;
}

export const GameHudScreen: React.FC<GameHudScreenProps> = ({
  serverUrl,
  playerToken,
  state,
  killedAlertTrigger,
  meetingAlertTrigger,
  sabotageAlertTrigger,
  missionStartedTrigger,
  onUpdateState,
  onLeaveSession,
}) => {
  const insets = useSafeAreaInsets();
  const [showRoleSplash, setShowRoleSplash] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTask, setActiveTask] = useState<SkeldTaskDef | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalUnlocked, setTerminalUnlocked] = useState(false);
  const [showKilledModal, setShowKilledModal] = useState(false);
  const [deadBodyFound, setDeadBodyFound] = useState<{
    victimName: string;
    victimColor: PlayerColorId;
  } | null>(null);
  const [reportingBody, setReportingBody] = useState(false);
  const [voteNowBusy, setVoteNowBusy] = useState(false);
  const [forensicResult, setForensicResult] = useState<ForensicResult | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sabotageBusy, setSabotageBusy] = useState(false);
  const [colorBusy, setColorBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [localKillRemaining, setLocalKillRemaining] = useState(state.self.killCooldownRemainingSec);
  const [localScanRemaining, setLocalScanRemaining] = useState(state.self.scanCooldownRemainingSec);
  const [localSabotageRemaining, setLocalSabotageRemaining] = useState(
    state.self.sabotageCooldownRemainingSec ?? 0,
  );

  const prevPhaseRef = useRef(state.phase);
  const roleSplashShownRef = useRef(false);
  const serverSkewMsRef = useRef(state.serverTime - Date.now());
  const progressAnim = useRef(new Animated.Value(state.taskProgress.percentage)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    serverSkewMsRef.current = state.serverTime - Date.now();
    setLocalKillRemaining(state.self.killCooldownRemainingSec);
    setLocalScanRemaining(state.self.scanCooldownRemainingSec);
    setLocalSabotageRemaining(state.self.sabotageCooldownRemainingSec ?? 0);
  }, [
    state.self.killCooldownRemainingSec,
    state.self.scanCooldownRemainingSec,
    state.self.sabotageCooldownRemainingSec,
    state.serverTime,
  ]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: state.taskProgress.percentage,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [state.taskProgress.percentage, progressAnim]);

  useEffect(() => {
    const iv = setInterval(() => {
      setNowMs(Date.now());
      setLocalKillRemaining((k) => Math.max(0, k - 1));
      setLocalScanRemaining((s) => Math.max(0, s - 1));
      setLocalSabotageRemaining((sb) => Math.max(0, sb - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (state.phase !== 'MEETING' || !state.meeting?.revealEndsAt) return;
    setNowMs(Date.now());
    const fastIv = setInterval(() => {
      setNowMs(Date.now());
    }, 200);
    return () => clearInterval(fastIv);
  }, [state.phase, state.meeting?.revealEndsAt]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (killedAlertTrigger > 0) {
      haptics.event('killed');
      setActiveTask(null);
      setShowScanner(false);
      setDeadBodyFound(null);
      setShowKilledModal(true);
    }
  }, [killedAlertTrigger]);

  useEffect(() => {
    if (meetingAlertTrigger > 0) {
      haptics.event('alarm');
      setActiveTask(null);
      setShowScanner(false);
      setDeadBodyFound(null);
    }
  }, [meetingAlertTrigger]);

  useEffect(() => {
    if (sabotageAlertTrigger > 0) {
      haptics.event('sabotage');
    }
  }, [sabotageAlertTrigger]);

  useEffect(() => {
    if (
      state.activeSabotage?.kind === 'BLACKOUT' &&
      activeTask &&
      activeTask.id !== 'fix-wiring'
    ) {
      haptics.notify('warning');
      setActiveTask(null);
      const codeHint = state.settings.hideManualCodes ? '' : ' (WIR1)';
      showToast(`Power Blackout! Scan Fix Wiring${codeHint} to restore power first.`);
    }
  }, [state.activeSabotage?.kind, activeTask, state.settings.hideManualCodes]);

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3800);
  };

  const isImpostorTeam =
    state.self.secretRole === 'IMPOSTOR' || state.self.secretRole === 'SHAPESHIFTER';
  const isInvestigator = state.self.secretRole === 'INVESTIGATOR';
  const didPlayerWin = state.winner === 'IMPOSTORS' ? isImpostorTeam : !isImpostorTeam;
  const myColor = getColorDef(state.self.color);

  useEffect(() => {
    if (state.phase === 'ENDED') {
      haptics.notify(didPlayerWin ? 'success' : 'error');
    }
  }, [state.phase, didPlayerWin]);

  const signalJamLeftSec =
    state.activeSabotage?.kind === 'SIGNAL_JAM' && state.activeSabotage.expiresAt
      ? Math.max(0, Math.ceil((state.activeSabotage.expiresAt - nowMs) / 1000))
      : 0;

  const handleQrDetected = async (parsed: ParsedQrAction) => {
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
        error: `That QR code belongs to ${parsed.sessionCode}, not ${state.sessionCode}.`,
      };
    }

    if (parsed.kind === 'TASK') {
      if (state.activeSabotage?.kind === 'BLACKOUT') {
        const codeHint = state.settings.hideManualCodes ? '' : ' (WIR1)';
        if (parsed.task.id !== 'fix-wiring') {
          return {
            valid: false,
            error: `Power Blackout! Scan Fix Wiring${codeHint} to restore power first.`,
          };
        }
        if (!state.self.alive) {
          return {
            valid: false,
            error: `Only alive crewmates can repair Fix Wiring${codeHint} during a Blackout.`,
          };
        }
      }
      setShowScanner(false);
      haptics.notify('success');
      setActiveTask(parsed.task);
      return { valid: true };
    }

    if (parsed.kind === 'MEETING') {
      if (state.activeSabotage?.kind === 'SIGNAL_JAM' && signalJamLeftSec > 0) {
        haptics.notify('error');
        return {
          valid: false,
          error: `Signal Jam active! Meetings disabled for ${signalJamLeftSec}s.`,
        };
      }
      try {
        const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/meeting/call`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${playerToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        haptics.notify('success');
        setShowScanner(false);
        onUpdateState(data.state);
        return { valid: true };
      } catch (err) {
        haptics.notify('error');
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Unable to call meeting.',
        };
      }
    }

    if (parsed.kind === 'PLAYER') {
      try {
        const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/scan-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({ targetColor: parsed.color.id, mode: 'AUTO' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setShowScanner(false);
        onUpdateState(data.state);

        const outcome = data.outcome;
        if (outcome.kind === 'KILL_EXECUTED') {
          haptics.impact('heavy');
          showToast(`Eliminated ${outcome.victimName} (${outcome.victimColor.toUpperCase()}).`);
        } else if (outcome.kind === 'DEAD_BODY_FOUND') {
          haptics.notify('warning');
          setDeadBodyFound({
            victimName: outcome.victimName,
            victimColor: outcome.victimColor,
          });
        } else if (outcome.kind === 'INVESTIGATE_RESULT') {
          haptics.notify('success');
          setForensicResult({
            targetName: outcome.targetName,
            targetColor: outcome.targetColor,
            reportedAlignment: outcome.reportedAlignment,
          });
        } else if (outcome.kind === 'ID_CHECK') {
          haptics.impact('light');
          showToast(
            `${outcome.targetName} — Suit: ${getColorDef(outcome.targetColor).label} (${outcome.alive ? 'Alive' : 'Dead'})`,
          );
        }
        return { valid: true };
      } catch (err) {
        haptics.notify('error');
        return {
          valid: false,
          error: err instanceof Error ? err.message : 'Scan rejected.',
        };
      }
    }

    haptics.notify('error');
    return { valid: false, error: 'Unrecognized QR code.' };
  };

  const handleTaskCompleted = async () => {
    const finished = activeTask;
    setActiveTask(null);
    if (!finished) return;
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/tasks/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ taskId: finished.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      haptics.notify('success');
      onUpdateState(data.state);
      if (data.powerRestored) {
        showToast('Fix Wiring complete! Ship power restored.');
      } else {
        showToast(`Task station verified (${finished.name}).`);
      }
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Failed to log task.');
    }
  };

  const handleTriggerSabotage = async (kind: SabotageKind) => {
    if (sabotageBusy) return;
    haptics.impact('heavy');
    setSabotageBusy(true);
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/sabotage`, {
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
      setShowTerminal(false);
      setTerminalUnlocked(false);
      showToast(
        kind === 'BLACKOUT'
          ? 'BLACKOUT triggered! Tasks locked until Fix Wiring is repaired.'
          : 'SIGNAL JAM triggered! Emergency Meetings disabled for 60s.',
      );
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Sabotage failed.');
    } finally {
      setSabotageBusy(false);
    }
  };

  const handleReportDeadBody = async () => {
    if (!deadBodyFound || reportingBody) return;
    haptics.impact('heavy');
    setReportingBody(true);
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/scan-player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify({ targetColor: deadBodyFound.victimColor, mode: 'REPORT' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeadBodyFound(null);
      onUpdateState(data.state);
    } catch (err) {
      haptics.notify('error');
      showToast(err instanceof Error ? err.message : 'Unable to report body.');
    } finally {
      setReportingBody(false);
    }
  };

  const handleVoteNow = async () => {
    if (voteNowBusy) return;
    haptics.impact('medium');
    setVoteNowBusy(true);
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/meeting/vote-now`, {
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

  const handleArrive = async () => {
    haptics.impact('heavy');
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/meeting/arrive`, {
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
    haptics.selection();
    setColorBusy(true);
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/player/color`, {
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

  const handleVote = async (target: string) => {
    haptics.impact('medium');
    try {
      const res = await fetch(`${serverUrl}/api/sessions/${state.sessionCode}/meeting/vote`, {
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

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const effectiveNowMs = nowMs + serverSkewMsRef.current;

  const revealLeftSec =
    state.meeting?.stage === 'VOTING' && state.meeting.revealEndsAt
      ? Math.max(0, Math.ceil((state.meeting.revealEndsAt - effectiveNowMs) / 1000))
      : 0;

  const meetingSecLeft = state.meeting
    ? state.meeting.stage === 'DISCUSSION'
      ? Math.max(0, Math.ceil((state.meeting.discussionEndsAt - effectiveNowMs) / 1000))
      : state.meeting.stage === 'VOTING'
        ? Math.max(0, Math.ceil((state.meeting.votingEndsAt - effectiveNowMs) / 1000))
        : 0
    : 0;

  const modalSafePadding = {
    paddingTop: Math.max(insets.top + 16, 18),
    paddingBottom: Math.max(insets.bottom + 16, 18),
    paddingLeft: Math.max(insets.left + 16, 18),
    paddingRight: Math.max(insets.right + 16, 18),
  };

  return (
    <View style={styles.screen}>
      {/* Compact Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 10, 14),
            paddingLeft: Math.max(insets.left + 16, 16),
            paddingRight: Math.max(insets.right + 16, 16),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <AnimatedCrewmate color={state.self.color} alive={state.self.alive} size={42} animate={state.self.alive} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.playerName}>{state.self.name}</Text>
              {!state.self.alive ? <Text style={styles.ghostTag}>GHOST</Text> : null}
            </View>
            <Text style={styles.headerMeta}>
              {myColor.label} • {state.sessionCode} • Rejoin{' '}
              <Text style={{ color: '#38BDF8', fontWeight: '900' }}>{state.self.rejoinCode}</Text>
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.leaveBtn} onPress={onLeaveSession}>
          <Text style={styles.leaveBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {toastMsg ? (
        <View
          style={[
            styles.toast,
            {
              marginLeft: Math.max(insets.left + 16, 16),
              marginRight: Math.max(insets.right + 16, 16),
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingLeft: Math.max(insets.left + 16, 16),
            paddingRight: Math.max(insets.right + 16, 16),
            paddingBottom:
              state.phase === 'PLAYING'
                ? Math.max(insets.bottom + 104, 112)
                : Math.max(insets.bottom + 24, 32),
          },
        ]}
      >
        {/* LOBBY PHASE */}
        {state.phase === 'LOBBY' ? (
          <View style={styles.panel}>
            <Text style={styles.kicker}>CAFETERIA DROPSHIP</Text>
            <Text style={styles.panelTitle}>Waiting for Host to Launch</Text>
            <Text style={styles.panelSub}>
              Put your printed{' '}
              <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{myColor.label}</Text> QR badge
              on your back. Roles are revealed only when the mission begins.
            </Text>

            <View style={styles.rejoinBox}>
              <Text style={styles.kicker}>PERSONAL REJOIN CODE</Text>
              <Text style={styles.rejoinCode}>{state.self.rejoinCode}</Text>
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Switch Suit Color (Live Sync)</Text>
            <View style={styles.colorSwitchGrid}>
              {PLAYER_COLORS.map((c) => {
                const claimedBy = state.players.find((p) => p.color === c.id);
                const isMine = c.id === state.self.color;
                const isTakenOther = Boolean(claimedBy && !isMine);
                return (
                  <TouchableOpacity
                    key={c.id}
                    disabled={isTakenOther || colorBusy}
                    onPress={() => handleSwitchLobbyColor(c.id)}
                    style={[
                      styles.colorSwitchCell,
                      {
                        borderColor: isMine ? '#38BDF8' : '#1E293B',
                        backgroundColor: isMine ? '#1E293B' : '#0B0F17',
                        opacity: isTakenOther ? 0.32 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                    <Text style={styles.colorSwitchText} numberOfLines={1}>
                      {isMine ? 'You' : isTakenOther ? claimedBy?.name : c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Roster ({state.players.length})</Text>
            <View style={styles.rosterGrid}>
              {state.players.map((p) => (
                <View key={p.playerId} style={styles.rosterCell}>
                  <AnimatedCrewmate color={p.color} size={32} animate />
                  <Text style={styles.rosterName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* PLAYING PHASE — IDENTICAL PLAIN CREWMATE STEALTH HUD */}
        {state.phase === 'PLAYING' ? (
          <>
            {state.activeSabotage?.kind === 'BLACKOUT' ? (
              <Animated.View style={[styles.sabotageBanner, { borderColor: '#F59E0B', transform: [{ scale: pulseAnim }] }]}>
                <Text style={[styles.sabotageTitle, { color: '#FBBF24' }]}>POWER BLACKOUT ACTIVE</Text>
                <Text style={styles.sabotageSub}>
                  All regular tasks locked. Anyone alive — even if already finished or not on your list — can scan Fix Wiring{state.settings.hideManualCodes ? '' : ' (WIR1)'} to restore power!
                </Text>
                {state.self.alive ? (
                  <TouchableOpacity
                    style={[styles.primaryActionMini, { backgroundColor: '#F59E0B', marginTop: 10 }]}
                    onPress={() => setShowScanner(true)}
                  >
                    <Text style={styles.primaryActionMiniText}>Scan Fix Wiring QR</Text>
                  </TouchableOpacity>
                ) : null}
              </Animated.View>
            ) : null}

            {state.activeSabotage?.kind === 'SIGNAL_JAM' ? (
              <Animated.View style={[styles.sabotageBanner, { borderColor: '#EF4444', transform: [{ scale: pulseAnim }] }]}>
                <Text style={[styles.sabotageTitle, { color: '#FCA5A5' }]}>
                  COMMS SIGNAL JAM ({signalJamLeftSec}s)
                </Text>
                <Text style={styles.sabotageSub}>
                  Emergency Meeting button disabled temporarily. Dead body reports still work.
                </Text>
              </Animated.View>
            ) : null}

            {/* Plain Crewmember Clearance Card */}
            <View style={styles.panel}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.kicker}>STATION CLEARANCE</Text>
                  <Text style={[styles.panelTitle, { color: '#38BDF8' }]}>
                    {state.self.alive ? 'CREWMATE' : 'GHOST CREWMATE'}
                  </Text>
                </View>
                <Text style={styles.stealthChip}>Stealth HUD</Text>
              </View>
              <Text style={styles.panelSub}>
                {state.self.alive
                  ? 'Scan Task QR stations around the area to complete your checklist, or scan a dead player badge to report.'
                  : 'You were eliminated. Your tasks still count toward a Crewmate victory.'}
              </Text>
            </View>

            {/* Global Task Progress */}
            <View style={styles.panel}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionHeading}>Total Crew Tasks</Text>
                <Text style={styles.pctText}>{state.taskProgress.percentage}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: barWidth }]} />
              </View>
            </View>

            {/* Assigned Skeld Tasks */}
            <View style={styles.panel}>
              <Text style={styles.sectionHeading}>Assigned Skeld Tasks</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {state.activeSabotage?.kind === 'BLACKOUT' &&
                state.self.alive &&
                !state.self.assignedTasks.some((t) => t.taskId === 'fix-wiring') ? (
                  <View
                    style={[
                      styles.taskRow,
                      { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskName, { color: '#FDE68A' }]}>
                        Emergency Repair: Fix Wiring
                      </Text>
                      <Text style={styles.taskRoom}>
                        Electrical • Anyone alive can repair power
                      </Text>
                    </View>
                    <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 12 }}>
                      REPAIR
                    </Text>
                  </View>
                ) : null}

                {state.self.assignedTasks.map((t) => {
                  const def = getTaskDef(t.taskId);
                  const isBlackoutWiring =
                    state.activeSabotage?.kind === 'BLACKOUT' &&
                    state.self.alive &&
                    t.taskId === 'fix-wiring';
                  return (
                    <View
                      key={t.taskId}
                      style={[
                        styles.taskRow,
                        isBlackoutWiring
                          ? { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)', opacity: 1 }
                          : { opacity: t.completed ? 0.5 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.taskName,
                            isBlackoutWiring
                              ? { color: '#FDE68A' }
                              : t.completed && { textDecorationLine: 'line-through' },
                          ]}
                        >
                          {def.name}
                        </Text>
                        <Text style={styles.taskRoom}>
                          {def.room}
                          {state.settings.hideManualCodes ? '' : ` • Code ${def.shortCode}`}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: isBlackoutWiring ? '#FBBF24' : t.completed ? '#4ADE80' : '#64748B',
                          fontWeight: '900',
                          fontSize: 12,
                        }}
                      >
                        {isBlackoutWiring ? (t.completed ? 'RE-SCAN' : 'REPAIR') : t.completed ? 'DONE' : 'SCAN'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {/* MEETING PHASE */}
        {state.phase === 'MEETING' && state.meeting ? (
          <View style={styles.panel}>
            <Text style={[styles.kicker, { color: '#EF4444' }]}>
              {state.meeting.reason === 'BODY_REPORTED' ? 'DEAD BODY REPORTED' : 'EMERGENCY MEETING'}
            </Text>
            <Text style={styles.panelTitle}>
              {state.meeting.stage === 'GATHERING'
                ? 'Gather at Meeting Table'
                : state.meeting.stage === 'DISCUSSION'
                  ? `Discussion (${meetingSecLeft}s)`
                  : state.meeting.stage === 'VOTING'
                    ? state.meeting.revealEndsAt
                      ? `Revealing Results (${revealLeftSec}s)`
                      : `Cast Vote (${meetingSecLeft}s)`
                    : 'Ejection Verdict'}
            </Text>

            {state.meeting.stage === 'GATHERING' ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.panelSub}>
                  Arrived: {state.meeting.arrivedCount} / {state.meeting.totalAliveCount} alive players
                </Text>
                {state.self.alive ? (
                  state.self.hasArrived ? (
                    <View style={styles.arrivedBadge}>
                      <Text style={styles.arrivedText}>Checked In! Waiting for remaining crew...</Text>
                    </View>
                  ) : (
                    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 12 }}>
                      <TouchableOpacity style={styles.hereBtn} onPress={handleArrive}>
                        <Text style={styles.hereBtnText}>HERE! (AT MEETING TABLE)</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )
                ) : null}
              </View>
            ) : null}

            {state.meeting.stage === 'DISCUSSION' && state.self.alive ? (
              <View style={{ marginTop: 14 }}>
                <TouchableOpacity
                  disabled={Boolean(state.self.hasVotedNow) || voteNowBusy}
                  style={[
                    styles.hereBtn,
                    {
                      backgroundColor: state.self.hasVotedNow ? '#1E293B' : '#F59E0B',
                    },
                  ]}
                  onPress={handleVoteNow}
                >
                  <Text
                    style={[
                      styles.hereBtnText,
                      { color: state.self.hasVotedNow ? '#4ADE80' : '#020617' },
                    ]}
                  >
                    {state.self.hasVotedNow
                      ? `VOTE NOW AGREED (${state.meeting.voteNowCount ?? 0}/${state.meeting.totalAliveCount})`
                      : `VOTE NOW (${state.meeting.voteNowCount ?? 0}/${state.meeting.totalAliveCount})`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {state.meeting.stage === 'VOTING' ? (
              <View style={{ gap: 8, marginTop: 14 }}>
                {state.meeting.revealEndsAt ? (
                  <Animated.View style={[styles.revealCountdownBox, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.revealCountdownKicker}>ALL VOTES LOCKED</Text>
                    <Text style={styles.revealCountdownText}>
                      Revealing results in {revealLeftSec}s...
                    </Text>
                  </Animated.View>
                ) : null}
                {state.players
                  .filter((p) => p.alive)
                  .map((p) => {
                    const votersForPlayer = state.meeting?.voteBreakdown?.byTarget[p.playerId] || [];
                    const canTap = state.self.alive && !state.self.hasVoted;
                    return (
                      <TouchableOpacity
                        key={p.playerId}
                        disabled={!canTap}
                        style={[
                          styles.voteRow,
                          { flexDirection: 'column', alignItems: 'stretch', opacity: canTap ? 1 : 0.78 },
                        ]}
                        onPress={() => handleVote(p.playerId)}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <AnimatedCrewmate color={p.color} size={32} />
                            <Text style={styles.taskName}>{p.name}</Text>
                          </View>
                          <Text style={{ color: p.hasVoted ? '#4ADE80' : '#EF4444', fontWeight: '900', fontSize: 12 }}>
                            {p.hasVoted ? 'VOTED' : canTap ? 'VOTE' : 'OPEN'}
                          </Text>
                        </View>
                        {votersForPlayer.length > 0 ? (
                          <View style={styles.voterIconsStrip}>
                            {votersForPlayer.map((v) => (
                              <View key={v.playerId} style={styles.voterIconChip}>
                                <AnimatedCrewmate color={v.color} size={20} />
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                <TouchableOpacity
                  disabled={!state.self.alive || state.self.hasVoted}
                  style={[
                    styles.skipBtn,
                    {
                      height: undefined,
                      minHeight: 46,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      opacity: state.self.alive && !state.self.hasVoted ? 1 : 0.75,
                    },
                  ]}
                  onPress={() => handleVote('SKIP')}
                >
                  <Text style={styles.skipBtnText}>
                    {!state.self.alive
                      ? 'Skipped Votes'
                      : state.self.hasVoted
                        ? 'Skip Vote (Vote Recorded)'
                        : 'Skip Vote'}
                  </Text>
                  {(state.meeting.voteBreakdown?.skipped.length || 0) > 0 ? (
                    <View style={[styles.voterIconsStrip, { width: '100%', justifyContent: 'center' }]}>
                      {state.meeting.voteBreakdown!.skipped.map((v) => (
                        <View key={v.playerId} style={styles.voterIconChip}>
                          <AnimatedCrewmate color={v.color} size={20} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            ) : null}

            {state.meeting.stage === 'VERDICT' ? (
              <View style={styles.verdictBox}>
                {state.meeting.ejectedPlayer ? (
                  <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <AnimatedCrewmate
                      color={state.meeting.ejectedPlayer.color}
                      alive={false}
                      size={56}
                    />
                    {state.meeting.ejectedPlayer.playerId === state.self.playerId ? (
                      <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 12, marginTop: 6 }}>
                        YOU WERE VOTED OUT & KILLED
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.verdictText}>
                  {state.meeting.verdictMessage || 'Tallying votes...'}
                </Text>

                {state.meeting.voteBreakdown ? (
                  <View style={{ width: '100%', gap: 8, marginTop: 14 }}>
                    {state.players
                      .filter((p) => (state.meeting?.voteBreakdown?.byTarget[p.playerId]?.length || 0) > 0)
                      .map((target) => (
                        <View key={target.playerId} style={styles.voteRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <AnimatedCrewmate color={target.color} alive={target.alive} size={24} />
                            <Text style={styles.taskName}>{target.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {(state.meeting?.voteBreakdown?.byTarget[target.playerId] || []).map((v) => (
                              <View key={v.playerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <AnimatedCrewmate color={v.color} size={18} />
                                <Text style={{ color: '#CBD5E1', fontSize: 11 }}>{v.name}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    <View style={styles.voteRow}>
                      <Text style={styles.taskName}>Skipped</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {state.meeting.voteBreakdown.skipped.length > 0 ? (
                          state.meeting.voteBreakdown.skipped.map((v) => (
                            <View key={v.playerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <AnimatedCrewmate color={v.color} size={18} />
                              <Text style={{ color: '#CBD5E1', fontSize: 11 }}>{v.name}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={{ color: '#64748B', fontSize: 11 }}>None</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ENDED PHASE (FLASHY WIN vs DREARY LOSE BY TEAM) */}
        {state.phase === 'ENDED' ? (
          <View
            style={[
              styles.panel,
              didPlayerWin
                ? {
                    backgroundColor: state.winner === 'CREWMATES' ? '#07221E' : '#260911',
                    borderColor: '#FBBF24',
                    borderWidth: 2,
                  }
                : {
                    backgroundColor: '#0A0C11',
                    borderColor: '#334155',
                    borderWidth: 1,
                  },
            ]}
          >
            {didPlayerWin ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.kicker, { color: '#FBBF24', letterSpacing: 2 }]}>
                  ★ {state.winner === 'IMPOSTORS' ? 'IMPOSTORS PREVAIL' : isInvestigator ? 'INVESTIGATOR & CREW VICTORY' : 'CREWMATES VICTORY'} ★
                </Text>
                <Animated.View style={{ transform: [{ scale: pulseAnim }], marginVertical: 10 }}>
                  <Text
                    style={{
                      fontSize: 40,
                      fontWeight: '900',
                      letterSpacing: 3,
                      color: state.winner === 'CREWMATES' ? '#6EE7B7' : '#FCA5A5',
                      textShadowColor: '#FBBF24',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 12,
                    }}
                  >
                    VICTORY
                  </Text>
                </Animated.View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
                  {state.players
                    .filter((p) => {
                      const pImp = p.revealedRole === 'IMPOSTOR' || p.revealedRole === 'SHAPESHIFTER';
                      return state.winner === 'IMPOSTORS' ? pImp : !pImp;
                    })
                    .map((w) => (
                      <View key={w.playerId} style={{ alignItems: 'center', gap: 4 }}>
                        <AnimatedCrewmate color={w.color} alive size={40} animate />
                        <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '700' }}>{w.name}</Text>
                      </View>
                    ))}
                </View>
                <Text style={[styles.panelSub, { color: '#E2E8F0', textAlign: 'center' }]}>
                  {state.winReason}
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.kicker, { color: '#64748B', letterSpacing: 2 }]}>
                  {state.winner === 'IMPOSTORS'
                    ? isInvestigator
                      ? 'INVESTIGATOR & CREW DEFEATED'
                      : 'CREWMATES DEFEATED'
                    : 'IMPOSTORS DEFEATED'}
                </Text>
                <View style={{ marginVertical: 12, opacity: 0.72, alignItems: 'center' }}>
                  <AnimatedCrewmate color={state.self.color} alive={false} size={58} />
                  <Text
                    style={{
                      fontSize: 38,
                      fontWeight: '900',
                      letterSpacing: 4,
                      color: '#94A3B8',
                      marginTop: 8,
                    }}
                  >
                    DEFEAT
                  </Text>
                </View>
                <Text style={[styles.panelSub, { color: '#94A3B8', textAlign: 'center' }]}>
                  {state.winReason}
                </Text>
              </View>
            )}

            <View style={{ gap: 8, marginTop: 14, opacity: didPlayerWin ? 1 : 0.78 }}>
              {state.players.map((p) => (
                <View
                  key={p.playerId}
                  style={[
                    styles.taskRow,
                    !didPlayerWin ? { backgroundColor: '#07090D', borderColor: '#1E293B' } : null,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AnimatedCrewmate color={p.color} alive={p.alive} size={30} />
                    <Text style={styles.taskName}>{p.name}</Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '900',
                      fontSize: 12,
                      color:
                        p.revealedRole === 'IMPOSTOR' || p.revealedRole === 'SHAPESHIFTER'
                          ? '#EF4444'
                          : p.revealedRole === 'INVESTIGATOR'
                            ? '#F59E0B'
                            : '#38BDF8',
                    }}
                  >
                    {p.revealedRole || 'CREWMATE'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* IDENTICAL 2-BUTTON STEALTH ACTION BAR */}
      {state.phase === 'PLAYING' ? (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom + 12, 16),
              paddingLeft: Math.max(insets.left + 16, 16),
              paddingRight: Math.max(insets.right + 16, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.scanActionBtn}
            activeOpacity={0.85}
            onPress={() => {
              haptics.impact('medium');
              setShowScanner(true);
            }}
          >
            <Text style={styles.scanActionText}>Scan QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.terminalActionBtn}
            activeOpacity={0.85}
            onPress={() => {
              haptics.impact('light');
              setTerminalUnlocked(false);
              setShowTerminal(true);
            }}
          >
            <Text style={styles.terminalActionText}>Terminal</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PRIVACY-LOCKED PERSONAL SHIP TERMINAL */}
      <Modal
        visible={showTerminal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          setShowTerminal(false);
          setTerminalUnlocked(false);
        }}
      >
        <View style={[styles.modalBackdrop, modalSafePadding]}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.panelTitle}>Ship Terminal</Text>
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={() => {
                  haptics.impact('light');
                  setShowTerminal(false);
                  setTerminalUnlocked(false);
                }}
              >
                <Text style={styles.leaveBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            {!terminalUnlocked ? (
              <View style={{ marginTop: 18 }}>
                <Text style={styles.panelTitle}>Privacy Lock Engaged</Text>
                <Text style={styles.panelSub}>
                  Make sure nobody is looking at your screen before revealing your private clearance or ship controls.
                </Text>
                <TouchableOpacity
                  style={[styles.scanActionBtn, { marginTop: 16 }]}
                  onPress={() => {
                    haptics.impact('medium');
                    setTerminalUnlocked(true);
                  }}
                >
                  <Text style={styles.scanActionText}>Hold to Reveal My Role</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 14, gap: 12 }}>
                <View style={styles.rejoinBox}>
                  <Text style={styles.kicker}>TRUE ROLE CLEARANCE</Text>
                  <Text
                    style={[
                      styles.panelTitle,
                      {
                        color: isImpostorTeam
                          ? '#FF3B30'
                          : isInvestigator
                            ? '#F59E0B'
                            : '#38BDF8',
                      },
                    ]}
                  >
                    {state.self.secretRole}
                  </Text>
                  <Text style={styles.panelSub}>
                    Rejoin Code: {state.self.rejoinCode}
                  </Text>
                </View>

                {isImpostorTeam && state.self.alive ? (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.sectionHeading}>
                      Kill QR Cooldown: {localKillRemaining > 0 ? `${localKillRemaining}s` : 'READY (Use Scan QR)'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        disabled={localSabotageRemaining > 0 || Boolean(state.activeSabotage) || sabotageBusy}
                        style={[
                          styles.sabotageBtn,
                          {
                            backgroundColor: '#F59E0B',
                            opacity:
                              localSabotageRemaining > 0 || state.activeSabotage ? 0.45 : 1,
                          },
                        ]}
                        onPress={() => handleTriggerSabotage('BLACKOUT')}
                      >
                        <Text style={styles.sabotageBtnText}>
                          {localSabotageRemaining > 0 ? `Wait ${localSabotageRemaining}s` : 'Kill Power'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={localSabotageRemaining > 0 || Boolean(state.activeSabotage) || sabotageBusy}
                        style={[
                          styles.sabotageBtn,
                          {
                            backgroundColor: '#EF4444',
                            opacity:
                              localSabotageRemaining > 0 || state.activeSabotage ? 0.45 : 1,
                          },
                        ]}
                        onPress={() => handleTriggerSabotage('SIGNAL_JAM')}
                      >
                        <Text style={styles.sabotageBtnText}>
                          {localSabotageRemaining > 0 ? `Wait ${localSabotageRemaining}s` : 'Signal Jam (60s)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {isInvestigator && state.self.alive ? (
                  <Text style={styles.panelSub}>
                    Forensic Scan Cooldown: {localScanRemaining > 0 ? `${localScanRemaining}s` : 'READY (Use Scan QR on a player badge)'}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => setTerminalUnlocked(false)}
                >
                  <Text style={[styles.leaveBtnText, { textAlign: 'center' }]}>Lock Screen</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* START-OF-GAME ROLE REVEAL SPLASH */}
      <RoleSplashOverlay
        visible={showRoleSplash}
        role={state.self.secretRole}
        selfColor={state.self.color}
        selfName={state.self.name}
        impostorCount={state.settings.impostorCount}
        investigatorCount={state.settings.investigatorCount}
        teammates={state.self.teammates}
        onDismiss={() => setShowRoleSplash(false)}
      />

      {/* NATIVE CAMERA QR SCANNER */}
      <NativeQrScannerModal
        visible={showScanner}
        hideManualCodes={Boolean(state.settings.hideManualCodes)}
        onDetected={handleQrDetected}
        onClose={() => setShowScanner(false)}
      />

      {/* 16 SKELD MINI-GAMES */}
      <TaskMiniGamesModal
        task={activeTask}
        isBlackoutRepair={
          Boolean(activeTask && activeTask.id === 'fix-wiring' && state.activeSabotage?.kind === 'BLACKOUT')
        }
        isImpostor={isImpostorTeam}
        onComplete={handleTaskCompleted}
        onClose={() => setActiveTask(null)}
      />

      {/* FORENSIC SCAN RESULT MODAL */}
      <Modal visible={Boolean(forensicResult)} transparent statusBarTranslucent animationType="fade">
        <View style={[styles.modalBackdrop, modalSafePadding]}>
          {forensicResult ? (
            <View style={styles.modalCard}>
              <Text style={[styles.kicker, { color: '#F59E0B' }]}>FORENSIC SCAN RESULT</Text>
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <AnimatedCrewmate color={forensicResult.targetColor} size={74} animate />
                <Text style={[styles.panelTitle, { marginTop: 10 }]}>
                  {forensicResult.targetName}
                </Text>
                <Text style={styles.panelSub}>
                  Suit Color: {getColorDef(forensicResult.targetColor).label}
                </Text>
                <Text
                  style={[
                    styles.panelTitle,
                    {
                      marginTop: 12,
                      color:
                        forensicResult.reportedAlignment === 'IMPOSTOR' ? '#FF3B30' : '#22C55E',
                    },
                  ]}
                >
                  {forensicResult.reportedAlignment}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.scanActionBtn}
                onPress={() => setForensicResult(null)}
              >
                <Text style={styles.scanActionText}>Dismiss Report</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* DEAD BODY FOUND MODAL */}
      <Modal visible={Boolean(deadBodyFound) && state.phase === 'PLAYING'} transparent statusBarTranslucent animationType="fade">
        <View style={[styles.modalBackdrop, modalSafePadding]}>
          {deadBodyFound ? (
            <View style={[styles.modalCard, { borderColor: '#EF4444' }]}>
              <Text style={[styles.kicker, { color: '#EF4444', textAlign: 'center' }]}>
                DEAD BODY FOUND
              </Text>
              <View style={{ alignItems: 'center', marginVertical: 14 }}>
                <AnimatedCrewmate color={deadBodyFound.victimColor} alive={false} size={80} />
                <Text style={[styles.panelTitle, { marginTop: 10 }]}>
                  {deadBodyFound.victimName}
                </Text>
                <Text style={styles.panelSub}>
                  Suit Color: {getColorDef(deadBodyFound.victimColor).label}
                </Text>
              </View>
              <TouchableOpacity
                disabled={reportingBody}
                style={[styles.scanActionBtn, { backgroundColor: '#EF4444', marginBottom: 10 }]}
                onPress={handleReportDeadBody}
              >
                <Text style={[styles.scanActionText, { color: '#FFFFFF' }]}>
                  {reportingBody ? 'CALLING MEETING...' : 'CALL EMERGENCY MEETING'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={reportingBody}
                style={styles.leaveBtn}
                onPress={() => setDeadBodyFound(null)}
              >
                <Text style={[styles.leaveBtnText, { textAlign: 'center' }]}>
                  Dismiss (Do Not Report)
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* YOU HAVE BEEN KILLED MODAL */}
      <Modal visible={showKilledModal} transparent statusBarTranslucent animationType="fade">
        <View style={[styles.modalBackdrop, modalSafePadding]}>
          <View style={[styles.modalCard, { borderColor: '#EF4444' }]}>
            <View style={{ alignItems: 'center' }}>
              <AnimatedCrewmate color={state.self.color} alive={false} size={96} />
              <Text style={[styles.panelTitle, { color: '#EF4444', marginTop: 12, textAlign: 'center' }]}>
                YOU HAVE BEEN KILLED
              </Text>
              <Text style={[styles.panelSub, { textAlign: 'center', marginTop: 8 }]}>
                Stay quiet at your spot so another Crewmate can scan your back QR badge and report the body!
              </Text>
              <TouchableOpacity
                style={[styles.scanActionBtn, { marginTop: 18, width: '100%', backgroundColor: '#EF4444' }]}
                onPress={() => setShowKilledModal(false)}
              >
                <Text style={styles.scanActionText}>Enter Ghost Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  ghostTag: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  leaveBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  leaveBtnText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 12,
  },
  toast: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    color: '#E0F2FE',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollContent: {
    paddingTop: 16,
    gap: 12,
  },
  panel: {
    backgroundColor: '#131A26',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#94A3B8',
  },
  panelTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 3,
  },
  panelSub: {
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    marginTop: 6,
  },
  rejoinBox: {
    marginTop: 14,
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  rejoinCode: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#38BDF8',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#CBD5E1',
  },
  colorSwitchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  colorSwitchCell: {
    width: '31.4%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorSwitchText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  rosterCell: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    padding: 10,
  },
  rosterName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  sabotageBanner: {
    backgroundColor: '#1A1215',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  sabotageTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sabotageSub: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 4,
  },
  primaryActionMini: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  primaryActionMiniText: {
    color: '#060A12',
    fontSize: 13,
    fontWeight: '900',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stealthChip: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  pctText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22C55E',
  },
  progressTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 99,
    backgroundColor: '#0B0F17',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 99,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  taskName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  taskRoom: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  arrivedBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.45)',
    borderRadius: 12,
    padding: 14,
  },
  arrivedText: {
    color: '#4ADE80',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },
  hereBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hereBtnText: {
    color: '#060A12',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  skipBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  skipBtnText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 14,
  },
  voterIconsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  voterIconChip: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#334155',
  },
  revealCountdownBox: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 2,
    borderColor: '#FBBF24',
    alignItems: 'center',
  },
  revealCountdownKicker: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  revealCountdownText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  verdictBox: {
    marginTop: 14,
    backgroundColor: '#0B0F17',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  verdictText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 15, 23, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  scanActionBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanActionText: {
    color: '#060A12',
    fontSize: 15,
    fontWeight: '900',
  },
  terminalActionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminalActionText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#131A26',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  sabotageBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sabotageBtnText: {
    color: '#060A12',
    fontWeight: '900',
    fontSize: 13,
  },
});
