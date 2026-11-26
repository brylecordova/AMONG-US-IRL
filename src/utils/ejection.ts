import type {
  GamePhase,
  MeetingStage,
  PlayerColorId,
  SecretRole,
} from '../shared/skeldData';

export interface VerdictEjectionCheckInput {
  phase: GamePhase;
  meeting: {
    id: string;
    stage: MeetingStage;
    ejectedPlayer?: {
      playerId: string;
      name: string;
      revealedRole?: SecretRole;
    } | null;
  } | null;
  dismissedMeetingId: string | null;
}

export function shouldShowVerdictEjection({
  phase,
  meeting,
  dismissedMeetingId,
}: VerdictEjectionCheckInput): boolean {
  if (phase !== 'MEETING' || !meeting) return false;
  if (meeting.stage !== 'VERDICT') return false;
  if (!meeting.ejectedPlayer) return false;
  return dismissedMeetingId !== meeting.id;
}

export function formatEjectionSubtitle(opts: {
  isSelf: boolean;
  confirmEjects: boolean;
  revealedRole?: SecretRole;
  sessionCode: string;
}): string {
  if (opts.confirmEjects && opts.revealedRole) {
    if (opts.revealedRole === 'JESTER') {
      return `Jester Confirmed · Vessel ${opts.sessionCode}`;
    }
    if (opts.revealedRole === 'IMPOSTOR' || opts.revealedRole === 'SHAPESHIFTER') {
      return `Impostor Confirmed · Vessel ${opts.sessionCode}`;
    }
    return `Not An Impostor · Vessel ${opts.sessionCode}`;
  }
  return `Airlock Sealed · Vessel ${opts.sessionCode}`;
}

export function shouldConsumeAndroidLeave(triggerCount?: number | null): boolean {
  return typeof triggerCount === 'number' && triggerCount > 0;
}

export interface PresenceRosterPlayer {
  playerId: string;
  name: string;
  color: PlayerColorId;
}

export function findDepartedPlayers<T extends PresenceRosterPlayer>(
  prevPlayers: readonly T[] | null | undefined,
  nextPlayers: readonly T[],
  selfPlayerId: string,
): PresenceRosterPlayer[] {
  if (!prevPlayers || prevPlayers.length === 0) return [];
  const nextIds = new Set(nextPlayers.map((p) => p.playerId));
  return prevPlayers
    .filter((p) => p.playerId !== selfPlayerId && !nextIds.has(p.playerId))
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      color: p.color,
    }));
}

