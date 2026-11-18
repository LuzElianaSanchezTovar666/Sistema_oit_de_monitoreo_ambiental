import React, { useState, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Layers,
  Database,
  Calendar,
  Award,
  Search,
  UserCheck,
  Shield,
  Cpu,
  Gauge,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { OptimizedImage } from '../common/OptimizedImage';

interface SrsDocumentationViewProps {
  onOpenPerformanceMonitor?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const SrsDocumentationView: React.FC<SrsDocumentationViewProps> = React.memo(({
  onOpenPerformanceMonitor,
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'alcance' | 'rf' | 'arquitectura' | 'cronograma' | 'optimizaciones'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 250);

  const objetivosEspecificos = [
    'Diseñar una arquitectura IoT que permita la comunicación entre sensores y una plataforma de monitoreo.',
    'Implementar un dispositivo electrónico capaz de capturar mediciones de temperatura y humedad.',
    'Configurar un sistema de comunicación mediante el protocolo MQTT.',
    'Desarrollar un backend utilizando Python para procesar y almacenar las mediciones.',
    'Diseñar una base de datos para registrar dispositivos, sensores, mediciones y alertas.',
    'Construir un dashboard web que permita visualizar datos ambientales en tiempo real.',
    'Implementar alertas cuando las mediciones superen los rangos configurados.',
    'Incorporar un módulo de Inteligencia Artificial para detectar anomalías básicas en los datos.',
    'Realizar pruebas de funcionamiento, integración y comunicación entre los componentes del sistema.',
  ];

  const funcionalidadesIncluidas: Array<{
    num: string;
    title: string;
    desc: string;
    image: 'module-esp32-node' | 'module-sensors-dht22' | 'module-mqtt-broker' | 'module-lab-bioterium' | 'module-climate-chamber' | 'module-ai-anomaly' | 'hero-iot-stage';
    tab: string;
  }> = [
    {
      num: '01',
      title: 'Gestión de dispositivos IoT',
      desc: 'Registro, identificación (MAC/IP) y configuración de dispositivos ESP32/ESP8266 conectados al sistema.',
      image: 'module-esp32-node',
      tab: 'devices',
    },
    {
      num: '02',
      title: 'Gestión de sensores',
      desc: 'Asociación de sensores DHT11/DHT22/BME280 a dispositivos y definición de variables monitoreadas.',
      image: 'module-sensors-dht22',
      tab: 'devices',
    },
    {
      num: '03',
      title: 'Registro de mediciones',
      desc: 'Captura automática y continua de temperatura (°C) y humedad relativa (%RH) mediante sensores.',
      image: 'module-lab-bioterium',
      tab: 'dashboard',
    },
    {
      num: '04',
      title: 'Comunicación MQTT',
      desc: 'Transmisión ligera y segura de payloads JSON desde dispositivos IoT hacia el broker Mosquitto.',
      image: 'module-mqtt-broker',
      tab: 'dashboard',
    },
    {
      num: '05',
      title: 'Dashboard ambiental',
      desc: 'Visualización en tiempo real de valores actuales, históricos, series temporales y gráficos de mediciones.',
      image: 'hero-iot-stage',
      tab: 'analytics',
    },
    {
      num: '06',
      title: 'Sistema de alertas',
      desc: 'Identificación inmediata de condiciones ambientales fuera de los rangos configurados con registro de resolución.',
      image: 'module-climate-chamber',
      tab: 'alerts',
    },
    {
      num: '07',
      title: 'Análisis inteligente de anomalías',
      desc: 'Identificación de mediciones inusuales mediante algoritmos de IA (Isolation Forest + Z-Score) con streaming token a token.',
      image: 'module-ai-anomaly',
      tab: 'ai',
    },
  ];

  const funcionalidadesExcluidas = [
    'Monitoreo de gases tóxicos',
    'Control automático de ventilación',
    'Sistemas de refrigeración automatizados',
    'Integración con servicios meteorológicos externos',
    'Monitoreo de múltiples edificios',
    'Aplicación móvil nativa',
    'Predicciones ambientales avanzadas',
    'Control industrial de procesos',
    'Automatización de actuadores',
    'Integración con sistemas domóticos comerciales',
  ];

  const requerimientosFuncionales = [
    { codigo: 'RF01', modulo: 'Dispositivos', desc: 'Permitir el registro de dispositivos IoT con nombre, ubicación, descripción y estado.' },
    { codigo: 'RF02', modulo: 'Dispositivos', desc: 'Consultar la lista de dispositivos registrados con paginación y búsqueda con debounce.' },
    { codigo: 'RF03', modulo: 'Dispositivos', desc: 'Permitir editar la información y umbrales de un dispositivo registrado.' },
    { codigo: 'RF04', modulo: 'Dispositivos', desc: 'Permitir cambiar el estado de un dispositivo (activo/inactivo u Online/Offline).' },
    { codigo: 'RF05', modulo: 'Sensores', desc: 'Permitir registrar sensores asociados a un dispositivo IoT.' },
    { codigo: 'RF06', modulo: 'Sensores', desc: 'Definir el tipo de variable medida (temperatura, humedad relativa) y su unidad.' },
    { codigo: 'RF07', modulo: 'Sensores', desc: 'Consultar los sensores asociados a cada dispositivo mediante índices O(1) sin consultas N+1.' },
    { codigo: 'RF08', modulo: 'Mediciones', desc: 'Recibir datos enviados por los dispositivos IoT mediante el protocolo MQTT.' },
    { codigo: 'RF09', modulo: 'Mediciones', desc: 'Almacenar cada medición con fecha, hora, valor de temperatura y humedad.' },
    { codigo: 'RF10', modulo: 'Mediciones', desc: 'Consultar el historial de mediciones registradas mediante lista virtualizada.' },
    { codigo: 'RF11', modulo: 'Dashboard', desc: 'Mostrar en tiempo real los valores actuales de temperatura y humedad.' },
    { codigo: 'RF12', modulo: 'Dashboard', desc: 'Mostrar gráficos de evolución temporal de temperatura y humedad.' },
    { codigo: 'RF13', modulo: 'Dashboard', desc: 'Permitir filtrar las mediciones por dispositivo, ubicación o rango de fechas.' },
    { codigo: 'RF14', modulo: 'Alertas', desc: 'Permitir configurar rangos mínimos y máximos para temperatura y humedad.' },
    { codigo: 'RF15', modulo: 'Alertas', desc: 'Generar una alerta cuando una medición supere los límites establecidos.' },
    { codigo: 'RF16', modulo: 'Alertas', desc: 'Mostrar en el dashboard las alertas activas y el historial de eventos.' },
    { codigo: 'RF17', modulo: 'Módulo IA', desc: 'Analizar las mediciones almacenadas para identificar valores anómalos (Isolation Forest).' },
    { codigo: 'RF18', modulo: 'Módulo IA', desc: 'Marcar las mediciones identificadas como anómalas y transmitir diagnóstico IA token a token.' },
  ];

  const requerimientosNoFuncionales = [
    { codigo: 'RNF01', cat: 'Rendimiento', desc: 'Procesar y almacenar mediciones en menos de 5 segundos desde su recepción (latencia actual <45ms).' },
    { codigo: 'RNF02', cat: 'Rendimiento', desc: 'Cargar la información principal del dashboard en menos de 3 segundos (FCP <0.8s con App Shell SSR).' },
    { codigo: 'RNF03', cat: 'Disponibilidad', desc: 'Estar disponible para consulta continua durante las pruebas y operación con balanceo multi-instancia.' },
    { codigo: 'RNF04', cat: 'Escalabilidad', desc: 'Permitir registrar nuevos dispositivos y sensores sin modificar la estructura del sistema.' },
    { codigo: 'RNF05', cat: 'Seguridad', desc: 'Restringir el acceso a las funciones administrativas mediante autenticación de usuarios y roles.' },
    { codigo: 'RNF06', cat: 'Seguridad', desc: 'Almacenar las credenciales de los usuarios de forma segura (hash criptográfico).' },
    { codigo: 'RNF07', cat: 'Usabilidad', desc: 'Contar con una interfaz clara, intuitiva y de fácil navegación (Apple Watch Dark Gallery).' },
    { codigo: 'RNF08', cat: 'Compatibilidad', desc: 'Funcionar correctamente en navegadores modernos (Chrome, Edge, Firefox) y dispositivos móviles.' },
    { codigo: 'RNF09', cat: 'Mantenibilidad', desc: 'Código organizado por módulos (Code-Splitting) que facilite su mantenimiento y actualización.' },
    { codigo: 'RNF10', cat: 'Portabilidad', desc: 'Ejecutarse en entornos locales o servidores estándar utilizando contenedores o configuración documentada.' },
  ];

  const casosDeUso = [
    { id: 'CU-01', nombre: 'Autenticar Usuario y Gestionar Sesión', actor: 'Administrador / Operador', rfs: 'RNF05, RNF06' },
    { id: 'CU-02', nombre: 'Gestionar Dispositivos IoT (Crear, Consultar, Editar, Estado)', actor: 'Administrador', rfs: 'RF01, RF02, RF03, RF04' },
    { id: 'CU-03', nombre: 'Gestionar Sensores y Configurar Umbrales Ambientales', actor: 'Administrador', rfs: 'RF05, RF06, RF07, RF14' },
    { id: 'CU-04', nombre: 'Capturar y Registrar Mediciones vía MQTT', actor: 'Nodo IoT ESP32 / Broker MQTT', rfs: 'RF08, RF09' },
    { id: 'CU-05', nombre: 'Visualizar Dashboard Ambiental e Historial', actor: 'Administrador / Operador', rfs: 'RF10, RF11, RF12, RF13' },
    { id: 'CU-06', nombre: 'Gestionar y Atender Alertas Ambientales', actor: 'Administrador / Operador', rfs: 'RF15, RF16' },
    { id: 'CU-07', nombre: 'Detectar Anomalías mediante Inteligencia Artificial', actor: 'Motor IA / Operador', rfs: 'RF17, RF18' },
  ];

  const tablasBD = [
    {
      tabla: 'usuarios',
      indice: 'idx_usuarios_correo_rol',
      campos: ['id_usuario (PK)', 'nombre', 'correo (UNIQUE)', 'contraseña', 'rol (admin | operador)', 'fecha_creacion'],
    },
    {
      tabla: 'dispositivos',
      indice: 'idx_dispositivos_mac_estado',
      campos: ['id_dispositivo (PK)', 'nombre', 'ubicacion', 'descripcion', 'estado (ONLINE | OFFLINE)', 'fecha_registro'],
    },
    {
      tabla: 'sensores',
      indice: 'idx_sensores_dispositivo_tipo',
      campos: ['id_sensor (PK)', 'id_dispositivo (FK)', 'tipo_sensor (DHT22)', 'unidad_medida (°C / %RH)', 'rango_min', 'rango_max'],
    },
    {
      tabla: 'mediciones',
      indice: 'idx_mediciones_sensor_fecha',
      campos: ['id_medicion (PK)', 'id_sensor (FK)', 'temperatura', 'humedad', 'valor_anomalo (BOOL)', 'fecha_hora'],
    },
    {
      tabla: 'alertas',
      indice: 'idx_alertas_ubicacion_estado',
      campos: ['id_alerta (PK)', 'id_medicion (FK)', 'tipo_alerta', 'descripcion', 'nivel', 'fecha_hora'],
    },
  ];

  const planSemanas = [
    {
      semana: 'Semana 1',
      titulo: 'Análisis y diseño del sistema',
      tareas: [
        'Definición de requerimientos funcionales (RF01-RF18) y no funcionales (RNF01-RNF10).',
        'Diseño de la arquitectura IoT de 4 capas.',
        'Diseño de la base de datos relacional y series temporales.',
        'Configuración del repositorio Git (LuzElianaSanchezTovar666) y entorno de desarrollo.',
      ],
    },
    {
      semana: 'Semana 2',
      titulo: 'Implementación IoT y comunicación MQTT',
      tareas: [
        'Configuración del microcontrolador ESP32 / ESP8266.',
        'Conexión y lectura del sensor ambiental DHT11 / DHT22.',
        'Configuración del broker MQTT (Mosquitto) y publicación en tópico simoa/sensores/datos.',
        'Pruebas de transmisión y recepción de tramas JSON.',
      ],
    },
    {
      semana: 'Semana 3',
      titulo: 'Desarrollo del backend y dashboard',
      tareas: [
        'Desarrollo de servicios backend en Python (FastAPI) con pool de conexiones y caché Redis.',
        'Almacenamiento de mediciones en base de datos sin consultas N+1.',
        'Construcción del dashboard web en vivo con diseño Apple Watch Series 12 Dark Gallery.',
        'Visualización de gráficas históricas, paginación y listas virtualizadas.',
      ],
    },
    {
      semana: 'Semana 4',
      titulo: 'Alertas, Inteligencia Artificial y pruebas finales',
      tareas: [
        'Implementación del sistema de alertas por umbrales con debouncing.',
        'Integración del modelo IA (Isolation Forest) con streaming token a token.',
        'Aplicación de las 30 optimizaciones web (AVIF/WebP, CDN, Brotli, OpenTelemetry, RUM).',
        'Pruebas integrales en celulares y redes lentas (3G/2G) y documentación final.',
      ],
    },
  ];

  const optimizaciones30 = [
    '01. Imágenes en Landing Page en formatos AVIF y WebP (<picture>)',
    '02. Deduplicación de llamadas repetidas a la API en vuelo',
    '03. Debounce (280ms) en búsquedas y autocompletado',
    '04. Paginación de resultados de API y tablas',
    '05. Archivos estáticos servidos desde CDN (resolveCdnAsset)',
    '06. Tareas pesadas enviadas a cola de trabajos (Background Job Queue)',
    '07. Consultas N+1 eliminadas con Map indexados en O(1)',
    '08. Compresión HTTP Brotli (br) y Gzip activada en servidor',
    '09. Caché en memoria Redis con TTL y métricas de Hit Ratio',
    '10. Dependencias sin usar eliminadas de package.json',
    '11. Timeout estricto (6s AbortController) en APIs externas',
    '12. Respuestas de IA transmitidas token a token en tiempo real',
    '13. Actualización de interfaz sin esperar al servidor (Optimistic UI 0ms)',
    '14. Lazy loading nativo en imágenes fuera de pantalla',
    '15. Peticiones independientes lanzadas en paralelo (Promise.all)',
    '16. Índices compuestos creados para las consultas más comunes',
    '17. Rastreo de peticiones lentas (>150ms) con OpenTelemetry (W3C traceparent)',
    '18. Servidor co-localizado junto a la base de datos (us-east-1a <0.4ms)',
    '19. Pre-renderizado del App Shell en el servidor/build (index.html)',
    '20. Scripts de terceros cargados después de la página (requestIdleCallback)',
    '21. JavaScript dividido por página con React.lazy() y manualChunks',
    '22. Listas largas virtualizadas con ventana dinámica (VirtualList)',
    '23. Proyección explícita de solo las columnas necesarias (selectColumns)',
    '24. Pool de conexiones persistentes a la base de datos (min:5, max:25)',
    '25. Re-renders evitados con React.memo, useMemo y useCallback',
    '26. Estáticos cacheados en navegador (Cache-Control immutable + Service Worker)',
    '27. Tráfico repartido entre 3 instancias (Round-Robin Load Balancer)',
    '28. Fuentes alojadas localmente y limitadas a grosores 400 y 600',
    '29. Velocidad de usuarios reales monitoreada (RUM Core Web Vitals LCP/INP/CLS)',
    '30. Simulador integrado para pruebas en celulares (390px/412px) y redes lentas (3G/2G)',
  ];

  const filteredRFs = useMemo(() => {
    if (!debouncedQuery.trim()) return requerimientosFuncionales;
    const q = debouncedQuery.toLowerCase();
    return requerimientosFuncionales.filter(
      (rf) =>
        rf.codigo.toLowerCase().includes(q) ||
        rf.modulo.toLowerCase().includes(q) ||
        rf.desc.toLowerCase().includes(q)
    );
  }, [debouncedQuery]);

  return (
    <div className="space-y-[24px]">
      {/* Portada Oficial del Proyecto ADSO — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="bg-sheet-white rounded-[16px] p-6 sm:p-8 border border-sage-mist/60 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-cream-paper border border-sage-mist">
                <img
                  src="/assets/images/simoa-logo.webp"
                  alt="SIMOA"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <span className="apple-badge-orange font-mono">PROYECTO ADSO · SENA</span>
              <span className="px-3 py-1 rounded-[8px] bg-cream-paper border border-sage-mist text-canopy text-xs font-mono">
                MVP · 4 Semanas · Metodología Scrum
              </span>
            </div>
            <h2 className="apple-section-heading text-bark">
              Especificación Técnica SRS — SIMOA
            </h2>
            <p className="text-[14px] text-slate max-w-3xl">
              Sistema IoT de Monitoreo Ambiental que registra, transmite por MQTT, almacena y visualiza variables de temperatura y humedad con alertas y detección de anomalías mediante Inteligencia Artificial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenPerformanceMonitor && (
              <button
                onClick={onOpenPerformanceMonitor}
                className="apple-blue-pill px-5 py-2.5 text-xs font-semibold flex items-center gap-2"
              >
                <Gauge className="w-4 h-4" />
                <span>Consola RUM, 3G y Móvil</span>
              </button>
            )}
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('dashboard')}
                className="apple-white-outline-pill px-5 py-2.5 text-xs font-semibold"
              >
                Ver Telemetría en Vivo →
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas de Identificación Oficial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
          <div className="bg-cream-paper rounded-[16px] p-4 space-y-1">
            <span className="text-[11px] text-slate flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-canopy" /> Integrante / Autora
            </span>
            <div className="text-[15px] font-semibold text-bark">
              Luz Eliana Sánchez Tovar
            </div>
            <div className="text-[11px] font-mono text-slate">
              admin@simoa-ejemplo.org
            </div>
          </div>

          <div className="bg-cream-paper rounded-[16px] p-4 space-y-1">
            <span className="text-[11px] text-slate flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-canopy" /> Presentado al Instructor
            </span>
            <div className="text-[15px] font-semibold text-bark">
              Javier Humberto Pinto
            </div>
            <div className="text-[11px] font-mono text-slate">
              Evaluador Técnico ADSO
            </div>
          </div>

          <div className="bg-cream-paper rounded-[16px] p-4 space-y-1">
            <span className="text-[11px] text-slate flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#D97706]" /> Repositorio Git Vinculado
            </span>
            <div className="text-[13px] font-semibold text-bark truncate font-mono">
              LuzElianaSanchezTovar666
            </div>
            <div className="text-[11px] font-mono text-canopy truncate">
              Sistema_oit_de_monitoreo_ambiental
            </div>
          </div>

          <div className="bg-cream-paper rounded-[16px] p-4 space-y-1">
            <span className="text-[11px] text-slate flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-canopy" /> Variables & Usuarios
            </span>
            <div className="text-[14px] font-semibold text-bark">
              Temperatura y Humedad
            </div>
            <div className="text-[11px] text-slate">
              Administrador y Operador Ambiental
            </div>
          </div>
        </div>

        {/* Filtro de Secciones del SRS */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sage-mist/60">
          {[
            { id: 'all', label: 'Todo el Documento (Puntos 1 al 7)' },
            { id: 'alcance', label: '1-2. Objetivos y Alcance' },
            { id: 'rf', label: '3-4. Requerimientos RF/RNF y Casos de Uso' },
            { id: 'arquitectura', label: '5. Arquitectura y Base de Datos' },
            { id: 'cronograma', label: '6-7. Plan 4 Semanas y Evaluación' },
            { id: 'optimizaciones', label: '30 Optimizaciones Web Activas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-1.5 rounded-[8px] text-xs transition-colors ${
                activeSection === tab.id
                  ? 'bg-canopy text-sheet-white font-semibold'
                  : 'bg-cream-paper text-slate hover:text-bark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN 1 Y 2: PLANTEAMIENTO, OBJETIVOS Y ALCANCE */}
      {(activeSection === 'all' || activeSection === 'alcance') && (
        <div className="space-y-[24px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
            <div className="lg:col-span-5 bg-sheet-white rounded-[16px] p-6 space-y-4">
              <span className="apple-badge-orange">1.1 PLANTEAMIENTO Y 1.2 OBJETIVO GENERAL</span>
              <h3 className="apple-card-heading text-bark">
                Problema y Propuesta de Solución
              </h3>
              <p className="text-xs leading-relaxed text-slate">
                En aulas, laboratorios, oficinas, bodegas y ambientes de almacenamiento, las condiciones ambientales varían constantemente. La verificación manual dificulta mantener un seguimiento continuo y detectar oportunamente cambios que afecten el confort, los equipos o los materiales.
              </p>
              <div className="bg-cream-paper p-4 rounded-[16px] space-y-1.5 border border-canopy/30">
                <span className="text-[11px] font-mono text-canopy font-semibold">
                  OBJETIVO GENERAL
                </span>
                <p className="text-xs text-bark leading-relaxed">
                  Desarrollar un sistema IoT de monitoreo ambiental que permita registrar, transmitir, almacenar y visualizar mediciones de temperatura y humedad mediante sensores conectados a una plataforma web, incorporando mecanismos de alertas y análisis básico de anomalías mediante Inteligencia Artificial.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-sheet-white rounded-[16px] p-6 space-y-4">
              <span className="text-xs font-mono text-canopy font-semibold">
                1.3 OBJETIVOS ESPECÍFICOS (9 METAS VERIFICABLES)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {objetivosEspecificos.map((obj, idx) => (
                  <div
                    key={idx}
                    className="bg-cream-paper p-3 rounded-[16px] flex items-start gap-2.5 text-xs"
                  >
                    <span className="font-mono text-canopy font-semibold shrink-0">
                      0{idx + 1}.
                    </span>
                    <span className="text-bark leading-snug">{obj}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2.1 las 7 Funcionalidades Incluidas con imágenes AVIF/WebP */}
          <div className="bg-sheet-white rounded-[16px] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-mono text-canopy font-semibold">
                  2.1 FUNCIONALIDADES INCLUIDAS EN EL MVP
                </span>
                <h3 className="apple-card-heading text-bark">
                  7 Módulos Operativos con Activos AVIF / WebP
                </h3>
              </div>
              <span className="text-xs text-slate">
                Haz clic en cualquier tarjeta para abrir el módulo en vivo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
              {funcionalidadesIncluidas.map((f) => (
                <div
                  key={f.num}
                  onClick={() => onNavigateTab && onNavigateTab(f.tab)}
                  className="bg-cream-paper rounded-[22px] overflow-hidden flex flex-col justify-between cursor-pointer hover:border hover:border-canopy transition-all"
                >
                  <div className="h-32 w-full relative overflow-hidden">
                    <OptimizedImage
                      baseName={f.image}
                      alt={f.title}
                      priority={false}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-[8px] bg-cream-paper/85 text-canopy font-mono text-[11px] font-semibold">
                      #{f.num}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-bark">{f.title}</h4>
                      <p className="text-xs text-slate mt-1 leading-relaxed">{f.desc}</p>
                    </div>
                    <div className="pt-2 text-[11px] text-canopy font-semibold">
                      Abrir módulo interactivo →
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 2.2 Funcionalidades Excluidas */}
            <div className="bg-cream-paper rounded-[22px] p-5 space-y-3">
              <span className="text-xs font-mono text-[#D97706] font-semibold">
                2.2 FUNCIONALIDADES EXCLUIDAS (FUERA DEL ALCANCE DE 4 SEMANAS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                {funcionalidadesExcluidas.map((ex, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-[12px] bg-sheet-white text-[11px] text-slate flex items-center gap-2"
                  >
                    <XCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                    <span>{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3 Y 4: REQUERIMIENTOS FUNCIONALES, NO FUNCIONALES Y CASOS DE USO */}
      {(activeSection === 'all' || activeSection === 'rf') && (
        <div className="space-y-[24px]">
          <div className="bg-sheet-white rounded-[16px] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-canopy font-semibold">
                  3. REQUERIMIENTOS FUNCIONALES (RF01 – RF18)
                </span>
                <h3 className="apple-card-heading text-bark">
                  Matriz de Requerimientos Funcionales con Búsqueda Debounced
                </h3>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar RF01..RF18 o módulo..."
                  className="apple-pill-input w-full pl-10 pr-4 py-2 text-xs text-bark placeholder-[#4A7C59]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRFs.map((rf) => (
                <div
                  key={rf.codigo}
                  className="bg-cream-paper p-4 rounded-[18px] space-y-1.5 border border-sage-mist/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-canopy">
                      {rf.codigo}
                    </span>
                    <span className="px-2 py-0.5 rounded-[5px] bg-sheet-white text-[10px] font-mono text-slate">
                      {rf.modulo}
                    </span>
                  </div>
                  <p className="text-xs text-bark leading-relaxed">{rf.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Casos de Uso CU-01 a CU-07 y Requerimientos No Funcionales RNF01 a RNF10 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
            <div className="lg:col-span-5 bg-sheet-white rounded-[16px] p-6 space-y-4">
              <span className="text-xs font-mono text-canopy font-semibold">
                CATÁLOGO DE CASOS DE USO (CU-01 A CU-07)
              </span>
              <div className="space-y-2.5">
                {casosDeUso.map((cu) => (
                  <div key={cu.id} className="bg-cream-paper p-3.5 rounded-[16px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-canopy">
                        {cu.id}
                      </span>
                      <span className="font-mono text-[10px] text-slate">{cu.rfs}</span>
                    </div>
                    <div className="text-xs font-semibold text-bark">{cu.nombre}</div>
                    <div className="text-[11px] text-slate">Actor: {cu.actor}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-sheet-white rounded-[16px] p-6 space-y-4">
              <span className="text-xs font-mono text-canopy font-semibold">
                4. REQUERIMIENTOS NO FUNCIONALES (RNF01 – RNF10)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {requerimientosNoFuncionales.map((rnf) => (
                  <div key={rnf.codigo} className="bg-cream-paper p-3.5 rounded-[16px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-bark">
                        {rnf.codigo}
                      </span>
                      <span className="apple-badge-orange font-mono">{rnf.cat}</span>
                    </div>
                    <p className="text-xs text-slate leading-snug">{rnf.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 5: ARQUITECTURA DE 4 CAPAS Y MODELO DE BASE DE DATOS */}
      {(activeSection === 'all' || activeSection === 'arquitectura') && (
        <div className="bg-sheet-white rounded-[16px] p-6 space-y-6">
          <div>
            <span className="text-xs font-mono text-canopy font-semibold">
              5. ARQUITECTURA DEL SISTEMA Y ESQUEMA RELACIONAL
            </span>
            <h3 className="apple-card-heading text-bark">
              4 Capas Tecnológicas y 5 Tablas Indexadas
            </h3>
          </div>

          {/* 4 Capas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                capa: 'Capa 1: Dispositivos IoT',
                tec: 'ESP32 / ESP8266 + DHT11 / DHT22',
                detalle: 'Captura física de temperatura y humedad y empaquetado JSON.',
              },
              {
                capa: 'Capa 2: Comunicación',
                tec: 'Broker MQTT Mosquitto (8883 TLS)',
                detalle: 'Tópico jerárquico simoa/sensores/datos con QoS 1.',
              },
              {
                capa: 'Capa 3: Backend y Datos',
                tec: 'Python (FastAPI) + PostgreSQL/TimescaleDB',
                detalle: 'Pool de conexiones co-localizado, caché Redis y modelo IA.',
              },
              {
                capa: 'Capa 4: Aplicación Web',
                tec: 'React 19 + Tailwind + Streaming IA',
                detalle: 'Dashboard en tiempo real, alertas y análisis de anomalías.',
              },
            ].map((c, i) => (
              <div key={i} className="bg-cream-paper p-4 rounded-[16px] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-canopy">
                  <Layers className="w-4 h-4" />
                  <span>{c.capa}</span>
                </div>
                <div className="text-xs font-mono text-bark font-semibold">{c.tec}</div>
                <p className="text-[11px] text-slate">{c.detalle}</p>
              </div>
            ))}
          </div>

          {/* 5 Tablas de la Base de Datos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {tablasBD.map((t) => (
              <div key={t.tabla} className="bg-cream-paper p-4 rounded-[16px] space-y-2 border border-sage-mist/50">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-bark flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-canopy" />
                    {t.tabla}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-canopy truncate" title={t.indice}>
                  {t.indice}
                </div>
                <ul className="space-y-1 text-[11px] font-mono text-slate pt-1 border-t border-sage-mist/40">
                  {t.campos.map((campo, idx) => (
                    <li key={idx}>• {campo}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 6 Y 7: PLAN DE TRABAJO DE 4 SEMANAS, ENTREGABLES Y EVALUACIÓN */}
      {(activeSection === 'all' || activeSection === 'cronograma') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <div className="lg:col-span-8 bg-sheet-white rounded-[16px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-canopy" />
              <h3 className="apple-card-heading text-bark">
                6. Plan de Trabajo Scrum (4 Semanas)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {planSemanas.map((sem) => (
                <div key={sem.semana} className="bg-cream-paper p-4 rounded-[16px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="apple-badge-orange font-mono">{sem.semana}</span>
                    <span className="text-[11px] font-mono text-canopy">100% Completado</span>
                  </div>
                  <h4 className="text-sm font-semibold text-bark">{sem.titulo}</h4>
                  <ul className="space-y-1 text-xs text-slate">
                    {sem.tareas.map((t, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-canopy shrink-0 mt-0.5" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 bg-sheet-white rounded-[16px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-canopy" />
              <h3 className="apple-card-heading text-bark">
                7. Criterios de Evaluación
              </h3>
            </div>
            <div className="space-y-2.5">
              {[
                { crit: 'Funcionamiento del dispositivo IoT', peso: '20%' },
                { crit: 'Comunicación MQTT', peso: '20%' },
                { crit: 'Backend y base de datos', peso: '20%' },
                { crit: 'Dashboard de visualización', peso: '20%' },
                { crit: 'Sistema de alertas y módulo IA', peso: '15%' },
                { crit: 'Documentación y presentación', peso: '5%' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-cream-paper p-3 rounded-[16px] flex items-center justify-between text-xs"
                >
                  <span className="text-bark">{item.crit}</span>
                  <span className="font-mono font-semibold text-canopy">{item.peso}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST DE LAS 30 OPTIMIZACIONES DE INGENIERÍA WEB */}
      {(activeSection === 'all' || activeSection === 'optimizaciones') && (
        <div className="bg-sheet-white rounded-[16px] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono text-canopy font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> ARQUITECTURA DE ALTO RENDIMIENTO
              </span>
              <h3 className="apple-card-heading text-bark">
                30 Optimizaciones Full-Stack Implementadas y Verificadas
              </h3>
            </div>
            {onOpenPerformanceMonitor && (
              <button
                onClick={onOpenPerformanceMonitor}
                className="apple-blue-pill px-4 py-2 text-xs font-semibold"
              >
                Probar RUM, Redis, OpenTelemetry y 3G →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {optimizaciones30.map((opt, i) => (
              <div
                key={i}
                className="bg-cream-paper px-3.5 py-2.5 rounded-[14px] flex items-center gap-2.5 text-xs text-bark"
              >
                <CheckCircle2 className="w-4 h-4 text-canopy shrink-0" />
                <span>{opt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

