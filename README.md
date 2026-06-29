# LensPrompt Recorder

LensPrompt Recorder is an iPhone-first video recorder with a private teleprompter overlay. It lets you paste a script that is already split into sentences, record with the front camera, and read smart subtitles that advance at your speaking pace. The prompt is only shown inside the app preview; it is not burned into the exported video.

Live app: [lensprompt-recorder.vercel.app](https://lensprompt-recorder.vercel.app)

## What It Does

- Records from the user-facing camera with a mirrored preview.
- Requests 1080p HD at 60 fps with high audio and video bitrates.
- Keeps the microphone live by default for speech-following prompt progress.
- Advances sentence-by-sentence like karaoke, with fuzzy word matching so short improvisations do not break the flow.
- Lets you drag, resize, reposition, and tune the prompt overlay on the phone screen.
- Provides camera zoom controls in 0.1x steps when the browser exposes native zoom support.
- Shows a Save to Gallery flow immediately after stopping a take, with backup download and discard options.
- Keeps the camera preview alive between takes so the app is ready for another recording.

## Important Browser Note

Mobile browsers do not expose true raw or uncompressed camera recording from a web app. LensPrompt requests high quality HD 60 fps capture and records with the best `MediaRecorder` format the browser supports, but Safari/Chrome still encode the video. For true ProRes or fully uncompressed capture, this would need to become a native iOS app.

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Camera and microphone permissions require a secure context on iPhone, so the deployed HTTPS URL is the easiest way to test on device.

For local phone testing over HTTPS:

```bash
npm run dev:phone
```

## Quality Checks

```bash
npm test
npm run typecheck
npm run build
```

## Project Structure

```text
src/App.tsx                         Main recording and prompt UI
src/hooks/useCameraRecorder.ts      Camera, MediaRecorder, zoom, and preview keepalive
src/hooks/useSpeechRecognition.ts   Browser speech recognition wrapper
src/lib/teleprompter.ts             Sentence splitting, fuzzy matching, and progress model
src/lib/cameraQuality.ts            HD 60 fps constraints and zoom helpers
src/lib/exportFlow.ts               Save, discard, and next-take state machine
src/styles.css                      Mobile-first interface styling
```

## Deployment

The app is designed for static deployment on Vercel.

```bash
npm run build
npx vercel@latest deploy --prod
```

## Privacy

The app runs entirely in the browser. Camera preview, speech tracking, prompt matching, and recording export happen locally on the device unless you choose to share, save, or download the recorded file.

## License

Private project. Add a license before distributing or open-sourcing this repository.
