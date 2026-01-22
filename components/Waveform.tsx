
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  isActive: boolean;
  analyser?: AnalyserNode | null;
  intensity?: number;
}

/**
 * 🌊 WAVEFORM VISUALIZER (INVARIANT V7)
 * Definition: The waveform indicates system presence and state.
 * It is never hidden or disabled.
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
      // 🛡️ Rule: Presence is mandatory. Sublte pulse even when idle.
      const baseIntensity = 0.08;
      
      if (!isActive || !analyser || !dataArrayRef.current) return baseIntensity;
      
      analyser.getByteTimeDomainData(dataArrayRef.current);
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const v = (dataArrayRef.current[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArrayRef.current.length);
      const alpha = 0.2;
      smoothedRmsRef.current = alpha * rms + (1 - alpha) * smoothedRmsRef.current;
      
      return Math.max(baseIntensity, Math.min(smoothedRmsRef.current * 4 * intensity, 1.0)); 
    };

    const drawWave = (color: string, speed: number, amplitude: number, phase: number, freq: number, w: number, h: number, curInt: number) => {
      const centerY = h / 2;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10 * curInt;
      ctx.shadowColor = color;

      for (let x = 0; x <= w; x += 5) {
        const relX = x / w;
        const wave = Math.sin(relX * Math.PI * freq + offset * speed + phase);
        const taper = Math.sin(relX * Math.PI);
        const y = centerY + (wave * amplitude * taper * curInt);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const curInt = calculateRealIntensity();

      drawWave('rgba(77, 163, 255, 0.8)', 0.03, height * 0.45, 0, 3, width, height, curInt);
      drawWave('rgba(78, 209, 138, 0.5)', 0.02, height * 0.35, Math.PI / 1.5, 2.5, width, height, curInt * 0.7);
      drawWave('rgba(155, 123, 255, 0.4)', 0.04, height * 0.25, Math.PI / 0.75, 4, width, height, curInt * 0.5);

      offset += (0.2 * (curInt + 0.1));
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, analyser, intensity]);

  return <canvas ref={canvasRef} className="w-full h-full" width={1200} height={400} />;
};

export default Waveform;
