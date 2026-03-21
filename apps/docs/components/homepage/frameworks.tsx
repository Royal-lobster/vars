import {
  SiNextdotjs,
  SiVite,
  SiAstro,
  SiNestjs,
  SiSvelte,
  SiNuxt,
  SiRemix,
  SiExpress,
} from '@icons-pack/react-simple-icons';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

const ICONS = [
  SiNextdotjs,
  SiVite,
  SiAstro,
  SiNestjs,
  SiSvelte,
  SiNuxt,
  SiRemix,
  SiExpress,
];

export function Frameworks() {
  return (
    <section className="border-y border-white/[0.06] py-20">
      <div className="mx-auto max-w-[1120px] px-5 md:px-10">
        <div className="mb-10 text-center">
          <h3 className="text-sm font-medium text-white/40">
            Works with any framework
          </h3>
          <p className="mt-2 text-base text-white/50">
            Prefix any command. vars handles the rest.
          </p>
        </div>

        <div className="mx-auto max-w-[600px] [&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-sm [&_pre]:!leading-[1.8]">
          <DynamicCodeBlock
            lang="bash"
            code={`$ vars run --env dev -- your-dev-command\n✔ Injected 12 variables.`}
            codeblock={{ keepBackground: false, allowCopy: false }}
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
          {ICONS.map((Icon, i) => (
            <Icon
              key={i}
              size={24}
              className="text-white/40"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
