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
      icon: <LineChart className="w-5 h-5 text-[#16a34a]" />,
      eyebrow: 'SERIES TEMPORALES',
      metric: '1 Hz',
      title: 'Históricos y gráficas dinámicas',
      desc: 'Series temporales con bandas de tolerancia, umbrales configurables y exportación CSV.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-[#16a34a]" />,
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
    <div className="relative min-h-screen bg-obsidian-shell text-pure-white selection:bg-neon-pulse selection:text-white overflow-x-hidden">
      {/* Fondo interactivo agrometeorológico SIMOA */}
      <EnvironmentalThreeBackground />

      {/* ORYZO AI — Signature Vertical Edge Serial Label */}
      <div className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 z-20 oryzo-vertical-label pointer-events-none select-none text-[#4ade80]">
        SIMOA · ORYZO 1-MODEL
      </div>

      {/* 1. ANNOUNCEMENT BANNER — Fondo Invernadero Oscuro con Verde y Acento Sensor */}
      {showAnnouncement && (
        <div className="relative z-20 w-full bg-[#0d1c14] border-b border-[#1e3a2b] text-[#86efac] px-6 py-2.5 text-center text-[14px] font-medium flex items-center justify-center gap-3">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c084fc] animate-pulse" />
            SIMOA Consola v2.4 · Telemetría MQTTS cifrada y red de sensores IoT activa
          </span>
          <button
            onClick={() => setShowAnnouncement(false)}
            aria-label="Cerrar aviso"
            className="absolute right-4 p-1 rounded-full hover:bg-[#162e21] text-[#86efac] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. NAVIGATION BAR — Fondo Negro Invernadero Frío con división sutil */}
      <header className="relative z-20 bg-[#070b09]/95 border-b border-[#1e3a2b] backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          <a href="#inicio" className="flex items-center gap-3 shrink-0 focus:outline-none">
            <div className="px-3 py-1.5 rounded-[56px] bg-[#0e1713] border border-[#22c55e]/40 flex items-center">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-[#94a398]">
            <a href="#modulos" className="hover:text-[#4ade80] transition-colors">
              Módulos
            </a>
            <a href="#capacidades" className="hover:text-[#4ade80] transition-colors">
              Capacidades
            </a>
            <a href="#arquitectura" className="hover:text-[#4ade80] transition-colors">
              Arquitectura
            </a>
            <a href="#contacto" className="hover:text-[#4ade80] transition-colors">
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="#contacto"
              className="hidden sm:inline-block text-[15px] font-medium text-[#94a398] hover:text-[#4ade80] transition-colors px-2 py-1"
            >
              Soporte técnico
            </a>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="hidden sm:inline-flex sauce-btn-primary text-[15px] py-2.5 px-6 cursor-pointer items-center gap-2"
            >
              Abrir consola
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-[10px] border border-[#1e3a2b] text-[#4ade80] cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0e1713] border-t border-[#1e3a2b] px-6 py-4 space-y-3 text-[15px]">
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
                className="block py-1.5 text-[#94a398] hover:text-[#4ade80] font-medium"
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
                <p className="sauce-eyebrow text-[#4ade80] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c084fc] animate-pulse" />
                  CONSOLA IOT · INVERNADEROS INTELIGENTES Y RED DE SENSORES
                </p>
                <h1 className="sauce-display">
                  Control ambiental preciso para cada recinto crítico.
                </h1>
                <p className="text-[18px] leading-[1.45] text-[#94a398] font-normal max-w-[520px]">
                  Supervisa nodos ESP32, analiza series de temperatura y humedad con sensores calibrados
                  y detecta anomalías térmicas con IA desde una consola unificada.
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

              {/* Right Column — Ilustración de Invernadero y Sensores (Fondo Negro + Verde + Toques Moraditos) */}
              <div className="flex justify-center lg:justify-end">
                <svg
                  viewBox="0 0 520 420"
                  className="w-full max-w-[500px] h-auto"
                  aria-label="Ilustración de invernadero inteligente SIMOA con sensores IoT"
                >
                  <defs>
                    <linearGradient id="ghGlass" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#070b09" stopOpacity="0.05" />
                    </linearGradient>
                    <linearGradient id="ghSoil" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0e1713" />
                      <stop offset="50%" stopColor="#14241c" />
                      <stop offset="100%" stopColor="#0e1713" />
                    </linearGradient>
                  </defs>

                  {/* Base oscura del terreno del invernadero */}
                  <rect x="45" y="335" width="430" height="24" rx="12" fill="url(#ghSoil)" stroke="#1e3a2b" strokeWidth="1.2" />

                  {/* Estructura principal del invernadero (perfil verde brillante sobre fondo negro) */}
                  <polygon
                    points="85,335 85,185 260,88 435,185 435,335"
                    fill="url(#ghGlass)"
                    stroke="#22c55e"
                    strokeWidth="1.8"
                  />

                  {/* Vigas y marcos estructurales en verde botánico */}
                  <line x1="85" y1="185" x2="435" y2="185" stroke="#16a34a" strokeWidth="1.5" />
                  <line x1="172" y1="136" x2="172" y2="335" stroke="#16a34a" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="260" y1="88" x2="260" y2="335" stroke="#22c55e" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="348" y1="136" x2="348" y2="335" stroke="#16a34a" strokeWidth="1.2" strokeDasharray="4 4" />

                  {/* Camas de cultivo hidropónico y brotes en verde vivo */}
                  <rect x="112" y="302" width="120" height="20" rx="6" fill="#0e1713" stroke="#22c55e" strokeWidth="1.2" />
                  <rect x="288" y="302" width="120" height="20" rx="6" fill="#0e1713" stroke="#22c55e" strokeWidth="1.2" />

                  {/* Plantas / hojas estilizadas dentro del invernadero */}
                  {[135, 172, 209, 311, 348, 385].map((px, idx) => (
                    <g key={px}>
                      <line x1={px} y1="302" x2={px} y2={252 - (idx % 2) * 10} stroke="#22c55e" strokeWidth="2" />
                      <ellipse
                        cx={px - 11}
                        cy={272 - (idx % 2) * 8}
                        rx="12"
                        ry="6"
                        transform={`rotate(-28 ${px - 11} ${272 - (idx % 2) * 8})`}
                        fill="#4ade80"
                        fillOpacity="0.9"
                      />
                      <ellipse
                        cx={px + 11}
                        cy={264 - (idx % 2) * 8}
                        rx="12"
                        ry="6"
                        transform={`rotate(28 ${px + 11} ${264 - (idx % 2) * 8})`}
                        fill="#86efac"
                        fillOpacity="0.85"
                      />
                    </g>
                  ))}

                  {/* Puntos sensores IoT en zonas del invernadero (Toques moraditos que representan los sensores) */}
                  <circle cx="172" cy="215" r="5" fill="#c084fc" />
                  <circle cx="172" cy="215" r="12" fill="none" stroke="#a855f7" strokeOpacity="0.6" strokeWidth="1.6" />
                  <circle cx="172" cy="215" r="2" fill="#ffffff" />

                  <circle cx="348" cy="215" r="5" fill="#c084fc" />
                  <circle cx="348" cy="215" r="12" fill="none" stroke="#a855f7" strokeOpacity="0.6" strokeWidth="1.6" />
                  <circle cx="348" cy="215" r="2" fill="#ffffff" />

                  <circle cx="260" cy="145" r="5" fill="#c084fc" />
                  <circle cx="260" cy="145" r="12" fill="none" stroke="#a855f7" strokeOpacity="0.6" strokeWidth="1.6" />
                  <circle cx="260" cy="145" r="2" fill="#ffffff" />

                  {/* Líneas conectoras finas hacia etiquetas ambientales (Moraditas de telemetría de sensores) */}
                  <line x1="172" y1="215" x2="72" y2="122" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="348" y1="215" x2="442" y2="122" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="260" y1="145" x2="260" y2="48" stroke="#22c55e" strokeWidth="1.2" strokeDasharray="4 4" />
                  <line x1="112" y1="312" x2="64" y2="270" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="4 4" />

                  {/* Etiquetas de sensores y zonas ambientales */}
                  <rect x="14" y="96" width="134" height="30" rx="15" fill="#1b102b" stroke="#a855f7" strokeWidth="1.2" />
                  <text x="81" y="115" textAnchor="middle" fill="#d8b4fe" fontSize="11" fontWeight="600" fontFamily="monospace">SENSOR DHT22 · 23.4°C</text>

                  <rect x="370" y="96" width="138" height="30" rx="15" fill="#1b102b" stroke="#a855f7" strokeWidth="1.2" />
                  <text x="439" y="115" textAnchor="middle" fill="#d8b4fe" fontSize="11" fontWeight="600" fontFamily="monospace">SENSOR BME280 · 68%</text>

                  <rect x="180" y="20" width="160" height="30" rx="15" fill="#0e1713" stroke="#22c55e" strokeWidth="1.2" />
                  <text x="260" y="39" textAnchor="middle" fill="#4ade80" fontSize="11" fontWeight="600">INVERNADERO ACTIVO</text>

                  <rect x="10" y="244" width="130" height="30" rx="15" fill="#1b102b" stroke="#a855f7" strokeWidth="1.2" />
                  <text x="75" y="263" textAnchor="middle" fill="#d8b4fe" fontSize="11" fontWeight="600" fontFamily="monospace">NODO ESP32 · OK</text>
                </svg>
              </div>
            </div>

            {/* 4. STAT BLOCK ROW — 4 columnas sobre fondo negro */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-4">
              {[
                { num: '±0.2°C', label: 'PRECISIÓN DE SONDAS CALIBRADAS' },
                { num: '<200ms', label: 'DETECCIÓN DE ANOMALÍAS IA' },
                { num: '99.9%', label: 'CONFORMIDAD EN CADENA DE FRÍO' },
                { num: '1 Hz', label: 'FRECUENCIA DE TELEMETRÍA VIVA' },
              ].map((stat) => (
                <div key={stat.label} className="space-y-2">
                  <div className="sauce-stat-value">{stat.num}</div>
                  <div className="sauce-eyebrow text-[#94a398]">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 5. LOGO BAR — Cajas redondeadas en fondo oscuro con toques moraditos para sensores */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { name: 'ESP32-WROOM', isSensor: true },
                { name: 'DHT22 · BME280', isSensor: true },
                { name: 'MOSQUITTO MQTTS', isSensor: false },
                { name: 'TIMESCALEDB', isSensor: false },
                { name: 'SCIKIT-LEARN IA', isSensor: false },
              ].map((logo) => (
                <div
                  key={logo.name}
                  className={`h-[104px] rounded-[60px] flex items-center justify-center px-5 text-center transition-colors ${
                    logo.isSensor
                      ? 'bg-[#1b102b] border border-[#a855f7]/60 text-[#c084fc] shadow-[0_0_15px_rgba(168,85,247,0.12)]'
                      : 'bg-[#0e1713] border border-[#1e3a2b] text-[#86efac]'
                  }`}
                >
                  <span className="text-[13px] font-semibold tracking-[0.05em] uppercase">
                    {logo.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ORYZO AI — Hairline Dashed Divider */}
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="oryzo-divider" />
      </div>

      {/* 6. LIGHT CONTENT CARD (#0e1713 Invernadero Oscuro) — Tab Pill Navigation + Product Preview */}
      <section id="modulos" className="relative z-10 py-16 px-6">
        <div className="max-w-[1200px] mx-auto sauce-card-mint p-8 sm:p-12 space-y-10">
          <div className="max-w-[740px] mx-auto text-center space-y-4">
            <p className="sauce-eyebrow text-[#4ade80]">
              PLATAFORMA INTEGRAL · UN SOLO PANEL DE CONTROL
            </p>
            <h2 className="sauce-heading text-white">
              {currentFeature.title}
            </h2>
            <p className="text-[16px] text-[#94a398] leading-[1.5]">
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
              className="p-2.5 rounded-[56px] text-[#94a398] hover:text-white cursor-pointer hidden sm:inline-flex"
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
                      ? 'bg-[#22c55e] text-[#070b09] font-semibold shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      : 'bg-[#0e1713] text-[#94a398] hover:text-[#4ade80] border border-[#1e3a2b]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <button
              onClick={() => setActiveFeatureTab((prev) => (prev + 1) % featureTabs.length)}
              aria-label="Siguiente módulo"
              className="p-2.5 rounded-[56px] text-[#94a398] hover:text-[#4ade80] cursor-pointer hidden sm:inline-flex"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Embedded Product Screenshot Panel — Chrome oscuro + toques moraditos */}
          <div className="rounded-[20px] bg-[#0a0f0d] border border-[#1e3a2b] p-3 sm:p-4">
            <div className="flex items-center gap-2 px-2 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc]" />
              <span className="ml-3 text-[11px] font-mono text-[#86efac] font-semibold">
                simoa-console.local / {currentFeature.id}
              </span>
            </div>

            <div className="rounded-[12px] bg-[#070b09] text-white p-6 sm:p-8 space-y-6 border border-[#1e3a2b]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1e3a2b] pb-4">
                <div>
                  <span className="sauce-eyebrow text-[#4ade80]">{currentFeature.eyebrow}</span>
                  <h3 className="text-[20px] font-medium text-white mt-1">
                    {currentFeature.label} · Vista de Consola
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[56px] bg-[#122419] border border-[#22c55e]/50 text-[#4ade80] text-[12px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  Señal activa
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[currentFeature.metricA, currentFeature.metricB, currentFeature.metricC].map(
                  (m) => (
                    <div
                      key={m.label}
                      className="p-5 rounded-[20px] bg-[#0e1713] border border-[#1e3a2b] space-y-2"
                    >
                      <div className="sauce-eyebrow text-[#4ade80]">{m.label}</div>
                      <div className="text-[32px] font-medium text-[#22c55e] tabular-nums">
                        {m.value}
                      </div>
                      <div className="text-[13px] text-[#94a398]">{m.delta}</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ORYZO AI — Hairline Dashed Divider */}
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="oryzo-divider" />
      </div>

      {/* 7. CAPACIDADES & ARQUITECTURA */}
      <section id="capacidades" className="relative z-10 py-20 px-6">
        <div className="max-w-[1200px] mx-auto space-y-12">
          <div id="arquitectura" className="max-w-[680px] space-y-4">
            <p className="sauce-eyebrow text-[#4ade80]">ARQUITECTURA Y CAPACIDADES</p>
            <h2 className="sauce-heading text-white">
              Ingeniería de monitoreo construida para operar sin interrupciones.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="sauce-card-dark p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="sauce-eyebrow text-[#4ade80]">{cap.eyebrow}</span>
                    <div className="w-10 h-10 rounded-[10px] bg-[#132219] text-[#22c55e] flex items-center justify-center">
                      {cap.icon}
                    </div>
                  </div>
                  <div className="text-[36px] font-medium text-[#22c55e] tabular-nums">
                    {cap.metric}
                  </div>
                  <h3 className="text-[20px] font-medium text-white">{cap.title}</h3>
                  <p className="text-[15px] text-[#94a398] leading-[1.5]">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORYZO AI — Hairline Dashed Divider */}
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="oryzo-divider" />
      </div>

      {/* 8. CONTACT CARD */}
      <section id="contacto" className="relative z-10 py-16 px-6">
        <div className="max-w-[1200px] mx-auto sauce-card-mint p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <p className="sauce-eyebrow text-[#4ade80]">CONTACTO TÉCNICO</p>
            <h2 className="sauce-heading text-white">
              Integra SIMOA con tus nodos ESP32.
            </h2>
            <p className="text-[16px] text-[#94a398] leading-[1.5]">
              Solicita una demostración o prueba el simulador de campo integrado para validar
              umbrales térmicos, alertas y reportes.
            </p>
            <div className="pt-2 space-y-3 text-[15px] text-[#d1dcd4]">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-[#22c55e]" />
                <span>Soporte MQTTS TLS 1.3 (Puerto 8883)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                <span>Trazabilidad auditada de mediciones e incidencias</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-[#c084fc]" />
                <span>Simulador de campo y red de sensores IoT</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <label className="block text-[14px] font-medium text-[#d1dcd4] mb-1.5">
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
              <label className="block text-[14px] font-medium text-[#d1dcd4] mb-1.5">
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
              <label className="block text-[14px] font-medium text-[#d1dcd4] mb-1.5 flex items-center justify-between">
                <span>Hardware de interés</span>
                <span className="text-[11px] font-mono text-[#c084fc]">Sondas &amp; Sensores</span>
              </label>
              <select
                value={contactHardwareModel}
                onChange={(e) => setContactHardwareModel(e.target.value)}
                className="sauce-input w-full px-4 py-2.5 bg-[#0e1713] text-white border-b border-[#1e3a2b]"
              >
                <option className="bg-[#0e1713] text-white">ESP32-WROOM + Sensor DHT22</option>
                <option className="bg-[#0e1713] text-white">ESP32 + Sensor Bosch BME280</option>
                <option className="bg-[#0e1713] text-white">Gateway Industrial + Sensirion SHT31</option>
              </select>
            </div>
            <div>
              <label className="block text-[14px] font-medium text-[#d1dcd4] mb-1.5">
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
              <div className="p-4 rounded-[10px] bg-[#122419] border border-[#22c55e] text-[#86efac] text-[14px] flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
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

      {/* 9. FOOTER — Fondo Negro Invernadero */}
      <footer className="relative z-10 bg-[#050806] text-[#94a398] border-t border-[#1e3a2b] py-20 px-6 mt-12">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="text-[20px] font-medium text-white">SIMOA</span>
            </div>
            <p className="text-[14px] text-[#94a398] max-w-[380px] leading-[1.6]">
              Sistema Inteligente de Monitoreo Ambiental IoT. Telemetría continua, gestión de nodos
              ESP32 y diagnóstico predictivo con IA.
            </p>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="sauce-eyebrow text-[#4ade80]">CONSOLA</p>
            <ul className="space-y-2.5 text-[#94a398]">
              <li>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="hover:text-[#4ade80] cursor-pointer"
                >
                  Monitoreo en Vivo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('devices')}
                  className="hover:text-[#4ade80] cursor-pointer"
                >
                  Dispositivos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="hover:text-[#4ade80] cursor-pointer"
                >
                  Histórico y CSV
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="hover:text-[#4ade80] cursor-pointer"
                >
                  Diagnóstico IA
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="sauce-eyebrow text-[#4ade80]">SISTEMA</p>
            <ul className="space-y-2.5 text-[#94a398]">
              <li>
                <a href="#modulos" className="hover:text-[#4ade80]">
                  Módulos
                </a>
              </li>
              <li>
                <a href="#capacidades" className="hover:text-[#4ade80]">
                  Capacidades
                </a>
              </li>
              <li>
                <a href="#arquitectura" className="hover:text-[#4ade80]">
                  Arquitectura MQTTS
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-[#4ade80]">
                  Contacto
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-14 pt-8 border-t border-[#1e3a2b] flex flex-wrap items-center justify-between gap-4 text-[13px] text-[#64748b]">
          <span>© 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental</span>
          <span>Consola IoT · Luz Eliana Sánchez Tovar</span>
        </div>
      </footer>
    </div>
  );
};
