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
  onComplete: () => void;
  onClose: () => void;
}

export const TaskMiniGamesModal: React.FC<TaskMiniGamesModalProps> = ({
  task,
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
        return <MedbayScanGame onDone={onComplete} />;
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

/* 4. Upload Data */
const UploadDataGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 8);
        if (next >= 100) {
          clearInterval(iv);
          setTimeout(onDone, 300);
        }
        return next;
      });
    }, 180);
    return () => clearInterval(iv);
  }, [running, onDone]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.bigPct}>{progress}%</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#38BDF8' }]} />
      </View>
      <TouchableOpacity
        disabled={running}
        style={[styles.primaryBtn, { marginTop: 18, width: '100%', opacity: running ? 0.6 : 1 }]}
        onPress={() => setRunning(true)}
      >
        <Text style={styles.primaryBtnText}>{running ? 'Uploading Packets...' : 'Upload Data'}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* 5. Fuel Engines */
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
    }, 160);
    return () => clearInterval(iv);
  }, [holding, stage, onDone]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {stage === 'FILL' ? 'Phase 1: Fill Gas Canister' : 'Phase 2: Pour Fuel Into Engine'} ({level}%)
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${level}%`, backgroundColor: '#F59E0B' }]} />
      </View>
      <TouchableOpacity
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        style={[styles.primaryBtn, { marginTop: 18, width: '100%', backgroundColor: '#F59E0B' }]}
      >
        <Text style={styles.primaryBtnText}>HOLD TO {stage === 'FILL' ? 'FILL CANISTER' : 'FUEL ENGINE'}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* 6. MedBay Scan */
const MedbayScanGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [pct, setPct] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!scanning) return;
    const iv = setInterval(() => {
      setPct((p) => {
        const next = Math.min(100, p + 10);
        if (next >= 100) {
          clearInterval(iv);
          setTimeout(onDone, 300);
        }
        return next;
      });
    }, 240);
    return () => clearInterval(iv);
  }, [scanning, onDone]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.bigPct}>{pct}%</Text>
      <Text style={styles.hint}>
        {scanning ? 'Analyzing height, weight, and blood type...' : 'Tap Start Scan to begin biometric check.'}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#22C55E' }]} />
      </View>
      <TouchableOpacity
        disabled={scanning}
        style={[styles.primaryBtn, { marginTop: 18, width: '100%', backgroundColor: '#22C55E' }]}
        onPress={() => setScanning(true)}
      >
        <Text style={styles.primaryBtnText}>{scanning ? 'Scanning...' : 'Submit Biometric Scan'}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* 7. Inspect Sample */
const InspectSampleGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [analyzed, setAnalyzed] = useState(false);
  const anomalyIdx = useMemo(() => Math.floor(Math.random() * 5), []);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {analyzed ? 'Select the crimson anomalous reagent tube.' : 'Start the centrifuge analyzer first.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 14 }}>
        {[0, 1, 2, 3, 4].map((idx) => {
          const isBad = analyzed && idx === anomalyIdx;
          return (
            <TouchableOpacity
              key={idx}
              disabled={!analyzed}
              onPress={() => {
                if (idx === anomalyIdx) onDone();
              }}
              style={[
                styles.tube,
                { backgroundColor: isBad ? '#EF4444' : '#38BDF8', opacity: analyzed ? 1 : 0.45 },
              ]}
            >
              <Text style={styles.tubeText}>{idx + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!analyzed ? (
        <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={() => setAnalyzed(true)}>
          <Text style={styles.primaryBtnText}>Run Centrifuge</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

/* 8. Prime Shields */
const PrimeShieldsGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [nodes, setNodes] = useState([false, true, false, false, true, false, true]);

  const tapNode = (idx: number) => {
    const next = nodes.map((v, i) => (i === idx ? true : v));
    setNodes(next);
    if (next.every(Boolean)) {
      setTimeout(onDone, 260);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>Tap all red nodes until every shield plate turns white.</Text>
      <View style={styles.gridWrap}>
        {nodes.map((primed, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => tapNode(idx)}
            style={[
              styles.shieldHex,
              { backgroundColor: primed ? '#E2E8F0' : '#EF4444' },
            ]}
          >
            <Text style={{ fontWeight: '900', color: primed ? '#0F172A' : '#FFFFFF' }}>
              {primed ? 'OK' : 'TAP'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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

/* 11. Align Engine Output */
const AlignEngineGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [angle, setAngle] = useState(-30);

  const adjust = (delta: number) => {
    const next = Math.max(-45, Math.min(45, angle + delta));
    setAngle(next);
    if (Math.abs(next) <= 3) {
      setTimeout(onDone, 300);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.bigPct}>{angle.toFixed(1)}°</Text>
      <Text style={styles.hint}>Bring engine output pitch within ±3° of 0.0°.</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, width: '100%' }}>
        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => adjust(-10)}>
          <Text style={styles.primaryBtnText}>-10°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => adjust(-3)}>
          <Text style={styles.primaryBtnText}>-3°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => adjust(3)}>
          <Text style={styles.primaryBtnText}>+3°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => adjust(10)}>
          <Text style={styles.primaryBtnText}>+10°</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* 12. Empty Garbage */
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
    }, 150);
    return () => clearInterval(iv);
  }, [holding, onDone]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.bigPct}>{cleared}%</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${cleared}%`, backgroundColor: '#22C55E' }]} />
      </View>
      <TouchableOpacity
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        style={[styles.primaryBtn, { marginTop: 18, width: '100%', backgroundColor: '#22C55E' }]}
      >
        <Text style={styles.primaryBtnText}>HOLD CHUTE LEVER</Text>
      </TouchableOpacity>
    </View>
  );
};

/* 13. Calibrate Distributor (Generous Forgiving Window) */
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

/* 14. Divert Power */
const DivertPowerGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [boosted, setBoosted] = useState(false);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        {!boosted ? 'Step 1: Raise Electrical Bus Output.' : 'Step 2: Flip Destination Breaker Switch.'}
      </Text>
      {!boosted ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', backgroundColor: '#F59E0B' }]}
          onPress={() => setBoosted(true)}
        >
          <Text style={styles.primaryBtnText}>Raise Bus Power to 100%</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%', backgroundColor: '#22C55E' }]}
          onPress={() => setTimeout(onDone, 250)}
        >
          <Text style={styles.primaryBtnText}>Flip Destination Breaker</Text>
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
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>
        Tap each leaf to clear the O2 filter ({leaves.filter(Boolean).length} left).
      </Text>
      <View style={styles.gridWrap}>
        {leaves.map((present, idx) => (
          <TouchableOpacity
            key={idx}
            disabled={!present}
            onPress={() => removeLeaf(idx)}
            style={[
              styles.leafBtn,
              { opacity: present ? 1 : 0.15 },
            ]}
          >
            <Text style={{ fontWeight: '900', color: '#060A12' }}>{present ? 'LEAF' : 'OK'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

/* 16. Chart Course */
const ChartCourseGame: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [beacon, setBeacon] = useState(0);

  const hitBeacon = (idx: number) => {
    if (idx === beacon) {
      if (idx === 3) {
        setTimeout(onDone, 250);
      } else {
        setBeacon(idx + 1);
      }
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.hint}>Tap navigation beacons in sequence: {beacon + 1} / 4</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
        {[0, 1, 2, 3].map((idx) => {
          const passed = idx < beacon;
          const active = idx === beacon;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => hitBeacon(idx)}
              style={[
                styles.beaconBtn,
                {
                  backgroundColor: passed ? '#22C55E' : active ? '#38BDF8' : '#1E293B',
                },
              ]}
            >
              <Text style={{ fontWeight: '900', color: passed || active ? '#060A12' : '#94A3B8' }}>
                WP-{idx + 1}
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
  bigPct: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 8,
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
    width: 68,
    height: 52,
    borderRadius: 12,
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
  leafBtn: {
    width: 74,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4ADE80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  beaconBtn: {
    width: 66,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
