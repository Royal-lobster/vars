import {
  SiNextdotjs,
  SiVite,
  SiAstro,
  SiNestjs,
  SiSvelte,
  SiNuxt,
} from '@icons-pack/react-simple-icons';
import type { ComponentType } from 'react';

const FRAMEWORKS: {
  name: string;
  code: string;
  color: string;
  Icon: ComponentType<{ size?: number; color?: string; className?: string }>;
  iconColor: string;
}[] = [
  {
    name: 'Next.js',
    code: 'withVars(nextConfig)',
    color: 'from-white/5 to-white/[0.02]',
    Icon: SiNextdotjs,
    iconColor: '#ffffff',
  },
  {
    name: 'Vite',
    code: 'varsPlugin()',
    color: 'from-purple-500/5 to-purple-500/[0.02]',
    Icon: SiVite,
    iconColor: '#646CFF',
  },
  {
    name: 'Astro',
    code: 'varsIntegration()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
    Icon: SiAstro,
    iconColor: '#BC52EE',
  },
  {
    name: 'NestJS',
    code: '@Inject(VARS)',
    color: 'from-red-500/5 to-red-500/[0.02]',
    Icon: SiNestjs,
    iconColor: '#E0234E',
  },
  {
    name: 'SvelteKit',
    code: 'varsPlugin()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
    Icon: SiSvelte,
    iconColor: '#FF3E00',
  },
  {
    name: 'Nuxt',
    code: 'varsPlugin()',
    color: 'from-green-500/5 to-green-500/[0.02]',
    Icon: SiNuxt,
    iconColor: '#00DC82',
  },
];

export function Frameworks() {
  return (
    <section className="border-y border-white/[0.06] py-20">
      <div className="mx-auto max-w-[1120px] px-5 md:px-10">
        <div className="mb-10 text-center">
          <h3 className="text-sm font-medium text-white/40">
            One-line integration with your stack
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FRAMEWORKS.map((fw) => (
            <div
              key={fw.name}
              className={`group flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-b ${fw.color} p-5 text-center transition-all hover:border-green-500/15`}
            >
              <fw.Icon
                size={32}
                color={fw.iconColor}
                className="opacity-80 transition-opacity group-hover:opacity-100"
              />
              <span className="text-sm font-medium text-white/70">
                {fw.name}
              </span>
              <code className="rounded-md bg-black/30 px-2.5 py-1 font-mono text-[10px] text-green-500/70 transition-colors group-hover:text-green-400">
                {fw.code}
              </code>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
