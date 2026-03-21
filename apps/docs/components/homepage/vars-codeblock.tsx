import { codeToHast, type BundledTheme } from 'shiki';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, type JSX } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { varsLanguage } from '@/lib/vars-lang';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

interface VarsCodeBlockProps {
  code: string;
  className?: string;
}

export async function VarsDynamicCodeBlock({ code, className }: VarsCodeBlockProps) {
  const hast = await codeToHast(code, {
    lang: varsLanguage,
    themes: {
      light: 'github-light' as BundledTheme,
      dark: 'github-dark' as BundledTheme,
    },
    defaultColor: false,
  });

  const rendered = toJsxRuntime(hast, {
    Fragment,
    jsx: jsx as any,
    jsxs: jsxs as any,
    components: {
      pre: (props) => (
        <CodeBlock keepBackground={false} {...props}>
          <Pre>{props.children}</Pre>
        </CodeBlock>
      ),
    },
  }) as JSX.Element;

  return <div className={className}>{rendered}</div>;
}
