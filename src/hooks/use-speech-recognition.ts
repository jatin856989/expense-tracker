"use client";

import * as React from "react";

export type SpeechStatus = "idle" | "listening" | "no-support" | "error";

/**
 * Thin wrapper around the browser's native SpeechRecognition (Web Speech
 * API) — free, no server round-trip for transcription, works in Chrome
 * (desktop + Android) and recent Safari/iOS. Requires a secure context
 * (HTTPS, or localhost) — will report "no-support" on a plain-HTTP LAN
 * address during local dev.
 */
export function useSpeechRecognition() {
  const [status, setStatus] = React.useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);

  const supported = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const start = React.useCallback(() => {
    if (!supported) {
      setStatus("no-support");
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatus("no-support");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setErrorMessage(null);
    };

    recognition.onresult = (event) => {
      let combined = "";
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      setTranscript(combined);
    };

    recognition.onerror = (event) => {
      setStatus("error");
      setErrorMessage(
        event.error === "not-allowed" || event.error === "permission-denied"
          ? "Microphone permission was denied."
          : event.error === "no-speech"
            ? "Didn't hear anything — try again."
            : `Speech recognition error: ${event.error}`
      );
    };

    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = React.useCallback(() => {
    setStatus("idle");
    setTranscript("");
    setErrorMessage(null);
  }, []);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { status, transcript, errorMessage, supported, start, stop, reset };
}
