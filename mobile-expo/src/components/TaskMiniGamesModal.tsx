import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SkeldTaskDef } from '../skeldShared';

interface TaskMiniGamesModalProps {
  task: SkeldTaskDef | null;
  isBlackoutRepair?: boolean;
  isImpostor?: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export const TaskMiniGamesModal: React.FC<TaskMiniGamesModalProps> = ({
  task,
  isBlackoutRepair = false,
  isImpostor = false,
  onComplete,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!task) return;
    slideAnim.setValue(24);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 7, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [task, slideAnim, opacityAnim]);

  if (!task) return null;

  const renderTask = () => {
    switch (task.id) {
      case 'fix-wiring':
        return <FixWiringGame onDone={onComplete} />;
      case 'swipe-card':
        return <SwipeCardGame onDone={onComplete} />;
      case 'clear-asteroids':
        return <ClearAsteroidsGame onDone={onComplete} />;
      case 'download-upload':
        return <UploadDataGame onDone={onComplete} />;
      case 'fuel-engines':
        return <FuelEnginesGame onDone={onComplete} />;
      case 'medbay-scan':
        return <MedbayScanGame onDone={onComplete} isImpostor={isImpostor} />;
      case 'inspect-sample':
        return <InspectSampleGame onDone={onComplete} />;
      case 'prime-shields':
        return <PrimeShieldsGame onDone={onComplete} />;
      case 'start-reactor':
        return <StartReactorGame onDone={onComplete} />;
      case 'unlock-manifolds':
        return <UnlockManifoldsGame onDone={onComplete} />;
      case 'align-engine':
        return <AlignEngineGame onDone={onComplete} />;
      case 'empty-garbage':
        return <EmptyGarbageGame onDone={onComplete} />;
      case 'calibrate-distributor':
        return <CalibrateDistributorGame onDone={onComplete} />;
      case 'divert-power':
        return <DivertPowerGame onDone={onComplete} />;
      case 'clean-o2-filter':
        return <CleanO2FilterGame onDone={onComplete} />;
      case 'chart-course':
        return <ChartCourseGame onDone={onComplete} />;
      default:
        return null;
    }
  };

  return (
    <Modal visible={Boolean(task)} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomBadge}>
                {task.room.toUpperCase()} • {task.tier}
              </Text>
              <Text style={styles.taskTitle}>{task.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          {isBlackoutRepair ? (
            <View style={styles.blackoutNotice}>
              <Text style={styles.blackoutNoticeText}>
                EMERGENCY BLACKOUT REPAIR • Complete wiring to restore ship power!
              </Text>
            </View>
          ) : null}
          <Text style={styles.instruction}>{task.instruction}</Text>
          <View style={styles.body}>{renderTask()}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

/* 1. Fix Wiring */
const WIRE_COLORS = [
  { id: 'red', hex: '#EF4444', label: 'RED' },
  { id: 'blue', hex: '#3B82F6', label: 'BLU' },
  { id: 'yellow', hex: '#EAB308', label: 'YLW' },
  { id: 'pink', hex: '#EC4899', label: 'PNK' },
];

const FixWiringGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const rightOrder = useMemo(
    () => [...WIRE_COLORS].sort(() => Math.random() - 0.5),
    [],
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);

  const handleRightTap = (id: string) => {
    if (!selectedLeft) return;
    if (selectedLeft === id && !matched.includes(id)) {
      const next = [...matched, id];
      setMatched(next);
      setSelectedLeft(null);
      if (next.length === WIRE_COLORS.length) {
        setTimeout(onDone, 320);
      }
    } else {
      setSelectedLeft(null);
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        Tap a colored terminal on the left, then tap its matching color on the right ({matched.length}/4).
      </Text>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          {WIRE_COLORS.map((w) => {
            const done = matched.includes(w.id);
            const active = selectedLeft === w.id;
            return (
              <TouchableOpacity
                key={w.id}
                disabled={done}
                onPress={() => setSelectedLeft(w.id)}
                style={[
                  styles.wireBtn,
                  {
                    backgroundColor: w.hex,
                    opacity: done ? 0.45 : 1,
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? '#FFFFFF' : '#0F172A',
                  },
                ]}
              >
                <Text style={styles.wireText}>{done ? 'LINKED' : w.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.col}>
          {rightOrder.map((w) => {
            const done = matched.includes(w.id);
            return (
              <TouchableOpacity
                key={w.id}
                disabled={done}
                onPress={() => handleRightTap(w.id)}
                style={[
                  styles.wireBtn,
                  {
                    backgroundColor: w.hex,
                    opacity: done ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={styles.wireText}>{done ? 'OK' : w.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

/* 2. Swipe Card */
const SwipeCardGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [pulledOut, setPulledOut] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [status, setStatus] = useState('Step 1: Pull your ID badge out of the wallet.');
  const cardX = useRef(new Animated.Value(0)).current;

  const triggerSwipe = () => {
    if (!pulledOut || swiping) return;
    setSwiping(true);
    setStatus('Reading magnetic stripe...');
    cardX.setValue(0);
    Animated.timing(cardX, {
      toValue: 140,
      duration: 680,
      useNativeDriver: true,
    }).start(() => {
      setStatus('ACCEPTED. THANK YOU.');
      setTimeout(onDone, 360);
    });
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>{status}</Text>
      {!pulledOut ? (
        <TouchableOpacity
          style={styles.walletBox}
          onPress={() => {
            setPulledOut(true);
            setStatus('Step 2: Tap "Swipe Across Reader" below.');
          }}
        >
          <Text style={styles.walletTitle}>CREWMATE WALLET</Text>
          <View style={styles.idCardMini}>
            <Text style={styles.idCardText}>SKELD ID • TAP TO PULL OUT</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={styles.readerTrack}>
            <Animated.View
              style={[styles.idCardBadge, { transform: [{ translateX: cardX }] }]}
            >
              <Text style={styles.idCardBadgeText}>CREW ID</Text>
            </Animated.View>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 14, width: '100%' }]}
            onPress={triggerSwipe}
          >
            <Text style={styles.primaryBtnText}>Swipe Across Reader</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* 3. Clear Asteroids */
const ClearAsteroidsGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [destroyed, setDestroyed] = useState(0);
  const [pos, setPos] = useState({ x: 35, y: 25 });
  const targetGoal = 10;

  useEffect(() => {
    const iv = setInterval(() => {
      setPos({
        x: Math.floor(Math.random() * 72) + 8,
        y: Math.floor(Math.random() * 64) + 10,
      });
    }, 1150);
    return () => clearInterval(iv);
  }, []);

  const hitAsteroid = () => {
    const next = destroyed + 1;
    setDestroyed(next);
    setPos({
      x: Math.floor(Math.random() * 72) + 8,
      y: Math.floor(Math.random() * 64) + 10,
    });
    if (next >= targetGoal) {
      setTimeout(onDone, 250);
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        Destroyed: {destroyed} / {targetGoal} asteroids
      </Text>
      <View style={styles.spaceBox}>
        <TouchableOpacity
          onPress={hitAsteroid}
          style={[
            styles.asteroidBtn,
            { left: `${pos.x}%`, top: `${pos.y}%` },
          ]}
        >
          <Text style={styles.asteroidText}>ROCK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* 4. Upload Data — Interactive Packet Conduit & Interference Clearing */
const UploadDataGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [packetPct, setPacketPct] = useState(15);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setPacketPct((p) => (p + 20) % 100);
      setProgress((p) => {
        if (doneRef.current) return p;
        const step = glitchActive ? 2 : boosted ? 11 : 5;
        const next = Math.min(100, p + step);
        if (next >= 100 && !doneRef.current) {
          doneRef.current = true;
          clearInterval(iv);
          setTimeout(onDone, 300);
        }
        return next;
      });
    }, 160);
    return () => clearInterval(iv);
  }, [running, boosted, glitchActive, onDone]);

  useEffect(() => {
    if (!running) return;
    const g = setTimeout(() => {
      if (!doneRef.current) setGlitchActive(true);
    }, 900);
    return () => clearTimeout(g);
  }, [running]);

  const clearGlitch = () => {
    setGlitchActive(false);
    setProgress((p) => {
      const next = Math.min(100, p + 18);
      if (next >= 100 && !doneRef.current) {
        doneRef.current = true;
        setTimeout(onDone, 280);
      }
      return next;
    });
  };

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>
        {!running
          ? 'Stream telemetry logs to Mainframe'
          : glitchActive
            ? 'PACKET INTERFERENCE! Tap CLEAR!'
            : `${progress}% Uploaded`}
      </Text>
      <View style={styles.conduitRow}>
        <View style={styles.nodeBoxAmber}>
          <Text style={styles.nodeBoxText}>TABLET</Text>
        </View>
        <View style={styles.packetBridge}>
          {running ? (
            <View style={[styles.packetBlock, { left: `${packetPct}%` }]} />
          ) : null}
          {glitchActive ? (
            <TouchableOpacity style={styles.glitchBtn} onPress={clearGlitch}>
              <Text style={styles.glitchBtnText}>CLEAR</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.nodeBoxCyan}>
          <Text style={styles.nodeBoxText}>SERVER</Text>
        </View>
      </View>
      <View style={[styles.progressTrack, { marginTop: 12 }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%`, backgroundColor: glitchActive ? '#F59E0B' : '#38BDF8' },
          ]}
        />
      </View>
      {!running ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 16, width: '100%' }]}
          onPress={() => setRunning(true)}
        >
          <Text style={styles.primaryBtnText}>Begin Upload</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPressIn={() => setBoosted(true)}
          onPressOut={() => setBoosted(false)}
          style={[
            styles.primaryBtn,
            {
              marginTop: 16,
              width: '100%',
              backgroundColor: boosted ? '#22C55E' : '#1E293B',
            },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: boosted ? '#060A12' : '#38BDF8' }]}>
            {boosted ? 'Turbo Sync Active...' : 'Hold to Boost Upload Speed'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* 5. Fuel Engines — Sight-Glass Jerrycan & Thruster Chamber */
const FuelEnginesGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [stage, setStage] = useState<'FILL' | 'POUR'>('FILL');
  const [level, setLevel] = useState(0);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!holding) return;
    const iv = setInterval(() => {
      setLevel((l) => {
        const next = Math.min(100, l + 10);
        if (next >= 100) {
          setHolding(false);
          if (stage === 'FILL') {
            setStage('POUR');
            return 0;
          } else {
            clearInterval(iv);
            setTimeout(onDone, 280);
          }
        }
        return next;
      });
    }, 150);
    return () => clearInterval(iv);
  }, [holding, stage, onDone]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {stage === 'FILL' ? 'Stage 1/2: Fill Jerrycan' : 'Stage 2/2: Fuel Engine Thruster'} ({level}%)
      </Text>
      <View style={styles.tankFrame}>
        <View
          style={[
            styles.tankLiquid,
            {
              height: `${level}%`,
              backgroundColor: stage === 'FILL' ? '#EF4444' : '#F59E0B',
            },
          ]}
        />
        <Text style={styles.tankPct}>{level}%</Text>
      </View>
      <TouchableOpacity
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        style={[
          styles.primaryBtn,
          { marginTop: 16, width: '100%', backgroundColor: holding ? '#22C55E' : '#F59E0B' },
        ]}
      >
        <Text style={styles.primaryBtnText}>
          {holding ? 'Pumping Fuel...' : `HOLD TO ${stage === 'FILL' ? 'FILL CANISTER' : 'FUEL ENGINE'}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/* 6. MedBay Scan — Biometric Chamber + Progressive Readouts */
const MedbayScanGame: React.FC<{ onDone: () => void; isImpostor?: boolean }> = ({
  onDone,
  isImpostor = false,
}) => {
  const [pct, setPct] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<'IDLE' | 'SCANNING' | 'PASS' | 'WARNING'>('IDLE');
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (!scanning || scanPhase !== 'SCANNING') return;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    const iv = setInterval(() => {
      setPct((p) => {
        const next = Math.min(100, p + 8);
        if (next >= 100) {
          clearInterval(iv);
          if (isImpostor) {
            setScanPhase('WARNING');
            // 2 additional seconds compared to 300ms normal crewmate completion
            finishTimer = setTimeout(onDone, 2300);
          } else {
            setScanPhase('PASS');
            finishTimer = setTimeout(onDone, 300);
          }
        }
        return next;
      });
    }, 200);
    return () => {
      clearInterval(iv);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [scanning, scanPhase, isImpostor, onDone]);

  useEffect(() => {
    if (scanPhase !== 'WARNING') return;
    setBlinkOn(true);
    const blinkIv = setInterval(() => setBlinkOn((b) => !b), 180);
    return () => clearInterval(blinkIv);
  }, [scanPhase]);

  const isWarning = scanPhase === 'WARNING';
  const warningFlash = isWarning && blinkOn;

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.scanChamber,
          isWarning
            ? {
                backgroundColor: warningFlash ? '#2A060B' : '#120306',
                borderColor: warningFlash ? '#EF4444' : '#7F1D1D',
                borderWidth: 2,
              }
            : null,
        ]}
      >
        {isWarning ? (
          <Text
            style={{
              position: 'absolute',
              top: 6,
              color: warningFlash ? '#FFFFFF' : '#FCA5A5',
              backgroundColor: warningFlash ? '#DC2626' : '#450A0A',
              fontSize: 10,
              fontWeight: '900',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              letterSpacing: 1,
            }}
          >
            ⚠ WARNING: RED X-RAY ANOMALY
          </Text>
        ) : null}
        <View
          style={[
            styles.crewSilhouette,
            isWarning
              ? {
                  backgroundColor: warningFlash ? '#7F1D1D' : '#450A0A',
                  borderColor: warningFlash ? '#FCA5A5' : '#EF4444',
                }
              : null,
          ]}
        >
          <View
            style={[
              styles.crewVisor,
              isWarning ? { backgroundColor: warningFlash ? '#EF4444' : '#991B1B' } : null,
            ]}
          />
        </View>
        {scanning ? (
          <View
            style={[
              styles.scanLaser,
              {
                top: isWarning ? '50%' : `${pct}%`,
                backgroundColor: isWarning ? (warningFlash ? '#EF4444' : '#7F1D1D') : '#34D399',
              },
            ]}
          />
        ) : null}
      </View>
      <View
        style={[
          styles.bioReadout,
          isWarning
            ? { backgroundColor: '#190508', borderWidth: 1, borderColor: '#EF4444' }
            : null,
        ]}
      >
        <Text style={[styles.bioText, isWarning ? { color: '#FECACA' } : null]}>
          HT: {pct >= 25 ? "3'6\"" : '---'}
        </Text>
        <Text style={[styles.bioText, isWarning ? { color: '#FECACA' } : null]}>
          WT: {pct >= 50 ? '92 LBS' : '---'}
        </Text>
        <Text style={[styles.bioText, isWarning ? { color: '#F87171' } : null]}>
          BLOOD: {isWarning ? '???' : pct >= 75 ? 'O-' : '---'}
        </Text>
        <Text style={[styles.bioText, { color: isWarning ? '#EF4444' : '#4ADE80' }]}>
          {isWarning ? 'ANOMALY!' : `${pct}%`}
        </Text>
      </View>
      <TouchableOpacity
        disabled={scanning}
        style={[
          styles.primaryBtn,
          {
            marginTop: 14,
            width: '100%',
            backgroundColor: isWarning ? (warningFlash ? '#EF4444' : '#7F1D1D') : '#22C55E',
            opacity: scanning && !isWarning ? 0.65 : 1,
          },
        ]}
        onPress={() => {
          setScanning(true);
          setScanPhase('SCANNING');
        }}
      >
        <Text style={[styles.primaryBtnText, isWarning ? { color: '#FFFFFF' } : null]}>
          {isWarning
            ? '⚠ WARNING: NON-CREW BIOMETRICS'
            : scanPhase === 'PASS'
              ? 'Biometrics Verified'
              : scanning
                ? 'Scanning Biometrics...'
                : 'Step on MedBay Pad & Scan'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/* 7. Inspect Sample — Animated Centrifuge Spin + Anomaly Tube */
const InspectSampleGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [phase, setPhase] = useState<'IDLE' | 'SPINNING' | 'READY'>('IDLE');
  const [ticks, setTicks] = useState(0);
  const anomalyIdx = useMemo(() => Math.floor(Math.random() * 5), []);

  useEffect(() => {
    if (phase !== 'SPINNING') return;
    const iv = setInterval(() => {
      setTicks((t) => {
        const next = t + 1;
        if (next >= 12) {
          clearInterval(iv);
          setPhase('READY');
        }
        return next;
      });
    }, 200);
    return () => clearInterval(iv);
  }, [phase]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {phase === 'IDLE'
          ? 'Start the centrifuge analyzer first.'
          : phase === 'SPINNING'
            ? 'Centrifuge spinning samples...'
            : 'Tap the crimson anomalous reagent tube.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 14 }}>
        {[0, 1, 2, 3, 4].map((idx) => {
          const isBad = phase === 'READY' && idx === anomalyIdx;
          const offset = phase === 'SPINNING' ? ((ticks + idx) % 2 === 0 ? -5 : 5) : 0;
          return (
            <TouchableOpacity
              key={idx}
              disabled={phase !== 'READY'}
              onPress={() => {
                if (idx === anomalyIdx) onDone();
              }}
              style={[
                styles.tube,
                {
                  backgroundColor: isBad ? '#EF4444' : phase === 'IDLE' ? '#475569' : '#38BDF8',
                  opacity: phase === 'READY' ? 1 : 0.75,
                  transform: [{ translateY: offset }],
                },
              ]}
            >
              <Text style={styles.tubeText}>{idx + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {phase === 'IDLE' ? (
        <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={() => setPhase('SPINNING')}>
          <Text style={styles.primaryBtnText}>Run Centrifuge</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

/* 8. Prime Shields — Honeycomb 2-3-2 Arrangement */
const PrimeShieldsGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [nodes, setNodes] = useState([false, true, false, false, true, false, true]);

  const tapNode = (idx: number) => {
    const next = nodes.map((v, i) => (i === idx ? true : v));
    setNodes(next);
    if (next.every(Boolean)) {
      setTimeout(onDone, 260);
    }
  };

  const pct = Math.round((nodes.filter(Boolean).length / nodes.length) * 100);
  const renderHexRow = (indices: number[]) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
      {indices.map((idx) => {
        const primed = nodes[idx];
        return (
          <TouchableOpacity
            key={idx}
            onPress={() => tapNode(idx)}
            style={[
              styles.shieldHex,
              {
                backgroundColor: primed ? '#E2E8F0' : '#DC2626',
                borderWidth: 2,
                borderColor: primed ? '#22D3EE' : '#FCA5A5',
              },
            ]}
          >
            <Text style={{ fontWeight: '900', color: primed ? '#0F172A' : '#FFFFFF' }}>
              {primed ? 'PRIMED' : 'OFF'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Text style={styles.hint}>Tap red deflector plates • Shield {pct}%</Text>
      {renderHexRow([0, 1])}
      {renderHexRow([2, 3, 4])}
      {renderHexRow([5, 6])}
    </View>
  );
};

/* 9. Start Reactor */
const StartReactorGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const sequence = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 9)),
    [],
  );
  const [step, setStep] = useState(1);
  const [showingIdx, setShowingIdx] = useState<number | null>(null);
  const [inputPos, setInputPos] = useState(0);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLocked(true);
    setInputPos(0);
    let idx = 0;
    const playNext = () => {
      if (cancelled) return;
      if (idx >= step) {
        setShowingIdx(null);
        setLocked(false);
        return;
      }
      setShowingIdx(sequence[idx]);
      setTimeout(() => {
        if (cancelled) return;
        setShowingIdx(null);
        idx += 1;
        setTimeout(playNext, 180);
      }, 420);
    };
    const t = setTimeout(playNext, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, sequence]);

  const handlePad = (cell: number) => {
    if (locked) return;
    if (cell === sequence[inputPos]) {
      const nextPos = inputPos + 1;
      if (nextPos >= step) {
        if (step >= sequence.length) {
          setTimeout(onDone, 260);
        } else {
          setStep((s) => s + 1);
        }
      } else {
        setInputPos(nextPos);
      }
    } else {
      setStep(1);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {locked ? `Watch sequence (Round ${step}/4)...` : `Repeat sequence (${inputPos}/${step})`}
      </Text>
      <View style={styles.reactorGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
          const lit = showingIdx === cell;
          return (
            <TouchableOpacity
              key={cell}
              onPress={() => handlePad(cell)}
              style={[
                styles.reactorBtn,
                { backgroundColor: lit ? '#38BDF8' : '#1E293B' },
              ]}
            >
              <Text style={{ color: lit ? '#060A12' : '#94A3B8', fontWeight: '900' }}>
                {cell + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/* 10. Unlock Manifolds */
const UnlockManifoldsGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const nums = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5), []);
  const [nextNum, setNextNum] = useState(1);

  const tapNum = (n: number) => {
    if (n === nextNum) {
      if (n === 10) {
        setTimeout(onDone, 220);
      } else {
        setNextNum(n + 1);
      }
    } else {
      setNextNum(1);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>Next required manifold: #{nextNum}</Text>
      <View style={styles.manifoldGrid}>
        {nums.map((n) => {
          const done = n < nextNum;
          return (
            <TouchableOpacity
              key={n}
              disabled={done}
              onPress={() => tapNum(n)}
              style={[
                styles.manifoldBtn,
                { backgroundColor: done ? '#22C55E' : '#1E293B' },
              ]}
            >
              <Text style={{ color: done ? '#060A12' : '#F8FAFC', fontWeight: '900', fontSize: 16 }}>
                {n}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/* 11. Align Engine Output — Visual Thruster Plume + Vector Lock */
const AlignEngineGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [angle, setAngle] = useState(-28);
  const aligned = Math.abs(angle) <= 2;

  const adjust = (delta: number) => {
    setAngle((prev) => Math.max(-35, Math.min(35, prev + delta)));
  };

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>
        Thruster Pitch: {angle > 0 ? `+${angle}°` : `${angle}°`} {aligned ? '• ALIGNED' : ''}
      </Text>
      <View style={styles.thrusterScope}>
        <View style={[styles.targetHorizon, { borderColor: aligned ? '#4ADE80' : '#EF4444' }]} />
        <View
          style={[
            styles.thrusterBody,
            {
              borderColor: aligned ? '#4ADE80' : '#64748B',
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        >
          <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 11 }}>ENGINE ►</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, width: '100%' }}>
        <TouchableOpacity style={[styles.nudgeBtn]} onPress={() => adjust(-10)}>
          <Text style={styles.nudgeText}>-10°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn]} onPress={() => adjust(-2)}>
          <Text style={styles.nudgeText}>-2°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn]} onPress={() => adjust(2)}>
          <Text style={styles.nudgeText}>+2°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn]} onPress={() => adjust(10)}>
          <Text style={styles.nudgeText}>+10°</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        disabled={!aligned}
        onPress={() => setTimeout(onDone, 250)}
        style={[
          styles.primaryBtn,
          {
            marginTop: 12,
            width: '100%',
            backgroundColor: aligned ? '#22C55E' : '#1E293B',
          },
        ]}
      >
        <Text style={[styles.primaryBtnText, { color: aligned ? '#060A12' : '#64748B' }]}>
          {aligned ? 'Lock Thruster Vector' : 'Center Engine Within ±2°'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/* 12. Empty Garbage — Airlock Debris + Sliding Doors */
const EmptyGarbageGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [cleared, setCleared] = useState(0);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!holding) return;
    const iv = setInterval(() => {
      setCleared((c) => {
        const next = Math.min(100, c + 12);
        if (next >= 100) {
          clearInterval(iv);
          setHolding(false);
          setTimeout(onDone, 260);
        }
        return next;
      });
    }, 140);
    return () => clearInterval(iv);
  }, [holding, onDone]);

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>Airlock Chute • {cleared}% Cleared</Text>
      <View style={styles.chuteBox}>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            transform: [{ translateY: cleared * 0.9 }],
            opacity: Math.max(0.1, 1 - cleared / 100),
          }}
        >
          <View style={[styles.debrisItem, { backgroundColor: '#DC2626' }]} />
          <View style={[styles.debrisItem, { backgroundColor: '#D97706', borderRadius: 14 }]} />
          <View style={[styles.debrisItem, { backgroundColor: '#64748B' }]} />
        </View>
        <View style={[styles.hatchStatus, { backgroundColor: holding ? '#22C55E' : '#EF4444' }]} />
      </View>
      <TouchableOpacity
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        style={[
          styles.primaryBtn,
          { marginTop: 14, width: '100%', backgroundColor: holding ? '#22C55E' : '#EF4444' },
        ]}
      >
        <Text style={styles.primaryBtnText}>
          {holding ? 'Venting Debris to Space...' : 'HOLD CHUTE LEVER DOWN'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/* 13. Calibrate Distributor */
const CalibrateDistributorGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [ringIdx, setRingIdx] = useState(0);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setPos((p) => (p + 10) % 100);
    }, 95);
    return () => clearInterval(iv);
  }, []);

  const inZone = pos >= 34 && pos <= 66;

  const lockPhase = () => {
    if (inZone) {
      if (ringIdx >= 2) {
        setTimeout(onDone, 260);
      } else {
        setRingIdx((r) => r + 1);
      }
    } else {
      setRingIdx(0);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        Phase Ring {ringIdx + 1} / 3 — Tap LOCK when the marker enters the green zone.
      </Text>
      <View style={styles.calibTrack}>
        <View style={styles.calibSweetSpot} />
        <View style={[styles.calibNeedle, { left: `${pos}%` }]} />
      </View>
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          { marginTop: 18, width: '100%', backgroundColor: inZone ? '#22C55E' : '#38BDF8' },
        ]}
        onPress={lockPhase}
      >
        <Text style={styles.primaryBtnText}>LOCK RING {ringIdx + 1}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* 14. Divert Power — Bus Conduit Meter + Breaker Flip */
const DivertPowerGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const rooms = ['O2', 'SHIELDS', 'COMMS', 'WEAPONS'];
  const targetIdx = useMemo(() => Math.floor(Math.random() * 4), []);
  const [power, setPower] = useState(25);
  const ready = power >= 100;

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>
        {!ready
          ? `Boost ${rooms[targetIdx]} Bus Power to 100%`
          : `Snap ${rooms[targetIdx]} Breaker Switch`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, width: '100%', marginBottom: 14 }}>
        {rooms.map((rm, idx) => {
          const isTarget = idx === targetIdx;
          return (
            <View
              key={rm}
              style={[
                styles.busCell,
                { borderColor: isTarget ? '#F59E0B' : '#1E293B' },
              ]}
            >
              <Text style={styles.busLabel}>{rm}</Text>
              <Text style={[styles.busVal, { color: isTarget ? '#FBBF24' : '#475569' }]}>
                {isTarget ? `${power}%` : 'OFF'}
              </Text>
            </View>
          );
        })}
      </View>
      {!ready ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', backgroundColor: '#F59E0B' }]}
          onPress={() => setPower((p) => Math.min(100, p + 25))}
        >
          <Text style={styles.primaryBtnText}>Boost {rooms[targetIdx]} Fader (+25%)</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', backgroundColor: '#22C55E' }]}
          onPress={() => setTimeout(onDone, 250)}
        >
          <Text style={styles.primaryBtnText}>Flip {rooms[targetIdx]} Breaker Switch</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* 15. Clean O2 Filter */
const CleanO2FilterGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [leaves, setLeaves] = useState([true, true, true, true, true, true]);

  const removeLeaf = (idx: number) => {
    const next = leaves.map((v, i) => (i === idx ? false : v));
    setLeaves(next);
    if (next.every((v) => !v)) {
      setTimeout(onDone, 250);
    }
  };

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>
        Tap leaves to vacuum into O2 chute ({leaves.filter(Boolean).length} left)
      </Text>
      <View style={styles.o2VentBox}>
        <View style={styles.o2ChuteStrip}>
          <Text style={styles.o2ChuteText}>VACUUM</Text>
        </View>
        <View style={[styles.gridWrap, { flex: 1, paddingVertical: 8 }]}>
          {leaves.map((present, idx) => (
            <TouchableOpacity
              key={idx}
              disabled={!present}
              onPress={() => removeLeaf(idx)}
              style={[
                styles.leafBtn,
                {
                  backgroundColor: idx % 2 === 0 ? '#D97706' : '#65A30D',
                  opacity: present ? 1 : 0.12,
                },
              ]}
            >
              <Text style={{ fontWeight: '900', color: '#FEF3C7', fontSize: 11 }}>
                {present ? 'LEAF' : 'OK'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

/* 16. Chart Course — Radar Beacon Plotter */
const ChartCourseGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [beacon, setBeacon] = useState(0);
  const coords = [
    { left: '12%', top: '65%' },
    { left: '34%', top: '24%' },
    { left: '60%', top: '58%' },
    { left: '82%', top: '20%' },
  ];

  const hitBeacon = (idx: number) => {
    if (idx === beacon + 1) {
      setBeacon(idx);
      if (idx === 3) {
        setTimeout(onDone, 260);
      }
    }
  };

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Text style={styles.hint}>Tap next glowing beacon ({beacon + 1} / 4)</Text>
      <View style={styles.chartRadar}>
        {coords.map((pt, idx) => {
          const isCurrent = idx === beacon;
          const isNext = idx === beacon + 1;
          const passed = idx < beacon;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => hitBeacon(idx)}
              style={[
                styles.beaconNode,
                {
                  left: pt.left as `${number}%`,
                  top: pt.top as `${number}%`,
                  backgroundColor: isCurrent
                    ? '#38BDF8'
                    : isNext
                      ? '#FBBF24'
                      : passed
                        ? '#22C55E'
                        : '#1E293B',
                },
              ]}
            >
              <Text
                style={{
                  fontWeight: '900',
                  fontSize: 11,
                  color: isCurrent || isNext || passed ? '#060A12' : '#94A3B8',
                }}
              >
                {isCurrent ? 'SHIP' : `W${idx + 1}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.88)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#131A26',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#38BDF8',
  },
  taskTitle: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
  },
  blackoutNotice: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blackoutNoticeText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
  },
  instruction: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
  },
  body: {
    marginTop: 16,
    backgroundColor: '#0B0F17',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  hint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 12,
    textAlign: 'center',
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  col: {
    flex: 1,
    gap: 10,
  },
  wireBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wireText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  walletBox: {
    width: '100%',
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#3B2314',
    borderWidth: 2,
    borderColor: '#7C4A2D',
    alignItems: 'center',
  },
  walletTitle: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  idCardMini: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  idCardText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 12,
  },
  readerTrack: {
    width: '100%',
    height: 68,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  idCardBadge: {
    width: 96,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idCardBadgeText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 12,
  },
  spaceBox: {
    width: '100%',
    height: 190,
    backgroundColor: '#050810',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
  },
  asteroidBtn: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#64748B',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  asteroidText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  conduitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  nodeBoxAmber: {
    width: 64,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeBoxCyan: {
    width: 64,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeBoxText: {
    color: '#060A12',
    fontSize: 10,
    fontWeight: '900',
  },
  packetBridge: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  packetBlock: {
    position: 'absolute',
    width: 18,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  glitchBtn: {
    alignSelf: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  glitchBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  tankFrame: {
    width: 96,
    height: 128,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#0F172A',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  tankLiquid: {
    width: '100%',
  },
  tankPct: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  scanChamber: {
    width: '100%',
    height: 126,
    borderRadius: 14,
    backgroundColor: '#05151C',
    borderWidth: 1.5,
    borderColor: '#0E7490',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  crewSilhouette: {
    width: 48,
    height: 66,
    borderRadius: 20,
    backgroundColor: '#083344',
    borderWidth: 2,
    borderColor: '#22D3EE',
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingRight: 4,
  },
  crewVisor: {
    width: 24,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38BDF8',
  },
  scanLaser: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#34D399',
  },
  bioReadout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  bioText: {
    color: '#BAE6FD',
    fontWeight: '800',
    fontSize: 11,
  },
  progressTrack: {
    width: '100%',
    height: 14,
    borderRadius: 99,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: '#060A12',
    fontWeight: '900',
    fontSize: 14,
  },
  tube: {
    width: 48,
    height: 82,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tubeText: {
    color: '#060A12',
    fontWeight: '900',
    fontSize: 16,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  shieldHex: {
    width: 72,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 210,
    gap: 10,
    justifyContent: 'center',
  },
  reactorBtn: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manifoldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  manifoldBtn: {
    width: 54,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thrusterScope: {
    width: '100%',
    height: 112,
    borderRadius: 14,
    backgroundColor: '#07101C',
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  targetHorizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  thrusterBody: {
    width: 116,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nudgeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nudgeText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13,
  },
  chuteBox: {
    width: '100%',
    height: 124,
    borderRadius: 14,
    backgroundColor: '#060912',
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    overflow: 'hidden',
  },
  debrisItem: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  hatchStatus: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  calibTrack: {
    width: '100%',
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calibSweetSpot: {
    position: 'absolute',
    left: '34%',
    width: '32%',
    height: '100%',
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#22C55E',
  },
  calibNeedle: {
    position: 'absolute',
    width: 6,
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  busCell: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  busLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  busVal: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  o2VentBox: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  o2ChuteStrip: {
    width: 44,
    backgroundColor: '#082F49',
    borderRightWidth: 2,
    borderRightColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  o2ChuteText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '900',
    transform: [{ rotate: '-90deg' }],
  },
  leafBtn: {
    width: 68,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartRadar: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: '#06111E',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    position: 'relative',
    overflow: 'hidden',
  },
  beaconNode: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
