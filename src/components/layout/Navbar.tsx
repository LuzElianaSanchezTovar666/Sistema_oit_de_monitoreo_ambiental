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
    admin: <Shield className="w-3.5 h-3.5 text-canopy" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-canopy" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-slate" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-bark" />,
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
      <div className="w-full bg-canopy text-sheet-white px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-normal">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-mint-pulse' : 'bg-sage-mist'
          }`}
        />
        <span className="truncate">
          Observatorio SIMOA · Telemetría IoT MQTTS (TLS 1.3) &amp; Motor de Anomalías IA activo
        </span>
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="hidden sm:inline-flex items-center gap-1 text-mint-pulse hover:underline font-medium shrink-0 cursor-pointer"
          >
            Portada →
          </button>
        )}
      </div>

      {/* Top Navigation — Sheet White (#ffffff), 72px height, 1px Sage Mist (#afc4bf) border */}
      <header className="flex items-center justify-between gap-6 px-6 h-[72px] bg-sheet-white border-b border-sage-mist">
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
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
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
                className={`px-3.5 py-2 rounded-[8px] text-[14px] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-canopy text-sheet-white font-medium'
                    : 'text-bark font-normal hover:bg-cream-paper'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-mint-pulse" />}
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
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-[13px] rounded-[8px] bg-cream-paper border border-sage-mist text-bark hover:bg-[#e8e7f5]/50 transition-colors cursor-pointer"
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                isStreaming ? 'text-canopy' : 'text-[#798281]'
              }`}
            />
            <span className="font-medium">{isStreaming ? 'En línea' : 'Pausado'}</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="arcadia-btn-primary flex items-center gap-2 px-4 py-2 text-[14px] cursor-pointer"
            title="Abrir Simulador de Sensores"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-mint-pulse" />
            <span className="hidden md:inline">Simulador</span>
          </button>

          <button
            onClick={onOpenAlerts}
            className="relative p-2 text-bark hover:bg-cream-paper rounded-[8px] bg-sheet-white border border-sage-mist transition-colors cursor-pointer"
            title="Ver alertas"
          >
            <Bell className="w-4 h-4" />
            {activeAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-bold text-bark bg-mint-pulse border border-canopy rounded-full font-mono tabular-nums leading-none">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* User profile & Role switcher */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist hover:bg-[#e8e7f5]/50 transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-[8px] bg-canopy flex items-center justify-center font-medium text-[12px] text-sheet-white">
                {currentUser.nombre.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-medium text-bark whitespace-nowrap leading-tight">
                  {currentUser.nombre}
                </span>
                <span className="text-[11px] text-slate capitalize flex items-center gap-1">
                  {roleIcons[currentUser.rol]}
                  {roleLabels[currentUser.rol]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-[16px] bg-sheet-white border border-sage-mist p-3 z-50 text-xs space-y-1"
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-sage-mist">
                  <p className="font-medium text-bark text-[13px]">{currentUser.nombre}</p>
                  <p className="text-[11px] text-slate truncate">{currentUser.correo}</p>
                  <p className="text-[11px] text-canopy font-medium mt-0.5">{currentUser.empresa}</p>
                </div>

                <div className="px-3 py-1.5 arcadia-eyebrow text-[11px] text-slate">
                  Cambiar Rol / Perfil
                </div>

                {allUsers.map((u) => (
                  <button
                    key={u.id_usuario}
                    onClick={() => {
                      onSelectUser(u);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left hover:bg-cream-paper transition-colors cursor-pointer ${
                      u.id_usuario === currentUser.id_usuario ? 'bg-cream-paper font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {roleIcons[u.rol]}
                      <div>
                        <div className="text-bark text-[13px]">{u.nombre}</div>
                        <div className="text-[11px] text-slate">{roleLabels[u.rol]}</div>
                      </div>
                    </div>
                    {u.id_usuario === currentUser.id_usuario && (
                      <span className="w-2 h-2 rounded-full bg-mint-pulse border border-canopy" />
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
