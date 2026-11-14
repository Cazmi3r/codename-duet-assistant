import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT,
  ASSASSIN,
  BYSTANDER,
  MAX_SIZE,
  MIN_SIZE,
  STANDARD,
  breakdown,
  clampDependents,
  decode,
  defaultsFor,
  encode,
  generate,
  randomSeed,
  validate,
  viewFor,
} from '../public/keycard.js';

const count = (arr, type) => arr.filter((x) => x === type).length;
const pairCount = (card, host, partner) =>
  card.host.filter((x, i) => x === host && card.partner[i] === partner).length;

function assertMatchesSettings(s, seed) {
  const card = generate(s, seed);
  const b = breakdown(s);
  assert.equal(card.host.length, s.rows * s.cols);
  assert.equal(card.partner.length, s.rows * s.cols);
  for (const side of [card.host, card.partner]) {
    assert.equal(count(side, AGENT), s.agents);
    assert.equal(count(side, ASSASSIN), s.assassins);
    assert.equal(count(side, BYSTANDER), b.bystandersPerSide);
  }
  assert.equal(pairCount(card, AGENT, AGENT), s.shared);
  assert.equal(pairCount(card, AGENT, ASSASSIN), s.assassinAgents);
  assert.equal(pairCount(card, ASSASSIN, AGENT), s.assassinAgents);
  assert.equal(pairCount(card, ASSASSIN, ASSASSIN), s.assassinBoth);
  assert.equal(pairCount(card, BYSTANDER, BYSTANDER), b.bystanderBystander);
  const agentsToFind = card.host.filter((x, i) => x === AGENT || card.partner[i] === AGENT).length;
  assert.equal(agentsToFind, b.totalAgents);
}

test('standard card matches the published rules', () => {
  assert.equal(validate(STANDARD), null);
  const b = breakdown(STANDARD);
  assert.deepEqual(
    [b.agentAgent, b.agentAssassin, b.agentBystander, b.assassinAssassin, b.assassinBystander, b.bystanderBystander],
    [3, 1, 5, 1, 1, 7],
  );
  assert.equal(b.totalAgents, 15);
  assert.equal(b.bystandersPerSide, 13);
  for (let seed = 0; seed < 200; seed++) assertMatchesSettings(STANDARD, seed);
});

test('recommended settings are valid for every grid size', () => {
  assert.deepEqual(defaultsFor(5, 5), { ...STANDARD });
  for (let rows = MIN_SIZE; rows <= MAX_SIZE; rows++) {
    for (let cols = MIN_SIZE; cols <= MAX_SIZE; cols++) {
      const s = defaultsFor(rows, cols);
      assert.equal(validate(s), null, `${rows}x${cols}`);
      assertMatchesSettings(s, rows * 100 + cols);
    }
  }
});

test('custom settings produce matching cards', () => {
  const custom = [
    { rows: 3, cols: 3, agents: 4, assassins: 0, shared: 0, assassinAgents: 0, assassinBoth: 0 },
    { rows: 4, cols: 6, agents: 10, assassins: 4, shared: 2, assassinAgents: 2, assassinBoth: 2 },
    { rows: 8, cols: 8, agents: 30, assassins: 2, shared: 0, assassinAgents: 2, assassinBoth: 0 },
    { rows: 3, cols: 3, agents: 9, assassins: 0, shared: 9, assassinAgents: 0, assassinBoth: 0 },
  ];
  for (const s of custom) {
    assert.equal(validate(s), null);
    for (let seed = 1; seed <= 20; seed++) assertMatchesSettings(s, seed);
  }
});

test('impossible settings are rejected', () => {
  assert.ok(validate({ ...STANDARD, shared: 9 })); // shared + assassinAgents > agents
  assert.ok(validate({ ...STANDARD, assassinBoth: 3 })); // overlaps exceed assassins
  assert.ok(validate({ ...STANDARD, agents: 20, shared: 0 })); // does not fit in 25 squares
  assert.ok(validate({ ...STANDARD, rows: 2 }));
  assert.ok(validate({ ...STANDARD, cols: 9 }));
  assert.ok(validate({ ...STANDARD, agents: 0, shared: 0, assassinAgents: 0 }));
  assert.ok(validate({ ...STANDARD, agents: 2.5 }));
  assert.throws(() => generate({ ...STANDARD, shared: 9 }, 1));
});

test('clampDependents pulls overlaps inside their parents', () => {
  const s = clampDependents({ ...STANDARD, agents: 2, assassins: 1 });
  assert.equal(validate(s), null);
  assert.ok(s.shared + s.assassinAgents <= s.agents);
  assert.ok(s.assassinAgents + s.assassinBoth <= s.assassins);
});

test('generation is deterministic and seeds give different cards', () => {
  assert.deepEqual(generate(STANDARD, 12345), generate(STANDARD, 12345));
  const distinct = new Set();
  for (let seed = 0; seed < 100; seed++) distinct.add(generate(STANDARD, seed).host.join());
  assert.ok(distinct.size > 95);
});

test('the joining player sees the partner side rotated 180 degrees', () => {
  const s = defaultsFor(4, 6);
  const card = generate(s, 777);
  assert.deepEqual(viewFor(s, 777, 'host'), card.host);
  const joined = viewFor(s, 777, 'join');
  const last = s.rows * s.cols - 1;
  joined.forEach((type, i) => assert.equal(type, card.partner[last - i]));
});

test('share codes round-trip', () => {
  for (const seed of [0, 1, 36, 0x7fffffff, 0xffffffff]) {
    for (const s of [STANDARD, defaultsFor(3, 8), defaultsFor(8, 8)]) {
      const decoded = decode(encode(s, seed));
      assert.deepEqual(decoded, { settings: { ...s }, seed });
    }
  }
  const seed = randomSeed();
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  assert.equal(decode(encode(STANDARD, seed)).seed, seed);
});

test('bad share codes are rejected', () => {
  const good = encode(STANDARD, 42);
  assert.equal(decode(''), null);
  assert.equal(decode(null), null);
  assert.equal(decode('hello'), null);
  assert.equal(decode(good.replace(/^1\./, '2.')), null); // unknown format
  assert.equal(decode(good + '.1'), null); // too many parts
  assert.equal(decode('1.5.5.9.3.9.1.1.a'), null); // impossible settings
  assert.equal(decode('1.5.5.9.3.3.1.1.zzzzzzz'), null); // seed out of range
  assert.equal(decode('1.5.5.-9.3.3.1.1.a'), null);
  assert.equal(decode('1.5.5.9.3.3.1.1.A!'), null);
});
