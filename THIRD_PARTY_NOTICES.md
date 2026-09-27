# Third-party notices

This distribution contains and interacts with software, services, data, and
content that are not covered by the project's MIT license.

## Open-source software

The application is built with open-source packages including Next.js, React,
Auth.js, node-postgres, discord.js, Sharp/libvips, Tailscale, cloudflared, and
their transitive dependencies. Their own license files and package metadata
remain authoritative. Common licenses in the production dependency trees
include MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, CC-BY-4.0, and
LGPL-3.0-or-later components distributed with Sharp/libvips.

Redistributors must preserve the copyright and license notices required by
those packages. Relevant upstream license pages include:

- Next.js: <https://github.com/vercel/next.js/blob/canary/license.md>
- React: <https://github.com/facebook/react/blob/main/LICENSE>
- Auth.js: <https://github.com/nextauthjs/next-auth/blob/main/LICENSE>
- discord.js: <https://github.com/discordjs/discord.js/blob/main/LICENSE>
- node-postgres: <https://github.com/brianc/node-postgres/blob/master/LICENSE>
- Sharp: <https://github.com/lovell/sharp/blob/main/LICENSE>
- libvips: <https://github.com/libvips/libvips/blob/master/COPYING>
- Tailscale: <https://github.com/tailscale/tailscale/blob/main/LICENSE>
- cloudflared: <https://github.com/cloudflare/cloudflared/blob/master/LICENSE>
- PostgreSQL: <https://www.postgresql.org/about/licence/>
- FFXIV Teamcraft simulator: <https://github.com/ffxiv-teamcraft/simulator> (MIT)

### FFXIV Teamcraft simulator license

MIT License

Copyright (c) 2019 Flavien Normand

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Gathering-guide reference datasets

The built-in gathering achievement directories contain a transformed subset
of factual item, fishing, gathering-node, location, time, weather, bait, and
acquisition-condition data from these MIT-licensed projects:

- FFXIV Teamcraft: <https://github.com/ffxiv-teamcraft/ffxiv-teamcraft>
  Copyright (c) 2017 Flavien Normand.
- FF14 Fish Tracker App: <https://github.com/icykoneko/ff14-fish-tracker-app>
  Copyright (c) 2019 icykoneko.

Both projects provide that software and data under the following MIT terms:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The lockfiles included with each service identify the exact JavaScript package
versions used by that release. Container images also contain operating-system
packages with their own notices. This document is a practical summary, not a
replacement for those licenses.

## FINAL FANTASY XIV materials

FINAL FANTASY XIV, FINAL FANTASY, Square Enix names and marks, game artwork,
screenshots, icons, text, and other game materials are owned by or licensed to
Square Enix. They are not licensed under this project's MIT license.

This software is an unofficial community project and is not affiliated with,
endorsed by, or sponsored by Square Enix. Installers and site operators are
responsible for following the current FINAL FANTASY XIV Materials Usage
License: <https://support.na.square-enix.com/rule.php?id=5382&tag=authc>

The policy effective September 16, 2026 permits covered FFXIV materials for
non-commercial community use, with only the limited partner-program and
gameplay-posting revenue exceptions stated in the policy. It requires the
`© SQUARE ENIX` notice, states that Internet use is considered public for
purposes of the policy even behind access controls, restricts excessive alteration, and requires immediate compliance
with Square Enix removal requests. Operators must review the current terms
before enabling advertising, paid access, subscriptions, access-linked
donations, or any other commercial use.

That policy classification does not make a private or ephemeral Discord reply
publicly accessible. It means that restricted delivery is still a covered use
and does not avoid the policy's conditions.

The linked policy is for North American Square Enix accounts. European and
Japanese account holders must consult their applicable regional policy. All
uses must also comply with the FFXIV User Agreement and Square Enix Account
Terms and must not defame, disparage, or harass others.

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.
FINAL FANTASY XIV copyrighted materials are © SQUARE ENIX.

## Built-in guide library

The built-in guides and their local SVG diagrams are original project
documentation. They summarize game facts in independently written language and
are not copies of community-wiki articles, official guide text, screenshots,
icons, maps, or other third-party images. Quest, item, duty, location, NPC, and
system names are used only as needed to identify the subjects being documented.

Guide pages include reference links so readers and maintainers can verify facts
against current sources and patch information. Some factual research was
checked against the Final Fantasy XIV Online Wiki at
<https://ffxiv.consolegameswiki.com/>. Original written contributions on that
wiki are made available under the GNU Free Documentation License 1.2 or later:
<https://www.gnu.org/licenses/old-licenses/fdl-1.2.html>. Square Enix images and
other Square Enix materials appearing on that wiki are excluded from the
wiki's GFDL grant and are not redistributed in this project's guide library.

The reference links do not incorporate the linked pages into this distribution
and do not place third-party writing or media under the project's MIT License.
If material is later copied or adapted rather than independently summarized,
the contributor and redistributor must satisfy the source's applicable license
and attribution requirements before publishing that change.

## External services and data providers

### Calculator reference data

The member calculators contain independently structured factual reference data,
including chocobo color RGB values, submersible component statistics, materia
grades, and relic stage names. Source links and review dates are displayed next
to the relevant calculator. Facts were checked against the Final Fantasy XIV
Online Wiki and community research; no source article prose, screenshots, icons,
or other hosted media are bundled. Game names and numeric game data remain
subject to Square Enix rights and are not relicensed by the project's MIT
license. Maintainers should recheck calculator data after game patches.

Optional or runtime integrations include Discord, Google Calendar, Tailscale,
Cloudflare, the Lodestone, XIVAPI, Universalis, FFXIV Collect, Teamcraft,
AnimeSchedule.net, Reddit, and other linked community resources. Their names,
APIs, data, hosted services, account plans, rate limits, privacy policies, and
terms remain the property and responsibility of their respective providers.
The project's MIT license grants no rights to those services or their content.

### FFXIV Collect collection catalog

Achievement, title, mount, minion, reward, patch, category, ownership-rate,
source, and image metadata may be retrieved from the independently operated
FFXIV Collect service: <https://ffxivcollect.com/>. FFXIV Collect documents its
data as available through a public RESTful JSON API. The portal acknowledges
FFXIV Collect as the immediate catalog source; public API availability does not
place the returned data, game text, or images under this project's MIT License.

Catalog responses are cached in the installation's PostgreSQL database. Image
URLs may continue to point to provider-hosted assets rather than bundling those
assets with the release. FFXIV and Square Enix material in those responses
remains subject to the applicable rights and the FINAL FANTASY XIV Materials
Usage License. Redistributors and operators must respect provider instructions,
rate limits, attribution, and takedown requests.

### Lodestone achievement ownership

Personal Owned/Missing status is derived from achievement identifiers and
completion timestamps visible on a linked character's public Lodestone
achievement pages. Those observations are stored by the self-hosted
installation and can persist as last-known data or in backups. Private profiles
are not bypassed. This processing is separate from FFXIV Collect and is subject
to the operator's privacy, security, retention, and deletion responsibilities.

## Browser restore runtime

The restore helper uses Python's standard library, installed from Alpine Linux
packages, and PostgreSQL 16 client tools. Python is covered by the PSF license
and its historical license stack: <https://docs.python.org/3/license.html>.
PostgreSQL uses the PostgreSQL License: <https://www.postgresql.org/about/licence/>.
The Alpine base image contains additional separately licensed components.
Keep the packages' copyright and license materials when distributing images;
the project's MIT license does not replace these licenses. No third-party
Python application packages are added for the restore feature.

PostgreSQL's trusted-source requirement is documented at
<https://www.postgresql.org/docs/16/app-pgrestore.html>.

## Installation and member content

Logos, banners, screenshots, contest entries, gallery photos, text, and other
material supplied by an installer or member remain the property of their
respective owners. Uploaders must have permission to submit that material and
grant the site operator the permission needed to store, display, resize, and
distribute it through the configured portal and Discord integrations.
# FF14.tw Treasure Map Finder data and reference images

The treasure-map matcher includes coordinate data and 227 reference images from
[hydai/ff14.tw](https://github.com/hydai/ff14.tw), revision
`c0028a4ad60fea680ad4f58bec7f4e9a6fa13198`. These files are distributed under
the Apache License 2.0. A copy of that license is included at
`bot/data/treasure-maps/LICENSE`.

The matcher also bundles derived coordinate and visual-reference descriptors
generated from FINAL FANTASY XIV game data and map assets exposed through
[XIVAPI](https://v2.xivapi.com). No XIVAPI-hosted map image files are bundled;
the generated descriptors and coordinates remain subject to the FINAL FANTASY
XIV materials notice above.

The 227 bundled reference images are used internally for non-commercial visual
matching and are not served as a public image gallery. Cropping, resizing, and
fingerprinting are limited to what the matcher requires; they must not be
repurposed as standalone artwork or merchandise. Square Enix's policy remains
controlling even where the immediate community source also supplies an Apache
2.0 notice. Operators must remove or disable these references if Square Enix or
the immediate source requests it.

## Release-wide materials boundary

The notice above applies throughout the release, not only to guides. Relevant
surfaces include collection names and images, Lodestone portraits and news,
duty and item catalog text, treasure-map screenshots and references, Fashion
Report posts, Discord catalog cards, event text, member gallery or contest
screenshots, and installer-supplied branding. The website displays the Square
Enix notice globally; Discord responses that reproduce or display possible
FFXIV material carry a qualified `FFXIV materials © SQUARE ENIX` footer.

This release contains no payment, advertising, affiliate, subscription, or
donation integration and accepts images—not audio or video—for its community
media features. Operators must not use the portal as paid access to FFXIV
materials. FFXIV music must not be uploaded or distributed on its own, and any
future video feature must implement the policy's gameplay, audio, Performance,
and music restrictions before it is enabled.

The physical-item rules are separate from ordinary portal operation. If an
operator uses giveaways, galleries, or links to organize physical fan items,
the operator must independently follow the policy's personal-production,
no-payment, policy-link/QR, logo, crossover, 3D-printing, AI-derivative, and
other physical-item restrictions. The portal does not grant permission to
manufacture or distribute those items.
