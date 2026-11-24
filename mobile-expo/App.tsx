import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { buildWsUrl, ClientGameState } from './src/skeldShared';
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

  const wsRef = useRef<WebSocket | null>(null);

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
          } else if (msg.type === 'player:removed') {
            handleLeave();
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
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
  }, [sessionCode, playerToken, serverUrl]);

  const handleLeave = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSessionCode(null);
    setPlayerToken(null);
    setGameState(null);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {sessionCode && playerToken && gameState ? (
        <GameHudScreen
          serverUrl={serverUrl}
          playerToken={playerToken}
          state={gameState}
          killedAlertTrigger={killedAlertTrigger}
          meetingAlertTrigger={meetingAlertTrigger}
          sabotageAlertTrigger={sabotageAlertTrigger}
          missionStartedTrigger={missionStartedTrigger}
          onUpdateState={setGameState}
          onLeaveSession={handleLeave}
        />
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
