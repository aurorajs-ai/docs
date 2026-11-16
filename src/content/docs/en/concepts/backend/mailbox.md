---
title: Mailbox catalog and reader port
description: How the tools bounded context keeps a catalog of e-mail addresses the platform reads and sends from, how a consumer reaches them by id, and how the neutral reading port hides Microsoft 365, Google and IMAP.
---

## Why this exists

A bounded context often has to ingest attachments from an inbox or send mail from a company address, and an administrator, not a developer, decides which account that is. If each context stored its own connection, credentials would be scattered across aggregates and every provider's protocol would leak into business code.

The mailbox capability of the `tools` bounded context fixes both. One catalog row is one address the platform logs into, and consumers refer to it by id. Provider details stay behind a neutral port.

## How it works

### The catalog

A `ToolsMailbox` row is one e-mail address, unique across the catalog. It has two independent directions, each with its own provider, secret and status:

| Direction | Providers | Used for |
| --- | --- | --- |
| Inbound (read) | `MICROSOFT_365`, `IMAP`, `GOOGLE` | Listing messages, downloading attachments, moving messages |
| Outbound (send) | `SMTP`, `MICROSOFT_365`, `GOOGLE` | Sending mail as that address |

A direction with no provider is off, and its secret and status are cleared. SMTP only sends and IMAP only reads, which is why the two provider sets differ.

Each direction keeps a JSON **secret**, encrypted at rest and masked on every read. It is validated on save by the provider's own parser, the same function the adapter runs when it connects, so the stored format and the validator cannot drift. The form offers a template per provider, and an empty secret on update keeps the stored one.

A direction's **status** is maintained by the server: `CONFIGURED` (a valid secret was saved, never tested), `VERIFIED` (the last test succeeded) or `CONNECTION_ERROR` (the last test failed, or a consumer reported rejected credentials). An unsaved form can be tested without writing anything.

### Referencing a mailbox

A consumer stores only the mailbox `id`, as a real foreign key (`mailboxId`), and never a connection of its own. Two ports, registered globally through `BridgesModule`, serve it:

- **`TOOLS_MAILBOX_INBOUND`** resolves an id to a ready connection, or to the reason it is unusable (`NOT_CONFIGURED`, `CONNECTION_ERROR`, `UNDECRYPTABLE`). The connection carries the decrypted secret: the consumer passes it to the reader and never logs, stores or returns it. When the reader rejects the credentials, the consumer calls `reportCredentialsRejected`, which flips the status to `CONNECTION_ERROR` and answers `true` to exactly one of several concurrent callers, so a notice goes out once.
- **`TOOLS_MAILBOX_SENDER`** sends mail through a mailbox id. It is fully wrapped: the secret never leaves `tools`. There is no `from`, because the sender is always the mailbox's own address, under its configured display name. `html` is required.

An unknown id is a caller bug and is rejected with a not-found error, not a result.

### The neutral reading port

`MailboxReaderService` is the single reading port. A dispatcher routes each call by the connection's provider, and no provider or protocol type ever crosses the port; a test enforces that isolation. The connection arrives on every call, so the port never learns which business entity owns the mailbox.

| Operation | What it does |
| --- | --- |
| `listMessages(connection, folder)` | Lists the pending messages of a folder, each with its subject, sender, received time and attachments. |
| `getAttachmentContent(connection, messageRef, attachmentRef)` | Downloads one attachment. |
| `moveMessage(connection, messageRef, destinationFolder)` | Moves a message to another folder. |
| `testConnection(connection, folders)` | Authenticates, reaches the mailbox and resolves every named folder, touching no message. |
| `ensureFolder(connection, folder)` | Creates the last segment of a folder path if missing and answers whether it did. A missing parent is an error: parents are never created recursively. |

Folders are `/`-separated paths of display names, and a first segment `Inbox` always denotes the inbox. A message is **pending** while it stays in its source folder: the read flag is never used, so moving a processed message out is how a consumer marks it done. A message is identified by its `internetMessageId` (the RFC 5322 Message-ID), which is stable across folders and protocols. The `messageRef` is valid only while the message stays in its folder, because a provider may reassign it on a move.

Failures are one type, `MailboxReaderError`, with a category code (`INVALID_CREDENTIALS`, `MAILBOX_UNREACHABLE`, `FOLDER_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `PROVIDER_UNAVAILABLE`, `UNEXPECTED_RESPONSE`). Consumers switch on the code. A message never carries a secret, a token or a provider response body.

### The IMAP adapter

The IMAP adapter uses `imapflow`. Its secret is `{ host, port, secure, username, password }`. TLS is mandatory: implicit TLS when `secure` is true, otherwise STARTTLS that must succeed, and the certificate is always verified. Folder paths use `/` in the port and are mapped to the server's own delimiter. Its message reference encodes the folder, the UIDVALIDITY and the UID, so a reference from before a mailbox was rebuilt is not found rather than pointing at a different message.

## When it applies

- A bounded context ingests documents from an inbox an administrator configures.
- A bounded context sends mail from a specific company address rather than the platform's system mailer.

## Trade-offs and limits

- System mail (password reset, notices) stays in the platform mailer and is not part of this catalog.
- Sending needs `MAILER_ENABLED=true`. Without it the platform boots, and a send fails with a service-unavailable error. Inbound reading does not need the mailer.
- Microsoft 365 needs a Graph app registration with the application permission for the direction in use. Google needs a service account with domain-wide delegation for the `https://mail.google.com/` scope.
- Assigning the `tools.mailbox.*` permissions to roles is manual.

## Related

- [Cross-bounded-context ports](../cross-bounded-context-ports/) — why the consumer injects a token.
- [File storage](../file-storage/) — the same catalog pattern for writing files.
