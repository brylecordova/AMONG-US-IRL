import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { buildWsUrl, ClientGameState, getColorDef } from './src/skeldShared';
import { JoinScreen } from './src/screens/JoinScreen';
import { GameHudScreen } from './src/screens/GameHudScreen';

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://192.168.1.42:3000');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  const [killedAlertTrigger, setKilledAlertTrigger] = useState(0);
  const [meetingAlertTrigger, setMeetingAlertTrigger] = useState(0);
  const [sabotageAlertTrigger, setSabotageAlertTrigger] = useState(0);
  const [missionStartedTrigger, setMissionStartedTrigger] = useState(0);

  // Security Camera live CCTV state
  const [securityWatcherCount, setSecurityWatcherCount] = useState(0);
  const [securityLatestFrame, setSecurityLatestFrame] = useState<{
    targetPlayerId: string;
    imageBase64: string;
    ts: number;
  } | null>(null);
  const [securityTargetStatus, setSecurityTargetStatus] = useState<{
    targetPlayerId: string;
    busy: boolean;
    offline: boolean;
    lostReason: string | null;
  } | null>(null);
  const [securityJammed, setSecurityJammed] = useState(false);
  const [securityForceClosedSeq, setSecurityForceClosedSeq] = useState(0);
  const [securityErrorEvent, setSecurityErrorEvent] = useState<{
    seq: number;
    message: string;
  } | null>(null);
  const [playerScannerOpen, setPlayerScannerOpen] = useState(false);

  const [nativeCamPerm, requestNativeCamPerm] = useCameraPermissions();
  const [nativePictureSize, setNativePictureSize] = useState<string | undefined>(undefined);
  const nativeCamRef = useRef<CameraView | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const sendWsMessage = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const handleLeave = useCallback(() => {
    try {
      const storage = (globalThis as { localStorage?: { removeItem?: (key: string) => void } })
        .localStorage;
      storage?.removeItem?.('skeld_irl_saved_player_session');
    } catch {
      // Ignore storage access errors in native/private runtimes
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSecurityWatcherCount(0);
    setSecurityLatestFrame(null);
    setSecurityTargetStatus(null);
    setSecurityJammed(false);
    setPlayerScannerOpen(false);
    setSessionCode(null);
    setPlayerToken(null);
    setGameState(null);
  }, []);

  useEffect(() => {
    if (!sessionCode || !playerToken || !serverUrl) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(buildWsUrl(serverUrl));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            sessionCode,
            role: 'PLAYER',
            token: playerToken,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown };
          const payloadRec =
            msg.payload && typeof msg.payload === 'object'
              ? (msg.payload as Record<string, unknown>)
              : null;

          if (msg.type === 'state:player' && msg.payload) {
            setGameState(msg.payload as ClientGameState);
          } else if (msg.type === 'player:killed') {
            setKilledAlertTrigger((n) => n + 1);
          } else if (msg.type === 'meeting:alert') {
            setMeetingAlertTrigger((n) => n + 1);
          } else if (msg.type === 'sabotage:alert') {
            setSabotageAlertTrigger((n) => n + 1);
          } else if (msg.type === 'mission:started') {
            setMissionStartedTrigger((n) => n + 1);
          } else if (msg.type === 'security:capture') {
            const active = Boolean(payloadRec?.active);
            const count =
              typeof payloadRec?.watcherCount === 'number' ? payloadRec.watcherCount : 0;
            setSecurityWatcherCount(active ? Math.max(1, count) : 0);
          } else if (msg.type === 'security:frame') {
            if (
              typeof payloadRec?.targetPlayerId === 'string' &&
              typeof payloadRec?.imageBase64 === 'string'
            ) {
              const targetPlayerId = payloadRec.targetPlayerId;
              setSecurityLatestFrame({
                targetPlayerId,
                imageBase64: payloadRec.imageBase64,
                ts: typeof payloadRec.ts === 'number' ? payloadRec.ts : Date.now(),
              });
              setSecurityTargetStatus((prev) =>
                prev && prev.targetPlayerId === targetPlayerId
                  ? { ...prev, busy: false, offline: false, lostReason: null }
                  : prev,
              );
            }
          } else if (msg.type === 'security:target_busy') {
            if (typeof payloadRec?.targetPlayerId === 'string') {
              const targetPlayerId = payloadRec.targetPlayerId;
              const busy = Boolean(payloadRec.busy);
              setSecurityTargetStatus((prev) => ({
                targetPlayerId,
                busy,
                offline: prev?.targetPlayerId === targetPlayerId ? prev.offline : false,
                lostReason: prev?.targetPlayerId === targetPlayerId ? prev.lostReason : null,
              }));
            }
          } else if (msg.type === 'security:target_offline') {
            if (typeof payloadRec?.targetPlayerId === 'string') {
              const targetPlayerId = payloadRec.targetPlayerId;
              setSecurityTargetStatus((prev) => ({
                targetPlayerId,
                busy: prev?.targetPlayerId === targetPlayerId ? prev.busy : false,
                offline: true,
                lostReason: prev?.targetPlayerId === targetPlayerId ? prev.lostReason : null,
              }));
            }
          } else if (msg.type === 'security:target_lost') {
            if (typeof payloadRec?.targetPlayerId === 'string') {
              const targetPlayerId = payloadRec.targetPlayerId;
              setSecurityTargetStatus({
                targetPlayerId,
                busy: false,
                offline: false,
                lostReason:
                  typeof payloadRec.reason === 'string' ? payloadRec.reason : 'DECEASED',
              });
            }
          } else if (msg.type === 'security:jammed') {
            setSecurityJammed(true);
            setSecurityWatcherCount(0);
          } else if (msg.type === 'security:ready') {
            setSecurityJammed(false);
          } else if (msg.type === 'security:ended') {
            setSecurityWatcherCount(0);
            setSecurityForceClosedSeq((n) => n + 1);
          } else if (msg.type === 'security:error') {
            setSecurityErrorEvent({
              seq: Date.now() + Math.random(),
              message:
                typeof payloadRec?.error === 'string'
                  ? payloadRec.error
                  : 'Security monitor error.',
            });
          } else if (msg.type === 'player:removed') {
            handleLeave();
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        setSecurityWatcherCount(0);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionCode, playerToken, serverUrl, handleLeave]);

  const isMatchAlivePlayer =
    Boolean(sessionCode && playerToken && gameState) &&
    gameState?.phase === 'PLAYING' &&
    Boolean(gameState.self?.alive);
  const isSignalJamActive =
    Boolean(gameState) &&
    gameState?.phase === 'PLAYING' &&
    gameState?.activeSabotage?.kind === 'SIGNAL_JAM';

  useEffect(() => {
    setSecurityJammed(Boolean(isSignalJamActive));
    if (!isMatchAlivePlayer || isSignalJamActive) {
      setSecurityWatcherCount(0);
    }
    if (!isMatchAlivePlayer) {
      setSecurityLatestFrame(null);
      setSecurityTargetStatus(null);
    }
  }, [isMatchAlivePlayer, isSignalJamActive]);

  const shouldCaptureSecurityCam =
    isMatchAlivePlayer && !isSignalJamActive && securityWatcherCount > 0;

  // Notify server when QR scanner temporarily occupies the device camera
  useEffect(() => {
    if (!shouldCaptureSecurityCam || !playerScannerOpen) return;
    sendWsMessage({ type: 'security:scanner_busy', busy: true });
    return () => {
      sendWsMessage({ type: 'security:scanner_busy', busy: false });
    };
  }, [shouldCaptureSecurityCam, playerScannerOpen, sendWsMessage]);

  // Web (Expo Web multi-tab) 5 FPS webcam capture + simulated fallback if camera unavailable
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!shouldCaptureSecurityCam || playerScannerOpen) return;

    const g = globalThis as {
      navigator?: {
        mediaDevices?: {
          getUserMedia?: (constraints: Record<string, unknown>) => Promise<{
            getTracks: () => Array<{ stop: () => void }>;
          }>;
        };
      };
      document?: {
        createElement: (tag: string) => any;
      };
    };

    const doc = g.document;
    if (!doc) return;

    let cancelled = false;
    let stream: { getTracks: () => Array<{ stop: () => void }> } | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startSimCanvasFallback = () => {
      if (cancelled) return;
      const canvas = doc.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const colorDef = getColorDef(gameState?.self.color || 'red');
      const playerName = gameState?.self.name || 'Player';
      let tick = 0;

      intervalId = setInterval(() => {
        if (cancelled) return;
        tick += 1;

        ctx.fillStyle = '#070D18';
        ctx.fillRect(0, 0, 320, 240);

        // Moving radar sweep line so 5 FPS updates are clearly visible
        const sweepY = (tick * 12) % 240;
        ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
        ctx.fillRect(0, sweepY, 320, 14);

        // Suit color avatar circle
        ctx.fillStyle = colorDef.hex;
        ctx.beginPath();
        ctx.arc(160, 102, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Visor
        ctx.fillStyle = '#9ADBF9';
        ctx.fillRect(142, 84, 36, 18);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(playerName.toUpperCase(), 160, 168);

        ctx.fillStyle = '#67E8F9';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`SIM TEST CAM • ${colorDef.label.toUpperCase()}`, 160, 190);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px monospace';
        ctx.fillText(new Date().toLocaleTimeString(), 160, 212);

        const dataUrl: string = canvas.toDataURL('image/jpeg', 0.55);
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx !== -1) {
          sendWsMessage({
            type: 'security:frame',
            imageBase64: dataUrl.slice(commaIdx + 1),
          });
        }
      }, 200);
    };

    const startWebCamera = async () => {
      const getUserMedia = g.navigator?.mediaDevices?.getUserMedia;
      if (!getUserMedia) {
        startSimCanvasFallback();
        return;
      }
      try {
        try {
          stream = await getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch {
          stream = await getUserMedia({ video: true, audio: false });
        }
        if (cancelled || !stream) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = doc.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});

        const canvas = doc.createElement('canvas');
        const ctx = canvas.getContext('2d');
        intervalId = setInterval(() => {
          if (cancelled || !ctx || video.readyState < 2) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return;
          const scale = Math.min(1, 320 / Math.max(vw, vh));
          canvas.width = Math.max(1, Math.round(vw * scale));
          canvas.height = Math.max(1, Math.round(vh * scale));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl: string = canvas.toDataURL('image/jpeg', 0.52);
          const commaIdx = dataUrl.indexOf(',');
          if (commaIdx !== -1) {
            sendWsMessage({
              type: 'security:frame',
              imageBase64: dataUrl.slice(commaIdx + 1),
            });
          }
        }, 200);
      } catch {
        // Fallback when webcam is unavailable or occupied by another tab
        startSimCanvasFallback();
      }
    };

    void startWebCamera();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [
    shouldCaptureSecurityCam,
    playerScannerOpen,
    sendWsMessage,
    gameState?.self.color,
    gameState?.self.name,
  ]);

  // Native Expo (iOS / Android phone) 5 FPS silent CameraView capture
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!shouldCaptureSecurityCam || playerScannerOpen) return;

    if (nativeCamPerm && !nativeCamPerm.granted && nativeCamPerm.canAskAgain) {
      requestNativeCamPerm().catch(() => {});
      return;
    }
    if (!nativeCamPerm?.granted) return;

    let cancelled = false;
    let inFlight = false;

    const timer = setInterval(() => {
      if (cancelled || inFlight || !nativeCamRef.current) return;
      inFlight = true;
      nativeCamRef.current
        .takePictureAsync({
          base64: true,
          quality: 0.18,
          shutterSound: false,
        })
        .then((photo) => {
          if (cancelled || !photo?.base64) return;
          if (photo.base64.length >= 16 && photo.base64.length <= 180_000) {
            sendWsMessage({ type: 'security:frame', imageBase64: photo.base64 });
          }
        })
        .catch(() => {
          // Drop failed capture frame cleanly
        })
        .finally(() => {
          inFlight = false;
        });
    }, 220);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    shouldCaptureSecurityCam,
    playerScannerOpen,
    nativeCamPerm,
    requestNativeCamPerm,
    sendWsMessage,
  ]);

  const handleNativeCameraReady = async () => {
    if (!nativeCamRef.current) return;
    try {
      const sizes = await nativeCamRef.current.getAvailablePictureSizesAsync();
      if (sizes && sizes.length > 0) {
        const sorted = [...sizes].sort((a, b) => {
          const [aw, ah] = a.split('x').map(Number);
          const [bw, bh] = b.split('x').map(Number);
          return (aw || 9999) * (ah || 9999) - (bw || 9999) * (bh || 9999);
        });
        const preferred =
          sorted.find((s) => {
            const [w, h] = s.split('x').map(Number);
            return Math.min(w || 0, h || 0) >= 240;
          }) || sorted[0];
        setNativePictureSize(preferred);
      }
    } catch {
      // Use default camera size if unavailable
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {sessionCode && playerToken && gameState ? (
        <>
          {Platform.OS !== 'web' &&
          shouldCaptureSecurityCam &&
          !playerScannerOpen &&
          nativeCamPerm?.granted ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01, overflow: 'hidden' }}
            >
              <CameraView
                ref={nativeCamRef}
                style={{ width: 2, height: 2 }}
                facing="back"
                animateShutter={false}
                pictureSize={nativePictureSize}
                onCameraReady={handleNativeCameraReady}
              />
            </View>
          ) : null}
          <GameHudScreen
            serverUrl={serverUrl}
            playerToken={playerToken}
            state={gameState}
            killedAlertTrigger={killedAlertTrigger}
            meetingAlertTrigger={meetingAlertTrigger}
            sabotageAlertTrigger={sabotageAlertTrigger}
            missionStartedTrigger={missionStartedTrigger}
            securityWatcherCount={securityWatcherCount}
            securityLatestFrame={securityLatestFrame}
            securityTargetStatus={securityTargetStatus}
            securityJammed={securityJammed}
            securityForceClosedSeq={securityForceClosedSeq}
            securityErrorEvent={securityErrorEvent}
            onSendWsMessage={sendWsMessage}
            onScannerOpenChange={setPlayerScannerOpen}
            onClearSecurityFeedState={() => {
              setSecurityLatestFrame(null);
              setSecurityTargetStatus(null);
            }}
            onUpdateState={setGameState}
            onLeaveSession={handleLeave}
          />
        </>
      ) : (
        <JoinScreen
          initialServerUrl={serverUrl}
          onJoined={({ serverUrl: url, sessionCode: code, playerToken: token, state }) => {
            setServerUrl(url);
            setSessionCode(code);
            setPlayerToken(token);
            setGameState(state);
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
