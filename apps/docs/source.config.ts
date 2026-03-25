import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { varsLanguage } from "./lib/vars-lang";

export const docs = defineDocs({
	dir: "content/docs",
});

export default defineConfig({
	mdxOptions: {
		rehypeCodeOptions: {
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
			langs: [varsLanguage],
		},
	},
});
