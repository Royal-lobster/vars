import { Separator } from '@/components/ui/separator';

const COLUMNS = [
  {
    title: 'Product',
    links: ['Documentation', 'Getting Started', 'CLI Reference', 'Changelog'],
  },
  {
    title: 'Integrations',
    links: ['Next.js', 'Vite', 'Astro', 'NestJS', 'VS Code'],
  },
  {
    title: 'Community',
    links: ['GitHub', 'Discord', 'Twitter / X', 'Contributing'],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1120px] px-5 pb-10 pt-16 md:px-10">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-sm shadow-green-500/20">
                <span className="font-mono text-[11px] font-bold text-green-50">
                  {'{ }'}
                </span>
              </span>
              vars
            </div>
            <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/25">
              Encrypted, typed, schema-first environment variables. The last env
              management tool you&apos;ll ever need.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[13px] text-white/25 transition-colors hover:text-green-500"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-white/[0.06]" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-white/25">
            © 2026 vars. Open source under MIT.
          </span>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-white/25 hover:text-green-500">
              Privacy
            </a>
            <a href="#" className="text-xs text-white/25 hover:text-green-500">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
