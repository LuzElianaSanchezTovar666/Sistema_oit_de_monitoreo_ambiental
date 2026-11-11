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
    admin: <Shield className="w-4 h-4 text-emerald-500" />,
    cliente: <UserCheck className="w-4 h-4 text-blue-500" />,
    tecnico: <Wrench className="w-4 h-4 text-amber-500" />,
    supervisor: <Eye className="w-4 h-4 text-purple-500" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Activity className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            EcoSense IoT - Autenticación
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de Acceso Basado en Roles (RBAC) con tokens JWT y Argon2id
          </p>
        </div>

        {/* Formulario Manual */}
        <form onSubmit={handleCustomLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                placeholder="usuario@iot-ambiental.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-[11px] font-semibold">{error}</div>}

          <button
            type="submit"
            className="w-full py-2.5 px-4 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Perfiles Rápidos para Evaluación */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Perfiles Rápidos Preconfigurados
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            {users.map((u) => (
              <button
                key={u.id_usuario}
                type="button"
                onClick={() => handleQuickLogin(u)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {roleIcons[u.rol]}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                      {u.nombre}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                      {u.rol} · {u.empresa}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-600 font-medium">Ingresar →</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Continuar en modo explorador
          </button>
        </div>
      </div>
    </div>
  );
};
