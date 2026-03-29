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
	},
	twitter: {
		card: "summary_large_image",
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
