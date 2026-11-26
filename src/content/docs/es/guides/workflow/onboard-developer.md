---
title: Incorporar a un desarrollador
description: Incorpora a un desarrollador a un proyecto Catalyst, nuevo o existente — entrada en el roster, clave SOPS, entorno local, daemon del despachador y primera tarea desde la asignación hasta el pull request.
---

## Objetivo

Dejar a un desarrollador trabajando sobre el tablero compartido: dado de alta en el roster, con su entorno local descifrado, con un daemon del despachador propio y con una primera tarea llevada hasta el pull request.

## Antes de empezar

- Lee una vez [El tablero con varios desarrolladores](../../../concepts/workflow/multi-developer-board/). Esta guía no repite por qué existe cada fichero.
- Una máquina macOS. El daemon del despachador es un agente `launchd`.
- Node 26 y `pnpm`.
- La CLI `catalyst`, instalada como en [Instalar el CLI de Aurora Catalyst](../../../tutorials/getting-started/install-cli/).
- La CLI del tablero, fijada a la versión que usa el workflow del grafo, y una sesión de GitHub:

  ```bash
  npm i -g backlog.md@1.57.4
  gh auth login
  ```

  `gh auth login` es la única credencial que usa el despachador para sus llamadas a GitHub. El daemon necesita además `npx`, `claude`, `openspec` y `catalyst` en el PATH; `pnpm backlog:daemon install` nombra cualquier binario que falte y se detiene. El camino B necesita también `sops` y `age`.

## Pasos

Elige el camino que corresponde a tu situación y continúa después con **Ambos caminos**.

### Camino A — un proyecto nuevo

A1. **Crea el proyecto.** Sigue [Instalar Aurora Catalyst](../../../tutorials/getting-started/install-aurora/) (`catalyst new my-project`). El comando incluye el workflow del grafo y un roster vacío, y crea la tarea `board:graph` después de la instalación. Falla si el binario `backlog` no está instalado.

A2. **Añádete al roster, crea el remoto y haz el primer push.** Sustituye `developers: []` en `.backlog/team.yaml`:

   ```yaml
   developers:
     - id: ana
       name: Ana Pérez
       email: ana@example.com
   ```

   Cada entrada tiene exactamente `id`, `name` y `email`; cualquier otra clave se rechaza. Después crea el repositorio en GitHub y sube `main`, incluido `.backlog/`:

   ```bash
   git add .backlog
   git commit -m "chore(backlog): add the first developer"
   gh repo create my-org/my-project --private --source . --remote origin
   git push -u origin main
   ```

   Ese primer push toca `.backlog/tasks/**`, así que lanza el workflow `backlog graph` del repositorio. Comprueba que GitHub Actions está activado en él.

### Camino B — un repositorio existente

B1. **Clona el repositorio.**

   ```bash
   git clone git@github.com:my-org/my-project.git
   cd my-project
   ```

B2. **Prepara un pull request de incorporación.** Lleva dos cambios y lo revisa el responsable del repositorio:

   - Tu entrada en `.backlog/team.yaml`, como en el paso A2.
   - Tu clave pública `age` como nuevo destinatario de `backend/.sops.yaml`. Crea antes el par de claves; se imprime la clave pública (`age1...`) y la privada queda en `backend/.keys/`, que está en `.gitignore`:

     ```bash
     mkdir -p backend/.keys
     age-keygen -o backend/.keys/age.txt
     ```

     Añade la clave pública a los destinatarios de la regla existente, como se describe en [Desplegar un proyecto en Coolify](../deploy-to-coolify/):

     ```yaml
     creation_rules:
       - age: >-
           age1ownerpublickey...,
           age1yourpublickey...
     ```

   Ábrelo con `gh pr create`. No subas nunca `backend/.keys/age.txt`.

B3. **Espera a que el responsable lo mergee y recifre.** Añadir un destinatario a `.sops.yaml` no modifica los ficheros que ya están cifrados. El responsable ejecuta `sops updatekeys` sobre cada fichero `backend/.env.<env>.enc` y sube el resultado. Después haz `git pull`.

### Ambos caminos — el entorno local

1. **Instala las dependencias.**

   ```bash
   pnpm install
   ```

2. **Crea `backend/.env` y `backend/.keys`.** Un proyecto creado en el paso A1 ya tiene ambos. En un clon:

   - Genera el par de claves de firma OAuth con `catalyst keys`; escribe en `backend/.keys/`.
   - Descifra el entorno que uses en local. Desde `backend/`, `catalyst env decrypt --env dev --config ../aurora.yaml` escribe `backend/.env.dev` y lee tu clave de `backend/.keys/age.txt`. Usa sus variables para `backend/.env` y apunta el bloque `DATABASE_*` a tu propia base de datos, como en [Instalar Aurora Catalyst](../../../tutorials/getting-started/install-aurora/).

   Arranca el proyecto con `pnpm dev` desde la raíz. Para el primer inicio de sesión, consulta [Añadir IAM + OAuth](../../../tutorials/getting-started/add-iam-oauth/).

3. **Instala tu daemon del despachador.** Desde el checkout principal, con `main` activa y sin cambios en ficheros versionados:

   ```bash
   pnpm backlog:daemon install --assignee @ana
   pnpm backlog:daemon status
   ```

   `install` comprueba el id contra `.backlog/team.yaml` (un id desconocido termina con error y no escribe nada), escribe `.backlog/.dispatch/assignee` y carga un agente para este repositorio. `status` muestra la identidad, la etiqueta `dev.aurora.backlog-dispatch.<repositorio>`, si está cargado y su directorio de trabajo.

4. **Toma tu primera tarea.** Una tarea es tuya cuando su assignee es `@<id>`:

   ```bash
   backlog task edit T-12 -a @ana
   ```

   Después elige cómo se ejecuta:

   - **Despachada.** Pásala a `Queued` (`backlog task edit T-12 -s Queued`). Tu daemon la toma en su siguiente pasada, en un máximo de cinco minutos o de inmediato tras el cambio de estado, y la trabaja en un worktree sobre la rama `task/T-12`. Una tarea encolada sin exactamente un assignee del roster pasa a `Blocked` con un comentario.
   - **Interactiva.** En Claude Code, ejecuta `/task T-12`. El Task Gate la pone en `In Progress` y te la asigna en una sola edición, crea el worktree sobre `task/T-12` y trabajas allí. Si la tarea es de otro desarrollador, el asistente pregunta antes de reasignarla.

   En ambos casos el trabajo termina con un pull request a `main`. Cuando se mergea, tu daemon pasa la tarea a `Done`.

## Comprueba que funcionó

- `pnpm backlog:daemon status` muestra tu id, `loaded` y el directorio de trabajo de este checkout.
- `pnpm backlog:graph` imprime la vista actual de dependencias sin escribir nada.
- Tu primera tarea llega a `In Progress`, con `@<id>` como único assignee, y después a `Done` cuando se mergea su pull request.
- El workflow `backlog graph` del repositorio se ejecutó tras tu primer push a `main`.

## Solución de problemas

- **`install` se detiene por un binario ausente.** Instálalo, abre un shell nuevo donde esté en el PATH y ejecuta `install` otra vez. Lo mismo vale tras actualizar Node o renombrar el checkout.
- **El despacho se detiene e informa del checkout principal.** La sincronización exige `main` activa y rechaza un fichero versionado modificado. Haz commit del cambio o descártalo; el trabajo se hace en worktrees, nunca en el checkout principal.
- **Una tarea encolada está en `Blocked`.** Lee su comentario. Nombra la causa: sin assignee, dos assignees o un id fuera del roster. Corrige el assignee y vuelve a pasar la tarea a `Queued`.
- **`sops` no descifra tras mergear el pull request de incorporación.** El responsable aún no ha recifrado los ficheros para tu clave; pídele `sops updatekeys`.

## Relacionado

- [Concepto: El tablero con varios desarrolladores](../../../concepts/workflow/multi-developer-board/)
- [Instalar y actualizar paquetes](../install-and-upgrade-packages/)
