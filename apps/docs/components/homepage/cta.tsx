import Link from 'next/link';
import { CopyCommand } from './copy-command';

export function CTA() {
  return (
    <section className="px-5 py-28 text-center md:px-10">
      <div>
        <h2 className="text-[clamp(32px,5vw,48px)] font-bold tracking-[-2px]">
          Replace .env{' '}
          <em className="font-serif italic text-green-500 font-normal">today.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-[450px] text-base leading-relaxed text-white/50">
          One command. Five minutes. Your whole team gets every secret, no Slack DMs required.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-green-500 px-6 text-sm font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 transition-all hover:bg-green-400 hover:shadow-green-500/50"
          >
            Why vars? →
          </Link>
          <CopyCommand command="npx vars init" />
        </div>
      </div>
    </section>
  );
}
