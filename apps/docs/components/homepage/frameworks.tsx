import {
  SiNextdotjs,
  SiVite,
  SiAstro,
  SiNestjs,
  SiSvelte,
  SiNuxt,
} from '@icons-pack/react-simple-icons';
import type { ComponentType, ReactNode } from 'react';

type Token = { text: string; cls: string };

// Simple JS/TS syntax highlighter for short snippets
function tokenize(line: string): Token[] {
  if (line.trim() === '') return [];
  if (line.trimStart().startsWith('//'))
    return [{ text: line, cls: 'text-neutral-600 italic' }];

  const tokens: Token[] = [];
  // Match leading whitespace
  const leadMatch = line.match(/^(\s+)/);
  if (leadMatch) {
    tokens.push({ text: leadMatch[1], cls: '' });
    line = line.slice(leadMatch[1].length);
  }

  // Tokenize remaining
  const regex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:import|export|default|from|const|let)\b)|(@\w+)|(\b(?:defineConfig|defineNuxtConfig|withVars|varsPlugin|varsIntegration|sveltekit|VarsModule|forRoot|Module)\b)|([\[\]{}(),;:.])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), cls: 'text-white/50' });
    }
    if (match[1]) {
      // String literal
      tokens.push({ text: match[0], cls: 'text-green-400' });
    } else if (match[2]) {
      // Keyword
      tokens.push({ text: match[0], cls: 'text-purple-400' });
    } else if (match[3]) {
      // Decorator
      tokens.push({ text: match[0], cls: 'text-yellow-400' });
    } else if (match[4]) {
      // Function/identifier
      tokens.push({ text: match[0], cls: 'text-blue-400' });
    } else if (match[5]) {
      // Punctuation
      tokens.push({ text: match[0], cls: 'text-neutral-500' });
    }
    lastIndex = match.index + match[0].length;
  }
  // Trailing text
  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), cls: 'text-white/50' });
  }
  return tokens;
}

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
              <div className="mx-4 mb-4 overflow-x-auto rounded-lg bg-black/30 px-4 py-3 font-mono text-[11px] leading-[1.8]">
                {fw.code.map((line, i) => {
                  const tokens = tokenize(line);
                  return (
                    <div key={i} className={tokens.length === 0 ? 'h-3' : 'whitespace-pre'}>
                      {tokens.length === 0
                        ? '\u00A0'
                        : tokens.map((t, j) => (
                            <span key={j} className={t.cls}>
                              {t.text}
                            </span>
                          ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
