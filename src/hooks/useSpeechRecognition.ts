import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechState = {
  status: SpeechRecognitionStatus;
  transcript: string;
  interimTranscript: string;
  error: string;
  isSupported: boolean;
};

type SpeechActions = {
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeechRecognition(language = "en-US"): SpeechState & SpeechActions {
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const finalTranscriptRef = useRef("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const shouldListenRef = useRef(false);
  const startInstanceRef = useRef<() => void>(() => undefined);

  const getConstructor = useCallback(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return window.SpeechRecognition ?? window.webkitSpeechRecognition;
  }, []);

  const isSupported = useMemo(() => Boolean(getConstructor()), [getConstructor]);

  useEffect(() => {
    startInstanceRef.current = () => {
      const RecognitionConstructor = getConstructor();

      if (!RecognitionConstructor) {
        setStatus("unsupported");
        setError("Speech recognition is unavailable in this browser.");
        return;
      }

      if (recognitionRef.current) {
        return;
      }

      const recognition = new RecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event) => {
        let interim = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const spokenText = result[0]?.transcript ?? "";

          if (result.isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${spokenText}`.trim();
          } else {
            interim = `${interim} ${spokenText}`.trim();
          }
        }

        setInterimTranscript(interim);
        setTranscript([finalTranscriptRef.current, interim].filter(Boolean).join(" "));
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }

        setStatus("error");
        setError(event.message || event.error);
      };

      recognition.onend = () => {
        recognitionRef.current = null;

        if (shouldListenRef.current) {
          restartTimerRef.current = window.setTimeout(() => {
            startInstanceRef.current();
          }, 240);
          return;
        }

        setStatus("idle");
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setStatus("listening");
        setError("");
      } catch (startError) {
        setStatus("error");
        setError(startError instanceof Error ? startError.message : "Speech recognition failed.");
      }
    };
  }, [getConstructor, language]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;

      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    shouldListenRef.current = true;

    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    startInstanceRef.current();
  }, []);

  const stop = useCallback(() => {
    shouldListenRef.current = false;

    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError("");
  }, []);

  return {
    status,
    transcript,
    interimTranscript,
    error,
    isSupported,
    start,
    stop,
    reset,
  };
}
