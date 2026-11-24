import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import jsQR from 'jsqr';
import { Camera, ImagePlus, Keyboard, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { parseQrOrManualInput, ParsedQrAction } from '../shared/skeldData';
import { soundEngine } from '../utils/sound';

export interface QrScanValidationResult {
  valid: boolean;
  error?: string;
}

interface QrScannerModalProps {
  title: string;
  subtitle: string;
  accentColor?: 'emerald' | 'red' | 'cyan';
  hideManualCodes?: boolean;
  onDetected: (
    parsed: ParsedQrAction,
  ) => Promise<QrScanValidationResult | void> | QrScanValidationResult | void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  title,
  subtitle,
  accentColor = 'cyan',
  hideManualCodes = false,
  onDetected,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const mountedRef = useRef(true);
  const cooldownTimerRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current !== null) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const submitParsedQr = useCallback(
    async (parsed: ParsedQrAction, fromCamera: boolean): Promise<boolean> => {
      if (detectedRef.current) return false;
      detectedRef.current = true;

      try {
        const result = await onDetectedRef.current(parsed);
        if (!mountedRef.current) return true;

        if (result && result.valid === false) {
          setManualError(
            result.error || 'QR code not valid right now. Aim at a valid station or badge QR.',
          );
          if (cooldownTimerRef.current !== null) {
            window.clearTimeout(cooldownTimerRef.current);
          }
          cooldownTimerRef.current = window.setTimeout(() => {
            detectedRef.current = false;
          }, fromCamera ? 1200 : 250);
          return false;
        }

        soundEngine.playClick();
        stopCamera();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setManualError(err instanceof Error ? err.message : 'Unable to process QR code.');
        if (cooldownTimerRef.current !== null) {
          window.clearTimeout(cooldownTimerRef.current);
        }
        cooldownTimerRef.current = window.setTimeout(() => {
          detectedRef.current = false;
        }, fromCamera ? 1200 : 250);
        return false;
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(
    async (preferredFacing: 'environment' | 'user') => {
      stopCamera();
      setCameraError(null);

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraError(
          hideManualCodes
            ? 'Live video requires HTTPS on LAN IPs. Use "Take Photo of QR" below.'
            : 'Live video requires HTTPS on LAN IPs. Use "Take Photo of QR" or enter the manual code below.',
        );
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          hideManualCodes
            ? 'Live camera API unavailable in this browser. Use "Take Photo of QR" below.'
            : 'Live camera API unavailable in this browser. Use "Take Photo of QR" or enter the manual code below.',
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: preferredFacing } },
          audio: false,
        });
      } catch {
        // Fallback for localhost desktop webcams that reject facingMode constraints
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.name : '';
          if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
            setCameraError(
              'Camera permission was blocked. Allow camera access in your browser address bar and tap Retry, or use Photo / Manual Code below.',
            );
          } else if (msg === 'NotFoundError' || msg === 'DevicesNotFoundError') {
            setCameraError('No camera detected on this device. Use the manual code entry below.');
          } else {
            setCameraError(
              'Unable to start live camera stream (it may be in use by another app). Use Photo QR or Manual Code below.',
            );
          }
          return;
        }
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      try {
        await video.play();
      } catch {
        // Autoplay fallback
      }
      setCameraActive(true);

      type NativeBarcodeDetector = {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
      const BarcodeDetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector;
        }
      ).BarcodeDetector;

      let nativeDetector: NativeBarcodeDetector | null = null;
      if (BarcodeDetectorCtor) {
        try {
          nativeDetector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        } catch {
          nativeDetector = null;
        }
      }

      let nativeDetecting = false;
      let lastInvalidRawAt = 0;

      const handleDecodedText = (rawText: string) => {
        if (detectedRef.current) return;
        const parsed = parseQrOrManualInput(rawText);
        if (!parsed) {
          const now = Date.now();
          if (now - lastInvalidRawAt > 1500) {
            lastInvalidRawAt = now;
            setManualError('Unrecognized QR code — keep aiming at an AMONG-US IRL QR code.');
          }
          return;
        }
        void submitParsedQr(parsed, true);
      };

      const scanFrame = () => {
        if (!mountedRef.current || !streamRef.current) return;

        if (!detectedRef.current) {
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.readyState >= v.HAVE_CURRENT_DATA) {
            const w = v.videoWidth;
            const h = v.videoHeight;
            if (w > 0 && h > 0) {
              if (nativeDetector && !nativeDetecting) {
                nativeDetecting = true;
                nativeDetector
                  .detect(v)
                  .then((codes) => {
                    for (const item of codes) {
                      if (item.rawValue) {
                        handleDecodedText(item.rawValue);
                        break;
                      }
                    }
                  })
                  .catch(() => {
                    nativeDetector = null;
                  })
                  .finally(() => {
                    nativeDetecting = false;
                  });
              }

              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
                if (code && code.data) {
                  handleDecodedText(code.data);
                }
              }
            }
          }
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    },
    [hideManualCodes, stopCamera, submitParsedQr],
  );

  useEffect(() => {
    detectedRef.current = false;
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode, startCamera, stopCamera]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualError(null);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1024;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (decoded && decoded.data) {
          const parsed = parseQrOrManualInput(decoded.data);
          if (parsed) {
            URL.revokeObjectURL(url);
            void submitParsedQr(parsed, false);
            return;
          }
        }
      }
      URL.revokeObjectURL(url);
      setManualError('No valid AMONG-US IRL QR detected in photo. Try closer framing or enter code manually.');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setManualError('Could not read captured image.');
    };
    img.src = url;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseQrOrManualInput(manualCode);
    if (!parsed) {
      setManualError('Unrecognized code. Enter a task code (e.g. WIR1), player suit (e.g. RED), or EMRG.');
      return;
    }
    void submitParsedQr(parsed, false);
  };

  const borderAccent =
    accentColor === 'red'
      ? 'border-red-500/60'
      : accentColor === 'emerald'
        ? 'border-emerald-500/60'
        : 'border-cyan-500/60';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full max-w-md max-h-[94dvh] overflow-y-auto bg-[#151C28] border border-white/15 rounded-t-3xl sm:rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0F1520]">
          <div className="min-w-0 pr-2">
            <h3 className="font-display text-2xl font-bold text-white leading-none">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Live Camera Viewfinder */}
          <div
            className={`relative h-56 bg-slate-950 rounded-xl border-2 overflow-hidden flex items-center justify-center ${borderAccent}`}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive ? (
              <>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-40 h-40 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] overflow-hidden flex items-center justify-center">
                    <div className="w-36 h-0.5 bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-scanner-sweep" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                  className="absolute bottom-2.5 right-2.5 min-h-[40px] px-3 rounded-lg bg-black/70 hover:bg-black/90 border border-white/20 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span>Flip</span>
                </button>
              </>
            ) : (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center gap-2.5">
                <Camera className="w-8 h-8 text-slate-500" />
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  {cameraError || 'Initializing camera QR scanner...'}
                </p>
                {cameraError && (
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Native Photo Capture Fallback (Works on phones even over plain HTTP LAN!) */}
          <label className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2 cursor-pointer">
            <ImagePlus className="w-4 h-4" />
            <span>Take Photo of QR Code (HTTP Camera Fallback)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>

          {/* Manual Fallback Code Input (Hidden when Host enables Hide Manual Codes) */}
          {!hideManualCodes && (
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Keyboard className="w-4 h-4 text-slate-400" />
                <span>Manual Code Fallback (Task / Suit Color / EMRG)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value.toUpperCase());
                    setManualError(null);
                  }}
                  placeholder="e.g. WIR1, RED, EMRG"
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl bg-slate-950 border border-white/15 font-mono text-sm uppercase text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm whitespace-nowrap shrink-0"
                >
                  Submit
                </button>
              </div>
              {manualError && <p className="text-xs text-red-400">{manualError}</p>}
            </form>
          )}
          {hideManualCodes && manualError && (
            <p className="text-xs text-red-400">{manualError}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
