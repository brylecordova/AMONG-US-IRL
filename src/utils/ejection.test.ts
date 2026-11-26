import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEjectionSubtitle, shouldShowVerdictEjection } from './ejection.ts';

test('shouldShowVerdictEjection triggers only when meeting is in VERDICT with an ejectedPlayer and not dismissed', () => {
  assert.equal(
    shouldShowVerdictEjection({
      phase: 'PLAYING',
      meeting: null,
      dismissedMeetingId: null,
    }),
    false,
  );

  assert.equal(
    shouldShowVerdictEjection({
      phase: 'MEETING',
      meeting: { id: 'm1', stage: 'VOTING', ejectedPlayer: null },
      dismissedMeetingId: null,
    }),
    false,
  );

  assert.equal(
    shouldShowVerdictEjection({
      phase: 'MEETING',
      meeting: { id: 'm1', stage: 'VERDICT', ejectedPlayer: null },
      dismissedMeetingId: null,
    }),
    false,
  );

  assert.equal(
    shouldShowVerdictEjection({
      phase: 'MEETING',
      meeting: {
        id: 'm1',
        stage: 'VERDICT',
        ejectedPlayer: { playerId: 'p1', name: 'Alice', revealedRole: 'IMPOSTOR' },
      },
      dismissedMeetingId: null,
    }),
    true,
  );

  assert.equal(
    shouldShowVerdictEjection({
      phase: 'MEETING',
      meeting: {
        id: 'm1',
        stage: 'VERDICT',
        ejectedPlayer: { playerId: 'p1', name: 'Alice', revealedRole: 'IMPOSTOR' },
      },
      dismissedMeetingId: 'm1',
    }),
    false,
  );

  assert.equal(
    shouldShowVerdictEjection({
      phase: 'MEETING',
      meeting: {
        id: 'm2',
        stage: 'VERDICT',
        ejectedPlayer: { playerId: 'p2', name: 'Bob' },
      },
      dismissedMeetingId: 'm1',
    }),
    true,
  );
});

test('formatEjectionSubtitle reflects confirmEjects and role metadata', () => {
  assert.equal(
    formatEjectionSubtitle({
      isSelf: false,
      confirmEjects: true,
      revealedRole: 'IMPOSTOR',
      sessionCode: 'SKLD01',
    }),
    'Impostor Confirmed · Vessel SKLD01',
  );

  assert.equal(
    formatEjectionSubtitle({
      isSelf: false,
      confirmEjects: true,
      revealedRole: 'JESTER',
      sessionCode: 'SKLD01',
    }),
    'Jester Confirmed · Vessel SKLD01',
  );

  assert.equal(
    formatEjectionSubtitle({
      isSelf: true,
      confirmEjects: true,
      revealedRole: 'CREWMATE',
      sessionCode: 'SKLD01',
    }),
    'Not An Impostor · Vessel SKLD01',
  );

  assert.equal(
    formatEjectionSubtitle({
      isSelf: false,
      confirmEjects: false,
      sessionCode: 'SKLD01',
    }),
    'Airlock Sealed · Vessel SKLD01',
  );
});
