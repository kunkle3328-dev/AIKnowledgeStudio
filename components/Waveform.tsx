
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  isActive: boolean;
  intensity?: number; // 0.1 to 1.0
}

const Waveform: React.FC<WaveformProps> = ({ isActive, intensity = 0.5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;

    const drawSpiral = (
      color: string, 
      speed: number, 
      amplitude: number, 
      phase: number, 
      frequency: number,
      width: number, 
      height: number
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
        const dynamicAmplitude = isActive ? amplitude * intensity : 4; 
        const y = centerY + (wave * dynamicAmplitude * envelope);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // LOCKED: 3-Spiral System
      drawSpiral('rgba(77, 163, 255, 0.9)', 0.02, height * 0.35, 0, 3, width, height);
      drawSpiral('rgba(78, 209, 138, 0.7)', 0.015, height * 0.3, Math.PI / 1.5, 2.5, width, height);
      drawSpiral('rgba(155, 123, 255, 0.6)', 0.025, height * 0.25, Math.PI / 0.75, 4, width, height);

      if (isActive) {
        offset += (0.8 * intensity);
      } else {
        offset += 0.1;
        ctx.globalAlpha = 0.4;
      }
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, intensity]);

  return <canvas ref={canvasRef} className="w-full h-full" width={1200} height={300} />;
};

export default Waveform;
