import React, { useState, useCallback } from 'react';
import {
  Thermometer,
  Cpu,
  LineChart,
  AlertTriangle,
  BrainCircuit,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Send,
  Menu,
  X,
  Server,
  ShieldCheck,
  Radio,
  ChevronLeft,
  ChevronRight,
  AtSign,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { HeroSkeleton } from '../common/SkeletonLoader';

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
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactHardwareModel, setContactHardwareModel] = useState('ESP32-WROOM + Sensor DHT22');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // AI composer state for hero floating card
  const [composerQuery, setComposerQuery] = useState('');

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
      category: 'FLUJO CONTINUO',
      title: 'Supervisión térmica e higrométrica sin puntos ciegos.',
      desc: 'Visualiza lecturas de temperatura (°C) y humedad relativa (%RH) con bandas de tolerancia, cálculo de Z-Score y registro histórico listo para auditoría.',
      metricA: { label: 'Temperatura media', value: '23.4 °C', delta: '↑ 0.2° vs promedio histórico' },
      metricB: { label: 'Humedad relativa', value: '61.8 %RH', delta: 'Estable en banda 40–70%' },
      metricC: { label: 'Score anomalía IA', value: '0.04 σ', delta: 'Isolation Forest nominal' },
    },
    {
      id: 'devices',
      label: 'Nodos ESP32',
      category: 'GESTIÓN EDGE',
      title: 'Control centralizado de microcontroladores y sondas.',
      desc: 'Administra direcciones MAC, latidos PINGREQ, intensidad WiFi RSSI y calibración de sensores DHT22, BME280 y SHT31 desde un solo panel.',
      metricA: { label: 'Nodos en línea', value: '12 / 12', delta: 'Latencia media 18 ms' },
      metricB: { label: 'Sondas activas', value: '24', delta: 'DHT22 · BME280 · SHT31' },
      metricC: { label: 'Disponibilidad mes', value: '99.94%', delta: 'Reconexión automática' },
    },
    {
      id: 'alerts',
      label: 'Alertas 5 min',
      category: 'SEGURIDAD OPERATIVA',
      title: 'Notificaciones precisas sin saturación por falsos positivos.',
      desc: 'El motor anti-rebote consolida excursiones térmicas en ventanas de 5 minutos, clasifica severidad y registra la causa raíz de cada incidencia.',
      metricA: { label: 'Ventana debounce', value: '5 min', delta: 'Sin spam de eventos' },
      metricB: { label: 'Incidencias hoy', value: '0', delta: '100% en rango óptimo' },
      metricC: { label: 'Respuesta alerta', value: '< 1.2 s', delta: 'Aviso visual y sonoro' },
    },
    {
      id: 'ai',
      label: 'Diagnóstico IA',
      category: 'MACHINE LEARNING',
      title: 'Detecta fallos de climatización antes de perder muestras.',
      desc: 'Isolation Forest y Z-Score 3σ evalúan correlaciones anómalas entre temperatura y humedad para diagnosticar fallas en menos de 200 ms.',
      metricA: { label: 'Latencia inferencia', value: '142 ms', delta: 'Por cada muestra MQTT' },
      metricB: { label: 'Sensibilidad 3σ', value: '3.0 σ', delta: 'Control multivariante' },
      metricC: { label: 'Tramas aisladas', value: '0', delta: 'Integridad JSON 100%' },
    },
  ];

  const capabilities = [
    {
      icon: <Thermometer className="w-5 h-5 text-[#17191c]" />,
      category: 'TELEMETRÍA',
      metric: '±0.2 °C',
      title: 'Registro de temperatura y humedad',
      desc: 'Captura periódica en recintos críticos con sondas calibradas DHT22, BME280 y SHT31.',
      tab: 'dashboard',
    },
    {
      icon: <Cpu className="w-5 h-5 text-[#17191c]" />,
      category: 'HARDWARE',
      metric: 'ESP32',
      title: 'Supervisión de dispositivos IoT',
      desc: 'Control de latidos PINGREQ, validación de dirección MAC y estado Online/Offline.',
      tab: 'devices',
    },
    {
      icon: <LineChart className="w-5 h-5 text-[#17191c]" />,
      category: 'ANALÍTICA',
      metric: '1 Hz',
      title: 'Históricos y series temporales',
      desc: 'Gráficas continuas con bandas de tolerancia, umbrales y exportación CSV certificada.',
      tab: 'analytics',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-[#17191c]" />,
      category: 'RESILIENCIA',
      metric: '5 min',
      title: 'Alertas con debouncing anti-rebote',
      desc: 'Notificaciones inmediatas ante excursiones térmicas evitando falsos positivos.',
      tab: 'alerts',
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-[#17191c]" />,
      category: 'INFERENCIA',
      metric: '< 200 ms',
      title: 'Diagnóstico predictivo de anomalías',
      desc: 'Isolation Forest y Z-Score 3σ que identifican fallos antes de comprometer el recinto.',
      tab: 'ai',
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5 text-[#17191c]" />,
      category: 'AUDITORÍA',
      metric: '99.9%',
      title: 'Trazabilidad y reportes de cumplimiento',
      desc: 'Estadísticas consolidadas (Mín, Máx, Promedio y Desviación Estándar) listas para auditoría.',
      tab: 'analytics',
    },
  ];

  const currentFeature = featureTabs[activeFeatureTab];

  return (
    <div className="relative min-h-screen bg-white text-[#17191c] selection:bg-[#fbe1d1] selection:text-[#5d2a1a] overflow-x-hidden font-sans">
      {/* 1. TOP NAVIGATION — Steep Whisper-Quiet Header */}
      <header className="relative z-30 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          {/* Logo Brand: Geometric Icon + Steep style wordmark */}
          <a href="#inicio" className="flex items-center gap-2.5 shrink-0 focus:outline-none">
            <div className="w-7 h-7 rounded-full bg-[#17191c] flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H8l5-7v4h3l-5 7z" />
              </svg>
            </div>
            <span className="text-[21px] font-serif font-normal text-[#17191c] tracking-[-0.03em]">
              Steep
            </span>
          </a>

          {/* Nav Items Center */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-normal text-[#17191c]">
            <a href="#modulos" className="hover:text-[#777b86] transition-colors">
              Product
            </a>
            <a href="#capacidades" className="hover:text-[#777b86] transition-colors">
              Resources
            </a>
            <a href="#arquitectura" className="hover:text-[#777b86] transition-colors">
              Customers
            </a>
            <a href="#contacto" className="hover:text-[#777b86] transition-colors">
              Pricing
            </a>
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-5">
            <a
              href="#contacto"
              className="hidden sm:inline-block text-[15px] text-[#17191c] hover:underline cursor-pointer"
            >
              Book a demo
            </a>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="steep-btn-filled text-[15px] px-5 py-2"
            >
              Get started
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full border border-[#ececec] text-[#17191c] cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#ececec] px-6 py-6 space-y-4 text-[16px]">
            {[
              { href: '#modulos', label: 'Product' },
              { href: '#capacidades', label: 'Resources' },
              { href: '#arquitectura', label: 'Customers' },
              { href: '#contacto', label: 'Pricing' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1 text-[#17191c] hover:text-[#777b86]"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterSystem('dashboard');
                }}
                className="steep-btn-filled w-full"
              >
                Get started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION — Exact Steep Collage with Peach Glow Aura and 4 Floating Artifacts */}
      <section id="inicio" className="relative z-10 pt-8 pb-32 px-6 overflow-visible">
        {/* Soft Radial Peach/Mist Glow Aura Mesh matching exact screenshot */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(circle at 72% 38%, rgba(251, 225, 209, 0.85) 0%, rgba(251, 225, 209, 0.40) 30%, rgba(255, 255, 255, 0) 65%), radial-gradient(circle at 20% 32%, rgba(235, 240, 248, 0.60) 0%, rgba(255, 255, 255, 0) 50%)',
          }}
        />

        {skeletonMode ? (
          <div className="max-w-[1240px] mx-auto relative z-10">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1240px] mx-auto relative z-10">
            {/* Center Editorial Typography Headline */}
            <div className="max-w-[780px] mx-auto text-center pt-8 pb-14 space-y-6">
              <h1 className="font-serif font-normal text-[#17191c] text-[52px] sm:text-[70px] lg:text-[84px] leading-[1.08] tracking-[-0.035em]">
                AI analytics for faster <br />
                insights and <span className="italic font-serif">zero chaos</span>
              </h1>
              <p className="text-[17px] sm:text-[19px] leading-[1.45] text-[#555861] max-w-[580px] mx-auto font-normal">
                Steep is an AI analytics platform built on governed metrics that
                powers analysis, reporting and company-wide engagement.
              </p>
              {/* Pair of Pills: Filled + Ghost */}
              <div className="pt-2 flex items-center justify-center gap-4">
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-btn-filled text-[15px] px-6 py-2.5 shadow-sm"
                >
                  Get started
                </button>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-btn-ghost text-[15px] px-6 py-2.5"
                >
                  Book a demo
                </button>
              </div>
            </div>

            {/* FLOATING PRODUCT ARTIFACT COLLAGE (4 CARDS) */}
            <div className="relative w-full max-w-[1140px] mx-auto min-h-[380px] lg:min-h-[440px]">
              {/* ARTIFACT 1: Top-Left Region Table with Bar Chart */}
              <div
                className="lg:absolute lg:top-[-110px] lg:left-0 w-full sm:w-[320px] bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-4 mb-6 lg:mb-0"
              >
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Left Metric and Bar Chart */}
                  <div className="space-y-2">
                    <div className="text-[28px] font-medium text-[#17191c] leading-none tabular-nums">
                      3 503
                    </div>
                    <div className="text-[12px] text-[#777b86]">
                      2% vs last week
                    </div>
                    {/* Minimal vertical bar chart */}
                    <div className="flex items-end gap-1.5 h-14 pt-2">
                      {[40, 65, 80, 50, 95].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-2.5 rounded-sm ${
                            i === 2 ? 'bg-[#17191c]' : 'bg-[#777b86]/30'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-[#a3a6af] font-mono px-0.5">
                      <span>F</span>
                      <span>S</span>
                      <span>S</span>
                      <span>M</span>
                    </div>
                  </div>

                  {/* Right Region List */}
                  <div className="space-y-1.5 text-[12px] border-l border-[#ececec] pl-3">
                    <span className="text-[11px] font-medium text-[#17191c] block mb-1">
                      Region
                    </span>
                    {[
                      { name: 'Europe', val: '1 373' },
                      { name: 'North America', val: '930' },
                      { name: 'Africa', val: '745' },
                      { name: 'Asia', val: '432' },
                      { name: 'Other', val: '23' },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-[#777b86]">
                        <span className="truncate">{row.name}</span>
                        <span className="text-[#17191c] font-medium tabular-nums">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ARTIFACT 2: Right Registrations / Radial Ring Card (Soft Peach Wash) */}
              <div
                className="lg:absolute lg:top-[-20px] lg:right-0 w-full sm:w-[280px] bg-[#fbf5f0] rounded-[20px] p-5 border border-[#f3e1d5] shadow-[0_0_0_1px_rgba(4,23,43,0.04),0_16px_24px_-4px_rgba(93,42,26,0.08)] space-y-3 mb-6 lg:mb-0"
              >
                <div className="text-[13px] font-medium text-[#5d2a1a]">
                  Registrations
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-[32px] font-medium text-[#17191c] leading-none tabular-nums">
                      2.4k
                    </div>
                    <div className="text-[12px] text-[#777b86] mt-1.5">
                      ↑ 5.5% vs last week
                    </div>
                  </div>

                  {/* Radial Progress Gauge (75% of target) */}
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#edd3c4"
                        strokeWidth="6"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#5d2a1a"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - 0.75)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-[14px] font-semibold text-[#17191c] leading-none">
                        75%
                      </div>
                      <div className="text-[9px] text-[#777b86] leading-none mt-0.5">
                        of target
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 3: Bottom-Left Activation Line Chart Card with "JB" Cursor Pointer */}
              <div className="lg:absolute lg:bottom-[-20px] lg:left-[40px] w-full sm:w-[320px] mb-6 lg:mb-0">
                {/* JB Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-4 -left-7 z-20 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#dcfce7] border border-[#86efac] text-[#166534] font-medium text-[13px] flex items-center justify-center shadow-sm">
                      JB
                    </div>
                    {/* Little mouse pointer cursor arrow */}
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#166534] -ml-1 -mt-3 fill-current drop-shadow-sm">
                      <path d="M2 2l11 4.5-5 1.5-1.5 5L2 2z" />
                    </svg>
                  </div>

                  <div className="bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-3">
                    <div className="text-[13px] font-medium text-[#17191c]">
                      Activation
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-medium text-[#17191c] tabular-nums leading-none">
                        46.2%
                      </span>
                      <span className="text-[12px] text-[#777b86]">
                        103% of target
                      </span>
                    </div>

                    {/* Minimalist Line Chart with Dots */}
                    <div className="h-16 w-full pt-1">
                      <svg viewBox="0 0 240 60" className="w-full h-full overflow-visible">
                        <line x1="0" y1="50" x2="240" y2="50" stroke="#f2f2f3" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="0" y1="20" x2="240" y2="20" stroke="#f2f2f3" strokeWidth="1" strokeDasharray="3 3" />
                        <path
                          d="M 10 50 Q 60 48 100 38 T 160 22 T 220 10"
                          fill="none"
                          stroke="#5d2a1a"
                          strokeWidth="1.8"
                        />
                        <circle cx="10" cy="50" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="100" cy="38" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="160" cy="22" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="220" cy="10" r="3" fill="#5d2a1a" />
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-[#979799] font-mono pt-1">
                      <span>Aug</span>
                      <span>Sep</span>
                      <span>Oct</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#f2f2f3] text-[#17191c] font-medium">Nov</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 4: Bottom-Center AI Question Composer Input with "AF" Cursor Pointer */}
              <div className="lg:absolute lg:bottom-[-50px] lg:right-[140px] w-full sm:w-[380px]">
                {/* AF Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-3 -right-3 z-20 flex items-center">
                    {/* Mouse cursor pointer arrow */}
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#1d4ed8] -mr-1 -mt-3 fill-current drop-shadow-sm">
                      <path d="M2 2l11 4.5-5 1.5-1.5 5L2 2z" />
                    </svg>
                    <div className="w-9 h-9 rounded-full bg-[#dbeafe] border border-[#93c5fd] text-[#1e40af] font-medium text-[12px] flex items-center justify-center shadow-sm">
                      AF
                    </div>
                  </div>

                  <div className="bg-white rounded-[20px] p-3.5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.06),0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.06)] flex items-center gap-3">
                    <input
                      type="text"
                      value={composerQuery}
                      onChange={(e) => setComposerQuery(e.target.value)}
                      placeholder="Ask anything..."
                      className="flex-1 bg-transparent border-none text-[15px] text-[#17191c] placeholder:text-[#a3a6af] focus:outline-none px-2"
                    />

                    <div className="flex items-center gap-2 text-[#a3a6af]">
                      <button type="button" className="p-1 hover:text-[#17191c] cursor-pointer" aria-label="Mention">
                        <AtSign className="w-4 h-4" />
                      </button>
                      <button type="button" className="p-1 hover:text-[#17191c] cursor-pointer" aria-label="History">
                        <Clock className="w-4 h-4" />
                      </button>
                      {/* Black circular send button with white arrow */}
                      <button
                        onClick={() => onEnterSystem('ai')}
                        className="w-9 h-9 rounded-full bg-[#17191c] text-white flex items-center justify-center hover:bg-[#33363d] transition-colors cursor-pointer shrink-0 ml-1"
                        aria-label="Send query"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. EDITORIAL ACCENT CARD (#fbe1d1 Blush Peach) */}
      <section className="relative z-10 py-16 px-6 bg-white">
        <div className="max-w-[1240px] mx-auto steep-card-peach grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-3">
            <span className="text-[13px] uppercase tracking-[0.1em] text-[#5d2a1a] font-medium">
              TRAZABILIDAD AMBIENTAL CALIBRADA
            </span>
            <h2 className="text-[32px] md:text-[38px] font-serif font-normal text-[#5d2a1a] leading-tight">
              Diseñado para recintos donde cada décima de grado cuenta.
            </h2>
            <p className="text-[17px] text-[#5d2a1a]/85 max-w-[620px] leading-relaxed">
              SIMOA consolida lecturas continuas de sensores IoT con validación estricta de umbrales
              y alertas anti-rebote, garantizando una cadena térmica auditable bajo estándares técnicos.
            </p>
          </div>
          <div className="flex md:justify-end">
            <button
              onClick={() => onEnterSystem('analytics')}
              className="bg-[#5d2a1a] text-[#fbe1d1] px-6 py-3 rounded-full text-[15px] font-medium hover:bg-[#431d11] transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              Ver trazabilidad
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. MODULES PREVIEW — Neutral Card Surface with Clean Tab Switcher */}
      <section id="modulos" className="relative z-10 py-20 px-6 bg-[#fafafb]">
        <div className="max-w-[1240px] mx-auto space-y-12">
          <div className="max-w-[720px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em]">MÓDULOS DE CONSOLA</span>
            <h2 className="steep-heading font-serif font-normal">
              {currentFeature.title}
            </h2>
            <p className="steep-subheading">
              {currentFeature.desc}
            </p>
          </div>

          {/* Module Selector Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {featureTabs.map((tab, idx) => {
              const isActive = idx === activeFeatureTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(idx)}
                  className={`px-5 py-2.5 rounded-full text-[15px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#17191c] text-white font-normal'
                      : 'bg-white text-[#17191c] border border-[#ececec] hover:bg-[#f2f2f3]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Feature Showcase Artifact */}
          <div className="steep-card-artifact p-8 sm:p-10 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececec] pb-4">
              <div>
                <span className="steep-tag">{currentFeature.category}</span>
                <h3 className="text-[22px] font-medium text-[#17191c] mt-1">
                  {currentFeature.label} · Consola en vivo
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 text-[13px] text-[#777b86]">
                <span className="w-2 h-2 rounded-full bg-[#17191c]" />
                Enlace activo MQTTS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[currentFeature.metricA, currentFeature.metricB, currentFeature.metricC].map((m) => (
                <div key={m.label} className="steep-card-neutral p-6 space-y-2">
                  <div className="text-[14px] text-[#777b86]">{m.label}</div>
                  <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                    {m.value}
                  </div>
                  <div className="text-[13px] text-[#979799] pt-1">{m.delta}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() =>
                  onEnterSystem(
                    currentFeature.id === 'ai'
                      ? 'ai'
                      : currentFeature.id === 'devices'
                      ? 'devices'
                      : currentFeature.id === 'alerts'
                      ? 'alerts'
                      : 'dashboard'
                  )
                }
                className="steep-link font-medium cursor-pointer"
              >
                Abrir vista completa de {currentFeature.label} →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CAPABILITIES & ARCHITECTURE */}
      <section id="capacidades" className="relative z-10 py-24 px-6 bg-white">
        <div className="max-w-[1240px] mx-auto space-y-16">
          <div id="arquitectura" className="max-w-[700px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em]">ARQUITECTURA Y CAPACIDADES</span>
            <h2 className="steep-heading font-serif font-normal">
              Ingeniería de monitoreo construida para operar con serenidad y precisión.
            </h2>
            <p className="steep-subheading">
              Cada componente ha sido diseñado para priorizar fiabilidad, legibilidad y rigor técnico.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#ebebee] transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="steep-tag">{cap.category}</span>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#17191c] shadow-sm">
                      {cap.icon}
                    </div>
                  </div>
                  <div className="text-[32px] font-medium text-[#17191c] tabular-nums">
                    {cap.metric}
                  </div>
                  <h3 className="text-[20px] font-medium text-[#17191c]">{cap.title}</h3>
                  <p className="text-[15px] text-[#777b86] leading-relaxed">{cap.desc}</p>
                </div>
                <div>
                  <button
                    onClick={() => onEnterSystem(cap.tab)}
                    className="steep-link text-[14px] cursor-pointer"
                  >
                    Ver en consola →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CONTACT & DEPLOYMENT */}
      <section id="contacto" className="relative z-10 py-20 px-6 bg-[#fafafb] border-t border-[#ececec]">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <span className="steep-tag uppercase tracking-[0.08em]">CONTACTO TÉCNICO</span>
            <h2 className="steep-heading font-serif font-normal">
              Integra SIMOA en tus recintos ambientales.
            </h2>
            <p className="text-[17px] text-[#777b86] leading-relaxed">
              Solicita asistencia técnica o prueba el simulador de campo integrado para calibrar
              umbrales térmicos, validar debouncing de 5 minutos y verificar alertas automáticas.
            </p>
            <div className="space-y-3 pt-2 text-[15px] text-[#17191c]">
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4 text-[#5d2a1a]" />
                <span>Protocolo seguro MQTTS TLS 1.3 (Broker dedicado)</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#5d2a1a]" />
                <span>Trazabilidad auditada y registro inalterable de incidencias</span>
              </div>
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-[#5d2a1a]" />
                <span>Compatibilidad nativa con nodos ESP32 y sensores I2C/OneWire</span>
              </div>
            </div>
          </div>

          {/* Clean Editorial Contact Form */}
          <div className="steep-card-artifact p-8 space-y-5">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej. Dra. Carmen Silva"
                  className="steep-input w-full"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="nombre@organizacion.org"
                  className="steep-input w-full"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Hardware o recintos
                </label>
                <select
                  value={contactHardwareModel}
                  onChange={(e) => setContactHardwareModel(e.target.value)}
                  className="steep-input w-full"
                >
                  <option value="ESP32-WROOM + Sensor DHT22">ESP32-WROOM + Sensor DHT22</option>
                  <option value="ESP32 + Sensor Bosch BME280">ESP32 + Sensor Bosch BME280</option>
                  <option value="Gateway Industrial + Sensirion SHT31">Gateway Industrial + Sensirion SHT31</option>
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Requerimiento o mensaje
                </label>
                <textarea
                  rows={3}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Describe los recintos o variables ambientales a monitorear..."
                  className="steep-input w-full"
                />
              </div>

              {contactSent ? (
                <div className="p-4 rounded-[16px] bg-[#f2f2f3] text-[#17191c] text-[15px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#17191c]" />
                  Solicitud registrada. Nos comunicaremos a la brevedad.
                </div>
              ) : (
                <button
                  type="submit"
                  className="steep-btn-filled w-full justify-center"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Enviar solicitud
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="relative z-10 bg-white text-[#777b86] border-t border-[#ececec] py-16 px-6">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <span className="text-[20px] font-serif font-normal text-[#17191c]">
              Steep · SIMOA
            </span>
            <p className="text-[15px] text-[#777b86] max-w-[360px] leading-relaxed">
              Sistema Inteligente de Monitoreo Ambiental. Telemetría continua, control de nodos
              y detección estadística de anomalías térmicas e higrométricas.
            </p>
          </div>

          <div className="space-y-3 text-[15px]">
            <span className="steep-tag uppercase tracking-[0.08em] block">CONSOLA</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="hover:text-[#17191c] cursor-pointer"
                >
                  Monitoreo en vivo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('devices')}
                  className="hover:text-[#17191c] cursor-pointer"
                >
                  Dispositivos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="hover:text-[#17191c] cursor-pointer"
                >
                  Histórico y exportación
                </button>
              </li>
              <li>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="hover:text-[#17191c] cursor-pointer"
                >
                  Diagnóstico IA
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[15px]">
            <span className="steep-tag uppercase tracking-[0.08em] block">SISTEMA</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <a href="#modulos" className="hover:text-[#17191c]">
                  Módulos
                </a>
              </li>
              <li>
                <a href="#capacidades" className="hover:text-[#17191c]">
                  Capacidades
                </a>
              </li>
              <li>
                <a href="#arquitectura" className="hover:text-[#17191c]">
                  Arquitectura
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-[#17191c]">
                  Contacto
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto mt-12 pt-8 border-t border-[#ececec] flex flex-wrap items-center justify-between gap-4 text-[14px] text-[#979799]">
          <span>© 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental</span>
          <span>Consola IoT · Luz Eliana Sánchez Tovar</span>
        </div>
      </footer>
    </div>
  );
};
