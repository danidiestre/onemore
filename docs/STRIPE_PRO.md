# OneMore Pro – Stripe (4€/mes)

La primera sesión es gratis. A partir de la segunda, el usuario necesita suscripción Pro (4€/mes) vía Stripe.

## Configuración en Stripe

1. **Producto y precio**
   - En [Stripe Dashboard](https://dashboard.stripe.com/products) crea un producto, p. ej. "OneMore Pro".
   - Añade un precio recurrente: **4 €/mes** (recurring monthly).
   - Copia el **Price ID** (empieza por `price_...`).

2. **Webhook**
   - En [Stripe Webhooks](https://dashboard.stripe.com/webhooks) añade un endpoint:
     - URL: `https://<TU_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
     - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copia el **Signing secret** (empieza por `whsec_...`).

## Secretos en Supabase

En **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets** (o en CLI: `supabase secrets set ...`) configura:

| Secreto | Valor |
|--------|--------|
| `STRIPE_SECRET_KEY` | Tu clave secreta de Stripe (`sk_live_...`). **No la pongas nunca en el código ni en .env.** |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | El Price ID del precio de 4€/mes (`price_...`). |
| `STRIPE_WEBHOOK_SECRET` | El signing secret del webhook (`whsec_...`). |

Las Edge Functions `create-checkout` y `stripe-webhook` ya están desplegadas y usan estos secretos.

## Flujo en la app

1. El usuario abre "Nueva sesión" y escribe el nombre.
2. Si es su **primera sesión** → se crea gratis.
3. Si ya tiene al menos una sesión y **no tiene Pro** → se muestra el paywall "Suscribirse 4€/mes"; al pulsar se abre Stripe Checkout en el navegador.
4. Tras pagar, Stripe llama al webhook y se actualiza `user_subscriptions`; el usuario puede volver a la app y crear la sesión.

## Deep links

La app usa `onemore://pro-success` como URL de éxito y `onemore://` como cancelación para volver a la app después del pago. Asegúrate de tener el scheme `onemore` en `app.json` (ya está configurado).
