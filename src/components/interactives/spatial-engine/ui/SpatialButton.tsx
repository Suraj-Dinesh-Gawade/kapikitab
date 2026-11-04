'use client';

import React, { useState } from 'react';
import { Text } from '@react-three/drei';
import { useARAnchor } from '../core/KapikitabAREnvironment';

interface SpatialButtonProps {
  position: [number, number, number];
  label: string;
  onTrigger: () => void;
  isPrimary?: boolean;
  isDanger?: boolean;
}

export default function SpatialButton({ position, label, onTrigger, isPrimary = false, isDanger = false }: SpatialButtonProps) {
  const [pressed, setPressed] = useState(false);
  const arContext = useARAnchor();

  const baseColor = isDanger ? "#7f1d1d" : (isPrimary ? "#44403c" : "#292524");
  const highlightColor = isDanger ? "#ef4444" : "#10b981"; 
  const size: [number, number, number] = isPrimary ? [0.35, 0.12, 0.04] : [0.15, 0.08, 0.02];

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setPressed(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20); 
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    setPressed(false);
  };

  // THE FIX: Added a dedicated click handler that resists OrbitControls interference
  const handleClick = (e: any) => {
    e.stopPropagation();
    setPressed(false);
    
    if (isDanger && label === "RE-ANCHOR" && arContext) {
      arContext.resetAnchor();
    } else {
      onTrigger();
    }
  };

  return (
    <group position={position}>
      {/* THE FIX: Replaced visible={false} with a fully transparent material so the Raycaster detects it from all angles! */}
      {/* Expanded the Z-axis hitbox slightly more for easier AR tapping */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onClick={handleClick}
      >
        <boxGeometry args={[size[0] * 1.5, size[1] * 1.5, size[2] * 4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh scale={pressed ? 0.9 : 1} frustumCulled={false}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={pressed ? highlightColor : baseColor} roughness={0.9} />
      </mesh>

      <Text
        position={[0, 0, size[2] / 2 + 0.005]}
        fontSize={isPrimary ? 0.045 : 0.03}
        color={pressed ? "#ffffff" : (isDanger ? "#fecaca" : "#10b981")}
        anchorX="center"
        anchorY="middle"
        frustumCulled={false}
      >
        {label}
      </Text>
    </group>
  );
}