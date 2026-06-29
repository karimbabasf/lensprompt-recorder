import { PointerEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Camera from "lucide-react/dist/esm/icons/camera.js";
import Captions from "lucide-react/dist/esm/icons/captions.js";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle.js";
import Circle from "lucide-react/dist/esm/icons/circle.js";
import Download from "lucide-react/dist/esm/icons/download.js";
import ImageDown from "lucide-react/dist/esm/icons/image-down.js";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2.js";
import Move from "lucide-react/dist/esm/icons/move.js";
import PanelBottomOpen from "lucide-react/dist/esm/icons/panel-bottom-open.js";
import Play from "lucide-react/dist/esm/icons/play.js";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.js";
import Settings from "lucide-react/dist/esm/icons/settings.js";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import Square from "lucide-react/dist/esm/icons/square.js";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles.js";
import { useCameraRecorder } from "./hooks/useCameraRecorder";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { applyExportEvent, createExportFlow, type ExportFlow } from "./lib/exportFlow";
import { advancePrompt, createPromptModel, PromptSentence } from "./lib/teleprompter";

type OverlaySettings = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  cueLength: number;
  opacity: number;
};

type DragState = {
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  startSettings: OverlaySettings;
  stageWidth: number;
  stageHeight: number;
};

const DEFAULT_SCRIPT = [
  "I want this to feel natural, like I am talking straight to you.",
  "The words should follow me, not the other way around.",
  "If I improvise for a second, the prompt should stay calm and catch back up.",
].join("\n");

const DEFAULT_OVERLAY: OverlaySettings = {
  x: 8,
  y: 20,
  width: 84,
  height: 26,
  fontSize: 30,
  cueLength: 1,
  opacity: 88,
};

const OVERLAY_STORAGE_KEY = "lensprompt-overlay";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const autoStartedRef = useRef(false);
  const lastMediaUrlRef = useRef("");
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [overlay, setOverlay] = useState<OverlaySettings>(readOverlaySettings);
  const [exportFlow, setExportFlow] = useState(createExportFlow);
  const recorder = useCameraRecorder(videoRef);
  const speech = useSpeechRecognition("en-US");
  const deferredTranscript = useDeferredValue(speech.transcript);

  const promptModel = useMemo(() => createPromptModel(script), [script]);
  const progress = useMemo(
    () => advancePrompt(promptModel, deferredTranscript),
    [deferredTranscript, promptModel],
  );
  const activeSentence = promptModel.sentences[progress.displaySentenceIndex];
  const secureContext = typeof window === "undefined" || window.isSecureContext;
  const recordingExtension = recorder.mimeType.includes("mp4") ? "mp4" : "webm";

  useEffect(() => {
    window.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
  }, [overlay]);

  useEffect(() => {
    if (autoStartedRef.current) {
      return;
    }

    autoStartedRef.current = true;
    void recorder.startCamera();

    if (speech.isSupported) {
      speech.start();
    }
  }, [recorder.startCamera, speech.isSupported, speech.start]);

  useEffect(() => {
    if (!recorder.mediaUrl) {
      lastMediaUrlRef.current = "";
      return;
    }

    if (
      recorder.mediaBlob &&
      recorder.status === "stopped" &&
      recorder.mediaUrl !== lastMediaUrlRef.current
    ) {
      lastMediaUrlRef.current = recorder.mediaUrl;
      setIsPanelOpen(false);
      setExportFlow((current) => applyExportEvent(current, { type: "recording-ready" }));
    }
  }, [recorder.mediaBlob, recorder.mediaUrl, recorder.status]);

  useEffect(() => {
    if (!exportFlow.shouldClearRecording) {
      return;
    }

    recorder.clearRecording();
    lastMediaUrlRef.current = "";
    setExportFlow((current) => applyExportEvent(current, { type: "recording-cleared" }));
  }, [exportFlow.shouldClearRecording, recorder.clearRecording]);

  const handleOverlayPointerDown = (event: PointerEvent<HTMLElement>) => {
    const stageBounds = stageRef.current?.getBoundingClientRect();

    if (!stageBounds) {
      return;
    }

    const target = event.target as HTMLElement;
    const mode = target.dataset.resize === "true" ? "resize" : "move";

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSettings: overlay,
      stageWidth: stageBounds.width,
      stageHeight: stageBounds.height,
    };
  };

  const handleOverlayPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const dx = ((event.clientX - dragState.startX) / dragState.stageWidth) * 100;
    const dy = ((event.clientY - dragState.startY) / dragState.stageHeight) * 100;

    setOverlay((current) => {
      if (dragState.mode === "resize") {
        return clampOverlay({
          ...current,
          width: dragState.startSettings.width + dx,
          height: dragState.startSettings.height + dy,
        });
      }

      return clampOverlay({
        ...current,
        x: dragState.startSettings.x + dx,
        y: dragState.startSettings.y + dy,
      });
    });
  };

  const handleOverlayPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const downloadRecording = () => {
    if (!recorder.mediaUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = recorder.mediaUrl;
    anchor.download = `lensprompt-take-${new Date().toISOString().slice(0, 19)}.${recordingExtension}`;
    anchor.click();
  };

  const saveRecordingToGallery = async () => {
    if (!recorder.mediaBlob) {
      return;
    }

    setExportFlow((current) => applyExportEvent(current, { type: "save-started" }));

    const file = new File([recorder.mediaBlob], `lensprompt-take.${recordingExtension}`, {
      type: recorder.mediaBlob.type || recorder.mimeType,
    });

    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: "LensPrompt take",
        });
      } else {
        downloadRecording();
      }

      setExportFlow((current) => applyExportEvent(current, { type: "save-complete" }));
    } catch (saveError) {
      const wasCancelled = saveError instanceof DOMException && saveError.name === "AbortError";
      setExportFlow((current) =>
        applyExportEvent(current, {
          type: "save-failed",
          error: wasCancelled
            ? "Save was cancelled. Your take is still here."
            : "Save did not finish. Your take is still here.",
        }),
      );
    }
  };

  const handleRecordPress = async () => {
    if (recorder.status === "recording") {
      recorder.stopRecording();
      return;
    }

    if (recorder.isBusy) {
      return;
    }

    if (recorder.mediaBlob) {
      setExportFlow((current) => applyExportEvent(current, { type: "recording-ready" }));
      return;
    }

    setExportFlow(createExportFlow());
    setIsPanelOpen(false);

    if (speech.isSupported && speech.status !== "listening") {
      speech.start();
    }

    await recorder.startRecording();
  };

  const discardTake = () => {
    setExportFlow((current) => applyExportEvent(current, { type: "discard" }));
  };

  const adjustZoom = (delta: number) => {
    const nextZoom = Number((recorder.zoom.value + delta).toFixed(1));
    void recorder.setZoom(nextZoom);
  };

  return (
    <main className="app-shell">
      <section className="stage" ref={stageRef} aria-label="Camera monitor">
        <video
          ref={videoRef}
          className={recorder.facingMode === "user" ? "camera-feed mirrored" : "camera-feed"}
          playsInline
          muted
          autoPlay
        />
        {!recorder.isCameraReady && (
          <div className="empty-monitor">
            <div className="lens-mark">
              <Camera size={44} strokeWidth={1.6} />
            </div>
            <p>Camera standby</p>
          </div>
        )}

        <div className="grain" />

        <article
          className="prompt-overlay"
          style={{
            left: `${overlay.x}%`,
            top: `${overlay.y}%`,
            width: `${overlay.width}%`,
            height: `${overlay.height}%`,
            fontSize: `${overlay.fontSize}px`,
            backgroundColor: `rgba(8, 8, 6, ${overlay.opacity / 100})`,
          }}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          onPointerCancel={handleOverlayPointerUp}
        >
          <div className="overlay-toolbar">
            <span>
              <Move size={14} />
              drag
            </span>
            <span>
              <Captions size={15} />
              {Math.round(progress.progressRatio * 100)}%
            </span>
          </div>

          <div className="cue-stack">
            {activeSentence ? (
              visibleSentences(promptModel.sentences, progress.displaySentenceIndex, overlay.cueLength).map(
                (sentence) => (
                  <SentenceCue
                    key={sentence.id}
                    sentence={sentence}
                    completedWords={progress.sentenceWordCounts[sentenceIndexOf(promptModel.sentences, sentence)]}
                    isActive={sentence.id === activeSentence.id}
                  />
                ),
              )
            ) : (
              <p className="empty-script">Paste your script to begin.</p>
            )}
          </div>

          {(speech.interimTranscript || progress.improvisedWords.length > 0) && (
            <div className="live-strip">
              <WandSparkles size={14} />
              <span>{formatLiveStrip(speech.interimTranscript, progress.improvisedWords)}</span>
            </div>
          )}

          <button
            className="resize-handle"
            type="button"
            aria-label="Resize subtitle overlay"
            data-resize="true"
          >
            <Maximize2 size={18} />
          </button>
        </article>

        <div className="transport compact">
          <button
            className={recorder.isRecording ? "record-button recording" : "record-button"}
            type="button"
            onClick={handleRecordPress}
            disabled={recorder.isBusy}
            aria-label={getRecordAriaLabel(recorder.status)}
          >
            {recorder.isRecording || recorder.status === "finalizing" ? (
              <Square size={23} fill="currentColor" />
            ) : (
              <Circle size={25} fill="currentColor" />
            )}
            <span>{getRecordLabel(recorder.status, Boolean(recorder.mediaBlob))}</span>
          </button>
          {recorder.zoom.isSupported && (
            <div className="zoom-stepper" aria-label="Camera zoom">
              <button
                type="button"
                onClick={() => adjustZoom(-0.1)}
                disabled={recorder.zoom.value <= recorder.zoom.min}
                aria-label="Zoom out"
              >
                -
              </button>
              <span>{recorder.zoom.value.toFixed(1)}x</span>
              <button
                type="button"
                onClick={() => adjustZoom(0.1)}
                disabled={recorder.zoom.value >= recorder.zoom.max}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={() => setIsPanelOpen((value) => !value)}
            aria-label="Open controls"
          >
            <SlidersHorizontal size={22} />
            <span>Panel</span>
          </button>
        </div>

        {exportFlow.isModalOpen && (
          <ExportDialog
            flow={exportFlow}
            hasRecording={Boolean(recorder.mediaBlob)}
            fileSize={formatBytes(recorder.mediaBlob?.size ?? 0)}
            onSave={saveRecordingToGallery}
            onDownload={downloadRecording}
            onDiscard={discardTake}
            onNextTake={() => setExportFlow((current) => applyExportEvent(current, { type: "start-next-take" }))}
          />
        )}

        <StatusRail
          secureContext={secureContext}
          recorderError={recorder.error}
          speechStatus={speech.status}
          speechError={speech.error}
          speechSupported={speech.isSupported}
        />
      </section>

      <aside className={isPanelOpen ? "control-panel open" : "control-panel"} aria-label="Script and overlay controls">
        <button
          className="panel-tab"
          type="button"
          onClick={() => setIsPanelOpen((value) => !value)}
          aria-label={isPanelOpen ? "Close panel" : "Open panel"}
        >
          <PanelBottomOpen size={18} />
        </button>

        <div className="panel-section script-section">
          <div className="section-heading">
            <span>
              <Captions size={18} />
              Script
            </span>
            <button className="text-button" type="button" onClick={speech.reset}>
              Reset speech
            </button>
          </div>
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck="true"
            aria-label="Sentence-by-sentence script"
          />
        </div>

        <div className="panel-section">
          <div className="section-heading">
            <span>
              <Settings size={18} />
              Overlay
            </span>
            <button className="text-button" type="button" onClick={() => setOverlay(DEFAULT_OVERLAY)}>
              Reset
            </button>
          </div>
          <SliderControl label="Width" value={overlay.width} min={36} max={96} unit="%" onChange={(width) => updateOverlay({ width })} />
          <SliderControl label="Height" value={overlay.height} min={14} max={62} unit="%" onChange={(height) => updateOverlay({ height })} />
          <SliderControl label="Left" value={overlay.x} min={0} max={92} unit="%" onChange={(x) => updateOverlay({ x })} />
          <SliderControl label="Top" value={overlay.y} min={0} max={82} unit="%" onChange={(y) => updateOverlay({ y })} />
          <SliderControl label="Text" value={overlay.fontSize} min={18} max={54} unit="px" onChange={(fontSize) => updateOverlay({ fontSize })} />
          <SliderControl label="Length" value={overlay.cueLength} min={1} max={4} unit="cue" onChange={(cueLength) => updateOverlay({ cueLength })} />
          <SliderControl label="Shade" value={overlay.opacity} min={36} max={96} unit="%" onChange={(opacity) => updateOverlay({ opacity })} />
        </div>

        <div className="panel-section">
          <div className="section-heading">
            <span>
              <Play size={18} />
              Take
            </span>
            <span className="file-size">{formatBytes(recorder.mediaBlob?.size ?? 0)}</span>
          </div>
          <div className="take-actions">
            <button className="solid-button" type="button" onClick={saveRecordingToGallery} disabled={!recorder.mediaBlob}>
              <ImageDown size={18} />
              Save to Gallery
            </button>
            <button className="solid-button ghost" type="button" onClick={downloadRecording} disabled={!recorder.mediaUrl}>
              <Download size={18} />
              Backup
            </button>
          </div>
          {recorder.mimeType && <p className="codec-line">{recorder.mimeType}</p>}
        </div>
      </aside>
    </main>
  );

  function updateOverlay(partial: Partial<OverlaySettings>) {
    setOverlay((current) => clampOverlay({ ...current, ...partial }));
  }
}

function SentenceCue({
  sentence,
  completedWords,
  isActive,
}: {
  sentence: PromptSentence;
  completedWords: number;
  isActive: boolean;
}) {
  return (
    <p className={isActive ? "sentence-cue active" : "sentence-cue"}>
      {sentence.words.map((word, index) => (
        <span key={`${sentence.id}-${word}-${index}`} className={index < completedWords ? "word spoken" : "word"}>
          {word}
        </span>
      ))}
    </p>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-control">
      <span>
        {label}
        <strong>
          {Math.round(value)}
          {unit === "cue" ? "" : unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={unit === "cue" ? 1 : 0.5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ExportDialog({
  flow,
  hasRecording,
  fileSize,
  onSave,
  onDownload,
  onDiscard,
  onNextTake,
}: {
  flow: ExportFlow;
  hasRecording: boolean;
  fileSize: string;
  onSave: () => void;
  onDownload: () => void;
  onDiscard: () => void;
  onNextTake: () => void;
}) {
  const isSaved = flow.stage === "saved";
  const isSaving = flow.stage === "saving";

  return (
    <div className="export-scrim" role="presentation">
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className={isSaved ? "export-icon saved" : "export-icon"}>
          {isSaved ? <CheckCircle size={28} /> : <ImageDown size={28} />}
        </div>
        <div className="export-copy">
          <p className="export-kicker">{fileSize}</p>
          <h2 id="export-title">{isSaved ? "Saved" : "Save to Gallery"}</h2>
          <p>{flow.error || flow.message || "Your take is ready."}</p>
        </div>

        {isSaved ? (
          <button className="solid-button wide" type="button" onClick={onNextTake}>
            <RotateCcw size={18} />
            Record another
          </button>
        ) : (
          <div className="export-actions">
            <button className="solid-button wide" type="button" onClick={onSave} disabled={!hasRecording || isSaving}>
              <ImageDown size={18} />
              {isSaving ? "Saving..." : "Save to Gallery"}
            </button>
            <button className="solid-button ghost" type="button" onClick={onDownload} disabled={!hasRecording || isSaving}>
              <Download size={18} />
              Backup
            </button>
            <button className="text-button muted" type="button" onClick={onDiscard} disabled={isSaving}>
              Discard take
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusRail({
  secureContext,
  recorderError,
  speechStatus,
  speechError,
  speechSupported,
}: {
  secureContext: boolean;
  recorderError: string;
  speechStatus: SpeechRecognitionStatus;
  speechError: string;
  speechSupported: boolean;
}) {
  const messages = [
    !secureContext ? "Use HTTPS for iPhone camera and mic access." : "",
    !speechSupported ? "Speech tracking is unavailable in this browser." : "",
    recorderError,
    speechStatus === "error" ? speechError : "",
  ].filter(Boolean);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="status-rail" role="status">
      {messages.map((message) => (
        <span key={message}>{message}</span>
      ))}
    </div>
  );
}

function readOverlaySettings(): OverlaySettings {
  if (typeof window === "undefined") {
    return DEFAULT_OVERLAY;
  }

  try {
    const storedSettings = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
    return storedSettings ? clampOverlay({ ...DEFAULT_OVERLAY, ...JSON.parse(storedSettings) }) : DEFAULT_OVERLAY;
  } catch {
    return DEFAULT_OVERLAY;
  }
}

function clampOverlay(settings: OverlaySettings): OverlaySettings {
  const width = clamp(settings.width, 30, 96);
  const height = clamp(settings.height, 12, 70);

  return {
    ...settings,
    width,
    height,
    x: clamp(settings.x, 0, 100 - width),
    y: clamp(settings.y, 0, 100 - height),
    fontSize: clamp(settings.fontSize, 18, 56),
    cueLength: Math.round(clamp(settings.cueLength, 1, 4)),
    opacity: clamp(settings.opacity, 32, 98),
  };
}

function visibleSentences(sentences: PromptSentence[], activeIndex: number, cueLength: number) {
  return sentences.slice(activeIndex, activeIndex + cueLength);
}

function sentenceIndexOf(sentences: PromptSentence[], sentence: PromptSentence) {
  return sentences.findIndex((candidate) => candidate.id === sentence.id);
}

function formatLiveStrip(interimTranscript: string, improvisedWords: string[]) {
  if (interimTranscript.trim()) {
    return interimTranscript.trim();
  }

  return improvisedWords.slice(-8).join(" ");
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 MB";
  }

  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes > 100 ? 0 : 1)} MB`;
}

function getRecordLabel(status: string, hasSavedTake: boolean) {
  if (hasSavedTake) {
    return "Save take";
  }

  switch (status) {
    case "requesting":
      return "Arming";
    case "starting":
      return "Starting";
    case "recording":
      return "Stop";
    case "finalizing":
      return "Saving";
    default:
      return "Record";
  }
}

function getRecordAriaLabel(status: string) {
  return status === "recording" ? "Stop recording" : "Start recording";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default App;
