import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ParsedQrAction, parseQrOrManualInput } from '../skeldShared';

export interface NativeQrValidationResult {
  valid: boolean;
  error?: string;
}

interface NativeQrScannerModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  hideManualCodes?: boolean;
  onDetected: (
    parsed: ParsedQrAction,
    raw: string,
  ) => Promise<NativeQrValidationResult | void> | NativeQrValidationResult | void;
  onClose: () => void;
}

export const NativeQrScannerModal: React.FC<NativeQrScannerModalProps> = ({
  visible,
  title = 'Skeld Optical Scanner',
  subtitle = 'Point your phone camera at any Task, Security Cam, Player Back, Meeting, or Join QR code.',
  hideManualCodes = false,
  onDetected,
  onClose,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scanLockRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scanLockRef.current = false;
      setManualInput('');
      setErrorMsg(null);
      return;
    }

    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }

    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    sweep.start();
    return () => sweep.stop();
  }, [visible, permission, requestPermission, laserAnim]);

  const submitParsed = async (parsed: ParsedQrAction, raw: string, fromCamera: boolean) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      const result = await onDetected(parsed, raw);
      if (!visibleRef.current) return;
      if (result && result.valid === false) {
        setErrorMsg(result.error || 'QR code not valid right now. Keep scanning.');
        setTimeout(() => {
          scanLockRef.current = false;
        }, fromCamera ? 1200 : 250);
      }
    } catch (err) {
      if (!visibleRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process QR code.');
      setTimeout(() => {
        scanLockRef.current = false;
      }, fromCamera ? 1200 : 250);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    const parsed = parseQrOrManualInput(data);
    if (!parsed) {
      setErrorMsg(`Unrecognized QR code: ${data.slice(0, 36)}`);
      return;
    }
    void submitParsed(parsed, data, true);
  };

  const handleManualSubmit = () => {
    const parsed = parseQrOrManualInput(manualInput);
    if (!parsed) {
      setErrorMsg('Enter a valid station code (e.g. WIR1, CAMS, RED, EMRG) or Join URL.');
      return;
    }
    void submitParsed(parsed, manualInput.trim(), false);
  };

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 224],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeRoot} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.container}>
            <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cameraContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <Text style={styles.permissionDesc}>
                AMONG-US IRL uses your native phone camera to scan QR badges instantly over local Wi-Fi.
              </Text>
              <TouchableOpacity
                style={styles.grantBtn}
                onPress={() => requestPermission()}
              >
                <Text style={styles.grantBtnText}>Allow Rear Camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing={facing}
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={styles.overlayFrame}>
                <View style={styles.reticle}>
                  <Animated.View
                    style={[styles.laserLine, { transform: [{ translateY: laserTranslateY }] }]}
                  />
                </View>
              </View>
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() => setTorch((t) => !t)}
                >
                  <Text style={styles.ctrlBtnText}>{torch ? 'Flash: ON' : 'Flash: OFF'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                >
                  <Text style={styles.ctrlBtnText}>Flip Camera</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {errorMsg ? <Text style={styles.errorBanner}>{errorMsg}</Text> : null}

        {!hideManualCodes ? (
          <View style={styles.manualSection}>
            <Text style={styles.manualLabel}>Manual Station / Suit Code Fallback</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                placeholder="e.g. WIR1, CAMS, RED, EMRG"
                placeholderTextColor="#64748B"
                value={manualInput}
                onChangeText={(txt) => {
                  setManualInput(txt);
                  setErrorMsg(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleManualSubmit}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}>
                <Text style={styles.submitBtnText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  closeBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 13,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  permissionDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    textAlign: 'center',
  },
  grantBtn: {
    marginTop: 18,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
  },
  grantBtnText: {
    color: '#060A12',
    fontWeight: '900',
    fontSize: 14,
  },
  overlayFrame: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
    overflow: 'hidden',
  },
  laserLine: {
    height: 3,
    width: '92%',
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#38FEDC',
    shadowColor: '#38FEDC',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    gap: 12,
  },
  ctrlBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctrlBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    color: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  manualSection: {
    marginTop: 14,
  },
  manualLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94A3B8',
    marginBottom: 8,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#131A26',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#060A12',
    fontWeight: '900',
    fontSize: 14,
  },
});
