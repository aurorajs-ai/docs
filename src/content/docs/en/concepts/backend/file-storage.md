---
title: File storage catalog
description: How the tools bounded context keeps a catalog of external storages the platform writes files to, how a consumer references one by id, and how the write-only port hides the provider.
---

## Why this exists

Some processes must archive or deliver a file to an external server: a scanned invoice to a customer's SFTP, a monthly export to a shared drive. The server and its credentials are an administrator's decision. If each aggregate stored its own connection, secrets would spread across tables and every bounded context would carry transport code.

The file storage capability of the `tools` bounded context keeps one catalog row per remote place. A consumer stores only the row's id and writes through a port that never exposes the secret.

## How it works

### The catalog

A `ToolsFileStorage` row is one remote endpoint the platform logs into, with a provider (`SFTP` is the only one implemented), an encrypted JSON secret and a status. "File storage" here is a remote endpoint, not a mounted network share.

- The **secret** is validated on save by the provider's own parser, the function `write` runs first, so format and validator cannot drift. The error names the failing field, never its value. It is encrypted at rest, masked on every read and never handed to another bounded context. An empty secret on update keeps the stored one, and changing the provider requires a new secret in the same request.
- The **status** is maintained by the server: `CONFIGURED` (a valid secret was saved, never tested), `VERIFIED` (the last connection test succeeded) or `CONNECTION_ERROR` (the last test failed). A failed write does not change the status.
- An SFTP secret holds `host`, `port`, an optional `timeoutSeconds` (an inactivity window, default 20), a `basePath`, a mandatory `hostKeyFingerprint` and a password credential. The host key is verified before authentication, and credentials are always explicit: nothing is read from the environment.

### Testing a connection

The test by id writes a probe file to the storage and records `VERIFIED` or `CONNECTION_ERROR`. A refused credential is the answer (`success: false`), not an exception, and the probe is never deleted. It is the only path that changes the status.

A form that has not been saved can be tested with the provider and the plaintext secret. That test validates the secret with the same parser as a save, writes no record and never echoes the secret. It needs the create or update permission. Changes to the address or provider that were not saved are ignored by the id-based test.

### Writing a file

A consumer injects `TOOLS_FILE_STORAGE_WRITER` and calls:

- `write(fileStorageId, { path, content, onConflict })`. The `path` is relative to the storage root and already validated by the caller. `content` is a stream. `onConflict` is `'fail'` or `'overwrite'`, explicit on every request with no default. A write is complete or absent at the target name. The result is `{ path, providerRef? }`.
- `testConnection(fileStorageId)`.

Expected failures reject with `FileStorageError`, whose `code` is one of `INVALID_SECRET`, `INVALID_CREDENTIALS`, `HOST_KEY_MISMATCH`, `CONNECTION_FAILED`, `WRITE_FAILED` or `TARGET_EXISTS`, and whose `kind` (`CONFIGURATION`, `TRANSPORT` or `CONFLICT`) follows from the code. Messages never carry secret values, host keys or library text. An unknown id rejects with a not-found error.

### Referencing a storage

The consumer declares `<name>FileStorageId` in its module YAML as a many-to-one relationship to `ToolsFileStorage`, with `avoidConstraint: false` and `onDelete: restrict`, so the foreign key is real. Deleting a storage that is in use is refused with a conflict error (`tools.error.fileStorageInUse`): unlink it first. The `tools` context never names its consumers.

## When it applies

- A bounded context archives or delivers a generated file to an external SFTP server an administrator configures.
- You want connection credentials in one encrypted place, not on each aggregate.

## Trade-offs and limits

- The catalog is write-only. There is no listing, reading, downloading, folder operation or deletion of written files. To show a file to a user, use `storage-account` and its signed URL: an SFTP server cannot give a browser a URL.
- The adapter never retries, because a stream can be read only once. Retries belong to the caller's job.
- Rotating the platform's key pair makes stored secrets unrecoverable. Saving a new secret fixes it.
- The generated bulk update, batch create and upsert are excluded for this module: only `updateById` exists. A client payload can never set `status`.
- Assigning the `tools.fileStorage.*` permissions to roles is manual. A role that edits a consumer linking a storage needs `get`.

## Related

- [Mailbox catalog and reader port](../mailbox/) — the same pattern for e-mail.
- [Cross-bounded-context ports](../cross-bounded-context-ports/)
