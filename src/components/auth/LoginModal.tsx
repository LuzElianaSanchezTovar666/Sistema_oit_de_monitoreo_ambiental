import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { Usuario } from '../../types/iot';
import { fetchCurrentUser, loginWithCredentials } from '../../services/authService';

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
      setError(err?.message || 'No pudimos conectar con SIMOA. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const containerClass = fullPage
    ? 'relative isolate min-h-screen w-full flex items-center justify-center overflow-hidden p-4 sm:p-6 bg-garden-deep font-sans'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md font-sans';

  return (
    <div className={containerClass}>
      {fullPage && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <img
            src="/assets/images/simoa-greenhouse.webp"
            alt=""
            className="size-full scale-105 object-cover object-center blur-[4px]"
          />
          <div className="absolute inset-0 bg-garden-deep/50" />
        </div>
      )}
      <div className="relative w-full max-w-4xl bg-white text-[#0D3B1E] rounded-[28px] overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-[#C8E6C9] shadow-[0_8px_30px_rgba(13,59,30,0.12)]">
        {/* Panel izquierdo — Identidad Oficial SIMOA */}
        <div className="md:col-span-5 bg-garden-mint text-garden-deep p-8 sm:p-10 flex flex-col justify-center border-b md:border-b-0 md:border-r border-garden-border">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/images/simoa-logo.webp"
                alt="SIMOA"
                className="h-10 w-auto object-contain"
              />
            </div>
            <h2 className="text-[24px] font-semibold text-brand-forest leading-tight pt-2">
              Monitoreo ambiental SIMOA
            </h2>
            <p className="text-[15px] text-[#3B694C] leading-relaxed">
              Consulta las lecturas de tus sensores y revisa las alertas desde un solo lugar.
            </p>
          </div>

        </div>

        {/* Formulario de acceso */}
        <div className="md:col-span-7 bg-white p-8 sm:p-10 flex flex-col justify-center">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-[22px] font-semibold text-[#0D3B1E] mt-1">
                  Iniciar sesión
                </h3>
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
                <label htmlFor="simoa-login-email" className="block text-[14px] font-semibold text-[#0D3B1E] mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#3B694C] pointer-events-none" />
                  <input
                    id="simoa-login-email" type="email" autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="h-11 w-full rounded-full border border-sage-mist bg-sheet-white text-sm text-bark placeholder:text-slate focus:border-canopy focus-visible:outline-2 focus-visible:outline-canopy pl-11 pr-4"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="simoa-login-password" className="block text-[14px] font-semibold text-[#0D3B1E] mb-1.5">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#3B694C] pointer-events-none" />
                  <input
                    id="simoa-login-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-full border border-sage-mist bg-sheet-white text-sm text-bark placeholder:text-slate focus:border-canopy focus-visible:outline-2 focus-visible:outline-canopy pl-11 pr-11"
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
                    Iniciando sesión…
                  </>
                ) : (
                  <>
                    Ingresar
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
