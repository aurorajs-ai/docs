---
title: Mantener el catálogo de procesos
description: Inicia el catálogo de procesos de un bounded context, añade o cambia un proceso, márcalo en el manual y valida el resultado con los comandos y scripts que incluye el proyecto.
---

## Objetivo

Mantener `blueprint/<bc>/processes.yaml` fiel a lo que el bounded context permite hacer a un usuario, y lograr que el manual narre todos los procesos activos.

## Antes de empezar

- Sabes qué es un proceso y en qué se diferencia de una regla y de un capítulo del manual. Lee primero [Catálogo de procesos](../../../concepts/workflow/process-catalog/).
- Las pantallas que cruza un proceso existen en el árbol de navegación del bounded context.
- Las reglas de negocio que cita un proceso existen en el índice de reglas. Un proceso nunca cita una regla derogada.

## Pasos

1. **Inicia un bounded context que no tiene catálogo.** En Claude Code, ejecuta `/processes:document <bc>`. Lee el árbol de navegación, los capítulos del manual, los PRD del dossier, `CONTEXT.md` y las reglas de negocio, redacta el catálogo y migra la prosa de flujos de `CONTEXT.md`. Una ejecución por bounded context, una pull request por bounded context.

2. **Añade o cambia un proceso a mano.** Edita `blueprint/<bc>/processes.yaml`:

   ```yaml
   processes:
     - id: grant-access
       goal: Una persona entra en la aplicación y solo ve lo que su rol permite.
       steps:
         - { screen: iam.role, optional: true }
         - { screen: iam.account }
       rules: [BR-IAM-ROLE-004]
       status: planned
   ```

   Usa un `id` en inglés con kebab-case, un `goal` de una frase en español, pasos ordenados sobre pantallas `<bc>.<module>` y solo los ids de reglas que limitan el camino. Una condición o una rama va en una regla, nunca en un paso.

3. **Pasa un proceso a `active` cuando se entregue.** En la pull request que lo entrega, cambia `status` a `active` y añade el marcador al manual, en el mismo cambio:

   ```markdown
   ## Dar acceso a una persona

   <!-- process: grant-access -->
   ```

   El marcador va en el H2 del capítulo del primer paso obligatorio del proceso, en cada idioma que documente el bounded context. Consulta [Escribir un capítulo del manual](../../frontend/write-a-manual-chapter/).

4. **Retira un proceso en lugar de borrarlo.** Establece `status: retired` y conserva la entrada para que su id no se reutilice. Un proceso retirado no debe tener marcador en el manual.

5. **Valida.** Desde la raíz del proyecto:

   ```bash
   pnpm processes:validate
   pnpm manual:compile
   ```

6. **Comprueba un cambio contra el catálogo.** En Claude Code, `/processes:check` valida el árbol de trabajo, `/processes:check --branch <name>` una rama contra `main` y `/processes:check --pr <number>` una pull request. Informa `sin cambios` o los ids que actualizó.

## Verifica que funciona

- `pnpm processes:validate` y `pnpm manual:compile` pasan los dos.
- Cada proceso `active` tiene exactamente un marcador por idioma de su bounded context.
- Un bounded context con procesos activos y sin carpeta de manual solo produce un aviso, que lista esos procesos.

## Solución de problemas

- **Se informa de una pantalla desconocida.** Un proceso `active` solo puede usar pantallas que existan como `/<bc>/<module>` en el árbol de navegación. Corrige el nombre o la entrada de navegación, o mantén el proceso en `planned`.
- **Se informa de un id de regla desconocido o derogado.** El id debe existir en el índice de reglas de negocio, y un proceso `active` no puede citar una regla derogada.
- **La compilación informa de un marcador ausente o sobrante.** Cada proceso `active` necesita un marcador por idioma, y un marcador solo puede nombrar un proceso `active` del catálogo.
- **Se rechaza una clave.** El esquema solo admite `id`, `goal`, `steps`, `rules` y `status`, y `screen` y `optional` en un paso.

## Relacionado

- [Concepto: Catálogo de procesos](../../../concepts/workflow/process-catalog/)
- [Guía: Mantener el catálogo de business rules](../maintain-business-rules/)
