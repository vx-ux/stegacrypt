import { useRef, useEffect } from 'react';
import { createNoise3D } from 'simplex-noise';


export default function ShiftBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const noise3D = createNoise3D();
    let animationId;

    const BLOB_COUNT = 5;
    const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => ({
      // Each blob has a unique noise offset so they move independently
      noiseOffsetX: i * 100,
      noiseOffsetY: i * 100 + 50,
      noiseOffsetR: i * 100 + 200,
      // Base radius as a fraction of the smaller viewport dimension
      baseRadiusFactor: 0.18 + Math.random() * 0.14,
      // Color assignment - cycle between electric blue and teal
      color: i % 2 === 0 ? { r: 14, g: 165, b: 233 } : { r: 20, g: 184, b: 166 },
      // Opacity range
      alpha: 0.04 + Math.random() * 0.035,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const SPEED = 0.00012; // Very slow drift

    function draw(time) {
      const t = time * SPEED;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const minDim = Math.min(w, h);

      // Clear with deep navy base
      ctx.fillStyle = '#0a0f1e';
      ctx.fillRect(0, 0, w, h);

      // Draw each blob
      for (const blob of blobs) {
        // Noise-driven position (centered, wanders within ~40% of viewport)
        const nx = noise3D(blob.noiseOffsetX, 0, t) * w * 0.4 + w * 0.5;
        const ny = noise3D(0, blob.noiseOffsetY, t) * h * 0.4 + h * 0.5;
        // Noise-driven radius variation
        const radiusNoise = noise3D(blob.noiseOffsetR, t, 0);
        const radius = minDim * blob.baseRadiusFactor * (0.8 + radiusNoise * 0.4);

        // Radial gradient from blob color to transparent
        const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
        const { r, g, b } = blob.color;
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${blob.alpha})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${blob.alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Subtle wave overlay for extra organic texture
      drawWaves(ctx, w, h, t);

      animationId = requestAnimationFrame(draw);
    }

    function drawWaves(ctx, w, h, t) {
      ctx.save();
      ctx.globalAlpha = 0.025;

      const waveCount = 3;
      const colors = ['#0ea5e9', '#14b8a6', '#0ea5e9'];

      for (let wi = 0; wi < waveCount; wi++) {
        ctx.beginPath();
        const yBase = h * (0.3 + wi * 0.2);

        for (let x = 0; x <= w; x += 4) {
          const noiseVal = noise3D(x * 0.002, wi * 10, t * 1.5 + wi);
          const y = yBase + noiseVal * h * 0.1;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        ctx.fillStyle = colors[wi];
        ctx.fill();
      }

      ctx.restore();
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
