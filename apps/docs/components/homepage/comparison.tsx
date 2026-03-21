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
        <div className="overflow-hidden rounded-xl border border-red-500/10 bg-red-500/[0.03]">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/10 font-mono text-xs">
              .env
            </Badge>
            <span className="text-sm font-medium text-white/40">
              What you&apos;ve been doing
            </span>
          </div>

          {/* Editor-style code block */}
          <div className="mx-5 overflow-hidden rounded-lg border border-red-500/10 bg-[#0a0a0a]">
            <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500/50" />
              <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
              <div className="h-2 w-2 rounded-full bg-green-500/50" />
              <span className="ml-2 font-mono text-[10px] text-neutral-600">.env</span>
            </div>
            <div className="p-4 font-mono text-xs leading-[2]">
              {[
                'DATABASE_URL=postgres://admin:password123@db.example.com/prod',
                'PORT=3000',
                'STRIPE_KEY=sk_live_abc123def456',
              ].map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 inline-block w-5 select-none text-right font-mono tabular-nums text-[10px] leading-[2] text-neutral-700">{i + 1}</span>
                  <span className="text-white/60">{line}</span>
                </div>
              ))}
            </div>
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

          {/* Editor-style code block */}
          <div className="mx-5 overflow-hidden rounded-lg border border-green-500/10 bg-[#0a0a0a]">
            <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500/50" />
              <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
              <div className="h-2 w-2 rounded-full bg-green-500/50" />
              <span className="ml-2 font-mono text-[10px] text-neutral-600">.vars</span>
            </div>
            <div className="p-4 font-mono text-xs leading-[2]">
              {([
                [
                  { text: 'DATABASE_URL', cls: 'text-green-50 font-semibold' },
                  { text: ' ', cls: '' },
                  { text: 'z.string().url()', cls: 'text-green-500' },
                ],
                [
                  { text: '  @prod', cls: 'text-green-700' },
                  { text: ' = ', cls: 'text-neutral-600' },
                  { text: 'enc:v1:aes256gcm:...', cls: 'text-neutral-600' },
                ],
                [
                  { text: 'PORT', cls: 'text-green-50 font-semibold' },
                  { text: ' ', cls: '' },
                  { text: 'z.coerce.number()', cls: 'text-green-500' },
                ],
                [
                  { text: '  @default', cls: 'text-green-700' },
                  { text: ' = ', cls: 'text-neutral-600' },
                  { text: 'enc:v1:aes256gcm:...', cls: 'text-neutral-600' },
                ],
                [
                  { text: 'STRIPE_KEY', cls: 'text-green-50 font-semibold' },
                  { text: ' ', cls: '' },
                  { text: 'z.string().startsWith("sk_")', cls: 'text-green-500' },
                ],
                [
                  { text: '  @prod', cls: 'text-green-700' },
                  { text: ' = ', cls: 'text-neutral-600' },
                  { text: 'enc:v1:aes256gcm:...', cls: 'text-neutral-600' },
                ],
              ] as { text: string; cls: string }[][]).map((tokens, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 inline-block w-5 select-none text-right font-mono tabular-nums text-[10px] leading-[2] text-neutral-700">{i + 1}</span>
                  <span>
                    {tokens.map((t, j) => (
                      <span key={j} className={t.cls}>{t.text}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
