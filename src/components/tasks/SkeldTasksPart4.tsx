import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 13. CALIBRATE DISTRIBUTOR (Short · Electrical) — 3-Coil Rotary Distributor + Voltage Meters
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
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div
        className={`text-xs font-mono text-center font-bold ${
          inWindow ? 'text-emerald-400' : missFlash ? 'text-red-400' : 'text-amber-300'
        }`}
      >
        {inWindow ? 'ALIGNED! TAP LOCK NOW!' : feedback}
      </div>

      {/* Rotary Coils + Phase Voltage Bars */}
      <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          {[0, 1, 2].map((idx) => {
            const isCurrent = idx === stage;
            const isLocked = idx < stage;
            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center transition-colors ${
                    isLocked
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : isCurrent && inWindow
                        ? 'border-emerald-400 bg-emerald-500/15'
                        : isCurrent
                          ? 'border-white bg-slate-900'
                          : 'border-slate-700 bg-slate-900 opacity-55'
                  }`}
                >
                  {/* Copper Center Hub */}
                  <div className="absolute w-4 h-4 rounded-full bg-amber-600 border border-amber-300 z-10" />
                  {/* Wide 3 o'clock alignment bracket */}
                  <div
                    className={`absolute right-[-7px] top-1/2 -translate-y-1/2 w-3.5 h-6 rounded-full border border-slate-950 ${
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
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  COIL {idx + 1} · {isLocked ? 'OK' : isCurrent ? 'LIVE' : 'WAIT'}
                </span>
              </div>
            );
          })}
        </div>

        {/* 3-Bar Output Voltage Meter */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  idx < stage ? 'w-full bg-emerald-400' : idx === stage && inWindow ? 'w-2/3 bg-amber-400' : 'w-1/4 bg-slate-600'
                }`}
              />
            </div>
          ))}
        </div>
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

// 14. DIVERT POWER (Short · Electrical) — Animated Bus Conduits + Armored Circuit Switch
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

  const readyToFlip = sliderVal >= 95;

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="text-xs font-mono text-amber-300 text-center font-bold">
        {!readyToFlip
          ? `BOOST ${rooms[activeIdx]} BUS FADER TO 100%`
          : `SNAP ${rooms[activeIdx]} CIRCUIT BREAKER CLOSED`}
      </div>

      {/* Animated Conduit Header & Destination Buses */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-700 space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {rooms.map((rm, idx) => {
            const isTarget = idx === activeIdx;
            return (
              <div
                key={rm}
                className={`rounded-lg p-2 text-center border transition-colors ${
                  isTarget
                    ? breakerFlipped
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-amber-500/20 border-amber-400 text-amber-200'
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

        {/* Visual Power Conduit Bars */}
        <div className="grid grid-cols-4 gap-2 px-3">
          {rooms.map((rm, idx) => {
            const isTarget = idx === activeIdx;
            return (
              <div key={rm} className="h-8 flex justify-center">
                <div className="w-2.5 h-full bg-slate-900 rounded-full overflow-hidden flex items-end border border-slate-800">
                  {isTarget && (
                    <div
                      className={`w-full transition-all duration-75 ${
                        breakerFlipped ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ height: `${sliderVal}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Bus Fader Control */}
      <div className="bg-slate-950/75 p-3 rounded-xl border border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-300">
          <span>{rooms[activeIdx]} BUS FADER</span>
          <span className="tabular-nums text-amber-400 font-bold">{sliderVal}%</span>
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

      {/* Armored Knife Switch Trigger */}
      <button
        type="button"
        disabled={!readyToFlip || breakerFlipped}
        onClick={() => {
          setBreakerFlipped(true);
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 320);
        }}
        className={`w-full min-h-[50px] py-3 rounded-xl font-bold text-sm transition-all ${
          breakerFlipped
            ? 'bg-emerald-500 text-slate-950'
            : readyToFlip
              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.4)] active:scale-95'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
        }`}
      >
        {breakerFlipped
          ? `${rooms[activeIdx]} Power Diverted!`
          : readyToFlip
            ? `Flip ${rooms[activeIdx]} Breaker Switch`
            : `Slide ${rooms[activeIdx]} Fader to 100%`}
      </button>
    </div>
  );
};

// 15. CLEAN O2 FILTER (Short · O2) — Spinning Intake Fan Grate & Suction-Animated SVG Leaves
export const CleanO2FilterTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [leaves, setLeaves] = useState([
    { id: 1, x: 42, y: 24, rot: -20, tone: '#B45309', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
    { id: 2, x: 76, y: 34, rot: 35, tone: '#D97706', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
    { id: 3, x: 54, y: 56, rot: 12, tone: '#65A30D', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
    { id: 4, x: 78, y: 74, rot: -38, tone: '#CA8A04', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
    { id: 5, x: 38, y: 76, rot: 45, tone: '#9A3412', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
    { id: 6, x: 64, y: 22, rot: -10, tone: '#4D7C0F', status: 'stuck' as 'stuck' | 'sucking' | 'cleared' },
  ]);
  const [fanAngle, setFanAngle] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setFanAngle((a) => (a + 18) % 360), 60);
    return () => clearInterval(iv);
  }, []);

  const clearLeaf = (id: number) => {
    soundEngine.playClick();
    setLeaves((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, status: 'sucking' as const } : l));
      return next;
    });
    setTimeout(() => {
      setLeaves((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, status: 'cleared' as const } : l));
        if (next.every((l) => l.status === 'cleared')) {
          soundEngine.playTaskSuccess();
          setTimeout(onComplete, 260);
        }
        return next;
      });
    }, 220);
  };

  const clearedCount = leaves.filter((l) => l.status !== 'stuck').length;

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>TAP LEAVES TO SUCK INTO O2 CHUTE</span>
        <span className="tabular-nums text-emerald-400 font-bold">
          {clearedCount} / {leaves.length}
        </span>
      </div>

      <div className="relative h-56 bg-slate-950 border-2 border-slate-700 rounded-xl overflow-hidden flex">
        {/* Left Vacuum Suction Nozzle */}
        <div className="w-16 h-full bg-slate-900 border-r-2 border-cyan-500/50 flex flex-col items-center justify-center shrink-0 gap-2">
          <div className="w-2 h-16 rounded-full bg-cyan-400/50 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-cyan-300 -rotate-90 whitespace-nowrap">
            O2 VACUUM
          </span>
        </div>

        {/* Vent Chamber with Rotating Exhaust Fan Behind Mesh */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 m-auto w-44 h-44 opacity-30 pointer-events-none"
            style={{ transform: `rotate(${fanAngle}deg)` }}
          >
            <circle cx="50" cy="50" r="44" fill="none" stroke="#64748B" strokeWidth="2" />
            <path d="M50 12 C62 24, 62 40, 50 50 C38 40, 38 24, 50 12 Z" fill="#94A3B8" />
            <path d="M88 50 C76 62, 60 62, 50 50 C60 38, 76 38, 88 50 Z" fill="#94A3B8" />
            <path d="M50 88 C38 76, 38 60, 50 50 C62 60, 62 76, 50 88 Z" fill="#94A3B8" />
            <path d="M12 50 C24 38, 40 38, 50 50 C40 62, 24 62, 12 50 Z" fill="#94A3B8" />
            <circle cx="50" cy="50" r="9" fill="#CBD5E1" />
          </svg>

          {leaves.map((leaf) => {
            if (leaf.status === 'cleared') return null;
            const sucking = leaf.status === 'sucking';
            return (
              <button
                key={leaf.id}
                type="button"
                onClick={() => clearLeaf(leaf.id)}
                style={{
                  left: sucking ? '4%' : `${leaf.x}%`,
                  top: sucking ? '50%' : `${leaf.y}%`,
                  transform: `translate(-50%, -50%) rotate(${sucking ? leaf.rot + 180 : leaf.rot}deg) scale(${sucking ? 0.3 : 1})`,
                  opacity: sucking ? 0 : 1,
                }}
                className="absolute w-12 h-12 flex items-center justify-center transition-all duration-200 active:scale-75 cursor-pointer"
                aria-label={`Remove leaf ${leaf.id}`}
              >
                <svg viewBox="0 0 48 48" className="w-11 h-11 drop-shadow-md">
                  <path
                    d="M10 36 C10 18, 22 8, 40 8 C40 26, 30 38, 12 38 Z"
                    fill={leaf.tone}
                    stroke="#FDE68A"
                    strokeWidth="2"
                  />
                  <path d="M8 40 L34 14" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 16. CHART COURSE (Short · Navigation) — Starfield Radar + Rotating Dropship Autopilot
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

  // Angle of Dropship nose pointing toward the next waypoint
  const currWp = waypoints[step];
  const nextWp = waypoints[Math.min(waypoints.length - 1, step + 1)];
  const shipAngle =
    step < waypoints.length - 1
      ? Math.round((Math.atan2(nextWp.y - currWp.y, nextWp.x - currWp.x) * 180) / Math.PI)
      : -30;

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 space-y-3 select-none">
      <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
        <span>TAP NEXT NAVIGATION BEACON</span>
        <span className="tabular-nums font-bold">
          BEACON {step + 1} / {waypoints.length}
        </span>
      </div>

      <div className="relative h-56 bg-[#06111E] border-2 border-cyan-500/40 rounded-xl overflow-hidden">
        {/* Starfield + Radar Grid */}
        <div
          className="absolute inset-0 opacity-35 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#BAE6FD 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1="25" y1="0" x2="25" y2="100" stroke="#0EA5E9" strokeOpacity="0.18" strokeWidth="0.5" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="#0EA5E9" strokeOpacity="0.18" strokeWidth="0.5" />
          <line x1="75" y1="0" x2="75" y2="100" stroke="#0EA5E9" strokeOpacity="0.18" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#0EA5E9" strokeOpacity="0.18" strokeWidth="0.5" />

          {/* Remaining Dotted Path */}
          <polyline
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            points={waypoints.map((w) => `${w.x},${w.y}`).join(' ')}
          />
          {/* Completed Solid Emerald Flight Path */}
          {step > 0 && (
            <polyline
              fill="none"
              stroke="#34D399"
              strokeWidth="2.2"
              points={waypoints
                .slice(0, step + 1)
                .map((w) => `${w.x},${w.y}`)
                .join(' ')}
            />
          )}
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
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 font-mono text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                isCurrent
                  ? 'bg-cyan-400 border-white text-slate-950 scale-110 shadow-[0_0_14px_#22d3ee]'
                  : isNext
                    ? 'bg-amber-400 border-amber-100 text-slate-950 animate-pulse cursor-pointer shadow-[0_0_12px_#fbbf24]'
                    : isDone
                      ? 'bg-emerald-500/80 border-emerald-200 text-slate-950'
                      : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {isCurrent ? (
                <svg
                  viewBox="0 0 32 32"
                  className="w-7 h-7 transition-transform duration-300"
                  style={{ transform: `rotate(${shipAngle}deg)` }}
                >
                  <polygon points="28,16 6,6 12,16 6,26" fill="#0F172A" />
                </svg>
              ) : (
                `W${idx + 1}`
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
