import { useState, useRef, useEffect } from "react";
import { tokenizeLine } from "../../utils/helper";

export const useAnimationLogic = (settings, code) => {
  const [typedCode, setTypedCode] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const audioDestRef = useRef(null);
  const bgAudioRef = useRef(null);

  // Cursor Blinking Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Frame Rate Effect
  useEffect(() => {
    if (settings.frameByFrame) {
      document.addEventListener("keydown", handleNextFrame);
      return () => document.removeEventListener("keydown", handleNextFrame);
    }
  }, [settings.frameByFrame, typedCode]);

  const handleNextFrame = () => {
    if (!settings.frameByFrame || !isAnimating) return;

    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    if (typedCode.length < code.length) {
      setTypedCode(code.slice(0, typedCode.length + 1));
      renderFrame(
        canvasRef.current.getContext("2d"),
        code.slice(0, typedCode.length + 1)
      );
    } else {
      setIsAnimating(false);
      stopRecording();
    }
  };

  // Play a sound through the shared AudioContext so it gets captured in the recording
  const playSound = async (type) => {
    if (!settings.typingSounds && type === "typing") return;
    if (!settings.backgroundMusic && type === "background") return;

    const audioCtx = audioCtxRef.current;
    const dest = audioDestRef.current;
    if (!audioCtx || !dest) return;

    const url = type === "typing" ? "/sounds/keypress.mp3" : "/sounds/background.mp3";

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = type === "background";

    // Connect to both the destination (for recording) and the speakers
    source.connect(dest);
    source.connect(audioCtx.destination);
    source.start();

    if (type === "background") {
      bgAudioRef.current = source;
    }
  };

  const stopRecording = () => {
    // Stop background music source node if playing
    if (bgAudioRef.current) {
      try { bgAudioRef.current.stop(); } catch (_) {}
      bgAudioRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  };

  const startAnimation = () => {
    setIsAnimating(true);
    setTypedCode("");
    recordedChunksRef.current = [];

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = settings.width;
    canvas.height = settings.height;

    // --- Set up Web Audio routing ---
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    audioCtxRef.current = audioCtx;
    audioDestRef.current = dest;

    // Merge canvas video track + audio track into one stream
    const videoStream = canvas.captureStream(
      settings.frameRate * settings.playbackSpeed
    );
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    mediaRecorderRef.current = new MediaRecorder(combinedStream, {
      mimeType: settings.outputFormat === "MP4" ? "video/mp4" : "video/webm",
    });
    mediaRecorderRef.current.ondataavailable = (event) =>
      recordedChunksRef.current.push(event.data);
    mediaRecorderRef.current.start();

    let i = 0;
    animationRef.current = setInterval(
      () => {
        if (i <= code.length) {
          setTypedCode(code.slice(0, i));
          renderFrame(ctx, code.slice(0, i));
          if (settings.typingSounds) playSound("typing");
          i++;
        } else {
          clearInterval(animationRef.current);
          setIsAnimating(false);
          stopRecording();
        }
      },
      1000 / settings.typingSpeed / settings.playbackSpeed
    );

    if (settings.backgroundMusic) playSound("background");
  };

  const renderFrame = (ctx, text) => {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, settings.width, settings.height);
    ctx.font = `${settings.fontSize}px ${settings.fontFamily} monospace`;

    const lines = text.split("\n");
    const maxLines = Math.floor((settings.height - 50) / (settings.fontSize * 1.5));
    const start = Math.max(0, lines.length - maxLines);
    const visibleLines = lines.slice(start);

    visibleLines.forEach((line, index) => {
      const yPos = 50 + index * (settings.fontSize * 1.5);
      let xPos = 20;

      if (settings.lineNumbers) {
        const lineNumText = `${start + index + 1}. `;
        ctx.fillStyle = "#6272a4"; // muted color for line numbers
        ctx.fillText(lineNumText, 5, yPos);
        xPos = 10 + ctx.measureText(lineNumText).width;
      }

      // Draw each syntax-highlighted token
      const tokens = tokenizeLine(line);
      tokens.forEach((token) => {
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, xPos, yPos);
        xPos += ctx.measureText(token.text).width;
      });
    });

    if (showCursor) {
      const lastLine = visibleLines[visibleLines.length - 1] || "";
      const lastLineNum = start + visibleLines.length;
      const lineNumWidth = settings.lineNumbers
        ? 10 + ctx.measureText(`${lastLineNum}. `).width
        : 20;
      ctx.fillStyle = settings.textColor;
      ctx.fillText(
        "|",
        lineNumWidth + ctx.measureText(lastLine).width,
        50 + (visibleLines.length - 1) * (settings.fontSize * 1.5)
      );
    }

    if (settings.watermark) {
      ctx.font = "12px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(
        "© " + settings.branding,
        settings.width - 120,
        settings.height - 10
      );
    }
  };

  const downloadRecording = () => {
    const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (`animation.${settings.outputFormat}`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return {
    typedCode,
    isAnimating,
    showCursor,
    canvasRef,
    startAnimation,
    downloadRecording,
  };
};