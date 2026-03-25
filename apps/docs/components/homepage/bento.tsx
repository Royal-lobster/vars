import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import {
	Braces,
	CheckSquare,
	Code,
	FileOutput,
	FileSearch,
	GitBranch,
	Layers,
	MonitorSmartphone,
	RefreshCw,
	Shield,
	Stethoscope,
	Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const codeBlockStyle =
	"[&_figure]:!my-0 [&_figure]:!rounded-lg [&_pre]:!text-[11px] [&_pre]:!leading-[1.7]";

const cardBase =
	"group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)]";

function CardHeader({
	icon: Icon,
	title,
	description,
}: { icon: LucideIcon; title: string; description: string }) {
	return (
		<div className="relative z-10 p-5">
			<Icon size={16} className="text-green-500" />
			<h3 className="mt-3 text-sm font-semibold">{title}</h3>
			<p className="mt-1 text-[12px] leading-relaxed text-white/40">{description}</p>
		</div>
	);
}

function CardImage({ src }: { src: string }) {
	return (
		<>
			<img
				src={src}
				alt=""
				className="absolute inset-0 h-full w-full object-cover opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.12]"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
		</>
	);
}

export function Bento() {
	return (
		<section className="mx-auto max-w-[1120px] px-5 pb-20 pt-24 md:px-10">
			<div className="mb-12 text-center">
				<h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
					And that&apos;s not{" "}
					<em className="font-serif italic text-green-500 font-normal">even half of it.</em>
				</h2>
				<p className="mt-3 text-[15px] text-white/50">
					Everything you need. Nothing you don&apos;t.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-12">
				{/* Row 1: Zod (wide with code) | Multi-env + CLI (stacked) */}
				<div className={`md:col-span-7 ${cardBase}`}>
					<CardImage src="/images/topographic.webp" />
					<CardHeader
						icon={Shield}
						title="Zod-native schemas"
						description="No proprietary DSL. Write the same Zod expressions you already use. Validated at build time."
					/>
					<div className={`relative z-10 px-5 pb-5 ${codeBlockStyle}`}>
						<DynamicCodeBlock
							lang="ts"
							code={`DATABASE_URL : z.string().url().startsWith("postgres://")
PORT        : z.coerce.number().int().min(1024).max(65535)
NODE_ENV    : z.enum(["development", "staging", "production"])`}
							codeblock={{ keepBackground: false, allowCopy: false }}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-3 md:col-span-5">
					<div className={`flex-1 ${cardBase}`}>
						<CardImage src="/images/aurora.webp" />
						<CardHeader
							icon={Layers}
							title="Multi-environment"
							description="dev, staging, prod in one file. Side by side. They can never drift apart."
						/>
					</div>
					<div className={`flex-1 ${cardBase}`}>
						<CardImage src="/images/neural-mesh.webp" />
						<CardHeader
							icon={Terminal}
							title="Full CLI"
							description="17 commands: show, hide, run, gen, check, export, rotate, diff, doctor, and more."
						/>
					</div>
				</div>

				{/* Row 2: VS Code + Check blocks (stacked) | TypeScript codegen (wide with code) */}
				<div className="flex flex-col gap-3 md:col-span-5">
					<div className={`flex-1 ${cardBase}`}>
						<CardImage src="/images/crystal.webp" />
						<CardHeader
							icon={MonitorSmartphone}
							title="VS Code extension"
							description="Autocomplete, inline validation, hover docs, go-to-definition. Full LSP."
						/>
					</div>
					<div className={`flex-1 ${cardBase}`}>
						<CardImage src="/images/fireflies.webp" />
						<CardHeader
							icon={CheckSquare}
							title="Check blocks"
							description='Cross-variable constraints validated at build time. "If prod, no debug logging."'
						/>
					</div>
				</div>
				<div className={`md:col-span-7 ${cardBase}`}>
					<CardImage src="/images/fluid-green.webp" />
					<CardHeader
						icon={Code}
						title="TypeScript codegen"
						description="Generated types with Redacted<T>. Typos become compile errors, not 3am incidents."
					/>
					<div className={`relative z-10 px-5 pb-5 ${codeBlockStyle}`}>
						<DynamicCodeBlock
							lang="ts"
							code={`import { vars } from "#vars"

// Public values are plain types
const port: number = vars.PORT

// Secrets require explicit unwrap — can't accidentally log them
const db: string = vars.DATABASE_URL.unwrap()
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^ Redacted<string>`}
							codeblock={{ keepBackground: false, allowCopy: false }}
						/>
					</div>
				</div>

				{/* Row 3: Interpolation | PIN rotation | Export (wide with code) */}
				<div className={`md:col-span-3 ${cardBase}`}>
					<CardImage src="/images/aurora.webp" />
					<CardHeader
						icon={Braces}
						title="Interpolation"
						description="${} variable references with per-environment resolution."
					/>
				</div>
				<div className={`md:col-span-3 ${cardBase}`}>
					<CardImage src="/images/crystal.webp" />
					<CardHeader
						icon={RefreshCw}
						title="PIN rotation"
						description="vars rotate re-encrypts everything with a new PIN. One command."
					/>
				</div>
				<div className={`md:col-span-6 ${cardBase}`}>
					<CardImage src="/images/topographic.webp" />
					<CardHeader
						icon={FileOutput}
						title="Export anywhere"
						description="Export resolved values to .env, JSON, or Kubernetes secret format."
					/>
					<div className={`relative z-10 px-5 pb-5 ${codeBlockStyle}`}>
						<DynamicCodeBlock
							lang="bash"
							code={`$ vars export --env prod > .env         # dotenv format
$ vars export --env prod --format json  # JSON format`}
							codeblock={{ keepBackground: false, allowCopy: false }}
						/>
					</div>
				</div>

				{/* Row 4: Pre-commit | Diff & coverage | vars doctor */}
				<div className={`md:col-span-4 ${cardBase}`}>
					<CardImage src="/images/fireflies.webp" />
					<CardHeader
						icon={GitBranch}
						title="Pre-commit hooks"
						description="Auto-installed during init. Blocks you from committing decrypted secrets to git."
					/>
				</div>
				<div className={`md:col-span-4 ${cardBase}`}>
					<CardImage src="/images/neural-mesh.webp" />
					<CardHeader
						icon={FileSearch}
						title="Diff & coverage"
						description="Compare values across environments. See which envs are missing values at a glance."
					/>
				</div>
				<div className={`md:col-span-4 ${cardBase}`}>
					<CardImage src="/images/fluid-green.webp" />
					<CardHeader
						icon={Stethoscope}
						title="vars doctor"
						description="Diagnose your setup — key health, .gitignore, hooks, expiring secrets, schema errors."
					/>
				</div>
			</div>
		</section>
	);
}
