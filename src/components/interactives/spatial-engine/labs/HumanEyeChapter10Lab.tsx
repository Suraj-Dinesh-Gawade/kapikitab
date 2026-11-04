// src/components/interactives/spatial-engine/labs/HumanEyeChapter10Lab.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Line, RoundedBox } from '@react-three/drei';
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

import KapikitabAREnvironment, {
  useARAnchor,
} from '../core/KapikitabAREnvironment';
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

function formatEntityLabel(instanceId: string): string {
  return instanceId
    .replace(/_main$/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// 1. CAMERA DIRECTOR (PC Mode Only — Never fights phone AR tracking)
// ============================================================================
function CameraDirector({
  cameraDirective,
  entityRefs,
  freeInspectMode,
  isAR,
}: {
  cameraDirective: any;
  entityRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  freeInspectMode: boolean;
  isAR: boolean;
}) {
  const { camera, controls } = useThree();
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

    const rawOffset = cameraDirective.cameraOffsetMeters || {
      x: 0,
      y: 0.22,
      z: 0.65,
    };
    const safeZ = Math.max(0.55, rawOffset.z || 0.65);
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
// 2. CUBOID PROXY ENTITY (100% Native WebGL — Zero Frustum Culling or HTML Bugs)
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

  const isDrivenByGate =
    interactionGate &&
    (interactionGate.targetInstanceId === entity.instanceId ||
      interactionGate.sourceToolOrInstanceId === entity.instanceId);

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

    groupRef.current.position.lerp(
      new THREE.Vector3(targetX, targetY, targetZ),
      Math.min(1, delta * 6)
    );

    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(baseRot.x || 0),
        THREE.MathUtils.degToRad(baseRot.y || 0),
        THREE.MathUtils.degToRad(rotZDeg)
      )
    );
    groupRef.current.quaternion.slerp(targetQuat, Math.min(1, delta * 6));

    const pulse = hasShaderMorph
      ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.06
      : 1;
    const s = uniformScale * pulse;
    groupRef.current.scale.lerp(
      new THREE.Vector3(s, s, s),
      Math.min(1, delta * 6)
    );

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.5;
    }
  });

  if (!placement) return null;

  const baseOpacity =
    isDrivenByGate && interactionGate.drivenProperty === 'material.opacity'
      ? mappedGateOutput
      : hasXray
      ? 0.28
      : 0.92;

  const activeMacroInfo = myMacros[myMacros.length - 1];

  return (
    <group
      ref={groupRef}
      frustumCulled={false}
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
      {/* OUTER CUBOID PROXY (frustumCulled={false} prevents mobile AR vanishing!) */}
      <RoundedBox
        args={style.size}
        radius={0.012}
        smoothness={4}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={hasShaderMorph ? '#38bdf8' : style.color}
          emissive={hovered || myMacros.length > 0 ? '#38bdf8' : '#000000'}
          emissiveIntensity={hovered ? 0.5 : myMacros.length > 0 ? 0.35 : 0}
          transparent={baseOpacity < 0.99}
          opacity={baseOpacity}
          depthWrite={baseOpacity > 0.5}
          roughness={0.25}
          metalness={0.25}
        />
      </RoundedBox>

      {/* INNER CORE SUB-NODE CUBOID */}
      <mesh scale={[0.52, 0.52, 0.52]} frustumCulled={false}>
        <boxGeometry args={style.size} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={hasXray ? 0.85 : 0.25}
          wireframe={!hasXray}
        />
      </mesh>

      {/* SEMANTIC SOCKETS */}
      {(entity.sockets || []).map((sock: any, idx: number) => (
        <mesh
          key={sock.socketName || idx}
          frustumCulled={false}
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
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} frustumCulled={false}>
          <ringGeometry args={[0.09, 0.108, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.95}
          />
        </mesh>
      )}

      {/* FLOATING 3D CUBOID TITLE */}
      <Text
        position={[0, style.size[1] / 2 + 0.045, 0]}
        fontSize={0.022}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.0025}
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

      {/* NATIVE 3D HOLOGRAM TELEMETRY BADGE (Works in Mobile AR & Vision Pro!) */}
      {activeMacroInfo && (
        <group position={[0, -style.size[1] / 2 - 0.055, 0.04]}>
          <RoundedBox args={[0.26, 0.055, 0.006]} radius={0.008} frustumCulled={false}>
            <meshStandardMaterial
              color="#0c0a09"
              emissive="#0ea5e9"
              emissiveIntensity={0.2}
              transparent
              opacity={0.92}
            />
          </RoundedBox>
          <Text
            position={[0, 0.008, 0.005]}
            fontSize={0.014}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.24}
          >
            {`${
              activeMacroInfo.params?.calloutLabel || activeMacroInfo.macroType
            }`}
          </Text>
          <Text
            position={[0, -0.011, 0.005]}
            fontSize={0.011}
            color="#34d399"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.24}
          >
            {activeMacroInfo.params?.telemetryValue ||
              activeMacroInfo.targetNodeName ||
              'Active'}
          </Text>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// 3. MANIM 3D GEOMETRIC OVERLAY
// ============================================================================
function ManimGeometricOverlay3D({
  manimOverlay,
  unlockedSyncMarkers,
}: {
  manimOverlay: any;
  unlockedSyncMarkers: string[];
}) {
  if (!manimOverlay || !manimOverlay.enabled) return null;

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
    <group frustumCulled={false}>
      <Line
        points={[
          [-0.75, originOffset.y, originOffset.z],
          [0.75, originOffset.y, originOffset.z],
        ]}
        color="#10b981"
        lineWidth={2}
        dashed
        dashSize={0.03}
        gapSize={0.02}
      />

      {(manimOverlay.vertices || []).map((v: any) => {
        const pos = vertexMap.get(v.id)!;
        return (
          <group key={v.id} position={pos} frustumCulled={false}>
            <mesh frustumCulled={false}>
              <sphereGeometry args={[0.014, 16, 16]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <Text
              position={[0, 0.032, 0]}
              fontSize={0.02}
              color="#38bdf8"
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.002}
              outlineColor="#000000"
            >
              {v.label}
            </Text>
          </group>
        );
      })}

      {verticesList.length >= 2 && (
        <Line
          points={verticesList.map(([, vec]) => [vec.x, vec.y, vec.z])}
          color="#38bdf8"
          lineWidth={2.5}
        />
      )}

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
          <mesh key={poly.polygonId} geometry={geom} frustumCulled={false}>
            <meshBasicMaterial
              color={poly.fillColorHex || '#38bdf8'}
              transparent
              opacity={poly.opacity ?? 0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ============================================================================
// 4. APPLE VISION PRO 3D SPATIAL GLASS CONSOLE (Interactive in Mobile AR!)
// ============================================================================
function Spatial3DButton({
  position,
  size = [0.16, 0.055, 0.012],
  label,
  active = false,
  accentColor = '#10b981',
  onClick,
}: {
  position: [number, number, number];
  size?: [number, number, number];
  label: string;
  active?: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={size} radius={0.012} smoothness={4} frustumCulled={false}>
        <meshStandardMaterial
          color={active ? accentColor : hovered ? '#292524' : '#1c1917'}
          emissive={active || hovered ? accentColor : '#000000'}
          emissiveIntensity={active ? 0.35 : hovered ? 0.2 : 0}
          roughness={0.2}
          metalness={0.3}
        />
      </RoundedBox>
      <Text
        position={[0, 0, size[2] / 2 + 0.003]}
        fontSize={0.018}
        color={active ? '#0c0a09' : '#f5f5f4'}
        anchorX="center"
        anchorY="middle"
        maxWidth={size[0] - 0.02}
      >
        {label}
      </Text>
    </group>
  );
}

function SpatialVisionProConsole3D({
  currentBeat,
  currentBeatIdx,
  totalBeats,
  isPlaying,
  setIsPlaying,
  onPrevBeat,
  onNextBeat,
  unlockedSyncMarkers,
  onTriggerSyncIndex,
  sliderValue,
  onStepSlider,
  gateCompleted,
}: {
  currentBeat: any;
  currentBeatIdx: number;
  totalBeats: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  onPrevBeat: () => void;
  onNextBeat: () => void;
  unlockedSyncMarkers: string[];
  onTriggerSyncIndex: (idx: number) => void;
  sliderValue: number;
  onStepSlider: (delta: number) => void;
  gateCompleted: boolean;
}) {
  const arContext = useARAnchor();
  const [hudHidden, setHudHidden] = useState(false);

  // Current active spoken sentence
  const activeSpokenSegment = useMemo(() => {
    const segs = currentBeat?.narrationSegments || [];
    if (segs.length === 0) return currentBeat?.narrationText || '';
    const lastSync = unlockedSyncMarkers[unlockedSyncMarkers.length - 1];
    const found = segs.find((s: any) => s.syncMarker === lastSync);
    return found ? found.spokenText : segs[0].spokenText;
  }, [currentBeat, unlockedSyncMarkers]);

  const formulaLatex =
    currentBeat?.manimOverlay?.katexFormulaSteps?.[0]?.latex ||
    currentBeat?.continuousPhysicsBindings?.[0]?.mathematicalFormula ||
    'Interactive Spatial Mode';

  return (
    <group frustumCulled={false}>
      {/* ====================================================================
          ZONE 3: ULTRA-LOW FRONT-LIP MICRO DOCK (Below table level: y = -0.04)
          Never blocks any cuboid or ray, lets you toggle UI or step beats fast
      ==================================================================== */}
      <group
        position={[0, -0.045, 0.36]}
        rotation={[-0.45, 0, 0]}
        frustumCulled={false}
      >
        <RoundedBox
          args={[0.76, 0.065, 0.012]}
          radius={0.015}
          smoothness={4}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#0c0a09"
            roughness={0.2}
            metalness={0.4}
            transparent
            opacity={0.9}
          />
        </RoundedBox>

        <Spatial3DButton
          position={[-0.27, 0, 0.01]}
          size={[0.14, 0.042, 0.01]}
          label="<< Beat"
          onClick={onPrevBeat}
        />
        <Spatial3DButton
          position={[-0.1, 0, 0.01]}
          size={[0.15, 0.042, 0.01]}
          label={isPlaying ? 'PAUSE' : 'PLAY'}
          active={isPlaying}
          onClick={() => setIsPlaying((p) => !p)}
        />
        <Spatial3DButton
          position={[0.07, 0, 0.01]}
          size={[0.14, 0.042, 0.01]}
          label="Beat >>"
          onClick={onNextBeat}
        />
        <Spatial3DButton
          position={[0.25, 0, 0.01]}
          size={[0.17, 0.042, 0.01]}
          label={hudHidden ? 'Show Wings' : 'Clean View'}
          active={hudHidden}
          accentColor="#38bdf8"
          onClick={() => setHudHidden((v) => !v)}
        />
      </group>

      {!hudHidden && (
        <>
          {/* ================================================================
              ZONE 1: LEFT WING POD (NARRATION, BEAT TITLE & SYNC ANCHORS)
              Anchored outside the left edge of the bench, angled +26 deg inward
          ================================================================ */}
          <group
            position={[-0.86, 0.25, 0.14]}
            rotation={[-0.18, 0.46, 0]}
            frustumCulled={false}
          >
            {/* Left Frosted Glass Backplate */}
            <RoundedBox
              args={[0.62, 0.42, 0.014]}
              radius={0.022}
              smoothness={4}
              frustumCulled={false}
            >
              <meshStandardMaterial
                color="#0c0a09"
                roughness={0.15}
                metalness={0.4}
                transparent
                opacity={0.86}
              />
            </RoundedBox>

            {/* Top Emerald Accent Header */}
            <Text
              position={[0, 0.165, 0.011]}
              fontSize={0.019}
              color="#34d399"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.56}
            >
              {`BEAT ${currentBeatIdx + 1}/${totalBeats}: ${
                currentBeat?.conceptTitle || ''
              }`}
            </Text>

            {/* Spoken Narration Subtitle */}
            <Text
              position={[0, 0.055, 0.011]}
              fontSize={0.0165}
              color="#f5f5f4"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              maxWidth={0.55}
            >
              {activeSpokenSegment}
            </Text>

            {/* Sync Anchor Triggers */}
            <Text
              position={[-0.22, -0.055, 0.011]}
              fontSize={0.013}
              color="#a8a29e"
              anchorX="left"
              anchorY="middle"
            >
              WORD SYNC:
            </Text>
            {(currentBeat?.narrationSegments || []).map(
              (seg: any, idx: number) => (
                <Spatial3DButton
                  key={seg.segmentId}
                  position={[-0.04 + idx * 0.14, -0.055, 0.011]}
                  size={[0.12, 0.045, 0.01]}
                  label={seg.syncMarker.replace('anchor_', 'Sync ')}
                  active={unlockedSyncMarkers.includes(seg.syncMarker)}
                  accentColor="#38bdf8"
                  onClick={() => onTriggerSyncIndex(idx)}
                />
              )
            )}

            {/* Transport Row */}
            <Spatial3DButton
              position={[-0.19, -0.14, 0.011]}
              size={[0.16, 0.048, 0.01]}
              label="<< Prev"
              onClick={onPrevBeat}
            />
            <Spatial3DButton
              position={[0, -0.14, 0.011]}
              size={[0.18, 0.048, 0.01]}
              label={isPlaying ? 'PAUSE' : 'PLAY'}
              active={isPlaying}
              onClick={() => setIsPlaying((p) => !p)}
            />
            <Spatial3DButton
              position={[0.19, -0.14, 0.011]}
              size={[0.16, 0.048, 0.01]}
              label="Next >>"
              onClick={onNextBeat}
            />
          </group>

          {/* ================================================================
              ZONE 2: RIGHT WING POD (MANIM FORMULA, PHYSICS SLIDER & AR TOOLS)
              Anchored outside the right edge of the bench, angled -26 deg inward
          ================================================================ */}
          <group
            position={[0.86, 0.25, 0.14]}
            rotation={[-0.18, -0.46, 0]}
            frustumCulled={false}
          >
            {/* Right Frosted Glass Backplate */}
            <RoundedBox
              args={[0.62, 0.42, 0.014]}
              radius={0.022}
              smoothness={4}
              frustumCulled={false}
            >
              <meshStandardMaterial
                color="#0c0a09"
                roughness={0.15}
                metalness={0.4}
                transparent
                opacity={0.86}
              />
            </RoundedBox>

            {/* Right Panel Header */}
            <Text
              position={[0, 0.165, 0.011]}
              fontSize={0.018}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.56}
            >
              MANIM FORMULA & CONTROLS
            </Text>

            {/* Formula Box */}
            <Text
              position={[0, 0.105, 0.011]}
              fontSize={0.0165}
              color="#fde047"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              maxWidth={0.55}
            >
              {formulaLatex}
            </Text>

            {/* Interactive Gate Prompt */}
            <Text
              position={[0, 0.035, 0.011]}
              fontSize={0.0145}
              color="#d6d3d1"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              maxWidth={0.55}
            >
              {currentBeat?.interactionGate?.promptText ||
                'Tap or adjust parameter below:'}
            </Text>

            {/* Parameter Stepper Row */}
            <Spatial3DButton
              position={[-0.2, -0.055, 0.011]}
              size={[0.14, 0.048, 0.01]}
              label="Param [-]"
              accentColor="#38bdf8"
              onClick={() => onStepSlider(-0.15)}
            />
            <Text
              position={[0, -0.055, 0.011]}
              fontSize={0.0155}
              color={gateCompleted ? '#34d399' : '#ffffff'}
              anchorX="center"
              anchorY="middle"
              maxWidth={0.22}
            >
              {`${
                currentBeat?.interactionGate?.drivenProperty || 'val'
              }: ${sliderValue.toFixed(2)}`}
            </Text>
            <Spatial3DButton
              position={[0.2, -0.055, 0.011]}
              size={[0.14, 0.048, 0.01]}
              label="Param [+]"
              accentColor="#38bdf8"
              onClick={() => onStepSlider(0.15)}
            />

            {/* AR Scale & Move Lab Row */}
            {arContext?.isAR && (
              <>
                <Spatial3DButton
                  position={[-0.19, -0.14, 0.011]}
                  size={[0.15, 0.048, 0.01]}
                  label="Scale -"
                  onClick={() =>
                    arContext.setArScale((s) => Math.max(0.3, s - 0.1))
                  }
                />
                <Spatial3DButton
                  position={[0, -0.14, 0.011]}
                  size={[0.15, 0.048, 0.01]}
                  label="Scale +"
                  onClick={() =>
                    arContext.setArScale((s) => Math.min(1.4, s + 0.1))
                  }
                />
                <Spatial3DButton
                  position={[0.19, -0.14, 0.011]}
                  size={[0.17, 0.048, 0.01]}
                  label="Move Lab"
                  accentColor="#f59e0b"
                  onClick={() => arContext.resetAnchor()}
                />
              </>
            )}
          </group>
        </>
      )}
    </group>
  );
}

// ============================================================================
// 5. INTERNAL SCENE STAGE (Normalizes JSON Standing Coords to Tabletop Origin)
// ============================================================================
function NormalizedSpatialStage({
  entities,
  placementByInstanceId,
  activeMacros,
  currentBeat,
   currentBeatIdx,
  totalBeats,
  isPlaying,
  setIsPlaying,
  onPrevBeat,
  onNextBeat,
  unlockedSyncMarkers,
  onTriggerSyncIndex,
  sliderValue,
  onStepSlider,
  gateCompleted,
  handleEntityTap,
  entityRefs,
  registerEntityRef,
  freeInspectMode,
}: any) {
  const arContext = useARAnchor();
  const isAR = Boolean(arContext?.isAR);

  // CRITICAL AR FIX:
  // In JSON, the workbench is at [0, 0.88, -1.0] and cuboids are at y=1.0..1.48, z=-1.0.
  // In AR, shifting by [0, -0.88, +1.0] places the workbench and cuboids directly on the user's desk!
  const stageOffset: [number, number, number] = isAR
    ? [0, -0.88, 1.0]
    : [0, 0, 0];

  return (
    <group frustumCulled={false}>
      <CameraDirector
        cameraDirective={currentBeat?.cameraDirective}
        entityRefs={entityRefs}
        freeInspectMode={freeInspectMode}
        isAR={isAR}
      />

      {/* NORMALIZED WORKBENCH & ENTITIES GROUP */}
      <group position={stageOffset} frustumCulled={false}>
        {/* OPTICAL BENCH WORKSURFACE */}
        <mesh position={[0, 0.88, -1.0]} frustumCulled={false}>
          <boxGeometry args={[1.65, 0.025, 0.6]} />
          <meshStandardMaterial
            color="#1c1917"
            roughness={0.7}
            metalness={0.3}
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
      </group>

      {/* APPLE VISION PRO 3D SPATIAL CONSOLE (Always available in AR!) */}
      {isAR && (
        <SpatialVisionProConsole3D
          currentBeat={currentBeat}
          currentBeatIdx={currentBeatIdx}
          totalBeats={totalBeats}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onPrevBeat={onPrevBeat}
          onNextBeat={onNextBeat}
          unlockedSyncMarkers={unlockedSyncMarkers}
          onTriggerSyncIndex={onTriggerSyncIndex}
          sliderValue={sliderValue}
          onStepSlider={onStepSlider}
          gateCompleted={gateCompleted}
        />
      )}
    </group>
  );
}

// ============================================================================
// 6. MAIN EXPORTED R3F COMPONENT
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

  const [currentBeatIdx, setCurrentBeatIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [freeInspectMode, setFreeInspectMode] = useState(false);

  const [sliderValue, setSliderValue] = useState(0);
  const [gateCompleted, setGateCompleted] = useState(false);
  const [showDiveDeeper, setShowDiveDeeper] = useState(false);

  const entityRefs = useRef<Record<string, THREE.Group | null>>({});
  const registerEntityRef = (id: string, ref: THREE.Group | null) => {
    entityRefs.current[id] = ref;
  };

  const currentBeat = allBeats[currentBeatIdx] || allBeats[0];
  const currentModule = modules.find(
    (m: any) => m.moduleId === currentBeat?.moduleId
  );

  useEffect(() => {
    if (!currentBeat) return;
    setElapsedMs(0);
    setGateCompleted(false);
    setFreeInspectMode(false);

    const gate = currentBeat.interactionGate;
    if (gate) {
      const mid =
        ((gate.inputRangeMin ?? 0) + (gate.inputRangeMax ?? 1)) / 2;
      setSliderValue(mid);
    }
  }, [currentBeatIdx, currentBeat]);

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

  const activeMacros = useMemo(() => {
    if (!currentBeat) return [];
    return (currentBeat.wordSyncedHologramMacros || []).filter((m: any) =>
      unlockedSyncMarkers.includes(m.syncMarker)
    );
  }, [currentBeat, unlockedSyncMarkers]);

  const placementByInstanceId = useMemo(() => {
    const map: Record<string, any> = {};
    (currentBeat?.entityPlacements || []).forEach((p: any) => {
      map[p.instanceId] = p;
    });
    return map;
  }, [currentBeat]);

  const handleEntityTap = () => {
    setGateCompleted(true);
  };

  const handleSliderChange = (val: number) => {
    const min = currentBeat?.interactionGate?.inputRangeMin ?? 0;
    const max = currentBeat?.interactionGate?.inputRangeMax ?? 1;
    const clamped = Math.max(min, Math.min(max, val));
    setSliderValue(clamped);

    const target = currentBeat?.interactionGate?.successTargetValue ?? 0.5;
    const range = Math.abs(max - min) || 1;
    if (Math.abs(clamped - target) <= range * 0.25) {
      setGateCompleted(true);
    }
  };

  const handleStepSlider = (fractionDelta: number) => {
    const min = currentBeat?.interactionGate?.inputRangeMin ?? 0;
    const max = currentBeat?.interactionGate?.inputRangeMax ?? 1;
    const step = (max - min) * fractionDelta;
    handleSliderChange(sliderValue + step);
  };

  return (
    <div className="relative w-full h-full min-h-[640px] bg-stone-950 text-stone-100 overflow-hidden select-none font-sans">
      {/* ====================================================================
          3D SPATIAL CANVAS (PC + APPLE VISION PRO MOBILE AR PASSTHROUGH)
      ==================================================================== */}
      <KapikitabAREnvironment>
        <NormalizedSpatialStage
          entities={entities}
          placementByInstanceId={placementByInstanceId}
          activeMacros={activeMacros}
          currentBeat={currentBeat}
          currentBeatIdx={currentBeatIdx}
          totalBeats={allBeats.length}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onPrevBeat={() => setCurrentBeatIdx((i) => Math.max(0, i - 1))}
          onNextBeat={() =>
            setCurrentBeatIdx((i) => Math.min(allBeats.length - 1, i + 1))
          }
          unlockedSyncMarkers={unlockedSyncMarkers}
          onTriggerSyncIndex={(idx: number) => {
            setIsPlaying(false);
            const segs = currentBeat?.narrationSegments || [];
            setElapsedMs(
              ((idx + 0.1) / Math.max(1, segs.length)) *
                (currentBeat?.durationMs || 18000)
            );
          }}
          sliderValue={sliderValue}
          onStepSlider={handleStepSlider}
          gateCompleted={gateCompleted}
          handleEntityTap={handleEntityTap}
          entityRefs={entityRefs}
          registerEntityRef={registerEntityRef}
          freeInspectMode={freeInspectMode}
        />
      </KapikitabAREnvironment>

      {/* ====================================================================
          2D DESKTOP / TABLET HUD OVERLAYS (For Non-AR Browser Testing)
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

      {/* RIGHT HUD */}
      <div className="hidden md:block absolute top-20 right-4 z-30 w-80 bg-stone-900/85 backdrop-blur-md border border-stone-800 rounded-2xl p-3.5 shadow-2xl pointer-events-auto space-y-3">
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
            Tactile Exploration Mode — No geometric proof overlay required.
          </div>
        )}

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
      </div>

      {/* BOTTOM HUD */}
      <div className="absolute bottom-4 left-4 right-4 z-30 flex flex-col md:flex-row gap-3 items-stretch pointer-events-auto">
        <div className="flex-1 bg-stone-900/90 backdrop-blur-md border border-stone-800 rounded-2xl p-4 shadow-2xl flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
              <span>WORD-SYNCED NARRATION SEGMENTS</span>
              <div className="flex gap-1.5">
                {(currentBeat?.narrationSegments || []).map((seg: any, idx: number) => {
                  const active = unlockedSyncMarkers.includes(seg.syncMarker);
                  return (
                    <button
                      key={seg.segmentId}
                      onClick={() => {
                        setIsPlaying(false);
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

          <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-stone-800">
            <button
              onClick={() => setCurrentBeatIdx((i) => Math.max(0, i - 1))}
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