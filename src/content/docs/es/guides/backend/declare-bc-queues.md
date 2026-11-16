---
title: Declarar las colas de un bounded context
description: Declara las colas BullMQ que posee un bounded context con QueueDeclarationModule.forFeature, para que el queue manager las descubra al arrancar.
---

## Objetivo

Declarar, dentro de tu propio bounded context (BC), las colas BullMQ que posee, para que `queue-manager` las descubra al arrancar y ningún otro paquete tenga que listarlas.

## Antes de empezar

- Tu BC ya registra sus colas en su propio módulo de colas (el que llama a `BullModule.registerQueueAsync`).
- Conoces el nombre de cada cola, cuántos jobs procesa en paralelo un worker y cuánto tiempo se conservan los jobs terminados.
- El paquete `queue-manager` es el recolector. Sin él, una declaración es inerte: importarla no hace nada. Puede instalarse antes o después del paquete que posee las colas.

## Pasos

1. **Escribe una `QueueDeclaration` por cola.** Todos los campos son obligatorios; una declaración a la que le falte alguno no compila.

   ```ts
   import { QueueDeclaration } from '@aurora/modules/queue-declaration/index.js';

   export const sapQueueDeclarations: QueueDeclaration[] = [
     {
       name: SAP_SYNC_QUEUE,
       concurrency: 2,
       retention: {
         completed: { count: 100, age: 3600 },
         failed: { count: 500 },
       },
     },
   ];
   ```

   `retention.completed` y `retention.failed` son ventanas `{ count?, age? }`: se conservan como máximo `count` jobs terminados, y/o durante como máximo `age` segundos.

2. **Construye la declaración con las constantes que ya tienes.** Usa las mismas constantes que registran la cola y configuran su worker, de modo que nombre, retención y concurrencia se escriban una sola vez.

3. **Importa `QueueDeclarationModule.forFeature` en el módulo de colas del BC.**

   ```ts
   @Module({
     imports: [
       QueueDeclarationModule.forFeature(sapQueueDeclarations),
       BullModule.registerQueueAsync({ name: SAP_SYNC_QUEUE /* ... */ }),
     ],
   })
   export class SapQueueModule {}
   ```

4. **Pasa un array estático.** `forFeature` proporciona el valor con `useValue`, y el recolector lo encuentra mediante `DiscoveryService`, que solo ve las instancias que existen cuando se escanea el grafo de módulos. Una declaración construida con una factory (por ejemplo desde `ConfigService`) resulta invisible.

5. **Exporta el módulo de colas desde el paquete.** En un manifiesto de paquete, indica el nombre de archivo (sin extensión) del módulo de colas en la clave `queues` del backend, para que el barrel de colas bajo `src/@config/bullmq/` lo exporte. Consulta [Manifiesto de paquete](../../../reference/package-manifest/).

## Verifica que funciona

- Arranca el backend. La cola aparece en el queue manager con la concurrencia y la retención que declaraste.
- Declara dos veces el mismo nombre de cola, desde un BC o desde dos: el arranque falla con un error que nombra la cola. Un nombre de cola debe ser único en toda la aplicación.

## Solución de problemas

**La cola no aparece en el queue manager.** Comprueba que `queue-manager` está instalado y que la aplicación importa tu módulo de colas. Después comprueba que la declaración es un array estático y no el resultado de una factory.

**El arranque falla nombrando una cola.** Dos declaraciones usan el mismo `name`. Renombra una de ellas.

**TypeScript rechaza la declaración.** Falta un campo: `name`, `concurrency`, `retention.completed` y `retention.failed` son obligatorios.

## Relacionado

- [Manifiesto de paquete](../../../reference/package-manifest/) — la clave `queues` de la mitad backend.
- [Instalar y actualizar paquetes](../../workflow/install-and-upgrade-packages/) — `catalyst add` y el orden de instalación.
