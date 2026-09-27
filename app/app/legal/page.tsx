import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal and content notice",
  description: "Ownership, privacy, third-party service, and user-content information for this portal."
};

export default function LegalPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="eyebrow">Legal and content notice</p>
        <h1>Ownership and responsible use</h1>
        <p>This self-hosted portal is operated by the community that installed it. The open-source project contributors do not operate this installation and do not receive its member data merely because the software is used.</p>

        <h2>Unofficial FINAL FANTASY XIV project</h2>
        <p>This project is not affiliated with, endorsed by, or sponsored by Square Enix. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. FINAL FANTASY XIV copyrighted materials are © SQUARE ENIX.</p>
        <p>Game names, artwork, screenshots, icons, text, and other game materials are not covered by this project&apos;s MIT license. Their use is subject to the <a href="https://support.na.square-enix.com/rule.php?id=5382&amp;tag=authc" target="_blank" rel="noreferrer">FINAL FANTASY XIV Materials Usage License</a>.</p>
        <p>The Materials Usage License effective September 16, 2026 generally permits covered materials for non-commercial FINAL FANTASY XIV community use, with limited stated exceptions for approved platform partner programs and gameplay-streaming or gameplay-posting revenue. It requires the © SQUARE ENIX notice, states that internet use is considered public for purposes of the policy even when access is restricted, limits excessive alteration, and permits Square Enix to restrict use or request removal. This policy classification does not make a private or ephemeral Discord response publicly accessible. Operators must review the current license before enabling advertising, paid access, subscriptions, donations tied to access, or other commercial use and must promptly comply with applicable removal requests.</p>
        <p>The linked policy applies to players with North American Square Enix accounts. Operators or contributors using European or Japanese accounts must consult the policy for their account region as well. Use of FFXIV material must also comply with the FFXIV User Agreement and Square Enix Account Terms and must not be used to defame, disparage, or harass others.</p>

        <h2>Where the materials policy applies</h2>
        <p>This notice covers the entire portal and bot, including collection names and images, Lodestone portraits and news, duty and item data, treasure-map uploads and bundled matching references, Fashion Report posts, Discord catalog cards, event text, member screenshots, and installer-supplied branding. Restricted portal pages and private Discord replies remain access-restricted, but that restriction does not exempt their use of covered material from the policy.</p>
        <p>The current release has no payment, advertising, affiliate, audio-upload, or video-upload feature. Operators must not place access to FFXIV material behind payment or add monetization without reviewing the current policy. Future audio or video features must enforce the policy&apos;s gameplay, music, Performance, and standalone-listening restrictions before publication.</p>
        <p>Physical fan items have separate restrictions. Giveaways, gallery posts, and external links do not authorize sale, commissioned or paid production, crowdfunding, 3D printing, AI-generated derivative physical works, official-logo use, crossover material, or imitation merchandise. Operators must review the physical-item section before organizing such an activity.</p>

        <h2>Treasure-map recognition material</h2>
        <p>The map matcher contains 227 cropped reference images from the FF14.tw community project and derived coordinate or visual descriptors generated from XIVAPI-exposed game data. They are used internally for non-commercial matching rather than served as a public image gallery. Immediate-source notices are preserved in the distribution, but Square Enix&apos;s policy still controls underlying game material. Uploaded screenshots are cached briefly; an approved match retains derived recognition information rather than a permanent copy of the upload.</p>

        <h2>Collection catalog sources</h2>
        <p>Achievement, title, mount, minion, reward, patch, category, source, and image metadata may be retrieved from the independently operated <a href="https://ffxivcollect.com/" target="_blank" rel="noreferrer">FFXIV Collect</a> public REST API. FFXIV Collect is acknowledged as the immediate catalog source and does not endorse or operate this portal.</p>
        <p>Public API access does not place returned data, game text, or images under this project&apos;s MIT license. Catalog responses may be cached locally, while some images remain hosted by their provider. Operators must respect provider terms, rate limits, attribution, policy changes, and takedown requests.</p>

        <h2>Built-in guides and illustrations</h2>
        <p>The built-in walkthroughs and local SVG diagrams are original project documentation. They identify game subjects and summarize game facts in independently written language; they do not redistribute community-wiki articles, official guide text, screenshots, icons, maps, or other third-party images.</p>
        <p>Each guide keeps reference links for factual verification and patch maintenance. Some facts were checked against the <a href="https://ffxiv.consolegameswiki.com/" target="_blank" rel="noreferrer">Final Fantasy XIV Online Wiki</a>, whose original written contributions are available under the <a href="https://www.gnu.org/licenses/old-licenses/fdl-1.2.html" target="_blank" rel="noreferrer">GNU Free Documentation License 1.2 or later</a>. Square Enix images hosted there are excluded from that wiki license and are not bundled with these guides.</p>
        <p>Future contributors must not copy text or media into the guide library unless redistribution is permitted and every required notice and attribution is preserved.</p>
        <p>A guide&apos;s patch-review date is a maintenance aid, not a guarantee that every route, reward, availability label, or prerequisite remains current. Confirm time-limited, ranked, and recently changed content in the game and current official sources.</p>

        <h2>Member uploads</h2>
        <p>Uploaders keep ownership of their original material. By submitting material, an uploader confirms that they created it or have permission to share it and grants this installation&apos;s operator permission to store, resize, display, and transmit it through the portal and configured Discord features.</p>
        <p>Do not upload unlawful, infringing, malicious, deceptive, or privacy-invasive material. The installation operator may moderate or remove submissions. Removal may not recall copies already delivered to an external service or retained temporarily in backups or moderation records.</p>

        <h2>Privacy and external services</h2>
        <p>This installation may store Discord identifiers, character and Free Company information, preferences, event activity, contest records, and uploaded content. Its operator controls that data and is responsible for access, retention, deletion requests, security, and any locally required privacy notice.</p>
        <p>For a linked, current Free Company character, the worker may read achievement identifiers and completion timestamps visible on that character&apos;s public Lodestone profile. They are stored locally to show the signed-in member&apos;s own Owned/Missing state. Private profiles are not bypassed, another member&apos;s achievement history is not exposed through the collection pages, and collection synchronization does not announce that history in Discord.</p>
        <p>Last-known ownership can remain when a profile becomes private, synchronization is incomplete, or a character stops being current, and it can remain in backups. Operators must establish an appropriate retention period, restrict access, and honor applicable access or deletion requests. Collection data may be delayed or inaccurate and must not be treated as authoritative proof.</p>
        <p>Enabled integrations may send information to Discord, Google, Tailscale, Cloudflare, Square Enix services, XIVAPI, Universalis, FFXIV Collect, Teamcraft, AnimeSchedule.net, Reddit, and other linked providers. Each provider applies its own terms and privacy practices.</p>

        <h2>Backups and restoration</h2>
        <p>Backups can contain credentials, member identifiers, preferences, and uploaded content. Archives are not encrypted by this software. Operators must restrict access, use secure storage and transfer, and restore only trusted backups they are authorized to use. Validation is not malware screening. Restoring content does not grant additional rights to it.</p>
        <p>Restoring an older backup may bring back previously deleted information or permissions. Before reopening the site, operators must reconcile subsequent deletion requests and revoked access. External services and their configuration are not recreated by restoration.</p>

        <h2>Software and third-party licenses</h2>
        <p>Original project code is provided under the MIT License without warranty. That license does not cover third-party packages, service data, game materials, installation branding, or member content. Redistributors must preserve all notices supplied with the release and its dependencies.</p>

        <p className="legal-small">Questions, rights complaints, and privacy requests should be directed through this installation&apos;s published privacy contact. These notices provide general project information and are not legal advice.</p>
        <p><a className="button secondary" href="/">Return to the portal</a> <a className="button secondary" href="/privacy">Privacy</a> <a className="button secondary" href="/terms">Terms</a></p>
      </article>
    </main>
  );
}
