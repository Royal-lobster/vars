import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

const STEPS = [
  {
    title: 'Init',
    description: 'One command. Set a PIN. Migrates your existing .env automatically.',
    command: 'npx vars init',
  },
  {
    title: 'Edit',
    description: 'Decrypt with vars show, add your variables with Zod types.',
    command: 'npx vars show',
  },
  {
    title: 'Lock',
    description: 'Run vars hide. Secrets encrypted. Safe to commit.',
    command: 'npx vars hide',
  },
  {
    title: 'Commit',
    description: "Push to git. Teammates clone and enter the PIN. That's onboarding.",
    command: 'git commit -m "update secrets"',
  },
  {
    title: 'Deploy',
    description: 'Set VARS_KEY in CI. One secret replaces your entire dashboard.',
    command: 'npx vars run --env prod -- npm start',
  },
];

export function Workflow() {
  return (
    <section className="mx-auto max-w-[800px] px-5 py-24 md:px-10">
      <div className="mb-14 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          Your new{' '}
          <em className="font-serif italic text-green-500 font-normal">workflow.</em>
        </h2>
        <p className="mt-3 text-[15px] text-white/50">
          Five steps. That&apos;s the whole thing.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="flex items-center gap-5 rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-5 transition-all hover:border-green-500/15"
          >
            {/* Number */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 font-mono text-sm font-bold text-green-400">
              {i + 1}
            </div>

            {/* Title + description */}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-0.5 text-xs text-white/40">{step.description}</p>
            </div>

            {/* Command */}
            <code className="hidden shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2 font-mono text-xs text-white/60 sm:block">
              {step.command}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
