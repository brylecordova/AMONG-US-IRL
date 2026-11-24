import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ClientGameState,
  normalizeServerUrl,
  ParsedQrAction,
  PLAYER_COLORS,
  PlayerColorId,
} from '../skeldShared';
import { AnimatedCrewmate } from '../components/AnimatedCrewmate';
import { NativeQrScannerModal } from '../components/NativeQrScannerModal';

interface JoinScreenProps {
  initialServerUrl: string;
  onJoined: (payload: {
    serverUrl: string;
    sessionCode: string;
    playerToken: string;
    state: ClientGameState;
  }) => void;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({ initialServerUrl, onJoined }) => {
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [sessionCode, setSessionCode] = useState('');
  const [mode, setMode] = useState<'NEW' | 'REJOIN'>('NEW');
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<PlayerColorId>('red');
  const [takenColors, setTakenColors] = useState<PlayerColorId[]>([]);
  const [rejoinCode, setRejoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Fetch public lobby color availability whenever serverUrl & valid 5+ char code exist
  useEffect(() => {
    const cleanBase = normalizeServerUrl(serverUrl);
    const cleanCode = sessionCode.trim().toUpperCase();
    if (!cleanBase || cleanCode.length < 4) {
      setTakenColors([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${cleanBase}/api/sessions/${cleanCode}/public`);
        if (!res.ok) return;
        const data = (await res.json()) as { takenColors?: PlayerColorId[] };
        if (!cancelled && Array.isArray(data.takenColors)) {
          setTakenColors(data.takenColors);
          if (data.takenColors.includes(selectedColor)) {
            const firstFree = PLAYER_COLORS.find((c) => !data.takenColors?.includes(c.id));
            if (firstFree) setSelectedColor(firstFree.id);
          }
        }
      } catch {
        // Ignore network errors while typing LAN URL
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serverUrl, sessionCode, selectedColor]);

  const handleJoinQrDetected = (parsed: ParsedQrAction) => {
    setShowQrScanner(false);
    setErrorMsg(null);
    if (parsed.kind === 'JOIN') {
      setSessionCode(parsed.sessionCode);
      if (parsed.serverOrigin) {
        setServerUrl(parsed.serverOrigin);
      }
    } else if (parsed.sessionCode) {
      setSessionCode(parsed.sessionCode);
    } else {
      setErrorMsg('Please scan the Host PC "Join Mission" QR code.');
    }
  };

  const handleSubmit = async () => {
    const baseUrl = normalizeServerUrl(serverUrl);
    const cleanCode = sessionCode.trim().toUpperCase();
    if (!baseUrl) {
      setErrorMsg('Enter your Host PC LAN address (e.g., http://192.168.1.42:3000).');
      return;
    }
    if (!cleanCode) {
      setErrorMsg('Enter or scan the Mission Code from the Host PC.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === 'NEW') {
        if (!name.trim()) throw new Error('Enter your callsign before boarding.');
        const res = await fetch(`${baseUrl}/api/sessions/${cleanCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color: selectedColor }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to join mission.');
        onJoined({
          serverUrl: baseUrl,
          sessionCode: cleanCode,
          playerToken: data.playerToken,
          state: data.state,
        });
      } else {
        if (!rejoinCode.trim()) throw new Error('Enter your 5-character Player Rejoin Code.');
        const res = await fetch(`${baseUrl}/api/sessions/${cleanCode}/rejoin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejoinCode: rejoinCode.trim().toUpperCase() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to rejoin mission.');
        onJoined({
          serverUrl: baseUrl,
          sessionCode: cleanCode,
          playerToken: data.playerToken,
          state: data.state,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed. Check Wi-Fi & IP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.topHero}>
            <AnimatedCrewmate color={selectedColor} size={64} animate />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>SKELD IRL • MOBILE SCANNER CLIENT</Text>
              <Text style={styles.title}>Board The Skeld</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.scanHostBtn}
            activeOpacity={0.85}
            onPress={() => setShowQrScanner(true)}
          >
            <Text style={styles.scanHostBtnText}>Scan Host PC Join QR Code</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Host Server Address (LAN or Tunnel URL)</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.42:3000"
            placeholderTextColor="#64748B"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Mission Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. SK42X"
            placeholderTextColor="#64748B"
            value={sessionCode}
            onChangeText={(txt) => setSessionCode(txt.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'NEW' && styles.segmentActive]}
              onPress={() => {
                setMode('NEW');
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.segmentText, mode === 'NEW' && styles.segmentTextActive]}>
                New Player
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'REJOIN' && styles.segmentActive]}
              onPress={() => {
                setMode('REJOIN');
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.segmentText, mode === 'REJOIN' && styles.segmentTextActive]}>
                Rejoin Game
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'NEW' ? (
            <>
              <Text style={styles.label}>Player Callsign</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
                maxLength={18}
              />

              <Text style={styles.label}>Select Suit Color (Matches Back QR Badge)</Text>
              <View style={styles.colorGrid}>
                {PLAYER_COLORS.map((c) => {
                  const taken = takenColors.includes(c.id);
                  const active = selectedColor === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      disabled={taken}
                      onPress={() => setSelectedColor(c.id)}
                      style={[
                        styles.colorCell,
                        {
                          backgroundColor: active ? '#1E293B' : '#0B0F17',
                          borderColor: active ? '#38BDF8' : '#1E293B',
                          opacity: taken ? 0.3 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                      <Text style={styles.colorLabel}>{taken ? 'TAKEN' : c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>5-Character Player Rejoin Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. A7K9P"
                placeholderTextColor="#64748B"
                value={rejoinCode}
                onChangeText={(txt) => setRejoinCode(txt.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
            </>
          )}

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={styles.submitBtn}
            disabled={loading}
            activeOpacity={0.85}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#060A12" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'NEW' ? 'Join Mission' : 'Restore Session'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <NativeQrScannerModal
        visible={showQrScanner}
        title="Scan Host Join QR"
        subtitle="Aim at the Join Mission QR displayed on the Host PC."
        onDetected={handleJoinQrDetected}
        onClose={() => setShowQrScanner(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  scroll: {
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#131A26',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
  },
  topHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: '#38BDF8',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
  },
  scanHostBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanHostBtnText: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 48,
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 4,
    marginTop: 16,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#1E293B',
  },
  segmentText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#F8FAFC',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  colorCell: {
    width: '31.4%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  colorLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    color: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#060A12',
    fontSize: 15,
    fontWeight: '900',
  },
});
