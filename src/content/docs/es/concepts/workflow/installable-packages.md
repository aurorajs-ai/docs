---
title: Paquetes instalables y actualizaciones del scaffold
description: Cómo los bounded contexts se distribuyen como paquetes descritos por un manifiesto, y cómo el lockfile del proyecto y la rama de proveedor aurora/scaffold permiten que catalyst add y catalyst upgrade los fusionen sin sobrescribir tus cambios.
---

## Por qué existe

Un proyecto Aurora parte de un scaffold y crece añadiendo bounded contexts que mantienen otros: identity, tools, automation, reporting. Los primeros instaladores copiaban archivos de forma imperativa. Divergían entre sí, no daban al proyecto ninguna vía para recibir correcciones posteriores y su opción `--force` sobrescribía las ediciones manuales.

Ahora los paquetes siguen un único modelo declarativo. Un solo manifiesto describe cada paquete, la CLI calcula todo lo demás, y quien decide de quién es una línea es Git, no la CLI.

## Cómo funciona

### El manifiesto

Cada paquete tiene un manifiesto escrito a mano, `cliter/packages/<package>.yaml`, en el monorepo de origen. Es la única declaración que leen el empaquetador y el instalador. Nombra las rutas de backend y frontend que se copian, los paquetes que `requires`, las dependencias npm fijadas, las claves `.env` que necesita y su contribución a la composición: módulos, agregados, relaciones, bridges, colas, rutas, navegación, widgets y enlaces de puertos. No admite hooks, scripts ni código, y un manifiesto con un campo desconocido falla la validación. La [referencia del manifiesto de paquete](../../../reference/package-manifest/) lista todas las claves.

Un paquete incluye solo sus propios bounded contexts y zonas compartidas, nunca archivos de otro bounded context. Una necesidad entre contextos pasa por un puerto y un adaptador en `@bridges`.

### El lockfile

`aurora.lock.yaml`, en la raíz del proyecto, es el único registro de lo que está instalado. Guarda los nombres de los paquetes instalados y la versión de la CLI que renderizó la punta de la rama de proveedor. No hay versión por paquete: la CLI, los paquetes del core y los paquetes del catálogo comparten una sola versión. Los comandos que necesitan el conjunto instalado se niegan a ejecutarse sin el lockfile.

### La rama de proveedor

`catalyst new` crea una rama llamada `aurora/scaffold`. Contiene lo que Aurora generaría para tu proyecto: el scaffold más todo el conjunto de paquetes instalados. Tanto `catalyst add` como `catalyst upgrade` funcionan igual:

1. Renderizan el scaffold de la CLI en ejecución más el conjunto de paquetes resultante en un directorio temporal. La instalación de dependencias, `backend/.env` y la salida del codegen de GraphQL no forman parte del renderizado, así que nunca entran en él.
2. Confirman ese renderizado en `aurora/scaffold`, como hijo de su punta, sin cambiar de rama ni tocar tu árbol de trabajo.
3. Ejecutan `git merge --no-edit aurora/scaffold` en la rama que tienes activa.

La fusión a tres bandas de Git, con el renderizado anterior como base, resuelve la propiedad. Un archivo que nunca cambiaste toma el contenido nuevo. Un archivo que cambiaste conserva tus ediciones y recibe solo el delta propio del renderizado. Un archivo que el renderizado eliminó y que nunca tocaste se borra. Donde tú y el renderizado cambiasteis las mismas líneas, la fusión se detiene con conflictos, que resuelves como cualquier otro.

### Archivos de composición

Los archivos que conectan los paquetes entre sí (el módulo de la aplicación, el módulo de bridges, el agregador del esquema Drizzle, las rutas, la navegación) se generan completos a partir de los manifiestos del conjunto instalado, y llevan la cabecera `@aurora-catalyst-generated`. Tu propio cableado va en dos archivos que son tuyos, `backend/src/project.composition.ts` y `frontend/src/app/project.composition.ts`. Los archivos de composición generados los importan y los extienden después de las entradas de los paquetes, de modo que una instalación nunca reescribe lo que pones ahí. `catalyst generate` registra tus propios bounded contexts en estos archivos.

### Qué más hace una actualización

`catalyst upgrade` migra primero los archivos de definición de módulo: renombra cada `<module>.aurora.yaml` a `<module>.module.yaml` con `git mv`, reescribe las dos líneas generadas que nombran el archivo antiguo y confirma solo eso, antes de la fusión. Después renderiza y fusiona como se ha descrito. Los paquetes instalados se actualizan junto con el scaffold. Los paquetes npm del framework se actualizan mediante npm.

### Tras la fusión

Cuando la fusión no tiene conflictos, la CLI instala las dependencias, añade las claves de `backend/.env` que tienen un valor por defecto declarado y faltan (un valor existente nunca se cambia), regenera los tipos de GraphQL y el índice de reglas de negocio, e imprime lo que queda: las claves obligatorias que aún faltan y `pnpm db:generate --name <package>` por cada paquete cuyo backend cambió. Un paquete que incluye reglas de negocio copia con él los archivos `.md` y el índice se regenera a partir de los archivos del disco, de modo que el índice pertenece a tu proyecto y nunca se distribuye. La CLI nunca genera ni aplica una migración de esquema por ti.

## Cuándo aplica

- Añades un bounded context con `catalyst add`, o llevas un proyecto a una CLI más reciente con `catalyst upgrade`.
- Una fusión informa de conflictos en un archivo que personalizaste.
- Te preguntas por qué cambió un archivo de composición generado y se perdieron tus ediciones en él: esos archivos pertenecen a los manifiestos, y tu cableado pertenece a los archivos `project.composition.ts`.

## Compromisos y límites

- Una sola versión para todo: no puedes retener un paquete mientras actualizas el resto.
- `catalyst add` se niega a ejecutarse cuando la versión de la CLI difiere de la del lockfile. Ejecuta antes `catalyst upgrade`. `catalyst upgrade` se niega cuando falta `aurora/scaffold`, o cuando un archivo rastreado tiene cambios en el área de preparación o sin preparar: haz commit o guárdalos antes.
- Las migraciones de esquema las generas tú después de la fusión, y nunca se ejecutan automáticamente.
- La rama de proveedor vive en el clon que ejecutó `catalyst new` hasta que la subes. Tras cada actualización, sube `aurora/scaffold` junto con tu rama. Un clon nuevo la obtiene con `git fetch origin aurora/scaffold:aurora/scaffold`.
- Un proyecto creado antes de que existiera el lockfile hay que adoptarlo a mano primero. El README de la CLI describe los dos caminos de adopción.

## Relacionado

- [Guía: Instalar y actualizar paquetes](../../../guides/workflow/install-and-upgrade-packages/)
- [Referencia: Manifiesto de paquete](../../../reference/package-manifest/)
- [Referencia de la CLI: add](../../../reference/cli-commands/add/) y [upgrade](../../../reference/cli-commands/upgrade/)
- [Scaffolding de un módulo](../../backend/module-scaffolding/)
