import React from 'react';
import { motion } from 'motion/react';
import { Camera, Radio, ShieldAlert, Skull, Video, WifiOff, X } from 'lucide-react';
import { getColorDef, PublicPlayer } from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { haptics } from '../utils/haptics';

interface SecurityMonitorModalProps {
  players: PublicPlayer[];
  selfPlayerId: string;
  jammed: boolean;
  selectedTargetId: string | null;
  latestFrame: { targetPlayerId: string; imageBase64: string; ts: number } | null;
  targetBusy: boolean;
  targetOffline: boolean;
  targetLostReason: string | null;
  onSelectTarget: (targetPlayerId: string) => void;
  onClose: () => void;
}

export const SecurityMonitorModal: React.FC<SecurityMonitorModalProps> = ({
  players,
  selfPlayerId,
  jammed,
  selectedTargetId,
  latestFrame,
  targetBusy,
  targetOffline,
  targetLostReason,
  onSelectTarget,
  onClose,
}) => {
  const otherPlayers = players.filter((p) => p.playerId !== selfPlayerId);
  const selectedPlayer = selectedTargetId
    ? otherPlayers.find((p) => p.playerId === selectedTargetId) ?? null
    : null;

  const hasValidFrame =
    !jammed &&
    Boolean(selectedPlayer?.alive) &&
    !targetBusy &&
    !targetOffline &&
    targetLostReason !== 'DECEASED' &&
    Boolean(latestFrame && latestFrame.targetPlayerId === selectedTargetId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/88 backdrop-blur-sm flex items-end sm:items-center justify-center pt-[env(safe-area-inset-top)] sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] sm:max-h-[92dvh] overflow-y-auto bg-[#0D131F] border border-cyan-500/35 rounded-t-3xl sm:rounded-2xl shadow-2xl"
      >
        {/* Top Security Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#080D16]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold text-white leading-none truncate">
                SECURITY MONITOR
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-1">
                {jammed
                  ? 'COMMS SIGNAL JAMMED'
                  : selectedPlayer
                    ? `FEED: ${selectedPlayer.name.toUpperCase()} · 5 FPS`
                    : 'SELECT A CREWMATE CAMERA'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.impact('light');
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
            aria-label="Close Security Monitor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
          {/* Live CCTV Viewport */}
          <div className="relative w-full aspect-[4/3] rounded-2xl bg-[#05080F] border-2 border-cyan-500/35 overflow-hidden flex items-center justify-center">
            {hasValidFrame && latestFrame ? (
              <img
                src={`data:image/jpeg;base64,${latestFrame.imageBase64}`}
                alt={`Security feed from ${selectedPlayer?.name || 'player'}`}
                className="w-full h-full object-cover"
              />
            ) : jammed ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/50 text-red-400 flex items-center justify-center mx-auto">
                  <Radio className="w-6 h-6" />
                </div>
                <div className="font-display text-2xl font-bold text-red-300">
                  SIGNAL JAMMED
                </div>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                  Comms Signal Jam active — all Security camera feeds are offline until interference clears.
                </p>
              </div>
            ) : !selectedPlayer ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="font-display text-xl font-bold text-white">
                  CCTV STANDBY
                </div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Tap any alive crewmate below to link into their rear camera at 5 FPS. They will see a notice that Security is watching.
                </p>
              </div>
            ) : !selectedPlayer.alive || targetLostReason === 'DECEASED' ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/45 text-red-400 flex items-center justify-center mx-auto">
                  <Skull className="w-6 h-6" />
                </div>
                <div className="font-display text-2xl font-bold text-red-300">
                  SIGNAL LOST — DECEASED
                </div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {selectedPlayer.name} has been eliminated. Rear camera feed terminated.
                </p>
              </div>
            ) : targetBusy ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/45 text-amber-300 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="font-display text-xl font-bold text-amber-200">
                  SCANNING QR TERMINAL
                </div>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                  {selectedPlayer.name} is currently using their camera to scan a QR code. Feed resumes automatically when finished.
                </p>
              </div>
            ) : targetOffline ? (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/15 text-slate-300 flex items-center justify-center mx-auto">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div className="font-display text-xl font-bold text-slate-200">
                  SIGNAL INTERRUPTED
                </div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {selectedPlayer.name}&apos;s device is offline or backgrounded. Waiting for signal...
                </p>
              </div>
            ) : (
              <div className="p-6 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin mx-auto" />
                <div className="font-mono text-xs font-bold text-cyan-300 tracking-wider">
                  LINKING TO {selectedPlayer.name.toUpperCase()}...
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Awaiting rear camera frames from their Android companion app.
                </p>
              </div>
            )}

            {/* Subtle CCTV Scanline Overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.65) 2px, rgba(0,0,0,0.65) 4px)',
              }}
            />

            {/* Corner Framing Brackets */}
            <span className="pointer-events-none absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-sm" />
            <span className="pointer-events-none absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70 rounded-tr-sm" />
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70 rounded-bl-sm" />
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70 rounded-br-sm" />

            {/* Live REC Badge */}
            {hasValidFrame && selectedPlayer && (
              <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 border border-red-500/50 flex items-center gap-1.5 text-[10px] font-mono font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>REC · 5 FPS · {selectedPlayer.name.toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Player Menu (1 Feed at a Time) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold uppercase tracking-wider text-slate-300">
                Crew Camera Channels ({otherPlayers.filter((p) => p.alive).length} Online)
              </span>
              <span className="text-[11px] text-slate-400">1 feed at a time</span>
            </div>

            {otherPlayers.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-center text-xs text-slate-400">
                No other players in this session.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {otherPlayers.map((p) => {
                  const colorDef = getColorDef(p.color);
                  const isSelected = p.playerId === selectedTargetId;
                  const disabled = jammed || !p.alive;

                  return (
                    <button
                      key={p.playerId}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        haptics.selection();
                        onSelectTarget(p.playerId);
                      }}
                      className={`min-h-[54px] px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2.5 text-left transition-colors ${
                        !p.alive
                          ? 'bg-red-950/20 border-red-500/20 opacity-45 cursor-not-allowed'
                          : jammed
                            ? 'bg-slate-950/50 border-white/5 opacity-45 cursor-not-allowed'
                            : isSelected
                              ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                              : 'bg-slate-950/70 hover:bg-slate-900 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CrewmateAvatar color={p.color} alive={p.alive} size={32} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{colorDef.label}</div>
                        </div>
                      </div>

                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-1 rounded shrink-0 ${
                          !p.alive
                            ? 'bg-red-500/20 text-red-300'
                            : isSelected
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        {!p.alive ? 'DECEASED' : isSelected ? 'LIVE' : 'VIEW'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
