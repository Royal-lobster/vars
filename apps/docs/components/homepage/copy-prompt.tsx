'use client';

export function CopyPrompt() {
  const prompt = 'Setup vars in my project using https://vars.dev/llms-full.txt';

  return (
    <>
      <button
        type="button"
        className="group relative mt-2 flex w-full max-w-[480px] cursor-pointer items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 transition-all hover:border-green-500/20 hover:bg-white/[0.05]"
        onClick={() => navigator.clipboard.writeText(prompt)}
      >
        <span className="font-mono text-xs text-white/30">$</span>
        <span className="flex-1 truncate text-left font-mono text-xs text-white/50">
          {prompt}
        </span>
        <span className="shrink-0 text-[10px] text-white/20 transition-colors group-hover:text-green-500">
          Click to copy
        </span>
      </button>
      <p className="text-[11px] text-white/25">
        Paste into Claude Code, Cursor, or any AI coding agent
      </p>
    </>
  );
}
