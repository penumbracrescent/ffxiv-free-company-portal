type GuideReference = { label: string; url: string };
type Guide = {
  slug: string; parentSlug: string; type: "article"; category: string; title: string;
  summary: string; expansion: string; level: string; audience: string; tags: string[];
  imageUrl: string; order: number; content: string; references: GuideReference[];
};
const ref=(label:string,url:string):GuideReference=>({label,url});
const baseRefs=[
  ref("Official Variant and Criterion dungeon rules","https://na.finalfantasyxiv.com/lodestone/topics/detail/2627bf0e00e90852aa6cdc821f337ea9b2c12277"),
  ref("Variant route record directory","https://ffxivcollect.com/survey_records"),
];
const guide=(slug:string,title:string,summary:string,expansion:string,level:string,order:number,tags:string[],content:string,references:GuideReference[]):Guide=>({
  slug,parentSlug:"variant-criterion-collection-rewards",type:"article",category:"Variant & Criterion Dungeon",title,summary,expansion,level,audience:"Combat",
  tags:[...tags,"variant dungeon","criterion dungeon","routes","mounts","achievements"],imageUrl:"/guides/field-operations.svg",order,content,references,
});

export const VARIANT_CRITERION_GUIDES:Guide[]=[
guide("variant-criterion-sildihn-subterrane","The Sil'dihn Subterrane — Complete Variant, Criterion & Savage Guide","Complete all 12 survey records, claim Silkie, farm the Sil'dihn Throne, and prepare for Criterion and Savage.","Endwalker","90",10,["sil'dihn","silkie","sil'dihn throne","another sil'dihn subterrane"],`## At a glance
| Mode | Party | Goal and headline reward |
|---|---:|---|
| The Sil'dihn Subterrane | 1–4, any roles | 12 records → **Silkie** from **Dig Deep: The Sil'dihn Subterrane** |
| Another Sil'dihn Subterrane | 1 tank, 1 healer, 2 DPS | 4 Sil'dihn Silver per clear; **Sil'dihn Throne** drop or 100 Silver |
| Another Sil'dihn Subterrane (Savage) | Fixed light party | **The Savage Sands Below** → **Infamy of Sil'dih** |

### Entry rules
| Duty | Minimum / sync | Matching and recovery |
|---|---|---|
| Variant | Item level 575 / sync 635 | 1–4 players, no role lock; matching is off by default; Phoenix Down and two Variant actions allowed |
| Criterion | Item level 610 / sync 635 | 1 tank, 1 healer, 2 DPS; Variant Raise II only, one charge per player and refreshed after an objective or wipe |
| Savage | No listed minimum / sync 635 | Premade four only; no raises or Variant actions; 120-minute instance with a 24-minute combat enrage |

## Unlock and setup
Complete **Endwalker**, speak with **Osmon** in Old Sharlayan (X:11.9, Y:13.3), then accept **A Key to the Past** from **Shallow Moor** (X:12.0, Y:13.3). Enter through Duty → V&C Dungeon Finder. The physical entrance is Central Thanalan (X:16.8, Y:23.6). Finish the Variant quest and speak with Osmon for Criterion; clear Criterion and speak with him again for Savage.

For solo Variant runs, take Variant Cure plus a defensive action on DPS, Cure plus damage on tank, or Spirit Dart plus defensive utility on healer. In a party, ensure someone covers healing and at least one player can raise.

## All 12 survey records
Only one new record can be earned per run.
| # | Record | Required route and choice |
|---:|---|---|
| 1 | Whom the Silkie Serves | Left. Solve the eyes with green/blue ore from northeast rubble and yellow ore from the southeast corner. After teleporting, open the hidden rubble-side door before Nanamo opens the gate. |
| 2 | Pride and Acceptance | Correct ore puzzle, but let Nanamo open the gate. |
| 3 | A Spot in the Sunlight | Left. Fail the ore puzzle, then step on every cotton spore. |
| 4 | A Key Memory | Left. Fail the puzzle and avoid every cotton spore. |
| 5 | In Father's Stead | Right, left lift, then answer **the blessed spark**. |
| 6 | Ul'dah's Sin to Bear | Right, left lift, then answer **the sacred fire**. |
| 7 | To Learn More of Myrrh | Right lift. Kill the second drake group largest to smallest: father, mother, brother, sister, drakeling. Take the hidden-room incense and open the sarcophagus normally. |
| 8 | Ul'dah and Sil'dih | Middle. Fail the scales and pull the right lever. |
| 9 | Raising the Flags | Middle. Fail the scales and pull the left lever. |
| 10 | My Mother's Eyes | Middle. Helm on left pan, Fruit on right, then choose Nald. |
| 11 | The Thorne Legacy | Solve the scales as above, then choose Thal. |
| 12 | In Parchment We Trust | Follow record 7 through the incense. Target the sarcophagus and use **/bow → /respect → /vpose → /kneel** to reach Thorne Knight. |

### Mobile route card
- **Left 1–4:** correct eyes + hidden door; correct + wait; wrong + touch every spore; wrong + touch none.
- **Right 5–7/12:** left lift + blessed spark; left lift + sacred fire; right lift + drakes largest-to-smallest + incense + open normally; repeat incense and use **/bow, /respect, /vpose, /kneel**.
- **Middle 8–11:** wrong scales + right lever; wrong + left lever; Helm left/Fruit right + Nald; same scales + Thal.

**Irreversible mistakes:** touching one spore ruins record 4; missing one ruins record 3; Nanamo opening the hidden-door gate locks out record 1; a wrong drake kill order prevents the incense routes. Wait for each sarcophagus emote to register before using the next.

## Variant combat playbook
- **Geryon the Steer:** Read the arena objects before moving. Avoid the rolling barrels and line attacks, use the safe side of the moving obstacles, and mitigate the roomwide. Route choices alter the environmental pattern rather than the basic boss rules.
- **Silkie:** The tail's soap color determines its attack: lightning produces diagonal cones, wind produces knockback, and ice produces a donut/point-blank pattern. Watch which puffs the boss washes and move only after their stored element is clear.
- **Gladiator of Sil'dih:** Clone glows indicate charge distance. Let each clone stop, dodge its forward half-room cleave, then step into the area just hit to avoid the return cleave.
- **Shadowcaster Zeless Gah:** Keep away from the burning rim. Identify the active knockback scepter, remember which fire orb is connected through each portal, and resolve the transported explosion at the destination portal.
- **Thorne Knight:** Read sword orientation and knight positions before the telegraphs disappear. Preserve sprint for overlapping marching knights and directional cleaves.

## Criterion combat and trash playbook
Criterion failures usually apply Damage Down; a mechanically clean pull is more valuable than greed.

### Refuge of the Wise → Silkie
- Kill the dangerous patrols in the agreed order. **Belladonna:** get inside for its donut, look away from the gaze, and heavily mitigate its unmarked tankbuster. **Kaluk:** dodge opposite its named left/right sweep.
- **Silkie:** assign tank/healer/DPS cardinals. Tail colors still mean lightning cones, wind knockback, and ice in/out. During puff combinations, identify colors first, aim the required line through the correct puff, then move into the newly safe space. For gold/silver fate debuffs, stand where the matching colored lines cross, cleanse both stacks, and remain spread. Mitigate every Total Wash.

### Refuge of the Powerful → Gladiator
- **Armor:** Hells' Nebula sets HP to 1; heal before Infernal Weight and bait the following cone together. **Dullahan:** mitigate the bleed raidwide and its King's Will auto-attacks; the point-blank attack is untelegraphed in Savage.
- **Gladiator:** count each mirage's glows to determine its charge distance. Dodge the first half-cleaves and immediately cross into them for the reverse. Preassign chain partners and clock spots; do not drag a tether through another player. Tankbusters and Flash of Steel require planned cooldowns.

### Shadowcaster Zeless Gah
- Assign fixed clock positions and portal-reading language. A tethered object resolves through its paired portal, so look at the destination rather than the source. Place personal AoEs at the edge, preserve the center for stacks/towers, and resolve knockbacks before moving for the next portal pattern. Late pulls should prioritize survival over uptime because the enrage follows the final portal sequences.

## Savage differences and timeline
Boss mechanics are effectively the Criterion versions, but damage and HP are higher, many trash telegraphs are shortened or removed, and no death is recoverable. The 24-minute Sewer-dweller timer starts with the first enemy; a wipe respawns everything and restarts the attempt. Build a written mitigation sheet spanning both trash rooms and all three bosses, including tank invulnerabilities, healer raid cooldowns, and DPS mitigation. Practice late Criterion mechanics by holding damage so they are not skipped.

**Party Finder template:** “Another Sil'dihn (Criterion) | fresh/prog/clear | clocks + partners | know through [mechanic] | bring food.” For Savage add “deathless Criterion clears required | mitigation sheet | 24m timeline.”

## Complete reward catalog
Variant coffers are personal—every player must open their own. Matching Nanamo's suggested starting door creates a bonus coffer.

| Source | Rewards |
|---|---|
| Variant boss/personal coffers | 1 potsherd from the first boss and 2 from the final boss; Gladiator, Zeless Gah and Thorne Knight cards; Sewer Skink and Sponge Silkie minions; Deceiver's Diamonds; Sil'dihn Chair, Side Table, Kitchen Shelf and Sabotender Parasol |
| Potsherd exchange | Noir Hat 15, Longcoat 27, Gloves 9, Slacks 12, Shoes 9; Sil'dihn Earring 3; **Ample Appreciation** emote 9 |
| Criterion | 4 Sil'dihn Silver per clear; Sil'dihn Throne rare personal drop or 100 Silver; Framer's Kit 8; Desert Sun roll 8; materia 2/4 |
| Savage | 1 Sil'dihn Manuscript; Silkie Earring or Sil'dihn Banner 1; materia 1; achievement title **Infamy of Sil'dih** |

The guaranteed Criterion mount costs **25 clears** at four Silver per clear. The mount can drop earlier and is marketable; Savage does not drop Silver or the mount.

## Achievements and mounts
Defeat Silkie, Shadowcaster Zeless Gah, the gladiator of Sil'dih, and Thorne Knight for their four boss achievements. Reveal every area for **Mapping the Realm**. Unlock all records for **Dig Deep**, then claim the **Silkie Whistle** from the achievement menu.

Criterion runs **Silkie → gladiator → Zeless Gah**, with lethal trash rooms between bosses. Assign clock positions, partners, mitigation, and raise priority before entry. Normal Criterion supplies limited Variant Raise II charges and is the practice mode for Savage.

Savage removes usable raises and checkpoint recovery. A wipe resets the entire duty and respawns enemies; the timed Sewer-dweller effect eventually ends the attempt. Savage does not improve the Silver or mount farm.

- [ ] Claim **Silkie** after all records.
- [ ] Complete records 1–4, 5–8, and 9–12; verify all 12 are visible in the V&C book.
- [ ] Complete Mapping the Realm and all four Variant boss achievements.
- [ ] Farm 4 Sil'dihn Silver per Criterion clear.
- [ ] Loot the **Sil'dihn Throne** or exchange 100 Silver with **Trisassant**, Old Sharlayan (X:12.0, Y:13.3).
- [ ] Clear Savage and claim/equip **Infamy of Sil'dih**.
- [ ] Buy the Noir set, emote, orchestrion roll, and framer's kit wanted from Trisassant.
- [ ] Collect the three boss cards and desired personal-coffer minions/furnishings.

[[variant-criterion-collection-rewards|Return to the Variant & Criterion reward overview]]
[[criterion-variant-title-journey|Open the Variant & Criterion title journey]]`,[...baseRefs,ref("Sil'dihn route and achievement reference","https://ffxiv.consolegameswiki.com/wiki/The_Sil%27dihn_Subterrane"),ref("Another Sil'dihn Subterrane mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Sil%27dihn_Subterrane"),ref("Sil'dihn Savage rules and mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Sil%27dihn_Subterrane_(Savage)"),ref("Trisassant complete exchange catalog","https://ffxiv.consolegameswiki.com/wiki/Trisassant")]),

guide("variant-criterion-mount-rokkon","Mount Rokkon — Complete Variant, Criterion & Savage Guide","Complete all 12 exorcism records, claim Burabura Chochin, farm Shishioji, and prepare for Criterion and Savage.","Endwalker","90",20,["mount rokkon","burabura chochin","shishioji","mononopeke"],`## At a glance
| Mode | Party | Goal and headline reward |
|---|---:|---|
| Mount Rokkon | 1–4, any roles | 12 records → **Burabura Chochin** from **Mononopeke** |
| Another Mount Rokkon | 1 tank, 1 healer, 2 DPS | 4 Shishu Coins per clear; **Shishioji** drop or 100 Coins |
| Another Mount Rokkon (Savage) | Fixed light party | **Moving a Savage Mountain** → **Ascendant Ascetic** |

### Entry rules
| Duty | Minimum / sync | Matching and recovery |
|---|---|---|
| Variant | Item level 605 / sync 665 | 1–4 players, any roles; matching off by default; two Variant actions and Phoenix Down allowed |
| Criterion | Item level 640 / sync 665 | 1 tank, 1 healer, 2 DPS; one Variant Raise II charge each, refreshed after objectives or a wipe |
| Savage | No listed minimum / sync 665 | Premade four, no raises, no Variant actions, 120-minute instance and a dungeon-wide combat timer |

## Unlock
Complete **Endwalker**, unlock V&C through Osmon, then accept **Mononoke Aware** from Shallow Moor in Old Sharlayan (X:12.0, Y:13.3). The four V&C questlines are independent; Sil'dihn completion is not required. Finish the Variant quest and return to Osmon for Criterion, then clear Criterion for Savage.

## All 12 exorcism records
| # | Record | Required route and choice |
|---:|---|---|
| 1 | Gift of the Onmyoji | Left. Ignore the statues, close the katana case, then defeat Moko. |
| 2 | The Crimson Sword | Left. Ignore the statues and katana case. |
| 3 | A Tale of Dead Men | Left. Turn Suzaku south and Seiryu east, touch the orb, then let the Shishu Apa extinguish the lanterns. |
| 4 | Forging a Legacy | Repeat the statue/orb solution, but stop the Apa from extinguishing the lanterns. |
| 5 | The Luthier and the Songstress | Middle. Spare the baboon and defeat Gorai. |
| 6 | Lost to Avarice | Middle. Slay the baboon and defeat Gorai. |
| 7 | Beyond the Lanterns' Light | Middle. After Shishu Yoko, take the hidden western wall path before approaching the eastern door, then pull the rope. |
| 8 | The Common Man's Courage | Right. Cleanse all four stones of protection. |
| 9 | Sound of the Stone | Right. Ignore all four stones. |
| 10 | The Seal of Silence | Right. Take the Rokkon Sentinel. Do not break the fence; **/ebow** at the shrine, place the dogu, and topple the Iwakura. |
| 11 | Seasons of the Fleeting | Repeat the dogu shrine route, but topple the tree. |
| 12 | The Ogiseru's Fate | Follow record 7 to the rope. Bring the lantern enemies downstairs and kill each facing an unlit floor lantern beneath a marked wall section. Enter the Lantern of Passage and defeat Enenra. |

### Mobile route card
- **Left 1–4:** statues untouched + close case; untouched + leave case; Seiryu east/Suzaku south + let Apa finish Water III; same statues + stop Water III.
- **Middle 5–7/12:** spare baboon; kill baboon; hidden west wall + rope; same hidden route, then kill lantern enemies while they face each dark floor lantern.
- **Right 8–11:** ignore Sentinel + cleanse all stones; ignore Sentinel + cleanse none; take Sentinel + do not break fence + **/ebow** + dogu + Iwakura; same but topple tree.

**Irreversible mistakes:** interacting with either statue invalidates records 1–2; interrupting Water III invalidates 3 and allowing it invalidates 4; crossing the eastern trigger before entering the hidden wall loses 7/12; breaking the fence loses the dogu routes. For record 12, the enemy must face the lantern when it dies—not merely stand near it.

## Variant combat playbook
- **Yozakura:** flower colors and weather determine the follow-up shape. Move into the first resolved blossom pattern and watch the arena edge for the next line or knockback.
- **Moko:** Iai attacks are delayed directional cleaves. Read the sword stance and clone position, then move through the first cleave into its former area. The route changes the additional hazard layered over the sword sequence.
- **Gorai:** Shrines and seals telegraph expanding patterns. Identify the safe symbol before movement begins, then follow the safe lane rather than reacting to every flash.
- **Shishio:** Count inhaled clouds; that count controls both the number of line attacks and the later cloud-explosion size. Dodge through the line sequence, keep non-tanks out of the broad tankbuster, then leave the rear cone.
- **Enenra:** The smoke splits and recombines. Track both copies, dodge their mirrored shapes, then resolve the tethered line away from the party.

## Criterion combat and trash playbook
### Single Step → Shishio
- Do not touch the patrolling **Yuki** until Raiko/Fuko are dead; while empowered, its autos kill. Keep wide job AoEs away from its path. Dodge Raiko's point-blank and aim its charge away from the party.
- **Shishio:** count Smokeater inhales for Rokujo Revel; line lengths correspond to floor rocks. Dodge Noble Pursuit using the gaps in its charge lines. For Wail, pair each support with a DPS and resolve pair stacks without overlapping later spreads. During colored rebirth towers, soak the matching color in numeral order while passing cone tethers between players.

### Clever Roost → Gorai
- Treat the wind sprites and tengu as bosses: interrupt/stun only according to the agreed plan and keep their lines visible. Use mitigation on every unavoidable trash cast rather than saving everything for the boss.
- **Gorai:** identify each prayer/seal's origin and rotation before it starts. Assign fixed cardinal towers and partner stacks. During soldiers and exaflare-style patterns, enter the first resolved lane; do not chase the animation. Save movement tools for overlapping knockback and line sequences.

### Moko
- Assign clock spots and a single convention for sword directions. Fleeting Iai-giri jumps behind its target and cleaves according to the target's facing, so the bait player must face the agreed direction. Resolve stack/spread order before moving for exploding floor lines. Later mechanics combine the cleave bait with alternating safe corners—find the corner first, then orient the bait.

## Savage preparation
Savage keeps the Criterion solutions but increases damage/HP, removes all raises, shortens or removes trash indicators, and resets the entire duty on a wipe. Use a cooldown sheet covering Shishio raidwides, both trash rooms, Gorai, and Moko. Practice Moko's late patterns by holding DPS in Criterion. A disconnect after combat begins returns that player incapacitated.

**Party Finder template:** “Another Rokkon | fresh/prog/clear | fixed clocks + TH/DD partners | [strategy] | know through [mechanic].” Savage: “deathless Criterion clears | mitigation plan | no recovery.”

## Complete reward catalog
All Variant loot is personal; open every coffer. Following Hancock's suggested starting path produces an extra personal coffer.

| Source | Rewards |
|---|---|
| Variant coffers | 1+2 Rokkon Potsherds; Moko, Gorai, Shishio and Enenra cards; Okuri Chochin, Shiromaru and Kuromaru minions; Shishu Reiseki; Onibi prism; Far Eastern Brazier, Stone/Planted Toro Lantern, Tsukumogami Parasol and Komainu Statue |
| Potsherd exchange | Bujin/Gozen head 9, body 18, legs 9 and shared footwear 9; Looping in the Deepest Fringes roll 9; **Scrupulous Citations** emote 9; Ambitious Ends hair 6; Rose-colored Spectacles 3 |
| Criterion | 4 Shishu Coins; Shishioji rare drop or 100; Framer's Kit 8; Crimson Rise roll 8; materia 2/4 |
| Savage | 1 Rokkon Manuscript; Oyoroi Display or materia for 1; title **Ascendant Ascetic** |

The guaranteed Criterion mount is **25 clears**. The direct mount drop is marketable; Savage awards neither Coins nor the mount.

## Progression and rewards
The standard route bosses are **Moko**, **Gorai**, and **Shishio**; the secret route reaches **Enenra**. Unlock every record for **Mononopeke**, then claim the **Burabura Chochin Whistle** from Achievements.

Criterion runs **Shishio → Gorai → Moko** with two dangerous trash rooms. Assign supports/DPS as partners, fixed clocks, mitigation order, and consistent waymarks. Treat the wind-sprite trash room as a mechanic and pull each enemy where the lines remain visible.

Savage removes raises and normal recovery. A party wipe resets the duty, enemies return, and timed empowerment eventually ends the pull. Start only after repeated deathless Criterion clears.

- [ ] Claim **Burabura Chochin** after all records.
- [ ] Complete records 1–4, 5–8, and 9–12; verify all 12 in the V&C book.
- [ ] Complete Mapping the Realm and all four Variant boss achievements.
- [ ] Clear Criterion for **Moving a Mountain** and its mapping achievement.
- [ ] Farm 4 Shishu Coins per clear.
- [ ] Loot **Shishioji** or exchange 100 Coins with Trisassant (X:12.0, Y:13.3).
- [ ] Clear Savage for **Moving a Savage Mountain** and **Ascendant Ascetic**.
- [ ] Buy desired Shishu glamour, emote, hairstyle, facewear, roll and framer's kit.
- [ ] Collect all four cards and desired minions/furnishings.

[[variant-criterion-collection-rewards|Return to the Variant & Criterion reward overview]]
[[criterion-variant-title-journey|Open the Variant & Criterion title journey]]`,[...baseRefs,ref("Official Patch 6.45 notes","https://na.finalfantasyxiv.com/lodestone/topics/detail/6f9bce9aa59c6a8f68cc82b754e9a46b43f30b24"),ref("Mount Rokkon record reference","https://ffxiv.consolegameswiki.com/wiki/Mount_Rokkon_Exorcism_Record"),ref("Another Mount Rokkon mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Mount_Rokkon"),ref("Mount Rokkon Savage mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Mount_Rokkon_(Savage)"),ref("Trisassant complete exchange catalog","https://ffxiv.consolegameswiki.com/wiki/Trisassant")]),

guide("variant-criterion-aloalo-island","Aloalo Island — Complete Variant, Criterion & Savage Guide","Complete all 12 conservation records, claim Spectral Statice, farm Quaqua, and prepare for Criterion and Savage.","Endwalker","90",30,["aloalo island","spectral statice","quaqua","good-willed hunting"],`## At a glance
| Mode | Party | Goal and headline reward |
|---|---:|---|
| Aloalo Island | 1–4, any roles | 12 records → **Spectral Statice** from **Good-willed Hunting** |
| Another Aloalo Island | 1 tank, 1 healer, 2 DPS | 4 Aloalo Coins per clear; **Quaqua** drop or 100 Coins |
| Another Aloalo Island (Savage) | Fixed light party | **Charting the Savage Unknown** → **Force of Nature** |

### Entry rules
| Duty | Minimum / sync | Matching and recovery |
|---|---|---|
| Variant | Item level 605 / sync 665 | 1–4, any roles; two Variant actions; matching off by default |
| Criterion | Item level 640 / sync 665 | 1 tank, 1 healer, 2 DPS; one Variant Raise II charge each, refreshed after an objective or wipe |
| Savage | No listed minimum / sync 665 | Premade four only; no raises/actions; complete-run timer and full reset on wipe |

## Unlock
Complete **Endwalker**, unlock V&C through Osmon, then accept **Stranger from Paradise** from Shallow Moor in Old Sharlayan (X:12.0, Y:13.3). Finish the Variant quest for Criterion; clear Criterion for Savage.

## All 12 conservation records
| # | Record | Required route and choice |
|---:|---|---|
| 1 | A Not-quite Deserted Island | Left. Do not let Matsya fish and do not help Zozone. |
| 2 | The First Settlers of Aloalo Island | Left. Do not let Matsya fish; help Zozone. |
| 3 | God of Heaven and Sea | Left. Let Matsya fish and search the sand for bait. |
| 4 | A Noxious Gift | Left. Let Matsya fish and search the rocks for bait. |
| 5 | The Roots of Arcanima | Middle. Continue without hidden interactions. |
| 6 | Under the Boughs of the Great Tree | Middle. After the encounter following Quaqua, enter both red-flower passages and scare the wildlife. |
| 7 | A Dear Friend | Middle. Defeat the treant before the crawlers over the sigil; leave J'jhimei alone during Susena. |
| 8 | Fish for the Mind | Repeat that enemy order, then attack J'jhimei during Susena. |
| 9 | A Familiar History | Right. Accept Statice's help. |
| 10 | The Remnants of Faith | Right. Decline help, ignore the coffers, and pull the lever. |
| 11 | A Lalafell or a Fish? | Right. Decline help, open the coffers, then pull the lever. |
| 12 | Wellspring of Golden Memories | Right, decline help. Complete the ritual below, take the sack, then place statues **sparrow → whale → turtle**. |

### Record 12 ritual
1. Turtle: say **O wayfarer of land and sea, hear me.** Circle anticlockwise twice, then **/bow**.
2. Sparrow: say **O dancer of the skies, hear me.** Use **/blowkiss**, circle clockwise once, then **/dance**.
3. Whale: say **O messenger from beyond the horizon, hear me.** Circle clockwise once, then anticlockwise once, then **/dance**.

Wait for each response and avoid extra /say text. One wrong direction, emote, or statue order produces a normal ending.

### Mobile route card
- **Left 1–4:** no fishing/no Zozone; no fishing/help Zozone; fish/sand bait; fish/rock bait.
- **Middle 5–8:** no interactions; both red-flower wildlife passages; treant before crawlers + ignore J'jhimei; same kill order + attack J'jhimei.
- **Right 9–12:** accept prank; decline + no coffers; decline + open coffers; decline + ritual + statue order **sparrow, whale, turtle**.

**Irreversible mistakes:** Zozone can die before being healed; crawlers dying before the treant loses 7/8; approaching the normal exit before both hidden red-flower passages loses 6; one extra /say, wrong circle direction, premature emote, or wrong statue order loses 12.

## Variant combat playbook
- **Quaqua:** Read the arrow/totem pattern before it activates. Route choices change which environmental attacks overlap the basic in/out and line patterns.
- **Ketuduke:** Crystals fire along their long faces. Bubble effects move or enlarge their lines, so determine the final crystal state before choosing a tile.
- **Lala:** The personal analysis indicator marks a vulnerable direction around your character; the orientation is arena-relative, not based on where your character faces. Block attacks with the safe side and resolve arithmetic/rotation patterns in sequence.
- **Statice:** During Trick Reload, remember the two failed chambers; those two numbered Trigger Happy sectors are safe. Use Pinwheel gaps, aim balloon knockbacks into a safe sector, and keep the movable dartboard target in the desired color.
- **Loquloqui:** Tethered birds/newts enlarge their line/circle AoEs. Start away from enlarged summons, move into flower tiles after they resolve, and respect the fast frontal half-room cleave.

## Criterion combat and trash playbook
### First trash → Ketuduke
- Agree on a pull route and cooldowns. Avoid clipping the room edge, which applies lethal dropsy in Savage. Keep enemies positioned so conal/line attacks remain visible.
- **Ketuduke:** the arena is a 4×4 grid. Crystals fire along their long side; bubble debuffs change crystal behavior and forced march changes player position. Assign fixed tiles, face forced marches toward the planned destination, and resolve stack/spread only after crystal lanes are known. Mitigate every Tidal Roar.

### Second trash → Lala
- Use interrupts and tank cooldowns on the assigned enemies; do not improvise a large pull in Savage. Preserve party mitigation for the unavoidable cast immediately before Lala.
- **Lala:** assign clocks and a consistent rotation call. Analysis weaknesses are arena-relative. During rotating board/arc patterns, determine the final attack origin first, then place your safe side away from it. For forced march and spatial tactics, set facing before the bind; do not rotate at the last moment.

### Statice
- **Reload:** call the two blanks; those numbered sectors are safe. **Pinwheel:** follow the gaps while preserving your assigned clock. **Balloon:** use knockback immunity only if the group's strategy expects it. **Present Box:** claw players share their enumeration while missile players break their chain and spread; never touch your own pursuing add. Later sequences combine reload sectors, bombs, rotating fire and a second knockback—solve in that order.

## Savage preparation and Exquisite weapons
Savage repeats Criterion solutions with tighter damage, higher HP, no raises and lethal trash. Hold damage in Criterion to practice late Statice. Plan every tank invulnerability and party mitigation across the entire timeline.

Each Savage clear awards an **Aloalo Manuscript**. Exchange one for an **Elevated Ester**, then use the Ester with the corresponding Augmented Credendum weapon (or Gentlemage's Umbrella) for an Exquisite weapon. A Manuscript can instead buy Forgotten Figure or materia. Savage does not award Aloalo Coins or the Quaqua drop.

**Party Finder template:** “Another Aloalo | fresh/prog/clear | [Ketuduke strat] | Lala rotation | Statice present-box positions | know through [mechanic].” Savage: “deathless Criterion | full mitigation sheet | late Statice practiced.”

## Complete reward catalog
All Variant coffers are personal. Choosing Matsya's suggested opening portal adds a bonus coffer before the final boss.

| Source | Rewards |
|---|---|
| Variant coffers | 1+2 Aloalo Potsherds; Ketuduke, Lala, Statice and Loquloqui cards; Repulu and Uolosapa minions; Uolosapa prism; Faerie Cushion, Island Palm, Pendant Wall Lamp, Roselle Hedge, Sparrow Statue, Coelacanth Display and Giant Leaf Parasol |
| Potsherd exchange | Free Spirit Hat 15, Jacket 27, Ringbands 9, Slops 12, Loafers 9; O Speaker, Slumber roll 9; **Humble Triumph** emote 9; Bold and the Braid hair 6; Statice's Wings 3 |
| Criterion | 4 Aloalo Coins; Quaqua rare drop or 100; Framer's Kit 8; O Hunter, Rejoice roll 8; materia 2/4 |
| Savage | 1 Aloalo Manuscript; Elevated Ester, Forgotten Figure or materia for 1; title **Force of Nature** |

The guaranteed Quaqua costs **25 Criterion clears**. The mount may drop sooner and is marketable.

## Progression and rewards
Standard routes feature **Ketuduke**, **Lala**, and **Statice**; the secret ritual reaches **Loquloqui**. Unlock every record for **Good-willed Hunting**, then claim **Spectral Statice** from Achievements.

Criterion runs **Ketuduke → Lala → Statice**. Agree on planar/rotation language, fixed bubble and forced-march positions, tether responsibilities, and trash mitigation. Practice late sequences in normal Criterion even when current damage could skip them.

Savage has no raises and resets the whole duty on a wipe. Begin only when every member can execute Criterion and both trash sections repeatedly without a death.

- [ ] Claim **Spectral Statice** after all records.
- [ ] Complete records 1–4, 5–8, and 9–12; verify all 12 in the V&C book.
- [ ] Complete Mapping the Realm and all four Variant boss achievements.
- [ ] Clear Criterion and its mapping achievement.
- [ ] Farm 4 Aloalo Coins per clear.
- [ ] Loot **Quaqua** or exchange 100 Coins with Trisassant (X:12.0, Y:13.3).
- [ ] Clear Savage for **Charting the Savage Unknown** and **Force of Nature**.
- [ ] Combine all three Endwalker Savage achievements for **Criterion Core** and title **Epic Hero…**.
- [ ] Buy the desired Free Spirit set, emote, hairstyle, wings, rolls and framer's kit.
- [ ] Collect all four cards, both minions, and desired furnishings.

[[variant-criterion-collection-rewards|Return to the Variant & Criterion reward overview]]
[[criterion-variant-title-journey|Open the Variant & Criterion title journey]]`,[...baseRefs,ref("Official Patch 6.51 notes","https://na.finalfantasyxiv.com/lodestone/topics/detail/0df80cf3ca68eae3183b94d00813a0a42f2e4fda"),ref("Aloalo record reference","https://ffxiv.consolegameswiki.com/wiki/Aloalo_Conservation_Record"),ref("Another Aloalo Island mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Aloalo_Island"),ref("Aloalo Savage mechanics","https://ffxiv.consolegameswiki.com/wiki/Another_Aloalo_Island_(Savage)"),ref("Trisassant complete exchange catalog","https://ffxiv.consolegameswiki.com/wiki/Trisassant")]),

guide("variant-criterion-merchants-tale","The Merchant's Tale — Complete Variant, Advanced & Criterion Guide","Unlock all 13 records, understand Advanced mode, and earn both mounts, achievements, and the Literary Cannon title.","Dawntrail","90–100",40,["merchant's tale","corvosi","royal magicked carpet","genie of the lamp","advanced"],`## The new three-mode structure
| Mode | Party | Goal and headline reward |
|---|---:|---|
| The Merchant's Tale | 1–4, any roles; level 90+ raised to 100 | 13 records → **Comfortable Eye Mask** facewear |
| The Merchant's Tale (Advanced) | 2–4 practical entry, flexible roles | Enhanced bosses and Corvosi Brass → **Royal Magicked Carpet** |
| Another Merchant's Tale | Exactly 4: 1 tank, 1 healer, 2 DPS | Criterion → **Genie of the Lamp** and **Literary Cannon** |

Merchant's Tale has no separate Criterion (Savage) duty. Advanced is the replayable middle difficulty; Another Merchant's Tale is the fixed-party Criterion challenge.

Square Enix's duty table displays Advanced as party size **1–4**, while its entry instructions describe entering **as a pair or a party up to four**. Plan for at least two players unless the in-game finder on your current patch permits solo registration.

### Entry rules
| Duty | Minimum / sync | Matching and recovery |
|---|---|---|
| Variant | Level 90, no item-level minimum / level 100 and item level 765 | 1–4, flexible roles; fixed stats per equipped slot; XP below 100; matching off by default |
| Advanced | Level 100, item level 760 / sync 785 | Flexible composition, two Variant actions, HP scales with party size, matchmaking on by default; no trash |
| Criterion | Level 100, item level 770 / sync 795 | Exactly four; matchmaking forms tank, healer, melee, ranged/caster; one Variant Raise II charge each; no trash |

## Unlock and sync
Complete **Endwalker**, speak with Osmon (X:11.9, Y:13.3), and accept **A Spellbinding Read** from Shallow Moor (X:12.0, Y:13.3). Equip every slot: Variant raises players to level 100 with fixed job stats at item level 765, ignores materia, and gives no stats for empty slots. Defeat the three ordinary route bosses to unlock Advanced through Memolivia; defeat all Advanced bosses and speak with Osmon for Criterion.

## All 13 folklore records
| # | Record | Required route and choice |
|---:|---|---|
| 1 | A Land of Abundance | Left. Break the damaged fence, wait at the nest, and defeat Will of the Wind before it escapes. |
| 2 | A Carpet Soars | Left. Break the fence but let Will of the Wind steal the apple. |
| 3 | A Foe of Flame | Left. Leave the first fence intact. Later, stand beside the damaged railing when an Airy Wisp attack resolves. |
| 4 | Fragrant Fruits | Left. Leave both fences alone. |
| 5 | The Sunlit Expanse | Right. Choose **The seaweed won't steer us wrong** and let the goobbue swallow all four colorful rock piles. |
| 6 | Treasure at the Ocean's Floor | Same seaweed route; kill the goobbue before all four piles are swallowed. |
| 7 | Ruler of the Radiant Sea | Right. Choose **I'd fancy a stroll on the beach** and sound the Giant Conch Shell. |
| 8 | The Ocean's Bounty | Beach route; ignore the conch. |
| 9 | Valley of Extremes | Middle. Choose **Let the mushrooms guide us true** and aim Magnetic Rock into all three rock clusters. |
| 10 | A Blade Engraven | Mushroom route; kill the Stone Puppet without lighting the clusters. |
| 11 | Master of the Unyielding Blade | Middle. Choose **Floating rocks warrant a closer look** and approach all three protruding rocks until they glow. Use the western path for the upper rock. |
| 12 | In a Harsh Nature | Floating-rock route; approach none of the rocks. |
| 13 | The Eye of the Beholder | Right seaweed route. At the altar use **/bow**, say **I am returned!**, then stand on **coral → conch → starfish → pearl**. |

### Mobile route card
- **Left 1–4:** break fence + stop wind; break + let wind escape; leave fence + stand at damaged railing for Wisp; leave both alone.
- **Right 5–8/13:** seaweed + let goobbue eat four piles; seaweed + kill early; beach + conch; beach + no conch; seaweed + altar ritual + **coral, conch, starfish, pearl**.
- **Middle 9–12:** mushrooms + light all three clusters; mushrooms + light none; floating rocks + touch all three; floating rocks + touch none.

**Irreversible mistakes:** failing to hit Willful Wind before Flee finishes loses route 1; attacking it loses route 2; stand next to the damaged railing before the Wisp resolves for route 3; one missed rock/pile changes the ending; use the exact **/say I am returned!** phrase for route 13, wait for the altar response, then step on each symbol once in order.

## Variant combat playbook
- **Genie of the Lamp:** The glowing cannon arm cleaves its half while the other arm clips a smaller cone. Read the two wall-cannon waves in spawn order, trace the airship lanes after Chart Course changes one switch, and finish in a safe lane before the fast arm cleave.
- **Rukhkh:** sand spheres hit by cones become larger; remember invisible spheres after Banishing Mist. Dodge the boss's reappearance point-blank, then use the untouched/small sphere side for Sand Burst. Route history adds seeds, poison circles or boulder lanes.
- **Pari of Plenty:** memorize the carpet's three dash lines and finish close for Sun Circlet's donut. Fireflight arrows show sweep direction: same-color arrows mean swap sides after the first cleave; opposite colors mean stay. Track the carpet hiding no bauble on the route-4 version.
- **Lone Swordmaster:** Malefic Quartering marks an arena-relative vulnerable side. Stand where incoming directional attacks do not strike that side. Route mechanics add charge-based knockbacks, magnets, falling rocks or directional cover.
- **Darya:** read the musical score right-to-left for add order, dodge their columns, and handle forced march after baiting Aqua Ball. Later patterns combine add lines with in/out tides.
- **Deadly Dandan:** treat each summoned hazard as a story cue, preserve the center until its size is known, and move only after the active illustration resolves.

## Advanced boss playbook
There is no trash. Choose the boss order that gives the group its best warm-up, but all three must die consecutively for the achievement, bonus personal Brass, shared Brass coffer, and locked vendor stock.

- **Darya:** preassign clocks and forced-march lanes. Read familiar order first, then place baits and marches so the later column is clear. Resolve knockback/lines before greed; the edge is lethal.
- **Lone Swordmaster:** agree that calls describe the attack origin, not a player's facing. Protect the non-red personal quadrant from directional attacks, preposition for magnets, and identify safe cover before Vanishing Horizon.
- **Pari:** track carpet endpoints, not the boss model. Resolve rotating half-cleaves with a stay/swap call, then enter the first resolved expanding spark. Assign bauble lanes so no two players improvise into the same safe tile.

Variant actions: DPS should normally take Cure plus Rampart; tanks can take Cure plus Spirit Dart/Eagle Eye; healers can take Rampart plus Spirit Dart. Adjust only if the group has an explicit tanking/healing plan.

## Criterion boss playbook
Another Merchant's Tale has no trash and runs **Darya → Lone Swordmaster → Pari**. Normal resurrection is restricted; each player receives one Variant Raise II charge and avoidable failures apply Damage Down.

- **Darya:** use fixed clocks, familiar-column calls and assigned forced-march destinations. Bait player AoEs before march locks movement. For overlapping tides and summons, solve the add order, then in/out, then personal movement.
- **Swordmaster:** keep one vocabulary for cardinal attack origins and vulnerable quadrants. Resolve directional protection before magnets/knockbacks. Preassign partner and clock positions so the group can solve without rotating the arena mentally mid-cast.
- **Pari:** call the carpet endpoint and sweep sequence early. Handle pairs/spreads at assigned tiles, follow expanding sparks into the first-cleared area, and keep mitigation for repeated raidwide damage near enrage.

**Party Finder templates:** “Merchant Advanced | all 3 / Brass farm | flexible comp | learning welcome” or “Another Merchant | fresh/prog/clear | fixed clocks + pairs | know through [mechanic] | food.” State the strategy link/name when recruiting; “standard” is not specific enough for directional mechanics.

## Complete reward catalog and farming math
All Variant and Criterion coffers are personal unless a shared roll coffer is explicitly shown. Open them before leaving. Following Y'nazqha's suggested opening route adds a bonus Variant coffer.

| Source | Rewards |
|---|---|
| Variant coffers | Corvosi Potsherds; Pari, Swordmaster, Darya and Dandan cards; Little Mermaid and Magic Lamp minions; Corvosi Parasol, Crystal, Fan, Sofa, Green/Purple Carpets, Shisha, Ribbons prism and other furnishings |
| Potsherd exchange | Story-lover and Story-spinner sets: head 9, body 12, hands 6, legs 9, feet 6 each; **Saving Face** emote 9; Worthy Pursuits roll 9 |
| Advanced Brass | Soothing Sea-beast 12; Dark Glasses 12; Sea-folk earring/necklace/bracelet/ring 12 each; Corvosi Screen 8; Shadowhunter Chic hair 20 and Elevated Ester 40 after full clear; Royal Magicked Carpet 100 after **Stranger than Fiction** |
| Criterion Manuscripts | 4 per clear; Genie Lamp rare drop or 100; Framer's Kit 8; What Moves the Heart roll 8; grade XI/XII materia 2/4; Elevated Ester 20 |

Advanced gives **1 personal Brass per boss**. Defeating all three consecutively adds **1 personal Brass** and a shared coffer containing one equal stack per party member; the random stack size is 1, 4 or 12 and must be rolled on. Therefore the carpet is not a fixed-clear grind. Criterion is fixed: **25 clears** guarantee the Genie mount if it never drops.

## Variant achievements
Defeat Pari of Plenty, Darya the Sea-maid, Lone Swordmaster, and secret boss Deadly Dandan for their boss achievements. Reveal the map for **Mapping the Realm**. Unlock all 13 records for **A Storied Collection**, then claim **The Faces We Wear – Comfortable Eye Mask**. There is intentionally no all-record Variant mount.

## Advanced mode and Royal Magicked Carpet
Advanced contains enhanced **Pari**, **Lone Swordmaster**, and **Darya**. Choose the boss order and leave after an individual victory, or clear all three for extra rewards. Each boss gives personal Corvosi Brass; a full clear adds another personal reward and a shared coffer with variable Brass stacks.

Assign partners, clocks, tether priorities, and mitigation before pulling. Learn one boss consistently before adding the next. Complete **Stranger than Fiction** so all relevant vendor entries appear. Exchange **100 Corvosi Brass** with **Trisassant**, Old Sharlayan (X:12.0, Y:13.3), for the **Royal Magicked Carpet**. Brass also buys the Soothing Sea-beast minion, Shadowhunter Chic hairstyle, Dark Glasses facewear, accessories, housing items, and Elevated Ester.

## Criterion and Genie of the Lamp
Another Merchant's Tale requires level 100, item level 770, and syncs to 795. It runs **Darya → Lone Swordmaster → Pari** and restricts Variant actions. Avoidable failures apply Damage Down.

Assign pairs and clocks before Darya, use one directional language for Swordmaster, pre-plan Pari tether positions, and open every personal coffer. Each clear guarantees **4 Corvosi Manuscripts**. The **Genie Lamp** may drop directly; otherwise buy it for **100 Manuscripts** from Trisassant. The clear achievement **One Thousand and One Fights** awards title **Literary Cannon**.

- [ ] Unlock all 13 records and claim the Comfortable Eye Mask.
- [ ] Complete records 1–4, 5–8, 9–12, and secret record 13; verify all 13 in the V&C book.
- [ ] Complete Mapping the Realm and all four Variant final-boss achievements.
- [ ] Clear all Advanced bosses for **Stranger than Fiction**.
- [ ] Buy **Royal Magicked Carpet** for 100 Brass.
- [ ] Clear Criterion for **Literary Cannon**.
- [ ] Loot or buy **Genie of the Lamp** for 100 Manuscripts.
- [ ] Finish the post-duty story quest.
- [ ] Buy desired Story-lover/Story-spinner pieces and the emote/orchestrion roll.
- [ ] Obtain the Advanced minion, hairstyle, facewear, accessories and desired Ester(s).
- [ ] Collect all four cards, both Variant minions, and desired furnishings.

[[variant-criterion-collection-rewards|Return to the Variant & Criterion reward overview]]
[[criterion-variant-title-journey|Open the Variant & Criterion title journey]]`,[...baseRefs,ref("Official Patch 7.45 rules","https://na.finalfantasyxiv.com/lodestone/topics/detail/534af9c97992897890b8dd90aacabb77c6f51450"),ref("Merchant's Tale route reference","https://ffxiv.consolegameswiki.com/wiki/The_Merchant%27s_Tale"),ref("Merchant's Tale Advanced mechanics","https://ffxiv.consolegameswiki.com/wiki/The_Merchant%27s_Tale_(Advanced)"),ref("Criterion reward reference","https://ffxiv.consolegameswiki.com/wiki/Another_Merchant%27s_Tale"),ref("Trisassant complete exchange catalog","https://ffxiv.consolegameswiki.com/wiki/Trisassant")]),
];
