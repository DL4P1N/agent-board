/** Walking along findPath polylines + heading smoothing. */
import { DESKS, STATIONS, findPath, pathLength, sampleAlong, type Place } from '../layout';
import type { AgentState, Vec2 } from '../types';
import type { Rt } from './world';

export const WALK_MPS = 1.6;

export function placeHeading(p: Place): number | null {
  if ('desk' in p) return DESKS[p.desk].heading;
  if ('station' in p) return STATIONS[p.station].heading;
  return null;
}

/** Start walking from the agent's current position (never teleports: the path begins at `pos`). */
export function walkTo(rt: Rt, place: Place, next: string): void {
  const a = rt.a;
  const p = findPath({ point: a.pos }, place);
  const path: Vec2[] = [{ x: a.pos.x, z: a.pos.z }];
  for (const q of p) {
    const l = path[path.length - 1];
    if (Math.hypot(q.x - l.x, q.z - l.z) > 1e-6) path.push({ x: q.x, z: q.z });
  }
  rt.path = path; rt.plen = pathLength(path); rt.pd = 0; rt.walking = true; rt.next = next;
  const hh = placeHeading(place);
  rt.endHeading = hh ?? a.heading;
  rt.atDesk = false;
  a.pose = a.carrying ? 'carry_walk' : 'walk';
  a.phaseProgress = 0;
}

/** Advance along the current path. Returns true on the tick the destination is reached. */
export function advanceWalk(rt: Rt, speed: number, h: number): boolean {
  const a = rt.a;
  const before = rt.pd;
  rt.pd = Math.min(rt.plen, rt.pd + speed * h);
  a.stats.walkedMeters += rt.pd - before;
  if (rt.pd >= rt.plen) {
    const last = rt.path[rt.path.length - 1];
    a.pos.x = last.x; a.pos.z = last.z;
    rt.walking = false; rt.th = rt.endHeading; a.phaseProgress = 1;
    return true;
  }
  const s = sampleAlong(rt.path, rt.pd);
  a.pos.x = s.pos.x; a.pos.z = s.pos.z;
  rt.th = s.heading;
  a.phaseProgress = rt.plen > 0 ? rt.pd / rt.plen : 1;
  return false;
}

const TWO_PI = Math.PI * 2;
export function wrapAngle(x: number): number {
  x = x % TWO_PI;
  if (x > Math.PI) x -= TWO_PI; else if (x < -Math.PI) x += TWO_PI;
  return x;
}
export function turnHeading(a: AgentState, target: number, h: number): void {
  const d = wrapAngle(target - a.heading);
  const maxStep = 12 * h;
  a.heading = wrapAngle(a.heading + Math.max(-maxStep, Math.min(maxStep, d)));
}
