import { describe, expect, it } from "vitest";
import {
  createHd60RecordingConstraints,
  HIGH_QUALITY_AUDIO_BITS,
  HIGH_QUALITY_VIDEO_BITS,
  readZoomCapability,
} from "./cameraQuality";

describe("camera quality profile", () => {
  it("requests mirrored front-camera HD at 60 fps", () => {
    const constraints = createHd60RecordingConstraints("user");

    expect(constraints.video).toMatchObject({
      facingMode: { ideal: "user" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60, min: 55 },
    });
  });

  it("keeps recording bitrates at the high quality profile", () => {
    expect(HIGH_QUALITY_VIDEO_BITS).toBe(100_000_000);
    expect(HIGH_QUALITY_AUDIO_BITS).toBe(320_000);
  });

  it("normalizes browser zoom capabilities into a friendly slider range", () => {
    const zoom = readZoomCapability(
      { zoom: { min: 1, max: 8, step: 0.1 } },
      { zoom: 2.6 },
    );

    expect(zoom).toEqual({
      isSupported: true,
      min: 1,
      max: 8,
      step: 0.1,
      value: 2.6,
    });
  });

  it("marks zoom unsupported when the camera track does not expose a range", () => {
    expect(readZoomCapability({}, {})).toMatchObject({ isSupported: false, value: 1 });
  });
});
