"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Maximize, Minimize, Loader2, Sparkles, ArrowRight, Eye } from 'lucide-react';

// Explicitly importing the Orchestrator with its proper name
import SimulationRouter from '@/components/interactives/SimulationRouter';

type GraphicAsset = {
  _id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  modelUrl: string;
  themeColor: string;
  accentColor: string;
  glowColor: string;
  componentRef?: string;
};

export default function SimulationPage() {
  const [simulations, setSimulations] = useState<GraphicAsset[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isIsolated, setIsIsolated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGraphics = async () => {
      try {
        const res = await fetch('/api/content/graphics');
        const data = await res.json();
        setSimulations(data);
        if (data.length > 0) setActiveSimId(data[0]._id);
      } catch (error) {
        console.error("Failed to load 3D graphics:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGraphics();

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error("Fullscreen failed:", err));
    } else {
      document.exitFullscreen();
    }
  };

  if (isLoading) return <div className="flex-1 w-full flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-stone-500 dark:text-slate-400" size={32} /></div>;
  if (simulations.length === 0 || !activeSimId) return <div className="p-8 text-stone-500 dark:text-slate-400 text-center">No 3D virtual labs available yet.</div>;

  const activeSim = simulations.find(s => s._id === activeSimId) || simulations[0];
  const inactiveSims = simulations.filter(s => s._id !== activeSimId);

  return (
    <div className="flex-1 w-full flex flex-col relative max-w-6xl mx-auto px-4 lg:px-8 pt-4 pb-32 overflow-y-auto no-scrollbar transition-colors duration-500">
      
      {/* Header */}
      <div className="mb-6 flex justify-between items-end transition-colors duration-500">
        <div>
          <h1 className="text-4xl font-serif text-stone-900 dark:text-slate-100 tracking-tight mb-2 transition-colors">Virtual Labs</h1>
          <p className="text-stone-500 dark:text-slate-400 font-light text-lg transition-colors">Learn by doing. Enter the metaverse.</p>
        </div>
        <div className="hidden md:flex items-center space-x-2 text-sm font-medium text-stone-700 dark:text-slate-300 bg-stone-100 dark:bg-[#282C3D] px-4 py-2 rounded-full border border-stone-200 dark:border-slate-700 shadow-sm transition-colors">
          <Sparkles size={16} className="animate-pulse text-emerald-600 dark:text-blue-400" />
          <span>{simulations.length} Labs Online</span>
        </div>
      </div>

      {/* --- CINEMATIC HOLOGRAM VIEWER --- */}
      <div 
        ref={containerRef} 
        className={`relative w-full shadow-2xl overflow-hidden bg-stone-950 dark:bg-[#0F1117] flex flex-col md:flex-row items-center transition-all duration-300 ${
          isFullscreen ? 'h-screen rounded-none border-none' : 'min-h-[500px] md:h-[600px] rounded-[2.5rem] p-1 border border-stone-800 dark:border-slate-800'
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div key={activeSim._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className={`absolute inset-0 bg-gradient-to-br ${activeSim.themeColor} mix-blend-overlay`} />
        </AnimatePresence>

        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Top Controls */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-30 pointer-events-none">
          <motion.span 
            key={`tag-${activeSim._id}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg ${activeSim.glowColor} transition-opacity duration-500 ${isIsolated ? 'opacity-0' : 'opacity-100'}`}
          >
            {activeSim.category}
          </motion.span>
          
          <div className="flex items-center gap-3 pointer-events-auto">
            <AnimatePresence>
              {isIsolated && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setIsIsolated(false)}
                  className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full flex items-center gap-2 text-white border border-white/20 hover:bg-white/20 transition-colors text-sm font-medium"
                >
                  <Eye size={16} /> Show Info
                </motion.button>
              )}
            </AnimatePresence>
            
            <button onClick={toggleFullscreen} className="h-12 w-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/20 transition-colors">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>

        {/* Left Side: Content */}
        <div className={`relative z-10 flex flex-col justify-center pointer-events-none transition-all duration-700 ease-in-out ${
          isIsolated ? 'w-0 h-0 opacity-0 overflow-hidden p-0' : 'w-full md:w-1/3 h-auto md:h-full p-8 md:p-12 opacity-100'
        }`}>
          <AnimatePresence mode="wait">
            {!isIsolated && (
              <motion.div key={`content-${activeSim._id}`} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.5 }}>
                <h2 className="text-4xl md:text-5xl font-serif text-white mb-4 leading-[1.1] tracking-tight drop-shadow-lg">{activeSim.title}</h2>
                <p className="text-white/80 text-base font-light mb-10 max-w-sm leading-relaxed">{activeSim.description}</p>
                <button onClick={() => setIsIsolated(true)} className="pointer-events-auto group relative inline-flex items-center justify-center px-6 py-3 bg-stone-100 dark:bg-blue-500 text-stone-900 dark:text-white rounded-full text-sm font-bold overflow-hidden transition-all hover:scale-105 shadow-md">
                  <Play size={16} fill="currentColor" className="mr-3" />
                  <span>Isolate Model</span>
                  <ArrowRight size={16} className="ml-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all absolute right-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: LIVE WEBXR MODEL VIEWER OR R3F ENGINE */}
        <div className={`relative z-20 flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-700 ease-in-out ${
          isIsolated ? 'w-full h-full flex-1' : 'w-full md:w-2/3 h-[400px] md:h-full'
          }`}>
          {/* Added this div */}
          <div className="sim-responsive-viewport w-full h-full flex items-center justify-center overflow-hidden"></div>
          <SimulationRouter 
            activeSim={activeSim} 
            isFullscreen={isFullscreen} 
          />
          </div>
          {/* Panning & Zooming Hint Toast */}
          <AnimatePresence>
            {isIsolated && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-stone-900/80 backdrop-blur-md text-white/90 px-5 py-2.5 rounded-full text-[11px] sm:text-xs font-medium tracking-wide z-50 pointer-events-none text-center whitespace-nowrap shadow-lg border border-white/10"
              >
                <span className="md:hidden">✌️ Two fingers to pan & zoom</span>
                <span className="hidden md:inline">🖱️ Right-click & drag to pan</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      {/* --- CAROUSEL OF OTHER LABS --- */}
      <div className={`mt-10 transition-all duration-500 ${isFullscreen ? 'opacity-0 hidden' : 'opacity-100'}`}>
        <h3 className="text-xl font-medium text-stone-800 dark:text-slate-200 mb-6 font-serif transition-colors">Explore the Warehouse</h3>
        <div className="flex space-x-5 overflow-x-auto no-scrollbar pb-6 pl-2 -ml-2">
          {inactiveSims.map((sim) => (
            <motion.button
              key={sim._id}
              whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setActiveSimId(sim._id); setIsIsolated(false); }}
              className="flex-shrink-0 w-80 p-6 rounded-[2rem] bg-white dark:bg-[#282C3D] border border-stone-200 dark:border-slate-700 shadow-sm hover:border-emerald-300 dark:hover:border-blue-500 transition-all text-left group"
            >
              <span className="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-blue-400/80 block mb-2 transition-colors">{sim.category}</span>
              <h4 className="text-xl font-serif text-stone-800 dark:text-slate-100 mb-2 group-hover:text-emerald-700 dark:group-hover:text-blue-300 transition-colors tracking-tight">{sim.title}</h4>
              <p className="text-sm text-stone-500 dark:text-slate-400 font-light leading-relaxed truncate transition-colors">{sim.subtitle}</p>
            </motion.button>
          ))}
        </div>
      </div>

    </div>
  );
}