# Build iOS y Android con EAS (Expo)

Los builds se ejecutan en **EAS (Expo Application Services)** y aparecen en tu proyecto en [expo.dev](https://expo.dev).

## Requisitos

- [EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Cuenta Expo: `eas login`
- Para **App Store / Play Store**: cuenta Apple Developer y Google Play Console, y credenciales configuradas en EAS (o en el primer `eas submit`).

## Build para tiendas (iOS + Android)

Desde la raíz del proyecto:

```bash
# Ambas plataformas
eas build --platform all --profile production

# Solo iOS
eas build --platform ios --profile production

# Solo Android
eas build --platform android --profile production
```

El build se hace en la nube. Al terminar, en [expo.dev](https://expo.dev) → tu proyecto → **Builds** tendrás los artefactos y enlaces para descargar o enviar a las tiendas.

## Perfiles (eas.json)

| Perfil         | Uso |
|----------------|-----|
| `development`  | Dev client, distribución interna (probar RevenueCat, etc.) |
| `preview`      | Pruebas internas (IPA/APK instalables) |
| `production`   | Build para store (App Store / Play Store) |

Por defecto se usa `production` si no indicas `--profile`.

## Variables de entorno y secretos (EAS)

En [expo.dev](https://expo.dev) → tu proyecto → **Secrets** añade las que necesites para el build. Se inyectan en build time y `app.config.js` las pasa al app.

| Variable | Necesaria para |
|----------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` o `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID` | RevenueCat (suscripción Pro) |
| `EXPO_PUBLIC_INVITE_LINK_DOMAIN` | (opcional) Dominio de invite links |

Si no las configuras en Secrets, la app usará los valores por defecto de `app.json` `extra` (Supabase e invite domain ya tienen fallback).

## Enviar a las tiendas (submit)

Cuando tengas un build **production** listo:

```bash
# iOS (App Store Connect)
eas submit --platform ios --latest

# Android (Google Play)
eas submit --platform android --latest
```

La primera vez, EAS te pedirá credenciales (Apple ID, keystore de Android, etc.). Puedes configurarlas en [expo.dev](https://expo.dev) → project → **Credentials**.

## Después del build

- **Builds**: [expo.dev](https://expo.dev) → tu proyecto → **Builds** → ver, descargar o enviar a store.
- **Subir a stores**: `eas submit --platform ios` / `eas submit --platform android` (o desde la web en el detalle del build).

## Comandos útiles

```bash
eas whoami
eas build:list
eas build:view
eas credentials
```

## Nota: RevenueCat e IAP

Para que las compras in-app (suscripción Pro) funcionen en el build de producción, asegúrate de:

1. Tener los productos y el entitlement `pro` configurados en RevenueCat (ver `docs/CHECKLIST_SUSCRIPCION_4.99.md`).
2. Tener las API keys de RevenueCat en EAS Secrets (o en `app.json` extra para desarrollo).
3. Usar el perfil **production** para builds que subas a App Store / Play Store.
