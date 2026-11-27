import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Fondo interactivo 3D con Three.js para la Landing Page de SIMOA:
 * - Figuras geométricas ecológicas dispersas (icosaedros, octaedros, anillos y nodos IoT)
 * - Campo de partículas ambientales flotantes (moléculas de aire / señales)
 * - Líneas de conexión sutiles entre nodos cercanos
 * - Interacción fluida con el cursor (parallax 3D, atracción de partículas y rotación reactiva)
 */
export const EnvironmentalThreeBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId = 0;

    try {
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.z = 22;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // Iluminación ambiental suave
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0x66bb6a, 1.1);
      dirLight.position.set(10, 15, 12);
      scene.add(dirLight);

      const tealLight = new THREE.PointLight(0x0284c7, 0.8, 40);
      tealLight.position.set(-12, -8, 10);
      scene.add(tealLight);

      // Paleta ambiental SIMOA
      const ecoColors = [0x1b5e20, 0x2e7d32, 0x43a047, 0x66bb6a, 0x0284c7];

      // 1. Figuras geométricas 3D dispersas (nodos, moléculas y anillos de sensores)
      const shapes: Array<{
        mesh: THREE.Mesh | THREE.LineSegments;
        baseX: number;
        baseY: number;
        baseZ: number;
        rotSpeedX: number;
        rotSpeedY: number;
        rotSpeedZ: number;
        floatSpeed: number;
        floatOffset: number;
      }> = [];

      const geometries: THREE.BufferGeometry[] = [
        new THREE.IcosahedronGeometry(1.2, 0),
        new THREE.OctahedronGeometry(1.0, 0),
        new THREE.TetrahedronGeometry(1.1, 0),
        new THREE.TorusGeometry(1.3, 0.22, 12, 32),
        new THREE.DodecahedronGeometry(0.95, 0),
      ];

      // Ubicaciones armoniosas distribuidas para rodear el contenido sin obstaculizar lectura
      const positions = [
        { x: -14, y: 7, z: -4 },
        { x: -16, y: -4, z: -2 },
        { x: -8, y: -9, z: -6 },
        { x: 14, y: 8, z: -3 },
        { x: 17, y: -3, z: -5 },
        { x: 10, y: -8, z: -2 },
        { x: -5, y: 10, z: -7 },
        { x: 6, y: 11, z: -8 },
      ];

      positions.forEach((pos, idx) => {
        const geom = geometries[idx % geometries.length];
        const isWireframe = idx % 2 === 0;

        let mat: THREE.Material;
        if (isWireframe) {
          mat = new THREE.MeshBasicMaterial({
            color: ecoColors[idx % ecoColors.length],
            wireframe: true,
            transparent: true,
            opacity: 0.32,
          });
        } else {
          mat = new THREE.MeshStandardMaterial({
            color: ecoColors[idx % ecoColors.length],
            roughness: 0.35,
            metalness: 0.2,
            transparent: true,
            opacity: 0.42,
          });
        }

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        scene.add(mesh);

        shapes.push({
          mesh,
          baseX: pos.x,
          baseY: pos.y,
          baseZ: pos.z,
          rotSpeedX: (Math.random() - 0.5) * 0.008,
          rotSpeedY: (Math.random() - 0.5) * 0.012,
          rotSpeedZ: (Math.random() - 0.5) * 0.006,
          floatSpeed: 0.001 + Math.random() * 0.0012,
          floatOffset: Math.random() * Math.PI * 2,
        });
      });

      // 2. Campo de partículas ambientales (flujo de telemetría y moléculas de aire)
      const particleCount = 75;
      const particleGeometry = new THREE.BufferGeometry();
      const positionsArray = new Float32Array(particleCount * 3);
      const basePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const x = (Math.random() - 0.5) * 44;
        const y = (Math.random() - 0.5) * 28;
        const z = (Math.random() - 0.5) * 16 - 2;

        positionsArray[i3] = x;
        positionsArray[i3 + 1] = y;
        positionsArray[i3 + 2] = z;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
      }

      particleGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positionsArray, 3)
      );

      const particleMaterial = new THREE.PointsMaterial({
        color: 0x2e7d32,
        size: 0.22,
        transparent: true,
        opacity: 0.55,
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Anillo de luz en cursor
      const cursorRingGeom = new THREE.RingGeometry(0.7, 0.85, 32);
      const cursorRingMat = new THREE.MeshBasicMaterial({
        color: 0x43a047,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const cursorRing = new THREE.Mesh(cursorRingGeom, cursorRingMat);
      cursorRing.position.set(0, 0, 5);
      scene.add(cursorRing);

      // Núcleo central del cursor
      const cursorCoreGeom = new THREE.CircleGeometry(0.18, 16);
      const cursorCoreMat = new THREE.MeshBasicMaterial({
        color: 0x1b5e20,
        transparent: true,
        opacity: 0.45,
      });
      const cursorCore = new THREE.Mesh(cursorCoreGeom, cursorCoreMat);
      cursorCore.position.set(0, 0, 5.01);
      scene.add(cursorCore);

      // Estado de cursor y mouse interactivo
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      const worldMouse = new THREE.Vector3(0, 0, 0);

      const handleMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;

        // Proyectar coordenadas del cursor al plano 3D (z=0)
        worldMouse.set(mouse.targetX * 16, mouse.targetY * 10, 0);
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          mouse.targetX = (t.clientX / window.innerWidth) * 2 - 1;
          mouse.targetY = -(t.clientY / window.innerHeight) * 2 + 1;
          worldMouse.set(mouse.targetX * 16, mouse.targetY * 10, 0);
        }
      };

      let scrollOffset = 0;
      const handleScroll = () => {
        scrollOffset = window.scrollY * 0.003;
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });

      const handleResize = () => {
        if (!container || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      // Bucle de animación suave
      let clock = 0;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        clock += 0.016;

        // Suavizado del cursor (Lerp)
        mouse.x += (mouse.targetX - mouse.x) * 0.06;
        mouse.y += (mouse.targetY - mouse.y) * 0.06;

        // Efecto Parallax en la cámara
        camera.position.x = mouse.x * 2.2;
        camera.position.y = mouse.y * 1.5 - scrollOffset * 0.4;
        camera.lookAt(0, -scrollOffset * 0.3, 0);

        // Actualizar posición del halo de cursor
        cursorRing.position.x += (worldMouse.x - cursorRing.position.x) * 0.12;
        cursorRing.position.y += (worldMouse.y - cursorRing.position.y) * 0.12;
        cursorRing.rotation.z += 0.02;

        cursorCore.position.x = cursorRing.position.x;
        cursorCore.position.y = cursorRing.position.y;

        // Animación de figuras geométricas
        shapes.forEach((s) => {
          s.mesh.rotation.x += s.rotSpeedX;
          s.mesh.rotation.y += s.rotSpeedY;
          s.mesh.rotation.z += s.rotSpeedZ;

          const floatY = Math.sin(clock * 1.2 + s.floatOffset) * 0.55;
          s.mesh.position.y = s.baseY + floatY - scrollOffset * 0.8;

          // Reacción al cursor (pequeña repulsión si está cerca)
          const dx = s.mesh.position.x - worldMouse.x;
          const dy = s.mesh.position.y - worldMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6.5) {
            const force = (6.5 - dist) / 6.5;
            s.mesh.position.x = s.baseX + (dx / dist) * force * 1.2;
          } else {
            s.mesh.position.x += (s.baseX - s.mesh.position.x) * 0.04;
          }
        });

        // Animación y reactividad de partículas
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const bx = basePositions[ix];
          const by = basePositions[ix + 1];

          // Flotación natural
          arr[ix + 1] = by + Math.sin(clock * 0.8 + i) * 0.35 - scrollOffset * 0.5;

          // Atracción sutil al cursor
          const dx = worldMouse.x - arr[ix];
          const dy = worldMouse.y - arr[ix + 1];
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 5.5) {
            const pull = (5.5 - dist) / 5.5;
            arr[ix] += (bx + dx * 0.35 * pull - arr[ix]) * 0.08;
            arr[ix + 1] += (by + dy * 0.35 * pull - arr[ix + 1]) * 0.08;
          } else {
            arr[ix] += (bx - arr[ix]) * 0.05;
            arr[ix + 1] += (by - arr[ix + 1]) * 0.05;
          }
        }
        posAttr.needsUpdate = true;

        renderer?.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);

        geometries.forEach((g) => g.dispose());
        shapes.forEach((s) => (s.mesh.material as THREE.Material).dispose());
        particleGeometry.dispose();
        particleMaterial.dispose();
        cursorRingGeom.dispose();
        cursorRingMat.dispose();
        cursorCoreGeom.dispose();
        cursorCoreMat.dispose();

        if (renderer) {
          renderer.dispose();
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        }
      };
    } catch {
      // Fallback silencioso si WebGL no está disponible
    }
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    />
  );
};
