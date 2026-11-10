'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import SimContainer from '@/components/SimContainer';

// Domain 1 has been deleted.

// Domain 2 Default Fallback
import XRViewer from './model-viewer/XRViewer';

// THE FIX: Import LoadingState from the new shared file
import { LoadingState } from './LoadingState';

// Curriculum Registries
import { class8MathRegistry } from '@/components/interactives/curriculum/math/class-8/class8MathRegistry';
import { class9MathRegistry } from '@/components/interactives/curriculum/math/class-9/class9MathRegistry';
import { class10MathRegistry } from './curriculum/math/class-10/class10MathRegistry';
import { class11MathRegistry } from './curriculum/math/class-11/class11MathRegistry';
import { class12MathRegistry } from './curriculum/math/class-12/class12MathRegistry';

export const MasterSimulationRegistry = {
  ...class8MathRegistry,
  ...class9MathRegistry,
  ...class10MathRegistry,
  ...class11MathRegistry,
  ...class12MathRegistry,
};


// ==================================================================
// DOMAIN 2: Lightweight 3D (<model-viewer>)
// For displaying biological models and pure animations from Blender.
// ==================================================================
const modelViewerRegistry: Record<string, React.ComponentType<any>> = {
  'InteractiveWolf': dynamic(() => import('./model-viewer/wrappers/InteractiveWolf'), { loading: LoadingState }),
  'InteractiveBrain': dynamic(() => import('./model-viewer/wrappers/InteractiveBrain'), { loading: LoadingState }),
  'RocketLaunch3D': dynamic(() => import('./model-viewer/wrappers/RocketLaunch3D'), { loading: LoadingState }),
  'InteractiveDoll': dynamic(() => import('./model-viewer/wrappers/InteractiveDoll'), { loading: LoadingState }),
};

// ==================================================================
// DOMAIN 3: Heavy Spatial Engine (R3F)
// For fully interactive physics and chemistry labs.
// ==================================================================
const spatialEngineRegistry: Record<string, React.ComponentType<any>> = {
  'GravityLabR3F': dynamic(() => import('./spatial-engine/labs/GravityLabR3F'), { ssr: false, loading: LoadingState }),
  'ChemistryTestLab': dynamic(() => import('./spatial-engine/labs/ChemistryTestLab'), { ssr: false, loading: LoadingState }),
  'WindTunnelLab': dynamic(() => import('./spatial-engine/labs/WindTunnelLab'), { ssr: false, loading: LoadingState }),
  'CollisionLab': dynamic(() => import('./spatial-engine/labs/CollisionLab'), { ssr: false, loading: LoadingState }),
// NEW: Class 10 Human Eye & Colourful World Cuboid Proxy Lab
  'HumanEyeChapter10Lab': dynamic(() => import('./spatial-engine/labs/HumanEyeChapter10Lab'), { ssr: false, loading: LoadingState }),
};

// ==================================================================
// THE ORCHESTRATOR
// ==================================================================
//added subtitle and description
interface SimulationRouterProps {
  activeSim: {
    title: string;
    subtitle?: string;
    description?: string;
    modelUrl?: string;
    componentRef?: string;
  };
  isFullscreen: boolean;
}

export default function SimulationRouter({ activeSim, isFullscreen }: SimulationRouterProps) {
  const ref = activeSim?.componentRef;
  console.log("ROUTER DIAGNOSTIC -> Received Ref:", ref, "| Found in Registry:", !!MasterSimulationRegistry[ref as keyof typeof MasterSimulationRegistry]);

  //added content variable, and in each route instaed of return storing the value in the content variable.And also wrap them into SimContainer
  
 let content = null;

  if (ref) {
    // Route 1: Master Curriculum Registry
    if (MasterSimulationRegistry[ref as keyof typeof MasterSimulationRegistry]) {
      const CurriculumSim = MasterSimulationRegistry[ref as keyof typeof MasterSimulationRegistry];
      content = <CurriculumSim modelUrl={activeSim.modelUrl} isFullscreen={isFullscreen} title={activeSim.title} />;
    }
    // Route 2: DOMAIN 3 (The Spatial Engine)
    else if (spatialEngineRegistry[ref]) {
      const SpatialLab = spatialEngineRegistry[ref];
      content = <SpatialLab modelUrl={activeSim.modelUrl} isFullscreen={isFullscreen} title={activeSim.title} />;
    }
    // Route 3: DOMAIN 2
    else if (modelViewerRegistry[ref]) {
      const ModelViewerWrapper = modelViewerRegistry[ref];
      content = <ModelViewerWrapper modelUrl={activeSim.modelUrl} isFullscreen={isFullscreen} title={activeSim.title} />;
    }
  }

  // Route 4: Fallback (3D Model with no code)
  if (!content && activeSim?.modelUrl) {
    content = <XRViewer src={activeSim.modelUrl} alt={activeSim.title} isFullscreen={isFullscreen} />;
  }

  // Error Catching Fallback
  if (!content) {
    content = (
      <div className="p-6 bg-red-950/30 border border-red-900 rounded-xl text-red-400 text-sm flex flex-col items-center justify-center h-full min-h-[400px]">
        <strong>Configuration Error</strong>
        <p>Simulation "{ref || 'Unknown'}" is missing from the Router.</p>
      </div>
    );
  }

  // Wrap the chosen simulation content once inside SimContainer
  return (
    <SimContainer
      title={activeSim.title}
      subtitle={activeSim.subtitle}
      statusText={activeSim.description}
    >
      {content}
    </SimContainer>
  );
}