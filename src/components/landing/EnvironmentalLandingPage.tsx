import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Thermometer,
  Droplets,
  AlertTriangle,
  BrainCircuit,
  FileSpreadsheet,
  Server,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  Eye,
  CheckCircle2,
  Mail,
  Send,
  Sun,
  Moon,
  ChevronRight,
  Sparkles,
  Wifi,
  LineChart,
} from 'lucide-react';
import { ScrollReveal } from '../../hooks/useScrollAnimation';
import { HeroSkeleton, CardGridSkeleton, FlowSequenceSkeleton, SkeletonBox } from '../common/SkeletonLoader';

interface EnvironmentalLandingPageProps {
  onEnterSystem: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  skeletonMode: boolean;
  onToggleSkeletonMode: () => void;
}

export const EnvironmentalLandingPage: React.FC<EnvironmentalLandingPageProps> = ({
  onEnterSystem,
  darkMode,
  onToggleDarkMode,
  skeletonMode,
  onToggleSkeletonMode,
}) => {
  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setContactSent(false);
    }, 4000);
  };

  // 6 Main Capabilities (Acerca del Sistema)
  const aboutCapabilities = [
    {
      icon: <Thermometer className="w-5 h-5 text-emerald-500" />,
      title: 'Registro de Temperatura y Humedad',
      desc: 'Captura periódica y continua de variables higrotérmicas en recintos críticos con sondas calibradas.',
    },
    {
      icon: <Cpu className="w-5 h-5 text-emerald-500" />,
      title: 'Supervisión de Dispositivos IoT',
      desc: 'Seguimiento en tiempo real de nodos microcontroladores ESP32 y ESP8266 con control de estado y pings.',
    },
    {
      icon: <LineChart className="w-5 h-5 text-emerald-500" />,
      title: 'Consultas e Historiales en Vivo',
      desc: 'Base de datos temporal TimescaleDB con trazabilidad integral de millones de puntos telemétricos.',
    },
    {
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
      title: 'Gráficas Ambientales Dinámicas',
      desc: 'Series de tiempo interactivas en SVG con bandas de tolerancia, líneas de umbral y zoom temporal.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-emerald-500" />,
      title: 'Alertas Preventivas con Debouncing',
      desc: 'Disparo inmediato ante superación de límites, consolidando eventos en ventanas de 5 minutos.',
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-emerald-500" />,
      title: 'Detección Inteligente con IA',
      desc: 'Algoritmos Isolation Forest y Z-Score dinámico que discriminan picos de anomalías reales.',
    },
  ];

  // 6 Main Modules (Funcionalidades)
  const functionalModules = [
    {
      tag: 'Hardware & Red',
      icon: <Cpu className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Dispositivos IoT',
      desc: 'Administración y seguimiento de nodos ESP32, ESP8266 y Gateways industriales. Validación estricta de dirección MAC, control de paquetes PINGREQ y estado Online/Offline.',
      highlight: 'Validación MAC & Pings 3s',
    },
    {
      tag: 'Instrumentación',
      icon: <Thermometer className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Sensores Ambientales',
      desc: 'Gestión y parametrización de sensores DHT22, BME280 y SHT31. Definición de umbrales operacionales mínimos y máximos, así como límites críticos de contingencia.',
      highlight: 'DHT22 / BME280 / SHT31',
    },
    {
      tag: 'Telemetría Viva',
      icon: <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Mediciones e Historial',
      desc: 'Streaming de series temporales en tiempo real sin latencia. Visualización simultánea de temperatura (°C) y humedad relativa (%RH) con almacenamiento TimescaleDB.',
      highlight: 'Streaming continuo 1Hz',
    },
    {
      tag: 'Seguridad Operativa',
      icon: <AlertTriangle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Gestor de Alertas',
      desc: 'Seguimiento de condiciones fuera de parámetro con debouncing de 5 minutos. Catálogo normalizado de causas, alarma sonora en cabina y registro de operadores.',
      highlight: 'Debouncing 5 min & Beeper',
    },
    {
      tag: 'Machine Learning',
      icon: <BrainCircuit className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Inteligencia Artificial',
      desc: 'Inferencia multivariante mediante el algoritmo Isolation Forest combinado con Z-Score 3σ. Diagnóstico predictivo de causa raíz con soporte de Gemini 2.5 Flash.',
      highlight: 'Isolation Forest & Z-Score',
    },
    {
      tag: 'Trazabilidad & Auditoría',
      icon: <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      title: 'Reportes y Analítica',
      desc: 'Estadísticas consolidadas (Mín, Máx, Promedio, Desviación Estándar y Tasa de Conformidad SLA). Exportación directa en archivos CSV, esquemas JSON y reportes.',
      highlight: 'Descarga CSV / JSON / SLA',
    },
  ];

  // 4 Core Technologies
  const techStack = [
    {
      name: 'Python & IA',
      category: 'Procesamiento & Modelos',
      desc: 'FastAPI para backend asíncrono, NumPy y Scikit-Learn ejecutando el modelo Isolation Forest y control estadístico Z-Score para la detección de anomalías.',
      badge: 'Python 3.10+ / Scikit-Learn',
      color: 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20',
    },
    {
      name: 'MQTT Protocol',
      category: 'Broker de Mensajería IoT',
      desc: 'Eclipse Mosquitto v2.0+ implementando comunicación publish/subscribe ultraliviana sobre canal cifrado MQTTS con TLS 1.3 en puerto 8883.',
      badge: 'Mosquitto / MQTTS TLS 8883',
      color: 'border-teal-500/40 bg-teal-50/50 dark:bg-teal-950/20',
    },
    {
      name: 'Node-RED',
      category: 'Orquestación de Flujos',
      desc: 'Motor visual de interconexión para transformación de payloads JSON telemétricos, filtrado de tramas corruptas y desvío a Dead Letter Queue (DLQ).',
      badge: 'Node-RED Runtime v3.0+',
      color: 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20',
    },
    {
      name: 'Sensores IoT',
      category: 'Captura Ambiental',
      desc: 'Sondas digitales de alta precisión DHT22, Bosch BME280 y Sensirion SHT31 conectadas a microcontroladores ESP32 con lecturas estables cada 2.5s.',
      badge: 'ESP32 / DHT22 / BME280',
      color: 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20',
    },
  ];

  // 6 Pipeline Steps (Funcionamiento)
  const pipelineSteps = [
    {
      step: '01',
      title: 'Sensores Ambientales',
      desc: 'Sondas DHT22/BME280 miden temperatura y humedad relativa en el espacio físico.',
      icon: <Thermometer className="w-5 h-5 text-emerald-500" />,
    },
    {
      step: '02',
      title: 'Microcontrolador ESP32',
      desc: 'El nodo digitaliza las señales y empaqueta la telemetría en formato JSON ligero.',
      icon: <Cpu className="w-5 h-5 text-emerald-500" />,
    },
    {
      step: '03',
      title: 'Broker Mosquitto',
      desc: 'Transmisión cifrada MQTTS TLS 1.3 sobre el puerto 8883 con garantía QoS 1.',
      icon: <Server className="w-5 h-5 text-emerald-500" />,
    },
    {
      step: '04',
      title: 'Node-RED Engine',
      desc: 'Valida la integridad del paquete JSON; si está corrupto lo aísla en la cola DLQ.',
      icon: <Layers className="w-5 h-5 text-emerald-500" />,
    },
    {
      step: '05',
      title: 'Motor Python e IA',
      desc: 'FastAPI almacena en TimescaleDB y ejecuta el modelo Isolation Forest (<200ms).',
      icon: <BrainCircuit className="w-5 h-5 text-emerald-500" />,
    },
    {
      step: '06',
      title: 'Plataforma Web en Vivo',
      desc: 'La interfaz React + Tailwind actualiza gráficas, indicadores y alertas en tiempo real.',
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-emerald-500 selection:text-white">
      {/* 2. NAVBAR MODERNA CON BLUR Y TRANSPARENCIA */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-6 px-6 py-3.5 bg-white/80 dark:bg-slate-950/85 backdrop-blur-md border-b border-emerald-900/10 dark:border-emerald-900/30 transition-all">
        {/* Logo */}
        <a href="#inicio" className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 dark:text-white shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              EcoSense IoT
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono -mt-0.5">
              Monitoreo Ambiental
            </span>
          </div>
        </a>

        {/* Enlaces de Navegación */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <a href="#inicio" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Inicio
          </a>
          <a href="#acerca" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Acerca del sistema
          </a>
          <a href="#funcionalidades" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Funcionalidades
          </a>
          <a href="#tecnologias" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Tecnologías
          </a>
          <a href="#funcionamiento" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Funcionamiento
          </a>
          <a href="#contacto" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap">
            Contacto
          </a>
        </nav>

        {/* Acciones del Navbar */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle de Modo Skeleton para auditoría del usuario */}
          <button
            onClick={onToggleSkeletonMode}
            title={skeletonMode ? 'Desactivar modo skeleton' : 'Activar modo skeleton en toda la web'}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              skeletonMode
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200 font-bold'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{skeletonMode ? 'Skeleton Activo' : 'Ver Skeleton'}</span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Botón Destacado: Ingresar al sistema */}
          <button
            onClick={onEnterSystem}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm hover:shadow-md transition-all whitespace-nowrap shrink-0 group"
          >
            <span>Ingresar al sistema</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* SKELETON MODE PREVIEW EN TODA LA WEB SI ESTÁ ACTIVO */}
      {skeletonMode ? (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
          <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
              [Modo Skeleton Loading Activo en Toda la Web]
            </span>
            <button
              onClick={onToggleSkeletonMode}
              className="px-3 py-1 font-semibold rounded-lg bg-emerald-600 text-white"
            >
              Ver Contenido Real
            </button>
          </div>
          <HeroSkeleton />
          <div className="space-y-4">
            <SkeletonBox className="h-6 w-52" />
            <SkeletonBox className="h-4 w-96" />
            <CardGridSkeleton count={6} />
          </div>
          <div className="space-y-4">
            <SkeletonBox className="h-6 w-60" />
            <FlowSequenceSkeleton />
          </div>
        </div>
      ) : (
        <main className="space-y-24 pb-20">
          {/* 3. HERO PRINCIPAL */}
          <section id="inicio" className="relative pt-12 lg:pt-20 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                {/* Columna Texto Hero (7 columnas) */}
                <ScrollReveal animation="slide-up" className="lg:col-span-7 space-y-6">
                  {/* Badge de innovación */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>PLATAFORMA IOT & INTELIGENCIA CLÍNICA AMBIENTAL</span>
                  </div>

                  {/* Título Principal */}
                  <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] text-balance">
                    Monitoreo ambiental inteligente
                  </h1>

                  {/* Subtítulo */}
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl">
                    Conoce, analiza y supervisa las condiciones ambientales mediante tecnología IoT e inteligencia artificial.
                  </p>

                  {/* Botones del HERO */}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      onClick={onEnterSystem}
                      className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md hover:shadow-lg transition-all group"
                    >
                      <span>Explorar el sistema</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <a
                      href="#funcionalidades"
                      className="px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors"
                    >
                      Conocer funcionalidades
                    </a>
                  </div>

                  {/* Indicadores en Tiempo Real de Confianza */}
                  <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white block tabular-nums">
                        100 %
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                        Ingesta sin pérdida
                      </span>
                    </div>
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white block tabular-nums">
                        &lt; 200 ms
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                        Inferencia IA
                      </span>
                    </div>
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white block tabular-nums">
                        5 min
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                        Debouncing alertas
                      </span>
                    </div>
                  </div>
                </ScrollReveal>

                {/* Columna Visual Hero (5 columnas): Ilustración Tecnológica & Elementos Flotantes */}
                <ScrollReveal animation="slide-right" delay={150} className="lg:col-span-5 relative">
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-900/20 dark:border-emerald-800/40 shadow-2xl bg-slate-900 group">
                    <img
                      src="/src/assets/images/iot_environmental_hero_1794429349622.jpg"
                      alt="Ilustración tecnológica de sensores ambientales, dispositivos IoT y gráficas holográficas de temperatura y humedad en entorno botánico limpio"
                      referrerPolicy="no-referrer"
                      className="w-full h-80 sm:h-96 lg:h-[450px] object-cover transition-transform duration-700 group-hover:scale-102"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                    {/* Tarjeta Flotante 1: Telemetría de Sensor en Vivo */}
                    <div className="absolute top-4 left-4 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 text-white font-mono text-xs shadow-xl space-y-1 animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-sans text-[11px]">
                        <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
                        <span>Sonda Invernadero A1 · DHT22</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-200 font-bold">
                        <span>23.80 °C</span>
                        <span className="text-blue-400">68.4 %RH</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Estado: <span className="text-emerald-400 font-semibold">Nominal (Z: +0.32σ)</span>
                      </div>
                    </div>

                    {/* Tarjeta Flotante 2: Estado del Broker MQTT */}
                    <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white font-mono text-xs shadow-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-300 font-sans font-semibold text-[11px]">
                          <Server className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Broker Mosquitto TLS 1.3 (8883)</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Inferencia Isolation Forest: <span className="text-purple-400 font-semibold">Score 0.08 OK</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
                        ONLINE
                      </span>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </section>

          {/* 4. SECCIÓN ACERCA DEL SISTEMA */}
          <section id="acerca" className="py-16 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Misión y Alcance de la Plataforma
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Acerca del Sistema IoT de Monitoreo Ambiental
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  Diseñado para entornos industriales, laboratorios farmacéuticos, invernaderos hidropónicos y centros de cómputo donde la estabilidad higrotérmica es crítica. La plataforma unifica la adquisición de datos de hardware, la comunicación telemétrica segura y el análisis de datos predictivo.
                </p>
              </ScrollReveal>

              {/* Grid de 6 Tarjetas Visuales con Animación */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aboutCapabilities.map((item, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 80}
                    lazy
                    skeleton={<SkeletonBox className="h-40 rounded-2xl" />}
                  >
                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all hover:shadow-sm space-y-3 h-full flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                          {item.desc}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verificado en el sistema</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 5. SECCIÓN DE FUNCIONALIDADES */}
          <section id="funcionalidades" className="py-16">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <ScrollReveal animation="slide-up" className="max-w-2xl space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Módulos de la Solución
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Funcionalidades Principales
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Cada componente está estructurado bajo principios de arquitectura asíncrona guiada por eventos, asegurando integridad metrológica y usabilidad sin recargar la pantalla.
                </p>
              </ScrollReveal>

              {/* Grid de las 6 funcionalidades con hover y transiciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {functionalModules.map((mod, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 70}
                    lazy
                    skeleton={<SkeletonBox className="h-64 rounded-2xl" />}
                  >
                    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all space-y-4 flex flex-col justify-between h-full group">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                            {mod.icon}
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                            {mod.tag}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {mod.title}
                        </h3>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                          {mod.desc}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          {mod.highlight}
                        </span>
                        <button
                          onClick={onEnterSystem}
                          className="flex items-center gap-1 text-slate-400 hover:text-emerald-600 font-sans text-xs font-semibold"
                        >
                          <span>Ver</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 6. SECCIÓN DE TECNOLOGÍAS */}
          <section id="tecnologias" className="py-16 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <ScrollReveal animation="slide-up" className="max-w-2xl space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Stack & Protocolos
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Tecnologías Utilizadas en el Proyecto
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Tecnologías abiertas y estándares industriales para garantizar escalabilidad, seguridad perimetral y procesamiento distribuido de telemetría.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {techStack.map((tech, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 90}
                    lazy
                    skeleton={<SkeletonBox className="h-56 rounded-2xl" />}
                  >
                    <div className={`p-6 rounded-2xl border ${tech.color} space-y-3 flex flex-col justify-between h-full shadow-xs`}>
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          {tech.category}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {tech.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                          {tech.desc}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        {tech.badge}
                      </span>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 7. SECCIÓN DE FUNCIONAMIENTO (FLUJO DE INFORMACIÓN SECUENCIAL) */}
          <section id="funcionamiento" className="py-16">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <ScrollReveal animation="slide-up" className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Pipeline de Datos de Extremo a Extremo
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Funcionamiento del Sistema
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">
                  Secuencia desde la captura física hasta la visualización en la interfaz web reactiva.
                </p>
              </ScrollReveal>

              {/* Secuencia Visual con Pasos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 relative">
                {pipelineSteps.map((step, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="scale-in"
                    delay={idx * 80}
                    lazy
                    skeleton={<SkeletonBox className="h-44 rounded-xl" />}
                  >
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-center relative h-full flex flex-col justify-between shadow-xs hover:border-emerald-500 transition-colors">
                      <div className="space-y-2">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                          {step.icon}
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Paso {step.step}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {step.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-normal">
                          {step.desc}
                        </p>
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold pt-1">
                        &rarr; Siguiente
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              {/* Banner CTA intermedio para ingresar al sistema */}
              <ScrollReveal animation="fade-in" delay={150}>
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-8 rounded-2xl border border-emerald-800/40 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-lg font-bold">
                      ¿Listo para monitorear sus espacios ambientales en vivo?
                    </h3>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Acceda al panel de gestión para observar las lecturas de los nodos ESP32, verificar alertas y probar el simulador de fallas.
                    </p>
                  </div>
                  <button
                    onClick={onEnterSystem}
                    className="px-6 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all whitespace-nowrap shrink-0 flex items-center gap-2"
                  >
                    <span>Ingresar al sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* 11. CONTACTO O INFORMACIÓN DEL PROYECTO */}
          <section id="contacto" className="py-16 bg-white dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Información Académica del Proyecto */}
                <ScrollReveal animation="slide-left" className="lg:col-span-5 space-y-5">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Ficha Técnica del Proyecto
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Información y Contacto del Proyecto
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                    Este proyecto integra instrumentación física de bajo costo con algoritmos avanzados de análisis telemétrico para democratizar el monitoreo ambiental industrial.
                  </p>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-slate-400 text-[11px] block font-sans">Línea de Investigación</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Internet de las Cosas (IoT) e Inteligencia Artificial en Climatización
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-slate-400 text-[11px] block font-sans">Arquitectura Implementada</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Modular Asíncrona Guiada por Eventos con BFF y TimescaleDB
                      </span>
                    </div>
                  </div>
                </ScrollReveal>

                {/* Formulario de Contacto Funcional con Validación */}
                <ScrollReveal animation="slide-right" delay={100} className="lg:col-span-7">
                  <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      <span>Formulario de Consulta Técnica</span>
                    </h3>

                    {contactSent ? (
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>¡Mensaje enviado con éxito! Nos comunicaremos a la brevedad.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                              Nombre Completo
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="ej. Ing. Fernando Soto"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                              Correo Electrónico
                            </label>
                            <input
                              type="email"
                              required
                              placeholder="contacto@institucion.edu"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                            Mensaje o Consulta sobre el Sistema
                          </label>
                          <textarea
                            rows={3}
                            required
                            placeholder="Describa su duda sobre sensores, brokers MQTT o detección de anomalías..."
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <button
                          type="submit"
                          className="px-5 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Mensaje</span>
                        </button>
                      </form>
                    )}
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* 11. FOOTER ELEGANTE */}
      <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Columna 1: Identidad */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  EcoSense IoT
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                Sistema IoT de Monitoreo Ambiental inteligente con ingesta MQTT, orquestación Node-RED y detección de anomalías por IA.
              </p>
            </div>

            {/* Columna 2: Accesos Rápidos */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider block font-mono">
                Navegación
              </span>
              <ul className="space-y-1.5 text-[11px]">
                <li><a href="#inicio" className="hover:text-emerald-600">Inicio</a></li>
                <li><a href="#acerca" className="hover:text-emerald-600">Acerca del sistema</a></li>
                <li><a href="#funcionalidades" className="hover:text-emerald-600">Funcionalidades</a></li>
                <li><a href="#tecnologias" className="hover:text-emerald-600">Tecnologías</a></li>
                <li><a href="#funcionamiento" className="hover:text-emerald-600">Funcionamiento</a></li>
              </ul>
            </div>

            {/* Columna 3: Tecnologías */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider block font-mono">
                Stack Tecnológico
              </span>
              <ul className="space-y-1.5 text-[11px] font-mono">
                <li>Python & Scikit-Learn</li>
                <li>Eclipse Mosquitto MQTTS</li>
                <li>Node-RED Engine</li>
                <li>Sensores DHT22 & BME280</li>
                <li>TimescaleDB Hypertable</li>
              </ul>
            </div>

            {/* Columna 4: Información Académica y Acción */}
            <div className="space-y-3">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider block font-mono">
                Acceso al Proyecto
              </span>
              <p className="text-[11px] text-slate-500 font-normal">
                Proyecto de Investigación y Desarrollo de Telemetría Ambiental.
              </p>
              <button
                onClick={onEnterSystem}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Ingresar al sistema</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <div>
              © 2026 Sistema IoT de Monitoreo Ambiental. Todos los derechos reservados.
            </div>
            <div className="font-mono text-slate-400">
              Desarrollado bajo estándares abiertos IoT y Machine Learning.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
