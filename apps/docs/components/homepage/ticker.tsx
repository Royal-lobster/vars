import { Separator } from '@/components/ui/separator';

const ITEMS = [
  { label: 'AES-256-GCM', bold: true },
  { label: 'Zod', bold: true },
  { label: '6 framework plugins' },
  { label: 'LSP + VS Code' },
  { label: 'AI-safe by design' },
];

export function Ticker() {
  return (
    <div className="border-b border-white/[0.06] px-5 py-7">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {ITEMS.map((item, i) => (
          <span key={i} className="flex items-center gap-6">
            <span className="whitespace-nowrap font-mono text-xs uppercase tracking-widest text-white/25">
              {item.bold ? (
                <strong className="text-white/40">{item.label}</strong>
              ) : (
                item.label
              )}
            </span>
            {i < ITEMS.length - 1 && (
              <Separator orientation="vertical" className="h-3 bg-white/[0.06]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
