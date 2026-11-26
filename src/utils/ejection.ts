import type { GamePhase, MeetingStage, SecretRole } from '../shared/skeldData';

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
