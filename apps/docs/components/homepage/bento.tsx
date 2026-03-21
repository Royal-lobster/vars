import Image from 'next/image';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { VarsDynamicCodeBlock } from './vars-codeblock';

interface BentoItem {
  label: string;
  title: string;
  description: string;
  image: string;
  span: 'wide' | 'narrow' | 'full';
  code?: string;
  lang?: string;
}

const ITEMS: BentoItem[] = [
  {
    label: 'Schema-first',
    title: 'Your schema is native Zod',
    description:
      'No proprietary DSL. Write the same Zod expressions you already use. Type errors at build time, not in production at 3am.',
    image: '/images/topographic.webp',
    span: 'wide',
    lang: 'ts',
    code: `z.string().url().startsWith("postgres://")
z.coerce.number().int().min(1024).max(65535)
z.enum(["development", "staging", "production"])`,
  },
  {
    label: 'Multi-env',
    title: 'One file, all environments',
    description:
      'dev, staging, prod in one .vars file. No more .env.local, .env.production, .env.staging sprawl.',
    image: '/images/fireflies.webp',
    span: 'narrow',
    lang: 'vars',
    code: `PORT  z.coerce.number()
  @default = 3000
  @prod    = 8080`,
  },
  {
    label: 'CLI',
    title: 'Powerful tooling',
    description:
      'Everything from the command line. Scriptable and CI-friendly.',
    image: '/images/aurora.webp',
    span: 'wide',
    lang: 'bash',
    code: `$ vars show     # decrypt, edit
$ vars hide     # re-encrypt
$ vars run      # inject & run
$ vars gen      # typed exports`,
  },
  {
    label: 'Editor Intelligence',
    title: 'LSP + VS Code extension',
    description:
      'Autocomplete, inline validation, hover docs — your .vars file gets first-class editor support through a dedicated language server.',
    image: '/images/neural-mesh.webp',
    span: 'narrow',
  },
  {
    label: 'Team Sharing',
    title: 'Commit your secrets',
    description:
      'The vault is encrypted, so it goes straight into git. New teammate? Clone and enter the PIN. No Slack DMs. No 1Password vaults. No Doppler.',
    image: '/images/crystal.webp',
    span: 'narrow',
  },
  {
    label: 'Platform Sync',
    title: 'Push and pull from your hosting',
    description:
      'Sync secrets with Vercel, Netlify, Railway, and Fly.io. Push from your vault to the platform, or pull existing vars back into your encrypted file.',
    image: '/images/fireflies.webp',
    span: 'wide',
    lang: 'bash',
    code: `$ vars push --env prod --vercel   # vault → Vercel
$ vars pull --netlify             # Netlify → vault
$ vars template --env prod > .env # generate .env`,
  },
];

const REFINE_CODE = `# Cross-variable constraint
@refine env.LOG_LEVEL !== "debug" || env.DEBUG === true
  "DEBUG must be true when LOG_LEVEL is debug"`;

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

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[11.5px] [&_pre]:!leading-[1.8]';

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
          <div
            key={item.label}
            className={`group overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)] ${spanClass(item.span)}`}
          >
            <div className="relative h-[200px] overflow-hidden">
              <Image
                src={item.image}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
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
                <div className={`mt-4 ${codeBlockStyle}`}>
                  <DynamicCodeBlock
                    lang={item.lang ?? 'text'}
                    code={item.code}
                    codeblock={{ keepBackground: false }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Full-width refinements card */}
        <div className="group overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 md:col-span-12">
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[240px] overflow-hidden">
              <Image
                src="/images/crystal.webp"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col justify-center p-8">
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
              <VarsDynamicCodeBlock
                code={REFINE_CODE}
                className={`mt-4 ${codeBlockStyle}`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
