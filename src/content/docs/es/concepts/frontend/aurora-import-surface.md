---
title: La superficie de importación de @aurora
description: Por qué la capa de framework del frontend se importa mediante alias de sub-barrel explícitos, por qué el código de carga inmediata nunca debe usar el barrel raíz y qué protege el presupuesto del payload inicial.
---

## Por qué existe

El alias raíz `@aurora` reexporta todos los grupos de la capa de framework, incluidas clases de componentes Angular que el build no puede eliminar por tree-shaking. Cualquier archivo que importe de él arrastra esos componentes al chunk que contiene el archivo. En código de carga diferida (lazy) es inofensivo, porque el coste se paga cuando se carga la ruta. En código alcanzable desde el arranque de la aplicación lo paga cada usuario en la primera carga: el bundle inicial llegó a 1,93 MB antes de acotar la superficie.

La solución no es una convención que alguien deba recordar. La hace cumplir el compilador: la tabla de alias declara cada superficie pública una por una, y una ruta que no está declarada no se resuelve.

## Cómo funciona

`frontend/tsconfig.json` declara **un alias explícito por superficie pública** y ningún comodín `@aurora/*`. Cada alias apunta al `index.ts` de esa superficie, o a un único archivo cuando la superficie es exactamente ese archivo.

| Tipo | Alias |
| --- | --- |
| Grupos | `@aurora/components`, `@aurora/composables`, `@aurora/directives`, `@aurora/lib`, `@aurora/pipes`, `@aurora/query-dsl`, `@aurora/types`, `@aurora/validators` |
| Módulos del framework | `@aurora/modules/<name>` para `assisted-form`, `authentication`, `command-palette`, `dashboard`, `graphql`, `guided-action`, `health`, `lang`, `manual`, `report-viewer`, `session`, `theme` y `widget` |
| Algunas superficies estrechas | por ejemplo `@aurora/components/chart` y `@aurora/components/pdf-viewer` |

De ahí se siguen tres consecuencias:

- Un import que nombra un archivo de implementación, como `@aurora/components/data-table/cells/boolean-cell.component`, no coincide con ningún alias y falla al compilar con `TS2307` (no se encuentra el módulo).
- `@aurora/modules` como conjunto no es un alias, así que nadie puede arrastrar todos los módulos con un solo especificador.
- `@aurora` sigue resolviéndose y sigue reexportándolo todo. El código lazy puede seguir usándolo.

### Qué cuenta como código de carga inmediata

Es todo lo que la aplicación alcanza desde el arranque sin un `import()` dinámico: la configuración de la aplicación, las rutas raíz, el provider de Aurora, el agregador de providers de widgets y los registros de widgets de cada bounded context. Estos archivos deben importar los símbolos del framework desde sub-barrels declarados, nunca desde el barrel raíz. Lo mismo vale para el adaptador de cuenta actual de IAM: se importa desde su propio sub-barrel pequeño, porque importarlo desde el barrel del módulo arrastra los componentes del módulo al grafo de carga inmediata.

### La regla

La regla de harness `HR-BARRELS-005` (activa; sustituye a las derogadas `HR-BARRELS-001`, `-003` y `-004`) establece que un activo de un módulo se importa a través de un barrel, el propio del módulo o un sub-barrel público de superficie estrecha, nunca mediante una ruta profunda a un archivo de implementación. Un `import()` dinámico con destino literal, como el de una ruta lazy, está exento, porque es el límite de chunk que la regla protege. Si el activo que necesitas no está expuesto, añádelo al `index.ts` adecuado en lugar de acudir al archivo.

### El presupuesto

`frontend/angular.json` define un presupuesto `initial`, ahora mismo con aviso a 1,6 MB y error a 2 MB. Lee la cifra *raw* de la línea `Initial total` de un build de producción, la primera de sus dos columnas.

## Cuándo aplica

- Un build falla con `TS2307` en un `@aurora/<ruta>`: esa subruta no es una superficie declarada. Importa desde el barrel del grupo o del módulo, o añade el activo al barrel que debería exponerlo.
- Añades código a la configuración de la aplicación, a las rutas raíz o a un provider: importa desde sub-barrels.
- El `Initial total` crece tras un cambio: busca un archivo de carga inmediata que importe `@aurora`.

## Compromisos y límites

- Un build en verde no demuestra que un cambio de imports sea seguro. Un barrel que cierre un ciclo de dependencias puede romper la inyección de dependencias de Angular al arrancar, con un tipo de parámetro indefinido, mientras el build pasa. Carga la aplicación compilada en un navegador después de remodelar barrels.
- La tabla de alias se replica en la plantilla de aplicación mediante el packager, así que las aplicaciones generadas la heredan. Nunca edites la plantilla a mano.

## Relacionado

- [Composables: atoms y presets](../composables/)
- [Los cuatro artefactos de gobernanza](../../workflow/governance-artifacts/) — qué es una regla de harness y cómo se hace cumplir.
