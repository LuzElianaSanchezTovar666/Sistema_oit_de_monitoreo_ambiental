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

    // Nodos de sensores IoT distribuidos en zonas del invernadero (Toques moraditos que representan los sensores)
    const sensorNodes = [
      { rx: 0.14, ry: 0.34, label: '23.6 °C · GERMINACIÓN (DHT22)', color: '#c084fc', phase: 0.0 },
      { rx: 0.38, ry: 0.52, label: '68 %RH · CULTIVO A1 (BME280)', color: '#a855f7', phase: 1.4 },
      { rx: 0.64, ry: 0.38, label: '22.1 °C · CLIMATIZACIÓN (SHT31)', color: '#c084fc', phase: 2.7 },
      { rx: 0.84, ry: 0.60, label: '74 %RH · FERTIRRIEGO (ESP32)', color: '#a855f7', phase: 4.1 },
    ];

    const drawGreenhouseSilhouette = (cx: number, baseY: number, w: number, h: number, alpha: number) => {
      ctx.save();
      ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 2.2})`;
      ctx.lineWidth = 1.4;

      const x0 = cx - w / 2;
      const x1 = cx + w / 2;
      const wallTopY = baseY - h * 0.55;
      const peakY = baseY - h;

      // Estructura principal a dos aguas del invernadero (verde brillante que resalta en fondo negro)
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.lineTo(x0, wallTopY);
      ctx.lineTo(cx, peakY);
      ctx.lineTo(x1, wallTopY);
      ctx.lineTo(x1, baseY);
      ctx.closePath();
      ctx.stroke();

      // Costillas internas / paneles en tono verde botánico
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 2.5})`;
      ctx.lineWidth = 0.9;
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

      // 1. Retícula sutil de gráfica agrometeorológica en tono verdecito sobre blanco
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.08)';
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
      drawGreenhouseSilhouette(width * 0.22 + mouse.x * 10, height * 0.86 + mouse.y * 6, 260, 150, 0.16);
      drawGreenhouseSilhouette(width * 0.52 + mouse.x * 14, height * 0.88 + mouse.y * 8, 320, 180, 0.13);
      drawGreenhouseSilhouette(width * 0.80 + mouse.x * 10, height * 0.85 + mouse.y * 6, 240, 140, 0.15);

      // 3. Curva de Humedad Relativa (%RH - Verde menta frío que resalta sobre negro)
      drawTelemetryWave(
        elapsed,
        height * 0.62,
        34,
        3.2,
        0.55,
        'rgba(74, 222, 128, 0.85)',
        'rgba(34, 197, 94, 0.20)',
        'rgba(7, 11, 9, 0.0)',
        mouse.y * 12
      );

      // 4. Curva de Temperatura (°C - Verde esmeralda brillante que resalta sobre negro)
      drawTelemetryWave(
        elapsed,
        height * 0.48,
        28,
        2.6,
        0.75,
        'rgba(34, 197, 94, 0.90)',
        'rgba(74, 222, 128, 0.22)',
        'rgba(7, 11, 9, 0.0)',
        mouse.y * 18
      );

      // 5. Conexiones y nodos de sensores del invernadero (Toques moraditos que representan los sensores)
      ctx.save();
      const computedNodes = sensorNodes.map((n) => ({
        ...n,
        x: n.rx * width + mouse.x * 16,
        y: n.ry * height + Math.sin(elapsed * 0.9 + n.phase) * 8 + mouse.y * 10,
      }));

      // Enlaces punteados entre sensores en tono moradito
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < computedNodes.length - 1; i++) {
        ctx.moveTo(computedNodes[i].x, computedNodes[i].y);
        ctx.lineTo(computedNodes[i + 1].x, computedNodes[i + 1].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Dibujar cada sensor IoT con pulso moradito suave y etiqueta de lectura contrastada
      computedNodes.forEach((node) => {
        const pulseRadius = 12 + Math.sin(elapsed * 2.2 + node.phase) * 5;

        // Anillo de pulso del sensor (Moradito)
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}66`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Núcleo del sensor (Moradito brillante)
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Punto central blanco para destello de telemetría activa
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Etiqueta legible en lavanda / blanco sobre fondo negro
        ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = '#f3e8ff';
        ctx.fillText(node.label, node.x + 14, node.y + 4);
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
