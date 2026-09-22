"use client";

import * as React from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { parseAndCreateVoiceCommand, undoVoiceEntity } from "@/lib/actions/voice";
import { cn } from "@/lib/utils";

export function VoiceFab() {
  const { status, transcript, errorMessage, supported, start, stop, reset } = useSpeechRecognition();
  const [open, setOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const wasListening = React.useRef(false);

  async function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setOpen(false);
      reset();
      return;
    }
    setProcessing(true);
    const result = await parseAndCreateVoiceCommand(trimmed);
    setProcessing(false);
    setOpen(false);
    reset();

    if (result.success) {
      toast.success(result.summary, {
        action: {
          label: "Undo",
          onClick: async () => {
            await undoVoiceEntity(result.undo.entity, result.undo.id);
            toast("Undone.");
          },
        },
      });
    } else {
      toast.error(result.error, {
        description: result.transcript ? `Heard: "${result.transcript}"` : undefined,
      });
    }
  }

  // Recognition ends on its own (silence detected) — auto-submit whatever
  // was heard. This is the "just speak and it happens" path.
  React.useEffect(() => {
    if (wasListening.current && status === "idle" && open) {
      handleSubmit(transcript);
    }
    wasListening.current = status === "listening";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleOpen() {
    if (!supported) {
      toast.error("Voice input isn't supported in this browser.", {
        description: "Try Chrome on Android, or Safari on iOS 14.5+.",
      });
      return;
    }
    setOpen(true);
    start();
  }

  function handleSheetChange(next: boolean) {
    if (!next) {
      stop();
      setOpen(false);
      reset();
    }
  }

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed right-5 bottom-5 z-40 size-14 rounded-full shadow-lg"
        aria-label="Add by voice"
        onClick={handleOpen}
      >
        <Mic className="size-6" />
      </Button>

      <Sheet open={open} onOpenChange={handleSheetChange}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>{processing ? "Adding it in..." : "Listening"}</SheetTitle>
            <SheetDescription>
              Try &ldquo;add expense 500 for groceries, paid cash&rdquo; or &ldquo;I lent Rahul 2000&rdquo;.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center gap-4 px-4 py-6">
            <div
              className={cn(
                "flex size-20 items-center justify-center rounded-full bg-primary/10",
                status === "listening" && "animate-pulse"
              )}
            >
              {processing ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : (
                <Mic className="size-8 text-primary" />
              )}
            </div>
            <p className="min-h-12 text-center text-sm text-muted-foreground">
              {errorMessage ?? (transcript || (status === "listening" ? "Listening…" : "Getting ready…"))}
            </p>
            {status === "listening" && (
              <Button variant="outline" onClick={stop}>
                <Square className="size-4" /> Stop
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
