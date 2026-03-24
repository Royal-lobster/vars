import { Hero } from '@/components/homepage/hero';
import { Ticker } from '@/components/homepage/ticker';
import { Comparison } from '@/components/homepage/comparison';
import { Audience } from '@/components/homepage/audience';
import { Workflow } from '@/components/homepage/workflow';
import { FeatureEncryption } from '@/components/homepage/feature-encryption';
import { Frameworks } from '@/components/homepage/frameworks';
import { CTA } from '@/components/homepage/cta';
import { Footer } from '@/components/homepage/footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Hero />
      <Ticker />
      <Comparison />
      <Audience />
      <Workflow />
      <FeatureEncryption />
      <Frameworks />
      <CTA />
      <Footer />
    </main>
  );
}
