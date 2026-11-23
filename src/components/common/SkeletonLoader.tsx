import React from 'react';

export const SkeletonBox: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = 'h-4 w-full', rounded = 'rounded-[10px]' }) => {
  return (
    <div
      className={`animate-pulse bg-sheet-white ${rounded} ${className} relative overflow-hidden`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-sage-mist/60 to-transparent" />
    </div>
  );
};

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-16 space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-5">
          <SkeletonBox className="h-6 w-44" rounded="rounded-[8px]" />
          <SkeletonBox className="h-16 w-full max-w-xl" rounded="rounded-[16px]" />
          <SkeletonBox className="h-16 w-3/4" rounded="rounded-[16px]" />
          <SkeletonBox className="h-5 w-4/5 mt-3" />
          <SkeletonBox className="h-5 w-2/3" />
          <div className="flex gap-4 pt-3">
            <SkeletonBox className="h-12 w-56" rounded="rounded-[36px]" />
            <SkeletonBox className="h-12 w-40" rounded="rounded-[999px]" />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-sage-mist">
            <SkeletonBox className="h-12 w-full" rounded="rounded-[16px]" />
            <SkeletonBox className="h-12 w-full" rounded="rounded-[16px]" />
            <SkeletonBox className="h-12 w-full" rounded="rounded-[16px]" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <SkeletonBox className="h-96 w-full" rounded="rounded-[16px]" />
        </div>
      </div>
    </div>
  );
};

export const CardGridSkeleton: React.FC<{ count?: number; cols?: string }> = ({
  count = 6,
  cols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
}) => {
  return (
    <div className={`grid ${cols} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-sheet-white rounded-[16px] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-10 w-10" rounded="rounded-[8px]" />
            <SkeletonBox className="h-5 w-16" rounded="rounded-[5px]" />
          </div>
          <SkeletonBox className="h-6 w-3/4" />
          <SkeletonBox className="h-4 w-full" />
          <SkeletonBox className="h-4 w-5/6" />
          <div className="pt-3 border-t border-sage-mist flex justify-between">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const FlowSequenceSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-sheet-white rounded-[16px] p-4 space-y-3 text-center"
        >
          <SkeletonBox className="h-10 w-10 mx-auto" rounded="rounded-[8px]" />
          <SkeletonBox className="h-4 w-20 mx-auto" />
          <SkeletonBox className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
};
