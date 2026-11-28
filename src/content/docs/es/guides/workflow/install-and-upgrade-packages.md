---
title: Instalar y actualizar paquetes
description: Añade un paquete a un proyecto con catalyst add, instala una framework solution desde su repositorio, actualiza el scaffold y todos los paquetes instalados con catalyst upgrade, resuelve conflictos, genera la migración y mantén subida la rama de proveedor.
---

## Objetivo

Añadir un paquete Aurora a un proyecto existente, o llevar el proyecto a las versiones de scaffold y de paquetes de la CLI que ejecutas, sin perder tus propias ediciones.

## Antes de empezar

- El proyecto se creó con `catalyst new`, así que tiene `aurora.lock.yaml` y la rama `aurora/scaffold`. `git` está en el `PATH`.
- Estás en la raíz del proyecto, en la rama que debe recibir el cambio.
- Para `catalyst upgrade`, los archivos rastreados no tienen cambios preparados ni sin preparar (los archivos sin rastrear no cuentan). Haz commit o guárdalos antes.

## Pasos

### Añadir un paquete

1. **Ejecuta el comando.** Pasa el nombre del paquete, u omítelo para elegir de una lista.

   ```bash
   catalyst add tools
   ```

   La CLI lee los paquetes instalados del lockfile, resuelve los `requires` del paquete de forma transitiva e imprime el plan: el paquete solicitado y cada paquete que añade como requisito. No pregunta nada; después renderiza y fusiona en tu rama. Un paquete que ya está instalado no hace nada.

2. **Resuelve los conflictos, si los hay.** La fusión se detiene cuando tú y el renderizado cambiasteis las mismas líneas. El comando termina con código distinto de cero, lista los archivos en conflicto y nombra los pasos que debes ejecutar después. Corrige las marcas, haz `git add` y `git commit`, y ejecuta esos pasos tú mismo. Para descartar la operación: `git merge --abort`.

3. **Genera la migración.** La CLI nunca genera ni aplica una. Por cada paquete cuyo backend cambió imprime el comando:

   ```bash
   pnpm db:generate --name tools
   ```

   Revisa la migración generada antes de aplicarla. Consulta [Gestionar migraciones de esquema con drizzle-kit](../../backend/manage-schema-migrations/).

4. **Define las claves obligatorias.** La CLI añade las claves de `backend/.env` que faltan y tienen un valor por defecto declarado, e imprime las claves obligatorias que no tienen ninguno, para que las definas tú.

### Instalar una framework solution desde su repositorio

Una framework solution como `business-partner-portal` no viene en la CLI: vive en su propio repositorio git privado, etiquetado con la versión de la CLI. Pide a quien la mantiene la URL del repositorio (el `repository` del manifiesto del paquete).

1. **Ejecuta el comando con la URL.** El nombre del paquete es obligatorio.

   ```bash
   catalyst add business-partner-portal --from <repository-url>
   ```

   La CLI clona el repositorio en la etiqueta igual al `cliVersion` de `aurora.lock.yaml`, con tus propias credenciales de git, y lo renderiza junto con los paquetes que incluye la CLI. Si la descarga falla o falta la etiqueta, el comando se detiene antes de escribir nada.

2. **Continúa como con cualquier paquete.** Resuelve los conflictos, genera la migración y define las claves, como en "Añadir un paquete".

El lockfile guarda ahora `{ name, source }` para el paquete, y `blueprint/packages/<package>.yaml` guarda su manifiesto. No edites ese archivo: el siguiente renderizado lo reescribe.

### Actualizar el proyecto

1. **Ejecuta la actualización.**

   ```bash
   catalyst upgrade
   ```

   Se niega a continuar cuando falta el lockfile, cuando `aurora/scaffold` no existe o cuando hay archivos rastreados modificados. Renderiza el scaffold y cada paquete bloqueado y los fusiona. Descarga de nuevo cada framework solution desde su `source` en la etiqueta igual a la versión de la CLI, así que cada repositorio debe ser accesible con tus credenciales de git y tener esa etiqueta; si no, la actualización se detiene antes de cambiar nada y nombra la entrada, la URL y la etiqueta.

2. **Resuelve los conflictos y ejecuta los pasos posteriores a la fusión**, como arriba. La actualización también imprime los comandos `pnpm db:generate --name <package>` de los paquetes cuyo backend cambió.

3. **Sube la rama de proveedor junto con tu rama.**

   ```bash
   git push origin aurora/scaffold
   ```

   Súbela tras cada actualización o instalación. Un clon nuevo la obtiene con `git fetch origin aurora/scaffold:aurora/scaffold`.

### Relacionar un módulo con un bounded context de un paquete

Desde la CLI 5.2.0 el render escribe en `blueprint/<bc>/` los `*.module.yaml` de cada paquete instalado. Un proyecto instalado con una CLI anterior todavía no los tiene.

1. **Actualiza a la CLI 5.2.0 o posterior.** Ejecuta `catalyst upgrade` como arriba. La fusión añade `blueprint/<bc>/*.module.yaml` de cada paquete del lockfile.
2. **Declara la relación** en tu módulo, apuntando `modulePath` al bounded context del paquete (por ejemplo `iam/account`; consulta la [referencia del YAML de módulo](../../../reference/module-yaml/#claves-de-relación)).
3. **Genera el módulo** con `catalyst generate`. El destino ya se resuelve.

### Migrar un paquete que la CLI ya no incluye

Dos paquetes salieron de la CLI. Ambas migraciones se hacen una sola vez y a mano, y el README de la CLI contiene los procedimientos completos («Install a framework solution from its repository» y «Leave a package the CLI no longer ships»). Así es cada una:

- **`business-partner-portal` bloqueado por nombre simple.** `catalyst upgrade` rechaza el nombre simple, y `catalyst add --from` se niega porque el `cliVersion` del lockfile difiere de la CLI en ejecución, así que edita el lockfile a mano una vez. En un `main` limpio y con `aurora/scaffold` presente, sustituye `- business-partner-portal` por `- name: business-partner-portal` más `source: <repository-url>`, haz commit y ejecuta `catalyst upgrade`.
- **`production-planning`.** Ahora es una solución de cliente: su código pertenece al proyecto del cliente. Quítalo de `aurora.lock.yaml`, ejecuta `catalyst upgrade`, restaura los archivos que la fusión borró con `git checkout ORIG_HEAD -- <paths>` y registra su bounded context a mano en los dos `project.composition.ts`. Antes de actualizar, copia al proyecto lo que el monorepo tenga de él y el proyecto no, como sus archivos `*.module.yaml`.

### Deshacer o restaurar

- **Restaurar un archivo a su renderizado original:** `git checkout aurora/scaffold -- <path>`.
- **Deshacer una instalación o actualización con conflictos:** `git merge --abort`.
- **Deshacer una ya completada:** `git reset --hard ORIG_HEAD`. Cuando la actualización creó el commit de renombrado, este queda antes de la fusión: tras ese reset, `git reset --hard HEAD~1` lo deshace también.

## Verifica que funciona

- `aurora.lock.yaml` lista el paquete, y la versión de la CLI coincide con la que ejecutaste.
- Los módulos del paquete aparecen en los archivos de composición generados, y tu propio cableado en los archivos `project.composition.ts` está intacto.
- El backend y el frontend compilan, y la migración del paquete está generada y revisada.

## Solución de problemas

- **`catalyst add` dice que la versión de la CLI difiere de la del lockfile.** Ejecuta antes `catalyst upgrade`: `add` renderiza paquetes solo en la versión del lockfile.
- **La CLI dice que no encuentra `aurora.lock.yaml`.** El proyecto es anterior al lockfile. Adóptalo primero a mano: el README de la CLI describe dos caminos.
- **Falló un paso posterior a la fusión, por ejemplo la instalación sin red.** El comando se detiene con código distinto de cero tras el commit de fusión, nombra el paso fallido y los que no se ejecutaron, e imprime las claves `.env` pendientes. Una nueva ejecución encuentra el paquete ya instalado, así que ejecuta tú los pasos indicados.
- **`catalyst add --from` o `catalyst upgrade` se detiene al descargar.** El repositorio no es accesible con tus credenciales de git, o no tiene una etiqueta igual a la versión de la CLI. El mensaje nombra la entrada, la URL y la etiqueta. Arregla el acceso, o pide a quien la mantiene que publique la etiqueta, y vuelve a ejecutar: no se escribió nada.
- **`catalyst add --from` rechaza el nombre del paquete.** El nombre es uno de los que incluye la CLI, o la CLI en ejecución difiere del `cliVersion` del lockfile. En el segundo caso ejecuta antes `catalyst upgrade`.
- **Desapareció una edición en un archivo de composición generado.** Esos archivos se generan completos a partir de los manifiestos. Mueve tu cableado a `backend/src/project.composition.ts` o a `frontend/src/app/project.composition.ts`.
- **`catalyst generate` falla con `relationship.modulePath "iam/account" does not name an existing schema`.** Al proyecto le falta el YAML de ese bounded context del paquete. Comprueba que el paquete está en `aurora.lock.yaml` y ejecuta `catalyst upgrade` con la CLI 5.2.0 o posterior. Si ningún paquete instalado aporta el destino, el error es correcto: añade el paquete o escribe el módulo.

## Relacionado

- [Concepto: Paquetes instalables y actualizaciones del scaffold](../../../concepts/workflow/installable-packages/)
- [Referencia: Manifiesto de paquete](../../../reference/package-manifest/)
- [Referencia de la CLI: add](../../../reference/cli-commands/add/), [upgrade](../../../reference/cli-commands/upgrade/)
