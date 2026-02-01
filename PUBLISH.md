# Guía de Publicación - DrinkCounter

Esta guía te ayudará a publicar la app DrinkCounter en App Store (iOS) y Google Play Store (Android).

## Prerrequisitos

1. **Cuenta de Expo**: Regístrate en https://expo.dev
2. **Cuenta de Apple Developer** (para iOS): https://developer.apple.com ($99/año)
3. **Cuenta de Google Play Console** (para Android): https://play.google.com/console ($25 una vez)

## Paso 1: Instalar EAS CLI

```bash
npm install -g eas-cli
```

## Paso 2: Iniciar sesión en Expo

```bash
eas login
```

## Paso 3: Configurar el proyecto

El proyecto ya tiene configurado:
- `eas.json` - Configuración de builds
- `app.json` - Configuración de la app

## Paso 4: Configurar credenciales (primera vez)

### Para iOS:

```bash
eas build:configure
```

Esto te pedirá:
- Si quieres usar EAS para gestionar las credenciales (recomendado: sí)
- Tu Apple ID y contraseña
- Si tienes un certificado de distribución (si es la primera vez, EAS lo creará)

### Para Android:

```bash
eas build:configure
```

EAS creará automáticamente:
- Keystore para firmar la app
- Credenciales necesarias

## Paso 5: Crear un build

### Build para iOS (TestFlight/App Store):

```bash
eas build --platform ios --profile production
```

Esto:
- Creará un build en los servidores de Expo
- Te dará un link para seguir el progreso
- Cuando termine, tendrás un archivo `.ipa` listo para subir a App Store Connect

### Build para Android (Google Play):

```bash
eas build --platform android --profile production
```

Esto creará un archivo `.aab` (Android App Bundle) listo para Google Play.

### Build para ambas plataformas:

```bash
eas build --platform all --profile production
```

## Paso 6: Subir a las tiendas

### iOS - App Store Connect:

1. **Crear la app en App Store Connect**:
   - Ve a https://appstoreconnect.apple.com
   - Crea una nueva app
   - Completa la información (nombre, descripción, screenshots, etc.)

2. **Subir el build**:
   ```bash
   eas submit --platform ios
   ```
   - Esto subirá automáticamente el build a App Store Connect
   - O puedes descargar el `.ipa` y subirlo manualmente con Transporter

3. **Revisar y publicar**:
   - En App Store Connect, revisa el build
   - Completa toda la información requerida
   - Envía para revisión

### Android - Google Play Console:

1. **Crear la app en Google Play Console**:
   - Ve a https://play.google.com/console
   - Crea una nueva app
   - Completa la información (nombre, descripción, screenshots, etc.)

2. **Subir el build**:
   ```bash
   eas submit --platform android
   ```
   - Esto subirá automáticamente el build a Google Play
   - O puedes descargar el `.aab` y subirlo manualmente

3. **Revisar y publicar**:
   - En Google Play Console, revisa el build
   - Completa toda la información requerida
   - Envía para revisión

## Paso 7: Builds de prueba (opcional)

Antes de publicar, puedes crear builds de prueba:

### Para iOS (TestFlight):

```bash
eas build --platform ios --profile preview
```

Luego sube a TestFlight:
```bash
eas submit --platform ios
```

### Para Android (Internal Testing):

```bash
eas build --platform android --profile preview
```

Luego sube a Google Play Console en la sección "Internal testing".

## Comandos útiles

- **Ver builds en progreso**: `eas build:list`
- **Ver credenciales**: `eas credentials`
- **Actualizar versión**: Edita `app.json`:
  - `version`: Versión visible (ej: "1.0.0")
  - `ios.buildNumber`: Número de build para iOS (incrementa cada build)
  - `android.versionCode`: Número de build para Android (incrementa cada build)

## Actualizar la app

Para publicar una nueva versión:

1. Actualiza la versión en `app.json`:
   ```json
   {
     "version": "1.0.1",
     "ios": {
       "buildNumber": "2"
     },
     "android": {
       "versionCode": 2
     }
   }
   ```

2. Crea un nuevo build:
   ```bash
   eas build --platform all --profile production
   ```

3. Sube a las tiendas:
   ```bash
   eas submit --platform all
   ```

## Notas importantes

- **Primera publicación**: Puede tardar varios días en ser aprobada
- **Actualizaciones**: Generalmente se aprueban más rápido (horas/días)
- **Deep Links**: La app ya tiene configurado el scheme `drinkcounter://` en `app.json`
- **Supabase**: Las credenciales están en `app.json` bajo `expo.extra`

## Troubleshooting

### Error: "package.json does not exist in /home/expo/workingdir/build/drink-counter"

Este error ocurre cuando el proyecto está en un subdirectorio del repositorio. **EAS Build espera que el proyecto esté en la raíz del repositorio**.

**Solución**: Tienes dos opciones:

1. **Crear un repositorio separado para el proyecto** (recomendado):
   ```bash
   cd /Users/danidiestre/Documents/Code/drink-counter
   git init
   git remote add origin <tu-nuevo-repositorio>
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Mover el proyecto a la raíz del repositorio actual**:
   - Mueve todos los archivos de `drink-counter/` a la raíz del repositorio
   - Asegúrate de que `package.json`, `app.json`, y `eas.json` estén en la raíz

### Error de credenciales:
```bash
eas credentials
```

### Ver logs del build:
```bash
eas build:list
# Luego haz click en el link del build para ver logs detallados
```

### Build falla:
- Revisa los logs en el dashboard de Expo
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que `app.json` esté correctamente configurado
- **Asegúrate de que el proyecto esté en la raíz del repositorio Git**

## Recursos

- [Documentación de EAS Build](https://docs.expo.dev/build/introduction/)
- [Documentación de EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Guía de App Store Connect](https://developer.apple.com/app-store-connect/)
- [Guía de Google Play Console](https://support.google.com/googleplay/android-developer)
