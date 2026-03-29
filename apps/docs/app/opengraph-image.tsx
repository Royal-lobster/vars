import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "vars — Encrypted Environment Variables";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Satori-safe subset of the real logo: green circle + braces + lock outline */
function Logo() {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
			{/* Green circle with lock icon */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "64px",
					height: "64px",
					borderRadius: "16px",
					background: "#22c55e",
				}}
			>
				<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
					{/* Lock shackle */}
					<path
						d="M7 11V7a5 5 0 0 1 10 0v4"
						stroke="#f0fdf4"
						strokeWidth="2.2"
						strokeLinecap="round"
					/>
					{/* Lock body */}
					<rect x="3" y="11" width="18" height="11" rx="3" fill="#f0fdf4" />
					{/* Keyhole */}
					<circle cx="12" cy="16" r="2" fill="#15803d" />
					<rect x="11" y="17" width="2" height="3" rx="0.5" fill="#15803d" />
				</svg>
			</div>
			<span
				style={{
					fontSize: "48px",
					fontWeight: 800,
					color: "white",
					fontFamily: "sans-serif",
					letterSpacing: "-2px",
				}}
			>
				vars
			</span>
		</div>
	);
}

/* Syntax-highlighted line helpers */
const kw = { color: "#c084fc" }; // purple — keywords (env, param, group, check)
const vn = { color: "#22c55e" }; // green — variable names
const tp = { color: "#38bdf8" }; // blue — types/schemas
const st = { color: "#fbbf24" }; // amber — string values
const en = { color: "#f87171" }; // red — encrypted values
const cm = { color: "rgba(255,255,255,0.25)" }; // dim — comments
const op = { color: "rgba(255,255,255,0.3)" }; // dim — operators
const mono = { fontFamily: "monospace" };

export default function OGImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				background: "linear-gradient(145deg, #0a0a0a 0%, #0d1a10 50%, #0a0a0a 100%)",
				padding: "56px 64px",
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
				gap: "48px",
			}}
		>
			{/* Left side — branding */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "24px",
					maxWidth: "480px",
				}}
			>
				<Logo />

				<span
					style={{
						fontSize: "24px",
						color: "rgba(255,255,255,0.4)",
						fontFamily: "sans-serif",
						fontWeight: 400,
						lineHeight: 1.4,
					}}
				>
					Encrypted, schema-validated, multi-environment variables. One .vars file replaces your
					entire .env workflow.
				</span>

				{/* Feature pills */}
				<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
					{["Zod schemas", "AES-256 encryption", "Multi-env", "PIN-protected"].map((label) => (
						<div
							key={label}
							style={{
								display: "flex",
								padding: "6px 14px",
								borderRadius: "8px",
								border: "1px solid rgba(34,197,94,0.15)",
								background: "rgba(34,197,94,0.05)",
								fontSize: "14px",
								fontFamily: "sans-serif",
								color: "rgba(34,197,94,0.7)",
							}}
						>
							{label}
						</div>
					))}
				</div>
			</div>

			{/* Right side — .vars file preview */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "440px",
					borderRadius: "14px",
					border: "1px solid rgba(34,197,94,0.12)",
					background: "rgba(15,15,15,0.95)",
				}}
			>
				{/* File header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						padding: "12px 18px",
						borderBottom: "1px solid rgba(255,255,255,0.06)",
						gap: "8px",
					}}
				>
					<div style={{ display: "flex", gap: "6px" }}>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
							}}
						/>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
							}}
						/>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
							}}
						/>
					</div>
					<span
						style={{
							fontSize: "12px",
							...mono,
							color: "rgba(255,255,255,0.3)",
							marginLeft: "8px",
						}}
					>
						config.vars
					</span>
				</div>

				{/* File content — showcasing real syntax */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						padding: "16px 18px",
						gap: "3px",
						...mono,
						fontSize: "13px",
						lineHeight: 1.65,
					}}
				>
					{/* env declaration */}
					<div style={{ display: "flex" }}>
						<span style={kw}>env</span>
						<span style={op}>(</span>
						<span style={st}>dev</span>
						<span style={op}>, </span>
						<span style={st}>staging</span>
						<span style={op}>, </span>
						<span style={st}>prod</span>
						<span style={op}>)</span>
					</div>

					{/* blank line */}
					<div style={{ display: "flex", height: "8px" }} />

					{/* group block */}
					<div style={{ display: "flex" }}>
						<span style={kw}>group </span>
						<span style={{ color: "white" }}>database</span>
						<span style={op}>{" {"}</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "16px" }}>
						<span style={vn}>HOST</span>
						<span style={op}> : </span>
						<span style={tp}>z.string()</span>
						<span style={op}>{" {"}</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "32px" }}>
						<span style={st}>dev</span>
						<span style={op}> = </span>
						<span style={st}>&quot;localhost&quot;</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "32px" }}>
						<span style={st}>prod</span>
						<span style={op}> = </span>
						<span style={en}>enc:aes256:Kx9m...</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "16px" }}>
						<span style={op}>{"}"}</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "16px" }}>
						<span style={kw}>public </span>
						<span style={vn}>PORT</span>
						<span style={op}> : </span>
						<span style={tp}>z.number()</span>
						<span style={op}> = </span>
						<span style={st}>5432</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={op}>{"}"}</span>
					</div>

					{/* blank line */}
					<div style={{ display: "flex", height: "8px" }} />

					{/* encrypted secret with schema */}
					<div style={{ display: "flex" }}>
						<span style={vn}>STRIPE_KEY</span>
						<span style={op}> : </span>
						<span style={tp}>z.string()</span>
						<span style={op}>{" {"}</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "16px" }}>
						<span style={st}>dev</span>
						<span style={op}> = </span>
						<span style={st}>&quot;sk_test_abc&quot;</span>
					</div>
					<div style={{ display: "flex", paddingLeft: "16px" }}>
						<span style={st}>prod</span>
						<span style={op}> = </span>
						<span style={en}>enc:aes256:Rv2q...</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={op}>{"}"}</span>
					</div>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
