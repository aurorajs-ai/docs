---
title: El canal de voz del asistente
description: Cómo el asistente de ayuda acepta preguntas habladas y pronuncia sus respuestas sin un segundo camino de consulta, por qué la voz va detrás de dos puertos neutrales y qué no hace a propósito el canal de voz.
---

## Por qué existe

Hay personas que no pueden teclear mientras trabajan: un operario de almacén con las dos manos ocupadas, o alguien en planta con guantes. Otras simplemente prefieren hablar. Y hay instalaciones que no pueden enviar audio ni preguntas a un proveedor en la nube.

El canal de voz da al asistente de ayuda una forma hablada de entrada y de salida. Cambia la **forma** de la conversación, nunca sus **capacidades**: una pregunta hablada se consulta, se contabiliza, se limita y se responde igual que una escrita, y el asistente sigue sin guardar, enviar, crear, editar ni borrar nada. Lo que sí puede hacer el asistente está en [Acciones guiadas y formularios asistidos](../guided-actions/).

## Cómo funciona

### Dos extremos, una sola consulta

El chat ya orquesta una pregunta: busca en el manual, toma las instantáneas del formulario y de la pantalla, envía la pregunta y aplica la respuesta. La voz no añade un segundo camino al lado. Añade solo los dos extremos:

1. **Entrada.** El navegador captura la frase y la envía por un socket a la pasarela (gateway) `/tools-assistant-voice`. La pasarela solo la transcribe (voz a texto, STT) y devuelve la transcripción final. El chat la muestra como un mensaje normal y la consulta por el mismo camino que una pregunta escrita. Por eso la cuota, las defensas y el turno guardado son los mismos.
2. **Salida.** Cuando llega la respuesta, el chat envía `voice:speak` con el `turnId` del turno guardado. La pasarela lee ese turno, filtrado por su id **y** por la cuenta del token, y pronuncia solo su `answer` (texto a voz, TTS).

```text
navegador                         pasarela /tools-assistant-voice       proveedor
frase ── voice:phrase ──────────▶ STT ─────────────────────────────────▶
      ◀── voice:transcript ────── transcripción final
ask(transcripción)  (mismo camino que escrito: búsqueda, instantáneas, mutación)
respuesta (turnId) ── voice:speak ▶ lee el turno de la cuenta del token
                                  TTS ─────────────────────────────────▶
      ◀── voice:audio / voice:audio-end ── PCM16 24 kHz
```

Pronunciar por `turnId` y no por texto significa que el socket nunca es un servicio de TTS libre: solo puede leer en voz alta lo que el propio asistente respondió a esa cuenta. Las citas y las acciones siguen siendo botones del chat; nunca se pronuncian ni se ejecutan por voz.

### El socket y sus comprobaciones

El handshake autentica el token de acceso como el resto de la plataforma y además exige el permiso `tools.assistant.ask`. No existe ningún permiso nuevo. La sesión se rechaza salvo que `tools.assistant.isEnabled` y al menos una clave de modo valgan `true`.

Cada mensaje vuelve a comprobar el token, el permiso y los interruptores. Si el token caducó o se revocó, o se retiró el permiso, la sesión termina con `voice:session-ended` (motivo `unauthorized`); si se apagaron los interruptores, con el motivo `unavailable`. Una frase dura como máximo 30 segundos y un socket atiende una petición a la vez. Los fallos llegan al chat como un código que él traduce, nunca como texto del proveedor.

| Sentido | Evento | Lleva |
| --- | --- | --- |
| Entrada | `voice:phrase` | `{ audio, lang }`, PCM16 mono 16 kHz |
| Entrada | `voice:speak` | `{ turnId, lang }` |
| Salida | `voice:transcript` | `{ text }` |
| Salida | `voice:audio` | un fragmento binario, PCM16 mono 24 kHz |
| Salida | `voice:audio-end` | fin de la respuesta hablada |
| Salida | `voice:error` | `{ code }` |
| Salida | `voice:session-ended` | `{ reason }` |

### Dos modos de escucha

El botón de ondas del chat abre una sesión. Cada modo se activa con su propio ajuste clave-valor, y el framework no infiere nada del par:

| Clave | Modo | Comportamiento |
| --- | --- | --- |
| `tools.assistant.isPushToTalkEnabled` | Pulsar para hablar | Mantén pulsado el botón para hablar. Un intercambio por pulsación; la sesión se cierra sola tras la respuesta. |
| `tools.assistant.isHandsFreeEnabled` | Manos libres | Un clic abre una sesión continua. Un detector de actividad de voz (VAD, la pieza que decide cuándo alguien empieza y deja de hablar) envía cada frase en su pausa natural. La sesión dura hasta que el usuario pulsa la píldora. |

Con los dos activos, el gesto elige el modo (clic para manos libres, mantener pulsado para pulsar para hablar). Con uno solo activo, el otro gesto no abre nada y el chat sugiere el válido. Sin ninguno no hay botón de voz. Un valor que no sea literalmente `true` cuenta como apagado.

### Dos perfiles de proveedor, enlazados en código

La voz va detrás de dos puertos neutrales: `TOOLS_ASSISTANT_STT` (entra una frase, sale su transcripción) y `TOOLS_ASSISTANT_TTS` (entra texto, salen fragmentos PCM16 a 24 kHz). El modelo de texto ya va detrás de un tercero, `TOOLS_ASSISTANT_MODEL`. La instalación enlaza cada puerto a un adaptador en `@config/tools-assistant/`:

| Perfil | Voz a texto | Texto a voz | Modelo |
| --- | --- | --- | --- |
| Servicio (por defecto) | ElevenLabs Scribe | ElevenLabs | Anthropic |
| Local | sherpa-onnx (Whisper), dentro del proceso del backend | sherpa-onnx (voz VITS en español), dentro del proceso del backend | Un servidor compatible con OpenAI en el mismo equipo, como LM Studio |

La elección es un cambio de imports y de `useClass` en un solo fichero, no un interruptor en tiempo de ejecución, así que el binding nativo de un adaptador sin enlazar nunca se carga al arrancar. Cada puerto es independiente: puedes mezclar, por ejemplo voz local con el modelo de Anthropic. Con los tres enlazados en local, un turno de voz funciona sin acceso a la red.

## Cuándo se aplica

- Ves un botón de ondas en la entrada del chat: al menos una clave de modo está activa.
- Una sesión termina con «unavailable» o «unauthorized»: se apagó un interruptor, o se perdió el token o el permiso a mitad de sesión.
- Te preguntas adónde va el audio: con el perfil de servicio, a ElevenLabs; con el local, a ninguna parte.

## Compromisos y límites

- **Ninguna capacidad nueva.** La voz no añade operaciones con efectos, confirmaciones ni verificación del hablante. Un «sí» hablado es una entrada no fiable y nunca contaría como confirmación sin una validación determinista en código.
- **Sin palabra de activación ni interrupción.** La sesión se abre a mano y dura hasta Detener; no puedes hablar encima del asistente, y la escucha se pausa mientras procesa y habla.
- **Solo transcripciones finales.** No hay transcripciones parciales y la respuesta del modelo no se emite en streaming, así que el tiempo hasta el primer sonido es la transcripción, más la respuesta completa del modelo, más el primer fragmento de voz.
- **Manos libres oye a todos.** No hay clasificador de relevancia, así que conviene con auriculares. Apaga `tools.assistant.isHandsFreeEnabled` para quitarlo.
- **La voz no se mide.** Los proveedores de voz no consumen tokens del modelo, así que la cuota no los cuenta. El permiso, los interruptores y la frase de 30 segundos acotan el gasto.
- **Privacidad.** ElevenLabs conserva el audio por defecto y la retención cero es de un plan enterprise. Haz que alguien con autoridad legal valide el cumplimiento del RGPD antes de abrirlo a usuarios reales; el perfil local es la alternativa.
- **Calidad del perfil local.** La voz local es solo en español y descarta los caracteres para los que no tiene símbolo (dígitos, `%`, `¿`), por lo que su adaptador deletrea antes números, porcentajes, euros y horas; una sigla se lee como una palabra. Un modelo local pequeño responde más rápido pero con menos acierto que uno grande, y uno grande puede tardar decenas de segundos por turno.
- **Contexto seguro.** El micrófono requiere HTTPS, o `localhost` en desarrollo.

## Relacionado

- [Cómo: Activar la voz en el asistente](../../../guides/frontend/enable-voice-in-the-assistant/)
- [Acciones guiadas y formularios asistidos](../guided-actions/) — qué hace el asistente y los controles de acceso y coste que la voz comparte.
- [El manual de usuario integrado](../in-app-user-manual/) — el manual que lee el asistente.
