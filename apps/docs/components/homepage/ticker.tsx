import { Separator } from "@/components/ui/separator";

const ITEMS = [
	{ label: "Encrypted secrets in git" },
	{ label: "Zod type safety" },
	{ label: "One key for CI/CD" },
	{ label: "Any framework" },
	{ label: "VS Code extension" },
	{ label: "PIN-protected from AI" },
];

function TickerRow() {
	return (
		<>
			{ITEMS.map((item, i) => (
				<span key={i} className="flex shrink-0 items-center gap-6">
					<span className="whitespace-nowrap font-mono text-xs uppercase tracking-widest text-white/30">
						{item.label}
					</span>
					<Separator orientation="vertical" className="h-3 bg-white/[0.06]" />
				</span>
			))}
		</>
	);
}

export function Ticker() {
	return (
		<div className="border-b border-white/[0.06] overflow-hidden py-7">
			<div className="flex w-max animate-marquee items-center gap-6 hover:[animation-play-state:paused] motion-reduce:animate-none">
				<TickerRow />
				<div aria-hidden="true" className="contents">
					<TickerRow />
				</div>
				<div aria-hidden="true" className="contents">
					<TickerRow />
				</div>
				<div aria-hidden="true" className="contents">
					<TickerRow />
				</div>
			</div>
		</div>
	);
}
