import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5 font-bold">
          <img src="/logo.svg" alt="vars" width={28} height={28} className="rounded-lg" />
          vars
        </span>
      ),
    },
    githubUrl: 'https://github.com/Royal-lobster/vars',
    links: [],
  };
}
