---
title: El tablero con varios desarrolladores
description: Cómo funciona el tablero Backlog de un proyecto Catalyst cuando lo comparten dos o más desarrolladores — una persona por tarea, un roster, una identidad de máquina, sincronización del tablero en cada pasada y un grafo que solo escribe la CI.
---

## Por qué existe

Un proyecto creado con `catalyst new` incluye un tablero de tareas (Backlog.md) y un despachador, un proceso que toma tareas en `Queued` y las ejecuta sin que haya una persona delante. Con un solo desarrollador, el tablero vive en un único checkout. Con dos o tres, ocurren tres problemas si el diseño no los evita:

- Dos despachadores toman la misma tarea en `Queued`, porque el único bloqueo es un fichero local de cada máquina.
- El mantenimiento de una máquina cierra o reescribe una tarea que pertenece a otra persona.
- Un cambio del tablero confirmado en un clon nunca llega a los demás, así que un `Done` que debería liberar una tarea dependiente no lo ve nadie más.

El diseño elimina los tres con una sola regla: **cada tarea tiene una persona responsable y cada máquina actúa solo sobre sus propias tareas.**

## Cómo funciona

**El roster.** `.backlog/team.yaml` está versionado y es común. Lista a los desarrolladores del repositorio, cada uno con exactamente `id`, `name` y `email`. El assignee de una tarea es `@<id>`. Cualquier otra clave se rechaza, porque el fichero se commitea y un `token:` suelto sería un secreto en git. Un proyecto nuevo empieza con `developers: []`.

**La identidad de la máquina.** `.backlog/.dispatch/assignee` es local y está en `.gitignore`. Contiene el `id` sin arroba del desarrollador de esta máquina y vive en el checkout principal, de modo que una sesión dentro de un worktree lee el mismo fichero. Lo escribe `pnpm backlog:daemon install --assignee @<id>`. No se infiere nada de `git config` ni del usuario de GitHub: ambos cambian por motivos ajenos a quién es dueño del despachador de un checkout. Una identidad ausente, o un id que no está en el roster, es un error visible.

**Una tarea, un responsable.**

- El despachador selecciona solo tareas en `Queued` asignadas a esta máquina.
- Los pasos de mantenimiento que cierran una tarea mergeada, revierten un `Done` escrito a mano, bloquean un `In Progress` huérfano o recalculan una tarea padre actúan solo sobre tareas propias.
- La guarda que comprueba dependencias lee el tablero completo, así que una dependencia de un compañero sigue siendo visible. Una candidata que espera una dependencia sin terminar no bloquea la cola: la pasada prueba con la siguiente.

**Assignee obligatorio en dos transiciones.** Una tarea que entra en `Queued` sin assignee, con dos o con un id fuera del roster pasa a `Blocked` con un comentario que nombra la causa. El Task Gate interactivo asigna la tarea cuando la pone en `In Progress`, en una sola edición; si otra persona ya es su responsable, el asistente informa de quién es y pregunta antes de reasignarla.

**Sincronización del tablero.** Cada pasada empieza confirmando los cambios pendientes del tablero, haciendo fetch, rebasando `main` sobre `origin/main` y haciendo push, con un máximo de tres intentos si el push es rechazado. Un `Done` de un compañero llega así antes de que la guarda de dependencias lea el tablero, y la tarea que esperaba se lanza sola. La pasada exige `main` activa en el checkout principal y no usa autostash: un fichero versionado modificado allí detiene el despacho de forma visible hasta que lo limpies.

**El grafo de dependencias.** Una tarea con la etiqueta `board:graph` guarda la vista de dependencias abiertas. Solo la GitHub Action `.github/workflows/backlog-graph.yml` la escribe, en cada push a `main` que toca `.backlog/tasks/**`. Un único escritor mantiene su fichero libre de conflictos entre clones. Para ver la vista actual, usa `pnpm backlog:graph`, sin `--write`.

**Un daemon por repositorio.** En macOS, un agente `launchd` por repositorio, con la etiqueta `dev.aurora.backlog-dispatch.<repositorio>`, ejecuta el despachador. Dos repositorios en una máquina ejecutan dos agentes, cada uno con su bloqueo, sus slots y sus logs.

## Cuándo aplica

- Añades un segundo desarrollador a un proyecto.
- Una tarea tuya espera una dependencia que es de un compañero.
- Una tarea que encolaste termina en `Blocked` con un comentario sobre su assignee.
- El despacho se detiene e informa de un checkout principal con cambios o de un conflicto de rebase.

## Compromisos y límites

- **Si la máquina de un desarrollador está apagada**, su tarea mergeada no llega a `Done` y la tarea dependiente de un compañero sigue esperando. Ningún camino de código escribe una tarea por su responsable; el grafo muestra la espera y el compañero pregunta.
- **Latencia.** Un `Done` tarda hasta una pasada en cada lado en propagarse. Un cambio de estado lanza una pasada de inmediato en la máquina donde ocurre.
- **Sin protección de rama en `main`.** El harness impone un pull request para el código. Los commits del tablero, de los despachadores y de la Action del grafo, van por push directo, y una regla que exigiera pull requests los rechazaría todos. Quien sube código a `main` fuera del flujo asume ese riesgo.
- **Sin tope entre repositorios.** El límite de workers en paralelo es por repositorio, así que varios repositorios en una máquina multiplican los workers concurrentes.
- **Editar a mano la tarea de un compañero** puede provocar un conflicto en el rebase. La pasada aborta el rebase, nombra las rutas y no selecciona nada hasta que una persona lo resuelva.

## Relacionado

- [Guía: Incorporar a un desarrollador](../../../guides/workflow/onboard-developer/)
- [Referencia: Harness](../../../reference/harness/)
