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

const VARS_CODE = `// vault.vars
DATABASE_URL  z.string().url()
  @dev  = postgres://localhost:5432/myapp
  @stg  = enc:v1:aes256gcm:a3b4c5...
  @prod = enc:v1:aes256gcm:e8d1f0...

API_KEY  z.string().min(20)
  @dev  = dev_abc123def456ghi789
  @stg  = enc:v1:aes256gcm:f6g7h8...
  @prod = enc:v1:aes256gcm:9c2b4f...

PORT  z.coerce.number().min(1024)
  @default = 3000
  @prod    = 8080`;

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
              'Plaintext secrets on disk',
              'Three files to keep in sync',
              'No types or validation',
              'Shared via Slack DMs',
              'Copy-paste between envs',
              'Hope nobody commits prod',
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
              'Encrypted, safe to commit',
              'One file, all environments',
              'Zod schemas validate values',
              'Clone the repo, enter PIN',
              'Dev plaintext, prod encrypted',
              'Types generated for you',
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
