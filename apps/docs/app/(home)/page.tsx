import { Hero } from '@/components/homepage/hero';
import { Ticker } from '@/components/homepage/ticker';
import { Comparison } from '@/components/homepage/comparison';
import { Differentiators } from '@/components/homepage/differentiators';
import { Workflow } from '@/components/homepage/workflow';
import { Bento } from '@/components/homepage/bento';
import { CTA } from '@/components/homepage/cta';
import { Footer } from '@/components/homepage/footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Hero />
      <Ticker />
      <Comparison />
      <Differentiators />
      <Workflow />
      <Bento />
      <CTA />
      <Footer />
    </main>
  );
}
