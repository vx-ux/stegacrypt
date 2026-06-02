import { useEffect, useRef } from 'react';

/**
 * ParticleCanvas — cyberpunk dot-network animation
 *
 * Renders an animated particle grid onto a <canvas> element:
 * - Dots drift slowly across the canvas
 * - Lines connect dots that are within CONNECTION_DISTANCE of each other
 * - Mouse proximity pulls nearby dots gently toward the cursor
 * - Colors use the StegaCrypt cyan/purple accent palette
 * - Full cleanup on unmount (RAF cancelled, resize observer disconnected)
 */

const PARTICLE_COUNT = 80;
const CONNECTION_DISTANCE = 140;
const MOUSE_RADIUS = 120;
const MOUSE_FORCE = 0.04;
const BASE_SPEED = 0.3;

// Accent colors from the design system
const COLORS = [
  'rgba(6, 182, 212,',   // --accent-cyan
  'rgba(139, 92, 246,',  // --accent-purple
  'rgba(16, 185, 129,',  // --accent-green
];

function createParticle(width, height) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * BASE_SPEED,
    vy: (Math.random() - 0.5) * BASE_SPEED,
    radius: Math.random() * 1.5 + 1,
    color,
    // pulse phase for subtle size animation
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: (Math.random() * 0.02 + 0.005),
  };
}

export default function ParticleCanvas() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let rafId;
    let particles = [];

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Re-create particles so they fill the new size
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(canvas.width, canvas.height)
      );
    }

    function draw() {
      const { width, height } = canvas;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse attraction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          p.vx += dx / dist * force;
          p.vy += dy / dist * force;
        }

        // Dampen velocity so it doesn't accelerate forever
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > BASE_SPEED * 3) {
          p.vx = (p.vx / speed) * BASE_SPEED * 3;
          p.vy = (p.vy / speed) * BASE_SPEED * 3;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.phaseSpeed;

        // Wrap around edges
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Pulsing radius
        const r = p.radius + Math.sin(p.phase) * 0.6;

        // Draw dot with subtle glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        gradient.addColorStop(0, `${p.color} 0.9)`);
        gradient.addColorStop(1, `${p.color} 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Solid core
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} 1)`;
        ctx.fill();
      }

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.25;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    }

    // Mouse tracking
    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    // Resize observer — reacts to hero section size changes
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    resize();
    draw();

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    // Also listen on window for when mouse leaves the canvas area
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
