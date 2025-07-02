'use client';

import React from 'react';
import { CityDto } from '@/types/api';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CityCardProps {
  city: CityDto;
  onClick: (citySlug: string) => void;
  className?: string; 
  // textClassName?: string; (Add if you want to control text color from parent)
  // iconClassName?: string; (Add if you want to control icon color from parent)
}

const CityCard: React.FC<CityCardProps> = React.memo(({ 
    city, 
    onClick, 
    className,
    // textClassName = "text-white text-shadow-medium",
    // iconClassName = "text-emerald-400"
}) => {
  return (
    <button
      onClick={() => onClick(city.slug)}
      className={cn(
        "w-full p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-2 focus:ring-offset-black/30 transition-transform duration-150 ease-in-out cursor-pointer flex flex-col items-center text-center h-full",
        // Base glass styles will be passed via className from page.tsx
        "active:scale-[0.97] active:brightness-90", // Tap feedback
        className 
      )}
    >
      <MapPin className={cn("w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-3 text-emerald-400")} />
      <h3 className={cn("text-sm sm:text-base font-semibold text-white text-shadow-medium line-clamp-2 mb-0.5")}>
        {city.nameEn}
      </h3>
      {city.nameAr && (
        <p className={cn("text-xs sm:text-sm text-slate-300 text-shadow-soft")}>
            {city.nameAr}
        </p>
      )}
    </button>
  );
});
CityCard.displayName = 'CityCard';

export default CityCard;
// // src/components/city/CityCard.tsx
// 'use client';

// import React from 'react';
// import { CityDto } from '@/types/api';
// import { MapPin } from 'lucide-react';

// interface CityCardProps {
//   city: CityDto;
//   onClick: (citySlug: string) => void;
// }

// const CityCard: React.FC<CityCardProps> = ({ city, onClick }) => {
//   return (
//     <button
//       onClick={() => onClick(city.slug)}
//       className="w-full bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 p-4 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-black/20 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-full transform hover:-translate-y-0.5"
//     >
//       <MapPin className="w-10 h-10 text-emerald-400 mb-3 group-hover:scale-110 transition-transform duration-200" />
//       <h3 className="text-lg font-semibold text-white mb-1 hover:text-emerald-300 transition-colors text-shadow-medium">
//         {city.nameEn}
//       </h3>
//       <p className="text-sm text-slate-300 text-shadow-soft">{city.nameAr}</p>
//     </button>
//   );
// };

// export default CityCard;
// // // src/components/city/CityCard.tsx
// // 'use client';

// // import React from 'react';
// // import { CityDto } from '@/types/api';
// // import { MapPin } from 'lucide-react';

// // interface CityCardProps {
// //   city: CityDto;
// //   onClick: (citySlug: string) => void;
// // }

// // const CityCard: React.FC<CityCardProps> = ({ city, onClick }) => {
// //   return (
// //     <button
// //       onClick={() => onClick(city.slug)}
// //       className="w-full bg-white p-4 rounded-lg shadow-md hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 cursor-pointer flex flex-col items-center text-center h-full"
// //     >
// //       <MapPin className="w-10 h-10 text-orange-500 mb-3" />
// //       <h3 className="text-lg font-semibold text-slate-800 mb-1 group-hover:text-orange-600">
// //         {city.nameEn}
// //       </h3>
// //       <p className="text-sm text-slate-600">{city.nameAr}</p>
// //     </button>
// //   );
// // };

// // export default CityCard;