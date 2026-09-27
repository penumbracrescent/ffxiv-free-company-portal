"use client";
import CraftingMacroCalculator from "./CraftingMacroCalculator";
import ChocoboCalculator, { chocoboPlan } from "./calculators/ChocoboCalculator";
import { GatheringCalculator, MateriaCalculator, RelicCalculator, SquadronCalculator, SubmarineCalculator } from "./calculators/AdvancedCalculators";

export { chocoboPlan };
type Tool="crafting"|"chocobo"|"treasure-map"|"squadron"|"submarine"|"materia"|"gathering"|"relic";
const tools:{id:Tool;label:string;description:string}[]=[
  {id:"crafting",label:"Crafting Macro",description:"Personalized rotations"},
  {id:"chocobo",label:"Chocobo Color",description:"Visual feeding assistant"},
  {id:"treasure-map",label:"Treasure Maps",description:"Discord matcher & supported maps"},
  {id:"squadron",label:"Squadron Mission",description:"Saved roster optimizer"},
  {id:"submarine",label:"Submarine Build",description:"Rank-aware component search"},
  {id:"materia",label:"Materia & Stats",description:"Cap-aware overmeld plan"},
  {id:"gathering",label:"Gathering",description:"Benefit-first breakpoints"},
  {id:"relic",label:"Relic & Currency",description:"Multi-job progress"},
];

export default function PortalCalculators({initial="crafting"}:{initial?:string}){
  const active=(tools.some(tool=>tool.id===initial)?initial:"crafting") as Tool;
  return <>
    <nav className="calculator-tabs" aria-label="Calculator selection">{tools.map(tool=><a key={tool.id} className={active===tool.id?"active":""} href={`/?view=calculators&calculator=${tool.id}`}><strong>{tool.label}</strong><small>{tool.description}</small></a>)}</nav>
    {active==="crafting"?<CraftingMacroCalculator/>:active==="chocobo"?<ChocoboCalculator/>:active==="treasure-map"?<TreasureMapGuide/>:active==="squadron"?<SquadronCalculator/>:active==="submarine"?<SubmarineCalculator/>:active==="materia"?<MateriaCalculator/>:active==="gathering"?<GatheringCalculator/>:<RelicCalculator/>}
  </>;
}

const treasureMaps=[
  ["Timeworn Dragonskin (G8)","8 player","Coerthas Western Highlands, Dravanian Forelands, Churning Mists, Sea of Clouds, Dravanian Hinterlands"],
  ["Timeworn Gazelleskin (G10)","8 player","Fringes, Peaks, Lochs, Ruby Sea, Yanxia, Azim Steppe"],
  ["Timeworn Gliderskin (G11)","Solo","Lakeland, Kholusia, Amh Araeng, Il Mheg, Rak'tika Greatwood, Tempest"],
  ["Timeworn Zonureskin (G12)","8 player","Lakeland, Kholusia, Amh Araeng, Il Mheg, Rak'tika Greatwood, Tempest"],
  ["Timeworn Saigaskin (G13)","Solo","Labyrinthos, Thavnair, Garlemald, Mare Lamentorum, Elpis, Ultima Thule"],
  ["Timeworn Kumbhiraskin (G14)","8 player","Labyrinthos, Thavnair, Garlemald, Mare Lamentorum, Elpis, Ultima Thule"],
  ["Timeworn Ophiotauroskin (G15)","8 player","Elpis"],
  ["Timeworn Loboskin (G16)","Solo","Urqopacha, Kozama'uka, Yak T'el, Shaaloani, Heritage Found, Living Memory"],
  ["Timeworn Br'aaxskin (G17)","8 player","Urqopacha, Kozama'uka, Yak T'el, Shaaloani, Heritage Found, Living Memory"],
  ["Timeworn Gargantuaskin (G18)","8 player","Living Memory"]
];
function TreasureMapGuide(){return <article className="calculator-panel"><header className="calculator-heading"><div><span className="tag">Discord image matcher</span><h3>Treasure map identification</h3><p>Drop a screenshot in the configured map channel for a public party result, or use the private Discord command when you only need the answer yourself.</p></div></header>
  <section className="calculator-section"><h4>How to use it</h4><div className="calculator-ranked-result success"><b>Public map party</b><span>Post the image directly in the officer-configured treasure-map channel.</span><small>The bot replies publicly with its match, coordinates, party size, confidence, and correction controls.</small></div><div className="calculator-ranked-result"><b>Private lookup</b><span>Use <code>/fae map image:</code> or right-click a Discord message and choose <strong>Apps → Identify Treasure Map</strong>.</span><small>Only you can see command and message-action results.</small></div><p>Unfamiliar screenshots are never presented as certain. Correcting one updates that result immediately; an officer must approve its fingerprint before it can train future matches. Raw images are deleted from the bot cache after 15 minutes.</p></section>
  <section className="calculator-section"><h4>Frequently used map families</h4><p>The bundled catalog also covers older solo maps and quest or special map families.</p><div className="calculator-results">{treasureMaps.map(([name,party,zones])=><div className="calculator-ranked-result" key={name}><b>{name}</b><span>{party}</span><small>{zones}</small></div>)}</div></section>
  <section className="calculator-result"><h4>1,232 known solo and party-map locations included</h4><p>The matcher first verifies that an upload is actually a deciphered map, reads the zone and the 1-, 4-, or 8-player marker, and only compares locations inside those filters. Ordinary photos posted in the map channel are ignored. It learns additional screenshot variations only from officer-approved corrections, does not bulk-read old chat, and deletes uploaded screenshots after 15 minutes.</p><small>Reference sources: official game-data locations through <a href="https://v2.xivapi.com" target="_blank" rel="noreferrer">XIVAPI</a>, plus exact party-map references from <a href="https://github.com/hydai/ff14.tw" target="_blank" rel="noreferrer">FF14.tw Treasure Map Finder</a> (Apache-2.0).</small></section>
  </article>}
