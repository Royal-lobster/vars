import "./global.css";
import { instrumentSans, jetbrainsMono, newsreader } from "@/lib/fonts";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

export const metadata = {
	title: {
		template: "%s | vars",
		default: "vars — Encrypted Environment Variables",
	},
	description:
		"Schema-validated, encrypted, multi-environment variables. One .vars file replaces your entire .env workflow.",
	metadataBase: new URL("https://vars-docs.vercel.app"),
	openGraph: {
		siteName: "vars",
		type: "website",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "vars — Encrypted Environment Variables",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: ["/og-image.png"],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className={`dark ${instrumentSans.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<RootProvider
					theme={{
						enabled: false,
					}}
				>
					{children}
				</RootProvider>
			</body>
		</html>
	);
}
