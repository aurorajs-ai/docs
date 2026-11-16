---
title: Catálogo de buzones y puerto de lectura
description: Cómo el bounded context tools mantiene un catálogo de direcciones de correo desde las que la plataforma lee y envía, cómo un consumidor las alcanza por id y cómo el puerto de lectura neutral oculta Microsoft 365, Google e IMAP.
---

## Por qué existe

Un bounded context necesita con frecuencia ingerir adjuntos de una bandeja de entrada o enviar correo desde una dirección corporativa, y quien decide qué cuenta es no es un desarrollador sino un administrador. Si cada contexto guardara su propia conexión, las credenciales quedarían repartidas entre agregados y el protocolo de cada proveedor se filtraría al código de negocio.

La capacidad de buzones del bounded context `tools` resuelve ambos problemas. Una fila del catálogo es una dirección en la que la plataforma inicia sesión, y los consumidores se refieren a ella por id. Los detalles del proveedor quedan detrás de un puerto neutral.

## Cómo funciona

### El catálogo

Una fila `ToolsMailbox` es una dirección de correo, única en todo el catálogo. Tiene dos sentidos independientes, cada uno con su proveedor, su secreto y su estado:

| Sentido | Proveedores | Para qué sirve |
| --- | --- | --- |
| Entrada (lectura) | `MICROSOFT_365`, `IMAP`, `GOOGLE` | Listar mensajes, descargar adjuntos, mover mensajes |
| Salida (envío) | `SMTP`, `MICROSOFT_365`, `GOOGLE` | Enviar correo desde esa dirección |

Un sentido sin proveedor está apagado, y su secreto y su estado se borran. SMTP solo envía e IMAP solo lee, por eso los dos conjuntos de proveedores difieren.

Cada sentido guarda un **secreto** JSON, cifrado en reposo y enmascarado en cada lectura. Se valida al guardar con el propio analizador del proveedor, la misma función que ejecuta el adaptador al conectar, de modo que el formato almacenado y el validador no pueden divergir. El formulario ofrece una plantilla por proveedor, y un secreto vacío al actualizar conserva el almacenado.

El **estado** de un sentido lo mantiene el servidor: `CONFIGURED` (se guardó un secreto válido, sin probar), `VERIFIED` (la última prueba tuvo éxito) o `CONNECTION_ERROR` (la última prueba falló, o un consumidor informó de credenciales rechazadas). Un formulario sin guardar se puede probar sin escribir nada.

### Referenciar un buzón

Un consumidor guarda solo el `id` del buzón, como clave foránea real (`mailboxId`), y nunca una conexión propia. Le sirven dos puertos, registrados globalmente mediante `BridgesModule`:

- **`TOOLS_MAILBOX_INBOUND`** resuelve un id en una conexión lista para usar, o en el motivo por el que no se puede usar (`NOT_CONFIGURED`, `CONNECTION_ERROR`, `UNDECRYPTABLE`). La conexión lleva el secreto descifrado: el consumidor la pasa al lector y nunca la registra, la guarda ni la devuelve. Cuando el lector rechaza las credenciales, el consumidor llama a `reportCredentialsRejected`, que cambia el estado a `CONNECTION_ERROR` y responde `true` a uno solo de varios llamantes concurrentes, de modo que el aviso se emite una vez.
- **`TOOLS_MAILBOX_SENDER`** envía correo mediante un id de buzón. Está completamente envuelto: el secreto nunca sale de `tools`. No hay `from`, porque el remitente es siempre la propia dirección del buzón, con su nombre visible configurado. `html` es obligatorio.

Un id desconocido es un error del llamante y se rechaza con un error de no encontrado, no con un resultado.

### El puerto de lectura neutral

`MailboxReaderService` es el único puerto de lectura. Un despachador enruta cada llamada según el proveedor de la conexión, y ningún tipo de proveedor o de protocolo cruza el puerto; un test hace cumplir ese aislamiento. La conexión llega en cada llamada, así que el puerto nunca sabe qué entidad de negocio es dueña del buzón.

| Operación | Qué hace |
| --- | --- |
| `listMessages(connection, folder)` | Lista los mensajes pendientes de una carpeta, cada uno con asunto, remitente, hora de recepción y adjuntos. |
| `getAttachmentContent(connection, messageRef, attachmentRef)` | Descarga un adjunto. |
| `moveMessage(connection, messageRef, destinationFolder)` | Mueve un mensaje a otra carpeta. |
| `testConnection(connection, folders)` | Autentica, alcanza el buzón y resuelve cada carpeta nombrada, sin tocar ningún mensaje. |
| `ensureFolder(connection, folder)` | Crea el último segmento de una ruta de carpeta si falta y responde si lo creó. Un padre ausente es un error: los padres nunca se crean de forma recursiva. |

Las carpetas son rutas de nombres visibles separadas por `/`, y un primer segmento `Inbox` denota siempre la bandeja de entrada. Un mensaje está **pendiente** mientras permanece en su carpeta de origen: la marca de leído no se usa nunca, así que mover fuera un mensaje procesado es la forma en que un consumidor lo da por hecho. Un mensaje se identifica por su `internetMessageId` (el Message-ID de RFC 5322), estable entre carpetas y protocolos. El `messageRef` solo es válido mientras el mensaje siga en su carpeta, porque un proveedor puede reasignarlo al moverlo.

Los fallos son de un único tipo, `MailboxReaderError`, con un código de categoría (`INVALID_CREDENTIALS`, `MAILBOX_UNREACHABLE`, `FOLDER_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `PROVIDER_UNAVAILABLE`, `UNEXPECTED_RESPONSE`). Los consumidores deciden según el código. Un mensaje de error nunca contiene un secreto, un token ni el cuerpo de una respuesta del proveedor.

### El adaptador IMAP

El adaptador IMAP usa `imapflow`. Su secreto es `{ host, port, secure, username, password }`. TLS es obligatorio: TLS implícito cuando `secure` es true y, en caso contrario, STARTTLS que debe tener éxito, y el certificado se verifica siempre. Las rutas de carpeta usan `/` en el puerto y se traducen al delimitador propio del servidor. Su referencia de mensaje codifica la carpeta, el UIDVALIDITY y el UID, de modo que una referencia anterior a la reconstrucción de un buzón no se encuentra en lugar de apuntar a otro mensaje.

## Cuándo aplica

- Un bounded context ingiere documentos de una bandeja que configura un administrador.
- Un bounded context envía correo desde una dirección corporativa concreta, en lugar de usar el correo de sistema de la plataforma.

## Compromisos y límites

- El correo de sistema (restablecimiento de contraseña, avisos) permanece en el mailer de la plataforma y no forma parte de este catálogo.
- Enviar requiere `MAILER_ENABLED=true`. Sin él la plataforma arranca, y un envío falla con un error de servicio no disponible. La lectura no necesita el mailer.
- Microsoft 365 necesita un registro de aplicación de Graph con el permiso de aplicación del sentido que se use. Google necesita una cuenta de servicio con delegación en todo el dominio para el ámbito `https://mail.google.com/`.
- Asignar los permisos `tools.mailbox.*` a los roles es manual.

## Relacionado

- [Ports entre bounded contexts](../cross-bounded-context-ports/) — por qué el consumidor inyecta un token.
- [Almacenamiento de archivos](../file-storage/) — el mismo patrón de catálogo para escribir archivos.
