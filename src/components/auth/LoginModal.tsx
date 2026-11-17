import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Shield,
  UserCheck,
  Wrench,
  Eye,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { Usuario, UserRole } from '../../types/iot';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: Usuario[];
  onLogin: (user: Usuario) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  onLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('••••••••');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = users.find((u) => u.correo.toLowerCase() === email.trim().toLowerCase());
    if (found) {
      onLogin(found);
      onClose();
    } else {
      setError('Credenciales no encontradas en el registro corporativo.');
    }
  };

  const handleQuickLogin = (u: Usuario) => {
    onLogin(u);
    onClose();
  };

  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="w-4 h-4 text-[#104336]" />,
    cliente: <UserCheck className="w-4 h-4 text-[#104336]" />,
    tecnico: <Wrench className="w-4 h-4 text-[#D97706]" />,
    supervisor: <Eye className="w-4 h-4 text-[#101f1e]" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FFFFFF] border border-[#afc4bf] rounded-[16px] w-full max-w-md p-6 sm:p-8 space-y-6">
        {/* Header with Official SIMOA Logo */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-[#f3f1ec] border border-[#afc4bf] mx-auto">
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h2 className="apple-card-heading text-[#101f1e]">
            Acceso a Plataforma SIMOA
          </h2>
          <p className="text-xs text-[#535e5d]">
            Control de Acceso Basado en Roles (RBAC) con tokens JWT
          </p>
        </div>

        {/* Formulario Manual */}
        <form onSubmit={handleCustomLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#535e5d] font-semibold mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-3 text-[#535e5d]" />
              <input
                type="email"
                required
                placeholder="usuario@iot-ambiental.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                className="apple-pill-input w-full pl-10 pr-4 py-2.5 text-xs placeholder-[#4A7C59]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#535e5d] font-semibold mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-3 text-[#535e5d]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="apple-pill-input w-full pl-10 pr-4 py-2.5 text-xs font-mono"
              />
            </div>
          </div>

          {error && <div className="text-[#DC2626] text-[11px] font-semibold">{error}</div>}

          <button
            type="submit"
            className="apple-blue-pill w-full py-2.5 px-4 font-semibold text-xs flex items-center justify-center gap-1.5"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Perfiles Rápidos para Evaluación */}
        <div className="pt-3 border-t border-[#afc4bf] space-y-2.5">
          <div className="text-[11px] font-semibold text-[#535e5d] uppercase tracking-wider text-center">
            Perfiles Rápidos Preconfigurados
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            {users.map((u) => (
              <button
                key={u.id_usuario}
                type="button"
                onClick={() => handleQuickLogin(u)}
                className="w-full flex items-center justify-between p-3 rounded-[16px] bg-[#f3f1ec] hover:bg-[#f3f1ec]/50 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FFFFFF] flex items-center justify-center shrink-0">
                    {roleIcons[u.rol]}
                  </div>
                  <div>
                    <div className="font-semibold text-[#101f1e] leading-tight">
                      {u.nombre}
                    </div>
                    <div className="text-[10px] text-[#535e5d] capitalize">
                      {u.rol} · {u.empresa}
                    </div>
                  </div>
                </div>
                <span className="apple-inline-link text-[11px] font-semibold">Ingresar →</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs text-[#535e5d] hover:text-[#101f1e]"
          >
            Continuar en modo explorador
          </button>
        </div>
      </div>
    </div>
  );
};
