import React, { useState, useCallback } from 'react';
import {
  Activity,
  Cpu,
  Thermometer,
  AlertTriangle,
  BrainCircuit,
  FileSpreadsheet,
  Server,
  Layers,
  ArrowRight,
  CheckCircle2,
  Mail,
  Send,
  ChevronRight,
  LineChart,
  Radio,
  Menu,
  X,
  ShieldCheck,
  MapPin,
  Clock,
} from 'lucide-react';
import { ScrollReveal } from '../../hooks/useScrollAnimation';
import { HeroSkeleton, CardGridSkeleton, FlowSequenceSkeleton, SkeletonBox } from '../common/SkeletonLoader';
import { OptimizedImage } from '../common/OptimizedImage';
import { EnvironmentalThreeBackground } from './EnvironmentalThreeBackground';

interface EnvironmentalLandingPageProps {
  onEnterSystem: (initialTab?: string) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  skeletonMode?: boolean;
  onToggleSkeletonMode?: () => void;
  onOpenPerformanceMonitor?: () => void;
}

export const EnvironmentalLandingPage: React.FC<EnvironmentalLandingPageProps> = ({
  onEnterSystem,
  skeletonMode = false,
  onToggleSkeletonMode = () => {},
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactHardwareModel, setContactHardwareModel] = useState('ESP32-WROOM + Sensor DHT22');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const handleContactSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setContactSent(false);
    }, 4000);
  }, []);

  // 6 Feature Metric Tiles (Acerca del Sistema — 16px padding, #F2F8F4 fill, 28px radius)
  const aboutCapabilities = [
    {
      icon: <Thermometer className="w-5 h-5 text-[#15803D]" />,
      metric: '±0.2 °C',
      metricColor: 'text-[#15803D]',
      title: 'Registro de Temperatura y Humedad',
      desc: 'Captura periódica y continua de variables higrotérmicas en recintos críticos con sondas calibradas.',
    },
    {
      icon: <Cpu className="w-5 h-5 text-[#0D3B1E]" />,
      metric: 'ESP32',
      metricColor: 'text-[#0D3B1E]',
      title: 'Supervisión de Dispositivos IoT',
      desc: 'Seguimiento en tiempo real de nodos microcontroladores con control de estado y telemetría.',
    },
    {
      icon: <LineChart className="w-5 h-5 text-[#15803D]" />,
      metric: '100%',
      metricColor: 'text-[#15803D]',
      title: 'Consultas e Historiales en Vivo',
      desc: 'Base de datos temporal TimescaleDB con trazabilidad integral de millones de puntos telemétricos.',
    },
    {
      icon: <Activity className="w-5 h-5 text-[#0D3B1E]" />,
      metric: '1 Hz',
      metricColor: 'text-[#0D3B1E]',
      title: 'Gráficas Ambientales Dinámicas',
      desc: 'Series de tiempo interactivas en SVG con bandas de tolerancia, líneas de umbral y zoom temporal.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-[#DC2626]" />,
      metric: '5 min',
      metricColor: 'text-[#DC2626]',
      title: 'Alertas Preventivas con Debouncing',
      desc: 'Disparo inmediato ante superación de límites, consolidando eventos críticos sin saturación.',
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-[#15803D]" />,
      metric: '<200 ms',
      metricColor: 'text-[#15803D]',
      title: 'Detección Inteligente con IA',
      desc: 'Algoritmos Isolation Forest y Z-Score dinámico que discriminan picos de anomalías reales.',
    },
  ];

  // 6 Main Modules with Next-Gen AVIF/WebP Imagery & Lazy Loading
  const functionalModules: Array<{
    tag: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
    highlight: string;
    metricValue: string;
    metricTone: string;
    imageBase: 'module-esp32-node' | 'module-sensors-dht22' | 'module-mqtt-broker' | 'module-ai-anomaly' | 'module-lab-bioterium' | 'module-climate-chamber';
    imageAlt: string;
  }> = [
    {
      tag: 'Hardware & Red',
      icon: <Cpu className="w-5 h-5 text-[#0D3B1E]" />,
      title: 'Dispositivos IoT',
      desc: 'Administración y seguimiento de nodos ESP32, ESP8266 y Gateways industriales. Validación estricta de dirección MAC, control de paquetes PINGREQ y estado Online/Offline.',
      highlight: 'Validación MAC & Pings 3s',
      metricValue: '99.9%',
      metricTone: 'text-[#15803D]',
      imageBase: 'module-esp32-node',
      imageAlt: 'Microcontrolador ESP32-WROOM iluminado en galería oscura con telemetría activa',
    },
    {
      tag: 'Instrumentación',
      icon: <Thermometer className="w-5 h-5 text-[#15803D]" />,
      title: 'Sensores Ambientales',
      desc: 'Gestión y parametrización de sensores DHT22, BME280 y SHT31. Definición de umbrales operacionales mínimos y máximos, así como límites críticos de contingencia.',
      highlight: 'DHT22 · BME280 · SHT31',
      metricValue: '23.8°',
      metricTone: 'text-[#15803D]',
      imageBase: 'module-sensors-dht22',
      imageAlt: 'Anillos concéntricos de temperatura y humedad relativa del sensor DHT22',
    },
    {
      tag: 'Telemetría Viva',
      icon: <Activity className="w-5 h-5 text-[#0D3B1E]" />,
      title: 'Mediciones e Historial',
      desc: 'Streaming de series temporales en tiempo real sin latencia. Visualización simultánea de temperatura (°C) y humedad relativa (%RH) con almacenamiento TimescaleDB.',
      highlight: 'Streaming continuo 1Hz',
      metricValue: '68%RH',
      metricTone: 'text-[#0D3B1E]',
      imageBase: 'module-mqtt-broker',
      imageAlt: 'Onda de transmisión de paquetes telemétricos MQTTS en tiempo real',
    },
    {
      tag: 'Seguridad Operativa',
      icon: <AlertTriangle className="w-5 h-5 text-[#DC2626]" />,
      title: 'Gestor de Alertas',
      desc: 'Seguimiento de condiciones fuera de parámetro con debouncing de 5 minutos. Catálogo normalizado de causas, alarma sonora en cabina y registro de operadores.',
      highlight: 'Debouncing 5 min & Beeper',
      metricValue: '3.0σ',
      metricTone: 'text-[#DC2626]',
      imageBase: 'module-climate-chamber',
      imageAlt: 'Recinto clínico monitoreado con alertas preventivas ante excursiones térmicas',
    },
    {
      tag: 'Machine Learning',
      icon: <BrainCircuit className="w-5 h-5 text-[#15803D]" />,
      title: 'Inteligencia Artificial',
      desc: 'Inferencia multivariante mediante el algoritmo Isolation Forest combinado con Z-Score 3σ. Diagnóstico predictivo de causa raíz transmitido token a token.',
      highlight: 'Isolation Forest & Z-Score',
      metricValue: '0.08',
      metricTone: 'text-[#15803D]',
      imageBase: 'module-ai-anomaly',
      imageAlt: 'Detección de anomalías mediante algoritmo Isolation Forest en galería oscura',
    },
    {
      tag: 'Trazabilidad & Auditoría',
      icon: <FileSpreadsheet className="w-5 h-5 text-[#0D3B1E]" />,
      title: 'Reportes y Analítica',
      desc: 'Estadísticas consolidadas (Mín, Máx, Promedio, Desviación Estándar y Tasa de Conformidad SLA). Exportación asíncrona mediante cola de trabajos en CSV y JSON.',
      highlight: 'Descarga CSV / JSON / SLA',
      metricValue: 'GxP',
      metricTone: 'text-[#0D3B1E]',
      imageBase: 'module-lab-bioterium',
      imageAlt: 'Laboratorio e incubadora ambiental con certificación de cadena de frío GxP',
    },
  ];

  // 4 Core Technologies
  const techStack = [
    {
      name: 'Python & IA',
      category: 'Procesamiento & Modelos',
      desc: 'FastAPI para backend asíncrono, NumPy y Scikit-Learn ejecutando el modelo Isolation Forest y control estadístico Z-Score para la detección de anomalías.',
      badge: 'Python 3.10+ · Scikit-Learn',
    },
    {
      name: 'MQTT Protocol',
      category: 'Broker de Mensajería IoT',
      desc: 'Eclipse Mosquitto v2.0+ implementando comunicación publish/subscribe ultraliviana sobre canal cifrado MQTTS con TLS 1.3 en puerto 8883.',
      badge: 'Mosquitto · MQTTS TLS 8883',
    },
    {
      name: 'Node-RED',
      category: 'Orquestación de Flujos',
      desc: 'Motor visual de interconexión para transformación de payloads JSON telemétricos, filtrado de tramas corruptas y desvío a Dead Letter Queue (DLQ).',
      badge: 'Node-RED Runtime v3.0+',
    },
    {
      name: 'Sensores IoT',
      category: 'Captura Ambiental',
      desc: 'Sondas digitales de alta precisión DHT22, Bosch BME280 y Sensirion SHT31 conectadas a microcontroladores ESP32 con lecturas estables cada 2.5s.',
      badge: 'ESP32 · DHT22 · BME280',
    },
  ];

  // 6 Pipeline Steps (Funcionamiento)
  const pipelineSteps = [
    {
      step: '01',
      title: 'Sensores Ambientales',
      desc: 'Sondas DHT22/BME280 miden temperatura y humedad relativa en el espacio físico.',
      icon: <Thermometer className="w-4 h-4 text-[#15803D]" />,
    },
    {
      step: '02',
      title: 'Nodo ESP32',
      desc: 'El microcontrolador digitaliza señales y empaqueta la telemetría en JSON ligero.',
      icon: <Cpu className="w-4 h-4 text-[#0D3B1E]" />,
    },
    {
      step: '03',
      title: 'Broker Mosquitto',
      desc: 'Transmisión cifrada MQTTS TLS 1.3 sobre puerto 8883 con garantía QoS 1.',
      icon: <Server className="w-4 h-4 text-[#0D3B1E]" />,
    },
    {
      step: '04',
      title: 'Node-RED Engine',
      desc: 'Valida la integridad del paquete JSON; si está corrupto lo aísla en la cola DLQ.',
      icon: <Layers className="w-4 h-4 text-[#0D3B1E]" />,
    },
    {
      step: '05',
      title: 'Motor Python e IA',
      desc: 'FastAPI almacena en TimescaleDB y ejecuta Isolation Forest en <200ms.',
      icon: <BrainCircuit className="w-4 h-4 text-[#15803D]" />,
    },
    {
      step: '06',
      title: 'Dashboard en Vivo',
      desc: 'La interfaz actualiza gráficas, indicadores y alertas críticas al instante.',
      icon: <Activity className="w-4 h-4 text-[#DC2626]" />,
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#F2F8F4] text-[#0D3B1E] selection:bg-[#1B5E20] selection:text-[#ffffff] overflow-x-hidden">
      {/* Fondo 3D Interactivo con Three.js (figuras dispersas, partículas y seguimiento de cursor) */}
      <EnvironmentalThreeBackground />

      {/* BARRA DE NAVEGACIÓN PRINCIPAL UNIFICADA Y PROFESIONAL */}
      <header className="sticky top-0 z-50 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#C8E6C9] shadow-[0_4px_20px_rgba(13,59,30,0.05)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between gap-6">
          {/* Logo Oficial SIMOA */}
          <a
            href="#inicio"
            className="flex items-center gap-3 shrink-0 group focus:outline-none"
          >
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-11 sm:h-12 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </a>

          {/* Enlaces de Navegación Centrales */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#F2F8F4] p-1.5 rounded-full border border-[#C8E6C9]/80">
            {[
              { href: '#inicio', label: 'Inicio' },
              { href: '#acerca', label: 'Nosotros' },
              { href: '#funcionalidades', label: 'Soluciones' },
              { href: '#tecnologias', label: 'Tecnología' },
              { href: '#funcionamiento', label: 'Cómo Funciona' },
              { href: '#contacto', label: 'Contacto' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-[#265336] hover:text-[#1B5E20] hover:bg-[#FFFFFF] hover:shadow-xs transition-all"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Acciones Comerciales Derecha */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F5E9] border border-[#A5D6A7] text-[12px] font-semibold text-[#1B5E20]">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Red IoT Activa</span>
            </div>

            <a
              href="#contacto"
              className="px-4 py-2 rounded-full text-[13px] font-semibold text-[#1B5E20] hover:bg-[#E8F5E9] transition-colors"
            >
              Solicitar Demo
            </a>

            <button
              onClick={() => onEnterSystem('dashboard')}
              className="px-5 py-2.5 text-[13px] font-semibold flex items-center gap-2 cursor-pointer rounded-full bg-[#0d1310] text-white hover:bg-[#1a231d] border border-[#1f2922] shadow-sm transition-all"
            >
              <span>Ingresar al Sistema</span>
              <ArrowRight className="w-4 h-4 text-[#4ade80]" />
            </button>
          </div>

          {/* Botón Menú Móvil */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="apple-blue-pill px-3.5 py-2 text-[12px] font-semibold"
            >
              Ingresar
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menú de navegación"
              className="p-2 rounded-xl bg-[#F2F8F4] border border-[#C8E6C9] text-[#0D3B1E]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFFFF] border-t border-[#C8E6C9] px-6 py-4 space-y-2 shadow-lg">
            {[
              { href: '#inicio', label: 'Inicio' },
              { href: '#acerca', label: 'Nosotros' },
              { href: '#funcionalidades', label: 'Soluciones' },
              { href: '#tecnologias', label: 'Tecnología' },
              { href: '#funcionamiento', label: 'Cómo Funciona' },
              { href: '#contacto', label: 'Contacto' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-[14px] font-semibold text-[#0D3B1E] hover:bg-[#F2F8F4] hover:text-[#1B5E20]"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* SKELETON MODE PREVIEW */}
      {skeletonMode ? (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
          <div className="flex items-center justify-between p-4 bg-[#FFFFFF] rounded-[28px] text-xs">
            <span className="font-semibold text-[#15803D] font-mono">
              [Modo Skeleton Loading Activo en Toda la Web]
            </span>
            <button
              onClick={onToggleSkeletonMode}
              className="apple-blue-pill px-4 py-1.5 font-semibold text-xs"
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
        <main className="relative z-10 space-y-[24px]">
          {/* 3. HERO PRODUCT STAGE */}
          <section id="inicio" className="bg-transparent pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                {/* Left Column: Monumental Launch Statement */}
                <ScrollReveal animation="slide-up" className="lg:col-span-7 space-y-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3.5 py-1.5 rounded-full bg-[#0d1310] text-[#86efac] border border-[#166534] text-[12px] font-semibold tracking-wide shadow-xs inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                      TELEMETRÍA AMBIENTAL EN TIEMPO REAL
                    </span>
                    <span className="apple-nav-text text-[#0d1310] uppercase tracking-wider font-bold">
                      PRECISIÓN INDUSTRIAL · IA PREDICTIVA
                    </span>
                  </div>

                  <h1 className="apple-hero-display text-balance">
                    Monitoreo ambiental inteligente.
                  </h1>

                  <p className="text-[17px] leading-relaxed text-[#1e293b] max-w-xl font-medium">
                    Plataforma integral de supervisión ambiental para invernaderos, laboratorios, cámaras de conservación y espacios críticos. Controla temperatura y humedad en vivo con alertas preventivas e Inteligencia Artificial.
                  </p>

                  {/* Primary & Secondary Commercial CTAs */}
                  <div className="flex flex-wrap items-center gap-3.5 pt-2">
                    <button
                      onClick={() => onEnterSystem('dashboard')}
                      className="px-7 py-3.5 text-[14px] font-semibold leading-[18px] flex items-center gap-2 cursor-pointer rounded-full bg-[#0d1310] text-white hover:bg-[#1a231d] shadow-[0_4px_16px_rgba(13,19,16,0.3)] border border-[#1f2922] transition-all"
                    >
                      <span>Acceder al Panel en Vivo</span>
                      <ArrowRight className="w-4 h-4 text-[#4ade80]" />
                    </button>
                    <a
                      href="#funcionalidades"
                      className="py-3.5 px-6 text-[14px] font-bold text-[#0d1310] bg-[#FFFFFF] border-2 border-[#0d1310]/20 hover:border-[#0d1310] hover:bg-[#f0fdf4] rounded-full transition-all shadow-xs"
                    >
                      Conocer Soluciones
                    </a>
                  </div>
                </ScrollReveal>

                {/* Right Column: Isolated Hardware Showcase on Gallery Black using AVIF/WebP <picture> */}
                <ScrollReveal animation="slide-right" delay={120} className="lg:col-span-5">
                  <div className="relative rounded-[28px] overflow-hidden bg-[#F2F8F4] border border-[#C8E6C9] shadow-md">
                    <OptimizedImage
                      baseName="hero-iot-stage"
                      alt="Hardware IoT ESP32 y sensores ambientales en formato AVIF/WebP con lecturas luminosas sobre fondo negro"
                      priority={true}
                      width={1200}
                      height={800}
                      className="w-full h-80 sm:h-96 lg:h-[440px] object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1310]/60 via-transparent to-transparent" />

                    {/* Health/Sensor Readout Overlay 1 — High Contrast Dark Carbon Header */}
                    <div className="absolute top-4 left-4 p-4 rounded-[24px] bg-[#0d1310]/92 backdrop-blur-md border border-[#1f2922] shadow-md space-y-1 text-white">
                      <div className="flex items-center gap-2 text-[12px] text-[#86efac] tracking-[-0.12px]">
                        <Radio className="w-3.5 h-3.5 text-[#22c55e] animate-pulse" />
                        <span>NODO INVERNADERO A1 · DHT22</span>
                      </div>
                      <div className="flex items-baseline gap-4 pt-1">
                        <div>
                          <span className="text-[28px] font-semibold tracking-[0.196px] text-[#4ade80] font-display tabular-nums">
                            23.8°
                          </span>
                          <span className="text-[12px] text-[#86efac] ml-1">TEMP</span>
                        </div>
                        <div>
                          <span className="text-[28px] font-semibold tracking-[0.196px] text-white font-display tabular-nums">
                            68.4%
                          </span>
                          <span className="text-[12px] text-[#86efac] ml-1">HUM</span>
                        </div>
                      </div>
                    </div>

                    {/* Health/Sensor Readout Overlay 2 — High Contrast Dark Carbon Anomaly Banner */}
                    <div className="absolute bottom-4 left-4 right-4 p-4 rounded-[24px] bg-[#0d1310]/95 backdrop-blur-md border border-[#1f2922] shadow-lg flex items-center justify-between text-white">
                      <div>
                        <div className="text-[12px] text-[#86efac]">ANOMALÍA IA · ISOLATION FOREST</div>
                        <div className="text-[14px] font-semibold text-white mt-0.5">
                          Score <span className="text-[#4ade80]">0.082 Nominal</span> · Umbral Crítico{' '}
                          <span className="text-[#f87171]">3.0σ</span>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#166534] text-[#86efac] text-[11px] font-semibold border border-[#22c55e]/40">
                        PROTECCIÓN ACTIVA
                      </span>
                    </div>
                  </div>
                </ScrollReveal>
              </div>

              {/* Floating High-Contrast Dark Utility Capsule */}
              <ScrollReveal animation="fade-in" delay={180}>
                <div className="p-3 pl-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto rounded-[36px] bg-[#0d1310] text-white border border-[#1f2922] shadow-[0_8px_30px_rgba(13,19,16,0.25)]">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-[14px] font-medium leading-[18px] tracking-[-0.224px] text-white">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                      Ingesta 100% sin pérdida
                    </span>
                    <span className="text-[#3b493f] hidden sm:inline">|</span>
                    <span>
                      Inferencia IA <span className="text-[#4ade80] font-semibold">&lt; 200 ms</span>
                    </span>
                    <span className="text-[#3b493f] hidden sm:inline">|</span>
                    <span>
                      Debouncing de alertas <span className="text-[#f87171] font-semibold">5 min</span>
                    </span>
                  </div>
                  <button
                    onClick={() => onEnterSystem()}
                    className="apple-blue-pill px-5 py-2.5 text-[12px] font-semibold leading-[16px] tracking-[-0.12px] shrink-0 w-full sm:w-auto text-center cursor-pointer"
                  >
                    Ingresar al Dashboard
                  </button>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* 4. UPGRADE COMPARISON MODULE */}
          <section id="acerca" className="px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#FFFFFF] border border-[#0d1310]/15 shadow-sm rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-4">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#15803D] bg-[#e8f5e9] border border-[#86efac] px-3.5 py-1 rounded-full inline-block">
                  Misión y alcance del sistema
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Precisión clínica en cada lectura ambiental.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed">
                  Diseñado para aulas, laboratorios farmacéuticos, bodegas e invernaderos donde la estabilidad higrotérmica es crítica. SIMOA unifica sensores electrónicos, transmisión MQTT segura y detección de anomalías por IA.
                </p>
              </ScrollReveal>

              {/* Featured Two-Column AVIF/WebP Hardware Showcase Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
                <div className="bg-[#FFFFFF] border border-[#0d1310]/15 shadow-xs rounded-[28px] overflow-hidden flex flex-col justify-between">
                  <div className="relative h-60 w-full overflow-hidden">
                    <OptimizedImage
                      baseName="module-lab-bioterium"
                      alt="Monitoreo de laboratorios y bioterios con sensores de precisión en formato AVIF/WebP"
                      priority={false}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1310]/70 via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-[#0d1310] text-[#86efac] border border-[#166534] text-[12px] font-semibold tracking-wide shadow-sm">
                      CADENA DE FRÍO · 24/7
                    </span>
                  </div>
                  <div className="p-6 space-y-3 bg-[#FFFFFF]">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-[20px] font-bold text-[#0d1310]">
                        Laboratorios, Invernaderos y Cámaras Frías
                      </h3>
                      <span className="text-[28px] font-bold text-[#15803D] font-display tabular-nums">
                        4.2°C
                      </span>
                    </div>
                    <p className="text-[14px] text-[#1e293b] leading-relaxed">
                      Supervisión ininterrumpida 24/7 con trazabilidad histórica completa y respuesta inmediata para proteger cultivos e insumos sensibles.
                    </p>
                  </div>
                </div>

                <div className="bg-[#FFFFFF] border border-[#0d1310]/15 shadow-xs rounded-[28px] overflow-hidden flex flex-col justify-between">
                  <div className="relative h-60 w-full overflow-hidden">
                    <OptimizedImage
                      baseName="module-climate-chamber"
                      alt="Control ambiental en tiempo real con alertas automáticas"
                      priority={false}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1310]/70 via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-[#0d1310] text-[#f87171] border border-[#991b1b] text-[12px] font-semibold tracking-wide shadow-sm">
                      ALERTAS AUTOMÁTICAS
                    </span>
                  </div>
                  <div className="p-6 space-y-3 bg-[#FFFFFF]">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-[20px] font-bold text-[#0d1310]">
                        Detección Temprana de Excursiones
                      </h3>
                      <span className="text-[28px] font-bold text-[#DC2626] font-display tabular-nums">
                        +3.1σ
                      </span>
                    </div>
                    <p className="text-[14px] text-[#1e293b] leading-relaxed">
                      Cuando una variable supera los rangos establecidos, el motor dispara alertas con debouncing y diagnóstico IA transmitido token a token.
                    </p>
                  </div>
                </div>
              </div>

              {/* Three-column Feature Metric Tiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
                {aboutCapabilities.map((item, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 60}
                    lazy
                    skeleton={<SkeletonBox className="h-44" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#FFFFFF] border border-[#0d1310]/14 shadow-xs hover:border-[#15803D]/50 hover:shadow-md rounded-[28px] p-6 h-full flex flex-col justify-between space-y-4 transition-all">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#0d1310] font-bold uppercase tracking-wider bg-[#f0fdf4] border border-[#86efac]/80 px-2.5 py-1 rounded-full">
                            Telemetría SIMOA
                          </span>
                          <div className="w-9 h-9 rounded-xl bg-[#0d1310] flex items-center justify-center text-[#4ade80] shadow-xs">
                            {item.icon}
                          </div>
                        </div>
                        <div className={`text-[32px] font-bold ${item.metricColor} py-1 tabular-nums font-display`}>
                          {item.metric}
                        </div>
                        <h3 className="text-[18px] font-bold leading-snug text-[#0d1310]">
                          {item.title}
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[#1e293b]">
                          {item.desc}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#0d1310]/10 flex items-center gap-2 text-[12px] font-semibold text-[#0d1310]">
                        <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                        <span>Módulo activo en tiempo real</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 5. FEATURE MEDIA CARDS */}
          <section id="funcionalidades" className="py-12 px-4 sm:px-6 bg-transparent">
            <div className="max-w-7xl mx-auto space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#15803D] bg-[#e8f5e9] border border-[#86efac] px-3.5 py-1 rounded-full inline-block">
                  Soluciones de Monitoreo Integral
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Seis módulos. Un ecosistema continuo.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed">
                  Arquitectura completa para supervisar cada punto de tu operación ambiental desde la captura en campo hasta el análisis predictivo.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
                {functionalModules.map((mod, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 70}
                    lazy
                    skeleton={<SkeletonBox className="h-80" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#FFFFFF] border border-[#0d1310]/15 shadow-[0_8px_30px_rgba(13,19,16,0.06)] hover:shadow-[0_16px_40px_rgba(13,19,16,0.12)] hover:border-[#15803D]/50 rounded-[28px] overflow-hidden flex flex-col justify-between h-full transition-all">
                      {/* Media Header */}
                      <div className="relative h-44 w-full bg-[#0d1310] overflow-hidden">
                        <OptimizedImage
                          baseName={mod.imageBase}
                          alt={mod.imageAlt}
                          priority={false}
                          className="w-full h-full object-cover opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1310]/70 via-transparent to-transparent" />
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-[#0d1310] text-[#86efac] border border-[#166534] shadow-xs">
                            {mod.tag}
                          </span>
                          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-[#15803D] text-white shadow-xs">
                            {mod.highlight}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between bg-[#FFFFFF]">
                        <div className="space-y-3">
                          {/* Cápsula de Indicador de Alto Contraste Negro */}
                          <div className="bg-[#0d1310] text-white rounded-[22px] p-4 border border-[#1f2922] shadow-sm flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-[#86efac] block uppercase tracking-wider">
                                Indicador Operativo
                              </span>
                              <span
                                className={`text-[28px] font-bold ${
                                  mod.metricTone === 'text-[#DC2626]' ? 'text-[#f87171]' : 'text-[#4ade80]'
                                } tabular-nums font-display`}
                              >
                                {mod.metricValue}
                              </span>
                            </div>
                            <div className="w-11 h-11 rounded-full bg-[#16221a] border border-[#223528] flex items-center justify-center text-[#4ade80] shadow-xs">
                              {mod.icon}
                            </div>
                          </div>

                          <h3 className="text-[20px] font-bold text-[#0d1310] pt-1">
                            {mod.title}
                          </h3>

                          <p className="text-[14px] leading-relaxed text-[#1e293b]">
                            {mod.desc}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#0d1310]/12 flex items-center justify-between">
                          <button
                            onClick={() => onEnterSystem()}
                            className="text-[14px] font-bold text-[#0d1310] hover:text-[#15803D] flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <span>Explorar solución</span>
                            <ChevronRight className="w-4 h-4 text-[#15803D]" />
                          </button>
                          <span className="text-[12px] font-bold text-[#15803D] bg-[#e8f5e9] border border-[#86efac]/70 px-2.5 py-0.5 rounded-full">
                            ● En tiempo real
                          </span>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 6. SECCIÓN DE TECNOLOGÍAS - ALTO CONTRASTE NEGRO INDUSTRIAL */}
          <section id="tecnologias" className="px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#0d1310] text-white border border-[#1f2922] shadow-[0_16px_50px_rgba(13,19,16,0.35)] rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-4">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#4ade80] bg-[#16291e] border border-[#22c55e]/40 px-3.5 py-1 rounded-full inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  Stack & Protocolos
                </span>
                <h2 className="text-[30px] sm:text-[38px] font-bold text-white tracking-tight leading-tight">
                  Ingeniería abierta de grado industrial.
                </h2>
                <p className="text-[16px] text-[#cbd5e1] leading-relaxed max-w-3xl">
                  Estándares abiertos de baja latencia con compresión Brotli/Gzip, caché Redis, pool de conexiones co-localizado y trazabilidad OpenTelemetry.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
                {techStack.map((tech, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 80}
                    lazy
                    skeleton={<SkeletonBox className="h-56" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#141d18] border border-[#1e2e25] rounded-[24px] p-6 flex flex-col justify-between h-full space-y-4 hover:border-[#22c55e]/50 hover:shadow-[0_8px_24px_rgba(34,197,94,0.12)] transition-all">
                      <div className="space-y-2">
                        <span className="text-[12px] font-bold text-[#4ade80] uppercase tracking-wider">
                          {tech.category}
                        </span>
                        <h3 className="text-[20px] font-bold text-white">
                          {tech.name}
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[#94a3b8]">
                          {tech.desc}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#1e2e25]">
                        <span className="text-[12px] font-mono font-semibold text-[#86efac] bg-[#0d1310] border border-[#166534] px-3 py-1 rounded-full inline-block">
                          {tech.badge}
                        </span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 7. SECCIÓN DE FUNCIONAMIENTO */}
          <section id="funcionamiento" className="py-12 px-4 sm:px-6 bg-transparent">
            <div className="max-w-7xl mx-auto space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#15803D] bg-[#e8f5e9] border border-[#86efac] px-3.5 py-1 rounded-full inline-block">
                  Flujo de información secuencial
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Del sensor al dashboard en milisegundos.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed">
                  Trazabilidad completa desde la captura física en el nodo ESP32 hasta la evaluación por Inteligencia Artificial y la alerta en pantalla.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-[16px]">
                {pipelineSteps.map((step, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="scale-in"
                    delay={idx * 70}
                    lazy
                    skeleton={<SkeletonBox className="h-44" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#FFFFFF] border border-[#0d1310]/15 shadow-xs hover:border-[#15803D]/50 hover:shadow-md rounded-[24px] p-5 space-y-3 h-full flex flex-col justify-between transition-all">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-[#86efac] bg-[#0d1310] border border-[#166534] px-2.5 py-0.5 rounded-full">
                            PASO {step.step}
                          </span>
                          <div className="w-8 h-8 rounded-xl bg-[#0d1310] flex items-center justify-center text-[#4ade80] shadow-xs">
                            {step.icon}
                          </div>
                        </div>
                        <h4 className="text-[16px] font-bold text-[#0d1310]">
                          {step.title}
                        </h4>
                        <p className="text-[13px] leading-relaxed text-[#1e293b]">
                          {step.desc}
                        </p>
                      </div>
                      <div className="text-[12px] text-[#0d1310] font-bold pt-1 flex items-center gap-1">
                        <span>Etapa verificada</span>
                        <span className="text-[#15803D]">→</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 8. SECCIÓN DE CONTACTO Y DESPLIEGUE COMERCIAL */}
          <section id="contacto" className="bg-[#E7F3EB]/80 backdrop-blur-[2px] border-t border-[#0d1310]/15 text-[#0D3B1E] py-20 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#15803D] bg-[#e8f5e9] border border-[#86efac] px-3.5 py-1 rounded-full inline-block">
                  Atención y Despliegue Empresarial
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Implementa SIMOA en tu operación.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed">
                  Configura tu red de sensores ambientales para invernaderos, laboratorios, cámaras de frío o bodegas. Nuestro equipo especialista te asesora en la instalación y calibración.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="slide-up" delay={100}>
                <div className="bg-[#FFFFFF] border border-[#0d1310]/15 shadow-sm text-[#0D3B1E] rounded-[28px] p-6 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {/* Columna de Información Comercial */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="space-y-3">
                      <div className="inline-block px-3 py-1.5 rounded-xl bg-[#0d1310] border border-[#1f2922]">
                        <img
                          src="/assets/images/simoa-logo.webp"
                          alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                          className="h-10 w-auto object-contain"
                        />
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#0d1310] text-[#86efac] border border-[#166534] text-[12px] font-semibold tracking-wide shadow-xs block w-fit">
                        SOLUCIONES A MEDIDA
                      </span>
                      <h3 className="text-[22px] font-bold text-[#0d1310] pt-1">
                        Ecosistema de Monitoreo Ambiental
                      </h3>
                      <p className="text-[14px] leading-relaxed text-[#1e293b]">
                        Integramos nodos inalámbricos de alta precisión con transmisión segura en tiempo real, paneles analíticos y alertas predictivas.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 rounded-[20px] bg-[#FFFFFF] border border-[#0d1310]/14 shadow-xs flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0d1310] flex items-center justify-center text-[#4ade80] shrink-0 shadow-xs">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] block">
                            Variables Supervisadas
                          </span>
                          <span className="text-[14px] font-bold text-[#0d1310] block">
                            Temperatura (°C), Humedad Relativa (%RH) y Punto de Rocío
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-[20px] bg-[#FFFFFF] border border-[#0d1310]/14 shadow-xs flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0d1310] flex items-center justify-center text-[#4ade80] shrink-0 shadow-xs">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] block">
                            Sectores de Aplicación
                          </span>
                          <span className="text-[14px] font-bold text-[#0d1310] block">
                            Agroindustria, Invernaderos, Laboratorios y Cadena de Frío
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-[20px] bg-[#FFFFFF] border border-[#0d1310]/14 shadow-xs flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0d1310] flex items-center justify-center text-[#4ade80] shrink-0 shadow-xs">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] block">
                            Disponibilidad y Soporte
                          </span>
                          <span className="text-[14px] font-bold text-[#15803D] block">
                            Monitoreo continuo 24/7 con alertas instantáneas
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna de Formulario Comercial */}
                  <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#0d1310]/15 shadow-xs rounded-[28px] p-6 sm:p-8 space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[18px] font-bold text-[#0d1310] flex items-center gap-2">
                        <Mail className="w-5 h-5 text-[#15803D]" />
                        <span>Solicitar Asesoría o Cotización</span>
                      </h4>
                    </div>

                    {contactSent ? (
                      <div className="p-5 rounded-[24px] bg-[#f0fdf4] border border-[#86efac] text-[#15803D] text-[14px] font-bold flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
                        <span>¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto contigo pronto.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-4 text-[14px]">
                        <div>
                          <label className="block text-[12px] font-bold text-[#0d1310] mb-1.5 uppercase tracking-wide">
                            Tipo de Solución o Espacio a Monitorear
                          </label>
                          <select
                            value={contactHardwareModel}
                            onChange={(e) => setContactHardwareModel(e.target.value)}
                            className="w-full py-3 px-4 rounded-xl bg-[#f8faf9] border border-[#0d1310]/20 text-[#0d1310] font-medium text-[14px] focus:outline-none focus:border-[#15803D] focus:bg-white transition-all"
                          >
                            <option value="ESP32-WROOM + Sensor DHT22">Invernadero / Cultivo Protegido (Temperatura y Humedad)</option>
                            <option value="ESP32-WROOM + Bosch BME280">Laboratorio Clínico o Farmacéutico (Alta Precisión)</option>
                            <option value="Gateway MQTTS + Sensirion SHT31">Cámara de Conservación / Cadena de Frío</option>
                            <option value="ESP8266 NodeMCU + DHT11">Bodega de Almacenamiento o Recinto Interior</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] font-bold text-[#0d1310] mb-1.5 uppercase tracking-wide">
                              Nombre Completo o Empresa
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Tu nombre o empresa"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              className="w-full py-3 px-4 rounded-xl bg-[#f8faf9] border border-[#0d1310]/20 text-[#0d1310] font-medium text-[14px] focus:outline-none focus:border-[#15803D] focus:bg-white placeholder-[#94a3b8] transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-bold text-[#0d1310] mb-1.5 uppercase tracking-wide">
                              Correo Electrónico
                            </label>
                            <input
                              type="email"
                              required
                              placeholder="contacto@empresa.com"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="w-full py-3 px-4 rounded-xl bg-[#f8faf9] border border-[#0d1310]/20 text-[#0d1310] font-medium text-[14px] focus:outline-none focus:border-[#15803D] focus:bg-white placeholder-[#94a3b8] transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[12px] font-bold text-[#0d1310] mb-1.5 uppercase tracking-wide">
                            Detalles del Proyecto
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Cuéntanos cuántos puntos de medición necesitas o las condiciones de tu espacio..."
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            className="w-full py-3 px-4 rounded-xl bg-[#f8faf9] border border-[#0d1310]/20 text-[#0d1310] font-medium text-[14px] focus:outline-none focus:border-[#15803D] focus:bg-white placeholder-[#94a3b8] transition-all"
                          />
                        </div>

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                          <button
                            type="submit"
                            className="px-8 py-3.5 text-[14px] font-bold leading-tight flex items-center gap-2.5 cursor-pointer rounded-full bg-[#0d1310] text-white hover:bg-[#1a231d] shadow-[0_4px_16px_rgba(13,19,16,0.3)] border border-[#1f2922] transition-all"
                          >
                            <span>Enviar Solicitud</span>
                            <Send className="w-4 h-4 text-[#4ade80]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onEnterSystem('dashboard')}
                            className="px-6 py-3 rounded-full text-[13px] font-bold text-[#0d1310] bg-[#FFFFFF] border-2 border-[#0d1310]/20 hover:border-[#0d1310] hover:bg-[#f0fdf4] transition-all cursor-pointer shadow-xs"
                          >
                            Acceder al Dashboard →
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>
        </main>
      )}

      {/* 9. FOOTER COMERCIAL DE ALTO CONTRASTE */}
      <footer className="relative z-10 py-12 bg-[#FFFFFF] border-t border-[#0d1310]/15 text-[12px] text-[#1e293b]">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="inline-block px-3 py-1.5 rounded-xl bg-[#0d1310] border border-[#1f2922]">
                <img
                  src="/assets/images/simoa-logo.webp"
                  alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <p className="text-[12px] text-[#1e293b] leading-relaxed">
                Sistema Inteligente de Monitoreo Ambiental con telemetría IoT en tiempo real, trazabilidad histórica y detección temprana de anomalías con Inteligencia Artificial.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#0d1310] text-[13px] block uppercase tracking-wider">
                Navegación
              </span>
              <ul className="space-y-1.5 font-medium text-[#1e293b]">
                <li><a href="#inicio" className="hover:text-[#15803D] transition-colors">Inicio</a></li>
                <li><a href="#acerca" className="hover:text-[#15803D] transition-colors">Nosotros</a></li>
                <li><a href="#funcionalidades" className="hover:text-[#15803D] transition-colors">Soluciones</a></li>
                <li><a href="#tecnologias" className="hover:text-[#15803D] transition-colors">Tecnología</a></li>
                <li><a href="#funcionamiento" className="hover:text-[#15803D] transition-colors">Cómo Funciona</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#0d1310] text-[13px] block uppercase tracking-wider">
                Soluciones Ambientales
              </span>
              <ul className="space-y-1.5 text-[#1e293b] font-medium">
                <li>Monitoreo de Invernaderos</li>
                <li>Control de Cadena de Frío</li>
                <li>Supervisión de Laboratorios</li>
                <li>Alertas Preventivas 24/7</li>
                <li>Diagnóstico con Inteligencia Artificial</li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="font-bold text-[#0d1310] text-[13px] block uppercase tracking-wider">
                Plataforma en Línea
              </span>
              <p className="text-[12px] text-[#1e293b]">
                Accede en tiempo real al panel de control de tus sensores, alertas y reportes.
              </p>
              <button
                onClick={() => onEnterSystem('dashboard')}
                className="px-5 py-2.5 rounded-full text-[12px] font-bold bg-[#0d1310] text-white hover:bg-[#1a231d] border border-[#1f2922] shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Ingresar al Sistema</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#4ade80]" />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-[#0d1310]/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#1e293b] font-medium">
            <div>
              © 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental. Todos los derechos reservados.
            </div>
            <div className="flex items-center gap-4">
              <a href="#contacto" className="hover:text-[#15803D] transition-colors">Soporte Técnico</a>
              <span>·</span>
              <a href="#inicio" className="hover:text-[#15803D] transition-colors">Privacidad y Seguridad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EnvironmentalLandingPage;
