import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Smartphone,
  Trash2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
  ZapOff,
} from 'lucide-react';
import {
  buildRejoinUrl,
  GameSettings,
  getColorDef,
  HostGameState,
  PLAYER_COLORS,
  SKELD_TASKS,
} from '../shared/skeldData';
import { CrewmateAvatar } from './CrewmateAvatar';
import { GalacticBackdrop } from './GalacticBackdrop';
import {
  PrintedEmergencyQrCard,
  PrintedPlayerBadgeCard,
  PrintedTaskQrCard,
} from './PrintedQrCards';
import { QrCodeImg } from './QrCodeImg';
import { SmoothSlider } from './SmoothSlider';
import { soundEngine } from '../utils/sound';

interface HostDashboardProps {
  state: HostGameState;
  hostToken: string;
  onUpdateState: (next: HostGameState) => void;
  onExitHost: () => void;
}

type HostTab = 'CONTROL' | 'PRINT' | 'RULES';
type PrintFilter = 'ALL' | 'PLAYERS_ALL' | 'PLAYERS_JOINED' | 'TASKS' | 'MEETING';

interface ApkStatusInfo {
  available: boolean;
  fileName: string;
  originalFileName?: string;
  sizeBytes: number;
  sha256?: string;
  updatedAt?: string;
  downloadPath: string;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  state,
  hostToken,
  onUpdateState,
  onExitHost,
}) => {
  const [activeTab, setActiveTab] = useState<HostTab>('CONTROL');
  const [printFilter, setPrintFilter] = useState<PrintFilter>('ALL');
  const [urlInput, setUrlInput] = useState(state.publicUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const printSheetRef = React.useRef<HTMLDivElement | null>(null);
  const apkInputRef = React.useRef<HTMLInputElement | null>(null);

  const [apkStatus, setApkStatus] = useState<ApkStatusInfo | null>(null);
  const [apkLoading, setApkLoading] = useState(false);
  const [apkUploading, setApkUploading] = useState(false);
  const [apkUploadPct, setApkUploadPct] = useState(0);
  const [apkDragOver, setApkDragOver] = useState(false);
  const [apkError, setApkError] = useState<string | null>(null);
  const [selectedRejoinPlayerId, setSelectedRejoinPlayerId] = useState<string | null>(null);
  const [rejoinUrlCopied, setRejoinUrlCopied] = useState(false);

  const joinUrl = `${state.publicUrl}/?join=${state.sessionCode}`;
  const apkDownloadUrl = `${state.publicUrl}/download/among-us-irl.apk`;

  const selectedRejoinPlayer = selectedRejoinPlayerId
    ? state.players.find((p) => p.playerId === selectedRejoinPlayerId) ?? null
    : null;
  const rejoinQrUrl = selectedRejoinPlayer?.rejoinCode
    ? buildRejoinUrl(state.publicUrl, state.sessionCode, selectedRejoinPlayer.rejoinCode)
    : '';

  useEffect(() => {
    setRejoinUrlCopied(false);
  }, [selectedRejoinPlayerId]);

  useEffect(() => {
    if (!selectedRejoinPlayer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedRejoinPlayerId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRejoinPlayer]);

  const handleCopyRejoinUrl = async () => {
    if (!rejoinQrUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rejoinQrUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = rejoinQrUrl;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setRejoinUrlCopied(true);
      setTimeout(() => setRejoinUrlCopied(false), 1800);
    } catch {
      // Clipboard blocked on restricted context
    }
  };

  const fetchApkStatus = useCallback(async () => {
    setApkLoading(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/host/apk`, {
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { status?: ApkStatusInfo };
      if (data.status) {
        setApkStatus(data.status);
      }
    } catch {
      // Non-fatal network hiccup while polling APK folder status
    } finally {
      setApkLoading(false);
    }
  }, [hostToken, state.sessionCode]);

  useEffect(() => {
    void fetchApkStatus();
  }, [fetchApkStatus]);

  const uploadApkFile = (file: File) => {
    setApkError(null);
    if (!file.name.toLowerCase().endsWith('.apk')) {
      setApkError('Please select a valid Android .apk file.');
      return;
    }
    if (file.size === 0 || file.size > 125 * 1024 * 1024) {
      setApkError('APK file must be between 1 byte and 125 MB.');
      return;
    }

    setApkUploading(true);
    setApkUploadPct(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/sessions/${state.sessionCode}/host/apk`);
    xhr.setRequestHeader('Authorization', `Bearer ${hostToken}`);
    xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        setApkUploadPct(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      setApkUploading(false);
      try {
        const data = JSON.parse(xhr.responseText || '{}') as {
          status?: ApkStatusInfo;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && data.status) {
          setApkStatus(data.status);
          setApkUploadPct(100);
        } else {
          setApkError(data.error || `Upload failed (${xhr.status}).`);
        }
      } catch {
        setApkError(`Upload failed (${xhr.status}).`);
      }
    };

    xhr.onerror = () => {
      setApkUploading(false);
      setApkError('Network error while uploading APK to Host server.');
    };

    xhr.send(file);
  };

  const removeHostedApk = async () => {
    setApkError(null);
    setApkLoading(true);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/host/apk`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const data = (await res.json()) as { status?: ApkStatusInfo; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to remove hosted APK.');
      }
      if (data.status) {
        setApkStatus(data.status);
      }
    } catch (err) {
      setApkError(err instanceof Error ? err.message : 'Unable to remove hosted APK.');
    } finally {
      setApkLoading(false);
    }
  };

  const callHostApi = async (path: string, body?: unknown) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/host/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      if (data.state) {
        onUpdateState(data.state);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const savePublicUrl = async (customUrl: string) => {
    await callHostApi('url', { publicUrl: customUrl });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 1800);
  };

  const settingsSeqRef = React.useRef(0);

  const updateSettings = async (patch: Partial<GameSettings>) => {
    const seq = ++settingsSeqRef.current;
    setErrorMsg(null);
    onUpdateState({
      ...state,
      settings: {
        ...state.settings,
        ...patch,
      },
    });
    try {
      const res = await fetch(`/api/sessions/${state.sessionCode}/host/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }
      if (data.state && seq === settingsSeqRef.current) {
        onUpdateState(data.state);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const toggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const aliveCount = state.players.filter((p) => p.alive).length;
  const deadCount = state.players.length - aliveCount;

  const playersToPrint =
    printFilter === 'PLAYERS_JOINED'
      ? PLAYER_COLORS.filter((c) => state.players.some((p) => p.color === c.id))
      : PLAYER_COLORS;

  const chunkItems = <T,>(items: T[], size: number): T[][] => {
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      pages.push(items.slice(i, i + size));
    }
    return pages;
  };

  const crewBadgePages = chunkItems(playersToPrint, 2);
  const taskCardPages = chunkItems(SKELD_TASKS, 4);
  const showBadgesSection =
    printFilter === 'ALL' ||
    printFilter === 'PLAYERS_ALL' ||
    printFilter === 'PLAYERS_JOINED';
  const showTasksSection = printFilter === 'ALL' || printFilter === 'TASKS';
  const showMeetingSection = printFilter === 'ALL' || printFilter === 'MEETING';

  const collectDocumentCss = () => {
    const chunks: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules);
        chunks.push(rules.map((r) => r.cssText).join('\n'));
      } catch {
        // Cross-origin stylesheet (e.g. Google Fonts) is re-linked below
      }
    }
    return chunks.join('\n');
  };

  const buildPrintableHtmlDocument = (sheetEl: HTMLElement) => {
    const safeCode = state.sessionCode.replace(/[^A-Z0-9_-]/gi, '');
    const compiledCss = collectDocumentCss();
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AMONG-US IRL Printable QR Sheets - ${safeCode}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
${compiledCss}
      html, body {
        background: #ffffff !important;
        color: #0f172a !important;
        margin: 0;
        padding: 0;
      }
      .export-toolbar {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #0f172a;
        color: #f8fafc;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
      }
      .export-toolbar button {
        background: #10b981;
        color: #052e16;
        border: none;
        border-radius: 8px;
        padding: 9px 16px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .export-container {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px;
      }
      .print-only-sheet h3 {
        color: #0f172a !important;
      }
      .print-card {
        break-inside: avoid;
        page-break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @media print {
        .export-toolbar { display: none !important; }
        .export-container { max-width: none; padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="export-toolbar no-print">
      <div>
        <strong style="font-family: var(--font-display); font-size: 20px; letter-spacing: 0.04em;">AMONG-US IRL — PRINTABLE QR SHEETS</strong>
        <span style="margin-left: 12px; font-size: 12px; color: #94a3b8;">Session ${safeCode}</span>
      </div>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="export-container">
      ${sheetEl.outerHTML}
    </div>
    <script>
      window.addEventListener('load', function () {
        if (window.self === window.top) {
          setTimeout(function () { window.print(); }, 350);
        }
      });
    </script>
  </body>
</html>`;
  };

  const downloadPrintableSheet = (reason: 'FALLBACK' | 'MANUAL') => {
    const sheetEl = printSheetRef.current;
    if (!sheetEl) {
      setErrorMsg('Switch to Print QR Studio first so the cards are rendered.');
      return;
    }
    const html = buildPrintableHtmlDocument(sheetEl);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `among-us-irl-qr-sheets-${state.sessionCode}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (reason === 'FALLBACK') {
      setPrintNotice(
        `Browser print is blocked inside embedded preview windows. Downloaded among-us-irl-qr-sheets-${state.sessionCode}.html — open it in your browser to print or save as PDF.`,
      );
    } else {
      setPrintNotice(
        `Saved among-us-irl-qr-sheets-${state.sessionCode}.html — open the downloaded file in any browser to print or save as PDF.`,
      );
    }
  };

  const handlePrintSheets = () => {
    setErrorMsg(null);
    setPrintNotice(null);

    let beforePrintFired = false;
    const onBeforePrint = () => {
      beforePrintFired = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    try {
      window.print();
    } catch {
      window.removeEventListener('beforeprint', onBeforePrint);
      downloadPrintableSheet('FALLBACK');
      return;
    }

    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!beforePrintFired) {
        downloadPrintableSheet('FALLBACK');
      }
    }, 350);
  };

  return (
    <div className="print-root relative min-h-screen bg-[#040712] text-slate-100 flex flex-col">
      {activeTab !== 'PRINT' && (
        <MotionConfig reducedMotion="user">
          <GalacticBackdrop />
        </MotionConfig>
      )}

      {/* Top Bar Contract: 3 zones */}
      <header className="no-print sticky top-0 z-30 bg-[#070B16]/78 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={onExitHost}
            className="font-display text-2xl font-bold tracking-wide text-white whitespace-nowrap hover:text-cyan-300 transition-colors"
          >
            AMONG-US IRL
          </button>
        </div>

        <nav className="order-3 sm:order-2 w-full sm:w-auto flex items-center gap-5 text-sm font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('CONTROL')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'CONTROL'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Mission Control
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRINT')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'PRINT'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Print QR Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RULES')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              activeTab === 'RULES'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Rules & Balance
          </button>
        </nav>

        <div className="order-2 sm:order-3 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="min-w-[40px] min-h-[40px] rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {state.phase === 'LOBBY' ? (
            <motion.button
              type="button"
              disabled={busy}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => callHostApi('start')}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-colors"
            >
              Launch Mission
            </motion.button>
          ) : (
            <motion.button
              type="button"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => callHostApi('reset')}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Lobby</span>
            </motion.button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="no-print relative z-20 mx-auto mt-4 max-w-4xl w-full px-6">
          <div className="bg-red-500/15 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: MISSION CONTROL */}
      {activeTab === 'CONTROL' && (
        <MotionConfig reducedMotion="user">
          <div className="relative flex-1">
            <main className="no-print relative z-10 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Join QR & Port Forwarding Host Address */}
              <section className="lg:col-span-4 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#101726]/82 backdrop-blur-md border border-white/12 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-2xl font-bold text-white">Join Mission QR</h2>
                      <p className="text-xs text-slate-400">
                        Scan with any smartphone browser
                      </p>
                    </div>
                    <motion.span
                      key={state.sessionCode}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-2xl font-bold tracking-widest text-cyan-300 tabular-nums"
                    >
                      {state.sessionCode}
                    </motion.span>
                  </div>

                  {/* Animated QR Boarding Reticle */}
                  <div className="flex justify-center py-2">
                    <div className="relative p-3 rounded-2xl bg-slate-950/60 border border-cyan-500/20 overflow-hidden">
                      {/* Animated corner brackets */}
                      <motion.span
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl"
                      />
                      <motion.span
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.6, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr"
                      />
                      <motion.span
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.6, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl"
                      />
                      <motion.span
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.6, delay: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br"
                      />
                      {/* Subtle non-obscuring scan sweep */}
                      <motion.div
                        aria-hidden="true"
                        animate={{ y: [-110, 110, -110], opacity: [0.05, 0.35, 0.05] }}
                        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                      />
                      <QrCodeImg value={joinUrl} size={220} alt={`Join session ${state.sessionCode}`} />
                    </div>
                  </div>

                  <div className="text-center font-mono text-xs text-slate-300 break-all bg-slate-950/70 px-3 py-2 rounded-lg border border-white/5">
                    {joinUrl}
                  </div>

                  {/* Port Forwarding / LAN Address Switcher */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Host Address (LAN or Port-Forwarded URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                        placeholder="http://192.168.1.50:3000"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => savePublicUrl(urlInput)}
                        className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors"
                      >
                        {urlSaved ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{urlSaved ? 'Saved' : 'Update QR'}</span>
                      </motion.button>
                    </div>
                    {state.lanUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {state.lanUrls.map((lan) => (
                          <motion.button
                            key={lan}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              setUrlInput(lan);
                              savePublicUrl(lan);
                            }}
                            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-cyan-300 transition-colors"
                          >
                            Use {lan}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/10">
                    <span>Storage Engine</span>
                    <span className="font-mono text-slate-200">
                      {state.dbMode === 'mongodb' ? 'MongoDB Connected' : 'Local Persistent Store'}
                    </span>
                  </div>
                </motion.div>
              </section>

              {/* Right Column: Live Telemetry, Meeting Alert, Ship Manifest */}
              <section className="lg:col-span-8 space-y-6">
                {/* Global Task Progress & Phase Telemetry */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#101726]/82 backdrop-blur-md border border-white/12 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <AnimatePresence mode="wait">
                        <motion.h2
                          key={state.phase}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className="font-display text-2xl font-bold text-white"
                        >
                          {state.phase === 'LOBBY' && 'Pre-Launch Ship Manifest'}
                          {state.phase === 'PLAYING' && 'Mission Active — Crew Telemetry'}
                          {state.phase === 'MEETING' && 'Emergency Meeting In Progress'}
                          {state.phase === 'ENDED' &&
                            (state.winner === 'CREWMATES' ? 'Victory — Crewmates Win' : 'Defeat — Impostors Win')}
                        </motion.h2>
                      </AnimatePresence>
                      <p className="text-xs text-slate-400 mt-1 tabular-nums">
                        {state.players.length} Players Joined · {aliveCount} Alive · {deadCount} Eliminated ·{' '}
                        {state.settings.impostorCount === 2
                          ? '2 Impostors (1 Shapeshifter)'
                          : '1 Impostor'}{' '}
                        · {state.settings.investigatorCount} Investigator
                        {state.settings.investigatorCount === 1 ? '' : 's'}
                      </p>
                    </div>

                    {state.phase !== 'LOBBY' && (
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Total Tasks</div>
                        <motion.div
                          key={state.taskProgress.percentage}
                          initial={{ scale: 0.92, opacity: 0.7 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                          className="font-mono text-2xl font-bold text-emerald-400 tabular-nums"
                        >
                          {state.taskProgress.percentage}%
                        </motion.div>
                      </div>
                    )}
                  </div>

                  {/* Task Progress Bar with subtle energy shimmer */}
                  <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                    <motion.div
                      className="relative h-full bg-emerald-500 overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: `${state.taskProgress.percentage}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    >
                      {state.taskProgress.percentage > 0 && state.taskProgress.percentage < 100 && (
                        <motion.div
                          aria-hidden="true"
                          animate={{ x: ['-100%', '220%'] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                        />
                      )}
                    </motion.div>
                  </div>

                  {/* Active Sabotage Banner */}
                  <AnimatePresence>
                    {state.phase === 'PLAYING' && state.activeSabotage && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 flex items-center gap-3"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.14, 1], rotate: [0, -6, 6, 0] }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          className="shrink-0"
                        >
                          {state.activeSabotage.kind === 'BLACKOUT' ? (
                            <ZapOff className="w-6 h-6 text-amber-300" />
                          ) : (
                            <Radio className="w-6 h-6 text-amber-300" />
                          )}
                        </motion.div>
                        <div>
                          <div className="font-display text-xl font-bold text-amber-200">
                            {state.activeSabotage.kind === 'BLACKOUT'
                              ? 'SABOTAGE: POWER BLACKOUT'
                              : 'SABOTAGE: COMMS SIGNAL JAM'}
                          </div>
                          <div className="text-xs text-amber-100/80 mt-0.5">
                            {state.activeSabotage.kind === 'BLACKOUT'
                              ? `All tasks are locked until an alive player scans and completes Fix Wiring${state.settings.hideManualCodes ? '' : ' (WIR1)'} — even if already completed or unassigned.`
                              : `Emergency Meeting button${state.settings.hideManualCodes ? '' : ' (EMRG)'} is disabled for 60 seconds.`}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Active Meeting Banner */}
                  <AnimatePresence>
                    {state.phase === 'MEETING' && state.meeting && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="bg-red-500/15 border border-red-500/40 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <motion.div
                              animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                              className="shrink-0"
                            >
                              <ShieldAlert className="w-7 h-7 text-red-400" />
                            </motion.div>
                            <div>
                              <div className="font-display text-xl font-bold text-white">
                                {state.meeting.reason === 'BODY_REPORTED'
                                  ? `Dead Body Reported: ${state.meeting.victimName}`
                                  : `Emergency Meeting Called by ${state.meeting.reporterName}`}
                              </div>
                              <div className="text-xs text-red-200 mt-0.5 font-mono tabular-nums">
                                {state.meeting.verdictMessage
                                  ? state.meeting.verdictMessage
                                  : state.meeting.stage === 'GATHERING'
                                    ? `Gathering at Table (HERE!): ${state.meeting.arrivedCount} / ${state.meeting.totalAliveCount} Alive`
                                    : state.meeting.stage === 'DISCUSSION'
                                      ? `Discussion · Vote Now Agreed: ${state.meeting.voteNowCount} / ${state.meeting.totalAliveCount}`
                                      : state.meeting.revealEndsAt
                                        ? `All Votes Locked (${state.meeting.votesCastCount} / ${state.meeting.totalAliveCount}) · Revealing Results...`
                                        : `Votes Cast: ${state.meeting.votesCastCount} / ${state.meeting.totalAliveCount}`}
                              </div>
                            </div>
                          </div>
                          {state.meeting.stage === 'GATHERING' && (
                            <motion.button
                              type="button"
                              disabled={busy}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => callHostApi('start-discussion')}
                              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap"
                            >
                              Start Discussion Now
                            </motion.button>
                          )}
                        </div>

                        {state.meeting.voteBreakdown && (
                          <div className="pt-3 border-t border-red-500/30 space-y-2">
                            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-200/90">
                              Vote Breakdown
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {state.players
                                .filter((p) => (state.meeting?.voteBreakdown?.byTarget[p.playerId]?.length || 0) > 0)
                                .map((target) => {
                                  const voters = state.meeting?.voteBreakdown?.byTarget[target.playerId] || [];
                                  return (
                                    <motion.div
                                      key={target.playerId}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CrewmateAvatar color={target.color} alive={target.alive} size={24} />
                                        <span className="text-xs font-semibold text-white truncate">
                                          {target.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap justify-end">
                                        {voters.map((v) => (
                                          <span
                                            key={v.playerId}
                                            title={v.name}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-200"
                                          >
                                            <CrewmateAvatar color={v.color} size={16} />
                                            <span>{v.name}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                            </div>
                            {state.meeting.voteBreakdown.skipped.length > 0 && (
                              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10">
                                <span className="text-xs font-semibold text-slate-300">Skipped Vote</span>
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  {state.meeting.voteBreakdown.skipped.map((v) => (
                                    <span
                                      key={v.playerId}
                                      title={v.name}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-200"
                                    >
                                      <CrewmateAvatar color={v.color} size={16} />
                                      <span>{v.name}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* End Game Banner */}
                  {state.phase === 'ENDED' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-xl p-4 border ${
                        state.winner === 'CREWMATES'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                          : 'bg-red-500/15 border-red-500/40 text-red-200'
                      }`}
                    >
                      <div className="font-display text-2xl font-bold">
                        {state.winner === 'CREWMATES' ? 'CREWMATES VICTORY' : 'IMPOSTORS VICTORY'}
                      </div>
                      <p className="text-sm mt-1">{state.winReason}</p>
                    </motion.div>
                  )}
                </motion.div>

                {/* Player Roster Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#101726]/82 backdrop-blur-md border border-white/12 rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      <span className="tabular-nums">Crew Manifest ({state.players.length}/12)</span>
                    </h3>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setActiveTab('PRINT')}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-cyan-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print QR Badges & Tasks</span>
                    </motion.button>
                  </div>

                  {state.players.length === 0 ? (
                    <div className="py-10 px-4 text-center border border-dashed border-white/10 rounded-xl relative overflow-hidden">
                      {/* Animated Skeld radar & waiting crewmates */}
                      <div className="relative mx-auto w-28 h-16 flex items-center justify-center mb-3">
                        <motion.span
                          aria-hidden="true"
                          animate={{ scale: [0.7, 1.45], opacity: [0.5, 0] }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute w-14 h-14 rounded-full border border-cyan-400/50"
                        />
                        <motion.span
                          aria-hidden="true"
                          animate={{ scale: [0.7, 1.45], opacity: [0.4, 0] }}
                          transition={{ duration: 2.6, delay: 1.3, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute w-14 h-14 rounded-full border border-cyan-400/40"
                        />
                        <div className="relative flex items-center -space-x-2">
                          <CrewmateAvatar color="cyan" animate size={38} />
                          <CrewmateAvatar color="red" animate size={42} />
                          <CrewmateAvatar color="lime" animate size={36} />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-200">Waiting for crewmates to board</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Have players scan the Join Mission QR code with their smartphone camera.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <AnimatePresence>
                        {state.players.map((p, idx) => {
                          const colorDef = getColorDef(p.color);
                          const canShowRejoinQr = Boolean(p.rejoinCode);
                          return (
                            <motion.div
                              key={p.playerId}
                              layout
                              initial={{ opacity: 0, scale: 0.94, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              whileHover={{ y: -2 }}
                              transition={{ delay: idx * 0.03, duration: 0.2 }}
                              role={canShowRejoinQr ? 'button' : undefined}
                              tabIndex={canShowRejoinQr ? 0 : undefined}
                              aria-label={canShowRejoinQr ? `Show rejoin QR code for ${p.name}` : undefined}
                              onClick={() => {
                                if (p.rejoinCode) setSelectedRejoinPlayerId(p.playerId);
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && p.rejoinCode) {
                                  e.preventDefault();
                                  setSelectedRejoinPlayerId(p.playerId);
                                }
                              }}
                              className={`group p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                                canShowRejoinQr ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70' : ''
                              } ${
                                p.alive
                                  ? 'bg-slate-950/60 border-white/10 hover:border-cyan-400/50 hover:bg-slate-900/75'
                                  : 'bg-red-950/20 border-red-500/25 hover:border-red-400/50 opacity-85'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <CrewmateAvatar color={p.color} alive={p.alive} animate={p.alive} size={40} />
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-white truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                    <span>{colorDef.label}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className={p.alive ? 'text-emerald-400' : 'text-red-400'}>
                                      {p.alive ? 'Alive' : 'Killed'}
                                    </span>
                                  </div>
                                  {p.rejoinCode && (
                                    <div className="text-[11px] font-mono text-cyan-300/90 mt-0.5 tabular-nums">
                                      Rejoin: {p.rejoinCode}
                                    </div>
                                  )}
                                  {p.revealedRole && (
                                    <div className="text-[11px] font-mono font-bold text-amber-300 mt-0.5">
                                      {p.revealedRole}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {canShowRejoinQr && (
                                  <span
                                    aria-hidden="true"
                                    title="Click to open Rejoin QR Code"
                                    className="p-1.5 rounded-lg text-cyan-400/70 group-hover:text-cyan-300 group-hover:bg-cyan-500/10 transition-colors"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </span>
                                )}
                                {state.phase === 'LOBBY' && (
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      callHostApi('kick', { playerId: p.playerId });
                                    }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Remove ${p.name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>

                {/* Android Companion App (.apk) Download QR & Local Hosting */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#101726]/82 backdrop-blur-md border border-white/12 rounded-2xl p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-cyan-400 shrink-0" />
                        <h2 className="font-display text-2xl font-bold text-white">
                          Android Companion App
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Scan to download the camera-enabled .apk directly from this Host PC
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono font-semibold tabular-nums ${
                          apkStatus?.available ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {apkStatus?.available
                          ? `${(apkStatus.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                          : 'Not Hosted'}
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => fetchApkStatus()}
                        disabled={apkLoading}
                        title="Refresh public-apk folder status"
                        aria-label="Refresh hosted APK status"
                        className="min-w-[34px] min-h-[34px] rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${apkLoading ? 'animate-spin' : ''}`} />
                      </motion.button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[176px_1fr] gap-5 items-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative p-2.5 rounded-xl bg-slate-950/60 border border-cyan-500/20 overflow-hidden">
                        <motion.span
                          animate={{ opacity: [0.4, 0.95, 0.4] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400 rounded-tl"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 0.95, 0.4] }}
                          transition={{ duration: 2.8, delay: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400 rounded-br"
                        />
                        <QrCodeImg
                          value={apkDownloadUrl}
                          size={152}
                          alt="Download AMONG-US IRL Android APK"
                        />
                      </div>
                      <span className="mt-2 text-[11px] text-slate-400 text-center">
                        Scan to install APK
                      </span>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="font-mono text-[11px] text-slate-300 break-all bg-slate-950/70 px-3 py-2 rounded-lg border border-white/5">
                        {apkDownloadUrl}
                      </div>

                      {apkStatus?.available ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5 border-y border-white/10">
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-mono text-emerald-300 truncate">
                              {apkStatus.originalFileName || apkStatus.fileName}
                            </div>
                            {apkStatus.sha256 && (
                              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                                SHA-256 · {apkStatus.sha256.slice(0, 16)}...
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <motion.a
                              href={apkStatus.downloadPath}
                              download="among-us-irl.apk"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              className="min-h-[38px] px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download APK</span>
                            </motion.a>
                            <motion.button
                              type="button"
                              disabled={apkLoading}
                              whileTap={{ scale: 0.96 }}
                              onClick={removeHostedApk}
                              className="min-h-[38px] px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          No APK hosted yet. Drag and drop your built <code className="text-cyan-300">.apk</code> below or place it in the local <code className="text-cyan-300">public-apk/</code> folder.
                        </p>
                      )}

                      {/* Drag-and-Drop / Click APK Upload Dropzone */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setApkDragOver(true);
                        }}
                        onDragLeave={() => setApkDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setApkDragOver(false);
                          const dropped = e.dataTransfer.files?.[0];
                          if (dropped) uploadApkFile(dropped);
                        }}
                        onClick={() => {
                          if (!apkUploading) apkInputRef.current?.click();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !apkUploading) {
                            e.preventDefault();
                            apkInputRef.current?.click();
                          }
                        }}
                        className={`rounded-xl border border-dashed p-3.5 text-center cursor-pointer transition-colors ${
                          apkDragOver
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-white/20 bg-slate-950/60 hover:border-cyan-400/60 hover:bg-slate-900/70'
                        }`}
                      >
                        <input
                          ref={apkInputRef}
                          type="file"
                          accept=".apk,application/vnd.android.package-archive"
                          className="hidden"
                          onChange={(e) => {
                            const selected = e.target.files?.[0];
                            if (selected) uploadApkFile(selected);
                            e.target.value = '';
                          }}
                        />
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                          <motion.div
                            animate={
                              apkDragOver || apkUploading
                                ? { y: [0, -4, 0], scale: 1.08 }
                                : { y: 0, scale: 1 }
                            }
                            transition={
                              apkDragOver || apkUploading
                                ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
                                : { duration: 0.2 }
                            }
                            className="shrink-0"
                          >
                            <Upload className="w-4 h-4 text-cyan-400" />
                          </motion.div>
                          <div className="text-center sm:text-left">
                            <div className="text-xs font-semibold text-white">
                              {apkUploading
                                ? `Uploading APK... ${apkUploadPct}%`
                                : apkStatus?.available
                                  ? 'Drop new .apk here to replace'
                                  : 'Drop .apk here or click to upload'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Served immediately at /download/among-us-irl.apk (max 125 MB)
                            </div>
                          </div>
                        </div>
                        {apkUploading && (
                          <div className="mt-3 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-cyan-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${apkUploadPct}%` }}
                              transition={{ ease: 'easeOut', duration: 0.2 }}
                            />
                          </div>
                        )}
                      </div>

                      {apkError && (
                        <div className="bg-red-500/15 border border-red-500/40 text-red-200 px-3 py-2 rounded-lg text-xs">
                          {apkError}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </section>
            </main>
          </div>

          {/* Crew Member Rejoin QR Modal */}
          <AnimatePresence>
            {selectedRejoinPlayer && rejoinQrUrl && (
              <motion.div
                key="rejoin-qr-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setSelectedRejoinPlayerId(null)}
                className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  key={selectedRejoinPlayer.playerId}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="rejoin-qr-modal-title"
                  initial={{ opacity: 0, scale: 0.94, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#151C28] border border-white/15 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl"
                >
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CrewmateAvatar
                        color={selectedRejoinPlayer.color}
                        alive={selectedRejoinPlayer.alive}
                        animate={selectedRejoinPlayer.alive}
                        size={42}
                      />
                      <div className="min-w-0">
                        <h3
                          id="rejoin-qr-modal-title"
                          className="font-display text-xl font-bold text-white truncate"
                        >
                          {selectedRejoinPlayer.name}
                        </h3>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>{getColorDef(selectedRejoinPlayer.color).label}</span>
                          <span aria-hidden="true">·</span>
                          <span className={selectedRejoinPlayer.alive ? 'text-emerald-400' : 'text-red-400'}>
                            {selectedRejoinPlayer.alive ? 'Alive' : 'Killed'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSelectedRejoinPlayerId(null)}
                      aria-label="Close rejoin QR modal"
                      className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="relative mx-auto w-fit p-3.5 rounded-2xl bg-slate-950/75 border border-cyan-500/25 overflow-hidden">
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl"
                      />
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.4, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr"
                      />
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.4, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl"
                      />
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{ duration: 2.4, delay: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br"
                      />
                      <motion.div
                        aria-hidden="true"
                        animate={{ y: [-100, 100, -100] }}
                        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
                      />
                      <QrCodeImg
                        value={rejoinQrUrl}
                        size={220}
                        alt={`Rejoin QR code for ${selectedRejoinPlayer.name}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Mission Code
                        </div>
                        <div className="font-mono font-bold text-lg text-white tabular-nums tracking-wider mt-0.5">
                          {state.sessionCode}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-950/70 border border-cyan-500/25 px-3 py-2 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">
                          Rejoin Code
                        </div>
                        <div className="font-mono font-bold text-lg text-cyan-300 tabular-nums tracking-wider mt-0.5">
                          {selectedRejoinPlayer.rejoinCode}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-mono text-[11px] text-slate-300 break-all bg-slate-950/70 px-3 py-2 rounded-lg border border-white/5">
                        {rejoinQrUrl}
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCopyRejoinUrl}
                        className="w-full min-h-[40px] px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
                      >
                        {rejoinUrlCopied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-300">Copied Rejoin Link</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-cyan-400" />
                            <span>Copy Rejoin Link</span>
                          </>
                        )}
                      </motion.button>
                    </div>

                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                      Scan with the Android app or phone camera to auto-rejoin this player immediately.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      )}

      {/* TAB 2: PRINT QR STUDIO */}
      {activeTab === 'PRINT' && (
        <main className="max-w-7xl w-full mx-auto p-6 space-y-6 print:p-0 print:max-w-none">
          <div className="no-print bg-[#151C28] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Printable QR Studio</h2>
              <p className="text-xs text-slate-400">
                Print player back badges (for kills, Investigator scans, and body reports) and all 16 Skeld task cards.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['ALL', 'All Cards'],
                  ['PLAYERS_ALL', '12 Suit Back Badges'],
                  ['PLAYERS_JOINED', 'Joined Players Only'],
                  ['TASKS', '16 Skeld Tasks'],
                  ['MEETING', 'Emergency Button'],
                ] as Array<[PrintFilter, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrintFilter(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    printFilter === id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => downloadPrintableSheet('MANUAL')}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-100 font-semibold text-xs flex items-center gap-2 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Save Printable HTML</span>
              </button>
              <button
                type="button"
                onClick={handlePrintSheets}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sheets</span>
              </button>
            </div>
          </div>

          {printNotice && (
            <div className="no-print bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-4">
              <span>{printNotice}</span>
              <button
                type="button"
                onClick={() => setPrintNotice(null)}
                className="text-xs font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <div ref={printSheetRef} className="print-only-sheet space-y-8 print:space-y-0">
            {/* Player Back QR Badges — 3-col on screen, 2 per page on print */}
            {showBadgesSection && (
              <section className="space-y-4 print:space-y-2">
                <h3 className="font-display text-xl print:text-base font-bold text-white print:text-slate-900">
                  Player Back Badges — Wear on Back ({playersToPrint.length})
                </h3>
                <div className="print-block-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:space-y-0">
                  {crewBadgePages.map((pageColors, pageIdx) => (
                    <div
                      key={`crew-page-${pageIdx}`}
                      className="contents print-page-crew print-page-break"
                    >
                      {pageColors.map((color) => {
                        const joinedPlayer = state.players.find((p) => p.color === color.id);
                        return (
                          <PrintedPlayerBadgeCard
                            key={color.id}
                            sessionCode={state.sessionCode}
                            color={color}
                            joinedPlayerName={joinedPlayer?.name}
                            hideManualCodes={Boolean(state.settings.hideManualCodes)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 16 Skeld Task Cards — 4-col on screen, 4 per page (2x2) on print */}
            {showTasksSection && (
              <section
                className={`space-y-4 print:space-y-2 ${
                  showBadgesSection ? 'print:break-before-page' : ''
                }`}
              >
                <h3 className="font-display text-xl print:text-base font-bold text-white print:text-slate-900">
                  The Skeld Task Station Cards (16 Tasks)
                </h3>
                <div className="print-block-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:space-y-0">
                  {taskCardPages.map((pageTasks, pageIdx) => (
                    <div
                      key={`task-page-${pageIdx}`}
                      className="contents print-page-quad print-page-break"
                    >
                      {pageTasks.map((task) => (
                        <PrintedTaskQrCard
                          key={task.id}
                          sessionCode={state.sessionCode}
                          task={task}
                          hideManualCodes={Boolean(state.settings.hideManualCodes)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Emergency Meeting Cafeteria Button — max-w-sm on screen, crewmate-badge size on print */}
            {showMeetingSection && (
              <section
                className={`space-y-4 print:space-y-2 ${
                  showBadgesSection || showTasksSection ? 'print:break-before-page' : ''
                }`}
              >
                <h3 className="font-display text-xl print:text-base font-bold text-white print:text-slate-900">
                  Cafeteria Emergency Meeting Station
                </h3>
                <PrintedEmergencyQrCard
                  sessionCode={state.sessionCode}
                  hideManualCodes={Boolean(state.settings.hideManualCodes)}
                />
              </section>
            )}
          </div>
        </main>
      )}

      {/* TAB 3: RULES & BALANCE */}
      {activeTab === 'RULES' && (
        <main className="no-print relative z-10 max-w-3xl w-full mx-auto p-6">
          <div className="bg-[#101726]/84 backdrop-blur-md border border-white/12 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <span>Mission Rules & Role Balance</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {state.phase === 'LOBBY'
                    ? 'Adjust rules before launching the mission.'
                    : 'Settings are locked while a mission is active. Reset lobby to modify.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Impostor Count */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-sm font-semibold text-white">Impostors</div>
                <p className="text-xs text-slate-400">
                  With 2 Impostors, one is automatically designated as the Shapeshifter (reads as Crewmate on Investigator scans).
                </p>
                <div className="flex gap-2 pt-1">
                  {([1, 2] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={state.phase !== 'LOBBY'}
                      onClick={() => updateSettings({ impostorCount: cnt })}
                      className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-bold ${
                        state.settings.impostorCount === cnt
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-800 text-slate-300'
                      } disabled:opacity-60`}
                    >
                      {cnt} {cnt === 2 ? '(+Shapeshifter)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investigator Count */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-sm font-semibold text-white">Investigators</div>
                <p className="text-xs text-slate-400">
                  Can scan alive players’ back QRs to inspect their suit color and role alignment.
                </p>
                <div className="flex gap-2 pt-1">
                  {[0, 1, 2].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={state.phase !== 'LOBBY'}
                      onClick={() => updateSettings({ investigatorCount: cnt })}
                      className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-bold ${
                        state.settings.investigatorCount === cnt
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      } disabled:opacity-60`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasks Per Player */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Tasks Per Player"
                  value={state.settings.tasksPerPlayer}
                  min={2}
                  max={10}
                  step={1}
                  accent="emerald"
                  disabled={state.phase !== 'LOBBY'}
                  onChangeCommit={(val) => updateSettings({ tasksPerPlayer: val })}
                />
              </div>

              {/* Kill Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Kill Cooldown"
                  value={state.settings.killCooldownSec}
                  min={10}
                  max={60}
                  step={1}
                  accent="red"
                  disabled={state.phase !== 'LOBBY'}
                  formatValue={(v) => `${v}s`}
                  onChangeCommit={(val) => updateSettings({ killCooldownSec: val })}
                />
              </div>

              {/* Investigator Scan Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Investigator Scan Cooldown"
                  value={state.settings.scanCooldownSec}
                  min={10}
                  max={60}
                  step={1}
                  accent="cyan"
                  disabled={state.phase !== 'LOBBY'}
                  formatValue={(v) => `${v}s`}
                  onChangeCommit={(val) => updateSettings({ scanCooldownSec: val })}
                />
              </div>

              {/* Sabotage Cooldown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Sabotage Cooldown"
                  value={state.settings.sabotageCooldownSec ?? 30}
                  min={10}
                  max={90}
                  step={1}
                  accent="orange"
                  disabled={state.phase !== 'LOBBY'}
                  formatValue={(v) => `${v}s`}
                  onChangeCommit={(val) => updateSettings({ sabotageCooldownSec: val })}
                />
              </div>

              {/* Discussion Time */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Discussion Time"
                  value={state.settings.discussionSec}
                  min={0}
                  max={120}
                  step={1}
                  accent="amber"
                  disabled={state.phase !== 'LOBBY'}
                  formatValue={(v) => (v === 0 ? '0s (Skip)' : `${v}s`)}
                  onChangeCommit={(val) => updateSettings({ discussionSec: val })}
                />
              </div>

              {/* Voting Time */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <SmoothSlider
                  label="Voting Time"
                  value={state.settings.votingSec}
                  min={20}
                  max={120}
                  step={1}
                  accent="amber"
                  disabled={state.phase !== 'LOBBY'}
                  formatValue={(v) => `${v}s`}
                  onChangeCommit={(val) => updateSettings({ votingSec: val })}
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-white/10 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-white">Confirm Ejects</div>
                <div className="text-xs text-slate-400">
                  Reveal whether the voted-out player was an Impostor after meetings.
                </div>
              </div>
              <input
                type="checkbox"
                disabled={state.phase !== 'LOBBY'}
                checked={state.settings.confirmEjects}
                onChange={(e) => updateSettings({ confirmEjects: e.target.checked })}
                className="w-5 h-5 accent-cyan-400"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-white/10 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-white">
                  Hide Manual Codes (Anti-Remote Kill)
                </div>
                <div className="text-xs text-slate-400">
                  Removes manual short codes from printed sheets and disables typing codes in the scanner so Impostors must scan physical QR badges up close.
                </div>
              </div>
              <input
                type="checkbox"
                disabled={state.phase !== 'LOBBY'}
                checked={Boolean(state.settings.hideManualCodes)}
                onChange={(e) => updateSettings({ hideManualCodes: e.target.checked })}
                className="w-5 h-5 accent-cyan-400 shrink-0 ml-4"
              />
            </label>
          </div>
        </main>
      )}
    </div>
  );
};
