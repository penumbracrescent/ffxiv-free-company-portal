import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SetupWizard from "./SetupWizard";
import { isSetupMode, isValidSetupToken } from "../../lib/setup-security";

export const metadata: Metadata = { title: "Portal Setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function unlockSetup(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "").trim();
  if (!isValidSetupToken(token)) redirect("/setup?invalid=1");
  const cookieStore = await cookies();
  cookieStore.set("portal_setup_token", token, { httpOnly: true, sameSite: "strict", secure: String(process.env.PORTAL_URL || "").startsWith("https://"), path: "/setup", maxAge: 3600 });
  redirect("/setup");
}

export default async function SetupPage({ searchParams }: { searchParams?: Promise<{ token?: string; invalid?: string }> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = String(params?.token || cookieStore.get("portal_setup_token")?.value || "");
  if (!isSetupMode()) {
    return <main className="setup-shell"><section className="setup-card"><h1>Setup is complete</h1><p>This installation is no longer accepting first-time configuration.</p><a className="button primary" href="/">Open the portal</a></section></main>;
  }
  if (!isValidSetupToken(token)) {
    return <main className="setup-shell"><section className="setup-card setup-token-card"><p className="eyebrow">First-time setup</p><h1>Enter the setup token</h1><p>Open <code>SETUP_TOKEN.txt</code> beside your <code>.env</code> file and paste its contents below.</p>{params?.invalid ? <div className="setup-error">That token was not accepted. Check the text file and try again.</div> : null}<form action={unlockSetup}><label><span>Setup token</span><input name="token" type="password" required autoComplete="off" autoFocus /></label><button className="button primary" type="submit">Begin Setup</button></form></section></main>;
  }
  return <SetupWizard setupToken={token} defaultPortalUrl={String(process.env.PORTAL_URL || "http://localhost:9030/")} />;
}
