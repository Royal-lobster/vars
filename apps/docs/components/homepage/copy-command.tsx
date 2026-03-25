"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);

	return (
		<button
			type="button"
			aria-label={`Copy command: ${command}`}
			className="group flex h-11 items-center gap-3 rounded-lg border border-white/[0.06] bg-black/40 px-4 font-mono text-sm backdrop-blur-sm transition-all hover:border-green-500/20 hover:bg-black/50"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(command);
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				} catch {
					// Fallback for non-secure contexts
				}
			}}
		>
			<span className="text-white/30" aria-hidden="true">
				$
			</span>
			<span className="text-white/50">{command}</span>
			<span
				className="ml-1 text-[10px] text-white/20 transition-colors group-hover:text-green-500"
				role="status"
			>
				{copied ? "Copied!" : "Copy"}
			</span>
		</button>
	);
}
