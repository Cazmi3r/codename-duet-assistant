import {
  MAX_SIZE,
  MIN_SIZE,
  STANDARD,
  breakdown,
  clampDependents,
  codeFromHash,
  decode,
  defaultsFor,
  encode,
  randomSeed,
  validate,
  viewFor,
} from './keycard.js';

const $ = (id) => document.getElementById(id);
const GAME_KEY = 'cda.game'; // { code, role } for the card this device is showing
const SETTINGS_KEY = 'cda.settings'; // last settings used on the setup screen

const GROUPS = [
  {
    title: 'Grid',
    fields: [
      { key: 'rows', label: 'Rows' },
      { key: 'cols', label: 'Columns' },
    ],
  },
  {
    title: 'Each side',
    fields: [
      { key: 'agents', label: 'Agents', hint: 'Green squares on each side' },
      { key: 'assassins', label: 'Assassins', hint: 'Black squares on each side' },
    ],
  },
  {
    title: 'Overlap between sides',
    fields: [
      { key: 'shared', label: 'Shared agents', hint: 'Green on both sides' },
      { key: 'assassinAgents', label: 'Assassin hiding an agent', hint: 'Black for you, green for your partner' },
      { key: 'assassinBoth', label: 'Double assassins', hint: 'Black on both sides' },
    ],
  },
];

// ---------- Storage (the app must still work when storage is unavailable) ----------

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or blocked storage: the card just won't survive a reload.
  }
}

// ---------- State ----------

let settings = loadSettings();
let game = loadGame(); // { code, role, settings, seed } or null

function loadSettings() {
  const stored = load(SETTINGS_KEY);
  return stored && validate(stored) === null ? stored : { ...STANDARD };
}

function loadGame() {
  const stored = load(GAME_KEY);
  const decoded = stored && decode(stored.code);
  if (!decoded) return null;
  return { code: stored.code, role: stored.role === 'join' ? 'join' : 'host', ...decoded };
}

function setGame(code, role) {
  const decoded = decode(code);
  if (!decoded) return false;
  game = { code, role, ...decoded };
  save(GAME_KEY, { code, role });
  return true;
}

// A join link looks like https://example.com/#j=<code>.
function readJoinLink() {
  const code = codeFromHash(location.hash);
  if (code === null) return null;
  // Drop the code from the address bar so a reload keeps showing the stored card.
  history.replaceState(null, '', location.pathname + location.search);
  return code;
}

function joinUrl() {
  return `${location.origin}${location.pathname}#j=${game.code}`;
}

// ---------- Setup screen ----------

const steppers = {};

function buildFields() {
  const root = $('fields');
  for (const group of GROUPS) {
    const box = document.createElement('div');
    box.className = 'group';
    const title = document.createElement('h2');
    title.textContent = group.title;
    box.append(title);
    for (const field of group.fields) {
      const row = document.createElement('div');
      row.className = 'field';
      const text = document.createElement('div');
      text.className = 'field-text';
      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = field.label;
      text.append(label);
      if (field.hint) {
        const hint = document.createElement('span');
        hint.className = 'field-hint';
        hint.textContent = field.hint;
        text.append(hint);
      }
      const stepper = document.createElement('div');
      stepper.className = 'stepper';
      const minus = stepButton('−', `Decrease ${field.label}`, field.key, -1);
      const value = document.createElement('output');
      const plus = stepButton('+', `Increase ${field.label}`, field.key, 1);
      stepper.append(minus, value, plus);
      steppers[field.key] = { minus, value, plus };
      row.append(text, stepper);
      box.append(row);
    }
    root.append(box);
  }
}

function stepButton(text, label, key, delta) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    const next = stepped(key, delta);
    if (next) {
      settings = next;
      save(SETTINGS_KEY, settings);
      renderSetup();
    }
  });
  return button;
}

// The settings after one tap, or null if that tap is not allowed.
function stepped(key, delta) {
  const value = settings[key] + delta;
  if (key === 'rows' || key === 'cols') {
    if (value < MIN_SIZE || value > MAX_SIZE) return null;
    // A new grid size starts from the recommended counts for that size.
    return key === 'rows' ? defaultsFor(value, settings.cols) : defaultsFor(settings.rows, value);
  }
  if (value < 0) return null;
  const next = clampDependents({ ...settings, [key]: value });
  // If clamping undid the change, another setting has to make room first.
  if (next[key] !== value) return null;
  return validate(next) === null ? next : null;
}

function renderSetup() {
  for (const [key, stepper] of Object.entries(steppers)) {
    stepper.value.textContent = settings[key];
    stepper.minus.disabled = !stepped(key, -1);
    stepper.plus.disabled = !stepped(key, 1);
  }
  const b = breakdown(settings);
  $('summary').innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = `${b.totalAgents} agents to find`;
  $('summary').append(
    strong,
    document.createElement('br'),
    `${settings.rows} × ${settings.cols} grid · ${b.bystandersPerSide} bystanders per side`,
  );
  const recommended = defaultsFor(settings.rows, settings.cols);
  $('reset').disabled = Object.keys(recommended).every((k) => recommended[k] === settings[k]);
  $('back').hidden = !game;
}

// ---------- Card screen ----------

function renderCard() {
  const { rows, cols } = game.settings;
  const cells = viewFor(game.settings, game.seed, game.role);
  const grid = $('grid');
  grid.style.setProperty('--rows', rows);
  grid.style.setProperty('--cols', cols);
  grid.setAttribute('aria-label', describe(cells, cols));
  grid.replaceChildren(
    ...cells.map((type) => {
      const cell = document.createElement('div');
      cell.className = `cell ${type}`;
      return cell;
    }),
  );
  const host = game.role === 'host';
  $('card-title').textContent = host ? 'Your key card' : "Your key card (partner's side)";
  $('card-meta').textContent = `${rows} × ${cols} · ${breakdown(game.settings).totalAgents} agents to find between you`;
  $('show-qr').hidden = !host;
  $('new').textContent = host ? 'New card' : 'Start a new game';
}

function describe(cells, cols) {
  const lines = [];
  for (let i = 0; i < cells.length; i += cols) {
    lines.push(`Row ${i / cols + 1}: ${cells.slice(i, i + cols).join(', ')}`);
  }
  return `Key card. ${lines.join('. ')}.`;
}

// ---------- QR ----------

function renderQr() {
  const qr = window.qrcode(0, 'M');
  qr.addData(joinUrl());
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const size = n + quiet * 2;
  $('qr').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for your partner">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

async function shareLink() {
  const url = joinUrl();
  const button = $('share');
  try {
    if (navigator.share) {
      // URL only: share targets such as Copy paste any title or text alongside the link.
      await navigator.share({ url });
      return;
    }
    await navigator.clipboard.writeText(url);
    button.textContent = 'Link copied';
    setTimeout(() => (button.textContent = 'Share link instead'), 2000);
  } catch (err) {
    if (err && err.name === 'AbortError') return; // the player closed the share sheet
    window.prompt('Copy this link and send it to your partner:', url);
  }
}

// ---------- Keeping the screen on while a card is showing ----------

let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Not supported or refused (for example in low power mode); nothing to do.
  }
}

// ---------- Navigation ----------

let view = null;

function show(next, notice = '') {
  view = next;
  $('setup').hidden = next !== 'setup';
  $('card').hidden = next !== 'card';
  $('notice').textContent = notice;
  $('notice').hidden = !notice;
  if (next === 'setup') renderSetup();
  else renderCard();
  keepAwake(next === 'card');
  window.scrollTo(0, 0);
}

function start() {
  const joinCode = readJoinLink();
  if (joinCode !== null) {
    if (setGame(joinCode, 'join')) return show('card');
    return show('setup', "That link isn't a valid key card. Ask your partner to show the QR code again.");
  }
  show(game ? 'card' : 'setup');
}

buildFields();

$('generate').addEventListener('click', () => {
  setGame(encode(settings, randomSeed()), 'host');
  show('card');
});
$('reset').addEventListener('click', () => {
  settings = defaultsFor(settings.rows, settings.cols);
  save(SETTINGS_KEY, settings);
  renderSetup();
});
$('back').addEventListener('click', () => show('card'));
$('new').addEventListener('click', () => show('setup'));
$('show-qr').addEventListener('click', () => {
  renderQr();
  $('qr-dialog').showModal();
});
$('close-qr').addEventListener('click', () => $('qr-dialog').close());
$('share').addEventListener('click', shareLink);

// Scanning a second QR code while the page is already open.
window.addEventListener('hashchange', start);
document.addEventListener('visibilitychange', () => {
  if (view === 'card') keepAwake(true);
});

start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
