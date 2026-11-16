---
title: Configurar la seguridad de la cuenta
description: Configura el restablecimiento de contraseña y la autenticación en dos pasos con TOTP en un despliegue — variables de entorno, la política de alta forzada, los bloqueos y el restablecimiento por un administrador.
---

## Objetivo

Tener correos de restablecimiento de contraseña funcionando y, si lo quieres, inicio de sesión en dos pasos con una política opcional de alta forzada, con los límites y bloqueos ajustados a tu despliegue.

## Antes de empezar

- Los contextos IAM y OAuth están en el proyecto (`catalyst add identity` los instala).
- Conoces el [concepto](../../../concepts/backend/account-self-service/): qué hacen el restablecimiento y los dos pasos por el usuario.
- Puedes definir variables de entorno del backend y dispones de una forma de enviar correo desde él.

## Pasos

1. **Haz que el correo funcione.** El restablecimiento de contraseña envía su enlace por correo mediante el mailer del backend, que está apagado salvo que `MAILER_ENABLED=true`. Configura el transporte del mailer para tu entorno antes de probar nada más. Sin él, pedir un restablecimiento sigue respondiendo con normalidad, por diseño, y no llega ningún correo.

2. **Apunta el enlace a tu frontend.** El enlace enviado es `OAUTH_SIGN_IN_FRONTEND_URL` más `/auth/reset-password/<token>`. Ponle la URL pública del frontend. El origen nunca se toma de la petición, así que un valor erróneo aquí hace que todos los enlaces sean erróneos.

   ```ini
   OAUTH_SIGN_IN_FRONTEND_URL=https://app.example.com
   ```

3. **Ajusta el restablecimiento (opcional).** Se muestran los valores por defecto.

   ```ini
   IAM_PASSWORD_RESET_TOKEN_TTL_MINUTES=60   # vida del enlace
   THROTTLE_IAM_PASSWORD_RESET_LIMIT=5       # peticiones por IP, ambos endpoints
   THROTTLE_IAM_PASSWORD_RESET_TTL_MS=60000  # ventana de ese límite
   ```

4. **Ajusta el bloqueo por contraseña (opcional).** Tras este número de comprobaciones de contraseña fallidas consecutivas, la cuenta se bloquea y responde como si la contraseña fuera incorrecta aunque sea la correcta. Un inicio de sesión correcto pone el contador a cero, y un restablecimiento de contraseña también.

   ```ini
   OAUTH_LOGIN_MAX_ATTEMPTS=5
   OAUTH_LOGIN_LOCK_SECONDS=900
   ```

5. **Activa los dos pasos (opcional).** Solo la cadena exacta `true` activa la capacidad. Mientras está desactivada, todo inicio de sesión es solo con contraseña y las pantallas de perfil e inicio de sesión ocultan la función. Los usuarios conservan su secreto dado de alta, así que volver a activarla restaura su factor.

   ```ini
   IAM_TWO_FACTOR_ENABLED=true
   IAM_TWO_FACTOR_ISSUER=Aurora        # etiqueta que muestra la app de autenticación
   IAM_TWO_FACTOR_MAX_ATTEMPTS=5       # códigos erróneos antes de bloquear el segundo factor
   IAM_TWO_FACTOR_LOCK_SECONDS=900
   ```

   Los códigos erróneos cuentan para su propio bloqueo y nunca afectan al de la contraseña.

6. **Fuerza el alta (opcional).** La política no es una variable de entorno. Es el clave-valor `iam.twoFactor.required`, un booleano sembrado como `false`. Ponlo en `true` en las pantallas de clave-valor de `tools`; no hace falta redesplegar. Solo tiene efecto mientras `IAM_TWO_FACTOR_ENABLED` sea `true`. Entonces cada cuenta de usuario sin factor debe darse de alta en su siguiente inicio de sesión, antes de recibir una sesión. Las sesiones vivas no se revocan.

7. **Permite que los administradores restablezcan un factor.** Asigna el permiso `iam.account.resetTwoFactor` al rol que atiende los autenticadores perdidos. La pantalla de cuentas ofrece entonces una acción para restablecer el factor de otra cuenta. No revoca las sesiones de ese usuario, y el usuario se da de alta de nuevo en el siguiente inicio de sesión.

## Verifica que funciona

- Pide un restablecimiento para una dirección real. Para una dirección desconocida llega la misma respuesta. Para la real llega un correo con un enlace a tu frontend que abre el formulario de restablecimiento, y el enlace funciona una sola vez.
- Tras restablecer, inicia sesión con la contraseña nueva y confirma que una sesión anterior de esa cuenta ya no funciona.
- Con los dos pasos activados, da de alta una cuenta en su perfil, cierra sesión e inicia de nuevo: el paso de contraseña responde con un desafío en lugar de una sesión, y el segundo paso con un código establece la sesión.
- Con la política forzada activada, inicia sesión con una cuenta sin factor: debe darse de alta antes de recibir una sesión.

## Solución de problemas

**La petición de restablecimiento devuelve éxito pero no llega ningún correo.** La respuesta es idéntica a propósito. Revisa `MAILER_ENABLED` y la configuración del transporte, y después el log del backend: un fallo de entrega se registra con el id del usuario, nunca con el enlace.

**El enlace abre el sitio equivocado.** `OAUTH_SIGN_IN_FRONTEND_URL` no es la URL pública del frontend.

**`429` al restablecer.** Se alcanzó el throttle por IP de ambos endpoints. Espera a que pase la ventana o sube el límite.

**Los usuarios no pasan el segundo paso tras un cambio de claves.** Los secretos se cifran con el par de claves de OAuth, y reemplazar el par deja todos los secretos almacenados sin poder descifrarse. Restablece el factor de esos usuarios y haz que se den de alta de nuevo.

**Un usuario perdió su autenticador.** Puede iniciar sesión con un código de recuperación, cada uno utilizable una vez. Si no le quedan, restablece su factor como administrador.

## Relacionado

- [Autoservicio de cuenta](../../../concepts/backend/account-self-service/) — cómo funcionan el restablecimiento, el cambio de contraseña y los dos pasos.
- [Estrategias de autenticación](../../../concepts/backend/authentication-strategies/) — sesiones y el bloqueo que alimenta un inicio de sesión fallido.
