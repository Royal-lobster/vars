'use client';

import { useState } from 'react';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="group flex h-11 items-center gap-3 rounded-lg border border-white/[0.06] bg-black/40 px-4 font-mono text-sm backdrop-blur-sm transition-all hover:border-green-500/20 hover:bg-black/50"
      onClick={() => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span className="text-white/30">$</span>
      <span className="text-white/50">{command}</span>
      <span className="ml-1 text-[10px] text-white/20 transition-colors group-hover:text-green-500">
        {copied ? 'Copied!' : 'Copy'}
      </span>
    </button>
  );
}
