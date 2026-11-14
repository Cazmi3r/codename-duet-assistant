// Key card generation for Codenames Duet style two-sided key cards.
// Pure logic with no DOM access, so it runs in the browser and in Node tests.
//
// A card is fully determined by (settings, seed). Share codes embed FORMAT, so
// if generation ever changes, bump FORMAT and keep the old path for old codes.

export const FORMAT = 1;
export const MIN_SIZE = 3;
export const MAX_SIZE = 8;

export const AGENT = 'agent';
export const ASSASSIN = 'assassin';
export const BYSTANDER = 'bystander';

// The published game: 5x5, 9 agents and 3 assassins per side.
export const STANDARD = Object.freeze({
  rows: 5,
  cols: 5,
  agents: 9, // green squares on each side
  assassins: 3, // black squares on each side
  shared: 3, // green on both sides
  assassinAgents: 1, // black on one side, green on the other (per side)
  assassinBoth: 1, // black on both sides
});

const FIELDS = ['rows', 'cols', 'agents', 'assassins', 'shared', 'assassinAgents', 'assassinBoth'];

// Recommended counts for a grid size, scaled from the standard ratios.
export function defaultsFor(rows, cols) {
  const cells = rows * cols;
  const agents = Math.max(1, Math.round((cells * 9) / 25));
  const assassins = Math.max(1, Math.round((cells * 3) / 25));
  const third = Math.max(1, Math.round(assassins / 3));
  const assassinAgents = assassins >= 2 ? third : 0;
  const assassinBoth = assassins >= 2 ? Math.min(third, assassins - assassinAgents) : 0;
  return {
    rows,
    cols,
    agents,
    assassins,
    shared: Math.min(Math.round(agents / 3), agents - assassinAgents),
    assassinAgents,
    assassinBoth,
  };
}

// How many squares have each (host side, partner side) combination.
export function breakdown(s) {
  const agentBystander = s.agents - s.shared - s.assassinAgents;
  const assassinBystander = s.assassins - s.assassinAgents - s.assassinBoth;
  const used =
    s.shared + 2 * s.assassinAgents + 2 * agentBystander + s.assassinBoth + 2 * assassinBystander;
  return {
    cells: s.rows * s.cols,
    agentAgent: s.shared,
    agentAssassin: s.assassinAgents, // and the same number the other way round
    agentBystander, // and the same number the other way round
    assassinAssassin: s.assassinBoth,
    assassinBystander, // and the same number the other way round
    bystanderBystander: s.rows * s.cols - used,
    totalAgents: 2 * s.agents - s.shared,
    bystandersPerSide: s.rows * s.cols - s.agents - s.assassins,
  };
}

// Returns null when the settings describe a buildable card, else a reason.
export function validate(s) {
  for (const f of FIELDS) {
    if (!Number.isInteger(s[f]) || s[f] < 0) return `${f} must be a whole number`;
  }
  for (const f of ['rows', 'cols']) {
    if (s[f] < MIN_SIZE || s[f] > MAX_SIZE) return `${f} must be ${MIN_SIZE}-${MAX_SIZE}`;
  }
  if (s.agents < 1) return 'Each side needs at least 1 agent';
  const b = breakdown(s);
  if (b.agentBystander < 0) return 'Too many overlapping agents for the agents per side';
  if (b.assassinBystander < 0) return 'Too many overlapping assassins for the assassins per side';
  if (b.bystanderBystander < 0) return 'Not enough squares in the grid for these settings';
  return null;
}

// Pull dependent counts down so they fit inside their parents.
export function clampDependents(s) {
  const out = { ...s };
  out.assassinAgents = Math.min(out.assassinAgents, out.assassins, out.agents);
  out.shared = Math.min(out.shared, out.agents - out.assassinAgents);
  out.assassinBoth = Math.min(out.assassinBoth, out.assassins - out.assassinAgents);
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Builds both sides. Index i is the same physical square on both sides, in
// the host's reading order (row by row from the host's top-left).
export function generate(settings, seed) {
  const problem = validate(settings);
  if (problem) throw new Error(problem);
  const b = breakdown(settings);
  const pairs = [];
  const add = (n, host, partner) => {
    for (let i = 0; i < n; i++) pairs.push([host, partner]);
  };
  add(b.agentAgent, AGENT, AGENT);
  add(b.agentAssassin, AGENT, ASSASSIN);
  add(b.agentAssassin, ASSASSIN, AGENT);
  add(b.agentBystander, AGENT, BYSTANDER);
  add(b.agentBystander, BYSTANDER, AGENT);
  add(b.assassinAssassin, ASSASSIN, ASSASSIN);
  add(b.assassinBystander, ASSASSIN, BYSTANDER);
  add(b.assassinBystander, BYSTANDER, ASSASSIN);
  add(b.bystanderBystander, BYSTANDER, BYSTANDER);

  const random = mulberry32(seed);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return { host: pairs.map((p) => p[0]), partner: pairs.map((p) => p[1]) };
}

// The squares one player should see, in their own reading order. The joining
// player sits opposite the host, so their view is rotated 180 degrees.
export function viewFor(settings, seed, role) {
  const card = generate(settings, seed);
  return role === 'join' ? card.partner.slice().reverse() : card.host;
}

export function randomSeed() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

export function encode(settings, seed) {
  return [FORMAT, ...FIELDS.map((f) => settings[f]), (seed >>> 0).toString(36)].join('.');
}

// Returns { settings, seed } or null if the code is not a valid share code.
export function decode(code) {
  if (typeof code !== 'string') return null;
  const parts = code.trim().toLowerCase().split('.');
  if (parts.length !== FIELDS.length + 2) return null;
  if (parts[0] !== String(FORMAT)) return null;
  const settings = {};
  for (let i = 0; i < FIELDS.length; i++) {
    const raw = parts[i + 1];
    if (!/^\d{1,3}$/.test(raw)) return null;
    settings[FIELDS[i]] = Number(raw);
  }
  const rawSeed = parts[parts.length - 1];
  if (!/^[0-9a-z]{1,7}$/.test(rawSeed)) return null;
  const seed = parseInt(rawSeed, 36);
  if (seed > 0xffffffff) return null;
  if (validate(settings)) return null;
  return { settings, seed };
}
