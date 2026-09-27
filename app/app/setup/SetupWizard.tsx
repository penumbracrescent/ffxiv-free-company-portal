"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StickerIdEditor from "../components/StickerIdEditor";
import RestoreBackup from "./RestoreBackup";
import { worldsByDataCenter } from "../../lib/setup-worlds";

type Option = { id: string; label: string };
type Discovery = { guildName: string; botName: string; roles: Option[]; channels: Option[]; warnings: string[] };

const timeZones = [
  ["America/St_Johns", "Newfoundland"], ["America/Halifax", "Atlantic"], ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"], ["America/Denver", "Mountain"], ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"], ["America/Anchorage", "Alaska"], ["Pacific/Honolulu", "Hawaii"]
];


function HelpTip({ text }: { text: string }) {
  return (
    <span className="setup-help-tip" role="button" tabIndex={0} aria-label={`Help: ${text}`}>
      <span className="setup-help-icon" aria-hidden="true">?</span>
      <span className="setup-help-text" aria-hidden="true">{text}</span>
    </span>
  );
}

function Choice({
  name,
  label,
  options,
  initialValue = "",
  disabled = false,
  required = false,
  help
}: {
  name: string;
  label: string;
  options: Option[];
  initialValue?: string;
  disabled?: boolean;
  required?: boolean;
  help?: string;
}) {
  const availableValue = options.some((option) => option.id === initialValue) ? initialValue : "";
  return <label><span className="setup-field-label">{label}{help ? <HelpTip text={help} /> : null}</span><select key={`${name}:${options.length}:${availableValue}`} name={name} defaultValue={availableValue} disabled={disabled} required={required}><option value="">Not configured yet</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}

export default function SetupWizard({ setupToken, defaultPortalUrl }: { setupToken: string; defaultPortalUrl: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [restorePending, setRestorePending] = useState(false);
  const [commandName, setCommandName] = useState("fc");
  const commandEdited = useRef(false);
  const [portalUrl, setPortalUrl] = useState(defaultPortalUrl);
  const [portalName, setPortalName] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [privacyContact, setPrivacyContact] = useState("");
  const [operatorRegion, setOperatorRegion] = useState("");
  const [formerMemberRetentionDays, setFormerMemberRetentionDays] = useState(30);
  const [activityRetentionDays, setActivityRetentionDays] = useState(365);
  const [backupRetentionDays, setBackupRetentionDays] = useState(90);
  const [privacyAdditionalNotice, setPrivacyAdditionalNotice] = useState("");
  const [dataCenter, setDataCenter] = useState("Aether");
  const [world, setWorld] = useState("Faerie");
  const locationEdited = useRef(false);
  const [worldOptions, setWorldOptions] = useState(worldsByDataCenter);
  const [worldListStatus, setWorldListStatus] = useState("Loading current worlds from the Lodestone…");
  const [backgroundColor, setBackgroundColor] = useState("#05000c");
  const [accentColor, setAccentColor] = useState("#9333ea");
  const [tileColor, setTileColor] = useState("#120423");
  const [accessMode, setAccessMode] = useState("local");
  const [tailscaleHostname, setTailscaleHostname] = useState("fc-portal");
  const [tailscaleTailnet, setTailscaleTailnet] = useState("");
  const [cloudflareHostname, setCloudflareHostname] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [guildId, setGuildId] = useState("");
  const [adminDiscordId, setAdminDiscordId] = useState("");
  const [additionalAdminDiscordIds, setAdditionalAdminDiscordIds] = useState("");
  const [temporaryGuestsEnabled, setTemporaryGuestsEnabled] = useState(false);
  const [welcomeEngagementEnabled, setWelcomeEngagementEnabled] = useState(false);
  const [tempGuestHours, setTempGuestHours] = useState(6);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [restoredBackup, setRestoredBackup] = useState(false);
  const [restoredIntegrations, setRestoredIntegrations] = useState<string[]>([]);
  const [restoredSelections, setRestoredSelections] = useState<Record<string, string>>({});
  const [existingLogoUrl, setExistingLogoUrl] = useState("/branding/default-logo.svg");
  const [existingBannerUrl, setExistingBannerUrl] = useState("/branding/default-banner.svg");
  const callbackUrl = useMemo(() => {
    try { return new URL("api/auth/callback/discord", portalUrl.endsWith("/") ? portalUrl : `${portalUrl}/`).toString(); } catch { return "Enter a valid portal URL first"; }
  }, [portalUrl]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup/worlds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupToken }) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The current world list could not be loaded.");
        return result.worlds as Record<string, string[]>;
      })
      .then((worlds) => {
        if (cancelled || !Object.keys(worlds).length) return;
        // Loading a list must never change a choice already made by the operator.
        setWorldOptions((current) => ({ ...current, ...worlds }));
        setWorldListStatus("Current data centers and worlds loaded from the official Lodestone.");
      })
      .catch(() => { if (!cancelled) setWorldListStatus("The Lodestone was unavailable, so the verified built-in world list is being used."); });
    return () => { cancelled = true; };
  }, [setupToken]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup/prefill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupToken }) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The imported configuration could not be read.");
        return result;
      })
      .then((values) => {
        if (cancelled || !values.restored) return;
        setRestoredBackup(true);
        setRestorePending(false);
        if (!commandEdited.current) setCommandName(values.commandName || "fc");
        setRestoredIntegrations([
          values.restoredIntegrations?.authentik ? "Authentik route and credentials" : "",
          values.restoredIntegrations?.cloudflare ? "Cloudflare tunnel credentials" : "",
          values.restoredIntegrations?.googleCalendar ? "Google Calendar service settings" : "",
          values.restoredIntegrations?.synologyReverseProxy ? "reverse-proxy portal route" : ""
        ].filter(Boolean));
        setPortalName(values.portalName || "");
        setOperatorName(values.operatorName || values.portalName || "");
        setPrivacyContact(values.privacyContact || "");
        setOperatorRegion(values.operatorRegion || "");
        setFormerMemberRetentionDays(Number(values.formerMemberRetentionDays)||30);
        setActivityRetentionDays(Number(values.activityRetentionDays)||365);
        setBackupRetentionDays(Number(values.backupRetentionDays)||90);
        setPrivacyAdditionalNotice(values.privacyAdditionalNotice||"");
        setPortalUrl(values.portalUrl || defaultPortalUrl);
        if (!locationEdited.current) {
          setDataCenter(values.dataCenter || "Aether");
          setWorld(values.world || "Faerie");
        }
        setBackgroundColor(values.backgroundColor || "#05000c");
        setAccentColor(values.accentColor || "#9333ea");
        setTileColor(values.tileColor || "#120423");
        setAccessMode(values.accessMode || "local");
        setTailscaleHostname(values.tailscaleHostname || "fc-portal");
        setTailscaleTailnet(values.tailscaleTailnet || "");
        setCloudflareHostname(values.cloudflareHostname || "");
        setApplicationId(values.applicationId || "");
        setGuildId(values.guildId || "");
        const administrators = String(values.adminDiscordIds || "").split(/[\s,]+/).filter(Boolean);
        setAdminDiscordId(administrators[0] || "");
        setAdditionalAdminDiscordIds(administrators.slice(1).join("\n"));
        setTemporaryGuestsEnabled(Boolean(values.temporaryGuestsEnabled));
        setWelcomeEngagementEnabled(Boolean(values.welcomeEngagementEnabled));
        setTempGuestHours(Number(values.tempGuestHours) || 6);
        setExistingLogoUrl(values.logoUrl || "/branding/default-logo.svg");
        setExistingBannerUrl(values.bannerUrl || "/branding/default-banner.svg");
        setRestoredSelections({
          verifiedRoleId: values.verifiedRoleId || "", unverifiedRoleId: values.unverifiedRoleId || "",
          tempAccessRoleId: values.tempAccessRoleId || "", welcomeChannelId: values.welcomeChannelId || "",
          freeCompanyChatChannelId: values.freeCompanyChatChannelId || "", officerLogChannelId: values.officerLogChannelId || "",
          eventChannelId: values.eventChannelId || values.raidChannelId || values.mountFarmChannelId || "", raidChannelId: "",
          mountFarmChannelId: "", mountWinChannelId: values.mountWinChannelId || "",
          testChannelId: values.testChannelId || "", welcomeWaveStickerIds: values.welcomeWaveStickerIds || ""
        });
        const assign = (name: string, value: unknown) => {
          const field = formRef.current?.elements.namedItem(name);
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = String(value || "");
        };
        queueMicrotask(() => {
          assign("portalSubtitle", values.portalSubtitle);
          assign("timeZone", values.timeZone);
          assign("lodestoneUrl", values.lodestoneUrl);
          assign("tailscaleAuthKey", values.tailscaleAuthKey);
          assign("cloudflareTunnelToken", values.cloudflareTunnelToken);
          assign("oauthSecret", values.oauthSecret);
          assign("botToken", values.botToken);
        });
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "The imported configuration could not be read."); });
    return () => { cancelled = true; };
  }, [defaultPortalUrl, setupToken]);

  function continueFromPortal() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const commandName = String(data.get("commandName") || "").trim();
    const lodestoneUrl = String(data.get("lodestoneUrl") || "").trim();
    if (!portalName.trim()) { setError("Enter the Free Company name before continuing."); return; }
    if (!/^[a-z0-9_-]{1,32}$/.test(commandName)) { setError("The Discord command must use 1-32 lowercase letters, numbers, hyphens, or underscores."); return; }
    try {
      const parsedLodestoneUrl = new URL(lodestoneUrl);
      const host = parsedLodestoneUrl.hostname.toLowerCase();
      if (parsedLodestoneUrl.protocol !== "https:"
          || !(host === "finalfantasyxiv.com" || host.endsWith(".finalfantasyxiv.com"))
          || !/^\/lodestone\/freecompany\/\d+(?:\/|$)/.test(parsedLodestoneUrl.pathname)) throw new Error();
    } catch { setError("Enter the complete Free Company Lodestone URL before continuing."); return; }
    setError("");
    setStep(2);
  }

  function chooseAccessMode(value: string) {
    setAccessMode(value);
    if (value === "local" || value === "later") {
      setPortalUrl(defaultPortalUrl);
    } else if (value === "tailscale") {
      setPortalUrl(tailscaleHostname && tailscaleTailnet ? `https://${tailscaleHostname}.${tailscaleTailnet}/` : "");
    } else if (value === "cloudflare") {
      setPortalUrl(cloudflareHostname ? `https://${cloudflareHostname}/` : "");
    } else {
      setPortalUrl("");
    }
  }

  function continueFromAccess() {
    const form = formRef.current;
    if (!form) return;
    let parsedUrl: URL;
    try { parsedUrl = new URL(portalUrl); } catch { setError("Enter a valid portal address before continuing."); return; }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) { setError("The portal address must use HTTP or HTTPS."); return; }
    if (["tailscale", "cloudflare", "reverse-proxy"].includes(accessMode) && parsedUrl.protocol !== "https:") { setError("Public portal addresses must use HTTPS."); return; }
    const data = new FormData(form);
    if (accessMode === "tailscale") {
      const authKey = String(data.get("tailscaleAuthKey") || "").trim();
      if (!tailscaleHostname || !tailscaleTailnet.endsWith(".ts.net") || !authKey.startsWith("tskey-")) { setError("Complete the Tailscale machine name, .ts.net tailnet name, and authentication key before continuing."); return; }
    }
    if (accessMode === "cloudflare") {
      const tunnelToken = String(data.get("cloudflareTunnelToken") || "").trim();
      if (!cloudflareHostname.includes(".") || tunnelToken.length < 40) { setError("Complete the Cloudflare public hostname and tunnel token before continuing."); return; }
    }
    setError("");
    setStep(3);
  }

  async function testDiscord() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const botToken = String(data.get("botToken") || "").trim();
    const oauthSecret = String(data.get("oauthSecret") || "").trim();
    if (!applicationId || !guildId || !adminDiscordId || (!oauthSecret && !restoredIntegrations.includes("Authentik route and credentials")) || !botToken) { setError("Complete the Discord IDs, OAuth client secret (unless Authentik was restored), and bot token before testing the connection."); return; }
    setBusy(true); setError(""); setDiscovery(null);
    try {
      const response = await fetch("/api/setup/discord", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupToken, botToken, guildId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Discord validation failed.");
      setDiscovery(result); setStep(4);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Discord validation failed."); }
    finally { setBusy(false); }
  }

  function reviewSetup() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    if (temporaryGuestsEnabled && !String(data.get("tempAccessRoleId") || "")) {
      setError("Choose a temporary guest role or disable temporary guest access before reviewing setup.");
      return;
    }
    setError("");
    setStep(5);
  }

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!worldOptions[dataCenter]?.includes(world)) {
      setError("Choose a world belonging to the selected data center.");
      setStep(1);
      return;
    }
    formData.set("dataCenter", dataCenter);
    formData.set("world", world);
    formData.set("commandName", commandName);
    if (!operatorName.trim()) { setError("Enter the installation operator responsible for member data."); return; }
    const contact=privacyContact.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !/^https:\/\//i.test(contact)) { setError("Enter a public privacy contact email address or HTTPS contact page URL."); return; }
    if (formData.get("legalAcknowledgement") !== "on") {
      setError("Confirm the operator and content responsibilities before finishing setup.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/setup/complete", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Setup could not be completed.");
      setComplete(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Setup could not be completed."); }
    finally { setBusy(false); }
  }

  if (complete) return <main className="setup-shell"><section className="setup-card setup-complete"><span className="tag success">Configuration saved</span><h1>One final sealing step</h1><p>Run <code>setup.ps1</code> again on Windows, or <code>setup.sh</code> again on Linux/macOS, to activate these settings and remove the one-time setup code.</p><p>Windows can run <code>setup.ps1</code> directly against this folder or a mapped network share; Docker is not required for sealing. Then start or rebuild the complete stack on the Docker host.</p>{accessMode === "tailscale" ? <p>In Tailscale, confirm MagicDNS and HTTPS Certificates are enabled. Then open <strong>Access controls → Definitions → Node attributes</strong>, add a node attribute with target <code>autogroup:member</code> and attribute <code>funnel</code>, leave IP Pools, App, and Capability empty, and save it. Finally, verify the portal machine is connected on the Machines page.</p> : null}{accessMode === "cloudflare" ? <div className="setup-access-details"><h2>Finish the Cloudflare route after the stack starts</h2><ol className="setup-instructions"><li>Return to <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare Zero Trust</a> and open <strong>Networking → Tunnels</strong>.</li><li>Wait for this tunnel to show <strong>Healthy</strong>. The portal's <code>cloudflared</code> container supplies the connector; do not run Cloudflare's sample Docker command separately.</li><li>Open the tunnel, choose <strong>Routes → Add route → Published application</strong>, and select the hostname you entered during setup.</li><li>Leave the path blank and set the service URL to <code>http://portal:3000</code>, then save the route.</li><li>Open <strong>{portalUrl}</strong>. No router port forwarding is required.</li></ol></div> : null}</section></main>;

  return <main className="setup-shell">
    <section className="setup-card">
      <p className="eyebrow">{restoredBackup ? "Backup restoration" : "First-time setup"}</p><h1>{restoredBackup ? "Review your restored Free Company portal" : "Create your Free Company portal"}</h1>
      <div className="setup-steps">{["Portal", "Access", "Discord", "Roles & Channels", "Review"].map((label, index) => <div className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}><strong>{index + 1}</strong><span>{label}</span></div>)}</div>
      {restoredBackup ? <div className="setup-warning"><strong>Portable backup loaded.</strong> The database and persistent files have already been restored. Review the imported fields below; saved member join dates, galleries, user preferences, channel settings, wave sticker IDs, and other database records do not need to be entered again.{restoredIntegrations.length ? <span> Preserved integrations: {restoredIntegrations.join(", ")}.</span> : null}</div> : null}
      {error ? <div className="setup-error">{error}</div> : null}
      {step === 1 && !restoredBackup ? <RestoreBackup setupToken={setupToken} onPendingChange={setRestorePending} /> : null}
      <form ref={formRef} onSubmit={finish} encType="multipart/form-data" noValidate>
        <fieldset disabled={restorePending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <input type="hidden" name="setupToken" value={setupToken} />
        <input type="hidden" name="existingLogoUrl" value={existingLogoUrl} />
        <input type="hidden" name="existingBannerUrl" value={existingBannerUrl} />
        <section className="setup-panel" hidden={step !== 1}>
          <h2>Portal identity</h2><p>Choose what members will see. These images and colors can be changed later.</p>
          <div className="form-grid">
            <label><span>Free Company name</span><input name="portalName" value={portalName} onChange={(e) => { const value=e.target.value; setOperatorName(current=>!current||current===portalName?value:current); setPortalName(value); }} required maxLength={100} placeholder="New Leaf" /></label>
            <label><span>Portal subtitle</span><input name="portalSubtitle" defaultValue="Free Company Portal" maxLength={100} /></label>
            <label><span>Discord command</span><span className="input-prefix"><b>/</b><input name="commandName" value={commandName} onChange={event => { commandEdited.current = true; setCommandName(event.target.value); }} required pattern="[a-z0-9_-]{1,32}" /></span></label>
            <label><span>Timezone</span><select name="timeZone" defaultValue="America/Chicago">{timeZones.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Data center</span><select name="dataCenter" value={dataCenter} onChange={(event) => { locationEdited.current = true; const value = event.target.value; setDataCenter(value); setWorld(worldOptions[value][0]); }}>{Object.keys(worldOptions).map((value) => <option value={value} key={value}>{value}</option>)}</select><small>{worldListStatus}</small></label>
            <label><span>World</span><select name="world" value={world} onChange={(event) => { locationEdited.current = true; setWorld(event.target.value); }}>{(worldOptions[dataCenter] || [world]).map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            <label className="full"><span>Free Company Lodestone URL</span><input name="lodestoneUrl" required type="url" placeholder="https://na.finalfantasyxiv.com/lodestone/freecompany/.../" /><small>After setup starts the containers, the Officer Area will display a unique verification code. Until it is verified, roster and character scanning remain paused. Place the code either in public text on this FC profile (such as the slogan, company board, or estate profile), or as the exact title of a new FC forum thread whose status is Public. Draft and Members Only forum threads cannot be verified.</small></label>
            <label><span>Background color</span><span className="color-control"><input name="backgroundColor" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /><code>{backgroundColor}</code></span></label>
            <label><span>Accent color</span><span className="color-control"><input name="accentColor" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /><code>{accentColor}</code></span></label>
            <label><span>Tile color</span><span className="color-control"><input name="tileColor" type="color" value={tileColor} onChange={(event) => setTileColor(event.target.value)} /><code>{tileColor}</code></span><small>Sets the surface color used by cards, panels, and dashboard tiles.</small></label>
            <label><span>Logo image</span><input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /><small>PNG, JPG, WEBP, or GIF · square image recommended · maximum 8 MB. Use branding you have permission to publish; do not imply official Square Enix endorsement.</small></label>
            <label><span>Home banner image</span><input name="banner" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /><small>PNG, JPG, WEBP, or GIF · wide image recommended · maximum 8 MB. FFXIV screenshots remain subject to the current Materials Usage Policy.</small></label>
          </div>
          <div className="theme-preview" style={{ "--preview-bg": backgroundColor, "--preview-accent": accentColor, "--preview-tile": tileColor } as React.CSSProperties}>
            <div className="theme-preview-heading"><div><span>Live color preview</span><strong>{portalName || "Your Free Company"}</strong></div><small>{world} · {dataCenter}</small></div>
            <div className="theme-preview-window">
              <aside><div className="theme-preview-logo">✦</div><strong>{portalName || "Your FC"}</strong><span className="active">⌂ Home</span><span>✧ Events & Raiding</span><span>♘ Mount Tracker</span><span>⚙ Settings</span></aside>
              <div className="theme-preview-content">
                <div className="theme-preview-hero"><small>A HOME AMONG FRIENDS</small><h3>{portalName || "Your Free Company"}</h3><p>Community, events, crafting, and adventures together.</p><button type="button">View Events</button></div>
                <div className="theme-preview-cards"><div><small>SYSTEM</small><strong>Portal Status</strong><span>Everything is ready.</span></div><div><small>UP NEXT</small><strong>Community Event</strong><span>Members can RSVP here.</span></div></div>
              </div>
            </div>
            <p>Approximate preview only. Uploaded logo and banner images appear after setup is completed.</p>
          </div>
          <div className="form-actions"><button className="button primary" type="button" onClick={continueFromPortal}>Continue to Access</button></div>
        </section>

        <section className="setup-panel" hidden={step !== 2}>
          <h2>Choose how members reach the portal</h2><p>This determines the permanent portal address and the Discord login callback. Public choices use encrypted HTTPS and do not require exposing the portal's raw HTTP port.</p>
          <div className="setup-access-grid">
            {[
              ["local", "Local network only", "Use the Docker host's LAN address. No router forwarding is needed."],
              ["tailscale", "Free Tailscale address", "Public HTTPS through Funnel. Members do not need Tailscale."],
              ["cloudflare", "My domain with Cloudflare", "Public HTTPS on a domain you own, without router forwarding."],
              ["reverse-proxy", "My reverse proxy", "Use an HTTPS proxy or tunnel you already operate."],
              ["later", "Configure later", "Finish locally now and update the public URL and Discord callback later."]
            ].map(([value, title, description]) => <label className={accessMode === value ? "setup-access-choice selected" : "setup-access-choice"} key={value}><input type="radio" name="accessMode" value={value} checked={accessMode === value} onChange={() => chooseAccessMode(value)} /><span><strong>{title}</strong><small>{description}</small></span></label>)}
          </div>

          {accessMode === "local" || accessMode === "later" ? <div className="form-grid setup-access-details"><label className="full"><span>Portal address</span><input name="portalUrl" value={portalUrl} onChange={(event) => setPortalUrl(event.target.value)} required type="url" /><small>Replace localhost with the Docker host's LAN address when members use another device.</small></label></div> : null}

          {accessMode === "tailscale" ? <div className="setup-access-details">
            <ol className="setup-instructions">
              <li>Create or sign into a <a href="https://login.tailscale.com/admin" target="_blank" rel="noreferrer">Tailscale account</a>.</li>
              <li>Open <a href="https://login.tailscale.com/admin/dns" target="_blank" rel="noreferrer"><strong>DNS</strong></a>. Enable <strong>MagicDNS</strong> and <strong>HTTPS Certificates</strong>, then copy the <strong>Tailnet DNS name</strong> shown on that page exactly. Tailscale assigns this value; do not invent a new <code>.ts.net</code> name.</li>
              <li>Open <a href="https://login.tailscale.com/admin/acls" target="_blank" rel="noreferrer"><strong>Access controls</strong></a>, choose <strong>Definitions → Node attributes → Add node attribute</strong>, set <strong>Targets</strong> to <code>autogroup:member</code> and <strong>Attributes</strong> to <code>funnel</code>, leave <strong>IP Pools</strong>, <strong>App</strong>, and <strong>Capability</strong> empty, then save. Do not use the General access rule form. The container configures Funnel non-interactively, so no approval prompt may appear later.</li>
              <li>On the <a href="https://login.tailscale.com/admin/settings/keys" target="_blank" rel="noreferrer"><strong>Keys</strong></a> page, generate a one-time, non-ephemeral authentication key for this portal.</li>
              <li>After the completed stack starts, confirm the portal machine is connected and approved on the <a href="https://login.tailscale.com/admin/machines" target="_blank" rel="noreferrer"><strong>Machines</strong></a> page. Public DNS can take several minutes to become available. If the address still does not open after it appears, flush the viewing device’s DNS cache and retry.</li>
            </ol>
            <div className="form-grid">
              <label><span>Portal machine name</span><input name="tailscaleHostname" value={tailscaleHostname} onChange={(event) => { const value = event.target.value.toLowerCase(); setTailscaleHostname(value); setPortalUrl(value && tailscaleTailnet ? `https://${value}.${tailscaleTailnet}/` : ""); }} required pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" placeholder="fc-portal" /><small>You choose this first portion, such as lost.</small></label>
              <label><span>Tailnet DNS name from Tailscale</span><input name="tailscaleTailnet" value={tailscaleTailnet} onChange={(event) => { const value = event.target.value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""); setTailscaleTailnet(value); setPortalUrl(tailscaleHostname && value ? `https://${tailscaleHostname}.${value}/` : ""); }} required placeholder="pango-lin.ts.net" /><small>Copy this from <a href="https://login.tailscale.com/admin/dns" target="_blank" rel="noreferrer">Tailscale → DNS</a>. Together they form {tailscaleHostname || "fc-portal"}.{tailscaleTailnet || "your-tailnet.ts.net"}.</small></label>
              <label className="full"><span>One-time Tailscale authentication key</span><input name="tailscaleAuthKey" type="password" required autoComplete="off" placeholder="tskey-auth-…" /><small>Stored with the installation secrets. The container keeps its enrolled identity under data/tailscale/state.</small></label>
            </div>
          </div> : null}

          {accessMode === "cloudflare" ? <div className="setup-access-details">
            <h3>Cloudflare Tunnel setup</h3>
            <p>Cloudflare manages tunnels inside its Zero Trust dashboard. Being redirected there is expected; this does not require purchasing a separate domain or opening router ports.</p>
            <ol className="setup-instructions">
              <li>Confirm the domain you plan to use appears as <strong>Active</strong> under Cloudflare Websites. Owning a domain at a registrar is not sufficient until that domain's DNS is connected to Cloudflare.</li>
              <li>Open <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noreferrer">Cloudflare Zero Trust</a>, then choose <strong>Networking → Tunnels → Create tunnel → Cloudflared</strong>.</li>
              <li>Give the tunnel a descriptive name such as <code>fc-portal-dev</code>, then choose <strong>Save tunnel</strong>.</li>
              <li>Choose the <strong>Docker</strong> connector. Cloudflare displays a command ending in <code>--token LONG_PRIVATE_VALUE</code>. Copy only the long value after <code>--token</code>. <strong>Do not run the sample Docker command</strong>; this portal starts its own managed <code>cloudflared</code> container after setup is sealed.</li>
              <li>Enter the public hostname and token below. If Cloudflare says it is waiting for a connector, leave that page open or return to it later; the connector cannot become healthy until you finish this wizard, run the sealing script, and start the complete portal stack.</li>
              <li>After the stack starts, return to <strong>Networking → Tunnels</strong> and wait for the tunnel to show <strong>Healthy</strong>. Open it, choose <strong>Routes → Add route → Published application</strong>, set the hostname to the same value entered below, leave the path blank, and set the service URL to <code>http://portal:3000</code>.</li>
              <li>Save the route and open the HTTPS portal address shown below. Do not add router port forwarding. A separate Cloudflare Access application is optional and is not required for the portal's own Discord sign-in.</li>
            </ol>
            <div className="form-grid">
              <label className="full"><span>Public portal hostname</span><input name="cloudflareHostname" value={cloudflareHostname} onChange={(event) => { const value = event.target.value.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""); setCloudflareHostname(value); setPortalUrl(value ? `https://${value}/` : ""); }} required placeholder="portal.example.com" /></label>
              <label className="full"><span>Cloudflare tunnel token</span><input name="cloudflareTunnelToken" type="password" required autoComplete="off" /><small>Paste only the private value following <code>--token</code>, not the full Docker command. It is sealed into the installation's local .env file.</small></label>
            </div>
          </div> : null}

          {accessMode === "reverse-proxy" ? <div className="setup-access-details"><div className="form-grid"><label className="full"><span>Final public HTTPS address</span><input name="portalUrl" value={portalUrl} onChange={(event) => setPortalUrl(event.target.value)} required type="url" placeholder="https://portal.example.com/" /><small>Configure your proxy to forward this hostname to the portal container on port 3000, or to the Docker host's private portal port.</small></label></div></div> : null}
          {accessMode === "tailscale" || accessMode === "cloudflare" ? <input type="hidden" name="portalUrl" value={portalUrl} /> : null}
          <div className="setup-review"><div><span>Portal address</span><strong>{portalUrl || "Not ready"}</strong></div><div><span>Access method</span><strong>{accessMode === "cloudflare" ? "Cloudflare Tunnel" : accessMode === "tailscale" ? "Tailscale Funnel" : accessMode === "reverse-proxy" ? "Existing reverse proxy" : accessMode === "later" ? "Configure later" : "Local network"}</strong></div></div>
          <div className="form-actions"><button className="button secondary" type="button" onClick={() => setStep(1)}>Previous</button><button className="button primary" type="button" onClick={continueFromAccess}>Continue to Discord</button></div>
        </section>

        <section className="setup-panel" hidden={step !== 3}>
          <h2>Create and connect the Discord application</h2>
          <ol className="setup-instructions">
            <li>Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a> and create a new application for this guild.</li>
            <li>Open <strong>Installation</strong>. Keep <strong>Guild Install</strong> enabled, disable <strong>User Install</strong>, and change <strong>Install Link</strong> from Discord Provided Link to <strong>None</strong>.</li>
            <li>Open <strong>Bot</strong>, create the bot, then enable both <strong>Server Members Intent</strong> and <strong>Message Content Intent</strong> under Privileged Gateway Intents. Reset/copy its bot token afterward.</li>
            <li>Under <strong>Bot - Authorization Flow</strong>, turn <strong>Public Bot off</strong>. Leave <strong>Requires OAuth2 Code Grant</strong> off. This installation is intended for only your server.</li>
            <li>Open <strong>OAuth2 - URL Generator</strong>. In <strong>Scopes</strong>, check exactly <strong>bot</strong> and <strong>applications.commands</strong>. Selecting bot reveals <strong>Bot Permissions</strong>; check View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Kick Members, Manage Roles, Manage Nicknames, Create Events, and Use External Stickers. Open the generated URL while signed in as the application owner to install the bot.</li>
            <li>Place the bot’s Discord role above the Verified, Unverified, and Temporary Guest roles.</li>
              <li>{restoredIntegrations.includes("Authentik route and credentials") ? "Your existing Authentik sign-in configuration is preserved. Keep its public URL and callback settings; direct Discord OAuth is optional for this restored route." : <>Under <strong>OAuth2</strong>, add this exact redirect:<code>{callbackUrl}</code></>}</li>
              <li>Under <strong>General Information</strong>, publish <code>{`${portalUrl.replace(/\/?$/, "/")}privacy`}</code> as the Privacy Policy URL and <code>{`${portalUrl.replace(/\/?$/, "/")}terms`}</code> as the Terms of Service URL.</li>
          </ol>
          <div className="form-grid">
            <label><span>Application ID</span><input name="applicationId" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} required inputMode="numeric" /></label>
            <label><span>Discord server ID</span><input name="guildId" value={guildId} onChange={(e) => setGuildId(e.target.value)} required inputMode="numeric" /></label>
            <label><span>Your Discord user ID</span><input name="adminDiscordId" value={adminDiscordId} onChange={(e) => setAdminDiscordId(e.target.value)} required inputMode="numeric" /><small>This becomes the primary portal administrator.</small></label>
            <label><span>Additional portal administrators (optional)</span><textarea name="additionalAdminDiscordIds" value={additionalAdminDiscordIds} onChange={(e) => setAdditionalAdminDiscordIds(e.target.value)} rows={3} placeholder="One Discord user ID per line" /><small>Enter numeric Discord user IDs separated by lines, spaces, or commas. They receive the same portal administrator access after signing in with Discord.</small></label>
            <label><span>OAuth client secret {restoredIntegrations.includes("Authentik route and credentials") ? "(optional: Authentik restored)" : ""}</span><input name="oauthSecret" type="password" required={!restoredIntegrations.includes("Authentik route and credentials")} autoComplete="off" /></label>
            <label className="full"><span>Bot token</span><input name="botToken" type="password" required autoComplete="off" /></label>
          </div>
          <div className="form-actions"><button className="button secondary" type="button" onClick={() => setStep(2)}>Previous</button><button className="button primary" type="button" disabled={busy} onClick={testDiscord}>{busy ? "Checking Discord…" : "Test Connection & Load Choices"}</button></div>
        </section>

        <section className="setup-panel" hidden={step !== 4}>
          <span className="tag success">Connected</span><h2>{discovery?.guildName}</h2><p>Bot account: {discovery?.botName}. Only assignable roles and writable text channels are listed.</p>
          {discovery?.warnings.map((warning) => <div className="setup-warning" key={warning}>{warning}</div>)}
          <h3>Member roles</h3><div className="form-grid"><Choice name="verifiedRoleId" label="Verified member role" options={discovery?.roles || []} initialValue={restoredSelections.verifiedRoleId} /><Choice name="unverifiedRoleId" label="Unverified role" options={discovery?.roles || []} initialValue={restoredSelections.unverifiedRoleId} help="Optional. Assign this role through your newcomer invite link to keep the welcome and verification channel hidden from established members: deny View Channel to @everyone, allow it for this role, and do not grant the verified role access. The portal removes it after successful verification. Anyone joining through an invite that does not assign this role may not be able to see a private welcome channel." /></div>
          <div className="setup-option-card">
            <label className="checkbox-row"><input name="temporaryGuestsEnabled" type="checkbox" checked={temporaryGuestsEnabled} onChange={(event) => setTemporaryGuestsEnabled(event.target.checked)} /><span><strong>Enable temporary guest access</strong><small>Guests can choose limited access and will be removed automatically when their time expires.</small></span></label>
            <div className="form-grid">
              <Choice name="tempAccessRoleId" label="Temporary guest role" options={discovery?.roles || []} initialValue={restoredSelections.tempAccessRoleId} disabled={!temporaryGuestsEnabled} required={temporaryGuestsEnabled} />
              <label><span>Guest access duration (hours)</span><input name="tempGuestHours" type="number" min={1} max={720} value={tempGuestHours} onChange={(event) => setTempGuestHours(Number(event.target.value))} disabled={!temporaryGuestsEnabled} required={temporaryGuestsEnabled} /></label>
            </div>
          </div>
          <label className="checkbox-row">
            <input name="welcomeEngagementEnabled" type="checkbox" checked={welcomeEngagementEnabled} onChange={(event) => setWelcomeEngagementEnabled(event.target.checked)} />
            <span>
              <strong className="setup-field-label">Enable portal welcome engagement <HelpTip text="Posts a greeting in the selected Free Company chat channel after successful member verification. The greeting includes a Wave hello button and can use configured wave stickers. Leave this off when your server prefers Discord's built-in welcome engagement. Verification and onboarding still work normally." /></strong>
              <small>Optional. When disabled, the bot will not post its additional greeting or Wave hello button.</small>
            </span>
          </label>
          <StickerIdEditor name="welcomeWaveStickerIds" initialValue={restoredSelections.welcomeWaveStickerIds || ""} />
          <h3>Core channels</h3><div className="form-grid"><Choice name="welcomeChannelId" label="Welcome and verification" options={discovery?.channels || []} initialValue={restoredSelections.welcomeChannelId} /><Choice name="freeCompanyChatChannelId" label="Free Company chat" options={discovery?.channels || []} initialValue={restoredSelections.freeCompanyChatChannelId} /><Choice name="officerLogChannelId" label="Private officer log" options={discovery?.channels || []} initialValue={restoredSelections.officerLogChannelId} /><Choice name="eventChannelId" label="Party Planner" options={discovery?.channels || []} initialValue={restoredSelections.eventChannelId} /><Choice name="mountWinChannelId" label="Mount wins" options={discovery?.channels || []} initialValue={restoredSelections.mountWinChannelId} /><Choice name="testChannelId" label="Private testing" options={discovery?.channels || []} initialValue={restoredSelections.testChannelId} /></div>
          <p className="muted">Additional feature channels can be selected later in Officer Area.</p>
          <div className="form-actions"><button className="button secondary" type="button" onClick={() => setStep(3)}>Previous</button><button className="button primary" type="button" onClick={reviewSetup}>Review Setup</button></div>
        </section>

        <section className="setup-panel" hidden={step !== 5}>
          <h2>Review and activate</h2><div className="setup-review"><div><span>Free Company</span><strong>{portalName || "Not entered"}</strong></div><div><span>Portal address</span><strong>{portalUrl}</strong></div><div><span>Access</span><strong>{accessMode === "cloudflare" ? "Cloudflare Tunnel" : accessMode === "tailscale" ? "Tailscale Funnel" : accessMode === "reverse-proxy" ? "Existing reverse proxy" : accessMode === "later" ? "Configure later" : "Local network"}</strong></div><div><span>Discord server</span><strong>{discovery?.guildName || "Not connected"}</strong></div><div><span>Application ID</span><strong>{applicationId}</strong></div><div><span>Primary administrator</span><strong>{adminDiscordId}</strong></div><div><span>Additional administrators</span><strong>{additionalAdminDiscordIds.split(/[\s,]+/).filter(Boolean).length}</strong></div><div><span>Temporary guests</span><strong>{temporaryGuestsEnabled ? `${tempGuestHours} hours` : "Disabled"}</strong></div><div><span>Portal welcome engagement</span><strong>{welcomeEngagementEnabled ? "Enabled" : "Discord built-in / disabled"}</strong></div></div>
          <p><strong>World: {world} · Data center: {dataCenter}</strong></p>
          <h3>Privacy &amp; legal contact</h3><p>Every installation publishes its own policy because this community—not the software authors—controls member data. These values can be changed later in Officer Area.</p>
          <div className="form-grid">
            <label><span>Installation operator</span><input name="operatorName" value={operatorName} onChange={event=>setOperatorName(event.target.value)} required maxLength={160} placeholder={portalName||"Community or responsible person"}/></label>
            <label><span>Privacy contact email or HTTPS page</span><input name="privacyContact" value={privacyContact} onChange={event=>setPrivacyContact(event.target.value)} required maxLength={320} placeholder="privacy@example.com"/><small>This is published on /privacy and should reach someone able to handle access and deletion requests.</small></label>
            <label className="full"><span>Country or region (optional)</span><input name="operatorRegion" value={operatorRegion} onChange={event=>setOperatorRegion(event.target.value)} maxLength={160} placeholder="United States"/></label>
            <label><span>Former-member retention</span><select name="formerMemberRetentionDays" value={formerMemberRetentionDays} onChange={event=>setFormerMemberRetentionDays(Number(event.target.value))}><option value="30">30 days (recommended)</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
            <label><span>Activity and audit retention</span><select name="activityRetentionDays" value={activityRetentionDays} onChange={event=>setActivityRetentionDays(Number(event.target.value))}><option value="180">180 days</option><option value="365">365 days (recommended)</option><option value="730">2 years</option></select></label>
            <label><span>Recommended backup retention</span><select name="backupRetentionDays" value={backupRetentionDays} onChange={event=>setBackupRetentionDays(Number(event.target.value))}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days (recommended)</option></select></label>
            <label className="full"><span>Additional privacy notice (optional)</span><textarea name="privacyAdditionalNotice" value={privacyAdditionalNotice} onChange={event=>setPrivacyAdditionalNotice(event.target.value)} rows={3} maxLength={4000} placeholder="Add requirements specific to your community or location."/></label>
          </div>
          <div className="setup-warning"><strong>Storage encryption is an operator setting.</strong> Before opening the portal to members, place the Docker/PostgreSQL volume, <code>data</code> folder, and <code>backups</code> folder on storage encrypted at rest. The containers cannot verify host-volume or NAS encryption.</div>
          <p>Finishing writes the configuration to a local setup handoff. Run the setup launcher again afterward to seal it into the private installation file, then recreate the containers to activate it. A restart alone does not load changed environment settings.</p>
          <label className="checkbox-row"><input name="legalAcknowledgement" type="checkbox" required /><span><strong>I accept responsibility for this installation.</strong><small>I will publish accurate operator details, respond to member data requests, apply the selected retention periods to live data and backups, follow enabled services&apos; terms and applicable privacy requirements, and understand that this unofficial project is not affiliated with Square Enix. <a href="/privacy" target="_blank" rel="noreferrer">Privacy template</a> · <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/legal" target="_blank" rel="noreferrer">Legal notice</a></small></span></label>
          <div className="form-actions"><button className="button secondary" type="button" onClick={() => setStep(4)}>Previous</button><button className="button primary" type="submit" disabled={busy || !discovery}>{busy ? "Saving…" : "Finish Setup"}</button></div>
        </section>
        </fieldset>
      </form>
    </section>
  </main>;
}
