---
title: Guías
description: Recetas orientadas a tareas para quienes ya conocen lo básico de Aurora Catalyst.
---

Las guías están **orientadas a tareas**: asumen que ya entendiste los fundamentos y sólo necesitas resolver un problema concreto.

Si Aurora es nuevo para ti, empieza con los [tutoriales](../tutorials/).

## Backend

- **[Añadir un port cross-BC](./backend/add-a-cross-bc-port/)** — conecta una nueva dependencia entre bounded contexts mediante `@bridges`.
- **[Añadir campos personalizados a un módulo](./backend/add-custom-fields-to-a-module/)** — activa los campos personalizados en tiempo de ejecución en un módulo y define el primer grupo y campo.
- **[Adoptar la máquina de estados en un módulo](./backend/adopt-the-state-machine/)** — registra una máquina al arrancar, da entrada a los elementos en el estado inicial y muévelos mediante el puerto de transición.
- **[Decoradores de field-schema](./backend/apply-field-schema-decorators/)** — valida payloads y formatea valores de retorno con `@ApplySchema`, `@Format` y `@Sanitize`.
- **[Crear un cubo de informes](./backend/author-a-report-cube/)** — declara dimensiones, medidas, joins y un informe curado, y regístralo.
- **[Configurar la seguridad de la cuenta](./backend/configure-account-security/)** — configura el restablecimiento de contraseña y la autenticación en dos pasos TOTP de un despliegue.
- **[Declarar las colas de un bounded context](./backend/declare-bc-queues/)** — declara las colas BullMQ que posee un BC con `QueueDeclarationModule.forFeature`.
- **[Excluir APIs](./backend/exclude-generated-apis/)** — omite operaciones o archivos al regenerar un módulo.
- **[Gestionar migraciones de esquema con drizzle-kit](./backend/manage-schema-migrations/)** — edita el YAML, genera la migración, revísala y aplícala.
- **[Componer un QueryStatement](./backend/query-with-querystatement/)** — construye cláusulas `where`, `relations` y `order` y carga relaciones de forma segura.
- **[Registrar una entidad en el motor de reglas](./backend/register-an-entity-with-the-rules-engine/)** — declara campos y acciones al arrancar y evalúa un elemento contra reglas redactadas por administradores.
- **[Registrar handlers por clave](./backend/register-and-resolve-handlers/)** — despacha a todos los handlers registrados para una clave en tiempo de ejecución.
- **[Acotar un módulo por tenant](./backend/scope-a-module-by-tenant/)** — declara `hasTenant`, elige las relaciones recorribles y verifica el aislamiento.

## Frontend

- **[Configurar un módulo frontend](./frontend/configure-a-frontend-module/)** — elige el shell de detalle, los widgets, el layout del formulario y regenera.
- **[Activar el asistente en un módulo](./frontend/enable-the-assistant-on-a-module/)** — deja que el asistente de ayuda rellene el formulario de alta de un módulo.
- **[Implementar un widget grid-elements-manager](./frontend/implement-grid-elements-manager/)** — embebe el CRUD de un módulo hijo dentro del detalle de su padre.
- **[Gestionar themes](./frontend/manage-theme-palettes/)** — usa el selector de paletas y añade una paleta desde una exportación de tweakcn.
- **[Escribir un capítulo del manual](./frontend/write-a-manual-chapter/)** — crea el capítulo de una pantalla, marca sus procesos, añade un recorrido y compila el manual.

## Workflow

- **[Desplegar un proyecto en Coolify](./workflow/deploy-to-coolify/)** — desde `catalyst new` hasta un frontend y un backend en marcha en un servidor Coolify.
- **[Instalar y actualizar paquetes](./workflow/install-and-upgrade-packages/)** — `catalyst add` y `catalyst upgrade`, conflictos, migraciones y la rama de proveedor.
- **[Mantener el catálogo de business rules](./workflow/maintain-business-rules/)** — los tres flujos de autoría, los comandos y el hook de pre-commit.
- **[Mantener el catálogo de procesos](./workflow/maintain-processes/)** — inicia, edita y valida `processes.yaml` y sus marcadores del manual.
