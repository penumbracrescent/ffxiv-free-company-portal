# Gear Planner

Member navigation: Gear Planner (`/?view=gear`). The API uses the same Discord / verified FC membership gate as the crafting calculator. No new account or API key is required.

Choose class/job, current level, home world and travel scope. Calculate fetches equipment from XIVAPI and latest reported listings from Universalis. Market data is crowdsourced: review timestamps are displayed, availability and travel access are not guaranteed.

Modes use a transparent leveling-stat heuristic, not best-in-slot or crafting/gathering breakpoint optimization. Good value normally keeps 90% of the highest purchasable score in each slot, but avoids a near-top option that costs over 10 times an alternative (and more than 5,000 gil). Budget chooses the cheapest candidate with at least 45% of the top score. Candidate lists contain strongest market options, merchant options, a few older cheaper pieces, and other acquisition alternatives from the previous 25 levels. They are not a complete inventory catalogue. Materia, set effects, story unlocks and owned equipment are not inferred.

NQ and HQ stats are separate; HQ bonuses are additive. Gil-shop sources are verified records, not inferred from an item's base value. Calamity/journeyman salvage and recompense repurchases are conditional and excluded from automatic purchases. Special-shop costs and quality verification status are shown separately and never treated as gil or free equipment. Consult linked Teamcraft acquisition details for quest/dungeon sources and unlock requirements.

Whole listing stacks and reported buyer tax are included in purchases. Missing prices are explicitly excluded from a partial total. Ring capacity is reserved across the basket, Unique rings cannot be equipped twice, and negative equipment-slot flags block incompatible pieces. Select an owned candidate and mark Keep to remove that slot's purchase. Exact older owned items outside the candidate range are not imported from Lodestone.

Shopping routes compare cheapest basket, home world, and a greedy fewer-stops plan. Fewer stops is an approximation, not a guaranteed optimal route; gil spent teleporting is excluded. Other-DC search is limited to the same physical region; special cross-region exceptions are not included. Next listing uses the current snapshot and keeps the selected item's quality. Calculate refreshes prices. A future-level comparison never replaces the current-level plan.

Optional Discord command: `/fae gear job:BLM level:81 world:Faerie scope:dc` (root command name follows installation configuration). Replies are private, require linked verified membership, and contain a concise summary and portal link. Source is included; do not start a dev bot against a production Discord application merely to register it.

Tests: `node --test gear-planner.test.mjs` in app. Read-only upstream check: `node gear-live-check.mjs BLM:81 RDM:57 PLD:57 WAR:57 BTN:57 CRP:57 FSH:57`.

Merchant dataset: FFXIV Teamcraft, MIT license, pinned commit c56afbc26b47501ceabb55cdb8d24e3c4d025abb, generated October 6, 2026. License retained alongside vendors.json. Game item names/icons © SQUARE ENIX. Dataset refresh script: build-vendors.mjs.

Deployment scope for this change: public-release source and fae-dev only. Live is intentionally untouched. Character appearance / 3D glamour preview is deferred.
