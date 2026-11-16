---
title: Componer un QueryStatement
description: Construye cláusulas where/relations/order en un handler o service, reenvía constraint para acotar el alcance y carga relaciones sin filtrar campos enmascarados.
---

## Objetivo

Componer un `QueryStatement` tipado dentro de un handler o service — `where`, `relations`, `order`, `limit` — y cargar relaciones sin filtrar campos enmascarados. Para ver cada operador, bloque y límite del lenguaje, consulta la [referencia de Query Statement](../../../reference/query-statement/).

## Antes de empezar

- Tienes un handler o service de backend generado (lo habitual es un handler de lectura).
- Entiendes los dos parámetros `QueryStatement` que recibe un handler de Catalyst:
  - `queryStatement` — el payload de filtro / orden / paginación **que envía el cliente**, desde el resolver o el controller.
  - `constraint` — el **alcance impuesto por el servidor** (id de tenant, filtro de permisos), inyectado antes por un middleware o por decoradores. En un módulo `hasTenant: true`, el alcance por tenant también decide qué relaciones puede recorrer un cliente: consulta [Alcance por tenant](../../../concepts/backend/tenant-scope/).

  Trátalos como de solo lectura. Combinarlos es trabajo de la capa de servicio.
- `@aurorajs.dev/core-back` está instalado — viene con todo backend de Catalyst.

## Pasos

1. **Tipa la sentencia.** Anótala siempre, para que el compilador compruebe la forma de cada bloque:

   ```typescript
   import { QueryStatement } from '@aurorajs.dev/core-back';
   ```

2. **Construye `where` con claves de operador sin adornos.** Un campo se asocia a un objeto de comparación, y los campos hermanos se combinan con AND:

   ```typescript
   const queryStatement: QueryStatement = {
     where: {
       and: [
         { isActive: { eq: true } },
         { name: { iLike: `${query.prefix}%` } },
       ],
     },
     order: [{ field: 'createdAt', dir: 'desc' }],
     limit: query.limit ?? 50,
   };
   ```

   El vocabulario de operadores es cerrado: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `between`, `isNull`, `iLike`, `contains`, `overlap`, más los conectores `and`, `or` y `not`. Una clave fuera de esa lista se rechaza antes de ejecutar ningún SQL, así que un error tipográfico falla de forma visible en lugar de degenerar en otro filtro. Si prefieres constantes a claves de texto, `WHERE_OPERATOR` y `LOGICAL_OPERATOR` salen de `@aurorajs.dev/core-back`.

3. **Carga relaciones con `relations`.** Un nombre de relación se asocia a `true`, o a un nodo que da forma a los hijos cargados:

   ```typescript
   const queryStatement: QueryStatement = {
     where: { id: { eq: accountId } },
     relations: { user: true, tenant: true },
   };
   ```

   Anida para cargar un grafo:

   ```typescript
   { relations: { state: { relations: { category: true } } } }
   ```

   Mantén separados los dos ejes. Una clave de relación dentro de `where` filtra las filas **padre** y no carga nada. Una clave de relación dentro de `relations` carga hijos y nunca filtra a los padres. Pedir la relación en el selection set de GraphQL tampoco la carga: sin una entrada en `relations`, el campo llega como `null`.

4. **Reenvía `queryStatement` y `constraint` al service sin cambios.** Construye un objeto nuevo si necesitas ampliarlos; no mutes los que llegan. Cuando añadas una relación a la sentencia de quien llama, esparce las relaciones que ya traía:

   ```typescript
   return await this.getService.main(
     {
       ...queryStatement,
       relations: { ...queryStatement?.relations, state: { relations: { category: true } } },
     },
     constraint,
     handlerMeta,
   );
   ```

### Cargar relaciones de forma segura

`@Format` y `@ApplySchema` formatean el registro devuelto con el field schema del agregado, y entran recursivamente en cada relación que el field schema declara como entrada `relation`. Por tanto, un campo enmascarado de una relación cargada (`type: 'password'`, `secret`, `encrypted`) también queda enmascarado ahí.

Eso solo vale para las relaciones que el field schema **declara**. El generador declara cada relación a partir de la YAML, y el motor de consultas lo hace cumplir: una sentencia que nombra una relación ausente del field schema — en `relations`, en `where` o en un dot-path de `order` o `aggregation` — falla con HTTP `400` y `Errors.RelationNotQueryable`. Una relación que solo existe en el archivo de relaciones de Drizzle no es accesible desde una consulta. Las relaciones inversas (un valor de campo personalizado hacia su padre, una compañera i18n hacia su padre) no se pueden consultar en absoluto.

Si escribes una relación a mano, declárala en la YAML del módulo y regenera, en lugar de añadirla solo al archivo de relaciones.

## Verifica que funcionó

- Ejecuta el handler con una consulta que use `iLike` o `between` y revisa las filas: el predicado se aplica a la columna que nombraste.
- Carga una relación que tenga un campo enmascarado y confirma que el campo no aparece en el JSON devuelto.
- Confirma que `constraint` no se devuelve en la respuesta ni en los mensajes de error — lleva alcance de tenant / permisos que debe quedarse en el servidor.

## Solución de problemas

**La sentencia falla antes de llegar a la base de datos.** El validador es default-deny: un operador desconocido, una clave de nivel superior desconocida, un `limit` superior a 10000 o un anidamiento de más de 10 niveles se rechazan con un mensaje que nombra la ruta. Consulta la [referencia](../../../reference/query-statement/#validación-y-seguridad).

**HTTP `400` con `Errors.RelationNotQueryable`.** La sentencia nombra una relación que el field schema del agregado no declara. Declara la relación en la YAML y regenera.

**HTTP `400` con `Errors.TenantScopeQueryRejected`.** El módulo es `hasTenant: true` y la sentencia cruza una relación que no está declarada como atravesable en el alcance por tenant. Consulta [Alcance por tenant](../../../concepts/backend/tenant-scope/).

**HTTP `403` con `Errors.MaskedPropertyNotQueryable`.** La sentencia filtra, ordena o agrega por una propiedad `secret`, `password` o `encrypted`, directamente o a través de una relación. Quítala de la sentencia. El código de backend de confianza que de verdad la necesita pasa `unsafeAllowMaskedPropertyQuery(...)` como `exemption` de la llamada al repositorio: consulta la [referencia](../../../reference/query-statement/#las-propiedades-enmascaradas-no-se-pueden-consultar).

**El merge del service se rompe después de que corra mi handler.** Mutaste `queryStatement` o `constraint`. Trátalos como de solo lectura. Si necesitas un objeto combinado, construye uno nuevo con un spread.

**Quieres ocultar una columna con una proyección.** El lenguaje no tiene clave de proyección: no existe `attributes`. Enmascara los campos sensibles con el handler `format` del field schema (`@Format` / `@ApplySchema`), que corre en toda lectura sin importar cómo se construyó la consulta.

## Relacionado

- [Referencia de Query Statement](../../../reference/query-statement/) — cada operador, bloque y límite.
- [Decoradores de field-schema](../apply-field-schema-decorators/) — el lado de validación / formato de la capa declarativa.
- [Scaffolding de un módulo backend](../../../concepts/backend/module-scaffolding/) — cómo se declaran las relaciones en la YAML.
