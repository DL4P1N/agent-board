/**
 * Pure brief -> build plan generator (no DOM, no three.js, no Math.random/Date).
 * `planFromBrief` turns a free-text hackathon brief into 18-30 believable tickets, ordered scaffolding-first,
 * from a library of feature templates triggered by keywords, on top of an always-included baseline.
 */
import type { BriefPlan, ChecklistItem, Difficulty, PlannedTicket } from '../types';
import type { Skill } from '../skills';

export const SAMPLE_BRIEFS: { project: string; brief: string }[] = [
  { project: 'Sticky Wall', brief: 'A realtime collaborative whiteboard with AI-generated sticky notes, login, and a public share link. Deploy a live demo.' },
  { project: 'Foodie Map', brief: 'A street-food map where friends drop pins, upload photos and rate every stall they try.' },
  { project: 'Habit Quest', brief: 'A pixel-art habit tracker with daily streaks, badges and a friends leaderboard to keep each other honest.' },
  { project: 'Fridge Remix', brief: 'An AI recipe remixer: snap a photo of your fridge and get three dinner ideas with a shopping list for what is missing.' },
  { project: 'Queue Party', brief: 'Live music-queue voting for parties: guests scan a QR code, add songs and upvote what plays next, in realtime.' },
  { project: 'Alt Text Hero', brief: 'A browser extension that checks any web page for accessibility problems like contrast, missing alt text and keyboard traps, and suggests fixes.' },
  { project: 'Green Receipt', brief: 'A carbon-footprint receipt scanner: photograph a grocery receipt, estimate emissions per item and show weekly trends in a dashboard.' },
  { project: 'Trivia Rumble', brief: 'A multiplayer trivia game with websockets, team scores, timed rounds and a live leaderboard for the whole room.' },
  { project: 'Trip Slicer', brief: 'A group travel planner where friends vote on an itinerary, split costs and export the final plan as a PDF.' },
  { project: 'Pocket Tutor', brief: 'A mobile-first flashcard app with spaced repetition, offline mode and an AI tutor that explains the answers you miss.' },
];

// ---------- tiny utils ----------
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cap1 = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

type MS = PlannedTicket['milestone'];
interface TT {
  id: string; epic: string; ms: MS; pri: number; d: Difficulty; skills: string[]; titles: string[];
  what: string; accept: string; essential?: boolean; feature?: boolean;
}
function t(id: string, epic: string, ms: MS, pri: number, d: Difficulty, skills: string[], titles: string[], wa: string, essential = false): TT {
  const [what, accept] = wa.split(' || ');
  return { id, epic, ms, pri, d, skills, titles, what, accept: accept ?? 'Works end to end in the preview build.', essential };
}

// ---------- baseline (always included) ----------
const E_FOUND = 'Foundation';
const E_CORE = 'Core UX';
const E_QA = 'Quality';
const E_DEMO = 'Demo & Launch';
const BASE_EPICS = [E_FOUND, E_CORE, E_QA, E_DEMO];

const BASELINE: TT[] = [
  t('repo', E_FOUND, 'mvp', 100, 2, ['ci-cd', 'refactor'], ['{P}: repo scaffold + CI', '{P}: project scaffold, lint and CI pipeline'], 'Create the repo, app skeleton, lint/format config and a CI workflow that runs on every push. || A fresh clone builds with one command and CI is green on main.', true),
  t('schema', E_FOUND, 'mvp', 96, 3, ['db-migrations', 'api-design'], ['{P}: data model and schema', 'Data model + first migration'], 'Design the core entities and write the initial migration. || The migration applies cleanly on an empty database and the relationships are sketched in a short ADR.'),
  t('api', E_FOUND, 'mvp', 95, 3, ['api-design', 'unit-tests'], ['{P}: API skeleton with validation', 'REST API skeleton + health check'], 'Stand up the API with routing, input validation and a health endpoint. || Typed request/response contracts for the core resource; invalid input returns a clear 400.'),
  t('core', E_CORE, 'mvp', 94, 3, ['react-ui', 'css-pixel'], ['{P}: core {core} screen', '{P}: main {core} view and layout'], 'Build the main screen where users do the one thing {P} exists for, wired to the API with mock data first. || The happy path works end to end and the layout holds at laptop and phone widths.', true),
  t('deploy', E_FOUND, 'mvp', 90, 3, ['ci-cd'], ['{P}: deploy pipeline to a preview URL', 'Preview deploys on every merge'], 'Wire the pipeline so every merge to main publishes a live preview URL. || Merging to main updates the preview within 5 minutes; rollback steps are in the README.', true),
  t('seed', E_CORE, 'features', 66, 2, ['db-migrations', 'docs'], ['Seed and demo data', '{P}: demo seed data and reset script'], 'Create believable seed data and a one-command reset so every demo starts clean. || The preview never shows an empty app; the reset script runs in under 10 seconds.', true),
  t('smoke', E_QA, 'features', 62, 3, ['playwright'], ['E2E smoke test of the main flow', '{P}: Playwright smoke test for the happy path'], 'Add a browser test that walks the main user flow and runs in CI. || The test passes in CI and fails loudly when the main flow breaks.'),
  t('errors', E_QA, 'polish', 28, 2, ['react-ui'], ['Error handling and empty states', '{P}: friendly errors and empty states'], 'Replace raw errors with friendly messages and give every list a useful empty state. || No unhandled promise errors in the console during the demo path.', true),
  t('a11yperf', E_QA, 'polish', 26, 3, ['perf', 'playwright'], ['Accessibility and performance pass', 'A11y + perf pass (Lighthouse 90+)'], 'Fix contrast, labels and focus order, then trim bundle size and slow requests. || Lighthouse accessibility and performance are 90+ on the main screen.'),
  t('bugbash', E_QA, 'polish', 24, 3, ['playwright', 'unit-tests'], ['Bug bash: fix the top 10 issues', 'Bug bash and regression fixes'], 'Click through everything as a stranger, file what breaks and fix the worst ten. || Every issue found is fixed or triaged; no known crashers on the demo path.'),
  t('readme', E_DEMO, 'demo', 52, 1, ['docs'], ['README and setup docs', '{P}: README + one-command setup'], 'Write the README: what it is, screenshots, setup and deploy steps. || A teammate can run the project from a clean checkout using only the README.', true),
  t('script', E_DEMO, 'demo', 56, 2, ['docs'], ['Demo script and rehearsal notes', '{P}: 3-minute demo script'], 'Write a tight three-minute demo script with the exact click path and fallback plan. || The script fits in 3 minutes and was rehearsed once against the live preview.', true),
  t('pitch', E_DEMO, 'demo', 54, 2, ['docs', 'css-pixel'], ['Pitch one-liner and slide', '{P}: pitch one-liner + single slide'], 'Write the one-line pitch and design one clean slide with the problem, demo and next steps. || One slide, one sentence, readable from the back of the room.', true),
  t('video', E_DEMO, 'demo', 50, 1, ['docs'], ['Record the demo video', '{P}: record and upload the demo video'], 'Record a clean screen capture of the demo script and upload it for the judges. || A 2-3 minute video with audio is uploaded and the link is in the README.'),
];

// ---------- generic fillers (used when few feature keywords trigger) ----------
const FILLERS: TT[] = [
  t('landing', E_CORE, 'features', 61, 2, ['css-pixel', 'react-ui'], ['{P}: landing page and branding', 'Landing page with logo and tagline'], 'Add a landing page with the pitch, a hero screenshot and a clear call to action. || Visitors understand what {P} does within five seconds of landing.'),
  t('unit', E_QA, 'features', 60, 3, ['unit-tests'], ['Unit tests for core logic', '{P}: unit tests for the core domain logic'], 'Cover the core domain logic with fast unit tests and fixtures. || The core module has tests for the happy path and two edge cases, run in CI.'),
  t('settings', E_CORE, 'features', 59, 2, ['react-ui', 'api-design'], ['Settings and preferences page', '{P}: user settings screen'], 'Add a small settings screen that persists a few preferences. || Changes persist across reloads and are validated server-side.'),
  t('logging', E_FOUND, 'features', 58, 2, ['ci-cd', 'api-design'], ['Structured logging and error tracking', '{P}: logging + error reporting'], 'Add structured logs with request ids and wire up error reporting in the preview. || A forced error shows up with a stack trace and request id in the logs.'),
  t('secpass', E_QA, 'polish', 27, 3, ['security'], ['Security pass: secrets, validation, rate limits', '{P}: security review of secrets and inputs'], 'Review secrets handling, input validation and add basic rate limiting. || No secrets in the repo, inputs are validated and the API rate-limits abusive clients.'),
  t('skeleton', E_CORE, 'polish', 25, 2, ['react-ui', 'css-pixel'], ['Loading skeletons and transitions', '{P}: loading states and micro-interactions'], 'Replace spinners with skeletons and add subtle transitions to key interactions. || No layout jumps while data loads; transitions stay under 200ms.'),
];

// ---------- feature templates (keyword triggered) ----------
interface FeatureTemplate { id: string; re: RegExp; items: TT[] }
function F(id: string, re: RegExp, items: TT[]): FeatureTemplate { return { id, re, items: items.map((i) => ({ ...i, feature: true })) }; }

const FEATURES: FeatureTemplate[] = [
  F('auth', /\b(auth\w*|log ?in|sign ?(?:in|up)|accounts?|users?|oauth|sso|passwords?|members?)\b/gi, [
    t('auth1', 'Auth', 'mvp', 93, 3, ['auth', 'api-design'], ['{P}: login and session handling', 'Login, signup and sessions'], 'Email or OAuth login with secure sessions and a logout flow. || A new user can sign up, reload the page and stay signed in; logout clears the session.'),
    t('auth2', 'Auth', 'features', 68, 2, ['auth', 'react-ui'], ['Protected routes and user profile', '{P}: gated screens and profile menu'], 'Gate private screens behind auth and add a small profile menu. || Anonymous users are redirected to login; the menu shows the name and a logout button.'),
  ]),
  F('realtime', /\b(real-?time|web ?sockets?|live|collab\w*|sync\w*|multiplayer|presence|simultaneous)\b/gi, [
    t('rt1', 'Realtime', 'mvp', 92, 4, ['api-design', 'perf'], ['{P}: realtime sync over websockets', '{P}: live updates channel (websockets)'], 'Add a websocket channel that broadcasts state changes to everyone in the same room. || Two browsers see each other\'s changes within 300ms; reconnect resumes without data loss.'),
    t('rt2', 'Realtime', 'features', 67, 3, ['react-ui', 'css-pixel'], ['Presence indicators and live cursors', 'Who is online: presence + cursors'], 'Show who is in the room with avatars and live cursors. || Joining and leaving updates the presence list within 2 seconds.'),
  ]),
  F('ai', /\b(ai|llm|gpt|claude|generat\w*|ml|smart|suggest\w*|recommend\w*|assistant|prompts?)\b/gi, [
    t('ai1', 'AI', 'features', 70, 4, ['api-design', 'security'], ['{P}: AI generation endpoint', 'LLM-backed generation service'], 'Server endpoint that calls the model with a tight prompt and streams the result. || Returns a result for the demo prompt in under 5s; the API key never reaches the client.'),
    t('ai2', 'AI', 'features', 64, 3, ['unit-tests', 'security'], ['Prompt design and output guardrails', '{P}: prompt templates + output validation'], 'Write the prompt templates and validate/sanitize model output before it hits the UI. || Malformed or unsafe output falls back to a safe default; prompt tests cover 5 cases.'),
    t('ai3', 'AI', 'polish', 29, 2, ['react-ui'], ['AI loading, retry and fallback states', '{P}: graceful AI failure UX'], 'Give AI actions a loading state, retry button and a canned fallback. || Killing the AI backend never leaves the UI stuck on a spinner.'),
  ]),
  F('payments', /\b(pay\w*|checkout|stripe|billing|subscri\w*|donat\w*|tips?|pricing|purchase\w*)\b/gi, [
    t('pay1', 'Payments', 'features', 69, 4, ['payments', 'api-design'], ['Stripe checkout flow', '{P}: checkout in Stripe test mode'], 'Create a hosted checkout session in test mode and wire it to the main flow. || A test card completes checkout and lands on a success page.'),
    t('pay2', 'Payments', 'features', 63, 4, ['payments', 'security', 'unit-tests'], ['Payment webhook handler and receipts', 'Stripe webhook handler + receipts'], 'Verify webhook signatures, mark orders paid idempotently and email a receipt. || Replaying the same event twice does not double-charge or double-fulfil.'),
  ]),
  F('maps', /\b(maps?|geo\w*|locations?|nearby|gps|places?|routes?|street|neighbou?rhood|city)\b/gi, [
    t('map1', 'Maps', 'features', 69, 3, ['react-ui', 'api-design'], ['{P}: interactive map with markers', 'Map view with clustered markers'], 'Render an interactive map with markers that open a detail card. || 200 markers render smoothly and tapping one opens its card.'),
    t('map2', 'Maps', 'features', 65, 3, ['api-design', 'db-migrations'], ['Geolocation and nearby query', '{P}: nearby search with geo index'], 'Store coordinates with a geo index and expose a nearby query. || Nearby results are sorted by distance and return in under 200ms on seed data.'),
  ]),
  F('chat', /\b(chat\w*|messag\w*|dm|inbox|comments?|threads?|repl(?:y|ies))\b/gi, [
    t('chat1', 'Messaging', 'features', 68, 3, ['react-ui', 'api-design'], ['Chat UI and send flow', '{P}: messaging UI with optimistic send'], 'Build the message list and composer with optimistic sending. || Messages appear instantly and reconcile with the server; failures show a retry.'),
    t('chat2', 'Messaging', 'features', 62, 3, ['db-migrations', 'api-design'], ['Message persistence and unread counts', 'Message history + unread badges'], 'Persist messages with pagination and track unread counts per user. || Reloading restores history; unread badges clear when a thread is opened.'),
  ]),
  F('dashboard', /\b(dashboards?|charts?|analytics|metrics|stats|insights?|reports?|tracking|trends?)\b/gi, [
    t('dash1', 'Insights', 'features', 68, 3, ['react-ui', 'perf'], ['{P}: dashboard with key charts', 'Insights dashboard with 3 charts'], 'Build a dashboard with three charts that tell the story at a glance. || Charts render from API data, are keyboard-accessible and load in under 1s on seed data.'),
    t('dash2', 'Insights', 'features', 63, 3, ['api-design', 'db-migrations'], ['Aggregation endpoints for trends', '{P}: weekly trend aggregation API'], 'Add aggregation queries and an endpoint for weekly trends. || Aggregates match a hand-computed fixture and respond in under 300ms.'),
  ]),
  F('mobile', /\b(mobile|pwa|offline|responsive|phone|ios|android|app store)\b/gi, [
    t('mob1', 'Mobile', 'features', 66, 2, ['css-pixel', 'react-ui'], ['Mobile-first responsive layout', '{P}: responsive layout for phones'], 'Make every screen usable on a 375px phone with touch-sized targets. || No horizontal scroll at 375px and all tap targets are at least 44px.'),
    t('mob2', 'Mobile', 'features', 61, 3, ['perf', 'react-ui'], ['PWA install and offline cache', '{P}: installable PWA with offline mode'], 'Add a manifest and service worker that cache the app shell and recent data. || The app installs to the home screen and opens with airplane mode on.'),
  ]),
  F('game', /\b(games?|trivia|quiz\w*|leaderboards?|scores?|levels?|puzzles?|players?|rounds?|team)\b/gi, [
    t('game1', 'Gameplay', 'mvp', 92, 4, ['react-ui', 'unit-tests'], ['{P}: game loop and scoring', 'Core game loop with timed rounds'], 'Implement the round state machine, timers and scoring rules. || A full round runs start to finish with correct scores; unit tests cover scoring edge cases.'),
    t('game2', 'Gameplay', 'features', 66, 3, ['api-design', 'db-migrations'], ['Leaderboard with live ranking', '{P}: leaderboard and rankings'], 'Persist scores and show a live-updating leaderboard. || Ties are broken deterministically and the board updates within a second of a score change.'),
  ]),
  F('media', /\b(uploads?|photos?|images?|camera|pictures?|videos?|media|scan\w*|receipts?|ocr|selfies?)\b/gi, [
    t('media1', 'Media', 'features', 69, 3, ['api-design', 'security'], ['Image upload and storage pipeline', '{P}: photo upload with signed URLs'], 'Accept image uploads with size/type checks and store them behind signed URLs. || A 5MB photo uploads in under 5s; non-images and oversize files are rejected.'),
    t('media2', 'Media', 'features', 64, 3, ['react-ui', 'perf'], ['Photo capture, preview and compression', '{P}: camera capture with client-side resize'], 'Let users take or pick a photo, preview it and compress it in the browser. || Previews appear instantly and uploads are resized to 1600px max.'),
  ]),
  F('search', /\b(search\w*|filter\w*|sort\w*|browse|discover\w*|tags?|categor\w+|catalog)\b/gi, [
    t('search1', 'Search', 'features', 65, 3, ['api-design', 'react-ui', 'db-migrations'], ['Search and filters with debounced queries', '{P}: search + filter UI'], 'Add search and filter controls backed by an indexed query. || Typing updates results after a 250ms debounce; filters combine and can be cleared.'),
  ]),
  F('notif', /\b(notif\w*|e-?mail|push|alerts?|remind\w*|digest|sms)\b/gi, [
    t('notif1', 'Notifications', 'features', 64, 3, ['api-design'], ['Notification service (email/push)', '{P}: notifications via email and push'], 'Add a notification service with templates and a dev-mode inbox. || Triggering the event delivers one notification; duplicates are suppressed.'),
    t('notif2', 'Notifications', 'polish', 29, 2, ['react-ui'], ['Notification preferences UI', 'Notification settings and unsubscribe'], 'Let users choose which notifications they get. || Opting out takes effect immediately and unsubscribe links work.'),
  ]),
  F('calendar', /\b(calendar|schedul\w*|booking|appointments?|events?|agenda|timetable|time zones?)\b/gi, [
    t('cal1', 'Scheduling', 'features', 66, 3, ['react-ui', 'api-design'], ['Calendar and schedule view', '{P}: schedule view with day/week toggle'], 'Render a day/week schedule view with create and edit. || Events can be created, moved and deleted; the view handles overlapping items.'),
    t('cal2', 'Scheduling', 'features', 60, 4, ['db-migrations', 'unit-tests'], ['Recurring events and time zones', 'Time zone-safe recurrence rules'], 'Support recurring events with correct time zone and DST handling. || Weekly recurrence across a DST change lands at the same local time; tests cover it.'),
  ]),
  F('share', /\b(shar\w*|invites?|public|embed|permalink|links?)\b/gi, [
    t('share1', 'Social', 'features', 68, 3, ['api-design', 'auth'], ['Public share links', '{P}: shareable read-only link'], 'Generate an unguessable link that opens a read-only view of the item. || Anyone with the link can view without logging in; revoking the link works instantly.'),
  ]),
  F('feed', /\b(feed|friends?|follow\w*|community|social|profiles?|leaderboards?)\b/gi, [
    t('feed1', 'Social', 'features', 64, 4, ['db-migrations', 'api-design', 'react-ui'], ['Friends and activity feed', '{P}: friends graph and activity feed'], 'Model friendships and show a feed of friend activity. || Adding a friend shows their activity within a minute; the feed paginates smoothly.'),
  ]),
  F('commerce', /\b(cart|shop\w*|store|e-?commerce|products?|orders?|inventory|marketplace|merch)\b/gi, [
    t('shop1', 'Commerce', 'features', 67, 3, ['react-ui', 'db-migrations'], ['Product catalog and detail pages', '{P}: catalog with detail pages'], 'Build the catalog grid and product detail page from seed data. || 20 products browse smoothly and each has a shareable detail URL.'),
    t('shop2', 'Commerce', 'features', 63, 4, ['api-design', 'payments', 'unit-tests'], ['Cart and order state', 'Cart persistence and order creation'], 'Implement the cart and order lifecycle with totals and stock checks. || Totals match a hand-computed fixture; out-of-stock items cannot be ordered.'),
  ]),
  F('audio', /\b(voice|audio|speech|music|podcasts?|sound|songs?|playlists?|queue|dj|transcri\w*|tracks?)\b/gi, [
    t('audio1', 'Audio', 'features', 67, 4, ['react-ui', 'perf'], ['Audio playback and queue pipeline', '{P}: playback queue with now-playing'], 'Build the playback pipeline and a queue with a now-playing bar. || Tracks advance automatically and the queue survives a page reload.'),
    t('audio2', 'Audio', 'features', 61, 3, ['api-design'], ['Track search and metadata lookup', 'Music search via provider API'], 'Search tracks via a provider API and normalize the metadata. || Search returns typed results in under 800ms and handles provider errors.'),
  ]),
  F('voting', /\b(vot\w*|polls?|rank\w*|rat(?:e|es|ing|ings)|reviews?|likes?|upvote\w*)\b/gi, [
    t('vote1', 'Voting', 'features', 67, 3, ['api-design', 'db-migrations'], ['{P}: voting and ratings with live tallies', 'Voting/ratings API with live tallies'], 'Let users vote or rate and show live tallies. || Tallies update across clients within a second and reflect each user\'s latest vote.'),
    t('vote2', 'Voting', 'polish', 30, 3, ['security', 'unit-tests'], ['Abuse prevention: one vote per user', 'Rate limits and duplicate-vote protection'], 'Prevent duplicate votes and ballot stuffing. || A user cannot vote twice; scripted spam is throttled; tests cover both.'),
  ]),
  F('export', /\b(export\w*|pdf|csv|download\w*|print\w*|import\w*)\b/gi, [
    t('export1', 'Export', 'features', 62, 3, ['api-design', 'docs'], ['Export to PDF/CSV', '{P}: export as PDF and CSV'], 'Add export buttons that generate a clean PDF and CSV from current data. || The PDF matches the on-screen layout and the CSV opens cleanly in a spreadsheet.'),
  ]),
  F('onboarding', /\b(onboard\w*|tutorials?|tour|welcome|getting started|first[- ]run)\b/gi, [
    t('onb1', 'Onboarding', 'polish', 30, 2, ['react-ui', 'css-pixel'], ['First-run onboarding flow', '{P}: welcome tour for new users'], 'Add a short first-run tour that gets a new user to their first success. || A new user reaches the first success in under 60 seconds; the tour is skippable.'),
  ]),
  F('admin', /\b(admin\w*|moderat\w*|back-?office|roles?|permissions?|manage\w*)\b/gi, [
    t('admin1', 'Admin', 'features', 60, 3, ['react-ui', 'auth'], ['Admin console and moderation tools', '{P}: admin view with moderation actions'], 'Add an admin-only screen for reviewing and removing content. || Only admins can open it; removals take effect immediately and are logged.'),
  ]),
  F('a11y', /\b(accessib\w*|a11y|wcag|screen readers?|contrast|aria|disabilit\w*)\b/gi, [
    t('a11y1', 'Accessibility', 'mvp', 91, 4, ['react-ui', 'playwright'], ['{P}: accessibility rule engine', 'Rule engine: contrast, alt text and labels'], 'Implement the core rules (contrast, alt text, labels, focus order) as a pure, testable engine. || Each rule has a fixture page it catches and a clean page it passes.'),
    t('a11y2', 'Accessibility', 'features', 66, 3, ['react-ui', 'docs'], ['Violation report with fix suggestions', '{P}: issue list with suggested fixes'], 'Show violations grouped by severity with a plain-language fix for each. || Each violation highlights its element and offers a copyable fix.'),
  ]),
  F('i18n', /\b(i18n|translat\w*|locali[sz]\w*|multilingual|languages?|bilingual)\b/gi, [
    t('i18n1', 'i18n', 'polish', 29, 3, ['react-ui', 'refactor'], ['i18n framework and two locales', '{P}: translations for English and Spanish'], 'Extract UI strings into a message catalog and ship two locales. || Switching language updates every screen with no missing-key fallbacks.'),
  ]),
  F('integrations', /\b(apis?|webhooks?|integrat\w*|plugins?|sdk|slack|discord|github|zapier|connectors?)\b/gi, [
    t('int1', 'Integrations', 'features', 62, 3, ['api-design', 'auth'], ['Third-party integration (webhooks/OAuth)', '{P}: integration with an external service'], 'Connect one external service via OAuth or webhooks with retries. || A test event round-trips through the integration and failures retry with backoff.'),
  ]),
  F('extension', /\b(extensions?|chrome|browser add-?on|content scripts?|manifest)\b/gi, [
    t('ext1', 'Extension', 'mvp', 92, 3, ['react-ui', 'refactor'], ['{P}: browser extension scaffold', 'Extension manifest, popup and content script'], 'Scaffold the extension: manifest v3, popup UI and a content script bridge. || The extension loads unpacked in Chrome and the popup talks to the content script.'),
    t('ext2', 'Extension', 'features', 68, 4, ['react-ui', 'perf'], ['Content script: scan and annotate the page', '{P}: page scanner with on-page highlights'], 'Scan the current page and annotate findings in place without breaking it. || Scanning a heavy page takes under 2s and highlights can be dismissed.'),
  ]),
  F('theming', /\b(dark mode|themes?|theming|skins?|palette|customi[sz]\w*|branding)\b/gi, [
    t('theme1', 'Theming', 'polish', 30, 2, ['css-pixel'], ['Dark mode and theme tokens', '{P}: theme tokens with dark mode'], 'Introduce design tokens and a dark theme that follows the system setting. || Every screen is legible in light and dark; the choice persists.'),
  ]),
  F('streaks', /\b(streaks?|gamif\w*|badges?|achievements?|xp|rewards?|habits?|goals?|points)\b/gi, [
    t('streak1', 'Streaks', 'mvp', 91, 3, ['db-migrations', 'unit-tests'], ['{P}: streak engine and daily check-ins', 'Streak engine with time zone-safe days'], 'Implement check-ins and streak calculation with grace rules. || Streaks survive time zone changes and a missed day resets correctly; tests cover the rules.'),
    t('streak2', 'Streaks', 'features', 62, 2, ['css-pixel', 'react-ui'], ['Badges and celebration animations', '{P}: badges and level-up celebrations'], 'Award badges at milestones with a short celebration animation. || Hitting a 3-day streak shows the badge once and persists it to the profile.'),
  ]),
  F('pixel', /\b(pixel|retro|8-?bit|animat\w*|sprites?)\b/gi, [
    t('pixel1', 'Look & Feel', 'features', 61, 3, ['css-pixel', 'perf'], ['Pixel-art sprites and micro-animations', '{P}: pixel sprites and idle animations'], 'Add a sprite sheet and a few idle and reaction animations. || Animations run at 60fps and respect reduced-motion settings.'),
  ]),
  F('data', /\b(scrap\w*|crawl\w*|ingest\w*|datasets?|sensors?|carbon|footprint|emissions?|open data)\b/gi, [
    t('data1', 'Data', 'mvp', 90, 4, ['api-design', 'db-migrations'], ['{P}: data ingestion and normalization', 'Ingestion pipeline with a normalized schema'], 'Ingest raw inputs and normalize them into the schema, with a lookup table for reference values. || Ten sample inputs normalize correctly; bad rows are quarantined, not dropped.'),
  ]),
  F('canvas', /\b(whiteboards?|canvas|draw\w*|sticky|stickies|boards?|diagrams?|sketch\w*|notes?)\b/gi, [
    t('canvas1', 'Canvas', 'mvp', 92, 4, ['react-ui', 'perf'], ['{P}: canvas with draggable items', 'Canvas engine: pan, zoom and drag'], 'Build the canvas with pan, zoom and draggable items that stay smooth at 200 items. || Dragging holds 60fps with 200 items; zoom keeps the pointer anchored.'),
    t('canvas2', 'Canvas', 'features', 64, 3, ['react-ui', 'unit-tests'], ['Undo/redo and item editing', '{P}: undo, redo and inline editing'], 'Add inline editing and an undo/redo history. || Ctrl+Z / Ctrl+Shift+Z work for move, edit and delete.'),
  ]),
  F('editor', /\b(editor|markdown|rich text|documents?|wiki|writing)\b/gi, [
    t('editor1', 'Editor', 'features', 66, 3, ['react-ui', 'api-design'], ['Rich-text editor with autosave', '{P}: editor with debounced autosave'], 'Add a lightweight rich-text editor that autosaves. || Edits autosave within 2s and a reload restores the latest text.'),
  ]),
  F('food', /\b(recipes?|food|cook\w*|fridge|meals?|ingredients?|restaurants?|diet\w*|stalls?)\b/gi, [
    t('food1', 'Food', 'features', 67, 3, ['db-migrations', 'api-design'], ['Ingredient and food data model', '{P}: food catalog and normalization'], 'Model foods and ingredients with aliases so messy inputs map to canonical items. || "tomatoes", "tomato" and "roma tomato" resolve to one item.'),
    t('food2', 'Food', 'features', 62, 3, ['api-design', 'unit-tests'], ['Recipe rules and dietary filters', '{P}: dietary filters and substitution rules'], 'Add dietary filters and substitution rules for the suggestions. || Vegan and nut-free filters never return a violating result in tests.'),
  ]),
  F('health', /\b(fitness|workouts?|health\w*|sleep|wellness|medit\w*|steps)\b/gi, [
    t('health1', 'Health', 'features', 63, 3, ['db-migrations', 'react-ui'], ['Activity logging and summaries', '{P}: daily log and weekly summary'], 'Let users log activity quickly and see a weekly summary. || Logging takes two taps and the summary matches the underlying entries.'),
  ]),
  F('security', /\b(privacy|secure|security|encrypt\w*|gdpr|compliance|safe|abuse|spam)\b/gi, [
    t('sec1', 'Security', 'polish', 30, 3, ['security', 'api-design'], ['Security hardening: validation and rate limits', '{P}: input validation, CORS and rate limiting'], 'Harden the API: strict validation, CORS rules and rate limiting. || Fuzzed inputs return 4xx not 500; repeated abuse is throttled.'),
  ]),
  F('perf', /\b(fast|performance|scal\w+|cache|caching|latency|speed)\b/gi, [
    t('perf1', 'Performance', 'features', 61, 3, ['perf'], ['Caching and load test of the hot path', '{P}: cache the hot path and load test it'], 'Add caching to the hottest endpoint and load-test it. || p95 stays under 300ms at 50 concurrent users on the preview.'),
  ]),
  F('travel', /\b(travel|trips?|itinerar\w*|flights?|hotels?|vacation|split costs?)\b/gi, [
    t('travel1', 'Travel', 'features', 66, 3, ['react-ui', 'db-migrations'], ['Itinerary builder', '{P}: drag-and-drop itinerary builder'], 'Build an itinerary with days, stops and drag-to-reorder. || Reordering persists and totals update immediately.'),
    t('travel2', 'Travel', 'features', 62, 3, ['api-design', 'unit-tests'], ['Cost splitting and settle-up', '{P}: expense splitting with settle-up'], 'Track shared expenses and compute who owes whom. || Settle-up minimizes the number of transfers; tests cover rounding.'),
  ]),
  F('learn', /\b(learn\w*|study|flashcards?|courses?|lessons?|education|students?|teach\w*|tutor\w*|spaced repetition)\b/gi, [
    t('learn1', 'Learning', 'mvp', 91, 3, ['react-ui', 'unit-tests'], ['{P}: flashcard review loop', 'Card review loop with spaced repetition'], 'Implement the review loop and a simple spaced-repetition scheduler. || Correct answers push the next review out; misses bring it back within the session.'),
  ]),
];

const DEFAULT_IDS = new Set(['react-ui', 'css-pixel', 'api-design', 'db-migrations', 'auth', 'payments', 'playwright', 'unit-tests', 'ci-cd', 'security', 'perf', 'refactor', 'docs']);
const GENERIC_ADJ = new Set(['collaborative', 'simple', 'small', 'new', 'modern', 'fun', 'cool', 'smart', 'powerful', 'interactive', 'social', 'mobile-first', 'lightweight', 'beautiful', 'tiny', 'little', 'minimal', 'friendly', 'group']);
const STOPW = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'into', 'live']);

function plural(w: string): string {
  if (!w) return 'apps';
  if (/s$/i.test(w)) return w;
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(ch|sh|x|z)$/i.test(w)) return w + 'es';
  return w + 's';
}

/** "A realtime collaborative whiteboard with ..." -> { words: ['realtime','whiteboard'], noun: 'whiteboard' } */
function corePhrase(brief: string): { words: string[]; noun: string } {
  const m = /^\s*(?:an?|the|our|my)?\s*(.+?)(?:\s+(?:with|that|which|where|for|to|so|and|using|powered|built|featuring|including|like|in)\b|[,.;:!?]|$)/i.exec(brief);
  let phrase = (m?.[1] ?? '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
  let words = phrase.split(/\s+/).filter((w) => w && !GENERIC_ADJ.has(w) && !STOPW.has(w));
  if (words.length > 4) words = words.slice(-4);
  if (words.length > 2 && /^(?:a|an)$/.test(words[0])) words = words.slice(1);
  const noun = words[words.length - 1] ?? '';
  return { words, noun };
}

function tagline(textLc: string): string {
  if (/\b(ai|llm|gpt|generat\w*)\b/.test(textLc)) return 'where AI writes the first draft';
  if (/\b(game|trivia|quiz|multiplayer|leaderboard)\b/.test(textLc)) return 'built to be played together';
  if (/\b(map|geo|location|nearby)\b/.test(textLc)) return 'that put your world on the map';
  if (/\b(streak|habit|goal|gamif\w*)\b/.test(textLc)) return 'that make showing up the fun part';
  if (/\b(real-?time|live|collab\w*|websocket)\b/.test(textLc)) return 'that everyone shapes live';
  if (/\b(friends?|social|share|community)\b/.test(textLc)) return 'your friends will actually open';
  if (/\b(accessib\w*|a11y)\b/.test(textLc)) return 'that make the web work for everyone';
  if (/\b(pay\w*|checkout|stripe)\b/.test(textLc)) return 'with checkout that just works';
  return 'built in a weekend, ready to demo';
}

function makePitch(project: string, brief: string): string {
  const { words, noun } = corePhrase(brief);
  const textLc = brief.toLowerCase();
  if (!noun) return `${project}: the fastest way from idea to live demo.`;
  const head = [...words.slice(0, -1), plural(noun)].join(' ');
  return `${project}: ${head} ${tagline(textLc)}.`;
}

function tokensOf(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOPW.has(w));
}

// ---------- main ----------
export function planFromBrief(input: { projectName: string; brief: string; skills: Skill[]; seed: number; maxTickets?: number }): BriefPlan {
  try {
    return build(input);
  } catch {
    return build({ projectName: 'Project', brief: '', skills: Array.isArray(input?.skills) ? input.skills : [], seed: 1, maxTickets: input?.maxTickets });
  }
}

function build(input: { projectName: string; brief: string; skills: Skill[]; seed: number; maxTickets?: number }): BriefPlan {
  const P = (String(input.projectName ?? '').trim() || 'Project').slice(0, 40);
  const brief = String(input.brief ?? '').slice(0, 4000).trim();
  const skills: Skill[] = Array.isArray(input.skills) ? input.skills.filter((s) => s && typeof s.id === 'string') : [];
  const skillIds = new Set(skills.map((s) => s.id));
  const seed = Number.isFinite(input.seed) ? (input.seed | 0) : 1;
  const rng = mulberry32((seed >>> 0) ^ hash32(P + '|' + brief));
  const textLc = (P + ' ' + brief).toLowerCase();
  const briefLc = brief.toLowerCase();
  const wordCount = brief ? brief.split(/\s+/).length : 0;
  const { noun } = corePhrase(brief);
  const coreNoun = noun || 'app';

  const minCount = wordCount < 6 ? 16 : 18;
  const upper = Math.min(30, 20 + Math.floor(wordCount / 6));
  let cap = 30;
  if (typeof input.maxTickets === 'number' && Number.isFinite(input.maxTickets)) cap = Math.max(1, Math.min(30, Math.floor(input.maxTickets)));

  // 1. baseline
  let chosen: TT[] = BASELINE.map((x) => ({ ...x }));

  // 2. triggered features, strongest first
  const triggered = FEATURES
    .map((f, idx) => ({ f, idx, score: (textLc.match(f.re) ?? []).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  for (const { f } of triggered) {
    if (chosen.length >= upper) break;
    const room = upper - chosen.length;
    for (const it of f.items.slice(0, room)) chosen.push({ ...it });
  }

  // 3. fillers up to the minimum
  for (const fl of FILLERS) {
    if (chosen.length >= minCount) break;
    chosen.push({ ...fl });
  }

  // 4. trim to maxTickets (essentials survive)
  if (chosen.length > cap) {
    const order = chosen.map((c, i) => ({ c, i })).filter((x) => !x.c.essential).sort((a, b) => a.c.pri - b.c.pri || b.i - a.i);
    const drop = new Set<number>();
    let over = chosen.length - cap;
    for (const x of order) { if (over <= 0) break; drop.add(x.i); over--; }
    chosen = chosen.filter((_, i) => !drop.has(i));
  }

  // 5. epics: baseline epics + the two strongest feature epics, the rest fold into Core UX
  const featEpicCount = new Map<string, number>();
  const featEpicOrder: string[] = [];
  for (const c of chosen) {
    if (!c.feature) continue;
    if (!featEpicCount.has(c.epic)) featEpicOrder.push(c.epic);
    featEpicCount.set(c.epic, (featEpicCount.get(c.epic) ?? 0) + 1);
  }
  const keepFeat = [...featEpicOrder].sort((a, b) => (featEpicCount.get(b) ?? 0) - (featEpicCount.get(a) ?? 0) || featEpicOrder.indexOf(a) - featEpicOrder.indexOf(b)).slice(0, 2);
  for (const c of chosen) if (c.feature && !keepFeat.includes(c.epic)) c.epic = E_CORE;
  const usedEpics = new Set(chosen.map((c) => c.epic));
  const epics = [E_FOUND, E_CORE, ...keepFeat, E_QA, E_DEMO].filter((e, i, a) => usedEpics.has(e) && a.indexOf(e) === i);
  for (const e of BASE_EPICS) if (!epics.includes(e) && epics.length < 6) epics.push(e);

  // 6. custom skills (not in the default catalog) attach to relevant tickets
  const customs = skills.filter((s) => s.custom || !DEFAULT_IDS.has(s.id));
  const customUse = new Map<string, number>();

  // 7. order: by priority desc (stable), seeded shuffle within equal priority
  const indexed = chosen.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => b.c.pri - a.c.pri || a.i - b.i);
  const groups: { c: TT; i: number }[][] = [];
  for (const x of indexed) {
    const last = groups[groups.length - 1];
    if (last && last[0].c.pri === x.c.pri) last.push(x); else groups.push([x]);
  }
  const ordered: TT[] = [];
  for (const g of groups) {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    for (const x of g) ordered.push(x.c);
  }

  // 8. materialize
  const usedTitles = new Set<string>();
  const tickets: PlannedTicket[] = ordered.map((c) => {
    const variants = c.titles;
    let title = variants[Math.floor(rng() * variants.length)].replace(/\{P\}/g, P).replace(/\{core\}/g, coreNoun);
    title = cap1(title);
    if (usedTitles.has(title.toLowerCase())) {
      const alt = variants.map((v) => cap1(v.replace(/\{P\}/g, P).replace(/\{core\}/g, coreNoun))).find((v) => !usedTitles.has(v.toLowerCase()));
      title = alt ?? `${title} (2)`;
    }
    let n = 2;
    while (usedTitles.has(title.toLowerCase())) { title = `${title.replace(/ \(\d+\)$/, '')} (${n++})`; }
    usedTitles.add(title.toLowerCase());

    const description = `${c.what.replace(/\{P\}/g, P)}\nAcceptance: ${c.accept.replace(/\{P\}/g, P)}`;
    let ids = c.skills.filter((id) => skillIds.has(id));

    // custom skill matching
    const ticketLc = (title + ' ' + description).toLowerCase();
    const extra: string[] = [];
    for (const s of customs) {
      const words = tokensOf(`${s.name} ${s.id} ${s.blurb ?? ''}`).filter((w) => !['skill', 'skills', 'with', 'design', 'tests', 'testing'].includes(w));
      const nameWords = tokensOf(`${s.name} ${s.id}`);
      const direct = nameWords.some((w) => ticketLc.includes(w));
      const viaBrief = words.some((w) => briefLc.includes(w)) && c.feature !== undefined && !BASE_EPICS.includes(c.epic) && (customUse.get(s.id) ?? 0) < 3;
      if (direct || viaBrief) {
        extra.push(s.id);
        customUse.set(s.id, (customUse.get(s.id) ?? 0) + 1);
      }
    }
    ids = [...ids.slice(0, 2), ...extra, ...ids.slice(2)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
    if (ids.length === 0 && skills.length > 0) ids = [skills[0].id];

    return {
      title,
      description,
      difficulty: c.d,
      skills: ids,
      epic: c.epic,
      milestone: c.ms,
      priority: c.pri,
    };
  });

  const checklist: ChecklistItem[] = [
    { id: 'repo', label: 'Repo + CI green', done: false, auto: true },
    { id: 'deploy-live', label: 'Live preview deployed', done: false, auto: true },
    { id: 'readme', label: 'README + setup', done: false, auto: true },
    { id: 'demo-script', label: 'Demo script rehearsed', done: false, auto: true },
    { id: 'pitch', label: 'Pitch ready', done: false, auto: true },
    { id: 'submitted', label: 'Submitted to judges', done: false, auto: true },
  ];

  return {
    epics,
    milestones: [
      { id: 'mvp', title: 'MVP walking skeleton', dueFraction: 0.45 },
      { id: 'features', title: 'Feature complete', dueFraction: 0.72 },
      { id: 'polish', title: 'Polish + deploy hardened', dueFraction: 0.9 },
      { id: 'demo', title: 'Demo ready', dueFraction: 1.0 },
    ],
    tickets,
    checklist,
    pitch: makePitch(P, brief),
  };
}
