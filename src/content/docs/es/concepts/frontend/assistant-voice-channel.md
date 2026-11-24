---
title: El canal de voz del asistente
description: Cómo el asistente de ayuda acepta preguntas habladas y pronuncia sus respuestas sin un segundo camino de consulta, por qué la voz va detrás de dos puertos neutrales y qué no hace a propósito el canal de voz.
---

## Por qué existe

Hay personas que no pueden teclear mientras trabajan: un operario de almacén con las dos manos ocupadas, o alguien en planta con guantes. Otras simplemente prefieren hablar. Y hay instalaciones que no pueden enviar audio ni preguntas a un proveedor en la nube.

El canal de voz da al asistente de ayuda una forma hablada de entrada y de salida. Cambia la **forma** de la conversación, nunca sus **capacidades**: una pregunta hablada se consulta, se contabiliza, se limita y se responde igual que una escrita, y el asistente sigue sin guardar, enviar, crear, editar ni borrar nada. Lo que sí puede hacer el asistente está en [Acciones guiadas y formularios asistidos](../guided-actions/).

## Cómo funciona

### Un turno, ejecutado por el servidor

Una pregunta escrita la orquesta el chat. Una hablada la orquesta la pasarela (gateway) `/tools-assistant-voice`, pero pasa por los mismos pasos: el handler de la consulta expone su validación como `prepare` (defensas, cuota, entrada del modelo) y su cierre como `finish` (registro de uso, filtrado, turno guardado), y tanto el camino escrito como el turno de voz los llaman. Por eso la cuota, las defensas y el turno guardado son los mismos.

1. **Frase.** El navegador captura la frase y la envía por el socket con el contexto que lleva una pregunta escrita: id de conversación, ruta, idioma y las instantáneas del formulario y de la pantalla. El servidor toma la cuenta y los permisos del token, nunca del payload.
2. **Transcripción.** La pasarela la transcribe (voz a texto, STT) y devuelve la transcripción final antes que nada. El chat la muestra como mensaje del usuario.
3. **Consulta.** El servidor busca en el manual con la ruta de la frase y los permisos de la cuenta, ejecuta `prepare` con el canal de voz y llama al modelo en modo streaming (`askStream` en `TOOLS_ASSISTANT_MODEL`).
4. **Voz.** El texto de `answer` se corta en frases mientras llega, y cada frase es una llamada de texto a voz (TTS). El primer audio empieza con la primera frase, no al final de la respuesta del modelo. El cliente reproduce las frases en orden y sin cortes.
5. **Turno guardado.** Cuando la respuesta está completa, `finish` registra el uso, filtra y guarda el turno, y el servidor lo envía como `voice:turn`. El chat lo pinta como una respuesta escrita, con sus botones de citas y acciones.

```text
navegador                         pasarela /tools-assistant-voice       proveedor
frase + contexto ─ voice:phrase ▶ STT ─────────────────────────────────▶
      ◀── voice:transcript ────── transcripción final
                                  búsqueda en el manual, prepare, askStream ▶
      ◀── voice:audio ×N ──────── TTS por frase, mientras el modelo emite
      ◀── voice:audio-end ─────── una vez por turno
                                  finish: uso, filtrado, guardado
      ◀── voice:turn ──────────── el turno guardado
```

El servidor pronuncia solo el `answer` que produjo su propia llamada al modelo. El socket no acepta ningún texto ni ningún id de turno para pronunciar, así que nunca es un servicio de TTS libre. Las citas y las acciones siguen siendo botones del chat; nunca se pronuncian ni se ejecutan por voz.

### Respuestas escritas para el oído

Una pregunta hecha por voz lleva su canal. Para el canal de voz el modelo escribe `answer` para ser escuchada: corta, sin listas, sin tablas, sin leer citas en voz alta, con tono hablado. El chat muestra ese mismo texto. La instrucción de voz viaja después del prompt de sistema fijo, así que las preguntas escritas y las habladas comparten el mismo prefijo cacheable. Una pregunta escrita se consulta exactamente igual que antes.

### Hablar encima del asistente

En manos libres el detector de actividad de voz sigue activo mientras el asistente procesa y habla. Cuando confirma voz real (una tos o un golpe no bastan), el chat detiene la reproducción al instante y envía `voice:cancel-speech`. Solo se corta el audio: la llamada al modelo termina, el turno se guarda completo, el chat muestra la respuesta entera y la siguiente pregunta la tiene como contexto.

La frase nueva se envía cuando termina, una vez guardado el turno anterior (un socket atiende un turno a la vez). La propia voz del asistente no lo dispara en altavoces sin auriculares, porque la cancelación de eco del navegador quita la reproducción del micrófono. Pulsar para hablar mantiene un intercambio por pulsación; una pulsación nueva durante una respuesta corta el audio del mismo modo.

Si el proveedor de voz falla a mitad de turno, el audio se detiene, `voice:audio-end` se envía igualmente y el turno se guarda y se entrega con `isSpeechFailed: true` para que el chat explique por qué se cortó el audio. No llega ningún `voice:error`.

### El socket y sus comprobaciones

El handshake autentica el token de acceso como el resto de la plataforma y además exige el permiso `tools.assistant.ask`. No existe ningún permiso nuevo. La sesión se rechaza salvo que `tools.assistant.isEnabled` y al menos una clave de modo valgan `true`.

Cada mensaje vuelve a comprobar el token, el permiso y los interruptores. Si el token caducó o se revocó, o se retiró el permiso, la sesión termina con `voice:session-ended` (motivo `unauthorized`); si se apagaron los interruptores, con el motivo `unavailable`. Una frase dura como máximo 30 segundos y un socket atiende un turno a la vez; una segunda frase mientras hay uno en curso se rechaza, y `voice:cancel-speech` no cuenta como tal. Los fallos llegan al chat como un código que él traduce, nunca como texto del proveedor.

| Sentido | Evento | Lleva |
| --- | --- | --- |
| Entrada | `voice:phrase` | `{ audio, lang, conversationId, route, form?, screen? }`, audio PCM16 mono 16 kHz |
| Entrada | `voice:cancel-speech` | nada; detiene la voz del turno en curso |
| Salida | `voice:transcript` | `{ text }` |
| Salida | `voice:audio` | un fragmento binario, PCM16 mono 24 kHz |
| Salida | `voice:audio-end` | fin de la respuesta hablada, una vez por turno |
| Salida | `voice:turn` | el turno guardado: id, respuesta, cobertura, citas, acciones, escrituras de formulario, foco, `isSpeechFailed` |
| Salida | `voice:error` | `{ code }` |
| Salida | `voice:session-ended` | `{ reason }` |

### Dos modos de escucha

El botón de ondas del chat abre una sesión. Cada modo se activa con su propio ajuste clave-valor, y el framework no infiere nada del par:

| Clave | Modo | Comportamiento |
| --- | --- | --- |
| `tools.assistant.isPushToTalkEnabled` | Pulsar para hablar | Mantén pulsado el botón para hablar. Un intercambio por pulsación; la sesión se cierra sola tras la respuesta. |
| `tools.assistant.isHandsFreeEnabled` | Manos libres | Un clic abre una sesión continua. Un detector de actividad de voz (VAD, la pieza que decide cuándo alguien empieza y deja de hablar) envía cada frase en su pausa natural y sigue escuchando mientras el asistente responde, así que puedes interrumpirlo. La sesión dura hasta que el usuario pulsa la píldora. |

Con los dos activos, el gesto elige el modo (clic para manos libres, mantener pulsado para pulsar para hablar). Con uno solo activo, el otro gesto no abre nada y el chat sugiere el válido. Sin ninguno no hay botón de voz. Un valor que no sea literalmente `true` cuenta como apagado.

### Dos perfiles de proveedor, enlazados en código

La voz va detrás de dos puertos neutrales: `TOOLS_ASSISTANT_STT` (entra una frase, sale su transcripción) y `TOOLS_ASSISTANT_TTS` (entra texto, salen fragmentos PCM16 a 24 kHz). El modelo de texto va detrás de un tercero, `TOOLS_ASSISTANT_MODEL`, que ofrece `ask` (una respuesta completa) y `askStream` (el texto de la respuesta según se genera, y al final la misma respuesta interpretada y el uso de tokens); todos los adaptadores implementan ambos. La instalación enlaza cada puerto a un adaptador en `@config/tools-assistant/`:

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
- **Sin palabra de activación.** La sesión se abre a mano y dura hasta Detener.
- **Solo transcripciones finales.** No hay transcripciones parciales, así que el tiempo hasta el primer sonido es la transcripción, más lo que tarda el modelo en la primera frase, más el primer fragmento de voz. Medido en el perfil de servicio, la mediana desde que se envía la frase hasta el primer audio es de unos 1,9 s. En el perfil local la ganancia es pequeña, porque la lectura del prompt domina la espera.
- **La voz se corta frase a frase.** Cada frase es una llamada de TTS distinta, así que la prosodia se reinicia entre frases.
- **Manos libres oye a todos.** No hay clasificador de relevancia, y la voz de un compañero también puede interrumpir la respuesta (la transcripción sigue visible y nada tiene efectos), así que conviene con auriculares o en sitios tranquilos. La cancelación de eco se midió en un portátil con un volumen; si una instalación oye interrupciones falsas, apaga manos libres. Apaga `tools.assistant.isHandsFreeEnabled` para quitarlo.
- **La voz no se mide.** Los proveedores de voz no consumen tokens del modelo, así que la cuota no los cuenta. El permiso, los interruptores y la frase de 30 segundos acotan el gasto.
- **Privacidad.** ElevenLabs conserva el audio por defecto y la retención cero es de un plan enterprise. Haz que alguien con autoridad legal valide el cumplimiento del RGPD antes de abrirlo a usuarios reales; el perfil local es la alternativa.
- **Calidad del perfil local.** La voz local es solo en español y descarta los caracteres para los que no tiene símbolo (dígitos, `%`, `¿`), por lo que su adaptador deletrea antes números, porcentajes, euros y horas; una sigla se lee como una palabra. Un modelo local pequeño responde más rápido pero con menos acierto que uno grande, y uno grande puede tardar decenas de segundos por turno.
- **Contexto seguro.** El micrófono requiere HTTPS, o `localhost` en desarrollo.

## Relacionado

- [Cómo: Activar la voz en el asistente](../../../guides/frontend/enable-voice-in-the-assistant/)
- [Acciones guiadas y formularios asistidos](../guided-actions/) — qué hace el asistente y los controles de acceso y coste que la voz comparte.
- [El manual de usuario integrado](../in-app-user-manual/) — el manual que lee el asistente.
