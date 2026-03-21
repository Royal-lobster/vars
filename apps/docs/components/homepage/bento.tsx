import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

interface BentoItem {
  label: string;
  title: string;
  description: string;
  image: string;
  span: 'wide' | 'narrow' | 'full';
  code?: string[];
}

const ITEMS: BentoItem[] = [
  {
    label: 'Schema-first',
    title: 'Your schema is native Zod',
    description:
      'No proprietary DSL. Write the same Zod expressions you already use. Type errors at build time, not in production at 3am.',
    image: '/images/topographic.webp',
    span: 'wide',
    code: [
      'z.string().url().startsWith("postgres://")',
      'z.coerce.number().int().min(1024).max(65535)',
      'z.enum(["development", "staging", "production"])',
    ],
  },
  {
    label: 'Multi-env',
    title: 'One file, all environments',
    description:
      'dev, staging, prod — all in one .vars file. No more .env.local, .env.production, .env.staging sprawl.',
    image: '/images/fireflies.webp',
    span: 'narrow',
  },
  {
    label: 'CLI',
    title: 'Powerful tooling',
    description:
      'init, unlock, run, check, gen — everything from the command line. Scriptable and CI-friendly.',
    image: '/images/aurora.webp',
    span: 'narrow',
  },
  {
    label: 'Editor Intelligence',
    title: 'LSP + VS Code extension',
    description:
      'Autocomplete, inline validation, hover docs — your .vars file gets first-class editor support through a dedicated language server.',
    image: '/images/neural-mesh.webp',
    span: 'wide',
  },
];

function spanClass(span: BentoItem['span']) {
  switch (span) {
    case 'wide':
      return 'md:col-span-8';
    case 'narrow':
      return 'md:col-span-4';
    case 'full':
      return 'md:col-span-12';
  }
}

export function Bento() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-20 md:px-10">
      <div className="mb-12 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          Built for teams that{' '}
          <em className="font-serif italic text-green-500 font-normal">ship.</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {ITEMS.map((item) => (
          <Card
            key={item.label}
            className={`group overflow-hidden border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)] ${spanClass(item.span)}`}
          >
            <div className="relative h-[200px] overflow-hidden">
              <Image
                src={item.image}
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <CardContent className="p-6">
              <span className="font-mono text-[10px] uppercase tracking-[2px] text-green-500">
                {item.label}
              </span>
              <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.5px]">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                {item.description}
              </p>
              {item.code && (
                <div className="mt-4 rounded-lg bg-black/40 p-4 font-mono text-[11.5px] leading-[1.8] text-green-500">
                  {item.code.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Full-width refinements card */}
        <Card className="group overflow-hidden border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 md:col-span-12">
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[240px] overflow-hidden">
              <Image
                src="/images/crystal.webp"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <CardContent className="flex flex-col justify-center p-8">
              <span className="font-mono text-[10px] uppercase tracking-[2px] text-green-500">
                Refinements
              </span>
              <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.5px]">
                Cross-variable constraints
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                Express relationships between variables. If LOG_LEVEL is &quot;debug&quot;,
                enforce that DEBUG is true. Validated at build time.
              </p>
              <div className="mt-4 rounded-lg bg-black/40 p-4 font-mono text-[11.5px] leading-[1.8]">
                <div>
                  <span className="font-semibold text-green-400">@refine</span>{' '}
                  <span className="text-green-500">(env) =&gt;</span>
                </div>
                <div className="text-green-500">
                  {'  '}env.LOG_LEVEL !== &quot;debug&quot; || env.DEBUG === true
                </div>
                <div className="text-green-800">
                  {'  '}&quot;DEBUG must be true when LOG_LEVEL is debug&quot;
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </section>
  );
}
