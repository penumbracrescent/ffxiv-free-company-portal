import NextAuth from "next-auth";
import Authentik from "next-auth/providers/authentik";
import Discord from "next-auth/providers/discord";
import { Client } from "pg";
import { createHmac } from "node:crypto";

function normalizeDiscordUserId(value: unknown): string | null {
  const discordUserId = String(value ?? "").trim();
  return /^\d{15,22}$/.test(discordUserId) ? discordUserId : null;
}

function getDiscordUserIdFromProfile(profile: Record<string, any>): string | null {
  return normalizeDiscordUserId(
    profile.discord_id ??
      profile.discord_user_id ??
      profile.discord?.id ??
      profile.attributes?.discord?.id
  );
}

const authProvider = String(process.env.AUTH_PROVIDER || "discord").trim().toLowerCase();

const configuredInstallationAdminIds = String(process.env.PORTAL_ADMIN_DISCORD_IDS || "")
  .split(",")
  .map((value) => normalizeDiscordUserId(value))
  .filter((value): value is string => Boolean(value));
const primaryInstallationAdminId = normalizeDiscordUserId(process.env.PORTAL_PRIMARY_ADMIN_DISCORD_ID)
  || configuredInstallationAdminIds[0]
  || null;
const installationAdminIds = new Set(primaryInstallationAdminId ? [primaryInstallationAdminId] : []);

async function isDiscordPortalAdministrator(discordUserId: string | null) {
  if (!discordUserId) return false;
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) return installationAdminIds.has(discordUserId);
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const fingerprint=createHmac("sha256",String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"")).update(`discord:${discordUserId}`).digest("hex");
    const suppressed=await client.query("select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1",[fingerprint]).catch(()=>({rows:[]}));
    if(suppressed.rows.length)return false;
    if (installationAdminIds.has(discordUserId)) return true;
    const result = await client.query<{ value: string }>("select value from portal_settings where key = 'additionalAdminDiscordIds' limit 1;");
    return String(result.rows[0]?.value || "").split(",").map((value) => value.trim()).includes(discordUserId);
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function isDiscordPrivacySuppressed(discordUserId:string|null){
  if(!discordUserId||!String(process.env.DATABASE_URL||"").trim())return false;
  const client=new Client({connectionString:process.env.DATABASE_URL});
  try{await client.connect();const fingerprint=createHmac("sha256",String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"")).update(`discord:${discordUserId}`).digest("hex");return Boolean((await client.query("select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1",[fingerprint])).rows.length);}catch{return false;}finally{await client.end().catch(()=>undefined);}
}

const providers = authProvider === "authentik"
  ? [Authentik({
      clientId: process.env.AUTH_AUTHENTIK_ID!,
      clientSecret: process.env.AUTH_AUTHENTIK_SECRET!,
      issuer: process.env.AUTH_AUTHENTIK_ISSUER!,
      authorization: { params: { scope: "openid email profile groups discord" } },
      profile(profile) {
        const authentikSubject = String(profile.sub ?? "").trim();
        const discordUserId = getDiscordUserIdFromProfile(profile);
        return {
          id: authentikSubject,
          name: profile.name ?? profile.preferred_username ?? profile.email,
          email: profile.email,
          image: profile.picture,
          groups: Array.isArray(profile.groups) ? profile.groups : [],
          authentikSubject,
          discordUserId
        } as any;
      }
    })]
  : [Discord({
      clientId: process.env.AUTH_DISCORD_ID || process.env.DISCORD_APPLICATION_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.global_name ?? profile.username,
          email: profile.email,
          image: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
          groups: [],
          authentikSubject: null,
          discordUserId: normalizeDiscordUserId(profile.id)
        } as any;
      }
    })];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.groups = (user as any).groups ?? [];
        token.authentikSubject =
          String((user as any).authentikSubject ?? token.sub ?? "").trim() || null;
        token.discordUserId = normalizeDiscordUserId(
          (user as any).discordUserId
        );
      }

      const discordUserId = normalizeDiscordUserId((token as any).discordUserId);
      const privacySuppressed=await isDiscordPrivacySuppressed(discordUserId);
      const groups = Array.isArray((token as any).groups)
        ? (token as any).groups.filter((group: unknown) => group !== "Admins" && (!privacySuppressed || group !== "Guild Officers"))
        : [];
      if (!privacySuppressed && await isDiscordPortalAdministrator(discordUserId)) groups.push("Admins");
      token.groups = groups;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).groups = Array.isArray((token as any).groups)
          ? (token as any).groups
          : [];
        (session.user as any).authentikSubject =
          String((token as any).authentikSubject ?? token.sub ?? "").trim() ||
          null;
        (session.user as any).discordUserId = normalizeDiscordUserId(
          (token as any).discordUserId
        );
      }

      return session;
    }
  }
});
