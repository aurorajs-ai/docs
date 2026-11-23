---
title: The assistant voice channel
description: How the help assistant accepts spoken questions and speaks its answers without a second ask path, why speech sits behind two neutral ports, and what the voice channel deliberately does not do.
---

## Why this exists

Some people cannot type while they work: a warehouse operator with both hands busy, or someone on the shop floor with gloves on. Others simply prefer to speak. And some installations cannot send audio or questions to a cloud provider at all.

The voice channel gives the help assistant a spoken form of input and output. It changes the **form** of the conversation, never its **capabilities**: a spoken question is asked, billed, limited and answered exactly like a typed one, and the assistant still never saves, submits, creates, edits or deletes anything. See [Guided actions and assisted forms](../guided-actions/) for what the assistant can do.

## How it works

### Two edges, one ask

The chat widget already orchestrates a question: it searches the manual, takes the form and screen snapshots, sends the question and applies the answer. Voice does not add a second path next to it. It adds only the two edges:

1. **Input.** The browser captures the phrase and sends it over a socket to the gateway `/tools-assistant-voice`. The gateway only transcribes it (speech to text, STT) and returns the final transcript. The chat shows the transcript as a normal message and asks it through the same path as a typed question. Quota, defenses and stored turn are therefore the same.
2. **Output.** When the answer arrives, the chat sends `voice:speak` with the `turnId` of the stored turn. The gateway reads that turn, filtered by its id **and** by the account of the token, and speaks only its `answer` (text to speech, TTS).

```text
browser                           gateway /tools-assistant-voice        provider
phrase ── voice:phrase ─────────▶ STT ─────────────────────────────────▶
       ◀── voice:transcript ───── final transcript
ask(transcript)  (same path as typed: search, snapshots, mutation)
answer (turnId) ── voice:speak ─▶ read the turn of the token account
                                  TTS ─────────────────────────────────▶
       ◀── voice:audio / voice:audio-end ── PCM16 24 kHz
```

Speaking by `turnId` instead of by text means the socket is never a free TTS service: it can only read aloud what the assistant itself answered to that account. Citations and actions stay buttons in the chat; they are never spoken or run by voice.

### The socket and its checks

The handshake authenticates the access token like the rest of the platform and also requires the permission `tools.assistant.ask`. No new permission exists. The session is refused unless `tools.assistant.isEnabled` and at least one mode key are `true`.

Every message re-checks the token, the permission and the switches. If the token expired or was revoked, or the permission was removed, the session ends with `voice:session-ended` (reason `unauthorized`); if the switches were turned off, with reason `unavailable`. A phrase lasts at most 30 seconds, and a socket handles one request at a time. Failures reach the chat as a code it translates, never as provider text.

| Direction | Event | Carries |
| --- | --- | --- |
| In | `voice:phrase` | `{ audio, lang }`, PCM16 mono 16 kHz |
| In | `voice:speak` | `{ turnId, lang }` |
| Out | `voice:transcript` | `{ text }` |
| Out | `voice:audio` | a binary chunk, PCM16 mono 24 kHz |
| Out | `voice:audio-end` | end of the spoken answer |
| Out | `voice:error` | `{ code }` |
| Out | `voice:session-ended` | `{ reason }` |

### Two listening modes

The wave button in the chat opens a session. Each mode is enabled by its own key-value setting, and the framework infers nothing from the pair:

| Key | Mode | Behavior |
| --- | --- | --- |
| `tools.assistant.isPushToTalkEnabled` | Push-to-talk | Hold the button to speak. One exchange per hold; the session closes by itself after the answer. |
| `tools.assistant.isHandsFreeEnabled` | Hands-free | A click opens a continuous session. A voice activity detector (VAD, the piece that decides when someone starts and stops speaking) sends each phrase at its natural pause. The session lasts until the user clicks the pill. |

With both on, the gesture chooses the mode (click for hands-free, hold for push-to-talk). With one on, the other gesture opens nothing and the chat hints the valid one. With none on there is no voice button. A value that is not literally `true` counts as off.

### Two provider profiles, bound in code

Speech sits behind two neutral ports, `TOOLS_ASSISTANT_STT` (one phrase in, its transcript out) and `TOOLS_ASSISTANT_TTS` (text in, PCM16 24 kHz chunks out). The text model already sits behind a third, `TOOLS_ASSISTANT_MODEL`. The installation binds each port to one adapter in `@config/tools-assistant/`:

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
- **No wake word, no barge-in.** A session is opened by hand and stays open until Stop; you cannot talk over the assistant, and the listening pauses while it processes and speaks.
- **Final transcripts only.** There are no partial transcripts, and the model answer is not streamed, so the time to the first sound is transcription plus the full model answer plus the first speech chunk.
- **Hands-free hears everyone.** There is no relevance classifier, so it suits headsets. Turn off `tools.assistant.isHandsFreeEnabled` to remove it.
- **Speech is not metered.** Speech providers consume no model tokens, so quota does not count them. The permission, the switches and the 30-second phrase bound the spend.
- **Privacy.** ElevenLabs retains audio by default and zero retention is an enterprise plan. Have someone with legal authority validate GDPR compliance before real users; the local profile is the alternative.
- **Local profile quality.** The local voice is Spanish only and drops characters it has no token for (digits, `%`, `¿`), so its adapter spells out numbers, percentages, euros and clock times first; an acronym is read as a word. A small local model answers faster but less accurately than a large one, and a large one can take tens of seconds per turn.
- **Secure context.** The microphone needs HTTPS, or `localhost` in development.

## Related

- [How-to: Enable voice in the assistant](../../../guides/frontend/enable-voice-in-the-assistant/)
- [Guided actions and assisted forms](../guided-actions/) — what the assistant does, and the access and cost gates that voice shares.
- [The in-app user manual](../in-app-user-manual/) — the manual the assistant reads.
