import { Users, User, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Persona {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight: string;
}

const PERSONAS: Persona[] = [
  {
    icon: Users,
    title: 'Small teams',
    description: 'New hire clones the repo, enters a PIN, and has every secret. No Slack DMs, no 1Password hunting, no 2-day waits.',
    highlight: 'Clone + PIN = onboarded',
  },
  {
    icon: User,
    title: 'Solo developers',
    description: 'One file instead of .env.local, .env.production, and a Vercel dashboard. Set VARS_KEY once, deploy forever.',
    highlight: 'One file, all environments',
  },
  {
    icon: Globe,
    title: 'Open source maintainers',
    description: 'Public variables with Zod schemas are self-documenting. Contributors read the .vars file and know exactly what they need.',
    highlight: 'Schema IS the docs',
  },
];

export function Audience() {
  return (
    <section className="border-y border-white/[0.06] py-20">
      <div className="mx-auto max-w-[1120px] px-5 md:px-10">
        <div className="mb-12 text-center">
          <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
            Built for teams of{' '}
            <em className="font-serif italic text-green-500 font-normal">2 to 20.</em>
          </h2>
          <p className="mt-3 text-[15px] text-white/50">
            Not an enterprise vault. Not a SaaS. A file in your repo that replaces .env.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PERSONAS.map((p) => (
            <div
              key={p.title}
              className="group rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-6 transition-all hover:border-green-500/15"
            >
              <p.icon size={20} className="text-green-500" />
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">{p.description}</p>
              <div className="mt-4 inline-flex rounded-md border border-green-500/15 bg-green-500/[0.06] px-2.5 py-1 font-mono text-[11px] text-green-400">
                {p.highlight}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
