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
      {/* Announcement Bar — Environmental Mint */}
      <div className="w-full bg-[#E8F5E9] border-b border-[#C8E6C9] text-[#1B5E20] px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-medium">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-[#16A34A] animate-pulse' : 'bg-[#94A3B8]'
          }`}
        />
        <span className="truncate">
          Consola SIMOA · Sesión activa ({roleLabels[currentUser.rol]})
        </span>
      </div>

      {/* Top Navigation — Clean Botanical White, 72px height */}
      <header className="flex items-center justify-between gap-6 px-6 h-[72px] bg-white/95 backdrop-blur-md border-b border-[#C8E6C9] shadow-[0_2px_14px_rgba(13,59,30,0.04)]">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToLanding}
            title="Volver a la página principal SIMOA"
            className="flex items-center gap-2.5 focus:outline-none cursor-pointer group"
          >
            <img
              src="/assets/images/simoa-logo.webp"
              alt="SIMOA"
              className="h-10 sm:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>
        </div>

        {/* Navigation Links — Pill tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F2F8F4] p-1 rounded-full border border-[#C8E6C9]/80">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-4 py-2 rounded-full text-[13px] transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'apple-blue-pill font-semibold shadow-xs'
                    : 'text-[#265336] font-medium hover:text-[#1B5E20] hover:bg-white'
                }`}
              >
                {item.id === 'sensors' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
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
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 text-[13px] rounded-full border border-[#C8E6C9] bg-white text-[#1B5E20] hover:bg-[#E8F5E9] transition-colors cursor-pointer font-medium"
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  isStreaming ? 'text-[#16A34A]' : 'text-[#94A3B8]'
                }`}
              />
              <span>{isStreaming ? 'En línea' : 'Pausado'}</span>
            </button>
          )}

          {onOpenSimulator && (['admin', 'tecnico'] as UserRole[]).includes(currentUser.rol) && (
            <button
              onClick={onOpenSimulator}
              className="apple-blue-pill flex items-center gap-2 px-4 py-1.5 text-[13px] font-semibold cursor-pointer"
              title="Abrir Simulador de Sensores"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
              <span className="hidden md:inline">Simulador</span>
            </button>
          )}

          {(['admin', 'cliente', 'supervisor'] as UserRole[]).includes(currentUser.rol) && (
            <button
              onClick={onOpenAlerts}
              className="relative p-2 text-[#0D3B1E] hover:bg-[#E8F5E9] rounded-full border border-[#C8E6C9] bg-white transition-colors cursor-pointer"
              title="Ver alertas"
            >
              <Bell className="w-4 h-4 text-[#1B5E20]" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#DC2626] rounded-full font-mono tabular-nums leading-none">
                  {activeAlertCount}
                </span>
              )}
            </button>
          )}

          {/* Authenticated User Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#C8E6C9] bg-[#F2F8F4]">
            <div className="w-7 h-7 rounded-full bg-[#1B5E20] flex items-center justify-center font-bold text-[12px] text-white">
              {currentUser.nombre.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[13px] font-semibold text-[#0D3B1E] whitespace-nowrap leading-tight">
                {currentUser.nombre}
              </span>
              <span className="text-[11px] text-[#3B694C] flex items-center gap-1 font-medium">
                {roleIcons[currentUser.rol]}
                {roleLabels[currentUser.rol]}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#C8E6C9] bg-white text-[#1B5E20] hover:bg-[#E8F5E9] text-[13px] font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>
    </div>
  );
};
