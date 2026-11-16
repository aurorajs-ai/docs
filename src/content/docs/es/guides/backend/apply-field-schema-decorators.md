---
title: Decoradores de field-schema
description: Cablea @ApplySchema, @Format o @Sanitize sobre el main() de un handler para que el payload se valide y el retorno se formatee automáticamente.
---

## Objetivo

Elegir el decorador correcto de field-schema para el handler que acabas de scaffoldear, cablearlo en `main()` y dejar que él se ocupe de la validación, la sanitización y el enmascarado del output — en lugar de duplicar esas comprobaciones a mano.

## Antes de empezar

- Tienes un módulo backend scaffoldeado y su archivo `*.field-schema.ts` existe en disco. El CLI lo generó desde `aggregateProperties` en la YAML del módulo; no lo edites a mano.
- Sabes qué rol tiene el handler: ¿recibe un payload?, ¿devuelve la entidad?
- `@aurorajs.dev/core-back` está instalado — viene con cualquier backend de Catalyst.

## Pasos

1. **Elige el decorador con este árbol de decisión.**

   ```
   ¿El handler RECIBE un payload?
     ├── No  → @Format(schema)
     └── Sí  → ¿DEVUELVE la entidad?
                ├── Sí → @ApplySchema({ schema, operation })
                └── No → @Sanitize({ schema, operation })
   ```

   `@ApplySchema` compone sanitize (input) + format (output). `@Format` solo formatea el retorno (las lecturas son idempotentes). `@Sanitize` solo sanitiza el payload (flujos de escritura cuyo retorno es `void`, un booleano o un tipo resumen).

   **`@ApplySchema` y `@Sanitize` reciben un objeto, y `operation` es obligatorio.** Vale `'create'` o `'update'` e indica al sanitizador qué escritura hace el handler. Una llamada que lo omita no compila: no hay valor por defecto. El generador emite `'create'` para `create` y `createBatch`, y `'update'` para `updateById`, `update` y `upsert`. `@Format` no recibe `operation`: la dirección de lectura no tiene operaciones de escritura. La operación importa en agregados con propiedades que se escriben una sola vez o nunca, porque el sanitizador rechaza la clave del payload con un `400` en lugar de descartarla en silencio. Consulta [Escribibilidad de propiedades](../../../concepts/backend/property-writability/).

   **`@Sanitize` casi nunca se escribe suelto.** El CLI no lo emite: todo handler de escritura que genera devuelve la entidad, así que lleva `@ApplySchema`. Y `@ApplySchema` lo compone internamente — `applyDecorators(Format(schema), Sanitize({ schema, payloadIndex, operation }))` — de modo que la sanitización ya corre ahí. Aplica `@Sanitize` a mano solo en un handler de escritura cuyo retorno no sea la entidad. Si lees `@Sanitize` en un comentario del código o en el nombre de un test, se refiere a esa rama interna de `@ApplySchema`, no a un decorador escrito aparte.

2. **Cablea `@ApplySchema` en un handler de escritura que devuelve la entidad.** Ejemplo real desde `iam/tag`:

   ```typescript
   import { ApplySchema, EmitEvent } from '@aurorajs.dev/core-back';
   import { IamTagFieldSchema } from '@app/iam/tag/domain/index.js';

   @EmitEvent('iam.tag.created')
   @ApplySchema({ schema: IamTagFieldSchema, operation: 'create' })
   async main(payload: IamCreateTagInput, handlerMeta?: HandlerMeta): Promise<IamTag> {
     await this.createService.main(payload, handlerMeta);
     return await this.findByIdService.main(payload.id, {}, handlerMeta);
   }
   ```

   `sanitize` corre sobre `payload` ANTES de que se ejecute `main()` — en `iam/user`, por ejemplo, ahí es donde `type: 'password'` convierte el texto plano en un hash bcrypt. `format` corre sobre el retorno DESPUÉS de que `main()` resuelva — ahí `password` se vuelve `undefined` antes de salir al cliente.

3. **Cablea `@Format` en un handler de lectura.**

   ```typescript
   import { Format } from '@aurorajs.dev/core-back';

   @Format(IamTagFieldSchema)
   async main(id: string, constraint?: QueryStatement, handlerMeta?: HandlerMeta): Promise<IamTag> {
     const tag = await this.findByIdService.main(id, constraint, handlerMeta);
     if (!tag) throw new NotFoundException(`IamTag with id: ${id}, not found`);
     return tag;
   }
   ```

   `@Format` detecta automáticamente la forma del retorno — objeto individual, array o `Pagination` con una lista `.rows` — y formatea cada elemento.

4. **Si el payload no es el primer argumento, usa la forma de objeto.**

   ```typescript
   @ApplySchema({ schema: IamTagFieldSchema, payloadIndex: 1, operation: 'update' })
   async main(constraint, payload, handlerMeta?) { … }
   ```

   Misma opción en `@Sanitize`. `@Format` no tiene `payloadIndex` — siempre opera sobre el retorno.

5. **En handlers de update, calcula el delta con `Obj.diffAtomic`.** Tras la sanitización, persiste solo lo que cambió. Uso real en `iam-update-tag-by-id.handler.ts`:

   ```typescript
   import { Obj } from '@aurorajs.dev/core-back';

   const tag = await this.findByIdService.main(payload.id, constraint, handlerMeta);
   if (!tag) throw new NotFoundException(`IamTag with id: ${payload.id}, not found`);

   const dataToUpdate = Obj.diffAtomic(payload, tag);

   await this.updateByIdService.main(
     { ...dataToUpdate, id: payload.id }, // reinyecta el id — el diff omite claves coincidentes
     constraint,
     handlerMeta,
   );
   ```

   `Obj.diffAtomic` omite las claves cuyo valor coincide en ambos lados, así que el `id` hay que volver a añadirlo explícitamente como clave objetivo. Usa esta función y no `Obj.diff`: una propiedad es una columna, así que un array o un valor `jsonb` modificado debe emitirse completo. `Obj.diff` emitiría solo el fragmento cambiado y sobrescribiría la columna con él.

6. **Ajusta el decorador en un handler generado de `additionalApis`.** El handler de mutación que se genera para una entrada de `additionalApis` llega ya con `@ApplySchema({ schema, operation: 'update' })`. La operación es fija, no se deduce de lo que hace el handler, así que revísala:

   - Cambia `operation` a `'create'` si el handler solo inserta.
   - Añade `payloadIndex: N` si el payload no es el argumento 0.
   - Quita el decorador si el payload ya no tiene forma de agregado. No es un detalle estético: un payload primitivo llega estropeado, porque el pipeline lo copia con un spread.
   - Una API adicional de tipo query no recibe decorador.

7. **Trata `decimal` como un número de JavaScript en ambas direcciones.** Una propiedad `decimal` es un `number` al leer y al escribir, con un máximo de 15 dígitos significativos. `@Format` convierte la cadena numérica que devuelve la base de datos (`"21.00"`) en número, de modo que un registro que lees y reenvías sin cambios pasa la validación de escritura. Valida los decimales solo como números. Si una YAML declara `decimals: [precision, scale]` con una precisión mayor que 15, `catalyst generate` aborta al cargar el esquema: baja la precisión en la YAML.

## Verifica que funcionó

- Para un campo `type: 'password'`, crea un usuario e inspecciona la fila: la columna guarda un hash bcrypt, nunca texto plano. Vuelve a leerlo — la clave `password` no aparece en la respuesta.
- Para `maxLength`, `enumOptions` o `nullable`, envía un payload que viole la restricción. El decorador lanza antes de que `main()` se ejecute.
- Los timestamps del retorno llevan la timezone del caller. Esa es la señal de que `@Format` / `@ApplySchema` extrajo `handlerMeta.timezone` — una llamada directa a `formatRecord()` la perdería.

## Solución de problemas

**Una relación devuelve un campo sensible sin enmascarar.** `@Format` entra recursivamente en toda relación declarada como entrada `relation` del field schema, así que un secreto anidado también se enmascara. Una relación que no está en el field schema no se puede consultar, de modo que nunca llega al formateador. Mira [Componer un QueryStatement](../query-with-querystatement/#cargar-relaciones-de-forma-segura).

**La validación corre dos veces** — una en el decorador y otra dentro de `main()`. Elimina la comprobación del handler. `@ApplySchema` ya aplicó `maxLength`, `nullable`, `enumOptions` y las `rules` declaradas. Deja solo reglas de negocio que la FieldSchema no pueda expresar (invariantes entre campos, cálculos de dominio).

**Recurres a un Value Object para encapsular la validación.** Catalyst no tiene capa de VO — la validación y la modificación se delegan completamente a `FieldSchema` + type handlers vía `@ApplySchema`. Expresa la regla en `aggregateProperties` de la YAML y regenera.

**Llamada directa a `formatRecord()` o `sanitizeRecord()`.** Evítala. El decorador cablea `handlerMeta.timezone` y otras opciones automáticamente; una llamada directa pierde ese contexto y produce output inconsistente.

## Relacionado

- [Scaffolding de un módulo backend](../../../concepts/backend/module-scaffolding/) — por qué `*.field-schema.ts` se genera desde YAML y no se edita a mano.
- [Escribibilidad de propiedades](../../../concepts/backend/property-writability/) — qué hacen `readOnly` y `createOnly` con el payload que sanitiza el decorador.
- [Componer un QueryStatement](../query-with-querystatement/) — el lado de consulta de la capa declarativa de acceso a datos.
