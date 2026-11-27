import React, { useState, useCallback, useEffect } from 'react';
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
  LineChart,
  ArrowUp,
  ShieldCheck,
  MapPin,
  Clock,
} from 'lucide-react';
import { ScrollReveal } from '../../hooks/useScrollAnimation';
import { HeroSkeleton, CardGridSkeleton, FlowSequenceSkeleton, SkeletonBox } from '../common/SkeletonLoader';
import { OptimizedImage } from '../common/OptimizedImage';

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
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY >= 320);
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    return () => window.removeEventListener('scroll', updateBackToTop);
  }, []);

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

  // Tarjetas de telemetría de la sección Acerca del Sistema
  const aboutCapabilities = [
    {
      icon: <Thermometer className="w-5 h-5" />,
      metric: '±0.2 °C',
      title: 'Temperatura y humedad',
      desc: 'Lecturas continuas con sensores calibrados.',
    },
    {
      icon: <Cpu className="w-5 h-5" />,
      metric: 'ESP32',
      title: 'Dispositivos IoT',
      desc: 'Consulta si tus dispositivos están conectados.',
    },
    {
      icon: <LineChart className="w-5 h-5" />,
      metric: '100%',
      title: 'Historial de lecturas',
      desc: 'Consulta los registros guardados.',
    },
    {
      icon: <Activity className="w-5 h-5" />,
      metric: '1 Hz',
      title: 'Gráficas en vivo',
      desc: 'Sigue los cambios de temperatura y humedad.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      metric: '5 min',
      title: 'Alertas sin duplicados',
      desc: 'Recibe un aviso si una lectura sale del rango.',
    },
    {
      icon: <BrainCircuit className="w-5 h-5" />,
      metric: '<200 ms',
      title: 'Detección con IA',
      desc: 'Identifica lecturas fuera de lo habitual.',
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
      desc: 'Recibe avisos cuando una lectura sale del rango y consulta quién atendió cada alerta. El sistema evita repetir el mismo aviso en un periodo de cinco minutos.',
      highlight: 'Aviso sonoro y control de repetición',
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
      icon: <Thermometer className="w-4 h-4" />,
    },
    {
      step: '02',
      title: 'Nodo ESP32',
      desc: 'El microcontrolador digitaliza señales y empaqueta la telemetría en JSON ligero.',
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      step: '03',
      title: 'Broker Mosquitto',
      desc: 'Transmisión cifrada MQTTS TLS 1.3 sobre puerto 8883 con garantía QoS 1.',
      icon: <Server className="w-4 h-4" />,
    },
    {
      step: '04',
      title: 'Node-RED Engine',
      desc: 'Valida la integridad del paquete JSON; si está corrupto lo aísla en la cola DLQ.',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      step: '05',
      title: 'Motor Python e IA',
      desc: 'FastAPI almacena en TimescaleDB y ejecuta Isolation Forest en <200ms.',
      icon: <BrainCircuit className="w-4 h-4" />,
    },
    {
      step: '06',
      title: 'Dashboard en Vivo',
      desc: 'La interfaz actualiza gráficas, indicadores y alertas críticas al instante.',
      icon: <Activity className="w-4 h-4" />,
    },
  ];

  return (
    <div id="inicio" tabIndex={-1} className="relative min-h-screen bg-garden-paper text-garden-deep selection:bg-garden-leaf selection:text-garden-deep overflow-x-clip">
      {/* BARRA DE NAVEGACIÓN PRINCIPAL UNIFICADA Y PROFESIONAL */}
      <header className="sticky top-0 z-50 border-b border-garden-border bg-garden-paper/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between gap-3 sm:gap-6">
          {/* Logo Oficial SIMOA */}
          <a
            href="#inicio"
            className="flex items-center gap-3 shrink-0 rounded-lg group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest"
          >
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-10 sm:h-12 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </a>

          <nav aria-label="Navegación principal" className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a
              href="#contacto"
              className="rounded-xl border border-garden-edge bg-garden-leaf px-2.5 py-2 text-xs font-bold text-garden-deep transition-colors hover:bg-garden-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Contacto
            </a>
            <button
              type="button"
              onClick={() => onEnterSystem('dashboard')}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-brand-forest bg-brand-forest px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-canopy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Ingresar al Sistema
              <ArrowRight className="hidden size-4 text-garden-leaf sm:block" aria-hidden="true" />
            </button>
          </nav>
        </div>
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
        <main className="relative z-10 space-y-8 sm:space-y-14">
          <section aria-labelledby="simoa-hero-title">
            <div className="relative flex min-h-[560px] flex-col overflow-hidden bg-garden-deep text-white sm:min-h-[630px] lg:min-h-[650px]">
              <img
                src="/assets/images/simoa-greenhouse.webp"
                alt="Sensor ambiental entre las plantas de un invernadero"
                width={1720}
                height={717}
                fetchPriority="high"
                className="simoa-garden-hero-image absolute inset-0 size-full object-cover"
              />
              <div className="simoa-garden-hero-shade absolute inset-0" aria-hidden="true" />

              <div className="relative flex w-full flex-1 flex-col justify-between gap-10 px-5 pt-9 sm:px-10 sm:pt-12 lg:px-[6vw] lg:pt-14">
                <div className="max-w-[57rem]">
                  <h1 id="simoa-hero-title" className="text-[clamp(3rem,8vw,7.5rem)] font-bold leading-[0.98] tracking-[-0.045em] text-white">
                    Monitoreo ambiental inteligente.
                  </h1>
                  <p className="mt-6 max-w-lg text-base leading-relaxed text-garden-mint sm:text-lg">
                    Consulta la temperatura y la humedad desde un solo panel y recibe avisos cuando una lectura salga del rango esperado.
                  </p>
                </div>

                <ul className="grid gap-4 border-t border-white/35 py-6 text-sm font-semibold text-garden-mint sm:grid-cols-3 sm:gap-6 sm:py-8">
                  <li className="flex items-center gap-2.5"><Thermometer className="size-5 text-garden-leaf" aria-hidden="true" /> Temperatura y humedad en vivo</li>
                  <li className="flex items-center gap-2.5"><LineChart className="size-5 text-garden-leaf" aria-hidden="true" /> Historial de lecturas</li>
                  <li className="flex items-center gap-2.5"><AlertTriangle className="size-5 text-garden-leaf" aria-hidden="true" /> Alertas fuera de rango</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="acerca" aria-labelledby="simoa-about-title" className="scroll-mt-24 px-4 sm:px-6">
            <div className="mx-auto grid max-w-7xl gap-8 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:px-6 lg:py-14">
              <ScrollReveal animation="slide-up" className="space-y-6">
                <div className="space-y-3">
                  <span className="inline-block rounded-full border border-garden-border bg-garden-mint px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-forest">
                    Dónde se usa SIMOA
                  </span>
                  <h2 id="simoa-about-title" className="max-w-[22ch] text-[clamp(1.8rem,4.2vw,3.35rem)] font-bold leading-[1.08] tracking-tight text-garden-deep">
                    Conoce las condiciones de cada espacio.
                  </h2>
                  <p className="max-w-prose text-base leading-relaxed text-slate">
                    SIMOA reúne en un solo lugar las lecturas de invernaderos, laboratorios y cámaras de frío. Así puedes consultar el historial y atender a tiempo los cambios de temperatura y humedad.
                  </p>
                </div>

                <ul className="landing-card-grid grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:gap-4">
                  {aboutCapabilities.map((item) => (
                    <li key={item.title}>
                      <div className="landing-card flex h-full flex-col gap-2 rounded-2xl border px-4 py-3.5 shadow-sm lg:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="landing-card-accent font-display text-2xl font-bold tabular-nums">{item.metric}</span>
                          <span className="landing-card-chip grid size-8 shrink-0 place-items-center rounded-lg border" aria-hidden="true">
                            {item.icon}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold leading-snug sm:text-base">{item.title}</h3>
                        <p className="landing-card-description text-sm leading-snug">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>

              <div className="grid gap-4 md:auto-rows-fr">
                <figure className="flex flex-col overflow-hidden rounded-2xl border border-garden-border bg-garden-mint shadow-sm">
                  <div className="relative min-h-44 flex-1 sm:min-h-52">
                    <OptimizedImage
                      baseName="module-lab-bioterium"
                      alt="Equipo de monitoreo ambiental en un laboratorio"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-garden-mint px-3 py-1 text-xs font-bold text-garden-deep">
                      Cadena de frío 24/7
                    </span>
                  </div>
                  <figcaption className="space-y-1 px-5 py-4">
                    <h3 className="text-base font-bold leading-snug text-garden-deep">Laboratorios, invernaderos y cámaras de frío</h3>
                    <p className="text-sm leading-relaxed text-slate">Consulta las lecturas y su historial para cuidar cultivos e insumos sensibles.</p>
                  </figcaption>
                </figure>

                <figure className="flex flex-col overflow-hidden rounded-2xl border border-garden-border bg-garden-mint shadow-sm">
                  <div className="relative min-h-44 flex-1 sm:min-h-52">
                    <OptimizedImage
                      baseName="module-climate-chamber"
                      alt="Personal trabajando en un espacio con monitoreo ambiental"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-brand-forest px-3 py-1 text-xs font-bold text-white">
                      Alertas automáticas
                    </span>
                  </div>
                  <figcaption className="space-y-1 px-5 py-4">
                    <h3 className="text-base font-bold leading-snug text-garden-deep">Detección de cambios fuera de rango</h3>
                    <p className="text-sm leading-relaxed text-slate">Recibe un aviso y consulta el diagnóstico de IA para entender qué pasó.</p>
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          {/* 5. FEATURE MEDIA CARDS */}
          <section id="funcionalidades" className="scroll-mt-24 bg-garden-deep px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-7xl mx-auto space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#15803D] bg-[#e8f5e9] border border-[#86efac] px-3.5 py-1 rounded-full inline-block">
                  Soluciones de Monitoreo Integral
                </span>
                <h2 className="text-[28px] sm:text-[40px] font-bold text-white tracking-tight leading-tight">
                  Seis módulos. Un ecosistema continuo.
                </h2>
                <p className="text-[16px] text-garden-mint leading-relaxed">
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
                      <div className="relative h-44 w-full bg-garden-deep overflow-hidden">
                        <OptimizedImage
                          baseName={mod.imageBase}
                          alt={mod.imageAlt}
                          priority={false}
                          className="w-full h-full object-cover opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-garden-deep/70 via-transparent to-transparent" />
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-garden-deep text-[#86efac] border border-[#166534] shadow-xs">
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
                          <div className="bg-garden-deep text-white rounded-[22px] p-4 border border-[#1f2922] shadow-sm flex items-center justify-between">
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
                            <div className="w-11 h-11 rounded-full bg-brand-forest border border-garden-leaf/30 flex items-center justify-center text-[#4ade80] shadow-xs">
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

          {/* 6. SECCIÓN DE TECNOLOGÍAS */}
          <section id="tecnologias" className="scroll-mt-24 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#FFFFFF] border border-[#0d1310]/15 shadow-sm rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-4">
                <span className="text-[13px] font-bold uppercase tracking-wider text-brand-forest bg-cream-paper border border-sage-mist/45 px-3.5 py-1 rounded-full inline-block">
                  Tecnologías y comunicación
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Ingeniería abierta de grado industrial.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed max-w-3xl">
                  Estas tecnologías permiten recibir, procesar y guardar las lecturas de los sensores antes de mostrarlas en el panel.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px] landing-card-grid">
                {techStack.map((tech, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="slide-up"
                    delay={idx * 80}
                    lazy
                    skeleton={<SkeletonBox className="h-56" rounded="rounded-[28px]" />}
                  >
                    <div className="landing-card border shadow-sm rounded-[24px] p-6 flex flex-col justify-between h-full space-y-4 transition-all">
                      <div className="space-y-2">
                        <span className="landing-card-accent text-[12px] font-bold uppercase tracking-wider">
                          {tech.category}
                        </span>
                        <h3 className="text-[20px] font-bold">
                          {tech.name}
                        </h3>
                        <p className="text-[14px] leading-relaxed landing-card-description">
                          {tech.desc}
                        </p>
                      </div>
                      <div className="landing-card-divider pt-3 border-t">
                        <span className="landing-card-chip text-[12px] font-mono font-semibold border px-3 py-1 rounded-full inline-block">
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
          <section id="funcionamiento" className="scroll-mt-24 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto bg-[#FFFFFF] border border-[#0d1310]/15 shadow-sm rounded-[28px] p-6 sm:p-12 lg:p-16 space-y-10">
              <ScrollReveal animation="slide-up" className="max-w-3xl space-y-3">
                <span className="text-[13px] font-bold uppercase tracking-wider text-brand-forest bg-garden-mint border border-garden-border px-3.5 py-1 rounded-full inline-block">
                  Cómo viajan los datos
                </span>
                <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0d1310] tracking-tight leading-tight">
                  Del sensor al panel de monitoreo.
                </h2>
                <p className="text-[16px] text-[#1e293b] leading-relaxed">
                  Sigue el recorrido de una lectura desde el sensor hasta el panel y mira en qué momento se genera una alerta.
                </p>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1200px]:grid-cols-6 gap-[16px] landing-card-grid">
                {pipelineSteps.map((step, idx) => (
                  <ScrollReveal
                    key={idx}
                    animation="scale-in"
                    delay={idx * 70}
                    lazy
                    skeleton={<SkeletonBox className="h-44" rounded="rounded-[28px]" />}
                  >
                    <div className="landing-card border shadow-sm rounded-[24px] p-5 space-y-3 h-full flex flex-col justify-between transition-all">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="landing-card-chip text-[11px] font-mono font-bold border px-2.5 py-0.5 rounded-full">
                            PASO {step.step}
                          </span>
                          <div className="landing-card-chip w-8 h-8 rounded-xl border flex items-center justify-center shrink-0">
                            {step.icon}
                          </div>
                        </div>
                        <h4 className="text-[16px] font-bold">
                          {step.title}
                        </h4>
                        <p className="text-[13px] leading-relaxed landing-card-description">
                          {step.desc}
                        </p>
                      </div>
                      <div className="landing-card-accent text-[12px] font-bold pt-1 flex items-center gap-1">
                        <span>Etapa verificada</span>
                        <span>→</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>

          {/* 8. SECCIÓN DE CONTACTO Y DESPLIEGUE COMERCIAL */}
          <section id="contacto" className="scroll-mt-24 bg-garden-mint backdrop-blur-[2px] border-t border-garden-border text-[#0D3B1E] py-20 px-4 sm:px-6">
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
                      <div className="inline-block px-3 py-1.5 rounded-xl bg-[#e4f0e7] border border-[#a9c4b2]">
                        <img
                          src="/assets/images/simoa-logo.webp"
                          alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                          className="h-10 w-auto object-contain"
                        />
                      </div>
                      <span className="px-3 py-1 rounded-full bg-garden-mint text-brand-forest border border-garden-border text-[12px] font-semibold tracking-wide shadow-xs block w-fit">
                        SOLUCIONES A MEDIDA
                      </span>
                      <h3 className="text-[22px] font-bold text-brand-forest pt-1">
                        Ecosistema de Monitoreo Ambiental
                      </h3>
                      <p className="text-[14px] leading-relaxed text-[#1e293b]">
                        Integramos nodos inalámbricos de alta precisión con transmisión segura en tiempo real, paneles analíticos y alertas predictivas.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 rounded-[20px] bg-brand-forest text-white border border-brand-forest flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center text-[#d6ecdd] shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#d6ecdd] block">
                            Variables Supervisadas
                          </span>
                          <span className="text-[14px] font-semibold text-white block">
                            Temperatura (°C), Humedad Relativa (%RH) y Punto de Rocío
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-[20px] bg-garden-mint text-brand-forest border border-garden-border flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/70 border border-garden-border flex items-center justify-center text-brand-forest shrink-0">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-forest block">
                            Sectores de Aplicación
                          </span>
                          <span className="text-[14px] font-semibold text-bark block">
                            Agroindustria, Invernaderos, Laboratorios y Cadena de Frío
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-[20px] bg-garden-sage text-garden-deep border border-garden-border flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-white/60 border border-garden-border flex items-center justify-center text-garden-deep shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-garden-deep block">
                            Disponibilidad y Soporte
                          </span>
                          <span className="text-[14px] font-semibold text-bark block">
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
                            className="px-8 py-3.5 text-[14px] font-bold leading-tight flex items-center gap-2.5 cursor-pointer rounded-full bg-brand-forest text-white hover:bg-canopy shadow-[0_4px_16px_rgba(13,19,16,0.3)] border border-[#1f2922] transition-all"
                          >
                            <span>Enviar Solicitud</span>
                            <Send className="w-4 h-4 text-[#4ade80]" />
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

      {showBackToTop && (
        <a
          href="#inicio"
          aria-label="Volver arriba"
          title="Volver arriba"
          className="fixed right-4 bottom-4 z-50 grid size-12 place-items-center rounded-full border border-brand-forest bg-garden-leaf text-garden-deep shadow-lg transition-colors hover:bg-garden-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest sm:right-6 sm:bottom-6"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </a>
      )}

      {/* 9. FOOTER COMERCIAL DE ALTO CONTRASTE */}
      <footer className="relative z-10 py-12 bg-garden-deep border-t border-brand-forest text-[13px] text-garden-mint">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="inline-block px-3 py-1.5 rounded-xl bg-garden-mint border border-garden-border">
                <img
                  src="/assets/images/simoa-logo.webp"
                  alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <p className="text-[12px] text-garden-mint leading-relaxed">
                SIMOA muestra las lecturas de tus sensores, guarda su historial y te avisa cuando detecta cambios fuera de lo esperado.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-white text-[13px] block uppercase tracking-wider">
                Navegación
              </span>
              <ul className="space-y-1.5 font-medium text-garden-mint">
                <li><a href="#inicio" className="hover:text-garden-leaf transition-colors">Inicio</a></li>
                <li><a href="#acerca" className="hover:text-garden-leaf transition-colors">Nosotros</a></li>
                <li><a href="#funcionalidades" className="hover:text-garden-leaf transition-colors">Soluciones</a></li>
                <li><a href="#tecnologias" className="hover:text-garden-leaf transition-colors">Tecnología</a></li>
                <li><a href="#funcionamiento" className="hover:text-garden-leaf transition-colors">Cómo Funciona</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-white text-[13px] block uppercase tracking-wider">
                Soluciones Ambientales
              </span>
              <ul className="space-y-1.5 text-garden-mint font-medium">
                <li>Monitoreo de Invernaderos</li>
                <li>Control de Cadena de Frío</li>
                <li>Supervisión de Laboratorios</li>
                <li>Alertas Preventivas 24/7</li>
                <li>Diagnóstico con Inteligencia Artificial</li>
              </ul>
            </div>

          </div>

          <div className="pt-6 border-t border-white/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-garden-mint font-medium">
            <div>
              © 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental. Todos los derechos reservados.
            </div>
            <div className="flex items-center gap-4">
              <a href="#contacto" className="hover:text-garden-leaf transition-colors">Soporte Técnico</a>
              <span>·</span>
              <a href="#inicio" className="hover:text-garden-leaf transition-colors">Privacidad y Seguridad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EnvironmentalLandingPage;
