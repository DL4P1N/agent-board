// The board page's shared state: the fixed vocabulary (statuses, columns, labels), which board this is (BASE), the
// per-board saved settings (store), who you are (token, me), the board's data (state) and the page's own view state (ui,
// oUi). Other modules change token, me, state and seenMention through the setters at the end.
//
// The page's scripts are ES modules loaded by <script type="module" src="js/boot.js">. Each module imports the one
// before it first (see the list in boot.js), so they run in the order the page's one inline script used to: this one
// first, boot.js last.

const STATUSES = ['open', 'claimed', 'in_progress', 'blocked', 'review', 'done'];
// The board's columns: Claimed (picked up, not started) sits in In progress, its card says so. The exact status stays in
// the Table view and the task dialog.
const COLS = ['open', 'in_progress', 'blocked', 'review', 'done'];
const LABEL = { proposed: 'Proposed', open: 'Open', claimed: 'Claimed', in_progress: 'In progress', blocked: 'Blocked', review: 'Review', done: 'Done' };
const HINT = { proposed: 'Proposed: waiting for the planner or you to approve', open: 'Ready for an agent to claim', claimed: 'Picked up, not started yet', in_progress: 'Being worked on', blocked: 'Stuck: needs help', review: 'Waiting to be merged', done: 'Merged / finished' };
const COL_DESC = { open: 'Ready for an agent to pick up', in_progress: 'An agent took it and is working on it (or about to start)', blocked: 'Stuck: needs a decision or help', review: 'Pushed to a branch, waiting to be merged into main', done: 'Merged into main' };
const FROZEN_DESC = 'Feature freeze: only Priority-1 tasks (bug fixes) can still be claimed';
const COL_EMPTY = { open: 'No open tasks. Add one with + New task.', in_progress: 'No tasks in progress.', blocked: 'No blocked tasks.', review: 'No tasks to merge.', done: 'No tasks merged yet.' };
const PHASES = [['needs_goal', 'Set the goal'], ['needs_plan', 'Write tasks'], ['building', 'Build'], ['all_done', 'Done']];
const ALL_PHASES = [['connect', 'Connect'], ...PHASES]; // 'connect' is client-side: shown while no laptop is connected yet
const AGENT_ONLINE_MS = 10 * 60 * 1000;
const ACTIVE = ['claimed', 'in_progress', 'blocked', 'review'];
const STALE_MS = 15 * 60 * 1000; // matches the server; its per-task `stale` flag wins when present
const HOLDING = ['claimed', 'in_progress']; // what counts against an agent's slots (blocked work doesn't)
const SIZE_TIP = { S: 'Size S: small, under 30 minutes. One-task-at-a-time agents take these first', M: 'Size M: about an hour', L: 'Size L: large. Agents on bigger plans take these first' };
const HUES = [45, 75, 110, 145, 175, 200, 222, 245, 270, 295, 320]; // person colours, evenly spaced, kept away from the red/orange used for warnings
const DONE_SHOWN = 6;
const COL_SHOWN = 12; // other columns: cards shown before "Show N more" (only when 4+ more would be hidden)
const $ = (id) => document.getElementById(id);
// One server can host several boards: /b/<slug>/ (its API under /b/<slug>/api). The default board is at the root.
const BASE = (location.pathname.match(/^\/b\/[^/]+/) || [''])[0];
const SLUG = BASE ? decodeURIComponent(BASE.slice(3)) : '';
// Each board keeps its own saved token, name and view choices; the root board keeps the original keys.
const nsKey = (k) => (BASE && k.startsWith('board-') && k !== 'board-admin-token' ? `${k}@${BASE}` : k);
const store = { get: (k) => { try { return localStorage.getItem(nsKey(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(nsKey(k), v); } catch {} } };
const qs = new URLSearchParams(location.search);
// A link's token leaves the address bar (boot.js's start()), but a reload before the name is typed would lose it: this
// tab keeps it until sign-in completes (it then lives in the saved token). A newer link's token replaces an older one.
const pending = { get: () => { try { return sessionStorage.getItem(nsKey('board-pending-token')); } catch { return null; } }, set: (v) => { try { v ? sessionStorage.setItem(nsKey('board-pending-token'), v) : sessionStorage.removeItem(nsKey('board-pending-token')); } catch {} } };
if (qs.get('token')) pending.set(qs.get('token'));
let token = qs.get('token') || pending.get() || store.get('board-token') || '';
// names are case-insensitive. ?name=<person> (join prints the board link with it) signs in as that person.
const nameParam = String(qs.get('name') || '').trim().toLowerCase().replace(/[^\w.\-]/g, '');
if (nameParam) store.set('board-name', nameParam);
let me = (nameParam || store.get('board-name') || '').toLowerCase();
const DEFAULT_SETTINGS = { goal: '', repo: '', integrator: '', planner: '', deadline: '', freeze_minutes: '60', require_approval: '', plan_approved: '', planner_extra: '2' };
const ANYONE = '*'; // settings.integrator: whoever is free merges
let state = { tasks: [], locks: [], questions: [], events: [], settings: { ...DEFAULT_SETTINGS }, phase: 'needs_goal', presence: [], setup: null };
let ui = { nf: { open: false, loaded: false, loading: false, url: '', kind: null, events: null, err: '' }, rotateArm: false, filter: store.get('board-filter') || '', tab: store.get('board-tab') || 'all', dm: null, showAllDone: false, confirmLock: null, dragging: false, steps: {}, editGoal: false, editRepo: false, addrs: false, picked: null, moveMenu: null, doneOpen: store.get('board-done') };
// Folded panels, the same in both views and remembered per board in this browser: Needs attention and Agents (to chips),
// Activity, File locks and the 3D Tasks window (to their title bars), the expanded Tasks window. File locks start
// folded; the Tasks window starts open and docked.
const oUi = (() => { try { const v = JSON.parse(store.get('board-office-ui') || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
const oSave = () => store.set('board-office-ui', JSON.stringify(oUi));
let seenMention = Number(store.get('board-seen-mention') || 0);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = () => (reduceMotion() ? 'auto' : 'smooth');

// Other modules change these through their setters (a module can't assign another module's binding).
function setToken(t) { token = t; }
function setMe(n) { me = n; }
function setState(s) { state = s; }
function setSeenMention(id) { seenMention = id; }

export { $, ACTIVE, AGENT_ONLINE_MS, ALL_PHASES, ANYONE, BASE, COL_DESC, COL_EMPTY, COL_SHOWN, COLS, DEFAULT_SETTINGS,
  DONE_SHOWN, FROZEN_DESC, HINT, HOLDING, HUES, LABEL, me, nsKey, oSave, oUi, pending, qs, reduceMotion, seenMention,
  setMe, setSeenMention, setState, setToken, SIZE_TIP, SLUG, smooth, STALE_MS, state, STATUSES, store, token, ui };
