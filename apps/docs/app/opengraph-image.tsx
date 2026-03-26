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
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				background: "linear-gradient(135deg, #050505 0%, #0a1a0a 50%, #0d250d 100%)",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Glow effect top-right */}
			<div
				style={{
					position: "absolute",
					top: "-120px",
					right: "-120px",
					width: "500px",
					height: "500px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 40%, transparent 70%)",
					display: "flex",
				}}
			/>

			{/* Glow effect bottom-left */}
			<div
				style={{
					position: "absolute",
					bottom: "-150px",
					left: "-100px",
					width: "450px",
					height: "450px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.03) 40%, transparent 70%)",
					display: "flex",
				}}
			/>

			{/* Grid overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)",
					backgroundSize: "60px 60px",
					display: "flex",
				}}
			/>

			{/* Content container */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "28px",
					zIndex: 1,
				}}
			>
				{/* Icon: curly braces + lock */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "4px",
						fontSize: "72px",
						fontFamily: "monospace",
						fontWeight: 700,
					}}
				>
					<span style={{ color: "#22c55e" }}>{"{"}</span>
					<svg
						width="64"
						height="64"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#f0fdf4"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
						<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						<circle cx="12" cy="16" r="1" fill="#22c55e" />
					</svg>
					<span style={{ color: "#22c55e" }}>{"}"}</span>
				</div>

				{/* Title */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "12px",
					}}
				>
					<span
						style={{
							fontSize: "80px",
							fontWeight: 700,
							color: "white",
							letterSpacing: "-3px",
							fontFamily: "sans-serif",
						}}
					>
						vars
					</span>
					<div
						style={{
							width: "80px",
							height: "3px",
							background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
							display: "flex",
						}}
					/>
				</div>

				{/* Tagline */}
				<span
					style={{
						fontSize: "24px",
						color: "rgba(255,255,255,0.5)",
						fontFamily: "sans-serif",
						fontWeight: 400,
						letterSpacing: "0.5px",
					}}
				>
					Encrypted environment variables, schema-validated
				</span>

				{/* Code snippet hint */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						marginTop: "12px",
						padding: "10px 24px",
						borderRadius: "8px",
						border: "1px solid rgba(34,197,94,0.2)",
						background: "rgba(34,197,94,0.05)",
					}}
				>
					<span
						style={{
							fontSize: "18px",
							fontFamily: "monospace",
							color: "rgba(34,197,94,0.7)",
						}}
					>
						$
					</span>
					<span
						style={{
							fontSize: "18px",
							fontFamily: "monospace",
							color: "rgba(255,255,255,0.6)",
						}}
					>
						npx vars init
					</span>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
