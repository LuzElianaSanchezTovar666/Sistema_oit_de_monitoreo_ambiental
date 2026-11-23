import React, { useEffect, useRef } from 'react';

/**
 * Fondo interactivo de gráficas de sensores e invernadero para SIMOA:
 * - Retícula milimetrada estilo estación agrometeorológica
 * - Siluetas vectoriales sutiles de naves de invernadero
 * - Curvas animadas en tiempo real de Temperatura (°C) y Humedad Relativa (%RH)
 * - Nodos de sensores pulsantes con lecturas ambientales y flujo de datos
 * - Parallax suave con el cursor y soporte para prefers-reduced-motion
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

    // Nodos de sensores distribuidos en zonas del invernadero (Verdes claros + Oscuros)
    const sensorNodes = [
      { rx: 0.14, ry: 0.34, label: '23.6 °C · GERMINACIÓN', color: '#86efac', phase: 0.0 },
      { rx: 0.38, ry: 0.52, label: '68 %RH · CULTIVO A1', color: '#52b788', phase: 1.4 },
      { rx: 0.64, ry: 0.38, label: '22.1 °C · CLIMATIZACIÓN', color: '#a7f3d0', phase: 2.7 },
      { rx: 0.84, ry: 0.60, label: '74 %RH · FERTIRRIEGO', color: '#6ee7b7', phase: 4.1 },
    ];

    const drawGreenhouseSilhouette = (cx: number, baseY: number, w: number, h: number, alpha: number) => {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 237, 215, ${alpha})`;
      ctx.lineWidth = 1.2;

      const x0 = cx - w / 2;
      const x1 = cx + w / 2;
      const wallTopY = baseY - h * 0.55;
      const peakY = baseY - h;

      // Estructura principal a dos aguas del invernadero
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.lineTo(x0, wallTopY);
      ctx.lineTo(cx, peakY);
      ctx.lineTo(x1, wallTopY);
      ctx.lineTo(x1, baseY);
      ctx.closePath();
      ctx.stroke();

      // Costillas internas / paneles
      ctx.strokeStyle = `rgba(108, 95, 81, ${alpha * 1.4})`;
      ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) {
        const px = x0 + (w * i) / 4;
        const roofY = i <= 2
          ? wallTopY - ((wallTopY - peakY) * i) / 2
          : wallTopY - ((wallTopY - peakY) * (4 - i)) / 2;
        ctx.beginPath();
        ctx.moveTo(px, baseY);
        ctx.lineTo(px, roofY);
        ctx.stroke();
      }

      // Línea de cumbrera y viga horizontal
      ctx.beginPath();
      ctx.moveTo(x0, wallTopY);
      ctx.lineTo(x1, wallTopY);
      ctx.stroke();

      ctx.restore();
    };

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
      const step = 16;
      const points: Array<{ x: number; y: number }> = [];

      for (let x = 0; x <= width + step; x += step) {
        const normX = x / Math.max(width, 1);
        const y =
          baseY +
          parallaxY +
          Math.sin(normX * Math.PI * freq + t * speed) * amp +
          Math.cos(normX * Math.PI * (freq * 1.7) - t * speed * 0.6) * (amp * 0.45);
        points.push({ x, y });
      }

      // Área degradada bajo la curva de la gráfica
      const grad = ctx.createLinearGradient(0, baseY - amp * 1.5, 0, height);
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

      // Línea principal de la gráfica de sensor
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Puntos de muestreo sobre la curva
      ctx.fillStyle = strokeColor;
      for (let i = 4; i < points.length; i += 9) {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const startTime = performance.now();

    const renderFrame = (now: number) => {
      const elapsed = prefersReducedMotion ? 0 : (now - startTime) * 0.001;

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Retícula sutil de gráfica agrometeorológica (Cork Border)
      ctx.save();
      ctx.strokeStyle = 'rgba(108, 95, 81, 0.14)';
      ctx.lineWidth = 1;
      const gridSize = 64;
      const offsetX = (mouse.x * -12) % gridSize;
      const offsetY = (mouse.y * -12) % gridSize;

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

      // 2. Siluetas arquitectónicas de invernaderos en el fondo
      drawGreenhouseSilhouette(width * 0.22 + mouse.x * 10, height * 0.86 + mouse.y * 6, 260, 150, 0.14);
      drawGreenhouseSilhouette(width * 0.52 + mouse.x * 14, height * 0.88 + mouse.y * 8, 320, 180, 0.11);
      drawGreenhouseSilhouette(width * 0.80 + mouse.x * 10, height * 0.85 + mouse.y * 6, 240, 140, 0.13);

      // 3. Curva de Humedad Relativa (%RH - Verde claro menta)
      drawTelemetryWave(
        elapsed,
        height * 0.62,
        34,
        3.2,
        0.55,
        'rgba(134, 239, 172, 0.36)',
        'rgba(82, 183, 136, 0.12)',
        'rgba(13, 19, 16, 0.0)',
        mouse.y * 12
      );

      // 4. Curva de Temperatura (°C - Blanco limpio contrastado con oscuro)
      drawTelemetryWave(
        elapsed,
        height * 0.48,
        28,
        2.6,
        0.75,
        'rgba(255, 255, 255, 0.30)',
        'rgba(255, 255, 255, 0.06)',
        'rgba(13, 19, 16, 0.0)',
        mouse.y * 18
      );

      // 5. Conexiones y nodos de sensores del invernadero
      ctx.save();
      const computedNodes = sensorNodes.map((n) => ({
        ...n,
        x: n.rx * width + mouse.x * 16,
        y: n.ry * height + Math.sin(elapsed * 0.9 + n.phase) * 8 + mouse.y * 10,
      }));

      // Enlaces punteados entre nodos (Cork / Driftwood)
      ctx.strokeStyle = 'rgba(255, 237, 215, 0.15)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < computedNodes.length - 1; i++) {
        ctx.moveTo(computedNodes[i].x, computedNodes[i].y);
        ctx.lineTo(computedNodes[i + 1].x, computedNodes[i + 1].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Dibujar cada nodo con pulso suave y etiqueta de lectura
      computedNodes.forEach((node) => {
        const pulseRadius = 10 + Math.sin(elapsed * 2.2 + node.phase) * 4;

        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}44`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Etiqueta discreta junto al nodo
        ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = 'rgba(255, 237, 215, 0.52)';
        ctx.fillText(node.label, node.x + 12, node.y + 4);
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
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
