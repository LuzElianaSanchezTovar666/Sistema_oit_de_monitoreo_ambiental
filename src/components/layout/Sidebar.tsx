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
    <aside className="w-64 shrink-0 bg-[#F2F8F4] border-r border-[#C8E6C9] flex flex-col justify-between p-5 hidden md:flex font-sans">
      <div className="space-y-6">
        <div>
          <span className="apple-badge-orange uppercase tracking-[0.08em] px-2.5 block mb-3 text-[11px] font-semibold text-[#1B5E20]">
            Menú de Consola
          </span>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[13px] transition-all cursor-pointer ${
                    isActive
                      ? 'apple-blue-pill font-semibold shadow-xs'
                      : 'text-[#0D3B1E] font-medium hover:bg-white hover:text-[#1B5E20]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : 'text-[#3B694C]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono tabular-nums font-semibold ${
                        isActive
                          ? 'bg-white text-[#1B5E20] rounded-full'
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
        <div className="p-4 rounded-[24px] bg-white border border-[#C8E6C9] shadow-[0_4px_14px_rgba(13,59,30,0.04)] text-xs space-y-3">
          <div className="flex items-center justify-between text-[13px] font-semibold text-[#0D3B1E]">
            <span>Topología Activa</span>
            <span className="inline-flex items-center gap-1.5 text-[#15803D] text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              Nominal
            </span>
          </div>
          <div className="space-y-2 text-[12px] text-[#3B694C]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#1B5E20]" /> Mosquitto TLS
              </span>
              <span className="text-[#0D3B1E] font-mono font-medium">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#1B5E20]" /> TimescaleDB
              </span>
              <span className="text-[#0D3B1E] font-medium">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#15803D]" /> IA Pipeline
              </span>
              <span className="text-[#15803D] font-medium">Isolation Forest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-[#C8E6C9] text-[12px] text-[#3B694C] px-1 space-y-1">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-semibold text-[#0D3B1E]">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Estado Red</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803D]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            Conectado
          </span>
        </div>
      </div>
    </aside>
  );
};
