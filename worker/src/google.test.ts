import assert from "node:assert/strict";
import test from "node:test";

import { playerIdForGoogle, verifyGoogleToken, type Jwk } from "./google";

const enc = (value: unknown) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

async function setup() {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" } as unknown as Jwk;
  const sign = async (claims: Record<string, unknown>, alg = "RS256") => {
    const body = `${enc({ alg, kid: "k1" })}.${enc(claims)}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(body));
    return `${body}.${Buffer.from(signature).toString("base64url")}`;
  };
  return { jwk, sign };
}

const NOW = 1_800_000_000_000;
const good = { iss: "https://accounts.google.com", aud: "client-1", sub: "1234", exp: NOW / 1000 + 600 };

test("a genuine Google token gives the account id; anything else gives null", async () => {
  const { jwk, sign } = await setup();
  assert.equal(await verifyGoogleToken(await sign(good), "client-1", [jwk], NOW), "1234");
  assert.equal(await verifyGoogleToken(await sign({ ...good, aud: "other" }), "client-1", [jwk], NOW), null, "wrong app");
  assert.equal(await verifyGoogleToken(await sign({ ...good, iss: "https://evil.example" }), "client-1", [jwk], NOW), null, "wrong issuer");
  assert.equal(await verifyGoogleToken(await sign({ ...good, exp: NOW / 1000 - 1 }), "client-1", [jwk], NOW), null, "expired");
  const forged = (await sign(good)).replace(/\.[^.]+$/, `.${enc("nope")}`);
  assert.equal(await verifyGoogleToken(forged, "client-1", [jwk], NOW), null, "bad signature");
  assert.equal(await verifyGoogleToken(await sign(good), "", [jwk], NOW), null, "sign-in switched off");
  assert.equal(await verifyGoogleToken(await sign({ ...good, aud: "ios-1" }), "client-1, ios-1", [jwk], NOW), "1234", "any of the app ids");
  assert.equal(await verifyGoogleToken("a.b", "client-1", [jwk], NOW), null);
});

test("the same Google account always maps to the same 32-character player id", async () => {
  const id = await playerIdForGoogle("1234");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(id, await playerIdForGoogle("1234"));
  assert.notEqual(id, await playerIdForGoogle("1235"));
});
