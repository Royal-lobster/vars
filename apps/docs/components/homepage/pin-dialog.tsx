import { Lock } from 'lucide-react';

export function PinDialog() {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Terminal prompt line */}
      <div className="w-full max-w-[420px] rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <p className="font-mono text-[13px] text-white/50">
          <span className="text-green-500">$</span>{' '}
          <span className="text-white/70">cursor run</span>{' '}
          <span className="text-green-400/70">&quot;add a new database migration&quot;</span>
        </p>
      </div>

      {/* macOS dialog — purely illustrative */}
      <div
        aria-hidden="true"
        role="presentation"
        className="relative w-full max-w-[380px] rounded-xl border border-white/[0.12] bg-[#1c1c1e]/95 p-8 backdrop-blur-2xl"
        style={{
          boxShadow:
            '0 0 80px rgba(34, 197, 94, 0.06), 0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Lock icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.12] to-white/[0.04]">
            <Lock className="h-6 w-6 text-white/80" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h4 className="text-center text-[15px] font-semibold tracking-[-0.2px] text-white">
          vars — PIN Required
        </h4>

        {/* Body text */}
        <p className="mt-2.5 text-center text-[12.5px] leading-[1.5] text-white/50">
          An AI agent is requesting access to
          <br />
          decrypt secrets in{' '}
          <span className="font-mono text-white/60">config.vars</span>
        </p>

        {/* Command label */}
        <div className="mt-4 flex justify-center">
          <span className="rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] text-white/35">
            Command: vars show config.vars
          </span>
        </div>

        {/* PIN input dots */}
        <div className="mt-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04]"
            >
              <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-7 flex gap-3">
          <div className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] py-2 text-center text-[13px] font-medium text-white/50">
            Cancel
          </div>
          <div className="flex-1 rounded-lg bg-green-600 py-2 text-center text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            Approve
          </div>
        </div>
      </div>
    </div>
  );
}
