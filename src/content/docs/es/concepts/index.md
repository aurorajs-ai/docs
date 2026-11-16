---
title: Conceptos
description: Las ideas, decisiones y filosofía detrás de Aurora Catalyst.
---

Las páginas de concepto están **orientadas a la comprensión**: explican el _porqué_ detrás de Aurora, no el cómo usarlo. Léelas cuando quieras formar un modelo mental sólido.

Si quieres _hacer_ algo, usa las [guías](../guides/). Si necesitas datos exactos, usa la [referencia](../reference/).

## Temas

### Backend

- **[Impersonación de cuentas](./backend/account-impersonation/)** — cómo un operador autorizado actúa como otra cuenta sin compartir contraseña, con un token de vida corta y tres vetos.
- **[Autoservicio de cuenta](./backend/account-self-service/)** — cómo una cuenta gestiona su propio perfil, su contraseña y su autenticación en dos pasos, y cómo funciona el restablecimiento de contraseña.
- **[Estrategias de autenticación](./backend/authentication-strategies/)** — los tres modos `OAUTH_STRATEGY`, el patrón BFF y cómo fluyen los tokens entre un hub y sus satélites.
- **[Ports entre bounded contexts](./backend/cross-bounded-context-ports/)** — cómo la carpeta `@bridges` desacopla los bounded contexts mediante ports, tokens, adapters y un composition root global.
- **[Campos personalizados](./backend/custom-fields/)** — campos tipados que un operador añade a una entidad en tiempo de ejecución, sin cambiar el esquema.
- **[Catálogo de almacenamientos de archivos](./backend/file-storage/)** — almacenamientos externos en los que la plataforma escribe archivos, referenciados por id, tras un puerto de solo escritura.
- **[Catálogo de buzones y puerto de lectura](./backend/mailbox/)** — direcciones de correo desde las que la plataforma lee y envía, y el puerto de lectura neutral sobre Microsoft 365, Google e IMAP.
- **[Scaffolding de un módulo](./backend/module-scaffolding/)** — qué genera la CLI para un módulo de backend y cómo el lockfile vigila las ediciones a mano.
- **[Escritura de propiedades](./backend/property-writability/)** — cómo `readOnly` y `createOnly` deciden quién puede escribir un valor en el formulario, los contratos de la API y el pipeline de escritura.
- **[Motor de informes](./backend/report-engine/)** — cómo se ejecutan los informes de agregación curados: cubos como lista blanca en tiempo de compilación y ejecución por informe almacenado.
- **[Motor de reglas](./backend/rules-engine/)** — reglas de negocio que los administradores redactan como tablas de decisión sobre los campos y acciones que declara un bounded context.
- **[Máquina de estados configurable](./backend/state-machine/)** — un ciclo de vida cuyos estados y transiciones editan los administradores sin desplegar.
- **[Alcance por tenant](./backend/tenant-scope/)** — cómo un módulo `hasTenant` mantiene a cada llamante dentro de sus tenants, y por qué las relaciones se deniegan por defecto.
- **[Campos traducidos a través de relaciones](./backend/translated-fields-through-relations/)** — cómo un módulo que apunta a un agregado table-i18n muestra, busca y ordena por sus campos traducidos.

### Frontend

- **[La superficie de importación de @aurora](./frontend/aurora-import-surface/)** — por qué la capa de framework se importa mediante alias de sub-barrel explícitos, y qué protege el presupuesto del payload inicial.
- **[Renderers de celdas](./frontend/cell-renderers/)** — cómo la data-table despacha por tipo de propiedad y cómo sobreescribir el render por columna.
- **[Composables: atoms y presets](./frontend/composables/)** — por qué la lógica del brain se parte en atoms de responsabilidad única y presets opinados conectados a TanStack Table.
- **[Composición vs herencia](./frontend/composition-over-inheritance/)** — por qué el brain extiende en horizontal componiendo funciones en vez de por jerarquías de clases.
- **[Detail mode](./frontend/detail-mode/)** — cómo `front.detailMode` elige entre una página de detalle ruteada y un CRUD lista-con-modal.
- **[Embed mode](./frontend/embed-mode/)** — cómo `front.embedSupport` permite embeber un módulo hijo dentro del detalle de su padre.
- **[Acciones guiadas y formularios asistidos](./frontend/guided-actions/)** — cómo el asistente y la paleta de comandos llevan al usuario a una pantalla o a un formulario de alta, y qué le deja rellenar `hasAssistant`.
- **[Ancho de campos](./frontend/form-field-widths/)** — cómo el grid de 12 columnas, los defaults por tipo, `widget.span` y el pase de auto-expand deciden el ancho de cada campo.
- **[El manual de usuario integrado](./frontend/in-app-user-manual/)** — un manual para el usuario final escrito por pantalla, compilado en cada build, buscable según permisos y complementado con recorridos guiados.
- **[Preservation regions](./frontend/preservation-regions/)** — cómo te apropias de un trozo de un archivo generado y por qué ese trozo sobrevive a la regeneración.
- **[Preferencias de interfaz por rol](./frontend/role-ui-preferences/)** — cómo la página de aterrizaje y la navegación oculta de un rol moldean la sesión al iniciar sesión y al impersonar.
- **[Columnas pinned (TanStack)](./frontend/tanstack-column-pinning/)** — por qué fijar una columna la reordena en vez de moverla, y cómo la data-table escribe pinning y orden a la vez.
- **[Paletas de theme](./frontend/theme-palettes/)** — cómo se resuelve la paleta de color activa y se propaga a toda la interfaz.

### Workflow y gobernanza

- **[Sistema de business rules](./workflow/business-rules-overview/)** — un catálogo de invariantes de dominio junto a los YAML, usado como memoria institucional y detector de incoherencias.
- **[Anatomía de una business rule](./workflow/business-rule-anatomy/)** — los campos, la gramática de IDs, estado/severidad, la tabla de casos y el ciclo de vida de una regla.
- **[Arquitectura del sistema de business rules](./workflow/business-rules-architecture/)** — las piezas técnicas (índice, scripts, slash commands, skill, hooks, CI, extensión OpenSpec) y cómo se relacionan.
- **[Despliegue en Coolify](./workflow/coolify-deployment/)** — cómo `provision`, `pipeline`, `deploy` y `backup` llevan un proyecto desde `aurora.yaml` hasta un servidor endurecido.
- **[Modos de desarrollo](./workflow/development-modes/)** — Framework mode vs Solution mode y el comando `/dev-mode` que cambia entre ellos.
- **[Los cuatro artefactos de gobernanza](./workflow/governance-artifacts/)** — Harness Rules, el hook architecture-checkpoint y las skills de project-structure de backend/frontend: qué te bloquea, qué te aconseja y quién es responsable de qué.
- **[Paquetes instalables y actualizaciones del scaffold](./workflow/installable-packages/)** — manifiestos, el lockfile y la rama de proveedor `aurora/scaffold` detrás de `catalyst add` y `catalyst upgrade`.
- **[Catálogo de procesos](./workflow/process-catalog/)** — los procesos de negocio de un bounded context como caminos ordenados sobre pantallas, y en qué se diferencian de las reglas y del manual.
