import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Modelado interactivo 3D con Three.js para SIMOA:
 * - Sensores reales de invernadero (Sensor DHT22, Placa ESP32, Sonda de suelo, Hojas y Gotas de riego)
 * - Diseñado con contraste en tonos oscuros (negro obsidiana / carbón) combinados con verde botánico
 * - Posicionado exclusivamente en los LATERALES (flancos izquierdo y derecho)
 * - Zona central 100% limpia y despejada para el texto y las métricas
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

      // Iluminación ambiental y dirigida para resaltar el contraste negro/verde
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
      scene.add(ambientLight);

      const dirLightLeft = new THREE.DirectionalLight(0x4ade80, 1.3);
      dirLightLeft.position.set(-15, 12, 10);
      scene.add(dirLightLeft);

      const dirLightRight = new THREE.DirectionalLight(0x22c55e, 1.3);
      dirLightRight.position.set(15, 12, 10);
      scene.add(dirLightRight);

      // Creadores procedurales de modelos de sensores e invernadero
      const createDht22Sensor = (): THREE.Group => {
        const group = new THREE.Group();
        // Carcasa negra de alto contraste
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.3,
          metalness: 0.3,
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.6), bodyMat);
        group.add(body);

        // Ranuras de ventilación verdes (rejilla higrométrica de invernadero)
        const grillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        [-0.5, -0.25, 0, 0.25, 0.5].forEach((yPos) => {
          const slot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.64), grillMat);
          slot.position.set(0, yPos, 0);
          group.add(slot);
        });

        // Pines inferiores de conexión metálicos
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
        [-0.45, -0.15, 0.15, 0.45].forEach((px) => {
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), pinMat);
          pin.position.set(px, -1.35, 0);
          group.add(pin);
        });

        return group;
      };

      const createEsp32Node = (): THREE.Group => {
        const group = new THREE.Group();
        // Placa PCB negro grafito con serigrafía verde
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x090d0b, roughness: 0.45, metalness: 0.2 });
        const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.7, 0.15), pcbMat);
        group.add(pcb);

        // Chip SoC central negro con marco metálico
        const chipMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.8 });
        const chip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.25), chipMat);
        chip.position.set(0, 0.2, 0.08);
        group.add(chip);

        // LED de telemetría verde brillante
        const ledMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.22), ledMat);
        led.position.set(-0.65, 0.95, 0.1);
        group.add(led);

        // Pines dorados en ambos bordes
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });
        for (let y = -1.1; y <= 1.1; y += 0.28) {
          const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), pinMat);
          pLeft.position.set(-1.0, y, 0);
          group.add(pLeft);

          const pRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), pinMat);
          pRight.position.set(1.0, y, 0);
          group.add(pRight);
        }

        return group;
      };

      const createIndustrialProbe = (): THREE.Group => {
        const group = new THREE.Group();
        // Vástago de sonda de acero inoxidable para sustrato
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.7, 16), shaftMat);
        group.add(shaft);

        // Cabezal negro mate industrial
        const headMat = new THREE.MeshStandardMaterial({ color: 0x090d0b, roughness: 0.35 });
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 16), headMat);
        head.position.set(0, 1.7, 0);
        group.add(head);

        // Anillo de goma verde de sellado estanco
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x16a34a });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.16, 16), ringMat);
        ring.position.set(0, 1.3, 0);
        group.add(ring);

        return group;
      };

      const createGreenhouseLeaf = (): THREE.Group => {
        const group = new THREE.Group();
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x16a34a,
          roughness: 0.25,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });

        // Forma de hoja vegetal
        const shape = new THREE.Shape();
        shape.moveTo(0, -1.2);
        shape.quadraticCurveTo(0.85, -0.3, 0.9, 0.6);
        shape.quadraticCurveTo(0.4, 1.3, 0, 1.9);
        shape.quadraticCurveTo(-0.4, 1.3, -0.9, 0.6);
        shape.quadraticCurveTo(-0.85, -0.3, 0, -1.2);

        const geom = new THREE.ExtrudeGeometry(shape, {
          depth: 0.08,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.04,
          bevelThickness: 0.04,
        });
        const mesh = new THREE.Mesh(geom, leafMat);
        mesh.scale.set(0.85, 0.85, 0.85);
        group.add(mesh);

        // Nervadura central contrastada en verde oscuro
        const veinMat = new THREE.MeshBasicMaterial({ color: 0x0d3b1e });
        const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8), veinMat);
        vein.position.set(0, 0.25, 0.07);
        group.add(vein);

        return group;
      };

      const createHumidityDroplet = (): THREE.Group => {
        const group = new THREE.Group();
        const dropMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.2,
          metalness: 0.15,
          transparent: true,
          opacity: 0.8,
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), dropMat);
        group.add(sphere);

        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 16), dropMat);
        cone.position.set(0, 0.85, 0);
        group.add(cone);

        return group;
      };

      // Constructores disponibles
      const builders = [
        createDht22Sensor,
        createEsp32Node,
        createIndustrialProbe,
        createGreenhouseLeaf,
        createHumidityDroplet,
      ];

      // Figuras 3D ubicadas exclusivamente a los LATERALES
      const shapes: Array<{
        group: THREE.Group;
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

      const lateralConfigs = [
        // Flanco Izquierdo
        { x: -18.5, y: 11, z: -2, isLeft: true, modelIdx: 0 },
        { x: -21.0, y: 6, z: -4, isLeft: true, modelIdx: 1 },
        { x: -17.5, y: 1, z: -1, isLeft: true, modelIdx: 2 },
        { x: -20.5, y: -4, z: -3, isLeft: true, modelIdx: 3 },
        { x: -17.0, y: -9, z: -5, isLeft: true, modelIdx: 4 },
        { x: -21.5, y: -14, z: -2, isLeft: true, modelIdx: 0 },

        // Flanco Derecho
        { x: 18.5, y: 11, z: -2, isLeft: false, modelIdx: 1 },
        { x: 21.0, y: 6, z: -4, isLeft: false, modelIdx: 0 },
        { x: 17.5, y: 1, z: -1, isLeft: false, modelIdx: 3 },
        { x: 20.5, y: -4, z: -3, isLeft: false, modelIdx: 2 },
        { x: 17.0, y: -9, z: -5, isLeft: false, modelIdx: 4 },
        { x: 21.5, y: -14, z: -2, isLeft: false, modelIdx: 1 },
      ];

      lateralConfigs.forEach((cfg) => {
        const buildFn = builders[cfg.modelIdx % builders.length];
        const group = buildFn();
        group.position.set(cfg.x, cfg.y, cfg.z);
        scene.add(group);

        shapes.push({
          group,
          baseX: cfg.x,
          baseY: cfg.y,
          baseZ: cfg.z,
          rotSpeedX: (Math.random() - 0.5) * 0.008,
          rotSpeedY: (Math.random() - 0.5) * 0.012,
          rotSpeedZ: (Math.random() - 0.5) * 0.006,
          floatSpeed: 0.001 + Math.random() * 0.001,
          floatOffset: Math.random() * Math.PI * 2,
          isLeft: cfg.isLeft,
        });
      });

      // Partículas laterales (moléculas de aire / señales telemétricas)
      const particleCount = 70;
      const particleGeometry = new THREE.BufferGeometry();
      const positionsArray = new Float32Array(particleCount * 3);
      const basePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const isLeft = i % 2 === 0;
        const x = isLeft ? -16.5 - Math.random() * 8.5 : 16.5 + Math.random() * 8.5;
        const y = (Math.random() - 0.5) * 32;
        const z = (Math.random() - 0.5) * 12 - 2;

        positionsArray[i3] = x;
        positionsArray[i3 + 1] = y;
        positionsArray[i3 + 2] = z;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x16a34a,
        size: 0.22,
        transparent: true,
        opacity: 0.55,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Estado del mouse
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      const worldMouse = new THREE.Vector3(0, 0, 0);

      const handleMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
        worldMouse.set(mouse.targetX * 20, mouse.targetY * 12, 0);
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

      // Bucle de animación
      let clock = 0;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        clock += 0.016;

        mouse.x += (mouse.targetX - mouse.x) * 0.06;
        mouse.y += (mouse.targetY - mouse.y) * 0.06;

        camera.position.x = mouse.x * 1.5;
        camera.position.y = mouse.y * 1.2 - scrollOffset * 0.4;
        camera.lookAt(0, -scrollOffset * 0.3, 0);

        shapes.forEach((s) => {
          s.group.rotation.x += s.rotSpeedX;
          s.group.rotation.y += s.rotSpeedY;
          s.group.rotation.z += s.rotSpeedZ;

          const floatY = Math.sin(clock * 1.1 + s.floatOffset) * 0.55;
          s.group.position.y = s.baseY + floatY - scrollOffset * 0.75;

          const dx = s.group.position.x - worldMouse.x;
          const dy = s.group.position.y - worldMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 6.0) {
            const force = (6.0 - dist) / 6.0;
            const pushDir = s.isLeft ? -1 : 1;
            s.group.position.x = s.baseX + pushDir * force * 1.5;
          } else {
            s.group.position.x += (s.baseX - s.group.position.x) * 0.04;
          }

          // Confinamiento estricto a los laterales (|x| >= 16.0)
          if (s.isLeft) {
            s.group.position.x = Math.min(-16.0, s.group.position.x);
          } else {
            s.group.position.x = Math.max(16.0, s.group.position.x);
          }
        });

        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          const bx = basePositions[ix];
          const by = basePositions[ix + 1];

          arr[ix + 1] = by + Math.sin(clock * 0.75 + i) * 0.35 - scrollOffset * 0.5;

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
