"use client";

import { ArrowRight, Mic, PhoneOff, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkRequest } from "@/lib/request-model";
import { type VoiceState, initial, next } from "@/lib/voice-model";
import { useLiveCall } from "./live-call";

/** What the line needs from the browser: ears and a voice. The Web Speech API is one implementation. */
type Listener = {
  start(on: (text: string, final: boolean) => void): void;
  stop(): void;
};
type Speaker = { speak(text: string): Promise<void>; stop(): void };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function webSpeechListener(): Listener | undefined {
  const speech = window as unknown as SpeechWindow;
  const Recognition =
    speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
  if (!Recognition) return undefined;
  let active = false;
  let recognition: Recognition | undefined;
  return {
    start(on) {
      active = true;
      const listen = () => {
        recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = ({ results }) => {
          const latest = results[results.length - 1];
          on(latest[0].transcript.trim(), latest.isFinal);
        };
        // The browser ends recognition after a silence; keep listening until the call ends.
        recognition.onend = () => active && listen();
        recognition.onerror = ({ error }) => {
          if (error === "not-allowed" || error === "service-not-allowed")
            active = false;
        };
        recognition.start();
      };
      listen();
    },
    stop() {
      active = false;
      recognition?.stop();
    },
  };
}

function webSpeechSpeaker(): Speaker | undefined {
  if (!("speechSynthesis" in window)) return undefined;
  return {
    speak: (text) =>
      new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        // Chrome does not always fire end; a timer sized to the line stands in for it.
        const timer = setTimeout(done, 2_000 + text.length * 80);
        function done() {
          clearTimeout(timer);
          resolve();
        }
        utterance.onend = done;
        utterance.onerror = done;
        speechSynthesis.speak(utterance);
      }),
    stop: () => speechSynthesis.cancel(),
  };
}

const status: Record<VoiceState, { label: string; dot: string }> = {
  idle: { label: "Off", dot: "bg-muted-foreground/40" },
  listening: { label: "Listening", dot: "bg-emerald-500 animate-pulse" },
  thinking: { label: "Thinking", dot: "bg-amber-500" },
  speaking: { label: "Speaking", dot: "bg-sky-500" },
};

/**
 * The support line in the browser: listen, think, speak, and listen again,
 * with the caller able to cut in at any time. Without speech services it is
 * a typed conversation with the same server.
 */
export function VoiceLine({ realtimeUrl }: { realtimeUrl?: string }) {
  const [voice, dispatch] = useReducer(next, initial);
  // The call is shared with staff as it happens, when a realtime server is configured.
  const { publish, notes } = useLiveCall(realtimeUrl);
  const [typed, setTyped] = useState("");
  const [filed, setFiled] = useState<WorkRequest>();
  const [voiceReady, setVoiceReady] = useState<boolean>();
  const listener = useRef<Listener>(undefined);
  const speaker = useRef<Speaker>(undefined);
  const closing = useRef(false);

  useEffect(() => {
    listener.current = webSpeechListener();
    speaker.current = webSpeechSpeaker();
    setVoiceReady(Boolean(listener.current && speaker.current));
  }, []);

  const hangUp = () => {
    listener.current?.stop();
    dispatch({ type: "stop" });
  };
  const call = () => {
    closing.current = false;
    setFiled(undefined);
    listener.current?.start((text, final) =>
      dispatch({ type: "heard", text, final }),
    );
    dispatch({ type: "start" });
  };
  const send = () => {
    const text = typed.trim();
    if (!text) return;
    if (voice.state === "idle") dispatch({ type: "start" });
    dispatch({ type: "heard", text, final: true });
    setTyped("");
  };

  // Thinking: the transcript goes to the server, which answers with the next line.
  useEffect(() => {
    if (voice.state !== "thinking") return;
    const controller = new AbortController();
    fetch("/api/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turns: voice.turns }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then(({ say, request }: { say: string; request?: WorkRequest }) => {
        if (request) {
          setFiled(request);
          closing.current = true;
        }
        publish({ type: "turn", heard: voice.turns.at(-1)?.text, reply: say });
        dispatch({ type: "reply", text: say });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          dispatch({
            type: "reply",
            text: "Sorry, I lost you for a moment. Could you say that again?",
          });
      });
    return () => controller.abort();
  }, [voice.state, voice.turns, publish]);

  // A call that had turns and is back to idle has ended, for whoever is following it.
  const ended = voice.state === "idle" && voice.turns.length > 0;
  useEffect(() => {
    if (ended) publish({ type: "end" });
  }, [ended, publish]);

  // Speaking: say the latest line. Leaving this state early, because the
  // caller cut in, runs the cleanup, which stops the voice mid-sentence.
  useEffect(() => {
    if (voice.state !== "speaking") return;
    const line = voice.turns.at(-1)?.text ?? "";
    let current = true;
    const done = () => {
      if (!current) return;
      if (closing.current) hangUp();
      else dispatch({ type: "spoken" });
    };
    if (speaker.current) speaker.current.speak(line).then(done);
    else done();
    return () => {
      current = false;
      speaker.current?.stop();
    };
  }, [voice.state, voice.turns]);

  const live = voice.state !== "idle";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
          <span className={`size-2 rounded-full ${status[voice.state].dot}`} />
          {status[voice.state].label}
        </span>
        {live ? (
          <Button variant="outline" size="sm" onClick={hangUp}>
            <PhoneOff /> Hang up
          </Button>
        ) : (
          <Button size="sm" onClick={call} disabled={voiceReady === false}>
            <Mic /> Start the call
          </Button>
        )}
        {voiceReady === false && (
          <span className="text-sm text-muted-foreground">
            This browser has no speech services; type below.
          </span>
        )}
      </div>
      <Waveform active={live && voiceReady === true} />
      <ol className="flex flex-col gap-3 text-sm">
        {voice.turns.map((turn, index) => (
          <li
            key={index}
            className={
              turn.role === "caller"
                ? "ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2.5"
                : "max-w-[85%] leading-relaxed"
            }
          >
            {turn.text}
          </li>
        ))}
        {voice.interim && (
          <li className="ml-auto max-w-[85%] px-4 text-muted-foreground italic">
            {voice.interim}
          </li>
        )}
      </ol>
      {notes.map((note, index) => (
        <p
          key={index}
          className="rounded-xl border bg-card px-4 py-3 text-sm"
          role="status"
        >
          <span className="text-muted-foreground">From the team:</span> {note}
        </p>
      ))}
      {filed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
          <span>
            Filed with the {filed.team} team as{" "}
            <span className="font-medium">{filed.title}</span>
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/requests/${filed.id}`}>
              Open the request <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Input
          aria-label="Type instead"
          placeholder="Or type what happened"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={voice.state === "thinking"}
        />
        <Button type="submit" variant="outline" disabled={!typed.trim()}>
          <Send /> Send
        </Button>
      </form>
    </div>
  );
}

/** The microphone's signal, drawn as it arrives, so the caller sees that they are heard. */
function Waveform({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    let frame = 0;
    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((media) => {
        stream = media;
        audio = new AudioContext();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 1024;
        audio.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const { width, height } = context.canvas;
        const draw = () => {
          analyser.getByteTimeDomainData(samples);
          context.clearRect(0, 0, width, height);
          context.strokeStyle = "#10b981";
          context.lineWidth = 2;
          context.beginPath();
          samples.forEach((sample, i) => {
            const x = (i / samples.length) * width;
            const y = (sample / 255) * height;
            if (i === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.stroke();
          frame = requestAnimationFrame(draw);
        };
        draw();
      })
      .catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void audio?.close();
    };
  }, [active]);
  return (
    <canvas
      ref={canvas}
      width={960}
      height={96}
      aria-hidden
      className="h-24 w-full rounded-xl border bg-card"
    />
  );
}
