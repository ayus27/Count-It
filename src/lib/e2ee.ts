// End-to-end encryption helpers. Private keys never leave this browser (IndexedDB).
const DB = "team-chat-keys";
const STORE = "keys";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet<T>(k: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(k);
    q.onsuccess = () => res(q.result as T | undefined);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(k: string, v: unknown): Promise<void> {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

export type LocalKeys = { privateKey: CryptoKey; publicJwk: JsonWebKey };

export async function loadKeys(userId: string): Promise<LocalKeys | undefined> {
  return idbGet<LocalKeys>(`user:${userId}`);
}

export async function createKeys(userId: string): Promise<LocalKeys> {
  const pair = await crypto.subtle.generateKey(ECDH, false, ["deriveKey"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keys = { privateKey: pair.privateKey, publicJwk };
  await idbSet(`user:${userId}`, keys);
  return keys;
}

const pubCache = new Map<string, Promise<CryptoKey>>();
function importPub(jwk: JsonWebKey): Promise<CryptoKey> {
  const id = `${jwk.x}:${jwk.y}`;
  let p = pubCache.get(id);
  if (!p) {
    p = crypto.subtle.importKey("jwk", jwk, ECDH, false, []);
    pubCache.set(id, p);
  }
  return p;
}

/** Shared AES key between my private key and another person's public key. */
export async function pairKey(mine: CryptoKey, theirJwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: await importPub(theirJwk) },
    mine,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function aesEncrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { ct: toB64(ct), iv: toB64(iv) };
}
export async function aesDecrypt(key: CryptoKey, ct: string, iv: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export type Member = { user_id: string; full_name: string; public_key: JsonWebKey };
export type Sealed = { ciphertext: string; iv: string; wrapped_keys: Record<string, { ct: string; iv: string }> | null };

export async function sealDirect(mine: CryptoKey, them: Member, text: string): Promise<Sealed> {
  const k = await pairKey(mine, them.public_key);
  const { ct, iv } = await aesEncrypt(k, enc.encode(text));
  return { ciphertext: ct, iv, wrapped_keys: null };
}

export async function sealGroup(mine: CryptoKey, members: Member[], text: string): Promise<Sealed> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const msgKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const { ct, iv } = await aesEncrypt(msgKey, enc.encode(text));
  const wrapped: Record<string, { ct: string; iv: string }> = {};
  for (const m of members) wrapped[m.user_id] = await aesEncrypt(await pairKey(mine, m.public_key), raw);
  return { ciphertext: ct, iv, wrapped_keys: wrapped };
}

/** Decrypt a message. `otherJwk` is the public key of the other party (sender, or recipient if I sent it). */
export async function openMessage(
  mine: CryptoKey,
  myId: string,
  msg: { ciphertext: string; iv: string; wrapped_keys: unknown },
  otherJwk: JsonWebKey,
): Promise<string> {
  const pk = await pairKey(mine, otherJwk);
  if (!msg.wrapped_keys) return dec.decode(await aesDecrypt(pk, msg.ciphertext, msg.iv));
  const w = (msg.wrapped_keys as Record<string, { ct: string; iv: string }>)[myId];
  if (!w) throw new Error("not a recipient");
  const raw = await aesDecrypt(pk, w.ct, w.iv);
  const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  return dec.decode(await aesDecrypt(k, msg.ciphertext, msg.iv));
}
