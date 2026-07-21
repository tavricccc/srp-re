/** Minimal Google Identity Services (GIS) Token Client typings used by Novae login. */

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  hd?: string;
  prompt?: string;
  token_type?: string;
  scope?: string;
  state?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

interface GoogleTokenClientError {
  type?: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
  message?: string;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: GoogleTokenClientError) => void;
  prompt?: '' | 'none' | 'consent' | 'select_account';
  hd?: string;
  hint?: string;
  state?: string;
}

interface GoogleOverridableTokenClientConfig {
  prompt?: '' | 'none' | 'consent' | 'select_account';
  enable_serial_consent?: boolean;
  hint?: string;
  state?: string;
}

interface GoogleTokenClient {
  requestAccessToken(overrideConfig?: GoogleOverridableTokenClientConfig): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
}

interface GoogleAccounts {
  oauth2: GoogleOAuth2;
}

interface GoogleIdentityServices {
  accounts: GoogleAccounts;
}

interface Window {
  google?: GoogleIdentityServices;
}
