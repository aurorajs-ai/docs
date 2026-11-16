---
title: Escribir un capítulo del manual
description: Crea el capítulo del manual de una pantalla, marca sus procesos, añade un recorrido de pantalla y compila el manual para comprobarlo.
---

## Objetivo

Documentar una pantalla de módulo para los usuarios finales, en un idioma, de modo que aparezca en el índice del manual, se abra desde el panel de ayuda y la encuentre la búsqueda.

## Antes de empezar

- La pantalla existe en el árbol de navegación (`frontend/src/app/domains/admin/apps/<bc>/<bc>.navigation.ts`) y conoces su ruta, por ejemplo `/iam/account`.
- Conoces el comportamiento real de la pantalla. Lee la carpeta frontend del módulo y sus etiquetas i18n, y ejecuta `pnpm manual:dossier <bc>` para listar la evidencia por módulo.
- Para el primer manual de un bounded context, `/manual:reconcile-prd` alinea el PRD con lo que se construyó y `/manual:write` redacta un capítulo por pantalla. Esta guía cubre los pasos manuales que hay detrás de ambos.

## Pasos

1. **Crea el archivo del capítulo.** Un archivo por pantalla e idioma: `cliter/<bc>/manual/<lang>/<module>.md`, con la ruta de la pantalla en el frontmatter.

   ```markdown
   ---
   route: /iam/account
   ---

   # Cuentas

   Una o dos frases: para qué sirve la pantalla y quién la usa.

   ## Crear una cuenta

   1. Pulsa **Nueva cuenta**.
   2. Rellena **Correo electrónico** y **Nombre de usuario**.
   3. Pulsa **Guardar**.

   La cuenta aparece en la lista.
   ```

   Usa un H1 y un H2 por cada tarea del usuario. Numera los pasos, una acción en cada uno, con la etiqueta en negrita exactamente como la muestra la pantalla, y termina con el resultado visible. Escribe en el idioma de la carpeta.

2. **Limítate a lo que ve el usuario.** Deja fuera nombres de campos, de tablas o de columnas, claves de permisos, variables de entorno, endpoints, códigos de error y los umbrales que una regla mantiene internos. Nombra un rol solo si el PRD lo nombra.

3. **Enlaza en lugar de repetir.** El comportamiento genérico de listados y formularios (búsqueda, filtro, columnas, guardar, cancelar, avisos) vive en los capítulos generales. Enlázalos: `[Listados](/manual/general.02-listados)`. Para apuntar a otra pantalla, enlaza su capítulo o su sección: `[cuentas](/manual/iam.account)` o `[crear una cuenta](/manual/iam.account#iam.account.crear-una-cuenta)`.

4. **Marca un proceso.** Si un proceso de `cliter/<bc>/processes.yaml` empieza en esta pantalla, narra el proceso en un H2 y pon el marcador en su propia línea, justo debajo del encabezado:

   ```markdown
   ## Dar acceso a una persona

   <!-- process: grant-access -->

   1. ...
   ```

   Si el proceso cruza varias pantallas, narra aquí toda la secuencia, en el capítulo de su primer paso obligatorio, y enlaza la sección de cada una de las otras pantallas. Los demás capítulos no llevan marcador para él.

5. **Opcionalmente, añade un recorrido de pantalla.** Solo para lo que es específico de esta pantalla. Crea `cliter/<bc>/manual/<lang>/tours/<module>.yaml`, con el mismo nombre que el archivo del capítulo:

   ```yaml
   steps:
     - { target: iam.account.main-action, title: Crear una cuenta, text: Pulsa aquí para añadir una cuenta nueva. }
   ```

   Cada paso tiene exactamente `target`, `title` y `text`. El `target` es el valor completo de un atributo `data-tour` que la plantilla de la pantalla ya incluye: los listados llevan `header`, `main-action`, `filter` y `table`, los formularios llevan `header` y `save`, cada uno con el prefijo `<bc>.<module>.`. No inventes destinos. Entrecomilla un `title` o un `text` que contenga `: `. Si todos los elementos de la pantalla son genéricos, no escribas archivo de recorrido.

6. **Opcionalmente, marca un ejemplo grabado.** Después de los pasos y del resultado de una tarea de varios pasos, añade `<!-- video: <slug> -->` en su propia línea y escribe el archivo de pasos `videos/<slug>.yaml`. Usa solo datos de demostración inventados, y consulta las notas de grabación en `scripts/manual/README.md` de tu proyecto.

7. **Compila.** Desde la raíz del proyecto:

   ```bash
   pnpm manual:compile
   ```

## Verifica que funciona

- La compilación termina sin errores. Falla, nombrando el archivo, ante una `route` ausente o desconocida, un enlace a un capítulo o sección que no existe, un recorrido sin su capítulo, un paso de recorrido con una clave que falta o sobra, un proceso `active` sin marcador en un idioma, un marcador duplicado y un marcador para un id que no es un proceso `active`.
- Ejecuta `pnpm dev`, abre la pantalla y pulsa la acción de ayuda de la cabecera del sitio: el panel se abre en tu capítulo.
- Busca en el panel de ayuda una palabra del capítulo: la sección aparece. Un usuario sin el permiso de la pantalla no la ve.

## Solución de problemas

- **`declares route "...", which no navigation item has`.** La `route` debe ser igual a una url del árbol de navegación. Cópiala del archivo `*.navigation.ts`.
- **El panel de ayuda se abre en otro capítulo.** El panel elige el capítulo cuya ruta es la coincidencia más larga con la dirección. Comprueba que ningún otro capítulo declara una ruta coincidente más larga.
- **Un paso del recorrido no hace nada en pantalla.** Un destino ausente en pantalla se omite al ejecutar. Revisa el valor de `data-tour` en la plantilla y que un permiso no esté ocultando el elemento.
- **Un aviso sobre un bounded context con procesos activos y sin manual.** Es un aviso, no un fallo, hasta que exista el primer capítulo.

## Relacionado

- [Concepto: El manual de usuario integrado](../../../concepts/frontend/in-app-user-manual/)
- [Concepto: Catálogo de procesos](../../../concepts/workflow/process-catalog/)
- [Concepto: Acciones guiadas y formularios asistidos](../../../concepts/frontend/guided-actions/)
