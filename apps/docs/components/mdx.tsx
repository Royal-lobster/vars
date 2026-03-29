import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		Accordion,
		Accordions,
		...components,
	};
}
