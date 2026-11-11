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
      label: 'Nodos y Sensores',
      icon: <Cpu className="w-4 h-4" />,
      badge: devicesCount.toString(),
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'alerts',
      label: 'Alertas e Incidencias',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount.toString() : null,
      badgeColor: 'bg-red-500 text-white',
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
      icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
      badge: 'ML',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
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
      label: 'Simulador Edge & DLQ',
      icon: <Radio className="w-4 h-4 text-amber-500" />,
      badge: 'Test',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.allowedRoles.includes(userRole));

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 hidden md:flex">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3">
            Navegación del Sistema
          </span>
          <nav className="mt-2 space-y-1">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold ${
                        item.badgeColor || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
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
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <span>Topología Activa</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono">Nominal</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-slate-400" /> Mosquitto TLS
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-slate-400" /> TimescaleDB
              </span>
              <span className="text-slate-700 dark:text-slate-300">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-slate-400" /> Node-RED
              </span>
              <span className="text-slate-700 dark:text-slate-300">Pipeline 1Hz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <span>Latencia Promedio</span>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">42ms</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Tasa Ingesta</span>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">100% OK</span>
        </div>
      </div>
    </aside>
  );
};
