---
title: Acotar un módulo por tenant
description: Declara hasTenant en un módulo, elige qué relaciones puede recorrer un cliente, regenera y verifica que cada usuario se queda dentro de sus propios tenants.
---

## Objetivo

Hacer que cada endpoint generado de un módulo devuelva y acepte solo filas de los tenants del llamante, y decidir qué relaciones puede seguir un cliente desde él.

## Antes de empezar

- Un proyecto Catalyst con el `cliter/<bounded-context>/<module>.module.yaml` del módulo.
- El módulo está protegido por OAuth (`hasOAuth: true`). El alcance por tenant necesita la cuenta autenticada.
- Conoces el [concepto](../../../concepts/backend/tenant-scope/): el alcance sale de los `dTenants` del llamante y las relaciones se deniegan por defecto.

## Pasos

1. **Declara el flag y la columna de tenant.** Al inicio del YAML, pon `hasTenant: true` junto a `hasOAuth: true`. Añade la columna con la que se compara el alcance: `tenantId` para una fila que pertenece a un tenant, `tenantIds` (tipo `array`) para una fila compartida por varios. El generador busca exactamente estos dos nombres. Haz la columna nullable solo si un `NULL` debe significar «visible para todos los tenants».

   ```yaml
   hasOAuth: true
   hasTenant: true
   aggregateProperties:
     - name: tenantId
       type: id
       nullable: false
       index: index
       relationship:
         type: many-to-one
         aggregateName: IamTenant
         modulePath: iam/tenant
         key: id
         field: tenant
         avoidConstraint: true
   ```

2. **Excluye las dos operaciones que no se pueden acotar.** `getRaw` y `upsert` no tienen argumento `constraint` donde enganchar el alcance. La generación falla hasta que ambas están en `excludedOperations`.

   ```yaml
   excludedOperations:
     - getRaw
     - upsert
   ```

3. **Marca las relaciones que un cliente puede seguir.** Añade `traversableInTenantScope: true` al bloque `relationship` de cada relación que un listado o un detalle necesite cargar, filtrar u ordenar. Sin él, una petición que nombre esa relación falla. Esto incluye la relación con el tenant del ejemplo anterior si la interfaz muestra el tenant.

   ```yaml
       relationship:
         type: many-to-one
         aggregateName: BusinessPartnerPortalBusinessPartner
         modulePath: business-partner-portal/business-partner
         key: id
         field: businessPartner
         avoidConstraint: true
         traversableInTenantScope: true
   ```

   Solo se permite un salto, y el registro relacionado no queda acotado por tenant. Marca una relación únicamente cuando su destino sea seguro de leer desde este tenant.

4. **Regenera.**

   ```bash
   catalyst generate back module --name=<bounded-context>/<module> --force
   ```

5. **Los endpoints manuales usan el decorador tú mismo.** Si añades una lectura propia sobre un agregado `hasTenant`, aplica `@TenantConstraint` de `@aurorajs.dev/core-back`. Necesita el field schema del agregado y la posición del argumento de la consulta. Si la columna de tenant es un array como `tenantIds`, indica también `targetProperty: 'tenantIds'` e `isArray: true`. Los resolvers generados muestran la forma completa.

   ```ts
   @TenantConstraint({
     fieldSchema: ContactFieldSchema,
     queryStatementIndex: 1,
     allowedRelations: ['tenant'],
   })
   async main(account, queryStatement, constraint, meta) { /* … */ }
   ```

   Solo `queryStatementIndex` es obligatorio: es `null` cuando el método no recibe consulta, y no tiene valor por defecto a propósito, porque uno dejaría una consulta sin comprobar en silencio. `aggregateFieldIndex` es opcional; indícalo solo en `sum`, `max` y `min`, donde señala el campo agregado. `targetProperty` vale `'tenantId'` por defecto e `isArray` vale `false`; cámbialos cuando la columna de tenant sea un array como `tenantIds`:

   ```ts
   @TenantConstraint({
     fieldSchema: ContactFieldSchema,
     queryStatementIndex: 1,
     targetProperty: 'tenantIds',
     isArray: true,
   })
   ```

## Verifica que funciona

- Lee el resolver generado de una operación de listado. Lleva `@TenantConstraint` con tus `allowedRelations`; los resolvers de creación y actualización llevan `@TenantPolicy`.
- Inicia sesión con una cuenta cuyos `dTenants` solo contienen el tenant A. Un listado devuelve únicamente las filas de A, y crear una fila con el id del tenant B devuelve `403`.
- Envía una consulta que nombre una relación que no marcaste. Devuelve `400` con `Errors.TenantScopeQueryRejected` y la ruta de la clave problemática.

## Solución de problemas

**`[tenant-property-missing ERROR]`.** El módulo declara `hasTenant: true` pero no tiene propiedad `tenantId` ni `tenantIds`. Añade una, o quita el flag.

**`[tenant-requires-oauth ERROR]`.** Pon `hasOAuth: true`, o quita `hasTenant`. Sin guarda, los decoradores no encuentran cuenta y cada petición fallaría con un `500`.

**`[tenant-no-constraint-operation ERROR]`.** Añade la operación indicada (`getRaw` o `upsert`) a `excludedOperations`.

**Un listado que la cuenta debería ver llega vacío.** Revisa primero los `dTenants` de la cuenta. Una lista vacía no coincide con ninguna fila, y una pertenencia nueva a un tenant llega a `dTenants` en la siguiente emisión de token.

**`403` en una actualización que el usuario puede hacer.** El payload lleva un valor de tenant fuera del alcance del llamante. Envía la columna de tenant solo cuando quieras cambiarla; en una actualización, un valor ausente se deja como está.

## Relacionado

- [Alcance por tenant](../../../concepts/backend/tenant-scope/) — por qué el alcance tiene esta forma.
- [Excluir APIs](../exclude-generated-apis/) — `excludedOperations` en detalle.
- [Componer un QueryStatement](../query-with-querystatement/) — el lenguaje de consulta y sus reglas de relaciones.
- [Claves del YAML de módulo](../../../reference/module-yaml/) — `traversableInTenantScope`.
