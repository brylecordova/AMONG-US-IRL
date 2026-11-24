import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 9. START REACTOR (Long · Reactor) — Dual Reactor Console with 5 LED Stage Pips & Tap Feedback
export const StartReactorTask: React.FC<TaskProps> = ({ onComplete }) => {
  const TOTAL_ROUNDS = 5;
  const [sequence] = useState<number[]>(() =>
    Array.from({ length: TOTAL_ROUNDS }, () => Math.floor(Math.random() * 9)),
  );
  const [round, setRound] = useState(1);
  const [showingIdx, setShowingIdx] = useState<number | null>(null);
  const [tappedIdx, setTappedIdx] = useState<number | null>(null);
  const [isPlayback, setIsPlayback] = useState(true);
  const [inputStep, setInputStep] = useState(0);
  const [errorFlash, setErrorFlash] = useState(false);

  useEffect(() => {
    setIsPlayback(true);
    setInputStep(0);
    let step = 0;
    let cancelled = false;

    const playNext = () => {
      if (cancelled) return;
      if (step >= round) {
        setShowingIdx(null);
        setIsPlayback(false);
        return;
      }
      setShowingIdx(sequence[step]);
      soundEngine.playClick();
      setTimeout(() => {
        if (cancelled) return;
        setShowingIdx(null);
        step += 1;
        setTimeout(playNext, 180);
      }, 360);
    };

    const startTimer = setTimeout(playNext, 350);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [round, sequence]);

  const handlePadTap = (cell: number) => {
    if (isPlayback) return;
    soundEngine.playClick();
    setTappedIdx(cell);
    setTimeout(() => setTappedIdx(null), 160);

    if (sequence[inputStep] === cell) {
      const nextStep = inputStep + 1;
      if (nextStep >= round) {
        if (round >= TOTAL_ROUNDS) {
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 350);
        } else {
          setRound((r) => r + 1);
        }
      } else {
        setInputStep(nextStep);
      }
    } else {
      setErrorFlash(true);
      setTimeout(() => {
        setErrorFlash(false);
        setRound(1);
      }, 450);
    }
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={isPlayback ? 'text-cyan-300 font-bold' : 'text-emerald-300 font-bold'}>
          {isPlayback ? 'WATCH REACTOR PATTERN' : 'REPEAT ON RIGHT KEYPAD'}
        </span>
        <span className="tabular-nums text-emerald-400 font-bold">
          {round} / {TOTAL_ROUNDS}
        </span>
      </div>

      {/* Stage LED Pips */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
          const lit = i < round - (isPlayback ? 1 : 0);
          return (
            <span
              key={i}
              className={`w-6 h-2.5 rounded-full border transition-colors ${
                lit
                  ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_8px_#34d399]'
                  : 'bg-slate-900 border-slate-700'
              }`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Monitor Screen */}
        <div className="bg-slate-950 p-2.5 rounded-xl border-2 border-slate-700 grid grid-cols-3 gap-1.5 shadow-inner">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={`h-11 rounded-md border transition-colors ${
                showingIdx === i
                  ? 'bg-cyan-400 border-cyan-100 shadow-[0_0_12px_#22d3ee]'
                  : 'bg-slate-900 border-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Input Keypad */}
        <div
          className={`bg-slate-900 p-2.5 rounded-xl border-2 grid grid-cols-3 gap-1.5 ${
            errorFlash ? 'border-red-500 bg-red-950/30' : 'border-slate-700'
          }`}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={isPlayback}
              onClick={() => handlePadTap(i)}
              className={`h-11 rounded-md border transition-all active:scale-90 ${
                tappedIdx === i
                  ? 'bg-emerald-400 border-emerald-100'
                  : 'bg-slate-700 hover:bg-cyan-500/40 border-slate-500 disabled:opacity-50'
              }`}
              aria-label={`Reactor key ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// 10. UNLOCK MANIFOLDS (Short · Reactor) — Brushed Steel Manifold Panel & Pressure Bar
export const UnlockManifoldsTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [tiles] = useState<number[]>(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5),
  );
  const [nextNum, setNextNum] = useState(1);
  const [errFlash, setErrFlash] = useState(false);

  const tapTile = (num: number) => {
    if (num === nextNum) {
      soundEngine.playClick();
      if (num === 10) {
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 300);
      } else {
        setNextNum(num + 1);
      }
    } else if (num > nextNum) {
      soundEngine.playClick();
      setErrFlash(true);
      setNextNum(1);
      setTimeout(() => setErrFlash(false), 350);
    }
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>TAP IN ORDER 1 → 10</span>
        <span className="tabular-nums text-cyan-300 font-bold">NEXT: #{nextNum}</span>
      </div>

      {/* 10-Segment Pressure Strip */}
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-sm ${
              idx + 1 < nextNum ? 'bg-emerald-400' : 'bg-slate-800'
            }`}
          />
        ))}
      </div>

      <div
        className={`grid grid-cols-5 gap-2 p-2.5 rounded-xl bg-slate-950 border-2 ${
          errFlash ? 'border-red-500' : 'border-slate-700'
        }`}
      >
        {tiles.map((n) => {
          const done = n < nextNum;
          return (
            <button
              key={n}
              type="button"
              disabled={done}
              onClick={() => tapTile(n)}
              className={`h-14 rounded-lg font-mono font-bold text-lg tabular-nums transition-all active:scale-90 ${
                done
                  ? 'bg-emerald-500 text-slate-950 border-2 border-emerald-200 shadow-[0_0_8px_#34d399]'
                  : 'bg-gradient-to-b from-sky-100 to-slate-300 hover:from-white hover:to-slate-200 text-slate-900 border-2 border-slate-500 shadow'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// 11. ALIGN ENGINE OUTPUT (Short · Upper/Lower Engine) — Cutaway Thruster Exhaust + Fine Nudge Lock
export const AlignEngineTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [angle, setAngle] = useState<number>(() => (Math.random() > 0.5 ? 28 : -28));
  const [locked, setLocked] = useState(false);
  const aligned = Math.abs(angle) <= 2;

  const updateAngle = (val: number) => {
    const clamped = Math.max(-35, Math.min(35, val));
    setAngle(clamped);
  };

  const lockVector = () => {
    if (!aligned || locked) return;
    setLocked(true);
    soundEngine.playTaskSuccess();
    setTimeout(onComplete, 350);
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">THRUSTER VECTOR AXIS</span>
        <span className={`tabular-nums font-bold ${aligned ? 'text-emerald-400' : 'text-amber-400'}`}>
          {angle > 0 ? `+${angle}°` : `${angle}°`} {aligned ? '· ALIGNED' : ''}
        </span>
      </div>

      {/* Cutaway Engine + Live Exhaust Plume Scope */}
      <div className="h-36 bg-[#07101C] border-2 border-slate-700 rounded-xl relative flex items-center justify-center overflow-hidden">
        {/* Target Vector Dashed Horizon */}
        <div
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed ${
            aligned ? 'border-emerald-400' : 'border-red-500/70'
          }`}
        />

        {/* Rotating Thruster Assembly */}
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className="flex items-center transition-transform duration-75"
        >
          {/* Engine Housing */}
          <div
            className={`w-28 h-14 rounded-l-xl border-2 flex items-center justify-between px-3 ${
              aligned ? 'bg-emerald-950/70 border-emerald-400' : 'bg-slate-800 border-slate-500'
            }`}
          >
            <div className="w-2.5 h-8 rounded bg-amber-400" />
            <span className="text-[11px] font-mono font-bold text-white">THRUSTER</span>
          </div>
          {/* Nozzle Bell */}
          <div className="w-5 h-11 bg-slate-600 border-y-2 border-r-2 border-slate-400 rounded-r-md" />
          {/* Plasma Flame Plume */}
          <div
            className={`w-16 h-7 rounded-r-full blur-[1px] animate-pulse ${
              aligned
                ? 'bg-gradient-to-r from-emerald-300 via-cyan-400 to-transparent'
                : 'bg-gradient-to-r from-amber-400 via-orange-500 to-transparent'
            }`}
          />
        </div>
      </div>

      {/* Yoke Slider + Precision Nudge Buttons */}
      <div className="space-y-2.5">
        <input
          type="range"
          min={-35}
          max={35}
          value={angle}
          onChange={(e) => updateAngle(Number(e.target.value))}
          className="w-full h-11 accent-emerald-400 cursor-pointer"
          aria-label="Engine alignment pitch"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              updateAngle(angle - 2);
            }}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-mono text-xs font-bold text-slate-200"
          >
            -2°
          </button>
          <button
            type="button"
            disabled={!aligned || locked}
            onClick={lockVector}
            className={`flex-1 min-h-[44px] rounded-xl font-bold text-xs transition-colors ${
              aligned
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {aligned ? 'Lock Vector Alignment' : 'Center Thruster to ±2°'}
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              updateAngle(angle + 2);
            }}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-mono text-xs font-bold text-slate-200"
          >
            +2°
          </button>
        </div>
      </div>
    </div>
  );
};

// 12. EMPTY CHUTE / GARBAGE (Short · O2 / Storage · Visual) — Interactive Lever + Twin Hatch + Debris
export const EmptyGarbageTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [pull, setPull] = useState(0);
  const [holding, setHolding] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      setPull((p) => {
        if (doneRef.current) return p;
        const next = Math.min(100, p + 6);
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          setHolding(false);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 350);
        }
        return next;
      });
    }, 85);
    return () => clearInterval(timer);
  }, [holding, onComplete]);

  const hatchOpenPct = holding ? Math.min(48, 12 + pull * 0.38) : 0;

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">AIRLOCK CHUTE VENT</span>
        <span className="tabular-nums text-emerald-400 font-bold">{pull}% CLEARED</span>
      </div>

      {/* Airlock Chamber + Twin Doors + Illustrated Skeld Debris */}
      <div className="h-44 bg-[#060912] border-2 border-slate-700 rounded-xl relative overflow-hidden p-4 flex flex-col justify-between">
        {/* Starry Space Layer */}
        <div
          className="absolute inset-0 opacity-45 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        {/* Tumbling Debris Items */}
        <div
          className="relative z-10 flex items-center justify-around transition-transform duration-100"
          style={{
            transform: `translateY(${pull * 1.25}px) rotate(${pull * 0.45}deg)`,
            opacity: Math.max(0.05, 1 - pull / 100),
          }}
        >
          {/* Crushed Soda Can */}
          <div className="w-8 h-10 rounded bg-red-600 border-2 border-slate-200 rotate-12 flex items-center justify-center text-[8px] font-mono font-bold text-white">
            COLA
          </div>
          {/* Leaf */}
          <div className="w-9 h-7 rounded-full bg-amber-600 border border-amber-300 -rotate-12" />
          {/* Gear */}
          <div className="w-9 h-9 rounded-full bg-slate-500 border-4 border-dashed border-slate-300" />
          {/* Broken Tablet */}
          <div className="w-8 h-9 rounded bg-cyan-900 border-2 border-cyan-400 rotate-6" />
        </div>

        {/* Twin Sliding Airlock Hatch Doors */}
        <div className="relative z-20 h-6 w-full flex overflow-hidden rounded border border-slate-600">
          <div
            className="h-full bg-slate-700 border-r-2 border-amber-400 transition-all duration-150"
            style={{ width: `${50 - hatchOpenPct}%` }}
          />
          <div className="flex-1 bg-transparent" />
          <div
            className="h-full bg-slate-700 border-l-2 border-amber-400 transition-all duration-150"
            style={{ width: `${50 - hatchOpenPct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onPointerDown={() => {
          soundEngine.playClick();
          setHolding(true);
        }}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        className={`w-full min-h-[50px] py-3.5 rounded-xl font-bold text-sm touch-none transition-colors ${
          holding
            ? 'bg-emerald-500 text-slate-950'
            : 'bg-red-600 hover:bg-red-500 text-white'
        }`}
      >
        {holding ? 'Airlock Hatch Open — Venting Debris...' : 'Hold Airlock Lever Down'}
      </button>
    </div>
  );
};
