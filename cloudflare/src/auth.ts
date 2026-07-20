import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './types';

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export async function requireFirebaseUid(request: Request, env: Env) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  if (!match) throw new Error('unauthenticated');
  if (env.LOCAL_TEST_MODE === 'true') {
    try {
      const encodedPayload = match[1].split('.')[1] ?? '';
      const normalized = encodedPayload.replace(/-/gu, '+').replace(/_/gu, '/');
      const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>;
      const now = Math.floor(Date.now() / 1000);
      if (payload.aud !== env.FIREBASE_PROJECT_ID
        || payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
        || typeof payload.exp !== 'number' || payload.exp <= now
        || typeof payload.sub !== 'string' || !payload.sub) throw new Error('unauthenticated');
      return payload.sub;
    } catch {
      throw new Error('unauthenticated');
    }
  }
  try {
    const { payload } = await jwtVerify(match[1], firebaseKeys, {
      audience: env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('unauthenticated');
    return payload.sub;
  } catch {
    throw new Error('unauthenticated');
  }
}
