// src/components/subcategory/SubCategoryCard.tsx
'use client';

import Link from 'next/link';
import { SubCategoryDto } from '@/types/api';
import { ChevronRight, Tag } from 'lucide-react'; 

interface SubCategoryCardProps {
  subCategory: SubCategoryDto;
  areaSlug: string; // UPDATED: from citySlug to areaSlug
  href: string;     // This pre-constructed href will be used
}

export default function SubCategoryCard({ subCategory, areaSlug, href }: SubCategoryCardProps) {
  // The displayName logic is good.
  const displayName = subCategory.name.replace(/([A-Z])/g, ' $1').trim(); 

  return (
    <Link 
      href={href} // Using the href passed from the parent
      className="group block p-4 sm:p-5 bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
      aria-label={`View ${displayName} services in ${areaSlug.replace(/-/g, ' ')}`} // Enhanced aria-label
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-2">
            <Tag className="w-4 h-4 mr-2 text-emerald-400 flex-shrink-0" />
            <h3 className="font-semibold text-white group-hover:text-emerald-300 text-base sm:text-lg transition-colors text-shadow-medium truncate">
              {displayName}
            </h3>
          </div>
          {subCategory.shopCount > 0 ? (
            <p className="text-xs sm:text-sm text-slate-300 text-shadow-soft">
              {subCategory.shopCount} {subCategory.shopCount === 1 ? 'service point' : 'service points'} available
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-400 text-shadow-soft">No service points listed currently</p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors flex-shrink-0 ml-3" />
      </div>
    </Link>
  );
}
// // src/components/subcategory/SubCategoryCard.tsx
// 'use client';

// import Link from 'next/link';
// import { SubCategoryDto } from '@/types/api';
// // import { cn } from '@/lib/utils'; // cn is not used in this component
// import { ChevronRight, Tag } from 'lucide-react'; 

// interface SubCategoryCardProps {
//   subCategory: SubCategoryDto;
//   areaSlug: string; // UPDATED: from citySlug to areaSlug
//   href: string;     // This pre-constructed href will be used
// }

// export default function SubCategoryCard({ subCategory, areaSlug, href }: SubCategoryCardProps) {
//   // The displayName logic is good.
//   const displayName = subCategory.name.replace(/([A-Z])/g, ' $1').trim(); 

//   return (
//     <Link 
//       href={href} // Using the href passed from the parent
//       className="group block p-4 bg-white rounded-lg border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all duration-200"
//       aria-label={`View ${displayName} services in ${areaSlug.replace(/-/g, ' ')}`} // Enhanced aria-label
//     >
//       <div className="flex items-center justify-between">
//         <div>
//           <div className="flex items-center text-sm text-orange-600 mb-1">
//             <Tag className="w-4 h-4 mr-1.5" />
//             <h3 className="font-semibold text-slate-700 group-hover:text-orange-700 text-base">
//               {displayName}
//             </h3>
//           </div>
//           {subCategory.shopCount > 0 ? (
//             <p className="text-xs text-slate-500">
//               {subCategory.shopCount} {subCategory.shopCount === 1 ? 'service point' : 'service points'} available
//             </p>
//           ) : (
//             <p className="text-xs text-slate-400">No service points listed currently</p>
//           )}
//         </div>
//         <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-600 transition-colors" />
//       </div>
//     </Link>
//   );
// }
// // // src/components/subcategory/SubCategoryCard.tsx
// // 'use client';

// // import Link from 'next/link';
// // import { SubCategoryDto } from '@/types/api';
// // import { cn } from '@/lib/utils';
// // import { ChevronRight, Tag } from 'lucide-react'; // Or another suitable icon for subcategories

// // interface SubCategoryCardProps {
// //   subCategory: SubCategoryDto;
// //   citySlug: string;
// //   href: string;
// // }

// // export default function SubCategoryCard({ subCategory, citySlug, href }: SubCategoryCardProps) {
// //   // You might want a helper to get a more user-friendly display name from subCategory.name
// //   // (which is currently the enum string like "GeneralMaintenance")
// //   const displayName = subCategory.name.replace(/([A-Z])/g, ' $1').trim(); 

// //   return (
// //     <Link 
// //       // href={`/cities/${citySlug}/categories/${subCategory.slug}/shops`}
// //       href={href}
// //       className="group block p-4 bg-white rounded-lg border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all duration-200"
// //     >
// //       <div className="flex items-center justify-between">
// //         <div>
// //           <div className="flex items-center text-sm text-orange-600 mb-1">
// //             <Tag className="w-4 h-4 mr-1.5" />
// //             <h3 className="font-semibold text-slate-700 group-hover:text-orange-700 text-base">
// //               {displayName}
// //             </h3>
// //           </div>
// //           {subCategory.shopCount > 0 ? (
// //             <p className="text-xs text-slate-500">
// //               {subCategory.shopCount} {subCategory.shopCount === 1 ? 'service point' : 'service points'} available
// //             </p>
// //           ) : (
// //             <p className="text-xs text-slate-400">No service points listed currently</p>
// //           )}
// //         </div>
// //         <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-orange-600 transition-colors" />
// //       </div>
// //     </Link>
// //   );
// // }