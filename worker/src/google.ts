/**
 * Sign in with Google: the app sends a Google ID token, the worker checks it
 * and turns the Google account into a stable player id. Nothing else about the
 * account (name, e-mail, picture) is read or stored; the id is a hash of `sub`.
 */
export interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
}

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const b64 = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
};

const json = (text: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(new TextDecoder().decode(b64(text))) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** `clientIds` is one id or several separated by commas: the web, Android and iOS apps each have their own. */
/** Returns the Google account id (`sub`) when the token is genuine, for one of these apps and not expired. */
export async function verifyGoogleToken(token: unknown, clientIds: string, keys: Jwk[], nowMs: number): Promise<string | null> {
  const allowed = clientIds.split(",").map(id => id.trim()).filter(Boolean);
  if (typeof token !== "string" || allowed.length === 0) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = json(parts[0]);
  const claims = json(parts[1]);
  if (!header || !claims || header.alg !== "RS256") return null;
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", { ...jwk, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(parts[2]), signed))) return null;
  if (!allowed.includes(String(claims.aud)) || !ISSUERS.includes(String(claims.iss))) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 < nowMs) return null;
  return typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : null;
}

/**
 * The popup sign-in on the web gives an access token instead of an ID token. Google's tokeninfo
 * endpoint says which app it was issued to and for which account.
 */
export async function verifyAccessToken(
  token: unknown,
  clientIds: string,
  get: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = fetch,
): Promise<string | null> {
  const allowed = clientIds.split(",").map(id => id.trim()).filter(Boolean);
  if (typeof token !== "string" || !/^[\w.~-]{10,2048}$/.test(token) || allowed.length === 0) return null;
  const response = await get(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const info = (await response.json()) as { aud?: string; azp?: string; sub?: string; expires_in?: string | number };
  const app = info.aud ?? info.azp ?? "";
  return allowed.includes(app) && Number(info.expires_in) > 0 && typeof info.sub === "string" && info.sub !== "" ? info.sub : null;
}

/** 32 hex characters, the same shape as an anonymous player id. */
export async function playerIdForGoogle(sub: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`neon-path:google:${sub}`)));
  return Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
}

let cached: { keys: Jwk[]; at: number } | null = null;

export async function googleKeys(nowMs: number): Promise<Jwk[]> {
  if (cached && nowMs - cached.at < 3_600_000) return cached.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("google keys unavailable");
  cached = { keys: ((await response.json()) as { keys: Jwk[] }).keys, at: nowMs };
  return cached.keys;
}
