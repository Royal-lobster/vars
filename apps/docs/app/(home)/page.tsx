import { Hero } from '@/components/homepage/hero';
import { Ticker } from '@/components/homepage/ticker';
import { Comparison } from '@/components/homepage/comparison';
import { Workflow } from '@/components/homepage/workflow';
import { Bento } from '@/components/homepage/bento';
import { Frameworks } from '@/components/homepage/frameworks';
import { CTA } from '@/components/homepage/cta';
import { Footer } from '@/components/homepage/footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Hero />
      <Ticker />
      <Comparison />
      <Workflow />
      <Bento />
      <Frameworks />
      <CTA />
      <Footer />
    </main>
  );
}
