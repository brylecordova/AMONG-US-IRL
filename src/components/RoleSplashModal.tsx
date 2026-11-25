import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { getColorDef, PlayerColorId, SecretRole } from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { haptics } from '../utils/haptics';
import { soundEngine } from '../utils/sound';

interface RoleSplashModalProps {
  secretRole: SecretRole;
  selfName: string;
  selfColor: PlayerColorId;
  teammates: Array<{ playerId: string; name: string; color: PlayerColorId; role: SecretRole }>;
  onDismiss: () => void;
}

export const RoleSplashModal: React.FC<RoleSplashModalProps> = ({
  secretRole,
  selfName,
  selfColor,
  teammates,
  onDismiss,
}) => {
  const [stage, setStage] = useState<'SHH' | 'REVEAL'>('SHH');
  const isImpostor = secretRole === 'IMPOSTOR' || secretRole === 'SHAPESHIFTER';
  const isInvestigator = secretRole === 'INVESTIGATOR';

  useEffect(() => {
    haptics.impact('light');
    const timer = setTimeout(() => {
      setStage('REVEAL');
    }, 1150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (stage === 'REVEAL') {
      soundEngine.playRoleReveal(isImpostor);
      haptics.impact(isImpostor ? 'heavy' : 'medium');
    }
  }, [stage, isImpostor]);

  const accentText = isImpostor
    ? 'text-red-500'
    : isInvestigator
      ? 'text-cyan-300'
      : 'text-emerald-400';

  const glowStyle = isImpostor
    ? 'radial-gradient(circle, rgba(239,68,68,0.38) 0%, rgba(11,15,23,0) 70%)'
    : isInvestigator
      ? 'radial-gradient(circle, rgba(34,211,238,0.34) 0%, rgba(11,15,23,0) 70%)'
      : 'radial-gradient(circle, rgba(52,211,153,0.32) 0%, rgba(11,15,23,0) 70%)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#05070C] flex items-center justify-center overflow-y-auto pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] select-none"
    >
      <AnimatePresence mode="wait">
        {stage === 'SHH' ? (
          <motion.div
            key="shh"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.35 }}
            onClick={() => setStage('REVEAL')}
            className="flex flex-col items-center text-center gap-6 cursor-pointer"
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="relative"
            >
              <CrewmateAvatar color={selfColor} size={118} />
              {/* Shhh Finger SVG Overlay */}
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                className="absolute -bottom-1 right-0 drop-shadow-lg"
              >
                <circle cx="22" cy="22" r="20" fill="#1E293B" stroke="#F8FAFC" strokeWidth="2.5" />
                <rect x="19" y="10" width="6" height="17" rx="3" fill="#F8FAFC" />
                <rect x="14" y="25" width="16" height="7" rx="3.5" fill="#CBD5E1" />
              </svg>
            </motion.div>

            <motion.div
              initial={{ letterSpacing: '0.3em', opacity: 0 }}
              animate={{ letterSpacing: '0.12em', opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="font-display text-6xl font-bold text-white tracking-widest"
            >
              SHHHHH!
            </motion.div>
            <p className="text-xs text-slate-400 font-mono">
              Shield your phone screen before your role appears
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-md flex flex-col items-center text-center space-y-5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.25 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 -z-10 pointer-events-none"
              style={{ background: glowStyle }}
            />

            <motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="space-y-1"
            >
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-slate-400">
                {selfName} · {getColorDef(selfColor).label} Suit
              </div>
              <motion.h1
                initial={{ scale: 0.78, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 320, damping: 20 }}
                className={`font-display text-6xl sm:text-7xl font-bold tracking-wider ${accentText}`}
              >
                {secretRole}
              </motion.h1>
            </motion.div>

            {/* Crew / Impostor Lineup */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="flex items-end justify-center gap-4 py-2"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CrewmateAvatar color={selfColor} size={102} />
              </motion.div>

              {isImpostor &&
                teammates.map((mate, idx) => (
                  <motion.div
                    key={mate.playerId}
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1, y: [0, -5, 0] }}
                    transition={{
                      x: { delay: 0.35 + idx * 0.1 },
                      y: { duration: 2.8, repeat: Infinity, delay: 0.4 },
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <CrewmateAvatar color={mate.color} size={78} />
                    <span className="text-[11px] font-mono text-red-300">{mate.name}</span>
                  </motion.div>
                ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-[#111827]/90 border border-white/10 rounded-2xl p-4 space-y-2.5 text-left w-full"
            >
              <p className="text-sm text-slate-200 leading-relaxed">
                {secretRole === 'CREWMATE' &&
                  'Walk to physical Task QR stations and complete all assignments, or scan fallen bodies to report.'}
                {secretRole === 'INVESTIGATOR' &&
                  'Complete tasks and tap Scan QR on any alive player’s back to inspect their suit color and alignment.'}
                {secretRole === 'IMPOSTOR' &&
                  'Tap Scan QR on an alive Crewmate’s back to eliminate them. Open Terminal to trigger Kill Power or Signal Jam sabotages.'}
                {secretRole === 'SHAPESHIFTER' &&
                  'You are the Shapeshifter Impostor: Investigator scans detect you as CREWMATE! Open Terminal for Sabotages and cooldowns.'}
              </p>

              <div className="flex items-start gap-2 pt-2 border-t border-white/10 text-xs text-emerald-300/90">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Stealth Mode Active: Once you enter the ship, every player’s screen looks like a plain Crewmate so nearby players cannot tell your role.
                </span>
              </div>
            </motion.div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                soundEngine.playClick();
                haptics.impact('medium');
                onDismiss();
              }}
              className="w-full min-h-[54px] rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-base shadow-xl"
            >
              Enter Ship (Hide Role)
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
