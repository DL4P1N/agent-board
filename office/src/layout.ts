/**
 * Shared floor plan + pathfinding. Used by sim (to move agents) and scene (to build the room).
 * Plain TS, no three.js import. Coordinates: x east, z south, 1 unit ~ 1 metre. Room is
 * x in [-14, 14], z in [-11, 11]. North wall is z = -11 (the "front" of the office, where the
 * orchestrator's planning board hangs). The default camera looks from the south-east toward the north-west.
 *
 *   north zone (z -11..-4):   VAULT    DEPOT        ORCH BOARD+DESK         INTEGRATOR DESK   MAIN+DEPLOY RACKS
 *   corridor z = -3
 *   row 0 cubicles z=0  (extent -1.5..1.5)   aisle z=2
 *   row 1 cubicles z=4  (extent  2.5..5.5)   aisle z=6
 *   row 2 cubicles z=8  (extent  6.5..9.5)   aisle z=10
 *   4 columns at x = -7.5, -2.5, 2.5, 7.5; vertical aisles at x = -10, -5, 0, 5, 10.
 *
 * Workers sit at the SOUTH end of an open-south cubicle, facing NORTH (heading 0) at a desk that sits
 * against the cubicle's north partition. They leave the cubicle southward into the aisle.
 */
import type { Vec2 } from './types';

export const ROOM = { minX: -14, maxX: 14, minZ: -11, maxZ: 11, wallHeight: 5 };

export const COLS_X = [-7.5, -2.5, 2.5, 7.5];
export const ROWS_Z = [0, 4, 8];
export const V_AISLES_X = [-10, -5, 0, 5, 10];
export const H_AISLES_Z = [-3, 2, 6, 10];
export const CUBICLE = { width: 3.6, depth: 3.0 };

export interface DeskSlot {
  index: number;          // 0..11, row-major (row 0 left->right first)
  col: number;
  row: number;
  center: Vec2;           // cubicle centre
  desk: Vec2;             // centre of the desk surface (north half of cubicle)
  seat: Vec2;             // where the agent sits / stands working
  heading: number;        // facing direction when seated (0 = north)
  gate: Vec2;             // aisle point just outside the cubicle (south side)
  aisleZ: number;
}

export const DESKS: DeskSlot[] = [];
for (let row = 0; row < ROWS_Z.length; row++) {
  for (let col = 0; col < COLS_X.length; col++) {
    const cx = COLS_X[col], cz = ROWS_Z[row];
    DESKS.push({
      index: row * COLS_X.length + col,
      col, row,
      center: { x: cx, z: cz },
      desk: { x: cx, z: cz - 0.8 },
      seat: { x: cx, z: cz + 0.55 },
      heading: 0,
      gate: { x: cx, z: cz + 2 },
      aisleZ: cz + 2,
    });
  }
}

/** Named stations (standing spots + prop anchors). `stand` is where an agent stands, `face` the heading. */
export interface Station { id: string; prop: Vec2; stand: Vec2; heading: number }
export const STATIONS = {
  /** Shelves of paper stacks; workers pick up tickets here. Stand south of the shelf, face north. */
  depot:      { id: 'depot',      prop: { x: -7.5, z: -9.6 }, stand: { x: -7.5, z: -7.6 }, heading: 0 },
  /** Shared secrets vault (safe). Flavour prop + agents occasionally walk by when 'blocked' on a key. */
  vault:      { id: 'vault',      prop: { x: -12.2, z: -9.4 }, stand: { x: -12.2, z: -7.4 }, heading: 0 },
  /** Orchestrator's giant planning board on the north wall. */
  board:      { id: 'board',      prop: { x: 0, z: -10.7 }, stand: { x: 0, z: -9.0 }, heading: 0 },
  /** Orchestrator's seat (desk just south of the board). */
  orchSeat:   { id: 'orchSeat',   prop: { x: 0, z: -7.2 }, stand: { x: 0, z: -6.2 }, heading: 0 },
  /** Integrator desk (east). Faces west toward the inbox tray. */
  integSeat:  { id: 'integSeat',  prop: { x: 9.0, z: -7.0 }, stand: { x: 9.9, z: -7.0 }, heading: Math.PI / 2 },
  /** Where workers drop finished PR papers (inbox tray on the integrator desk edge). */
  inbox:      { id: 'inbox',      prop: { x: 8.6, z: -6.0 }, stand: { x: 7.6, z: -5.6 }, heading: -Math.PI / 2 },
  /** Out tray: rejected papers wait here for the worker to collect. */
  outTray:    { id: 'outTray',    prop: { x: 8.6, z: -8.0 }, stand: { x: 7.6, z: -8.2 }, heading: -Math.PI / 2 },
  /** Skill Library: tall bookshelves of colour-coded skill cartridges on the WEST wall. Agents fetch the skills a ticket needs. Stand east of the shelf, face west. */
  library:    { id: 'library',    prop: { x: -13.2, z: 0.5 }, stand: { x: -11.4, z: 0.5 }, heading: Math.PI / 2 },
  /** The 'main' branch server rack (glows on merge). */
  mainRack:   { id: 'mainRack',   prop: { x: 12.2, z: -9.6 }, stand: { x: 12.2, z: -7.6 }, heading: 0 },
  /** Shared deployment rack / "launch pad". */
  deployRack: { id: 'deployRack', prop: { x: 13.4, z: -6.0 }, stand: { x: 11.6, z: -6.0 }, heading: -Math.PI / 2 },
} as const satisfies Record<string, Station>;

export type StationId = keyof typeof STATIONS;

// ---------- waypoint graph + pathfinding ----------

interface Node { id: string; p: Vec2; edges: string[] }
const nodes = new Map<string, Node>();
const key = (x: number, z: number) => `${x},${z}`;
function addNode(p: Vec2, id = key(p.x, p.z)): Node {
  let n = nodes.get(id);
  if (!n) { n = { id, p, edges: [] }; nodes.set(id, n); }
  return n;
}
function link(a: Node, b: Node) {
  if (a === b) return;
  if (!a.edges.includes(b.id)) a.edges.push(b.id);
  if (!b.edges.includes(a.id)) b.edges.push(a.id);
}

// grid nodes at every (vertical aisle x, horizontal aisle z) intersection
for (const z of H_AISLES_Z) for (const x of V_AISLES_X) addNode({ x, z });
// outer ring connectors so the north corridor spans the whole room
for (const z of H_AISLES_Z) {
  for (let i = 0; i < V_AISLES_X.length - 1; i++) link(nodes.get(key(V_AISLES_X[i], z))!, nodes.get(key(V_AISLES_X[i + 1], z))!);
}
for (const x of V_AISLES_X) {
  for (let j = 0; j < H_AISLES_Z.length - 1; j++) link(nodes.get(key(x, H_AISLES_Z[j]))!, nodes.get(key(x, H_AISLES_Z[j + 1]))!);
}

// north-zone stand points connect to the north corridor (z = -3) via the nearest aisle x, through a staging row at z = -5.2
const northStage = new Map<number, Node>();
for (const x of V_AISLES_X) {
  const s = addNode({ x, z: -5.2 });
  northStage.set(x, s);
  link(s, nodes.get(key(x, -3))!);
}
for (let i = 0; i < V_AISLES_X.length - 1; i++) link(northStage.get(V_AISLES_X[i])!, northStage.get(V_AISLES_X[i + 1])!);

function nearestStage(x: number): Node {
  let best = northStage.get(V_AISLES_X[0])!;
  for (const [ax, n] of northStage) if (Math.abs(ax - x) < Math.abs(best.p.x - x)) best = n;
  return best;
}

// station nodes (standing spots) - connected to the nearest north staging node(s)
const stationNodes = new Map<string, Node>();
for (const s of Object.values(STATIONS) as Station[]) {
  const n = addNode({ x: s.stand.x, z: s.stand.z }, `st:${s.id}`);
  stationNodes.set(s.id, n);
  if (s.id === 'library') { link(n, nodes.get(key(-10, 2))!); link(n, nodes.get(key(-10, -3))!); continue; }
  link(n, nearestStage(s.stand.x));
  // second link to the stage node on the other side so paths don't cut through props
  const sorted = [...northStage.values()].sort((a, b) => Math.abs(a.p.x - s.stand.x) - Math.abs(b.p.x - s.stand.x));
  if (sorted[1]) link(n, sorted[1]);
}

// desk nodes: seat <-> gate <-> aisle node(s)
const deskNodes = new Map<number, Node>();
for (const d of DESKS) {
  const gate = addNode(d.gate, `gate:${d.index}`);
  const seat = addNode(d.seat, `seat:${d.index}`);
  link(seat, gate);
  // connect gate to the two nearest vertical-aisle nodes on its aisle row
  const row = V_AISLES_X.map((x) => nodes.get(key(x, d.aisleZ))!).sort((a, b) => Math.abs(a.p.x - d.gate.x) - Math.abs(b.p.x - d.gate.x));
  link(gate, row[0]); link(gate, row[1]);
  deskNodes.set(d.index, seat);
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

export type Place = { desk: number } | { station: StationId } | { point: Vec2 };

function nodeForPlace(p: Place): Node {
  if ('desk' in p) return deskNodes.get(p.desk)!;
  if ('station' in p) return stationNodes.get(p.station)!;
  // arbitrary point: attach to nearest existing node (not stored in graph)
  let best: Node | null = null;
  for (const n of nodes.values()) if (!best || dist(n.p, p.point) < dist(best.p, p.point)) best = n;
  return best!;
}

/** Dijkstra over the waypoint graph. Returns a polyline from `from` to `to` (inclusive). */
export function findPath(from: Place, to: Place): Vec2[] {
  const start = nodeForPlace(from), goal = nodeForPlace(to);
  const d = new Map<string, number>([[start.id, 0]]);
  const prev = new Map<string, string>();
  const open = new Set<string>([start.id]);
  while (open.size) {
    let cur: string | null = null;
    for (const id of open) if (cur === null || d.get(id)! < d.get(cur)!) cur = id;
    if (cur === null) break;
    open.delete(cur);
    if (cur === goal.id) break;
    const cn = nodes.get(cur)!;
    for (const eid of cn.edges) {
      const en = nodes.get(eid)!;
      const nd = d.get(cur)! + dist(cn.p, en.p);
      if (nd < (d.get(eid) ?? Infinity)) { d.set(eid, nd); prev.set(eid, cur); open.add(eid); }
    }
  }
  const out: Vec2[] = [];
  let c: string | undefined = goal.id;
  while (c) { out.unshift({ ...nodes.get(c)!.p }); c = prev.get(c); }
  return out.length ? out : [{ ...start.p }, { ...goal.p }];
}

export function pathLength(path: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < path.length; i++) l += dist(path[i - 1], path[i]);
  return l;
}

/** Position `distance` metres along a polyline + heading of the segment (heading convention: see types.ts). */
export function sampleAlong(path: Vec2[], distance: number): { pos: Vec2; heading: number } {
  if (path.length === 1) return { pos: { ...path[0] }, heading: 0 };
  let rem = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = dist(a, b);
    if (rem <= seg || i === path.length - 1) {
      const t = seg === 0 ? 1 : Math.min(1, rem / seg);
      return { pos: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, heading: headingOf(a, b) };
    }
    rem -= seg;
  }
  const last = path[path.length - 1];
  return { pos: { ...last }, heading: 0 };
}

/** Heading for moving from a to b. Front is -z at heading 0; heading = atan2(-dx, -dz). */
export function headingOf(a: Vec2, b: Vec2): number {
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}
