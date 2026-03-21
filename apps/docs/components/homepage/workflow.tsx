import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

const STEPS = [
  {
    number: '1',
    title: 'Init',
    description: 'One command. Pick a PIN. Done.',
    command: '$ npx vars init',
    lang: 'bash',
  },
  {
    number: '2',
    title: 'Edit',
    description: 'Decrypt, add your variables with Zod schemas, set values per environment.',
    command: `$ npx vars show

# .vars/unlocked.vars
DATABASE_URL  z.string().url()
  @dev  = postgres://localhost/myapp
  @prod = postgres://prod.db.internal/myapp`,
    lang: 'bash',
  },
  {
    number: '3',
    title: 'Lock',
    description: 'Encrypt everything. Safe to commit.',
    command: `$ npx vars hide
✓ 3 variables encrypted
✓ vault.vars updated`,
    lang: 'bash',
  },
  {
    number: '4',
    title: 'Commit & share',
    description: 'Push the encrypted vault. Teammates clone and enter the PIN.',
    command: `$ git add .vars/vault.vars
$ git commit -m "add database config"
$ git push`,
    lang: 'bash',
  },
  {
    number: '5',
    title: 'Run',
    description: 'Inject secrets into any command. Nothing hits disk.',
    command: '$ npx vars run --env dev -- npm start',
    lang: 'bash',
  },
];

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[11.5px] [&_pre]:!leading-[1.8]';

export function Workflow() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-24 md:px-10">
      <div className="mb-14 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          Your new{' '}
          <em className="font-serif italic text-green-500 font-normal">workflow.</em>
        </h2>
        <p className="mt-3 text-[15px] text-white/50">
          Five steps. That&apos;s the whole thing.
        </p>
      </div>

      <div className="relative">
        {/* Vertical line connecting steps */}
        <div className="absolute left-[19px] top-6 bottom-6 w-px bg-gradient-to-b from-green-500/40 via-green-500/20 to-transparent md:left-1/2 md:-translate-x-px" />

        <div className="flex flex-col gap-12">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`relative flex flex-col gap-4 md:flex-row md:items-start md:gap-16 ${
                i % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              {/* Step number */}
              <div className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-[#0a0a0a] font-mono text-sm font-bold text-green-400 shadow-lg shadow-green-500/10 md:static md:mx-auto">
                {step.number}
              </div>

              {/* Content */}
              <div className={`ml-14 flex-1 md:ml-0 ${i % 2 === 1 ? 'md:text-right' : ''}`}>
                <h3 className="text-lg font-semibold tracking-[-0.5px]">
                  {step.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                  {step.description}
                </p>
              </div>

              {/* Code */}
              <div className={`ml-14 flex-1 md:ml-0 ${codeBlockStyle}`}>
                <DynamicCodeBlock
                  lang={step.lang}
                  code={step.command}
                  codeblock={{ keepBackground: false }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
