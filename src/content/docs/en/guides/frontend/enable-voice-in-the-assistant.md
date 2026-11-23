---
title: Enable voice in the assistant
description: "Turn on the assistant voice channel in an installation: choose a listening mode, set the speech provider (ElevenLabs or a local profile) and its environment variables, and check a spoken turn."
---

## Goal

Let users speak to the help assistant and hear its answers, with either the ElevenLabs service profile or the local profile.

## Before you start

- An application with the `tools` package installed and the assistant working in text: `tools.assistant.isEnabled` is `true` and the user's role holds `tools.assistant.ask`. See [Access and cost](../../../concepts/frontend/guided-actions/#access-and-cost).
- The application served over HTTPS, or opened on `localhost` (the microphone needs a secure context).
- For the service profile, an ElevenLabs API key. For the local profile, the three local pieces described in step 3.

## Steps

1. **Choose the listening modes.** Set one or both key-value settings to the boolean `true` (any other value counts as off):

   | Key | Offers |
   | --- | --- |
   | `tools.assistant.isPushToTalkEnabled` | Hold the button to speak, one exchange per hold |
   | `tools.assistant.isHandsFreeEnabled` | Click to open a continuous session |

   Both keys ship empty, so no installation shows a voice button until you set one.

2. **Service profile: set the key and the voice.** This is the default binding. Put the key in the backend environment and the voice in key-value:

   ```bash
   ELEVENLABS_API_KEY=<your key>
   ```

   Set `tools.assistant.voiceId` to the ElevenLabs voice the assistant speaks with. The key is read on every call, never at boot, so the backend starts without it and a missing key fails the call naming the variable.

3. **Local profile: prepare the models and the server.** Everything runs on the installation's own host, with no network access.

   - **Speech to text** (Whisper `large-v3-turbo`, int8, about 1.5 GB). A directory containing `turbo-encoder.int8.onnx`, `turbo-decoder.int8.onnx` and `turbo-tokens.txt`.
   - **Text to speech** (Spanish voice `vits-coqui-es-css10`, about 145 MB). A directory containing `model.onnx` and `tokens.txt`.
   - **Model.** An OpenAI-compatible server on the same host, for example LM Studio, with the model loaded and a context length set explicitly. Set the model id in `tools.assistant.model`.

   Point the backend to them:

   ```bash
   TOOLS_ASSISTANT_LOCAL_STT_MODEL_DIR=/path/to/whisper-turbo
   TOOLS_ASSISTANT_LOCAL_TTS_MODEL_DIR=/path/to/vits-es
   TOOLS_ASSISTANT_LOCAL_MODEL_URL=http://localhost:1234/v1
   ```

   The models live outside the repository. The engines load on the first phrase and are reused, so the first turn is slower. On macOS with Apple silicon no library path variable is needed; on Linux, check that the platform package of `sherpa-onnx-node` loads before relying on it.

4. **Bind the adapters (local profile only).** In `backend/src/@config/tools-assistant/tools-assistant.providers.ts`, replace the three `useClass` values with the local classes. Each port is independent, so you can replace only some of them:

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

   Remove the ElevenLabs and Anthropic imports you no longer use.

5. **Restart the backend** so the key-value seed and the bindings apply, then reload the application.

## Verify it worked

- The chat input shows the wave button when the text area is empty. A session shows a pill labelled "Cancel" while it opens and "Stop" once it listens.
- Say a question. The transcript appears as a message, the answer follows, and you hear it.
- With the local profile, disconnect the network and repeat: the turn must still complete.

## Troubleshooting

- **No wave button.** `tools.assistant.isEnabled` or both mode keys are not literally `true`. The status the chat reads carries both flags.
- **The click or the hold opens nothing and a hint appears.** Only the other mode is enabled; the hint names the valid gesture.
- **The session ends at once with "unavailable" or "unauthorized".** A switch is off, or the account lacks `tools.assistant.ask`.
- **A voice error names an environment variable.** That variable is blank or missing: `ELEVENLABS_API_KEY`, or one of the three `TOOLS_ASSISTANT_LOCAL_*` variables.
- **Numbers or symbols are spoken wrongly with the local voice.** It drops characters outside its token set; ask for the figure in words, or accept the limit described in the concept page.
- **The local model takes very long to answer.** A large model can need tens of seconds per turn; a smaller one answers faster but less accurately.
- **LM Studio on a customer server.** Its desktop terms grant use for personal or internal business purposes and forbid offering it as a service; check them for your case, or use another OpenAI-compatible server such as `llama-server`.

## Related

- [Concept: The assistant voice channel](../../../concepts/frontend/assistant-voice-channel/)
- [How-to: Enable the assistant on a module](../enable-the-assistant-on-a-module/)
