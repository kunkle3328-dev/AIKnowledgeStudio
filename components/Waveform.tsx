
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  isActive: boolean;
  intensity?: number;
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

    const drawSplineWave = (color: string, speed: number, amplitude: number, phase: number, width: number, height: number) => {
      const centerY = height / 2;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;

      const points = 12;
      const step = width / (points - 1);

      for (let i = 0; i < points; i++) {
        const x = i * step;
        const relativeX = i / (points - 1);
        const sine = Math.sin(relativeX * Math.PI * 2 + offset * speed + phase);
        const y = centerY + (sine * amplitude * (isActive ? 1 : 0.05) * intensity);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = (i - 1) * step;
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(prevX, y, cpX, y); // simplified spline feel
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Matches screenshot #3 waves
      drawSplineWave('rgba(79, 124, 255, 0.7)', 0.04, height * 0.35, 0, width, height);
      drawSplineWave('rgba(34, 197, 94, 0.7)', 0.03, height * 0.3, Math.PI / 2, width, height);
      drawSplineWave('rgba(139, 92, 246, 0.7)', 0.05, height * 0.4, Math.PI, width, height);

      if (isActive) offset += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, intensity]);

  return <canvas ref={canvasRef} className="w-full h-full" width={800} height={400} />;
};

export default Waveform;
