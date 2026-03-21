import type { ThemeRegistration } from 'shiki';

export const varsTheme: ThemeRegistration = {
  name: 'vars-green',
  type: 'dark',
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#e8e8e8',
    'editorLineNumber.foreground': '#333333',
    'editorLineNumber.activeForeground': '#22c55e',
  },
  tokenColors: [
    {
      name: 'Comment',
      scope: ['comment'],
      settings: { foreground: '#3a3a3a', fontStyle: 'italic' },
    },
    {
      name: 'Variable name (bright)',
      scope: ['variable', 'entity.name', 'support.variable'],
      settings: { foreground: '#f0fdf4', fontStyle: 'bold' },
    },
    {
      name: 'Schema / type (green)',
      scope: ['entity.name.function', 'support.function', 'keyword.operator'],
      settings: { foreground: '#22c55e' },
    },
    {
      name: 'String',
      scope: ['string'],
      settings: { foreground: '#4ade80' },
    },
    {
      name: 'Number',
      scope: ['constant.numeric'],
      settings: { foreground: '#86efac' },
    },
    {
      name: 'Keyword / decorator (dim)',
      scope: ['keyword', 'storage', 'entity.name.tag'],
      settings: { foreground: '#3b8a5a' },
    },
    {
      name: 'Encrypted value (very dim)',
      scope: ['string.other', 'meta.embedded'],
      settings: { foreground: '#2a2a2a' },
    },
    {
      name: 'Punctuation',
      scope: ['punctuation'],
      settings: { foreground: '#555555' },
    },
  ],
};
