import React, { useEffect, useRef, useState } from 'react';

type AnimationType = 'fade-in' | 'slide-up' | 'slide-left' | 'slide-right' | 'scale-in';

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  lazy?: boolean;
  skeleton?: React.ReactNode;
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  lazyDelay?: number;
}) {
  const ref = useRef<T | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if user prefers reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setHasEntered(true);
      setContentReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          const delay = options?.lazyDelay ?? 180;
          setTimeout(() => setContentReady(true), delay);
          observer.unobserve(el);
        }
      },
      {
        threshold: options?.threshold ?? 0.12,
        rootMargin: options?.rootMargin ?? '0px 0px -40px 0px',
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
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
  animation = 'slide-up',
  delay = 0,
  className = '',
  lazy = false,
  skeleton = null,
}) => {
  const { ref, hasEntered, contentReady } = useScrollAnimation<HTMLDivElement>({
    threshold: 0.1,
    lazyDelay: lazy ? 220 : 0,
  });

  const getAnimationClasses = () => {
    if (!hasEntered) {
      switch (animation) {
        case 'slide-up':
          return 'opacity-0 translate-y-8';
        case 'slide-left':
          return 'opacity-0 -translate-x-8';
        case 'slide-right':
          return 'opacity-0 translate-x-8';
        case 'scale-in':
          return 'opacity-0 scale-95';
        case 'fade-in':
        default:
          return 'opacity-0';
      }
    }
    return 'opacity-100 translate-y-0 translate-x-0 scale-100';
  };

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out transform ${getAnimationClasses()} ${className}`}
    >
      {lazy && !contentReady && skeleton ? skeleton : children}
    </div>
  );
};
