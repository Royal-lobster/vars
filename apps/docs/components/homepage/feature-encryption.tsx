import Image from 'next/image';

export function FeatureEncryption() {
  return (
    <section className="mx-auto grid max-w-[1120px] items-center gap-16 px-5 py-24 md:grid-cols-2 md:px-10">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-[2px] text-green-500">
          Encryption
        </span>
        <h2 className="mt-4 text-4xl font-bold leading-[1.15] tracking-[-1.5px]">
          Every value encrypted.
          <br />
          <em className="font-serif italic text-green-500 font-normal">
            Every time.
          </em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/50">
          AES-256-GCM per-value encryption with a PIN-protected master key
          stored in your OS keychain. AI coding agents can read your .vars file
          but can never access the actual secrets. Safe to commit. Safe to share.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]">
        <Image
          src="/images/fluid-green.webp"
          alt=""
          width={600}
          height={450}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/[0.06] bg-[#050505]/85 p-4 font-mono text-xs leading-relaxed backdrop-blur-xl">
          <div>
            <span className="font-semibold text-green-50">SECRET</span>{' '}
            <span className="text-green-500">z.string().min(1)</span>
          </div>
          <div>
            <span className="text-green-700">  @prod</span>{' '}
            <span className="text-neutral-700">= enc:v1:aes256gcm:9c2b4f...</span>
          </div>
          <div className="mt-1 text-green-500">✓ Encrypted — PIN required to decrypt</div>
        </div>
      </div>
    </section>
  );
}
