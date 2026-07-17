import type { IdTokenResult, User } from 'firebase/auth';
import { allowedDomain } from '@/lib/firebase';
import type { ValidationResult } from '@/composables/sessionTypes';
import { debugLog } from '@/composables/sessionDebug';
import { withRequestTimeout } from '@/lib/request';
import { t } from '@/i18n';

function getDomain(email: string | null | undefined) {
  const emailParts = String(email ?? '').trim().toLowerCase().split('@');
  return emailParts.length === 2 ? emailParts[1] : '';
}

function getGoogleIdentityCount(token: IdTokenResult) {
  const identities = token.claims.firebase?.identities;
  const googleIdentity = identities && typeof identities === 'object'
    ? (identities as Record<string, unknown>)['google.com']
    : null;

  return Array.isArray(googleIdentity) ? googleIdentity.length : 0;
}

export function validateBasicUser(user: User | null): ValidationResult {
  const expectedDomain = allowedDomain || 'auth.designateAnOnCampusDomain';

  if (!user?.email) {
    return {
      ok: false,
      reason: 'auth.theCurrentLoginAccountCannotPassTheSchoolIdentityVerification',
    };
  }

  if (!user.emailVerified) {
    return {
      ok: false,
      reason: 'auth.pleaseCompleteTheSchoolAccountVerificationBeforeLoggingIn',
    };
  }

  if (getDomain(user.email) !== allowedDomain) {
    return {
      ok: false,
      reason: t('auth.schoolDomain', { domain: t(expectedDomain) }),
    };
  }

  return { ok: true, reason: '' };
}

export async function validateUserAgainstToken(user: User) {
  const token = await withRequestTimeout(() => user.getIdTokenResult(), { label: 'auth.loginVerification' });
  const email = String(token.claims.email ?? user.email ?? '').trim().toLowerCase();
  const signInProvider = String(token.claims.firebase?.sign_in_provider ?? '');
  const emailVerified = Boolean(token.claims.email_verified ?? user.emailVerified);
  const expectedDomain = allowedDomain || 'auth.designateAnOnCampusDomain';

  debugLog('token snapshot', {
    uid: user.uid,
    userEmail: user.email ?? '',
    tokenEmail: email,
    userEmailVerified: user.emailVerified,
    tokenEmailVerified: emailVerified,
    signInProvider,
    googleIdentityCount: getGoogleIdentityCount(token),
    expectedDomain,
    userProviders: user.providerData.map((provider) => provider.providerId),
  });

  if (!email) {
    return {
      ok: false,
      reason: 'auth.theCurrentLoginAccountCannotPassTheSchoolIdentityVerification',
    };
  }

  if (getDomain(email) !== allowedDomain) {
    return {
      ok: false,
      reason: t('auth.schoolDomain', { domain: t(expectedDomain) }),
    };
  }

  if (!emailVerified) {
    return {
      ok: false,
      reason: 'auth.pleaseCompleteTheSchoolAccountVerificationBeforeLoggingIn',
    };
  }

  if (signInProvider !== 'google.com' && getGoogleIdentityCount(token) === 0) {
    return {
      ok: false,
      reason: 'auth.pleaseUseTheDesignatedSchoolAccountToLogIn',
    };
  }

  return { ok: true, reason: '' };
}
