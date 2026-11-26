import { useI18n } from "../i18n/index.tsx";

const GLOW = (id: string) => (
  <defs>
    <radialGradient id={id} cx="50%" cy="50%" r="50%">
      <stop offset="0" stopColor="#5BD37F" stopOpacity="0.35" />
      <stop offset="1" stopColor="#5BD37F" stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Slide 1: a bank card and cash. */
export function ArtCard() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 320 280" role="img" aria-label={t("welcome.1.art")}>
      <defs>
        <radialGradient id="wg1" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#5BD37F" stopOpacity="0.35" /><stop offset="1" stopColor="#5BD37F" stopOpacity="0" /></radialGradient>
        <linearGradient id="wc1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2E8F52" /><stop offset="1" stopColor="#14502D" /></linearGradient>
      </defs>
      <circle cx="160" cy="140" r="132" fill="url(#wg1)" />
      <g transform="rotate(9 205 175)">
        <rect x="120" y="128" width="172" height="98" rx="12" fill="#5BD37F" />
        <rect x="130" y="138" width="152" height="78" rx="8" fill="none" stroke="#0E3B21" strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="206" cy="177" r="24" fill="#0E3B21" fillOpacity="0.88" />
        <text x="206" y="182" textAnchor="middle" fontSize="13" fontWeight="800" fill="#5BD37F">{"RWF"}</text>
        <rect x="140" y="150" width="26" height="6" rx="3" fill="#0E3B21" fillOpacity="0.55" />
        <rect x="246" y="198" width="26" height="6" rx="3" fill="#0E3B21" fillOpacity="0.55" />
      </g>
      <g transform="rotate(-8 125 115)">
        <rect x="38" y="62" width="172" height="108" rx="14" fill="url(#wc1)" stroke="#9BE7B4" strokeOpacity="0.55" strokeWidth="1.5" />
        <rect x="38" y="88" width="172" height="20" fill="#0A2616" fillOpacity="0.65" />
        <rect x="54" y="124" width="36" height="26" rx="6" fill="#E8D48A" />
        <rect x="54" y="124" width="36" height="26" rx="6" fill="none" stroke="#7A6A2A" strokeOpacity="0.5" />
        <circle cx="64" cy="158" r="3" fill="#CFEFD9" /><circle cx="74" cy="158" r="3" fill="#CFEFD9" /><circle cx="84" cy="158" r="3" fill="#CFEFD9" />
        <rect x="150" y="150" width="44" height="8" rx="4" fill="#CFEFD9" fillOpacity="0.8" />
      </g>
      <circle cx="264" cy="64" r="15" fill="#E8D48A" /><circle cx="264" cy="64" r="9" fill="none" stroke="#7A6A2A" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="290" cy="94" r="10" fill="#E8D48A" fillOpacity="0.85" />
      <path d="M44 224 l0 14 M37 231 l14 0" stroke="#9BE7B4" strokeWidth="3" strokeLinecap="round" />
      <path d="M286 238 l0 10 M281 243 l10 0" stroke="#9BE7B4" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Slide 2: a phone with a payment link shared in a chat bubble. */
export function ArtLink() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 320 280" role="img" aria-label={t("welcome.2.art")}>
      {GLOW("wg2")}
      <circle cx="160" cy="140" r="132" fill="url(#wg2)" />
      <rect x="100" y="22" width="124" height="236" rx="26" fill="#0A2616" stroke="#5BD37F" strokeWidth="3" />
      <rect x="142" y="32" width="40" height="8" rx="4" fill="#5BD37F" fillOpacity="0.35" />
      <rect x="114" y="54" width="96" height="14" rx="7" fill="#CFEFD9" fillOpacity="0.18" />
      <rect x="114" y="80" width="96" height="76" rx="12" fill="#14502D" stroke="#5BD37F" strokeOpacity="0.45" />
      <rect x="124" y="92" width="50" height="8" rx="4" fill="#CFEFD9" fillOpacity="0.8" />
      <rect x="124" y="110" width="72" height="8" rx="4" fill="#CFEFD9" fillOpacity="0.4" />
      <rect x="124" y="128" width="40" height="14" rx="5" fill="#E8D48A" />
      <rect x="114" y="172" width="96" height="40" rx="20" fill="#5BD37F" />
      <text x="162" y="197" textAnchor="middle" fontSize="15" fontWeight="800" fill="#04210F">{t("welcome.pay")}</text>
      <rect x="114" y="224" width="96" height="8" rx="4" fill="#CFEFD9" fillOpacity="0.18" />
      <path d="M18 74 h104 a14 14 0 0 1 14 14 v22 a14 14 0 0 1 -14 14 h-82 l-18 16 v-16 a14 14 0 0 1 -14 -14 v-22 a14 14 0 0 1 14 -14 z" fill="#5BD37F" />
      <g transform="rotate(-40 77 99)" fill="none" stroke="#04210F" strokeWidth="5" strokeLinecap="round">
        <rect x="52" y="90" width="28" height="16" rx="8" />
        <rect x="74" y="92" width="28" height="16" rx="8" transform="translate(-4 -2)" />
      </g>
      <path d="M214 168 h72 a12 12 0 0 1 12 12 v18 a12 12 0 0 1 -12 12 h-60 l-16 14 v-14 h-2 a12 12 0 0 1 -12 -12 v-18 a12 12 0 0 1 12 -12 z" fill="#2F7D46" fillOpacity="0.35" stroke="#9BE7B4" strokeOpacity="0.5" />
      <path d="M232 190 l10 10 l20 -22" fill="none" stroke="#5BD37F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M286 46 l0 14 M279 53 l14 0" stroke="#9BE7B4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="214" r="5" fill="#E8D48A" />
    </svg>
  );
}

/** Slide 3: coin stacks and a percent badge (the commission). */
export function ArtCoins() {
  const { t } = useI18n();
  const stack = (x: number, n: number) =>
    Array.from({ length: n }, (_, i) => <use key={`${x}-${i}`} href="#wcoin" x={x} y={238 - i * 9} />);
  return (
    <svg viewBox="0 0 320 280" role="img" aria-label={t("welcome.3.art")}>
      {GLOW("wg3")}
      <defs>
        <g id="wcoin">
          <ellipse cx="0" cy="8" rx="34" ry="10" fill="#1B6B3C" />
          <rect x="-34" y="0" width="68" height="8" fill="#1B6B3C" />
          <ellipse cx="0" cy="0" rx="34" ry="10" fill="#5BD37F" />
          <ellipse cx="0" cy="0" rx="22" ry="6" fill="none" stroke="#0E3B21" strokeOpacity="0.35" strokeWidth="2" />
        </g>
      </defs>
      <circle cx="160" cy="140" r="132" fill="url(#wg3)" />
      {stack(86, 3)}
      {stack(234, 4)}
      {stack(160, 6)}
      <circle cx="160" cy="124" r="40" fill="#F2FBF5" />
      <circle cx="160" cy="124" r="40" fill="none" stroke="#5BD37F" strokeWidth="4" />
      <text x="160" y="138" textAnchor="middle" fontSize="40" fontWeight="800" fill="#0E3B21">%</text>
      <path d="M236 112 l0 -30 M224 94 l12 -14 l12 14" fill="none" stroke="#5BD37F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M62 70 l0 14 M55 77 l14 0" stroke="#9BE7B4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="276" cy="156" r="6" fill="#E8D48A" />
      <circle cx="44" cy="150" r="4" fill="#E8D48A" fillOpacity="0.8" />
    </svg>
  );
}
