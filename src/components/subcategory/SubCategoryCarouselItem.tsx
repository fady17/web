'use client';

import React from 'react';
import { PredefinedSubCategory } from '@/config/categories';
import { ArrowRight, Layers, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubCategoryCarouselItemProps {
  subCategory: PredefinedSubCategory;
  onClick: () => void;
  shopCount?: number | null;
  isLoading?: boolean;
  className?: string; // For base glass styling applied by parent if needed
  textClassName?: string;
  iconClassName?: string;
}

const SubCategoryCarouselItem: React.FC<SubCategoryCarouselItemProps> = React.memo(({ 
  subCategory, 
  onClick,
  shopCount,
  isLoading,
  className, // This will receive the glass background classes from page.tsx
  textClassName = "text-slate-100 text-shadow-medium",
  iconClassName = "text-emerald-400",
}) => {
  const IconComponent = subCategory.icon;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "p-3 sm:p-4 h-full w-full flex flex-col justify-between items-center text-center",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-2 focus:ring-offset-black/30", // Focus state
        "rounded-xl transition-transform duration-150 ease-in-out", // Keep subtle transition for active state
        "active:scale-[0.97] active:brightness-90", // Tap feedback
        className // This prop will apply the glass background, border, shadow from page.tsx
      )}
      aria-label={`Explore ${subCategory.name}`}
    >
      <div className="flex flex-col items-center justify-center flex-grow mb-2"> {/* Ensure content is centered and title has space */}
        {isLoading ? (
            <div className="mb-2 sm:mb-3 flex-shrink-0">
                <Loader2 className={cn("w-6 h-6 sm:w-7 animate-spin", iconClassName)} />
            </div>
        ) : IconComponent ? (
          <div className="mb-2 sm:mb-3 flex-shrink-0">
            <IconComponent className={cn("w-6 h-6 sm:w-7", iconClassName)} />
          </div>
        ) : (
             <div className="mb-2 sm:mb-3 flex-shrink-0">
                <Layers className={cn("w-6 h-6 sm:w-7", iconClassName === "text-emerald-400" ? "text-slate-400" : iconClassName)} />
            </div>
        )}
        <h3 className={cn(
            "text-xs sm:text-sm font-semibold leading-tight line-clamp-2", // Ensure line-clamp and text size
            textClassName
        )}>
          {subCategory.name}
        </h3>
        {shopCount !== undefined && shopCount !== null && shopCount > 0 && (
          <p className={cn("text-[10px] sm:text-xs mt-1", textClassName === "text-slate-100 text-shadow-medium" ? "text-slate-300" : "text-slate-500")}>
            {shopCount} available
          </p>
        )}
      </div>
      <div className={cn("mt-auto pt-2 border-t border-white/10 w-full text-xs font-medium flex items-center justify-center", iconClassName === "text-emerald-400" ? "text-emerald-400" : "text-current")}>
        Explore 
        <ArrowRight className="w-3 h-3 ml-1.5"/>
      </div>
    </button>
  );
});
SubCategoryCarouselItem.displayName = 'SubCategoryCarouselItem';

export default SubCategoryCarouselItem;
// // src/components/subcategory/SubCategoryCarouselItem.tsx
// 'use client';

// import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { PredefinedSubCategory } from '@/config/categories'; // Using the predefined type
// import { ArrowRight } from 'lucide-react';
// import { cn } from '@/lib/utils';

// interface SubCategoryCarouselItemProps {
//   subCategory: PredefinedSubCategory;
//   onClick: () => void; // Parent will handle the click logic (geo, nav)
//   shopCount?: number | null; // Optional: To display if city is known and counts fetched
//   isLoading?: boolean; // For individual item loading state if needed
//   // Add a new prop for styling context
//   className?: string; // Allow passing external classes
//   textClassName?: string; // For text elements
//   iconClassName?: string; // For icon elements
// }

// const SubCategoryCarouselItem: React.FC<SubCategoryCarouselItemProps> = ({ 
//   subCategory, 
//   onClick,
//   shopCount,
//   isLoading,
//   className, // Use this for the outer button
//   textClassName = "text-slate-100", // Default to glass theme text
//   iconClassName = "text-emerald-400", // Default to glass theme icon
// }) => {
//   const IconComponent = subCategory.icon;

//   return (
//     <button
//       onClick={onClick}
//       disabled={isLoading}
//       className={cn(
//         "block p-3 sm:p-4 h-full w-full flex-col justify-between items-center text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-black/20 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5",
//         className // External classes for background/border managed by parent
//       )}
//       aria-label={`Explore ${subCategory.name}`}
//     >
//       <Card className="h-full flex flex-col justify-between hover:shadow-xl transition-all duration-300 bg-transparent border-0 group">
//         <CardHeader className="pb-2">
//           {IconComponent && (
//             <div className="flex justify-center mb-2">
//               <IconComponent className={cn("w-7 h-7 group-hover:scale-110 transition-transform duration-200", iconClassName)} />
//             </div>
//           )}
//           <CardTitle className={cn("text-base font-semibold group-hover:text-emerald-300 transition-colors leading-tight text-shadow-medium", textClassName)}>
//             {subCategory.name}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="flex-grow pt-0 pb-3">
//           {shopCount !== undefined && shopCount !== null && shopCount > 0 && (
//             <p className="text-xs text-slate-300 mt-1 text-shadow-soft">
//               {shopCount} available
//             </p>
//           )}
//           {shopCount === 0 && (
//             <p className="text-xs text-slate-400 mt-1 text-shadow-soft">
//               None listed currently
//             </p>
//           )}
//         </CardContent>
//         <div className="p-4 pt-0 text-xs font-medium text-emerald-400 group-hover:text-emerald-300 flex items-center justify-center transition-colors">
//           Explore 
//           <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform"/>
//         </div>
//       </Card>
//     </button>
//   );
// };

// export default SubCategoryCarouselItem;
// // // src/components/subcategory/SubCategoryCarouselItem.tsx
// // 'use client';

// // import React from 'react';
// // import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// // import { PredefinedSubCategory } from '@/config/categories'; // Using the predefined type
// // import { ArrowRight } from 'lucide-react';
// // import { cn } from '@/lib/utils';

// // interface SubCategoryCarouselItemProps {
// //   subCategory: PredefinedSubCategory;
// //   onClick: () => void; // Parent will handle the click logic (geo, nav)
// //   shopCount?: number | null; // Optional: To display if city is known and counts fetched
// //   isLoading?: boolean; // For individual item loading state if needed
// //   // Add a new prop for styling context
// //   className?: string; // Allow passing external classes
// //   textClassName?: string; // For text elements
// //   iconClassName?: string; // For icon elements
// // }

// // const SubCategoryCarouselItem: React.FC<SubCategoryCarouselItemProps> = ({ 
// //   subCategory, 
// //   onClick,
// //   shopCount,
// //   isLoading,
// //   className, // Use this for the outer button
// //   textClassName = "text-slate-800", // Default to light theme text
// //   iconClassName = "text-orange-600", // Default to light theme icon
// // }) => {
// //   const IconComponent = subCategory.icon;

// //   return (
// //     <button
// //       onClick={onClick}
// //       disabled={isLoading}
// //       // className="w-full h-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded-lg"
// //       className={cn(
// //         "block p-3 sm:p-4 h-full w-full flex-col justify-between items-center text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded-lg",
// //         className // External classes for background/border managed by parent
// //       )}
// //       aria-label={`Explore ${subCategory.name}`}
// //     >
// //       <Card className="h-full flex flex-col justify-between hover:shadow-md transition-shadow duration-200 bg-white group">
// //         <CardHeader className="pb-2">
// //           {IconComponent && <IconComponent className="w-7 h-7 mb-2 text-orange-500 group-hover:text-orange-600 transition-colors" />}
// //           <CardTitle className="text-base font-semibold text-slate-700 group-hover:text-orange-600 transition-colors leading-tight">
// //             {subCategory.name}
// //           </CardTitle>
// //         </CardHeader>
// //         <CardContent className="flex-grow pt-0 pb-3">
// //           {/* Placeholder for a short description if you add it to PredefinedSubCategory */}
// //           {/* <p className="text-xs text-slate-500">Brief line about this service.</p> */}
// //           {shopCount !== undefined && shopCount !== null && shopCount > 0 && (
// //             <p className="text-xs text-slate-500 mt-1">{shopCount} available</p>
// //           )}
// //            {shopCount === 0 && (
// //             <p className="text-xs text-slate-400 mt-1">None listed currently</p>
// //           )}
// //         </CardContent>
// //         <div className="p-4 pt-0 text-xs font-medium text-orange-500 group-hover:text-orange-600 flex items-center transition-colors">
// //           Explore <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform"/>
// //         </div>
// //       </Card>
// //     </button>
// //   );
// // };

// // export default SubCategoryCarouselItem;