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
    admin: <Shield className="w-3.5 h-3.5 text-[#104336]" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-[#104336]" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-[#535e5d]" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-[#101f1e]" />,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    cliente: 'Operador / Cliente',
    tecnico: 'Técnico Campo',
    supervisor: 'Supervisor',
  };

  return (
    <div className="sticky top-0 z-30">
      {/* Announcement Bar — Full-bleed Canopy (#104336) */}
      <div className="w-full bg-[#104336] text-[#ffffff] px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-normal">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-[#0fff87]' : 'bg-[#afc4bf]'
          }`}
        />
        <span className="truncate">
          Observatorio SIMOA · Telemetría IoT MQTTS (TLS 1.3) &amp; Motor de Anomalías IA activo
        </span>
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="hidden sm:inline-flex items-center gap-1 text-[#0fff87] hover:underline font-medium shrink-0 cursor-pointer"
          >
            Portada →
          </button>
        )}
      </div>

      {/* Top Navigation — Sheet White (#ffffff), 68px height, 1px Sage Mist (#afc4bf) border */}
      <header className="flex items-center justify-between gap-6 px-6 h-[68px] bg-[#ffffff] border-b border-[#afc4bf]">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToLanding}
            title="Volver a la página principal SIMOA"
            className="flex items-center gap-2.5 focus:outline-none cursor-pointer"
          >
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
              className="h-9 w-auto object-contain"
            />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {[
            { id: 'dashboard', label: 'Monitoreo en Vivo' },
            { id: 'devices', label: 'Dispositivos y Sensores' },
            { id: 'alerts', label: 'Alertas' },
            { id: 'analytics', label: 'Analítica' },
            { id: 'ai', label: 'Diagnóstico IA' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3.5 py-2 rounded-[8px] text-[14px] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#104336] text-[#ffffff] font-medium'
                    : 'text-[#101f1e] font-normal hover:bg-[#f3f1ec]'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0fff87]" />}
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
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-[8px] bg-[#f3f1ec] border border-[#afc4bf] text-[#101f1e] hover:bg-[#e8e7f5]/50 transition-colors cursor-pointer"
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                isStreaming ? 'text-[#104336]' : 'text-[#798281]'
              }`}
            />
            <span className="font-medium">{isStreaming ? 'En línea' : 'Pausado'}</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="arcadia-btn-primary flex items-center gap-2 px-4 py-2 text-[14px] cursor-pointer"
            title="Abrir Simulador de Sensores"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0fff87]" />
            <span className="hidden md:inline">Simulador</span>
          </button>

          <button
            onClick={onOpenAlerts}
            className="relative p-2 text-[#101f1e] hover:bg-[#f3f1ec] rounded-[8px] bg-[#ffffff] border border-[#afc4bf] transition-colors cursor-pointer"
            title="Ver alertas"
          >
            <Bell className="w-4 h-4" />
            {activeAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-bold text-[#101f1e] bg-[#0fff87] border border-[#104336] rounded-full font-mono tabular-nums leading-none">
                {activeAlertCount}
              </span>
            )}
          </button>

          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="arcadia-btn-ghost px-3.5 py-2 text-[14px] cursor-pointer hidden sm:inline-flex"
              title="Volver a la página de inicio"
            >
              Inicio
            </button>
          )}

          {/* User profile & Role switcher */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#f3f1ec] border border-[#afc4bf] hover:bg-[#e8e7f5]/50 transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-[8px] bg-[#104336] flex items-center justify-center font-medium text-[12px] text-[#ffffff]">
                {currentUser.nombre.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-medium text-[#101f1e] whitespace-nowrap leading-tight">
                  {currentUser.nombre}
                </span>
                <span className="text-[11px] text-[#535e5d] capitalize flex items-center gap-1">
                  {roleIcons[currentUser.rol]}
                  {roleLabels[currentUser.rol]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#535e5d]" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-[16px] bg-[#ffffff] border border-[#afc4bf] p-3 z-50 text-xs space-y-1"
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#afc4bf]">
                  <p className="font-medium text-[#101f1e] text-[13px]">{currentUser.nombre}</p>
                  <p className="text-[11px] text-[#535e5d] truncate">{currentUser.correo}</p>
                  <p className="text-[11px] text-[#104336] font-medium mt-0.5">{currentUser.empresa}</p>
                </div>

                <div className="px-3 py-1.5 arcadia-eyebrow text-[11px] text-[#535e5d]">
                  Cambiar Rol / Perfil
                </div>

                {allUsers.map((u) => (
                  <button
                    key={u.id_usuario}
                    onClick={() => {
                      onSelectUser(u);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left hover:bg-[#f3f1ec] transition-colors cursor-pointer ${
                      u.id_usuario === currentUser.id_usuario ? 'bg-[#f3f1ec] font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {roleIcons[u.rol]}
                      <div>
                        <div className="text-[#101f1e] text-[13px]">{u.nombre}</div>
                        <div className="text-[11px] text-[#535e5d]">{roleLabels[u.rol]}</div>
                      </div>
                    </div>
                    {u.id_usuario === currentUser.id_usuario && (
                      <span className="w-2 h-2 rounded-full bg-[#0fff87] border border-[#104336]" />
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
