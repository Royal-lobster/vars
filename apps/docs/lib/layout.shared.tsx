import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-sm shadow-green-500/20">
            <span className="font-mono text-[11px] font-bold text-green-50">
              {'{ }'}
            </span>
          </span>
          vars
        </span>
      ),
    },
    githubUrl: 'https://github.com/Royal-lobster/vars',
    links: [
      { text: 'Documentation', url: '/docs' },
    ],
  };
}
