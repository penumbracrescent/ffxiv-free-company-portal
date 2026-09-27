"use client";
import { useActionState, useEffect, useRef, useState } from "react";

type Result = { ok: boolean; message: string };
export default function PortalBrandingEditor({ logoUrl, bannerUrl, save }: {
  logoUrl: string; bannerUrl: string; save: (state: Result, data: FormData) => Promise<Result>;
}) {
  const [result, action, pending] = useActionState(save, { ok: false, message: "" });
  const [logo, setLogo] = useState("");
  const [banner, setBanner] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  useEffect(() => () => { if (banner) URL.revokeObjectURL(banner); }, [banner]);
  useEffect(() => { if (result.ok) { form.current?.reset(); setLogo(""); setBanner(""); } }, [result]);
  return <form action={action} ref={form} className="settings-form">
    <p>Change the public site logo and homepage banner without repeating setup. Use images you own or have permission to display. PNG, JPG, WebP, or GIF; up to 8 MB each.</p>
    <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className="form-grid">
        <label><span>Logo (square recommended)</span><img src={logo || logoUrl} alt="Logo preview" style={{ width: 160, height: 160, objectFit: "contain", maxWidth: "100%" }} /><input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setLogo(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : "")} /><small>Use branding you have permission to publish and do not imply official Square Enix endorsement.</small></label>
        <label><span>Banner (wide image recommended)</span><img src={banner || bannerUrl} alt="Banner preview" style={{ width: "100%", height: 160, objectFit: "cover" }} /><input name="banner" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setBanner(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : "")} /><small>FFXIV screenshots remain subject to the current Materials Usage Policy.</small></label>
        <label><input type="checkbox" name="resetLogo" /> Use the original setup logo</label>
        <label><input type="checkbox" name="resetBanner" /> Use the original setup banner</label>
      </div>
      <p>Leave a field unchanged to keep its current image. Choose either an upload or reset for each image.</p>
      <button type="submit" className="button primary">{pending ? "Saving..." : "Save Logo and Banner"}</button>
    </fieldset>
    {result.message && <p role={result.ok ? "status" : "alert"}>{result.message}</p>}
  </form>;
}
