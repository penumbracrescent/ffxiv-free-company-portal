# Legal and content notice

This software is provided under the MIT License without warranty. The license
covers only original project code and documentation. It does not grant rights
to FINAL FANTASY XIV materials, third-party packages, external services, API
data, or content uploaded by portal users.

## For installation operators

The person or organization operating an installation is responsible for:

- complying with applicable laws and the terms of every enabled service;
- keeping credentials private and configuring reasonable access controls;
- publishing any privacy, retention, moderation, and community rules required
  for the installation and its jurisdiction;
- responding to requests concerning member data and uploaded content;
- obtaining permission for branding, screenshots, images, text, and other
  material displayed by the installation;
- preserving third-party copyright and license notices; and
- promptly removing material they do not have permission to host.

The project contributors do not operate third-party installations and do not
receive their member data merely because the software is used.

## For members and uploaders

By submitting material to an installation, the uploader represents that they
created it or have permission to submit it. The uploader grants that
installation's operator a non-exclusive permission to store, reproduce,
resize, display, and transmit the material as needed for portal and configured
Discord features. The uploader retains ownership of their original material.
This permission ends when the material is removed, except for backups,
moderation records, or posts already delivered to an external service.

Uploaders must not submit unlawful, infringing, deceptive, malicious, or
privacy-invasive material. The installation operator may remove submissions
and should provide a contact method for rights or privacy complaints.

## FINAL FANTASY XIV notice

This is an unofficial community project and is not affiliated with, endorsed
by, or sponsored by Square Enix.

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.
FINAL FANTASY XIV copyrighted materials are © SQUARE ENIX.

Use of game materials is subject to Square Enix's current Materials Usage
License: <https://support.na.square-enix.com/rule.php?id=5382&tag=authc>

The policy effective September 16, 2026 generally permits covered FFXIV
materials for non-commercial community use, subject to its stated conditions
and limited partner-program and gameplay-posting revenue exceptions. The policy
states that Internet use is considered public for its purposes even behind
access controls. This classification does not make a private Discord response
publicly accessible; it means restricted delivery is not exempt from the
policy. Operators must include the required copyright notice, avoid excessive alteration, review the policy
before enabling monetization, advertising, paid access, subscriptions, or
access-linked donations, and immediately comply with a removal request from
Square Enix.

The linked policy applies to players with North American Square Enix accounts.
European and Japanese account holders must also consult their regional policy.
Use must comply with the FFXIV User Agreement and Square Enix Account Terms and
must not defame, disparage, or harass others.

This notice covers the complete portal and bot: catalog text and images,
Lodestone material, treasure-map screenshots and bundled matching references,
Discord cards and announcements, member media that contains game material,
and installer-provided branding. The current release does not provide payment,
advertising, audio-upload, or video-upload features. A future operator or
contributor must not add those capabilities without first applying the current
commercial, music, video, and Performance restrictions.

Physical fan items are governed by a separate, narrower section of the policy.
Portal giveaways or links do not authorize manufacturing, paid production,
sale, crowdfunding, 3D printing, AI-generated derivative physical items, use
of official logos, or crossover material.

## Achievement, title, mount, and minion catalog data

The portal can retrieve public collection metadata from FFXIV Collect's public
REST API and public character achievement information from the Lodestone.
Names, descriptions, icons, reward information, identifiers, availability
labels, and similar game-related fields remain third-party data or Square Enix
materials; they are not relicensed under this project's MIT License. Public API
access is not, by itself, a transfer of copyright or a promise that the service
will remain available.

FFXIV Collect is an independent community service. This project is not
affiliated with or endorsed by FFXIV Collect. Operators should preserve source
acknowledgement, respect provider terms and rate limits, and be prepared to
update, disable, or remove imported data and externally hosted images if a
provider's policy, availability, or instructions change.

## Built-in guides and illustrations

The built-in guide text and local SVG diagrams are original project
documentation. They use game names and independently written summaries of game
facts; they do not redistribute community-wiki article text, official guide
text, screenshots, icons, maps, or other third-party images.

Guide references are supplied for factual verification and patch maintenance.
Some facts were checked against the Final Fantasy XIV Online Wiki, whose
original written contributions are licensed under the GNU Free Documentation
License 1.2 or later. Square Enix images hosted there are not covered by that
wiki license and are not included in the built-in guide library. See
`THIRD_PARTY_NOTICES.md` for details.

Future contributors must not copy text or media into the guides unless the
material's license permits redistribution and all required notices and
attributions are included.

Patch-review dates and guide links are maintenance aids, not guarantees that a
route, reward, availability classification, or prerequisite remains current.
Players should confirm time-limited, ranked, or recently changed content in the
game and current official sources.

## Personal achievement information

For a linked, current Free Company character, the worker may read achievement
IDs and completion timestamps exposed by that character's public Lodestone
profile. The installation stores those observations locally to display the
signed-in member's own Owned/Missing state. It does not bypass a private
achievement profile, and title or achievement synchronization does not post a
member's collection history to Discord.

Last-known ownership may be retained when a profile becomes private or a sync is
incomplete. After a character stops being current, identifying and collection
records are removed on the installation's configured former-member schedule; a
deidentified shell may remain for completed-event or award integrity. Data can
also remain temporarily in backups.
Installation operators are responsible for defining retention, restricting
access, honoring applicable access or deletion requests, and deleting or
anonymizing records when they are no longer needed. Catalog progress is
informational and may trail the game or contain source-data errors.

## Backup and restoration responsibilities

Backups contain private credentials, member identifiers, settings, and uploaded
content. They are not encrypted by this software. Restrict access to archives,
use protected storage and HTTPS (or a trusted local connection), and never ship
real backups with a public release. Restore only archives from a trusted source
that you are authorized to use. Archive validation is not malware screening;
PostgreSQL restoration executes database definitions supplied by the source.

Restoring data does not grant new rights to member content. Operators remain
responsible for lawful processing, retention, access, and deletion requests.
After restoring an older backup, reconcile any subsequent deletion requests or
revoked permissions before reopening the site. External provider configuration
and data are not recreated by this restore feature.

## No legal guarantee

These notices are intended to clarify ownership and responsible use. They are
not legal advice and cannot prevent a claim. Operators with commercial plans,
unusual data practices, or jurisdiction-specific obligations should obtain
qualified legal advice before launch.
