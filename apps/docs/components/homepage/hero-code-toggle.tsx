'use client';

import { useRef, useState, useCallback, useEffect, type ReactNode, type PointerEvent } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface HeroCodeToggleProps {
  unlocked: ReactNode;
  vault: ReactNode;
}

export function HeroCodeToggle({ unlocked, vault }: HeroCodeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  }, [isDragging, updatePosition]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="mt-14 w-full max-w-[620px] text-left">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="flex items-center gap-1.5 font-mono text-xs text-green-400/60">
          <Unlock size={12} />
          unlocked.vars
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-white/30">
          vault.vars
          <Lock size={12} />
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-white/[0.06] select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Vault (encrypted) layer — full width, sits behind */}
        <div className="relative">
          {vault}
        </div>

        {/* Unlocked (plaintext) layer — clipped from the left */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <div style={{ width: containerRef.current?.offsetWidth ?? '100%' }}>
            {unlocked}
          </div>
        </div>

        {/* Drag handle */}
        <div
          className="absolute top-0 bottom-0 z-10 flex cursor-col-resize items-center"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="h-full w-px bg-green-500/50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-[#0a0a0a] shadow-lg shadow-black/50">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-green-500">
              <path d="M4.5 3L1.5 7L4.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 3L12.5 7L9.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
