import { Button } from '@/components/ui/button';

export function CTA() {
  return (
    <section className="relative overflow-hidden px-5 py-28 text-center md:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_60%,rgba(34,197,94,0.06)_0%,transparent_60%)]" />
      <div className="relative">
        <h2 className="text-[clamp(32px,5vw,48px)] font-bold tracking-[-2px]">
          Replace .env{' '}
          <em className="font-serif italic text-green-500 font-normal">today.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-[450px] text-base leading-relaxed text-white/50">
          One command. Five minutes. Never worry about plaintext secrets again.
        </p>
        <Button
          size="lg"
          className="mt-8 bg-green-500 px-10 text-[15px] font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 hover:bg-green-400 hover:shadow-green-500/50"
        >
          Read the Docs →
        </Button>
        <div className="mt-5 font-mono text-sm text-white/25">
          <code className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-4 py-1.5">
            npx vars init
          </code>
        </div>
      </div>
    </section>
  );
}
