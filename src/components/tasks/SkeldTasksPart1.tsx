import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 1. FIX WIRING (Common · Electrical)
const WIRE_COLORS = [
  { id: 'red', hex: '#EF4444', label: 'Red' },
  { id: 'blue', hex: '#3B82F6', label: 'Blue' },
  { id: 'yellow', hex: '#FACC15', label: 'Yellow' },
  { id: 'pink', hex: '#EC4899', label: 'Pink' },
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
    <div className="relative bg-[#1E2430] border border-white/15 rounded-xl p-4 select-none">
      <div className="text-xs text-slate-400 mb-3 text-center">
        Tap a left terminal, then tap its matching color on the right
      </div>
      <div className="relative grid grid-cols-[1fr_100px_1fr] items-center gap-2 min-h-[240px]">
        {/* Left Terminals */}
        <div className="flex flex-col justify-between h-full gap-3 z-10">
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
                className={`h-12 rounded-lg border-2 flex items-center justify-between px-3 transition-transform active:scale-95 ${
                  isDone
                    ? 'opacity-50 border-emerald-400'
                    : isSel
                      ? 'border-white ring-2 ring-white/50 scale-[1.03]'
                      : 'border-white/20 hover:border-white/50'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-slate-950 bg-white/80 px-1.5 py-0.5 rounded">
                  {w.label}
                </span>
                <span className="w-3 h-3 rounded-full bg-amber-300 border border-slate-900" />
              </button>
            );
          })}
        </div>

        {/* SVG Wire Connections */}
        <svg viewBox="0 0 100 240" className="w-full h-full pointer-events-none">
          {leftOrder.map((lw, li) => {
            if (!connected[lw.id]) return null;
            const ri = rightOrder.findIndex((rw) => rw.id === lw.id);
            const y1 = 26 + li * 62;
            const y2 = 26 + ri * 62;
            return (
              <line
                key={lw.id}
                x1="0"
                y1={y1}
                x2="100"
                y2={y2}
                stroke={lw.hex}
                strokeWidth="9"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Right Terminals */}
        <div className="flex flex-col justify-between h-full gap-3 z-10">
          {rightOrder.map((w) => {
            const isDone = connected[w.id];
            const isErr = errorFlash === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onClick={() => handleRightTap(w.id)}
                className={`h-12 rounded-lg border-2 flex items-center justify-between px-3 transition-transform active:scale-95 ${
                  isErr
                    ? 'border-red-500 animate-pulse'
                    : isDone
                      ? 'border-emerald-400'
                      : 'border-white/20 hover:border-white/60'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="w-3 h-3 rounded-full bg-amber-300 border border-slate-900" />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-950 bg-white/80 px-1.5 py-0.5 rounded">
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
  const [status, setStatus] = useState('PULL CARD FROM WALLET');
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
    setStatus('SWIPING...');
    setStatusTone('neutral');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const maxW = trackRef.current.clientWidth - 96;
    const delta = Math.max(0, Math.min(maxW, e.clientX - startXRef.current));
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (!dragging || !trackRef.current) return;
    setDragging(false);
    const maxW = trackRef.current.clientWidth - 96;
    const elapsed = performance.now() - startTimeRef.current;

    if (dragX < maxW * 0.78) {
      setStatus('BAD READ. SWIPE ALL THE WAY.');
      setStatusTone('warn');
      setDragX(0);
      return;
    }

    if (elapsed < 280) {
      setStatus('TOO FAST. TRY AGAIN.');
      setStatusTone('warn');
      setDragX(0);
    } else if (elapsed > 1400) {
      setStatus('TOO SLOW. TRY AGAIN.');
      setStatusTone('warn');
      setDragX(0);
    } else {
      setStatus('ACCEPTED. THANK YOU.');
      setStatusTone('ok');
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 450);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-4 select-none">
      {/* Reader LED Screen */}
      <div className="bg-slate-950 border-2 border-slate-700 rounded-lg p-3 flex items-center justify-between">
        <span
          className={`font-mono text-sm font-bold tracking-wide ${
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
          className={`w-3.5 h-3.5 rounded-full ${
            statusTone === 'ok'
              ? 'bg-emerald-400'
              : statusTone === 'warn'
                ? 'bg-red-500'
                : 'bg-slate-600'
          }`}
        />
      </div>

      {/* Swipe Track */}
      <div
        ref={trackRef}
        className="relative h-24 bg-[#283142] border border-white/10 rounded-xl overflow-hidden flex items-center px-3 touch-none"
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-slate-950" />
        {!cardOut ? (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setCardOut(true);
              setStatus('SWIPE CARD LEFT TO RIGHT (0.5s - 1.2s)');
            }}
            className="mx-auto px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-transform active:scale-95"
          >
            Take Out ID Card
          </button>
        ) : (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ transform: `translateX(${dragX}px)` }}
            className="relative z-10 w-24 h-16 rounded-lg bg-slate-100 text-slate-900 border-2 border-slate-400 shadow-lg cursor-grab active:cursor-grabbing flex flex-col justify-between p-2"
          >
            <div className="h-2.5 w-full bg-slate-800 rounded-sm" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold">SKELD ID</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
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
      size: 38 + Math.random() * 16,
    })),
  );
  const nextIdRef = useRef(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setAsteroids((prev) =>
        prev.map((a) => {
          const nx = a.x - 1.8;
          if (nx < -8) {
            return {
              id: nextIdRef.current++,
              x: 105,
              y: 12 + Math.random() * 76,
              size: 40 + Math.random() * 14,
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
              y: 12 + Math.random() * 76,
              size: 40 + Math.random() * 14,
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
      <div className="relative h-64 bg-[#071812] border-2 border-emerald-500/40 rounded-xl overflow-hidden">
        {/* Crosshair grid */}
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
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-5 text-center">
      <div className="flex items-center justify-between px-4">
        <div className="w-16 h-14 rounded-lg bg-amber-400/90 border-2 border-amber-200 flex items-center justify-center text-slate-950 font-bold text-xs">
          TABLET
        </div>
        <div className="flex-1 mx-3 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="w-16 h-14 rounded-lg bg-cyan-400/90 border-2 border-cyan-200 flex items-center justify-center text-slate-950 font-bold text-xs">
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
          className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
        >
          Upload Data
        </button>
      )}
    </div>
  );
};
