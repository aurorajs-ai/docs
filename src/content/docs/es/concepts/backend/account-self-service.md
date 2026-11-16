---
title: Autoservicio de cuenta
description: Cómo una cuenta gestiona su propio perfil, su contraseña y su autenticación en dos pasos mediante operaciones ligadas al token del llamante, y cómo funcionan el restablecimiento de contraseña y el inicio de sesión con TOTP.
---

## Por qué existe

Un usuario necesita cambiar su propio nombre, foto, correo y contraseña, y activar un segundo factor, sin tener ningún permiso administrativo. Las operaciones de actualización genéricas no sirven para eso: toman un id de cuenta del payload y aceptan roles, tenants y el flag de activo, así que exponerlas al propietario permitiría que cualquiera se ascendiera a sí mismo.

El autoservicio lo resuelve por forma. Operaciones dedicadas actúan sobre la cuenta del token, nunca sobre un id que nombre el cliente, y sus inputs son estrechos: no hay ningún campo por el que pueda viajar una escalada.

## Cómo funciona

### Operaciones ligadas al token

Las operaciones de perfil, contraseña y dos factores son operaciones GraphQL protegidas con `@Auth()` sin permiso: cualquier cuenta autenticada puede llamarlas, y cada una toma su destino de `@CurrentAccount()`.

| Operación | Qué hace |
| --- | --- |
| `iamMeAccount` | Lee la propia cuenta del llamante. |
| `iamUpdateMeAccount` | Actualiza correo, nombre de usuario y el perfil de usuario (nombre, apellidos, móvil, idioma, avatar). |
| `iamChangePasswordMeAccount` | Cambia la contraseña del llamante. |
| `iamMeAvatarAccount` | Lee el avatar del llamante. |
| `iamMeTwoFactorAccount`, `iamEnrollTwoFactorMeAccount`, `iamActivateTwoFactorMeAccount`, `iamDisableTwoFactorMeAccount`, `iamRegenerateTwoFactorRecoveryCodesMeAccount` | El ciclo de vida del segundo factor. |

Todo lo que queda fuera del input estrecho se ignora, nunca se reenvía. Las columnas derivadas como `dPermissions` y `dTenants` no son alcanzables, y la reserva «gestionado por» que protege las cuentas administradas externamente no se aplica, porque el propietario que actúa sobre sus propios datos no es la API de administración.

### Perfil y avatar

Cambiar el correo pide `currentPassword`, que se verifica en el servidor y nunca se guarda ni se devuelve. Esa comprobación cuenta como un intento de inicio de sesión: un fallo suma para el bloqueo, y una cuenta bloqueada se rechaza igual que con una contraseña incorrecta. Borrar el correo cuenta como un cambio, porque corta la recuperación por enlace de restablecimiento. Cambiar el nombre de usuario no pide la contraseña.

El avatar viaja como URI `data:`. Solo se aceptan PNG, JPEG y WebP, el base64 debe ser estricto, la imagen decodificada puede pesar como máximo 64 KB y los bytes deben coincidir con el tipo declarado. El SVG se rechaza a propósito porque puede llevar script. Los fragmentos de listado dejan fuera el avatar, de modo que un listado nunca transporta bytes de imagen. Un cliente lo lee con `iamMeAvatarAccount`.

### Cambiar la contraseña

`iamChangePasswordMeAccount` verifica la contraseña actual, valida la nueva y le calcula el hash y después termina todas las sesiones de la cuenta, incluida la del propio llamante. El llamante inicia sesión de nuevo con la contraseña nueva.

### Restablecer la contraseña

Un usuario que no puede iniciar sesión usa dos endpoints REST públicos, `POST /api/iam/user/forgot-password` con `{ email }` y `POST /api/iam/user/reset-password` con `{ token, password }`.

El primer endpoint está construido para no revelar qué correos existen. Responde igual, y hace el mismo trabajo síncrono, para una cuenta existente, una inactiva y un correo desconocido, y no espera a que el correo se envíe. El token son 32 bytes aleatorios. Solo se guarda su resumen SHA-256, en `rememberToken` con una caducidad, de modo que quien lea la base de datos no puede usarlo. El enlace enviado es la URL del frontend de inicio de sesión configurada más `/auth/reset-password/<token>`, y el origen nunca sale de la petición.

Una petición nueva sustituye al token anterior, así que un usuario tiene un único enlace vigente. El enlace funciona una sola vez. El restablecimiento valida la contraseña nueva antes de consumir el token, de modo que una contraseña demasiado corta deja el enlace utilizable. Un restablecimiento correcto pone a cero el contador de intentos fallidos y el bloqueo, y termina todas las sesiones de la cuenta.

### Inicio de sesión en dos pasos

La autenticación en dos pasos usa TOTP (RFC 6238): HMAC-SHA1, 6 dígitos, pasos de 30 segundos, aceptando un paso de desfase de reloj a cada lado. Está desactivada salvo que el despliegue la active.

**Alta.** `iamEnrollTwoFactorMeAccount` devuelve una URI `otpauth://` y un secreto, y el factor queda pendiente. `iamActivateTwoFactorMeAccount` recibe un código de la aplicación de autenticación, lo activa y devuelve diez códigos de recuperación de un solo uso. Es la única vez que se muestran. El secreto se guarda cifrado con la clave pública de OAuth y se descifra con la privada para verificar.

**Inicio de sesión.** Para un usuario con dos pasos activado, `POST /api/o-auth/sign-in` verifica la contraseña y responde `200` con el siguiente paso y un desafío de un solo uso, sin establecer cookie. El cliente llama entonces a `POST /api/o-auth/sign-in/two-factor` con el desafío y un `code` o un `recoveryCode`. Solo entonces el backend establece la cookie `hub_session` y responde `204`. Un código nunca se acepta dos veces, un código de recuperación se consume, y los códigos erróneos cuentan para un bloqueo propio, separado del de la contraseña. El desafío dura diez minutos.

**Gestión.** El propietario puede desactivar el factor con un código o con un código de recuperación, y regenerar los códigos de recuperación con un código. Un administrador con el permiso `iam.account.resetTwoFactor` puede restablecer el factor de otra cuenta con `iamResetTwoFactorAccount`, y eso no revoca las sesiones del usuario.

## Cuándo aplica

- Construyes o revisas una pantalla de perfil y necesitas saber qué puede cambiar el propietario.
- Un usuario dice «no me llegó el correo de restablecimiento» o «mi enlace dejó de funcionar».
- Activas la autenticación en dos pasos en un despliegue, o un usuario perdió su aplicación de autenticación.

## Compromisos y límites

- **Reemplazar el par de claves rompe los factores dados de alta.** Los secretos almacenados dejan de poder descifrarse, y esos usuarios no pasan el segundo paso hasta que un administrador restablece su factor y se dan de alta de nuevo.
- **Un único enlace de restablecimiento vigente por usuario.** Pedir un segundo enlace invalida el primero.
- **El restablecimiento es público y tiene límite de frecuencia.** Ambos endpoints comparten un throttle por IP, y el inicio de sesión comprueba el `Origin` de la petición.
- **El correo forma parte de la recuperación.** Un despliegue sin un mailer funcional no puede entregar enlaces de restablecimiento.
- **Las operaciones genéricas de usuario ya no llevan campos de dos pasos.** Solo las operaciones dedicadas los escriben.

## Relacionado

- [Configurar la seguridad de la cuenta](../../../guides/backend/configure-account-security/) — las variables de entorno y la política de alta forzada.
- [Estrategias de autenticación](../authentication-strategies/) — sesiones, tokens y revocación que desencadenan los cambios de contraseña.
- [Impersonación de cuentas](../account-impersonation/) — un operador actuando como una cuenta, lo opuesto al autoservicio.
