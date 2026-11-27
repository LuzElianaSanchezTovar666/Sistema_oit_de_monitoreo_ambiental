import React from 'react';

/**
 * Steep Ambient Background Aura:
 * Ethereal soft peach & mist glowing radial gradient wash over paper white canvas.
 * Completely eliminates any legacy dark, green, or greenhouse lines.
 */
export const EnvironmentalThreeBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-white"
    >
      {/* Primary Warm Peach Aura (Top-Right / Center-Right) */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[85vw] max-w-[1100px] h-[75vh] max-h-[900px] rounded-full blur-[120px] opacity-75"
        style={{
          background: 'radial-gradient(circle, #fbe1d1 0%, rgba(251, 225, 209, 0.5) 45%, rgba(255, 255, 255, 0) 75%)',
        }}
      />

      {/* Secondary Soft Mist Aura (Top-Left / Mid-Left) */}
      <div
        className="absolute top-[5%] left-[-10%] w-[65vw] max-w-[850px] h-[60vh] max-h-[750px] rounded-full blur-[140px] opacity-60"
        style={{
          background: 'radial-gradient(circle, #edf0f5 0%, rgba(237, 240, 245, 0.4) 50%, rgba(255, 255, 255, 0) 80%)',
        }}
      />

      {/* Subtle Warm Amber Glow Accent */}
      <div
        className="absolute top-[35%] right-[20%] w-[45vw] max-w-[600px] h-[45vh] max-h-[550px] rounded-full blur-[130px] opacity-40"
        style={{
          background: 'radial-gradient(circle, #fcd9c3 0%, rgba(252, 217, 195, 0.3) 50%, rgba(255, 255, 255, 0) 80%)',
        }}
      />
    </div>
  );
};
