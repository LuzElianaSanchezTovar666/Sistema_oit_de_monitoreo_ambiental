import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Modelado interactivo 3D con Three.js para SIMOA:
 * - Sensores de invernadero con estética cristalina / translúcida (NO negros, aspecto de vidrio/holográfico)
 * - DHT22, ESP32, Sonda de suelo, Hojas botánicas y Gotas de riego
 * - Confinados estrictamente a los laterales (flancos exteriores)
 * - Protección matemática garantizada para que NUNCA sobrepasen el área del texto / letras
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
        52,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.z = 24;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      // Iluminación ambiental y direccional suave para destacar reflejos translúcidos
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
      scene.add(ambientLight);

      const dirLightLeft = new THREE.DirectionalLight(0x86efac, 1.1);
      dirLightLeft.position.set(-18, 14, 12);
      scene.add(dirLightLeft);

      const dirLightRight = new THREE.DirectionalLight(0x38bdf8, 1.1);
      dirLightRight.position.set(18, 14, 12);
      scene.add(dirLightRight);

      // Conversión de píxeles de pantalla a coordenadas de mundo Three.js
      const screenXToWorldX = (screenPx: number, targetZ: number): number => {
        const ndcX = (screenPx / window.innerWidth) * 2 - 1;
        const dist = camera.position.z - targetZ;
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
        const halfWidth = halfHeight * camera.aspect;
        return ndcX * halfWidth;
      };

      // Obtener los límites seguros en píxeles del contenedor de contenido
      const getSafeGutterBounds = () => {
        const contentEl = document.querySelector('.max-w-7xl') || document.querySelector('main');
        const rect = contentEl?.getBoundingClientRect();
        const screenW = window.innerWidth;

        // Márgenes seguros con holgura para que ningún modelo toque el texto
        const leftMarginPx = rect ? rect.left : (screenW - 1280) / 2;
        const rightMarginPx = rect ? rect.right : screenW - (screenW - 1280) / 2;

        const safeLeftPx = Math.max(0, leftMarginPx - 30);
        const safeRightPx = Math.min(screenW, rightMarginPx + 30);

        return {
          safeLeftPx,
          safeRightPx,
          hasLeftGutter: safeLeftPx >= 90,
          hasRightGutter: screenW - safeRightPx >= 90,
        };
      };

      // =========================================================================
      // MODELOS 3D TRANSLÚCIDOS DE MONITOREO DE INVERNADEROS (SIN NEGRO)
      // =========================================================================

      // 1. Sensor DHT22 Translúcido (Vidrio esmeralda / menta con rejilla)
      const createDht22Sensor = (): THREE.Group => {
        const group = new THREE.Group();

        // Carcasa de vidrio menta translúcido
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0xdcfce7,
          roughness: 0.15,
          metalness: 0.1,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.45), bodyMat);
        group.add(body);

        // Borde fino de definición cristalina
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.4,
        });
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(1.4, 1.9, 0.45)),
          edgeMat
        );
        group.add(edges);

        // Ranuras de ventilación verde higrométrico translúcido
        const grillMat = new THREE.MeshStandardMaterial({
          color: 0x16a34a,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        });
        [-0.4, -0.2, 0, 0.2, 0.4].forEach((yPos) => {
          const slot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.48), grillMat);
          slot.position.set(0, yPos, 0);
          group.add(slot);
        });

        // Pines inferiores de conexión translúcidos
        const pinMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.35,
          metalness: 0.4,
          roughness: 0.2,
          depthWrite: false,
        });
        [-0.35, -0.12, 0.12, 0.35].forEach((px) => {
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), pinMat);
          pin.position.set(px, -1.15, 0);
          group.add(pin);
        });

        group.scale.set(0.75, 0.75, 0.75);
        return group;
      };

      // 2. Placa Microcontrolador ESP32 Translúcida (Cristal jade con chip y pines dorados)
      const createEsp32Node = (): THREE.Group => {
        const group = new THREE.Group();

        // Placa PCB cristal jade translúcido
        const pcbMat = new THREE.MeshStandardMaterial({
          color: 0x86efac,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0.30,
          depthWrite: false,
        });
        const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.3, 0.12), pcbMat);
        group.add(pcb);

        // Borde cristalino verde
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x16a34a,
          transparent: true,
          opacity: 0.38,
        });
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 2.3, 0.12)),
          edgeMat
        );
        group.add(edges);

        // Chip SoC central translúcido pizarra/cristal (NO negro)
        const chipMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.2,
          metalness: 0.3,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const chip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.18), chipMat);
        chip.position.set(0, 0.15, 0.06);
        group.add(chip);

        // LED de telemetría menta translúcido
        const ledMat = new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.65,
        });
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), ledMat);
        led.position.set(-0.55, 0.8, 0.08);
        group.add(led);

        // Pines perimetrales translúcidos ámbar suave
        const pinMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.4,
          metalness: 0.5,
          roughness: 0.2,
          depthWrite: false,
        });
        for (let y = -0.9; y <= 0.9; y += 0.26) {
          const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), pinMat);
          pLeft.position.set(-0.85, y, 0);
          group.add(pLeft);

          const pRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), pinMat);
          pRight.position.set(0.85, y, 0);
          group.add(pRight);
        }

        group.scale.set(0.75, 0.75, 0.75);
        return group;
      };

      // 3. Sonda Industrial de Sustrato/Suelo Translúcida (Orientada verticalmente para no invadir texto)
      const createIndustrialProbe = (): THREE.Group => {
        const group = new THREE.Group();

        // Vástago de sonda cristalino acerado
        const shaftMat = new THREE.MeshStandardMaterial({
          color: 0xcfd8dc,
          roughness: 0.2,
          metalness: 0.35,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 16), shaftMat);
        group.add(shaft);

        // Cabezal superior translúcido verde bosque (NO negro)
        const headMat = new THREE.MeshStandardMaterial({
          color: 0x15803d,
          roughness: 0.25,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.85, 16), headMat);
        head.position.set(0, 1.4, 0);
        group.add(head);

        // Anillo de sellado verde lima translúcido
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.55,
        });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.12, 16), ringMat);
        ring.position.set(0, 1.05, 0);
        group.add(ring);

        // Mantener orientación vertical sutil (inclinación de solo 15°)
        group.rotation.z = 0.25;
        group.scale.set(0.75, 0.75, 0.75);
        return group;
      };

      // 4. Hoja Botánica de Invernadero Translúcida
      const createGreenhouseLeaf = (): THREE.Group => {
        const group = new THREE.Group();
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x22c55e,
          roughness: 0.2,
          transparent: true,
          opacity: 0.30,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const shape = new THREE.Shape();
        shape.moveTo(0, -1.0);
        shape.quadraticCurveTo(0.7, -0.2, 0.75, 0.5);
        shape.quadraticCurveTo(0.35, 1.1, 0, 1.6);
        shape.quadraticCurveTo(-0.35, 1.1, -0.75, 0.5);
        shape.quadraticCurveTo(-0.7, -0.2, 0, -1.0);

        const geom = new THREE.ExtrudeGeometry(shape, {
          depth: 0.05,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.03,
          bevelThickness: 0.03,
        });
        const mesh = new THREE.Mesh(geom, leafMat);
        group.add(mesh);

        // Nervadura central translúcida
        const veinMat = new THREE.MeshBasicMaterial({
          color: 0x15803d,
          transparent: true,
          opacity: 0.45,
        });
        const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 8), veinMat);
        vein.position.set(0, 0.2, 0.05);
        group.add(vein);

        group.scale.set(0.75, 0.75, 0.75);
        return group;
      };

      // 5. Gota de Humedad / Riego Translúcida
      const createHumidityDroplet = (): THREE.Group => {
        const group = new THREE.Group();
        const dropMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), dropMat);
        group.add(sphere);

        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 16), dropMat);
        cone.position.set(0, 0.7, 0);
        group.add(cone);

        group.scale.set(0.75, 0.75, 0.75);
        return group;
      };

      const builders = [
        createDht22Sensor,
        createEsp32Node,
        createIndustrialProbe,
        createGreenhouseLeaf,
        createHumidityDroplet,
      ];

      // Figuras 3D confinadas a los laterales
      const shapes: Array<{
        group: THREE.Group;
        baseY: number;
        baseZ: number;
        rotSpeedX: number;
        rotSpeedY: number;
        rotSpeedZ: number;
        floatSpeed: number;
        floatOffset: number;
        isLeft: boolean;
      }> = [];

      const initialBounds = getSafeGutterBounds();

      // Configuración vertical de modelos (6 a la izquierda, 6 a la derecha)
      const verticalSlots = [
        { y: 11, z: -2, modelIdx: 0 },
        { y: 6.5, z: -3.5, modelIdx: 1 },
        { y: 1.5, z: -1.5, modelIdx: 2 },
        { y: -3.5, z: -3, modelIdx: 3 },
        { y: -8.5, z: -4, modelIdx: 4 },
        { y: -13.5, z: -2, modelIdx: 0 },
      ];

      // Añadir modelos del flanco izquierdo
      verticalSlots.forEach((slot, idx) => {
        const buildFn = builders[slot.modelIdx % builders.length];
        const group = buildFn();
        const targetX = screenXToWorldX(Math.max(20, initialBounds.safeLeftPx * 0.45), slot.z);
        group.position.set(targetX, slot.y, slot.z);
        scene.add(group);

        shapes.push({
          group,
          baseY: slot.y,
          baseZ: slot.z,
          rotSpeedX: (Math.random() - 0.5) * 0.007,
          rotSpeedY: (Math.random() - 0.5) * 0.010,
          rotSpeedZ: (Math.random() - 0.5) * 0.005,
          floatSpeed: 0.001 + Math.random() * 0.001,
          floatOffset: (idx * Math.PI) / 3,
          isLeft: true,
        });
      });

      // Añadir modelos del flanco derecho
      verticalSlots.forEach((slot, idx) => {
        const buildFn = builders[(slot.modelIdx + 2) % builders.length];
        const group = buildFn();
        const screenW = window.innerWidth;
        const targetX = screenXToWorldX(
          initialBounds.safeRightPx + (screenW - initialBounds.safeRightPx) * 0.55,
          slot.z
        );
        group.position.set(targetX, slot.y, slot.z);
        scene.add(group);

        shapes.push({
          group,
          baseY: slot.y,
          baseZ: slot.z,
          rotSpeedX: (Math.random() - 0.5) * 0.007,
          rotSpeedY: (Math.random() - 0.5) * 0.010,
          rotSpeedZ: (Math.random() - 0.5) * 0.005,
          floatSpeed: 0.001 + Math.random() * 0.001,
          floatOffset: (idx * Math.PI) / 3 + 1.2,
          isLeft: false,
        });
      });

      // =========================================================================
      // PARTÍCULAS LATERALES TRANSLÚCIDAS (SEÑALES Y MOLÉCULAS DE AIRE)
      // =========================================================================
      const particleCount = 60;
      const particleGeometry = new THREE.BufferGeometry();
      const positionsArray = new Float32Array(particleCount * 3);
      const basePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const isLeft = i % 2 === 0;
        const screenW = window.innerWidth;
        const screenX = isLeft
          ? Math.random() * Math.max(20, initialBounds.safeLeftPx * 0.7)
          : initialBounds.safeRightPx + Math.random() * (screenW - initialBounds.safeRightPx);

        const x = screenXToWorldX(screenX, -2);
        const y = (Math.random() - 0.5) * 32;
        const z = (Math.random() - 0.5) * 8 - 2;

        positionsArray[i3] = x;
        positionsArray[i3 + 1] = y;
        positionsArray[i3 + 2] = z;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x4ade80,
        size: 0.18,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Manejo del cursor para parallax suave
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      const handleMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      let scrollOffset = 0;
      const handleScroll = () => {
        scrollOffset = window.scrollY * 0.003;
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });

      const handleResize = () => {
        if (!container || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      // =========================================================================
      // BUCLE DE ANIMACIÓN CON RESTRICCIÓN MATEMÁTICA ESTRICTA (FUERA DE LAS LETRAS)
      // =========================================================================
      let clock = 0;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        clock += 0.016;

        // Suavizado del movimiento del cursor
        mouse.x += (mouse.targetX - mouse.x) * 0.05;
        mouse.y += (mouse.targetY - mouse.y) * 0.05;

        // Parallax de la cámara contenido
        camera.position.x = mouse.x * 0.8;
        camera.position.y = mouse.y * 0.6 - scrollOffset * 0.3;
        camera.lookAt(0, -scrollOffset * 0.25, 0);

        // Recalcular los límites de seguridad en píxeles
        const currentBounds = getSafeGutterBounds();
        const screenW = window.innerWidth;

        shapes.forEach((s) => {
          s.group.rotation.x += s.rotSpeedX;
          s.group.rotation.y += s.rotSpeedY;
          s.group.rotation.z += s.rotSpeedZ;

          const floatY = Math.sin(clock * 1.0 + s.floatOffset) * 0.45;
          s.group.position.y = s.baseY + floatY - scrollOffset * 0.6;

          // REGLA CRÍTICA: Ningún modelo sobrepasa la zona de las letras
          if (s.isLeft) {
            if (!currentBounds.hasLeftGutter) {
              // Si la pantalla es estrecha y no hay margen libre a la izquierda, ocultar completamente
              s.group.visible = false;
            } else {
              s.group.visible = true;
              // Anclar estrictamente dentro del margen libre izquierdo
              const safeGutterCenterPx = currentBounds.safeLeftPx * 0.45;
              const targetWorldX = screenXToWorldX(safeGutterCenterPx, s.baseZ);
              s.group.position.x = targetWorldX;

              // Límite infranqueable: el borde derecho del modelo NUNCA cruza safeLeftPx
              const maxAllowedWorldX = screenXToWorldX(currentBounds.safeLeftPx - 25, s.baseZ);
              if (s.group.position.x > maxAllowedWorldX) {
                s.group.position.x = maxAllowedWorldX;
              }
            }
          } else {
            if (!currentBounds.hasRightGutter) {
              s.group.visible = false;
            } else {
              s.group.visible = true;
              const safeGutterCenterPx =
                currentBounds.safeRightPx + (screenW - currentBounds.safeRightPx) * 0.55;
              const targetWorldX = screenXToWorldX(safeGutterCenterPx, s.baseZ);
              s.group.position.x = targetWorldX;

              // Límite infranqueable: el borde izquierdo del modelo NUNCA cruza safeRightPx
              const minAllowedWorldX = screenXToWorldX(currentBounds.safeRightPx + 25, s.baseZ);
              if (s.group.position.x < minAllowedWorldX) {
                s.group.position.x = minAllowedWorldX;
              }
            }
          }
        });

        // Partículas contenidas estrictamente en los márgenes
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const isLeft = i % 2 === 0;
          const by = basePositions[ix + 1];

          arr[ix + 1] = by + Math.sin(clock * 0.65 + i) * 0.3 - scrollOffset * 0.4;

          if (isLeft) {
            if (!currentBounds.hasLeftGutter) {
              arr[ix + 2] = -999; // Ocultar si no hay espacio
            } else {
              const maxPartX = screenXToWorldX(currentBounds.safeLeftPx - 15, -2);
              arr[ix] = Math.min(arr[ix], maxPartX);
            }
          } else {
            if (!currentBounds.hasRightGutter) {
              arr[ix + 2] = -999;
            } else {
              const minPartX = screenXToWorldX(currentBounds.safeRightPx + 15, -2);
              arr[ix] = Math.max(arr[ix], minPartX);
            }
          }
        }
        posAttr.needsUpdate = true;

        renderer?.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);

        shapes.forEach((s) => {
          s.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            } else if (child instanceof THREE.LineSegments) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        });

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
