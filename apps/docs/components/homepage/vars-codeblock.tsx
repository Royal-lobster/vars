import { createHighlighter } from 'shiki';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, type JSX } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { varsLanguage } from '@/lib/vars-lang';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

interface VarsCodeBlockProps {
  code: string;
  className?: string;
}

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [varsLanguage],
    });
  }
  return highlighterPromise;
}

export async function VarsDynamicCodeBlock({ code, className }: VarsCodeBlockProps) {
  const highlighter = await getHighlighter();

  const hast = highlighter.codeToHast(code, {
    lang: 'vars',
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  });

  const rendered = toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: {
      pre: (props) => (
        <CodeBlock keepBackground={false} allowCopy={false} {...props}>
          <Pre>{props.children}</Pre>
        </CodeBlock>
      ),
    },
  }) as JSX.Element;

  return <div className={className}>{rendered}</div>;
}
