import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { VarsDynamicCodeBlock } from './vars-codeblock';
import {
  Shield,
  Layers,
  Terminal,
  MonitorSmartphone,
  Code,
  GitBranch,
  FileSearch,
  RefreshCw,
  FileOutput,
  Stethoscope,
  CheckSquare,
  Braces,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface BentoItem {
  icon: LucideIcon;
  title: string;
  description: string;
  span: 'default' | 'wide';
  code?: string;
  lang?: string;
}

const ITEMS: BentoItem[] = [
  {
    icon: Shield,
    title: 'Zod-native schemas',
    description: 'No proprietary DSL. Write the same Zod expressions you already use.',
    span: 'wide',
    lang: 'ts',
    code: `z.string().url().startsWith("postgres://")
z.coerce.number().int().min(1024).max(65535)
z.enum(["development", "staging", "production"])`,
  },
  {
    icon: Layers,
    title: 'Multi-environment',
    description: 'dev, staging, prod in one file. Side by side. They can never drift.',
    span: 'default',
  },
  {
    icon: Terminal,
    title: 'Full CLI',
    description: 'show, hide, run, gen, check, export, rotate, diff, doctor — 17 commands.',
    span: 'default',
  },
  {
    icon: MonitorSmartphone,
    title: 'VS Code extension',
    description: 'Autocomplete, inline validation, hover docs, go-to-definition.',
    span: 'default',
  },
  {
    icon: Code,
    title: 'TypeScript codegen',
    description: 'Generated types with Redacted<T>. Typos become compile errors.',
    span: 'wide',
    lang: 'ts',
    code: `import { vars } from "#vars"

// Public values are plain types
const port: number = vars.PORT

// Secrets require explicit unwrap — can't accidentally log them
const db: string = vars.DATABASE_URL.unwrap()
//                                   ^^^^^^^^ Redacted<string>`,
  },
  {
    icon: CheckSquare,
    title: 'Check blocks',
    description: 'Cross-variable constraints validated at build time. "If prod, no debug logging."',
    span: 'default',
  },
  {
    icon: Braces,
    title: 'Variable interpolation',
    description: 'Reference other variables with ${} syntax. Per-environment resolution.',
    span: 'default',
  },
  {
    icon: RefreshCw,
    title: 'PIN rotation',
    description: 'vars rotate re-encrypts everything with a new PIN. One command.',
    span: 'default',
  },
  {
    icon: FileOutput,
    title: 'Export anywhere',
    description: 'Export to .env, JSON, or Kubernetes secret format.',
    span: 'default',
    lang: 'bash',
    code: `$ vars export --env prod > .env
$ vars export --env prod --format json`,
  },
  {
    icon: GitBranch,
    title: 'Pre-commit hooks',
    description: 'Auto-installed. Blocks you from committing decrypted secrets.',
    span: 'default',
  },
  {
    icon: FileSearch,
    title: 'Diff & coverage',
    description: 'Compare values across environments. See which envs are missing values.',
    span: 'default',
  },
  {
    icon: Stethoscope,
    title: 'vars doctor',
    description: 'Diagnoses your setup — key health, .gitignore, hooks, expiring secrets.',
    span: 'default',
  },
];

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[11px] [&_pre]:!leading-[1.7]';

export function Bento() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-20 pt-24 md:px-10">
      <div className="mb-12 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          And that&apos;s not{' '}
          <em className="font-serif italic text-green-500 font-normal">even half of it.</em>
        </h2>
        <p className="mt-3 text-[15px] text-white/50">
          Everything you need. Nothing you don&apos;t.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {ITEMS.map((item) => (
          <div
            key={item.title}
            className={`group overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-5 transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)] ${
              item.span === 'wide' ? 'sm:col-span-2 md:col-span-2' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <item.icon size={16} className="mt-0.5 shrink-0 text-green-500" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-white/40">
                  {item.description}
                </p>
              </div>
            </div>
            {item.code && (
              <div className={`mt-3 ${codeBlockStyle}`}>
                <DynamicCodeBlock
                  lang={item.lang ?? 'text'}
                  code={item.code}
                  codeblock={{ keepBackground: false, allowCopy: false }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
