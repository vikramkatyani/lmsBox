import React from 'react';

export function CourseCardSkeleton() {
  return (
    <div className="relative bg-white rounded overflow-hidden shadow animate-pulse w-full min-w-0 shrink-0">
      {/* Image skeleton - responsive height for more substance */}
      <div className="h-40 md:h-48 lg:h-56 bg-gray-200 w-full"></div>
      
      {/* Content skeleton - responsive padding and content */}
      <div className="p-4 md:p-5 lg:p-6 w-full">
        {/* Title skeleton - responsive sizing */}
        <div className="h-5 md:h-6 lg:h-7 bg-gray-200 rounded mb-2 w-full"></div>
        <div className="h-4 md:h-5 lg:h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
        
        {/* Additional content for larger screens */}
        <div className="hidden md:block mb-4">
          <div className="h-4 lg:h-5 bg-gray-200 rounded mb-2 w-5/6"></div>
          <div className="h-4 lg:h-5 bg-gray-200 rounded w-2/3"></div>
        </div>
        
        {/* Progress bar skeleton - responsive sizing */}
        <div className="mt-4 w-full">
          <div className="h-2 md:h-3 bg-gray-200 rounded mb-2 md:mb-3 w-full"></div>
          <div className="h-4 md:h-5 bg-gray-200 rounded w-20 md:w-24 lg:w-28"></div>
        </div>
      </div>
    </div>
  );
}

export function CourseGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {Array.from({ length: count }, (_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default CourseCardSkeleton;