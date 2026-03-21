import { Button } from '@/components/ui/button';
import { CopyCommand } from './copy-command';

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
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            className="h-11 bg-green-500 px-6 text-sm font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 hover:bg-green-400 hover:shadow-green-500/50"
          >
            Read the Docs →
          </Button>
          <CopyCommand command="npx vars init" />
        </div>
      </div>
    </section>
  );
}
