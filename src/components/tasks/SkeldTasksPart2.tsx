import React, { useEffect, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 5. FUEL ENGINES (Long · Storage / Engine)
export const FuelEnginesTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'CANISTER' | 'ENGINE'>('CANISTER');
  const [level, setLevel] = useState(0);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      setLevel((prev) => {
        const next = Math.min(100, prev + 5);
        if (next >= 100) {
          setHolding(false);
          soundEngine.playClick();
          if (stage === 'CANISTER') {
            setTimeout(() => {
              setStage('ENGINE');
              setLevel(0);
            }, 350);
          } else {
            soundEngine.playTaskSuccess();
            setTimeout(onComplete, 350);
          }
        }
        return next;
      });
    }, 80);
    return () => clearInterval(timer);
  }, [holding, stage, onComplete]);

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-amber-300">
        <span>{stage === 'CANISTER' ? 'STAGE 1/2 · FILL CANISTER' : 'STAGE 2/2 · FUEL ENGINE'}</span>
        <span className="tabular-nums">{level}%</span>
      </div>

      <div className="mx-auto w-28 h-44 bg-slate-900 border-2 border-slate-600 rounded-xl relative overflow-hidden flex items-end">
        <div
          className={`w-full transition-all duration-75 ${
            stage === 'CANISTER' ? 'bg-red-500' : 'bg-amber-400'
          }`}
          style={{ height: `${level}%` }}
        />
        <div className="absolute inset-x-0 top-3 border-t-2 border-dashed border-emerald-400/70" />
      </div>

      <button
        type="button"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm touch-none"
      >
        {holding ? 'Pumping Fuel...' : 'Hold to Pump Fuel'}
      </button>
    </div>
  );
};

// 6. SUBMIT SCAN (Short · MedBay · Visual)
export const MedBayScanTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 3);
        if (next >= 100) {
          clearInterval(timer);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 400);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [scanning, onComplete]);

  return (
    <div className="bg-[#081C24] border border-cyan-500/30 rounded-xl p-5 space-y-4">
      <div className="relative h-44 bg-slate-950/90 border border-cyan-500/30 rounded-xl overflow-hidden flex items-center justify-center">
        {/* Biometric silhouette */}
        <div className="w-16 h-28 rounded-2xl border-2 border-cyan-400/70 bg-cyan-500/10 flex flex-col items-center pt-4">
          <div className="w-10 h-5 rounded-full bg-cyan-300/60" />
        </div>
        {scanning && (
          <div
            className="absolute inset-x-0 h-1.5 bg-emerald-400 shadow-[0_0_12px_#34d399]"
            style={{ top: `${progress}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-cyan-200 bg-slate-950/70 p-3 rounded-lg">
        <span>HT: 3&apos;6&quot;</span>
        <span>WT: 92 LBS</span>
        <span>BLOOD: O-</span>
        <span className="tabular-nums">SCAN: {progress}%</span>
      </div>

      {!scanning && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playInvestigateScan();
            setScanning(true);
          }}
          className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm"
        >
          Begin MedBay Scan
        </button>
      )}
    </div>
  );
};

// 7. INSPECT SAMPLE (Long · MedBay)
export const InspectSampleTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'IDLE' | 'ANALYZING' | 'SELECT'>('IDLE');
  const [anomalyIdx] = useState(() => Math.floor(Math.random() * 5));
  const [countdown, setCountdown] = useState(4);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (phase !== 'ANALYZING') return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          soundEngine.playClick();
          setPhase('SELECT');
          return 0;
        }
        return c - 1;
      });
    }, 750);
    return () => clearInterval(timer);
  }, [phase]);

  const pickVial = (idx: number) => {
    if (phase !== 'SELECT') return;
    if (idx === anomalyIdx) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 300);
    } else {
      setErrMsg('Normal reagent. Select the red anomaly tube.');
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-5">
      <div className="text-xs font-mono text-center text-cyan-300">
        {phase === 'IDLE' && 'PRESS ANALYZE TO PROCESS REAGENT VIALS'}
        {phase === 'ANALYZING' && `CENTRIFUGE PROCESSING... ${countdown}s`}
        {phase === 'SELECT' && 'TAP THE ANOMALOUS RED SAMPLE TUBE'}
      </div>

      <div className="flex items-end justify-center gap-3 h-36 bg-slate-950/70 rounded-xl p-4 border border-white/10">
        {[0, 1, 2, 3, 4].map((idx) => {
          const isAnomaly = phase === 'SELECT' && idx === anomalyIdx;
          return (
            <button
              key={idx}
              type="button"
              disabled={phase !== 'SELECT'}
              onClick={() => pickVial(idx)}
              className={`w-11 h-24 rounded-b-full border-2 border-slate-400 relative overflow-hidden transition-transform ${
                phase === 'SELECT' ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-70'
              }`}
            >
              <div
                className={`absolute inset-x-0 bottom-0 h-16 transition-colors ${
                  phase === 'IDLE'
                    ? 'bg-slate-700'
                    : phase === 'ANALYZING'
                      ? 'bg-cyan-500/60 animate-pulse'
                      : isAnomaly
                        ? 'bg-red-500'
                        : 'bg-sky-500'
                }`}
              />
            </button>
          );
        })}
      </div>

      {errMsg && <div className="text-xs text-red-400 text-center">{errMsg}</div>}

      {phase === 'IDLE' && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setPhase('ANALYZING');
          }}
          className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
        >
          Start Analyzer
        </button>
      )}
    </div>
  );
};

// 8. PRIME SHIELDS (Short · Shields · Visual)
export const PrimeShieldsTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [nodes, setNodes] = useState<boolean[]>(() => {
    const arr = [false, true, false, true, false, true, false];
    return arr.sort(() => Math.random() - 0.5);
  });

  const toggleNode = (idx: number) => {
    soundEngine.playClick();
    const next = [...nodes];
    next[idx] = !next[idx];
    setNodes(next);
    if (next.every(Boolean)) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 350);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-4">
      <div className="text-xs text-slate-400 text-center">
        Tap all red deflector cells to prime them white
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
        {nodes.map((primed, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggleNode(idx)}
            className={`h-16 rounded-xl border-2 font-bold text-xs transition-all active:scale-95 ${
              idx === 6 ? 'col-start-2' : ''
            } ${
              primed
                ? 'bg-slate-100 border-cyan-300 text-slate-950'
                : 'bg-red-600/90 border-red-300 text-white'
            }`}
          >
            {primed ? 'PRIMED' : 'OFFLINE'}
          </button>
        ))}
      </div>
    </div>
  );
};
