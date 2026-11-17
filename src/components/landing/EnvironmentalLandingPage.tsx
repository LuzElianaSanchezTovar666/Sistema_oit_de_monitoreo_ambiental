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
  ArrowUpRight,
  ArrowDownRight,
  Server,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { HeroSkeleton, CardGridSkeleton } from '../common/SkeletonLoader';
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

  const capabilities = [
    {
      icon: <Thermometer className="w-5 h-5 text-canopy" />,
      eyebrow: 'PRECISIÓN TÉRMICA',
      metric: '±0.2 °C',
      title: 'Registro continuo de temperatura y humedad',
      desc: 'Captura periódica en recintos críticos con sondas calibradas DHT22, BME280 y SHT31.',
    },
    {
      icon: <Cpu className="w-5 h-5 text-canopy" />,
      eyebrow: 'NODOS EDGE',
      metric: 'ESP32',
      title: 'Supervisión de dispositivos IoT en red',
      desc: 'Control de latidos PINGREQ, validación de dirección MAC y estado Online/Offline.',
    },
    {
      icon: <LineChart className="w-5 h-5 text-canopy" />,
      eyebrow: 'SERIES TEMPORALES',
      metric: '1 Hz',
      title: 'Históricos y gráficas dinámicas',
      desc: 'Almacenamiento en TimescaleDB con bandas de tolerancia, umbrales configurables y exportación CSV.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-canopy" />,
      eyebrow: 'SEGURIDAD OPERATIVA',
      metric: '5 min',
      title: 'Alertas preventivas con debouncing',
      desc: 'Notificaciones visibles inmediatas ante excursiones térmicas, evitando falsos positivos por ruido.',
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-orb-violet" />,
      eyebrow: 'INTELIGENCIA ARTIFICIAL',
      metric: '<200 ms',
      title: 'Detección multivariante de anomalías',
      desc: 'Isolation Forest y Z-Score 3σ que identifican fallos de climatización antes de la pérdida crítica.',
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5 text-canopy" />,
      eyebrow: 'AUDITORÍA GXP',
      metric: '99.9%',
      title: 'Trazabilidad y reportes de cumplimiento',
      desc: 'Estadísticas consolidadas (Mín, Máx, Promedio, Desviación Estándar y SLA) listas para inspección.',
    },
  ];

  const techStack = [
    {
      eyebrow: 'PROCESAMIENTO & IA',
      name: 'Python, FastAPI & Scikit-Learn',
      desc: 'Backend asíncrono ejecutando Isolation Forest y control estadístico Z-Score sobre series ambientales.',
    },
    {
      eyebrow: 'MENSAJERÍA CIFRADA',
      name: 'Mosquitto MQTTS TLS 1.3',
      desc: 'Comunicación publish/subscribe ultraliviana sobre el puerto 8883 con garantía de entrega QoS 1.',
    },
    {
      eyebrow: 'ORQUESTACIÓN DE FLUJOS',
      name: 'Node-RED & Dead Letter Queue',
      desc: 'Validación continua de integridad JSON y aislamiento automático de tramas corruptas.',
    },
    {
      eyebrow: 'CAPTURA EN CAMPO',
      name: 'ESP32-WROOM & DHT22 / BME280',
      desc: 'Microcontroladores industriales con lectura estable cada 2.5 segundos y reconexión automática.',
    },
  ];

  const barData = [
    { label: '08:00', temp: 58, hum: 44, ia: 22 },
    { label: '10:00', temp: 66, hum: 50, ia: 28 },
    { label: '12:00', temp: 82, hum: 62, ia: 74 },
    { label: '14:00', temp: 74, hum: 56, ia: 40 },
    { label: '16:00', temp: 64, hum: 48, ia: 26 },
    { label: '18:00', temp: 60, hum: 46, ia: 20 },
  ];

  return (
    <div className="relative min-h-screen bg-cream-paper text-bark selection:bg-canopy selection:text-sheet-white overflow-x-hidden">
      {/* Fondo 3D Interactivo con Three.js (paleta Arcadia: Canopy, Mint Pulse, Orb Violet) */}
      <EnvironmentalThreeBackground />

      {/* 1. ANNOUNCEMENT BAR — Full-bleed Canopy (#104336) */}
      <div className="relative z-10 w-full bg-canopy text-sheet-white px-6 py-2.5 text-center text-[13px] font-normal flex items-center justify-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-mint-pulse shrink-0" />
        <span>
          SIMOA Observatorio v2.4 · Monitoreo ambiental IoT con telemetría MQTTS y diagnóstico IA en vivo
        </span>
        <button
          onClick={() => onEnterSystem('dashboard')}
          className="hidden sm:inline-flex items-center gap-1 text-mint-pulse hover:underline font-medium cursor-pointer"
        >
          Explorar panel →
        </button>
      </div>

      {/* 2. TOP NAVIGATION — Sheet White (#ffffff), 72px height, 1px Sage Mist (#afc4bf) border */}
      <header className="sticky top-0 z-50 bg-sheet-white border-b border-sage-mist">
        <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between gap-6">
          <a href="#inicio" className="flex items-center gap-3 shrink-0 focus:outline-none">
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-normal text-bark">
            <a href="#observatorio" className="hover:text-canopy transition-colors">
              Observatorio
            </a>
            <a href="#arquitectura" className="hover:text-canopy transition-colors">
              Arquitectura
            </a>
            <a href="#capacidades" className="hover:text-canopy transition-colors">
              Capacidades
            </a>
            <a href="#tecnologias" className="hover:text-canopy transition-colors">
              Tecnologías
            </a>
            <a href="#contacto" className="hover:text-canopy transition-colors">
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onEnterSystem('srs')}
              className="hidden sm:inline-flex arcadia-btn-ghost px-4 py-2.5 text-[14px] cursor-pointer"
            >
              Documentación SRS
            </button>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="arcadia-btn-primary px-5 py-2.5 text-[14px] cursor-pointer flex items-center gap-2"
            >
              Abrir plataforma
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-[8px] border border-sage-mist text-bark cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-sheet-white border-t border-sage-mist px-6 py-4 space-y-3 text-[15px]">
            {[
              { href: '#observatorio', label: 'Observatorio' },
              { href: '#arquitectura', label: 'Arquitectura' },
              { href: '#capacidades', label: 'Capacidades' },
              { href: '#tecnologias', label: 'Tecnologías' },
              { href: '#contacto', label: 'Contacto' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1.5 text-bark hover:text-canopy"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* 3. HERO SECTION — Diagonal Hero Wash (#afc4bf -> #e8e7f5 -> #f1eee9) */}
      <section
        id="inicio"
        className="relative z-10 pt-20 pb-24 px-6 border-b border-sage-mist"
        style={{
          background:
            'linear-gradient(212.12deg, rgba(175, 196, 191, 0.55) 14.83%, rgba(232, 231, 245, 0.55) 52.99%, rgba(241, 238, 233, 0.65) 79.47%)',
        }}
      >
        {skeletonMode ? (
          <div className="max-w-[1200px] mx-auto">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto">
            {/* Centered Hero Text Stack */}
            <div className="max-w-[780px] mx-auto text-center space-y-6">
              <p className="arcadia-eyebrow text-canopy">
                OBSERVATORIO AMBIENTAL IOT · SIMOA
              </p>
              <h1 className="arcadia-display">
                Telemetría ambiental de alta precisión en un solo observatorio.
              </h1>
              <p className="text-[18px] leading-[1.5] text-slate font-normal max-w-[640px] mx-auto">
                Supervisa temperatura, humedad relativa y salud de nodos ESP32 en tiempo real.
                Detecta anomalías térmicas con IA antes de comprometer tus recintos críticos.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="arcadia-btn-mint px-6 py-3.5 text-[15px] cursor-pointer inline-flex items-center gap-2"
                >
                  Iniciar monitoreo en vivo
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#arquitectura"
                  className="arcadia-btn-ghost px-6 py-3.5 text-[15px] inline-flex items-center gap-2"
                >
                  Cómo funciona
                </a>
              </div>
            </div>

            {/* Embedded Product Dashboard Mockup Card — Sheet White (#ffffff), 16px radius, 1px Sage Mist (#afc4bf), zero shadow */}
            <div
              id="observatorio"
              className="mt-16 max-w-[1000px] mx-auto bg-sheet-white rounded-[16px] border border-sage-mist overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                {/* Left Vertical Canopy Icon Rail */}
                <div className="bg-canopy text-sheet-white md:w-16 px-4 py-4 md:py-6 flex md:flex-col items-center justify-between gap-4 shrink-0">
                  <div className="w-9 h-9 rounded-[8px] bg-mint-pulse text-bark flex items-center justify-center font-bold text-[13px]">
                    S
                  </div>
                  <div className="flex md:flex-col items-center gap-4 text-sage-mist">
                    <Activity className="w-5 h-5 text-mint-pulse" />
                    <Thermometer className="w-5 h-5" />
                    <Cpu className="w-5 h-5" />
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <span className="hidden md:block w-2 h-2 rounded-full bg-mint-pulse" />
                </div>

                {/* Dashboard Content Area */}
                <div className="flex-1 p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sage-mist">
                    <div>
                      <p className="arcadia-eyebrow text-slate">PANEL DE TELEMETRÍA EN VIVO</p>
                      <h2 className="text-[20px] font-medium text-bark mt-1">
                        Laboratorio Central · Bioterio &amp; Cadena de Frío
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[9999px] bg-cream-paper border border-sage-mist text-[12px] font-bold uppercase tracking-[0.07em] text-canopy">
                      <span className="w-2 h-2 rounded-full bg-mint-pulse border border-canopy" />
                      Streaming MQTTS 1 Hz
                    </span>
                  </div>

                  {/* 3 Stat Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-[16px] bg-cream-paper border border-sage-mist space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="arcadia-eyebrow text-slate">TEMPERATURA MEDIA</span>
                        <Thermometer className="w-4 h-4 text-canopy" />
                      </div>
                      <div className="arcadia-stat-value">23.4 °C</div>
                      <div className="flex items-center gap-1 text-[13px] font-medium text-canopy">
                        <ArrowDownRight className="w-4 h-4" />
                        <span>-0.3 °C respecto a umbral</span>
                      </div>
                    </div>

                    <div className="p-5 rounded-[16px] bg-cream-paper border border-sage-mist space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="arcadia-eyebrow text-slate">HUMEDAD RELATIVA</span>
                        <Activity className="w-4 h-4 text-canopy" />
                      </div>
                      <div className="arcadia-stat-value">61.8 %</div>
                      <div className="flex items-center gap-1 text-[13px] font-medium text-canopy">
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+1.2 % rango nominal</span>
                      </div>
                    </div>

                    <div className="p-5 rounded-[16px] bg-cream-paper border border-sage-mist space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="arcadia-eyebrow text-orb-violet">ÍNDICE ANOMALÍA IA</span>
                        <BrainCircuit className="w-4 h-4 text-orb-violet" />
                      </div>
                      <div className="arcadia-stat-value">0.04 σ</div>
                      <div className="flex items-center gap-1 text-[13px] font-medium text-slate">
                        <span>Isolation Forest · Estable</span>
                      </div>
                    </div>
                  </div>

                  {/* Minimalist Bar Chart Preview */}
                  <div className="p-5 rounded-[16px] bg-sheet-white border border-sage-mist">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                      <span className="arcadia-eyebrow text-slate">
                        PERFIL TÉRMICO E HIGROMÉTRICO (ÚLTIMAS 12 HORAS)
                      </span>
                      <div className="flex items-center gap-4 text-[12px] uppercase tracking-[0.07em] font-bold text-slate">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-[2px] bg-canopy" /> Temp
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-[2px] bg-mint-pulse border border-canopy" /> Humedad
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-[2px] bg-orb-violet" /> Score IA
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-4 items-end h-32 pt-2">
                      {barData.map((d) => (
                        <div key={d.label} className="flex flex-col items-center gap-2 h-full justify-end">
                          <div className="flex items-end gap-1.5 h-24">
                            <div
                              className="w-2.5 bg-canopy rounded-t-[2px]"
                              style={{ height: `${d.temp}%` }}
                            />
                            <div
                              className="w-2.5 bg-mint-pulse border border-canopy rounded-t-[2px]"
                              style={{ height: `${d.hum}%` }}
                            />
                            <div
                              className="w-2.5 bg-orb-violet rounded-t-[2px]"
                              style={{ height: `${d.ia}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-slate font-mono">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. LOGO STRIP — Sheet White (#ffffff), monochrome Bark (#101f1e) */}
      <section className="relative z-10 bg-sheet-white/88 border-b border-sage-mist py-12 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 items-center text-center">
            {[
              'ESP32-WROOM',
              'DHT22 · BME280',
              'MOSQUITTO MQTTS',
              'TIMESCALEDB',
              'SCIKIT-LEARN IA',
              'NODE-RED FLOW',
            ].map((brand) => (
              <div
                key={brand}
                className="text-[13px] font-bold tracking-[0.07em] uppercase text-bark opacity-85"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. NETWORK DIAGRAM SECTION ("Cómo entregamos resultados") — Cream Paper (#f3f1ec), Floating 3D-style Orbs */}
      <section id="arquitectura" className="relative z-10 bg-cream-paper/75 py-24 px-6 border-b border-sage-mist">
        <div className="max-w-[1200px] mx-auto">
          <div className="max-w-[700px] mx-auto text-center space-y-4">
            <p className="arcadia-eyebrow text-orb-violet">CÓMO ENTREGAMOS RESULTADOS</p>
            <h2 className="arcadia-heading">
              Una red conectada desde el sensor en campo hasta el diagnóstico predictivo.
            </h2>
            <p className="text-[16px] text-slate leading-[1.5]">
              Cada lectura ambiental viaja cifrada por MQTTS, se valida en Node-RED, se indexa en
              TimescaleDB y se evalúa con modelos de anomalías en menos de 200 ms.
            </p>
          </div>

          {/* Floating Orb Network Diagram in open Cream Paper space */}
          <div className="mt-16 relative max-w-[1000px] mx-auto">
            <svg
              viewBox="0 0 1000 320"
              className="w-full h-auto hidden md:block"
              aria-label="Diagrama de red de telemetría SIMOA"
            >
              {/* Dotted Sage Mist Connections */}
              <line x1="120" y1="160" x2="310" y2="85" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="120" y1="160" x2="310" y2="235" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="310" y1="85" x2="520" y2="160" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="310" y1="235" x2="520" y2="160" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="520" y1="160" x2="720" y2="95" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="520" y1="160" x2="720" y2="230" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="720" y1="95" x2="885" y2="160" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />
              <line x1="720" y1="230" x2="885" y2="160" stroke="#afc4bf" strokeWidth="1.5" strokeDasharray="4 5" />

              <defs>
                <radialGradient id="orbViolet" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#d9b8ff" />
                  <stop offset="55%" stopColor="#7c18d3" />
                  <stop offset="100%" stopColor="#4c0c85" />
                </radialGradient>
                <radialGradient id="orbMint" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#c9ffe3" />
                  <stop offset="55%" stopColor="#0fff87" />
                  <stop offset="100%" stopColor="#104336" />
                </radialGradient>
                <radialGradient id="orbLavender" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="60%" stopColor="#e8e7f5" />
                  <stop offset="100%" stopColor="#afc4bf" />
                </radialGradient>
              </defs>

              {/* 6 Floating Orbs */}
              <circle cx="120" cy="160" r="24" fill="url(#orbMint)" />
              <circle cx="310" cy="85" r="20" fill="url(#orbLavender)" />
              <circle cx="310" cy="235" r="20" fill="url(#orbViolet)" />
              <circle cx="520" cy="160" r="28" fill="url(#orbViolet)" />
              <circle cx="720" cy="95" r="22" fill="url(#orbMint)" />
              <circle cx="720" cy="230" r="20" fill="url(#orbLavender)" />
              <circle cx="885" cy="160" r="24" fill="url(#orbMint)" />

              {/* White Pill Labels */}
              {[
                { x: 120, y: 210, text: '01 · SENSORES DHT22' },
                { x: 310, y: 40, text: '02 · NODO ESP32' },
                { x: 310, y: 280, text: '03 · MQTTS TLS 8883' },
                { x: 520, y: 215, text: '04 · MOTOR IA / DLQ' },
                { x: 720, y: 48, text: '05 · TIMESCALEDB' },
                { x: 720, y: 276, text: '06 · ALERTAS 5 MIN' },
                { x: 885, y: 210, text: '07 · DASHBOARD VIVO' },
              ].map((pill) => (
                <g key={pill.text} transform={`translate(${pill.x}, ${pill.y})`}>
                  <rect
                    x="-82"
                    y="-14"
                    width="164"
                    height="28"
                    rx="14"
                    fill="#ffffff"
                    stroke="#afc4bf"
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#101f1e"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.07em"
                    fontFamily="DM Sans, sans-serif"
                  >
                    {pill.text}
                  </text>
                </g>
              ))}
            </svg>

            {/* Mobile Network Fallback */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {[
                { step: '01 · SENSORES DHT22', color: 'bg-mint-pulse' },
                { step: '02 · NODO ESP32', color: 'bg-[#e8e7f5]' },
                { step: '03 · MQTTS TLS 8883', color: 'bg-orb-violet' },
                { step: '04 · MOTOR IA / DLQ', color: 'bg-orb-violet' },
                { step: '05 · TIMESCALEDB', color: 'bg-mint-pulse' },
                { step: '06 · DASHBOARD VIVO', color: 'bg-mint-pulse' },
              ].map((n) => (
                <div
                  key={n.step}
                  className="flex items-center gap-3 px-4 py-3 rounded-[9999px] bg-sheet-white border border-sage-mist"
                >
                  <span className={`w-4 h-4 rounded-full ${n.color} border border-canopy shrink-0`} />
                  <span className="arcadia-eyebrow text-[12px] text-bark">{n.step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. ISOMETRIC FEATURE SECTION — Mint-Cream Gradient (#e8f0ec -> #f1eee9) */}
      <section
        className="relative z-10 py-24 px-6 border-b border-sage-mist"
        style={{
          background: 'linear-gradient(180deg, rgba(232, 240, 236, 0.78) 0%, rgba(241, 238, 233, 0.78) 100%)',
        }}
      >
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Isometric Observatory Illustration */}
          <div className="flex justify-center">
            <svg
              viewBox="0 0 480 360"
              className="w-full max-w-[460px] h-auto"
              aria-label="Ilustración isométrica de infraestructura IoT SIMOA"
            >
              {/* Base Isometric Platform */}
              <polygon points="240,320 440,220 240,120 40,220" fill="#ffffff" stroke="#afc4bf" strokeWidth="1.5" />
              <polygon points="40,220 240,320 240,340 40,240" fill="#e8e7f5" stroke="#afc4bf" strokeWidth="1" />
              <polygon points="440,220 240,320 240,340 440,240" fill="#c2cec8" stroke="#afc4bf" strokeWidth="1" />

              {/* Left Sensor Node Cube */}
              <polygon points="145,215 195,190 145,165 95,190" fill="#0fff87" stroke="#104336" strokeWidth="1.2" />
              <polygon points="95,190 145,215 145,250 95,225" fill="#104336" />
              <polygon points="195,190 145,215 145,250 195,225" fill="#185a49" />
              <text x="145" y="150" textAnchor="middle" fill="#104336" fontSize="11" fontWeight="700" letterSpacing="0.07em">
                ESP32 + DHT22
              </text>

              {/* Center Observatory Tower */}
              <polygon points="240,185 305,152 240,120 175,152" fill="#e8e7f5" stroke="#104336" strokeWidth="1.2" />
              <polygon points="175,152 240,185 240,255 175,222" fill="#ffffff" stroke="#afc4bf" strokeWidth="1.2" />
              <polygon points="305,152 240,185 240,255 305,222" fill="#f3f1ec" stroke="#afc4bf" strokeWidth="1.2" />
              {/* Antenna & Violet Data Orb */}
              <line x1="240" y1="120" x2="240" y2="62" stroke="#104336" strokeWidth="2.5" />
              <circle cx="240" cy="54" r="14" fill="#7c18d3" />
              <circle cx="235" cy="49" r="4" fill="#d9b8ff" />
              <text x="240" y="28" textAnchor="middle" fill="#104336" fontSize="11" fontWeight="700" letterSpacing="0.07em">
                NÚCLEO IA · MQTTS
              </text>

              {/* Right Climate Chamber Cube */}
              <polygon points="335,215 385,190 335,165 285,190" fill="#ffffff" stroke="#104336" strokeWidth="1.2" />
              <polygon points="285,190 335,215 335,250 285,225" fill="#afc4bf" />
              <polygon points="385,190 335,215 335,250 385,225" fill="#535e5d" />
              <text x="335" y="150" textAnchor="middle" fill="#104336" fontSize="11" fontWeight="700" letterSpacing="0.07em">
                RECINTO CRÍTICO
              </text>

              {/* Signal Arcs */}
              <path d="M 160 170 Q 195 130 226 142" fill="none" stroke="#104336" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M 320 170 Q 285 130 254 142" fill="none" stroke="#7c18d3" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>
          </div>

          {/* Right Editorial Text Block */}
          <div className="space-y-6">
            <p className="arcadia-eyebrow text-canopy">DETECCIÓN PREDICTIVA</p>
            <h2 className="arcadia-heading">
              Control ambiental diseñado para laboratorios, bioterios y cadena de frío.
            </h2>
            <p className="text-[16px] text-slate leading-[1.6]">
              SIMOA combina hardware accesible ESP32 con un motor analítico de grado industrial.
              Configura umbrales personalizados por recinto, recibe alertas con control anti-rebote
              y consulta el diagnóstico de causa raíz generado por IA.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => onEnterSystem('ai')}
                className="arcadia-btn-primary px-6 py-3 text-[14px] cursor-pointer inline-flex items-center gap-2"
              >
                Probar Diagnóstico IA
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEnterSystem('devices')}
                className="arcadia-btn-ghost px-6 py-3 text-[14px] cursor-pointer"
              >
                Gestionar nodos ESP32
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CAPABILITIES GRID — Sheet White (#ffffff) band, 16px cards, 1px Sage Mist (#afc4bf) */}
      <section id="capacidades" className="relative z-10 bg-sheet-white/88 py-24 px-6 border-b border-sage-mist">
        <div className="max-w-[1200px] mx-auto space-y-14">
          <div className="max-w-[680px] space-y-4">
            <p className="arcadia-eyebrow text-canopy">CAPACIDADES DEL SISTEMA</p>
            <h2 className="arcadia-heading">
              Todo lo necesario para auditar y proteger el entorno físico.
            </h2>
          </div>

          {skeletonMode ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="p-7 rounded-[16px] bg-cream-paper border border-sage-mist flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="arcadia-eyebrow text-[12px] text-slate">{cap.eyebrow}</span>
                      <div className="w-9 h-9 rounded-[8px] bg-sheet-white border border-sage-mist flex items-center justify-center">
                        {cap.icon}
                      </div>
                    </div>
                    <div className="arcadia-stat-value">{cap.metric}</div>
                    <h3 className="text-[20px] font-medium text-bark leading-[1.29]">
                      {cap.title}
                    </h3>
                    <p className="text-[15px] text-slate leading-[1.5]">{cap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 8. TECHNOLOGIES & CONTACT — Cream Paper (#f3f1ec) band */}
      <section id="tecnologias" className="relative z-10 bg-cream-paper/80 py-24 px-6">
        <div className="max-w-[1200px] mx-auto space-y-20">
          {/* Tech Stack */}
          <div className="space-y-10">
            <div className="max-w-[640px] space-y-3">
              <p className="arcadia-eyebrow text-canopy">STACK TECNOLÓGICO</p>
              <h2 className="arcadia-heading">Estándares abiertos de ingeniería IoT.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {techStack.map((t) => (
                <div
                  key={t.name}
                  className="p-7 rounded-[16px] bg-sheet-white border border-sage-mist space-y-3"
                >
                  <span className="arcadia-eyebrow text-[12px] text-canopy">{t.eyebrow}</span>
                  <h3 className="text-[22px] font-medium text-bark">{t.name}</h3>
                  <p className="text-[15px] text-slate leading-[1.5]">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Form */}
          <div
            id="contacto"
            className="p-8 sm:p-12 rounded-[16px] bg-sheet-white border border-sage-mist grid grid-cols-1 lg:grid-cols-2 gap-10 items-start"
          >
            <div className="space-y-5">
              <p className="arcadia-eyebrow text-canopy">CONTACTO TÉCNICO</p>
              <h2 className="arcadia-heading">Despliega SIMOA en tu infraestructura.</h2>
              <p className="text-[16px] text-slate leading-[1.5]">
                Solicita una demostración o integración con tus nodos ESP32, sensores DHT22/BME280
                y servidores Mosquitto TLS.
              </p>
              <div className="pt-2 space-y-3 text-[14px] text-bark">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-canopy" />
                  <span>Soporte MQTTS TLS 1.3 (Puerto 8883)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-canopy" />
                  <span>Trazabilidad auditada bajo especificación SRS</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-canopy" />
                  <span>Simulador de campo integrado en la plataforma</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-bark mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej. Laura Gómez"
                  className="arcadia-input w-full px-3.5 py-2.5"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-bark mb-1.5">
                  Correo institucional
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="nombre@organizacion.org"
                  className="arcadia-input w-full px-3.5 py-2.5"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-bark mb-1.5">
                  Hardware de interés
                </label>
                <select
                  value={contactHardwareModel}
                  onChange={(e) => setContactHardwareModel(e.target.value)}
                  className="arcadia-input w-full px-3.5 py-2.5"
                >
                  <option>ESP32-WROOM + Sensor DHT22</option>
                  <option>ESP32 + Sensor Bosch BME280</option>
                  <option>Gateway Industrial + Sensirion SHT31</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-bark mb-1.5">
                  Mensaje o requerimiento
                </label>
                <textarea
                  rows={3}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Describe los recintos o variables ambientales a monitorear..."
                  className="arcadia-input w-full px-3.5 py-2.5"
                />
              </div>

              {contactSent ? (
                <div className="p-3.5 rounded-[8px] bg-cream-paper border border-canopy text-canopy text-[14px] flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Solicitud registrada correctamente. Nuestro equipo responderá pronto.
                </div>
              ) : (
                <button
                  type="submit"
                  className="arcadia-btn-primary w-full py-3.5 px-6 text-[14px] cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar solicitud
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* 9. FOOTER — Canopy (#104336) background, white DM Sans 13-15px text */}
      <footer className="relative z-10 bg-canopy text-sheet-white py-20 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-mint-pulse" />
              <span className="text-[20px] font-medium tracking-[-0.02em] text-sheet-white">
                SIMOA
              </span>
            </div>
            <p className="text-[14px] text-sage-mist max-w-[380px] leading-[1.6]">
              Sistema Inteligente de Monitoreo Ambiental IoT. Telemetría continua, gestión de
              nodos ESP32 y diagnóstico predictivo con IA.
            </p>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="arcadia-eyebrow text-mint-pulse">PLATAFORMA</p>
            <ul className="space-y-2.5 text-sage-mist">
              <li>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="hover:text-sheet-white cursor-pointer"
                >
                  Monitoreo en Vivo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('devices')}
                  className="hover:text-sheet-white cursor-pointer"
                >
                  Nodos y Sensores
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="hover:text-sheet-white cursor-pointer"
                >
                  Histórico y CSV
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="hover:text-sheet-white cursor-pointer"
                >
                  Diagnóstico IA
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <p className="arcadia-eyebrow text-mint-pulse">DOCUMENTACIÓN</p>
            <ul className="space-y-2.5 text-sage-mist">
              <li>
                <button
                  onClick={() => onEnterSystem('srs')}
                  className="hover:text-sheet-white cursor-pointer"
                >
                  Especificación SRS
                </button>
              </li>
              <li>
                <a href="#arquitectura" className="hover:text-sheet-white">
                  Arquitectura MQTTS
                </a>
              </li>
              <li>
                <a href="#capacidades" className="hover:text-sheet-white">
                  Capacidades
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-sheet-white">
                  Contacto
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-14 pt-8 border-t border-sage-mist/25 flex flex-wrap items-center justify-between gap-4 text-[13px] text-sage-mist">
          <span>© 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental</span>
          <span>Observatorio IoT · Luz Eliana Sánchez Tovar</span>
        </div>
      </footer>
    </div>
  );
};
