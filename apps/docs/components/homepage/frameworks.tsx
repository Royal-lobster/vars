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
  code: string[];
  color: string;
  Icon: ComponentType<{ size?: number; color?: string; className?: string }>;
  iconColor: string;
}[] = [
  {
    name: 'Next.js',
    code: [
      '// next.config.mjs',
      'import { withVars } from "@vars/next";',
      '',
      'export default withVars({',
      '  // your next config',
      '});',
    ],
    color: 'from-white/5 to-white/[0.02]',
    Icon: SiNextdotjs,
    iconColor: '#ffffff',
  },
  {
    name: 'Vite',
    code: [
      '// vite.config.ts',
      'import { varsPlugin } from "@vars/vite";',
      '',
      'export default defineConfig({',
      '  plugins: [varsPlugin()],',
      '});',
    ],
    color: 'from-purple-500/5 to-purple-500/[0.02]',
    Icon: SiVite,
    iconColor: '#646CFF',
  },
  {
    name: 'Astro',
    code: [
      '// astro.config.mjs',
      'import { varsIntegration } from "@vars/astro";',
      '',
      'export default defineConfig({',
      '  integrations: [varsIntegration()],',
      '});',
    ],
    color: 'from-orange-500/5 to-orange-500/[0.02]',
    Icon: SiAstro,
    iconColor: '#BC52EE',
  },
  {
    name: 'NestJS',
    code: [
      '// app.module.ts',
      'import { VarsModule } from "@vars/nestjs";',
      '',
      '@Module({',
      '  imports: [VarsModule.forRoot()],',
      '})',
    ],
    color: 'from-red-500/5 to-red-500/[0.02]',
    Icon: SiNestjs,
    iconColor: '#E0234E',
  },
  {
    name: 'SvelteKit',
    code: [
      '// vite.config.ts',
      'import { varsPlugin } from "@vars/vite";',
      '',
      'export default defineConfig({',
      '  plugins: [sveltekit(), varsPlugin()],',
      '});',
    ],
    color: 'from-orange-500/5 to-orange-500/[0.02]',
    Icon: SiSvelte,
    iconColor: '#FF3E00',
  },
  {
    name: 'Nuxt',
    code: [
      '// nuxt.config.ts',
      'import { varsPlugin } from "@vars/vite";',
      '',
      'export default defineNuxtConfig({',
      '  vite: { plugins: [varsPlugin()] },',
      '});',
    ],
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORKS.map((fw) => (
            <div
              key={fw.name}
              className={`group overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b ${fw.color} transition-all hover:border-green-500/15`}
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <fw.Icon
                  size={20}
                  color={fw.iconColor}
                  className="opacity-80 transition-opacity group-hover:opacity-100"
                />
                <span className="text-sm font-medium text-white/70">
                  {fw.name}
                </span>
              </div>
              <div className="mx-4 mb-4 overflow-hidden rounded-lg bg-black/30 px-4 py-3 font-mono text-[11px] leading-[1.7]">
                {fw.code.map((line, i) => (
                  <div key={i} className={line.startsWith('//') ? 'text-neutral-600' : line === '' ? 'h-2' : 'text-white/50'}>
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
