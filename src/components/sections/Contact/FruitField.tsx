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
 * THE RING owns the field: fruits live in a soft annulus framing the copy,
 * drifting slowly around it. A depth-aware radial spring keeps them there —
 * firmly expelling anything that wanders into the central keep-out, gently
 * reeling escapees home from the edge over a couple of seconds (capped accel,
 * never a snap), and never letting one settle in the middle. The band feathers
 * OUTWARD (toward the screen edge), so the ring reads as a soft scatter, not a
 * drawn circle. A short-range tangential repulsion gives every fruit angular
 * personal space, so an arc the hand empties refills itself — the ring re-evens
 * instead of going bald where the cursor lingered. Tumble is capped and decays
 * to a calm idle rate.
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
   size: the hand has real influence, but a fruit still needs sustained
   presence to get moving, then glides and settles — nothing ever darts. */
const POINTER_FRESH_MS = 2400;
const DRAG = 1.35; // 1/s — relax toward cruise (lower = longer, smoother glide)
const MAX_SPEED = 1.0; // hard ceiling on any fruit's speed

/* The hand: proximity force (the v1 feel) + inertia. v6 — really grabby now: a
   wide reach with a LINEAR falloff (so even a cursor crossing the open middle
   still tugs the near side of the ring), a strong force/cap pair so fruit answer
   within a few frames, and a big steer toward the hand's travel so a sweep drags
   a fluid wake along with it. The accel cap still forbids an instant snap. */
const HAND_R = 2.8; // influence radius (world units) — reaches across the gap
const HAND_FORCE = 5.0; // u/s² at the very center — builds motion fast
const HAND_ACCEL_CAP = 4.5; // max |Δv|/s the hand can impose (the inertia)
const HAND_RAMP = 4.5; // 1/s — influence fades in when the pointer (re)appears
const DRIFT_BIAS = 0.7; // fraction of the push steered toward the hand's motion
const HAND_DEPTH = 2.4; // |z| beyond which the hand stops touching fruit

/* Fruit–fruit separation: fruits never weld together — overlap creates a soft
   mutual push plus a gradual positional relief (no snapping). */
const SEP_PAD = 1.12; // breathing room: fruits want ~12% gap between radii
const SEP_FORCE = 1.5;

/* RING SPREAD: fruits also repel each other ALONG the loop (tangentially), so
   after the hand blows a hole in one arc the neighbours drift in to refill it —
   the ring re-evens itself instead of leaving the hovered spot bare. Gentle and
   short-range (a soft "personal space" in angle), it relaxes toward even
   spacing over a couple of seconds — never a snapping lattice. */
const SPREAD_FORCE = 0.16; // tangential push — gentle: refills big gaps without
//                            ironing the ring into an even, "drawn" outline
const SPREAD_RANGE = 0.7; // rad — angular reach of the repulsion (~40°)

/* THE RING — the field's gravity. Fruits live in a soft annulus between TWO
   CONCENTRIC ELLIPSES: the inner keep-out (the copy's island) and an outer
   ellipse. BOTH are ellipses on purpose — the outer edge must NOT track the
   rectangular screen box, or fruit pile into the corners and the "ring" turns
   into a square. A radial spring with a wide dead-band owns motion: the inner
   ellipse firmly EXPELS anything that drifts toward the copy, the outer ellipse
   GENTLY reels escapees back over a couple of seconds (capped accel = a soft
   magnet, never a snap). The band is wide, so fruit scatter across it at varied
   radii — a soft oval cloud, felt rather than a hard-drawn circle. */
const EXCL_AX = 0.32; // inner keep-out semi-axis, fraction of viewport width
const EXCL_BY = 0.22; // inner keep-out semi-axis, fraction of viewport height — the
//                       copy is SHORT, so this is small: a tight guard around the
//                       text, which opens a wide band (fruit weren't dispersed, the
//                       keep-out was just bloated up against the outer ellipse).
const RING_AX = 0.47; // OUTER ellipse semi-axis, fraction of width (< ~0.48 = on-screen)
const RING_BY = 0.46; // OUTER ellipse semi-axis, fraction of height
const RING_LO = 0.04; // band inner edge — fruit may sit close to the guard (a bit "in")
const RING_HI = 1.0; // band outer edge — full span; the gentle outer spring still
//                      lets a few stragglers drift a touch beyond (dispersed OUT)
const RING_IN_K = 3.4; // 1/s² — central expulsion stiffness (firm; guards the copy)
const RING_IN_CAP = 2.6; // max outward accel — firm but not violent
const RING_OUT_K = 1.4; // 1/s² — homeward pull stiffness (gentle)
const RING_OUT_CAP = 0.55; // max inward accel — the soft, slow magnet home

/* The click pressure ring — a real thump (the viscous medium swallows small
   impulses, so the front must hit clearly; MAX_SPEED still bounds it). */
const WAVE_SPEED = 2.6; // world units/s — slow enough to read as a wave, not a snap
const WAVE_WIDTH = 0.9;
const WAVE_IMPULSE = 11; // dt-scaled at the front — a soft thump that reads cleanly
const WAVE_LIFE_S = 1.6;
const CLICK_CAP = 0.62; // a click never flings a fruit faster than the ORIGINAL
//                         field ceiling, so the ripple stays as soft as it was
//                         before the hand got its bigger MAX_SPEED above.

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
  /** Cruise the velocity relaxes back to. bx/by are recomputed every frame as
   *  the tangential drift AROUND the ring; bz is a slow idle z-bob. */
  bx: number; by: number; bz: number;
  /** Signed tangential speed — this fruit's share of the slow ring orbit. */
  orbit: number;
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

    // The cast: every fruit once, then a few EXTRA copies of the scarce, very
    // distinct kinds (kiwi, orange) so each arc of the ring is varied instead
    // of a long run of one fruit. Then SHUFFLE so no kind clusters into a
    // corner — the old in-order layout pooled all blueberries top-left and all
    // strawberries bottom-right. Mobile stays lighter: thinned, no extras.
    const picks: number[] = [];
    types.forEach((_, ti) => {
      if (isMobile && ti % 3 === 1) return;
      picks.push(ti);
    });
    if (!isMobile) {
      types.forEach((t, ti) => {
        if (t.name.startsWith("kiwi") || t.name.startsWith("laranja")) {
          picks.push(ti, ti); // two more of each scarce, vivid fruit
        }
      });
    }
    // Fisher–Yates with the seeded RNG → the mix is identical every mount.
    for (let i = picks.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      const tmp = picks[i];
      picks[i] = picks[k];
      picks[k] = tmp;
    }
    const n = picks.length;

    const all: FruitSim[] = picks.map((ti, j) => {
      const t = types[ti];

      // Relative sizing: keep the GLB's natural proportions, normalized so the
      // biggest fruit ≈ 0.8 world units, and the tiniest still readable.
      const base = (0.8 / maxSize) * t.sizeW;
      const visual = Math.max(0.2, base) * (0.85 + rng() * 0.4);
      const scale = visual / t.sizeW;

      // STRATIFIED RING SPAWN: angles are evenly distributed (with jitter) and
      // each fruit is born in the elliptical band between the inner keep-out and
      // the OUTER ELLIPSE (never the screen rectangle — that's what squared the
      // ring). Full occupancy, no birth clumps, headline clear, nothing inside.
      const z = -2.7 + rng() * 3.4;
      const dist = CAM_Z - z;
      const kz = dist / CAM_Z;
      const eaIn = vw * EXCL_AX * kz;
      const ebIn = vh * EXCL_BY * kz;
      const eaOut = vw * RING_AX * kz;
      const ebOut = vh * RING_BY * kz;

      const ang = ((j + 0.5) / n) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rIn = 1 / Math.sqrt((ca / eaIn) ** 2 + (sa / ebIn) ** 2);
      const rOut = 1 / Math.sqrt((ca / eaOut) ** 2 + (sa / ebOut) ** 2);
      // Scatter UNIFORMLY across the whole (now wide) band so radii vary widely
      // — some near the guard, some near the edge, most in between: a dispersed
      // cloud you can't trace a circle through. The guard keeps it off the copy.
      const frac = RING_LO + (RING_HI - RING_LO) * rng();
      const rad = rIn + (rOut - rIn) * frac;
      const x = ca * rad;
      const y = sa * rad;

      // slow tangential drift around the ring (signed per fruit, ±)
      const orbit = (0.035 + rng() * 0.045) * (rng() < 0.5 ? -1 : 1);
      const kLen = Math.hypot(rng() - 0.5, rng() - 0.5, rng() - 0.5) || 1;

      return {
        type: ti,
        scale,
        r: visual / 2,
        x, y, z,
        vx: -sa * orbit,
        vy: ca * orbit,
        vz: (rng() - 0.5) * 0.03,
        bx: -sa * orbit,
        by: ca * orbit,
        bz: (rng() - 0.5) * 0.03,
        orbit,
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

    // ---- ring spread: fruits keep angular "personal space" so a hovered-out
    // arc refills itself. A short-range tangential repulsion in PROJECTED ring
    // angle: near-in-angle pairs push apart along the loop, balanced pairs
    // cancel, so only the imbalance beside a gap produces net drift — the ring
    // relaxes back to even spacing instead of leaving the bare spot bare.
    const ringAng = sims.map((s) => Math.atan2(s.y, s.x));
    for (let i = 0; i < sims.length; i++) {
      const A = sims[i];
      const ai = ringAng[i];
      const sinI = Math.sin(ai);
      const cosI = Math.cos(ai);
      for (let j = i + 1; j < sims.length; j++) {
        let dA = ai - ringAng[j];
        if (dA > Math.PI) dA -= 2 * Math.PI;
        else if (dA < -Math.PI) dA += 2 * Math.PI;
        const adA = Math.abs(dA);
        if (adA >= SPREAD_RANGE || adA < 1e-4) continue;
        const w = (1 - adA / SPREAD_RANGE) ** 2;
        const f = SPREAD_FORCE * w * dt * (dA > 0 ? 1 : -1);
        // push i toward +tangent (increase its angle), j toward −tangent
        A.vx += -sinI * f;
        A.vy += cosI * f;
        const B = sims[j];
        B.vx -= -Math.sin(ringAng[j]) * f;
        B.vy -= Math.cos(ringAng[j]) * f;
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
          // Linear falloff (was ^1.5) so reach extends across the open middle —
          // even a cursor in the empty center still tugs the near side of the ring.
          const w = (1 - d / HAND_R) * depthFade * h.ramp;

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
          // Hold the click ripple to the original (gentle) ceiling, independent
          // of the hand's larger MAX_SPEED — restores the click that read better.
          const csp = Math.hypot(s.vx, s.vy);
          if (csp > CLICK_CAP) {
            const ck = CLICK_CAP / csp;
            s.vx *= ck;
            s.vy *= ck;
          }
        }
      }

      // ---- THE RING: radial spring toward the home annulus -------------------
      // Below the band → firmly EXPELLED outward (nothing floats in the middle);
      // above it → GENTLY reeled back home. Both accels are capped, so the
      // central keep-out is firm while the homeward magnet stays soft — a far
      // escapee drifts back over a couple of seconds, never a snap. Inside the
      // band there's no radial force at all: free float around the loop.
      const distR = CAM_Z - s.z;
      const kzR = distR / CAM_Z;
      const eaIn = vw * EXCL_AX * kzR;
      const ebIn = vh * EXCL_BY * kzR;
      const eaOut = vw * RING_AX * kzR;
      const ebOut = vh * RING_BY * kzR;
      const radR = Math.hypot(s.x, s.y) || 1e-4;
      const ux = s.x / radR;
      const uy = s.y / radR;
      // Both bounds are ELLIPSES at this fruit's angle — never the screen
      // rectangle, so the band stays oval and the corners stay empty.
      const rIn = 1 / Math.hypot(ux / eaIn, uy / ebIn);
      const rOut = 1 / Math.hypot(ux / eaOut, uy / ebOut);
      const gapR = Math.max(0.001, rOut - rIn);
      const lo = rIn + gapR * RING_LO;
      const hi = rIn + gapR * RING_HI;
      if (radR < lo) {
        const a = Math.min((lo - radR) * RING_IN_K, RING_IN_CAP);
        s.vx += ux * a * dt;
        s.vy += uy * a * dt;
      } else if (radR > hi) {
        const a = Math.min((radR - hi) * RING_OUT_K, RING_OUT_CAP);
        s.vx -= ux * a * dt;
        s.vy -= uy * a * dt;
      }

      // The cruise the velocity relaxes toward IS the tangential orbit, so a
      // settled fruit glides slowly AROUND the ring — never across the middle.
      s.bx = -uy * s.orbit;
      s.by = ux * s.orbit;

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

      // ---- HARD TEXT GUARD -----------------------------------------------------
      // The soft inner spring handles normal drift, but the hand is strong enough
      // to shove a fruit straight at the copy. This is the failsafe wall: a fruit
      // center may NEVER cross the keep-out ellipse. If it does, snap it back onto
      // the boundary and kill the inward part of its velocity — it slides along
      // the guard instead of sailing under the text. The copy stays readable.
      const ein = (s.x / eaIn) ** 2 + (s.y / ebIn) ** 2;
      if (ein < 1 && ein > 1e-6) {
        const push = 1 / Math.sqrt(ein);
        s.x *= push;
        s.y *= push;
        const rr = Math.hypot(s.x, s.y) || 1e-4;
        const gx = s.x / rr;
        const gy = s.y / rr;
        const vr = s.vx * gx + s.vy * gy;
        if (vr < 0) {
          s.vx -= vr * gx;
          s.vy -= vr * gy;
        }
      }

      // ---- depth-aware containment ---------------------------------------------
      // The visible frustum is narrower near the camera: bound each fruit by
      // the half-extents AT ITS OWN DEPTH, so nothing parks off-screen and the
      // far plane doesn't bunch toward the middle.
      const dist = CAM_Z - s.z;
      const halfH = FOV_TAN * dist * 0.92;
      const halfW = halfH * (vw / vh);
      const bx = Math.max(0.4, halfW - s.r);
      const by = Math.max(0.4, halfH - s.r);

      // The ring spring already keeps fruit in frame; this is a hard safety so
      // a strong shove can't park anything off-screen. (x/y cruise is the
      // tangential orbit, rebuilt each frame — nothing to flip here; only z
      // keeps a bouncing idle bob.)
      if (s.x > bx) s.vx -= (s.x - bx) * 6 * dt;
      else if (s.x < -bx) s.vx -= (s.x + bx) * 6 * dt;
      if (s.y > by) s.vy -= (s.y - by) * 6 * dt;
      else if (s.y < -by) s.vy -= (s.y + by) * 6 * dt;
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
