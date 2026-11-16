---
title: Declare a bounded context's queues
description: Declare the BullMQ queues a bounded context owns with QueueDeclarationModule.forFeature, so the queue manager discovers them at boot.
---

## Goal

Declare, inside your own bounded context (BC), the BullMQ queues it owns, so that `queue-manager` discovers them at boot and no other package has to list them.

## Before you start

- Your BC already registers its queues in its own queue module (the one that calls `BullModule.registerQueueAsync`).
- You know each queue's name, the number of jobs one worker processes in parallel, and how long finished jobs are kept.
- The `queue-manager` package is the collector. Without it a declaration is inert: importing it does nothing. It can be installed before or after the package that owns the queues.

## Steps

1. **Write one `QueueDeclaration` per queue.** All fields are required; a declaration missing any of them fails to type-check.

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

   `retention.completed` and `retention.failed` are `{ count?, age? }` windows: keep at most `count` finished jobs, and/or for at most `age` seconds.

2. **Build the declaration from the constants you already have.** Use the same constants that register the queue and configure its worker, so name, retention and concurrency are written once.

3. **Import `QueueDeclarationModule.forFeature` in the BC's queue module.**

   ```ts
   @Module({
     imports: [
       QueueDeclarationModule.forFeature(sapQueueDeclarations),
       BullModule.registerQueueAsync({ name: SAP_SYNC_QUEUE /* ... */ }),
     ],
   })
   export class SapQueueModule {}
   ```

4. **Pass a static array.** `forFeature` provides the value with `useValue`, and the collector finds it through `DiscoveryService`, which only sees instances that exist when the module graph is scanned. A declaration built by a factory (for example from `ConfigService`) is invisible.

5. **Export the queue module from the package.** In a package manifest, list the file stem of the queue module under the backend `queues` key, so the queue barrel under `src/@config/bullmq/` exports it. See [Package manifest](../../../reference/package-manifest/).

## Verify it worked

- Boot the backend. The queue appears in the queue manager with the concurrency and retention you declared.
- Declare the same queue name twice, from one BC or from two: the boot fails with an error that names the queue. A queue name must be unique across the whole application.

## Troubleshooting

**The queue does not show up in the queue manager.** Check that `queue-manager` is installed and that the application imports your queue module. Then check that the declaration is a static array, not the result of a factory.

**The boot fails naming a queue.** Two declarations use the same `name`. Rename one of them.

**TypeScript rejects the declaration.** A field is missing: `name`, `concurrency`, `retention.completed` and `retention.failed` are all required.

## Related

- [Package manifest](../../../reference/package-manifest/) — the `queues` key of the backend half.
- [Install and upgrade packages](../../workflow/install-and-upgrade-packages/) — `catalyst add` and the order of installation.
