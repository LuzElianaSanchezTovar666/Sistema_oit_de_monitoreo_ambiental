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
              className="apple-blue-pill px-5 py-2.5 text-[13px] font-semibold flex items-center gap-2 cursor-pointer"
            >
              <span>Ingresar al Sistema</span>
              <ArrowRight className="w-4 h-4" />
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
                    <span className="apple-badge-orange">TELEMETRÍA AMBIENTAL EN TIEMPO REAL</span>
                    <span className="apple-nav-text text-[#3B694C] uppercase tracking-wider font-semibold">
                      PRECISIÓN INDUSTRIAL · IA PREDICTIVA
                    </span>
                  </div>

                  <h1 className="apple-hero-display text-balance">
                    Monitoreo ambiental inteligente.
                  </h1>

                  <p className="apple-body text-[#3B694C] max-w-xl">
                    Plataforma integral de supervisión ambiental para invernaderos, laboratorios, cámaras de conservación y espacios críticos. Controla temperatura y humedad en vivo con alertas preventivas e Inteligencia Artificial.
                  </p>

                  {/* Primary & Secondary Commercial CTAs */}
                  <div className="flex flex-wrap items-center gap-3.5 pt-2">
                    <button
                      onClick={() => onEnterSystem('dashboard')}
                      className="apple-blue-pill px-7 py-3.5 text-[14px] font-semibold leading-[18px] flex items-center gap-2 cursor-pointer"
                    >
                      <span>Acceder al Panel en Vivo</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <a
                      href="#funcionalidades"
                      className="apple-white-outline-pill py-3.5 px-6 text-[14px] font-semibold leading-[18px]"
                    >
                      Conocer Soluciones
                    </a>
                  </div>
                </ScrollReveal>

                {/* Right Column: Isolated Hardware Showcase on Gallery Black using AVIF/WebP <picture> */}
                <ScrollReveal animation="slide-right" delay={120} className="lg:col-span-5">
                  <div className="relative rounded-[28px] overflow-hidden bg-[#F2F8F4]">
                    <OptimizedImage
                      baseName="hero-iot-stage"
                      alt="Hardware IoT ESP32 y sensores ambientales en formato AVIF/WebP con lecturas luminosas sobre fondo negro"
                      priority={true}
                      width={1200}
                      height={800}
                      className="w-full h-80 sm:h-96 lg:h-[440px] object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#F2F8F4] via-transparent to-[#F2F8F4]/40" />

                    {/* Health/Sensor Readout Overlay 1 — Vital Green & Pulse Red reserved for metrics */}
                    <div className="absolute top-4 left-4 p-4 rounded-[28px] bg-[#FFFFFF]/90 backdrop-blur-md space-y-1">
                      <div className="flex items-center gap-2 text-[12px] text-[#3B694C] tracking-[-0.12px]">
                        <Radio className="w-3.5 h-3.5 text-[#15803D] animate-pulse" />
                        <span>NODO INVERNADERO A1 · DHT22</span>
                      </div>
                      <div className="flex items-baseline gap-4 pt-1">
                        <div>
                          <span className="text-[28px] font-semibold tracking-[0.196px] text-[#15803D] font-display tabular-nums">
                            23.8°
                          </span>
                          <span className="text-[12px] text-[#3B694C] ml-1">TEMP</span>
                        </div>
                        <div>
                          <span className="text-[28px] font-semibold tracking-[0.196px] text-[#0D3B1E] font-display tabular-nums">
                            68.4%
                          </span>
                          <span className="text-[12px] text-[#3B694C] ml-1">HUM</span>
                        </div>
                      </div>
                    </div>

                    {/* Health/Sensor Readout Overlay 2 */}
                    <div className="absolute bottom-4 left-4 right-4 p-4 rounded-[28px] bg-[#FFFFFF]/95 backdrop-blur-md flex items-center justify-between">
                      <div>
                        <div className="text-[12px] text-[#3B694C]">ANOMALÍA IA · ISOLATION FOREST</div>
                        <div className="text-[14px] font-semibold text-[#0D3B1E] mt-0.5">
                          Score <span className="text-[#15803D]">0.082 Nominal</span> · Umbral Crítico{' '}
                          <span className="text-[#DC2626]">3.0σ</span>
                        </div>
                      </div>
                      <span className="apple-badge-orange">PROTECCIÓN ACTIVA</span>
                    </div>
                  </div>
                </ScrollReveal>
              </div>

              {/* Floating Dark Utility Capsule (#C8E6C9, 36px radius, 14px/600 copy + trailing Apple Blue 980px pill) */}
              <ScrollReveal animation="fade-in" delay={180}>
                <div className="apple-utility-capsule p-3 pl-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-[14px] font-semibold leading-[18px] tracking-[-0.224px] text-[#0D3B1E]">
                    <span>Ingesta 100% sin pérdida</span>
                    <span className="text-[#3B694C] hidden sm:inline">|</span>
                    <span>
                      Inferencia IA <span className="text-[#15803D]">&lt; 200 ms</span>
                    </span>
                    <span className="text-[#3B694C] hidden sm:inline">|</span>
                    <span>
                      Debouncing de alertas <span className="text-[#DC2626]">5 min</span>
                    </span>
                  </div>
                  <button
                    onClick={() => onEnterSystem()}
                    className="apple-blue-pill px-5 py-2.5 text-[12px] font-normal leading-[16px] tracking-[-0.12px] shrink-0 w-full sm:w-auto text-center"
                  >
                    Ingresar al Dashboard
                  </button>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* 4. UPGRADE COMPARISON MODULE */}
          <section id="acerca" className="px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#FFFFFF]/90 backdrop-blur-sm border border-[#C8E6C9]/80 shadow-sm rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-4">
                <span className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#3B694C] block">
                  Misión y alcance del sistema
                </span>
                <h2 className="apple-section-heading text-[#0D3B1E]">
                  Precisión clínica en cada lectura ambiental.
                </h2>
                <p className="apple-body text-[#3B694C]">
                  Diseñado para aulas, laboratorios farmacéuticos, bodegas e invernaderos donde la estabilidad higrotérmica es crítica. SIMOA unifica sensores electrónicos, transmisión MQTT segura y detección de anomalías por IA.
                </p>
              </ScrollReveal>

              {/* Featured Two-Column AVIF/WebP Hardware Showcase Cards (Lazy Loaded) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
                <div className="bg-[#F2F8F4] rounded-[28px] overflow-hidden flex flex-col justify-between">
                  <div className="relative h-60 w-full overflow-hidden">
                    <OptimizedImage
                      baseName="module-lab-bioterium"
                      alt="Monitoreo de laboratorios y bioterios con sensores de precisión en formato AVIF/WebP"
                      priority={false}
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#F2F8F4] via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 apple-badge-orange">CADENA DE FRÍO · 24/7</span>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="apple-card-heading text-[#0D3B1E]">
                        Laboratorios, Invernaderos y Cámaras Frías
                      </h3>
                      <span className="text-[28px] font-semibold text-[#15803D] font-display tabular-nums">
                        4.2°C
                      </span>
                    </div>
                    <p className="text-[14px] text-[#3B694C]">
                      Supervisión ininterrumpida 24/7 con trazabilidad histórica completa y respuesta inmediata para proteger cultivos e insumos sensibles.
                    </p>
                  </div>
                </div>

                <div className="bg-[#F2F8F4] rounded-[28px] overflow-hidden flex flex-col justify-between">
                  <div className="relative h-60 w-full overflow-hidden">
                    <OptimizedImage
                      baseName="module-climate-chamber"
                      alt="Control ambiental en tiempo real con alertas automáticas"
                      priority={false}
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#F2F8F4] via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 apple-badge-orange">ALERTAS AUTOMÁTICAS</span>
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="apple-card-heading text-[#0D3B1E]">
                        Detección Temprana de Excursiones
                      </h3>
                      <span className="text-[28px] font-semibold text-[#DC2626] font-display tabular-nums">
                        +3.1σ
                      </span>
                    </div>
                    <p className="text-[14px] text-[#3B694C]">
                      Cuando una variable supera los rangos establecidos, el motor dispara alertas con debouncing y diagnóstico IA transmitido token a token.
                    </p>
                  </div>
                </div>
              </div>

              {/* Three-column Feature Metric Tiles (#F2F8F4, 28px radius, 16px padding, no shadow) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
                {aboutCapabilities.map((item, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 60}
                    lazy
                    skeleton={<SkeletonBox className="h-44" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#F2F8F4] rounded-[28px] p-[16px] h-full flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#3B694C] font-semibold uppercase tracking-[-0.12px]">
                            Telemetría SIMOA
                          </span>
                          {item.icon}
                        </div>
                        <div className={`apple-metric-display ${item.metricColor} py-1 tabular-nums`}>
                          {item.metric}
                        </div>
                        <h3 className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#0D3B1E]">
                          {item.title}
                        </h3>
                        <p className="text-[14px] leading-[1.29] tracking-[-0.224px] text-[#3B694C]">
                          {item.desc}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center gap-1.5 text-[12px] text-[#3B694C]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
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
                <span className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#15803D] block">
                  Soluciones de Monitoreo Integral
                </span>
                <h2 className="apple-section-heading text-[#0D3B1E]">
                  Seis módulos. Un ecosistema continuo.
                </h2>
                <p className="apple-body text-[#3B694C]">
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
                    <div className="bg-[#FFFFFF] border border-[#C8E6C9]/80 shadow-xs rounded-[28px] overflow-hidden flex flex-col justify-between h-full">
                      {/* Media Header */}
                      <div className="relative h-44 w-full bg-[#F2F8F4] overflow-hidden">
                        <OptimizedImage
                          baseName={mod.imageBase}
                          alt={mod.imageAlt}
                          priority={false}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#FFFFFF] via-transparent to-transparent" />
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                          <span className="text-[12px] font-semibold px-3 py-1 rounded-[980px] bg-[#FFFFFF]/95 text-[#0D3B1E] shadow-xs">
                            {mod.tag}
                          </span>
                          <span className="apple-badge-orange">{mod.highlight}</span>
                        </div>
                      </div>

                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="bg-[#F2F8F4] rounded-[28px] p-[16px] flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[12px] text-[#3B694C] block">Indicador Operativo</span>
                              <span className={`apple-metric-display ${mod.metricTone} tabular-nums`}>
                                {mod.metricValue}
                              </span>
                            </div>
                            <div className="w-11 h-11 rounded-full bg-[#FFFFFF] flex items-center justify-center">
                              {mod.icon}
                            </div>
                          </div>

                          <h3 className="apple-card-heading text-[#0D3B1E] pt-1">
                            {mod.title}
                          </h3>

                          <p className="text-[14px] leading-[1.4] tracking-[-0.224px] text-[#3B694C]">
                            {mod.desc}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#C8E6C9]/60 flex items-center justify-between">
                          <button
                            onClick={() => onEnterSystem()}
                            className="apple-inline-link text-[14px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Explorar solución</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-semibold text-[#15803D]">● En tiempo real</span>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 6. SECCIÓN DE TECNOLOGÍAS */}
          <section id="tecnologias" className="px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#FFFFFF]/90 backdrop-blur-sm border border-[#C8E6C9]/80 shadow-sm rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#3B694C] block">
                  Stack & Protocolos
                </span>
                <h2 className="apple-section-heading text-[#0D3B1E]">
                  Ingeniería abierta de grado industrial.
                </h2>
                <p className="apple-body text-[#3B694C]">
                  Estándares abiertos de baja latencia con compresión Brotli/Gzip, caché Redis, pool de conexiones co-localizado y trazabilidad OpenTelemetry.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
                {techStack.map((tech, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 80}
                    lazy
                    skeleton={<SkeletonBox className="h-56" rounded="rounded-[28px]" />}
                  >
                    <div className="bg-[#F2F8F4] rounded-[28px] p-[16px] flex flex-col justify-between h-full space-y-4">
                      <div className="space-y-2">
                        <span className="text-[12px] font-semibold text-[#3B694C] uppercase tracking-[-0.12px]">
                          {tech.category}
                        </span>
                        <h3 className="apple-card-heading text-[#0D3B1E]">
                          {tech.name}
                        </h3>
                        <p className="text-[14px] leading-[1.35] tracking-[-0.224px] text-[#3B694C]">
                          {tech.desc}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#C8E6C9]/60">
                        <span className="text-[12px] font-mono text-[#15803D] font-semibold">
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
                <span className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#3B694C] block">
                  Flujo de información secuencial
                </span>
                <h2 className="apple-section-heading text-[#0D3B1E]">
                  Del sensor al dashboard en milisegundos.
                </h2>
                <p className="apple-body text-[#3B694C]">
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
                    <div className="bg-[#FFFFFF] p-[16px] rounded-[28px] space-y-3 h-full flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-mono font-semibold text-[#3B694C]">
                            PASO {step.step}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-[#F2F8F4] flex items-center justify-center">
                            {step.icon}
                          </div>
                        </div>
                        <h4 className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#0D3B1E]">
                          {step.title}
                        </h4>
                        <p className="text-[12px] leading-[1.4] tracking-[-0.12px] text-[#3B694C]">
                          {step.desc}
                        </p>
                      </div>
                      <div className="text-[12px] text-[#1B5E20] font-semibold pt-1">
                        Etapa verificada →
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 8. SECCIÓN DE CONTACTO Y DESPLIEGUE COMERCIAL */}
          <section id="contacto" className="bg-[#E7F3EB]/80 backdrop-blur-[2px] border-t border-[#C8E6C9] text-[#0D3B1E] py-20 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#1B5E20]">
                  Atención y Despliegue Empresarial
                </span>
                <h2 className="apple-section-heading text-[#0D3B1E]">
                  Implementa SIMOA en tu operación.
                </h2>
                <p className="apple-body text-[#3B694C]">
                  Configura tu red de sensores ambientales para invernaderos, laboratorios, cámaras de frío o bodegas. Nuestro equipo especialista te asesora en la instalación y calibración.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="slide-up" delay={100}>
                <div className="bg-[#FFFFFF] border border-[#C8E6C9] shadow-sm text-[#0D3B1E] rounded-[28px] p-6 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                  {/* Columna de Información Comercial */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="space-y-3">
                      <div className="inline-block px-3 py-1.5 rounded-xl bg-[#F2F8F4] border border-[#C8E6C9]">
                        <img
                          src="/assets/images/simoa-logo.webp"
                          alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                          className="h-10 w-auto object-contain"
                        />
                      </div>
                      <span className="apple-badge-orange block w-fit">SOLUCIONES A MEDIDA</span>
                      <h3 className="apple-card-heading text-[#0D3B1E] pt-1">
                        Ecosistema de Monitoreo Ambiental
                      </h3>
                      <p className="text-[14px] leading-[1.45] tracking-[-0.224px] text-[#3B694C]">
                        Integramos nodos inalámbricos de alta precisión con transmisión segura en tiempo real, paneles analíticos y alertas predictivas.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-[16px] rounded-[20px] bg-[#F2F8F4] border border-[#C8E6C9]/60 flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[12px] text-[#3B694C] block">Variables Supervisadas</span>
                          <span className="text-[14px] font-semibold text-[#0D3B1E] block">
                            Temperatura (°C), Humedad Relativa (%RH) y Punto de Rocío
                          </span>
                        </div>
                      </div>

                      <div className="p-[16px] rounded-[20px] bg-[#F2F8F4] border border-[#C8E6C9]/60 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[12px] text-[#3B694C] block">Sectores de Aplicación</span>
                          <span className="text-[14px] font-semibold text-[#0D3B1E] block">
                            Agroindustria, Invernaderos, Laboratorios y Cadena de Frío
                          </span>
                        </div>
                      </div>

                      <div className="p-[16px] rounded-[20px] bg-[#F2F8F4] border border-[#C8E6C9]/60 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[12px] text-[#3B694C] block">Disponibilidad y Soporte</span>
                          <span className="text-[14px] font-semibold text-[#15803D] block">
                            Monitoreo continuo 24/7 con alertas instantáneas
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna de Formulario Comercial */}
                  <div className="lg:col-span-7 bg-[#F2F8F4] border border-[#C8E6C9]/70 rounded-[28px] p-6 sm:p-8 space-y-5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[#0D3B1E] flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#15803D]" />
                        <span>Solicitar Asesoría o Cotización</span>
                      </h4>
                    </div>

                    {contactSent ? (
                      <div className="p-5 rounded-[28px] bg-[#FFFFFF] border border-[#A5D6A7] text-[#15803D] text-[14px] font-semibold flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
                        <span>¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto contigo pronto.</span>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-4 text-[14px]">
                        <div>
                          <label className="block text-[12px] font-semibold text-[#265336] mb-1.5">
                            Tipo de Solución o Espacio a Monitorear
                          </label>
                          <select
                            value={contactHardwareModel}
                            onChange={(e) => setContactHardwareModel(e.target.value)}
                            className="apple-pill-select w-full py-2.5 text-[14px]"
                          >
                            <option value="ESP32-WROOM + Sensor DHT22">Invernadero / Cultivo Protegido (Temperatura y Humedad)</option>
                            <option value="ESP32-WROOM + Bosch BME280">Laboratorio Clínico o Farmacéutico (Alta Precisión)</option>
                            <option value="Gateway MQTTS + Sensirion SHT31">Cámara de Conservación / Cadena de Frío</option>
                            <option value="ESP8266 NodeMCU + DHT11">Bodega de Almacenamiento o Recinto Interior</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] font-semibold text-[#265336] mb-1.5">
                              Nombre Completo o Empresa
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Tu nombre o empresa"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              className="apple-pill-input w-full py-2.5 text-[14px] placeholder-[#4A7C59]/70"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-semibold text-[#265336] mb-1.5">
                              Correo Electrónico
                            </label>
                            <input
                              type="email"
                              required
                              placeholder="contacto@empresa.com"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="apple-pill-input w-full py-2.5 text-[14px] placeholder-[#4A7C59]/70"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[12px] font-semibold text-[#265336] mb-1.5">
                            Detalles del Proyecto
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Cuéntanos cuántos puntos de medición necesitas o las condiciones de tu espacio..."
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            className="apple-pill-input w-full py-2.5 text-[14px] placeholder-[#4A7C59]/70"
                          />
                        </div>

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                          <button
                            type="submit"
                            className="apple-blue-pill px-6 py-2.5 text-[14px] font-semibold flex items-center gap-2 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar Solicitud</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEnterSystem('dashboard')}
                            className="apple-white-outline-pill py-2.5 text-[12px] font-semibold cursor-pointer"
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

      {/* 9. FOOTER COMERCIAL */}
      <footer className="relative z-10 py-12 bg-[#FFFFFF]/95 backdrop-blur-sm border-t border-[#C8E6C9]/80 text-[12px] text-[#3B694C]">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="inline-block px-3 py-1.5 rounded-xl bg-[#F2F8F4] border border-[#C8E6C9]">
                <img
                  src="/assets/images/simoa-logo.webp"
                  alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <p className="text-[12px] text-[#3B694C] leading-relaxed">
                Sistema Inteligente de Monitoreo Ambiental con telemetría IoT en tiempo real, trazabilidad histórica y detección temprana de anomalías con Inteligencia Artificial.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-[#0D3B1E] text-[13px] block">
                Navegación
              </span>
              <ul className="space-y-1.5">
                <li><a href="#inicio" className="hover:text-[#1B5E20] transition-colors">Inicio</a></li>
                <li><a href="#acerca" className="hover:text-[#1B5E20] transition-colors">Nosotros</a></li>
                <li><a href="#funcionalidades" className="hover:text-[#1B5E20] transition-colors">Soluciones</a></li>
                <li><a href="#tecnologias" className="hover:text-[#1B5E20] transition-colors">Tecnología</a></li>
                <li><a href="#funcionamiento" className="hover:text-[#1B5E20] transition-colors">Cómo Funciona</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-[#0D3B1E] text-[13px] block">
                Soluciones Ambientales
              </span>
              <ul className="space-y-1.5 text-[#3B694C]">
                <li>Monitoreo de Invernaderos</li>
                <li>Control de Cadena de Frío</li>
                <li>Supervisión de Laboratorios</li>
                <li>Alertas Preventivas 24/7</li>
                <li>Diagnóstico con Inteligencia Artificial</li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="font-semibold text-[#0D3B1E] text-[13px] block">
                Plataforma en Línea
              </span>
              <p className="text-[12px] text-[#3B694C]">
                Accede en tiempo real al panel de control de tus sensores, alertas y reportes.
              </p>
              <button
                onClick={() => onEnterSystem('dashboard')}
                className="apple-blue-pill px-5 py-2.5 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ingresar al Sistema</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-[#C8E6C9]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#4A7C59]">
            <div>
              © 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental. Todos los derechos reservados.
            </div>
            <div className="flex items-center gap-4">
              <a href="#contacto" className="hover:text-[#1B5E20] transition-colors">Soporte Técnico</a>
              <span>·</span>
              <a href="#inicio" className="hover:text-[#1B5E20] transition-colors">Privacidad y Seguridad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EnvironmentalLandingPage;
