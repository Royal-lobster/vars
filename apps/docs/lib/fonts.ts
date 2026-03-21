import { Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';

export const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
});
