---
title: Alcance por tenant
description: Cómo un módulo hasTenant mantiene a cada usuario dentro de sus propios tenants — los decoradores generados TenantConstraint y TenantPolicy, la instantánea dTenants y por qué las relaciones se deniegan por defecto.
---

## Por qué existe

Una aplicación multi-tenant guarda los datos de varias organizaciones en las mismas tablas. La regla de que un tenant nunca ve las filas de otro tiene que cumplirse en todos los endpoints y en todas las operaciones, incluidas las que el desarrollador olvidó. Escribir ese filtro a mano en cada handler garantiza que alguno se lo salte.

Aurora lo convierte en una declaración. Un módulo que declara `hasTenant: true` en su YAML recibe el filtrado emitido en cada resolver y controller generados. El desarrollador no escribe el filtro y no puede olvidarlo.

La misma declaración cierra una fuga menos evidente. Un lenguaje de consulta que puede seguir relaciones también puede hacer una pregunta que el llamante no debería poder hacer: «¿existe alguna fila, en el tenant de otro, que cumpla esto?». Por eso el alcance por tenant decide qué relaciones puede cruzar un cliente, y por defecto no puede cruzar ninguna.

## Cómo funciona

### Quién es el llamante: `dTenants`

Cada cuenta lleva `dTenants`, una lista desnormalizada de los ids de tenant en los que puede actuar. Se deriva de las pertenencias directas de la cuenta a tenants. Si la cuenta tiene `hasAddChildTenants`, incluye además todos los descendientes actuales de esos tenants. Es de solo lectura para los clientes y se recalcula al crear la cuenta, al actualizarla y en cada emisión de token (password, authorization code, refresh token, client credentials e impersonación). El refresco solo escribe si el valor cambió. Si falla, la emisión del token sigue adelante con la instantánea almacenada y el error se registra en el log.

Una cuenta con `dTenants` vacío no es «sin restricción»: no coincide con ninguna fila.

### Lecturas: `@TenantConstraint`

En cada lectura generada, y en la búsqueda de la fila de cada actualización y borrado por id generados, el resolver o controller ejecuta `@TenantConstraint` antes del handler. Hace dos cosas.

Primero, clasifica lo que envió el cliente. El `query`, el `constraint` y el campo agregado se comprueban contra el field schema del módulo. Cualquier relación fuera de la lista declarada del módulo, cualquier campo desconocido y cualquier forma mal construida se rechaza con HTTP `400` y `Errors.TenantScopeQueryRejected`. El error nombra la ruta problemática dentro del input del propio llamante, nunca un id de tenant ni un valor almacenado.

Segundo, construye un constraint nuevo `{ and: [callerWhere, tenantWhere] }`, donde `tenantWhere` compara la columna de tenant del módulo con los `dTenants` del llamante. El `where` completo del llamante, incluido cualquier `or`, sigue siendo un único operando indivisible, de modo que el predicado de tenant siempre se aplica junto a él.

La columna de tenant es `tenantId` (un solo tenant, comparado con `in`) o `tenantIds` (un array, comparado con `overlap`). El generador busca esos dos nombres exactos, nunca por prefijo. Si la columna de tenant admite nulos, un `NULL` es un registro global visible para todos los tenants y el predicado pasa a ser `isNull OR <acotado>`.

### Escrituras: `@TenantPolicy`

Las creaciones y actualizaciones ejecutan `@TenantPolicy` sobre el payload. Un valor de tenant fuera de los `dTenants` del llamante se rechaza con `403` (`Errors.TenantScopeViolation`); un payload masivo se rechaza entero si algún elemento queda fuera de alcance. En la creación, un payload sin valor de tenant es un `400` (`Errors.TenantScopeMissingProperty`), porque ese valor decide dónde nace la fila. En la actualización, un valor ausente significa «déjalo como está» y se permite, porque `@TenantConstraint` ya acotó la fila. Un valor presente se comprueba en ambos casos. Un array de tenants vacío en un payload se rechaza; nunca se interpreta como «todos los tenants».

### Fallo cerrado

Si `@TenantConstraint` o `@TenantPolicy` no encuentra un principal en la posición del argumento de cuenta, lanza `Errors.TenantScopeMisconfigured` (`500`) y el handler no llega a ejecutarse. Es un error de cableado en el código emitido, no un fallo del llamante, y la respuesta no lo describe. El detalle va al log del servidor.

### Relaciones: denegadas por defecto

Antes de esta regla, un cliente podía enviar `where: { unaRelacion: { ... } }` y el motor lo compilaba a una subconsulta `EXISTS` sin predicado de tenant. Combinada con un conteo, responde a «¿hay una fila que coincide en otro tenant?». `relations`, `order` y `aggregation` filtraban información de la misma manera.

Ahora una relación solo se cruza si el módulo declara `traversableInTenantScope: true` en esa relación, y entonces solo un salto: dentro del registro relacionado solo se pueden usar sus propios campos escalares. El clasificador trabaja contra el field schema y nunca recorta lo que rechaza: hace fallar la petición. El framework nunca infiere qué relaciones son seguras. Es la regla de que el YAML declara y el framework no infiere: o lo dice el YAML, o no ocurre.

## Cuándo aplica

- Declaras `hasTenant: true` en un módulo, o te preguntas por qué una consulta que sigue una relación devuelve ahora `Errors.TenantScopeQueryRejected`.
- Un cliente crea o actualiza un registro para un tenant al que la cuenta no pertenece y recibe un `403`.
- Una cuenta no ve datos en un listado acotado por tenant. Revisa sus `dTenants` antes de sospechar del filtro.

## Compromisos y límites

- **Un módulo `hasTenant` sin ninguna relación atravesable rechaza todas las relaciones.** Es la denegación por defecto funcionando como se pretende: una petición que nombra una relación falla. Declara cada relación que necesites.
- **El destino de una relación atravesable no queda acotado por tenant con esta regla.** Solo se permite el salto. Declara una relación como atravesable cuando su destino sea seguro de leer desde este tenant, como el propio registro de tenant o un padre que posee el mismo tenant.
- **La generación rechaza configuraciones inseguras.** `hasTenant: true` exige `hasOAuth: true` (los decoradores necesitan la cuenta autenticada), exige una propiedad `tenantId` o `tenantIds`, y exige `getRaw` y `upsert` en `excludedOperations`. Esas dos operaciones no tienen argumento `constraint` con el que acotar la búsqueda de su fila. Cada error nombra el módulo y el remedio.
- **Los cubos de informes se acotan por separado.** El motor de informes declara `tenantColumns` por alias de tabla. Consulta [Motor de informes](../report-engine/).

## Relacionado

- [Acotar un módulo por tenant](../../../guides/backend/scope-a-module-by-tenant/) — la receta: declarar el flag, marcar las relaciones y verificar.
- [Referencia de QueryStatement](../../../reference/query-statement/) — el lenguaje de consulta que clasifica el alcance.
- [Claves del YAML de módulo](../../../reference/module-yaml/) — las claves vecinas de `hasTenant` y `traversableInTenantScope`.
- [Impersonación de cuentas](../account-impersonation/) — una sesión impersonada queda acotada por los `dTenants` de la cuenta destino.
