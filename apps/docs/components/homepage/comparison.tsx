import { Badge } from '@/components/ui/badge';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { VarsDynamicCodeBlock } from './vars-codeblock';

const ENV_CODE = `# .env.development
DATABASE_URL=postgres://localhost:5432/myapp
API_KEY=dev_abc123def456ghi789
PORT=3000

# .env.production  (don't commit this!)
DATABASE_URL=postgres://admin:s3cret@prod.db.com/myapp
API_KEY=prod_xyz987uvw654rst321
PORT=8080

# .env.staging  (copy-paste from prod, change 2 things)
DATABASE_URL=postgres://admin:s3cret@staging.db.com/myapp
API_KEY=stg_lmn456opq789rst012
PORT=8080`;

const VARS_CODE = `# config.vars — just one file to manage
env(dev, staging, prod)

public PORT : z.number().min(1024) = 3000

DATABASE_URL : z.string().url() {
  dev  = enc:v2:aes256gcm-det:a3b4c5:d6e7f8:g9h0i1
  staging  = enc:v2:aes256gcm-det:j2k3l4:m5n6o7:p8q9r0
  prod = enc:v2:aes256gcm-det:e8d1f0:s1t2u3:v4w5x6
}

API_KEY : z.string().min(20) {
  dev  = enc:v2:aes256gcm-det:y7z8a9:b0c1d2:e3f4g5
  staging  = enc:v2:aes256gcm-det:f6g7h8:i9j0k1:l2m3n4
  prod = enc:v2:aes256gcm-det:9c2b4f:o5p6q7:r8s9t0
}`;

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-xs [&_pre]:!leading-[1.9]';

const COMPARISONS: [string, string][] = [
  ['3 .env files to sync', '1 config.vars file'],
  ['Plaintext secrets on disk', 'AES-256 encrypted per-value'],
  ['Shared via Slack DMs', 'Clone repo, enter PIN'],
  ['12 secrets in Vercel dashboard', '1 VARS_KEY'],
  ['No types or validation', 'Zod schemas + TypeScript codegen'],
  ['console.log leaks everything', 'Redacted<T> wrapper'],
];

export function Comparison() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-24 md:px-10">
      <div className="mb-12 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          The .env file is{' '}
          <em className="font-serif italic text-green-500 font-normal">broken.</em>
        </h2>
        <p className="mt-3 text-[15px] text-white/50">
          Here&apos;s what changes with vars.
        </p>
      </div>

      {/* Code comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* .env — Before */}
        <div className="overflow-hidden rounded-xl border border-red-500/10 bg-red-500/[0.03]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/10 font-mono text-xs">
              .env
            </Badge>
            <span className="text-sm font-medium text-white/40">
              What you&apos;ve been doing
            </span>
          </div>
          <div className={`mx-4 mb-4 ${codeBlockStyle}`}>
            <DynamicCodeBlock lang="bash" code={ENV_CODE} codeblock={{ keepBackground: false, allowCopy: false }} />
          </div>
        </div>

        {/* .vars — After */}
        <div className="overflow-hidden rounded-xl border border-green-500/10 bg-green-500/[0.03]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10 font-mono text-xs">
              .vars
            </Badge>
            <span className="text-sm font-medium text-white/40">
              What it looks like now
            </span>
          </div>
          <VarsDynamicCodeBlock
            code={VARS_CODE}
            className={`mx-4 mb-4 ${codeBlockStyle}`}
          />
        </div>
      </div>

      {/* Comparison strip */}
      <div className="relative mt-4 rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/[0.03] via-transparent to-green-500/[0.03]" />
        {COMPARISONS.map(([pain, solution], i) => (
          <div
            key={pain}
            className={`relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3.5 md:px-8 transition-colors hover:bg-white/[0.02] ${
              i !== COMPARISONS.length - 1 ? 'border-b border-white/[0.04]' : ''
            }`}
          >
            <span className="text-sm text-red-400/60 text-right line-through decoration-red-500/20">{pain}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-500 text-[10px] select-none shrink-0" aria-hidden>
              →
            </span>
            <span className="text-sm text-green-400/90 font-medium">{solution}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
