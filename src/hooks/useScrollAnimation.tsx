import React, { useEffect, useRef, useState } from 'react';

type AnimationType = 'fade-in' | 'slide-up' | 'slide-left' | 'slide-right' | 'scale-in';

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  lazyDelay?: number;
}) {
  const ref = useRef<T | null>(null);
  // Start visible immediately so no section can ever remain hidden at opacity-0 on any viewport/browser
  const [hasEntered, setHasEntered] = useState(true);
  const [contentReady, setContentReady] = useState(true);

  useEffect(() => {
    setHasEntered(true);
    setContentReady(true);
  }, [options?.threshold, options?.rootMargin, options?.lazyDelay]);

  return { ref, hasEntered, contentReady };
}

export const ScrollReveal: React.FC<{
  children: React.ReactNode;
  animation?: AnimationType;
  delay?: number;
  className?: string;
  lazy?: boolean;
  skeleton?: React.ReactNode;
}> = ({
  children,
  delay = 0,
  className = '',
}) => {
  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out opacity-100 translate-y-0 translate-x-0 scale-100 ${className}`}
    >
      {children}
    </div>
  );
};
