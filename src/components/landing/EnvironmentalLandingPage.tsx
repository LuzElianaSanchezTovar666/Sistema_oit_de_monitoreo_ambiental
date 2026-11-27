import React, { useState, useCallback } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  AtSign,
  Clock,
  ChevronRight,
  Sparkles,
  Shield,
  Activity,
  Cpu,
  LineChart,
  Thermometer,
  Droplets,
  AlertTriangle,
  BrainCircuit,
  FileSpreadsheet,
  CheckCircle2,
  Send,
  Server,
  ShieldCheck,
  Radio,
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
  const [composerQuery, setComposerQuery] = useState('');
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

  // Formulario de contacto técnico SIMOA
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
      category: 'FLUJO CONTINUO MQTTS',
      title: 'Supervisión térmica e higrométrica sin puntos ciegos.',
      desc: 'Visualiza lecturas de temperatura (°C) y humedad relativa (%RH) con bandas de tolerancia configurables, cálculo de Z-Score y registro histórico listo para auditoría.',
      metricA: { label: 'Temperatura media', value: '23.4 °C', delta: '↑ 0.2° vs promedio histórico' },
      metricB: { label: 'Humedad relativa', value: '61.8 %RH', delta: 'Estable en banda 40–70%' },
      metricC: { label: 'Score anomalía IA', value: '0.04 σ', delta: 'Isolation Forest nominal' },
    },
    {
      id: 'devices',
      label: 'Nodos ESP32',
      category: 'GESTIÓN DE HARDWARE',
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

  const currentFeature = featureTabs[activeFeatureTab];

  return (
    <div className="relative min-h-screen bg-white text-[#17191c] selection:bg-[#fbe1d1] selection:text-[#5d2a1a] overflow-x-hidden font-sans">
      {/* Steep Ambient Glow Background Aura */}
      <EnvironmentalThreeBackground />

      {/* 1. TOP NAVIGATION — Steep Pure Header con Identidad SIMOA */}
      <header className="relative z-30 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          {/* Logo Brand: Geometric Icon + SIMOA Wordmark */}
          <a href="#inicio" className="flex items-center gap-2.5 shrink-0 focus:outline-none">
            <div className="w-7 h-7 rounded-full bg-[#17191c] flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H8l5-7v4h3l-5 7z" />
              </svg>
            </div>
            <span className="text-[21px] font-serif font-normal text-[#17191c] tracking-[-0.03em]">
              SIMOA
            </span>
          </a>

          {/* Nav Items Center */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-normal text-[#17191c]">
            <a href="#modulos" className="hover:text-[#777b86] transition-colors">
              Módulos
            </a>
            <a href="#capacidades" className="hover:text-[#777b86] transition-colors">
              Capacidades
            </a>
            <a href="#arquitectura" className="hover:text-[#777b86] transition-colors">
              Arquitectura
            </a>
            <a href="#contacto" className="hover:text-[#777b86] transition-colors">
              Contacto
            </a>
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-5">
            <a
              href="#contacto"
              className="hidden sm:inline-block text-[15px] text-[#17191c] hover:underline cursor-pointer"
            >
              Soporte técnico
            </a>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="steep-btn-filled text-[15px] px-5 py-2"
            >
              Abrir consola
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
              { href: '#modulos', label: 'Módulos' },
              { href: '#capacidades', label: 'Capacidades' },
              { href: '#arquitectura', label: 'Arquitectura' },
              { href: '#contacto', label: 'Contacto' },
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
                Abrir consola
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION — Steep Exact Composition con Telemetría SIMOA */}
      <section id="inicio" className="relative z-10 pt-6 pb-28 px-6">
        {skeletonMode ? (
          <div className="max-w-[1240px] mx-auto">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1240px] mx-auto">
            {/* Center Editorial Typography Headline */}
            <div className="max-w-[880px] mx-auto text-center pt-8 pb-14 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2f2f3] border border-[#e5e5e7] text-[13px] text-[#555861] font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" />
                <span>S · I · M · O · A</span>
              </div>

              <h1 className="font-serif font-normal text-[#17191c] text-[58px] sm:text-[80px] lg:text-[96px] leading-[1.02] tracking-[-0.035em]">
                SIMOA
              </h1>

              <p className="font-serif italic text-[24px] sm:text-[34px] lg:text-[42px] text-[#2c2f35] leading-[1.2] tracking-[-0.02em] max-w-[760px] mx-auto">
                <span className="font-semibold not-italic text-[#17191c]">S</span>istema{' '}
                <span className="font-semibold not-italic text-[#17191c]">I</span>nteligente de{' '}
                <span className="font-semibold not-italic text-[#17191c]">M</span>onitoreo{' '}
                <span className="font-semibold not-italic text-[#17191c]">O</span>perativo{' '}
                <span className="font-semibold not-italic text-[#17191c]">A</span>mbiental
              </p>

              <p className="text-[17px] sm:text-[19px] leading-[1.5] text-[#555861] max-w-[640px] mx-auto font-normal">
                Supervisa temperatura, humedad y el estado de tus nodos IoT en tiempo real
                con una interfaz limpia, telemetría verificada y detección de anomalías por IA.
              </p>
              {/* Pair of Pills: Filled + Ghost */}
              <div className="pt-2 flex items-center justify-center gap-4">
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-btn-filled text-[15px] px-6 py-2.5"
                >
                  Iniciar monitoreo
                </button>
                <a
                  href="#modulos"
                  className="steep-btn-ghost text-[15px] px-6 py-2.5"
                >
                  Explorar módulos
                </a>
              </div>
            </div>

            {/* FLOATING PRODUCT ARTIFACT COLLAGE CON DATOS REALES DE SIMOA */}
            <div className="relative w-full max-w-[1140px] mx-auto min-h-[380px] lg:min-h-[440px]">
              {/* ARTIFACT 1: Top-Left Recintos & Telemetry Table with Bar Chart */}
              <div
                className="lg:absolute lg:top-[-110px] lg:left-0 w-full sm:w-[330px] bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-4 mb-6 lg:mb-0"
              >
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Left Metric and Bar Chart */}
                  <div className="space-y-2">
                    <div className="text-[28px] font-medium text-[#17191c] leading-none tabular-nums">
                      23.4 °C
                    </div>
                    <div className="text-[12px] text-[#777b86]">
                      ↑ 0.2° vs media (18–26°)
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
                      <span>1h</span>
                      <span>4h</span>
                      <span>12h</span>
                      <span>24h</span>
                    </div>
                  </div>

                  {/* Right Region / Recintos List */}
                  <div className="space-y-1.5 text-[12px] border-l border-[#ececec] pl-3">
                    <span className="text-[11px] font-medium text-[#17191c] block mb-1">
                      Recintos
                    </span>
                    {[
                      { name: 'Germinación', val: '23.6 °C' },
                      { name: 'Cultivo A1', val: '68.2 %' },
                      { name: 'Climatización', val: '22.1 °C' },
                      { name: 'Fertirriego', val: '74.0 %' },
                      { name: 'Sondas activas', val: '24' },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-[#777b86]">
                        <span className="truncate">{row.name}</span>
                        <span className="text-[#17191c] font-medium tabular-nums">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ARTIFACT 2: Right Registrations / Nodos ESP32 Radial Ring Card */}
              <div
                className="lg:absolute lg:top-[-20px] lg:right-0 w-full sm:w-[290px] bg-[#fbf5f0] rounded-[20px] p-5 border border-[#f3e1d5] shadow-[0_0_0_1px_rgba(4,23,43,0.04),0_16px_24px_-4px_rgba(93,42,26,0.08)] space-y-3 mb-6 lg:mb-0"
              >
                <div className="text-[13px] font-medium text-[#5d2a1a]">
                  Nodos ESP32
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-[32px] font-medium text-[#17191c] leading-none tabular-nums">
                      12 / 12
                    </div>
                    <div className="text-[12px] text-[#777b86] mt-1.5">
                      Ping medio 18 ms
                    </div>
                  </div>

                  {/* Radial Progress Gauge (99.9% Uptime) */}
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
                        strokeDashoffset={2 * Math.PI * 32 * (1 - 0.999)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-[13px] font-semibold text-[#17191c] leading-none">
                        99.9%
                      </div>
                      <div className="text-[9px] text-[#777b86] leading-none mt-0.5">
                        en línea
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 3: Bottom-Left Score Anomalía IA con Cursor "JB" */}
              <div className="lg:absolute lg:bottom-[-20px] lg:left-[40px] w-full sm:w-[320px] mb-6 lg:mb-0">
                {/* JB Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-4 -left-7 z-20 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#dcfce7] border border-[#86efac] text-[#166534] font-medium text-[13px] flex items-center justify-center shadow-sm">
                      JB
                    </div>
                    {/* Mouse pointer cursor arrow */}
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#166534] -ml-1 -mt-3 fill-current drop-shadow-sm">
                      <path d="M2 2l11 4.5-5 1.5-1.5 5L2 2z" />
                    </svg>
                  </div>

                  <div className="bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-3">
                    <div className="text-[13px] font-medium text-[#17191c]">
                      Diagnóstico IA
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-medium text-[#17191c] tabular-nums leading-none">
                        0.04 σ
                      </span>
                      <span className="text-[12px] text-[#777b86]">
                        Isolation Forest nominal
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
                      <span>06:00</span>
                      <span>10:00</span>
                      <span>14:00</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#f2f2f3] text-[#17191c] font-medium">Ahora</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 4: Bottom-Center AI Question Composer con Cursor "AF" */}
              <div className="lg:absolute lg:bottom-[-50px] lg:right-[140px] w-full sm:w-[380px]">
                {/* AF Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-3 -right-3 z-20 flex items-center">
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
                      placeholder="Consultar estado de recintos o incidencias..."
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
                        aria-label="Enviar consulta a IA"
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

      {/* 3. HARDWARE & TECNOLOGÍAS COMPATIBLES */}
      <section className="relative z-10 py-12 px-6 border-y border-[#ececec] bg-white">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-8 text-[#979799] text-[15px] font-medium tracking-tight">
          <span className="hover:text-[#17191c] transition-colors">ESP32-WROOM</span>
          <span className="hover:text-[#17191c] transition-colors">BOSCH BME280</span>
          <span className="hover:text-[#17191c] transition-colors">SENSIRION SHT31</span>
          <span className="hover:text-[#17191c] transition-colors">DHT22</span>
          <span className="hover:text-[#17191c] transition-colors">MOSQUITTO TLS 1.3</span>
          <span className="hover:text-[#17191c] transition-colors">TIMESCALEDB</span>
        </div>
      </section>

      {/* 4. SECCIÓN DE MÓDULOS EN FOG WHITE (#fafafb) */}
      <section id="modulos" className="relative z-10 py-24 px-6 bg-[#fafafb]">
        <div className="max-w-[1240px] mx-auto space-y-16">
          <div className="max-w-[760px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em] block">
              MÓDULOS DEL SISTEMA
            </span>
            <h2 className="font-serif font-normal text-[#17191c] text-[44px] sm:text-[56px] leading-[1.12] tracking-[-0.025em]">
              Un nuevo estándar en analítica ambiental IoT.
            </h2>
            <p className="text-[18px] text-[#777b86] leading-relaxed">
              SIMOA consolida la telemetría continua de temperatura y humedad en recintos críticos,
              proporcionando control de umbrales, alertas anti-rebote y diagnóstico predictivo con IA.
            </p>
          </div>

          {/* 3-Column Grid of Neutral Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">TELEMETRÍA CONTINUA</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Supervisión térmica e higrométrica</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Series temporales a 1 Hz con bandas de tolerancia configurables y cálculo de Z-Score
                  multivariante en tiempo real.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Ver telemetría →
                </button>
              </div>
            </div>

            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">INTELIGENCIA ARTIFICIAL</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Diagnóstico predictivo de fallos</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Isolation Forest y control 3σ detectan excursiones y pérdida de muestras en recintos
                  en menos de 200 ms de latencia.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Ver diagnóstico IA →
                </button>
              </div>
            </div>

            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">AUDITORÍA &amp; REPORTES</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Trazabilidad y reportes GxP</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Consolidación estadística (Mín, Máx, Promedio, Desviación Estándar) y exportación
                  certificada de archivos CSV.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Ver reportes →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TARJETA EDITORIAL DE ACENTO MELOCOTÓN (#fbe1d1) */}
      <section className="relative z-10 py-16 px-6 bg-white">
        <div className="max-w-[1240px] mx-auto steep-card-peach grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-4">
            <span className="text-[13px] uppercase tracking-[0.1em] text-[#5d2a1a] font-medium">
              CALIDAD Y CONFORMIDAD TÉCNICA
            </span>
            <h2 className="text-[34px] md:text-[42px] font-serif font-normal text-[#5d2a1a] leading-tight">
              Diseñado para recintos donde cada décima de grado cuenta.
            </h2>
            <p className="text-[18px] text-[#5d2a1a]/85 max-w-[640px] leading-relaxed">
              "SIMOA consolida lecturas continuas con certificación de umbrales y alertas anti-rebote
              de 5 minutos, garantizando una cadena térmica y de humedad auditable bajo estándares técnicos estrictos."
            </p>
            <div className="text-[14px] text-[#5d2a1a]/70 pt-2 font-medium">
              Luz Eliana Sánchez Tovar · Arquitectura de Consola IoT
            </div>
          </div>
          <div className="flex md:justify-end">
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="bg-[#5d2a1a] text-[#fbe1d1] px-6 py-3 rounded-full text-[15px] font-medium hover:bg-[#431d11] transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              Iniciar monitoreo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. PREVISUALIZACIÓN INTERACTIVA DE MÓDULOS */}
      <section id="capacidades" className="relative z-10 py-24 px-6 bg-[#fafafb] border-t border-[#ececec]">
        <div className="max-w-[1240px] mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-[620px] space-y-3">
              <span className="steep-tag uppercase tracking-[0.08em]">ARQUITECTURA DE DATOS</span>
              <h2 className="font-serif font-normal text-[#17191c] text-[40px] sm:text-[48px] leading-tight">
                {currentFeature.title}
              </h2>
            </div>

            {/* Tab buttons */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-full border border-[#ececec] flex-wrap">
              {featureTabs.map((tab, idx) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(idx)}
                  className={`px-5 py-2 rounded-full text-[14px] transition-colors cursor-pointer ${
                    activeFeatureTab === idx
                      ? 'bg-[#17191c] text-white font-normal'
                      : 'text-[#777b86] hover:text-[#17191c]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Floating Product Artifact */}
          <div className="steep-card-artifact p-8 sm:p-12 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececec] pb-6">
              <div>
                <span className="steep-tag">{currentFeature.category}</span>
                <h3 className="text-[26px] font-medium text-[#17191c] mt-1">
                  {currentFeature.label} · Consola en vivo
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2f2f3] text-[13px] text-[#17191c] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#17191c] animate-pulse" />
                Flujo MQTT Activo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">{currentFeature.metricA.label}</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  {currentFeature.metricA.value}
                </div>
                <div className="text-[13px] text-[#979799] pt-1">{currentFeature.metricA.delta}</div>
              </div>

              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">{currentFeature.metricB.label}</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  {currentFeature.metricB.value}
                </div>
                <div className="text-[13px] text-[#979799] pt-1">{currentFeature.metricB.delta}</div>
              </div>

              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">{currentFeature.metricC.label}</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  {currentFeature.metricC.value}
                </div>
                <div className="text-[13px] text-[#979799] pt-1">{currentFeature.metricC.delta}</div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => onEnterSystem(currentFeature.id === 'ai' ? 'ai' : currentFeature.id === 'devices' ? 'devices' : currentFeature.id === 'alerts' ? 'alerts' : 'dashboard')}
                className="steep-btn-filled text-[15px] px-6 py-2.5"
              >
                Abrir vista completa en consola →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CONTACTO TÉCNICO & HARDWARE */}
      <section id="contacto" className="relative z-10 py-20 px-6 bg-white border-t border-[#ececec]">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <span className="steep-tag uppercase tracking-[0.08em]">CONTACTO TÉCNICO</span>
            <h2 className="font-serif font-normal text-[#17191c] text-[40px] leading-tight">
              Integra SIMOA con tus nodos ESP32.
            </h2>
            <p className="text-[17px] text-[#777b86] leading-relaxed">
              Solicita asistencia técnica o prueba el simulador de campo integrado para validar
              umbrales térmicos, alertas anti-rebote de 5 minutos y reportes certificados.
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
                  Correo institucional
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
                  Hardware de interés
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
                  Mensaje o requerimiento técnico
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
                  Solicitud registrada correctamente. Nos comunicaremos a la brevedad.
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

      {/* 8. FOOTER — Quiet Paper White */}
      <footer id="arquitectura" className="relative z-10 bg-white text-[#777b86] border-t border-[#ececec] py-16 px-6">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#17191c]" />
              <span className="text-[20px] font-serif font-normal text-[#17191c]">SIMOA</span>
            </div>
            <p className="text-[15px] text-[#777b86] max-w-[340px] leading-relaxed">
              Sistema Inteligente de Monitoreo Ambiental IoT. Telemetría continua, control de nodos
              ESP32 y detección estadística de anomalías térmicas e higrométricas.
            </p>
          </div>

          <div className="space-y-3 text-[14px]">
            <span className="steep-tag uppercase tracking-[0.08em] block font-medium">CONSOLA</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <button onClick={() => onEnterSystem('dashboard')} className="hover:text-[#17191c] cursor-pointer">
                  Monitoreo en vivo
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('devices')} className="hover:text-[#17191c] cursor-pointer">
                  Dispositivos
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('analytics')} className="hover:text-[#17191c] cursor-pointer">
                  Histórico y exportación
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('ai')} className="hover:text-[#17191c] cursor-pointer">
                  Diagnóstico IA
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <span className="steep-tag uppercase tracking-[0.08em] block font-medium">SISTEMA</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <a href="#modulos" className="hover:text-[#17191c]">Módulos</a>
              </li>
              <li>
                <a href="#capacidades" className="hover:text-[#17191c]">Capacidades</a>
              </li>
              <li>
                <a href="#arquitectura" className="hover:text-[#17191c]">Arquitectura MQTTS</a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-[#17191c]">Contacto</a>
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
