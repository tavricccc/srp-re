import { pathToFileURL } from 'node:url';

const MANAGEMENT_API_ORIGIN = 'https://api.supabase.com';
const FIREBASE_ISSUER_ORIGIN = 'https://securetoken.google.com';
const PROJECT_REF_PATTERN = /^[a-z]{20}$/u;
const FIREBASE_PROJECT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{4,28}[a-z0-9])$/u;

function requiredValue(value, name) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function normalizeIssuer(value) {
  return typeof value === 'string' ? value.replace(/\/+$/u, '') : '';
}

function responseMessage(body, statusText) {
  if (body && typeof body === 'object' && typeof body.message === 'string') {
    return body.message;
  }
  return statusText || 'Unknown Management API error';
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Supabase Management API returned invalid JSON (${response.status}).`);
  }
}

async function managementRequest(fetchImpl, accessToken, url, init = {}) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = new Error(
      `Supabase Management API request failed (${response.status}): ${responseMessage(body, response.statusText)}`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

function isFirebaseIntegration(integration) {
  const type = typeof integration?.type === 'string' ? integration.type.toLowerCase() : '';
  const issuer = normalizeIssuer(integration?.oidc_issuer_url);
  return type.includes('firebase') || issuer.startsWith(`${FIREBASE_ISSUER_ORIGIN}/`);
}

export function firebaseIssuer(firebaseProjectId) {
  const projectId = requiredValue(firebaseProjectId, 'FIREBASE_PROJECT_ID');
  if (!FIREBASE_PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('FIREBASE_PROJECT_ID is not a valid Firebase project ID.');
  }
  return `${FIREBASE_ISSUER_ORIGIN}/${projectId}`;
}

export async function syncSupabaseFirebaseAuth({
  accessToken,
  projectRef,
  firebaseProjectId,
  fetchImpl = fetch,
  apiOrigin = MANAGEMENT_API_ORIGIN,
}) {
  const token = requiredValue(accessToken, 'SUPABASE_ACCESS_TOKEN');
  const ref = requiredValue(projectRef, 'SUPABASE_PROJECT_REF');
  if (!PROJECT_REF_PATTERN.test(ref)) {
    throw new Error('SUPABASE_PROJECT_REF must be the 20-letter project reference.');
  }

  const desiredIssuer = firebaseIssuer(firebaseProjectId);
  const endpoint = `${apiOrigin.replace(/\/+$/u, '')}/v1/projects/${ref}/config/auth/third-party-auth`;
  const listIntegrations = async () => {
    const integrations = await managementRequest(fetchImpl, token, endpoint);
    if (!Array.isArray(integrations)) {
      throw new Error('Supabase Management API returned an invalid third-party auth list.');
    }
    return integrations;
  };

  let integrations = await listIntegrations();
  let created = false;
  let desired = integrations.find(
    (integration) => normalizeIssuer(integration?.oidc_issuer_url) === desiredIssuer,
  );

  if (!desired) {
    try {
      await managementRequest(fetchImpl, token, endpoint, {
        method: 'POST',
        body: JSON.stringify({ oidc_issuer_url: desiredIssuer }),
      });
      created = true;
    } catch (error) {
      if (error?.status !== 409) throw error;
    }

    integrations = await listIntegrations();
    desired = integrations.find(
      (integration) => normalizeIssuer(integration?.oidc_issuer_url) === desiredIssuer,
    );
    if (!desired) {
      throw new Error('Firebase third-party auth creation completed without the expected issuer.');
    }
  }

  const staleFirebaseIntegrations = integrations.filter(
    (integration) =>
      integration?.id &&
      integration.id !== desired.id &&
      isFirebaseIntegration(integration),
  );
  for (const integration of staleFirebaseIntegrations) {
    await managementRequest(
      fetchImpl,
      token,
      `${endpoint}/${encodeURIComponent(integration.id)}`,
      { method: 'DELETE' },
    );
  }

  const verified = await listIntegrations();
  const matching = verified.filter(
    (integration) => normalizeIssuer(integration?.oidc_issuer_url) === desiredIssuer,
  );
  if (matching.length !== 1) {
    throw new Error('Firebase third-party auth verification did not find exactly one desired issuer.');
  }

  return {
    issuer: desiredIssuer,
    created,
    removedStale: staleFirebaseIntegrations.length,
  };
}

async function main() {
  const result = await syncSupabaseFirebaseAuth({
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  });
  console.log(
    `Firebase third-party auth is synchronized for ${result.issuer}; removed ${result.removedStale} stale integration(s).`,
  );
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
