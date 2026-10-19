export const TONE_HEX: Record<string, string> = {
  green: '#1e9e48', red: '#d83a32', orange: '#e07a10', purple: '#6b4fe0', blue: '#1565d8', gray: '#b7bfcc', yellow: '#c99a00',
};

export function Donut({ segments, size = 150, center }: { segments: { label: string; value: number; tone: string }[]; size?: number; center?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 54; const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#eef0f4" strokeWidth="18" />
        {total > 0 && segments.filter(s => s.value > 0).map(s => {
          const len = (s.value / total) * c;
          const el = <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={TONE_HEX[s.tone]} strokeWidth="18"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
          off += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="26" fontWeight="700" fill="#142036">{center ?? total}</text>
      </svg>
      <div className="legend">
        {segments.map(s => <span key={s.label}><i style={{ background: TONE_HEX[s.tone] }} />{s.label}: <b>{s.value}</b></span>)}
      </div>
    </div>
  );
}

export function StackBar({ parts }: { parts: { value: number; tone: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="stack-bar" title={parts.map(p => `${p.label}: ${p.value}`).join(' · ')}>
      {parts.map(p => <i key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: TONE_HEX[p.tone] }} />)}
    </div>
  );
}
