import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampZoom,
  createHd60RecordingConstraints,
  FacingMode,
  HIGH_QUALITY_AUDIO_BITS,
  HIGH_QUALITY_VIDEO_BITS,
  readZoomCapability,
  type ZoomControl,
} from "../lib/cameraQuality";

type RecorderStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "starting"
  | "recording"
  | "finalizing"
  | "stopped"
  | "error";

type RecorderState = {
  status: RecorderStatus;
  error: string;
  facingMode: FacingMode;
  mediaBlob: Blob | null;
  mediaUrl: string;
  mimeType: string;
  videoSettings: MediaTrackSettings | null;
  zoom: ZoomControl;
  isCameraReady: boolean;
  isRecording: boolean;
  isBusy: boolean;
};

type RecorderActions = {
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  flipCamera: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
  setZoom: (value: number) => Promise<void>;
};

export function useCameraRecorder(
  videoRef: RefObject<HTMLVideoElement>,
): RecorderState & RecorderActions {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [videoSettings, setVideoSettings] = useState<MediaTrackSettings | null>(null);
  const [zoom, setZoomState] = useState<ZoomControl>(readZoomCapability({}, {}));
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastFacingModeRef = useRef<FacingMode>(facingMode);

  lastFacingModeRef.current = facingMode;

  const supportedMimeType = useMemo(() => {
    if (typeof MediaRecorder === "undefined") {
      return "";
    }

    return (
      [
        "video/mp4;codecs=h264,aac",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
    );
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
    setVideoSettings(null);
    setZoomState(readZoomCapability({}, {}));
  }, [videoRef]);

  const refreshPreview = useCallback(async () => {
    const stream = streamRef.current;
    const videoElement = videoRef.current;

    if (!stream || !videoElement) {
      return;
    }

    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }

    videoElement.muted = true;
    videoElement.playsInline = true;

    if (videoElement.paused || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        await videoElement.play();
      } catch {
        // iOS may reject play during page transitions; the next keepalive tick retries.
      }
    }

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack?.getSettings() ?? null;

    setVideoSettings(settings);
    setZoomState(
      videoTrack ? readZoomCapability(videoTrack.getCapabilities(), settings ?? {}) : readZoomCapability({}, {}),
    );
  }, [videoRef]);

  const attachStream = useCallback(
    async (stream: MediaStream) => {
      streamRef.current = stream;
      await refreshPreview();
      setStatus("ready");
      setError("");
    },
    [refreshPreview],
  );

  const requestStream = useCallback(async (mode: FacingMode) => {
    return navigator.mediaDevices.getUserMedia(createHd60RecordingConstraints(mode));
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Camera access is unavailable in this browser.");
      return;
    }

    setStatus("requesting");
    setError("");

    try {
      stopCamera();
      const stream = await requestStream(lastFacingModeRef.current);
      await attachStream(stream);
    } catch (cameraError) {
      setStatus("error");
      setError(cameraError instanceof Error ? cameraError.message : "Camera request failed.");
    }
  }, [attachStream, requestStream, stopCamera]);

  useEffect(() => {
    const keepPreviewAlive = () => {
      const stream = streamRef.current;
      const videoTrack = stream?.getVideoTracks()[0];

      if (!stream) {
        return;
      }

      if (videoTrack?.readyState !== "live") {
        if (
          status !== "requesting" &&
          status !== "starting" &&
          status !== "recording" &&
          status !== "finalizing"
        ) {
          void startCamera();
        }
        return;
      }

      void refreshPreview();
    };

    const interval = window.setInterval(keepPreviewAlive, 1400);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        keepPreviewAlive();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshPreview, startCamera, status]);

  const flipCamera = useCallback(async () => {
    const nextFacingMode = lastFacingModeRef.current === "user" ? "environment" : "user";
    setFacingMode(nextFacingMode);
    lastFacingModeRef.current = nextFacingMode;

    if (streamRef.current) {
      setStatus("requesting");
      streamRef.current.getTracks().forEach((track) => track.stop());

      try {
        const stream = await requestStream(nextFacingMode);
        await attachStream(stream);
      } catch (cameraError) {
        setStatus("error");
        setError(cameraError instanceof Error ? cameraError.message : "Camera flip failed.");
      }
    }
  }, [attachStream, requestStream]);

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      setStatus("error");
      setError("Recording is unavailable in this browser.");
      return;
    }

    if (!streamRef.current) {
      await startCamera();
    }

    const stream = streamRef.current;

    if (!stream) {
      return;
    }

    chunksRef.current = [];
    setMediaBlob(null);

    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
      setMediaUrl("");
    }

    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: HIGH_QUALITY_VIDEO_BITS,
      audioBitsPerSecond: HIGH_QUALITY_AUDIO_BITS,
    };

    if (supportedMimeType) {
      recorderOptions.mimeType = supportedMimeType;
    }

    try {
      setStatus("starting");
      const recorder = new MediaRecorder(stream, recorderOptions);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const outputType = recorder.mimeType || supportedMimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: outputType });
        const url = URL.createObjectURL(blob);

        setMimeType(outputType);
        setMediaBlob(blob);
        setMediaUrl(url);
        setStatus("stopped");
        void refreshPreview();
      };

      recorder.onerror = () => {
        setStatus("error");
        setError("Recording stopped because the browser recorder reported an error.");
      };

      recorder.start(1000);
      setMimeType(recorder.mimeType || supportedMimeType);
      setStatus("recording");
      setError("");
    } catch (recordingError) {
      setStatus("error");
      setError(recordingError instanceof Error ? recordingError.message : "Recording failed.");
    }
  }, [mediaUrl, refreshPreview, startCamera, supportedMimeType]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      setStatus("finalizing");
      try {
        recorderRef.current.requestData();
      } catch {
        // Some browsers disallow requestData at this exact edge; stop still flushes data.
      }
      recorderRef.current.stop();
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }

    setMediaBlob(null);
    setMediaUrl("");
    chunksRef.current = [];

    if (streamRef.current) {
      setStatus("ready");
    } else {
      setStatus("idle");
    }
  }, [mediaUrl]);

  const setZoom = useCallback(async (value: number) => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    const currentZoom = readZoomCapability(videoTrack.getCapabilities(), videoTrack.getSettings());

    if (!currentZoom.isSupported) {
      setZoomState(currentZoom);
      return;
    }

    const nextZoom = clampZoom(value, currentZoom.min, currentZoom.max);

    await videoTrack.applyConstraints({ advanced: [{ zoom: nextZoom }] });

    const nextSettings = videoTrack.getSettings();
    setVideoSettings(nextSettings);
    setZoomState(readZoomCapability(videoTrack.getCapabilities(), nextSettings));
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl]);

  return {
    status,
    error,
    facingMode,
    mediaBlob,
    mediaUrl,
    mimeType,
    videoSettings,
    zoom,
    isCameraReady:
      status === "ready" ||
      status === "starting" ||
      status === "recording" ||
      status === "finalizing" ||
      status === "stopped",
    isRecording: status === "recording",
    isBusy: status === "requesting" || status === "starting" || status === "finalizing",
    startCamera,
    stopCamera,
    flipCamera,
    startRecording,
    stopRecording,
    clearRecording,
    setZoom,
  };
}
