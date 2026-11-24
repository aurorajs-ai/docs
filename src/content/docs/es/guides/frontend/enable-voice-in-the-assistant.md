---
title: Activar la voz en el asistente
description: "Activa el canal de voz del asistente en una instalación: elige un modo de escucha, configura el proveedor de voz (ElevenLabs o un perfil local) con sus variables de entorno y comprueba un turno hablado."
---

## Objetivo

Que los usuarios puedan hablar con el asistente de ayuda y oír sus respuestas, con el perfil de servicio de ElevenLabs o con el perfil local.

## Antes de empezar

- Una aplicación con el paquete `tools` instalado y el asistente funcionando por texto: `tools.assistant.isEnabled` es `true` y el rol del usuario tiene `tools.assistant.ask`. Mira [Acceso y coste](../../../concepts/frontend/guided-actions/#acceso-y-coste).
- La aplicación servida por HTTPS, o abierta en `localhost` (el micrófono requiere un contexto seguro).
- Para el perfil de servicio, una clave de API de ElevenLabs. Para el perfil local, las tres piezas locales del paso 3.

## Pasos

1. **Elige los modos de escucha.** Pon uno o los dos ajustes clave-valor al booleano `true` (cualquier otro valor cuenta como apagado):

   | Clave | Ofrece |
   | --- | --- |
   | `tools.assistant.isPushToTalkEnabled` | Mantener pulsado el botón para hablar, un intercambio por pulsación |
   | `tools.assistant.isHandsFreeEnabled` | Un clic abre una sesión continua |

   Las dos claves vienen vacías, así que ninguna instalación muestra el botón de voz hasta que pongas una.

2. **Perfil de servicio: configura la clave y la voz.** Es el enlace por defecto. Pon la clave en el entorno del backend y la voz en clave-valor:

   ```bash
   ELEVENLABS_API_KEY=<tu clave>
   ```

   Pon en `tools.assistant.voiceId` la voz de ElevenLabs con la que habla el asistente. La clave se lee en cada llamada y nunca al arrancar, así que el backend arranca sin ella y, si falta, la llamada falla nombrando la variable.

3. **Perfil local: prepara los modelos y el servidor.** Todo corre en el propio equipo de la instalación, sin acceso a la red.

   - **Voz a texto** (Whisper `large-v3-turbo`, int8, unos 1,5 GB). Un directorio con `turbo-encoder.int8.onnx`, `turbo-decoder.int8.onnx` y `turbo-tokens.txt`.
   - **Texto a voz** (voz en español `vits-coqui-es-css10`, unos 145 MB). Un directorio con `model.onnx` y `tokens.txt`.
   - **Modelo.** Un servidor compatible con OpenAI en el mismo equipo, por ejemplo LM Studio, con el modelo cargado y la longitud de contexto fijada de forma explícita. Pon el id del modelo en `tools.assistant.model` y añade el id con el que responde el servidor a `tools.assistant.models` como `SELF_HOSTED` con ambos precios en 0; si no, sus turnos guardan alojamiento y coste vacíos. El modelo guardado es el que devuelve el servidor, que puede diferir del id solicitado.

   Indica al backend dónde están:

   ```bash
   TOOLS_ASSISTANT_LOCAL_STT_MODEL_DIR=/ruta/a/whisper-turbo
   TOOLS_ASSISTANT_LOCAL_TTS_MODEL_DIR=/ruta/a/vits-es
   TOOLS_ASSISTANT_LOCAL_MODEL_URL=http://localhost:1234/v1
   ```

   Los modelos viven fuera del repositorio. Los motores se cargan con la primera frase y se reutilizan, así que el primer turno es más lento. En macOS con Apple silicon no hace falta ninguna variable de ruta de bibliotecas; en Linux, comprueba que carga el paquete de plataforma de `sherpa-onnx-node` antes de fiarte.

4. **Enlaza los adaptadores (solo perfil local).** En `backend/src/@config/tools-assistant/tools-assistant.providers.ts`, sustituye los tres valores de `useClass` por las clases locales. Cada puerto es independiente, así que puedes sustituir solo algunos:

   ```ts
   import {
     ToolsSherpaSpeechToTextService,
     ToolsSherpaTextToSpeechService,
   } from '@app/tools/sherpa/index.js';
   import { ToolsOpenAiCompatibleAssistantModelService } from '@app/tools/openai-compatible/index.js';

   export const toolsAssistantProviderBindings: Provider[] = [
     { provide: TOOLS_ASSISTANT_MODEL, useClass: ToolsOpenAiCompatibleAssistantModelService },
     { provide: TOOLS_ASSISTANT_STT, useClass: ToolsSherpaSpeechToTextService },
     { provide: TOOLS_ASSISTANT_TTS, useClass: ToolsSherpaTextToSpeechService },
   ];
   ```

   Elimina los imports de ElevenLabs y Anthropic que ya no uses.

5. **Reinicia el backend** para que se apliquen la semilla de claves-valor y los enlaces, y recarga la aplicación.

## Comprueba que funciona

- La entrada del chat muestra el botón de ondas cuando el área de texto está vacía. Una sesión muestra una píldora con «Cancelar» mientras se abre y «Detener» cuando ya escucha.
- Di una pregunta. La transcripción aparece como un mensaje, sigue la respuesta y la oyes.
- Con el perfil local, desconecta la red y repite: el turno debe completarse igualmente.

## Solución de problemas

- **No aparece el botón de ondas.** `tools.assistant.isEnabled` o las dos claves de modo no son literalmente `true`. El estado que lee el chat lleva ambas banderas.
- **El clic o la pulsación no abre nada y aparece una pista.** Solo está activo el otro modo; la pista indica el gesto válido.
- **La sesión termina al instante con «unavailable» o «unauthorized».** Hay un interruptor apagado, o la cuenta no tiene `tools.assistant.ask`.
- **Un error de voz nombra una variable de entorno.** Esa variable está vacía o falta: `ELEVENLABS_API_KEY`, o una de las tres `TOOLS_ASSISTANT_LOCAL_*`.
- **Con la voz local, números o símbolos suenan mal.** Descarta los caracteres fuera de su conjunto de símbolos; pide la cifra con palabras, o acepta el límite descrito en la página de concepto.
- **El modelo local tarda mucho en responder.** Un modelo grande puede necesitar decenas de segundos por turno; uno más pequeño responde antes pero con menos acierto.
- **LM Studio en el servidor de un cliente.** Sus términos de escritorio permiten el uso personal o interno de empresa y prohíben ofrecerlo como servicio; revísalos para tu caso, o usa otro servidor compatible con OpenAI como `llama-server`.

## Relacionado

- [Concepto: El canal de voz del asistente](../../../concepts/frontend/assistant-voice-channel/)
- [Cómo: Activar el asistente en un módulo](../enable-the-assistant-on-a-module/)
