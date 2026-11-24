import React, { useCallback, useEffect, useRef, useState } from 'react';

export type SliderAccent = 'emerald' | 'red' | 'cyan' | 'orange' | 'amber';

interface SmoothSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  accent?: SliderAccent;
  formatValue?: (val: number) => string;
  onChangeCommit: (val: number) => void;
}

const ACCENT_STYLES: Record<
  SliderAccent,
  { text: string; fill: string; thumbBorder: string; glow: string }
> = {
  emerald: {
    text: 'text-emerald-400',
    fill: 'bg-emerald-400',
    thumbBorder: 'border-emerald-300',
    glow: 'shadow-[0_0_12px_rgba(52,211,153,0.45)]',
  },
  red: {
    text: 'text-red-400',
    fill: 'bg-red-500',
    thumbBorder: 'border-red-300',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.45)]',
  },
  cyan: {
    text: 'text-cyan-400',
    fill: 'bg-cyan-400',
    thumbBorder: 'border-cyan-200',
    glow: 'shadow-[0_0_12px_rgba(34,211,238,0.45)]',
  },
  orange: {
    text: 'text-orange-400',
    fill: 'bg-orange-400',
    thumbBorder: 'border-orange-200',
    glow: 'shadow-[0_0_12px_rgba(251,146,60,0.45)]',
  },
  amber: {
    text: 'text-amber-300',
    fill: 'bg-amber-400',
    thumbBorder: 'border-amber-200',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.45)]',
  },
};

export const SmoothSlider: React.FC<SmoothSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  accent = 'cyan',
  formatValue,
  onChangeCommit,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const committedAtRef = useRef(0);
  const lastCommittedValRef = useRef(value);
  const keyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clampVal = useCallback(
    (raw: number) => Math.min(max, Math.max(min, raw)),
    [min, max],
  );

  const snapVal = useCallback(
    (raw: number) => {
      const clamped = clampVal(raw);
      const snapped = min + Math.round((clamped - min) / step) * step;
      return clampVal(snapped);
    },
    [clampVal, min, step],
  );

  const valToPct = useCallback(
    (v: number) => {
      if (max === min) return 0;
      return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
    },
    [min, max],
  );

  const [isDragging, setIsDragging] = useState(false);
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [visualPct, setVisualPct] = useState<number>(() => valToPct(value));

  // Sync external server value ONLY when not actively dragging and not within brief commit window
  useEffect(() => {
    if (draggingRef.current) return;
    if (Date.now() - committedAtRef.current < 600 && value !== lastCommittedValRef.current) {
      return;
    }
    setDisplayValue(value);
    setVisualPct(valToPct(value));
  }, [value, valToPct]);

  useEffect(() => {
    return () => {
      if (keyDebounceRef.current) clearTimeout(keyDebounceRef.current);
    };
  }, []);

  const readPointer = useCallback(
    (clientX: number): { pct: number; snapped: number } => {
      const el = trackRef.current;
      if (!el) return { pct: valToPct(displayValue), snapped: displayValue };
      const rect = el.getBoundingClientRect();
      const frac = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
      const raw = min + frac * (max - min);
      return {
        pct: frac * 100,
        snapped: snapVal(raw),
      };
    },
    [displayValue, max, min, snapVal, valToPct],
  );

  const commit = useCallback(
    (nextVal: number) => {
      committedAtRef.current = Date.now();
      lastCommittedValRef.current = nextVal;
      onChangeCommit(nextVal);
    },
    [onChangeCommit],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    const { pct, snapped } = readPointer(e.clientX);
    setVisualPct(pct);
    setDisplayValue(snapped);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    const { pct, snapped } = readPointer(e.clientX);
    setVisualPct(pct);
    setDisplayValue(snapped);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    const { snapped } = readPointer(e.clientX);
    setDisplayValue(snapped);
    setVisualPct(valToPct(snapped));
    if (snapped !== value || snapped !== lastCommittedValRef.current) {
      commit(snapped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    else if (e.key === 'Home') delta = min - displayValue;
    else if (e.key === 'End') delta = max - displayValue;
    else return;

    e.preventDefault();
    const next = snapVal(displayValue + delta);
    setDisplayValue(next);
    setVisualPct(valToPct(next));
    if (keyDebounceRef.current) clearTimeout(keyDebounceRef.current);
    keyDebounceRef.current = setTimeout(() => {
      commit(next);
    }, 120);
  };

  const styles = ACCENT_STYLES[accent];
  const formatted = formatValue ? formatValue(displayValue) : String(displayValue);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${styles.text}`}>
          {formatted}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={displayValue}
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={handleKeyDown}
        className={`relative h-7 flex items-center touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded-lg ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Background Rail */}
        <div className="w-full h-2 rounded-full bg-slate-800/90 border border-white/10 overflow-hidden relative">
          {/* Active Fill */}
          <div
            className={`h-full rounded-full ${styles.fill} ${
              isDragging ? 'transition-none' : 'transition-[width] duration-150 ease-out'
            }`}
            style={{ width: `${visualPct}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white border-2 ${styles.thumbBorder} ${
            isDragging
              ? `w-5 h-5 scale-110 ${styles.glow} transition-transform duration-75`
              : 'w-4 h-4 shadow-md transition-[left,transform] duration-150 ease-out hover:scale-110'
          }`}
          style={{ left: `${visualPct}%` }}
        />
      </div>
    </div>
  );
};
