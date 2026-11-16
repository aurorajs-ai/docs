---
title: Instalar y actualizar paquetes
description: Añade un paquete a un proyecto con catalyst add, actualiza el scaffold y todos los paquetes instalados con catalyst upgrade, resuelve conflictos, genera la migración y mantén subida la rama de proveedor.
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

### Actualizar el proyecto

1. **Ejecuta la actualización.**

   ```bash
   catalyst upgrade
   ```

   Se niega a continuar cuando falta el lockfile, cuando `aurora/scaffold` no existe o cuando hay archivos rastreados modificados. Renombra cualquier `<module>.aurora.yaml` a `<module>.module.yaml` en su propio commit, y después renderiza el scaffold y cada paquete bloqueado y los fusiona.

2. **Resuelve los conflictos y ejecuta los pasos posteriores a la fusión**, como arriba. La actualización también imprime los comandos `pnpm db:generate --name <package>` de los paquetes cuyo backend cambió.

3. **Sube la rama de proveedor junto con tu rama.**

   ```bash
   git push origin aurora/scaffold
   ```

   Súbela tras cada actualización o instalación. Un clon nuevo la obtiene con `git fetch origin aurora/scaffold:aurora/scaffold`.

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
- **Desapareció una edición en un archivo de composición generado.** Esos archivos se generan completos a partir de los manifiestos. Mueve tu cableado a `backend/src/project.composition.ts` o a `frontend/src/app/project.composition.ts`.

## Relacionado

- [Concepto: Paquetes instalables y actualizaciones del scaffold](../../../concepts/workflow/installable-packages/)
- [Referencia: Manifiesto de paquete](../../../reference/package-manifest/)
- [Referencia de la CLI: add](../../../reference/cli-commands/add/), [upgrade](../../../reference/cli-commands/upgrade/)
