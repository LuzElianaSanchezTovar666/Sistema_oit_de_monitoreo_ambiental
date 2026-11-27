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
    color: 'border-[#C8E6C9] bg-white text-[#0D3B1E] hover:bg-[#E8F5E9] hover:border-[#1B5E20]',
    badge: 'bg-[#E8F5E9] text-[#1B5E20]',
    icon: Shield,
  },
  {
    role: 'Técnico',
    title: 'Técnico (Sensores IoT)',
    email: 'tecnico@simoa.org',
    password: 'TecnicoPassword123!',
    desc: 'Calibración y red de sensores',
    color: 'border-[#A5D6A7] bg-[#E8F5E9] text-[#1B5E20] hover:bg-[#C8E6C9]',
    badge: 'bg-[#C8E6C9] text-[#1B5E20]',
    icon: Wrench,
  },
  {
    role: 'Operador',
    title: 'Operador',
    email: 'operador@simoa.org',
    password: 'OperadorPassword123!',
    desc: 'Monitoreo en tiempo real',
    color: 'border-[#C8E6C9] bg-white text-[#0D3B1E] hover:bg-[#E8F5E9] hover:border-[#1B5E20]',
    badge: 'bg-[#E8F5E9] text-[#1B5E20]',
    icon: Activity,
  },
  {
    role: 'Supervisor',
    title: 'Supervisor',
    email: 'supervisor@simoa.org',
    password: 'SupervisorPassword123!',
    desc: 'Supervisión y reportes',
    color: 'border-[#C8E6C9] bg-white text-[#0D3B1E] hover:bg-[#E8F5E9] hover:border-[#1B5E20]',
    badge: 'bg-[#E8F5E9] text-[#1B5E20]',
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
    ? 'min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#F2F8F4] font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md font-sans';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-4xl bg-white text-[#0D3B1E] rounded-[28px] overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-[#C8E6C9] shadow-[0_8px_30px_rgba(13,59,30,0.12)]">
        {/* Panel izquierdo — Identidad Oficial SIMOA */}
        <div className="md:col-span-5 bg-[#F2F8F4] text-[#0D3B1E] p-8 sm:p-10 flex flex-col justify-between space-y-8 border-b md:border-b-0 md:border-r border-[#C8E6C9]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA"
                className="h-10 w-auto object-contain"
              />
              <span className="text-[12px] text-[#3B694C] border-l border-[#C8E6C9] pl-3 font-semibold">
                Acceso Consola
              </span>
            </div>
            <h2 className="text-[24px] font-semibold text-[#0D3B1E] leading-tight pt-2">
              Supervisión ambiental con precisión técnica y rigor de campo.
            </h2>
            <p className="text-[15px] text-[#3B694C] leading-relaxed">
              Inicia sesión con credenciales autorizadas para gestionar nodos ESP32, configurar umbrales
              y auditar series temporales de temperatura y humedad.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#C8E6C9] text-[13px] text-[#3B694C]">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#1B5E20]" />
              <span>Autenticación de 4 roles técnicos con token JWT</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Thermometer className="w-4 h-4 text-[#15803D]" />
              <span>Sondas DHT22, BME280 y Sensirion SHT31</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-[#1B5E20]" />
              <span>Conexión segura MQTTS TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Panel derecho — Formulario de Acceso y Demo Roles */}
        <div className="md:col-span-7 bg-white p-8 sm:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="apple-badge-orange uppercase tracking-[0.08em] font-semibold">INICIAR SESIÓN</span>
                <h3 className="text-[22px] font-semibold text-[#0D3B1E] mt-1">
                  Credenciales de acceso
                </h3>
              </div>
              {onBackToLanding && (
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="text-[14px] text-[#3B694C] hover:text-[#1B5E20] inline-flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-[16px] bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-[14px] flex items-center gap-2.5 font-medium">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[14px] font-semibold text-[#0D3B1E] mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#3B694C] pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@simoa.org"
                    className="apple-pill-input w-full pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#0D3B1E] mb-1.5">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#3B694C] pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="apple-pill-input w-full pl-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 p-1 text-[#3B694C] hover:text-[#0D3B1E] cursor-pointer"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="apple-blue-pill w-full py-3 cursor-pointer justify-center flex items-center gap-2 font-semibold"
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
          <div className="pt-5 border-t border-[#C8E6C9] space-y-3">
            <span className="apple-badge-orange uppercase tracking-[0.08em] inline-block font-semibold">
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
