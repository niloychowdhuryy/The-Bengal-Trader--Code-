import type { CityBuildingId } from "./city-layout";

function HouseShell({
  variation = 0,
}: {
  variation?: number;
}) {
  const wall = variation ? "#d9bd88" : "#e4c995";
  const roof = variation ? "#80513b" : "#986144";
  return (
    <g>
      <ellipse cx="0" cy="49" rx="60" ry="15" fill="#334b38" opacity=".24" />
      <path d="M-50-8 0 15v49l-50-23Z" fill={wall} stroke="#72543b" strokeWidth="2.4" />
      <path d="M0 15 50-8v49L0 64Z" fill="#c69d69" stroke="#72543b" strokeWidth="2.4" />
      <path d="M-55-12 0-48 56-23 0 9Z" fill={roof} stroke="#624633" strokeWidth="3" strokeLinejoin="round" />
      <path d="m-55-12 55 21v9l-57-23Zm55 21 56-32v9L0 29Z" fill="#684633" stroke="#624633" strokeWidth="2" />
      <path d="M-39-14 0-39 39-21M-29-8 0-27 28-14" fill="none" stroke="#bc8654" strokeWidth="2" opacity=".72" />
      <path d="M-37 0h12v17h-12Zm-2 23q8-11 16 0v19l-16-7Zm57-1h12v16l-12 6Z" fill="#7d5840" stroke="#96754d" strokeWidth="1.5" />
      <path d="M-42-10q42-28 84-10m-71 11q29-18 58-12M-39 31l33 15m16-20 30-14" fill="none" stroke="#e5c992" strokeWidth="1.4" opacity=".82" />
      <path d="M-50 52q20-5 38 6m25-3q17-9 33-14" fill="none" stroke="#9a7650" strokeWidth="1.2" opacity=".54" />
      <path d="M-30 3v11m57-12v11m-20 1v18" stroke="#dfc18d" strokeWidth="1.2" opacity=".8" />
      <path d="M-48 22 0 45m8-27 34-16" stroke="#f1ddb1" strokeWidth="1.2" opacity=".38" />
    </g>
  );
}

function MosqueArt() {
  return (
    <g>
      <ellipse cx="0" cy="49" rx="72" ry="16" fill="#334b38" opacity=".22" />
      <path d="M-60-4 0 22v52l-60-27Z" fill="#e5d2a4" stroke="#71533b" strokeWidth="2.5" />
      <path d="M0 22 60-4v51L0 74Z" fill="#c9aa78" stroke="#71533b" strokeWidth="2.5" />
      <path d="M-67-11 0-39 68-10 0 20Z" fill="#986344" stroke="#684832" strokeWidth="3" />
      <path d="M-27-35q1-34 27-44 26 10 27 44-27 12-54 0Z" fill="#d9c491" stroke="#795b40" strokeWidth="2.4" />
      <path d="M-23-36q23-13 46 0" fill="none" stroke="#a57b4e" strokeWidth="2" />
      <path d="M-7-78v-8l7-7 7 7v8" fill="#b18450" stroke="#75543b" strokeWidth="1.8" />
      <path d="M-41 0v26m-11-31v25M34 1v26m12-32v25" stroke="#f0ddba" strokeWidth="5" opacity=".82" />
      <path d="M-18 17q18-24 36 0v36l-36-16Z" fill="#76513a" stroke="#9e754c" strokeWidth="2" />
      <path d="M-20 16q20-30 40 0" fill="none" stroke="#e9d9b2" strokeWidth="3" />
      <path d="M-57-10v-22q7-15 14 0v28m86-6v-22q7-15 14 0v27" fill="#d4bd8d" stroke="#795b40" strokeWidth="2" />
      <path d="M-54-29h8m78 0h8" stroke="#a57b4e" strokeWidth="2" />
      <path d="M-47-10q47-22 94 0M-59 8 0 35m8-13 48-21" fill="none" stroke="#d7bb86" strokeWidth="1.6" />
    </g>
  );
}

function MarketArt() {
  return (
    <g>
      <ellipse cx="0" cy="48" rx="78" ry="15" fill="#334b38" opacity=".22" />
      <path d="M-67-11 0 18v48l-67-29Z" fill="#d9bd89" stroke="#72543b" strokeWidth="2.3" />
      <path d="M0 18 67-11v48L0 66Z" fill="#c7a16b" stroke="#72543b" strokeWidth="2.3" />
      <path d="M-71-17 0-48 73-16 0 16Z" fill="#8d5940" stroke="#624633" strokeWidth="3" />
      <path d="M-54-16 0-39 55-15 0 8Z" fill="#d3a366" stroke="#76513b" strokeWidth="2" />
      <path d="m-44-13 44 19m-27-28 44 19m-25-28 45 19" stroke="#f0d7a4" strokeWidth="7" />
      <path d="M-54-16v47m27-58v47m55-48v47m27-35v47" stroke="#76513b" strokeWidth="3" />
      <path d="M-57 13h48v24l-48-21Zm65 5 49-21v25L8 43Z" fill="#8b6445" stroke="#704c34" strokeWidth="2" />
      <path d="M-47 21q9-10 17 0m21 4q10-12 19-1m18-2q8-11 17-1" fill="none" stroke="#e8c788" strokeWidth="3" />
      <path d="M-49 5h16v6h-16Zm27 12h16v6h-16Zm32-14h17v6H10Z" fill="#b98553" stroke="#75543a" strokeWidth="1.3" />
      <path d="M-58-2 0 24m8-14 54-23" stroke="#e8c88d" strokeWidth="1.7" opacity=".72" />
      <path d="M-63 39 0 66m5-24 59-26" stroke="#e3c28a" strokeWidth="2" opacity=".65" />
    </g>
  );
}

function WarehouseArt() {
  return (
    <g>
      <ellipse cx="0" cy="51" rx="65" ry="16" fill="#334b38" opacity=".23" />
      <path d="M-55-7 0 18v53l-55-27Z" fill="#d9bd88" stroke="#71533b" strokeWidth="2.5" />
      <path d="M0 18 55-7v53L0 71Z" fill="#c49a66" stroke="#71533b" strokeWidth="2.5" />
      <path d="M-63-13 0-53 63-25 0 9Z" fill="#78503a" stroke="#5d4332" strokeWidth="3" />
      <path d="M-55-9 0-43 55-20M-41-4 0-29 40-12" fill="none" stroke="#ab754d" strokeWidth="2.2" />
      <path d="M-37 4h27v43l-27-12Z" fill="#704a34" stroke="#573d2e" strokeWidth="2" />
      <path d="M-31 13 0 27v33l-31-14Zm37 16 38-18v32L6 61Z" fill="#8b6344" stroke="#684832" strokeWidth="2" />
      <path d="m-27 19 24 11m-24 1 24 11m14-5 28-13m-28 24 28-13" stroke="#cba271" strokeWidth="2" />
      <path d="M-55-8 0-42 55-20m-43-15 42 19M-43-2 0-28 42-11" fill="none" stroke="#ba8a5a" strokeWidth="1.5" />
      <circle cx="0" cy="45" r="3" fill="#d7b57b" />
    </g>
  );
}

function TownHallArt() {
  return (
    <g>
      <ellipse cx="0" cy="49" rx="67" ry="16" fill="#334b38" opacity=".23" />
      <path d="M-54-6 0 18v51l-54-26Z" fill="#d9c79e" stroke="#6b4c37" strokeWidth="2.5" />
      <path d="M0 18 54-6v51L0 69Z" fill="#c59b6d" stroke="#6b4c37" strokeWidth="2.5" />
      <path d="m-62-13 62-34 64 28L0 14Z" fill="#a55f42" stroke="#654633" strokeWidth="3" />
      <path d="M-42-10 0-33 42-14M-34-4 0-23 34-8" fill="none" stroke="#d69c62" strokeWidth="2" />
      <path d="M-31 5v27m-13-33v27M19 11v27m14-33v27" stroke="#79563c" strokeWidth="6" />
      <path d="M-11 22q11-20 22 0v35L-11 48Z" fill="#725039" stroke="#e0c491" strokeWidth="2" />
      <path d="M-46 5v14m10-20v17m61 1V2m10 23V-3" stroke="#e4d1aa" strokeWidth="2.3" />
      <path d="M-7 34v12m14-12v13" stroke="#c09259" strokeWidth="1.4" />
      <path d="M-46-17 0 4l46-21M-54 9 0 33m7-16 40-18" fill="none" stroke="#e6d3ac" strokeWidth="2" opacity=".7" />
      <path d="M-7-40 0-48l8 9" fill="#dbba7e" stroke="#80583d" strokeWidth="2" />
    </g>
  );
}

function WorkshopArt() {
  return (
    <g>
      <ellipse cx="0" cy="49" rx="64" ry="15" fill="#334b38" opacity=".22" />
      <path d="M-53-5 0 19v51l-53-26Z" fill="#d3b67d" stroke="#71533b" strokeWidth="2.5" />
      <path d="M0 19 53-5v51L0 70Z" fill="#bb905e" stroke="#71533b" strokeWidth="2.5" />
      <path d="m-60-12 25-18 25 31 25-29 46 20L0 16Z" fill="#966044" stroke="#654633" strokeWidth="3" />
      <path d="M-48-11 0 11m7 11 36-16" stroke="#d0a16b" strokeWidth="2" />
      <path d="M-34 5v32l18 9V14Zm42 21 29-13v30L8 57Z" fill="#754f37" stroke="#684832" strokeWidth="2" />
      <path d="M-29 12v15m42 5 20-9m-20 17 20-9" stroke="#c99d67" strokeWidth="2" />
      <path d="M-48-10-25-25 0 7l24-27 36 16M-39-5l39 20m9 12 34-15" fill="none" stroke="#c38a58" strokeWidth="1.7" />
      <path d="M30-15v-25h13v31" fill="#a46d4a" stroke="#684832" strokeWidth="2.5" />
      <path className="workshop-smoke" d="M35-43q-9-13 2-20t-2-16m13 34q-7-10 1-17" fill="none" stroke="#e9dfc5" strokeWidth="5" strokeLinecap="round" opacity=".46" />
    </g>
  );
}

function HomeArt() {
  return (
    <g>
      <ellipse cx="0" cy="51" rx="84" ry="18" fill="#334b38" opacity=".2" />
      <path d="M-67-4 0 26v43l-67-29Z" fill="#dec99b" stroke="#72543b" strokeWidth="2.4" />
      <path d="M0 26 67-4v43L0 69Z" fill="#c59e6c" stroke="#72543b" strokeWidth="2.4" />
      <path d="m-73-10 73-38 72 32L0 20Z" fill="#87583f" stroke="#634632" strokeWidth="3" />
      <path d="M-56-13 0-42 55-18 0 7Z" fill="#a66c49" stroke="#704b35" strokeWidth="2" />
      <path d="M-24 37q12-19 24 0v30l-24-11Z" fill="#73503a" stroke="#ead1a0" strokeWidth="2" />
      <path d="M21 25h18v16L21 50Z" fill="#8b6445" stroke="#ead1a0" strokeWidth="2" />
      <path d="M-58-15 0-45 58-19M-50-8 0-34 50-12" fill="none" stroke="#bc8756" strokeWidth="1.7" />
      <path d="M-59 9 0 34m9 1 43-19" fill="none" stroke="#f0dfb8" strokeWidth="1.5" opacity=".7" />
      <path d="M-52 4 0 29m9 2 44-20" stroke="#eddbb6" strokeWidth="2" opacity=".66" />
      <path d="M-80 54q27-20 54 0t54 0m-99 7q24-17 47 0t48 0" fill="none" stroke="#93744d" strokeWidth="2" />
      <path d="M-59 45v20m34-15v14m64-27v16" stroke="#76553c" strokeWidth="2" />
    </g>
  );
}

function FarmArt() {
  return (
    <g>
      <ellipse cx="0" cy="49" rx="75" ry="19" fill="#334b38" opacity=".2" />
      <path d="M-68 26q33-27 69-2t69-1v22q-36 25-72 0t-66 3Z" fill="#a8ad72" stroke="#788153" strokeWidth="2" />
      <path d="M-53 26q23-19 50 0m-39 9q20-16 42 0m8-9q25-17 52 1m-47 9q24-16 46 0" fill="none" stroke="#d3c883" strokeWidth="2" />
      <path d="M-34-2 5 15v35l-39-17Z" fill="#d7c08d" stroke="#71533b" strokeWidth="2.3" />
      <path d="M5 15 43-2v35L5 50Z" fill="#bf9564" stroke="#71533b" strokeWidth="2.3" />
      <path d="m-41-8 47-27 45 20L5 10Z" fill="#92704a" stroke="#654633" strokeWidth="3" />
      <path d="M-19 8v22l14 7V14Z" fill="#79563e" />
      <path d="M-56 46q7-32 19-38m-5 41q8-27 18-34m75 34q-5-27-17-36" fill="none" stroke="#637d4d" strokeWidth="3" />
      <path d="M-61 30q23-18 47 0m-37 14q22-16 45 0m24-15q24-18 47 0m-37 14q21-16 43 0" fill="none" stroke="#e4d18c" strokeWidth="1.6" opacity=".85" />
    </g>
  );
}

function DockArt() {
  return (
    <g>
      <ellipse cx="0" cy="43" rx="80" ry="15" fill="#334b38" opacity=".22" />
      <path d="M-69 7 0 37l72-32v24L0 63l-69-30Z" fill="#9a714c" stroke="#60452f" strokeWidth="3" />
      <path d="M-57 10v37m27-25v37M0 34v35m30-49v37m28-50v36" stroke="#654933" strokeWidth="5" />
      <path d="M-65 9 0 38 68 8M-50 24 0 46l53-23" fill="none" stroke="#d1a26a" strokeWidth="2.5" />
      <path d="M-45-24v34m-3-31-25 25h25m6-17L-8 8h-25Z" fill="#f1e4c4" stroke="#8e6e49" strokeWidth="2" />
      <path d="M-50 7q24-9 76 1L12 27q-27 12-55 0Z" fill="#553b2d" stroke="#342e27" strokeWidth="2.5" />
      <path d="M-44 8q25-6 62 1l-9 11q-20 8-44 0Z" fill="#996541" stroke="#d3a36a" strokeWidth="1.4" />
      <path d="M-36 10 5 20m-30-13 38 10" stroke="#dfb979" strokeWidth="1.3" />
      <path d="M-77 70q17-7 34 0t34 0 34 0 34 0 34 0m-128 12q14-6 29 0t29 0 29 0 29 0" fill="none" stroke="#eff0d3" strokeWidth="2.2" strokeLinecap="round" opacity=".68" />
    </g>
  );
}

export default function CityBuildingArt({
  id,
  variation,
}: {
  id: CityBuildingId;
  variation: number;
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
    default:
      return <HouseShell variation={variation} />;
  }
}
