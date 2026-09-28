// Ký & xác thực session cookie bằng HMAC-SHA256 (Web Crypto API — chạy được cả
// trong Node runtime lẫn Edge middleware, không cần thêm thư viện JWT).

export const SESSION_COOKIE_NAME = 'session';

export interface SessionPayload {
  uid: string;
  role: 'admin' | 'teacher';
  exp: number; // epoch giây
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'Thiếu biến môi trường SESSION_SECRET (dùng để ký session đăng nhập). Thêm vào .env.local.'
    );
  }
  return secret;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const buf = new Uint8Array(bytes);
  let str = '';
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 12
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(full)).buffer as ArrayBuffer);
  const key = await getKey(getSecret());
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const key = await getKey(getSecret());
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature) as BufferSource,
      encoder.encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
