export const CHOCOBO_COLORS = [["Snow White",228,223,208],["Ash Grey",172,168,162],["Goobbue Grey",137,135,132],["Slate Grey",101,101,101],["Charcoal Grey",72,71,66],["Soot Black",43,41,35],["Rose Pink",230,159,150],["Lilac Purple",131,105,105],["Rolanberry Red",91,23,41],["Dalamud Red",120,26,26],["Rust Red",98,34,7],["Wine Red",69,21,17],["Coral Pink",204,108,94],["Blood Red",145,59,48],["Salmon Pink",228,170,138],["Sunset Orange",183,92,45],["Mesa Red",122,44,23],["Bark Brown",106,75,55],["Chocolate Brown",110,61,36],["Russet Brown",79,45,31],["Kobold Brown",48,33,27],["Cork Brown",201,145,86],["Qiqirn Brown",153,110,63],["Opo-opo Brown",123,92,45],["Aldgoat Brown",162,135,92],["Pumpkin Orange",197,116,36],["Acorn Brown",142,88,27],["Orchard Brown",100,66,22],["Chestnut Brown",61,41,13],["Gobbiebag Brown",185,164,137],["Shale Brown",146,129,108],["Mole Brown",97,82,69],["Loam Brown",63,51,41],["Bone White",235,211,160],["Ul Brown",183,163,112],["Desert Yellow",219,180,87],["Honey Yellow",250,198,43],["Millioncorn Yellow",228,158,52],["Coeurl Yellow",188,136,4],["Cream Yellow",242,215,112],["Halatali Yellow",165,132,48],["Raisin Brown",64,51,17],["Mud Green",88,82,48],["Sylph Green",187,187,138],["Lime Green",171,176,84],["Moss Green",112,115,38],["Meadow Green",139,156,99],["Olive Green",75,82,50],["Marsh Green",50,54,33],["Apple Green",149,174,92],["Cactuar Green",101,130,65],["Hunter Green",40,75,43],["Ochu Green",64,99,57],["Adamantoise Green",95,117,88],["Nophica Green",59,77,60],["Deepwood Green",30,42,33],["Celeste Green",150,189,185],["Turquoise Green",67,114,114],["Morbol Green",31,70,70],["Ice Blue",178,196,206],["Sky Blue",131,176,210],["Seafog Blue",100,129,160],["Peacock Blue",59,104,134],["Rhotano Blue",28,61,84],["Corpse Blue",142,155,172],["Ceruleum Blue",79,87,102],["Woad Blue",47,56,81],["Ink Blue",26,31,39],["Raptor Blue",91,127,192],["Othard Blue",47,88,137],["Storm Blue",35,65,114],["Void Blue",17,41,68],["Royal Blue",39,48,103],["Midnight Blue",24,25,55],["Shadow Blue",55,55,71],["Abyssal Blue",49,45,87],["Lavender Purple",135,127,174],["Gloom Purple",81,69,96],["Currant Purple",50,44,59],["Iris Purple",183,158,188],["Grape Purple",59,42,61],["Lotus Pink",254,206,245],["Colibri Pink",220,155,202],["Plum Purple",121,82,108],["Regal Purple",102,48,78]] as const;

export const CHOCOBO_FRUIT = ["Xelphatol Apple","Doman Plum","Mamook Pear","Valfruit","Cieldalaes Pineapple","O'Ghomoro Berries"] as const;

export type SubmarinePart = { code:string; name:string; slot:"Hull"|"Stern"|"Bow"|"Bridge"; rank:number; cost:number; stats:[number,number,number,number,number] };
const families = ["Shark","Unkiu","Whale","Coelacanth","Syldra","Modified Shark","Modified Unkiu","Modified Whale","Modified Coelacanth","Modified Syldra"];
const ranks = [1,15,25,35,45,50,50,50,50,50], costs = [5,9,12,14,17,20,20,20,20,20];
const stats: Record<SubmarinePart["slot"], number[][]> = {
  Hull:[[-10,30,20,40,20],[15,10,0,60,15],[-15,55,35,15,20],[40,-10,25,40,25],[10,75,30,-15,5],[-5,40,25,45,35],[20,15,5,65,25],[-10,55,40,20,30],[40,-5,30,40,30],[10,80,30,-15,10]],
  Stern:[[-30,20,60,30,15],[15,0,30,40,25],[15,20,0,55,15],[10,25,35,25,25],[20,60,35,-15,5],[-25,25,70,35,25],[20,5,35,45,35],[20,20,5,60,20],[10,25,40,30,30],[20,60,35,-10,10]],
  Bow:[[50,40,10,-20,15],[60,20,20,-15,10],[25,60,-15,20,15],[65,10,-10,30,0],[45,30,-15,40,40],[55,50,-15,-15,25],[65,25,25,-10,20],[25,65,-10,25,25],[70,15,-10,30,5],[45,30,-10,40,40]],
  Bridge:[[20,20,20,20,20],[25,5,25,30,30],[0,25,20,45,40],[55,20,35,-15,50],[55,20,-5,30,60],[25,25,30,25,35],[30,10,30,35,40],[0,30,25,50,45],[60,20,35,-10,55],[60,20,-5,30,60]],
};
const letter = (name:string) => `${name.startsWith("Modified ") ? name.slice(9,10) : name.slice(0,1)}${name.startsWith("Modified ") ? "+" : ""}`;
export const SUBMARINE_PARTS: SubmarinePart[] = (["Hull","Stern","Bow","Bridge"] as const).flatMap(slot => families.map((name,index) => ({code:letter(name),name:`${name}-class ${slot === "Hull" ? "Pressure Hull" : slot}`,slot,rank:ranks[index],cost:costs[index],stats:stats[slot][index] as SubmarinePart["stats"]})));

export const MATERIA_GRADES = [
  {name:"XII",value:54,firstOvermeldOnly:true},{name:"XI",value:18,firstOvermeldOnly:false},{name:"X",value:36,firstOvermeldOnly:true},{name:"IX",value:12,firstOvermeldOnly:false},
  {name:"VIII",value:24,firstOvermeldOnly:true},{name:"VII",value:8,firstOvermeldOnly:false},{name:"VI",value:16,firstOvermeldOnly:true},{name:"V",value:6,firstOvermeldOnly:false},
] as const;
export const OVERMELD_RATES = [100,100,17,10,7];

export const RELIC_SERIES = [
  {name:"Zodiac (ARR)",stages:["Base relic","Zenith","Atma","Animus books","Novus","Nexus","Zodiac","Zeta"]},
  {name:"Anima (Heavensward)",stages:["Animated","Awoken","Anima","Hyperconductive","Reconditioned","Sharpened","Complete","Lux"]},
  {name:"Eurekan (Stormblood)",stages:["Anemos","Pagos","Pyros","Hydatos","Physeos"]},
  {name:"Resistance (Shadowbringers)",stages:["Resistance","Augmented","Recollection","Law's Order","Augmented Law's Order","Blade's"]},
  {name:"Manderville (Endwalker)",stages:["Manderville","Amazing","Majestic","Mandervillous"]},
  {name:"Phantom (Dawntrail)",stages:["Base","Phantom Paste","Demiatma","Final enhancements"]},
] as const;

export const CRAFTER_GATHERER_JOBS = ["Carpenter","Blacksmith","Armorer","Goldsmith","Leatherworker","Weaver","Alchemist","Culinarian","Miner","Botanist","Fisher"];
export const COMBAT_JOBS = ["Paladin","Warrior","Dark Knight","Gunbreaker","White Mage","Scholar","Astrologian","Sage","Monk","Dragoon","Ninja","Samurai","Reaper","Viper","Bard","Machinist","Dancer","Black Mage","Summoner","Red Mage","Pictomancer"];
