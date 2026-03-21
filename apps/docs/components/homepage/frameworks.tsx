import { Card, CardContent } from '@/components/ui/card';

const FRAMEWORKS = [
  {
    name: 'Next.js',
    icon: '▲',
    code: 'withVars(nextConfig)',
    color: 'from-white/5 to-white/[0.02]',
  },
  {
    name: 'Vite',
    icon: '⚡',
    code: 'varsPlugin()',
    color: 'from-purple-500/5 to-purple-500/[0.02]',
  },
  {
    name: 'Astro',
    icon: '🚀',
    code: 'varsIntegration()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
  },
  {
    name: 'NestJS',
    icon: '🔴',
    code: '@Inject(VARS)',
    color: 'from-red-500/5 to-red-500/[0.02]',
  },
  {
    name: 'SvelteKit',
    icon: '🟠',
    code: 'varsPlugin()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
  },
  {
    name: 'Nuxt',
    icon: '💚',
    code: 'varsPlugin()',
    color: 'from-green-500/5 to-green-500/[0.02]',
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
            <Card
              key={fw.name}
              className={`group border-white/[0.06] bg-gradient-to-b ${fw.color} transition-all hover:border-green-500/15`}
            >
              <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                <span className="text-2xl">{fw.icon}</span>
                <span className="text-sm font-medium text-white/70">
                  {fw.name}
                </span>
                <code className="rounded-md bg-black/30 px-2.5 py-1 font-mono text-[10px] text-green-500/70 transition-colors group-hover:text-green-400">
                  {fw.code}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
