import { source } from "@/lib/source";

export const revalidate = false;

export async function GET() {
	const pages = source.getPages();
	const sections = pages.map(
		(page) => `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ""}`,
	);
	const content = sections.join("\n\n---\n\n");

	return new Response(content, {
		headers: { "Content-Type": "text/plain" },
	});
}
