---
title: Impersonación de cuentas
description: Cómo un operador autorizado actúa como otra cuenta sin compartir una contraseña — la mutación GraphQL, el token de vida corta con un claim de actor, los tres vetos y cómo el panel de administración apila y restaura sesiones.
---

## Por qué existe

El personal de soporte necesita ver lo que ve un usuario: los mismos menús, los mismos datos, el mismo error. Los atajos habituales son malos. Pedir la contraseña del usuario rompe la promesa de que solo él la conoce. Copiar los roles del usuario a una cuenta de operador muestra más o menos lo correcto, pero se desvía en cuanto los roles cambian y no deja rastro de quién miró.

La impersonación lo resuelve en el token. El operador pide al backend un token que se comporta como la cuenta destino, y el token dice, en un claim estándar, quién está realmente detrás. Todo lo que podría hacer la cuenta destino lo puede hacer el operador, y todo queda atribuido al operador.

## Cómo funciona

### Emisión del token

El operador llama a la mutación GraphQL `oAuthCreateImpersonateToken(payload: { targetAccountId })`. Es solo GraphQL y no es un grant type del endpoint de tokens, así que `POST /api/o-auth/token` nunca emite uno. El llamante debe estar autenticado con un JWT y tener el permiso `oAuth.credential.impersonalize`, que se siembra sin roles: la capacidad permanece inerte hasta que un administrador la asigna a un rol.

La respuesta es un token de acceso y su duración, nada más:

- **Sin refresh token.** Una credencial de impersonación no se puede renovar por construcción.
- **Vida corta.** Su duración es `JWT_IMPERSONATION_TTL_SECONDS`, 900 segundos por defecto, independiente de las duraciones de los tokens ordinarios.
- **Un claim de actor.** El token lleva `act.sub`, el id de cuenta del operador (RFC 8693). El principal construido a partir de él expone ese id como `impersonatedBy`, de modo que cualquier código distingue una petición impersonada de una normal.
- **Una fila de auditoría.** Una fila de credencial OAuth registra el grant type `IMPERSONATION`, el destino como cuenta y el operador como `impersonatorAccountId`.
- **Una vista fresca del destino.** Las instantáneas de permisos y de tenants del destino se refrescan en la emisión, de modo que el token nunca entrega un acceso obsoleto.

Solo funciona cuando el propio backend emite los tokens (`OAUTH_STRATEGY=local-provider`). En cualquier otro modo responde `503`.

### Los tres vetos

Antes de emitir, el handler rechaza con `403` cuando:

1. **El destino es el propio llamante.** No hay autoimpersonación.
2. **El llamante ya está impersonando.** No hay cadenas: un token con claim de actor no puede iniciar otra impersonación.
3. **El destino tiene un permiso que concede privilegios.** Los permisos del destino se comparan con una lista de denegación: otros derechos de impersonación y los permisos que permitirían crear un privilegio equivalente por otra puerta, concretamente los permisos de escritura de roles, cuentas, permisos, clientes OAuth, aplicaciones y credenciales; actualizar y hacer upsert de usuarios, que pueden fijar una contraseña; la configuración clave-valor, que guarda esta misma lista; y los códigos de autorización, tokens de acceso y refresh tokens, incluidos los permisos de lectura, porque esas filas contienen credenciales utilizables. No se permite impersonar a un par.

La lista de denegación tiene un suelo fijo en el código. Una lista ajustable por el operador en el almacén clave-valor (`oAuth.impersonation.privilegeDenylist`) solo puede añadir entradas. Nunca puede quitar una que el suelo exija, porque un valor almacenado que pudiera reducir la lista permitiría que una sesión comprometida desactive el veto para todas las siguientes. Una clave ausente, un error de lectura o un valor mal formado vuelven al suelo.

El veto lee los permisos del destino tras un refresco estricto. Si el refresco falla, la petición falla con `503` en lugar de decidir con una instantánea obsoleta. Un destino inexistente o inactivo es un `404`, y un destino sin cliente es un `400`.

### En el panel de administración

El listado de cuentas ofrece una acción de impersonar por cuenta, solo a una sesión que tenga el permiso, nunca mientras la propia sesión está impersonada y nunca en la fila del propio operador.

Iniciar una impersonación apila las credenciales del operador detrás de las impersonadas en el almacén de tokens. Una insignia persistente en la cabecera se muestra siempre que la sesión activa está impersonada, y se deriva del claim de actor del token activo, nunca de la presencia de la pila, de modo que una pila obsoleta no puede hacerla mentir. Activar la insignia termina la impersonación y restaura la sesión del operador. Si no hay nada que restaurar, el panel cierra la sesión y vuelve al inicio de sesión con un mensaje, en lugar de afirmar un regreso que no ocurrió.

Como el token no tiene refresh, que una impersonación caduque no es un cierre de sesión. El panel restaura la sesión del propio operador y muestra un único aviso, aunque fallen varias peticiones a la vez.

## Cuándo aplica

- Soporte necesita reproducir lo que ve un usuario concreto.
- Ves un valor `impersonatedBy` en el principal, un claim `act` en un token o una fila de credencial con grant type `IMPERSONATION`.
- Una petición de impersonación devuelve `403` y necesitas saber qué veto la rechazó.

## Compromisos y límites

- **Solo en modo `local-provider`.** Un satélite que delega el inicio de sesión en un hub no puede emitir el token.
- **La lista de denegación es gruesa a propósito.** Una comprobación de «los permisos del destino deben ser un subconjunto de los del llamante» compararía dos instantáneas y se rompería en cuanto un rol cambie, dando un veto que nadie sabe explicar. Una lista de permisos conocidos que conceden privilegios es estable y legible. La comprobación más estricta queda registrada como posible endurecimiento futuro.
- **Nada incluye el permiso de serie.** Hasta que un rol tenga `oAuth.credential.impersonalize`, nadie puede impersonar.
- **Sin renovación.** Una sesión de soporte larga necesita una impersonación nueva cuando pasan los 15 minutos.

## Relacionado

- [Estrategias de autenticación](../authentication-strategies/) — el endpoint de tokens que la impersonación deliberadamente no usa.
- [Alcance por tenant](../tenant-scope/) — una sesión impersonada queda acotada por los tenants del destino.
- [Autoservicio de cuenta](../account-self-service/) — lo que una cuenta puede hacer por sí misma, sin operador de por medio.
