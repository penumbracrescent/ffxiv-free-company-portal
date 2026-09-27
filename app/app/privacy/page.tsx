import type { Metadata } from "next";
import { getPrivacySettings, privacyContactHref } from "../../lib/privacy";

export const metadata: Metadata = { title: "Privacy policy", description: "How this community portal handles personal information." };

export default async function PrivacyPage() {
  const p = await getPrivacySettings();
  const href = privacyContactHref(p.privacyContact);
  return <main className="legal-page"><article className="legal-card">
    <p className="eyebrow">Privacy policy</p><h1>How this portal uses information</h1>
    <p><strong>Operator:</strong> {p.operatorName}{p.operatorRegion ? ` · ${p.operatorRegion}` : ""}</p>
    <p>This self-hosted installation is controlled by the community named above. The open-source project contributors do not operate this installation or receive its member data merely because the software is used.</p>
    <h2>Information collected</h2>
    <p>The portal may store Discord account identifiers and display names; linked FINAL FANTASY XIV character, world, Free Company, role, portrait, mount, minion, achievement, and title information; preferences; per-crafting-job level, Craftsmanship, Control, CP, Specialist status, and preferred food and medicine; event attendance and signups; poll ballots; giveaway and contest records; gallery submissions; and security, command, moderation, and synchronization records.</p>
    <p>Public polls may show ballot identities only to eligible signed-in members, private polls restrict individual ballots to officers, and fully anonymous polls do not expose voter identities to members or officers.</p>
    <h2>Why it is used</h2>
    <p>Information is used to authenticate members, associate a Discord account with a current Free Company character, operate community features, remember crafter profiles and generate requested crafting macros, prevent abuse and duplicate verification, keep an administrative audit trail, and maintain the service. Crafting macro replies are visible only to the requesting Discord member, but the submitted stats are saved to that member&apos;s portal profile for later website and Discord requests. The operator should not use information for unrelated advertising or sell it.</p>
    <h2>Sources and sharing</h2>
    <p>Discord supplies account and server information authorized through the bot or sign-in flow. Public game information may be read from the Lodestone and catalog providers. Enabled features may send necessary information to Discord, Google Calendar, Tailscale, Cloudflare, Authentik, Square Enix services, XIVAPI, Universalis, FFXIV Collect, Teamcraft, AnimeSchedule.net, Reddit, and linked sites. Those providers apply their own terms and privacy practices.</p>
    <p>When Google Workspace APIs are enabled, use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including its Limited Use requirements. This portal uses Google Calendar data only for the calendar function configured by the operator.</p>
    <h2>Retention</h2>
    <p>Active member links and profile information are retained while needed for active portal membership. Former-member identity and collection records are removed after {p.formerMemberRetentionDays} days; a deidentified character shell may remain only where completed event, poll, or award integrity requires it. Event, poll, giveaway, contest, administrative, and fulfillment history may be retained for up to {p.activityRetentionDays} days, with identifying fields removed where continued proof is needed. Successful Discord commands are logged anonymously. Failed commands may temporarily retain the member&apos;s Discord and linked-character identity for troubleshooting; command diagnostics are retained for 30 days and anonymous aggregate command totals for 90 days.</p>
    <p>Backups are operator-controlled and may retain deleted records temporarily. This installation recommends removing backups after {p.backupRetentionDays} days and reconciling restored backups with deletion requests before reopening the service.</p>
    <h2>Your choices and requests</h2>
    <p>Signed-in verified members can download their own JSON export under Member Settings → Data &amp; Privacy. Verification-only mode removes optional collection, portrait, preference, participation, and submission data while retaining the minimum Discord-to-character link and current FC status needed for member access.</p>
    <p>Full opt-out deletes or deidentifies associated portal data, removes portal-managed Discord roles and nickname, signs the member out, and prevents automatic roster, portrait, collection, verification, and diagnostic processing. The portal retains one-way Discord and Lodestone suppression fingerprints and a non-identifying request receipt solely to honor that choice. Returning requires an explicit Opt In and Re-verify action; deleted history is not restored. The primary portal officer must transfer that responsibility before opting out, and secondary portal administrators are removed from the portal admin list.</p>
    <p>You may also ask the operator for access to, correction of, or deletion of information associated with your Discord account. Deidentified records may remain when needed for legal obligations, dispute prevention, or integrity of completed events, polls, and awards.</p>
    {p.additionalNotice ? <><h2>Operator notice</h2><p>{p.additionalNotice}</p></> : null}
    <h2>Contact</h2>
    {href ? <p>Send privacy and data requests to <a href={href}>{p.privacyContact}</a>.</p> : <p>The operator has not yet published a privacy contact. Administrators must add one before inviting users to this installation.</p>}
    <p className="legal-small">Effective {new Date(p.effectiveAt).toLocaleDateString("en-US")}; last updated {new Date(p.updatedAt).toLocaleDateString("en-US")}.</p>
    <p><a className="button secondary" href="/">Return to the portal</a> <a className="button secondary" href="/terms">Terms</a> <a className="button secondary" href="/legal">Legal notice</a></p>
  </article></main>;
}
