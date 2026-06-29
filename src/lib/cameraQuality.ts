export type FacingMode = "user" | "environment";
export type ZoomControl = {
  isSupported: boolean;
  min: number;
  max: number;
  step: number;
  value: number;
};

export const HIGH_QUALITY_VIDEO_BITS = 100_000_000;
export const HIGH_QUALITY_AUDIO_BITS = 320_000;
export const TARGET_FRAME_RATE = 60;
export const MIN_ACCEPTABLE_FRAME_RATE = 55;
export const TARGET_WIDTH = 1920;
export const TARGET_HEIGHT = 1080;

export function createHd60RecordingConstraints(mode: FacingMode): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: mode },
      width: { ideal: TARGET_WIDTH },
      height: { ideal: TARGET_HEIGHT },
      frameRate: { ideal: TARGET_FRAME_RATE, min: MIN_ACCEPTABLE_FRAME_RATE },
      aspectRatio: { ideal: 16 / 9 },
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 },
    },
  };
}

export function isHd60Delivered(settings: MediaTrackSettings | null): boolean {
  if (!settings?.width || !settings.height || !settings.frameRate) {
    return false;
  }

  return (
    settings.width >= TARGET_WIDTH &&
    settings.height >= TARGET_HEIGHT &&
    settings.frameRate >= MIN_ACCEPTABLE_FRAME_RATE
  );
}

export function readZoomCapability(
  capabilities: Pick<MediaTrackCapabilities, "zoom">,
  settings: Pick<MediaTrackSettings, "zoom">,
): ZoomControl {
  const range = capabilities.zoom;

  if (!range || typeof range.min !== "number" || typeof range.max !== "number") {
    return {
      isSupported: false,
      min: 1,
      max: 1,
      step: 0.1,
      value: 1,
    };
  }

  const min = range.min;
  const max = Math.max(range.max, min);
  const step = typeof range.step === "number" && range.step > 0 ? range.step : 0.1;
  const value = clampZoom(typeof settings.zoom === "number" ? settings.zoom : min, min, max);

  return {
    isSupported: max > min,
    min,
    max,
    step,
    value,
  };
}

export function clampZoom(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
