import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findDepartedPlayers,
  formatEjectionSubtitle,
  shouldConsumeAndroidLeave,
  shouldShowVerdictEjection,
} from './ejection.ts';

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

test('shouldConsumeAndroidLeave only triggers when triggerCount is positive', () => {
  assert.equal(shouldConsumeAndroidLeave(undefined), false);
  assert.equal(shouldConsumeAndroidLeave(null), false);
  assert.equal(shouldConsumeAndroidLeave(0), false);
  assert.equal(shouldConsumeAndroidLeave(-1), false);
  assert.equal(shouldConsumeAndroidLeave(1), true);
  assert.equal(shouldConsumeAndroidLeave(3), true);
});

test('findDepartedPlayers detects removed teammates while excluding self', () => {
  const prev = [
    { playerId: 'p1', name: 'HostKid', color: 'red' as const },
    { playerId: 'p2', name: 'CrewmateTwo', color: 'cyan' as const },
    { playerId: 'p3', name: 'CrewmateThree', color: 'lime' as const },
  ];
  const next = [
    { playerId: 'p1', name: 'HostKid', color: 'red' as const },
    { playerId: 'p3', name: 'CrewmateThree', color: 'lime' as const },
  ];

  assert.deepEqual(findDepartedPlayers(prev, next, 'p1'), [
    { playerId: 'p2', name: 'CrewmateTwo', color: 'cyan' },
  ]);

  assert.deepEqual(findDepartedPlayers(prev, next, 'p2'), []);
  assert.deepEqual(findDepartedPlayers(null, next, 'p1'), []);
  assert.deepEqual(findDepartedPlayers([], next, 'p1'), []);
});

