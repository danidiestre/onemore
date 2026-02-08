import Constants from 'expo-constants';

const INVITE_SCHEME = 'onemore';

/**
 * Base URL for invite links. When set (e.g. https://links.tuapp.com), share links
 * use this domain so Universal Links / App Links can open the app.
 * Set in app.json extra.inviteLinkDomain or EXPO_PUBLIC_INVITE_LINK_DOMAIN (with or without https://).
 */
function getInviteBaseUrl(): string {
  const domain =
    Constants.expoConfig?.extra?.inviteLinkDomain ??
    process.env.EXPO_PUBLIC_INVITE_LINK_DOMAIN;
  if (domain && typeof domain === 'string') {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    return base.replace(/\/$/, '');
  }
  return `${INVITE_SCHEME}://`;
}

/**
 * Full URL to join a session by invite code.
 * Uses the configured domain if set, otherwise the app scheme (onemore://join/CODE).
 */
export function getInviteLink(code: string): string {
  const base = getInviteBaseUrl();
  if (base.startsWith('http')) {
    return `${base}/join/${code}`;
  }
  return `${base}join/${code}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
