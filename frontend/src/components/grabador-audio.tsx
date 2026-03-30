"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Estado = "idle" | "grabando" | "pausado" | "procesando" | "completado" | "error";

interface GrabadorAudioProps {
  onComplete: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GrabadorAudio({ onComplete, disabled = false }: GrabadorAudioProps) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [segundos, setSegundos] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef      = useRef("");

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const sourceRef    = useRef<MediaStreamAudioSourceNode | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number | null>(null);

  // ── Waveform ──────────────────────────────────────────────────────────────

  const startWaveform = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current   = source;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Subtle center line
      ctx.strokeStyle = "rgba(78,168,125,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

      // Waveform — forest green gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0,   "rgba(28,61,47,0.4)");
      gradient.addColorStop(0.3, "rgba(78,168,125,0.7)");
      gradient.addColorStop(0.5, "rgba(78,168,125,1)");
      gradient.addColorStop(0.7, "rgba(78,168,125,0.7)");
      gradient.addColorStop(1,   "rgba(28,61,47,0.4)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = "round";
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const stopWaveform = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    audioCtxRef.current = null; analyserRef.current = null; sourceRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(78,168,125,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
      }
    }
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const iniciar = useCallback(async () => {
    setErrorMsg(""); setSegundos(0); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setEstado("procesando");
        onComplete(blob, mimeType);
      };
      recorder.start(250);
      startWaveform(stream);
      startTimer();
      setEstado("grabando");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al acceder al micrófono");
      setEstado("error");
    }
  }, [onComplete, startWaveform, startTimer]);

  const pausar = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause(); stopTimer(); setEstado("pausado");
    }
  }, [stopTimer]);

  const reanudar = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume(); startTimer(); setEstado("grabando");
    }
  }, [startTimer]);

  const detener = useCallback(() => {
    stopTimer(); stopWaveform();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [stopTimer, stopWaveform]);

  useEffect(() => () => {
    stopTimer(); stopWaveform(); streamRef.current?.getTracks().forEach(t => t.stop());
  }, [stopTimer, stopWaveform]);

  // ── States ────────────────────────────────────────────────────────────────

  const estaGrabando   = estado === "grabando";
  const estaPausado    = estado === "pausado";
  const estaActivo     = estaGrabando || estaPausado;
  const estaProcesando = estado === "procesando";

  return (
    <div className="flex flex-col items-center gap-7 w-full" role="region" aria-label="Grabador de audio">

      {/* Waveform canvas */}
      <div
        className="w-full rounded-xl overflow-hidden relative"
        style={{
          backgroundColor: "var(--forest-950)",
          border: "1px solid rgba(78,168,125,0.15)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-[80px]"
          aria-hidden="true"
        />
        {/* Recording indicator overlay */}
        {estaGrabando && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-recording-ring absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: "#ef4444" }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span
              className="font-mono text-[10px] font-semibold tracking-widest"
              style={{ color: "#ef4444" }}
            >
              REC
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div
        className="font-mono text-6xl font-medium tabular-nums tracking-widest transition-colors duration-300"
        style={{ color: estaGrabando ? "var(--forest-400)" : "var(--stone)" }}
        aria-live="polite"
        aria-label={`Tiempo de grabación: ${formatTimer(segundos)}`}
      >
        {formatTimer(segundos)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3" role="group" aria-label="Controles de grabación">

        {estado === "idle" && (
          <button
            onClick={iniciar}
            disabled={disabled}
            aria-label="Iniciar grabación"
            className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
            style={{
              backgroundColor: "var(--forest-800)",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(28,61,47,0.3)",
            }}
            onMouseEnter={e => {
              if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--forest-600)";
            }}
            onMouseLeave={e => {
              if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--forest-800)";
            }}
          >
            <IconMic />
            Iniciar grabación
          </button>
        )}

        {estaActivo && (
          <button
            onClick={estaGrabando ? pausar : reanudar}
            aria-label={estaGrabando ? "Pausar grabación" : "Reanudar grabación"}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer"
            style={{
              border: "1.5px solid var(--forest-800)",
              color: "var(--forest-800)",
              backgroundColor: "transparent",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--forest-50)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            {estaGrabando ? <IconPause /> : <IconPlay />}
            {estaGrabando ? "Pausar" : "Reanudar"}
          </button>
        )}

        {estaActivo && (
          <button
            onClick={detener}
            aria-label="Detener grabación"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors duration-150 cursor-pointer"
            style={{
              backgroundColor: "#ef4444",
              color: "#fff",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#dc2626"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#ef4444"; }}
          >
            <IconStop />
            Detener
          </button>
        )}

        {estaProcesando && (
          <div
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
            style={{ backgroundColor: "var(--parchment)", border: "1px solid var(--border-warm)" }}
            role="status"
            aria-live="polite"
          >
            <span
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--forest-400)", borderTopColor: "transparent" }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>Subiendo audio…</span>
          </div>
        )}

        {estado === "completado" && (
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: "var(--forest-50)",
              border: "1px solid var(--forest-200)",
              color: "var(--forest-800)",
            }}
            role="status"
          >
            <IconCheck />
            Audio enviado
          </div>
        )}
      </div>

      {/* Estado textual */}
      {estaActivo && (
        <p
          className="text-sm text-center"
          style={{ color: "var(--stone)" }}
          aria-live="polite"
        >
          {estaGrabando
            ? "Grabando consulta — el audio se procesa al detener."
            : "Grabación pausada. Reanuda cuando estés listo."}
        </p>
      )}

      {/* Error */}
      {estado === "error" && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "#dc2626" }}
          role="alert"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{errorMsg || "Error al acceder al micrófono. Verifica los permisos."}</span>
        </div>
      )}
    </div>
  );
}
