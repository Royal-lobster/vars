import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';
import { type NextRequest } from 'next/server';

export const revalidate = false;

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ slug: string[] }> },
) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return new Response('Not found', { status: 404 });

  const text = await getLLMText(page);
  return new Response(text);
}

export function generateStaticParams() {
  return source.generateParams();
}
