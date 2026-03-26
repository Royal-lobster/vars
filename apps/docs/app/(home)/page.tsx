import { Bento } from "@/components/homepage/bento";
import { Comparison } from "@/components/homepage/comparison";
import { CTA } from "@/components/homepage/cta";
import { Differentiators } from "@/components/homepage/differentiators";
import { Footer } from "@/components/homepage/footer";
import { Hero } from "@/components/homepage/hero";
import { Ticker } from "@/components/homepage/ticker";
import { Workflow } from "@/components/homepage/workflow";

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
