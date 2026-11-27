import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Modelado interactivo 3D con Three.js para la Landing Page de SIMOA:
 * - Posicionado exclusivamente en los LATERALES (flancos izquierdo y derecho)
 * - Zona central 100% despejada para garantizar lectura nítida del contenido
 * - Figuras geométricas ecológicas (icosaedros, octaedros, anillos y tetraedros)
 * - Flujo de partículas y rotación reactiva al cursor
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
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambientLight);

      const dirLightLeft = new THREE.DirectionalLight(0x66bb6a, 1.2);
      dirLightLeft.position.set(-15, 12, 10);
      scene.add(dirLightLeft);

      const dirLightRight = new THREE.DirectionalLight(0x43a047, 1.2);
      dirLightRight.position.set(15, 12, 10);
      scene.add(dirLightRight);

      // Paleta ambiental SIMOA
      const ecoColors = [0x1b5e20, 0x2e7d32, 0x43a047, 0x66bb6a, 0x0284c7];

      // Geometrías base
      const geometries: THREE.BufferGeometry[] = [
        new THREE.IcosahedronGeometry(1.25, 0),
        new THREE.TorusGeometry(1.3, 0.22, 12, 32),
        new THREE.OctahedronGeometry(1.1, 0),
        new THREE.DodecahedronGeometry(1.0, 0),
        new THREE.TetrahedronGeometry(1.15, 0),
      ];

      // Figuras 3D distribuidas estrictamente en los LATERALES (Izquierda y Derecha)
      const shapes: Array<{
        mesh: THREE.Mesh;
        baseX: number;
        baseY: number;
        baseZ: number;
        rotSpeedX: number;
        rotSpeedY: number;
        rotSpeedZ: number;
        floatSpeed: number;
        floatOffset: number;
        isLeft: boolean;
      }> = [];

      // Coordenadas laterales: |x| >= 17 para no interferir con el centro
      const lateralPositions = [
        // Columna Izquierda (Left Flank)
        { x: -18.5, y: 11, z: -2, isLeft: true },
        { x: -21.0, y: 6, z: -4, isLeft: true },
        { x: -17.5, y: 1, z: -1, isLeft: true },
        { x: -20.5, y: -4, z: -3, isLeft: true },
        { x: -17.0, y: -9, z: -5, isLeft: true },
        { x: -21.5, y: -14, z: -2, isLeft: true },

        // Columna Derecha (Right Flank)
        { x: 18.5, y: 11, z: -2, isLeft: false },
        { x: 21.0, y: 6, z: -4, isLeft: false },
        { x: 17.5, y: 1, z: -1, isLeft: false },
        { x: 20.5, y: -4, z: -3, isLeft: false },
        { x: 17.0, y: -9, z: -5, isLeft: false },
        { x: 21.5, y: -14, z: -2, isLeft: false },
      ];

      lateralPositions.forEach((pos, idx) => {
        const geom = geometries[idx % geometries.length];
        const isWireframe = idx % 2 === 0;

        let mat: THREE.Material;
        if (isWireframe) {
          mat = new THREE.MeshBasicMaterial({
            color: ecoColors[idx % ecoColors.length],
            wireframe: true,
            transparent: true,
            opacity: 0.45,
          });
        } else {
          mat = new THREE.MeshStandardMaterial({
            color: ecoColors[idx % ecoColors.length],
            roughness: 0.3,
            metalness: 0.25,
            transparent: true,
            opacity: 0.55,
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
          rotSpeedX: (Math.random() - 0.5) * 0.009,
          rotSpeedY: (Math.random() - 0.5) * 0.013,
          rotSpeedZ: (Math.random() - 0.5) * 0.007,
          floatSpeed: 0.001 + Math.random() * 0.0012,
          floatOffset: Math.random() * Math.PI * 2,
          isLeft: pos.isLeft,
        });
      });

      // 2. Partículas ambientales colocadas únicamente en las bandas laterales
      const particleCount = 80;
      const particleGeometry = new THREE.BufferGeometry();
      const positionsArray = new Float32Array(particleCount * 3);
      const basePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const isLeft = i % 2 === 0;
        // x estrictamente <= -16.5 o >= 16.5
        const x = isLeft
          ? -16.5 - Math.random() * 9
          : 16.5 + Math.random() * 9;
        const y = (Math.random() - 0.5) * 32;
        const z = (Math.random() - 0.5) * 12 - 2;

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
        size: 0.25,
        transparent: true,
        opacity: 0.6,
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Estado del mouse / cursor interactivo
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      const worldMouse = new THREE.Vector3(0, 0, 0);

      const handleMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
        worldMouse.set(mouse.targetX * 20, mouse.targetY * 12, 0);
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          mouse.targetX = (t.clientX / window.innerWidth) * 2 - 1;
          mouse.targetY = -(t.clientY / window.innerHeight) * 2 + 1;
          worldMouse.set(mouse.targetX * 20, mouse.targetY * 12, 0);
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

        // Efecto Parallax en la cámara (suave)
        camera.position.x = mouse.x * 1.5;
        camera.position.y = mouse.y * 1.2 - scrollOffset * 0.4;
        camera.lookAt(0, -scrollOffset * 0.3, 0);

        // Animación de figuras geométricas laterales
        shapes.forEach((s) => {
          s.mesh.rotation.x += s.rotSpeedX;
          s.mesh.rotation.y += s.rotSpeedY;
          s.mesh.rotation.z += s.rotSpeedZ;

          const floatY = Math.sin(clock * 1.1 + s.floatOffset) * 0.55;
          s.mesh.position.y = s.baseY + floatY - scrollOffset * 0.75;

          // Reacción de repulsión si el cursor se aproxima al lateral
          const dx = s.mesh.position.x - worldMouse.x;
          const dy = s.mesh.position.y - worldMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6.0) {
            const force = (6.0 - dist) / 6.0;
            const pushDir = s.isLeft ? -1 : 1;
            s.mesh.position.x = s.baseX + pushDir * force * 1.5;
          } else {
            s.mesh.position.x += (s.baseX - s.mesh.position.x) * 0.04;
          }

          // Garantizar que NUNCA entren al corredor central (|x| >= 16.0)
          if (s.isLeft) {
            s.mesh.position.x = Math.min(-16.0, s.mesh.position.x);
          } else {
            s.mesh.position.x = Math.max(16.0, s.mesh.position.x);
          }
        });

        // Animación de partículas laterales
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const bx = basePositions[ix];
          const by = basePositions[ix + 1];

          arr[ix + 1] = by + Math.sin(clock * 0.75 + i) * 0.35 - scrollOffset * 0.5;

          // Suave reacción si el cursor está cerca del lateral
          const dx = worldMouse.x - arr[ix];
          const dy = worldMouse.y - arr[ix + 1];
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 5.0) {
            const pull = (5.0 - dist) / 5.0;
            arr[ix] += (bx + dx * 0.3 * pull - arr[ix]) * 0.08;
            arr[ix + 1] += (by + dy * 0.3 * pull - arr[ix + 1]) * 0.08;
          } else {
            arr[ix] += (bx - arr[ix]) * 0.05;
            arr[ix + 1] += (by - arr[ix + 1]) * 0.05;
          }

          // Mantener partículas estrictamente en los márgenes
          if (bx < 0) {
            arr[ix] = Math.min(-15.5, arr[ix]);
          } else {
            arr[ix] = Math.max(15.5, arr[ix]);
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
