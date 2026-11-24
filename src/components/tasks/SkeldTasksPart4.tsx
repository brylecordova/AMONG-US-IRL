import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 13. CALIBRATE DISTRIBUTOR (Short · Electrical) — Accessible timing & clear lock cue
export const CalibrateDistributorTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0); // 0, 1, 2
  const [angles, setAngles] = useState([140, 220, 60]);
  const [feedback, setFeedback] = useState('TAP LOCK WHEN BAR HITS GREEN NOTCH');
  const [missFlash, setMissFlash] = useState(false);
  const anglesRef = useRef(angles);
  anglesRef.current = angles;

  useEffect(() => {
    const timer = setInterval(() => {
      setAngles((prev) => [
        stage > 0 ? 0 : (prev[0] + 3.4) % 360,
        stage > 1 ? 0 : (prev[1] + 4.4) % 360,
        stage > 2 ? 0 : (prev[2] + 5.4) % 360,
      ]);
    }, 35);
    return () => clearInterval(timer);
  }, [stage]);

  const activeAngle = stage < 3 ? angles[stage] : 0;
  const activeDist = Math.min(activeAngle, 360 - activeAngle);
  const inWindow = stage < 3 && activeDist <= 52;

  const lockRing = () => {
    const current = anglesRef.current[stage];
    const dist = Math.min(current, 360 - current);
    if (dist <= 52) {
      soundEngine.playClick();
      const next = stage + 1;
      if (next >= 3) {
        setStage(3);
        setFeedback('DISTRIBUTOR CALIBRATED');
        soundEngine.playTaskSuccess();
        setTimeout(onComplete, 350);
      } else {
        setStage(next);
        setFeedback(`PHASE ${next} LOCKED — NOW ALIGN PHASE ${next + 1}`);
      }
    } else {
      setMissFlash(true);
      setTimeout(() => setMissFlash(false), 300);
      setFeedback(`MISSED — TRY PHASE ${stage + 1} AGAIN WHEN GREEN`);
    }
  };

  const ringColors = ['#FACC15', '#3B82F6', '#22D3EE'];

  return (
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div
        className={`text-xs font-mono text-center font-bold ${
          inWindow ? 'text-emerald-400' : missFlash ? 'text-red-400' : 'text-amber-300'
        }`}
      >
        {inWindow ? 'ALIGNED! TAP LOCK NOW!' : feedback}
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {[0, 1, 2].map((idx) => {
          const isCurrent = idx === stage;
          const isLocked = idx < stage;
          return (
            <div
              key={idx}
              className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center transition-colors ${
                isLocked
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : isCurrent && inWindow
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : isCurrent
                      ? 'border-white'
                      : 'border-slate-700 opacity-60'
              }`}
            >
              {/* Wide 3 o'clock alignment notch */}
              <div
                className={`absolute right-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-5 rounded-full border border-slate-950 ${
                  isCurrent && inWindow ? 'bg-emerald-400 scale-110' : 'bg-emerald-500/80'
                }`}
              />
              {/* Spinning contact bar */}
              <div
                className="w-12 sm:w-14 h-2.5 rounded-full origin-center"
                style={{
                  backgroundColor: isLocked ? '#34D399' : ringColors[idx],
                  transform: `rotate(${angles[idx]}deg)`,
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={stage >= 3}
        onClick={lockRing}
        className={`w-full min-h-[50px] rounded-xl font-bold text-sm transition-transform active:scale-95 ${
          inWindow
            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
        }`}
      >
        {stage >= 3 ? 'Calibrated' : `Lock Phase ${stage + 1}`}
      </button>
    </div>
  );
};

// 14. DIVERT POWER (Short · Electrical) — Mobile-friendly full-width slider
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
    <div className="bg-[#1E2430] border border-white/15 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="text-xs font-mono text-amber-300 text-center">
        {sliderVal < 95
          ? `RAISE ${rooms[activeIdx]} BREAKER TO 100%`
          : `ENGAGE ${rooms[activeIdx]} CIRCUIT SWITCH`}
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-700">
        {rooms.map((rm, idx) => {
          const isTarget = idx === activeIdx;
          return (
            <div
              key={rm}
              className={`rounded-lg p-2 text-center border ${
                isTarget
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-white/5 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono font-bold truncate">{rm}</div>
              <div className="font-mono text-xs font-bold mt-1 tabular-nums">
                {isTarget ? `${sliderVal}%` : 'OFF'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950/70 p-3 rounded-xl border border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-300">
          <span>{rooms[activeIdx]} POWER LEVEL</span>
          <span className="tabular-nums text-amber-400">{sliderVal}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sliderVal}
          onChange={(e) => handleSlider(Number(e.target.value))}
          className="w-full h-11 accent-amber-400 cursor-pointer"
          aria-label={`Divert power to ${rooms[activeIdx]}`}
        />
      </div>

      <button
        type="button"
        disabled={sliderVal < 95}
        onClick={() => {
          setBreakerFlipped(true);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 300);
        }}
        className="w-full min-h-[48px] py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-sm transition-colors"
      >
        {sliderVal < 95 ? `Slide ${rooms[activeIdx]} Slider to 100%` : `Engage ${rooms[activeIdx]} Circuit`}
      </button>
    </div>
  );
};

// 15. CLEAN O2 FILTER (Short · O2)
export const CleanO2FilterTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [leaves, setLeaves] = useState([
    { id: 1, x: 40, y: 22, cleared: false },
    { id: 2, x: 76, y: 36, cleared: false },
    { id: 3, x: 52, y: 56, cleared: false },
    { id: 4, x: 78, y: 74, cleared: false },
    { id: 5, x: 38, y: 76, cleared: false },
    { id: 6, x: 65, y: 24, cleared: false },
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
        <div className="w-14 h-full bg-slate-950 border-r-2 border-cyan-500/40 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-mono text-cyan-400 -rotate-90 whitespace-nowrap">
            VACUUM
          </span>
        </div>
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
    { x: 16, y: 72 },
    { x: 38, y: 34 },
    { x: 64, y: 65 },
    { x: 84, y: 26 },
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
