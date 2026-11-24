---
title: El manual de usuario integrado
description: Cómo una aplicación Aurora incluye un manual para el usuario final escrito como un capítulo Markdown por pantalla e idioma, compilado en cada build, leído dentro de la aplicación, buscable según permisos y complementado con recorridos guiados.
---

## Por qué existe

Un manual que vive en un PDF o en una wiki se desincroniza de la aplicación que describe, y el usuario tiene que abandonar la pantalla para leerlo. El manual integrado mantiene el texto en el repositorio, junto al código de cada bounded context, lo compila en cada build y lo muestra en un panel de ayuda sobre la pantalla en la que está el usuario.

Está escrito para el **usuario final**, nunca para un desarrollador. Describe tareas, pasos y resultados visibles, con las etiquetas que muestra la pantalla, y deja fuera nombres de campos, claves de permisos, umbrales y códigos de error.

## Cómo funciona

### Fuentes

| Fuente | Ruta | Contenido |
| --- | --- | --- |
| Capítulo de pantalla | `blueprint/<bc>/manual/<lang>/<module>.md` | Un capítulo por pantalla de módulo e idioma. El frontmatter declara la `route` de la pantalla. |
| Capítulo general | `docs/manual/<lang>/*.md` | Comportamiento compartido por todos los listados y formularios generados, sin ruta. Se lista primero, por orden de nombre de archivo. |
| Recorrido | `blueprint/<bc>/manual/<lang>/tours/<chapter>.yaml` | Un recorrido guiado de una pantalla. |
| Pasos de vídeo | `blueprint/<bc>/manual/<lang>/videos/<slug>.yaml` | Un guion que graba un ejemplo en bucle. |
| Acciones guiadas | `blueprint/<bc>/actions.yaml` | Los botones que ofrecen el asistente y la paleta de comandos. Un archivo por bounded context, junto al YAML del módulo. |

Un capítulo tiene un H1 y un H2 por cada tarea del usuario. El texto del H2 se convierte en el id de la sección, así que renombrar un encabezado cambia el destino de los enlaces y de los resultados de búsqueda. El id de un capítulo es `<bc>.<module>` y un enlace a una sección es `/manual/<chapterId>#<chapterId>.<slug>`. El comportamiento genérico se escribe una sola vez en los capítulos generales, y los capítulos de pantalla los enlazan en lugar de repetirlo.

`catalyst new` incluye los capítulos generales (listados, formularios, el asistente), sus recorridos y sus vídeos, en inglés y en español. Los paquetes instalables incluyen sus capítulos, así que un paquete instalado aparece en el manual sin un menú mantenido a mano.

### Compilación

Cada build compila los capítulos, por idioma, en dos salidas derivadas: una con todas las secciones (id, ruta, permiso, ruta de navegación, título, HTML saneado, texto plano) y otra con el orden de lectura. Son salidas de build: nunca se editan a mano ni se versionan. Las genera `pnpm manual:compile`, y `pnpm dev` y el build del backend lo ejecutan por ti.

- Un capítulo cuya `route` falta, o que el árbol de navegación no contiene, hace fallar la compilación y nombra el archivo. El capítulo hereda su permiso del árbol de navegación, así que el manual no guarda una segunda copia.
- La compilación deriva cada ruta de navegación (el camino por el menú hasta una pantalla, como `Plataforma > IAM > Cuentas`) del árbol de navegación y de los archivos de traducción del frontend, en cada idioma. La escribe en cada sección y la imprime como una línea «Dónde está» al inicio de cada capítulo de pantalla, así que nunca escribes una ruta de menú a mano. Lo que el árbol no puede saber (una pestaña de la pantalla, un control del shell de la aplicación) se declara con un marcador `<!-- nav: clave[, clave] -->`, donde cada clave es una clave de traducción. Una clave sin texto en un idioma, o un elemento de navegación del camino sin traducción, hace fallar la compilación.
- El HTML se sanea una sola vez, al compilar.
- El orden de lectura sigue el árbol de navegación: primero los capítulos generales y después cada bounded context y módulo en el orden en que los muestra el menú.
- Cada proceso `active` del [catálogo de procesos](../../workflow/process-catalog/) debe estar narrado por exactamente una sección de capítulo por idioma, marcada con `<!-- process: <id> -->` en su propia línea. Si no, la compilación falla.
- Un enlace a un capítulo o sección que no existe hace fallar la compilación.

### Lectura

- La página `/manual` muestra el índice junto al capítulo seleccionado y su tabla de contenidos. El índice y el capítulo se desplazan de forma independiente, y cada capítulo que abre el usuario es una navegación del navegador, de modo que funcionan los botones de atrás y adelante.
- Una acción de ayuda en la cabecera del sitio abre un panel de ayuda sobre la pantalla actual. Se abre en el capítulo cuya ruta es la más larga que coincide con la dirección (`/iam/account/edit/<id>` abre el capítulo de `/iam/account`; `/iam/accounting` no). Si la pantalla no tiene capítulo, se abre con el cuadro de búsqueda enfocado. El panel ofrece el asistente de ayuda, descrito en [Acciones guiadas y formularios asistidos](../guided-actions/). El asistente recibe la ruta de navegación de cada sección que lee, y sus instrucciones fijas le piden indicarla, tal cual, cuando envía al usuario a una pantalla o a un control: responde «Plataforma > IAM > Cuentas», no solo «Cuentas».
- El menú de usuario ofrece una entrada "Manual de usuario". Ambas entradas aparecen solo cuando el índice del usuario tiene al menos un capítulo.
- El manual no tiene permiso propio. Un capítulo se lista, se muestra y se puede buscar solo si el usuario tiene el permiso de su pantalla.

### Búsqueda

El backend carga las secciones compiladas al arrancar y responde una búsqueda léxica, sin tabla de base de datos ni migración. Tolera las formas flexionadas de una palabra e ignora los acentos. Los resultados se ordenan por relevancia y nunca incluyen una sección cuya pantalla el usuario no puede abrir. Las búsquedas que un usuario envía y no devuelven nada, o cuyos resultados no reciben ningún clic, se registran con el texto, el idioma y la hora, pero nunca con la identidad del usuario. Las búsquedas incrementales de la paleta de comandos y las preguntas al asistente no se registran.

### Recorridos guiados

Una pantalla puede abrir un recorrido corto por sus elementos principales en la primera visita del usuario. El nombre del archivo de un recorrido es el nombre base de su capítulo, y un recorrido sin su capítulo hace fallar la compilación. Cada paso tiene un `target`, un `title` y un `text`. En un recorrido de bounded context, `target` es el valor completo de un atributo `data-tour` que la plantilla de la pantalla ya incluye. Las plantillas generadas llevan `header`, `main-action`, `filter` y `table` en los listados, y `header` y `save` en los formularios.

Los **recorridos generales** explican una vez cada listado y cada formulario. Viven en `docs/manual/<lang>/tours/`, declaran `screen: list` o `screen: form` y apuntan a roles simples (`header`, `help`, `main-action`, `filter`, `table`, `save`), de modo que un recorrido sirve para todas las pantallas generadas de su tipo.

Un recorrido se ejecuta una sola vez por usuario, en cualquier dispositivo: una pantalla lanza juntos el recorrido general y el suyo propio, y una pantalla posterior lanza solo el suyo. Un destino ausente en pantalla, por ejemplo oculto por un permiso, se omite. La sección "Recorridos guiados" del panel de ayuda lista los recorridos que aplican a la pantalla actual y repite el elegido desde su primer paso.

### Ejemplos grabados

Una tarea de varios pasos puede llevar un marcador `<!-- video: <slug> -->`. Un script graba el vídeo a partir de un archivo de pasos, nunca a mano, y el manual lo reproduce como un clip mudo y en bucle, sin reproductor. Grabar requiere el Chromium de Playwright, `ffmpeg` y `psql`.

## Cuándo aplica

- Escribes o actualizas el manual de un bounded context, o revisas un capítulo.
- El panel de ayuda se abre en el capítulo equivocado, o una búsqueda no encuentra nada: la ruta y el permiso del capítulo deciden ambas cosas.
- Te preguntas por qué falla el build después de marcar un proceso como `active`: la compilación exige su marcador.

## Compromisos y límites

- La búsqueda es léxica, no semántica.
- No es un PDF: el manual se lee dentro de la aplicación, con la sesión, el tema y el idioma del usuario.
- El catálogo de procesos no es una entrada del asistente. El asistente lee el manual.
- La ruta sale solo del manual compilado, nunca del navegador, y no se reconstruye al ejecutar. Tras cambiar la navegación o sus traducciones, vuelve a ejecutar `pnpm manual:compile`: un backend que lee una salida antigua, sin la ruta, falla en lugar de responder sin ella.
- Las etiquetas de los grupos del menú lateral (Proyectos, Plataforma) son una constante de la compilación que replica el componente del menú. Si cambias los grupos del menú, actualiza esa constante.

## Relacionado

- [Guía: Escribir un capítulo del manual](../../../guides/frontend/write-a-manual-chapter/)
- [Catálogo de procesos](../../workflow/process-catalog/)
- [Acciones guiadas y formularios asistidos](../guided-actions/)
