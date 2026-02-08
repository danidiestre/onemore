# Guía de build – iOS y Android (EAS)

Documento único para que los builds **no fallen**. Incluye requisitos, checklist previo y solución a errores habituales (incl. Associated Domains en iOS).

---

## 1. Requisitos previos

- **EAS CLI**: `npm install -g eas-cli`
- **Expo**: `eas login` (cuenta en [expo.dev](https://expo.dev))
- **iOS**: Cuenta Apple Developer. App ID `com.drinkcounter.app` con las capacidades que usa la app (en particular **Associated Domains**).
- **Android**: Cuenta Google Play Console. Package `com.drinkcounter.app`.

---

## 2. Configuración que debe estar bien (ya en el repo)

| Qué | Dónde | Valor / Comentario |
|-----|--------|---------------------|
| **cli.appVersionSource** | `eas.json` | `"local"` – versión desde app.json |
| **slug** | `app.json` | `"drink-counter"` – debe coincidir con el proyecto en expo.dev (extra.eas.projectId) |
| **Bundle ID (iOS)** | `app.json` → ios.bundleIdentifier | `com.drinkcounter.app` |
| **Package (Android)** | `app.json` → android.package | `com.drinkcounter.app` |

No cambies el slug a otro valor a menos que crees un nuevo proyecto en expo.dev y actualices `extra.eas.projectId`.

---

## 3. Error: “Provisioning profile doesn't support Associated Domains” (iOS)

Si el build de iOS falla con:

```text
Provisioning profile "*[expo] com.drinkcounter.app AppStore ..." doesn't support the Associated Domains capability.
Provisioning profile ... doesn't include the com.apple.developer.associated-domains entitlement.
```

es porque la app usa **Associated Domains** (universal links: `applinks:links.drinkcounter.app`) pero el perfil de aprovisionamiento que usa EAS **no tiene** esa capacidad.

### Solución paso a paso

1. **Apple Developer**
   - Entra en [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**.
   - Abre el App ID **com.drinkcounter.app** (o créalo si no existe).
   - En **Capabilities** activa **Associated Domains** y guarda.

2. **Regenerar credenciales iOS en EAS**
   - En tu proyecto:
     ```bash
     eas credentials --platform ios
     ```
   - Elige el perfil (production) y **elimina el provisioning profile** actual (o “Remove” y deja que EAS cree uno nuevo).
   - O en [expo.dev](https://expo.dev) → tu proyecto → **Credentials** → iOS → borrar el provisioning profile para que el siguiente build genere uno nuevo.

3. **Vuelve a lanzar el build**
   ```bash
   eas build --platform ios --profile production
   ```
   EAS generará un nuevo perfil que incluirá Associated Domains si el App ID lo tiene activado.

### Si no usas universal links (no recomendado)

Solo si **no** necesitas que `https://links.drinkcounter.app/join/XXX` abra la app directamente, puedes quitar Associated Domains:

- En `app.json` → `expo.ios` borra o comenta:
  ```json
  "associatedDomains": ["applinks:links.drinkcounter.app"]
  ```
  Así el build puede pasar con un perfil sin esa capacidad, pero perderás universal links para los invites.

---

## 4. Checklist antes de cada build

Antes de `eas build`:

- [ ] **eas.json**: `cli.appVersionSource` = `"local"`.
- [ ] **app.json**: `slug` = `"drink-counter"` (igual que en expo.dev).
- [ ] **iOS**: En Apple Developer, el App ID `com.drinkcounter.app` tiene **Associated Domains** activado. Si has cambiado algo de capacidades, regenera credenciales iOS en EAS (`eas credentials --platform ios` y quitar perfil para forzar uno nuevo).
- [ ] **Versión**: En `app.json`, `version` (ej. 1.0.0) y `ios.buildNumber` / `android.versionCode` actualizados si quieres subir un nuevo build a las tiendas.

---

## 5. Comandos de build

```bash
# Ambas plataformas
eas build --platform all --profile production

# Solo iOS
eas build --platform ios --profile production

# Solo Android
eas build --platform android --profile production
```

---

## 6. Versiones (app.json)

- **version**: string, ej. `"1.0.0"` (visible en tiendas).
- **ios.buildNumber**: entero, debe subir en cada build que subas a App Store (ej. 1, 2, 3…).
- **android.versionCode**: entero, debe subir en cada build que subas a Play Store (ej. 1, 2, 3…).

Con `appVersionSource: "local"`, EAS usa estos valores de `app.json` (o los que inyectes vía `app.config.js`).

---

## 7. Secretos (EAS)

En [expo.dev](https://expo.dev) → proyecto → **Secrets**:

| Secreto | Uso |
|--------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase (opcional si ya está en app.json extra) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase (opcional si ya está en app.json extra) |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` o `_IOS` / `_ANDROID` | RevenueCat |

---

## 8. Submit a tiendas

Cuando tengas un build listo:

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

La primera vez, EAS puede pedir credenciales (Apple ID, keystore Android, etc.). También puedes configurarlas en expo.dev → **Credentials**.

---

## 9. Resumen: por qué “petaba” el build y cómo evitarlo

1. **Slug ≠ proyecto EAS**  
   → `app.json` debe tener `"slug": "drink-counter"` (mismo que en expo.dev).

2. **Falta `cli.appVersionSource`**  
   → En `eas.json`, `"cli": { "appVersionSource": "local" }`.

3. **iOS: perfil sin Associated Domains**  
   → Activar **Associated Domains** en el App ID en Apple Developer y regenerar el provisioning profile en EAS (borrar el actual y volver a hacer `eas build --platform ios --profile production`).

Con esta guía y el checklist, los futuros builds deberían pasar si sigues los pasos antes de lanzar `eas build`.
