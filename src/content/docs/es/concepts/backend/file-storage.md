---
title: Catálogo de almacenamientos de archivos
description: Cómo el bounded context tools mantiene un catálogo de almacenamientos externos en los que la plataforma escribe archivos, cómo un consumidor referencia uno por id y cómo el puerto de solo escritura oculta al proveedor.
---

## Por qué existe

Algunos procesos deben archivar o entregar un archivo en un servidor externo: una factura escaneada en el SFTP de un cliente, una exportación mensual en una unidad compartida. El servidor y sus credenciales son una decisión del administrador. Si cada agregado guardara su propia conexión, los secretos se repartirían entre tablas y cada bounded context cargaría con código de transporte.

La capacidad de almacenamiento de archivos del bounded context `tools` guarda una fila de catálogo por cada lugar remoto. Un consumidor guarda solo el id de la fila y escribe mediante un puerto que nunca expone el secreto.

## Cómo funciona

### El catálogo

Una fila `ToolsFileStorage` es un punto remoto en el que la plataforma inicia sesión, con un proveedor (`SFTP` es el único implementado), un secreto JSON cifrado y un estado. Aquí "almacenamiento de archivos" es un punto remoto, no una unidad de red montada.

- El **secreto** se valida al guardar con el propio analizador del proveedor, la función que `write` ejecuta primero, de modo que formato y validador no pueden divergir. El error nombra el campo que falla, nunca su valor. Se cifra en reposo, se enmascara en cada lectura y nunca se entrega a otro bounded context. Un secreto vacío al actualizar conserva el almacenado, y cambiar el proveedor exige un secreto nuevo en la misma petición.
- El **estado** lo mantiene el servidor: `CONFIGURED` (se guardó un secreto válido, sin probar), `VERIFIED` (la última prueba de conexión tuvo éxito) o `CONNECTION_ERROR` (la última prueba falló). Una escritura fallida no cambia el estado.
- Un secreto SFTP contiene `host`, `port`, un `timeoutSeconds` opcional (una ventana de inactividad, por defecto 20), un `basePath`, un `hostKeyFingerprint` obligatorio y una credencial de contraseña. La clave del servidor se verifica antes de autenticar, y las credenciales son siempre explícitas: no se lee nada del entorno.

### Probar una conexión

La prueba por id escribe un archivo de sondeo en el almacenamiento y registra `VERIFIED` o `CONNECTION_ERROR`. Una credencial rechazada es la respuesta (`success: false`), no una excepción, y el archivo de sondeo nunca se borra. Es el único camino que cambia el estado.

Un formulario que no se ha guardado se puede probar con el proveedor y el secreto en claro. Esa prueba valida el secreto con el mismo analizador que un guardado, no escribe ningún registro y nunca devuelve el secreto. Requiere el permiso de crear o de actualizar. La prueba por id ignora los cambios de dirección o de proveedor que no se hayan guardado.

### Escribir un archivo

Un consumidor inyecta `TOOLS_FILE_STORAGE_WRITER` y llama a:

- `write(fileStorageId, { path, content, onConflict })`. El `path` es relativo a la raíz del almacenamiento y ya lo validó el llamante. `content` es un stream. `onConflict` es `'fail'` u `'overwrite'`, explícito en cada petición y sin valor por defecto. Una escritura queda completa o ausente bajo el nombre destino. El resultado es `{ path, providerRef? }`.
- `testConnection(fileStorageId)`.

Los fallos esperados se rechazan con `FileStorageError`, cuyo `code` es uno de `INVALID_SECRET`, `INVALID_CREDENTIALS`, `HOST_KEY_MISMATCH`, `CONNECTION_FAILED`, `WRITE_FAILED` o `TARGET_EXISTS`, y cuyo `kind` (`CONFIGURATION`, `TRANSPORT` o `CONFLICT`) se deduce del código. Los mensajes nunca contienen valores secretos, claves de servidor ni texto de la librería. Un id desconocido se rechaza con un error de no encontrado.

### Referenciar un almacenamiento

El consumidor declara `<name>FileStorageId` en el YAML de su módulo como relación many-to-one con `ToolsFileStorage`, con `avoidConstraint: false` y `onDelete: restrict`, de modo que la clave foránea es real. Borrar un almacenamiento en uso se rechaza con un error de conflicto (`tools.error.fileStorageInUse`): desvincúlalo antes. El contexto `tools` nunca nombra a sus consumidores.

## Cuándo aplica

- Un bounded context archiva o entrega un archivo generado en un servidor SFTP externo que configura un administrador.
- Quieres las credenciales de conexión en un único lugar cifrado, no en cada agregado.

## Compromisos y límites

- El catálogo es de solo escritura. No hay listado, lectura, descarga, operaciones de carpeta ni borrado de los archivos escritos. Para mostrar un archivo a un usuario, usa `storage-account` y su URL firmada: un servidor SFTP no puede dar una URL a un navegador.
- El adaptador nunca reintenta, porque un stream solo se puede leer una vez. Los reintentos corresponden al trabajo del llamante.
- Rotar el par de claves de la plataforma hace irrecuperables los secretos almacenados. Guardar un secreto nuevo lo arregla.
- La actualización masiva, la creación por lotes y el upsert generados se excluyen en este módulo: solo existe `updateById`. Un payload de cliente nunca puede fijar `status`.
- Asignar los permisos `tools.fileStorage.*` a los roles es manual. Un rol que edita un consumidor que enlaza un almacenamiento necesita `get`.

## Relacionado

- [Catálogo de buzones y puerto de lectura](../mailbox/) — el mismo patrón para el correo.
- [Ports entre bounded contexts](../cross-bounded-context-ports/)
