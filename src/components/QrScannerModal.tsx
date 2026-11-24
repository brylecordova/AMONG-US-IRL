import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Keyboard, X } from 'lucide-react';
import { parseQrOrManualInput, ParsedQrAction } from '../shared/skeldData';
import { soundEngine } from '../utils/sound';

interface QrScannerModalProps {
  title: string;
  subtitle: string;
  accentColor?: 'emerald' | 'red' | 'cyan';
  onDetected: (parsed: ParsedQrAction) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  title,
  subtitle,
  accentColor = 'cyan',
  onDetected,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let rafId = 0;
    let mounted = true;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera API unavailable on this connection (HTTPS required on most phones). Use the manual station/badge code below.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraActive(true);
          rafId = requestAnimationFrame(scanFrame);
        }
      } catch {
        if (mounted) {
          setCameraError(
            'Camera permission denied or unavailable. Enter the 3–4 letter QR badge code manually below.',
          );
        }
      }
    }

    function scanFrame() {
      if (!mounted || detectedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              const parsed = parseQrOrManualInput(code.data);
              if (parsed) {
                detectedRef.current = true;
                soundEngine.playClick();
                onDetected(parsed);
                return;
              }
            }
          }
        }
      }
      rafId = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onDetected]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseQrOrManualInput(manualCode);
    if (!parsed) {
      setManualError('Unrecognized code. Enter a task code (e.g. WIR1), player suit (e.g. RED), or EMRG.');
      return;
    }
    soundEngine.playClick();
    onDetected(parsed);
  };

  const borderAccent =
    accentColor === 'red'
      ? 'border-red-500/60'
      : accentColor === 'emerald'
        ? 'border-emerald-500/60'
        : 'border-cyan-500/60';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#151C28] border border-white/15 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0F1520]">
          <div>
            <h3 className="font-display text-2xl font-bold text-white leading-none">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Live Camera Viewfinder */}
          <div className={`relative h-60 bg-slate-950 rounded-xl border-2 overflow-hidden flex items-center justify-center ${borderAccent}`}>
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraActive ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            ) : (
              <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center gap-2">
                <Camera className="w-8 h-8 text-slate-500" />
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  {cameraError || 'Initializing rear camera QR scanner...'}
                </p>
              </div>
            )}
          </div>

          {/* Manual Fallback Code Input */}
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
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-950 border border-white/15 font-mono text-sm uppercase text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
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
        </div>
      </div>
    </div>
  );
};
