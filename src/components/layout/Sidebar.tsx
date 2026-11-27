import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  MapPin,
  Thermometer,
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
  simulatorEnabled: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  alertCount,
  devicesCount,
  simulatorEnabled,
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
      badgeStyle: 'bg-[#f2f2f3] text-[#17191c] rounded-full',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'locations',
      label: 'Ubicaciones',
      icon: <MapPin className="w-4 h-4" />,
      badge: null,
      allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'],
    },
    {
      id: 'sensors',
      label: 'Sensores',
      icon: <Thermometer className="w-4 h-4" />,
      badge: 'IoT',
      badgeStyle: 'bg-brand-yellow text-brand-gold rounded-full',
      allowedRoles: ['admin', 'cliente', 'tecnico', 'supervisor'],
    },
    {
      id: 'alerts',
      label: 'Alertas e Incidencias',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount.toString() : null,
      badgeStyle: 'bg-[#17191c] text-white rounded-full',
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
      badgeStyle: 'bg-[#f2f2f3] text-[#17191c] rounded-full',
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

  const visibleItems = navItems.filter((item) =>
    item.allowedRoles.includes(userRole) && (item.id !== 'simulator' || simulatorEnabled)
  );

  return (
    <aside className="w-64 shrink-0 bg-console-sidebar text-console-sidebar-muted border-r border-console-sidebar-border flex flex-col justify-between p-5 hidden md:flex font-sans">
      <div className="space-y-6">
        <div>
          <span className="apple-badge-orange uppercase tracking-[0.08em] px-2.5 block mb-3 text-[11px] font-semibold">
            Menú de Consola
          </span>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[13px] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow ${
                    isActive
                      ? 'bg-console-sidebar-active text-white font-semibold shadow-xs'
                      : 'text-console-sidebar-muted font-medium hover:bg-console-sidebar-panel hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="shrink-0">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono tabular-nums font-semibold ${
                        isActive
                          ? 'bg-white text-console-sidebar rounded-full'
                          : item.badgeStyle || 'bg-[#E8F5E9] text-[#1B5E20] rounded-full'
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

        {/* Infrastructure Topology Card — SIMOA Environmental Style */}
        <div className="p-4 rounded-[24px] bg-console-sidebar-panel border border-console-sidebar-border text-xs space-y-3">
          <div className="flex items-center justify-between text-[13px] font-semibold text-white">
            <span>Topología Activa</span>
            <span className="inline-flex items-center gap-1.5 text-console-sidebar-status text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-console-sidebar-status animate-pulse" />
              Nominal
            </span>
          </div>
          <div className="space-y-2 text-[12px] text-console-sidebar-muted">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-console-sidebar-status" /> Mosquitto TLS
              </span>
              <span className="text-white font-mono font-medium">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-console-sidebar-status" /> TimescaleDB
              </span>
              <span className="text-white font-medium">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-console-sidebar-status" /> IA Pipeline
              </span>
              <span className="text-console-sidebar-status font-medium">Isolation Forest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-console-sidebar-border text-[12px] text-console-sidebar-muted px-1 space-y-1">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-semibold text-white">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Estado Red</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-console-sidebar-status">
            <span className="w-2 h-2 rounded-full bg-console-sidebar-status" />
            Conectado
          </span>
        </div>
      </div>
    </aside>
  );
};
