'use client';

import React from 'react';

interface SimulationWrapperProps {
  children: React.ReactNode;
}

export default function SimulationWrapper({ children }: SimulationWrapperProps) {
  return (
    <div className="sim-master-wrapper w-full max-w-5xl mx-auto my-4 px-2 sm:px-4">
      {children}
    </div>
  );
}