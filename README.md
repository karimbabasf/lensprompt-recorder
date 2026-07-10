# LensPrompt

A camera teleprompter that follows your voice. Paste a script, hit record, and read cues that keep pace with what you actually say. The prompt lives only in the app preview, so it is never burned into the recording.

[![CI](https://github.com/karimbabasf/lensprompt-recorder/actions/workflows/ci.yml/badge.svg)](https://github.com/karimbabasf/lensprompt-recorder/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4bd4c1.svg)](LICENSE)
[![Live app](https://img.shields.io/badge/live-lensprompt--recorder.vercel.app-4bd4c1.svg)](https://lensprompt-recorder.vercel.app)

**[Open the live app](https://lensprompt-recorder.vercel.app)**

## Why it is different

A normal teleprompter scrolls at a fixed speed and you chase it. LensPrompt listens with the browser speech API and advances word by word as you speak, so the word you need next is always the bright one. Improvise for a moment and it stays calm, then catches back up.

## Features

- Voice-tracked prompt with fuzzy matching, so a short ad lib does not break the flow
- Brightness-led cues: spoken text recedes, the current word carries the accent
- Record with the front or back camera, at the best quality the device exposes
- Draggable, resizable prompt overlay tuned with sliders for size, position, shade, and cue lines
- Live recording timecode plus a word count and speaking-duration estimate
- Zoom stepper when the browser reports native zoom support
- Save straight to the camera roll through the Web Share sheet, or download a backup
- Installable as a PWA: portrait, mobile-first, and it keeps working after the first load
- Private by design: video, audio, and transcript never leave the device

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints. Camera and microphone need a secure context, so on a phone use the deployed HTTPS link or run the local HTTPS server:

```bash
npm run dev:phone
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run dev:phone` | Dev server over HTTPS for on-device testing |
| `npm run build` | Type-check and build to `dist` |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | Type-check without emitting |

## How it works

| File | Responsibility |
| --- | --- |
| `src/lib/teleprompter.ts` | Sentence splitting, fuzzy word matching, and the progress model |
| `src/hooks/useSpeechRecognition.ts` | Continuous Web Speech recognition with auto-restart |
| `src/hooks/useCameraRecorder.ts` | Camera, MediaRecorder, zoom, front/back flip, preview keepalive |
| `src/lib/cameraQuality.ts` | HD 60 fps capture constraints and zoom helpers |
| `src/lib/exportFlow.ts` | Save, discard, and next-take state machine |
| `src/App.tsx` | Recording surface, prompt overlay, and the settings sheet |

Built with Vite, React 18, and TypeScript. There is no backend, no analytics, and no environment variables.

## Browser support

Voice tracking uses the Web Speech API, which is available in Chrome and Safari. Saving directly to the camera roll uses the Web Share sheet, which works best on iOS Safari. Where either is missing, the app falls back to a plain download and tells you in a status message.

## A note on quality

Mobile browsers do not expose raw or uncompressed capture to a web app. LensPrompt requests HD 60 fps and records with the best `MediaRecorder` format the browser supports, but Safari and Chrome still encode the video. True ProRes or uncompressed capture would require a native iOS app.

## Deployment

The build is fully static, so it can be hosted anywhere. This copy ships to Vercel from the CLI, which uploads the source and builds it remotely:

```bash
vercel --prod
```

For any other static host, run `npm run build` and serve the `dist` folder.

## Privacy

Everything runs in the browser. The camera preview, speech tracking, prompt matching, and export all happen on the device. Nothing is uploaded unless you choose to share or download your take.

## License

Released under the [MIT License](LICENSE).
