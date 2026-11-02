import type { CityBuildingId } from "./city-layout";
import {
  Arch,
  Barrel,
  Box,
  ChalaRoof,
  Dome,
  Figure,
  FlatRoof,
  GroundShadow,
  INK,
  Sack,
  iso,
} from "./iso";

// Original illustrative buildings. Every form is a generic game abstraction drawn
// around a centre point; none reproduces a named or documented structure.

const BRICK_LIT = "#ab6442";
const BRICK_SHADE = "#7f452c";
const TILE_LIT = "#a85a36";
const TILE_SHADE = "#723a22";
const TILE_LINE = "#5c2c18";

function MosqueArt() {
  const [dx, dy] = iso(0, 2, 54);
  return (
    <g>
      <GroundShadow u={-62} v={-40} w={124} d={80} reach={30} />
      {/* forecourt wall */}
      <Box u={-64} v={38} w={128} d={30} h={3} lit="#cfbb8e" shade="#a68c60" top="#dfd0a8" stroke={1.2} />
      <Box u={-52} v={-36} w={104} d={72} h={42} lit="#ecdcb6" shade="#bea479" />
      {[-40, -14, 12, 34].map((along) => (
        <Arch key={along} face="lit" along={along} fixed={36} width={14} height={30} />
      ))}
      <Arch face="shade" along={-14} fixed={52} width={16} height={28} />
      <FlatRoof u={-52} v={-36} w={104} d={72} z={42} fill="#dcc99c" />
      <Dome x={dx - 42} y={dy + 22} r={15} />
      <Dome x={dx + 42} y={dy + 22} r={15} />
      <Dome x={dx} y={dy - 4} r={21} />
      {/* slender corner towers */}
      {[[-54, 38], [54, 38], [54, -38]].map(([u, v]) => {
        const [x, y] = iso(u, v, 0);
        return (
          <g key={`${u}${v}`}>
            <path d={`M${x - 5} ${y}V${y - 58}h10V${y}Z`} fill="#e3cfa2" stroke={INK} strokeWidth="1.5" />
            <path d={`M${x + 1} ${y}V${y - 58}h4V${y}Z`} fill="#b9986a" />
            <path d={`M${x - 7} ${y - 58}q7-13 14 0Z`} fill="#c9a152" stroke={INK} strokeWidth="1.3" />
          </g>
        );
      })}
    </g>
  );
}

function MarketArt() {
  const stalls: [number, number, string, string][] = [
    [-58, 18, "#a8452a", "#d9a441"],
    [-14, 22, "#1f4d40", "#c75c33"],
    [30, 20, "#b9862e", "#ecdcb6"],
  ];
  return (
    <g>
      <GroundShadow u={-60} v={-46} w={120} d={40} reach={24} />
      {/* covered hall behind the stalls */}
      <Box u={-58} v={-46} w={116} d={34} h={34} lit="#d9bd89" shade="#ad8b5a" />
      {[-48, -22, 4, 30].map((along) => (
        <Arch key={along} face="lit" along={along} fixed={-12} width={14} height={24} />
      ))}
      <ChalaRoof u={-58} v={-46} w={116} d={34} z={34} rise={20} lit={TILE_LIT} shade={TILE_SHADE} line={TILE_LINE} strokes={12} />
      {/* open square with stalls under striped awnings */}
      <path d={`M${iso(-66, -8).join(" ")}L${iso(66, -8).join(" ")}L${iso(66, 58).join(" ")}L${iso(-66, 58).join(" ")}Z`} fill="#cdb483" stroke="#8f7747" strokeWidth="1.2" />
      {stalls.map(([u, v, stripe, goods]) => (
        <g key={u}>
          <Box u={u} v={v} w={30} d={14} h={9} lit="#8b6445" shade="#6a4a30" top={goods} stroke={1.2} />
          {[0, 28].map((offset) => {
            const [x, y] = iso(u + offset + 1, v + 14);
            return <path key={offset} d={`M${x} ${y}v-26`} stroke={INK} strokeWidth="2" />;
          })}
          <path
            d={`M${iso(u - 3, v - 2, 28).join(" ")}L${iso(u + 33, v - 2, 28).join(" ")}L${iso(u + 33, v + 18, 20).join(" ")}L${iso(u - 3, v + 18, 20).join(" ")}Z`}
            fill="#f3e6c6"
            stroke={INK}
            strokeWidth="1.4"
          />
          {[3, 15, 27].map((offset) => (
            <path
              key={offset}
              d={`M${iso(u + offset - 3, v - 2, 28).join(" ")}L${iso(u + offset + 3, v - 2, 28).join(" ")}L${iso(u + offset + 3, v + 18, 20).join(" ")}L${iso(u + offset - 3, v + 18, 20).join(" ")}Z`}
              fill={stripe}
            />
          ))}
        </g>
      ))}
      <Sack x={-62} y={48} />
      <Sack x={-49} y={53} fill="#c9a973" />
      <Barrel x={58} y={52} />
      <Figure x={-18} y={62} cloth="#1f4d40" />
      <Figure x={22} y={66} cloth="#efe2c4" className="city-person" delay="-2s" />
    </g>
  );
}

function WarehouseArt() {
  return (
    <g>
      <GroundShadow u={-62} v={-34} w={124} d={68} reach={28} />
      <Box u={-62} v={-34} w={124} d={68} h={44} lit={BRICK_LIT} shade={BRICK_SHADE} />
      {/* brick courses */}
      <path d={[10, 20, 30].map((z) => `M${iso(-62, 34, z).join(" ")}L${iso(62, 34, z).join(" ")}`).join("")} stroke="#6b3620" strokeWidth=".8" opacity=".6" />
      <Arch face="lit" along={-48} fixed={34} width={28} height={34} fill="#2f1c0f" />
      <Arch face="lit" along={-4} fixed={34} width={28} height={34} fill="#2f1c0f" />
      <Arch face="shade" along={-10} fixed={62} width={22} height={30} fill="#24150b" />
      <ChalaRoof u={-62} v={-34} w={124} d={68} z={44} rise={25} curve={5} lit={TILE_LIT} shade={TILE_SHADE} line={TILE_LINE} strokes={15} />
      {(() => {
        const [x, y] = iso(-34, 44);
        return <><Sack x={x} y={y} scale={1.25} /><Sack x={x + 13} y={y + 4} fill="#c9a973" scale={1.25} /><Sack x={x + 5} y={y - 7} fill="#e0cb9d" scale={1.15} /></>;
      })()}
      {(() => {
        const [x, y] = iso(18, 46);
        return <><Barrel x={x} y={y + 2} scale={1.2} /><Barrel x={x + 15} y={y + 8} scale={1.2} /></>;
      })()}
    </g>
  );
}

function TownHallArt() {
  return (
    <g>
      <GroundShadow u={-52} v={-40} w={104} d={80} reach={36} />
      {/* raised plinth and pillared lower storey */}
      <Box u={-58} v={-46} w={116} d={92} h={6} lit="#c9b48a" shade="#a48d62" top="#dac9a2" stroke={1.2} />
      <Box u={-50} v={-38} w={100} d={76} h={30} z={6} lit="#e7d4a8" shade="#bb9d6f" />
      {[-42, -22, -2, 18].map((along) => (
        <Arch key={along} face="lit" along={along} fixed={38} z={6} width={15} height={23} />
      ))}
      {[-26, 2].map((along) => (
        <Arch key={along} face="shade" along={along} fixed={50} z={6} width={16} height={23} />
      ))}
      {/* upper storey */}
      <Box u={-38} v={-26} w={76} d={54} h={25} z={36} lit="#e3cfa2" shade="#b39467" />
      {[-30, -12, 6, 22].map((along) => (
        <Arch key={along} face="lit" along={along} fixed={28} z={40} width={10} height={15} />
      ))}
      <Arch face="shade" along={-8} fixed={38} z={40} width={14} height={15} />
      <ChalaRoof u={-38} v={-26} w={76} d={54} z={61} rise={24} curve={10} lit={TILE_LIT} shade={TILE_SHADE} line={TILE_LINE} strokes={10} />
      {(() => {
        const [x, y] = iso(0, 2, 90);
        return (
          <g>
            <path d={`M${x} ${y + 6}v-30`} stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M${x} ${y - 24}l20 5-20 7Z`} fill="#8c2f18" stroke={INK} strokeWidth="1.2" />
          </g>
        );
      })()}
    </g>
  );
}

function WorkshopArt() {
  return (
    <g>
      <GroundShadow u={-52} v={-30} w={104} d={60} reach={24} />
      {/* yard with drying cloth */}
      <path d={`M${iso(-64, 28).join(" ")}L${iso(58, 28).join(" ")}L${iso(58, 66).join(" ")}L${iso(-64, 66).join(" ")}Z`} fill="#c8ae7c" stroke="#8f7747" strokeWidth="1.1" />
      <Box u={-52} v={-30} w={104} d={58} h={30} lit="#d6bb84" shade="#a98858" />
      <Arch face="lit" along={-40} fixed={28} width={22} height={24} />
      <Arch face="lit" along={2} fixed={28} width={22} height={24} />
      <ChalaRoof u={-52} v={-30} w={104} d={58} z={30} rise={21} strokes={11} />
      {/* kiln chimney and smoke */}
      {(() => {
        const [x, y] = iso(52, -8, 30);
        return (
          <g>
            <path d={`M${x - 8} ${y + 22}v-52h16v52Z`} fill={BRICK_LIT} stroke={INK} strokeWidth="1.5" />
            <path d={`M${x} ${y + 22}v-52h8v52Z`} fill={BRICK_SHADE} />
            <path className="workshop-smoke" d={`M${x} ${y - 34}q-11-12 1-23t-2-20m13 36q-8-10 2-18`} fill="none" stroke="#efe6cf" strokeWidth="6.5" strokeLinecap="round" opacity=".5" />
          </g>
        );
      })()}
      {/* cloth on drying lines */}
      {[-46, -6].map((u) => {
        const a = iso(u, 46, 24);
        const b = iso(u + 34, 46, 24);
        return (
          <g key={u}>
            <path d={`M${a[0]} ${a[1] + 25}V${a[1]}L${b[0]} ${b[1]}V${b[1] + 25}`} fill="none" stroke={INK} strokeWidth="1.8" />
            <path d={`M${a[0] + 3} ${a[1] + 2}L${b[0] - 3} ${b[1] + 1}l-2 17q-14 2-24-8Z`} fill={u < -10 ? "#b5492a" : "#efe2c4"} stroke={INK} strokeWidth="1" />
          </g>
        );
      })}
      <Figure x={-44} y={70} cloth="#3b6a5a" className="city-person" delay="-4s" />
    </g>
  );
}

function HomeArt() {
  return (
    <g>
      <GroundShadow u={-40} v={-34} w={80} d={56} reach={26} />
      {/* garden wall around a courtyard */}
      <path d={`M${iso(-62, 18).join(" ")}L${iso(58, 18).join(" ")}L${iso(58, 68).join(" ")}L${iso(-62, 68).join(" ")}Z`} fill="#a9ad6e" stroke="#6f7a45" strokeWidth="1.2" />
      <Box u={-62} v={66} w={120} d={3} h={9} lit="#d2bb8c" shade="#a68c60" top="#e4d3ab" stroke={1.1} />
      <Box u={56} v={18} w={3} d={50} h={9} lit="#d2bb8c" shade="#a68c60" top="#e4d3ab" stroke={1.1} />
      {/* banana plants and a kitchen plot */}
      {[[-44, 40], [-24, 50]].map(([u, v]) => {
        const [x, y] = iso(u, v);
        return (
          <g key={u} stroke="#31502b" strokeWidth="1.1">
            <path d={`M${x} ${y}v-18`} stroke="#6a7a3c" strokeWidth="2.6" />
            <path d={`M${x} ${y - 16}q-16-10-20 3 12 3 20-3Zm0 0q16-10 20 3-12 3-20-3Zm0-2q-8-15 1-20 8 6-1 20Z`} fill="#5f8f46" />
          </g>
        );
      })}
      <path d={`M${iso(14, 34).join(" ")}L${iso(46, 34).join(" ")}L${iso(46, 58).join(" ")}L${iso(14, 58).join(" ")}Z`} fill="#6f8a48" stroke="#4d6530" strokeWidth="1" />
      <path d={[40, 46, 52].map((v) => `M${iso(16, v).join(" ")}L${iso(44, v).join(" ")}`).join("")} stroke="#a7ba6a" strokeWidth="1.6" />
      <Box u={-40} v={-34} w={80} d={52} h={30} lit="#e4cf9f" shade="#ba9a6b" />
      <Arch face="lit" along={-10} fixed={18} width={18} height={24} fill="#4a2e19" />
      <Arch face="lit" along={-32} fixed={18} width={11} height={15} z={6} />
      <Arch face="lit" along={18} fixed={18} width={11} height={15} z={6} />
      <Arch face="shade" along={-12} fixed={40} width={13} height={15} z={6} />
      <ChalaRoof u={-40} v={-34} w={80} d={52} z={30} rise={26} curve={11} strokes={10} />
    </g>
  );
}

function FarmArt() {
  const paddies: [number, number, string][] = [
    [-70, 16, "#7f9c4e"],
    [-22, 16, "#a6ab59"],
    [26, 16, "#7f9c4e"],
    [-70, 46, "#b6ad5d"],
    [-22, 46, "#8aa650"],
  ];
  return (
    <g>
      {paddies.map(([u, v, fill]) => (
        <g key={`${u}${v}`}>
          <path d={`M${iso(u, v).join(" ")}L${iso(u + 44, v).join(" ")}L${iso(u + 44, v + 26).join(" ")}L${iso(u, v + 26).join(" ")}Z`} fill={fill} stroke="#5e6f37" strokeWidth="1.8" />
          <path d={[6, 12, 18].map((o) => `M${iso(u + 3, v + o).join(" ")}L${iso(u + 41, v + o).join(" ")}`).join("")} stroke="#d9d58c" strokeWidth="1.1" opacity=".75" />
        </g>
      ))}
      <GroundShadow u={-34} v={-34} w={66} d={44} reach={22} />
      <Box u={-34} v={-34} w={66} d={44} h={24} lit="#d7c08d" shade="#ad8d5f" />
      <Arch face="lit" along={-14} fixed={10} width={16} height={20} />
      <ChalaRoof u={-34} v={-34} w={66} d={44} z={24} rise={22} curve={8} strokes={8} />
      {/* haystack */}
      {(() => {
        const [x, y] = iso(44, -18);
        return (
          <g stroke={INK} strokeWidth="1.3">
            <path d={`M${x - 15} ${y + 7}q0-28 15-30 15 2 15 30-15 7-30 0Z`} fill="#d3ad60" />
            <path d={`M${x - 9} ${y - 3}q9 4 19 0m-19-8q9 3 16 0`} fill="none" stroke="#8d6a36" strokeWidth="1" />
          </g>
        );
      })()}
      {(() => {
        const [x, y] = iso(30, 58);
        return <Figure x={x} y={y} cloth="#efe2c4" className="city-person" delay="-1s" />;
      })()}
    </g>
  );
}

function DockArt() {
  const [mx, my] = iso(-34, 34, 34);
  return (
    <g>
      {/* timber wharf on piles, reaching out over the water */}
      {[-64, -32, 0, 32, 64].map((u) => {
        const [x, y] = iso(u, 46, 0);
        return <path key={u} d={`M${x} ${y - 6}v24`} stroke={INK} strokeWidth="5" />;
      })}
      <Box u={-70} v={-6} w={140} d={52} h={7} lit="#7d5430" shade="#5c3b20" top="#a9794a" />
      <path d={[-48, -26, -4, 18, 40].map((u) => `M${iso(u, -6, 7).join(" ")}L${iso(u, 46, 7).join(" ")}`).join("")} stroke="#5c3b20" strokeWidth="1.2" />
      {/* slipway store */}
      <Box u={-52} v={-40} w={64} d={32} h={24} lit="#c9a973" shade="#9e7f50" />
      <Arch face="lit" along={-42} fixed={-8} width={20} height={19} />
      <ChalaRoof u={-52} v={-40} w={64} d={32} z={24} rise={17} strokes={7} />
      {/* derrick */}
      <g stroke={INK} strokeLinecap="round">
        <path d={`M${mx} ${my + 34}V${my - 26}`} strokeWidth="4" />
        <path d={`M${mx} ${my - 18}L${mx + 46} ${my - 34}`} strokeWidth="3" />
        <path d={`M${mx + 44} ${my - 33}v28`} strokeWidth="1.2" />
      </g>
      <Sack x={mx + 44} y={my - 1} fill="#c9a973" />
      {(() => {
        const [x, y] = iso(20, 22, 7);
        return (
          <>
            <Sack x={x} y={y} scale={1.1} />
            <Barrel x={x + 16} y={y + 4} />
            <Figure x={x - 26} y={y + 12} cloth="#a8452a" carrying className="city-person" delay="-3s" />
          </>
        );
      })()}
      {/* hull on the slip */}
      <g transform={`translate(${iso(48, 2, 7).join(" ")}) rotate(-6)`} stroke={INK} strokeWidth="1.5">
        <path d="M-30-6q30 8 60-4-3 17-20 20h-24q-13-3-16-16Z" fill="#6b4426" />
        <path d="M-26-3q26 6 52-3l-2 5q-24 8-47 3Z" fill="#b57f49" stroke="none" />
      </g>
    </g>
  );
}

export default function CityBuildingArt({
  id,
}: {
  id: CityBuildingId;
}) {
  switch (id) {
    case "mosque":
      return <MosqueArt />;
    case "market":
      return <MarketArt />;
    case "warehouse":
      return <WarehouseArt />;
    case "town":
      return <TownHallArt />;
    case "workshop":
      return <WorkshopArt />;
    case "home":
      return <HomeArt />;
    case "farm":
      return <FarmArt />;
    case "docks":
      return <DockArt />;
  }
}
