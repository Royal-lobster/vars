import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

const HERO_CODE = `DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev   = enc:v1:aes256gcm:7f3a9b2c...
  @prod  = enc:v1:aes256gcm:e8d1f0a3...

PORT  z.coerce.number().int().min(1024)
  @default = enc:v1:aes256gcm:2c4b8e...

// Cross-variable refinement
@refine (env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true
  "DEBUG must be true when LOG_LEVEL is debug"`;

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
      <div className="relative z-10 flex max-w-[800px] flex-col items-center text-center">
        <Badge
          variant="outline"
          className="mb-8 gap-2 border-green-500/15 bg-green-500/[0.08] px-4 py-1.5 font-mono text-xs text-green-500"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px] shadow-green-500" />
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
          variables — in a single file your whole team can share.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <Button
            size="lg"
            className="bg-green-500 text-black font-semibold shadow-[0_0_30px] shadow-green-500/30 hover:bg-green-400 hover:shadow-green-500/50"
          >
            Get Started →
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-white/[0.06] bg-white/[0.04] text-white/50 hover:border-green-500/15 hover:text-white"
          >
            npx vars init
          </Button>
        </div>

        <div className="mt-14 w-full max-w-[620px] [&_figure]:!my-0 [&_figure]:!rounded-xl [&_figure]:!shadow-2xl [&_figure]:!shadow-black/50 [&_pre]:!text-[13px] [&_pre]:!leading-[1.9]">
          <DynamicCodeBlock lang="js" code={HERO_CODE} codeblock={{ keepBackground: false }} />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  );
}
