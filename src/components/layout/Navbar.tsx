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
    admin: <Shield className="w-3.5 h-3.5 text-neon-pulse" />,
    cliente: <UserCheck className="w-3.5 h-3.5 text-neon-pulse" />,
    tecnico: <Wrench className="w-3.5 h-3.5 text-neon-pulse" />,
    supervisor: <Eye className="w-3.5 h-3.5 text-neon-pulse" />,
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
    <div className="sticky top-0 z-30">
      {/* Announcement Bar — Neon Pulse (#76a9ff) */}
      <div className="w-full bg-neon-pulse text-obsidian-shell px-6 py-2 flex items-center justify-center gap-2.5 text-[13px] font-normal">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isStreaming ? 'bg-obsidian-shell' : 'bg-graphite-fill'
          }`}
        />
        <span className="truncate">
          Consola SIMOA · Sesión autenticada ({roleLabels[currentUser.rol]})
        </span>
      </div>

      {/* Top Navigation — Obsidian Shell (#10213d), 72px height */}
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

        {/* Navigation Links — 56px pill tabs filtered by RBAC */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {visibleNavItems.map((item) => {
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

        {/* Actions & Authenticated Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onToggleStreaming && <button
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
          </button>}

          {onOpenSimulator && (['admin', 'tecnico'] as UserRole[]).includes(currentUser.rol) && (
            <button
              onClick={onOpenSimulator}
              className="sauce-btn-primary flex items-center gap-2 px-4 py-2 text-[14px] cursor-pointer"
              title="Abrir Simulador de Sensores"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-obsidian-shell" />
              <span className="hidden md:inline">Simulador</span>
            </button>
          )}

          {(['admin', 'cliente', 'supervisor'] as UserRole[]).includes(currentUser.rol) && (
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
          )}

          {/* Authenticated User Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[56px] bg-deep-abyss border border-graphite-fill">
            <div className="w-7 h-7 rounded-full bg-neon-pulse flex items-center justify-center font-medium text-[12px] text-obsidian-shell">
              {currentUser.nombre.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[13px] font-medium text-pure-white whitespace-nowrap leading-tight">
                {currentUser.nombre}
              </span>
              <span className="text-[11px] text-slate-text flex items-center gap-1">
                {roleIcons[currentUser.rol]}
                {roleLabels[currentUser.rol]}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[56px] bg-deep-abyss border border-graphite-fill text-pure-white hover:border-neon-pulse hover:text-neon-pulse text-[13px] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>
    </div>
  );
};
