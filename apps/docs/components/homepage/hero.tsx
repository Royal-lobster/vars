import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CopyCommand } from "./copy-command";
import { HeroCodeToggle } from "./hero-code-toggle";
import { VarsDynamicCodeBlock } from "./vars-codeblock";

const UNLOCKED_CODE = `env(dev, staging, prod)

public PORT : z.number().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = "postgres://admin@staging.db.internal:5432/myapp"
  prod    = "postgres://admin@prod.db.internal:5432/myapp"
}

API_KEY : z.string().min(32) {
  dev     = "dev_key_a1b2c3d4e5f6g7h8i9j0k1l2m3"
  staging = "stg_key_m3l2k1j0i9h8g7f6e5d4c3b2a1"
  prod    = "prod_key_x9y8w7v6u5t4s3r2q1p0o9n8m7"
} (description = "Primary API key", expires = 2026-09-01)`;

const VAULT_CODE = `env(dev, staging, prod)

public PORT : z.number().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = enc:v2:aes256gcm-det:7f3a9b2c:d4e5f6a1:g7h8i9b2
  staging = enc:v2:aes256gcm-det:b2c3d4e5:f6g7h8a1:i9j0k1b2
  prod    = enc:v2:aes256gcm-det:e8d1f0a3:k5l6m7c3:n8o9p0d4
}

API_KEY : z.string().min(32) {
  dev     = enc:v2:aes256gcm-det:9c2b4f7a:w7x8y9g7:z0a1b2h8
  staging = enc:v2:aes256gcm-det:a1b2c3d4:e5f6g7h8:i9j0k1l2
  prod    = enc:v2:aes256gcm-det:f3e2d1c0:c3d4e5i9:f6g7h8j0
} (description = "Primary API key", expires = 2026-09-01)`;

const codeBlockClass =
	"[&_figure]:!my-0 [&_figure]:!rounded-xl [&_figure]:!shadow-2xl [&_figure]:!shadow-black/50 [&_pre]:!text-[13px] [&_pre]:!leading-[1.9]";

export function Hero() {
	return (
		<section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16 md:px-10">
			{/* Background image */}
			<div className="absolute inset-0 z-0">
				<img
					src="/images/hero-bg.webp"
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
				/>
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_40%,transparent_30%,#050505_75%)]" />
				<div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
			</div>

			{/* Content */}
			<div className="relative z-10 flex w-full max-w-[800px] min-w-0 flex-col items-center text-center">
				<Badge
					variant="outline"
					className="mb-8 gap-2 border-green-500/15 bg-green-500/[0.08] px-4 py-1.5 font-mono text-xs text-green-500"
				>
					<span
						className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px] shadow-green-500"
						aria-hidden="true"
					/>
					One file. One key.
				</Badge>

				<h1 className="font-sans text-[clamp(40px,7vw,68px)] font-bold leading-[1.05] tracking-[-3px] text-white">
					Every secret in git.
					<br />
					Just one key in <em className="font-serif italic text-green-500 font-normal">prod.</em>
				</h1>

				<p className="mt-6 max-w-[520px] text-[clamp(15px,2vw,17px)] leading-relaxed text-white/50">
					vars is a single config file that holds your secrets — encrypted — alongside schemas and
					defaults. Commit it to your repo. In CI, set one{" "}
					<code className="text-green-400 text-sm font-mono">VARS_KEY</code> and every secret is
					there. No syncing, no dashboards, no drift.
				</p>

				<div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
					<Link
						href="/docs"
						className="inline-flex h-11 items-center justify-center rounded-lg bg-green-500 px-6 text-sm font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 transition-all hover:bg-green-400 hover:shadow-green-500/50"
					>
						Get Started →
					</Link>
					<CopyCommand command="npx dotvars init" />
				</div>

				<HeroCodeToggle
					unlocked={<VarsDynamicCodeBlock code={UNLOCKED_CODE} className={codeBlockClass} />}
					vault={<VarsDynamicCodeBlock code={VAULT_CODE} className={codeBlockClass} />}
				/>
			</div>

			{/* Bottom fade */}
			<div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
		</section>
	);
}
