import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 13. CALIBRATE DISTRIBUTOR (Short · Electrical)
export const CalibrateDistributorTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0); // 0, 1, 2
  const [angles, setAngles] = useState([120, 210, 45]);
  const [feedback, setFeedback] = useState('LOCK PHASE 1 AT 3 O’CLOCK');
  const anglesRef = useRef(angles);
  anglesRef.current = angles;

  useEffect(() => {
    const timer = setInterval(() => {
      setAngles((prev) => [
        stage > 0 ? 0 : (prev[0] + 8) % 360,
        stage > 1 ? 0 : (prev[1] + 10) % 360,
        stage > 2 ? 0 : (prev[2] + 12) % 360,
      ]);
    }, 35);
    return () => clearInterval(timer);
  }, [stage]);

  const lockRing = () => {
    const current = anglesRef.current[stage];
    // Target is 0 deg (within ±36 deg tolerance for fair mobile taps)
    const dist = Math.min(current, 360 - current);
    if (dist <= 38) {
      soundEngine.playClick();
      const next = stage + 1;
      if (next >= 3) {
        setStage(3);
        setFeedback('DISTRIBUTOR CALIBRATED');
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 350);
      } else {
        setStage(next);
        setFeedback(`LOCK PHASE ${next + 1} AT 3 O’CLOCK`);
      }
    } else {
      setStage(0);
      setFeedback('MISSED TIMING — RESET TO PHASE 1');
    }
  };

  const ringColors = ['#FACC15', '#3B82F6', '#22D3EE'];

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-4">
      <div className="text-xs font-mono text-center text-amber-300">{feedback}</div>

      <div className="flex items-center justify-center gap-3">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center ${
              idx === stage ? 'border-white' : idx < stage ? 'border-emerald-400' : 'border-slate-700'
            }`}
          >
            {/* 3 o'clock notch */}
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400" />
            <div
              className="w-14 h-2 rounded-full origin-center"
              style={{
                backgroundColor: ringColors[idx],
                transform: `rotate(${angles[idx]}deg)`,
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={stage >= 3}
        onClick={lockRing}
        className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-sm transition-transform"
      >
        Lock Phase {Math.min(3, stage + 1)}
      </button>
    </div>
  );
};

// 14. DIVERT POWER (Short · Electrical)
export const DivertPowerTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [activeIdx] = useState(() => Math.floor(Math.random() * 4));
  const [sliderVal, setSliderVal] = useState(20);
  const [breakerFlipped, setBreakerFlipped] = useState(false);
  const rooms = ['O2', 'SHIELDS', 'COMMS', 'WEAPONS'];

  const handleSlider = (val: number) => {
    setSliderVal(val);
    if (val >= 95 && !breakerFlipped) {
      soundEngine.playClick();
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-5 space-y-5">
      <div className="text-xs font-mono text-amber-300 text-center">
        {sliderVal < 95
          ? `RAISE ${rooms[activeIdx]} BREAKER TO 100%`
          : `FLIP ${rooms[activeIdx]} SWITCH TO DIVERT POWER`}
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-700">
        {rooms.map((rm, idx) => (
          <div key={rm} className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">{rm}</span>
            {idx === activeIdx ? (
              <input
                type="range"
                min={0}
                max={100}
                value={sliderVal}
                onChange={(e) => handleSlider(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
                aria-label={`Divert power to ${rm}`}
              />
            ) : (
              <div className="w-full h-3 bg-slate-800 rounded-full opacity-50 my-2" />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={sliderVal < 95}
        onClick={() => {
          setBreakerFlipped(true);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 300);
        }}
        className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-sm transition-colors"
      >
        {sliderVal < 95 ? `Slide ${rooms[activeIdx]} Control First` : `Engage ${rooms[activeIdx]} Circuit`}
      </button>
    </div>
  );
};

// 15. CLEAN O2 FILTER (Short · O2)
export const CleanO2FilterTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [leaves, setLeaves] = useState([
    { id: 1, x: 45, y: 20, cleared: false },
    { id: 2, x: 75, y: 35, cleared: false },
    { id: 3, x: 55, y: 55, cleared: false },
    { id: 4, x: 80, y: 72, cleared: false },
    { id: 5, x: 42, y: 78, cleared: false },
    { id: 6, x: 65, y: 25, cleared: false },
  ]);

  const clearLeaf = (id: number) => {
    soundEngine.playClick();
    const next = leaves.map((l) => (l.id === id ? { ...l, cleared: true } : l));
    setLeaves(next);
    if (next.every((l) => l.cleared)) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 350);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>TAP LEAVES TO VACUUM INTO CHUTE</span>
        <span className="tabular-nums text-emerald-400">
          {leaves.filter((l) => l.cleared).length} / {leaves.length}
        </span>
      </div>

      <div className="relative h-56 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex">
        {/* Left Vacuum Chute */}
        <div className="w-16 h-full bg-slate-950 border-r-2 border-cyan-500/40 flex items-center justify-center">
          <span className="text-[10px] font-mono text-cyan-400 -rotate-90 whitespace-nowrap">
            VACUUM
          </span>
        </div>
        {/* Vent Grille */}
        <div className="flex-1 relative">
          {leaves.map((leaf) =>
            leaf.cleared ? null : (
              <button
                key={leaf.id}
                type="button"
                onClick={() => clearLeaf(leaf.id)}
                style={{ left: `${leaf.x}%`, top: `${leaf.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-amber-700/90 hover:bg-amber-600 border border-amber-300 text-amber-100 font-bold text-xs shadow-md active:scale-75 transition-transform"
              >
                LEAF
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

// 16. CHART COURSE (Short · Navigation)
export const ChartCourseTask: React.FC<TaskProps> = ({ onComplete }) => {
  const waypoints = [
    { x: 14, y: 72 },
    { x: 38, y: 34 },
    { x: 64, y: 65 },
    { x: 86, y: 26 },
  ];
  const [step, setStep] = useState(0);

  const reachWaypoint = (idx: number) => {
    if (idx !== step + 1) return;
    soundEngine.playClick();
    setStep(idx);
    if (idx === waypoints.length - 1) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 350);
    }
  };

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
        <span>TAP NEXT NAVIGATION BEACON</span>
        <span className="tabular-nums">
          WAYPOINT {step + 1} / {waypoints.length}
        </span>
      </div>

      <div className="relative h-56 bg-[#071320] border border-cyan-500/30 rounded-xl overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          <polyline
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            points={waypoints.map((w) => `${w.x},${w.y}`).join(' ')}
          />
        </svg>

        {waypoints.map((wp, idx) => {
          const isCurrent = idx === step;
          const isNext = idx === step + 1;
          const isDone = idx < step;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => reachWaypoint(idx)}
              style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 font-mono text-xs font-bold flex items-center justify-center transition-transform ${
                isCurrent
                  ? 'bg-cyan-400 border-white text-slate-950 scale-105'
                  : isNext
                    ? 'bg-amber-400/90 border-amber-200 text-slate-950 animate-pulse cursor-pointer'
                    : isDone
                      ? 'bg-emerald-500/70 border-emerald-300 text-slate-950'
                      : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {isCurrent ? 'SHIP' : `W${idx + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
