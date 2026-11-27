import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Cpu,
  Thermometer,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Shield,
  Wrench,
  Activity,
  UserCheck,
} from 'lucide-react';
import { Usuario } from '../../types/iot';
import { fetchCurrentUser, loginWithCredentials } from '../../services/authService';

export const DEMO_ROLE_CREDENTIALS = [
  {
    role: 'Administrador',
    title: 'Administrador',
    email: 'admin@simoa.org',
    password: 'AdminPassword123!',
    desc: 'Acceso total y configuración',
    color: 'border-[#ececec] bg-white text-[#17191c] hover:bg-[#f2f2f3]',
    badge: 'bg-[#f2f2f3] text-[#17191c]',
    icon: Shield,
  },
  {
    role: 'Técnico',
    title: 'Técnico (Sensores IoT)',
    email: 'tecnico@simoa.org',
    password: 'TecnicoPassword123!',
    desc: 'Calibración y red de sensores',
    color: 'border-[#fbe1d1] bg-[#fbe1d1]/30 text-[#5d2a1a] hover:bg-[#fbe1d1]/60',
    badge: 'bg-[#fbe1d1] text-[#5d2a1a]',
    icon: Wrench,
  },
  {
    role: 'Operador',
    title: 'Operador',
    email: 'operador@simoa.org',
    password: 'OperadorPassword123!',
    desc: 'Monitoreo en tiempo real',
    color: 'border-[#ececec] bg-white text-[#17191c] hover:bg-[#f2f2f3]',
    badge: 'bg-[#f2f2f3] text-[#17191c]',
    icon: Activity,
  },
  {
    role: 'Supervisor',
    title: 'Supervisor',
    email: 'supervisor@simoa.org',
    password: 'SupervisorPassword123!',
    desc: 'Supervisión y reportes',
    color: 'border-[#ececec] bg-white text-[#17191c] hover:bg-[#f2f2f3]',
    badge: 'bg-[#f2f2f3] text-[#17191c]',
    icon: UserCheck,
  },
];

interface LoginModalProps {
  isOpen: boolean;
  fullPage?: boolean;
  onClose?: () => void;
  onBackToLanding?: () => void;
  onLoginSuccess: (user: Usuario) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  fullPage = false,
  onClose,
  onBackToLanding,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('El correo electrónico es obligatorio.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!password) {
      setError('La contraseña es obligatoria.');
      return;
    }

    setLoading(true);
    try {
      const loginResult = await loginWithCredentials(cleanEmail, password);
      const verifiedProfile = (await fetchCurrentUser()) || loginResult.user;
      setPassword('');
      onLoginSuccess(verifiedProfile);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err?.message || 'Error de conexión con el servidor de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const containerClass = fullPage
    ? 'min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-white font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17191c]/30 backdrop-blur-sm font-sans';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-4xl bg-white text-[#17191c] rounded-[24px] overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-[#ececec] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_8px_40px_rgba(0,0,0,0.1)]">
        {/* Panel izquierdo — Identidad Editorial SIMOA */}
        <div className="md:col-span-5 bg-[#fafafb] text-[#17191c] p-8 sm:p-10 flex flex-col justify-between space-y-8 border-b md:border-b-0 md:border-r border-[#ececec]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[24px] font-serif font-normal text-[#17191c]">
                SIMOA
              </span>
              <span className="text-[12px] text-[#979799] border-l border-[#ececec] pl-3">
                Acceso Consola
              </span>
            </div>
            <h2 className="text-[26px] font-serif font-normal text-[#17191c] leading-tight pt-2">
              Supervisión ambiental con rigor editorial y técnico.
            </h2>
            <p className="text-[15px] text-[#777b86] leading-relaxed">
              Inicia sesión con credenciales autorizadas para gestionar nodos ESP32, configurar umbrales
              y auditar series temporales de temperatura y humedad.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#ececec] text-[13px] text-[#777b86]">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#17191c]" />
              <span>Autenticación de 4 roles técnicos con token JWT</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Thermometer className="w-4 h-4 text-[#5d2a1a]" />
              <span>Sondas DHT22, BME280 y Sensirion SHT31</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-[#17191c]" />
              <span>Conexión segura MQTTS TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Panel derecho — Formulario de Acceso y Demo Roles */}
        <div className="md:col-span-7 bg-white p-8 sm:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="steep-tag uppercase tracking-[0.08em]">INICIAR SESIÓN</span>
                <h3 className="text-[22px] font-medium text-[#17191c] mt-0.5">
                  Credenciales de acceso
                </h3>
              </div>
              {onBackToLanding && (
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="text-[14px] text-[#777b86] hover:text-[#17191c] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-[16px] bg-[#f2f2f3] border border-[#ececec] text-[#5d2a1a] text-[14px] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#5d2a1a] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#a3a6af] pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@simoa.org"
                    className="steep-input w-full pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#17191c] mb-1.5">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#a3a6af] pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="steep-input w-full pl-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 p-1 text-[#a3a6af] hover:text-[#17191c] cursor-pointer"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="steep-btn-filled w-full py-3 cursor-pointer justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Ingresar a la consola
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Selector rápido de perfiles demo */}
          <div className="pt-5 border-t border-[#ececec] space-y-3">
            <span className="steep-tag uppercase tracking-[0.08em] block">
              ACCESO RÁPIDO POR ROL
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMO_ROLE_CREDENTIALS.map((cred) => {
                const IconComponent = cred.icon;
                return (
                  <button
                    key={cred.role}
                    type="button"
                    onClick={() => {
                      setEmail(cred.email);
                      setPassword(cred.password);
                    }}
                    className={`p-3 rounded-[16px] border text-left transition-colors cursor-pointer flex flex-col justify-between space-y-1 ${cred.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium leading-tight">{cred.title}</span>
                      <IconComponent className="w-3.5 h-3.5 opacity-80" />
                    </div>
                    <span className="text-[11px] opacity-70 leading-tight">{cred.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
