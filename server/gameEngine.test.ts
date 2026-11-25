import test from 'node:test';
import assert from 'node:assert/strict';
import { getSession, initDatabase, saveSession } from './db.ts';
import {
  advanceSessionTimers,
  cancelArmedReactorMeltdown,
  castGuardianShield,
  createGameSession,
  joinGameSession,
  projectForPlayer,
  scanReactorOverrideQr,
  startMission,
  triggerArmedReactorMeltdown,
  updateReactorHold,
  updateSessionSettings,
} from './gameEngine.ts';
import type { PlayerColorId } from '../src/shared/skeldData.ts';

async function setupFourPlayerMatch(opts?: { guardianAngelCount?: number }) {
  await initDatabase();
  const { session, hostToken } = await createGameSession('http://localhost:3000');
  await updateSessionSettings(session.sessionCode, hostToken, {
    impostorCount: 1,
    investigatorCount: 0,
    sheriffCount: 0,
    guardianAngelCount: opts?.guardianAngelCount ?? 1,
    jesterCount: 0,
    sabotageCooldownSec: 10,
  });

  const colors: PlayerColorId[] = ['red', 'blue', 'green', 'yellow'];
  const tokens: string[] = [];
  for (let i = 0; i < 4; i++) {
    const joined = await joinGameSession(session.sessionCode, `P${i + 1}`, colors[i]);
    tokens.push(joined.player.playerToken);
  }
  const started = await startMission(session.sessionCode, hostToken);
  return { sessionCode: started.sessionCode, hostToken, tokens };
}

test('Guardian Angel can shield even an Impostor and while dead without Ghost Energy', async () => {
  const { sessionCode, tokens } = await setupFourPlayerMatch({ guardianAngelCount: 1 });
  const states = [];
  for (const t of tokens) {
    const sess = await getSession(sessionCode);
    states.push({ token: t, client: projectForPlayer(sess!, t)! });
  }

  const guardian = states.find((s) => s.client.self.secretRole === 'GUARDIAN_ANGEL')!;
  const impostor = states.find((s) => s.client.self.secretRole === 'IMPOSTOR')!;
  assert.ok(guardian && impostor);

  // Confirm ghostEnergy is removed from projected player state
  assert.equal('ghostEnergy' in guardian.client.self, false);

  // Mark Guardian Angel dead and confirm shield still works without ghost energy
  const sess = (await getSession(sessionCode))!;
  const gStored = sess.players.find((p) => p.playerToken === guardian.token)!;
  gStored.alive = false;
  gStored.lastShieldAt = 0;
  await saveSession(sess);

  await castGuardianShield(sessionCode, guardian.token, impostor.client.self.playerId);

  const afterSess = (await getSession(sessionCode))!;
  const impClient = projectForPlayer(afterSess, impostor.token)!;
  assert.ok(impClient.self.shieldedUntil > Date.now(), 'Impostor should see active shield duration');

  // Shield expires cleanly via advanceSessionTimers when past shieldedUntil
  const impStored = afterSess.players.find((p) => p.playerToken === impostor.token)!;
  impStored.shieldedUntil = Date.now() - 10;
  await saveSession(afterSess);
  await advanceSessionTimers(sessionCode);
  const expiredSess = (await getSession(sessionCode))!;
  const expiredImp = projectForPlayer(expiredSess, impostor.token)!;
  assert.equal(expiredImp.self.shieldedUntil, 0);
});

test('Impostor scanning Reactor QR arms remote trigger without immediate detonation and supports cancel/trigger', async () => {
  const { sessionCode, tokens } = await setupFourPlayerMatch({ guardianAngelCount: 0 });
  const sess = (await getSession(sessionCode))!;
  const impostor = sess.players.find((p) => p.secretRole === 'IMPOSTOR')!;
  assert.ok(impostor);

  // 1. Scan arms Reactor Meltdown but does NOT trigger activeSabotage immediately
  const scan1 = await scanReactorOverrideQr(sessionCode, impostor.playerToken);
  assert.equal(scan1.kind, 'MELTDOWN_ARMED');
  assert.equal(scan1.triggered, false);
  assert.equal(scan1.session.activeSabotage, null);
  assert.equal(projectForPlayer(scan1.session, impostor.playerToken)!.self.reactorArmed, true);

  // 2. Cancel disarms without triggering
  const cancelled = await cancelArmedReactorMeltdown(sessionCode, impostor.playerToken);
  assert.equal(cancelled.activeSabotage, null);
  assert.equal(projectForPlayer(cancelled, impostor.playerToken)!.self.reactorArmed, false);

  // 3. Re-arm and trigger remotely from anywhere else
  const scan2 = await scanReactorOverrideQr(sessionCode, impostor.playerToken);
  assert.equal(scan2.kind, 'MELTDOWN_ARMED');

  const triggered = await triggerArmedReactorMeltdown(sessionCode, impostor.playerToken);
  assert.equal(triggered.activeSabotage?.kind, 'REACTOR');
  assert.equal(projectForPlayer(triggered, impostor.playerToken)!.self.reactorArmed, false);
});

test('Reactor meltdown counts down all the way to 0s before ending match', async () => {
  const { sessionCode } = await setupFourPlayerMatch({ guardianAngelCount: 0 });
  let sess = (await getSession(sessionCode))!;
  const impostor = sess.players.find((p) => p.secretRole === 'IMPOSTOR')!;
  const crew = sess.players.filter((p) => p.secretRole !== 'IMPOSTOR');

  await scanReactorOverrideQr(sessionCode, impostor.playerToken);
  await triggerArmedReactorMeltdown(sessionCode, impostor.playerToken);

  // Set expiresAt to 200ms ago (client displays 0s) — must NOT end game yet!
  sess = (await getSession(sessionCode))!;
  sess.activeSabotage!.expiresAt = Date.now() - 200;
  await saveSession(sess);

  const midCheck = await advanceSessionTimers(sessionCode);
  let afterMid = (await getSession(sessionCode))!;
  assert.equal(afterMid.phase, 'PLAYING');
  assert.equal(midCheck.event, undefined);

  // Even at 0s, two crewmates completing 5s dual hold stabilize it instead of losing early
  sess = (await getSession(sessionCode))!;
  sess.activeSabotage!.expiresAt = Date.now() - 400;
  sess.activeSabotage!.reactorHolders = [
    { playerId: crew[0].playerId, name: crew[0].name, color: crew[0].color, startedAt: Date.now() - 5100, lastPingAt: Date.now() },
    { playerId: crew[1].playerId, name: crew[1].name, color: crew[1].color, startedAt: Date.now() - 5100, lastPingAt: Date.now() },
  ];
  sess.activeSabotage!.dualHoldStartedAt = Date.now() - 5100;
  await saveSession(sess);

  const clutchSave = await updateReactorHold(sessionCode, crew[0].playerToken, true);
  assert.equal(clutchSave.stabilized, true);
  assert.equal(clutchSave.session.phase, 'PLAYING');

  // Now trigger again and let it pass 0s grace (> expiresAt + 1000) -> Impostors win
  sess = (await getSession(sessionCode))!;
  sess.lastSabotageAt = 0;
  await saveSession(sess);
  await scanReactorOverrideQr(sessionCode, impostor.playerToken);
  await triggerArmedReactorMeltdown(sessionCode, impostor.playerToken);

  sess = (await getSession(sessionCode))!;
  sess.activeSabotage!.expiresAt = Date.now() - 1200;
  await saveSession(sess);

  const endCheck = await advanceSessionTimers(sessionCode);
  const endedSess = (await getSession(sessionCode))!;
  assert.equal(endedSess.phase, 'ENDED');
  assert.equal(endedSess.winner, 'IMPOSTORS');
  assert.equal(endCheck.event?.type, 'game:ended');
});
