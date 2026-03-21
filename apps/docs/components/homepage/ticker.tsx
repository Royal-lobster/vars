import { Separator } from '@/components/ui/separator';

const ITEMS = [
  { label: 'AES-256-GCM' },
  { label: 'Zod' },
  { label: 'PIN-per-command' },
  { label: '4 framework plugins' },
  { label: 'LSP + VS Code' },
  { label: 'AI-safe by design' },
];

function TickerRow() {
  return (
    <>
      {ITEMS.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-6">
          <span className="whitespace-nowrap font-mono text-xs uppercase tracking-widest text-white/30">
            {item.label}
          </span>
          <Separator orientation="vertical" className="h-3 bg-white/[0.06]" />
        </span>
      ))}
    </>
  );
}

export function Ticker() {
  return (
    <div className="border-b border-white/[0.06] overflow-hidden py-7">
      <div className="flex w-max animate-marquee items-center gap-6">
        <TickerRow />
        <TickerRow />
      </div>
    </div>
  );
}
