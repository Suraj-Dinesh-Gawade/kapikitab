// src/components/interactives/spatial-engine/KapikitabAREnvironment.tsx
'use client';

import React, { useState, Suspense, useRef, createContext, useContext } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Text, RoundedBox } from '@react-three/drei';
import { createXRStore, XR, useXRHitTest, useXR } from '@react-three/xr';

// 1. Configure XR store with high frame-rate & hit-test support
const store = createXRStore({
  hitTest: true,
  foveation: 0, // Maximum sharpness on mobile screens
});
const matrixHelper = new THREE.Matrix4();

export const ARAnchorContext = createContext<{
  resetAnchor: () => void;
  isAR: boolean;
  arScale: number;
  setArScale: React.Dispatch<React.SetStateAction<number>>;
} | null>(null);

export function useARAnchor() {
  return useContext(ARAnchorContext);
}

// Animated Apple Vision Pro-style Placement Reticle
function SpatialPlacementReticle({
  onPlace,
}: {
  onPlace: (pos: THREE.Vector3, quat: THREE.Quaternion) => void;
}) {
  const reticleRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const hasHit = useRef(false);

  useXRHitTest((results, getWorldMatrix) => {
    if (reticleRef.current && results.length > 0) {
      getWorldMatrix(matrixHelper, results[0]);
      reticleRef.current.position.setFromMatrixPosition(matrixHelper);
      reticleRef.current.quaternion.setFromRotationMatrix(matrixHelper);
      hasHit.current = true;
    }
  }, 'viewer');

  useFrame((state) => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.08;
      pulseRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group
      ref={reticleRef}
      onClick={(e) => {
        e.stopPropagation();
        if (reticleRef.current) {
          onPlace(
            reticleRef.current.position.clone(),
            reticleRef.current.quaternion.clone()
          );
        }
      }}
    >
      {/* Outer Glowing Glass Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} ref={pulseRef} frustumCulled={false}>
        <ringGeometry args={[0.14, 0.17, 48]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Inner Target Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial
          color="#10b981"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Floating Spatial Instruction */}
      <Text
        position={[0, 0.14, 0]}
        fontSize={0.032}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.003}
        outlineColor="#000000"
      >
        TAP CIRCLE TO PLACE LAB HERE
      </Text>
    </group>
  );
}

function ARSceneManager({ children }: { children: React.ReactNode }) {
  const isAR = useXR((state) => state.mode === 'immersive-ar');
  const [anchorPos, setAnchorPos] = useState<THREE.Vector3 | null>(null);
  const [anchorYaw, setAnchorYaw] = useState<number>(0);
  const [arScale, setArScale] = useState<number>(0.65); // Ideal tabletop scale (65% of 1m bench)

  // PC MODE: Render standard OrbitControls + Grid
  if (!isAR) {
    return (
      <ARAnchorContext.Provider
        value={{
          resetAnchor: () => setAnchorPos(null),
          isAR: false,
          arScale: 1,
          setArScale,
        }}
      >
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <Environment preset="city" />
        <Grid
          position={[0, -0.05, 0]}
          args={[10, 10]}
          cellColor="#10b981"
          sectionColor="#10b981"
          fadeDistance={5}
          fadeStrength={1.5}
        />
        {children}
      </ARAnchorContext.Provider>
    );
  }

  // AR MODE: Clean passthrough without OrbitControls fighting the phone's gyroscope
  return (
    <ARAnchorContext.Provider
      value={{
        resetAnchor: () => setAnchorPos(null),
        isAR: true,
        arScale,
        setArScale,
      }}
    >
      {!anchorPos ? (
        <SpatialPlacementReticle
          onPlace={(pos, quat) => {
            const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
            setAnchorYaw(euler.y);
            setAnchorPos(pos);
          }}
        />
      ) : (
        <group
          position={anchorPos}
          rotation={[0, anchorYaw, 0]}
          scale={[arScale, arScale, arScale]}
        >
          {children}
        </group>
      )}
    </ARAnchorContext.Provider>
  );
}

export default function KapikitabAREnvironment({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full absolute inset-0 overflow-hidden z-10 pointer-events-auto">
      {/* Universal AR Entry Button */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={() => store.enterAR()}
          className="bg-emerald-400 text-stone-950 px-6 py-2.5 rounded-full text-xs font-extrabold tracking-widest uppercase shadow-xl hover:bg-emerald-300 transition-all"
        >
          View in Your Room (AR)
        </button>
      </div>

      {/* Optimized depth buffer (near: 0.05, far: 100) prevents mobile AR distortion */}
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 1.4, 1.8], fov: 50, near: 0.05, far: 100 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <XR store={store}>
          <Suspense fallback={null}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[3, 6, 4]} intensity={1.8} />
            <directionalLight position={[-3, 2, -2]} intensity={0.6} />

            <ARSceneManager>{children}</ARSceneManager>
          </Suspense>
        </XR>
      </Canvas>
    </div>
  );
}