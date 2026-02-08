# Dominio para invite links

Los enlaces de invitación pueden usar un **dominio** (p. ej. `https://links.drinkcounter.app/join/ABC12345`) o **solo el scheme** (`onemore://join/CODE`). No hace falta comprar dominio para generar links.

## ¿Necesito comprar un dominio?

**No.** Tienes dos opciones:

1. **Sin dominio (por defecto)**  
   Si no configuras `inviteLinkDomain`, la app genera links del tipo `onemore://join/ABC12345`. Funcionan en cuanto alguien abre el link en un dispositivo con la app instalada. No necesitas servidor ni dominio.

2. **Con dominio (opcional)**  
   - **Dominio comprado:** puedes usar tu propio dominio (ej. `links.drinkcounter.app`) y alojar ahí el archivo de asociación para Universal/App Links.  
   - **Subdominio gratuito:** puedes usar un subdominio que te dan plataformas como **Vercel** (`tu-app.vercel.app`), **Netlify** (`tu-app.netlify.app`) o **Expo** (si usas EAS Hosting). No compras dominio; solo creas un proyecto y sirves en esa URL el archivo `apple-app-site-association` (y opcionalmente una página de “Abrir en la app”). Así tienes links `https://...` sin coste de dominio.

## Configuración del dominio

### 1. Definir el dominio en la app

En **`app.json`**, dentro de `expo.extra`:

```json
"inviteLinkDomain": "https://links.drinkcounter.app"
```

O con variable de entorno (EAS Build / local):

- `EXPO_PUBLIC_INVITE_LINK_DOMAIN=links.drinkcounter.app`  
- o `EXPO_PUBLIC_INVITE_LINK_DOMAIN=https://links.drinkcounter.app`

Si no se define dominio, se usa el scheme por defecto: `onemore://join/CODE`. **Para usar solo estos links (sin dominio):** quita o comenta `inviteLinkDomain` en `app.json` (y, si quieres, `ios.associatedDomains`); la app seguirá generando y abriendo links correctamente.

### 2. Añadir otro dominio (o cambiar el actual)

- **Para generar los links con otro dominio:** cambia `inviteLinkDomain` (o `EXPO_PUBLIC_INVITE_LINK_DOMAIN`) al nuevo dominio.
- **Para que varios dominios abran la app:** en `app.json` → `expo.ios.associatedDomains` añade cada dominio:

```json
"ios": {
  "associatedDomains": [
    "applinks:links.drinkcounter.app",
    "applinks:otro-dominio.com"
  ]
}
```

Cada dominio debe servir su propio archivo de asociación (ver abajo).

## Universal Links (iOS)

Para que `https://tu-dominio.com/join/CODE` abra la app en iOS:

1. **En la app:** el dominio debe estar en `ios.associatedDomains` como `applinks:tu-dominio.com` (sin `https://`).

2. **En el servidor del dominio:** sirve el archivo **Apple App Site Association** en:
   ```
   https://tu-dominio.com/.well-known/apple-app-site-association
   ```
   Contenido (sustituye `TEAM_ID` y el bundle id si es distinto):

   ```json
   {
     "applinks": {
       "details": [{
         "appID": "TEAM_ID.com.drinkcounter.app",
         "paths": ["/join/*"]
       }]
     }
   }
   ```

   - Content-Type: `application/json`.
   - Sin extensión en el nombre del archivo.
   - Debe servirse por HTTPS.

3. **Recompilar la app** (development build o producción) para que el dispositivo use los `associatedDomains` actualizados.

## Android App Links

En Android, para que el mismo dominio abra la app hay que servir **Digital Asset Links** en:

```
https://tu-dominio.com/.well-known/assetlinks.json
```

Y tener configurado el package name en `app.json` (`android.package`: `com.drinkcounter.app`). En builds con EAS/Expo, la configuración de intent filters puede generarse a partir del scheme y del dominio asociado según la documentación de Expo.

## Resumen

| Qué quieres | Dónde |
|-------------|--------|
| Usar otro dominio en los links que se comparten | `app.json` → `extra.inviteLinkDomain` o `EXPO_PUBLIC_INVITE_LINK_DOMAIN` |
| Que un nuevo dominio abra la app en iOS | Añadir `applinks:nuevo-dominio.com` en `ios.associatedDomains` y servir AASA en ese dominio |
| Que un nuevo dominio abra la app en Android | Servir `assetlinks.json` en ese dominio y configurar según Expo/Android |

La lógica que construye la URL del invite está en **`src/utils/invite.ts`** (`getInviteLink(code)`). El manejo de los links entrantes (scheme o https) está en **`app/_layout.tsx`**.
