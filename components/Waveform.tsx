
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
  intensity?: number; // fallback intensity if no analyser
}

/**
 * FIXED WAVEFORM VISUALIZER
 * Driven by REAL audio amplitude (PCM buffer) from the playback buffer.
 * Rules:
 * - Single Source of Truth: AudioTrack PCM buffer -> RMS -> Waveform renderer
 * - Smooth the Signal: alpha-filtered RMS
 * - Freeze instantly on pause
 */
const Waveform: React.FC<WaveformProps> = ({ isActive, analyser, intensity = 0.5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const smoothedRmsRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (analyser) {
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    let animationFrameId: number;
    let offset = 0;

    const calculateRealIntensity = () => {
      if (!isActive || !analyser || !dataArrayRef.current) return 0;
      
      // Step 1: Capture PCM Frames (Real-time amplitude)
      analyser.getByteTimeDomainData(dataArrayRef.current);
      
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        // Convert byte range 0-255 to normalized -1 to 1
        const v = (dataArrayRef.current[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArrayRef.current.length);
      
      // Step 2: Smooth the Signal
      const alpha = 0.15; // Responsiveness constant
      smoothedRmsRef.current = alpha * rms + (1 - alpha) * smoothedRmsRef.current;
      
      return Math.min(smoothedRmsRef.current * 8, 1.0); // Amplified for visual impact
    };

    const drawSpiral = (
      color: string, 
      speed: number, 
      amplitude: number, 
      phase: number, 
      frequency: number,
      width: number, 
      height: number,
      currentIntensity: number
    ) => {
      const centerY = height / 2;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      
      ctx.shadowBlur = isActive ? 15 : 5;
      ctx.shadowColor = color;

      const points = 60; 
      const step = width / (points - 1);

      for (let i = 0; i < points; i++) {
        const x = i * step;
        const relativeX = i / (points - 1);
        const wave = Math.sin(relativeX * Math.PI * frequency + offset * speed + phase);
        const envelope = Math.sin(relativeX * Math.PI);
        
        // Amplitude is directly driven by currentIntensity (RMS)
        // If inactive, we use a tiny base amplitude for a "resting" heartbeat
        const dynamicAmplitude = isActive ? (amplitude * currentIntensity) : 2; 
        const y = centerY + (wave * dynamicAmplitude * envelope);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Rule: Never animate when audio is paused (except subtle background offset)
      const currentIntensity = calculateRealIntensity();

      // Rule: PCM is the authority
      drawSpiral('rgba(77, 163, 255, 0.9)', 0.02, height * 0.45, 0, 3, width, height, currentIntensity);
      drawSpiral('rgba(78, 209, 138, 0.7)', 0.015, height * 0.4, Math.PI / 1.5, 2.5, width, height, currentIntensity * 0.8);
      drawSpiral('rgba(155, 123, 255, 0.6)', 0.025, height * 0.35, Math.PI / 0.75, 4, width, height, currentIntensity * 0.6);

      if (isActive) {
        // Animation speed is also tied to intensity
        offset += (0.8 * (currentIntensity + 0.1));
      } else {
        // Rule: Freeze waveform instantly on pause (or near-freeze)
        // We stop updating offset to freeze the state
        ctx.globalAlpha = 0.4;
      }
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, analyser]);

  return <canvas ref={canvasRef} className="w-full h-full" width={1200} height={300} />;
};

export default Waveform;
