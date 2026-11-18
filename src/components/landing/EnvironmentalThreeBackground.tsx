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

      const dirLight = new THREE.DirectionalLight(0x3ddc91, 1.1);
      dirLight.position.set(10, 15, 12);
      scene.add(dirLight);

      const tealLight = new THREE.PointLight(0xffcd48, 0.7, 40);
      tealLight.position.set(-12, -8, 10);
      scene.add(tealLight);

      // Paleta Sauce Labs Console (Neon Pulse, Mint Whisper, Signal Yellow, Graphite, Pure White)
      const ecoColors = [0x3ddc91, 0x97ddbc, 0xffcd48, 0x424f4f, 0xffffff];

      // 1. Figuras geométricas 3D dispersas (nodos, moléculas y anillos de sensores)
      interface FloatingShape {
        mesh: THREE.Mesh;
        basePos: THREE.Vector3;
        rotSpeed: THREE.Vector3;
        floatSpeed: number;
        floatAmp: number;
        phase: number;
      }

      const shapes: FloatingShape[] = [];
      const geometries = [
        new THREE.IcosahedronGeometry(1.1, 0),
        new THREE.OctahedronGeometry(0.95, 0),
        new THREE.DodecahedronGeometry(0.9, 0),
        new THREE.TorusGeometry(0.9, 0.18, 12, 32),
        new THREE.TetrahedronGeometry(0.85, 0),
      ];

      const shapeCount = 24;
      for (let i = 0; i < shapeCount; i++) {
        const geom = geometries[i % geometries.length];
        const color = ecoColors[i % ecoColors.length];
        const isWireframe = i % 2 === 0;

        const mat = new THREE.MeshStandardMaterial({
          color,
          wireframe: isWireframe,
          transparent: true,
          opacity: isWireframe ? 0.28 : 0.16,
          roughness: 0.35,
          metalness: 0.1,
        });

        const mesh = new THREE.Mesh(geom, mat);
        const scale = 0.55 + Math.random() * 1.15;
        mesh.scale.setScalar(scale);

        // Dispersar por todo el ancho y alto del espacio visible
        const x = (Math.random() - 0.5) * 40;
        const y = (Math.random() - 0.5) * 26;
        const z = (Math.random() - 0.5) * 14 - 2;

        mesh.position.set(x, y, z);
        mesh.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );

        scene.add(mesh);
        shapes.push({
          mesh,
          basePos: new THREE.Vector3(x, y, z),
          rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.008,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.006
          ),
          floatSpeed: 0.4 + Math.random() * 0.8,
          floatAmp: 0.4 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
        });
      }

      // 2. Campo de partículas flotantes interactivas con el cursor
      const particleCount = 150;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleBasePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const particleSpeeds = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const px = (Math.random() - 0.5) * 44;
        const py = (Math.random() - 0.5) * 28;
        const pz = (Math.random() - 0.5) * 12;

        particlePositions[i * 3] = px;
        particlePositions[i * 3 + 1] = py;
        particlePositions[i * 3 + 2] = pz;

        particleBasePositions[i * 3] = px;
        particleBasePositions[i * 3 + 1] = py;
        particleBasePositions[i * 3 + 2] = pz;

        particleSpeeds[i] = 0.5 + Math.random() * 1.2;

        const col = new THREE.Color(ecoColors[i % ecoColors.length]);
        particleColors[i * 3] = col.r;
        particleColors[i * 3 + 1] = col.g;
        particleColors[i * 3 + 2] = col.b;
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // 3. Anillo / Aura interactiva que sigue suavemente al cursor en 3D
      const cursorRingGeom = new THREE.TorusGeometry(1.3, 0.035, 12, 48);
      const cursorRingMat = new THREE.MeshBasicMaterial({
        color: 0x3ddc91,
        transparent: true,
        opacity: 0.35,
      });
      const cursorRing = new THREE.Mesh(cursorRingGeom, cursorRingMat);
      cursorRing.position.z = 4;
      scene.add(cursorRing);

      const cursorCoreGeom = new THREE.OctahedronGeometry(0.32, 0);
      const cursorCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffcd48,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      });
      const cursorCore = new THREE.Mesh(cursorCoreGeom, cursorCoreMat);
      cursorCore.position.z = 4;
      scene.add(cursorCore);

      // Seguimiento suave del cursor y scroll
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      let scrollOffset = window.scrollY * 0.004;

      const handleMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          mouse.targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
          mouse.targetY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
      };

      const handleScroll = () => {
        scrollOffset = window.scrollY * 0.004;
      };

      const handleResize = () => {
        if (!renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize);

      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();

        // Interpolación suave del cursor
        mouse.x += (mouse.targetX - mouse.x) * 0.06;
        mouse.y += (mouse.targetY - mouse.y) * 0.06;

        // Parallax suave de cámara con cursor y scroll
        camera.position.x += (mouse.x * 2.2 - camera.position.x) * 0.05;
        camera.position.y += (mouse.y * 1.4 - scrollOffset * 0.35 - camera.position.y) * 0.05;
        camera.lookAt(0, -scrollOffset * 0.25, 0);

        // Posición 3D aproximada del cursor
        const cursorWorldX = mouse.x * 16;
        const cursorWorldY = mouse.y * 9 - scrollOffset * 0.35;

        cursorRing.position.x += (cursorWorldX - cursorRing.position.x) * 0.1;
        cursorRing.position.y += (cursorWorldY - cursorRing.position.y) * 0.1;
        cursorRing.rotation.x = elapsed * 0.6 + mouse.y * 0.8;
        cursorRing.rotation.y = elapsed * 0.8 + mouse.x * 0.8;

        cursorCore.position.copy(cursorRing.position);
        cursorCore.rotation.x = -elapsed * 1.1;
        cursorCore.rotation.y = elapsed * 1.3;

        // Animar figuras geométricas dispersas + reacción al cursor
        for (let i = 0; i < shapes.length; i++) {
          const s = shapes[i];
          const floatY = Math.sin(elapsed * s.floatSpeed + s.phase) * s.floatAmp;
          const floatX = Math.cos(elapsed * s.floatSpeed * 0.7 + s.phase) * (s.floatAmp * 0.4);

          let targetX = s.basePos.x + floatX;
          let targetY = s.basePos.y + floatY;

          // Repulsión/desplazamiento sutil al acercar el cursor
          const dx = targetX - cursorWorldX;
          const dy = targetY - cursorWorldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6.5 && dist > 0.01) {
            const force = (6.5 - dist) / 6.5;
            targetX += (dx / dist) * force * 2.2;
            targetY += (dy / dist) * force * 2.2;
            s.mesh.rotation.x += 0.025 * force;
            s.mesh.rotation.y += 0.025 * force;
          }

          s.mesh.position.x += (targetX - s.mesh.position.x) * 0.06;
          s.mesh.position.y += (targetY - s.mesh.position.y) * 0.06;
          s.mesh.rotation.x += s.rotSpeed.x;
          s.mesh.rotation.y += s.rotSpeed.y;
          s.mesh.rotation.z += s.rotSpeed.z;
        }

        // Animar partículas flotantes y atraer suavemente hacia el cursor cercano
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const bx = particleBasePositions[ix] + Math.sin(elapsed * 0.4 * particleSpeeds[i] + i) * 0.7;
          const by = particleBasePositions[ix + 1] + Math.cos(elapsed * 0.35 * particleSpeeds[i] + i) * 0.7;

          const dx = cursorWorldX - bx;
          const dy = cursorWorldY - by;
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

