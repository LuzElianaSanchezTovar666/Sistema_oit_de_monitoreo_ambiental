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
  FileText,
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
      badgeStyle: 'bg-[#E3F2E6] text-[#0D3B1E] rounded-[5px]',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'alerts',
      label: 'Alertas e Incidencias',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount.toString() : null,
      badgeStyle: 'bg-[#DC2626] text-[#ffffff] rounded-[5px]',
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
      icon: <Sparkles className="w-4 h-4 text-[#15803D]" />,
      badge: 'IA',
      badgeStyle: 'apple-badge-orange',
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
      icon: <Radio className="w-4 h-4 text-[#D97706]" />,
      badge: null,
       badgeStyle: 'apple-badge-orange',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.allowedRoles.includes(userRole));

  return (
    <aside className="w-64 shrink-0 bg-[#FFFFFF] border-r border-[#C8E6C9]/80 flex flex-col justify-between p-4 hidden md:flex">
      <div className="space-y-5">
        <div className="p-3 rounded-[20px] bg-[#F2F8F4] border border-[#C8E6C9] flex items-center justify-center">
          <img
            src="/assets/images/simoa-logo.webp"
            alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-[#3B694C] uppercase tracking-wider px-3">
            Menú Principal
          </span>
          <nav className="mt-2.5 space-y-1.5">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[980px] text-[12px] tracking-[-0.12px] transition-colors ${
                    isActive
                      ? 'bg-[#1B5E20] text-[#ffffff] font-semibold'
                      : 'text-[#3B694C] hover:text-[#0D3B1E] hover:bg-[#F2F8F4]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold ${
                        isActive
                          ? 'bg-[#FFFFFF]/25 text-[#ffffff] rounded-[5px]'
                          : item.badgeStyle || 'bg-[#E3F2E6] text-[#0D3B1E] rounded-[5px]'
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

        {/* Infrastructure Topology Card — Feature Metric Tile (#F2F8F4, 28px radius, 16px padding) */}
        <div className="p-[16px] rounded-[28px] bg-[#F2F8F4] text-xs space-y-2.5">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#0D3B1E]">
            <span>Topología Activa</span>
            <span className="text-[#15803D] font-mono text-[11px]">● Nominal</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-[#3B694C] font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-[#3B694C]" /> Mosquitto TLS
              </span>
              <span className="text-[#15803D]">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-[#3B694C]" /> TimescaleDB
              </span>
              <span className="text-[#0D3B1E]">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-[#3B694C]" /> Redis + CDN
              </span>
              <span className="text-[#15803D]">30 Opt OK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-[#C8E6C9]/70 text-[11px] text-[#3B694C] px-2">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-semibold text-[#0D3B1E]">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Estado Red</span>
          <span className="font-semibold text-[#15803D]">● Conectado</span>
        </div>
      </div>
    </aside>
  );
};
