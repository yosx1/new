/* The cement plant skyline in the platform's navy/blue identity: stack with drifting steam, preheater tower,
   rotary kiln, cooler, clinker silos, cement mill and cement silos joined by conveyor galleries.
   Pure SVG (a few KB, sharp on every screen); only transforms and opacity animate, and everything stays
   still for people who ask their device to reduce motion. When real photos of the plant are added to
   PLANT_PHOTOS (files in public/photos/), the photo is shown instead with the same overlay. */
import { PLANT_PHOTOS } from '../data/photos';

type Variant = 'hero' | 'banner';

export function PlantScene({ variant = 'hero', className = '' }: { variant?: Variant; className?: string }) {
  const photo = PLANT_PHOTOS[variant];
  if (photo) {
    return (
      <div className={`plant-scene plant-photo ${variant} ${className}`} aria-hidden="true">
        <img src={photo} alt="" loading={variant === 'hero' ? 'eager' : 'lazy'} decoding="async" />
      </div>
    );
  }
  const far = variant === 'hero' ? 'rgba(154,192,255,.10)' : 'rgba(154,192,255,.14)';
  const body = variant === 'hero' ? '#0a2149' : '#0c2a5a';
  const edge = 'rgba(154,192,255,.42)';
  const lit = '#ffd27a';
  return (
    <svg className={`plant-scene ${variant} ${className}`} viewBox="0 0 1200 360" preserveAspectRatio={variant === "hero" ? "xMidYMax meet" : "xMaxYMax meet"} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ps-ground-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d2d63" stopOpacity="0" />
          <stop offset="1" stopColor="#06173a" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id={`ps-kiln-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b5fb3" />
          <stop offset=".5" stopColor={body} />
          <stop offset="1" stopColor="#061636" />
        </linearGradient>
        <radialGradient id={`ps-glow-${variant}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ff9a3c" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* far skyline: hills and a second line */}
      <path d="M0 300 C120 270 220 285 330 268 S560 250 680 262 S900 240 1010 255 S1150 248 1200 252 V360 H0Z" fill={far} />
      <g fill={far}>
        <rect x="430" y="214" width="26" height="56" /><rect x="462" y="232" width="40" height="38" />
        <rect x="1030" y="196" width="18" height="66" /><rect x="1054" y="214" width="34" height="48" />
      </g>

      {/* steam from the stack */}
      <g className="ps-steam">
        <circle cx="96" cy="40" r="16" /><circle cx="112" cy="28" r="20" /><circle cx="134" cy="18" r="24" />
      </g>

      <g fill={body} stroke={edge} strokeWidth="1.2">
        {/* stack */}
        <path d="M84 300 L92 54 H108 L116 300Z" />
        <rect x="90" y="96" width="20" height="5" fill="rgba(154,192,255,.25)" stroke="none" />
        <rect x="88" y="150" width="24" height="5" fill="rgba(154,192,255,.25)" stroke="none" />

        {/* preheater tower: frame, cyclones, platforms */}
        <rect x="160" y="70" width="128" height="230" />
        <path d="M160 70 L224 40 L288 70" fill="none" />
        <path d="M186 96 h36 v22 l-18 22 l-18 -22z M232 128 h36 v22 l-18 22 l-18 -22z M186 160 h36 v22 l-18 22 l-18 -22z M232 192 h36 v22 l-18 22 l-18 -22z" fill="#123a78" />
        <path d="M160 118 H288 M160 150 H288 M160 182 H288 M160 214 H288 M160 246 H288" fill="none" stroke="rgba(154,192,255,.22)" />
        {/* riser duct down to the kiln inlet */}
        <path d="M276 246 L310 246 L318 262" fill="none" strokeWidth="6" stroke="#0c2a5a" />

        {/* kiln piers */}
        <path d="M386 300 L394 268 H412 L420 300Z M556 300 L563 282 H581 L588 300Z M716 300 L722 294 H740 L746 300Z" />
      </g>

      {/* rotary kiln: inclined cylinder with tyres, the stripes turn */}
      <g transform="rotate(4.2 300 252)">
        <rect x="300" y="236" width="470" height="30" rx="15" fill={`url(#ps-kiln-${variant})`} stroke={edge} strokeWidth="1.2" />
        <rect x="300" y="236" width="470" height="30" rx="15" fill="none" className="ps-kiln-turn" stroke="rgba(154,192,255,.22)" strokeWidth="30" strokeDasharray="3 22" />
        <g fill="#1d4f9e" stroke={edge} strokeWidth="1">
          <rect x="392" y="231" width="12" height="40" rx="3" /><rect x="562" y="231" width="12" height="40" rx="3" /><rect x="722" y="231" width="12" height="40" rx="3" />
        </g>
      </g>
      {/* burner glow at the kiln outlet */}
      <circle cx="782" cy="292" r="26" fill={`url(#ps-glow-${variant})`} className="ps-flame" />

      <g fill={body} stroke={edge} strokeWidth="1.2">
        {/* clinker cooler */}
        <path d="M770 300 V262 H860 V300Z" />
        <rect x="800" y="246" width="34" height="16" />
        {/* clinker silos (domes) */}
        <path d="M880 300 V214 Q880 192 906 192 Q932 192 932 214 V300Z" />
        <path d="M938 300 V226 Q938 206 962 206 Q986 206 986 226 V300Z" />
        {/* cement mill building */}
        <path d="M1000 300 V222 L1034 204 L1068 222 V300Z" />
        {/* cement silos */}
        <rect x="1084" y="150" width="40" height="150" rx="6" />
        <rect x="1130" y="164" width="40" height="136" rx="6" />
        <path d="M1084 162 H1170" fill="none" stroke="rgba(154,192,255,.3)" />
      </g>
      {/* conveyor galleries */}
      <g stroke={edge} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M848 252 L900 196" /><path d="M986 232 L1010 214" /><path d="M1060 214 L1092 156" />
      </g>
      <g stroke="#0c2a5a" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M848 252 L900 196" /><path d="M986 232 L1010 214" /><path d="M1060 214 L1092 156" />
      </g>

      {/* lit windows */}
      <g fill={lit} className="ps-lights">
        <rect x="172" y="126" width="5" height="4" /><rect x="272" y="160" width="5" height="4" /><rect x="172" y="222" width="5" height="4" />
        <rect x="272" y="258" width="5" height="4" /><rect x="1018" y="250" width="6" height="5" /><rect x="1044" y="266" width="6" height="5" />
        <rect x="816" y="276" width="6" height="5" /><rect x="1098" y="196" width="4" height="4" /><rect x="1144" y="230" width="4" height="4" />
      </g>
      {/* aviation lights */}
      <circle cx="100" cy="52" r="3" fill="#ff4d4d" className="ps-beacon" />
      <circle cx="224" cy="38" r="3" fill="#ff4d4d" className="ps-beacon ps-beacon-2" />

      <rect x="0" y="292" width="1200" height="68" fill={`url(#ps-ground-${variant})`} />
      <path d="M0 300 H1200" stroke="rgba(154,192,255,.35)" strokeWidth="1" />
    </svg>
  );
}
