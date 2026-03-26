import {
	SiAstro,
	SiExpress,
	SiNestjs,
	SiNextdotjs,
	SiNuxt,
	SiRemix,
	SiSvelte,
	SiVite,
} from "@icons-pack/react-simple-icons";
import Link from "next/link";
import { CopyCommand } from "./copy-command";

const ICONS = [SiNextdotjs, SiVite, SiAstro, SiNestjs, SiSvelte, SiNuxt, SiRemix, SiExpress];

export function CTA() {
	return (
		<section className="relative overflow-hidden px-5 py-28 text-center md:px-10">
			<div className="absolute inset-0 z-0">
				<img
					src="/images/cta-bg.webp"
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
				/>
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_40%,transparent_30%,#050505_75%)]" />
				<div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
			</div>
			<div className="relative z-10">
				<h2 className="text-[clamp(32px,5vw,48px)] font-bold tracking-[-2px]">
					Stop managing secrets. <br className="hidden sm:block" />
					Start <em className="font-serif italic text-green-500 font-normal">committing</em> them.
				</h2>
				<p className="mx-auto mt-4 max-w-[450px] text-base leading-relaxed text-white/50">
					One file in your repo. One key in CI. Every secret encrypted, typed, and
					version-controlled. Set up in five minutes.
				</p>
				<div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Link
						href="/docs/getting-started"
						className="inline-flex h-11 items-center justify-center rounded-lg bg-green-500 px-6 text-sm font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 transition-all hover:bg-green-400 hover:shadow-green-500/50"
					>
						Get Started →
					</Link>
					<CopyCommand command="npx dotvars init" />
				</div>

				{/* Framework icons */}
				<div className="mt-12 flex flex-wrap items-center justify-center gap-6">
					{ICONS.map((Icon, i) => (
						<Icon key={i} size={20} className="text-white/20" />
					))}
				</div>
				<p className="mt-3 text-xs text-white/20">Works with any framework</p>
			</div>
		</section>
	);
}
