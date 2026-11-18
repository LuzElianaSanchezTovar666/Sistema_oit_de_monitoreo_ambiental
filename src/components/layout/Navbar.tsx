import React, { useState } from 'react';
import {
  Bell,
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
  onOpenPerformanceMonitor?: () => void;
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
  activeTab,
  onTabChange,
  isStreaming,
  onToggleStreaming,
  onBackToLanding,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="w-3.5 h-3.5 text-neon-pulse" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-neon-pulse" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-signal-yellow" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-pure-white" />,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    cliente: 'Operador / Cliente',
    tecnico: 'Técnico Campo',
    supervisor: 'Supervisor',
  };

  return (
    <div className="sticky top-0 z-30">
      {/* Announcement Bar — Neon Pulse (#3ddc91) */}
      <div className="w-full bg-neon-pulse text-obsidian-shell px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-normal">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-obsidian-shell' : 'bg-graphite-fill'
          }`}
        />
        <span className="truncate">
          Consola SIMOA · Telemetría IoT MQTTS (TLS 1.3) &amp; Motor de Anomalías IA activo
        </span>
      </div>

      {/* Top Navigation — Obsidian Shell (#132322), 72px height */}
      <header className="flex items-center justify-between gap-6 px-6 h-[72px] bg-obsidian-shell border-b border-graphite-fill/50">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToLanding}
            title="Volver a la página principal SIMOA"
            className="px-3 py-1.5 rounded-[56px] bg-mint-frost flex items-center focus:outline-none cursor-pointer"
          >
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </button>
        </div>

        {/* Navigation Links — 56px pill tabs */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {[
            { id: 'dashboard', label: 'Monitoreo en Vivo' },
            { id: 'devices', label: 'Dispositivos' },
            { id: 'alerts', label: 'Alertas' },
            { id: 'analytics', label: 'Analítica' },
            { id: 'ai', label: 'Diagnóstico IA' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-4 py-2 rounded-[56px] text-[14px] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-neon-pulse text-obsidian-shell font-medium'
                    : 'text-pure-white font-normal hover:bg-deep-abyss'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onToggleStreaming}
            title={isStreaming ? 'Pausar transmisión en vivo' : 'Reanudar transmisión en vivo'}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-[13px] rounded-[56px] bg-deep-abyss border border-graphite-fill text-pure-white hover:border-neon-pulse transition-colors cursor-pointer"
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                isStreaming ? 'text-neon-pulse' : 'text-slate-text'
              }`}
            />
            <span className="font-normal">{isStreaming ? 'En línea' : 'Pausado'}</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="sauce-btn-primary flex items-center gap-2 px-4 py-2 text-[14px] cursor-pointer"
            title="Abrir Simulador de Sensores"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-obsidian-shell" />
            <span className="hidden md:inline">Simulador</span>
          </button>

          <button
            onClick={onOpenAlerts}
            className="relative p-2.5 text-pure-white hover:border-neon-pulse rounded-[56px] bg-deep-abyss border border-graphite-fill transition-colors cursor-pointer"
            title="Ver alertas"
          >
            <Bell className="w-4 h-4" />
            {activeAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium text-obsidian-shell bg-neon-pulse rounded-full font-mono tabular-nums leading-none">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* User profile & Role switcher */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[56px] bg-deep-abyss border border-graphite-fill hover:border-neon-pulse transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-neon-pulse flex items-center justify-center font-medium text-[12px] text-obsidian-shell">
                {currentUser.nombre.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-medium text-pure-white whitespace-nowrap leading-tight">
                  {currentUser.nombre}
                </span>
                <span className="text-[11px] text-slate-text capitalize flex items-center gap-1">
                  {roleIcons[currentUser.rol]}
                  {roleLabels[currentUser.rol]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-text" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-[20px] bg-deep-abyss border border-graphite-fill p-3 z-50 text-xs space-y-1"
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-graphite-fill">
                  <p className="font-medium text-pure-white text-[13px]">{currentUser.nombre}</p>
                  <p className="text-[11px] text-slate-text truncate">{currentUser.correo}</p>
                  <p className="text-[11px] text-neon-pulse font-medium mt-0.5">{currentUser.empresa}</p>
                </div>

                <div className="px-3 py-1.5 sauce-eyebrow text-slate-text">
                  Cambiar Rol / Perfil
                </div>

                {allUsers.map((u) => (
                  <button
                    key={u.id_usuario}
                    onClick={() => {
                      onSelectUser(u);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-left hover:bg-obsidian-shell transition-colors cursor-pointer ${
                      u.id_usuario === currentUser.id_usuario ? 'bg-obsidian-shell font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {roleIcons[u.rol]}
                      <div>
                        <div className="text-pure-white text-[13px]">{u.nombre}</div>
                        <div className="text-[11px] text-slate-text">{roleLabels[u.rol]}</div>
                      </div>
                    </div>
                    {u.id_usuario === currentUser.id_usuario && (
                      <span className="w-2 h-2 rounded-full bg-neon-pulse" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
};
