# Build to Expo (expo.dev) with EAS

Builds run on **Expo Application Services (EAS)** and appear in your project on [expo.dev](https://expo.dev).

## Prerequisites

- [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Log in: `eas login` (use your Expo account)

## Quick build

From the project root:

```bash
# Build for both platforms (iOS + Android)
eas build --platform all --profile production

# Or one platform
eas build --platform ios --profile production
eas build --platform android --profile production
```

Builds run in the cloud. When they finish, you get a link to the build on **expo.dev** and, for internal distribution, install links.

## Build profiles (eas.json)

| Profile       | Use case                          |
|---------------|-----------------------------------|
| `development` | Dev client, internal distribution |
| `preview`     | Internal testing (simulator: false on iOS) |
| `production`  | Store-ready build (`distribution: store`)   |

Default profile is `production` if you omit `--profile`.

## Environment variables / secrets

- **Local:** copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Optional: `EXPO_PUBLIC_INVITE_LINK_DOMAIN`.
- **EAS Build:** in [expo.dev](https://expo.dev) → your project → **Secrets**, add the same vars. They are injected at build time and merged into the app config by `app.config.js`.

If you don’t set them, the app falls back to the values in `app.json` `extra` (already set for Supabase and invite domain).

## After the build

- **expo.dev** → your project → **Builds**: view, share internal links, or download artifacts.
- **Submit to stores:** `eas submit --platform ios` or `eas submit --platform android` (requires store credentials; EAS can manage them).

## Useful commands

```bash
eas whoami
eas build:list
eas build:view
```
