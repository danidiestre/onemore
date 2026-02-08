const appJson = require('./app.json');
const expo = appJson.expo;

// At build time (e.g. EAS Build), env vars from EAS Secrets or .env are injected.
// This merges them into extra so the app uses them; app.json values are fallbacks.
const extra = {
  ...expo.extra,
  ...(process.env.EXPO_PUBLIC_SUPABASE_URL && { supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL }),
  ...(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && { supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY }),
  ...(process.env.EXPO_PUBLIC_INVITE_LINK_DOMAIN && {
    inviteLinkDomain: process.env.EXPO_PUBLIC_INVITE_LINK_DOMAIN.startsWith('http')
      ? process.env.EXPO_PUBLIC_INVITE_LINK_DOMAIN
      : `https://${process.env.EXPO_PUBLIC_INVITE_LINK_DOMAIN}`,
  }),
};

module.exports = {
  ...expo,
  extra,
};
