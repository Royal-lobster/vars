import { VarsDynamicCodeBlock } from './vars-codeblock';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { PinDialog } from './pin-dialog';

const VARS_FILE_CODE = `env(dev, staging, prod)

public PORT : z.number().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = enc:v2:aes256gcm-det:b2c3d4:f6g7h8:i9j0k1
  prod    = enc:v2:aes256gcm-det:e8d1f0:k5l6m7:n8o9p0
}

API_KEY : z.string().min(32) {
  dev     = "dev_test_key_not_a_secret_at_all"
  staging = enc:v2:aes256gcm-det:a1b2c3:e5f6g7:i9j0k1
  prod    = enc:v2:aes256gcm-det:f3e2d1:c3d4e5:f6g7h8
} (description = "Primary API key", expires = 2026-09-01)`;

const CI_CODE = `# GitHub Actions — this is your ENTIRE secrets config
env:
  VARS_KEY: \${{ secrets.VARS_KEY }}

steps:
  - run: npx vars run --env prod -- npm start
  # ✔ 12 secrets decrypted and injected`;

const codeBlockStyle = '[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[12px] [&_pre]:!leading-[1.8]';

function SectionBg({ image, side }: { image: string; side: 'left' | 'right' }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${side === 'left' ? '-left-20' : '-right-20'}`}>
      <img
        src={image}
        alt=""
        className={`absolute ${side === 'left' ? '-left-40 -top-20' : '-right-40 -top-20'} h-[120%] w-[70%] object-cover opacity-[0.1] blur-sm`}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />
    </div>
  );
}

export function Differentiators() {
  return (
    <section className="px-5 py-24 md:px-10">
      <div className="mb-16 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          What no other tool{' '}
          <em className="font-serif italic text-green-500 font-normal">does.</em>
        </h2>
      </div>

      <div className="flex flex-col gap-0">
        {/* Differentiator 1: Schema + Secrets */}
        <div className="relative overflow-hidden border-t border-white/[0.04] py-20">
          <SectionBg image="/images/diff-schema.webp" side="right" />
          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-10 md:grid-cols-2">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[2px] text-green-500">
                Schema + Secrets
              </span>
              <h3 className="mt-4 text-2xl font-bold leading-[1.2] tracking-[-1px]">
                Your types, your values, your environments.
                <br />
                <span className="text-white/40">One file.</span>
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                t3-env gives you schema validation. Doppler gives you a secrets vault.
                vars gives you both — in a single file you commit to git. The schema{' '}
                <em className="text-white/70">is</em> the documentation. New devs read it and
                know exactly what every variable needs, what type it is, and which environments
                it spans.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm overflow-hidden">
              <VarsDynamicCodeBlock
                code={VARS_FILE_CODE}
                className={`${codeBlockStyle} [&_pre]:!bg-transparent`}
              />
            </div>
          </div>
        </div>

        {/* Differentiator 2: N secrets → 1 key */}
        <div className="relative overflow-hidden border-t border-white/[0.04] py-20">
          <SectionBg image="/images/diff-onekey.webp" side="left" />
          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-10 md:grid-cols-2">
            <div className="order-2 md:order-1 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm overflow-hidden">
              <DynamicCodeBlock
                lang="yaml"
                code={CI_CODE}
                codeblock={{ keepBackground: false, allowCopy: false }}
              />
            </div>
            <div className="order-1 md:order-2">
              <span className="font-mono text-[11px] uppercase tracking-[2px] text-green-500">
                One Key
              </span>
              <h3 className="mt-4 text-2xl font-bold leading-[1.2] tracking-[-1px]">
                12 dashboard secrets?
                <br />
                <span className="text-white/40">Now it&apos;s 1.</span>
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                Every secret is already in your repo, encrypted. In CI, you set a single{' '}
                <code className="text-green-400 font-mono text-sm">VARS_KEY</code> environment
                variable. That&apos;s it. No more pasting 12 secrets into Vercel one by one.
                No more hoping staging matches prod. Add a secret? Edit, commit, push — CI
                picks it up automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Differentiator 3: AI-safe PIN dialog */}
        <div className="relative overflow-hidden border-t border-b border-white/[0.04] py-20">
          <SectionBg image="/images/diff-aisafe.webp" side="right" />
          <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-10 md:grid-cols-2">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[2px] text-green-500">
                AI-Safe
              </span>
              <h3 className="mt-4 text-2xl font-bold leading-[1.2] tracking-[-1px]">
                Your AI agent can&apos;t read
                <br />
                <span className="text-white/40">your secrets.</span>
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                When an AI coding agent tries to decrypt your .vars file, it hits a native
                system dialog — a real OS-level prompt that requires your PIN. No session
                caching, no token persistence. Every single decryption needs your explicit
                approval. The agent sees encrypted blobs, never plaintext.
              </p>
            </div>
            <PinDialog />
          </div>
        </div>
      </div>
    </section>
  );
}
