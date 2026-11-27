import React from 'react';
import {
  Bell,
  Radio,
  SlidersHorizontal,
  UserCheck,
  Shield,
  Wrench,
  Eye,
  LogOut,
} from 'lucide-react';
import { Usuario, UserRole } from '../../types/iot';

interface NavbarProps {
  currentUser: Usuario;
  onLogout: () => void;
  activeAlertCount: number;
  onOpenAlerts: () => void;
  onOpenSimulator?: () => void;
  onOpenPerformanceMonitor?: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isStreaming: boolean;
  onToggleStreaming?: () => void;
  onBackToLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  activeAlertCount,
  onOpenAlerts,
  onOpenSimulator,
  activeTab,
  onTabChange,
  isStreaming,
  onToggleStreaming,
  onBackToLanding,
}) => {
  const roleIcons: Record<UserRole, React.ReactNode> = {
    admin: <Shield className="w-3.5 h-3.5 text-[#17191c]" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-[#17191c]" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-[#17191c]" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-[#17191c]" />,
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    cliente: 'Operador',
    tecnico: 'Técnico',
    supervisor: 'Supervisor',
  };

  const navItems: Array<{ id: string; label: string; allowedRoles: UserRole[] }> = [
    { id: 'dashboard', label: 'Monitoreo en Vivo', allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'] },
    { id: 'devices', label: 'Dispositivos', allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'] },
    { id: 'locations', label: 'Ubicaciones', allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'] },
    { id: 'sensors', label: 'Sensores', allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'] },
    { id: 'alerts', label: 'Alertas', allowedRoles: ['admin', 'cliente', 'supervisor'] },
    { id: 'analytics', label: 'Analítica', allowedRoles: ['admin', 'cliente', 'supervisor'] },
    { id: 'ai', label: 'Diagnóstico IA', allowedRoles: ['admin', 'supervisor'] },
  ];

  const visibleNavItems = navItems.filter((item) => item.allowedRoles.includes(currentUser.rol));

  return (
    <div className="sticky top-0 z-30 font-sans">
      {/* Announcement Bar — Quiet Fog White */}
      <div className="w-full bg-[#fafafb] border-b border-[#ececec] text-[#777b86] px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-normal">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-[#17191c]' : 'bg-[#a3a6af]'
          }`}
        />
        <span className="truncate">
          Consola SIMOA · Sesión activa ({roleLabels[currentUser.rol]})
        </span>
      </div>

      {/* Top Navigation — Paper White (#ffffff), 72px height */}
      <header className="flex items-center justify-between gap-6 px-6 h-[72px] bg-white/95 backdrop-blur-md border-b border-[#ececec]">
        {/* Brand Logo / Serif Title */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToLanding}
            title="Volver a la página principal SIMOA"
            className="flex items-center gap-2.5 focus:outline-none cursor-pointer"
          >
            <span className="text-[22px] font-serif font-normal text-[#17191c] tracking-tight">
              SIMOA
            </span>
            <span className="hidden sm:inline-block text-[12px] text-[#979799] border-l border-[#ececec] pl-2.5">
              Consola
            </span>
          </button>
        </div>

        {/* Navigation Links — Pill tabs */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-4 py-2 rounded-full text-[14px] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#17191c] text-white font-normal'
                    : 'text-[#17191c] font-normal hover:bg-[#f2f2f3]'
                }`}
              >
                {item.id === 'sensors' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5d2a1a]" />
                )}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & Authenticated Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onToggleStreaming && (
            <button
              onClick={onToggleStreaming}
              title={isStreaming ? 'Pausar transmisión en vivo' : 'Reanudar transmisión en vivo'}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 text-[13px] rounded-full border border-[#ececec] bg-white text-[#17191c] hover:bg-[#f2f2f3] transition-colors cursor-pointer"
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  isStreaming ? 'text-[#17191c]' : 'text-[#a3a6af]'
                }`}
              />
              <span className="font-normal">{isStreaming ? 'En línea' : 'Pausado'}</span>
            </button>
          )}

          {onOpenSimulator && (['admin', 'tecnico'] as UserRole[]).includes(currentUser.rol) && (
            <button
              onClick={onOpenSimulator}
              className="steep-btn-filled flex items-center gap-2 px-4 py-1.5 text-[13px] cursor-pointer"
              title="Abrir Simulador de Sensores"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
              <span className="hidden md:inline">Simulador</span>
            </button>
          )}

          {(['admin', 'cliente', 'supervisor'] as UserRole[]).includes(currentUser.rol) && (
            <button
              onClick={onOpenAlerts}
              className="relative p-2 text-[#17191c] hover:bg-[#f2f2f3] rounded-full border border-[#ececec] bg-white transition-colors cursor-pointer"
              title="Ver alertas"
            >
              <Bell className="w-4 h-4" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium text-white bg-[#17191c] rounded-full font-mono tabular-nums leading-none">
                  {activeAlertCount}
                </span>
              )}
            </button>
          )}

          {/* Authenticated User Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ececec] bg-[#fafafb]">
            <div className="w-7 h-7 rounded-full bg-[#17191c] flex items-center justify-center font-medium text-[12px] text-white">
              {currentUser.nombre.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[13px] font-medium text-[#17191c] whitespace-nowrap leading-tight">
                {currentUser.nombre}
              </span>
              <span className="text-[11px] text-[#777b86] flex items-center gap-1">
                {roleIcons[currentUser.rol]}
                {roleLabels[currentUser.rol]}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ececec] bg-white text-[#17191c] hover:bg-[#f2f2f3] text-[13px] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>
    </div>
  );
};
