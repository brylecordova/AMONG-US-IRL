import React, { useEffect, useState } from 'react';
import { soundEngine } from '../../utils/sound';

interface TaskProps {
  onComplete: () => void;
}

// 5. FUEL ENGINES (Long · Storage / Engine) — Jerrycan Sight-Glass & Spinning Thruster Chamber
export const FuelEnginesTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'CANISTER' | 'ENGINE'>('CANISTER');
  const [level, setLevel] = useState(0);
  const [holding, setHolding] = useState(false);
  const [turbineAngle, setTurbineAngle] = useState(0);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      setTurbineAngle((a) => (a + 28) % 360);
      setLevel((prev) => {
        const next = Math.min(100, prev + 5);
        if (next >= 100) {
          setHolding(false);
          soundEngine.playClick();
          if (stage === 'CANISTER') {
            setTimeout(() => {
              setStage('ENGINE');
              setLevel(0);
            }, 380);
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
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-amber-300 font-bold">
          {stage === 'CANISTER' ? 'STAGE 1/2 · FILL JERRYCAN' : 'STAGE 2/2 · FUEL THRUSTER'}
        </span>
        <span className="tabular-nums text-emerald-400 font-bold">{level}%</span>
      </div>

      {/* Interactive Fuel Rig Visual */}
      <div className="relative h-48 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden flex items-center justify-center px-4">
        {/* Background Gauge Grid */}
        <div className="absolute top-2.5 right-3 text-right font-mono text-[10px]">
          <div className="text-slate-400">FLOW PSI</div>
          <div className={holding ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {holding ? '48.2 PSI' : '0.0 PSI'}
          </div>
        </div>

        {/* Active Pouring Hose */}
        {holding && (
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-20 rounded-b-full animate-pulse ${
              stage === 'CANISTER' ? 'bg-red-400/90' : 'bg-amber-400/90'
            }`}
          />
        )}

        {stage === 'CANISTER' ? (
          /* Skeld Red Jerrycan with Sight-Glass */
          <div className="relative w-28 h-36 bg-red-700 border-2 border-red-400 rounded-xl p-2 flex flex-col justify-between shadow-lg">
            {/* Canister Handle & Spout */}
            <div className="flex items-center justify-between">
              <div className="w-10 h-3 rounded-full bg-slate-950 border border-red-900" />
              <div className="w-5 h-3 -mt-4 rounded-t bg-amber-300 border border-slate-900" />
            </div>

            {/* Translucent Fuel Sight-Glass */}
            <div className="relative flex-1 mt-1 bg-slate-950 border-2 border-slate-700 rounded-lg overflow-hidden flex items-end">
              <div
                className="w-full bg-gradient-to-t from-red-600 via-amber-500 to-yellow-300 transition-all duration-75"
                style={{ height: `${level}%` }}
              />
              <div className="absolute inset-x-0 top-2.5 border-t-2 border-dashed border-emerald-400/80" />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold text-white drop-shadow">
                {level}%
              </span>
            </div>
          </div>
        ) : (
          /* Cutaway Skeld Thruster Chamber + Spinning Turbine */
          <div className="flex items-center gap-4 w-full justify-center">
            <div className="relative w-32 h-32 rounded-2xl bg-slate-900 border-2 border-amber-400/60 overflow-hidden flex items-end">
              <div
                className="w-full bg-gradient-to-t from-amber-600 to-yellow-300 transition-all duration-75"
                style={{ height: `${level}%` }}
              />
              {/* Turbine Core Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  style={{ transform: `rotate(${turbineAngle}deg)` }}
                  className="transition-transform duration-75"
                >
                  <circle cx="32" cy="32" r="24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="6 4" />
                  <path d="M32 10 L36 32 L32 54 L28 32 Z" fill="#E2E8F0" />
                  <path d="M10 32 L32 28 L54 32 L32 36 Z" fill="#CBD5E1" />
                  <circle cx="32" cy="32" r="7" fill={holding ? '#34D399' : '#475569'} stroke="#0F172A" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
        )}
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
        className={`w-full min-h-[50px] py-3.5 rounded-xl font-bold text-sm touch-none transition-transform active:scale-[0.98] ${
          holding
            ? 'bg-emerald-400 text-slate-950'
            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
        }`}
      >
        {holding
          ? stage === 'CANISTER'
            ? 'Filling Jerrycan...'
            : 'Pumping Into Thruster...'
          : stage === 'CANISTER'
            ? 'Hold Nozzle to Fill Canister'
            : 'Hold to Pour Fuel Into Engine'}
      </button>
    </div>
  );
};

// 6. SUBMIT SCAN (Short · MedBay · Visual) — Holographic X-Ray Sweep + Live ECG Heartbeat
export const MedBayScanTask: React.FC<TaskProps & { isImpostor?: boolean }> = ({
  onComplete,
  isImpostor = false,
}) => {
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState<'IDLE' | 'SCANNING' | 'CREW_PASS' | 'IMPOSTOR_WARNING'>('IDLE');
  const [progress, setProgress] = useState(0);
  const [ecgTick, setEcgTick] = useState(0);
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const ecg = setInterval(() => setEcgTick((t) => (t + 1) % 40), 90);
    return () => clearInterval(ecg);
  }, []);

  useEffect(() => {
    if (!scanning || scanStage !== 'SCANNING') return;
    let finishTimeout: ReturnType<typeof setTimeout> | null = null;
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 3);
        if (next >= 100) {
          clearInterval(timer);
          if (isImpostor) {
            setScanStage('IMPOSTOR_WARNING');
            soundEngine.playScanWarning();
            // 2 additional seconds compared to normal 400ms crewmate result
            finishTimeout = setTimeout(onComplete, 2400);
          } else {
            setScanStage('CREW_PASS');
            soundEngine.playTaskSuccess();
            finishTimeout = setTimeout(onComplete, 400);
          }
        }
        return next;
      });
    }, 90);
    return () => {
      clearInterval(timer);
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [scanning, scanStage, isImpostor, onComplete]);

  useEffect(() => {
    if (scanStage !== 'IMPOSTOR_WARNING') return;
    setBlinkOn(true);
    const blinkTimer = setInterval(() => {
      setBlinkOn((b) => !b);
    }, 180);
    return () => clearInterval(blinkTimer);
  }, [scanStage]);

  const isWarning = scanStage === 'IMPOSTOR_WARNING';
  const warningFlash = isWarning && blinkOn;

  return (
    <div
      className={`border-2 rounded-xl p-4 sm:p-5 space-y-4 select-none transition-colors duration-100 ${
        isWarning
          ? warningFlash
            ? 'bg-[#2A060B] border-red-500 shadow-[0_0_28px_rgba(239,68,68,0.6)]'
            : 'bg-[#170508] border-red-900'
          : 'bg-[#081C24] border-cyan-500/40'
      }`}
    >
      {/* Scanner Hologram Viewport */}
      <div
        className={`relative h-48 border rounded-xl overflow-hidden flex flex-col items-center justify-center gap-2 transition-colors duration-100 ${
          isWarning
            ? warningFlash
              ? 'bg-[#1D0407] border-red-500'
              : 'bg-slate-950 border-red-800/80'
            : 'bg-slate-950/95 border-cyan-500/40'
        }`}
      >
        {/* Live ECG Monitor Strip at Top */}
        <svg viewBox="0 0 160 28" className="absolute top-2 inset-x-3 h-7 opacity-85 pointer-events-none">
          <polyline
            fill="none"
            stroke={isWarning ? '#EF4444' : '#10B981'}
            strokeWidth={isWarning ? '2.2' : '1.6'}
            points={
              isWarning
                ? '0,16 24,16 32,4 38,26 44,3 50,25 56,16 86,16 94,4 100,26 106,5 112,24 120,16 160,16'
                : '0,16 32,16 40,16 46,6 52,24 58,10 64,16 105,16 112,8 118,22 124,16 160,16'
            }
            strokeDasharray="160"
            strokeDashoffset={ecgTick * -4}
          />
        </svg>

        {/* Blinking Warning Header Overlay for Impostor X-Ray */}
        {isWarning && (
          <div
            className={`absolute top-9 inset-x-3 text-center font-mono text-[11px] font-bold tracking-widest px-2 py-0.5 rounded transition-opacity duration-75 ${
              warningFlash
                ? 'bg-red-600 text-white opacity-100 shadow-[0_0_12px_#ef4444]'
                : 'bg-red-950/80 text-red-400 opacity-50'
            }`}
          >
            ⚠ WARNING: ANOMALOUS BIO-XRAY
          </div>
        )}

        {/* Biometric Crewmate X-Ray Silhouette */}
        <svg width="82" height="102" viewBox="0 0 64 80" fill="none" className="mt-3">
          <rect
            x="8"
            y="24"
            width="9"
            height="28"
            rx="4"
            fill={isWarning ? '#7F1D1D' : '#0E7490'}
            stroke={isWarning ? (warningFlash ? '#FCA5A5' : '#EF4444') : '#22D3EE'}
            strokeWidth="2"
          />
          <path
            d="M17 24C17 12 24 7 33 7C43 7 50 13 50 25V58C50 62 46 65 42 65C38 65 37 60 37 54H30C30 60 29 65 25 65C21 65 17 62 17 58V24Z"
            fill={isWarning ? (warningFlash ? '#7F1D1D' : '#450A0A') : '#083344'}
            stroke={isWarning ? (warningFlash ? '#FCA5A5' : '#EF4444') : '#22D3EE'}
            strokeWidth="2.5"
          />
          <rect
            x="27"
            y="16"
            width="23"
            height="14"
            rx="7"
            fill={isWarning ? (warningFlash ? '#EF4444' : '#991B1B') : '#38BDF8'}
            stroke={isWarning ? '#FECACA' : '#22D3EE'}
            strokeWidth="2"
          />
          {/* Internal Skeletal / Core Biometric Overlay */}
          {scanning && (
            <g opacity={isWarning ? (warningFlash ? 1 : 0.35) : Math.min(1, progress / 35 + 0.25)}>
              <line
                x1="33"
                y1="33"
                x2="33"
                y2="53"
                stroke={isWarning ? '#FCA5A5' : '#34D399'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="25"
                y1="38"
                x2="41"
                y2="38"
                stroke={isWarning ? '#EF4444' : '#34D399'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <line
                x1="26"
                y1="43"
                x2="40"
                y2="43"
                stroke={isWarning ? '#EF4444' : '#34D399'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <line
                x1="27"
                y1="48"
                x2="39"
                y2="48"
                stroke={isWarning ? '#EF4444' : '#34D399'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>

        {/* Hexagonal MedBay Pad */}
        <div
          className={`w-36 h-3 rounded-full border transition-colors ${
            isWarning
              ? warningFlash
                ? 'bg-red-500/60 border-red-300 shadow-[0_0_20px_#ef4444]'
                : 'bg-red-900/40 border-red-700'
              : scanning
                ? 'bg-emerald-400/35 border-emerald-300 shadow-[0_0_16px_#34d399]'
                : 'bg-cyan-500/20 border-cyan-400/50'
          }`}
        />

        {scanning && (
          <div
            className={`absolute inset-x-0 h-1.5 ${
              isWarning
                ? warningFlash
                  ? 'bg-red-500 shadow-[0_0_18px_#ef4444]'
                  : 'bg-red-800/70'
                : 'bg-emerald-400 shadow-[0_0_14px_#34d399]'
            }`}
            style={{ top: isWarning ? '50%' : `${progress}%` }}
          />
        )}
      </div>

      {/* Progressive Telemetry Readouts */}
      <div
        className={`grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-lg border transition-colors ${
          isWarning
            ? 'bg-[#190508] border-red-500/60 text-red-200'
            : 'bg-slate-950/80 border-cyan-500/20 text-cyan-200'
        }`}
      >
        <span>HT: {progress >= 25 ? "3'6\"" : '---'}</span>
        <span>WT: {progress >= 50 ? '92 LBS' : '---'}</span>
        <span className={isWarning ? 'text-red-400 font-bold' : ''}>
          BLOOD: {isWarning ? 'UNKNOWN / ???' : progress >= 75 ? 'O-' : '---'}
        </span>
        <span
          className={`tabular-nums font-bold ${
            isWarning ? 'text-red-400' : 'text-emerald-300'
          }`}
        >
          {isWarning ? 'ANOMALY!' : `SCAN: ${progress}%`}
        </span>
      </div>

      {!scanning ? (
        <button
          type="button"
          onClick={() => {
            soundEngine.playInvestigateScan();
            setScanning(true);
            setScanStage('SCANNING');
          }}
          className="w-full min-h-[48px] py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm transition-transform active:scale-95"
        >
          Step Onto MedBay Pad &amp; Scan
        </button>
      ) : isWarning ? (
        <div
          className={`text-center font-mono text-xs font-bold py-2 rounded-lg transition-colors ${
            warningFlash
              ? 'bg-red-600/30 text-red-200 border border-red-500'
              : 'bg-red-950/40 text-red-400 border border-red-900'
          }`}
        >
          ⚠ WARNING: NON-CREW BIOMETRICS DETECTED (IMPOSTOR)
        </div>
      ) : scanStage === 'CREW_PASS' ? (
        <div className="text-center font-mono text-xs font-bold text-emerald-300 py-2">
          SCAN COMPLETE — NORMAL CREW BIOMETRICS VERIFIED
        </div>
      ) : (
        <div className="text-center font-mono text-xs text-emerald-300 py-2">
          BIOMETRIC X-RAY SWEEP IN PROGRESS — STAND STILL
        </div>
      )}
    </div>
  );
};

// 7. INSPECT SAMPLE (Long · MedBay) — Motorized Centrifuge Rack & Reagent Vial Selector
export const InspectSampleTask: React.FC<TaskProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'IDLE' | 'ANALYZING' | 'SELECT'>('IDLE');
  const [anomalyIdx] = useState(() => Math.floor(Math.random() * 5));
  const [countdown, setCountdown] = useState(4);
  const [spinTick, setSpinTick] = useState(0);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (phase !== 'ANALYZING') return;
    const spin = setInterval(() => setSpinTick((t) => (t + 1) % 12), 110);
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
    }, 700);
    return () => {
      clearInterval(spin);
      clearInterval(timer);
    };
  }, [phase]);

  const pickVial = (idx: number) => {
    if (phase !== 'SELECT') return;
    if (idx === anomalyIdx) {
      soundEngine.playTaskSuccess();
      setTimeout(onComplete, 300);
    } else {
      soundEngine.playClick();
      setErrMsg('Normal blue reagent. Tap the red anomalous sample tube!');
    }
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={phase === 'SELECT' ? 'text-red-300 font-bold' : 'text-cyan-300'}>
          {phase === 'IDLE' && 'LOAD REAGENT SAMPLES INTO CENTRIFUGE'}
          {phase === 'ANALYZING' && `CENTRIFUGE SPINNING... ${countdown}s`}
          {phase === 'SELECT' && 'QUARANTINE THE RED ANOMALY TUBE'}
        </span>
        <span className="text-slate-400">5 VIALS</span>
      </div>

      {/* Centrifuge Test Tube Rack */}
      <div className="relative bg-slate-950/90 rounded-xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-end justify-center gap-2.5 sm:gap-3 h-32">
          {[0, 1, 2, 3, 4].map((idx) => {
            const isAnomaly = phase === 'SELECT' && idx === anomalyIdx;
            const bounceY = phase === 'ANALYZING' ? ((spinTick + idx) % 2 === 0 ? -4 : 4) : 0;
            return (
              <button
                key={idx}
                type="button"
                disabled={phase !== 'SELECT'}
                onClick={() => pickVial(idx)}
                style={{ transform: `translateY(${bounceY}px)` }}
                className={`flex-1 max-w-[48px] h-28 flex flex-col items-center transition-transform ${
                  phase === 'SELECT' ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-85'
                }`}
                aria-label={`Sample tube ${idx + 1}`}
              >
                {/* Rubber Stopper Cap */}
                <div className="w-7 h-2.5 rounded-t bg-slate-400 border border-slate-600" />
                {/* Glass Vial Body */}
                <div
                  className={`w-full flex-1 rounded-b-full border-2 relative overflow-hidden ${
                    isAnomaly ? 'border-red-300 shadow-[0_0_12px_#ef4444]' : 'border-slate-400'
                  }`}
                >
                  <div
                    className={`absolute inset-x-0 bottom-0 h-16 transition-colors ${
                      phase === 'IDLE'
                        ? 'bg-slate-700'
                        : phase === 'ANALYZING'
                          ? 'bg-cyan-500/60'
                          : isAnomaly
                            ? 'bg-gradient-to-t from-red-700 to-red-400'
                            : 'bg-gradient-to-t from-sky-700 to-cyan-400'
                    }`}
                  />
                  {/* Glass Highlight */}
                  <div className="absolute top-2 left-1.5 bottom-4 w-1 rounded-full bg-white/30" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Metallic Rack Base */}
        <div className="h-3 rounded-lg bg-slate-800 border border-slate-600" />
      </div>

      {errMsg && <div className="text-xs text-red-400 text-center font-medium">{errMsg}</div>}

      {phase === 'IDLE' && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setPhase('ANALYZING');
          }}
          className="w-full min-h-[48px] py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm"
        >
          Dispense &amp; Spin Centrifuge
        </button>
      )}
    </div>
  );
};

// 8. PRIME SHIELDS (Short · Shields · Visual) — Authentic 7-Cell Honeycomb Hexagon Deflector Grid
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

  const primedCount = nodes.filter(Boolean).length;
  const pct = Math.round((primedCount / nodes.length) * 100);

  // Honeycomb layout: row 0 (2 hexes), row 1 (3 hexes), row 2 (2 hexes)
  const renderHex = (idx: number) => {
    const primed = nodes[idx];
    return (
      <button
        key={idx}
        type="button"
        onClick={() => toggleNode(idx)}
        className="relative w-20 h-[74px] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
        aria-label={`Shield hex ${idx + 1} ${primed ? 'primed' : 'offline'}`}
      >
        <svg viewBox="0 0 100 90" className="w-full h-full drop-shadow-md">
          <polygon
            points="25,4 75,4 97,45 75,86 25,86 3,45"
            fill={primed ? '#E2E8F0' : '#DC2626'}
            stroke={primed ? '#22D3EE' : '#FCA5A5'}
            strokeWidth="5"
          />
          <polygon
            points="31,14 69,14 86,45 69,76 31,76 14,45"
            fill="none"
            stroke={primed ? '#94A3B8' : '#7F1D1D'}
            strokeWidth="2"
          />
        </svg>
        <span
          className={`absolute font-mono text-[10px] font-bold ${
            primed ? 'text-slate-900' : 'text-white'
          }`}
        >
          {primed ? 'PRIMED' : 'OFF'}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-[#1B212D] border-2 border-slate-700 rounded-xl p-4 sm:p-5 space-y-4 select-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">TAP RED DEFLECTOR HEXAGONS</span>
        <span className="tabular-nums text-cyan-300 font-bold">SHIELD {pct}%</span>
      </div>

      <div className="bg-slate-950/90 border border-slate-700 rounded-xl py-4 px-2 flex flex-col items-center">
        <div className="flex items-center justify-center gap-2 -mb-2">{[0, 1].map(renderHex)}</div>
        <div className="flex items-center justify-center gap-2 -mb-2">{[2, 3, 4].map(renderHex)}</div>
        <div className="flex items-center justify-center gap-2">{[5, 6].map(renderHex)}</div>
      </div>
    </div>
  );
};
