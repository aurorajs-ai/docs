---
title: Despliegue en Coolify
description: Cómo catalyst provision, pipeline, deploy y backup llevan un proyecto desde aurora.yaml hasta un servidor Coolify endurecido que ejecuta el frontend y el backend, y por qué el servidor y la aplicación se declaran por separado del despliegue.
---

## Por qué existe

Llevar un proyecto generado a un servidor significaba servidores montados a mano, workflows copiados y secretos pegados en paneles, nada de ello reproducible. Dos proyectos en un mismo servidor se pisaban la configuración, y nadie podía saber si un servidor seguía coincidiendo con lo que el equipo creía.

Ahora la CLI trata el despliegue como una declaración. `aurora.yaml` establece cómo deben ser el servidor, los entornos y las copias de seguridad. `catalyst provision` hace que el servidor coincida con ella, `catalyst pipeline` escribe los archivos de CI y `catalyst deploy` dispara una publicación. Hoy solo existe el proveedor `coolify`.

## Cómo funciona

### Tres capas, tres comandos

| Capa | Qué contiene | Quién la escribe |
| --- | --- | --- |
| **Servidor** | Un host Ubuntu endurecido con Docker y un Coolify fijado | `catalyst provision` |
| **Aplicación** | Por entorno: un proyecto de Coolify, PostgreSQL, Redis opcional, una aplicación de backend y otra de frontend, un volumen para subidas, variables y el disparador de despliegue | `catalyst provision` |
| **Publicación** | Las imágenes y el propio despliegue | El workflow de CI de `catalyst pipeline`, iniciado por `catalyst deploy` |

**La capa de servidor** deja un host con las actualizaciones de seguridad aplicadas y las actualizaciones desatendidas activas, una ventana opcional de reinicio automático, SSH solo con clave, `fail2ban`, un cortafuegos que solo deja pasar el puerto SSH y los puertos 80 y 443 (también para los puertos publicados por Docker), redes de Docker tomadas de un rango de direcciones declarado, Docker y Coolify en una versión exacta con la actualización automática de Coolify desactivada, y la API de Coolify accesible solo desde el propio servidor. El panel de Coolify no se expone: provision imprime el comando de túnel SSH que lo alcanza desde tu portátil.

**La capa de aplicación** crea únicamente lo que `aurora.yaml` declara para cada entorno. La CLI nunca lee los paquetes instalados ni el remoto de Git para decidir: existe una base de datos porque se declara `back.database`, y Redis porque se declara `back.redis: true`. Las variables de ejecución del backend salen de un archivo cifrado del repositorio (`.env.<env>.enc`, SOPS con una clave age) que `provision` descifra en memoria en tu portátil, más las que deriva la propia CLI (el par de claves OAuth y los valores de conexión a la base de datos y a Redis). La aplicación contiene exactamente esa unión: una variable añadida a mano en el panel se elimina en la siguiente ejecución.

**La capa de publicación** se construye en GitHub Actions. El workflow generado construye las imágenes de la mitad que cambió, las sube a GitHub Container Registry como `<image>:<sha>` y se conecta al servidor por SSH para iniciar el despliegue de Coolify de esa aplicación. La imagen del backend se ejecuta bajo PM2. `catalyst deploy` solo sube la rama de origen del entorno a `environments/<env>`, que es el disparador del workflow.

### Cómo se permite a CI desplegar

`provision` crea en el servidor una cuenta `catalyst-deploy`: contraseña bloqueada, sin sudo y sin acceso a Docker. Guarda una clave restringida por proyecto y entorno, y cada conexión ejecuta un único comando forzado que acepta exactamente `backend` o `frontend`, inicia el despliegue de esa aplicación y espera el resultado. El token de Coolify que usa vive en el servidor y nunca en GitHub. Dos proyectos en un mismo servidor no colisionan, porque cada entrada se identifica por `<project>.<env>`.

### Idempotente y auditable

Ejecutar `provision` de nuevo sobre una declaración sin cambios no informa de ningún cambio. `catalyst provision audit` compara el servidor con las declaraciones y no cambia nada: informa de la deriva (una regla de cortafuegos añadida a mano, un temporizador editado, una clave de más), sondea los puertos desde fuera y termina con código distinto de cero cuando el servidor se desvió. El siguiente `provision` elimina la deriva.

### Copias de seguridad

Un entorno puede declarar copias de seguridad programadas, fuera del servidor, de su base de datos y de sus archivos subidos. Un temporizador del servidor toma cada copia, la sube a un destino (S3, Azure, GCS, SFTP o FTPS), la verifica y borra las copias más antiguas que la retención. `catalyst backup list`, `run` y `restore` operan sobre ellas. La [referencia de despliegue](../../../reference/aurora-yaml-deployment/) lista los campos del destino.

## Cuándo aplica

- Despliegas en un servidor que controlas un proyecto creado con `catalyst new`.
- Quieres un segundo entorno, o un segundo proyecto en el mismo servidor.
- Necesitas saber si un servidor sigue coincidiendo con lo que declaró el equipo.

## Compromisos y límites

- GitHub debe alcanzar el servidor por SSH, porque el workflow se ejecuta en un runner alojado por GitHub. Restringir SSH a una VPN o a direcciones fijas rompe los despliegues.
- Coolify escribe las variables descifradas en claro en sus propios archivos del servidor en cada despliegue, legibles solo por root y Coolify, y `docker inspect` las muestra.
- Sin un dominio declarado, Coolify genera una dirección `http://` que se sirve solo por HTTP. Usa un dominio declarado para tener HTTPS.
- Un cambio en una aplicación ya desplegada se aplica en su siguiente despliegue: `provision` nunca despliega.
- `restore` reemplaza datos sin pedir confirmación, y la importación de bases de datos de Coolify rechaza volcados de más de 10 GiB.
- Perder la contraseña de cifrado de las copias supone perder todas las copias cifradas.

## Relacionado

- [Guía: Desplegar en Coolify](../../../guides/workflow/deploy-to-coolify/)
- [Referencia: claves de despliegue de aurora.yaml](../../../reference/aurora-yaml-deployment/)
- [Referencia de la CLI: provision](../../../reference/cli-commands/provision/), [pipeline](../../../reference/cli-commands/pipeline/), [deploy](../../../reference/cli-commands/deploy/), [backup](../../../reference/cli-commands/backup/)
