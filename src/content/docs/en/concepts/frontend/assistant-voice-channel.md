---
title: The assistant voice channel
description: How the help assistant accepts spoken questions and speaks its answers without a second ask path, why speech sits behind two neutral ports, and what the voice channel deliberately does not do.
---

## Why this exists

Some people cannot type while they work: a warehouse operator with both hands busy, or someone on the shop floor with gloves on. Others simply prefer to speak. And some installations cannot send audio or questions to a cloud provider at all.

The voice channel gives the help assistant a spoken form of input and output. It changes the **form** of the conversation, never its **capabilities**: a spoken question is asked, billed, limited and answered exactly like a typed one, and the assistant still never saves, submits, creates, edits or deletes anything. See [Guided actions and assisted forms](../guided-actions/) for what the assistant can do.

## How it works

### One turn, run by the server

A typed question is orchestrated by the chat. A spoken one is orchestrated by the gateway `/tools-assistant-voice`, but it goes through the same steps: the ask handler exposes its validation as `prepare` (defenses, quota, model input) and its closing as `finish` (usage record, filtering, stored turn), and both the typed path and the voice turn call them. Quota, defenses and stored turn are therefore the same.

1. **Phrase.** The browser captures the phrase and sends it over the socket with the context a typed question carries: conversation id, route, language, and the form and screen snapshots. The server takes the account and permissions from the token, never from the payload.
2. **Transcript.** The gateway transcribes it (speech to text, STT) and returns the final transcript before anything else. The chat shows it as the user's message.
3. **Ask.** The server searches the manual with the route of the phrase and the permissions of the account, runs `prepare` with the voice channel, and calls the model in streaming mode (`askStream` on `TOOLS_ASSISTANT_MODEL`).
4. **Speech.** The `answer` text is cut into sentences as it streams, and each sentence is one text-to-speech (TTS) call. The first audio starts at the first sentence, not at the end of the model answer. The client plays the sentences in order, without gaps.
5. **Stored turn.** When the answer is complete, `finish` records the usage, filters and stores the turn, and the server sends it as `voice:turn`. The chat renders it like a typed answer, with its citation and action buttons.

```text
browser                           gateway /tools-assistant-voice        provider
phrase + context ─ voice:phrase ▶ STT ─────────────────────────────────▶
       ◀── voice:transcript ───── final transcript
                                  manual search, prepare, askStream ───▶
       ◀── voice:audio ×N ─────── TTS per sentence, while the model streams
       ◀── voice:audio-end ────── once per turn
                                  finish: usage, filter, store
       ◀── voice:turn ─────────── the stored turn
```

The server speaks only the `answer` its own model call produced. The socket accepts no text and no turn id to speak, so it is never a free TTS service. Citations and actions stay buttons in the chat; they are never spoken or run by voice.

### Answers written for the ear

A question asked by voice carries its channel. For the voice channel the model writes `answer` to be heard: short, no lists, no tables, no citations read aloud, spoken tone. The chat shows that same text. The voice instruction travels after the fixed system prompt, so typed and spoken questions share the same cacheable prefix. A typed question is asked exactly as before.

### Talking over the assistant

In hands-free the voice activity detector stays on while the assistant processes and speaks. When it confirms real speech (a cough or a knock is not enough), the chat stops playback at once and sends `voice:cancel-speech`. Only the audio is cut: the model call finishes, the turn is stored whole, the chat shows the full answer and the next question has it as context.

The new phrase is sent when it ends, once the previous turn is stored (a socket handles one turn at a time). The assistant's own voice does not trigger this on speakers without a headset, because the browser's echo cancellation removes the playback from the microphone. Push-to-talk keeps one exchange per hold; a new hold during an answer cuts the audio the same way.

If the speech provider fails mid-turn, the audio stops, `voice:audio-end` is still sent, and the turn is stored and delivered with `isSpeechFailed: true` so the chat can say why the audio stopped. No `voice:error` follows.

### The socket and its checks

The handshake authenticates the access token like the rest of the platform and also requires the permission `tools.assistant.ask`. No new permission exists. The session is refused unless `tools.assistant.isEnabled` and at least one mode key are `true`.

Every message re-checks the token, the permission and the switches. If the token expired or was revoked, or the permission was removed, the session ends with `voice:session-ended` (reason `unauthorized`); if the switches were turned off, with reason `unavailable`. A phrase lasts at most 30 seconds, and a socket handles one turn at a time; a second phrase while one is in flight is rejected, and `voice:cancel-speech` does not count as one. Failures reach the chat as a code it translates, never as provider text.

| Direction | Event | Carries |
| --- | --- | --- |
| In | `voice:phrase` | `{ audio, lang, conversationId, route, form?, screen? }`, audio PCM16 mono 16 kHz |
| In | `voice:cancel-speech` | nothing; stops the speech of the turn in flight |
| Out | `voice:transcript` | `{ text }` |
| Out | `voice:audio` | a binary chunk, PCM16 mono 24 kHz |
| Out | `voice:audio-end` | end of the spoken answer, once per turn |
| Out | `voice:turn` | the stored turn: id, answer, coverage, citations, actions, form writes, focus, `isSpeechFailed` |
| Out | `voice:error` | `{ code }` |
| Out | `voice:session-ended` | `{ reason }` |

### Two listening modes

The wave button in the chat opens a session. Each mode is enabled by its own key-value setting, and the framework infers nothing from the pair:

| Key | Mode | Behavior |
| --- | --- | --- |
| `tools.assistant.isPushToTalkEnabled` | Push-to-talk | Hold the button to speak. One exchange per hold; the session closes by itself after the answer. |
| `tools.assistant.isHandsFreeEnabled` | Hands-free | A click opens a continuous session. A voice activity detector (VAD, the piece that decides when someone starts and stops speaking) sends each phrase at its natural pause and keeps listening while the assistant answers, so you can interrupt it. The session lasts until the user clicks the pill. |

With both on, the gesture chooses the mode (click for hands-free, hold for push-to-talk). With one on, the other gesture opens nothing and the chat hints the valid one. With none on there is no voice button. A value that is not literally `true` counts as off.

### Two provider profiles, bound in code

Speech sits behind two neutral ports, `TOOLS_ASSISTANT_STT` (one phrase in, its transcript out) and `TOOLS_ASSISTANT_TTS` (text in, PCM16 24 kHz chunks out). The text model sits behind a third, `TOOLS_ASSISTANT_MODEL`, which offers `ask` (one complete answer) and `askStream` (the answer text as it is generated, ending with the same parsed answer and token usage); every adapter implements both. The installation binds each port to one adapter in `@config/tools-assistant/`:

| Profile | Speech to text | Text to speech | Model |
| --- | --- | --- | --- |
| Service (default) | ElevenLabs Scribe | ElevenLabs | Anthropic |
| Local | sherpa-onnx (Whisper), in the backend process | sherpa-onnx (Spanish VITS voice), in the backend process | An OpenAI-compatible server on the same host, such as LM Studio |

The choice is a change of imports and `useClass` in one file, not a runtime switch, so the native binding of an unbound adapter is never loaded at boot. Each port is independent: you can mix, for example local speech with the Anthropic model. With all three bound locally, a voice turn runs without network access.

## When it applies

- You see a wave button in the chat input: at least one mode key is on.
- A session ends with "unavailable" or "unauthorized": a switch was turned off or the token or permission was lost mid-session.
- You consider where audio goes: with the service profile, to ElevenLabs; with the local profile, nowhere.

## Trade-offs and limits

- **No new capability.** Voice does not add operations with effects, confirmations or speaker verification. A spoken "yes" is untrusted input and would never count as a confirmation without a deterministic check in code.
- **No wake word.** A session is opened by hand and stays open until Stop.
- **Final transcripts only.** There are no partial transcripts, so the time to the first sound is transcription plus the model time to the first sentence plus the first speech chunk. Measured on the service profile, the median from the phrase sent to the first audio is about 1.9 s. On the local profile the gain is small, because reading the prompt dominates the wait.
- **Speech is cut sentence by sentence.** Each sentence is a separate TTS call, so prosody restarts between sentences.
- **Hands-free hears everyone.** There is no relevance classifier, and a colleague's speech can interrupt the answer too (the transcript stays visible and nothing has effects), so it suits headsets or quiet places. Echo cancellation was measured on one laptop at one volume; if an installation hears false interruptions, turn off hands-free. Turn off `tools.assistant.isHandsFreeEnabled` to remove it.
- **Speech is not metered.** Speech providers consume no model tokens, so quota does not count them. The permission, the switches and the 30-second phrase bound the spend.
- **Privacy.** ElevenLabs retains audio by default and zero retention is an enterprise plan. Have someone with legal authority validate GDPR compliance before real users; the local profile is the alternative.
- **Local profile quality.** The local voice is Spanish only and drops characters it has no token for (digits, `%`, `¿`), so its adapter spells out numbers, percentages, euros and clock times first; an acronym is read as a word. A small local model answers faster but less accurately than a large one, and a large one can take tens of seconds per turn.
- **Secure context.** The microphone needs HTTPS, or `localhost` in development.

## Related

- [How-to: Enable voice in the assistant](../../../guides/frontend/enable-voice-in-the-assistant/)
- [Guided actions and assisted forms](../guided-actions/) — what the assistant does, and the access and cost gates that voice shares.
- [The in-app user manual](../in-app-user-manual/) — the manual the assistant reads.
