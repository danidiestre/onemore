# Suscripción Pro en App Store (y Google Play)

La app usa **RevenueCat** en iOS y Android para IAP, y **Stripe** solo en web.

## Reglas de las tiendas

- **Apple App Store**: Las suscripciones dentro de la app **deben** usar **In-App Purchase (IAP)**.
- **Google Play**: Igual: **Google Play Billing**.
- **Web**: Stripe (flujo actual).

## Configuración RevenueCat (ya integrado en la app)

### 1. Dashboard RevenueCat

1. [Crea un proyecto](https://app.revenuecat.com) y conecta **App Store Connect** (iOS) y **Google Play Console** (Android).
2. Crea un **Entitlement** con identificador **`pro`** (la app usa exactamente este id).
3. Crea un **Product** en RevenueCat para cada tienda (el mismo Product ID que en App Store Connect / Play Console) y asígnalo al entitlement `pro`.
4. Crea un **Offering** (p. ej. "default") y añade el producto mensual.
5. En **Project Settings → API Keys** copia la **Public API key** de Apple y la de Google.

### 2. Variables de entorno

En tu `.env` o en EAS Secrets:

```
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxx
```

### 3. App Store Connect (iOS)

- Crea un **Subscription Group** (p. ej. "OneMore Pro").
- Crea una suscripción **mensual** (4,99 € o el tier que quieras). Anota el **Product ID** (p. ej. `onemore_pro_monthly`).
- En RevenueCat, al conectar App Store, vincula este Product ID al producto/entitlement `pro`.

### 4. Google Play Console (Android)

- Crea una **suscripción** con el mismo Product ID (o uno equivalente) y asígnala al producto en RevenueCat.

### 5. Sincronización con tu backend

Tras una compra correcta, la app llama a la Edge Function **`confirm-iap-pro`** (con el JWT del usuario), que hace upsert en `user_subscriptions` con `status: 'active'`. Así `getProCheck()` sigue leyendo de la misma tabla y Pro funciona igual en web (Stripe) y en app (RevenueCat).

Opcional: en RevenueCat puedes configurar un **webhook** que notifique a tu backend cuando se active/cancele una suscripción, para redundancia o analytics.

### 6. Desarrollo y pruebas

- Necesitas un **development build** (no basta con Expo Go) para probar compras reales: `eas build --platform ios --profile development`.
- En RevenueCat puedes usar **Sandbox** (iOS) y **Test tracks** (Android) para pruebas sin cobrar.

## Resumen del flujo en código

- **iOS/Android**: "Suscribirse 4€/mes" → `purchasePro()` (RevenueCat) → al completar, llamada a `confirm-iap-pro` → `user_subscriptions` queda en `active`.
- **Web**: mismo botón → Stripe Checkout → webhook Stripe actualiza `user_subscriptions`.
- El entitlement en RevenueCat debe llamarse **`pro`** (`PRO_ENTITLEMENT_ID` en `src/lib/revenuecat.ts`).

## Otras opciones (no usadas)

### IAP a mano (StoreKit / Google Billing)

- Usar `expo-in-app-purchases` o `react-native-iap` para comprar en iOS/Android.
- Tu backend: endpoint que recibe el **receipt** (Apple) o **purchase token** (Google), lo valida con Apple/Google y actualiza `user_subscriptions`.
- Más trabajo (validar receipts, renovaciones, cancelaciones) pero sin dependencia de RevenueCat.

### 3. Híbrido: Stripe solo en web, IAP en app

- En **web**: mantener el flujo actual con Stripe (create-checkout → Stripe Checkout).
- En **iOS/Android**: no mostrar pago con Stripe; usar solo IAP (con RevenueCat o a mano).
- En el backend, `user_subscriptions` se rellena desde:
  - Webhook de Stripe (web), o
  - Webhook / API de RevenueCat, o validación de receipt en tu backend (app).

## Recomendación práctica

Usar **RevenueCat** para iOS y Android, y **Stripe** solo para web. Así:

1. Un solo concepto "Pro" en tu base de datos (`user_subscriptions`).
2. En la app móvil: botón "Suscribirse 4€/mes" → RevenueCat compra → webhook actualiza tu tabla.
3. En web: botón → Stripe Checkout → webhook actual (Stripe) actualiza la misma tabla.
4. `getProCheck()` no cambia: sigue leyendo `user_subscriptions`.

## Precio 4€/mes en App Store Connect

- En App Store Connect → tu app → **Subscriptions** → crear un **Subscription Group** (ej. "OneMore Pro").
- Dentro, crear una suscripción **4,99 €/mes** (o el tier que más se acerque a 4€; Apple tiene precios fijos por país).
- Copiar el **Product ID** (ej. `onemore_pro_monthly`) y usarlo en RevenueCat o en tu código IAP.

## Siguiente paso en código

- Añadir detección de plataforma: si `Platform.OS === 'ios'` (o `'android'`), usar flujo IAP/RevenueCat; si web, usar el flujo actual de Stripe.
- Cuando elijas RevenueCat o IAP a mano, se puede implementar la pantalla de suscripción y la llamada al backend/webhook para escribir en `user_subscriptions`.
