import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  LineChart,
  Sparkles,
  Wrench,
  Radio,
  Server,
  Database,
  ArrowRightLeft,
} from 'lucide-react';
import { UserRole } from '../../types/iot';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: UserRole;
  alertCount: number;
  devicesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  alertCount,
  devicesCount,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Monitoreo en Vivo',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: null,
      allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'],
    },
    {
      id: 'devices',
      label: 'Dispositivos',
      icon: <Cpu className="w-4 h-4" />,
      badge: devicesCount.toString(),
      badgeStyle: 'bg-obsidian-shell text-pure-white rounded-[10px]',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'alerts',
      label: 'Alertas e Incidencias',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount.toString() : null,
      badgeStyle: 'bg-neon-pulse text-obsidian-shell rounded-[10px]',
      allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'],
    },
    {
      id: 'analytics',
      label: 'Histórico y Analítica',
      icon: <LineChart className="w-4 h-4" />,
      badge: null,
      allowedRoles: ['admin', 'cliente', 'supervisor'],
    },
    {
      id: 'ai',
      label: 'Diagnóstico IA',
      icon: <Sparkles className="w-4 h-4" />,
      badge: 'IA',
      badgeStyle: 'bg-signal-yellow/20 text-signal-yellow rounded-[56px]',
      allowedRoles: ['admin', 'cliente', 'supervisor'],
    },
    {
      id: 'maintenance',
      label: 'Mantenimiento Técnico',
      icon: <Wrench className="w-4 h-4" />,
      badge: null,
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'simulator',
      label: 'Pruebas de Sensores',
      icon: <Radio className="w-4 h-4" />,
      badge: null,
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.allowedRoles.includes(userRole));

  return (
    <aside className="w-64 shrink-0 bg-deep-abyss border-r border-graphite-fill/50 flex flex-col justify-between p-5 hidden md:flex">
      <div className="space-y-6">
        <div className="p-3.5 rounded-[20px] bg-mint-frost flex items-center justify-center">
          <img
            src="/assets/images/simoa-logo.webp"
            alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div>
          <span className="sauce-eyebrow text-slate-text px-2">
            Menú Principal
          </span>
          <nav className="mt-3 space-y-1.5">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[56px] text-[14px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-neon-pulse text-obsidian-shell font-medium'
                      : 'text-pure-white font-normal hover:bg-obsidian-shell'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-obsidian-shell' : 'text-slate-text'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono tabular-nums font-medium ${
                        isActive
                          ? 'bg-obsidian-shell text-neon-pulse rounded-[56px]'
                          : item.badgeStyle || 'bg-obsidian-shell text-pure-white rounded-[10px]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Infrastructure Topology Card */}
        <div className="p-4 rounded-[20px] bg-obsidian-shell text-xs space-y-3">
          <div className="flex items-center justify-between text-[13px] font-medium text-pure-white">
            <span>Topología Activa</span>
            <span className="inline-flex items-center gap-1.5 text-neon-pulse font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-neon-pulse" />
              Nominal
            </span>
          </div>
          <div className="space-y-2 text-[11px] text-slate-text font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-neon-pulse" /> Mosquitto TLS
              </span>
              <span className="text-pure-white">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-neon-pulse" /> TimescaleDB
              </span>
              <span className="text-pure-white">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-signal-yellow" /> IA Pipeline
              </span>
              <span className="text-signal-yellow">Isolation Forest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-graphite-fill/50 text-[12px] text-slate-text px-1 space-y-1">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-medium text-pure-white">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Estado Red</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-neon-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-pulse" />
            Conectado
          </span>
        </div>
      </div>
    </aside>
  );
};
