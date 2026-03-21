import { cn } from '@/lib/utils';

type Token = { text: string; className: string };
type Line = Token[];

const LINES: Line[] = [
  [
    { text: 'DATABASE_URL', className: 'text-green-50 font-semibold' },
    { text: '  ', className: '' },
    { text: 'z.string().url().startsWith("postgres://")', className: 'text-green-500' },
  ],
  [
    { text: '  @dev', className: 'text-green-700' },
    { text: '  = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:7f3a9b2c...', className: 'text-neutral-700' },
  ],
  [
    { text: '  @prod', className: 'text-green-700' },
    { text: ' = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:e8d1f0a3...', className: 'text-neutral-700' },
  ],
  [],
  [
    { text: 'PORT', className: 'text-green-50 font-semibold' },
    { text: '  ', className: '' },
    { text: 'z.coerce.number().int().min(1024)', className: 'text-green-500' },
  ],
  [
    { text: '  @default', className: 'text-green-700' },
    { text: ' = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:2c4b8e...', className: 'text-neutral-700' },
  ],
  [],
  [
    { text: '// Cross-variable refinement', className: 'text-neutral-700 italic' },
  ],
  [
    { text: '@refine', className: 'text-green-400 font-semibold' },
    { text: ' ', className: '' },
    { text: '(env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true', className: 'text-green-500' },
  ],
  [
    { text: '  "DEBUG must be true when LOG_LEVEL is debug"', className: 'text-green-800' },
  ],
];

export function VarsCodeBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] shadow-2xl shadow-black/50',
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        <span className="ml-3 font-mono text-xs text-neutral-500">.vars</span>
      </div>
      {/* Code body */}
      <div className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.9]">
        {LINES.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-5 w-5 select-none text-right text-xs text-neutral-700">
              {i + 1}
            </span>
            <span>
              {line.length === 0 ? '\u00A0' : line.map((token, j) => (
                <span key={j} className={token.className}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
