import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import {
  ClientGameState,
  HostGameState,
  PLAYER_COLORS,
  PlayerColorId,
} from './shared/skeldData';
import { CrewmateAvatar } from './components/CrewmateAvatar';
import { HostDashboard } from './components/HostDashboard';
import { PlayerHud } from './components/PlayerHud';
import { soundEngine } from './utils/sound';

type AppScreen = 'TITLE' | 'JOIN_FORM' | 'HOST' | 'PLAYER';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('TITLE');

  // Host state (token held strictly in memory)
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [hostState, setHostState] = useState<HostGameState | null>(null);

  // Player state (token held strictly in memory)
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

  // Real-time event triggers
  const [killedAlertTrigger, setKilledAlertTrigger] = useState(0);
  const [meetingAlertTrigger, setMeetingAlertTrigger] = useState(0);
  const [sabotageAlertTrigger, setSabotageAlertTrigger] = useState(0);
  const [missionStartedTrigger, setMissionStartedTrigger] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  // Detect ?join=CODE URL parameter when smartphone scans Host PC Join QR
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join')?.trim().toUpperCase();
    if (code && /^[A-Z0-9]{4,8}$/.test(code)) {
      setJoinCode(code);
      setScreen('JOIN_FORM');
    }
  }, []);

  // Poll taken colors in Join form whenever joinCode reaches 6 chars
  useEffect(() => {
    if (screen !== 'JOIN_FORM' || joinCode.trim().length < 4) {
      setTakenColors([]);
      return;
    }
    let active = true;
    const fetchPublic = async () => {
      try {
        const res = await fetch(`/api/sessions/${joinCode.trim().toUpperCase()}/public`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.takenColors)) {
          setTakenColors(data.takenColors);
          const firstFree = PLAYER_COLORS.find((c) => !data.takenColors.includes(c.id));
          if (firstFree && data.takenColors.includes(selectedColor)) {
            setSelectedColor(firstFree.id);
          }
        }
      } catch {
        // Ignore transient lookup errors while typing
      }
    };
    fetchPublic();
    return () => {
      active = false;
    };
  }, [screen, joinCode, selectedColor]);

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
            if (msg.type === 'state:host' && msg.payload) {
              setHostState(msg.payload as HostGameState);
            } else if (msg.type === 'state:player' && msg.payload) {
              setPlayerState(msg.payload as ClientGameState);
            } else if (msg.type === 'player:killed') {
              setKilledAlertTrigger((n) => n + 1);
            } else if (msg.type === 'meeting:alert') {
              setMeetingAlertTrigger((n) => n + 1);
            } else if (msg.type === 'sabotage:alert') {
              setSabotageAlertTrigger((n) => n + 1);
            } else if (msg.type === 'mission:started') {
              setMissionStartedTrigger((n) => n + 1);
            } else if (msg.type === 'player:removed') {
              closedManually = true;
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
  }, [screen, hostState?.sessionCode, hostToken, playerState?.sessionCode, playerToken, connectWebSocket]);

  const handleCreateHostSession = async () => {
    soundEngine.playClick();
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
      setJoinError(err instanceof Error ? err.message : 'Failed to boot host command.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
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
      setPlayerToken(data.playerToken);
      setPlayerState(data.state);
      setScreen('PLAYER');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Unable to join session.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    setLoading(true);
    setJoinError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/api/sessions/${code}/rejoin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejoinCode: rejoinCodeInput.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rejoin session');
      setPlayerToken(data.playerToken);
      setPlayerState(data.state);
      setScreen('PLAYER');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Unable to rejoin session.');
    } finally {
      setLoading(false);
    }
  };

  // HOST COMMAND VIEW
  if (screen === 'HOST' && hostState && hostToken) {
    return (
      <HostDashboard
        state={hostState}
        hostToken={hostToken}
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
        onUpdateState={setPlayerState}
        onLeaveSession={() => {
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
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="w-full max-w-md bg-[#151C28] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScreen('TITLE')}
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

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
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
      </div>
    );
  }

  // FULL-VIEWPORT TITLE SCREEN (GAME SHELL)
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F17] flex items-center">
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

      <div className="relative z-10 max-w-6xl w-full mx-auto px-6 py-12">
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
              viewBox="0 0 360 76"
              className="w-full max-w-[340px] h-auto"
              role="img"
              aria-label="SKELD IRL"
            >
              <rect x="2" y="10" width="46" height="54" rx="14" fill="#EF4444" stroke="#0F172A" strokeWidth="3" />
              <rect x="20" y="20" width="26" height="16" rx="8" fill="#7DD3FC" stroke="#0F172A" strokeWidth="2.5" />
              <text
                x="64"
                y="56"
                fill="#FFFFFF"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="700"
                fontSize="56"
                letterSpacing="2"
              >
                SKELD IRL
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
