import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  // Generate a simple index of all doc pages
  const pages = source.getPages();
  const lines = pages.map(
    (page) => `- [${page.data.title}](${page.url}): ${page.data.description ?? ''}`
  );
  const content = `# vars Documentation\n\n${lines.join('\n')}`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
