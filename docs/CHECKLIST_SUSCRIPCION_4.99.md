# Checklist: suscripción 4,99 €/mes (One More! Pro)

Sigue esta lista en orden. Los IDs están elegidos para que la app funcione sin cambiar código.

---

## Valores a usar (copia y pega)

| Concepto | Valor |
|----------|--------|
| **Product ID (mensual)** | `onemore_pro_monthly` |
| **Entitlement identifier** | `pro` |
| **Offering identifier** | `default` |

---

## 1. App Store Connect (iOS)

- [ ] Entra en [App Store Connect](https://appstoreconnect.apple.com) → tu app **One More!** (o el nombre que tenga).
- [ ] **Monetization** → **Subscriptions** (o **Services** → **In-App Purchases** → Subscriptions).
- [ ] Crea un **Subscription Group**:
  - Nombre: `OneMore Pro` (o el que quieras).
- [ ] Dentro del group, **Create Subscription**:
  - **Reference name**: `OneMore Pro Monthly`
  - **Product ID**: `onemore_pro_monthly` (exactamente así).
  - **Subscription duration**: 1 month.
  - **Price**: selecciona el tier que sea **4,99 €** (o el más cercano en tu país).
- [ ] Completa la ficha (nombre localizado, etc.) y **Submit for Review** cuando la app esté lista.

---

## 2. Google Play Console (Android)

- [ ] Entra en [Google Play Console](https://play.google.com/console) → tu app.
- [ ] **Monetize** → **Subscriptions** (o **Products** → **Subscriptions**).
- [ ] **Create subscription**:
  - **Product ID**: `onemore_pro_monthly` (mismo que iOS).
  - **Name**: p. ej. `One More! Pro Monthly`.
  - **Billing period**: Monthly.
  - **Price**: 4,99 € (o el equivalente).
- [ ] Activa la suscripción y guarda.

---

## 3. RevenueCat

### 3.1 Apps (si aún no está)

- [ ] [RevenueCat](https://app.revenuecat.com) → tu proyecto.
- [ ] **Project Settings** → **Apps**: asegúrate de tener una app **iOS** (vinculada a App Store Connect) y una **Android** (vinculada a Google Play). Si no, **Add app** y sigue el asistente.

### 3.2 Product

- [ ] **Products** → **+ New**.
  - **Identifier**: `onemore_pro_monthly`
  - **Type**: Subscription.
  - **Apple App Store**: selecciona tu app iOS y asocia el Product ID `onemore_pro_monthly` de App Store Connect.
  - **Google Play Store**: selecciona tu app Android y asocia el Product ID `onemore_pro_monthly` de Play Console.
- [ ] Guardar.

### 3.3 Entitlement

- [ ] **Entitlements** → si no existe, **+ New**.
  - **Identifier**: `pro`
  - **Display name** (opcional): `One More! Pro`
- [ ] En ese entitlement, **Attach product** → selecciona `onemore_pro_monthly`.
- [ ] Guardar.

### 3.4 Offering

- [ ] **Offerings** → abre el offering **default** (o créalo con identifier `default`).
- [ ] Añade un **Package**:
  - **Identifier**: `monthly` (o `$rc_monthly`).
  - **Package type**: Monthly.
  - **Product**: `onemore_pro_monthly`.
- [ ] Guardar.

### 3.5 Paywall

- [ ] **Paywalls** → crea uno o edita el existente.
- [ ] Asigna el paywall al offering **default**.
- [ ] En el editor, configura el diseño; el precio 4,99 €/mes se rellenará solo desde la tienda.

---

## 4. Comprobar en la app

- [ ] Build de desarrollo: `eas build --platform ios --profile development` (o android).
- [ ] En la app: crea una primera sesión (gratis). Intenta crear una segunda: debe aparecer el paywall de RevenueCat con la opción de 4,99 €/mes.
- [ ] En sandbox (iOS) o con licencia de prueba (Android), completa una compra de prueba y comprueba que puedes crear la segunda sesión.

---

## Resumen rápido

1. **App Store Connect**: Subscription Group → suscripción con Product ID `onemore_pro_monthly`, 4,99 €/mes.
2. **Google Play**: Suscripción con Product ID `onemore_pro_monthly`, 4,99 €/mes.
3. **RevenueCat**: Producto `onemore_pro_monthly` → Entitlement `pro` → Offering `default` (package monthly) → Paywall asignado a `default`.

Cuando todo esté marcado, la suscripción de 4,99 €/mes funcionará desde la segunda sesión sin tocar código.
