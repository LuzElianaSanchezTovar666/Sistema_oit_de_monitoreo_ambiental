import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  UserCheck,
  Shield,
  Wrench,
  Eye,
  Gauge,
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
  activeTab,
  onTabChange,
  isStreaming,
  onToggleStreaming,
  onBackToLanding,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="w-3.5 h-3.5 text-[#15803D]" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-[#1B5E20]" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-[#D97706]" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-[#0D3B1E]" />,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    cliente: 'Operador / Cliente',
    tecnico: 'Técnico Campo',
    supervisor: 'Supervisor',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-6 px-6 h-[64px] bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#C8E6C9] shadow-[0_2px_14px_rgba(13,59,30,0.04)]">
      {/* Zone 1: Official SIMOA Brand Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onBackToLanding}
          title="Volver a la página principal SIMOA"
          className="flex items-center gap-2.5 focus:outline-none cursor-pointer group"
        >
          <img
            src="/assets/images/simoa-logo.webp"
            alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
            className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>
      </div>

      {/* Zone 2: Clean Pill Navigation Links */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#F2F8F4] p-1 rounded-full border border-[#C8E6C9]/80">
        {[
          { id: 'dashboard', label: 'Monitoreo en Vivo' },
          { id: 'devices', label: 'Dispositivos y Sensores' },
          { id: 'alerts', label: 'Alertas' },
          { id: 'analytics', label: 'Analítica' },
          { id: 'ai', label: 'Diagnóstico IA' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === item.id
                ? 'bg-[#1B5E20] text-[#FFFFFF] font-semibold shadow-xs'
                : 'text-[#265336] hover:text-[#1B5E20] hover:bg-[#FFFFFF]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: Actions & Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Streaming state toggle */}
        <button
          onClick={onToggleStreaming}
          title={isStreaming ? 'Pausar transmisión en vivo' : 'Reanudar transmisión en vivo'}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[12px] tracking-[-0.12px] rounded-full bg-[#E8F5E9] border border-[#A5D6A7] text-[#1B5E20] hover:bg-[#C8E6C9]/60 transition-colors cursor-pointer"
        >
          <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-[#16A34A] animate-pulse' : 'text-[#3B694C]'}`} />
          <span className="font-semibold">{isStreaming ? 'En línea' : 'Pausado'}</span>
        </button>

        {/* Edge Simulator button */}
        <button
          onClick={onOpenSimulator}
          className="apple-blue-pill flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] cursor-pointer"
          title="Abrir Simulador de Sensores"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#ffffff]" />
          <span className="hidden md:inline font-semibold">Simulador</span>
        </button>

        {/* Alerts trigger */}
        <button
          onClick={onOpenAlerts}
          className="relative p-2 text-[#265336] hover:text-[#1B5E20] hover:bg-[#E8F5E9] rounded-full bg-[#F2F8F4] border border-[#C8E6C9] transition-colors cursor-pointer"
          title="Ver alertas"
        >
          <Bell className="w-4 h-4" />
          {activeAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#ffffff] bg-[#DC2626] rounded-full font-mono tabular-nums leading-none">
              {activeAlertCount}
            </span>
          )}
        </button>

        {/* Botón Volver al Inicio */}
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="apple-white-outline-pill py-1.5 text-[12px] font-semibold tracking-[-0.12px] cursor-pointer"
            title="Volver a la página de inicio"
          >
            Inicio
          </button>
        )}

        {/* User profile & Role switcher */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1 rounded-[980px] bg-[#E3F2E6] hover:bg-[#E3F2E6]/80 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded-full bg-[#F2F8F4] flex items-center justify-center font-semibold text-[11px] text-[#0D3B1E]">
              {currentUser.nombre.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[12px] font-semibold text-[#0D3B1E] whitespace-nowrap leading-tight">
                {currentUser.nombre}
              </span>
              <span className="text-[10px] text-[#3B694C] capitalize flex items-center gap-1">
                {roleIcons[currentUser.rol]}
                {roleLabels[currentUser.rol]}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#265336]" />
          </button>

          {userDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-[28px] bg-[#FFFFFF] border border-[#C8E6C9] p-3 z-50 text-xs space-y-1"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-[#C8E6C9]">
                <p className="font-semibold text-[#0D3B1E]">{currentUser.nombre}</p>
                <p className="text-[11px] text-[#3B694C] truncate">{currentUser.correo}</p>
                <p className="text-[11px] text-[#15803D] font-medium mt-0.5">{currentUser.empresa}</p>
              </div>

              <div className="px-3 py-1.5 text-[10px] font-semibold text-[#3B694C] uppercase tracking-wider">
                Cambiar Rol / Perfil
              </div>

              {allUsers.map((u) => (
                <button
                  key={u.id_usuario}
                  onClick={() => {
                    onSelectUser(u);
                    setUserDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[14px] text-left hover:bg-[#E3F2E6]/60 transition-colors ${
                    u.id_usuario === currentUser.id_usuario ? 'bg-[#F2F8F4] font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {roleIcons[u.rol]}
                    <div>
                      <div className="text-[#0D3B1E] text-[12px]">{u.nombre}</div>
                      <div className="text-[10px] text-[#3B694C]">{roleLabels[u.rol]}</div>
                    </div>
                  </div>
                  {u.id_usuario === currentUser.id_usuario && (
                    <span className="text-[10px] text-[#15803D] font-semibold">Activo</span>
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
