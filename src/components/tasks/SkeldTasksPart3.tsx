import React, { useEffect, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 9. START REACTOR (Long · Reactor)
export const StartReactorTask: React.FC<TaskProps> = ({ onComplete }) => {
  const TOTAL_ROUNDS = 5;
  const [sequence] = useState<number[]>(() =>
    Array.from({ length: TOTAL_ROUNDS }, () => Math.floor(Math.random() * 9)),
  );
  const [round, setRound] = useState(1);
  const [showingIdx, setShowingIdx] = useState<number | null>(null);
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
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-cyan-300">
          {isPlayback ? 'WATCH SEQUENCE' : 'REPEAT SEQUENCE'}
        </span>
        <span className="tabular-nums text-emerald-400">
          STAGE {round} / {TOTAL_ROUNDS}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Monitor Screen */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-700 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className={`h-10 rounded transition-colors ${
                showingIdx === i ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Input Keypad */}
        <div
          className={`bg-slate-900 p-2.5 rounded-xl border grid grid-cols-3 gap-1.5 ${
            errorFlash ? 'border-red-500' : 'border-slate-700'
          }`}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={isPlayback}
              onClick={() => handlePadTap(i)}
              className="h-10 rounded bg-slate-700 hover:bg-cyan-500/40 active:bg-cyan-400 disabled:opacity-50 transition-colors"
              aria-label={`Reactor key ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// 10. UNLOCK MANIFOLDS (Short · Reactor)
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
      setErrFlash(true);
      setNextNum(1);
      setTimeout(() => setErrFlash(false), 350);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>TAP IN ASCENDING ORDER</span>
        <span className="tabular-nums text-cyan-300">NEXT: {nextNum}</span>
      </div>
      <div
        className={`grid grid-cols-5 gap-2 p-2 rounded-xl bg-slate-950 border ${
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
              className={`h-14 rounded-lg font-mono font-bold text-lg tabular-nums transition-all active:scale-95 ${
                done
                  ? 'bg-emerald-500/80 text-slate-950 border border-emerald-300'
                  : 'bg-sky-100 hover:bg-white text-slate-900 border border-slate-400'
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

// 11. ALIGN ENGINE OUTPUT (Short · Upper/Lower Engine)
export const AlignEngineTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [angle, setAngle] = useState<number>(() => (Math.random() > 0.5 ? 28 : -28));
  const aligned = Math.abs(angle) <= 2;

  const confirmAlignment = (val: number) => {
    setAngle(val);
    if (Math.abs(val) <= 2) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 400);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">THRUSTER VECTOR</span>
        <span className={`tabular-nums font-bold ${aligned ? 'text-emerald-400' : 'text-amber-400'}`}>
          {angle > 0 ? `+${angle}°` : `${angle}°`}
        </span>
      </div>

      {/* Engine Cone Diagram */}
      <div className="h-32 bg-slate-950 border border-slate-700 rounded-xl relative flex items-center justify-center overflow-hidden">
        <div
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed ${
            aligned ? 'border-emerald-400' : 'border-red-500/70'
          }`}
        />
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className={`w-36 h-12 rounded-lg border-2 flex items-center justify-between px-3 transition-transform ${
            aligned ? 'bg-emerald-500/20 border-emerald-400' : 'bg-slate-800 border-slate-500'
          }`}
        >
          <span className="w-3 h-6 rounded bg-amber-400" />
          <span className="text-xs font-mono font-bold text-white">ENGINE</span>
          <span className="text-xs text-slate-300">►</span>
        </div>
      </div>

      <input
        type="range"
        min={-35}
        max={35}
        value={angle}
        onChange={(e) => confirmAlignment(Number(e.target.value))}
        className="w-full h-10 accent-emerald-400 cursor-pointer"
        aria-label="Engine alignment pitch"
      />
    </div>
  );
};

// 12. EMPTY CHUTE / GARBAGE (Short · O2 / Storage · Visual)
export const EmptyGarbageTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [pull, setPull] = useState(0);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      setPull((p) => {
        const next = Math.min(100, p + 6);
        if (next >= 100) {
          setHolding(false);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 350);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [holding, onComplete]);

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>AIRLOCK CHUTE</span>
        <span className="tabular-nums text-emerald-400">{pull}% CLEARED</span>
      </div>

      <div className="h-36 bg-slate-950 border border-slate-700 rounded-xl relative overflow-hidden p-4 flex flex-col justify-between">
        <div className="flex justify-around transition-transform duration-150" style={{ transform: `translateY(${pull * 1.1}px)`, opacity: Math.max(0.1, 1 - pull / 100) }}>
          <span className="w-8 h-8 rounded bg-amber-700 rotate-12" />
          <span className="w-7 h-7 rounded-full bg-emerald-700" />
          <span className="w-9 h-6 rounded bg-slate-500 -rotate-12" />
        </div>
        <div className="h-2 bg-red-500/40 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pull}%` }} />
        </div>
      </div>

      <button
        type="button"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-sm touch-none"
      >
        {holding ? 'Venting Airlock...' : 'Hold Lever to Empty Chute'}
      </button>
    </div>
  );
};
