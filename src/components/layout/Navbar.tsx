import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Sun,
  Moon,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  UserCheck,
  Shield,
  Wrench,
  Eye,
} from 'lucide-react';
import { Usuario, UserRole } from '../../types/iot';

interface NavbarProps {
  currentUser: Usuario;
  allUsers: Usuario[];
  onSelectUser: (user: Usuario) => void;
  activeAlertCount: number;
  onOpenAlerts: () => void;
  onOpenSimulator: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onBackToLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  activeAlertCount,
  onOpenAlerts,
  onOpenSimulator,
  darkMode,
  onToggleDarkMode,
  activeTab,
  onTabChange,
  isStreaming,
  onToggleStreaming,
  onBackToLanding,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="w-4 h-4 text-emerald-500" />,
    cliente: <UserCheck className="w-4 h-4 text-blue-500" />,
    tecnico: <Wrench className="w-4 h-4 text-amber-500" />,
    supervisor: <Eye className="w-4 h-4 text-purple-500" />,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    cliente: 'Usuario / Cliente',
    tecnico: 'Técnico Campo',
    supervisor: 'Supervisor',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
          <Activity className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            EcoSense IoT
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tracking-tight -mt-0.5">
            Monitoreo Ambiental v2.4
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
            activeTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
          }`}
        >
          Dashboard en Vivo
        </button>
        <button
          onClick={() => onTabChange('devices')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
            activeTab === 'devices' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
          }`}
        >
          Nodos y Sensores
        </button>
        <button
          onClick={() => onTabChange('alerts')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
            activeTab === 'alerts' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
          }`}
        >
          Alertas e Incidencias
        </button>
        <button
          onClick={() => onTabChange('analytics')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
            activeTab === 'analytics' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
          }`}
        >
          Histórico y Analítica
        </button>
        <button
          onClick={() => onTabChange('ai')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
            activeTab === 'ai' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
          }`}
        >
          Diagnóstico IA
        </button>
      </nav>

      {/* Zone 3: Actions & Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Streaming state toggle */}
        <button
          onClick={onToggleStreaming}
          title={isStreaming ? 'Pausar ingesta en vivo' : 'Reanudar ingesta en vivo'}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isStreaming
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400'
              : 'border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
          <span className="font-mono tabular-nums">{isStreaming ? 'MQTT Conectado' : 'MQTT Pausado'}</span>
        </button>

        {/* Edge Simulator button */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          title="Abrir Simulador de Fallas y Edge IoT"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          <span className="hidden md:inline">Simulador Edge</span>
        </button>

        {/* Alerts trigger */}
        <button
          onClick={onOpenAlerts}
          className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Ver alertas"
        >
          <Bell className="w-4 h-4" />
          {activeAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-600 rounded-full font-mono tabular-nums leading-none">
              {activeAlertCount}
            </span>
          )}
        </button>

        {/* Botón Volver a la Landing Page */}
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
            title="Volver a la Landing Page de presentación"
          >
            <span>← Landing Page</span>
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User profile & Role switcher */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
              {currentUser.nombre.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap leading-tight">
                {currentUser.nombre}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1">
                {roleIcons[currentUser.rol]}
                {roleLabels[currentUser.rol]}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-2 z-50 text-xs"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/60">
                <p className="font-semibold text-slate-900 dark:text-white">{currentUser.nombre}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.correo}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{currentUser.empresa}</p>
              </div>

              <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cambiar Rol / Perfil
              </div>

              {allUsers.map((u) => (
                <button
                  key={u.id_usuario}
                  onClick={() => {
                    onSelectUser(u);
                    setUserDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    u.id_usuario === currentUser.id_usuario ? 'bg-slate-50 dark:bg-slate-700/70 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {roleIcons[u.rol]}
                    <div>
                      <div className="text-slate-800 dark:text-slate-200">{u.nombre}</div>
                      <div className="text-[10px] text-slate-400">{roleLabels[u.rol]}</div>
                    </div>
                  </div>
                  {u.id_usuario === currentUser.id_usuario && (
                    <span className="text-[10px] text-emerald-600 font-medium">Activo</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
