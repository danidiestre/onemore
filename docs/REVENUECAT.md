# RevenueCat – One More! Pro (React Native)

Integración del SDK de RevenueCat para suscripciones **One More! Pro** en iOS y Android: Paywall, Customer Center, comprobación de entitlement y productos mensual, anual y de por vida.

---

## Suscripción 4,99 €/mes desde la segunda sesión

La app ya está preparada: **primera sesión gratis**, a partir de la **segunda** se muestra el paywall y el usuario debe suscribirse (4,99 €/mes). Para que ese precio y producto existan, hay que crearlos en las tiendas y en RevenueCat.

### 1. App Store Connect (iOS)

1. Entra en [App Store Connect](https://appstoreconnect.apple.com) → tu app → **Subscriptions**.
2. Crea un **Subscription Group** (p. ej. "OneMore Pro").
3. Dentro, crea una **suscripción**:
   - **Reference name**: p. ej. "OneMore Pro Monthly"
   - **Product ID**: p. ej. `onemore_pro_monthly` (anótalo).
   - **Precio**: elige el tier de **4,99 €/mes** (o el más cercano; Apple tiene precios fijos).
4. Guarda y activa la suscripción.

### 2. Google Play Console (Android)

1. Entra en [Google Play Console](https://play.google.com/console) → tu app → **Monetization** → **Subscriptions**.
2. Crea una **suscripción**:
   - **Product ID**: el mismo que en iOS, p. ej. `onemore_pro_monthly`, o uno propio (p. ej. `onemore_pro_monthly_android`).
   - **Precio**: 4,99 €/mes.
3. Activa la suscripción.

### 3. RevenueCat: conectar tiendas y crear producto

1. [RevenueCat](https://app.revenuecat.com) → tu proyecto.
2. **Project Settings** → **Apps** → conecta tu app de **iOS** (App Store Connect) y de **Android** (Google Play), si aún no está hecho.
3. **Products**:
   - Clic en **+ New**.
   - **Identifier**: p. ej. `onemore_pro_monthly` (debe coincidir con el **Product ID** de App Store Connect / Play Console).
   - Tipo: **Subscription**.
   - Asigna este producto a la **app de iOS** y a la **app de Android** (vinculando al Product ID de cada tienda).
4. **Entitlements**:
   - Si no existe, crea un entitlement con **Identifier**: `pro`.
   - En ese entitlement, **attach** el producto `onemore_pro_monthly` (y los demás que quieras: yearly, lifetime).
5. **Offerings**:
   - Crea o edita el offering por defecto ("default").
   - Añade un **Package** de tipo **Monthly** y asígnalo al producto `onemore_pro_monthly`.
6. **Paywalls**:
   - Crea o edita un paywall y asígnalo al offering "default".
   - En el editor del paywall verás el producto; el precio (4,99 €/mes) lo toma RevenueCat de la tienda.

Cuando el usuario intente crear la **segunda sesión**, la app mostrará el paywall y RevenueCat mostrará la suscripción de 4,99 €/mes si todo está vinculado así.

### Resumen

| Dónde              | Qué hacer |
|--------------------|-----------|
| App Store Connect  | Suscripción mensual, Product ID `onemore_pro_monthly`, precio 4,99 €/mes |
| Google Play        | Suscripción mensual, mismo Product ID (o uno equivalente), 4,99 €/mes |
| RevenueCat Products| Producto con identifier = Product ID de las tiendas, tipo Subscription |
| RevenueCat Entitlements | Entitlement `pro` con ese producto asignado |
| RevenueCat Offerings   | Offering "default" con un package Monthly que use ese producto |
| RevenueCat Paywalls   | Paywall asociado al offering "default" |

No hace falta tocar código: la lógica "primera sesión gratis, segunda requiere Pro" y el `presentPaywall()` ya están en la app.

---

## 1. Instalación (ya hecha)

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

- **react-native-purchases**: lógica de compras y customer info.
- **react-native-purchases-ui**: Paywall y Customer Center nativos.

Requiere **development build** (Expo: `eas build --profile development`). En Expo Go el SDK usa Preview API (no compras reales).

## 2. Configuración de la API key

En el código se usa por defecto la key de test `test_EQpcQoRndAupdfJMJeBHfySuWhD` si no hay variables de entorno.

Para producción, en `.env` o EAS Secrets:

```env
# Una key para ambas plataformas (o usa las específicas)
EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxx   # o goog_xxxx para Android

# Opcional: keys distintas por plataforma
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxx
```

Las keys se leen desde `app.config.js` → `extra` y desde `process.env`.

## 3. Dashboard RevenueCat

### Entitlement: One More! Pro

1. En [RevenueCat](https://app.revenuecat.com) → **Project** → **Entitlements**.
2. Crea un entitlement con **Identifier**: `pro` (el código usa exactamente `pro`).
3. Nombre para ti: p. ej. **"One More! Pro"**.

### Productos (monthly, yearly, lifetime)

1. **Products** → crea/vincula productos de App Store Connect y Google Play:
   - **Monthly**: Product ID igual al de la suscripción mensual (p. ej. `onemore_pro_monthly`).
   - **Yearly**: Product ID de la suscripción anual (p. ej. `onemore_pro_yearly`).
   - **Lifetime**: Product ID del compra de por vida (p. ej. `onemore_pro_lifetime`).

2. Asigna los tres productos al entitlement **pro**.

3. **Offerings** → crea un Offering (p. ej. "default") y añade los tres paquetes:
   - Identifiers recomendados: `monthly`, `yearly`, `lifetime` (o `$rc_monthly`, `$rc_annual`, `$rc_lifetime`).

### Paywall

1. **Paywalls** → crea un paywall y asígnalo al offering "default".
2. Configura diseño, precios y textos (monthly, yearly, lifetime) en el editor.
3. El paywall se muestra con `RevenueCatUI.presentPaywall()` desde la app.

### Customer Center

1. **Customer Center** → configura opciones (gestionar suscripción, restaurar, ayuda, etc.).
2. Se abre con `RevenueCatUI.presentCustomerCenter()` desde la app.

## 4. Uso en la app

### Inicialización e identificación

Al tener al usuario de Supabase autenticado (p. ej. en la pantalla de crear sesión):

```ts
import { initRevenueCat } from '@/lib/revenuecat';

await initRevenueCat(user.id);  // user.id = Supabase auth uid
```

Así RevenueCat asocia las compras al mismo usuario que tu backend.

### Comprobar si es Pro (entitlement)

```ts
import { hasProEntitlement, getCustomerInfo } from '@/lib/revenuecat';

const isPro = await hasProEntitlement();

// O con customer info completo
const result = await getCustomerInfo();
if (!('error' in result)) {
  const hasPro = typeof result.customerInfo.entitlements.active['pro'] !== 'undefined';
}
```

### Mostrar el Paywall

```ts
import { presentPaywall } from '@/lib/revenuecat';

const { success, error } = await presentPaywall();
if (success) {
  // Usuario compró o restauró; ya se ha llamado a confirm-iap-pro
}
```

### Mostrar solo si no es Pro

```ts
import { presentPaywallIfNeeded } from '@/lib/revenuecat';

const { presented, success } = await presentPaywallIfNeeded();
// Si ya tenía pro, presented = false
```

### Customer Center (gestionar suscripción)

```ts
import { presentCustomerCenter } from '@/lib/revenuecat';

await presentCustomerCenter();
```

Se usa en:

- Paywall (botón "Gestionar suscripción").
- Ajustes de sesión → "One More! Pro – Gestionar suscripción".

### Restaurar compras

```ts
import { restorePurchases } from '@/lib/revenuecat';

const { success, isPro } = await restorePurchases();
```

Tras restaurar, si `isPro` es true se llama a `confirm-iap-pro` para mantener tu tabla `user_subscriptions` al día.

### Obtener offerings (productos disponibles)

```ts
import { getOfferings } from '@/lib/revenuecat';

const result = await getOfferings();
if (!('error' in result)) {
  const current = result.offerings.current;
  const packages = current?.availablePackages ?? [];  // monthly, yearly, lifetime
}
```

## 5. Sincronización con tu backend

Tras una compra o restauración exitosa, la app llama a la Edge Function **`confirm-iap-pro`**, que hace upsert en `user_subscriptions` con `status: 'active'`. Así:

- `getProCheck()` (Supabase) sigue siendo la fuente de verdad para “¿puede crear sesión?”.
- RevenueCat es la fuente de verdad en el dispositivo para el estado de la suscripción (renovaciones, cancelaciones, etc.).

Opcional: configurar un **webhook** de RevenueCat a tu backend para actualizar `user_subscriptions` también desde el servidor.

## 6. Buenas prácticas

- **Inicializar** RevenueCat con `initRevenueCat(userId)` en cuanto tengas al usuario de Supabase.
- **No** guardar la API key en el código en producción; usar siempre variables de entorno o EAS Secrets.
- **Probar** en un development build; en Expo Go solo funciona el modo preview.
- **Manejar errores**: comprobar `result.error` o `'error' in result` y mostrar mensajes claros (ej. “No se pudieron cargar los planes”, “Restaura compras”).
- **Restaurar compras**: ofrecer siempre un botón “Restaurar compras” cerca del paywall.
- **Customer Center**: ofrecer “Gestionar suscripción” a usuarios Pro (ya enlazado en paywall y en Ajustes).

## 7. Identificadores de paquetes

El módulo `src/lib/revenuecat.ts` reconoce:

- **Monthly**: `monthly`, `$rc_monthly`, o `packageType === 'MONTHLY'`.
- **Yearly**: `yearly`, `annual`, `$rc_annual`.
- **Lifetime**: `lifetime`, `$rc_lifetime`.

Si en RevenueCat usas otros identifiers, puedes ampliar `PACKAGE_IDENTIFIERS` en ese archivo.

## 8. Referencias

- [RevenueCat – React Native](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [Paywalls – Displaying Paywalls (React Native)](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls#react-native)
- [Customer Center – React Native](https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native)
