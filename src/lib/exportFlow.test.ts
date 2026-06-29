import { describe, expect, it } from "vitest";
import { applyExportEvent, createExportFlow } from "./exportFlow";

describe("export flow", () => {
  it("opens the save prompt as soon as a recording is ready", () => {
    const flow = applyExportEvent(createExportFlow(), { type: "recording-ready" });

    expect(flow.stage).toBe("ready-to-save");
    expect(flow.isModalOpen).toBe(true);
    expect(flow.shouldClearRecording).toBe(false);
  });

  it("requests recording cleanup after a successful save", () => {
    const ready = applyExportEvent(createExportFlow(), { type: "recording-ready" });
    const saved = applyExportEvent(ready, { type: "save-complete" });

    expect(saved.stage).toBe("saved");
    expect(saved.isModalOpen).toBe(true);
    expect(saved.shouldClearRecording).toBe(true);
    expect(saved.message).toContain("Ready for another take");
  });

  it("returns to a clean idle state for the next recording", () => {
    const ready = applyExportEvent(createExportFlow(), { type: "recording-ready" });
    const saved = applyExportEvent(ready, { type: "save-complete" });
    const idle = applyExportEvent(saved, { type: "start-next-take" });

    expect(idle).toEqual(createExportFlow());
  });

  it("lets the user discard a take instead of saving it", () => {
    const ready = applyExportEvent(createExportFlow(), { type: "recording-ready" });
    const discarded = applyExportEvent(ready, { type: "discard" });

    expect(discarded.stage).toBe("idle");
    expect(discarded.isModalOpen).toBe(false);
    expect(discarded.shouldClearRecording).toBe(true);
  });
});
