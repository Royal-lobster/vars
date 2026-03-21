import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { instrumentSans, jetbrainsMono, newsreader } from '@/lib/fonts';

export const metadata = {
  title: {
    template: '%s | vars',
    default: 'vars — Encrypted Environment Variables',
  },
  description:
    'Schema-validated, encrypted, multi-environment variables. One .vars file replaces your entire .env workflow.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${instrumentSans.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{
            defaultTheme: 'dark',
            forcedTheme: 'dark',
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
