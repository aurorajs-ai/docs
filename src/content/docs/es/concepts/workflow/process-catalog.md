---
title: Catálogo de procesos
description: Cómo cada bounded context declara sus procesos de negocio en processes.yaml como caminos ordenados sobre pantallas, en qué se diferencia de las reglas, las especificaciones y el manual, y cómo se valida el catálogo.
---

## Por qué existe

Un PRD describe los flujos que un producto debería soportar, pero nadie lo mantiene una vez que el código se entrega. Una especificación describe una capacidad, mientras que un proceso de negocio cruza varias pantallas: para planificar una campaña, el usuario la crea en una pantalla y asigna sus líneas en otra. Las reglas de negocio enuncian leyes, y el manual explica los clics. Nada era dueño de la pregunta "qué objetivos permite alcanzar este bounded context a un usuario, sobre qué pantallas y en qué orden".

El catálogo de procesos es ese dueño. Es un archivo breve y validado por bounded context que nombra los objetivos y las pantallas que conducen a ellos, y nada más.

## Cómo funciona

### Qué es un proceso

Un **proceso** es el conjunto ordenado de acciones que lleva al negocio a un estado con valor propio, por ejemplo dar acceso a una persona: opcionalmente preparar un rol, opcionalmente crear un tenant y, por último, crear la cuenta. Una **acción** es una operación del sistema y solo tiene valor como parte de un proceso.

Lo que separa un proceso de una acción es el fin de negocio, no el número de pantallas. Un estado es un fin de negocio cuando supera tres pruebas:

- Se lee como un estado alcanzado ("un proveedor queda dado de alta"), no como una actividad ("rellenar la ficha del proveedor").
- Alguien del negocio lo pide por su nombre, sin nombrar pantallas ni botones.
- El trabajo puede detenerse ahí: no hace falta ninguna acción más para recoger el valor. Un rol sin cuenta no pasa la prueba, porque solo sirve a la siguiente acción.

El trabajo que el sistema hace sin una persona no es un paso. Si tiene una parte humana (alguien lo configura, lo supervisa o recibe su resultado), entra por esa parte. Si solo cambia datos que el usuario ve, es una frase en un capítulo del manual. Si no tiene efecto visible, no está en el catálogo.

### El archivo

`cliter/<bc>/processes.yaml` tiene una única clave de primer nivel, `processes`. Cada proceso tiene exactamente cinco claves, y cada paso tiene `screen` y, opcionalmente, `optional: true`.

```yaml
processes:
  - id: grant-access
    goal: Una persona entra en la aplicación y solo ve lo que su rol permite.
    steps:
      - { screen: iam.role, optional: true }
      - { screen: iam.tenant, optional: true }
      - { screen: iam.account }
    rules: [BR-IAM-ROLE-004, BR-IAM-ACCOUNT-007]
    status: active
```

- `id` es kebab-case en inglés, único dentro del bounded context y citado desde fuera como `<bc>.<id>`. Nunca cambia, y el id de un proceso retirado no se reutiliza.
- `goal` es una frase en español, el idioma de las reglas de negocio. Los identificadores siguen en inglés y el contenido en español a propósito.
- `steps` es una lista ordenada no vacía. `screen` es `<bc>.<module>`. Un paso nombra solo una pantalla: no se enlaza con una operación.
- `rules` lista los ids de las reglas de negocio que limitan el camino, posiblemente ninguna.
- `status` es `planned` (decidido en un PRD, sin entregar), `active` (entregado, narrado por el manual) o `retired` (ya no existe, se conserva para que su id no se reutilice).

### Un dueño por pregunta

| Pregunta | Dueño |
| --- | --- |
| Qué objetivos existen, sobre qué pantallas, en qué orden | `processes.yaml` |
| Cómo lo hace el usuario: campos, botones, capturas | El manual |
| Una ley que lo limita: una condición, un límite, una cascada | Una regla de negocio |
| Por qué el código tiene esta forma | `CONTEXT.md`, solo prosa para desarrolladores |

Un proceso cita reglas por id, y una regla nunca cita un proceso, porque las referencias en ambos sentidos se desincronizan. Una frase que empieza por "si", "no puede", "solo cuando" o "como máximo" es una regla, nunca una rama del proceso.

### Validación

`pnpm processes:validate` comprueba el esquema, que los ids sean únicos, que cada proceso `active` use pantallas que existan en el árbol de navegación y que cada id de regla citado exista en el índice de reglas de negocio. Un proceso `active` no puede citar una regla derogada. Un proceso `planned` o `retired` conserva la forma `<bc>.<module>`, pero sus pantallas no tienen por qué existir.

El manual cierra el círculo. Cada proceso `active` debe estar narrado por exactamente una sección del manual por idioma, marcada con `<!-- process: <id> -->`, y `pnpm manual:compile` falla si no es así. Consulta [El manual de usuario integrado](../../frontend/in-app-user-manual/).

## Cuándo aplica

- Un diff añade o elimina una pantalla que cruza un camino de usuario, cambia el orden en que se llega a las pantallas, o vuelve un paso opcional u obligatorio: el catálogo cambia.
- Un diff cambia una etiqueta, una columna, un mensaje de validación o el comportamiento dentro de una pantalla sin cambiar el camino: no cambia.
- Un PRD introduce un flujo: entra como proceso `planned` y pasa a `active` en la pull request que lo entrega.

## Compromisos y límites

- El catálogo contiene solo identificadores. Su narrativa vive en el manual, y la prosa para desarrolladores en `CONTEXT.md`.
- No existe un estado `proposed`: la aprobación es la pull request que cambia el archivo.
- El catálogo no es una entrada del asistente de ayuda, que lee el manual.
- No merece la pena listar un proceso antes de que exista, o esté decidido, un fin de negocio. No listes de antemano todos los flujos imaginables.

## Relacionado

- [Guía: Mantener el catálogo de procesos](../../../guides/workflow/maintain-processes/)
- [Sistema de business rules](../business-rules-overview/)
- [El manual de usuario integrado](../../frontend/in-app-user-manual/)
