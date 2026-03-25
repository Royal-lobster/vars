const STEPS = [
	{
		title: "Init",
		description:
			"One command. Set a PIN. Auto-detects your framework and migrates existing .env files.",
		command: "npx vars init",
		detail: "Installs a pre-commit hook that blocks plaintext secrets from being committed.",
	},
	{
		title: "Edit",
		description:
			"Decrypt with vars show, add variables with Zod schemas. VS Code gives you autocomplete and validation.",
		command: "npx vars show",
		detail: "z.string().url(), z.number().min(1024) — same Zod you already know.",
	},
	{
		title: "Lock",
		description:
			"Run vars hide. Every secret value encrypted individually. Structure stays readable.",
		command: "npx vars hide",
		detail: "Safe to commit. Variable names and schemas are visible, only values are locked.",
	},
	{
		title: "Commit",
		description:
			"Push to git. Teammates clone the repo and enter the PIN. That's the entire onboarding.",
		command: 'git commit -m "update config"',
		detail: "No Slack DMs, no shared vaults, no waiting for access.",
	},
	{
		title: "Deploy",
		description:
			"Set VARS_KEY in CI once. Generates typed exports with Redacted<T> — typos become compile errors.",
		command: "npx vars run --env prod -- npm start",
		detail: "One secret in your dashboard replaces every env var you used to paste.",
	},
];

export function Workflow() {
	return (
		<section className="relative overflow-hidden py-24">
			{/* Subtle background glow */}
			<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-green-500/[0.03] blur-[120px] pointer-events-none" />

			<div className="relative mx-auto max-w-[800px] px-5 md:px-10">
				<div className="mb-14 text-center">
					<h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
						Your new <em className="font-serif italic text-green-500 font-normal">workflow.</em>
					</h2>
					<p className="mt-3 text-[15px] text-white/50">Five steps. That&apos;s the whole thing.</p>
				</div>

				<div className="relative flex flex-col gap-5">
					{/* Vertical connecting line */}
					<div className="absolute left-[24px] top-[28px] bottom-[28px] w-px bg-gradient-to-b from-green-500/30 via-green-500/10 to-green-500/30 hidden sm:block" />

					{STEPS.map((step, i) => (
						<div
							key={step.title}
							className="group rounded-xl border border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm p-5 transition-all hover:border-green-500/15 hover:bg-[#0a0a0a]"
						>
							<div className="flex items-center gap-5">
								{/* Number */}
								<div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 font-mono text-sm font-bold text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
									{i + 1}
								</div>

								{/* Title + description */}
								<div className="min-w-0 flex-1">
									<h3 className="text-sm font-semibold">{step.title}</h3>
									<p className="mt-0.5 text-xs text-white/40">{step.description}</p>
								</div>

								{/* Command */}
								<code className="hidden shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2 font-mono text-xs text-white/60 sm:block">
									{step.command}
								</code>
							</div>

							{/* Detail line */}
							<p className="mt-2.5 ml-14 text-[11px] text-green-400/40 leading-relaxed">
								{step.detail}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
