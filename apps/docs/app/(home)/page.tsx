import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center text-center px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">vars</h1>
      <p className="text-fd-muted-foreground mb-8 max-w-lg">
        Stop leaking secrets in plaintext. Schema-validated, encrypted
        environment variables with Zod.
      </p>
      <div className="flex gap-4">
        <Link
          href="/docs"
          className="rounded-lg bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm hover:bg-fd-primary/90"
        >
          Get Started
        </Link>
        <a
          href="https://github.com/srujangurram/vars"
          className="rounded-lg border border-fd-border px-6 py-2.5 text-sm font-medium hover:bg-fd-accent"
        >
          GitHub
        </a>
      </div>
    </main>
  );
}
