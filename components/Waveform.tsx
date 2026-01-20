
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  isActive: boolean;
  intensity?: number; // 0 to 1
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

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw 3 layers of waves
      const drawWave = (color: string, speed: number, amplitude: number, phase: number) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        for (let x = 0; x <= width; x += 1) {
          const relativeX = x / width;
          const sine = Math.sin(relativeX * Math.PI * 4 + offset * speed + phase);
          const y = centerY + (sine * amplitude * (isActive ? 1 : 0.1) * intensity);
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      // Blue layer
      drawWave('rgba(59, 130, 246, 0.6)', 0.05, height * 0.3, 0);
      // Green layer
      drawWave('rgba(16, 185, 129, 0.6)', 0.03, height * 0.25, Math.PI / 2);
      // Purple layer
      drawWave('rgba(139, 92, 246, 0.6)', 0.07, height * 0.35, Math.PI);

      if (isActive) {
        offset += 1;
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, intensity]);

  return <canvas ref={canvasRef} className="w-full h-full" width={800} height={400} />;
};

export default Waveform;
