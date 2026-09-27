import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function secret() {
  const value=String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"").trim();
  if(!value) throw new Error("The privacy-protection secret is required for poll ballots.");
  return createHash("sha256").update(`poll-ballot:${value}`).digest();
}

export function pollVoterKey(pollId:number,discordUserId:string){
  return createHmac("sha256",secret()).update(`${pollId}:${discordUserId}`).digest("hex");
}

export function encryptPollDiscordId(discordUserId:string){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",secret(),iv);
  const body=Buffer.concat([cipher.update(discordUserId,"utf8"),cipher.final()]);
  return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),body.toString("base64url")].join(".");
}

export function decryptPollDiscordId(value:string){
  const [iv,tag,body]=String(value||"").split(".");
  if(!iv||!tag||!body) return null;
  try{const decipher=createDecipheriv("aes-256-gcm",secret(),Buffer.from(iv,"base64url"));decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(body,"base64url")),decipher.final()]).toString("utf8");}catch{return null;}
}
