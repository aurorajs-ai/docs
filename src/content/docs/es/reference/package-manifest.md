---
title: Referencia del manifiesto de paquete
description: Todas las claves de cliter/packages/<package>.yaml, sus reglas de validación, un ejemplo completo y el catálogo de paquetes que instala catalyst add.
---

Para saber por qué los paquetes funcionan así, consulta [Paquetes instalables y actualizaciones del scaffold](../../concepts/workflow/installable-packages/). Para los pasos, consulta [Instalar y actualizar paquetes](../../guides/workflow/install-and-upgrade-packages/).

## Ubicación y reglas

Un paquete tiene exactamente un manifiesto escrito a mano en `cliter/packages/<package>.yaml` del monorepo de origen. `cliter/packages/` no es un bounded context. El manifiesto declara solo datos: no admite hooks, scripts ni código, y un campo ajeno a esta referencia, un paquete desconocido en `requires` o una dependencia sin versión exacta falla la validación con un mensaje que nombra el manifiesto y el campo.

## Claves de primer nivel

| Clave | Tipo | Descripción |
| --- | --- | --- |
| `name` | string | Nombre del paquete, el que pasas a `catalyst add`. |
| `label` | string | Nombre legible. |
| `requires` | lista de strings | Paquetes que se instalan junto con este. Solo nombres, nunca rangos de versión. Se resuelven de forma transitiva. |
| `env` | mapa | Claves `.env` que el paquete necesita, aplicadas tras la fusión. Un string es un valor por defecto de desarrollo, que se escribe cuando la clave no existe. `null` marca una clave obligatoria sin un valor por defecto válido: la CLI nunca la escribe y la informa cuando falta. |
| `backend` | mapa | La mitad de backend. Una mitad sin `paths` no se instala. |
| `frontend` | mapa | La mitad de frontend. |

## Claves de `backend`

| Clave | Descripción |
| --- | --- |
| `paths` | Rutas que se copian, relativas a `backend/`. |
| `dependencies` | Dependencias npm, cada una fijada a una versión exacta. Declara solo lo que el `package.json` del scaffold no incluye ya. |
| `modules` | Bounded contexts cuyo `<Pascal(bc)>Module` importa el módulo de la aplicación. |
| `aggregates` | Por bounded context, sus módulos, cada uno un nombre simple o `{ name, customFields: true }`. El nombre del agregado es `Pascal(bc) + Pascal(module)`. |
| `relations` | Por clave de esquema propietaria, por etiqueta de relación: `{ one, from, to }`, `{ many, from, to }` (unida por una columna del destino) o `{ many, from, to, through: { table, from, to } }` (a través de una tabla pivote). Nunca una expresión de código. |
| `bridges.imports` | Bounded contexts cuyos módulos importa el módulo de bridges. |
| `bridges.providers` | Cada uno `{ name, token: { name, from }, adapter?: { name, from } }`. `name` es el nombre base de `src/@bridges/providers/<name>.bridge.ts`. |
| `queues` | Nombres base de archivo bajo `src/@config/bullmq/` que exporta el barrel de colas. |

La validación falla, nombrando el manifiesto y el campo, cuando un bounded context de `modules` o `aggregates` no es propiedad del paquete, una clave de `relations` no es la clave de esquema de un agregado declarado, un bounded context de `bridges.imports` no es propiedad ni del paquete ni de sus `requires` transitivos, un archivo de provider o de cola no está entre los `paths`, o un `adapter.from` o `token.from` termina en el barrel equivocado.

## Claves de `frontend`

| Clave | Descripción |
| --- | --- |
| `paths` | Rutas que se copian, relativas a `frontend/`. |
| `dependencies` | Dependencias npm, fijadas a versiones exactas. |
| `routes` | Bounded contexts cuya ruta lazy registran las rutas de administración. |
| `navigation` | Por sección de la barra lateral, `navMain` o `projects`, los bounded contexts cuya navegación extiende esa sección. Cada uno debe estar también en `routes`. |
| `widgets` | Bounded contexts cuyos `<camel(bc)>WidgetProviders` agrega el agregador de providers de widgets. |
| `bindings` | Enlaces de puertos, cada uno `{ token: { name, from }, adapter: { name, from } }`. El `token.from` debe empezar por `@aurora`. Dos manifiestos de un mismo conjunto no pueden enlazar el mismo token. |

Un bounded context de `routes`, `navigation` o `widgets` debe tener su `src/app/domains/admin/apps/<bc>` entre los `paths` del frontend.

## Propiedad de las rutas

Un manifiesto declara rutas de copia solo dentro de los bounded contexts que posee, o dentro de zonas compartidas como `@config` y `assets`. Un paquete posee los bounded contexts nombrados por sus rutas `@api/<bc>` y `@app/<bc>`, y un bounded context pertenece como máximo a un manifiesto. Una ruta dentro del subárbol de otro bounded context se rechaza.

## Ejemplo

```yaml
# cliter/packages/queue-manager.yaml
name: queue-manager
label: Queue Manager
backend:
  modules: [queue-manager]
  aggregates:
    queue-manager: [queue-load-snapshot]
  queues: [queue-manager-queue.constants]
  paths:
    - src/@api/queue-manager
    - src/@app/queue-manager
    - src/@config/bullmq/queue-manager-queue.constants.ts
    - test/acceptance/queue-manager
  dependencies:
    '@nestjs/bullmq': 12.0.0
    bullmq: 6.5.1
    '@bull-board/api': 9.9.0
    ioredis: 5.10.1
frontend:
  routes: [queue-manager]
  navigation: { navMain: [queue-manager] }
  widgets: [queue-manager]
  paths:
    - src/app/domains/admin/apps/queue-manager
    - public/i18n/queue-manager
```

## El lockfile

`aurora.lock.yaml`, en la raíz del proyecto, tiene dos claves: `cliVersion` (la versión de la CLI que renderizó la punta de `aurora/scaffold`) y `packages` (los nombres de los paquetes instalados, sin duplicados y ordenados). Cualquier otra clave es un error.

## Catálogo de paquetes

| Paquete | Etiqueta | Requiere |
| --- | --- | --- |
| `authorization-code` | Authorization Code | ninguno |
| `automation` | Automation | `identity` |
| `business-partner-portal` | Business Partner Portal | `identity`, `queue-manager`, `common`, `storage-account`, `automation`, `fiscal`, `sap-integration` |
| `common` | Common | `identity` |
| `dashboard` | Dashboard | `identity` |
| `fiscal` | Fiscal | `identity`, `common` |
| `hub` | Hub | `identity` |
| `identity` | Identity (IAM + OAuth) | `tools` |
| `production-planning` | Production Planning | `identity` |
| `queue-manager` | Queue Manager | ninguno |
| `reporting` | Reporting | `identity` |
| `sap-integration` | SAP Integration | `identity`, `queue-manager` |
| `storage-account` | Storage Account | `identity` |
| `tools` | Tools | ninguno |

## Relacionado

- [Concepto: Paquetes instalables y actualizaciones del scaffold](../../concepts/workflow/installable-packages/)
- [Guía: Instalar y actualizar paquetes](../../guides/workflow/install-and-upgrade-packages/)
