import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "vars — Encrypted Environment Variables";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				overflow: "hidden",
				background: "#050505",
			}}
		>
			{/* Background gradient mesh */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(ellipse 80% 60% at 50% 120%, rgba(34,197,94,0.14) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 70% -10%, rgba(22,163,74,0.08) 0%, transparent 50%), radial-gradient(ellipse 40% 40% at 10% 50%, rgba(34,197,94,0.04) 0%, transparent 50%)",
					display: "flex",
				}}
			/>

			{/* Subtle dot grid */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"radial-gradient(rgba(34,197,94,0.07) 1px, transparent 1px)",
					backgroundSize: "32px 32px",
					display: "flex",
				}}
			/>

			{/* Horizontal accent line */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: 0,
					right: 0,
					height: "1px",
					background:
						"linear-gradient(90deg, transparent 5%, rgba(34,197,94,0.1) 30%, rgba(34,197,94,0.06) 70%, transparent 95%)",
					display: "flex",
				}}
			/>

			{/* Main content — left-aligned layout */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					padding: "72px 80px",
					gap: "32px",
					zIndex: 1,
					width: "100%",
				}}
			>
				{/* Logo mark */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "6px",
					}}
				>
					<span
						style={{
							fontSize: "56px",
							fontFamily: "monospace",
							fontWeight: 700,
							color: "#22c55e",
							lineHeight: 1,
						}}
					>
						{"{"}
					</span>
					<svg
						width="44"
						height="44"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#dcfce7"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
						<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						<circle cx="12" cy="16" r="1" fill="#22c55e" />
					</svg>
					<span
						style={{
							fontSize: "56px",
							fontFamily: "monospace",
							fontWeight: 700,
							color: "#22c55e",
							lineHeight: 1,
						}}
					>
						{"}"}
					</span>
				</div>

				{/* Title */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "16px",
					}}
				>
					<span
						style={{
							fontSize: "96px",
							fontWeight: 800,
							color: "white",
							letterSpacing: "-4px",
							fontFamily: "sans-serif",
							lineHeight: 0.9,
						}}
					>
						vars
					</span>
					<span
						style={{
							fontSize: "28px",
							color: "rgba(255,255,255,0.45)",
							fontFamily: "sans-serif",
							fontWeight: 400,
							letterSpacing: "-0.3px",
							lineHeight: 1.3,
						}}
					>
						Encrypted environment variables,
						<br />
						schema-validated at runtime.
					</span>
				</div>

				{/* Terminal command pill */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						marginTop: "8px",
						padding: "12px 24px",
						borderRadius: "10px",
						border: "1px solid rgba(34,197,94,0.15)",
						background: "rgba(34,197,94,0.04)",
						width: "fit-content",
					}}
				>
					<span
						style={{
							fontSize: "18px",
							fontFamily: "monospace",
							color: "rgba(34,197,94,0.6)",
							fontWeight: 500,
						}}
					>
						$
					</span>
					<span
						style={{
							fontSize: "18px",
							fontFamily: "monospace",
							color: "rgba(255,255,255,0.55)",
							fontWeight: 400,
						}}
					>
						npx dotvars init
					</span>
				</div>
			</div>

			{/* Right side decorative element — floating .vars file */}
			<div
				style={{
					position: "absolute",
					right: "60px",
					top: "50%",
					transform: "translateY(-50%)",
					display: "flex",
					flexDirection: "column",
					width: "360px",
					borderRadius: "14px",
					border: "1px solid rgba(34,197,94,0.12)",
					background:
						"linear-gradient(160deg, rgba(20,20,20,0.95) 0%, rgba(10,15,10,0.9) 100%)",
					overflow: "hidden",
					boxShadow:
						"0 0 80px rgba(34,197,94,0.06), 0 25px 50px rgba(0,0,0,0.5)",
				}}
			>
				{/* File header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						padding: "14px 20px",
						borderBottom: "1px solid rgba(255,255,255,0.06)",
						gap: "8px",
					}}
				>
					<div
						style={{
							display: "flex",
							gap: "6px",
						}}
					>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
								display: "flex",
							}}
						/>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
								display: "flex",
							}}
						/>
						<div
							style={{
								width: "10px",
								height: "10px",
								borderRadius: "50%",
								background: "rgba(255,255,255,0.08)",
								display: "flex",
							}}
						/>
					</div>
					<span
						style={{
							fontSize: "13px",
							fontFamily: "monospace",
							color: "rgba(255,255,255,0.35)",
							marginLeft: "8px",
						}}
					>
						app.vars
					</span>
				</div>

				{/* File content */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						padding: "18px 20px",
						gap: "6px",
						fontFamily: "monospace",
						fontSize: "14px",
						lineHeight: 1.7,
					}}
				>
					<span style={{ color: "rgba(255,255,255,0.25)" }}>
						# Database
					</span>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>DATABASE_URL</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>
							enc:aes256:Kx9...
						</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>REDIS_URL</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>
							enc:aes256:Qm7...
						</span>
					</div>
					<div
						style={{
							height: "1px",
							background: "rgba(255,255,255,0.04)",
							margin: "6px 0",
							display: "flex",
						}}
					/>
					<span style={{ color: "rgba(255,255,255,0.25)" }}>
						# API Keys
					</span>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>STRIPE_KEY</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>
							enc:aes256:Rv2...
						</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>JWT_SECRET</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>
							enc:aes256:Wn4...
						</span>
					</div>
				</div>
			</div>

			{/* Bottom domain watermark */}
			<div
				style={{
					position: "absolute",
					bottom: "28px",
					left: "80px",
					display: "flex",
					alignItems: "center",
					gap: "8px",
				}}
			>
				<div
					style={{
						width: "6px",
						height: "6px",
						borderRadius: "50%",
						background: "#22c55e",
						display: "flex",
					}}
				/>
				<span
					style={{
						fontSize: "15px",
						fontFamily: "sans-serif",
						color: "rgba(255,255,255,0.25)",
						fontWeight: 500,
						letterSpacing: "0.5px",
					}}
				>
					vars.dev
				</span>
			</div>
		</div>,
		{ ...size },
	);
}
