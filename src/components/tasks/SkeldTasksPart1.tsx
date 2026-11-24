import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 1. FIX WIRING (Common · Electrical) — Supports both Drag-to-Connect & Tap-to-Connect
const WIRE_COLORS = [
  { id: 'red', hex: '#EF4444', highlight: '#FCA5A5', label: 'RED' },
  { id: 'blue', hex: '#3B82F6', highlight: '#93C5FD', label: 'BLU' },
  { id: 'yellow', hex: '#FACC15', highlight: '#FEF08A', label: 'YLW' },
  { id: 'pink', hex: '#EC4899', highlight: '#F9A8D4', label: 'PNK' },
];

export const FixWiringTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [leftOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));
  const [rightOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [errorFlash, setErrorFlash] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{ colorId: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const completeWire = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      soundEngine.playClick();
      const next = { ...connected, [rightId]: true };
      setConnected(next);
      setSelectedLeft(null);
      if (Object.keys(next).length === WIRE_COLORS.length) {
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 350);
      }
    } else {
      setErrorFlash(rightId);
      setTimeout(() => setErrorFlash(null), 350);
      setSelectedLeft(null);
    }
  };

  const handleRightTap = (colorId: string) => {
    if (!selectedLeft) return;
    completeWire(selectedLeft, colorId);
  };

  const getBoardCoords = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 50, y: 50 };
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleLeftPointerDown = (colorId: string, e: React.PointerEvent) => {
    if (connected[colorId]) return;
    soundEngine.playClick();
    setSelectedLeft(colorId);
    const coords = getBoardCoords(e.clientX, e.clientY);
    setDragLine({ colorId, x: coords.x, y: coords.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleLeftPointerMove = (e: React.PointerEvent) => {
    if (!dragLine) return;
    const coords = getBoardCoords(e.clientX, e.clientY);
    setDragLine((prev) => (prev ? { ...prev, x: coords.x, y: coords.y } : null));
  };

  const handleLeftPointerUp = (e: React.PointerEvent) => {
    if (!dragLine) return;
    const colorId = dragLine.colorId;
    setDragLine(null);

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rightTarget = el?.closest('[data-wire-right]') as HTMLElement | null;
    const targetId = rightTarget?.dataset.wireRight;
    if (targetId && !connected[targetId]) {
      completeWire(colorId, targetId);
    }
  };

  const dragColorDef = dragLine ? WIRE_COLORS.find((w) => w.id === dragLine.colorId) : null;
  const dragLeftIndex = dragLine ? leftOrder.findIndex((w) => w.id === dragLine.colorId) : -1;

  return (
    <div className="relative bg-[#1B212D] border-2 border-slate-700 rounded-xl p-3 sm:p-4 select-none space-y-3 shadow-inner">
      {/* Industrial Screws */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
        <span className="text-slate-400">JUNCTION BOX · 400V</span>
        <span className="text-emerald-400 font-bold tabular-nums">
          {Object.keys(connected).length} / 4 LINKED
        </span>
      </div>

      <div className="text-xs text-slate-300 text-center bg-slate-950/60 border border-white/10 rounded-lg py-1.5 px-2">
        {selectedLeft
          ? `Drag or tap the matching ${WIRE_COLORS.find((w) => w.id === selectedLeft)?.label} terminal on the right`
          : 'Drag a wire across OR tap left then matching color on right'}
      </div>

      <div
        ref={boardRef}
        className="relative h-[236px] w-full flex items-stretch justify-between bg-[#111621] border border-slate-800 rounded-xl px-1.5 py-1 touch-none overflow-hidden"
      >
        {/* Copper Standoff Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />

        {/* SVG Wire Overlay */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          {leftOrder.map((lw, li) => {
            if (!connected[lw.id]) return null;
            const ri = rightOrder.findIndex((rw) => rw.id === lw.id);
            const y1 = 12.5 + li * 25;
            const y2 = 12.5 + ri * 25;
            return (
              <g key={lw.id}>
                <path
                  d={`M 30 ${y1} C 50 ${y1}, 50 ${y2}, 70 ${y2}`}
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="5.2"
                  strokeLinecap="round"
                />
                <path
                  d={`M 30 ${y1} C 50 ${y1}, 50 ${y2}, 70 ${y2}`}
                  fill="none"
                  stroke={lw.hex}
                  strokeWidth="3.6"
                  strokeLinecap="round"
                />
                <path
                  d={`M 30 ${y1} C 50 ${y1}, 50 ${y2}, 70 ${y2}`}
                  fill="none"
                  stroke={lw.highlight}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              </g>
            );
          })}

          {dragLine && dragColorDef && dragLeftIndex >= 0 && (
            <path
              d={`M 30 ${12.5 + dragLeftIndex * 25} C 48 ${12.5 + dragLeftIndex * 25}, 52 ${dragLine.y}, ${dragLine.x} ${dragLine.y}`}
              fill="none"
              stroke={dragColorDef.hex}
              strokeWidth="3.2"
              strokeDasharray="3 2"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Left Terminals */}
        <div className="w-[33%] min-w-[92px] flex flex-col justify-around py-1 z-20">
          {leftOrder.map((w) => {
            const isDone = connected[w.id];
            const isSel = selectedLeft === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={isDone}
                onPointerDown={(e) => handleLeftPointerDown(w.id, e)}
                onPointerMove={handleLeftPointerMove}
                onPointerUp={handleLeftPointerUp}
                onPointerCancel={() => setDragLine(null)}
                className={`h-12 w-full rounded-lg border-2 flex items-center justify-between px-2.5 transition-transform active:scale-95 ${
                  isDone
                    ? 'opacity-60 border-emerald-400'
                    : isSel
                      ? 'border-white ring-2 ring-white/60 scale-[1.03]'
                      : 'border-white/25 hover:border-white/60'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="text-[11px] font-mono font-bold text-slate-950 bg-white/90 px-1.5 py-0.5 rounded leading-none">
                  {w.label}
                </span>
                <span className="w-3 h-5 rounded-sm bg-amber-300 border border-slate-900 shrink-0 shadow-inner" />
              </button>
            );
          })}
        </div>

        {/* Right Terminals */}
        <div className="w-[33%] min-w-[92px] flex flex-col justify-around py-1 z-20">
          {rightOrder.map((w) => {
            const isDone = connected[w.id];
            const isErr = errorFlash === w.id;
            return (
              <button
                key={w.id}
                type="button"
                data-wire-right={w.id}
                disabled={isDone}
                onClick={() => handleRightTap(w.id)}
                className={`h-12 w-full rounded-lg border-2 flex items-center justify-between px-2.5 transition-transform active:scale-95 ${
                  isErr
                    ? 'border-red-500 scale-95'
                    : isDone
                      ? 'border-emerald-400'
                      : 'border-white/25 hover:border-white/60'
                }`}
                style={{ backgroundColor: w.hex }}
              >
                <span className="w-3 h-5 rounded-sm bg-amber-300 border border-slate-900 shrink-0 shadow-inner" />
                <span className="text-[11px] font-mono font-bold text-slate-950 bg-white/90 px-1.5 py-0.5 rounded leading-none">
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
  const [maxTrackX, setMaxTrackX] = useState(180);
  const [dragging, setDragging] = useState(false);
  const startTimeRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!cardOut || !trackRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const maxW = Math.max(40, trackRef.current.clientWidth - 124);
    setMaxTrackX(maxW);
    setDragging(true);
    startTimeRef.current = performance.now();
    startXRef.current = e.clientX;
    setDragX(0);
    setStatus('SWIPING ACROSS READER...');
    setStatusTone('neutral');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const maxW = Math.max(40, trackRef.current.clientWidth - 124);
    const delta = Math.max(0, Math.min(maxW, e.clientX - startXRef.current));
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (!dragging || !trackRef.current) return;
    setDragging(false);
    const maxW = Math.max(40, trackRef.current.clientWidth - 124);
    const elapsed = performance.now() - startTimeRef.current;

    if (dragX < maxW * 0.72) {
      setStatus('INCOMPLETE — DRAG ALL THE WAY RIGHT');
      setStatusTone('warn');
      setDragX(0);
      return;
    }

    if (elapsed < 170) {
      setStatus('TOO FAST — SWIPE A BIT SLOWER');
      setStatusTone('warn');
      setDragX(0);
    } else if (elapsed > 1800) {
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

  const progressPct = Math.min(100, Math.round((dragX / Math.max(1, maxTrackX)) * 100));

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 space-y-4 select-none">
      {/* Top: Admin Card Reader Console */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-3 space-y-3 shadow-inner">
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
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-3 h-3 rounded-full border border-black/50 ${
                statusTone === 'warn' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950'
              }`}
            />
            <span
              className={`w-3 h-3 rounded-full border border-black/50 ${
                statusTone === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-950'
              }`}
            />
          </div>
        </div>

        {/* Swipe Groove */}
        <div
          ref={trackRef}
          className="relative h-24 bg-[#20293A] border border-white/10 rounded-xl overflow-hidden flex items-center px-3 touch-none"
        >
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-3 bg-slate-950 rounded-full border border-slate-800" />
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 bg-cyan-400/70 rounded-full pointer-events-none"
            style={{ width: cardOut ? `${progressPct * 0.85}%` : '0%' }}
          />
          <div className="absolute inset-x-0 text-center text-[11px] font-mono text-slate-400 pointer-events-none">
            {cardOut ? '>>> DRAG CARD SMOOTHLY RIGHT >>>' : 'CARD READER SLOT EMPTY'}
          </div>

          {cardOut && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ transform: `translateX(${dragX}px)` }}
              className="relative z-10 w-28 h-16 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-900 border-2 border-cyan-400 shadow-lg cursor-grab active:cursor-grabbing flex flex-col justify-between p-1.5"
            >
              <div className="h-2.5 w-full bg-slate-900 rounded-sm" />
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-6 rounded bg-cyan-600/20 border border-cyan-700/40 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-700" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-mono font-bold leading-none">SKELD ID</div>
                  <div className="text-[9px] font-bold text-cyan-700 mt-0.5">DRAG →</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Crewmate Leather Wallet */}
      <div className="bg-gradient-to-b from-[#4E342E] to-[#3E2723] border-2 border-[#6D4C41] rounded-xl p-3 flex items-center justify-between gap-3 shadow-md">
        <div className="text-left">
          <div className="text-xs font-bold text-amber-100">CREWMATE WALLET</div>
          <div className="text-[11px] text-amber-200/80">
            {cardOut ? 'ID Card is loaded in the reader above' : 'Your Skeld ID Card is tucked inside'}
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
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 border-2 border-amber-400 font-bold text-xs whitespace-nowrap shrink-0 shadow active:scale-95 transition-transform"
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

// 3. CLEAR ASTEROIDS (Short · Weapons · Visual) — Jagged SVG Asteroids + Laser Beams + Explosion FX
interface Asteroid {
  id: number;
  x: number;
  y: number;
  size: number;
  rot: number;
  variant: number;
}

interface LaserShot {
  id: number;
  tx: number;
  ty: number;
}

export const ClearAsteroidsTask: React.FC<TaskProps> = ({ onComplete }) => {
  const TARGET_COUNT = 20;
  const [destroyed, setDestroyed] = useState(0);
  const [asteroids, setAsteroids] = useState<Asteroid[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      x: 18 + Math.random() * 68,
      y: 16 + Math.random() * 68,
      size: 46 + Math.random() * 14,
      rot: Math.floor(Math.random() * 360),
      variant: i % 3,
    })),
  );
  const [shots, setShots] = useState<LaserShot[]>([]);
  const nextIdRef = useRef(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setAsteroids((prev) =>
        prev.map((a) => {
          const nx = a.x - 1.5;
          if (nx < -8) {
            return {
              id: nextIdRef.current++,
              x: 105,
              y: 15 + Math.random() * 70,
              size: 46 + Math.random() * 14,
              rot: Math.floor(Math.random() * 360),
              variant: Math.floor(Math.random() * 3),
            };
          }
          return { ...a, x: nx, rot: (a.rot + 2) % 360 };
        }),
      );
    }, 60);
    return () => clearInterval(timer);
  }, []);

  const hitAsteroid = (a: Asteroid) => {
    soundEngine.playLaser();
    const shotId = nextIdRef.current++;
    setShots((prev) => [...prev, { id: shotId, tx: a.x, ty: a.y }]);
    setTimeout(() => {
      setShots((prev) => prev.filter((s) => s.id !== shotId));
    }, 180);

    const nextCount = destroyed + 1;
    setDestroyed(nextCount);
    setAsteroids((prev) =>
      prev.map((item) =>
        item.id === a.id
          ? {
              id: nextIdRef.current++,
              x: 94 + Math.random() * 10,
              y: 15 + Math.random() * 70,
              size: 46 + Math.random() * 14,
              rot: Math.floor(Math.random() * 360),
              variant: Math.floor(Math.random() * 3),
            }
          : item,
      ),
    );
    if (nextCount >= TARGET_COUNT) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 260);
    }
  };

  const rockPolygons = [
    '50,6 82,18 94,52 78,86 42,92 12,72 14,30',
    '44,8 78,12 92,42 84,78 52,92 18,80 8,44 24,18',
    '56,8 88,26 90,62 66,90 28,86 10,56 18,22',
  ];

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
        <span>WEAPONS TARGETING ARRAY</span>
        <span className="tabular-nums font-bold">
          DESTROYED: {destroyed} / {TARGET_COUNT}
        </span>
      </div>
      <div className="relative h-64 bg-[#05150F] border-2 border-emerald-500/45 rounded-xl overflow-hidden shadow-inner">
        {/* CRT Targeting Grid + Crosshair */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#10B981" strokeOpacity="0.22" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="#10B981" strokeOpacity="0.22" strokeWidth="0.6" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="#10B981" strokeOpacity="0.25" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#10B981" strokeOpacity="0.25" strokeWidth="0.5" />

          {/* Active Laser Beams + Impact Burst */}
          {shots.map((s) => (
            <g key={s.id}>
              <line x1="8" y1="98" x2={s.tx} y2={s.ty} stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="92" y1="98" x2={s.tx} y2={s.ty} stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx={s.tx} cy={s.ty} r="6.5" fill="none" stroke="#A7F3D0" strokeWidth="1.4" />
              <circle cx={s.tx} cy={s.ty} r="2.8" fill="#FDE047" />
            </g>
          ))}
        </svg>

        {asteroids.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => hitAsteroid(a)}
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              width: `${Math.max(46, a.size)}px`,
              height: `${Math.max(46, a.size)}px`,
              transform: `translate(-50%, -50%) rotate(${a.rot}deg)`,
            }}
            className="absolute flex items-center justify-center active:scale-75 transition-transform cursor-crosshair"
            aria-label="Shoot asteroid"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              <polygon
                points={rockPolygons[a.variant]}
                fill="#78716C"
                stroke="#D6D3D1"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle cx="38" cy="40" r="8" fill="#57534E" />
              <circle cx="64" cy="60" r="10" fill="#44403C" />
              <circle cx="58" cy="30" r="5" fill="#57534E" />
            </svg>
          </button>
        ))}

        {/* Bottom Turret Muzzles */}
        <div className="absolute bottom-1 left-2 w-4 h-4 rounded-t bg-emerald-500/50 border border-emerald-300 pointer-events-none" />
        <div className="absolute bottom-1 right-2 w-4 h-4 rounded-t bg-emerald-500/50 border border-emerald-300 pointer-events-none" />
      </div>
    </div>
  );
};

// 4. UPLOAD / DOWNLOAD DATA (Short · Cafeteria / Admin) — Interactive Packet Uplink & Interference Clearing
export const DataTransferTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [boosted, setBoosted] = useState(false);
  const [glitchPos, setGlitchPos] = useState<number | null>(null);
  const [packetOffset, setPacketOffset] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      setPacketOffset((o) => (o + 14) % 100);
      setProgress((p) => {
        if (doneRef.current) return p;
        const step = glitchPos !== null ? 1.5 : boosted ? 6.5 : 3.2;
        const next = Math.min(100, p + step);
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(timer);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 350);
        }
        return next;
      });
    }, 120);
    return () => clearInterval(timer);
  }, [started, boosted, glitchPos, onComplete]);

  // Spawn an interactive firewall interference block mid-transfer for players to clear
  useEffect(() => {
    if (!started) return;
    const g1 = setTimeout(() => {
      if (!doneRef.current) setGlitchPos(35 + Math.floor(Math.random() * 35));
    }, 950);
    const g2 = setTimeout(() => {
      if (!doneRef.current) setGlitchPos(25 + Math.floor(Math.random() * 45));
    }, 2200);
    return () => {
      clearTimeout(g1);
      clearTimeout(g2);
    };
  }, [started]);

  const clearGlitch = () => {
    if (glitchPos === null || doneRef.current) return;
    soundEngine.playClick();
    setGlitchPos(null);
    setProgress((p) => {
      const next = Math.min(100, p + 14);
      if (next >= 100 && !doneRef.current) {
        doneRef.current = true;
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 350);
      }
      return next;
    });
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      {/* Status Header */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={glitchPos !== null ? 'text-red-400 font-bold' : 'text-cyan-300'}>
          {!started
            ? 'LINK STANDBY'
            : glitchPos !== null
              ? 'PACKET INTERFERENCE · TAP BLOCK!'
              : boosted
                ? 'TURBO SYNC ACTIVE (2.5x)'
                : 'STREAMING SHIP LOGS...'}
        </span>
        <span className="tabular-nums font-bold text-emerald-400">{Math.round(progress)}%</span>
      </div>

      {/* Animated Transfer Conduit */}
      <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Tablet Folder Node */}
          <div className="w-16 h-14 rounded-lg bg-amber-400 border-2 border-amber-200 flex flex-col items-center justify-center text-slate-950 shrink-0 shadow">
            <div className="w-6 h-1.5 bg-amber-700 rounded-t -mt-1 mb-0.5 self-start ml-2" />
            <span className="font-mono font-bold text-[10px]">TABLET</span>
          </div>

          {/* Flying Packet Stream */}
          <div className="relative flex-1 h-12 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center">
            <div className="absolute inset-x-0 h-1 bg-slate-800" />
            {started &&
              [0, 33, 66].map((shift) => {
                const leftPct = (packetOffset + shift) % 100;
                return (
                  <div
                    key={shift}
                    style={{ left: `${leftPct}%` }}
                    className={`absolute -translate-x-1/2 w-5 h-3.5 rounded-sm border transition-opacity ${
                      boosted
                        ? 'bg-emerald-400 border-emerald-100 shadow-[0_0_8px_#34d399]'
                        : 'bg-cyan-400 border-cyan-100'
                    }`}
                  />
                );
              })}

            {glitchPos !== null && (
              <button
                type="button"
                onClick={clearGlitch}
                style={{ left: `${glitchPos}%` }}
                className="absolute -translate-x-1/2 z-10 min-w-[48px] h-10 px-2 rounded-lg bg-red-600 hover:bg-red-500 border-2 border-red-200 text-white font-mono text-[10px] font-bold shadow-lg animate-pulse cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Server Rack Node */}
          <div className="w-16 h-14 rounded-lg bg-cyan-400 border-2 border-cyan-200 flex flex-col items-center justify-center text-slate-950 shrink-0 shadow">
            <div className="flex gap-1 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${started ? 'bg-emerald-600' : 'bg-slate-600'}`} />
              <span className={`w-1.5 h-1.5 rounded-full ${boosted ? 'bg-amber-600' : 'bg-slate-600'}`} />
            </div>
            <span className="font-mono font-bold text-[10px]">MAINFRAME</span>
          </div>
        </div>

        <div className="h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${
              glitchPos !== null ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!started ? (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setStarted(true);
          }}
          className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
        >
          Begin Telemetry Upload
        </button>
      ) : (
        <button
          type="button"
          onPointerDown={() => {
            soundEngine.playClick();
            setBoosted(true);
          }}
          onPointerUp={() => setBoosted(false)}
          onPointerLeave={() => setBoosted(false)}
          className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-sm touch-none transition-colors ${
            boosted
              ? 'bg-cyan-400 text-slate-950'
              : 'bg-slate-800 hover:bg-slate-700 border border-cyan-400/50 text-cyan-200'
          }`}
        >
          {boosted ? 'Boosting Signal Bandwidth...' : 'Hold to Boost Upload Speed'}
        </button>
      )}
    </div>
  );
};
