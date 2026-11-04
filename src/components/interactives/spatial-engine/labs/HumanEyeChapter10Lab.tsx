'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line, Html, RoundedBox } from '@react-three/drei';
import { useXR } from '@react-three/xr';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Layers,
  Sparkles,
  Sliders,
  Eye,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

import KapikitabAREnvironment from '../core/KapikitabAREnvironment';
// Import your 10,086-line SceneGraph JSON directly
import sceneGraphData from './ch_chapter_10__pdf_graph.json';

// ============================================================================
// COLOR & SIZE PALETTE FOR CUBOID PROXIES BY CATEGORY
// ============================================================================
const CATEGORY_STYLES: Record<
  string,
  { color: string; border: string; size: [number, number, number] }
> = {
  anatomical_biological: {
    color: '#10b981', // Emerald
    border: '#34d399',
    size: [0.11, 0.14, 0.11],
  },
  mechanical_physics: {
    color: '#0ea5e9', // Sky Blue
    border: '#38bdf8',
    size: [0.12, 0.16, 0.08],
  },
  environment_prop: {
    color: '#f59e0b', // Amber
    border: '#fbbf24',
    size: [0.16, 0.12, 0.12],
  },
  molecular_chemical: {
    color: '#a855f7', // Purple
    border: '#c084fc',
    size: [0.14, 0.14, 0.14],
  },
};

// Format instanceId into clean readable label
function formatEntityLabel(instanceId: string): string {
  return instanceId
    .replace(/_main$/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// 1. CAMERA DIRECTOR (Smoothly drives OrbitControls & Camera per Beat)
// ============================================================================
function CameraDirector({
  cameraDirective,
  entityRefs,
  freeInspectMode,
}: {
  cameraDirective: any;
  entityRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  freeInspectMode: boolean;
}) {
  const { camera, controls } = useThree();
  const isAR = useXR((state) => state.mode === 'immersive-ar');

  const desiredTarget = useRef(new THREE.Vector3(0, 1.1, -1.0));
  const desiredCamPos = useRef(new THREE.Vector3(0, 1.35, -0.2));
  const isTransitioning = useRef(false);
  const transitionTimer = useRef(0);

  useEffect(() => {
    if (!cameraDirective || isAR) return;

    const focusId = cameraDirective.focusInstanceId;
    const focusObj = entityRefs.current[focusId];

    const targetPos = new THREE.Vector3(0, 1.1, -1.0);
    if (focusObj) {
      focusObj.getWorldPosition(targetPos);
    }

    // Ensure minimum comfortable camera distance so cuboids are framed clearly
    const rawOffset = cameraDirective.cameraOffsetMeters || {
      x: 0,
      y: 0.22,
      z: 0.65,
    };
    const safeZ = Math.max(0.48, rawOffset.z || 0.6);
    const safeY = rawOffset.y ?? 0.18;

    desiredTarget.current.copy(targetPos);
    desiredCamPos.current.set(
      targetPos.x + (rawOffset.x || 0),
      targetPos.y + safeY,
      targetPos.z + safeZ
    );

    isTransitioning.current = true;
    transitionTimer.current = 0;
  }, [cameraDirective, isAR, entityRefs]);

  useFrame((_, delta) => {
    if (isAR || freeInspectMode || !isTransitioning.current) return;

    transitionTimer.current += delta;
    const lerpSpeed = Math.min(1, delta * 4.5);

    camera.position.lerp(desiredCamPos.current, lerpSpeed);

    const orbitControls = controls as any;
    if (orbitControls && orbitControls.target) {
      orbitControls.target.lerp(desiredTarget.current, lerpSpeed);
      orbitControls.update();
    }

    if (
      camera.position.distanceTo(desiredCamPos.current) < 0.015 ||
      transitionTimer.current > 1.6
    ) {
      isTransitioning.current = false;
    }
  });

  return null;
}

// ============================================================================
// 2. CUBOID PROXY ENTITY (Replaces .glb with articulated, macro-aware cuboid)
// ============================================================================
function CuboidProxyEntity({
  entity,
  placement,
  activeMacros,
  interactionGate,
  sliderValue,
  onSelectEntity,
  registerRef,
}: {
  entity: any;
  placement: any;
  activeMacros: any[];
  interactionGate: any;
  sliderValue: number;
  onSelectEntity: (instanceId: string) => void;
  registerRef: (id: string, ref: THREE.Group | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const style =
    CATEGORY_STYLES[entity.category] || CATEGORY_STYLES.mechanical_physics;

  useEffect(() => {
    registerRef(entity.instanceId, groupRef.current);
    return () => registerRef(entity.instanceId, null);
  }, [entity.instanceId, registerRef]);

  // Macros targeting this specific entity
  const myMacros = useMemo(
    () =>
      activeMacros.filter((m) => m.targetInstanceId === entity.instanceId),
    [activeMacros, entity.instanceId]
  );

  const hasXray = myMacros.some((m) => m.macroType === 'XRAY_ISOLATE');
  const hasCallout = myMacros.some(
    (m) =>
      m.macroType === 'ANNOTATION_CALLOUT_RING' ||
      m.macroType === 'MAGNIFY_PORTAL'
  );
  const hasShaderMorph = myMacros.some(
    (m) =>
      m.macroType === 'SHADER_STATE_MORPH' ||
      m.macroType === 'CROSS_SECTION_SWEEP'
  );
  const hasFlowParticles = myMacros.some(
    (m) => m.macroType === 'FLOW_PARTICLES_BETWEEN'
  );

  // Check if user interaction gate drives this entity
  const isDrivenByGate =
    interactionGate &&
    (interactionGate.targetInstanceId === entity.instanceId ||
      interactionGate.sourceToolOrInstanceId === entity.instanceId);

  // Compute mapped output from user slider [inputMin..inputMax] -> [outputMin..outputMax]
  const mappedGateOutput = useMemo(() => {
    if (!interactionGate) return 0;
    const {
      inputRangeMin = 0,
      inputRangeMax = 1,
      outputRangeMin = 0,
      outputRangeMax = 1,
    } = interactionGate;
    const span = inputRangeMax - inputRangeMin || 1;
    const norm = Math.max(
      0,
      Math.min(1, (sliderValue - inputRangeMin) / span)
    );
    return outputRangeMin + norm * (outputRangeMax - outputRangeMin);
  }, [interactionGate, sliderValue]);

  // Smooth 60fps transform & macro animation loop
  useFrame((state, delta) => {
    if (!groupRef.current || !placement) return;

    const basePos = placement.solvedTransform.position;
    const baseRot = placement.solvedTransform.rotationEulerDeg;
    const baseScale = placement.solvedTransform.scale;

    let targetX = basePos.x;
    let targetY = basePos.y;
    let targetZ = basePos.z;
    let rotZDeg = baseRot.z || 0;
    let uniformScale = baseScale.x || 1;

    if (isDrivenByGate) {
      const prop = interactionGate.drivenProperty;
      if (prop === 'position.x') targetX = basePos.x + mappedGateOutput;
      if (prop === 'position.y') targetY = basePos.y + mappedGateOutput;
      if (prop === 'rotation.z')
        rotZDeg = THREE.MathUtils.radToDeg(mappedGateOutput);
      if (prop === 'scale.uniform') uniformScale = mappedGateOutput;
    }

    // Smooth Position Lerp
    groupRef.current.position.lerp(
      new THREE.Vector3(targetX, targetY, targetZ),
      Math.min(1, delta * 6)
    );

    // Smooth Rotation Lerp
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(baseRot.x || 0),
        THREE.MathUtils.degToRad(baseRot.y || 0),
        THREE.MathUtils.degToRad(rotZDeg)
      )
    );
    groupRef.current.quaternion.slerp(targetQuat, Math.min(1, delta * 6));

    // Smooth Scale Lerp
    const pulse = hasShaderMorph
      ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.06
      : 1;
    const s = uniformScale * pulse;
    groupRef.current.scale.lerp(
      new THREE.Vector3(s, s, s),
      Math.min(1, delta * 6)
    );

    // Rotate Callout Ring
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.5;
    }
  });

  if (!placement) return null;

  const baseOpacity =
    isDrivenByGate && interactionGate.drivenProperty === 'material.opacity'
      ? mappedGateOutput
      : hasXray
      ? 0.25
      : 0.88;

  const activeMacroInfo = myMacros[myMacros.length - 1];

  return (
    <group
      ref={groupRef}
      position={[
        placement.solvedTransform.position.x,
        placement.solvedTransform.position.y,
        placement.solvedTransform.position.z,
      ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectEntity(entity.instanceId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* OUTER CUBOID PROXY */}
      <RoundedBox args={style.size} radius={0.012} smoothness={4} castShadow>
        <meshStandardMaterial
          color={hasShaderMorph ? '#38bdf8' : style.color}
          emissive={
            hovered || myMacros.length > 0 ? '#38bdf8' : '#000000'
          }
          emissiveIntensity={hovered ? 0.5 : myMacros.length > 0 ? 0.35 : 0}
          transparent
          opacity={baseOpacity}
          roughness={0.25}
          metalness={0.3}
        />
      </RoundedBox>

      {/* INNER CORE SUB-NODE CUBOID (Visible during XRAY_ISOLATE) */}
      <mesh scale={[0.5, 0.5, 0.5]}>
        <boxGeometry args={style.size} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={hasXray ? 0.85 : 0.2}
          wireframe={!hasXray}
        />
      </mesh>

      {/* SEMANTIC SOCKETS (Small Cyan Spheres from entity.sockets) */}
      {(entity.sockets || []).map((sock: any, idx: number) => (
        <mesh
          key={sock.socketName || idx}
          position={[
            sock.localOffsetMeters?.x || 0,
            sock.localOffsetMeters?.y || 0,
            sock.localOffsetMeters?.z || 0,
          ]}
        >
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
      ))}

      {/* HOLOGRAM MACRO: ANNOTATION CALLOUT RING */}
      {(hasCallout || hasFlowParticles) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.09, 0.105, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* FLOATING 3D CUBOID LABEL */}
      <Text
        position={[0, style.size[1] / 2 + 0.045, 0]}
        fontSize={0.022}
        color="#f5f5f4"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.002}
        outlineColor="#0c0a09"
      >
        {formatEntityLabel(entity.instanceId)}
      </Text>

      {/* ZONE SUB-LABEL */}
      <Text
        position={[0, style.size[1] / 2 + 0.022, 0]}
        fontSize={0.013}
        color="#a8a29e"
        anchorX="center"
        anchorY="bottom"
      >
        {`[${placement.zone}]`}
      </Text>

      {/* ACTIVE HOLOGRAM MACRO TELEMETRY CALLOUT BADGE */}
      {activeMacroInfo && (
        <Html
          position={[0, -style.size[1] / 2 - 0.05, 0]}
          center
          distanceFactor={1.5}
        >
          <div className="px-2.5 py-1 rounded-md bg-stone-950/90 border border-sky-400/60 text-sky-300 text-[10px] font-mono whitespace-nowrap shadow-lg backdrop-blur-md">
            <span className="font-bold text-white">
              {activeMacroInfo.params?.calloutLabel ||
                activeMacroInfo.macroType}
            </span>
            {activeMacroInfo.params?.telemetryValue && (
              <span className="ml-1.5 text-emerald-400">
                • {activeMacroInfo.params.telemetryValue}
              </span>
            )}
            {activeMacroInfo.targetNodeName && (
              <div className="text-[9px] text-stone-400">
                Node: {activeMacroInfo.targetNodeName}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// 3. MANIM 3D GEOMETRIC OVERLAY (Vertices, Similar Triangles, Angle Arcs)
// ============================================================================
function ManimGeometricOverlay3D({
  manimOverlay,
  unlockedSyncMarkers,
}: {
  manimOverlay: any;
  unlockedSyncMarkers: string[];
}) {
  if (!manimOverlay || !manimOverlay.enabled) return null;

  // Center the Manim coordinate system around the Optical Bench (y = 1.0, z = -0.95)
  const originOffset = new THREE.Vector3(0, 1.02, -0.92);

  const vertexMap = new Map<string, THREE.Vector3>();
  (manimOverlay.vertices || []).forEach((v: any) => {
    vertexMap.set(
      v.id,
      new THREE.Vector3(
        (v.coordsMeters?.x || 0) + originOffset.x,
        (v.coordsMeters?.y || 0) + originOffset.y,
        (v.coordsMeters?.z || 0) + originOffset.z
      )
    );
  });

  const verticesList = Array.from(vertexMap.entries());

  return (
    <group>
      {/* PRINCIPAL OPTICAL AXIS REFERENCE LINE */}
      <Line
        points={[
          [-0.75, originOffset.y, originOffset.z],
          [0.75, originOffset.y, originOffset.z],
        ]}
        color="#10b981"
        lineWidth={1.5}
        dashed
        dashSize={0.03}
        gapSize={0.02}
      />

      {/* MANIM 3D VERTEX DOTS & LABELS */}
      {(manimOverlay.vertices || []).map((v: any) => {
        const pos = vertexMap.get(v.id)!;
        return (
          <group key={v.id} position={pos}>
            <mesh>
              <sphereGeometry args={[0.012, 16, 16]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <Text
              position={[0, 0.03, 0]}
              fontSize={0.02}
              color="#38bdf8"
              anchorX="center"
              anchorY="bottom"
            >
              {v.label}
            </Text>
          </group>
        );
      })}

      {/* CONNECTING RAYS BETWEEN VERTICES */}
      {verticesList.length >= 2 && (
        <Line
          points={verticesList.map(([, vec]) => [vec.x, vec.y, vec.z])}
          color="#38bdf8"
          lineWidth={2.5}
        />
      )}

      {/* HIGHLIGHTED SIMILAR TRIANGLES / POLYGONS */}
      {(manimOverlay.highlightedPolygons || []).map((poly: any) => {
        const isTriggered =
          !poly.triggerOnSyncMarker ||
          unlockedSyncMarkers.includes(poly.triggerOnSyncMarker);
        if (!isTriggered || !poly.vertexIds || poly.vertexIds.length < 3)
          return null;

        const pts = poly.vertexIds
          .map((id: string) => vertexMap.get(id))
          .filter(Boolean) as THREE.Vector3[];

        if (pts.length < 3) return null;

        const geom = new THREE.BufferGeometry().setFromPoints([
          pts[0],
          pts[1],
          pts[2],
        ]);
        geom.computeVertexNormals();

        return (
          <mesh key={poly.polygonId} geometry={geom}>
            <meshBasicMaterial
              color={poly.fillColorHex || '#38bdf8'}
              transparent
              opacity={poly.opacity ?? 0.28}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ============================================================================
// 4. MAIN EXPORTED R3F COMPONENT (Plugs into SimulationRouter & KapikitabAREnvironment)
// ============================================================================
export default function HumanEyeChapter10Lab({
  isFullscreen = false,
}: {
  modelUrl?: string;
  isFullscreen?: boolean;
  title?: string;
}) {
  const modules = sceneGraphData.modules || [];
  const allBeats = useMemo(
    () => modules.flatMap((m: any) => m.beats || []),
    [modules]
  );
  const entities = sceneGraphData.entities || [];

  // Playback & Navigation State
  const [currentBeatIdx, setCurrentBeatIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [freeInspectMode, setFreeInspectMode] = useState(false);

  // Interactive Physics Slider & Step State
  const [sliderValue, setSliderValue] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [gateCompleted, setGateCompleted] = useState(false);
  const [showDiveDeeper, setShowDiveDeeper] = useState(false);

  // Registry of 3D Group Refs by instanceId for the CameraDirector
  const entityRefs = useRef<Record<string, THREE.Group | null>>({});
  const registerEntityRef = (id: string, ref: THREE.Group | null) => {
    entityRefs.current[id] = ref;
  };

  const currentBeat = allBeats[currentBeatIdx] || allBeats[0];
  const currentModule = modules.find(
    (m: any) => m.moduleId === currentBeat?.moduleId
  );

  // Reset per-beat state when switching beats
  useEffect(() => {
    if (!currentBeat) return;
    setElapsedMs(0);
    setGateCompleted(false);
    setActiveStepIdx(0);
    setFreeInspectMode(false);

    const gate = currentBeat.interactionGate;
    if (gate) {
      const mid =
        ((gate.inputRangeMin ?? 0) + (gate.inputRangeMax ?? 1)) / 2;
      setSliderValue(mid);
    }
  }, [currentBeatIdx, currentBeat]);

  // Word-Sync Timeline Clock
  useEffect(() => {
    if (!isPlaying || !currentBeat) return;
    const interval = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 100;
        if (next >= (currentBeat.durationMs || 18000)) {
          setIsPlaying(false);
          return currentBeat.durationMs || 18000;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, currentBeat]);

  // Determine which [SYNC:anchor_X] markers have been reached based on elapsed time
  const unlockedSyncMarkers = useMemo(() => {
    if (!currentBeat) return ['anchor_1'];
    const segments = currentBeat.narrationSegments || [];
    const duration = currentBeat.durationMs || 18000;
    const unlocked: string[] = [];

    segments.forEach((seg: any, idx: number) => {
      const triggerTime = (idx / Math.max(1, segments.length)) * duration * 0.75;
      if (elapsedMs >= triggerTime) {
        unlocked.push(seg.syncMarker);
      }
    });

    return unlocked.length > 0 ? unlocked : ['anchor_1'];
  }, [currentBeat, elapsedMs]);

  // Active Hologram Macros for unlocked sync markers
  const activeMacros = useMemo(() => {
    if (!currentBeat) return [];
    return (currentBeat.wordSyncedHologramMacros || []).filter((m: any) =>
      unlockedSyncMarkers.includes(m.syncMarker)
    );
  }, [currentBeat, unlockedSyncMarkers]);

  // Map placements by instanceId for O(1) lookup
  const placementByInstanceId = useMemo(() => {
    const map: Record<string, any> = {};
    (currentBeat?.entityPlacements || []).forEach((p: any) => {
      map[p.instanceId] = p;
    });
    return map;
  }, [currentBeat]);

  // Handle Tap-to-Inspect or Slider Change
  const handleEntityTap = (instanceId: string) => {
    setGateCompleted(true);
    setActiveStepIdx((prev) =>
      Math.min(
        (currentBeat?.interactionStateMachine?.length || 1) - 1,
        prev + 1
      )
    );
  };

  const handleSliderChange = (val: number) => {
    setSliderValue(val);
    const target = currentBeat?.interactionGate?.successTargetValue ?? 0.5;
    const range =
      Math.abs(
        (currentBeat?.interactionGate?.inputRangeMax ?? 1) -
          (currentBeat?.interactionGate?.inputRangeMin ?? 0)
      ) || 1;
    if (Math.abs(val - target) <= range * 0.25) {
      setGateCompleted(true);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[640px] bg-stone-950 text-stone-100 overflow-hidden select-none font-sans">
      {/* ====================================================================
          3D SPATIAL CANVAS (WRAPPED IN YOUR KAPIKITAB AR ENVIRONMENT)
      ==================================================================== */}
      <KapikitabAREnvironment>
        <CameraDirector
          cameraDirective={currentBeat?.cameraDirective}
          entityRefs={entityRefs}
          freeInspectMode={freeInspectMode}
        />

        {/* OPTICAL BENCH WORKSURFACE REFERENCE */}
        <mesh position={[0, 0.88, -1.0]} receiveShadow>
          <boxGeometry args={[1.8, 0.03, 0.65]} />
          <meshStandardMaterial
            color="#1c1917"
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>

        {/* RENDER ALL SCENE ENTITIES AS ARTICULATED CUBOID PROXIES */}
        {entities.map((entity: any) => (
          <CuboidProxyEntity
            key={entity.instanceId}
            entity={entity}
            placement={placementByInstanceId[entity.instanceId] || null}
            activeMacros={activeMacros}
            interactionGate={currentBeat?.interactionGate}
            sliderValue={sliderValue}
            onSelectEntity={handleEntityTap}
            registerRef={registerEntityRef}
          />
        ))}

        {/* RENDER 3D MANIM GEOMETRIC OVERLAY */}
        <ManimGeometricOverlay3D
          manimOverlay={currentBeat?.manimOverlay}
          unlockedSyncMarkers={unlockedSyncMarkers}
        />
      </KapikitabAREnvironment>

      {/* ====================================================================
          TOP LEFT HUD: MODULE & BEAT SELECTOR + PEDAGOGICAL MODE BADGE
      ==================================================================== */}
      <div className="absolute top-4 left-4 z-30 max-w-md bg-stone-900/85 backdrop-blur-md border border-stone-800 rounded-2xl p-3.5 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-1">
          <Layers size={13} />
          <span>
            {currentModule?.sectionCode} • {currentBeat?.pedagogicalMode}
          </span>
          <span className="ml-auto text-stone-400">
            Beat {currentBeatIdx + 1} / {allBeats.length}
          </span>
        </div>

        <h2 className="text-sm font-bold text-stone-100 leading-snug">
          {currentBeat?.conceptTitle}
        </h2>

        {/* Beat Pill Selector */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {allBeats.map((b: any, idx: number) => (
            <button
              key={b.beatId}
              onClick={() => setCurrentBeatIdx(idx)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                idx === currentBeatIdx
                  ? 'bg-emerald-500 text-stone-950 font-bold shadow'
                  : 'bg-stone-800/80 text-stone-400 hover:bg-stone-700'
              }`}
            >
              B{idx}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          RIGHT HUD: MANIM EQUATION & CONTINUOUS PHYSICS TELEMETRY PANEL
      ==================================================================== */}
      <div className="absolute top-20 right-4 z-30 w-80 bg-stone-900/85 backdrop-blur-md border border-stone-800 rounded-2xl p-3.5 shadow-2xl pointer-events-auto space-y-3">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <Sparkles size={13} />
            Manim & Physics Telemetry
          </span>
          <button
            onClick={() => setFreeInspectMode((v) => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${
              freeInspectMode
                ? 'bg-sky-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-300'
            }`}
          >
            <Eye size={11} />
            {freeInspectMode ? 'Free Orbit ON' : 'Auto Cam'}
          </button>
        </div>

        {/* KaTeX Formula Steps */}
        {currentBeat?.manimOverlay?.katexFormulaSteps?.length > 0 ? (
          <div className="space-y-2">
            {currentBeat.manimOverlay.katexFormulaSteps.map((step: any) => (
              <div
                key={step.stepId}
                className="p-2.5 rounded-xl bg-stone-950/90 border border-sky-500/30"
              >
                <div className="font-mono text-xs text-sky-300 font-bold break-words">
                  {step.latex}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  {step.explanationNote}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-stone-400 italic">
            Tactile Exploration Mode — No geometric proof overlay required for
            this beat.
          </div>
        )}

        {/* Continuous Physics Binding Formula */}
        {currentBeat?.continuousPhysicsBindings?.map((phys: any) => (
          <div
            key={phys.bindingId}
            className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px]"
          >
            <div className="font-mono text-emerald-300 font-semibold">
              {phys.mathematicalFormula}
            </div>
            <div className="text-stone-400 mt-0.5">
              {phys.visualFeedbackDescription}
            </div>
          </div>
        ))}

        {/* Active Entities in Beat */}
        <div>
          <div className="text-[10px] font-mono uppercase text-stone-400 mb-1">
            Active Cuboid Proxies ({currentBeat?.entityPlacements?.length || 0})
          </div>
          <div className="flex flex-wrap gap-1">
            {(currentBeat?.entityPlacements || []).map((pl: any) => (
              <span
                key={pl.instanceId}
                className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-200 text-[10px] font-mono"
              >
                {formatEntityLabel(pl.instanceId)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          BOTTOM HUD: WORD-SYNCED NARRATION, INTERACTION GATE & CONTROLS
      ==================================================================== */}
      <div className="absolute bottom-4 left-4 right-4 z-30 flex flex-col md:flex-row gap-3 items-stretch pointer-events-auto">
        {/* LEFT CARD: Word-Synced Voiceover Script & Sync Anchors */}
        <div className="flex-1 bg-stone-900/90 backdrop-blur-md border border-stone-800 rounded-2xl p-4 shadow-2xl flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
              <span>WORD-SYNCED NARRATION SEGMENTS</span>
              <div className="flex gap-1.5">
                {(currentBeat?.narrationSegments || []).map((seg: any) => {
                  const active = unlockedSyncMarkers.includes(seg.syncMarker);
                  return (
                    <button
                      key={seg.segmentId}
                      onClick={() => {
                        setIsPlaying(false);
                        const idx =
                          currentBeat.narrationSegments.indexOf(seg);
                        setElapsedMs(
                          ((idx + 0.1) /
                            currentBeat.narrationSegments.length) *
                            (currentBeat.durationMs || 18000)
                        );
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        active
                          ? 'bg-sky-500/20 border border-sky-400 text-sky-300'
                          : 'bg-stone-800 text-stone-500'
                      }`}
                    >
                      [{seg.syncMarker}]
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spoken Segments */}
            <div className="space-y-1 text-xs leading-relaxed">
              {(currentBeat?.narrationSegments || []).map((seg: any) => {
                const isUnlocked = unlockedSyncMarkers.includes(
                  seg.syncMarker
                );
                return (
                  <p
                    key={seg.segmentId}
                    className={`transition-opacity ${
                      isUnlocked ? 'text-stone-100' : 'text-stone-500'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-emerald-400 mr-1.5">
                      [{seg.syncMarker}]
                    </span>
                    {seg.spokenText}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Transport Bar */}
          <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-stone-800">
            <button
              onClick={() =>
                setCurrentBeatIdx((i) => Math.max(0, i - 1))
              }
              disabled={currentBeatIdx === 0}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40"
            >
              <SkipBack size={15} />
            </button>

            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-1.5"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play Beat'}
            </button>

            <button
              onClick={() => setElapsedMs(0)}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700"
              title="Replay Beat"
            >
              <RotateCcw size={14} />
            </button>

            {/* Progress Bar */}
            <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{
                  width: `${Math.min(
                    100,
                    (elapsedMs / (currentBeat?.durationMs || 18000)) * 100
                  )}%`,
                }}
              />
            </div>

            <button
              onClick={() =>
                setCurrentBeatIdx((i) =>
                  Math.min(allBeats.length - 1, i + 1)
                )
              }
              disabled={currentBeatIdx === allBeats.length - 1}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
            >
              Next
              <SkipForward size={14} />
            </button>
          </div>
        </div>

        {/* RIGHT CARD: Interactive Gate Slider / Experiment Controls */}
        {currentBeat?.interactionGate && (
          <div className="w-full md:w-96 bg-stone-900/90 backdrop-blur-md border border-stone-800 rounded-2xl p-4 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono uppercase text-emerald-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Sliders size={13} />
                  Interactive Gate ({currentBeat.interactionGate.mechanic})
                </span>
                {gateCompleted && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 size={13} /> Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-200 leading-snug">
                {currentBeat.interactionGate.promptText}
              </p>

              {/* Continuous Slider Control */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-stone-400">
                  <span>
                    Target:{' '}
                    {formatEntityLabel(
                      currentBeat.interactionGate.targetInstanceId
                    )}
                  </span>
                  <span>
                    {currentBeat.interactionGate.drivenProperty} ={' '}
                    {sliderValue.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={currentBeat.interactionGate.inputRangeMin ?? 0}
                  max={currentBeat.interactionGate.inputRangeMax ?? 1}
                  step={0.01}
                  value={sliderValue}
                  onChange={(e) =>
                    handleSliderChange(parseFloat(e.target.value))
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Dive Deeper Curiosity Questions Toggle */}
            {currentBeat?.learnerCheckpoint?.suggestedDiveDeeperQuestions
              ?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-800">
                <button
                  onClick={() => setShowDiveDeeper((v) => !v)}
                  className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                >
                  <HelpCircle size={12} />
                  {showDiveDeeper
                    ? 'Hide Curiosity Checkpoints'
                    : 'Show Curiosity Checkpoints (2)'}
                </button>
                {showDiveDeeper && (
                  <ul className="mt-1.5 space-y-1 text-[11px] text-stone-300 list-disc list-inside">
                    {currentBeat.learnerCheckpoint.suggestedDiveDeeperQuestions.map(
                      (q: string, i: number) => (
                        <li key={i}>{q}</li>
                      )
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}