import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Comparison() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-24 md:px-10">
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
        <Card className="border-red-500/10 bg-red-500/[0.03]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/10 font-mono text-xs">
                .env
              </Badge>
              <CardTitle className="text-sm font-medium text-white/40">
                What you&apos;ve been doing
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-black/40 p-4 font-mono text-xs leading-[2]">
              <div className="text-red-400/60">DATABASE_URL=postgres://admin:password123@db.example.com/prod</div>
              <div className="text-red-400/60">PORT=3000</div>
              <div className="text-red-400/60">STRIPE_KEY=sk_live_abc123def456</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
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
          </CardContent>
        </Card>

        {/* .vars — After */}
        <Card className="border-green-500/10 bg-green-500/[0.03]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10 font-mono text-xs">
                .vars
              </Badge>
              <CardTitle className="text-sm font-medium text-white/40">
                What it looks like now
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-black/40 p-4 font-mono text-xs leading-[2]">
              <div>
                <span className="font-semibold text-green-50">DATABASE_URL</span>{' '}
                <span className="text-green-500">z.string().url()</span>
              </div>
              <div className="text-neutral-700">  @prod = enc:v1:aes256gcm:...</div>
              <div>
                <span className="font-semibold text-green-50">PORT</span>{' '}
                <span className="text-green-500">z.coerce.number()</span>
              </div>
              <div className="text-neutral-700">  @default = enc:v1:aes256gcm:...</div>
              <div>
                <span className="font-semibold text-green-50">STRIPE_KEY</span>{' '}
                <span className="text-green-500">z.string().startsWith(&quot;sk_&quot;)</span>
              </div>
              <div className="text-neutral-700">  @prod = enc:v1:aes256gcm:...</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
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
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
