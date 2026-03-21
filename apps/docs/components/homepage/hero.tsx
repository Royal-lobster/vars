import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { VarsDynamicCodeBlock } from './vars-codeblock';
import { CopyCommand } from './copy-command';
import { HeroCodeToggle } from './hero-code-toggle';

const UNLOCKED_CODE = `DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev   = postgres://localhost:5432/myapp
  @prod  = postgres://admin@prod.db.internal:5432/myapp

PORT  z.coerce.number().int().min(1024).max(65535)
  @default = 3000

API_KEY  z.string().min(32)
  @description "Primary API key"
  @expires     "2026-09-01"
  @dev   = dev_key_a1b2c3d4e5f6g7h8i9j0k1l2m3
  @prod  = prod_key_x9y8w7v6u5t4s3r2q1p0o9n8m7`;

const VAULT_CODE = `DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev   = enc:v1:aes256gcm:7f3a9b2c:d4e5f6a1:g7h8i9b2
  @prod  = enc:v1:aes256gcm:e8d1f0a3:k5l6m7c3:n8o9p0d4

PORT  z.coerce.number().int().min(1024).max(65535)
  @default = enc:v1:aes256gcm:2c4b8e91:q1r2s3e5:t4u5v6f6

API_KEY  z.string().min(32)
  @description "Primary API key"
  @expires     "2026-09-01"
  @dev   = enc:v1:aes256gcm:9c2b4f7a:w7x8y9g7:z0a1b2h8
  @prod  = enc:v1:aes256gcm:f3e2d1c0:c3d4e5i9:f6g7h8j0`;

const codeBlockClass =
  '[&_figure]:!my-0 [&_figure]:!rounded-xl [&_figure]:!shadow-2xl [&_figure]:!shadow-black/50 [&_pre]:!text-[13px] [&_pre]:!leading-[1.9]';

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16 md:px-10">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.webp"
          alt=""
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_40%,transparent_30%,#050505_75%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-[800px] min-w-0 flex-col items-center text-center">
        <Badge
          variant="outline"
          className="mb-8 gap-2 border-green-500/15 bg-green-500/[0.08] px-4 py-1.5 font-mono text-xs text-green-500"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px] shadow-green-500" aria-hidden="true" />
          Encrypted by default
        </Badge>

        <h1 className="font-sans text-[clamp(40px,7vw,68px)] font-bold leading-[1.05] tracking-[-3px] text-white">
          Stop leaking secrets
          <br />
          in{' '}
          <em className="font-serif italic text-green-500 font-normal">
            plaintext.
          </em>
        </h1>

        <p className="mt-6 max-w-[520px] text-[clamp(15px,2vw,17px)] leading-relaxed text-white/50">
          vars replaces .env with encrypted, schema-validated, multi-environment
          variables. Commit the vault, share with your team, no external services needed.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-green-500 px-6 text-sm font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 transition-all hover:bg-green-400 hover:shadow-green-500/50"
          >
            Get Started →
          </Link>
          <CopyCommand command="npx vars init" />
        </div>

        <HeroCodeToggle
          unlocked={
            <VarsDynamicCodeBlock code={UNLOCKED_CODE} className={codeBlockClass} />
          }
          vault={
            <VarsDynamicCodeBlock code={VAULT_CODE} className={codeBlockClass} />
          }
        />
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  );
}
