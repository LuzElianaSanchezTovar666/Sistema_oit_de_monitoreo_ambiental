import React, { useState } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  AtSign,
  Clock,
  ChevronRight,
  Layers,
  Sparkles,
  Shield,
  Activity,
  Cpu,
  LineChart,
} from 'lucide-react';
import { HeroSkeleton } from '../common/SkeletonLoader';
import { EnvironmentalThreeBackground } from './EnvironmentalThreeBackground';

interface EnvironmentalLandingPageProps {
  onEnterSystem: (initialTab?: string) => void;
  skeletonMode: boolean;
  onToggleSkeletonMode: () => void;
  onOpenPerformanceMonitor?: () => void;
}

export const EnvironmentalLandingPage: React.FC<EnvironmentalLandingPageProps> = ({
  onEnterSystem,
  skeletonMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [composerQuery, setComposerQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'exploration' | 'reporting'>('metrics');

  return (
    <div className="relative min-h-screen bg-white text-[#17191c] selection:bg-[#fbe1d1] selection:text-[#5d2a1a] overflow-x-hidden font-sans">
      {/* Steep Ambient Glow Background Aura */}
      <EnvironmentalThreeBackground />

      {/* 1. TOP NAVIGATION — Steep Pure Header */}
      <header className="relative z-30 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 h-[76px] flex items-center justify-between gap-6">
          {/* Logo Brand: Geometric Icon + Steep Wordmark */}
          <a href="#inicio" className="flex items-center gap-2.5 shrink-0 focus:outline-none">
            <div className="w-7 h-7 rounded-full bg-[#17191c] flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H8l5-7v4h3l-5 7z" />
              </svg>
            </div>
            <span className="text-[21px] font-serif font-normal text-[#17191c] tracking-[-0.03em]">
              Steep
            </span>
          </a>

          {/* Nav Items Center */}
          <nav className="hidden lg:flex items-center gap-8 text-[15px] font-normal text-[#17191c]">
            <a href="#product" className="hover:text-[#777b86] transition-colors">
              Product
            </a>
            <a href="#resources" className="hover:text-[#777b86] transition-colors">
              Resources
            </a>
            <a href="#customers" className="hover:text-[#777b86] transition-colors">
              Customers
            </a>
            <a href="#pricing" className="hover:text-[#777b86] transition-colors">
              Pricing
            </a>
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => onEnterSystem('analytics')}
              className="hidden sm:inline-block text-[15px] text-[#17191c] hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Book a demo
            </button>
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="steep-btn-filled text-[15px] px-5 py-2"
            >
              Get started
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full border border-[#ececec] text-[#17191c] cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#ececec] px-6 py-6 space-y-4 text-[16px]">
            {[
              { href: '#product', label: 'Product' },
              { href: '#resources', label: 'Resources' },
              { href: '#customers', label: 'Customers' },
              { href: '#pricing', label: 'Pricing' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1 text-[#17191c] hover:text-[#777b86]"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterSystem('dashboard');
                }}
                className="steep-btn-filled w-full"
              >
                Get started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION — Exact Steep Screenshot Composition */}
      <section id="inicio" className="relative z-10 pt-6 pb-28 px-6">
        {skeletonMode ? (
          <div className="max-w-[1240px] mx-auto">
            <HeroSkeleton />
          </div>
        ) : (
          <div className="max-w-[1240px] mx-auto">
            {/* Center Editorial Typography Headline */}
            <div className="max-w-[800px] mx-auto text-center pt-8 pb-14 space-y-6">
              <h1 className="font-serif font-normal text-[#17191c] text-[54px] sm:text-[72px] lg:text-[86px] leading-[1.08] tracking-[-0.035em]">
                AI analytics for faster <br />
                insights and <span className="italic font-serif">zero chaos</span>
              </h1>
              <p className="text-[17px] sm:text-[19px] leading-[1.45] text-[#555861] max-w-[580px] mx-auto font-normal">
                Steep is an AI analytics platform built on governed metrics that
                powers analysis, reporting and company-wide engagement.
              </p>
              {/* Pair of Pills: Filled + Ghost */}
              <div className="pt-2 flex items-center justify-center gap-4">
                <button
                  onClick={() => onEnterSystem('dashboard')}
                  className="steep-btn-filled text-[15px] px-6 py-2.5"
                >
                  Get started
                </button>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="steep-btn-ghost text-[15px] px-6 py-2.5"
                >
                  Book a demo
                </button>
              </div>
            </div>

            {/* FLOATING PRODUCT ARTIFACT COLLAGE (4 CARDS) */}
            <div className="relative w-full max-w-[1140px] mx-auto min-h-[380px] lg:min-h-[440px]">
              {/* ARTIFACT 1: Top-Left Region Table with Bar Chart */}
              <div
                className="lg:absolute lg:top-[-110px] lg:left-0 w-full sm:w-[320px] bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-4 mb-6 lg:mb-0"
              >
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Left Metric and Bar Chart */}
                  <div className="space-y-2">
                    <div className="text-[28px] font-medium text-[#17191c] leading-none tabular-nums">
                      3 503
                    </div>
                    <div className="text-[12px] text-[#777b86]">
                      2% vs last week
                    </div>
                    {/* Minimal vertical bar chart */}
                    <div className="flex items-end gap-1.5 h-14 pt-2">
                      {[40, 65, 80, 50, 95].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-2.5 rounded-sm ${
                            i === 2 ? 'bg-[#17191c]' : 'bg-[#777b86]/30'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-[#a3a6af] font-mono px-0.5">
                      <span>F</span>
                      <span>S</span>
                      <span>S</span>
                      <span>M</span>
                    </div>
                  </div>

                  {/* Right Region List */}
                  <div className="space-y-1.5 text-[12px] border-l border-[#ececec] pl-3">
                    <span className="text-[11px] font-medium text-[#17191c] block mb-1">
                      Region
                    </span>
                    {[
                      { name: 'Europe', val: '1 373' },
                      { name: 'North America', val: '930' },
                      { name: 'Africa', val: '745' },
                      { name: 'Asia', val: '432' },
                      { name: 'Other', val: '23' },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-[#777b86]">
                        <span className="truncate">{row.name}</span>
                        <span className="text-[#17191c] font-medium tabular-nums">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ARTIFACT 2: Right Registrations / Radial Ring Card (Soft Peach Wash) */}
              <div
                className="lg:absolute lg:top-[-20px] lg:right-0 w-full sm:w-[280px] bg-[#fbf5f0] rounded-[20px] p-5 border border-[#f3e1d5] shadow-[0_0_0_1px_rgba(4,23,43,0.04),0_16px_24px_-4px_rgba(93,42,26,0.08)] space-y-3 mb-6 lg:mb-0"
              >
                <div className="text-[13px] font-medium text-[#5d2a1a]">
                  Registrations
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-[32px] font-medium text-[#17191c] leading-none tabular-nums">
                      2.4k
                    </div>
                    <div className="text-[12px] text-[#777b86] mt-1.5">
                      ↑ 5.5% vs last week
                    </div>
                  </div>

                  {/* Radial Progress Gauge (75% of target) */}
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#edd3c4"
                        strokeWidth="6"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#5d2a1a"
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - 0.75)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-[14px] font-semibold text-[#17191c] leading-none">
                        75%
                      </div>
                      <div className="text-[9px] text-[#777b86] leading-none mt-0.5">
                        of target
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 3: Bottom-Left Activation Line Chart Card with "JB" Cursor Pointer */}
              <div className="lg:absolute lg:bottom-[-20px] lg:left-[40px] w-full sm:w-[320px] mb-6 lg:mb-0">
                {/* JB Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-4 -left-7 z-20 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#dcfce7] border border-[#86efac] text-[#166534] font-medium text-[13px] flex items-center justify-center shadow-sm">
                      JB
                    </div>
                    {/* Mouse pointer cursor arrow */}
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#166534] -ml-1 -mt-3 fill-current drop-shadow-sm">
                      <path d="M2 2l11 4.5-5 1.5-1.5 5L2 2z" />
                    </svg>
                  </div>

                  <div className="bg-white rounded-[20px] p-5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] space-y-3">
                    <div className="text-[13px] font-medium text-[#17191c]">
                      Activation
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-medium text-[#17191c] tabular-nums leading-none">
                        46.2%
                      </span>
                      <span className="text-[12px] text-[#777b86]">
                        103% of target
                      </span>
                    </div>

                    {/* Minimalist Line Chart with Dots */}
                    <div className="h-16 w-full pt-1">
                      <svg viewBox="0 0 240 60" className="w-full h-full overflow-visible">
                        <line x1="0" y1="50" x2="240" y2="50" stroke="#f2f2f3" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="0" y1="20" x2="240" y2="20" stroke="#f2f2f3" strokeWidth="1" strokeDasharray="3 3" />
                        <path
                          d="M 10 50 Q 60 48 100 38 T 160 22 T 220 10"
                          fill="none"
                          stroke="#5d2a1a"
                          strokeWidth="1.8"
                        />
                        <circle cx="10" cy="50" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="100" cy="38" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="160" cy="22" r="3" fill="#ffffff" stroke="#5d2a1a" strokeWidth="1.8" />
                        <circle cx="220" cy="10" r="3" fill="#5d2a1a" />
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-[#979799] font-mono pt-1">
                      <span>Aug</span>
                      <span>Sep</span>
                      <span>Oct</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#f2f2f3] text-[#17191c] font-medium">Nov</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ARTIFACT 4: Bottom-Center AI Question Composer Input with "AF" Cursor Pointer */}
              <div className="lg:absolute lg:bottom-[-50px] lg:right-[140px] w-full sm:w-[380px]">
                {/* AF Avatar Pointer Bubble */}
                <div className="relative">
                  <div className="absolute -top-3 -right-3 z-20 flex items-center">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#1d4ed8] -mr-1 -mt-3 fill-current drop-shadow-sm">
                      <path d="M2 2l11 4.5-5 1.5-1.5 5L2 2z" />
                    </svg>
                    <div className="w-9 h-9 rounded-full bg-[#dbeafe] border border-[#93c5fd] text-[#1e40af] font-medium text-[12px] flex items-center justify-center shadow-sm">
                      AF
                    </div>
                  </div>

                  <div className="bg-white rounded-[20px] p-3.5 border border-[#ececec]/80 shadow-[0_0_0_1px_rgba(4,23,43,0.06),0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.06)] flex items-center gap-3">
                    <input
                      type="text"
                      value={composerQuery}
                      onChange={(e) => setComposerQuery(e.target.value)}
                      placeholder="Ask anything..."
                      className="flex-1 bg-transparent border-none text-[15px] text-[#17191c] placeholder:text-[#a3a6af] focus:outline-none px-2"
                    />

                    <div className="flex items-center gap-2 text-[#a3a6af]">
                      <button type="button" className="p-1 hover:text-[#17191c] cursor-pointer" aria-label="Mention">
                        <AtSign className="w-4 h-4" />
                      </button>
                      <button type="button" className="p-1 hover:text-[#17191c] cursor-pointer" aria-label="History">
                        <Clock className="w-4 h-4" />
                      </button>
                      {/* Black circular send button with white arrow */}
                      <button
                        onClick={() => onEnterSystem('ai')}
                        className="w-9 h-9 rounded-full bg-[#17191c] text-white flex items-center justify-center hover:bg-[#33363d] transition-colors cursor-pointer shrink-0 ml-1"
                        aria-label="Send query"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. BRAND ROW — Monochromatic Quiet Logos */}
      <section className="relative z-10 py-12 px-6 border-y border-[#ececec] bg-white">
        <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-8 text-[#979799] text-[15px] font-medium tracking-tight">
          <span className="hover:text-[#17191c] transition-colors">LINEAR</span>
          <span className="hover:text-[#17191c] transition-colors">PITCH</span>
          <span className="hover:text-[#17191c] transition-colors">ARC</span>
          <span className="hover:text-[#17191c] transition-colors">FRAMER</span>
          <span className="hover:text-[#17191c] transition-colors">RETOOL</span>
          <span className="hover:text-[#17191c] transition-colors">VERCEL</span>
        </div>
      </section>

      {/* 4. FEATURE SECTION ON FOG WHITE (#fafafb) */}
      <section id="product" className="relative z-10 py-24 px-6 bg-[#fafafb]">
        <div className="max-w-[1240px] mx-auto space-y-16">
          <div className="max-w-[760px] space-y-4">
            <span className="steep-tag uppercase tracking-[0.08em] block">
              PLATAFORMA INTEGRAL
            </span>
            <h2 className="font-serif font-normal text-[#17191c] text-[44px] sm:text-[56px] leading-[1.12] tracking-[-0.025em]">
              A new standard for modern analytics.
            </h2>
            <p className="text-[18px] text-[#777b86] leading-relaxed">
              Steep connects directly to your metric layer and telemetry sources, providing an
              editorial canvas for exploration, decision-making, and automated alerts.
            </p>
          </div>

          {/* 3-Column Grid of Neutral Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">GOVERNED METRICS</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Unified semantic layer</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Define your environmental and operational thresholds once. Everyone in your team
                  explores with the same audited source of truth.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('devices')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Explore metrics →
                </button>
              </div>
            </div>

            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">AI INTELLIGENCE</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Conversational answers</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Ask questions in plain language. Steep inspects multivariate Z-Scores and Isolation Forest
                  to deliver instant anomaly breakdowns without query friction.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('ai')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Explore AI →
                </button>
              </div>
            </div>

            <div className="steep-card-neutral p-8 flex flex-col justify-between space-y-6 hover:bg-[#eaeaea] transition-colors">
              <div className="space-y-4">
                <span className="steep-tag uppercase tracking-[0.08em]">AUDIT & EXPORT</span>
                <h3 className="text-[22px] font-medium text-[#17191c]">Editorial reporting</h3>
                <p className="text-[16px] text-[#777b86] leading-relaxed">
                  Build beautiful presentations, monitor real-time charts, and export GxP-ready CSV records
                  with zero extra formatting required.
                </p>
              </div>
              <div>
                <button
                  onClick={() => onEnterSystem('analytics')}
                  className="steep-link font-medium cursor-pointer"
                >
                  Explore reports →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. THE SIGNATURE ACCENT PEACH CARD (#fbe1d1) */}
      <section className="relative z-10 py-16 px-6 bg-white">
        <div className="max-w-[1240px] mx-auto steep-card-peach grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-4">
            <span className="text-[13px] uppercase tracking-[0.1em] text-[#5d2a1a] font-medium">
              EDITORIAL EXCELLENCE
            </span>
            <h2 className="text-[34px] md:text-[42px] font-serif font-normal text-[#5d2a1a] leading-tight">
              The power of governed metrics with the speed of AI.
            </h2>
            <p className="text-[18px] text-[#5d2a1a]/85 max-w-[640px] leading-relaxed">
              "Steep eliminates the disconnect between telemetry engineering and operational teams.
              We replaced four disparate reporting tools with one serene, trustworthy interface."
            </p>
            <div className="text-[14px] text-[#5d2a1a]/70 pt-2 font-medium">
              Elena Rostova · VP of Engineering &amp; Environmental Systems
            </div>
          </div>
          <div className="flex md:justify-end">
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="bg-[#5d2a1a] text-[#fbe1d1] px-6 py-3 rounded-full text-[15px] font-medium hover:bg-[#431d11] transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              Start exploring
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE PRODUCT PREVIEW TAB SECTION */}
      <section id="resources" className="relative z-10 py-24 px-6 bg-[#fafafb] border-t border-[#ececec]">
        <div className="max-w-[1240px] mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-[620px] space-y-3">
              <span className="steep-tag uppercase tracking-[0.08em]">PRODUCT ARCHITECTURE</span>
              <h2 className="font-serif font-normal text-[#17191c] text-[40px] sm:text-[48px] leading-tight">
                Designed for teams that value precision.
              </h2>
            </div>

            {/* Tab buttons */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-full border border-[#ececec]">
              {[
                { id: 'metrics', label: 'Metrics' },
                { id: 'exploration', label: 'Exploration' },
                { id: 'reporting', label: 'Reporting' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-5 py-2 rounded-full text-[14px] transition-colors cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-[#17191c] text-white font-normal'
                      : 'text-[#777b86] hover:text-[#17191c]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Floating Product Artifact */}
          <div className="steep-card-artifact p-8 sm:p-12 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececec] pb-6">
              <div>
                <span className="steep-tag">LIVE TELEMETRY STREAM</span>
                <h3 className="text-[26px] font-medium text-[#17191c] mt-1">
                  {activeTab === 'metrics'
                    ? 'Governed Operational Telemetry'
                    : activeTab === 'exploration'
                    ? 'Anomaly Detection & Inferences'
                    : 'Certified Audit Reports'}
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2f2f3] text-[13px] text-[#17191c] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#17191c] animate-pulse" />
                Live Connection Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">Mean Temperature</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  23.4 °C
                </div>
                <div className="text-[13px] text-[#979799] pt-1">↑ 0.2° within nominal band</div>
              </div>

              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">Relative Humidity</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  61.8 %RH
                </div>
                <div className="text-[13px] text-[#979799] pt-1">Optimal tolerance (40–70%)</div>
              </div>

              <div className="steep-card-neutral p-6 space-y-2">
                <div className="text-[14px] text-[#777b86]">Z-Score ML Score</div>
                <div className="text-[36px] font-medium text-[#17191c] tabular-nums leading-none">
                  0.04 σ
                </div>
                <div className="text-[13px] text-[#979799] pt-1">Isolation Forest active</div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => onEnterSystem('dashboard')}
                className="steep-btn-filled text-[15px] px-6 py-2.5"
              >
                Open live console →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA SECTION */}
      <section id="pricing" className="relative z-10 py-28 px-6 bg-white text-center">
        <div className="max-w-[780px] mx-auto space-y-6">
          <span className="steep-tag uppercase tracking-[0.08em] block">
            GET STARTED TODAY
          </span>
          <h2 className="font-serif font-normal text-[#17191c] text-[48px] sm:text-[64px] leading-tight tracking-[-0.03em]">
            Ready for analytics <br />
            without chaos?
          </h2>
          <p className="text-[18px] text-[#777b86] max-w-[520px] mx-auto leading-relaxed">
            Join the teams building trustworthy data cultures with Steep. Sign in with your account
            or request a dedicated deployment.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <button
              onClick={() => onEnterSystem('dashboard')}
              className="steep-btn-filled text-[16px] px-7 py-3"
            >
              Get started
            </button>
            <button
              onClick={() => onEnterSystem('analytics')}
              className="steep-btn-ghost text-[16px] px-7 py-3"
            >
              Book a demo
            </button>
          </div>
        </div>
      </section>

      {/* 8. FOOTER — Quiet Paper White */}
      <footer id="customers" className="relative z-10 bg-white text-[#777b86] border-t border-[#ececec] py-16 px-6">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#17191c]" />
              <span className="text-[20px] font-serif font-normal text-[#17191c]">Steep</span>
            </div>
            <p className="text-[15px] text-[#777b86] max-w-[320px] leading-relaxed">
              AI analytics platform built on governed metrics. Fast, collaborative and beautifully designed.
            </p>
          </div>

          <div className="space-y-3 text-[14px]">
            <span className="steep-tag uppercase tracking-[0.08em] block font-medium">PRODUCT</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <button onClick={() => onEnterSystem('dashboard')} className="hover:text-[#17191c] cursor-pointer">
                  Metrics Layer
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('ai')} className="hover:text-[#17191c] cursor-pointer">
                  AI Exploration
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('analytics')} className="hover:text-[#17191c] cursor-pointer">
                  Reports
                </button>
              </li>
              <li>
                <button onClick={() => onEnterSystem('devices')} className="hover:text-[#17191c] cursor-pointer">
                  Integrations
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <span className="steep-tag uppercase tracking-[0.08em] block font-medium">RESOURCES</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <a href="#product" className="hover:text-[#17191c]">Documentation</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[#17191c]">Changelog</a>
              </li>
              <li>
                <a href="#customers" className="hover:text-[#17191c]">Community</a>
              </li>
              <li>
                <a href="#inicio" className="hover:text-[#17191c]">Security</a>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-[14px]">
            <span className="steep-tag uppercase tracking-[0.08em] block font-medium">COMPANY</span>
            <ul className="space-y-2 text-[#777b86]">
              <li>
                <a href="#inicio" className="hover:text-[#17191c]">About</a>
              </li>
              <li>
                <a href="#customers" className="hover:text-[#17191c]">Customers</a>
              </li>
              <li>
                <a href="#inicio" className="hover:text-[#17191c]">Careers</a>
              </li>
              <li>
                <a href="#inicio" className="hover:text-[#17191c]">Privacy Policy</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto mt-12 pt-8 border-t border-[#ececec] flex flex-wrap items-center justify-between gap-4 text-[14px] text-[#979799]">
          <span>© 2026 Steep Analytics. All rights reserved.</span>
          <span>Powered by SIMOA Technical Engine</span>
        </div>
      </footer>
    </div>
  );
};
