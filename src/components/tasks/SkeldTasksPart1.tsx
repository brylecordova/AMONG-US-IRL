import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 1. FIX WIRING (Common · Electrical)
const WIRE_COLORS = [
  { id: 'red', hex: '#EF4444', label: 'RED' },
  { id: 'blue', hex: '#3B82F6', label: 'BLU' },
  { id: 'yellow', hex: '#FACC15', label: 'YLW' },
  { id: 'pink', hex: '#EC4899', label: 'PNK' },
];

export const FixWiringTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [leftOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));
  const [rightOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [errorFlash, setErrorFlash] = useState<string | null>(null);

  const handleRightTap = (colorId: string) => {
    if (!selectedLeft) return;
    if (selectedLeft === colorId) {
      soundEngine.playClick();
      const next = { ...connected, [colorId]: true };
      setConnected(next);
      setSelectedLeft(null);
      if (Object.keys(next).length === WIRE_COLORS.length) {
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 350);
      }
    } else {
      setErrorFlash(colorId);
      setTimeout(() => setErrorFlash(null), 350);
      setSelectedLeft(null);
    }
  };

  return (
    <div className="relative bg-[#1E2430] border border-white/15 rounded-xl p-3 sm:p-4 select-none space-y-3">
      <div className="text-xs text-slate-300 text-center">
        {selectedLeft
          ? `Now tap the matching ${WIRE_COLORS.find((w) => w.id === selectedLeft)?.label} terminal on the right`
          : 'Tap a wire on the left, then tap its matching color on the right'}
      </div>

      <div className="relative h-[228px] w-full flex items-stretch justify-between">
        {/* Full-area SVG wire overlay using percentage row centers (12.5%, 37.5%, 62.5%, 87.5%) */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        >
          {leftOrder.map((lw, li) => {
            if (!connected[lw.id]) return null;
            const ri = rightOrder.findIndex((rw) => rw.id === lw.id);
            const y1 = 12.5 + li * 25;
            const y2 = 12.5 + ri * 25;
            return (
              <path
                key={lw.id}
                d={`M 30 ${y1} C 50 ${y1}, 50 ${y2}, 70 ${y2}`}
                fill="none"
                stroke={lw.hex}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Left Terminals */}
        <div className="w-[33%] min-w-[92px] flex flex-col justify-around py-1 z-10">
          {leftOrder.map((w) => {
            const isDone = connected[w.id];
            const isSel = selectedLeft === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedLeft(w.id);
                }}
                className={`h-11 w-full rounded-lg border-2 flex items-center justify-between px-2.5 transition-transform active:scale-95 ${
                  isDone
                    ? 'opacity-55 border-emerald-400'
                    : isSel
                      ? 'border-white ring-2 ring-white/60 scale-[1.03]'
                      : 'border-white/20 hover:border-white/60'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="text-[11px] font-mono font-bold text-slate-950 bg-white/85 px-1.5 py-0.5 rounded leading-none">
                  {w.label}
                </span>
                <span className="w-2.5 h-4 rounded-sm bg-amber-300 border border-slate-900 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Right Terminals */}
        <div className="w-[33%] min-w-[92px] flex flex-col justify-around py-1 z-10">
          {rightOrder.map((w) => {
            const isDone = connected[w.id];
            const isErr = errorFlash === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onClick={() => handleRightTap(w.id)}
                className={`h-11 w-full rounded-lg border-2 flex items-center justify-between px-2.5 transition-transform active:scale-95 ${
                  isErr
                    ? 'border-red-500 animate-pulse'
                    : isDone
                      ? 'border-emerald-400'
                      : 'border-white/20 hover:border-white/60'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="w-2.5 h-4 rounded-sm bg-amber-300 border border-slate-900 shrink-0" />
                <span className="text-[11px] font-mono font-bold text-slate-950 bg-white/85 px-1.5 py-0.5 rounded leading-none">
                  {isDone ? 'OK' : w.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 2. SWIPE CARD (Common · Admin)
export const SwipeCardTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [cardOut, setCardOut] = useState(false);
  const [status, setStatus] = useState('STEP 1: TAP ID CARD IN WALLET');
  const [statusTone, setStatusTone] = useState<'neutral' | 'warn' | 'ok'>('neutral');
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startTimeRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!cardOut) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    startTimeRef.current = performance.now();
    startXRef.current = e.clientX;
    setDragX(0);
    setStatus('SWIPING ACROSS READER...');
    setStatusTone('neutral');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const maxW = Math.max(40, trackRef.current.clientWidth - 112);
    const delta = Math.max(0, Math.min(maxW, e.clientX - startXRef.current));
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (!dragging || !trackRef.current) return;
    setDragging(false);
    const maxW = Math.max(40, trackRef.current.clientWidth - 112);
    const elapsed = performance.now() - startTimeRef.current;

    if (dragX < maxW * 0.72) {
      setStatus('INCOMPLETE — DRAG ALL THE WAY RIGHT');
      setStatusTone('warn');
      setDragX(0);
      return;
    }

    if (elapsed < 180) {
      setStatus('TOO FAST — SWIPE A BIT SLOWER');
      setStatusTone('warn');
      setDragX(0);
    } else if (elapsed > 1650) {
      setStatus('TOO SLOW — SWIPE IN ONE SMOOTH MOTION');
      setStatusTone('warn');
      setDragX(0);
    } else {
      setStatus('ACCEPTED. THANK YOU.');
      setStatusTone('ok');
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 400);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-4 select-none">
      {/* Top: Admin Card Reader */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-3">
        <div className="bg-slate-950 border-2 border-slate-700 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
          <span
            className={`font-mono text-xs font-bold tracking-wide ${
              statusTone === 'ok'
                ? 'text-emerald-400'
                : statusTone === 'warn'
                  ? 'text-amber-400'
                  : 'text-cyan-300'
            }`}
          >
            {status}
          </span>
          <span
            className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              statusTone === 'ok'
                ? 'bg-emerald-400'
                : statusTone === 'warn'
                  ? 'bg-red-500'
                  : 'bg-slate-600'
            }`}
          />
        </div>

        {/* Swipe Groove */}
        <div
          ref={trackRef}
          className="relative h-24 bg-[#242D3D] border border-white/10 rounded-xl overflow-hidden flex items-center px-3 touch-none"
        >
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-2.5 bg-slate-950 rounded-full" />
          <div className="absolute inset-x-0 text-center text-[11px] font-mono text-slate-400 pointer-events-none">
            {cardOut ? '>>> DRAG CARD RIGHT >>>' : 'CARD READER SLOT EMPTY'}
          </div>

          {cardOut && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ transform: `translateX(${dragX}px)` }}
              className="relative z-10 w-28 h-16 rounded-lg bg-slate-100 text-slate-900 border-2 border-cyan-400 shadow-lg cursor-grab active:cursor-grabbing flex flex-col justify-between p-2"
            >
              <div className="h-2.5 w-full bg-slate-800 rounded-sm" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold">SKELD ID</span>
                <span className="text-xs font-bold text-cyan-700">DRAG →</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Crewmate Leather Wallet */}
      <div className="bg-[#3E2723] border-2 border-[#5D4037] rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="text-left">
          <div className="text-xs font-bold text-amber-100">CREWMATE WALLET</div>
          <div className="text-[11px] text-amber-200/80">
            {cardOut ? 'ID Card is loaded in the reader above' : 'Your Skeld ID Card is inside this pocket'}
          </div>
        </div>

        {!cardOut ? (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setCardOut(true);
              setStatus('STEP 2: DRAG CARD LEFT TO RIGHT');
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 border-2 border-amber-400 font-bold text-xs whitespace-nowrap shrink-0 shadow"
          >
            Pull Out ID Card
          </button>
        ) : (
          <span className="text-[11px] font-mono font-bold text-emerald-300 shrink-0">
            CARD READY ↑
          </span>
        )}
      </div>
    </div>
  );
};

// 3. CLEAR ASTEROIDS (Short · Weapons · Visual)
interface Asteroid {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const ClearAsteroidsTask: React.FC<TaskProps> = ({ onComplete }) => {
  const TARGET_COUNT = 20;
  const [destroyed, setDestroyed] = useState(0);
  const [asteroids, setAsteroids] = useState<Asteroid[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 70,
      size: 44 + Math.random() * 14,
    })),
  );
  const nextIdRef = useRef(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setAsteroids((prev) =>
        prev.map((a) => {
          const nx = a.x - 1.7;
          if (nx < -8) {
            return {
              id: nextIdRef.current++,
              x: 105,
              y: 14 + Math.random() * 72,
              size: 44 + Math.random() * 14,
            };
          }
          return { ...a, x: nx };
        }),
      );
    }, 65);
    return () => clearInterval(timer);
  }, []);

  const hitAsteroid = (id: number) => {
    soundEngine.playLaser();
    const nextCount = destroyed + 1;
    setDestroyed(nextCount);
    setAsteroids((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              id: nextIdRef.current++,
              x: 92 + Math.random() * 12,
              y: 14 + Math.random() * 72,
              size: 44 + Math.random() * 14,
            }
          : a,
      ),
    );
    if (nextCount >= TARGET_COUNT) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 250);
    }
  };

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
        <span>WEAPONS TARGETING ARRAY</span>
        <span className="tabular-nums font-bold">
          DESTROYED: {destroyed} / {TARGET_COUNT}
        </span>
      </div>
      <div className="relative h-60 bg-[#071812] border-2 border-emerald-500/40 rounded-xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-25 border border-emerald-400/30">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-400" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-400" />
        </div>
        {asteroids.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => hitAsteroid(a.id)}
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              width: `${Math.max(44, a.size)}px`,
              height: `${Math.max(44, a.size)}px`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-500 border-2 border-stone-300 shadow-inner flex items-center justify-center active:scale-75 transition-transform"
            aria-label="Shoot asteroid"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          </button>
        ))}
      </div>
    </div>
  );
};

// 4. UPLOAD / DOWNLOAD DATA (Short · Cafeteria / Admin)
export const DataTransferTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 4);
        if (next >= 100) {
          clearInterval(timer);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 350);
        }
        return next;
      });
    }, 110);
    return () => clearInterval(timer);
  }, [started, onComplete]);

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 sm:p-5 space-y-5 text-center">
      <div className="flex items-center justify-between gap-2">
        <div className="w-16 h-14 rounded-lg bg-amber-400/90 border-2 border-amber-200 flex items-center justify-center text-slate-950 font-bold text-xs shrink-0">
          TABLET
        </div>
        <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="w-16 h-14 rounded-lg bg-cyan-400/90 border-2 border-cyan-200 flex items-center justify-center text-slate-950 font-bold text-xs shrink-0">
          ADMIN
        </div>
      </div>

      <div className="font-mono text-sm text-slate-300 tabular-nums">
        {started ? `UPLOADING TELEMETRY... ${progress}%` : 'READY TO UPLOAD SHIP LOGS'}
      </div>

      {!started && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setStarted(true);
          }}
          className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
        >
          Upload Data
        </button>
      )}
    </div>
  );
};
