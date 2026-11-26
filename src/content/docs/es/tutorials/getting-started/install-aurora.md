---
title: Instalar Aurora Catalyst
description: Genera un nuevo monorepo Catalyst y apunta su backend a una base de datos.
sidebar:
  order: 2
  hidden: true
---

Con el CLI ya instalado, este paso genera un nuevo proyecto Aurora Catalyst. El procedimiento es el mismo para cualquier app Catalyst — el rol que cumpla se decide más adelante, desde la configuración.

## 1. Genera el proyecto

```bash
catalyst new my-project
```

Esto crea un monorepo Aurora (un workspace `backend/` + `frontend/`) llamado `my-project`, instala sus dependencias, escribe `backend/.env` y genera el par de claves de firma OAuth en `backend/.keys/`. También hace commit del scaffold en una rama `aurora/scaffold`, que `catalyst add` y `catalyst upgrade` usan después como base de fusión. Mira [`catalyst new`](../../../reference/cli-commands/new/).

## 2. Crea una base de datos y establece la conexión

Crea una base de datos PostgreSQL vacía, abre `backend/.env` y apunta el bloque `DATABASE_*` a ella:

```dotenv
DATABASE_HOST = localhost
DATABASE_PORT = 5432
DATABASE_USER = postgres
DATABASE_PASSWORD = postgres
DATABASE_SCHEMA = my-project
```

`DATABASE_SCHEMA` es el nombre de la base de datos. Cada app Catalyst necesita su **propia** base de datos — si vas a levantar varias apps, dale a cada una la suya para que no choquen.

## 3. Entiende cómo se crean las tablas

El scaffold no incluye tablas ni migraciones. El esquema de la base de datos cambia solo mediante migraciones versionadas, y la primera se genera a partir de los archivos de esquema de los paquetes que instalas. La generas en el tutorial siguiente, con los comandos `pnpm db:generate --name <paquete>` que imprime `catalyst add`, y el backend la aplica cuando arranca.

:::note
Las migraciones se aplican al arrancar por defecto (`DATABASE_MIGRATE_ON_BOOT`). La guía [Gestionar las migraciones de esquema](../../../guides/backend/manage-schema-migrations/) cubre el ciclo completo y cuándo desactivarlo.
:::

## Siguiente

Tu proyecto está generado y conectado a una base de datos. El siguiente paso, [añadir IAM + OAuth](/aurora-catalyst-docs/es/tutorials/getting-started/add-iam-oauth/), lo convierte en un proveedor de identidad.

Para incorporar a un compañero al proyecto, sigue [Incorporar a un desarrollador](/aurora-catalyst-docs/es/guides/workflow/onboard-developer/).
