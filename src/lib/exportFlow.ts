export type ExportStage = "idle" | "ready-to-save" | "saving" | "saved" | "error";

export type ExportFlow = {
  stage: ExportStage;
  isModalOpen: boolean;
  shouldClearRecording: boolean;
  message: string;
  error: string;
};

export type ExportFlowEvent =
  | { type: "recording-ready" }
  | { type: "save-started" }
  | { type: "save-complete" }
  | { type: "save-failed"; error: string }
  | { type: "discard" }
  | { type: "recording-cleared" }
  | { type: "dismiss" }
  | { type: "start-next-take" };

export function createExportFlow(): ExportFlow {
  return {
    stage: "idle",
    isModalOpen: false,
    shouldClearRecording: false,
    message: "",
    error: "",
  };
}

export function applyExportEvent(state: ExportFlow, event: ExportFlowEvent): ExportFlow {
  switch (event.type) {
    case "recording-ready":
      return {
        stage: "ready-to-save",
        isModalOpen: true,
        shouldClearRecording: false,
        message: "Your take is ready.",
        error: "",
      };
    case "save-started":
      return {
        ...state,
        stage: "saving",
        isModalOpen: true,
        shouldClearRecording: false,
        message: "Opening your gallery save sheet.",
        error: "",
      };
    case "save-complete":
      return {
        stage: "saved",
        isModalOpen: true,
        shouldClearRecording: true,
        message: "Saved. Ready for another take.",
        error: "",
      };
    case "save-failed":
      return {
        ...state,
        stage: "error",
        isModalOpen: true,
        shouldClearRecording: false,
        error: event.error,
      };
    case "discard":
      return {
        stage: "idle",
        isModalOpen: false,
        shouldClearRecording: true,
        message: "",
        error: "",
      };
    case "recording-cleared":
      return {
        ...state,
        shouldClearRecording: false,
      };
    case "dismiss":
      return {
        ...state,
        isModalOpen: false,
      };
    case "start-next-take":
      return createExportFlow();
  }
}
