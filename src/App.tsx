import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Monitor, QrCode, Smartphone } from 'lucide-react';
import {
  ClientGameState,
  HostGameState,
  ParsedQrAction,
  PLAYER_COLORS,
  PlayerColorId,
} from './shared/skeldData';
import { CrewmateAvatar } from './components/CrewmateAvatar';
import { HostDashboard } from './components/HostDashboard';
import { PlayerHud } from './components/PlayerHud';
import { QrScannerModal, QrScanValidationResult } from './components/QrScannerModal';
import { haptics } from './utils/haptics';
import { soundEngine } from './utils/sound';

type AppScreen = 'TITLE' | 'JOIN_FORM' | 'HOST' | 'PLAYER';

const SAVED_PLAYER_SESSION_KEY = 'skeld_irl_saved_player_session';

interface SavedPlayerSession {
  sessionCode: string;
  rejoinCode: string;
}

function readSavedPlayerSession(): SavedPlayerSession | null {
  const validate = (raw: unknown): SavedPlayerSession | null => {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as { sessionCode?: unknown; rejoinCode?: unknown };
    const sessionCode = typeof rec.sessionCode === 'string' ? rec.sessionCode.trim().toUpperCase() : '';
    const rejoinCode = typeof rec.rejoinCode === 'string' ? rec.rejoinCode.trim().toUpperCase() : '';
    if (/^[A-Z0-9]{4,8}$/.test(sessionCode) && /^[A-Z0-9]{4,10}$/.test(rejoinCode)) {
      return { sessionCode, rejoinCode };
    }
    return null;
  };

  try {
    const rawLocal = window.localStorage.getItem(SAVED_PLAYER_SESSION_KEY);
    if (rawLocal) {
      const parsed = validate(JSON.parse(rawLocal));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore storage read issues
  }

  try {
    const rawAndroid = window.AmongUsAndroid?.getSavedPlayerSessionJson?.();
    if (rawAndroid) {
      const parsed = validate(JSON.parse(rawAndroid));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore native bridge JSON issues
  }

  return null;
}

function persistPlayerSession(sessionCode: string, rejoinCode: string): void {
  const cleanSession = sessionCode.trim().toUpperCase();
  const cleanRejoin = rejoinCode.trim().toUpperCase();
  if (!cleanSession || !cleanRejoin) return;
  try {
    window.localStorage.setItem(
      SAVED_PLAYER_SESSION_KEY,
      JSON.stringify({ sessionCode: cleanSession, rejoinCode: cleanRejoin }),
    );
  } catch {
    // Ignore localStorage quota/private mode errors
  }
  try {
    window.AmongUsAndroid?.savePlayerSession?.(cleanSession, cleanRejoin);
  } catch {
    // Ignore native bridge errors
  }
}

function clearSavedPlayerSession(): void {
  try {
    window.localStorage.removeItem(SAVED_PLAYER_SESSION_KEY);
  } catch {
    // Ignore localStorage errors
  }
  try {
    window.AmongUsAndroid?.clearPlayerSession?.();
  } catch {
    // Ignore native bridge errors
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('TITLE');

  // Host state (token held strictly in memory)
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [hostState, setHostState] = useState<HostGameState | null>(null);

  // Player state (token held in memory; session + rejoin codes persisted for seamless auto-rejoin)
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<ClientGameState | null>(null);

  // Join form state
  const [joinMode, setJoinMode] = useState<'NEW' | 'REJOIN'>('NEW');
  const [joinCode, setJoinCode] = useState('');
  const [rejoinCodeInput, setRejoinCodeInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedColor, setSelectedColor] = useState<PlayerColorId>('red');
  const [takenColors, setTakenColors] = useState<PlayerColorId[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const urlJoin = params.get('join')?.trim().toUpperCase();
    const urlRejoin = params.get('rejoin')?.trim().toUpperCase();
    if (urlJoin && urlRejoin) return true;
    const saved = readSavedPlayerSession();
    return Boolean(saved && (!urlJoin || urlJoin === saved.sessionCode));
  });
  const [showJoinQrScanner, setShowJoinQrScanner] = useState(false);
  const [wsReconnectNonce, setWsReconnectNonce] = useState(0);

  // Real-time event triggers
  const [killedAlertTrigger, setKilledAlertTrigger] = useState(0);
  const [meetingAlertTrigger, setMeetingAlertTrigger] = useState(0);
  const [sabotageAlertTrigger, setSabotageAlertTrigger] = useState(0);
  const [missionStartedTrigger, setMissionStartedTrigger] = useState(0);
  const [shieldBlockedEvent, setShieldBlockedEvent] = useState<{
    seq: number;
    targetId?: string;
    targetName?: string;
    guardianId?: string;
  } | null>(null);
  const [sheriffActionEvent, setSheriffActionEvent] = useState<{
    seq: number;
    hit: boolean;
    targetName?: string;
    sheriffName?: string;
  } | null>(null);
  const [hostEvent, setHostEvent] = useState<{
    seq: number;
    type: string;
    payload?: Record<string, unknown>;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Keep local + Android native storage synced whenever playerState has valid codes
  useEffect(() => {
    if (screen === 'PLAYER' && playerState?.sessionCode && playerState.self?.rejoinCode) {
      persistPlayerSession(playerState.sessionCode, playerState.self.rejoinCode);
    }
  }, [screen, playerState?.sessionCode, playerState?.self?.rejoinCode]);

  // Startup: handle ?join=CODE&rejoin=CODE QR deep-links OR auto-rejoin saved active session
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const urlJoin = params.get('join')?.trim().toUpperCase() || '';
    const urlRejoin = params.get('rejoin')?.trim().toUpperCase() || '';
    const hasUrlJoin = /^[A-Z0-9]{4,8}$/.test(urlJoin);
    const hasUrlRejoin = /^[A-Z0-9]{4,10}$/.test(urlRejoin);

    if (hasUrlJoin || hasUrlRejoin) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // Ignore history restriction
      }
    }

    const restore = async () => {
      // 1. Explicit Rejoin QR deep-link (?join=CODE&rejoin=CODE)
      if (hasUrlJoin && hasUrlRejoin) {
        try {
          const res = await fetch(`/api/sessions/${urlJoin}/rejoin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejoinCode: urlRejoin }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (res.ok && data.state && data.playerToken) {
            persistPlayerSession(data.state.sessionCode, data.state.self?.rejoinCode || urlRejoin);
            haptics.notify('success');
            setPlayerToken(data.playerToken);
            setPlayerState(data.state);
            setScreen('PLAYER');
          } else {
            setJoinCode(urlJoin);
            setRejoinCodeInput(urlRejoin);
            setJoinMode('REJOIN');
            setJoinError(data.error || 'Could not auto-rejoin with this QR code.');
            setScreen('JOIN_FORM');
          }
        } catch {
          if (cancelled) return;
          setJoinCode(urlJoin);
          setRejoinCodeInput(urlRejoin);
          setJoinMode('REJOIN');
          setJoinError('Could not reach Host PC to rejoin. Check Wi-Fi and tap Rejoin.');
          setScreen('JOIN_FORM');
        } finally {
          if (!cancelled) setRestoringSession(false);
        }
        return;
      }

      // 2. Saved Mission Code + Player Rejoin Code (closed / switched apps)
      const saved = readSavedPlayerSession();
      if (saved && (!hasUrlJoin || urlJoin === saved.sessionCode)) {
        try {
          const pubRes = await fetch(`/api/sessions/${saved.sessionCode}/public`);
          if (cancelled) return;
          if (pubRes.status === 400 || pubRes.status === 404) {
            clearSavedPlayerSession();
          } else if (pubRes.ok) {
            const pubData = (await pubRes.json()) as { phase?: string };
            if (pubData.phase === 'ENDED') {
              clearSavedPlayerSession();
            } else {
              const rejoinRes = await fetch(`/api/sessions/${saved.sessionCode}/rejoin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rejoinCode: saved.rejoinCode }),
              });
              const rejoinData = await rejoinRes.json();
              if (cancelled) return;
              if (rejoinRes.ok && rejoinData.state && rejoinData.playerToken) {
                persistPlayerSession(
                  rejoinData.state.sessionCode,
                  rejoinData.state.self?.rejoinCode || saved.rejoinCode,
                );
                haptics.notify('success');
                setPlayerToken(rejoinData.playerToken);
                setPlayerState(rejoinData.state);
                setScreen('PLAYER');
                setRestoringSession(false);
                return;
              }
              if (
                rejoinRes.status === 400 ||
                rejoinRes.status === 403 ||
                rejoinRes.status === 404
              ) {
                clearSavedPlayerSession();
              }
            }
          }
        } catch {
          // Transient network error: preserve saved session codes and pre-fill Rejoin form
          if (!cancelled && !hasUrlJoin) {
            setJoinCode(saved.sessionCode);
            setRejoinCodeInput(saved.rejoinCode);
            setJoinMode('REJOIN');
          }
        }
      }

      if (cancelled) return;
      if (hasUrlJoin) {
        setJoinCode(urlJoin);
        setScreen('JOIN_FORM');
      }
      setRestoringSession(false);
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedColorRef = useRef<PlayerColorId>(selectedColor);
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  // Real-time taken colors in Join form whenever joinCode is entered
  useEffect(() => {
    const cleanCode = joinCode.trim().toUpperCase();
    if (screen !== 'JOIN_FORM' || cleanCode.length < 4) {
      setTakenColors([]);
      return;
    }

    let active = true;
    let publicWs: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const applyTaken = (colors: PlayerColorId[]) => {
      if (!active) return;
      setTakenColors(colors);
      if (colors.includes(selectedColorRef.current)) {
        const firstFree = PLAYER_COLORS.find((c) => !colors.includes(c.id));
        if (firstFree) setSelectedColor(firstFree.id);
      }
    };

    const fetchPublic = async () => {
      try {
        const res = await fetch(`/api/sessions/${cleanCode}/public`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.takenColors)) {
          applyTaken(data.takenColors);
        }
      } catch {
        // Ignore transient lookup errors while typing
      }
    };

    const openPublicWs = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      publicWs = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe', sessionCode: cleanCode, role: 'PUBLIC' }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as {
            type?: string;
            payload?: { takenColors?: PlayerColorId[] };
          };
          if (msg.type === 'state:public' && Array.isArray(msg.payload?.takenColors)) {
            applyTaken(msg.payload.takenColors);
          }
        } catch {
          // Ignore malformed frame
        }
      };
      ws.onclose = () => {
        if (active) {
          reconnectTimer = setTimeout(openPublicWs, 2000);
        }
      };
    };

    fetchPublic();
    openPublicWs();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (publicWs) publicWs.close();
    };
  }, [screen, joinCode]);

  // WebSocket lifecycle with automatic reconnect
  const connectWebSocket = useCallback(
    (sessionCode: string, role: 'HOST' | 'PLAYER', token: string) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      let closedManually = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      const openSocket = () => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              sessionCode,
              role,
              token,
            }),
          );
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data) as { type: string; payload?: unknown };
            const payloadRec =
              msg.payload && typeof msg.payload === 'object'
                ? (msg.payload as Record<string, unknown>)
                : undefined;

            if (msg.type === 'state:host' && msg.payload) {
              setHostState(msg.payload as HostGameState);
            } else if (msg.type === 'state:player' && msg.payload) {
              setPlayerState(msg.payload as ClientGameState);
            } else if (msg.type === 'player:killed') {
              setKilledAlertTrigger((n) => n + 1);
            } else if (msg.type === 'meeting:alert') {
              setMeetingAlertTrigger((n) => n + 1);
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (msg.type === 'sabotage:alert') {
              setSabotageAlertTrigger((n) => n + 1);
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (msg.type === 'shield:blocked') {
              setShieldBlockedEvent({
                seq: Date.now() + Math.random(),
                targetId: typeof payloadRec?.targetId === 'string' ? payloadRec.targetId : undefined,
                targetName: typeof payloadRec?.targetName === 'string' ? payloadRec.targetName : undefined,
                guardianId: typeof payloadRec?.guardianId === 'string' ? payloadRec.guardianId : undefined,
              });
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (msg.type === 'sheriff:action') {
              setSheriffActionEvent({
                seq: Date.now() + Math.random(),
                hit: Boolean(payloadRec?.hit),
                targetName: typeof payloadRec?.targetName === 'string' ? payloadRec.targetName : undefined,
                sheriffName: typeof payloadRec?.sheriffName === 'string' ? payloadRec.sheriffName : undefined,
              });
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (
              msg.type === 'sabotage:cleared' ||
              msg.type === 'visual:task' ||
              msg.type === 'shield:deployed' ||
              msg.type === 'meeting:verdict' ||
              msg.type === 'game:ended'
            ) {
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (msg.type === 'mission:started') {
              setMissionStartedTrigger((n) => n + 1);
              setHostEvent({ seq: Date.now() + Math.random(), type: msg.type, payload: payloadRec });
            } else if (msg.type === 'player:removed') {
              closedManually = true;
              haptics.notify('warning');
              clearSavedPlayerSession();
              setPlayerToken(null);
              setPlayerState(null);
              setScreen('TITLE');
            }
          } catch {
            // Ignore malformed socket frames
          }
        };

        ws.onclose = () => {
          if (!closedManually) {
            reconnectTimer = setTimeout(openSocket, 1500);
          }
        };
      };

      openSocket();

      return () => {
        closedManually = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    },
    [],
  );

  useEffect(() => {
    if (screen === 'HOST' && hostState && hostToken) {
      return connectWebSocket(hostState.sessionCode, 'HOST', hostToken);
    }
    if (screen === 'PLAYER' && playerState && playerToken) {
      return connectWebSocket(playerState.sessionCode, 'PLAYER', playerToken);
    }
    return undefined;
  }, [
    screen,
    hostState?.sessionCode,
    hostToken,
    playerState?.sessionCode,
    playerToken,
    wsReconnectNonce,
    connectWebSocket,
  ]);

  // Immediately refresh player state & reconnect WebSocket when returning from another app
  useEffect(() => {
    if (screen !== 'PLAYER' || !playerState?.sessionCode || !playerToken) return;

    const syncOnResume = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/sessions/${playerState.sessionCode}/player`, {
          headers: { Authorization: `Bearer ${playerToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { state?: ClientGameState };
          if (data.state) {
            setPlayerState(data.state);
          }
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setWsReconnectNonce((n) => n + 1);
          }
          return;
        }
        if ((res.status === 403 || res.status === 404) && playerState.self?.rejoinCode) {
          const rejoinRes = await fetch(`/api/sessions/${playerState.sessionCode}/rejoin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejoinCode: playerState.self.rejoinCode }),
          });
          const rejoinData = await rejoinRes.json();
          if (rejoinRes.ok && rejoinData.state && rejoinData.playerToken) {
            setPlayerToken(rejoinData.playerToken);
            setPlayerState(rejoinData.state);
          } else if (rejoinRes.status === 400 || rejoinRes.status === 403 || rejoinRes.status === 404) {
            clearSavedPlayerSession();
            setPlayerToken(null);
            setPlayerState(null);
            setScreen('TITLE');
          }
        }
      } catch {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setWsReconnectNonce((n) => n + 1);
        }
      }
    };

    const onVisibility = () => {
      void syncOnResume();
    };
    const onFocus = () => {
      void syncOnResume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [screen, playerState?.sessionCode, playerState?.self?.rejoinCode, playerToken]);

  const handleCreateHostSession = async () => {
    soundEngine.playClick();
    haptics.impact('medium');
    setLoading(true);
    setJoinError(null);
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create session');
      setHostToken(data.hostToken);
      setHostState(data.state);
      setScreen('HOST');
    } catch (err) {
      haptics.notify('error');
      setJoinError(err instanceof Error ? err.message : 'Failed to boot host command.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    haptics.impact('medium');
    setLoading(true);
    setJoinError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/api/sessions/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName.trim(),
          color: selectedColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join session');
      haptics.notify('success');
      if (data.state?.sessionCode && data.state?.self?.rejoinCode) {
        persistPlayerSession(data.state.sessionCode, data.state.self.rejoinCode);
      }
      setPlayerToken(data.playerToken);
      setPlayerState(data.state);
      setScreen('PLAYER');
    } catch (err) {
      haptics.notify('error');
      setJoinError(err instanceof Error ? err.message : 'Unable to join session.');
    } finally {
      setLoading(false);
    }
  };

  const performRejoin = async (rawSessionCode: string, rawRejoinCode: string): Promise<boolean> => {
    soundEngine.playClick();
    haptics.impact('medium');
    setLoading(true);
    setJoinError(null);
    try {
      const code = rawSessionCode.trim().toUpperCase();
      const rejoin = rawRejoinCode.trim().toUpperCase();
      const res = await fetch(`/api/sessions/${code}/rejoin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejoinCode: rejoin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rejoin session');
      haptics.notify('success');
      persistPlayerSession(
        data.state?.sessionCode || code,
        data.state?.self?.rejoinCode || rejoin,
      );
      setPlayerToken(data.playerToken);
      setPlayerState(data.state);
      setScreen('PLAYER');
      return true;
    } catch (err) {
      haptics.notify('error');
      setJoinError(err instanceof Error ? err.message : 'Unable to rejoin session.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRejoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performRejoin(joinCode, rejoinCodeInput);
  };

  const handleJoinScreenQrDetected = async (
    parsed: ParsedQrAction,
  ): Promise<QrScanValidationResult> => {
    if (parsed.kind === 'REJOIN') {
      setShowJoinQrScanner(false);
      setJoinMode('REJOIN');
      setJoinCode(parsed.sessionCode);
      setRejoinCodeInput(parsed.rejoinCode);
      await performRejoin(parsed.sessionCode, parsed.rejoinCode);
      return { valid: true };
    }
    if (parsed.kind === 'JOIN') {
      setShowJoinQrScanner(false);
      setJoinCode(parsed.sessionCode);
      setJoinError(null);
      return { valid: true };
    }
    if (parsed.sessionCode) {
      setShowJoinQrScanner(false);
      setJoinCode(parsed.sessionCode);
      setJoinError(null);
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Please scan the Host PC Join Mission QR or a Crew Member Rejoin QR code.',
    };
  };

  // AUTO-RESTORE SPLASH WHILE CHECKING SAVED MISSION
  if (restoringSession) {
    return (
      <div className="min-h-dvh bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-[#151C28] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl"
        >
          <div className="flex justify-center">
            <CrewmateAvatar color="cyan" animate size={56} />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-white">Reconnecting to The Skeld</h1>
            <p className="text-xs text-slate-400">
              Checking your saved Mission &amp; Rejoin codes for an active game...
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRestoringSession(false)}
            className="w-full min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  // HOST COMMAND VIEW
  if (screen === 'HOST' && hostState && hostToken) {
    return (
      <HostDashboard
        state={hostState}
        hostToken={hostToken}
        hostEvent={hostEvent}
        onUpdateState={setHostState}
        onExitHost={() => {
          setHostToken(null);
          setHostState(null);
          setScreen('TITLE');
        }}
      />
    );
  }

  // SMARTPHONE PLAYER HUD
  if (screen === 'PLAYER' && playerState && playerToken) {
    return (
      <PlayerHud
        state={playerState}
        playerToken={playerToken}
        killedAlertTrigger={killedAlertTrigger}
        meetingAlertTrigger={meetingAlertTrigger}
        sabotageAlertTrigger={sabotageAlertTrigger}
        missionStartedTrigger={missionStartedTrigger}
        shieldBlockedEvent={shieldBlockedEvent}
        sheriffActionEvent={sheriffActionEvent}
        onUpdateState={setPlayerState}
        onLeaveSession={() => {
          clearSavedPlayerSession();
          setPlayerToken(null);
          setPlayerState(null);
          setScreen('TITLE');
        }}
      />
    );
  }

  // JOIN MISSION FORM (SMARTPHONE)
  if (screen === 'JOIN_FORM') {
    return (
      <div className="min-h-dvh bg-[#0B0F17] text-slate-100 flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="w-full max-w-md bg-[#151C28] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                haptics.impact('light');
                setScreen('TITLE');
              }}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
              aria-label="Back to title"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-3xl font-bold text-white leading-none">
                Board The Skeld
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {joinMode === 'NEW'
                  ? 'Pick the suit color matching your back QR badge'
                  : 'Re-enter an active game using your Lobby-Player code'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              haptics.impact('light');
              setJoinError(null);
              setShowJoinQrScanner(true);
            }}
            className="w-full min-h-[46px] px-4 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode className="w-4 h-4 text-cyan-300" />
            <span>Scan Join or Rejoin QR Code</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                haptics.selection();
                setJoinMode('NEW');
                setJoinError(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors ${
                joinMode === 'NEW'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New Player
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                haptics.selection();
                setJoinMode('REJOIN');
                setJoinError(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors ${
                joinMode === 'REJOIN'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rejoin Game
            </button>
          </div>

          {joinMode === 'NEW' ? (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mission Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-white/15 font-mono text-sm uppercase tracking-wider text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Callsign
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select Suit Color (12 Suits)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_COLORS.map((color) => {
                    const isTaken = takenColors.includes(color.id);
                    const isSelected = selectedColor === color.id;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        disabled={isTaken}
                        onClick={() => {
                          soundEngine.playClick();
                          haptics.selection();
                          setSelectedColor(color.id);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isTaken
                            ? 'bg-slate-950/50 border-white/5 opacity-35 cursor-not-allowed'
                            : isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 scale-[1.03]'
                              : 'bg-slate-950/60 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <CrewmateAvatar color={color.id} size={32} />
                        <span className="text-[11px] font-medium text-slate-200">
                          {isTaken ? 'Taken' : color.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {joinError && (
                <div className="text-xs text-red-300 bg-red-500/15 border border-red-500/40 rounded-xl px-3 py-2.5">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !joinCode.trim() || !playerName.trim()}
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm"
              >
                {loading ? 'Connecting...' : 'Join Mission'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRejoinSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mission Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-white/15 font-mono text-sm uppercase tracking-wider text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Player Rejoin Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={rejoinCodeInput}
                    onChange={(e) => setRejoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="K7M9P"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-slate-950 border border-white/15 font-mono text-sm uppercase tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Refreshed or closed your browser? Enter your 5-character Player Rejoin Code shown on your HUD (or ask the Host PC to read it from the Crew Manifest).
              </p>

              {joinError && (
                <div className="text-xs text-red-300 bg-red-500/15 border border-red-500/40 rounded-xl px-3 py-2.5">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !joinCode.trim() || !rejoinCodeInput.trim()}
                className="w-full min-h-[48px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-sm"
              >
                {loading ? 'Restoring...' : 'Rejoin Active Game'}
              </button>
            </form>
          )}
        </motion.div>

        <AnimatePresence>
          {showJoinQrScanner && (
            <QrScannerModal
              title="Scan Join or Rejoin QR"
              subtitle="Scan the Host PC Join QR or a Crew Member Rejoin QR from Mission Control."
              accentColor="cyan"
              hideManualCodes
              onDetected={handleJoinScreenQrDetected}
              onClose={() => setShowJoinQrScanner(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // FULL-VIEWPORT TITLE SCREEN (GAME SHELL)
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#0B0F17] flex items-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Generated Key-Art Backdrop with contrast scrim */}
      <motion.img
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.85 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        src="/src/assets/images/skeld_title_backdrop_1795510185116.jpg"
        alt="Orbital starship command bridge"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17] via-[#0B0F17]/85 to-[#0B0F17]/25" />

      <div className="relative z-10 max-w-6xl w-full mx-auto px-6 py-10 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="max-w-xl space-y-6"
        >
          {/* Bespoke SVG Title Lockup */}
          <div className="space-y-3">
            <motion.svg
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 24 }}
              viewBox="0 0 420 76"
              className="w-full max-w-[380px] h-auto"
              role="img"
              aria-label="AMONG-US IRL"
            >
              <rect x="2" y="10" width="46" height="54" rx="14" fill="#EF4444" stroke="#0F172A" strokeWidth="3" />
              <rect x="20" y="20" width="26" height="16" rx="8" fill="#7DD3FC" stroke="#0F172A" strokeWidth="2.5" />
              <text
                x="64"
                y="55"
                fill="#FFFFFF"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="700"
                fontSize="52"
                letterSpacing="2"
              >
                AMONG-US IRL
              </text>
            </motion.svg>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.22 }}
              className="text-base text-slate-300 leading-relaxed max-w-md text-balance"
            >
              Turn any physical space into The Skeld. Scan QR stations to complete 16 interactive tasks, investigate suspects, report bodies, and survive emergency votes.
            </motion.p>
          </div>

          {joinError && (
            <div className="text-xs text-red-300 bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3 max-w-md">
              {joinError}
            </div>
          )}

          {/* Primary Launch Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 pt-2 max-w-md"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={loading}
              onClick={handleCreateHostSession}
              className="flex-1 min-h-[52px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5"
            >
              <Monitor className="w-5 h-5" />
              <span>{loading ? 'Booting...' : 'Host Game (PC)'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                soundEngine.playClick();
                haptics.impact('medium');
                setScreen('JOIN_FORM');
              }}
              className="flex-1 min-h-[52px] px-5 py-3 rounded-xl bg-[#151C28] hover:bg-[#1E293B] border border-white/15 text-white font-bold text-sm flex items-center justify-center gap-2.5"
            >
              <Smartphone className="w-5 h-5 text-cyan-300" />
              <span>Join on Phone</span>
            </motion.button>
          </motion.div>

          {/* Single Flat Control-Hint Line */}
          <div className="text-xs text-slate-400 font-mono pt-1">
            Host PC prints QR badges &amp; tasks · Smartphones scan QR codes to play
          </div>
        </motion.div>
      </div>
    </div>
  );
}
