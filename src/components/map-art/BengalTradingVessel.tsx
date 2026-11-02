interface BengalTradingVesselProps {
  x: number;
  y: number;
  moving?: boolean;
}

export default function BengalTradingVessel({
  x,
  y,
  moving = false,
}: BengalTradingVesselProps) {
  return (
    <g
      className="bengal-trading-vessel"
      transform={`translate(${x} ${y}) rotate(-14)`}
      aria-hidden="true"
    >
      <g transform="scale(0.45)">
        <g className={moving ? "vessel-under-sail" : undefined}>
          <ellipse cx="4" cy="14" rx="39" ry="13" fill="#263e35" opacity=".22" />
          <path d="M-39 4q27-8 77-1l-9 13q-25 12-55 1Z" fill="#49352a" stroke="#382d26" strokeWidth="2.2" />
          <path d="M-33 4q27-6 63-1l-7 9q-23 8-47 1Z" fill="#805237" stroke="#ac7748" strokeWidth="1.5" />
          <path d="M-27 4q22-4 49-1m-47 5q22-4 43-1m-36 6q18 1 32-2" fill="none" stroke="#d19a5e" strokeWidth="1.2" opacity=".9" />
          <path d="M-35 2q-6-3-7-8m76 8q8-2 12-7" fill="none" stroke="#d8ae70" strokeWidth="2" strokeLinecap="round" />
          <path d="M-6 3v-49" fill="none" stroke="#49352a" strokeWidth="4" strokeLinecap="round" />
          <path d="M-9-44-9-8-35-9Z" fill="#f3e7c7" stroke="#a88658" strokeWidth="1.5" />
          <path d="M-4-38-4-8 23-8Z" fill="#d5aa6b" stroke="#96754d" strokeWidth="1.5" />
          <path d="M-8-15q9 3 19 1M-8-25q8 2 15 1" fill="none" stroke="#c4a878" strokeWidth="1" opacity=".8" />
          <path d="M-9-45-35-9m31-29 27 30" fill="none" stroke="#806044" strokeWidth="1" opacity=".85" />
          <path d="M-14 3v-8m17 8v-9" stroke="#dcc28e" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M-2-2q7-7 15 0l-2 5H-4Z" fill="#c99558" stroke="#725039" strokeWidth="1.2" />
          <path d="M-43 22q10-6 20 0t20 0 20 0 20 0" fill="none" stroke="#f4e8c9" strokeWidth="2" strokeLinecap="round" opacity=".76" />
          <path d="M-34 27q9-4 18 0m35 0q8-4 16 0" fill="none" stroke="#fff4d8" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
        </g>
      </g>
    </g>
  );
}
