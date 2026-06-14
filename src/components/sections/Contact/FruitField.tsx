"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import {
  Box3,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Object3D,
} from "three";
import {
  DRACO_DECODER_PATH,
  FRUIT_NAMES,
  HDRI_PATH,
  MODEL_PATH,
} from "@/components/BrainModel/constants";

/**
 * Zero-gravity fruit field for the final CTA — the fruits that flew off the
 * brain during Section 2's exodus, found again, floating free behind the
 * closing question.
 *
 * Reuse, not duplication: this loads the SAME GLB + HDRI as the global brain
 * (drei caches both by URL → zero extra download), extracts only the 36 fruit
 * nodes, and renders them in an isolated <Canvas> owned by this section — the
 * BrainStage and its travel choreography are never touched. Mesh "clones"
 * share the GLB geometries and materials (one clearcoat-promoted copy per
 * unique source material).
 *
 * THE MEDIUM IS THICK. Three interaction layers, all hand-calibrated so none
 * of them ever reads as an explosion:
 *   1. Viscous fluid — velocities relax quickly back to a slow cruise drift,
 *      so every disturbance starts with effort and settles with weight.
 *   2. The hand — force comes from the POINTER'S VELOCITY (entrainment: near
 *      fruits adopt a fraction of the hand's motion, like stirring water),
 *      plus a small rigid sphere around the cursor that fruits cannot
 *      overlap (positional push — you can part them and plow gently).
 *      A still pointer does nothing.
 *   3. Click/tap — a pressure RING expands from the point and thumps fruits
 *      as the front passes (same interaction vocabulary as the brain's click
 *      ripple in the Hero), velocity-capped so nothing flies off.
 *
 * Containment is depth-aware: the visible frustum is narrower near the
 * camera, so each fruit's bounds follow its own depth — escapees are pulled
 * back by a firm spring AND have their cruise drift flipped inward, so the
 * stage never empties. Tumble is capped and decays to a calm idle rate.
 *
 * The pointer arrives via a ref written by the section (the canvas itself is
 * pointer-events: none, so it can never swallow clicks). `active` gates the
 * frameloop by IntersectionObserver; prefers-reduced-motion renders a still
 * scatter.
 */

export interface FieldPointer {
  /** Stage-normalized pointer, -1..1 (x right, y up). */
  nx: number;
  ny: number;
  /** performance.now() of the last move. */
  at: number;
  /** Click/tap snapshot: origin (stage-normalized) + timestamp. */
  cx: number;
  cy: number;
  clickAt: number;
}

interface FieldProps {
  active: boolean;
  reduce: boolean;
  pointer: { current: FieldPointer };
}

const CAM_Z = 6;
const FOV_TAN = Math.tan((45 / 2) * (Math.PI / 180)); // camera fov 45

/* The thick medium. WEIGHT comes from the ACCELERATION CAP, not from force
   size: the hand has real influence, but a fruit needs ~half a second of
   sustained presence to get moving, then glides and settles — nothing ever
   darts. (v2 lerped fruit velocity toward the raw hand velocity, which in
   world units is huge even for a calm mouse — that was the ugly snap.) */
const POINTER_FRESH_MS = 2400;
const DRAG = 1.5; // 1/s — relax toward cruise (lower = longer, smoother glide)
const MAX_SPEED = 0.62; // hard ceiling on any fruit's speed

/* The hand: proximity force (the v1 feel) + inertia. v3 was too timid — the
   force/cap pair is ~3× stronger so hover visibly answers within the first
   half-second, while the accel cap still forbids darting. */
const HAND_R = 1.8; // influence radius (world units)
const HAND_FORCE = 1.7; // u/s² at the very center — builds motion gradually
const HAND_ACCEL_CAP = 1.6; // max |Δv|/s the hand can impose (the inertia)
const HAND_RAMP = 2.5; // 1/s — influence fades in when the pointer (re)appears
const DRIFT_BIAS = 0.25; // fraction of the push steered toward the hand's motion
const HAND_DEPTH = 2.4; // |z| beyond which the hand stops touching fruit

/* Fruit–fruit separation: fruits never weld together — overlap creates a soft
   mutual push plus a gradual positional relief (no snapping). */
const SEP_PAD = 1.12; // breathing room: fruits want ~12% gap between radii
const SEP_FORCE = 1.5;

/* The copy's island: an elliptical keep-out behind the headline/button. Near
   fruits are gently expelled (they frame the message instead of crossing it);
   deep, fog-dimmed ones may still drift behind it for atmosphere. */
const EXCL_FORCE = 1.0;
const EXCL_DEPTH = 2.2; // strength fades to zero by this |z|
const EXCL_AX = 0.36; // semi-axis, fraction of viewport width (at z = 0)
const EXCL_BY = 0.4; // semi-axis, fraction of viewport height (at z = 0)

/* The click pressure ring — a real thump (the viscous medium swallows small
   impulses, so the front must hit clearly; MAX_SPEED still bounds it). */
const WAVE_SPEED = 2.6; // world units/s — slow enough to read as a wave
const WAVE_WIDTH = 0.9;
const WAVE_IMPULSE = 11; // dt-scaled at the front
const WAVE_LIFE_S = 1.6;

/* Tumble. */
const SPIN_CAP = 1.5; // rad/s per axis
const SPIN_DECAY = 1.1; // 1/s back toward the idle floor

type GLTFNodes = { [key: string]: Object3D };

interface MeshDesc {
  geometry: BufferGeometry;
  material: Material | Material[];
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

interface FruitType {
  name: string;
  worldQuaternion: [number, number, number, number];
  worldScale: [number, number, number];
  /** Node-local bbox center — meshes are offset by −center so the fruit
   *  rotates around its own middle. */
  center: [number, number, number];
  /** World-space max dimension (GLB units) — drives relative sizing. */
  sizeW: number;
  meshes: MeshDesc[];
}

interface FruitSim {
  type: number;
  scale: number;
  /** Visual radius in world units (for the solid-sphere contact). */
  r: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Cruise drift the velocity relaxes back to (flipped inward on escape). */
  bx: number; by: number; bz: number;
  /** Tumble rates (rad/s) and the spin-kick jitter axis. */
  wx: number; wy: number; wz: number;
  kx: number; ky: number; kz: number;
}

/** Seeded RNG keeps the field identical across re-mounts within a session. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Promote a GLB material to the "juicy" clearcoat look (one copy per unique
 *  source material, shared by every fruit instance that uses it). */
function makeJuicy(cache: Map<Material, Material>, src: Material): Material {
  const hit = cache.get(src);
  if (hit) return hit;
  let out: Material = src;
  if (src instanceof MeshPhysicalMaterial) {
    const c = src.clone();
    c.clearcoat = 0.22;
    c.clearcoatRoughness = 0.32;
    out = c;
  } else if (src instanceof MeshStandardMaterial) {
    const p = new MeshPhysicalMaterial();
    p.color.copy(src.color);
    p.roughness = src.roughness;
    p.metalness = src.metalness;
    if (src.map) p.map = src.map;
    if (src.normalMap) {
      p.normalMap = src.normalMap;
      if (src.normalScale) p.normalScale.copy(src.normalScale);
    }
    p.emissive.copy(src.emissive);
    p.emissiveIntensity = src.emissiveIntensity;
    p.envMapIntensity = src.envMapIntensity;
    p.side = src.side;
    p.clearcoat = 0.22;
    p.clearcoatRoughness = 0.32;
    out = p;
  }
  cache.set(src, out);
  return out;
}

function Field({ reduce, pointer }: Omit<FieldProps, "active">) {
  const gltf = useGLTF(MODEL_PATH, DRACO_DECODER_PATH) as unknown as {
    nodes: GLTFNodes;
    scene: Object3D;
  };
  const { nodes, scene } = gltf;
  const viewport = useThree((s) => s.viewport);

  // ---- extract the 36 fruit types from the (cached) GLB -------------------
  const types = useMemo<FruitType[]>(() => {
    scene.updateWorldMatrix(true, true);
    const matCache = new Map<Material, Material>();
    const out: FruitType[] = [];

    for (const name of FRUIT_NAMES) {
      const node = nodes[name];
      if (!node) continue;

      const wPos = new Vector3();
      const wQuat = new Quaternion();
      const wScale = new Vector3();
      node.matrixWorld.decompose(wPos, wQuat, wScale);

      const box = new Box3().setFromObject(node);
      const size = new Vector3();
      box.getSize(size);
      const centerW = new Vector3();
      box.getCenter(centerW);
      // Bbox center in node-local space → recenter offset for self-rotation.
      const centerL = centerW.clone().applyMatrix4(
        new Matrix4().copy(node.matrixWorld).invert(),
      );

      const inv = new Matrix4().copy(node.matrixWorld).invert();
      const meshes: MeshDesc[] = [];
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const rel = new Matrix4().multiplyMatrices(inv, child.matrixWorld);
        const p = new Vector3();
        const q = new Quaternion();
        const s = new Vector3();
        rel.decompose(p, q, s);
        const material = Array.isArray(child.material)
          ? child.material.map((m: Material) => makeJuicy(matCache, m))
          : makeJuicy(matCache, child.material);
        meshes.push({
          geometry: child.geometry,
          material,
          position: [p.x, p.y, p.z],
          quaternion: [q.x, q.y, q.z, q.w],
          scale: [s.x, s.y, s.z],
        });
      });

      out.push({
        name,
        worldQuaternion: [wQuat.x, wQuat.y, wQuat.z, wQuat.w],
        worldScale: [wScale.x, wScale.y, wScale.z],
        center: [centerL.x, centerL.y, centerL.z],
        sizeW: Math.max(size.x, size.y, size.z) || 1,
        meshes,
      });
    }
    return out;
  }, [nodes, scene]);

  // ---- spawn the field ------------------------------------------------------
  const sims = useMemo<FruitSim[]>(() => {
    if (types.length === 0) return [];
    const rng = makeRng(20260610);
    const maxSize = Math.max(...types.map((t) => t.sizeW));
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 760;

    const vw = viewport.width;
    const vh = viewport.height;

    // Every fruit appears once; mobile thins the two crowded small kinds.
    const picks: number[] = [];
    types.forEach((_, ti) => {
      if (isMobile && ti % 3 === 1) return;
      picks.push(ti);
    });
    const n = picks.length;

    const all: FruitSim[] = picks.map((ti, j) => {
      const t = types[ti];

      // Relative sizing: keep the GLB's natural proportions, normalized so the
      // biggest fruit ≈ 0.8 world units, and the tiniest still readable.
      const base = (0.8 / maxSize) * t.sizeW;
      const visual = Math.max(0.2, base) * (0.85 + rng() * 0.4);
      const scale = visual / t.sizeW;

      // STRATIFIED RING SPAWN: angles are evenly distributed (with jitter) and
      // each fruit lands between the copy's elliptical island and the screen
      // edge AT ITS OWN DEPTH — full occupancy, no birth clumps, headline
      // clear. Deep (fog-dimmed) fruits may sit inside the island for
      // atmosphere.
      const z = -2.7 + rng() * 3.4;
      const dist = CAM_Z - z;
      const halfH = FOV_TAN * dist * 0.9;
      const halfW = halfH * (vw / vh);
      const kz = dist / CAM_Z;
      const ea = vw * EXCL_AX * kz;
      const eb = vh * EXCL_BY * kz;

      const ang = ((j + 0.5) / n) * Math.PI * 2 + (rng() - 0.5) * 0.55;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rEll = 1 / Math.sqrt((ca / ea) ** 2 + (sa / eb) ** 2);
      const rMax = Math.min(
        Math.abs(ca) > 1e-4 ? (halfW - visual / 2) / Math.abs(ca) : 1e9,
        Math.abs(sa) > 1e-4 ? (halfH - visual / 2) / Math.abs(sa) : 1e9,
      );
      const deepPass = z < -1.6;
      const rMin = deepPass ? rEll * (0.2 + rng() * 0.5) : rEll * 1.02;
      const rad = Math.min(rMax, rMin + Math.max(0, rMax - rMin) * rng() ** 0.8);
      const x = ca * rad;
      const y = sa * rad;

      const dAng = rng() * Math.PI * 2;
      const speed = 0.03 + rng() * 0.05; // slow cruise — the medium is thick
      const kLen = Math.hypot(rng() - 0.5, rng() - 0.5, rng() - 0.5) || 1;

      return {
        type: ti,
        scale,
        r: visual / 2,
        x, y, z,
        vx: Math.cos(dAng) * speed,
        vy: Math.sin(dAng) * speed,
        vz: (rng() - 0.5) * 0.04,
        bx: Math.cos(dAng) * speed,
        by: Math.sin(dAng) * speed,
        bz: (rng() - 0.5) * 0.04,
        wx: (rng() - 0.5) * 0.5,
        wy: (rng() - 0.5) * 0.5,
        wz: (rng() - 0.5) * 0.5,
        kx: (rng() - 0.5) / kLen,
        ky: (rng() - 0.5) / kLen,
        kz: (rng() - 0.5) / kLen,
      };
    });
    return all;
    // viewport identity changes on resize — respawn keeps bounds coherent.
  }, [types, viewport.width, viewport.height]);

  const groupRefs = useRef<(Group | null)[]>([]);
  /** Hand state: smoothed velocity (only its DIRECTION is used, for the sweep
   *  bias) and a presence ramp so influence fades in/out instead of popping. */
  const hand = useRef({ px: 0, py: 0, vx: 0, vy: 0, t: -1, ramp: 0 });

  useFrame((_state, dt0) => {
    if (reduce) return;
    const dt = Math.min(dt0, 1 / 30);
    if (dt <= 0) return;
    const now = performance.now();
    const p = pointer.current;

    const vw = viewport.width;
    const vh = viewport.height;
    const px = (p.nx * vw) / 2;
    const py = (p.ny * vh) / 2;
    const fresh = now - p.at < POINTER_FRESH_MS;

    // ---- hand state (presence ramp + direction of travel) -------------------
    const h = hand.current;
    if (fresh) {
      if (h.t < 0) {
        h.px = px;
        h.py = py;
      }
      const hvx = (px - h.px) / dt;
      const hvy = (py - h.py) / dt;
      h.vx += (hvx - h.vx) * Math.min(1, 10 * dt);
      h.vy += (hvy - h.vy) * Math.min(1, 10 * dt);
      h.px = px;
      h.py = py;
      h.t = now;
      h.ramp = Math.min(1, h.ramp + HAND_RAMP * dt);
    } else {
      h.ramp = Math.max(0, h.ramp - HAND_RAMP * dt);
      h.vx = 0;
      h.vy = 0;
      h.t = -1;
    }

    // ---- click pressure ring ------------------------------------------------
    const waveAge = (now - p.clickAt) / 1000;
    const waveOn = waveAge >= 0 && waveAge < WAVE_LIFE_S;
    const waveR = waveAge * WAVE_SPEED;
    const wx0 = (p.cx * vw) / 2;
    const wy0 = (p.cy * vh) / 2;

    // ---- fruit–fruit separation: nothing ever welds together ---------------
    // Overlap creates a soft mutual push; deeply interlocked pairs also get a
    // gradual positional relief (time-eased — no snapping).
    for (let i = 0; i < sims.length; i++) {
      const A = sims[i];
      for (let j = i + 1; j < sims.length; j++) {
        const B = sims[j];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dz = B.z - A.z;
        const minD = (A.r + B.r) * SEP_PAD;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= minD * minD || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const overlap = minD - d;
        const f = (overlap / minD) * SEP_FORCE * dt;
        A.vx -= nx * f; A.vy -= ny * f; A.vz -= nz * f;
        B.vx += nx * f; B.vy += ny * f; B.vz += nz * f;
        if (d < minD * 0.7) {
          const ease = Math.min(1, 2 * dt) * overlap * 0.5;
          A.x -= nx * ease; A.y -= ny * ease; A.z -= nz * ease;
          B.x += nx * ease; B.y += ny * ease; B.z += nz * ease;
        }
      }
    }

    for (let i = 0; i < sims.length; i++) {
      const s = sims[i];
      const g = groupRefs.current[i];
      if (!g) continue;

      const depthFade = Math.max(0, 1 - Math.abs(s.z) / HAND_DEPTH);

      // ---- the hand: proximity push with INERTIA ---------------------------
      // Force is radial (the v1 feel the user preferred), gently biased toward
      // the hand's direction of travel so sweeps read as flow — but the hand's
      // SPEED is never transferred, and the acceleration cap means a fruit
      // needs sustained presence to get moving. Heavy, organic, no darting.
      if (h.ramp > 0.001 && depthFade > 0) {
        const dx = s.x - px;
        const dy = s.y - py;
        const d = Math.hypot(dx, dy) || 1e-4;
        if (d < HAND_R) {
          const w = (1 - d / HAND_R) ** 1.5 * depthFade * h.ramp;

          let ux = dx / d;
          let uy = dy / d;
          const hsp = Math.hypot(h.vx, h.vy);
          if (hsp > 0.05) {
            ux += (h.vx / hsp) * DRIFT_BIAS;
            uy += (h.vy / hsp) * DRIFT_BIAS;
            const ul = Math.hypot(ux, uy) || 1;
            ux /= ul;
            uy /= ul;
          }

          let ax = ux * HAND_FORCE * w;
          let ay = uy * HAND_FORCE * w;
          const am = Math.hypot(ax, ay);
          if (am > HAND_ACCEL_CAP) {
            ax *= HAND_ACCEL_CAP / am;
            ay *= HAND_ACCEL_CAP / am;
          }
          s.vx += ax * dt;
          s.vy += ay * dt;

          // The stir follows the same eased force.
          const stir = am * dt * 1.6;
          s.wx += s.kx * stir;
          s.wy += s.ky * stir;
          s.wz += s.kz * stir;
        }
      }

      // ---- the click ring ----------------------------------------------------
      if (waveOn && depthFade > 0) {
        const dx = s.x - wx0;
        const dy = s.y - wy0;
        const d = Math.hypot(dx, dy) || 1e-4;
        const off = Math.abs(d - waveR);
        if (off < WAVE_WIDTH / 2) {
          const band = Math.cos((off / (WAVE_WIDTH / 2)) * (Math.PI / 2)) ** 2;
          const atten = 1 / (1 + waveR * 0.55);
          const f = WAVE_IMPULSE * band * atten * depthFade * dt;
          s.vx += (dx / d) * f;
          s.vy += (dy / d) * f;
          s.vz += Math.sin(i * 12.9898) * 0.2 * f;
          s.wx += s.kx * f * 1.4;
          s.wy += s.ky * f * 1.4;
          s.wz += s.kz * f * 1.4;
        }
      }

      // ---- the copy's island: gently expelled from the center ellipse -------
      const deepFade = Math.max(0, 1 - Math.abs(s.z) / EXCL_DEPTH);
      if (deepFade > 0) {
        const kz = (CAM_Z - s.z) / CAM_Z;
        const ea = vw * EXCL_AX * kz;
        const eb = vh * EXCL_BY * kz;
        const ex = s.x / ea;
        const ey = s.y / eb;
        const e2 = ex * ex + ey * ey;
        if (e2 < 1) {
          let gx = ex / ea;
          let gy = ey / eb;
          const gl = Math.hypot(gx, gy);
          if (gl < 1e-4) {
            // Dead center: pick a stable per-fruit escape direction.
            gx = Math.cos(i * 2.4);
            gy = Math.sin(i * 2.4);
          } else {
            gx /= gl;
            gy /= gl;
          }
          const g = (1 - e2) * EXCL_FORCE * deepFade;
          s.vx += gx * g * dt;
          s.vy += gy * g * dt;
        }
      }

      // ---- thick medium: relax to cruise + hard speed cap --------------------
      const relax = Math.min(1, DRAG * dt);
      s.vx += (s.bx - s.vx) * relax;
      s.vy += (s.by - s.vy) * relax;
      s.vz += (s.bz - s.vz) * relax;

      const sp = Math.hypot(s.vx, s.vy, s.vz);
      if (sp > MAX_SPEED) {
        const k = MAX_SPEED / sp;
        s.vx *= k;
        s.vy *= k;
        s.vz *= k;
      }

      // ---- tumble: cap, decay to idle floor ----------------------------------
      const wDecay = 1 - Math.min(1, SPIN_DECAY * dt);
      s.wx = Math.max(-SPIN_CAP, Math.min(SPIN_CAP, s.wx * wDecay));
      s.wy = Math.max(-SPIN_CAP, Math.min(SPIN_CAP, s.wy * wDecay));
      s.wz = Math.max(-SPIN_CAP, Math.min(SPIN_CAP, s.wz * wDecay));
      if (Math.abs(s.wx) < 0.1) s.wx = s.wx < 0 ? -0.1 : 0.1;
      if (Math.abs(s.wy) < 0.09) s.wy = s.wy < 0 ? -0.09 : 0.09;
      if (Math.abs(s.wz) < 0.07) s.wz = s.wz < 0 ? -0.07 : 0.07;

      // ---- integrate -----------------------------------------------------------
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      // ---- depth-aware containment ---------------------------------------------
      // The visible frustum is narrower near the camera: bound each fruit by
      // the half-extents AT ITS OWN DEPTH, so nothing parks off-screen and the
      // far plane doesn't bunch toward the middle.
      const dist = CAM_Z - s.z;
      const halfH = FOV_TAN * dist * 0.92;
      const halfW = halfH * (vw / vh);
      const bx = Math.max(0.4, halfW - s.r);
      const by = Math.max(0.4, halfH - s.r);

      if (s.x > bx) {
        s.vx -= (s.x - bx) * 6 * dt;
        s.bx = -Math.abs(s.bx); // cruise turns back inward
      } else if (s.x < -bx) {
        s.vx -= (s.x + bx) * 6 * dt;
        s.bx = Math.abs(s.bx);
      }
      if (s.y > by) {
        s.vy -= (s.y - by) * 6 * dt;
        s.by = -Math.abs(s.by);
      } else if (s.y < -by) {
        s.vy -= (s.y + by) * 6 * dt;
        s.by = Math.abs(s.by);
      }
      if (s.z > 0.7) {
        s.vz -= (s.z - 0.7) * 6 * dt;
        s.bz = -Math.abs(s.bz);
      } else if (s.z < -2.8) {
        s.vz -= (s.z + 2.8) * 6 * dt;
        s.bz = Math.abs(s.bz);
      }

      g.position.set(s.x, s.y, s.z);
      g.rotation.x += s.wx * dt;
      g.rotation.y += s.wy * dt;
      g.rotation.z += s.wz * dt;
    }
  });

  return (
    <>
      {sims.map((s, i) => {
        const t = types[s.type];
        return (
          <group
            key={i}
            ref={(el) => {
              groupRefs.current[i] = el;
            }}
            position={[s.x, s.y, s.z]}
            scale={s.scale}
          >
            <group quaternion={t.worldQuaternion} scale={t.worldScale}>
              <group position={[-t.center[0], -t.center[1], -t.center[2]]}>
                {t.meshes.map((m, mi) => (
                  <mesh
                    key={mi}
                    geometry={m.geometry}
                    material={m.material}
                    position={m.position}
                    quaternion={m.quaternion}
                    scale={m.scale}
                  />
                ))}
              </group>
            </group>
          </group>
        );
      })}
    </>
  );
}

export default function FruitField({ active, reduce, pointer }: FieldProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, CAM_Z], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      {/* Deep fruits dissolve into the section's green — depth for free. */}
      <fog attach="fog" args={["#06381a", 6.4, 11.5]} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[-3, 4, 4]} intensity={1.15} color="#ffe9c0" />
      <directionalLight position={[3, -1.5, 2]} intensity={0.25} color="#ffffff" />
      <Suspense fallback={null}>
        <Environment files={HDRI_PATH} />
        <Field reduce={reduce} pointer={pointer} />
      </Suspense>
    </Canvas>
  );
}
