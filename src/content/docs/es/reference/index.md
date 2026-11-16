---
title: Referencia
description: Referencia técnica autogenerada de Aurora Catalyst.
---

La referencia está **orientada a la información**: exacta, completa, consultable rápido.

La mayor parte de esta sección se **autogenera** desde los repos de Aurora mediante el script `import-from-sources`. No edites las páginas autogeneradas a mano — se sobreescriben en el próximo `pnpm sync`.

## Qué vive aquí

- **Comandos del CLI** — cada `catalyst <comando>` con sus flags, args y ejemplos (generado por `oclif readme`).
- **Esquema YAML** — referencia completa de los campos de `<module>.module.yaml`: [Claves del YAML de módulo](./module-yaml/).
- **Lockfile** — estructura de `cliter/{bc}/.locks/{scope}/{module}.lock.json`, incluyendo el campo `regions`.
- **[Query Statement (Aurora Query DSL)](./query-statement/)** — el lenguaje `where`, `relations`, `order` y `aggregation` y sus reglas de seguridad.
- **[Referencia de campos personalizados](./custom-fields/)** — el flag `hasCustomFields`, el input `customFieldValues` y los tipos de definición.
- **[Manifiesto de paquete](./package-manifest/)** — todas las claves de `cliter/packages/<package>.yaml` y el catálogo de paquetes instalables.
- **[Claves de despliegue de aurora.yaml](./aurora-yaml-deployment/)** — la configuración de despliegue en Coolify, los destinos de copias de seguridad y las variables que lee la CLI.
- **[Referencia de composables](./frontend/composables/)** y **[Referencia del harness](./harness/)** — los composables del brain de frontend y el catálogo del harness.
- **[Glosario](./glossary/)** — los términos técnicos que se usan en toda la documentación.

## Qué NO vive aquí

- Tutoriales → [`/es/tutorials/`](../tutorials/)
- Guías → [`/es/guides/`](../guides/)
- Fondo conceptual → [`/es/concepts/`](../concepts/)
