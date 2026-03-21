import { Badge } from '@/components/ui/badge';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { VarsDynamicCodeBlock } from './vars-codeblock';

const ENV_CODE = `# No encryption, no types, no validation
DATABASE_URL=postgres://admin:password123@prod.db.com/mydb
API_KEY=sk_live_abc123def456ghi789
STRIPE_SECRET=sk_live_51J3...keep_scrolling
PORT=3000
LOG_LEVEL=debug
DEBUG=false  # string or boolean? who knows
NODE_ENV=production
REDIS_URL=redis://default:pass@cache.internal:6379

# Now copy-paste all of this into:
#   .env.local, .env.staging, .env.production
# And pray they stay in sync...
# Oh, and share new secrets via Slack DMs 🙃`;

const VARS_CODE = `DATABASE_URL  z.string().url()
  @dev   = enc:v1:aes256gcm:7f3a...
  @prod  = enc:v1:aes256gcm:e8d1...

API_KEY  z.string().min(32)
  @description "Primary API key"
  @owner       backend-team
  @expires     2026-09-01
  @prod  = enc:v1:aes256gcm:9c2b...

// Cross-variable constraint
@refine env.LOG_LEVEL !== "debug" || env.DEBUG === true
  "DEBUG must be true when LOG_LEVEL is debug"`;

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-xs [&_pre]:!leading-[1.9]';

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

          <div className={`mx-4 mb-1 ${codeBlockStyle}`}>
            <DynamicCodeBlock lang="bash" code={ENV_CODE} codeblock={{ keepBackground: false }} />
          </div>

          <div className="grid grid-cols-2 gap-3 px-5 py-5">
            {[
              'Plaintext passwords in git',
              'No type safety',
              'No schema validation',
              'Secrets shared via DMs',
              'Env drift across stages',
              'Runtime crashes on typos',
            ].map((problem) => (
              <div key={problem} className="flex items-start gap-2 text-xs text-red-400/50">
                <span className="mt-0.5 text-red-500/40">✕</span>
                {problem}
              </div>
            ))}
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
            className={`mx-4 mb-1 ${codeBlockStyle}`}
          />

          <div className="grid grid-cols-2 gap-3 px-5 py-5">
            {[
              'AES-256-GCM encrypted',
              'Zod type safety',
              'Build-time validation',
              'Safe to commit & share',
              'All envs in one file',
              'AI-safe by design',
            ].map((benefit) => (
              <div key={benefit} className="flex items-start gap-2 text-xs text-green-400/70">
                <span className="mt-0.5 text-green-500">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
