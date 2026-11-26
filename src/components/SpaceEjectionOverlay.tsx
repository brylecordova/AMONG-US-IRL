import React from 'react';
import { motion } from 'motion/react';
import { CrewmateAvatar } from './CrewmateAvatar';
import type { PlayerColorId } from '../shared/skeldData';

interface SpaceEjectionOverlayProps {
  color: PlayerColorId;
  alive?: boolean;
  ghost?: boolean;
  caption: string;
  subtitle: string;
  alertBadge?: string;
  flightDurationSec?: number;
  skipLabel?: string;
  onSkip?: () => void;
}

const STARFIELD = [
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
];

export const SpaceEjectionOverlay: React.FC<SpaceEjectionOverlayProps> = ({
  color,
  alive = true,
  ghost = false,
  caption,
  subtitle,
  alertBadge,
  flightDurationSec = 3.2,
  skipLabel = 'Skip',
  onSkip,
}) => {
  return (
    <motion.div
      data-testid="space-ejection-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[90] bg-[#03050B] overflow-hidden flex flex-col items-center justify-center select-none"
    >
      {/* Deep Starfield */}
      <div className="pointer-events-none absolute inset-0">
        {STARFIELD.map((star, idx) => (
          <motion.span
            key={idx}
            aria-hidden="true"
            initial={{ x: 0, opacity: star.opacity * 0.6 }}
            animate={{
              x: [-8, -68],
              opacity: [star.opacity * 0.6, star.opacity, star.opacity * 0.5],
            }}
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
        initial={{ x: '-42vw', y: 12, rotate: -18, scale: 1.05, opacity: 1 }}
        animate={{
          x: '58vw',
          y: [-8, -26, 6, -14],
          rotate: [0, 240, 500, 720],
          scale: [1.05, 0.96, 0.78, 0.52],
          opacity: [1, 1, 0.95, 0.65],
        }}
        transition={{ delay: 0.12, duration: flightDurationSec, ease: [0.18, 0.7, 0.4, 1] }}
        className="relative z-20 mb-8 drop-shadow-[0_0_28px_rgba(255,255,255,0.22)]"
      >
        <CrewmateAvatar color={color} alive={alive} ghost={ghost} size={84} />
      </motion.div>

      {/* Classic Ejection Caption */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
        className="relative z-20 text-center px-6 space-y-2.5 max-w-xl"
      >
        {alertBadge && (
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-500/20 border border-red-400/50 text-[11px] font-mono font-bold uppercase tracking-wider text-red-300">
            {alertBadge}
          </div>
        )}
        <div className="font-display text-3xl sm:text-5xl font-bold tracking-wide text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
          {caption}
        </div>
        <div className="font-mono text-xs tracking-[0.22em] uppercase text-cyan-300/80">
          {subtitle}
        </div>
      </motion.div>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono uppercase tracking-wider text-slate-200 transition-colors"
        >
          {skipLabel}
        </button>
      )}
    </motion.div>
  );
};
