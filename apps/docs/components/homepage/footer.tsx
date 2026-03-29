import { Separator } from "@/components/ui/separator";

const COLUMNS = [
	{
		title: "Product",
		links: [
			{ label: "Why vars?", href: "/docs" },
			{ label: "Getting Started", href: "/docs/getting-started" },
		],
	},
	{
		title: "Integrations",
		links: [{ label: "Framework Guides", href: "/docs/frameworks" }],
	},
	{
		title: "Community",
		links: [{ label: "GitHub", href: "https://github.com/Royal-lobster/vars" }],
	},
];

export function Footer() {
	return (
		<footer className="border-t border-white/[0.06]">
			<div className="mx-auto max-w-[1120px] px-5 pb-10 pt-16 md:px-10">
				<div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4">
					{/* Brand */}
					<div>
						<div className="flex items-center gap-2.5 font-bold">
							<img src="/logo.svg" alt="vars" width={28} height={28} className="rounded-lg" />
							vars
						</div>
						<p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/25">
							Encrypted, typed, schema-first environment variables. The last env management tool
							you&apos;ll ever need.
						</p>
					</div>

					{/* Link columns */}
					{COLUMNS.map((col) => (
						<div key={col.title}>
							<h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
								{col.title}
							</h4>
							<ul className="mt-4 space-y-2.5">
								{col.links.map((link) => (
									<li key={link.label}>
										<a
											href={link.href}
											className="text-[13px] text-white/25 transition-colors hover:text-green-500"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<Separator className="my-8 bg-white/[0.06]" />

				<div className="flex flex-wrap items-center justify-between gap-4">
					<span className="text-xs text-white/25">© 2026 vars. Open source under MIT.</span>
					<div className="flex gap-4">
						<a
							href="https://github.com/Royal-lobster/vars"
							className="text-xs text-white/25 hover:text-green-500"
						>
							GitHub
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
