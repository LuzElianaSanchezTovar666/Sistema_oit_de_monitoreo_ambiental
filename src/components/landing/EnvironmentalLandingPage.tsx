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
  Search,
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
      {/* Fondo editorial interactivo Steep con curvas gesturales */}
      <EnvironmentalThreeBackground />

      {/* 1. TOP ANNOUNCEMENT BANNER — Editorial whisper */}
      {showAnnouncement && (
        <aside aria-label="Aviso del sistema" className="relative z-20 w-full bg-[#fafafb] border-b border-[#ececec] text-[#777b86] px-6 py-2.5 text-center text-[15px] flex items-center justify-center gap-3">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#5d2a1a]" />
            <span>SIMOA v2.4 · Telemetría IoT y diagnóstico multivariante en tiempo real</span>
          </span>
          <button
            onClick={() => setShowAnnouncement(false)}
            aria-label="Cerrar aviso"
            className="absolute right-4 p-1 rounded-full hover:bg-[#f2f2f3] text-[#777b86] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* 2. NAVIGATION BAR — Steep Transparent Top Bar */}
      <header className="relative z-20 bg-white/80 backdrop-blur-md border-b border-[#ececec]">
        <div className="max-w-[1200px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          <a href="#inicio" className="flex items-center gap-3 shrink-0 focus:outline-none">
            <span className="text-[22px] font-serif font-normal text-[#17191c] tracking-[-0.02em]">
              SIMOA
            </span>
            <span className="hidden sm:inline-block text-[13px] text-[#979799] border-l border-[#ececec] pl-3">
              Monitoreo Ambiental
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-8 text-[16px] font-normal text-[#17191c]">
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

          <div className="flex items-center gap-4">
            <a
              href="#contacto"
              className="hidden sm:inline-block text-[16px] text-[#17191c] hover:underline cursor-pointer"
            >
              Soporte
            </a>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="steep-btn-filled text-[15px]"
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

      {/* 3. HERO SECTION — Steep Editorial Headline + Floating Product Artifact Collage */}
      <section id="inicio" className="relative z-10 pt-16 pb-24 px-6">
        {skeletonMode ? (
          <div className="max-w-[1200px] mx-auto">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto space-y-16">
            {/* Centered Editorial Serif Headline */}
            <div className="max-w-[880px] mx-auto text-center space-y-6">
              <p className="steep-tag uppercase tracking-[0.08em]">
                CONSOLA IOT · INVERNADEROS Y REDES DE SENSORES
              </p>
              <h1 className="steep-display font-serif font-normal">
                Supervisión ambiental precisa, <span className="italic font-serif">sin puntos ciegos.</span>
              </h1>
              <p className="steep-subheading max-w-[620px] mx-auto">
                Telemetría en tiempo real sobre nodos ESP32, series temporales de temperatura y humedad,
                y diagnóstico predictivo con inteligencia artificial.
              </p>
              {/* Matched Pill Button Pair */}
              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-btn-filled"
                >
                  Iniciar monitoreo
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
                <a
                  href="#modulos"
                  className="steep-btn-ghost"
                >
                  Explorar módulos
                </a>
              </div>
            </div>

            {/* Collage of Floating Product Artifacts around Hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              {/* Floating Artifact 1: Telemetry Stat Card with Sienna minimal line */}
              <div className="steep-card-artifact space-y-4">
                <div className="flex items-center justify-between">
                  <span className="steep-tag">ZONA GERMINACIÓN · DHT22</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#17191c]" />
                </div>
                <div>
                  <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                    23.4 °C
                  </div>
                  <div className="text-[14px] text-[#777b86] mt-1">
                    ↑ 0.2°C vs banda nominal (18–26 °C)
                  </div>
                </div>
                <div className="h-10 flex items-end gap-1 pt-2">
                  {[22, 24, 25, 23, 22, 23, 24, 24, 23.4].map((val, i) => (
                    <div
                      key={i}
                      style={{ height: `${((val - 20) / 6) * 100}%` }}
                      className="flex-1 rounded-full bg-[#17191c]/20 hover:bg-[#5d2a1a] transition-colors"
                    />
                  ))}
                </div>
              </div>

              {/* Floating Artifact 2: AI Input / Composer */}
              <div className="steep-card-artifact flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="steep-tag">DIAGNÓSTICO PREDICTIVO</span>
                  <span className="text-[12px] text-[#5d2a1a] font-medium bg-[#fbe1d1] px-2.5 py-0.5 rounded-full">
                    Isolation Forest
                  </span>
                </div>
                <div>
                  <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                    0.04 σ
                  </div>
                  <div className="text-[14px] text-[#777b86] mt-1">
                    Z-Score normal · Latencia 142 ms
                  </div>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={composerQuery}
                    onChange={(e) => setComposerQuery(e.target.value)}
                    placeholder="Consultar estado de recinto..."
                    className="steep-input w-full pr-12 text-[14px] py-2"
                  />
                  <button
                    onClick={() => onEnterSystem('ai')}
                    className="absolute right-1.5 w-8 h-8 rounded-full bg-[#17191c] text-white flex items-center justify-center cursor-pointer hover:bg-[#33363d] transition-colors"
                    aria-label="Enviar consulta"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Floating Artifact 3: Nodes & Connectivity */}
              <div className="steep-card-artifact space-y-4">
                <div className="flex items-center justify-between">
                  <span className="steep-tag">RED DE SENSORES IOT</span>
                  <span className="text-[12px] text-[#777b86]">MQTTS 8883</span>
                </div>
                <div>
                  <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                    12 / 12
                  </div>
                  <div className="text-[14px] text-[#777b86] mt-1">
                    Nodos en línea · Ping 18 ms
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {['DHT22', 'BME280', 'SHT31', 'ESP32'].map((tag) => (
                    <div
                      key={tag}
                      className="py-1 px-2 rounded-full bg-[#f2f2f3] text-center text-[11px] font-medium text-[#17191c]"
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subtle Brand Tag Row */}
            <div className="pt-8 border-t border-[#ececec] flex flex-wrap items-center justify-between gap-6 text-[#979799] text-[14px]">
              <span>ESP32-WROOM</span>
              <span>BOSCH BME280</span>
              <span>SENSIRION SHT31</span>
              <span>MOSQUITTO TLS 1.3</span>
              <span>SCIKIT-LEARN 3σ</span>
            </div>
          </div>
        )}
      </section>

      {/* 4. EDITORIAL PEACH CARD — Signature Warm Highlight Callout */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-[1200px] mx-auto steep-card-peach grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-3">
            <span className="text-[13px] uppercase tracking-[0.1em] text-[#5d2a1a] font-medium">
              TRAZABILIDAD AMBIENTAL CALIBRADA
            </span>
            <h2 className="text-[32px] md:text-[38px] font-serif font-normal text-[#5d2a1a] leading-tight">
              Diseñado para recintos donde cada décima de grado cuenta.
            </h2>
            <p className="text-[17px] text-[#5d2a1a]/80 max-w-[620px] leading-relaxed">
              SIMOA consolida lecturas continuas con certificación de umbrales y alertas anti-rebote,
              garantizando una cadena de frío y humedad auditable bajo estándares técnicos estrictos.
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

      {/* 5. MODULES PREVIEW — Neutral Card Surface with Clean Tab Switcher */}
      <section id="modulos" className="relative z-10 py-16 px-6 bg-[#fafafb]">
        <div className="max-w-[1200px] mx-auto space-y-12">
          <div className="max-w-[720px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em]">MÓDULOS DEL SISTEMA</span>
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
                onClick={() => onEnterSystem(currentFeature.id === 'ai' ? 'ai' : currentFeature.id === 'devices' ? 'devices' : currentFeature.id === 'alerts' ? 'alerts' : 'dashboard')}
                className="steep-link font-medium cursor-pointer"
              >
                Abrir vista completa de {currentFeature.label} →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CAPABILITIES & ARCHITECTURE — 3-Column Neutral Card Grid */}
      <section id="capacidades" className="relative z-10 py-24 px-6 bg-white">
        <div className="max-w-[1200px] mx-auto space-y-16">
          <div id="arquitectura" className="max-w-[700px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em]">ARQUITECTURA Y CAPACIDADES</span>
            <h2 className="steep-heading font-serif font-normal">
              Ingeniería de monitoreo construida para operar con absoluta serenidad.
            </h2>
            <p className="steep-subheading">
              Cada componente ha sido diseñado para priorizar fiabilidad, legibilidad y precisión técnica.
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

      {/* 7. CONTACT & DEPLOYMENT SECTION */}
      <section id="contacto" className="relative z-10 py-20 px-6 bg-[#fafafb] border-t border-[#ececec]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <span className="steep-tag uppercase tracking-[0.08em]">CONTACTO TÉCNICO</span>
            <h2 className="steep-heading font-serif font-normal">
              Integra SIMOA en tus recintos ambientales.
            </h2>
            <p className="text-[17px] text-[#777b86] leading-relaxed">
              Solicita asistencia técnica o prueba el simulador de campo integrado para calibrar
              umbrales, validar debouncing de 5 minutos y verificar alertas automáticas.
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

      {/* 8. FOOTER — Quiet Paper White with Hairline Border */}
      <footer className="relative z-10 bg-white text-[#777b86] border-t border-[#ececec] py-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <span className="text-[20px] font-serif font-normal text-[#17191c]">
              SIMOA
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

        <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-[#ececec] flex flex-wrap items-center justify-between gap-4 text-[14px] text-[#979799]">
          <span>© 2026 SIMOA · Sistema Inteligente de Monitoreo Ambiental</span>
          <span>Consola IoT · Luz Eliana Sánchez Tovar</span>
        </div>
      </footer>
    </div>
  );
};
