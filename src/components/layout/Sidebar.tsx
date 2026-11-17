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
      badgeStyle: 'bg-[#f3f1ec] text-[#101f1e] border border-[#afc4bf] rounded-[4px]',
      allowedRoles: ['admin', 'tecnico', 'supervisor'],
    },
    {
      id: 'alerts',
      label: 'Alertas e Incidencias',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount.toString() : null,
      badgeStyle: 'bg-[#0fff87] text-[#101f1e] border border-[#104336] rounded-[4px]',
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
      badgeStyle: 'bg-[#e8e7f5] text-[#7c18d3] border border-[#afc4bf] rounded-[9999px]',
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
    <aside className="w-64 shrink-0 bg-[#ffffff] border-r border-[#afc4bf] flex flex-col justify-between p-5 hidden md:flex">
      <div className="space-y-6">
        <div className="p-3.5 rounded-[16px] bg-[#f3f1ec] border border-[#afc4bf] flex items-center justify-center">
          <img
            src="/assets/images/simoa-logo.webp"
            alt="SIMOA - Sistema Inteligente de Monitoreo Ambiental"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div>
          <span className="arcadia-eyebrow text-[11px] text-[#535e5d] px-2">
            Menú Principal
          </span>
          <nav className="mt-3 space-y-1.5">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[8px] text-[14px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#104336] text-[#ffffff] font-medium'
                      : 'text-[#101f1e] font-normal hover:bg-[#f3f1ec]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-[#0fff87]' : 'text-[#535e5d]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-bold ${
                        isActive
                          ? 'bg-[#0fff87] text-[#101f1e] rounded-[4px]'
                          : item.badgeStyle || 'bg-[#f3f1ec] text-[#101f1e] rounded-[4px]'
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
        <div className="p-4 rounded-[16px] bg-[#f3f1ec] border border-[#afc4bf] text-xs space-y-3">
          <div className="flex items-center justify-between text-[13px] font-medium text-[#101f1e]">
            <span>Topología Activa</span>
            <span className="inline-flex items-center gap-1.5 text-[#104336] font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#0fff87] border border-[#104336]" />
              Nominal
            </span>
          </div>
          <div className="space-y-2 text-[11px] text-[#535e5d] font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-[#104336]" /> Mosquitto TLS
              </span>
              <span className="text-[#104336] font-medium">8883 MQTTS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-[#104336]" /> TimescaleDB
              </span>
              <span className="text-[#101f1e]">Hypertable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-[#104336]" /> IA Pipeline
              </span>
              <span className="text-[#7c18d3] font-medium">Isolation Forest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-[#afc4bf] text-[12px] text-[#535e5d] px-1 space-y-1">
        <div className="flex items-center justify-between">
          <span>Plataforma</span>
          <span className="font-medium text-[#101f1e]">SIMOA Cloud v2.4</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Estado Red</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#104336]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0fff87] border border-[#104336]" />
            Conectado
          </span>
        </div>
      </div>
    </aside>
  );
};
