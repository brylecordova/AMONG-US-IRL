import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getColorDef, PublicPlayer } from '../skeldShared';
import { AnimatedCrewmate } from './AnimatedCrewmate';
import { haptics } from '../haptics';

interface SecurityMonitorModalProps {
  visible: boolean;
  players: PublicPlayer[];
  selfPlayerId: string;
  jammed: boolean;
  selectedTargetId: string | null;
  latestFrame: { targetPlayerId: string; imageBase64: string; ts: number } | null;
  targetBusy: boolean;
  targetOffline: boolean;
  targetLostReason: string | null;
  onSelectTarget: (targetPlayerId: string) => void;
  onClose: () => void;
}

export const SecurityMonitorModal: React.FC<SecurityMonitorModalProps> = ({
  visible,
  players,
  selfPlayerId,
  jammed,
  selectedTargetId,
  latestFrame,
  targetBusy,
  targetOffline,
  targetLostReason,
  onSelectTarget,
  onClose,
}) => {
  const otherPlayers = players.filter((p) => p.playerId !== selfPlayerId);
  const selectedPlayer = selectedTargetId
    ? otherPlayers.find((p) => p.playerId === selectedTargetId) ?? null
    : null;

  const hasValidFrame =
    !jammed &&
    Boolean(selectedPlayer?.alive) &&
    !targetBusy &&
    !targetOffline &&
    targetLostReason !== 'DECEASED' &&
    Boolean(latestFrame && latestFrame.targetPlayerId === selectedTargetId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeRoot} edges={['top', 'bottom', 'left', 'right']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.kicker}>SKELD CCTV SYSTEM</Text>
              <Text style={styles.title} numberOfLines={1}>
                SECURITY MONITOR
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {jammed
                  ? 'COMMS SIGNAL JAMMED'
                  : selectedPlayer
                    ? `FEED: ${selectedPlayer.name.toUpperCase()} • 5 FPS`
                    : 'SELECT A CREWMATE CAMERA'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                haptics.impact('light');
                onClose();
              }}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody}>
            {/* 4:3 Live CCTV Viewport */}
            <View style={styles.viewport}>
              {hasValidFrame && latestFrame ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${latestFrame.imageBase64}` }}
                  style={styles.feedImage}
                  resizeMode="cover"
                />
              ) : jammed ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: '#FCA5A5' }]}>SIGNAL JAMMED</Text>
                  <Text style={styles.stateSub}>
                    Comms Signal Jam active — all Security camera feeds are offline until interference clears.
                  </Text>
                </View>
              ) : !selectedPlayer ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: '#67E8F9' }]}>CCTV STANDBY</Text>
                  <Text style={styles.stateSub}>
                    Tap any alive crewmate below to link into their camera at 5 FPS. They will see a live alert that Security is watching.
                  </Text>
                </View>
              ) : !selectedPlayer.alive || targetLostReason === 'DECEASED' ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: '#FCA5A5' }]}>
                    SIGNAL LOST — DECEASED
                  </Text>
                  <Text style={styles.stateSub}>
                    {selectedPlayer.name} has been eliminated. Camera feed terminated.
                  </Text>
                </View>
              ) : targetBusy ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: '#FDE68A' }]}>
                    SCANNING QR TERMINAL
                  </Text>
                  <Text style={styles.stateSub}>
                    {selectedPlayer.name} is using their camera to scan a QR code. Feed resumes automatically when finished.
                  </Text>
                </View>
              ) : targetOffline ? (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: '#CBD5E1' }]}>
                    SIGNAL INTERRUPTED
                  </Text>
                  <Text style={styles.stateSub}>
                    {selectedPlayer.name}&apos;s client is offline or backgrounded. Waiting for signal...
                  </Text>
                </View>
              ) : (
                <View style={styles.stateBox}>
                  <ActivityIndicator color="#38BDF8" size="large" />
                  <Text style={[styles.stateTitle, { color: '#67E8F9', marginTop: 10 }]}>
                    LINKING TO {selectedPlayer.name.toUpperCase()}...
                  </Text>
                  <Text style={styles.stateSub}>
                    Awaiting 5 FPS camera frames from player device.
                  </Text>
                </View>
              )}

              {/* Corner Framing Brackets */}
              <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerTR]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerBL]} />
              <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />

              {/* Live REC Badge */}
              {hasValidFrame && selectedPlayer ? (
                <View pointerEvents="none" style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>
                    REC • 5 FPS • {selectedPlayer.name.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Crew Camera Channel List */}
            <View style={styles.channelHeaderRow}>
              <Text style={styles.channelHeading}>
                CREW CAMERA CHANNELS ({otherPlayers.filter((p) => p.alive).length} ONLINE)
              </Text>
              <Text style={styles.channelHint}>1 feed at a time</Text>
            </View>

            {otherPlayers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.stateSub}>No other players in this session.</Text>
              </View>
            ) : (
              <View style={styles.channelList}>
                {otherPlayers.map((p) => {
                  const colorDef = getColorDef(p.color);
                  const isSelected = p.playerId === selectedTargetId;
                  const disabled = jammed || !p.alive;

                  return (
                    <TouchableOpacity
                      key={p.playerId}
                      disabled={disabled}
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.selection();
                        onSelectTarget(p.playerId);
                      }}
                      style={[
                        styles.channelRow,
                        !p.alive
                          ? styles.channelRowDead
                          : jammed
                            ? styles.channelRowJammed
                            : isSelected
                              ? styles.channelRowSelected
                              : null,
                      ]}
                    >
                      <View style={styles.channelPlayerInfo}>
                        <AnimatedCrewmate color={p.color} alive={p.alive} size={32} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.channelPlayerName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.channelPlayerColor}>{colorDef.label}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          !p.alive
                            ? styles.statusChipDead
                            : isSelected
                              ? styles.statusChipLive
                              : styles.statusChipIdle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            !p.alive
                              ? { color: '#FCA5A5' }
                              : isSelected
                                ? { color: '#060A12' }
                                : { color: '#CBD5E1' },
                          ]}
                        >
                          {!p.alive ? 'DECEASED' : isSelected ? 'LIVE' : 'VIEW'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: '#090E18',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#070B13',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: '#38BDF8',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollBody: {
    padding: 16,
    gap: 14,
  },
  viewport: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: '#04070D',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedImage: {
    width: '100%',
    height: '100%',
  },
  stateBox: {
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stateSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(56, 189, 248, 0.75)',
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  recBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  channelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelHeading: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#CBD5E1',
  },
  channelHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#0D1421',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
  },
  channelList: {
    gap: 8,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F1623',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  channelRowSelected: {
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderColor: '#22D3EE',
  },
  channelRowDead: {
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    opacity: 0.45,
  },
  channelRowJammed: {
    opacity: 0.45,
  },
  channelPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  channelPlayerName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  channelPlayerColor: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusChipLive: {
    backgroundColor: '#22D3EE',
  },
  statusChipDead: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  statusChipIdle: {
    backgroundColor: '#1E293B',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
