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
      icon: <Cpu className="w-4 h-4 text-[#5d2a1a]" />,
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
      icon: <Thermometer className="w-4 h-4 text-[#5d2a1a]" />,
      badge: 'IoT',
      badgeStyle: 'bg-[#fbe1d1] text-[#5d2a1a] rounded-full',
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
    <aside className="w-64 shrink-0 bg-[#fafafb] border-r border-[#ececec] flex flex-col justify-between p-5 hidden md:flex font-sans">
      <div className="space-y-6">
        <div>
          <span className="steep-tag uppercase tracking-[0.08em] px-2 block mb-3">
            Menú de Consola
          </span>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[14px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#17191c] text-white font-normal'
                      : 'text-[#17191c] font-normal hover:bg-[#f2f2f3]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : 'text-[#777b86]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono tabular-nums font-normal ${
                        isActive
                          ? 'bg-white text-[#17191c] rounded-full'
                          : item.badgeStyle || 'bg-[#f2f2f3] text-[#777b86] rounded-full'
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

        {/* Infrastructure Topology Card — Steep Artifact Style */}
        <div className="p-4 rounded-[20px] bg-white border border-[#ececec] shadow-[0_0_0_1px_rgba(4,23,43,0.03),0_4px_12px_rgba(0,0,0,0.04)] text-xs space-y-3">
          <div className="flex items-center justify-between text-[13px] font-medium text-[#17191c]">
            <span>Topología Activa</span>
            <span className="inline-flex items-center gap-1.5 text-[#5d2a1a] text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" />
              Nominal
            </span>
          </div>
          <div className="space-y-2 text-[12px] text-[#777b86]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-[#17191c]" /> Mosquitto TLS
              </span>
              <span className="text-[#17191c] font-mono">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-[#17191c]" /> TimescaleDB
              </span>
              <span className="text-[#17191c]">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-[#5d2a1a]" /> IA Pipeline
              </span>
              <span className="text-[#5d2a1a]">Isolation Forest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-[#ececec] text-[12px] text-[#979799] px-1 space-y-1">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-medium text-[#17191c]">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Estado Red</span>
          <span className="inline-flex items-center gap-1.5 font-normal text-[#17191c]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#17191c]" />
            Conectado
          </span>
        </div>
      </div>
    </aside>
  );
};
