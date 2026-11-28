---
title: Paquetes instalables y actualizaciones del scaffold
description: Cómo los bounded contexts se distribuyen como paquetes descritos por un manifiesto, qué paquetes incluye la CLI y cuáles vienen de su propio repositorio, y cómo el lockfile del proyecto y la rama de proveedor aurora/scaffold permiten que catalyst add y catalyst upgrade los fusionen sin sobrescribir tus cambios.
---

## Por qué existe

Un proyecto Aurora parte de un scaffold y crece añadiendo bounded contexts que mantienen otros: identity, tools, automation, reporting. Los primeros instaladores copiaban archivos de forma imperativa. Divergían entre sí, no daban al proyecto ninguna vía para recibir correcciones posteriores y su opción `--force` sobrescribía las ediciones manuales.

Ahora los paquetes siguen un único modelo declarativo. Un solo manifiesto describe cada paquete, la CLI calcula todo lo demás, y quien decide de quién es una línea es Git, no la CLI.

## Cómo funciona

### El manifiesto

Cada paquete tiene un manifiesto escrito a mano, `blueprint/packages/<package>.yaml`, en el monorepo de origen. Es la única declaración que leen el empaquetador y el instalador. Nombra las rutas de backend y frontend que se copian, los paquetes que `requires`, las dependencias npm fijadas, las claves `.env` que necesita y su contribución a la composición: módulos, agregados, relaciones, bridges, colas, rutas, navegación, widgets y enlaces de puertos. No admite hooks, scripts ni código, y un manifiesto con un campo desconocido falla la validación. La [referencia del manifiesto de paquete](../../../reference/package-manifest/) lista todas las claves.

Un paquete incluye solo sus propios bounded contexts y zonas compartidas, nunca archivos de otro bounded context. Una necesidad entre contextos pasa por un puerto y un adaptador en `@bridges`.

### Tipos de paquete

Todo manifiesto declara un `kind` obligatorio, y ese tipo decide dónde se distribuye el paquete:

| Tipo | Dónde se distribuye | Quién lo mantiene | Cómo lo obtiene un proyecto |
| --- | --- | --- | --- |
| `framework` | El tarball público de la CLI | catalyst | `catalyst add <package>` |
| `framework-solution` | Su propio repositorio git privado, etiquetado con la versión de la CLI; nunca la CLI | catalyst, distribuido a varios clientes | `catalyst add <package> --from <repository-url>` |
| solución de cliente | El repositorio de su cliente; catalyst no tiene manifiesto para ella | el cliente | Es código propio del proyecto |

Quien mantiene el paquete decide el tipo con dos preguntas, en este orden:

1. ¿Algún paquete del framework lo necesita, por `requires` o por un puerto? Entonces es `framework`: un paquete del framework nunca depende de una solución.
2. Si no, ¿qué resuelve? Una capacidad independiente del sector es `framework`. Un proceso de negocio completo para un tipo de negocio es una solución: `framework-solution` cuando catalyst la mantiene y la distribuye a varios clientes, solución de cliente cuando la mantiene el cliente.

Que nadie lo requiera no convierte un paquete en solución: `dashboard`, `hub`, `reporting` y `authorization-code` son hojas y siguen siendo framework. Hoy `business-partner-portal` es la única framework solution; `production-planning` es una solución de cliente y ya no forma parte de catalyst.

El tarball público de la CLI incluye solo el scaffold, el harness y los paquetes del framework. No nombra ninguna solución ni ninguna URL privada, así que el repositorio lo aportas siempre tú.

### El lockfile

`aurora.lock.yaml`, en la raíz del proyecto, es el único registro de lo que está instalado. Guarda los paquetes instalados y la versión de la CLI que renderizó la punta de la rama de proveedor. Un paquete del framework es un nombre simple; una framework solution es una entrada `{ name, source }`, donde `source` es el repositorio del que viene. No hay versión por paquete: la CLI, los paquetes del core y los paquetes del catálogo comparten una sola versión. Los comandos que necesitan el conjunto instalado se niegan a ejecutarse sin el lockfile.

### La rama de proveedor

`catalyst new` crea una rama llamada `aurora/scaffold`. Contiene lo que Aurora generaría para tu proyecto: el scaffold más todo el conjunto de paquetes instalados. Tanto `catalyst add` como `catalyst upgrade` funcionan igual:

1. Renderizan el scaffold de la CLI en ejecución más el conjunto de paquetes resultante en un directorio temporal. La instalación de dependencias, `backend/.env` y la salida del codegen de GraphQL no forman parte del renderizado, así que nunca entran en él.
2. Confirman ese renderizado en `aurora/scaffold`, como hijo de su punta, sin cambiar de rama ni tocar tu árbol de trabajo.
3. Ejecutan `git merge --no-edit aurora/scaffold` en la rama que tienes activa.

La fusión a tres bandas de Git, con el renderizado anterior como base, resuelve la propiedad. Un archivo que nunca cambiaste toma el contenido nuevo. Un archivo que cambiaste conserva tus ediciones y recibe solo el delta propio del renderizado. Un archivo que el renderizado eliminó y que nunca tocaste se borra. Donde tú y el renderizado cambiasteis las mismas líneas, la fusión se detiene con conflictos, que resuelves como cualquier otro.

### Archivos de composición

Los archivos que conectan los paquetes entre sí (el módulo de la aplicación, el módulo de bridges, el agregador del esquema Drizzle, las rutas, la navegación) se generan completos a partir de los manifiestos del conjunto instalado, y llevan la cabecera `@aurora-catalyst-generated`. Tu propio cableado va en dos archivos que son tuyos, `backend/src/project.composition.ts` y `frontend/src/app/project.composition.ts`. Los archivos de composición generados los importan y los extienden después de las entradas de los paquetes, de modo que una instalación nunca reescribe lo que pones ahí. `catalyst generate` registra tus propios bounded contexts en estos archivos.

### Definiciones de módulo de los paquetes instalados

Cada paquete incluye también los archivos `*.module.yaml` de sus bounded contexts. El render los escribe en `blueprint/<bc>/` de tu proyecto, junto a tus propios módulos, y llegan por la misma fusión que cualquier archivo de paquete. Eso permite que un módulo tuyo se relacione con un bounded context de un paquete: con `identity` instalado, una relación many-to-one hacia `iam/account` se resuelve, porque `blueprint/iam/account.module.yaml` está en el proyecto. Antes de la CLI 5.2.0 un paquete no incluía definiciones de módulo, y `catalyst generate` fallaba con `relationship.modulePath "iam/account" does not name an existing schema`.

Una relación hacia un bounded context que ni tu proyecto ni un paquete instalado aportan sigue fallando con ese error, antes de escribir nada.

### Qué más hace una actualización

`catalyst upgrade` renderiza y fusiona como se ha descrito. Los paquetes instalados se actualizan junto con el scaffold, y también cada entrada `source`: `catalyst upgrade` vuelve a descargarla en la etiqueta igual a la versión de la CLI que ejecutas y la renderiza con los paquetes del framework como un único conjunto. Si el repositorio no es accesible o no tiene esa etiqueta, la actualización se detiene antes de escribir nada. Los paquetes npm del framework se actualizan mediante npm.

### Tras la fusión

Cuando la fusión no tiene conflictos, la CLI instala las dependencias, añade las claves de `backend/.env` que tienen un valor por defecto declarado y faltan (un valor existente nunca se cambia), regenera los tipos de GraphQL y el índice de reglas de negocio, e imprime lo que queda: las claves obligatorias que aún faltan y `pnpm db:generate --name <package>` por cada paquete cuyo backend cambió. Un paquete que incluye reglas de negocio copia con él los archivos `.md` y el índice se regenera a partir de los archivos del disco, de modo que el índice pertenece a tu proyecto y nunca se distribuye. La CLI nunca genera ni aplica una migración de esquema por ti.

### Una framework solution desde su repositorio

`catalyst add <package> --from <repository-url>` clona el repositorio en la etiqueta igual al `cliVersion` del lockfile, con tus propias credenciales de git, renderiza el paquete junto con los que incluye la CLI y lo registra como `{ name, source }`. También escribe el manifiesto del paquete en `blueprint/packages/<package>.yaml`, que cada renderizado reescribe: `catalyst generate` lo lee para saber qué bounded contexts posee el paquete sin acceder a la red. No edites ese archivo. El repositorio contiene exactamente un paquete y lleva una etiqueta por cada versión de la CLI.

## Cuándo aplica

- Añades un bounded context con `catalyst add`, o llevas un proyecto a una CLI más reciente con `catalyst upgrade`.
- Una fusión informa de conflictos en un archivo que personalizaste.
- Usas un paquete que no viene en la CLI, como `business-partner-portal`, y necesitas instalarlo o actualizarlo desde su repositorio.
- Te preguntas por qué cambió un archivo de composición generado y se perdieron tus ediciones en él: esos archivos pertenecen a los manifiestos, y tu cableado pertenece a los archivos `project.composition.ts`.

## Compromisos y límites

- Una sola versión para todo: no puedes retener un paquete mientras actualizas el resto. Una framework solution sigue la misma regla, así que su repositorio necesita una etiqueta por cada versión de la CLI a la que actualices.
- Una actualización depende de que cada repositorio `source` sea accesible con tus credenciales de git. Si alguno no lo es, la actualización se detiene en lugar de omitirlo.
- `catalyst add` se niega a ejecutarse cuando la versión de la CLI difiere de la del lockfile. Ejecuta antes `catalyst upgrade`. `catalyst upgrade` se niega cuando falta `aurora/scaffold`, o cuando un archivo rastreado tiene cambios en el área de preparación o sin preparar: haz commit o guárdalos antes.
- Las migraciones de esquema las generas tú después de la fusión, y nunca se ejecutan automáticamente.
- Los `*.module.yaml` incluidos son archivos del paquete, no tuyos. Ejecutar `catalyst generate` sobre un módulo de un paquete está permitido, pero `catalyst generate back` reescribe el YAML incluido, y `--force` sobrescribe el código del paquete sin `.origin` que revisar, porque no se incluye `.locks/`. Sin `--force`, los archivos existentes se omiten.
- La rama de proveedor vive en el clon que ejecutó `catalyst new` hasta que la subes. Tras cada actualización, sube `aurora/scaffold` junto con tu rama. Un clon nuevo la obtiene con `git fetch origin aurora/scaffold:aurora/scaffold`.
- Un proyecto creado antes de que existiera el lockfile hay que adoptarlo a mano primero. El README de la CLI describe los dos caminos de adopción.

## Relacionado

- [Guía: Instalar y actualizar paquetes](../../../guides/workflow/install-and-upgrade-packages/)
- [Referencia: Manifiesto de paquete](../../../reference/package-manifest/)
- [Referencia de la CLI: add](../../../reference/cli-commands/add/) y [upgrade](../../../reference/cli-commands/upgrade/)
- [Scaffolding de un módulo](../../backend/module-scaffolding/)
