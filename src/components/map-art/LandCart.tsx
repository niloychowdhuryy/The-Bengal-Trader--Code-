// A bullock cart: original illustrative art. Banglapedia notes that bulls and buffaloes
// have long pulled carts in Bengal, though that isn't specific evidence for the 1660s.
const INK = "#2a1b12";

export function CartArt() {
  return (
    <>
      <ellipse cx="0" cy="11" rx="52" ry="7" fill="#10262a" opacity=".3" />
      {/* bullock */}
      <path d="M22-14q14-5 26-1 6 1 8-4l9 3q-2 8-7 10l-1 18h-5l-1-11q-11 3-20 0l-2 11h-5l-1-15q-2-6-1-11Z" fill="#c9b08a" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m56-20 3-7m6 8 4-6" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="60" cy="-13" r="1.3" fill={INK} />
      {/* yoke and shaft */}
      <path d="M-14-7 40-18" stroke="#5e3c20" strokeWidth="3.4" strokeLinecap="round" />
      {/* cart bed with thatched hood and cargo */}
      <path d="M-46-22q19-20 40 0Z" fill="#c89a58" stroke={INK} strokeWidth="1.7" />
      <path d="M-38-23q11-11 24 0m-16-1q4-5 8 0" fill="none" stroke="#8c6a35" strokeWidth="1.1" />
      <path d="M-46-22v13m40-13v13" stroke={INK} strokeWidth="2.2" />
      <path d="M-40-9q0-9 8-9 7 0 7 9Zm15 0q0-7 7-7 7 0 7 7Z" fill="#d4b888" stroke={INK} strokeWidth="1.2" />
      <path d="M-52-9H0l-3 7h-46Z" fill="#8b5a30" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {/* wheel */}
      <circle cx="-26" cy="0" r="11.5" fill="#6b4426" stroke={INK} strokeWidth="2" />
      <circle cx="-26" cy="0" r="7.5" fill="#d9c28c" stroke={INK} strokeWidth="1.2" />
      <path d="M-26-7.5v15M-33.5 0h15m-12.5-5 10 10m0-10-10 10" stroke={INK} strokeWidth="1.3" />
      <circle cx="-26" cy="0" r="2" fill={INK} />
    </>
  );
}

export default function LandCart({
  x,
  y,
  moving = false,
  facing = 1,
  size = 1,
}: {
  x: number;
  y: number;
  moving?: boolean;
  facing?: 1 | -1;
  size?: number;
}) {
  return (
    <g
      className="bengal-land-cart"
      transform={`translate(${x} ${y})${size === 1 ? "" : ` scale(${size})`}`}
      aria-hidden="true"
    >
      <g transform="scale(0.45)">
        <g className={moving ? "cart-rolling" : undefined}>
          <g transform={facing < 0 ? "scale(-1 1)" : undefined}>
            <CartArt />
          </g>
        </g>
      </g>
    </g>
  );
}

export function CartPortrait() {
  return (
    <svg className="vessel-portrait" viewBox="-90 -60 180 128" aria-hidden="true">
      <CartArt />
    </svg>
  );
}
