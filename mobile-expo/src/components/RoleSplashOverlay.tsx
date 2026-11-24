import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getColorDef, PlayerColorId, SecretRole } from '../skeldShared';
import { AnimatedCrewmate } from './AnimatedCrewmate';

interface RoleSplashOverlayProps {
  visible: boolean;
  role: SecretRole;
  selfColor: PlayerColorId;
  selfName: string;
  impostorCount: number;
  investigatorCount: number;
  teammates: Array<{ playerId: string; name: string; color: PlayerColorId; role: SecretRole }>;
  onDismiss: () => void;
}

export const RoleSplashOverlay: React.FC<RoleSplashOverlayProps> = ({
  visible,
  role,
  selfColor,
  selfName,
  impostorCount,
  investigatorCount,
  teammates,
  onDismiss,
}) => {
  const [stage, setStage] = useState<'SHH' | 'ROLE'>('SHH');
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) return;
    setStage('SHH');
    scaleAnim.setValue(0.78);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      setStage('ROLE');
      scaleAnim.setValue(0.84);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1500);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.9,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [visible, glowAnim, opacityAnim, scaleAnim]);

  if (!visible) return null;

  const isImpostorTeam = role === 'IMPOSTOR' || role === 'SHAPESHIFTER';
  const isShapeshifter = role === 'SHAPESHIFTER';
  const isInvestigator = role === 'INVESTIGATOR';

  const accent = isImpostorTeam ? '#FF3B30' : isInvestigator ? '#F59E0B' : '#38BDF8';

  const title = isShapeshifter
    ? 'SHAPESHIFTER'
    : isImpostorTeam
      ? 'IMPOSTOR'
      : isInvestigator
        ? 'INVESTIGATOR'
        : 'CREWMATE';

  const subtitle = isShapeshifter
    ? 'Eliminate the crew. Investigator scans read you as CREWMATE.'
    : isImpostorTeam
      ? `Sabotage systems and eliminate Crewmates (${impostorCount} Impostor${impostorCount > 1 ? 's' : ''} aboard).`
      : isInvestigator
        ? 'Scan player back badges to check CREWMATE vs IMPOSTOR alignment.'
        : `Complete all tasks on The Skeld.${impostorCount === 1 ? ' There is 1 Impostor' : ` There are ${impostorCount} Impostors`} among us.${investigatorCount > 0 ? ` (${investigatorCount} Investigator active.)` : ''}`;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        {stage === 'SHH' ? (
          <Animated.View
            style={[
              styles.centerBox,
              { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <AnimatedCrewmate color={selfColor} size={104} animate />
            <Text style={styles.shhTitle}>SHHHHH!</Text>
            <Text style={styles.shhSub}>Shield your screen from nearby crew...</Text>
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.centerBox,
              { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Animated.View
              style={[
                styles.glowHalo,
                { backgroundColor: accent, opacity: glowAnim },
              ]}
            />
            <Text style={styles.kicker}>ROLE BRIEFING</Text>
            <Text style={[styles.roleTitle, { color: accent }]}>{title}</Text>
            <Text style={styles.roleSubtitle}>{subtitle}</Text>

            <View style={styles.lineupRow}>
              <View style={styles.avatarCard}>
                <AnimatedCrewmate color={selfColor} size={86} animate />
                <Text style={styles.avatarName}>{selfName}</Text>
                <Text style={[styles.avatarRole, { color: accent }]}>
                  {getColorDef(selfColor).label}
                </Text>
              </View>

              {isImpostorTeam &&
                teammates.map((mate) => (
                  <View key={mate.playerId} style={styles.avatarCard}>
                    <AnimatedCrewmate color={mate.color} size={76} animate />
                    <Text style={styles.avatarName}>{mate.name}</Text>
                    <Text style={[styles.avatarRole, { color: '#FF3B30' }]}>
                      {mate.role === 'SHAPESHIFTER' ? 'Shapeshifter' : 'Partner'}
                    </Text>
                  </View>
                ))}
            </View>

            <Text style={styles.stealthNote}>
              Stealth HUD active: once dismissed, your main screen mirrors a standard Crewmate. Open Terminal to view your role or trigger sabotages.
            </Text>

            <TouchableOpacity
              style={[styles.enterBtn, { backgroundColor: accent }]}
              activeOpacity={0.85}
              onPress={onDismiss}
            >
              <Text style={styles.enterBtnText}>ENTER SHIP (HIDE ROLE)</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#050810',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerBox: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  glowHalo: {
    position: 'absolute',
    top: -40,
    width: 260,
    height: 140,
    borderRadius: 130,
    opacity: 0.25,
  },
  shhTitle: {
    marginTop: 22,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#F8FAFC',
  },
  shhSub: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#94A3B8',
    textAlign: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#94A3B8',
  },
  roleTitle: {
    marginTop: 8,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  roleSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  lineupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 24,
    marginTop: 28,
    marginBottom: 24,
  },
  avatarCard: {
    alignItems: 'center',
  },
  avatarName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  avatarRole: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stealthNote: {
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  enterBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#060A12',
  },
});
