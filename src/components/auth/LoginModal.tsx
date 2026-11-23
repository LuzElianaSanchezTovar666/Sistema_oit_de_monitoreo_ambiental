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
  Leaf,
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
    color: 'border-blue-200 bg-blue-50/80 text-blue-950 hover:bg-blue-100',
    badge: 'bg-blue-700 text-white',
    icon: Shield,
  },
  {
    role: 'Técnico',
    title: 'Técnico',
    email: 'tecnico@simoa.org',
    password: 'TecnicoPassword123!',
    desc: 'Mantenimiento y sensores',
    color: 'border-amber-200 bg-amber-50/80 text-amber-950 hover:bg-amber-100',
    badge: 'bg-amber-600 text-white',
    icon: Wrench,
  },
  {
    role: 'Operador',
    title: 'Operador',
    email: 'operador@simoa.org',
    password: 'OperadorPassword123!',
    desc: 'Monitoreo en tiempo real',
    color: 'border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100',
    badge: 'bg-emerald-700 text-white',
    icon: Activity,
  },
  {
    role: 'Supervisor',
    title: 'Supervisor',
    email: 'supervisor@simoa.org',
    password: 'SupervisorPassword123!',
    desc: 'Supervisión y reportes',
    color: 'border-purple-200 bg-purple-50/80 text-purple-950 hover:bg-purple-100',
    badge: 'bg-purple-700 text-white',
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
    ? 'min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-obsidian-shell via-[#153760] to-deep-abyss'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-abyss/75 backdrop-blur-sm';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-4xl bg-[#ffffff] text-[#0F172A] rounded-[24px] overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-[#CBD5E1]">
        {/* Panel izquierdo — Identidad de SIMOA */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#17376a] via-[#1e4f91] to-[#0369A1] text-[#ffffff] p-7 sm:p-9 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ffffff]/15 text-[#ffffff] text-[11px] font-medium tracking-wide uppercase">
              <Leaf className="w-3.5 h-3.5 text-[#b4d5ff]" />
              <span>Monitoreo de Invernadero</span>
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#ffffff]">SIMOA</h1>
              <p className="text-sm text-[#E0F2FE] mt-1 font-normal">
                Control Ambiental para tu Invernadero
              </p>
            </div>

            <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed">
              Supervisa en tiempo real el clima de tus cultivos, recibe alertas oportunas ante
              cambios bruscos y mantén el control de cada zona desde un solo lugar.
            </p>
          </div>

          <div className="space-y-3 text-xs text-[#eaf3ff]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#ffffff]/15 flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 text-[#b4d5ff]" />
              </div>
              <span>Zonas de Germinación, Cultivo, Climatización y Fertirriego</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#ffffff]/15 flex items-center justify-center shrink-0">
                <Thermometer className="w-4 h-4 text-[#7DD3FC]" />
              </div>
              <span>Temperatura, humedad y alertas tempranas en tiempo real</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#ffffff]/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#b4d5ff]" />
              </div>
              <span>Acceso seguro personalizado según tu perfil</span>
            </div>
          </div>
        </div>

        {/* Panel derecho — Formulario de Inicio de Sesión */}
        <div className="md:col-span-7 p-7 sm:p-10 bg-[#ffffff] flex flex-col justify-center space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA"
                className="h-10 w-auto object-contain"
              />
            </div>
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0369A1] hover:text-obsidian-shell cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio
              </button>
            )}
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#0F172A]">
              Iniciar sesión
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-1">
              Ingresa tus credenciales registradas para acceder a tu panel de control.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="simoa-login-email"
                className="block text-xs font-medium text-[#1E293B] mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#64748B]" />
                <input
                  id="simoa-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="usuario@organizacion.org"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-[10px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="simoa-login-password"
                className="block text-xs font-medium text-[#1E293B] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#64748B]" />
                <input
                  id="simoa-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-[#F8FAFC] border border-[#CBD5E1] rounded-[10px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-2.5 p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 rounded-[10px] bg-gradient-to-r from-[#17376a] to-[#0369A1] hover:opacity-95 disabled:opacity-60 text-[#ffffff] text-sm font-medium flex items-center justify-center gap-2 transition-opacity cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Selector de Acceso Rápido por Rol */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475569]">
                Acceso Rápido por Rol (Demostración)
              </span>
              <span className="text-[10px] text-[#64748B]">
                Clic para autorrellenar
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ROLE_CREDENTIALS.map((demo) => {
                const IconComponent = demo.icon;
                const isSelected = email === demo.email;
                return (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() => {
                      setEmail(demo.email);
                      setPassword(demo.password);
                      setError('');
                    }}
                    className={`p-2.5 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between ${demo.color} ${
                      isSelected
                        ? 'ring-2 ring-offset-1 ring-[#0284C7] shadow-sm'
                        : 'shadow-none'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <IconComponent className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span className="text-xs font-semibold">{demo.title}</span>
                    </div>
                    <div className="mt-1.5 text-[10px] space-y-0.5">
                      <p className="font-mono truncate">{demo.email}</p>
                      <p className="text-[9px] opacity-75">{demo.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {!fullPage && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-xs text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
