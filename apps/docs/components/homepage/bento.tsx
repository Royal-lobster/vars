import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
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
  code?: string;
  lang?: string;
}

const ITEMS: BentoItem[] = [
  {
    icon: Shield,
    title: 'Zod-native schemas',
    description: 'No proprietary DSL. Same Zod you already use.',
    lang: 'ts',
    code: `z.string().url().startsWith("postgres://")
z.coerce.number().int().min(1024).max(65535)
z.enum(["development", "staging", "production"])`,
  },
  {
    icon: Layers,
    title: 'Multi-environment',
    description: 'dev, staging, prod side by side. Can never drift.',
  },
  {
    icon: Terminal,
    title: 'Full CLI',
    description: '17 commands: show, hide, run, gen, check, export, rotate, diff, doctor.',
  },
  {
    icon: MonitorSmartphone,
    title: 'VS Code extension',
    description: 'Autocomplete, validation, hover docs, go-to-definition.',
  },
  {
    icon: Code,
    title: 'TypeScript codegen',
    description: 'Generated types with Redacted<T>. Typos = compile errors.',
    lang: 'ts',
    code: `import { vars } from "#vars"

const port: number = vars.PORT
const db: string = vars.DATABASE_URL.unwrap()
//                                   ^^^^^^^^ Redacted<string>`,
  },
  {
    icon: CheckSquare,
    title: 'Check blocks',
    description: 'Cross-variable constraints at build time.',
  },
  {
    icon: Braces,
    title: 'Variable interpolation',
    description: '${} references with per-env resolution.',
  },
  {
    icon: RefreshCw,
    title: 'PIN rotation',
    description: 'vars rotate re-encrypts with new PIN. One command.',
  },
  {
    icon: FileOutput,
    title: 'Export anywhere',
    description: '.env, JSON, or Kubernetes secret format.',
    lang: 'bash',
    code: `$ vars export --env prod > .env
$ vars export --env prod --format json`,
  },
  {
    icon: GitBranch,
    title: 'Pre-commit hooks',
    description: 'Auto-installed. Blocks decrypted secrets from git.',
  },
  {
    icon: FileSearch,
    title: 'Diff & coverage',
    description: 'Compare values across envs. Find missing values.',
  },
  {
    icon: Stethoscope,
    title: 'vars doctor',
    description: 'Diagnose key health, .gitignore, hooks, expiring secrets.',
  },
];

const codeBlockStyle =
  '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[11px] [&_pre]:!leading-[1.7]';

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {ITEMS.map((item) => (
          <div
            key={item.title}
            className="group overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-5 transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)]"
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
