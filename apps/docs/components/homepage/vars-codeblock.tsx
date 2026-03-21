import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import type { CodeBlockProps } from 'fumadocs-ui/components/codeblock';
import { varsLanguage } from '@/lib/vars-lang';

interface VarsCodeBlockProps {
  code: string;
  className?: string;
  codeblock?: CodeBlockProps;
}

export function VarsDynamicCodeBlock({ code, className, codeblock }: VarsCodeBlockProps) {
  return (
    <div className={className}>
      <DynamicCodeBlock
        lang="vars"
        code={code}
        options={{
          langs: [varsLanguage],
        }}
        codeblock={{ keepBackground: false, ...codeblock }}
      />
    </div>
  );
}
