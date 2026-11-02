import type { VesselClassId } from "../../game/model";
import VesselArt from "./VesselArt";

interface BengalTradingVesselProps {
  x: number;
  y: number;
  moving?: boolean;
  vesselClass?: VesselClassId;
  /** Direction of travel: 1 sails right, -1 sails left. */
  facing?: 1 | -1;
  size?: number;
}

export default function BengalTradingVessel({
  x,
  y,
  moving = false,
  vesselClass = "river-boat",
  facing = 1,
  size = 1,
}: BengalTradingVesselProps) {
  return (
    <g
      className="bengal-trading-vessel"
      transform={`translate(${x} ${y})${size === 1 ? "" : ` scale(${size})`}`}
      aria-hidden="true"
    >
      <g transform="scale(0.45)">
        <g className={moving ? "vessel-under-sail" : "vessel-at-rest"}>
          <g transform={facing < 0 ? "scale(-1 1)" : undefined}>
            <VesselArt vesselClass={vesselClass} />
          </g>
        </g>
      </g>
    </g>
  );
}
