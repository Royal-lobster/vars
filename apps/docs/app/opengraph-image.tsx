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
				background: "linear-gradient(135deg, #050505 0%, #0a1a0f 50%, #050505 100%)",
				padding: "72px 80px",
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
			}}
		>
			{/* Left side — branding */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "28px",
					maxWidth: "560px",
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

				{/* Subtitle */}
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
					Encrypted environment variables, schema-validated at runtime.
				</span>

				{/* Terminal command pill */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "12px 24px",
						borderRadius: "10px",
						border: "1px solid rgba(34,197,94,0.15)",
						background: "rgba(34,197,94,0.06)",
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

			{/* Right side — .vars file preview */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "360px",
					borderRadius: "14px",
					border: "1px solid rgba(34,197,94,0.12)",
					background: "rgba(20,20,20,0.95)",
					overflow: "hidden",
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
					<span style={{ color: "rgba(255,255,255,0.25)" }}># Database</span>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>DATABASE_URL</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>enc:aes256:Kx9...</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>REDIS_URL</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>enc:aes256:Qm7...</span>
					</div>
					<div
						style={{
							height: "1px",
							background: "rgba(255,255,255,0.04)",
							margin: "6px 0",
						}}
					/>
					<span style={{ color: "rgba(255,255,255,0.25)" }}># API Keys</span>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>STRIPE_KEY</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>enc:aes256:Rv2...</span>
					</div>
					<div style={{ display: "flex" }}>
						<span style={{ color: "#22c55e" }}>JWT_SECRET</span>
						<span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
						<span style={{ color: "rgba(187,247,208,0.6)" }}>enc:aes256:Wn4...</span>
					</div>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
