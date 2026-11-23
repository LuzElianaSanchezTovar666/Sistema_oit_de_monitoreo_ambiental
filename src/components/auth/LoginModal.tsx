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
    color: 'border-[#2d543c] bg-[#09140e] text-[#ecfdf5] hover:border-[#86efac]',
    badge: 'bg-[#12261b] text-[#86efac]',
    icon: Shield,
  },
  {
    role: 'Técnico',
    title: 'Técnico',
    email: 'tecnico@simoa.org',
    password: 'TecnicoPassword123!',
    desc: 'Mantenimiento y sensores',
    color: 'border-[#2d543c] bg-[#09140e] text-[#ecfdf5] hover:border-[#86efac]',
    badge: 'bg-[#12261b] text-[#86efac]',
    icon: Wrench,
  },
  {
    role: 'Operador',
    title: 'Operador',
    email: 'operador@simoa.org',
    password: 'OperadorPassword123!',
    desc: 'Monitoreo en tiempo real',
    color: 'border-[#2d543c] bg-[#09140e] text-[#ecfdf5] hover:border-[#86efac]',
    badge: 'bg-[#12261b] text-[#86efac]',
    icon: Activity,
  },
  {
    role: 'Supervisor',
    title: 'Supervisor',
    email: 'supervisor@simoa.org',
    password: 'SupervisorPassword123!',
    desc: 'Supervisión y reportes',
    color: 'border-[#2d543c] bg-[#09140e] text-[#ecfdf5] hover:border-[#86efac]',
    badge: 'bg-[#12261b] text-[#86efac]',
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
    ? 'min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#09140e]'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09140e]/85 backdrop-blur-sm';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-4xl bg-[#12261b] text-[#ecfdf5] rounded-[12px] overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-dashed border-[#2d543c]">
        {/* Panel izquierdo — Identidad de SIMOA (Verde claro + Oscuro) */}
        <div className="md:col-span-5 bg-[#09140e] text-[#ecfdf5] p-7 sm:p-9 flex flex-col justify-between space-y-8 border-b md:border-b-0 md:border-r border-dashed border-[#2d543c]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[22.5px] border border-[#2d543c] text-[#ecfdf5] text-[10px] font-medium tracking-wide uppercase">
              <Leaf className="w-3.5 h-3.5 text-[#86efac]" />
              <span>Monitoreo de Invernadero</span>
            </div>

            <div>
              <h1 className="text-[41px] font-medium uppercase leading-[0.95] text-[#ecfdf5]">SIMOA</h1>
              <p className="text-xs uppercase font-medium tracking-wide text-[#86efac] mt-2">
                Control Ambiental para tu Invernadero
              </p>
            </div>

            <div className="border-t border-dashed border-[#2d543c] pt-4">
              <p className="text-sm text-[#a7d7b8] leading-relaxed font-normal">
                Supervisa en tiempo real el clima de tus cultivos, recibe alertas oportunas ante
                cambios bruscos y mantén el control de cada zona desde un solo lugar.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-[#ecfdf5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[12px] border border-dashed border-[#2d543c] bg-[#12261b] flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 text-[#86efac]" />
              </div>
              <span>Zonas de Germinación, Cultivo, Climatización y Fertirriego</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[12px] border border-dashed border-[#2d543c] bg-[#12261b] flex items-center justify-center shrink-0">
                <Thermometer className="w-4 h-4 text-[#bbf7d0]" />
              </div>
              <span>Temperatura, humedad y alertas tempranas en tiempo real</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[12px] border border-dashed border-[#2d543c] bg-[#12261b] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#86efac]" />
              </div>
              <span>Acceso seguro personalizado según tu perfil</span>
            </div>
          </div>
        </div>

        {/* Panel derecho — Formulario de Inicio de Sesión (Blanco limpio + Verde claro + Oscuro) */}
        <div className="md:col-span-7 p-7 sm:p-10 bg-[#ffffff] text-[#0d1310] flex flex-col justify-center space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA"
                className="h-9 w-auto object-contain"
              />
            </div>
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex items-center gap-1.5 text-xs font-medium uppercase text-[#1b4332] hover:text-[#0d1310] underline underline-offset-4 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio
              </button>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-medium uppercase leading-[0.95] text-[#0d1310]">
              Iniciar sesión
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-2 font-normal">
              Ingresa tus credenciales registradas para acceder a tu panel de control.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="simoa-login-email"
                className="block text-[11px] font-medium uppercase tracking-wide text-[#0d1310] mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-1 top-3 text-[#52796f]" />
                <input
                  id="simoa-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="usuario@invernadero.org"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full pl-8 pr-4 py-2.5 text-sm bg-transparent border-b border-[#0d1310] rounded-none text-[#0d1310] placeholder-[#6b7f74] focus:outline-none focus:border-[#52b788]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="simoa-login-password"
                className="block text-[11px] font-medium uppercase tracking-wide text-[#0d1310] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-1 top-3 text-[#52796f]" />
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
                  className="w-full pl-8 pr-11 py-2.5 text-sm bg-transparent border-b border-[#0d1310] rounded-none text-[#0d1310] placeholder-[#6b7f74] focus:outline-none focus:border-[#52b788]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-2.5 p-1 text-[#52796f] hover:text-[#0d1310] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-[12px] bg-[#f0fdf4] border border-dashed border-[#52b788] text-[#0d1310] text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#1b4332]" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-[36px] bg-[#0d1310] border border-[#2a3b32] hover:bg-[#151e19] disabled:opacity-60 text-[#ffffff] text-xs font-medium uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
          <div className="pt-4 border-t border-dashed border-[#cbd5e1] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#0d1310]">
                Acceso Rápido por Rol (Demostración)
              </span>
              <span className="text-[10px] uppercase text-[#1b4332]">
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
                    className={`p-2.5 rounded-[12px] border border-dashed text-left transition-colors cursor-pointer flex flex-col justify-between bg-[#f8fafc] border-[#cbd5e1] text-[#0d1310] hover:border-[#52b788] hover:bg-[#f0fdf4] ${
                      isSelected
                        ? 'border-[#1b4332] bg-[#dcfce7]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <IconComponent className="w-3.5 h-3.5 shrink-0 text-[#1b4332]" />
                      <span className="text-xs font-medium uppercase">{demo.title}</span>
                    </div>
                    <div className="mt-1.5 text-[10px] space-y-0.5">
                      <p className="font-mono truncate text-[#0d1310]">{demo.email}</p>
                      <p className="text-[9px] text-[#475569]">{demo.desc}</p>
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
              className="w-full text-center text-xs uppercase text-[#475569] hover:text-[#0d1310] cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
