import { Badge } from '@/components/ui/badge';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { VarsDynamicCodeBlock } from './vars-codeblock';
import {
  FileWarning,
  FolderSync,
  FileQuestion,
  MessageSquare,
  ClipboardCopy,
  ShieldAlert,
  Lock,
  FileStack,
  ShieldCheck,
  KeyRound,
  LockKeyhole,
  FileCode,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  stg  = enc:v2:aes256gcm-det:j2k3l4:m5n6o7:p8q9r0
  prod = enc:v2:aes256gcm-det:e8d1f0:s1t2u3:v4w5x6
}

API_KEY : z.string().min(20) {
  dev  = enc:v2:aes256gcm-det:y7z8a9:b0c1d2:e3f4g5
  stg  = enc:v2:aes256gcm-det:f6g7h8:i9j0k1:l2m3n4
  prod = enc:v2:aes256gcm-det:9c2b4f:o5p6q7:r8s9t0
}`;

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
            <DynamicCodeBlock lang="bash" code={ENV_CODE} codeblock={{ keepBackground: false, allowCopy: false }} />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-6">
            {([
              [FileWarning, 'Plaintext secrets on disk'],
              [FolderSync, 'Three files to keep in sync'],
              [FileQuestion, 'No types or validation'],
              [MessageSquare, 'Shared via Slack DMs'],
              [ClipboardCopy, 'Copy-paste between envs'],
              [ShieldAlert, 'Hope nobody commits prod'],
            ] as [LucideIcon, string][]).map(([Icon, problem]) => (
              <div key={problem} className="flex items-start gap-2.5 text-sm text-red-400/80">
                <Icon size={16} className="mt-0.5 shrink-0 text-red-500/60" />
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

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-6">
            {([
              [Lock, 'Encrypted, safe to commit'],
              [FileStack, 'One file, all environments'],
              [ShieldCheck, 'Zod schemas validate values'],
              [KeyRound, 'Clone the repo, enter PIN'],
              [LockKeyhole, 'Always encrypted, unlock to edit'],
              [FileCode, 'Types generated for you'],
            ] as [LucideIcon, string][]).map(([Icon, benefit]) => (
              <div key={benefit} className="flex items-start gap-2.5 text-sm text-green-400/90">
                <Icon size={16} className="mt-0.5 shrink-0 text-green-500" />
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
