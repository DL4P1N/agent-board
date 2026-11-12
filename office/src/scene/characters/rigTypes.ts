/**
 * Contract between the office scene (scene/) and the voxel character module (scene/characters/).
 * The scene owns position + heading of rig.object (sim is authoritative); the rig owns everything below
 * the pivot: limb animation, papers, hat, subagent drones, status glow.
 * The rig's local origin is at the FEET centre, front faces -z (so object.rotation.y = heading works).
 * Seated poses ('type','think','wait' when seated) must look right when the pivot sits at the SEAT point
 * (rig lowers itself ~0.35 units / bends legs; the scene provides a chair at the seat).
 */
import type * as THREE from 'three';
import type { Pose, Provider, Role } from '../../types';

export interface RigOptions {
  provider: Provider;        // claude = warm terracotta accent, codex = teal/mint accent
  role: Role;                // orchestrator gets a headset + clipboard, integrator a visor + stamp
  seed: number;              // deterministic skin/hair/outfit variation
  ownerColor?: string;       // hex of the human owner: worn as cap band + lanyard so owners are recognisable
  name: string;
}

export interface RigFrame {
  pose: Pose;
  /** Seated (pivot at chair) vs standing. Only matters for type/think/wait/blocked/sleep. */
  seated: boolean;
  carrying: null | { kind: 'tickets' | 'pr' | 'rejected' | 'skills'; count: number };
  /** Equipped skill colours (hex strings from skills.ts) -> small cartridges slotted on the back/belt, glowing; <= 4. 'skills' carrying = a stack of coloured books/cartridges (use these colours). */
  skillColors: string[];
  /** model tier label ('haiku'|'sonnet'|'opus'|'fable'|'mini'|'standard'|'max'...) -> shown as hat/antenna height + glow */
  tier: string;
  /** Live subagent count 0..8 -> little hovering drone cubes orbiting the character. */
  subagents: number;
  /** 0..1 context fill -> small gauge on the back / over head ring. */
  contextFill: number;
  /** speed multiplier for animation clocks (sim speed * walk/work speed). */
  speed: number;
  /** current hex of the carried paper stack tint is derived from kind. */
  selected: boolean;
}

export interface AgentRig {
  object: THREE.Group;
  /** Advance animation by dt real seconds. Must be cheap (called for up to 14 rigs per frame). */
  update(dt: number, frame: RigFrame): void;
  /** One-shot effects. */
  flashCompaction(): void;
  /** Approx height for placing name tags / bubbles (world units above pivot). */
  headHeight: number;
  dispose(): void;
}

export type CreateAgentRig = (opts: RigOptions) => AgentRig;
