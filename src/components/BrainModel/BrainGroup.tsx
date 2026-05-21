"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Box3,
  type BufferGeometry,
  Group,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import {
  ANIMATION,
  BRAIN_PART_NAMES,
  DRACO_DECODER_PATH,
  FRUIT_NAMES,
  MODEL_PATH,
  SEED_NAME,
} from "./constants";
import { useBrainState } from "./BrainContext";
import { useIdleFloat } from "./hooks/useIdleFloat";
import { useMouseMagnetism } from "./hooks/useMouseMagnetism";
import { Fruit } from "./Fruit";

type GLTFNodes = { [key: string]: Object3D };

export interface MeshRender {
  geometry: BufferGeometry;
  material: Material | Material[];
  /** Mesh position relative to the wrapper. */
  position: [number, number, number];
  /** Mesh rotation as a quaternion [x,y,z,w] relative to the wrapper. */
  quaternion: [number, number, number, number];
  /** Mesh scale relative to the wrapper. */
  scale: [number, number, number];
}

export interface NodeRender {
  name: string;
  /** Wrapper world transform — applied once at the wrapper level. */
  worldPosition: [number, number, number];
  worldQuaternion: [number, number, number, number];
  worldScale: [number, number, number];
  /** Unit vector pointing outward from the brain bbox center toward this node.
   *  Computed against the GLB bbox center (NOT the GLB origin) so it works for
   *  fruits in all positions including those below or behind the center. */
  outDirection: [number, number, number];
  meshes: MeshRender[];
}

/**
 * Brain + seed are a single logical unit:
 *   - Outer <group> rotates with mouse magnetism (whole composition tilts).
 *   - Normalize <group> rescales/recenters the raw GLB to a canonical ~2-unit cube at origin
 *     (the source model is authored in larger units, e.g. centimeters).
 *   - Inner core <group> oscillates in Y (idle float). Its current Y offset is published
 *     into BrainContext so each Fruit can chase it with elastic lag.
 *   - Fruits render outside the core group so they can apply their own per-fruit lag,
 *     micro-wobble, and hover lift while still tilting with the outer group.
 */
export function BrainGroup() {
  const outerRef = useRef<Group>(null!);
  const coreRef = useRef<Group>(null!);
  /** Group between outerRef and the normalize chain — receives the click
   *  impact wobble (displacement + tilt) so the whole brain reacts to clicks. */
  const impactRef = useRef<Group>(null!);
  /** Spring-driven state of the impact transform. Each axis has a current
   *  value AND a velocity — the spring physics in the frame loop chases the
   *  computed target with momentum, creating a more organic motion than damp. */
  const impactState = useRef({
    dx: 0, dxV: 0,
    dy: 0, dyV: 0,
    dz: 0, dzV: 0,
    rx: 0, rxV: 0,
    rz: 0, rzV: 0,
    scale: 0, scaleV: 0,
  });
  const {
    coreOffsetY,
    intensity,
    normScale: normScaleRef,
    hoverPoint,
    isHoveringBrain,
    hoverIntensity,
    pulses,
  } = useBrainState();

  const gltf = useGLTF(MODEL_PATH, DRACO_DECODER_PATH) as unknown as {
    nodes: GLTFNodes;
    scene: Object3D;
  };
  const { nodes, scene } = gltf;

  const { normScale, normOffset, brainParts, seedPart, fruits } = useMemo(() => {
    scene.updateWorldMatrix(true, true);

    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const TARGET_SIZE = 2;
    const scaleFactor = TARGET_SIZE / maxDim;
    // Publish so Fruit (which lives inside the normalize chain) can convert
    // authored-in-normalized animation amplitudes back to pre-normalize units.
    normScaleRef.current = scaleFactor;

    const brainPartsLocal = BRAIN_PART_NAMES
      .map((name) => nodes[name])
      .filter((n): n is Object3D => Boolean(n))
      .map((n) => nodeToRender(n, undefined, center));

    const seed = nodes[SEED_NAME]
      ? nodeToRender(nodes[SEED_NAME], undefined, center)
      : null;

    const fruitsLocal = FRUIT_NAMES
      .map((name, i) => {
        const node = nodes[name];
        if (!node) return null;
        return {
          name,
          phase: phaseFor(i),
          // Promote fruit materials to MeshPhysicalMaterial with very faint clearcoat —
          // adds just a hint of fresh-looking sheen without reading as "wet".
          render: nodeToRender(
            node,
            { clearcoat: 0.15, clearcoatRoughness: 0.35 },
            center,
          ),
        };
      })
      .filter((f): f is NonNullable<typeof f> => Boolean(f));

    return {
      normScale: scaleFactor,
      normOffset: [-center.x, -center.y, -center.z] as [number, number, number],
      brainParts: brainPartsLocal,
      seedPart: seed,
      fruits: fruitsLocal,
    };
  }, [nodes, scene]);

  useMouseMagnetism(outerRef, {
    maxRotationX: ANIMATION.magnetism.maxRotationX,
    maxRotationZ: ANIMATION.magnetism.maxRotationZ,
    lambda: ANIMATION.magnetism.lambda,
    intensity: intensity.magnetism,
    isActive: isHoveringBrain,
  });

  // Animation amplitudes are authored in normalized world units (where the brain
  // is ~2 units wide). Since `coreRef` is mounted inside <group scale={normScale}>,
  // we divide here so the rendered movement matches the intended size.
  useIdleFloat(coreRef, {
    amplitude: (ANIMATION.idle.amplitude * intensity.idle) / normScale,
    frequency: ANIMATION.idle.frequency,
    onUpdate: (off) => {
      coreOffsetY.current = off;
    },
  });

  // Global hover-intensity decay. While the cursor is in the aura, target=1;
  // when it leaves, target=0. Damping makes the transition smooth, so fruits
  // experience the SAME Gaussian field while it gradually fades to zero,
  // producing a consistent rise/fall curve in both directions.
  useFrame((_state, dt) => {
    const target = isHoveringBrain.current ? 1 : 0;
    hoverIntensity.current = MathUtils.damp(
      hoverIntensity.current,
      target,
      ANIMATION.hover.intensityLambda,
      dt,
    );
  });

  // Brain impact reaction — combines three layers, all gamma-decayed:
  //   1. Directional push AWAY from the click point (Newton's reaction).
  //   2. Subtle tilt TOWARD the click point.
  //   3. Tiny uniform scale "breath".
  // The TARGET each frame is the sum of contributions from active pulses;
  // the actual applied transform is the damped state, so when a pulse expires
  // the brain eases back to rest instead of snapping.
  useFrame((_state, dt) => {
    const g = impactRef.current;
    if (!g) return;

    const peakTime = ANIMATION.impact.peakTime;
    const dispAmp = ANIMATION.impact.displacement;
    const rotAmp = ANIMATION.impact.rotation;
    const scalePulseAmp = ANIMATION.impact.scalePulse;

    let dxTarget = 0, dyTarget = 0, dzTarget = 0;
    let rxTarget = 0, rzTarget = 0;
    let scaleTarget = 0;

    if (pulses.current.length > 0) {
      const now = performance.now() / 1000;
      for (const pulse of pulses.current) {
        const elapsed = now - pulse.startTime;
        if (elapsed < 0 || elapsed > ANIMATION.pulse.lifetime) continue;
        const r = elapsed / peakTime;
        if (r > 6) continue;

        // Gamma curve with smoothstep ramp-up over first 30% of peakTime.
        const gamma = r * Math.exp(1 - r);
        const rampR = Math.min(1, r / 0.3);
        const ramp = rampR * rampR * (3 - 2 * rampR);
        const temporal = gamma * ramp;

        // Click direction in world (unit vector from origin to click point).
        const len = Math.hypot(pulse.origin.x, pulse.origin.y, pulse.origin.z) || 1;
        const ox = pulse.origin.x / len;
        const oy = pulse.origin.y / len;
        const oz = pulse.origin.z / len;

        dxTarget -= ox * temporal * dispAmp;
        dyTarget -= oy * temporal * dispAmp;
        dzTarget -= oz * temporal * dispAmp;
        rxTarget += -oz * temporal * rotAmp;
        rzTarget += ox * temporal * rotAmp;
        scaleTarget += temporal * scalePulseAmp;
      }
    }

    // Damped spring step per axis: F = −k·(x − target) − c·v. This gives the
    // brain mass-on-a-spring behavior — momentum carries it slightly past the
    // target, then it eases back. Tuned just below critical damping so the
    // overshoot is barely perceptible but reads as "alive".
    const s = impactState.current;
    const k = ANIMATION.impact.stiffness;
    const c = ANIMATION.impact.damping;
    const springStep = (
      cur: number, vel: number, tgt: number,
    ): [number, number] => {
      const force = -k * (cur - tgt) - c * vel;
      const newVel = vel + force * dt;
      return [cur + newVel * dt, newVel];
    };
    [s.dx, s.dxV] = springStep(s.dx, s.dxV, dxTarget);
    [s.dy, s.dyV] = springStep(s.dy, s.dyV, dyTarget);
    [s.dz, s.dzV] = springStep(s.dz, s.dzV, dzTarget);
    [s.rx, s.rxV] = springStep(s.rx, s.rxV, rxTarget);
    [s.rz, s.rzV] = springStep(s.rz, s.rzV, rzTarget);
    [s.scale, s.scaleV] = springStep(s.scale, s.scaleV, scaleTarget);

    g.position.set(s.dx, s.dy, s.dz);
    g.rotation.set(s.rx, 0, s.rz);
    g.scale.setScalar(1 + s.scale);
  });

  return (
    <group ref={outerRef}>
      {/* Invisible hover collider in NORMALIZED world coords. Tracks both the
          on/off state of hover AND the precise intersection point — fruits read
          the point and apply a Gaussian-falloff lift relative to their own
          world position (mouse acts like a soft vacuum). */}
      <mesh
        onPointerEnter={() => {
          isHoveringBrain.current = true;
        }}
        onPointerMove={(e) => {
          // Compute where the cursor's picking ray would intersect a unit
          // sphere centered at the brain origin (radius = brain surface).
          // This gives the exact point on the brain the cursor is aiming at,
          // independent of the actual collider sphere's size. Falls back to
          // the closest-point-on-ray if the ray misses the unit sphere
          // (cursor aiming outside the brain but inside the aura).
          rayUnitSphereHit(e.ray, hoverPoint.current);
        }}
        onPointerLeave={() => {
          isHoveringBrain.current = false;
        }}
        onClick={(e) => {
          e.stopPropagation();
          const now = performance.now() / 1000;
          const PULSE_LIFETIME = ANIMATION.pulse.lifetime;
          const COOLDOWN_DIST = ANIMATION.pulse.cooldownDistance;

          // Prune pulses that are past their lifetime.
          const active = pulses.current.filter(
            (p) => now - p.startTime < PULSE_LIFETIME,
          );

          // Same fix as hover: where would the cursor's ray hit a unit sphere
          // at the brain center? That's the click point we want, not the
          // intersection with the larger aura collider.
          const projected = new Vector3();
          rayUnitSphereHit(e.ray, projected);

          // Reject the new click only if there's an ACTIVE pulse close to the
          // new point — close enough that the two ripples would visually
          // overlap and create a "reset" feeling. Far-away clicks coexist.
          for (const p of active) {
            if (p.origin.distanceTo(projected) < COOLDOWN_DIST) {
              pulses.current = active;
              return;
            }
          }

          // Accept — append the new pulse alongside any active distant ones.
          active.push({ origin: projected, startTime: now });
          pulses.current = active;
        }}
      >
        <sphereGeometry args={[1.95, 24, 16]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>

      {/* impactRef wobbles (displacement + tilt) when the brain is clicked —
          driven by the useFrame above. Lives between the magnetism rotation
          (outerRef) and the normalize+idle chain, so its motion composes
          cleanly with both. */}
      <group ref={impactRef}>
        <group scale={normScale}>
          <group position={normOffset}>
            {/* coreRef oscillates with idle float — brain + seed + fruits all live
                inside it so they move as a single rigid body (no clipping). */}
            <group ref={coreRef}>
              {brainParts.map((part) => (
                <StaticPart key={part.name} part={part} />
              ))}
              {seedPart && <StaticPart part={seedPart} />}
              {fruits.map(({ name, phase, render }) => (
                <Fruit key={name} render={render} phase={phase} />
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Static brain part (or seed): wrapper at world transform, meshes at relative transform. */
function StaticPart({ part }: { part: NodeRender }) {
  return (
    <group
      position={part.worldPosition}
      quaternion={part.worldQuaternion}
      scale={part.worldScale}
    >
      {part.meshes.map((m, i) => (
        <mesh
          key={i}
          geometry={m.geometry}
          material={m.material}
          position={m.position}
          quaternion={m.quaternion}
          scale={m.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

interface MaterialOverrides {
  /** When > 0, clones the material and sets emissive = base color × this factor. */
  emissiveBoost?: number;
  /** When set, promotes MeshStandardMaterial → MeshPhysicalMaterial with this clearcoat. */
  clearcoat?: number;
  /** Roughness of the clearcoat layer (lower = sharper highlight). */
  clearcoatRoughness?: number;
}

/** Build a renderable description from a raw GLB node — captures all descendant meshes
 *  with their transforms RELATIVE to the node, plus the node's own world transform.
 *  When `overrides` has any property set, each mesh's material is cloned/promoted
 *  to avoid mutating GLB-shared originals.
 *  `bboxCenter` is the brain's GLB-space bbox center; we use it to derive a
 *  per-node radial direction (outward = away from the brain's center). */
function nodeToRender(
  node: Object3D,
  overrides: MaterialOverrides | undefined,
  bboxCenter: Vector3,
): NodeRender {
  // Node's own world transform (used at the wrapper level).
  const wPos = new Vector3();
  const wQuat = new Quaternion();
  const wScale = new Vector3();
  node.matrixWorld.decompose(wPos, wQuat, wScale);

  // Outward direction = node position minus brain center, normalized. If the
  // node sits at the center exactly we fall back to +Y so the lift still moves.
  const dx = wPos.x - bboxCenter.x;
  const dy = wPos.y - bboxCenter.y;
  const dz = wPos.z - bboxCenter.z;
  const len = Math.hypot(dx, dy, dz);
  const outDirection: [number, number, number] =
    len > 1e-6 ? [dx / len, dy / len, dz / len] : [0, 1, 0];

  // Pre-compute inverse(node.matrixWorld) so each child mesh transform can be relative.
  const nodeWorldInv = new Matrix4().copy(node.matrixWorld).invert();

  const meshes: MeshRender[] = [];
  collectMeshesWithRelative(node, nodeWorldInv, meshes, overrides);

  return {
    name: node.name,
    worldPosition: [wPos.x, wPos.y, wPos.z],
    worldQuaternion: [wQuat.x, wQuat.y, wQuat.z, wQuat.w],
    worldScale: [wScale.x, wScale.y, wScale.z],
    outDirection,
    meshes,
  };
}

function collectMeshesWithRelative(
  node: Object3D,
  nodeWorldInv: Matrix4,
  out: MeshRender[],
  overrides?: MaterialOverrides,
) {
  if (node instanceof Mesh) {
    const rel = new Matrix4().multiplyMatrices(nodeWorldInv, node.matrixWorld);
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    rel.decompose(p, q, s);
    out.push({
      geometry: node.geometry,
      material: applyOverrides(node.material, overrides),
      position: [p.x, p.y, p.z],
      quaternion: [q.x, q.y, q.z, q.w],
      scale: [s.x, s.y, s.z],
    });
  }
  for (const child of node.children) {
    collectMeshesWithRelative(child, nodeWorldInv, out, overrides);
  }
}

function applyOverrides(
  material: Material | Material[],
  overrides?: MaterialOverrides,
): Material | Material[] {
  if (!overrides) return material;
  const hasAny =
    (overrides.emissiveBoost ?? 0) > 0 || overrides.clearcoat !== undefined;
  if (!hasAny) return material;
  if (Array.isArray(material)) {
    return material.map((m) => applyOverridesOne(m, overrides));
  }
  return applyOverridesOne(material, overrides);
}

function applyOverridesOne(
  material: Material,
  { emissiveBoost = 0, clearcoat, clearcoatRoughness = 0.25 }: MaterialOverrides,
): Material {
  let out: Material = material;

  // If clearcoat is requested and the source is MeshStandardMaterial, promote it
  // to MeshPhysicalMaterial so it gains clearcoat support.
  if (clearcoat !== undefined) {
    if (material instanceof MeshPhysicalMaterial) {
      const c = material.clone();
      c.clearcoat = clearcoat;
      c.clearcoatRoughness = clearcoatRoughness;
      out = c;
    } else if (material instanceof MeshStandardMaterial) {
      // We can't use Physical.copy(Standard) — three.js accesses fields that only
      // exist on Physical and throws. Build the Physical material with empty
      // params, then assign over the PBR fields we care about (skipping anything
      // that would be undefined — passing `undefined` to setValues breaks the
      // Vector2 fields).
      const s = material;
      const p = new MeshPhysicalMaterial();
      p.color.copy(s.color);
      p.roughness = s.roughness;
      p.metalness = s.metalness;
      if (s.map) p.map = s.map;
      if (s.roughnessMap) p.roughnessMap = s.roughnessMap;
      if (s.metalnessMap) p.metalnessMap = s.metalnessMap;
      if (s.normalMap) {
        p.normalMap = s.normalMap;
        if (s.normalScale) p.normalScale.copy(s.normalScale);
      }
      if (s.aoMap) {
        p.aoMap = s.aoMap;
        p.aoMapIntensity = s.aoMapIntensity;
      }
      p.emissive.copy(s.emissive);
      if (s.emissiveMap) p.emissiveMap = s.emissiveMap;
      p.emissiveIntensity = s.emissiveIntensity;
      if (s.envMap) p.envMap = s.envMap;
      p.envMapIntensity = s.envMapIntensity;
      if (s.alphaMap) p.alphaMap = s.alphaMap;
      p.transparent = s.transparent;
      p.opacity = s.opacity;
      p.side = s.side;
      p.alphaTest = s.alphaTest;
      p.toneMapped = s.toneMapped;
      p.wireframe = s.wireframe;
      p.flatShading = s.flatShading;
      p.clearcoat = clearcoat;
      p.clearcoatRoughness = clearcoatRoughness;
      out = p;
    }
  }

  // Emissive boost — clone if we haven't already.
  if (emissiveBoost > 0) {
    const target = out === material
      ? (material as Material & { clone: () => Material }).clone()
      : out;
    const m = target as Material & {
      color?: { clone: () => unknown };
      emissive?: { copy: (c: unknown) => void };
      emissiveIntensity?: number;
    };
    if (m.color && m.emissive) {
      m.emissive.copy(m.color.clone());
      m.emissiveIntensity = emissiveBoost;
      out = target;
    }
  }

  return out;
}

/** Deterministic phase per fruit index so renders are SSR-safe and stable across runs. */
function phaseFor(i: number) {
  return (((i * 9301 + 49297) % 233280) / 233280) * Math.PI * 2;
}

/** Solves where a picking ray hits a unit sphere centered at the brain origin
 *  and writes the result into `out`. If the ray misses the sphere, falls back
 *  to the closest-point-on-ray (so off-brain cursor positions still produce a
 *  consistent surface point near the brain). */
function rayUnitSphereHit(
  ray: { origin: Vector3; direction: Vector3 },
  out: Vector3,
): Vector3 {
  // |O + t·D|² = 1  (unit sphere at origin, D is normalized)
  // t² + 2t(O·D) + (|O|² − 1) = 0
  const O = ray.origin;
  const D = ray.direction;
  const ODdot = O.x * D.x + O.y * D.y + O.z * D.z;
  const OOlenSq = O.x * O.x + O.y * O.y + O.z * O.z;
  const disc = ODdot * ODdot - OOlenSq + 1;
  if (disc >= 0) {
    // Front hit (smaller t — closer to ray origin).
    const t = -ODdot - Math.sqrt(disc);
    out.x = O.x + t * D.x;
    out.y = O.y + t * D.y;
    out.z = O.z + t * D.z;
    return out;
  }
  // Ray misses — use closest approach to origin, projected to the unit sphere.
  // closestPoint = O - (O·D) D
  out.x = O.x - ODdot * D.x;
  out.y = O.y - ODdot * D.y;
  out.z = O.z - ODdot * D.z;
  // Normalize to the surface so the math downstream stays in the same space.
  const len = Math.hypot(out.x, out.y, out.z) || 1;
  out.x /= len;
  out.y /= len;
  out.z /= len;
  return out;
}

useGLTF.preload(MODEL_PATH, DRACO_DECODER_PATH);
