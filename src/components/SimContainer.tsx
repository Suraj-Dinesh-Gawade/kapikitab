'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface SimContainerProps {
  title?: string;
  subtitle?: string;
  statusText?: string;
  children: React.ReactNode;
}

export default function SimContainer({
  children,
}: SimContainerProps) {
  const [hideOverlays, setHideOverlays] = useState(false);

  return (
    <div 
      className={`sim-global-shell relative w-full h-full ${
        hideOverlays ? 'sim-hide-ui' : ''
      }`}
    >
      {/* Floating Toggle Button */}
      <button
        onClick={() => setHideOverlays(!hideOverlays)}
        className="absolute top-4 right-4 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer"
        title="Toggle UI Panels to see full simulation"
      >
        {hideOverlays ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-stone-400" />}
        <span>{hideOverlays ? 'Show Controls' : 'Hide Controls'}</span>
      </button>

      {/* Original Simulation Content (Untouched layout) */}
      <div className="sim-inner-stage w-full h-full">
        {children}
      </div>
    </div>
  );
}