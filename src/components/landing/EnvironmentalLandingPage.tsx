import React, { useState, useCallback } from 'react';
import {
  Activity,
  Cpu,
  Thermometer,
  AlertTriangle,
  BrainCircuit,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Send,
  LineChart,
  Menu,
  X,
  Server,
  ShieldCheck,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { HeroSkeleton } from '../common/SkeletonLoader';
import { EnvironmentalThreeBackground } from './EnvironmentalThreeBackground';

interface EnvironmentalLandingPageProps {
  onEnterSystem: (initialTab?: string) => void;
  skeletonMode: boolean;
  onToggleSkeletonMode: () => void;
  onOpenPerformanceMonitor?: () => void;
}

export const EnvironmentalLandingPage: React.FC<EnvironmentalLandingPageProps> = ({
  onEnterSystem,
  skeletonMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

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

  const featureTabs = [
    {
      id: 'telemetry',
      label: 'Telemetría',
      eyebrow: 'FLUJO CONTINUO · MQTTS TLS 1.3',
      title: 'Supervisión térmica e higrométrica sin puntos ciegos.',
      desc: 'Visualiza lecturas de temperatura (°C) y humedad relativa (%RH) con bandas de tolerancia, cálculo de Z-Score y registro histórico listo para auditoría.',
      metricA: { label: 'TEMPERATURA MEDIA', value: '23.4 °C', delta: 'Nominal · Banda 18–26 °C' },
      metricB: { label: 'HUMEDAD RELATIVA', value: '61.8 %RH', delta: 'Estable · Banda 40–70 %' },
      metricC: { label: 'SCORE ANOMALÍA IA', value: '0.04 σ', delta: 'Isolation Forest activo' },
    },
    {
      id: 'devices',
      label: 'Nodos ESP32',
      eyebrow: 'GESTIÓN DE HARDWARE EN CAMPO',
      title: 'Control centralizado de microcontroladores y sondas.',
      desc: 'Administra direcciones MAC, latidos PINGREQ, intensidad WiFi RSSI y calibración de sensores DHT22, BME280 y SHT31 desde un solo panel.',
      metricA: { label: 'NODOS EN LÍNEA', value: '12 / 12', delta: 'Ping promedio 18 ms' },
      metricB: { label: 'SONDAS ACTIVAS', value: '24', delta: 'DHT22 · BME280 · SHT31' },
      metricC: { label: 'UPTIME MENSUAL', value: '99.94 %', delta: 'Reconexión automática' },
    },
    {
      id: 'alerts',
      label: 'Alertas 5 min',
      eyebrow: 'SEGURIDAD OPERATIVA CON DEBOUNCING',
      title: 'Notificaciones precisas sin saturación por falsos positivos.',
      desc: 'El motor anti-rebote consolida excursiones térmicas en ventanas de 5 minutos, clasifica severidad y registra la causa raíz de cada incidencia.',
      metricA: { label: 'VENTANA DEBOUNCE', value: '5 min', delta: 'Cero spam de alertas' },
      metricB: { label: 'INCIDENCIAS HOY', value: '0', delta: '100% dentro de umbral' },
      metricC: { label: 'TIEMPO DE RESPUESTA', value: '< 1.2 s', delta: 'Alerta visual y sonora' },
    },
    {
      id: 'ai',
      label: 'Diagnóstico IA',
      eyebrow: 'MACHINE LEARNING MULTIVARIANTE',
      title: 'Detecta fallos de climatización antes de perder muestras.',
      desc: 'Isolation Forest y Z-Score 3σ evalúan correlaciones anómalas entre temperatura y humedad para diagnosticar fallas en menos de 200 ms.',
      metricA: { label: 'LATENCIA INFERENCIA', value: '142 ms', delta: 'Evaluación por lectura' },
      metricB: { label: 'PRECISIÓN Z-SCORE', value: '3.0 σ', delta: 'Control estadístico' },
      metricC: { label: 'TRAMAS AISLADAS DLQ', value: '0', delta: 'Integridad JSON 100%' },
    },
  ];

  const capabilities = [
    {
      icon: <Thermometer className="w-5 h-5 text-neon-pulse" />,
      eyebrow: 'PRECISIÓN TÉRMICA',
      metric: '±0.2 °C',
      title: 'Registro de temperatura y humedad',
      desc: 'Captura periódica en recintos críticos con sondas calibradas DHT22, BME280 y SHT31.',
    },
    {
      icon: <Cpu className="w-5 h-5 text-neon-pulse" />,
      eyebrow: 'NODOS EDGE',
      metric: 'ESP32',
      title: 'Supervisión de dispositivos IoT',
      desc: 'Control de latidos PINGREQ, validación de dirección MAC y estado Online/Offline.',
    },
    {
      icon: <LineChart className="w-5 h-5 text-sky-300" />,
      eyebrow: 'SERIES TEMPORALES',
      metric: '1 Hz',
      title: 'Históricos y gráficas dinámicas',
      desc: 'Series temporales con bandas de tolerancia, umbrales configurables y exportación CSV.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-signal-yellow" />,
      eyebrow: 'SEGURIDAD OPERATIVA',
      metric: '5 min',
      title: 'Alertas con debouncing',
      desc: 'Notificaciones inmediatas ante excursiones térmicas evitando falsos positivos.',
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-neon-pulse" />,
      eyebrow: 'INTELIGENCIA ARTIFICIAL',
      metric: '<200 ms',
      title: 'Detección de anomalías',
      desc: 'Isolation Forest y Z-Score 3σ que identifican fallos antes de comprometer el recinto.',
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5 text-neon-pulse" />,
      eyebrow: 'AUDITORÍA GXP',
      metric: '99.9%',
      title: 'Trazabilidad y reportes SLA',
      desc: 'Estadísticas consolidadas (Mín, Máx, Promedio y Desviación Estándar) listas para auditoría.',
    },
  ];

  const currentFeature = featureTabs[activeFeatureTab];

  return (
    <div className="relative min-h-screen bg-obsidian-shell text-pure-white selection:bg-neon-pulse selection:text-obsidian-shell overflow-x-hidden">
      {/* Fondo 3D Interactivo con Three.js (paleta Sauce Labs: Neon Pulse, Mint Whisper, Signal Yellow) */}
      <EnvironmentalThreeBackground />

      {/* 1. ANNOUNCEMENT BANNER — Full-width Neon Pulse (#76a9ff) */}
      {showAnnouncement && (
        <div className="relative z-20 w-full bg-neon-pulse text-obsidian-shell px-6 py-2.5 text-center text-[14px] font-normal flex items-center justify-center gap-3">
          <span>
            SIMOA Consola v2.4 · Telemetría MQTTS cifrada y motor de anomalías Isolation Forest activo
          </span>
          <button
            onClick={() => setShowAnnouncement(false)}
            aria-label="Cerrar aviso"
            className="absolute right-4 p-1 rounded-full hover:bg-obsidian-shell/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. NAVIGATION BAR — Full-width Obsidian Shell (#10213d) */}
      <header className="relative z-20 bg-obsidian-shell/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          <a href="#inicio" className="flex items-center gap-3 shrink-0 focus:outline-none">
            <div className="px-3 py-1.5 rounded-[56px] bg-mint-frost flex items-center">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-normal text-pure-white">
            <a href="#modulos" className="hover:text-neon-pulse transition-colors">
              Módulos
            </a>
            <a href="#capacidades" className="hover:text-neon-pulse transition-colors">
              Capacidades
            </a>
            <a href="#arquitectura" className="hover:text-neon-pulse transition-colors">
              Arquitectura
            </a>
            <a href="#contacto" className="hover:text-neon-pulse transition-colors">
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="#contacto"
              className="hidden sm:inline-block text-[15px] font-normal text-pure-white hover:text-neon-pulse transition-colors px-2 py-1"
            >
              Solicitar demo
            </a>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="hidden sm:inline-flex sauce-btn-primary text-[15px] py-2.5 px-6 cursor-pointer items-center gap-2"
            >
              Abrir consola
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-[10px] border border-graphite-fill text-pure-white cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-deep-abyss border-t border-graphite-fill px-6 py-4 space-y-3 text-[15px]">
            {[
              { href: '#modulos', label: 'Módulos' },
              { href: '#capacidades', label: 'Capacidades' },
              { href: '#arquitectura', label: 'Arquitectura' },
              { href: '#contacto', label: 'Contacto' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1.5 text-pure-white hover:text-neon-pulse"
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onEnterSystem('dashboard');
              }}
              className="sauce-btn-primary w-full py-2.5 text-[15px] cursor-pointer"
            >
              Abrir consola
            </button>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION — Split composition on Obsidian Shell (#10213d) */}
      <section id="inicio" className="relative z-10 pt-14 pb-20 px-6">
        {skeletonMode ? (
          <div className="max-w-[1200px] mx-auto">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto space-y-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Column — Headline & CTAs */}
              <div className="space-y-6">
                <p className="sauce-eyebrow text-neon-pulse">
                  CONSOLA IOT · TELEMETRÍA AMBIENTAL EN TIEMPO REAL
                </p>
                <h1 className="sauce-display">
                  Control ambiental preciso para cada recinto crítico.
                </h1>
                <p className="text-[18px] leading-[1.45] text-pure-white/75 font-normal max-w-[520px]">
                  Supervisa nodos ESP32, analiza series de temperatura y humedad y detecta anomalías
                  térmicas con IA desde una consola unificada.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => onEnterSystem('dashboard')}
                    className="sauce-btn-primary cursor-pointer inline-flex items-center gap-2"
                  >
                    Iniciar monitoreo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href="#modulos"
                    className="sauce-btn-ghost inline-flex items-center gap-2"
                  >
                    Explorar módulos
                  </a>
                </div>
              </div>

              {/* Right Column — 3D Isometric Product Illustration */}
              <div className="flex justify-center lg:justify-end">
                <svg
                  viewBox="0 0 520 420"
                  className="w-full max-w-[500px] h-auto"
                  aria-label="Ilustración isométrica de consola SIMOA"
                >
                  {/* Isometric Base Console */}
                  <polygon points="260,385 470,275 260,165 50,275" fill="var(--color-deep-abyss)" stroke="var(--color-graphite-fill)" strokeWidth="1.5" />
                  <polygon points="50,275 260,385 260,402 50,292" fill="var(--color-charcoal)" />
                  <polygon points="470,275 260,385 260,402 470,292" fill="var(--color-obsidian-shell)" stroke="var(--color-graphite-fill)" strokeWidth="1" />

                  {/* Stacked Isometric Module 1 — Mint Frost */}
                  <polygon points="260,315 410,235 260,155 110,235" fill="var(--color-mint-frost)" />
                  <polygon points="110,235 260,315 260,330 110,250" fill="var(--color-mint-whisper)" />
                  <polygon points="410,235 260,315 260,330 410,250" fill="#a6b8d2" />

                  {/* Stacked Isometric Module 2 — Signal Yellow */}
                  <polygon points="260,245 390,176 260,107 130,176" fill="#53d5f4" />
                  <polygon points="130,176 260,245 260,258 130,189" fill="#2496bc" />
                  <polygon points="390,176 260,245 260,258 390,189" fill="#166685" />

                  {/* Stacked Isometric Module 3 — Neon Pulse */}
                  <polygon points="260,175 370,117 260,59 150,117" fill="var(--color-neon-pulse)" />
                  <polygon points="150,117 260,175 260,188 150,130" fill="#477bd4" />
                  <polygon points="370,117 260,175 260,188 370,130" fill="#284e9c" />

                  {/* Thin Connector Lines & Floating Tags */}
                  <line x1="150" y1="117" x2="75" y2="85" stroke="var(--color-mint-whisper)" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="370" y1="117" x2="445" y2="85" stroke="var(--color-neon-pulse)" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="390" y1="176" x2="455" y2="176" stroke="#53d5f4" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="110" y1="235" x2="55" y2="220" stroke="var(--color-mint-frost)" strokeWidth="1.2" strokeDasharray="4 4" />

                  {/* Floating Labels */}
                  <rect x="20" y="68" width="90" height="28" rx="14" fill="var(--color-deep-abyss)" stroke="var(--color-neon-pulse)" strokeWidth="1" />
                  <text x="65" y="86" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="500">ESP32</text>

                  <rect x="405" y="68" width="95" height="28" rx="14" fill="var(--color-deep-abyss)" stroke="var(--color-neon-pulse)" strokeWidth="1" />
                  <text x="452" y="86" textAnchor="middle" fill="var(--color-neon-pulse)" fontSize="11" fontWeight="500">MQTTS</text>

                  <rect x="415" y="162" width="90" height="28" rx="14" fill="var(--color-deep-abyss)" stroke="#53d5f4" strokeWidth="1" />
                  <text x="460" y="180" textAnchor="middle" fill="#53d5f4" fontSize="11" fontWeight="500">IA 3σ</text>

                  <rect x="12" y="206" width="88" height="28" rx="14" fill="var(--color-deep-abyss)" stroke="var(--color-mint-whisper)" strokeWidth="1" />
                  <text x="56" y="224" textAnchor="middle" fill="var(--color-mint-frost)" fontSize="11" fontWeight="500">ALERTAS</text>
                </svg>
              </div>
            </div>

            {/* 4. STAT BLOCK ROW — 4 columns directly on #10213d, no container */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-4">
              {[
                { num: '±0.2°C', label: 'PRECISIÓN DE SONDAS CALIBRADAS' },
                { num: '<200ms', label: 'DETECCIÓN DE ANOMALÍAS IA' },
                { num: '99.9%', label: 'CONFORMIDAD EN CADENA DE FRÍO' },
                { num: '1 Hz', label: 'FRECUENCIA DE TELEMETRÍA VIVA' },
              ].map((stat) => (
                <div key={stat.label} className="space-y-2">
                  <div className="sauce-stat-value">{stat.num}</div>
                  <div className="sauce-eyebrow text-pure-white/50">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 5. LOGO BAR — Dark #0a172e rounded-[60px] tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                'ESP32-WROOM',
                'DHT22 · BME280',
                'MOSQUITTO MQTTS',
                'TIMESCALEDB',
                'SCIKIT-LEARN IA',
              ].map((logo) => (
                <div
                  key={logo}
                  className="h-[104px] rounded-[60px] bg-deep-abyss flex items-center justify-center px-5 text-center"
                >
                  <span className="text-[13px] font-medium tracking-[0.05em] text-pure-white/90 uppercase">
                    {logo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 6. LIGHT CONTENT CARD (#eaf3ff Mint Frost, 60px radius) — Tab Pill Navigation + Product Preview */}
      <section id="modulos" className="relative z-10 py-16 px-6">
        <div className="max-w-[1200px] mx-auto sauce-card-mint p-8 sm:p-12 space-y-10">
          <div className="max-w-[740px] mx-auto text-center space-y-4">
            <p className="sauce-eyebrow text-obsidian-shell">
              PLATAFORMA INTEGRAL · UN SOLO PANEL DE CONTROL
            </p>
            <h2 className="sauce-heading text-obsidian-shell">
              {currentFeature.title}
            </h2>
            <p className="text-[16px] text-graphite-fill leading-[1.5]">
              {currentFeature.desc}
            </p>
          </div>

          {/* Tab Pill Navigation (56px radius pills) */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() =>
                setActiveFeatureTab((prev) => (prev - 1 + featureTabs.length) % featureTabs.length)
              }
              aria-label="Módulo anterior"
              className="p-2.5 rounded-[56px] text-graphite-fill hover:text-obsidian-shell cursor-pointer hidden sm:inline-flex"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {featureTabs.map((tab, idx) => {
              const isActive = idx === activeFeatureTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(idx)}
                  className={`px-6 py-3 rounded-[56px] text-[16px] font-normal transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-neon-pulse text-obsidian-shell font-medium'
                      : 'bg-transparent text-graphite-fill hover:text-obsidian-shell'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <button
              onClick={() => setActiveFeatureTab((prev) => (prev + 1) % featureTabs.length)}
              aria-label="Siguiente módulo"
              className="p-2.5 rounded-[56px] text-graphite-fill hover:text-obsidian-shell cursor-pointer hidden sm:inline-flex"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Embedded Product Screenshot Panel (#0a172e chrome + #ffffff screen) */}
          <div className="rounded-[20px] bg-deep-abyss p-3 sm:p-4">
            <div className="flex items-center gap-2 px-2 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-graphite-fill" />
              <span className="w-2.5 h-2.5 rounded-full bg-graphite-fill" />
              <span className="w-2.5 h-2.5 rounded-full bg-neon-pulse" />
              <span className="ml-3 text-[11px] font-mono text-slate-text">
                simoa-console.local / {currentFeature.id}
              </span>
            </div>

            <div className="rounded-[12px] bg-pure-white text-obsidian-shell p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-fog-border pb-4">
                <div>
                  <span className="sauce-eyebrow text-graphite-fill">{currentFeature.eyebrow}</span>
                  <h3 className="text-[20px] font-medium text-obsidian-shell mt-1">
                    {currentFeature.label} · Vista de Consola
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[56px] bg-mint-frost text-obsidian-shell text-[12px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-neon-pulse" />
                  Señal activa
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[currentFeature.metricA, currentFeature.metricB, currentFeature.metricC].map(
                  (m) => (
                    <div
                      key={m.label}
                      className="p-5 rounded-[20px] bg-mint-frost border border-fog-border space-y-2"
                    >
                      <div className="sauce-eyebrow text-graphite-fill">{m.label}</div>
                      <div className="text-[32px] font-medium text-obsidian-shell tabular-nums">
                        {m.value}
                      </div>
                      <div className="text-[13px] text-graphite-fill">{m.delta}</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DARK CAPABILITIES & ARCHITECTURE BAND (#10213d + #0a172e 20px cards) */}
      <section id="capacidades" className="relative z-10 py-20 px-6">
        <div className="max-w-[1200px] mx-auto space-y-12">
          <div id="arquitectura" className="max-w-[680px] space-y-4">
            <p className="sauce-eyebrow text-neon-pulse">ARQUITECTURA Y CAPACIDADES</p>
            <h2 className="sauce-heading text-pure-white">
              Ingeniería de monitoreo construida para operar sin interrupciones.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="sauce-card-dark p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="sauce-eyebrow text-pure-white/60">{cap.eyebrow}</span>
                    <div className="w-10 h-10 rounded-[10px] bg-obsidian-shell flex items-center justify-center">
                      {cap.icon}
                    </div>
                  </div>
                  <div className="text-[36px] font-medium text-neon-pulse tabular-nums">
                    {cap.metric}
                  </div>
                  <h3 className="text-[20px] font-medium text-pure-white">{cap.title}</h3>
                  <p className="text-[15px] text-slate-text leading-[1.5]">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. LIGHT CONTACT CARD (#eaf3ff Mint Frost, 60px radius) */}
      <section id="contacto" className="relative z-10 py-16 px-6">
        <div className="max-w-[1200px] mx-auto sauce-card-mint p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <p className="sauce-eyebrow text-obsidian-shell">CONTACTO TÉCNICO</p>
            <h2 className="sauce-heading text-obsidian-shell">
              Integra SIMOA con tus nodos ESP32.
            </h2>
            <p className="text-[16px] text-graphite-fill leading-[1.5]">
              Solicita una demostración o prueba el simulador de campo integrado para validar
              umbrales térmicos, alertas y reportes.
            </p>
            <div className="pt-2 space-y-3 text-[15px] text-obsidian-shell">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-obsidian-shell" />
                <span>Soporte MQTTS TLS 1.3 (Puerto 8883)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-obsidian-shell" />
                <span>Trazabilidad auditada de mediciones e incidencias</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-obsidian-shell" />
                <span>Simulador de campo integrado en la consola</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <label className="block text-[14px] font-medium text-obsidian-shell mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej. Laura Gómez"
                className="sauce-input w-full px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-[14px] font-medium text-obsidian-shell mb-1.5">
                Correo institucional
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="nombre@organizacion.org"
                className="sauce-input w-full px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-[14px] font-medium text-obsidian-shell mb-1.5">
                Hardware de interés
              </label>
              <select
                value={contactHardwareModel}
                onChange={(e) => setContactHardwareModel(e.target.value)}
                className="sauce-input w-full px-4 py-2.5"
              >
                <option>ESP32-WROOM + Sensor DHT22</option>
                <option>ESP32 + Sensor Bosch BME280</option>
                <option>Gateway Industrial + Sensirion SHT31</option>
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-medium text-obsidian-shell mb-1.5">
                Mensaje o requerimiento
              </label>
              <textarea
                rows={3}
                required
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe los recintos o variables ambientales a monitorear..."
                className="sauce-input w-full px-4 py-2.5"
              />
            </div>

            {contactSent ? (
              <div className="p-4 rounded-[10px] bg-pure-white border border-neon-pulse text-obsidian-shell text-[14px] flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-obsidian-shell" />
                Solicitud registrada correctamente. Nuestro equipo responderá pronto.
              </div>
            ) : (
              <button
                type="submit"
                className="sauce-btn-primary w-full cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar solicitud
              </button>
            )}
          </form>
        </div>
      </section>

      {/* 9. FOOTER — Deep Abyss (#0a172e) */}
      <footer className="relative z-10 bg-deep-abyss text-pure-white py-20 px-6 mt-12">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-neon-pulse" />
              <span className="text-[20px] font-medium text-pure-white">SIMOA</span>
            </div>
            <p className="text-[14px] text-slate-text max-w-[380px] leading-[1.6]">
              Sistema Inteligente de Monitoreo Ambiental IoT. Telemetría continua, gestión de nodos
              ESP32 y diagnóstico predictivo con IA.
            </p>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="sauce-eyebrow text-neon-pulse">CONSOLA</p>
            <ul className="space-y-2.5 text-slate-text">
              <li>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="hover:text-pure-white cursor-pointer"
                >
                  Monitoreo en Vivo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('devices')}
                  className="hover:text-pure-white cursor-pointer"
                >
                  Dispositivos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="hover:text-pure-white cursor-pointer"
                >
                  Histórico y CSV
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="hover:text-pure-white cursor-pointer"
                >
                  Diagnóstico IA
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="sauce-eyebrow text-neon-pulse">SISTEMA</p>
            <ul className="space-y-2.5 text-slate-text">
              <li>
                <a href="#modulos" className="hover:text-pure-white">
                  Módulos
                </a>
              </li>
              <li>
                <a href="#capacidades" className="hover:text-pure-white">
                  Capacidades
                </a>
              </li>
              <li>
                <a href="#arquitectura" className="hover:text-pure-white">
                  Arquitectura MQTTS
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-pure-white">
                  Contacto
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-14 pt-8 border-t border-graphite-fill flex flex-wrap items-center justify-between gap-4 text-[13px] text-slate-text">
          <span>© 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental</span>
          <span>Consola IoT · Luz Eliana Sánchez Tovar</span>
        </div>
      </footer>
    </div>
  );
};
