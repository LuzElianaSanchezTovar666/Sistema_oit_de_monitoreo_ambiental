import React, { useEffect, useRef } from 'react';

/**
 * Fondo interactivo editorial estilo Steep para SIMOA:
 * - Canvas Paper White con retícula hairline sutil
 * - Curvas gesturales de telemetría en trazos Sienna Brown (#5d2a1a) y Slate Gray (#777b86)
 * - Nodos de sensores IoT con micro-destello y anillos en tono Blush Peach (#fbe1d1)
 * - Parallax fluido con el cursor del mouse y respeto a prefers-reduced-motion
 */
export const EnvironmentalThreeBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / Math.max(width, 1) - 0.5) * 2;
      mouse.targetY = (e.clientY / Math.max(height, 1) - 0.5) * 2;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Nodos de sensores IoT (Steep Minimal: Ink Black / Sienna Brown con halo Peach)
    const sensorNodes = [
      { rx: 0.12, ry: 0.32, label: '23.4 °C · GERMINACIÓN (DHT22)', color: '#5d2a1a', phase: 0.0 },
      { rx: 0.42, ry: 0.54, label: '62 %RH · CULTIVO A1 (BME280)', color: '#17191c', phase: 1.4 },
      { rx: 0.68, ry: 0.36, label: '22.8 °C · CLIMATIZACIÓN (SHT31)', color: '#5d2a1a', phase: 2.7 },
      { rx: 0.88, ry: 0.62, label: '0.04 σ · ANOMALÍA Z-SCORE', color: '#17191c', phase: 4.1 },
    ];

    const drawTelemetryWave = (
      t: number,
      baseY: number,
      amp: number,
      freq: number,
      speed: number,
      strokeColor: string,
      fillTop: string,
      fillBottom: string,
      parallaxY: number
    ) => {
      ctx.save();
      const step = 20;
      const points: Array<{ x: number; y: number }> = [];

      for (let x = 0; x <= width + step; x += step) {
        const normX = x / Math.max(width, 1);
        const y =
          baseY +
          parallaxY +
          Math.sin(normX * Math.PI * freq + t * speed) * amp +
          Math.cos(normX * Math.PI * (freq * 1.5) - t * speed * 0.5) * (amp * 0.35);
        points.push({ x, y });
      }

      // Área degradada sutil bajo la curva
      const grad = ctx.createLinearGradient(0, baseY - amp * 1.2, 0, height);
      grad.addColorStop(0, fillTop);
      grad.addColorStop(1, fillBottom);

      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Trazo fino gestural estilo Steep
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.restore();
    };

    const startTime = performance.now();

    const renderFrame = (now: number) => {
      const elapsed = prefersReducedMotion ? 0 : (now - startTime) * 0.001;

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Retícula hairline muy sutil sobre Paper White (#ffffff)
      ctx.save();
      ctx.strokeStyle = 'rgba(23, 25, 28, 0.035)';
      ctx.lineWidth = 1;
      const gridSize = 72;
      const offsetX = (mouse.x * -8) % gridSize;
      const offsetY = (mouse.y * -8) % gridSize;

      for (let x = offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Curva inferior de Humedad en tono Slate Gray suave
      drawTelemetryWave(
        elapsed,
        height * 0.65,
        28,
        2.8,
        0.45,
        'rgba(119, 123, 134, 0.45)',
        'rgba(242, 242, 243, 0.65)',
        'rgba(255, 255, 255, 0.0)',
        mouse.y * 10
      );

      // 3. Curva principal gestural en Sienna Brown (#5d2a1a) con velo Peach suave
      drawTelemetryWave(
        elapsed,
        height * 0.52,
        22,
        2.2,
        0.65,
        'rgba(93, 42, 26, 0.75)',
        'rgba(251, 225, 209, 0.35)',
        'rgba(255, 255, 255, 0.0)',
        mouse.y * 14
      );

      // 4. Conexiones punteadas y nodos de sensores IoT
      ctx.save();
      const computedNodes = sensorNodes.map((n) => ({
        ...n,
        x: n.rx * width + mouse.x * 12,
        y: n.ry * height + Math.sin(elapsed * 0.8 + n.phase) * 6 + mouse.y * 8,
      }));

      // Enlaces hairline punteados
      ctx.strokeStyle = 'rgba(119, 123, 134, 0.25)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < computedNodes.length - 1; i++) {
        ctx.moveTo(computedNodes[i].x, computedNodes[i].y);
        ctx.lineTo(computedNodes[i + 1].x, computedNodes[i + 1].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Dibujar cada sensor IoT
      computedNodes.forEach((node) => {
        const pulseRadius = 10 + Math.sin(elapsed * 2.0 + node.phase) * 4;

        // Halo Blush Peach (#fbe1d1)
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 225, 209, 0.55)';
        ctx.fill();

        // Núcleo del sensor
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Micro-centro blanco
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Tipografía Sohne 14px Slate Gray
        ctx.font = '400 13px Inter, -apple-system, sans-serif';
        ctx.fillStyle = '#777b86';
        ctx.fillText(node.label, node.x + 16, node.y + 4);
      });
      ctx.restore();

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(renderFrame);
      }
    };

    animationFrameId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-white"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
