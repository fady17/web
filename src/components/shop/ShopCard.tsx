'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShopDto } from '@/types/api';
// Removed direct import of 'Card' from shadcn if we are fully controlling styling via className
// If you still want to use <Card> as a structural element, ensure its default bg/border are made transparent.
import { MapPin, Building2 } from "lucide-react";
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const DynamicMapView = dynamic(() => import('./MapView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-700/30"> {/* Darker loading for glass */}
      <div className="text-center text-slate-300">
        <MapPin className="w-10 h-10 mx-auto mb-1 opacity-50 animate-pulse" />
        <p className="text-xs">Loading map...</p>
      </div>
    </div>
  )
});

interface ShopCardProps {
  shop: ShopDto;
  areaSlug: string; 
  className?: string; // For glass effect styling from parent
  // Optional: if you want to pass specific text/icon colors from parent
  // textClassName?: string; 
  // iconClassName?: string;
}

const formatDistance = (distanceInMeters?: number | null): string => {
  if (distanceInMeters === undefined || distanceInMeters === null || typeof distanceInMeters !== 'number' || !isFinite(distanceInMeters)) {
    return "Distance unavailable";
  }
  if (distanceInMeters === -1) return "N/A"; // More concise for error
  if (distanceInMeters < 50) return "< 50m";
  if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)}m`;
  const distanceInKm = distanceInMeters / 1000;
  return `${distanceInKm.toFixed(1)}km`;
};

// Updated getStatusInfo to return Tailwind classes directly for glass theme
const getStatusInfo = (openingHours?: string | null): { text: string; dotClasses: string; textClasses: string; bgClasses: string; } => {
  const statusText = openingHours ? openingHours.split('\n')[0] : "Hours not specified";
  
  if (openingHours?.toLowerCase().includes("open")) {
    return { text: statusText, dotClasses: "bg-emerald-400", textClasses: "text-emerald-200", bgClasses: "bg-emerald-500/20" };
  } else if (openingHours?.toLowerCase().includes("closed")) {
    return { text: statusText, dotClasses: "bg-red-400", textClasses: "text-red-200", bgClasses: "bg-red-500/20" };
  }
  return { text: statusText, dotClasses: "bg-slate-400", textClasses: "text-slate-300", bgClasses: "bg-slate-500/20" };
};

export default function ShopCard({ shop, areaSlug, className }: ShopCardProps) {
  const displayName = shop.nameEn || shop.nameAr || "Shop Name Unavailable";
  const displayAddress = shop.address || "Address not available";
  
  // Use shop.categorySlug (from the updated ShopDto) for the link
  const detailPageLink = `/operational-areas/${areaSlug}/categories/${shop.categorySlug}/shops/${shop.id}`;
  
  const distanceText = formatDistance(shop.distanceInMeters);
  const statusInfo = getStatusInfo(shop.openingHours);

  const mapCenter = useMemo(() => {
    if (typeof shop.latitude === 'number' && typeof shop.longitude === 'number' && !isNaN(shop.latitude) && !isNaN(shop.longitude)) {
      return [shop.latitude, shop.longitude] as [number, number];
    }
    return null; // Return null if coordinates are invalid/missing
  }, [shop.latitude, shop.longitude]);

  const hasValidCoordinates = !!mapCenter;

  // Determine if distance should actually be shown based on whether it's a valid calculation
  const shouldShowActualDistance = !(distanceText.toLowerCase().includes("unavailable") || distanceText.toLowerCase().includes("n/a"));

  return (
    <Link
      href={detailPageLink}
      className={cn(
        "group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 overflow-hidden h-[290px] sm:h-[300px] transition-shadow duration-300", // Defined height, adjusted focus ring
        "hover:shadow-2xl", // Subtle shadow increase on hover
        className // This applies the glass background/border from parent (e.g., "bg-black/30 border-white/10 ...")
      )}
    >
      {/* Card structure: using divs for full control with passed className */}
      <div className="relative flex flex-col w-full h-full overflow-hidden rounded-xl"> {/* Ensure rounded corners are respected */}
        {/* Map/Image Area */}
        <div className="relative h-[60%] flex-shrink-0 bg-slate-700/50"> {/* Adjusted height proportion, fallback color */}
          {hasValidCoordinates && mapCenter ? (
            <DynamicMapView
              center={mapCenter}
              displayName={displayName}
              displayAddress={displayAddress}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <MapPin className="w-10 h-10 mx-auto mb-1 opacity-60" />
                <p className="text-xs">Location Map Unavailable</p>
              </div>
            </div>
          )}
          {/* Text Overlay on Map/Image */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent p-3 z-[1]">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-2 min-w-0"> {/* Added min-w-0 for truncation */}
                <h3 className="text-white font-semibold text-[0.9rem] leading-tight line-clamp-2 text-shadow-medium group-hover:text-emerald-300 transition-colors">
                  {displayName}
                </h3>
                {displayAddress && (
                  <p className="text-slate-200/90 text-xs mt-0.5 line-clamp-1 leading-tight text-shadow-soft">
                    {displayAddress}
                  </p>
                )}
              </div>
              {shop.logoUrl ? (
                <div className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-md p-1 shadow-sm flex-shrink-0 border border-white/20">
                  <Image
                    src={shop.logoUrl}
                    alt={`${displayName} logo`}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-slate-600/50 backdrop-blur-sm rounded-md flex items-center justify-center flex-shrink-0 border border-white/10">
                  <Building2 className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Area (Bottom Part) */}
        <div className="p-3 flex-grow flex flex-col justify-between bg-black/40 backdrop-blur-md border-t border-white/10"> {/* Ensure it takes remaining space */}
          <div> {/* Wrapper for status to allow spacing if no distance */}
            <div className={`flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium max-w-max ${statusInfo.bgClasses}`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.dotClasses}`} />
                <span className={`${statusInfo.textClasses} truncate max-w-[120px] leading-normal`}> {/* Adjusted max-width */}
                  {statusInfo.text}
                </span>
            </div>
          </div>

          {/* Distance Display - only if user location was part of the search criteria */}
          {shouldShowActualDistance ? (
            <div
              className="font-semibold text-sm flex items-center text-emerald-300 mt-1.5"
              title="Approximate distance from your location"
            >
              <MapPin className="w-3.5 h-3.5 mr-1 text-emerald-400 flex-shrink-0" />
              {distanceText}
            </div>
          ) : (
            <div className="font-medium text-xs flex items-center text-slate-400 mt-1.5" title="Distance from your location">
              <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500 flex-shrink-0"/>
              Distance N/A 
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
// // src/components/shop/ShopCard.tsx
// import Link from 'next/link';
// import Image from 'next/image';
// import { ShopDto } from '@/types/api'; // ShopDto now uses categorySlug, operationalAreaId, etc.
// import { Card } from "@/components/ui/card";
// import { MapPin, Building2 } from "lucide-react"; // Removed Clock, ExternalLink as not directly used
// import dynamic from 'next/dynamic';
// import { useMemo } from 'react';

// const DynamicMapView = dynamic(() => import('./MapView'), { 
//   ssr: false,
//   loading: () => (
//     <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
//       <div className="text-center text-slate-400">
//         <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
//         <p className="text-xs">Loading map...</p>
//       </div>
//     </div>
//   )
// });

// interface ShopCardProps {
//   shop: ShopDto;
//   // citySlug is now areaSlug (OperationalArea slug)
//   // subCategorySlug is now categorySlug (ShopCategory slug, derived from shop.category)
//   // These are passed from the page where ShopCard is used (e.g., shops list page)
//   areaSlug: string; 
//   // categorySlug is available on shop.categorySlug directly from ShopDto
// }

// const formatDistance = (distanceInMeters?: number | null): string => {
//   if (distanceInMeters === undefined || distanceInMeters === null || typeof distanceInMeters !== 'number' || !isFinite(distanceInMeters)) {
//     return "Distance unavailable";
//   }
//   if (distanceInMeters === -1) return "Error calculating distance";
//   if (distanceInMeters < 50) return "< 50 m";
//   if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)} m`;
//   const distanceInKm = distanceInMeters / 1000;
//   return `${distanceInKm.toFixed(1)} km`;
// };

// const getStatusInfo = (openingHours?: string | null) => {
//   const status = openingHours ? openingHours.split('\n')[0] : "Hours not specified"; // Get first line
//   // Basic status detection based on keywords (can be enhanced)
//   let dotColor = "bg-slate-400", textColor = "text-slate-700", bgColor = "bg-slate-100";
//   if (openingHours?.toLowerCase().includes("open")) { dotColor = "bg-emerald-500"; textColor = "text-emerald-700"; bgColor = "bg-emerald-50"; }
//   else if (openingHours?.toLowerCase().includes("closed")) { dotColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50"; }
//   return { text: status, color: textColor, bgColor: bgColor, dotColor: dotColor };
// };

// export default function ShopCard({ shop, areaSlug }: ShopCardProps) { // Removed subCategorySlug from props
//   const displayName = shop.nameEn || shop.nameAr || "Shop Name Unavailable";
//   const displayAddress = shop.address || "Address not available";
  
//   // Use shop.categorySlug (from the updated ShopDto) for the link
//   // The operational area slug is passed as 'areaSlug'
//   const detailPageLink = `/operational-areas/${areaSlug}/categories/${shop.categorySlug}/shops/${shop.id}`;
  
//   const distanceText = formatDistance(shop.distanceInMeters);
//   const statusInfo = getStatusInfo(shop.openingHours);

//   const mapCenter = useMemo(() => {
//     if (shop.latitude && shop.longitude) {
//       return [shop.latitude, shop.longitude] as [number, number];
//     }
//     return [30.0444, 31.2357] as [number, number]; // Default to Cairo
//   }, [shop.latitude, shop.longitude]);

//   const hasValidCoordinates = !!(shop.latitude && shop.longitude);

//   return (
//     <Link
//       href={detailPageLink}
//       className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 overflow-hidden"
//     >
//       <Card className="relative flex flex-col w-full h-[280px] bg-white border border-slate-200 group-hover:border-orange-400 group-hover:shadow-xl transition-all duration-300 ease-out rounded-xl overflow-hidden">
//         <div className="relative flex-1 bg-slate-100">
//           {hasValidCoordinates ? (
//             <DynamicMapView
//               center={mapCenter}
//               displayName={displayName}
//               displayAddress={displayAddress}
//             />
//           ) : (
//             <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
//               <div className="text-center text-slate-400">
//                 <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
//                 <p className="text-xs">Location not available</p>
//               </div>
//             </div>
//           )}
//           <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent p-3 z-20">
//             <div className="flex items-start justify-between">
//               <div className="flex-1 mr-3">
//                 <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-orange-200 transition-colors">
//                   {displayName}
//                 </h3>
//                 {displayAddress && (
//                   <p className="text-white/80 text-xs mt-1 line-clamp-1 leading-tight">
//                     {displayAddress}
//                   </p>
//                 )}
//               </div>
//               {shop.logoUrl ? (
//                 <div className="w-10 h-10 bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
//                   <Image
//                     src={shop.logoUrl}
//                     alt={`${displayName} logo`}
//                     width={32}
//                     height={32}
//                     className="w-full h-full object-contain"
//                   />
//                 </div>
//               ) : (
//                 <div className="w-10 h-10 bg-white/90 rounded-lg flex items-center justify-center flex-shrink-0">
//                   <Building2 className="w-5 h-5 text-slate-400" />
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//         <div className="p-3 bg-white border-t border-slate-100">
//           <div className="flex justify-between items-center">
//             <div className="flex items-center space-x-2">
//               <div className={`flex items-center px-2 py-1 rounded-full ${statusInfo.bgColor}`}>
//                 <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor} mr-1.5`} />
//                 <span className={`text-xs font-medium ${statusInfo.color} truncate max-w-[100px]`}>
//                   {statusInfo.text}
//                 </span>
//               </div>
//             </div>
//             <div
//               className={`font-semibold text-sm flex items-center ${
//                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
//                   ? 'text-amber-600'
//                   : 'text-emerald-600'
//               }`}
//               title="Approximate distance"
//             >
//               <MapPin className={`w-4 h-4 mr-1 ${
//                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
//                   ? 'text-amber-500'
//                   : 'text-emerald-500'
//               }`} />
//               {distanceText}
//             </div>
//           </div>
//         </div>
//       </Card>
//     </Link>
//   );
// }
// // // src/components/shop/ShopCard.tsx
// // import Link from 'next/link';
// // import Image from 'next/image';
// // import { ShopDto } from '@/types/api';
// // import { Card } from "@/components/ui/card";
// // import { MapPin, Clock, Building2, ExternalLink } from "lucide-react";
// // import dynamic from 'next/dynamic';
// // import { useMemo } from 'react';

// // // Dynamically import the entire map component to avoid SSR issues
// // const DynamicMapView = dynamic(() => import('./MapView'), { 
// //   ssr: false,
// //   loading: () => (
// //     <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
// //       <div className="text-center text-slate-400">
// //         <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
// //         <p className="text-xs">Loading map...</p>
// //       </div>
// //     </div>
// //   )
// // });

// // interface ShopCardProps {
// //   shop: ShopDto;
// //   citySlug: string;
// //   subCategorySlug: string;
// // }

// // // Helper function to format distance
// // const formatDistance = (distanceInMeters?: number | null): string => {
// //   if (distanceInMeters === undefined || distanceInMeters === null || typeof distanceInMeters !== 'number' || !isFinite(distanceInMeters)) {
// //     return "Distance unavailable";
// //   }
// //   if (distanceInMeters === -1) {
// //     return "Error calculating distance";
// //   }
// //   if (distanceInMeters < 50) { return "< 50 m"; }
// //   if (distanceInMeters < 1000) { return `${Math.round(distanceInMeters)} m`; }
// //   const distanceInKm = distanceInMeters / 1000;
// //   return `${distanceInKm.toFixed(1)} km`;
// // };

// // // Helper function to determine status color and text
// // const getStatusInfo = (openingHours?: string | null) => {
// //   // For now, just handle the opening hours text
// //   // Later this will be replaced with actual open/closed status
// //   const status = openingHours || "Hours not specified";
  
// //   // Future logic for open/closed status
// //   // if (isOpen) return { text: "Open", color: "text-emerald-600", bgColor: "bg-emerald-50", dotColor: "bg-emerald-500" };
// //   // if (isClosed) return { text: "Closed", color: "text-red-600", bgColor: "bg-red-50", dotColor: "bg-red-500" };
  
// //   return { 
// //     text: status, 
// //     color: "text-slate-600", 
// //     bgColor: "bg-slate-50", 
// //     dotColor: "bg-slate-400" 
// //   };
// // };

// // export default function ShopCard({ shop, citySlug, subCategorySlug }: ShopCardProps) {
// //   const displayName = shop.nameEn || shop.nameAr || "Shop Name Unavailable";
// //   const displayAddress = shop.address || "Address not available";
// //   const detailPageLink = `/cities/${citySlug}/categories/${shop.subCategorySlug}/shops/${shop.id}`;
// //   const distanceText = formatDistance(shop.distanceInMeters);
// //   const statusInfo = getStatusInfo(shop.openingHours);

// //   // Map configuration
// //   const mapCenter = useMemo(() => {
// //     // If shop has coordinates, use them; otherwise use a default location
// //     if (shop.latitude && shop.longitude) {
// //       return [shop.latitude, shop.longitude] as [number, number];
// //     }
// //     // Default to Cairo coordinates if no shop location
// //     return [30.0444, 31.2357] as [number, number];
// //   }, [shop.latitude, shop.longitude]);

// //   const hasValidCoordinates = shop.latitude && shop.longitude;

// //   return (
// //     <Link
// //       href={detailPageLink}
// //       className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 overflow-hidden"
// //     >
// //       <Card className="relative flex flex-col w-full h-[280px] bg-white border border-slate-200 group-hover:border-orange-400 group-hover:shadow-xl transition-all duration-300 ease-out rounded-xl overflow-hidden">
        
// //         {/* Map Section */}
// //         <div className="relative flex-1 bg-slate-100">
// //           {hasValidCoordinates ? (
// //             <DynamicMapView
// //               center={mapCenter}
// //               displayName={displayName}
// //               displayAddress={displayAddress}
// //             />
// //           ) : (
// //             // Fallback when no coordinates available
// //             <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
// //               <div className="text-center text-slate-400">
// //                 <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
// //                 <p className="text-xs">Location not available</p>
// //               </div>
// //             </div>
// //           )}
          
// //           {/* Header Overlay */}
// //           <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent p-3 z-20">
// //             <div className="flex items-start justify-between">
// //               <div className="flex-1 mr-3">
// //                 <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-orange-200 transition-colors">
// //                   {displayName}
// //                 </h3>
// //                 {displayAddress && (
// //                   <p className="text-white/80 text-xs mt-1 line-clamp-1 leading-tight">
// //                     {displayAddress}
// //                   </p>
// //                 )}
// //               </div>
              
// //               {/* Logo */}
// //               {shop.logoUrl ? (
// //                 <div className="w-10 h-10 bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
// //                   <Image
// //                     src={shop.logoUrl}
// //                     alt={`${displayName} logo`}
// //                     width={32}
// //                     height={32}
// //                     className="w-full h-full object-contain"
// //                   />
// //                 </div>
// //               ) : (
// //                 <div className="w-10 h-10 bg-white/90 rounded-lg flex items-center justify-center flex-shrink-0">
// //                   <Building2 className="w-5 h-5 text-slate-400" />
// //                 </div>
// //               )}
// //             </div>
// //           </div>
// //         </div>

// //         {/* Bottom Section: Status and Distance */}
// //         <div className="p-3 bg-white border-t border-slate-100">
// //           <div className="flex justify-between items-center">
// //             {/* Status */}
// //             <div className="flex items-center space-x-2">
// //               <div className={`flex items-center px-2 py-1 rounded-full ${statusInfo.bgColor}`}>
// //                 <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor} mr-1.5`} />
// //                 <span className={`text-xs font-medium ${statusInfo.color} truncate max-w-[100px]`}>
// //                   {statusInfo.text}
// //                 </span>
// //               </div>
// //             </div>
            
// //             {/* Distance */}
// //             <div
// //               className={`font-semibold text-sm flex items-center ${
// //                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// //                   ? 'text-amber-600'
// //                   : 'text-emerald-600'
// //               }`}
// //               title="Approximate distance"
// //             >
// //               <MapPin className={`w-4 h-4 mr-1 ${
// //                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// //                   ? 'text-amber-500'
// //                   : 'text-emerald-500'
// //               }`} />
// //               {distanceText}
// //             </div>
// //           </div>
// //         </div>
// //       </Card>
// //     </Link>
// //   );
// // }
// // // // src/components/shop/ShopCard.tsx
// // // import Link from 'next/link';
// // // import Image from 'next/image';
// // // import { ShopDto } from '@/types/api';
// // // import { Card } from "@/components/ui/card";
// // // import { MapPin, Clock, Building2, ExternalLink } from "lucide-react";
// // // import dynamic from 'next/dynamic';
// // // import { useMemo } from 'react';

// // // // Dynamically import Leaflet components to avoid SSR issues
// // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
// // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
// // // const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

// // // interface ShopCardProps {
// // //   shop: ShopDto;
// // //   citySlug: string;
// // //   subCategorySlug: string;
// // // }

// // // // Helper function to format distance
// // // const formatDistance = (distanceInMeters?: number | null): string => {
// // //   if (distanceInMeters === undefined || distanceInMeters === null || typeof distanceInMeters !== 'number' || !isFinite(distanceInMeters)) {
// // //     return "Distance unavailable";
// // //   }
// // //   if (distanceInMeters === -1) {
// // //     return "Error calculating distance";
// // //   }
// // //   if (distanceInMeters < 50) { return "< 50 m"; }
// // //   if (distanceInMeters < 1000) { return `${Math.round(distanceInMeters)} m`; }
// // //   const distanceInKm = distanceInMeters / 1000;
// // //   return `${distanceInKm.toFixed(1)} km`;
// // // };

// // // // Helper function to determine status color and text
// // // const getStatusInfo = (openingHours?: string | null) => {
// // //   // For now, just handle the opening hours text
// // //   // Later this will be replaced with actual open/closed status
// // //   const status = openingHours || "Hours not specified";
  
// // //   // Future logic for open/closed status
// // //   // if (isOpen) return { text: "Open", color: "text-emerald-600", bgColor: "bg-emerald-50", dotColor: "bg-emerald-500" };
// // //   // if (isClosed) return { text: "Closed", color: "text-red-600", bgColor: "bg-red-50", dotColor: "bg-red-500" };
  
// // //   return { 
// // //     text: status, 
// // //     color: "text-slate-600", 
// // //     bgColor: "bg-slate-50", 
// // //     dotColor: "bg-slate-400" 
// // //   };
// // // };

// // // export default function ShopCard({ shop, citySlug, subCategorySlug }: ShopCardProps) {
// // //   const displayName = shop.nameEn || shop.nameAr || "Shop Name Unavailable";
// // //   const displayAddress = shop.address || "Address not available";
// // //   const detailPageLink = `/cities/${citySlug}/categories/${shop.subCategorySlug}/shops/${shop.id}`;
// // //   const distanceText = formatDistance(shop.distanceInMeters);
// // //   const statusInfo = getStatusInfo(shop.openingHours);

// // //   // Map configuration
// // //   const mapCenter = useMemo(() => {
// // //     // If shop has coordinates, use them; otherwise use a default location
// // //     if (shop.latitude && shop.longitude) {
// // //       return [shop.latitude, shop.longitude] as [number, number];
// // //     }
// // //     // Default to Cairo coordinates if no shop location
// // //     return [30.0444, 31.2357] as [number, number];
// // //   }, [shop.latitude, shop.longitude]);

// // //   const hasValidCoordinates = shop.latitude && shop.longitude;

// // //   return (
// // //     <Link
// // //       href={detailPageLink}
// // //       className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 overflow-hidden"
// // //     >
// // //       <Card className="relative flex flex-col w-full h-[280px] bg-white border border-slate-200 group-hover:border-orange-400 group-hover:shadow-xl transition-all duration-300 ease-out rounded-xl overflow-hidden">
        
// // //         {/* Map Section */}
// // //         <div className="relative flex-1 bg-slate-100">
// // //           {hasValidCoordinates ? (
// // //             <div className="w-full h-full relative">
// // //               <MapContainer
// // //                 center={mapCenter}
// // //                 zoom={15}
// // //                 className="w-full h-full z-0"
// // //                 dragging={false}
// // //                 scrollWheelZoom={false}
// // //                 doubleClickZoom={false}
// // //                 touchZoom={false}
// // //                 keyboard={false}
// // //                 attributionControl={false}
// // //                 zoomControl={false}
// // //               >
// // //                 <TileLayer
// // //                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// // //                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
// // //                 />
// // //                 <Marker position={mapCenter}>
// // //                   <Popup>
// // //                     <div className="text-sm">
// // //                       <strong>{displayName}</strong>
// // //                       <br />
// // //                       {displayAddress}
// // //                     </div>
// // //                   </Popup>
// // //                 </Marker>
// // //               </MapContainer>
              
// // //               {/* Map overlay to prevent interaction */}
// // //               <div className="absolute inset-0 z-10 bg-transparent cursor-pointer" />
// // //             </div>
// // //           ) : (
// // //             // Fallback when no coordinates available
// // //             <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
// // //               <div className="text-center text-slate-400">
// // //                 <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
// // //                 <p className="text-xs">Location not available</p>
// // //               </div>
// // //             </div>
// // //           )}
          
// // //           {/* Header Overlay */}
// // //           <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent p-3 z-20">
// // //             <div className="flex items-start justify-between">
// // //               <div className="flex-1 mr-3">
// // //                 <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 group-hover:text-orange-200 transition-colors">
// // //                   {displayName}
// // //                 </h3>
// // //                 {displayAddress && (
// // //                   <p className="text-white/80 text-xs mt-1 line-clamp-1 leading-tight">
// // //                     {displayAddress}
// // //                   </p>
// // //                 )}
// // //               </div>
              
// // //               {/* Logo */}
// // //               {shop.logoUrl ? (
// // //                 <div className="w-10 h-10 bg-white rounded-lg p-1.5 shadow-sm flex-shrink-0">
// // //                   <Image
// // //                     src={shop.logoUrl}
// // //                     alt={`${displayName} logo`}
// // //                     width={32}
// // //                     height={32}
// // //                     className="w-full h-full object-contain"
// // //                   />
// // //                 </div>
// // //               ) : (
// // //                 <div className="w-10 h-10 bg-white/90 rounded-lg flex items-center justify-center flex-shrink-0">
// // //                   <Building2 className="w-5 h-5 text-slate-400" />
// // //                 </div>
// // //               )}
// // //             </div>
// // //           </div>
// // //         </div>

// // //         {/* Bottom Section: Status and Distance */}
// // //         <div className="p-3 bg-white border-t border-slate-100">
// // //           <div className="flex justify-between items-center">
// // //             {/* Status */}
// // //             <div className="flex items-center space-x-2">
// // //               <div className={`flex items-center px-2 py-1 rounded-full ${statusInfo.bgColor}`}>
// // //                 <div className={`w-2 h-2 rounded-full ${statusInfo.dotColor} mr-1.5`} />
// // //                 <span className={`text-xs font-medium ${statusInfo.color} truncate max-w-[100px]`}>
// // //                   {statusInfo.text}
// // //                 </span>
// // //               </div>
// // //             </div>
            
// // //             {/* Distance */}
// // //             <div
// // //               className={`font-semibold text-sm flex items-center ${
// // //                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// // //                   ? 'text-amber-600'
// // //                   : 'text-emerald-600'
// // //               }`}
// // //               title="Approximate distance"
// // //             >
// // //               <MapPin className={`w-4 h-4 mr-1 ${
// // //                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// // //                   ? 'text-amber-500'
// // //                   : 'text-emerald-500'
// // //               }`} />
// // //               {distanceText}
// // //             </div>
// // //           </div>
// // //         </div>
// // //       </Card>
// // //     </Link>
// // //   );
// // // }
// // // // // src/components/shop/ShopCard.tsx
// // // // import Link from 'next/link';
// // // // import Image from 'next/image';
// // // // import { ShopDto } from '@/types/api';
// // // // import { Card } from "@/components/ui/card"; // Keep Card for base styling
// // // // import { MapPin, Clock, Building2, ExternalLink } from "lucide-react"; // Added ExternalLink for clarity

// // // // interface ShopCardProps {
// // // //   shop: ShopDto;
// // // //   citySlug: string;
// // // //   subCategorySlug: string; // Used for constructing the detail page link
// // // // }

// // // // // Helper function to format distance (remains the same)
// // // // const formatDistance = (distanceInMeters?: number | null): string => {
// // // //   if (distanceInMeters === undefined || distanceInMeters === null || typeof distanceInMeters !== 'number' || !isFinite(distanceInMeters)) {
// // // //     return "Distance unavailable";
// // // //   }
// // // //   if (distanceInMeters === -1) {
// // // //     return "Error calculating distance";
// // // //   }
// // // //   if (distanceInMeters < 50) { return "< 50 m"; } // Simplified for very close
// // // //   if (distanceInMeters < 1000) { return `${Math.round(distanceInMeters)} m`; }
// // // //   const distanceInKm = distanceInMeters / 1000;
// // // //   return `${distanceInKm.toFixed(1)} km`; // Removed " away" for brevity
// // // // };

// // // // export default function ShopCard({ shop, citySlug, subCategorySlug }: ShopCardProps) {
// // // //   const displayName = shop.nameEn || shop.nameAr || "Shop Name Unavailable";
// // // //   const displayAddress = shop.address || "Address not available";
// // // //   const detailPageLink = `/cities/${citySlug}/categories/${shop.subCategorySlug}/shops/${shop.id}`;
// // // //   const distanceText = formatDistance(shop.distanceInMeters);

// // // //   // Future: Replace with actual open/closed status logic
// // // //   const openingStatusText = shop.openingHours || "Hours not specified";

// // // //   return (
// // // //     <Link
// // // //       href={detailPageLink}
// // // //       className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 overflow-hidden"
// // // //       // Removed h-full here to let content dictate height for a more rectangular feel
// // // //       // Grid will manage alignment if items have different natural heights
// // // //     >
// // // //       <Card className="flex flex-col w-full h-full bg-white border border-slate-200 group-hover:border-orange-400 group-hover:shadow-lg transition-all duration-200 ease-in-out rounded-lg overflow-hidden">
// // // //         {/* Top Section: Name and Address */}
// // // //         <div className="p-3.5 sm:p-4 border-b border-slate-100">
// // // //           <h3 className="text-base font-semibold text-slate-800 group-hover:text-orange-600 transition-colors line-clamp-2 leading-tight">
// // // //             {displayName}
// // // //           </h3>
// // // //           {displayAddress && (
// // // //             <p className="text-xs text-slate-500 flex items-start mt-1 line-clamp-2 leading-snug">
// // // //               <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5 text-slate-400" />
// // // //               {displayAddress}
// // // //             </p>
// // // //           )}
// // // //         </div>

// // // //         {/* Middle Section: Logo - more compact */}
// // // //         <div className="flex-grow flex items-center justify-center py-3 px-4 bg-slate-50 min-h-[80px] max-h-[120px]">
// // // //           {shop.logoUrl ? (
// // // //             <Image
// // // //               src={shop.logoUrl}
// // // //               alt={`${displayName} logo`}
// // // //               width={120} // Slightly larger default width for better quality if scaled down
// // // //               height={80}  // Define a height to help with aspect ratio
// // // //               className="object-contain max-h-[60px] sm:max-h-[70px] w-auto" // Constrain display height
// // // //             />
// // // //           ) : (
// // // //             <div className="flex flex-col items-center justify-center text-slate-400 py-2">
// // // //               <Building2 className="w-8 h-8 sm:w-10  mb-1 text-slate-300" />
// // // //               <span className="text-xs text-slate-400">No Logo</span>
// // // //             </div>
// // // //           )}
// // // //         </div>

// // // //         {/* Bottom Section: Status and Distance */}
// // // //         <div className="p-3 border-t border-slate-100 bg-slate-50/50">
// // // //           <div className="flex justify-between items-center text-xs">
// // // //             <div className="flex items-center text-slate-600 overflow-hidden" title={shop.openingHours || "Opening hours"}>
// // // //               <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-slate-400" />
// // // //               <span className="truncate">{openingStatusText}</span>
// // // //             </div>
// // // //             <div
// // // //               className={`font-medium flex items-center shrink-0 ml-2 whitespace-nowrap ${
// // // //                 shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// // // //                   ? 'text-amber-600'
// // // //                   : 'text-emerald-600'
// // // //               }`}
// // // //               title="Approximate distance"
// // // //             >
// // // //               <MapPin className={`w-3.5 h-3.5 mr-1 flex-shrink-0 ${
// // // //                  shop.distanceInMeters === -1 || distanceText.includes("unavailable") || distanceText.includes("Error")
// // // //                   ? 'text-amber-500'
// // // //                   : 'text-emerald-500'
// // // //               }`} />
// // // //               {distanceText}
// // // //             </div>
// // // //           </div>
// // // //         </div>
// // // //       </Card>
// // // //     </Link>
// // // //   );
// // // // }
// // // // // // src/components/shop/ShopCard.tsx
// // // // // import Link from 'next/link';
// // // // // import { ShopDto } from '@/types/api';
// // // // // import { Card, CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
// // // // // import { MapPin, Phone, Clock, Settings, MessageCircle, Tag } from "lucide-react";

// // // // // interface ShopCardProps {
// // // // //   shop: ShopDto;
// // // // //   citySlug: string;
// // // // //   subCategorySlug: string;
// // // // // }

// // // // // export default function ShopCard({ shop, citySlug, subCategorySlug }: ShopCardProps) {
// // // // //   // --- DEBUGGING LINE ---
// // // // //   console.log(`ShopCard for "${shop.nameEn}": received distanceInMeters =`, shop.distanceInMeters, "(raw value)");
// // // // //   // --- END DEBUGGING LINE ---

// // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // //   const displayAddress = shop.address;
  
// // // // //   const servicesSummary = shop.servicesOffered
// // // // //     ? shop.servicesOffered.split(',').map(s => s.trim()).slice(0, 2).join(', ') + 
// // // // //       (shop.servicesOffered.split(',').length > 2 ? '...' : '')
// // // // //     : "Services not listed";

// // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // //   let whatsappLink = null;
// // // // //   if (rawPhoneNumber) {
// // // // //     // Assuming Egypt prefix '2' needs to be added if number starts with '0'
// // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber; 
// // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // //   }

// // // // //   const detailPageLink = `/cities/${citySlug}/categories/${shop.subCategorySlug}/shops/${shop.id}`;

// // // // //   const subCategoryDisplayName = shop.subCategoryName?.replace(/([A-Z])/g, ' $1').trim() || "N/A";

// // // // //   // Handle distance display carefully
// // // // //   let distanceText: string | null = null;
// // // // //   if (shop.distanceInMeters !== undefined && shop.distanceInMeters !== null) {
// // // // //     if (shop.distanceInMeters === -1) { // Check for our error indicator
// // // // //         distanceText = "Error calculating distance";
// // // // //     } else if (typeof shop.distanceInMeters === 'number' && isFinite(shop.distanceInMeters)) {
// // // // //         const distanceInKm = shop.distanceInMeters / 1000;
// // // // //         distanceText = `${distanceInKm.toFixed(1)} km away`;
// // // // //         // Further debug the "0.0 km" issue
// // // // //         if (distanceInKm > 0 && distanceInKm.toFixed(1) === "0.0") {
// // // // //             console.log(`Shop "${shop.nameEn}": distanceInMeters = ${shop.distanceInMeters}, converted to km = ${distanceInKm}, toFixed(1) = "0.0"`);
// // // // //         }
// // // // //     } else {
// // // // //         console.warn(`Shop "${shop.nameEn}": received invalid distanceInMeters =`, shop.distanceInMeters);
// // // // //     }
// // // // //   }


// // // // //   return (
// // // // //     <Card className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out h-full group">
// // // // //       {/* Optional: Shop Logo as Background (Example) */}
// // // // //       {/* {shop.logoUrl && (
// // // // //         <div 
// // // // //           className="h-32 sm:h-40 bg-cover bg-center"
// // // // //           style={{ backgroundImage: `url(${shop.logoUrl})` }}
// // // // //           aria-label={`${displayName} logo`}
// // // // //         ></div>
// // // // //       )} */}
      
// // // // //       <div className="p-4 space-y-2 flex-grow">
// // // // //         <CardTitle className="text-lg font-semibold leading-tight tracking-tight text-slate-800 group-hover:text-orange-600 transition-colors">
// // // // //           <Link href={detailPageLink} className="block">
// // // // //             <span className="line-clamp-2">{displayName}</span>
// // // // //           </Link>
// // // // //         </CardTitle>

// // // // //         {displayAddress && (
// // // // //           <CardDescription className="text-xs text-slate-500 flex items-start leading-relaxed">
// // // // //             <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 mt-0.5 text-slate-400" />
// // // // //             <span className="line-clamp-2">{displayAddress}</span>
// // // // //           </CardDescription>
// // // // //         )}
        
// // // // //         <div className="text-xs text-slate-600 flex items-center pt-0.5">
// // // // //           <Tag className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-blue-500" />
// // // // //           <span className="font-medium">{subCategoryDisplayName}</span>
// // // // //         </div>

// // // // //         {shop.openingHours && (
// // // // //           <div className="text-xs text-slate-500 flex items-center pt-0.5">
// // // // //             <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-slate-400" />
// // // // //             <span className="line-clamp-1">{shop.openingHours}</span>
// // // // //           </div>
// // // // //         )}

// // // // //         {servicesSummary && (
// // // // //           <div className="text-xs text-slate-500 flex items-start pt-0.5 leading-tight">
// // // // //             <Settings className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 mt-px text-slate-400" />
// // // // //             <span className="line-clamp-2">{servicesSummary}</span>
// // // // //           </div>
// // // // //         )}

// // // // //         {/* Updated Distance Display */}
// // // // //         {distanceText && (
// // // // //           <div className={`text-xs font-semibold flex items-center pt-1 ${shop.distanceInMeters === -1 ? 'text-red-500' : 'text-green-600'}`}>
// // // // //             <MapPin className={`w-3.5 h-3.5 mr-1 flex-shrink-0 ${shop.distanceInMeters === -1 ? 'text-red-400' : 'text-green-500'}`} />
// // // // //             <span>{distanceText}</span>
// // // // //           </div>
// // // // //         )}
// // // // //       </div>
      
// // // // //       {(shop.phoneNumber || whatsappLink) && (
// // // // //         <CardFooter className="p-3 border-t border-slate-100 bg-slate-50/50">
// // // // //           <div className="flex justify-between items-center w-full space-x-2">
// // // // //             {shop.phoneNumber && (
// // // // //               <a
// // // // //                 href={`tel:${rawPhoneNumber}`}
// // // // //                 className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center truncate py-1 px-2 rounded hover:bg-orange-100 transition-colors"
// // // // //                 aria-label={`Call ${displayName}`}
// // // // //               >
// // // // //                 <Phone className="w-4 h-4 mr-1.5 flex-shrink-0" />
// // // // //                 <span className="truncate">{shop.phoneNumber}</span>
// // // // //               </a>
// // // // //             )}
// // // // //             {!shop.phoneNumber && whatsappLink && <div className="flex-grow"></div>} 

// // // // //             {whatsappLink && (
// // // // //               <a
// // // // //                 href={whatsappLink}
// // // // //                 target="_blank"
// // // // //                 rel="noopener noreferrer"
// // // // //                 className="p-1.5 rounded-full hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors flex-shrink-0"
// // // // //                 aria-label={`Message ${displayName} on WhatsApp`}
// // // // //               >
// // // // //                 <MessageCircle className="w-5 h-5" />
// // // // //               </a>
// // // // //             )}
// // // // //           </div>
// // // // //         </CardFooter>
// // // // //       )}
// // // // //     </Card>
// // // // //   );
// // // // // }
// // // // // // // src/components/shop/ShopCard.tsx
// // // // // // import Link from 'next/link';
// // // // // // import { ShopDto } from '@/types/api'; // ShopDto now has subCategory, subCategorySlug, etc.
// // // // // // import { Card, CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
// // // // // // import { MapPin, Phone, Clock, Settings, MessageCircle, Building, Tag } from "lucide-react"; // Added Building, Tag

// // // // // // // Updated Props
// // // // // // interface ShopCardProps {
// // // // // //   shop: ShopDto;
// // // // // //   citySlug: string;       // NEW
// // // // // //   subCategorySlug: string; // NEW
// // // // // // }

// // // // // // export default function ShopCard({ shop, citySlug, subCategorySlug }: ShopCardProps) {
// // // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // // //   const displayAddress = shop.address;
  
// // // // // //   const servicesSummary = shop.servicesOffered
// // // // // //     ? shop.servicesOffered.split(',').map(s => s.trim()).slice(0, 2).join(', ') + 
// // // // // //       (shop.servicesOffered.split(',').length > 2 ? '...' : '')
// // // // // //     : "Services not listed";

// // // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // // //   let whatsappLink = null;
// // // // // //   if (rawPhoneNumber) {
// // // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber; // Assuming Egypt prefix '2'
// // // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // // //   }

// // // // // //   // Construct the correct detail page link
// // // // // //   const detailPageLink = `/cities/${citySlug}/categories/${shop.subCategorySlug}/shops/${shop.id}`;
// // // // // //   // Note: We use shop.subCategorySlug from the DTO to ensure the link matches the shop's actual subcategory,
// // // // // //   // even if the page itself is for a broader subCategorySlug (though they should usually match).

// // // // // //   const subCategoryDisplayName = shop.subCategoryName.replace(/([A-Z])/g, ' $1').trim();

// // // // // //   return (
// // // // // //     <Card className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out h-full">
// // // // // //       <div className="p-4 space-y-2 flex-grow">
// // // // // //         <CardTitle className="text-lg font-semibold leading-tight tracking-tight text-slate-800">
// // // // // //           <Link href={detailPageLink} className="hover:text-orange-600 transition-colors duration-150 block group">
// // // // // //             <span className="line-clamp-2 group-hover:underline">{displayName}</span>
// // // // // //           </Link>
// // // // // //         </CardTitle>

// // // // // //         {displayAddress && (
// // // // // //           <CardDescription className="text-xs text-slate-500 flex items-start leading-relaxed">
// // // // // //             <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 mt-0.5 text-slate-400" />
// // // // // //             <span className="line-clamp-2">{displayAddress}</span>
// // // // // //           </CardDescription>
// // // // // //         )}
        
// // // // // //         {/* Display SubCategory instead of a generic "category" */}
// // // // // //         <div className="text-xs text-slate-600 flex items-center pt-0.5">
// // // // // //           <Tag className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-blue-500" />
// // // // // //           <span className="font-medium">{subCategoryDisplayName}</span>
// // // // // //         </div>

// // // // // //         {shop.openingHours && (
// // // // // //           <div className="text-xs text-slate-500 flex items-center pt-0.5">
// // // // // //             <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-slate-400" />
// // // // // //             <span className="line-clamp-1">{shop.openingHours}</span>
// // // // // //           </div>
// // // // // //         )}

// // // // // //         {servicesSummary && (
// // // // // //           <div className="text-xs text-slate-500 flex items-start pt-0.5 leading-tight">
// // // // // //             <Settings className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 mt-px text-slate-400" />
// // // // // //             <span className="line-clamp-2">{servicesSummary}</span>
// // // // // //           </div>
// // // // // //         )}

// // // // // //         {shop.distanceInMeters !== undefined && shop.distanceInMeters !== null && (
// // // // // //           <div className="text-xs font-semibold text-green-600 flex items-center pt-1">
// // // // // //             <MapPin className="w-3.5 h-3.5 mr-1 text-green-500 flex-shrink-0" />
// // // // // //             <span>{(shop.distanceInMeters / 1000).toFixed(1)} km away</span>
// // // // // //           </div>
// // // // // //         )}
// // // // // //       </div>
      
// // // // // //       {(shop.phoneNumber || whatsappLink) && (
// // // // // //         <CardFooter className="p-3 border-t border-slate-100 bg-slate-50">
// // // // // //           <div className="flex justify-between items-center w-full space-x-2">
// // // // // //             {shop.phoneNumber && (
// // // // // //               <a
// // // // // //                 href={`tel:${rawPhoneNumber}`}
// // // // // //                 className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center truncate"
// // // // // //                 aria-label={`Call ${displayName}`}
// // // // // //               >
// // // // // //                 <Phone className="w-4 h-4 mr-1.5 flex-shrink-0" />
// // // // // //                 <span className="truncate">{shop.phoneNumber}</span>
// // // // // //               </a>
// // // // // //             )}
// // // // // //             {/* Ensure div takes space if phone is not there but whatsapp is */}
// // // // // //             {!shop.phoneNumber && whatsappLink && <div className="flex-grow"></div>} 

// // // // // //             {whatsappLink && (
// // // // // //               <a
// // // // // //                 href={whatsappLink}
// // // // // //                 target="_blank"
// // // // // //                 rel="noopener noreferrer"
// // // // // //                 className="p-1.5 rounded-full hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors flex-shrink-0"
// // // // // //                 aria-label={`Message ${displayName} on WhatsApp`}
// // // // // //               >
// // // // // //                 <MessageCircle className="w-5 h-5" />
// // // // // //               </a>
// // // // // //             )}
// // // // // //           </div>
// // // // // //         </CardFooter>
// // // // // //       )}
// // // // // //     </Card>
// // // // // //   );
// // // // // // }
// // // // // // // // src/components/shop/ShopCard.tsx
// // // // // // // import { ShopDto } from '@/types/api';
// // // // // // // import Link from 'next/link';
// // // // // // // import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // // // Badge import is no longer needed
// // // // // // // import { MapPin, Phone, Clock, Settings, MessageCircle } from "lucide-react"; // Settings icon for services

// // // // // // // interface ShopCardProps {
// // // // // // //   shop: ShopDto;
// // // // // // // }

// // // // // // // export default function ShopCard({ shop }: ShopCardProps) {
// // // // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // // // //   const displayAddress = shop.address;
// // // // // // //   // We'll display services as a truncated string now
// // // // // // //   const servicesSummary = shop.servicesOffered ? 
// // // // // // //     shop.servicesOffered.split(',').map(s => s.trim()).slice(0, 3).join(', ') + (shop.servicesOffered.split(',').length > 3 ? '...' : '') 
// // // // // // //     : null;


// // // // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // // // //   let whatsappLink = null;
// // // // // // //   if (rawPhoneNumber) {
// // // // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber;
// // // // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // // // //   }

// // // // // // //   return (
// // // // // // //     <Card className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow duration-200 ease-in-out">
// // // // // // //       <div> {/* Wrapper for top content */}
// // // // // // //         <div className="p-3 sm:p-4 space-y-1"> {/* Main padding, minimal vertical space between items */}
// // // // // // //           <CardTitle className="text-base font-semibold leading-snug tracking-normal">
// // // // // // //             <Link href={`/shops/${shop.id}`} className="hover:text-primary transition-colors block">
// // // // // // //               <span className="line-clamp-2">{displayName}</span>
// // // // // // //             </Link>
// // // // // // //           </CardTitle>

// // // // // // //           {displayAddress && (
// // // // // // //               <CardDescription className="text-xs text-slate-500 flex items-start pt-0.5 leading-tight"> {/* Reduced pt */}
// // // // // // //               <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0 mt-px text-slate-400" />
// // // // // // //               <span className="line-clamp-1">{displayAddress}</span>
// // // // // // //               </CardDescription>
// // // // // // //           )}
        
// // // // // // //           {shop.openingHours && (
// // // // // // //             <div className="text-xs text-slate-500 flex items-start pt-1 leading-tight"> {/* pt-1 for spacing */}
// // // // // // //               <Clock className="w-3 h-3 mr-1.5 flex-shrink-0 mt-px text-slate-400" />
// // // // // // //               <span className="line-clamp-1">{shop.openingHours}</span>
// // // // // // //             </div>
// // // // // // //           )}

// // // // // // //           {/* Services as Icon + Text Line */}
// // // // // // //           {servicesSummary && (
// // // // // // //             <div className="text-xs text-slate-500 flex items-start pt-1 leading-tight"> {/* pt-1 for spacing */}
// // // // // // //               <Settings className="w-3 h-3 mr-1.5 flex-shrink-0 mt-px text-slate-400" />
// // // // // // //               <span className="line-clamp-1">{servicesSummary}</span> {/* Truncated summary */}
// // // // // // //             </div>
// // // // // // //           )}

// // // // // // //           {/* Distance */}
// // // // // // //           {shop.distanceInMeters !== undefined && shop.distanceInMeters !== null && (
// // // // // // //               <div className="text-xs font-medium text-green-600 flex items-center pt-1.5"> {/* pt-1.5 for spacing */}
// // // // // // //                   <MapPin className="w-3 h-3 mr-1 text-green-500 flex-shrink-0" />
// // // // // // //                   <span>{(shop.distanceInMeters / 1000).toFixed(1)} km away</span>
// // // // // // //               </div>
// // // // // // //           )}
// // // // // // //         </div>
// // // // // // //       </div>
      
// // // // // // //       {/* Footer: Actions only */}
// // // // // // //       {(shop.phoneNumber || whatsappLink) && (
// // // // // // //         <CardFooter className="p-3 border-t border-slate-100">
// // // // // // //           <div className="flex justify-between items-center w-full">
// // // // // // //             {shop.phoneNumber ? (
// // // // // // //               <a
// // // // // // //                 href={`tel:${rawPhoneNumber}`}
// // // // // // //                 className="text-xs text-primary hover:underline flex items-center"
// // // // // // //                 aria-label={`Call ${displayName}`}
// // // // // // //               >
// // // // // // //                 <Phone className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
// // // // // // //                 <span className="truncate">{shop.phoneNumber}</span>
// // // // // // //               </a>
// // // // // // //             ) : (
// // // // // // //               <div /> 
// // // // // // //             )}

// // // // // // //             {whatsappLink && (
// // // // // // //               <a
// // // // // // //                 href={whatsappLink}
// // // // // // //                 target="_blank"
// // // // // // //                 rel="noopener noreferrer"
// // // // // // //                 className="p-1 rounded-full hover:bg-green-100 transition-colors flex-shrink-0"
// // // // // // //                 aria-label={`Message ${displayName} on WhatsApp`}
// // // // // // //               >
// // // // // // //                 <MessageCircle className="w-5 h-5 text-green-600 hover:text-green-700" />
// // // // // // //               </a>
// // // // // // //             )}
// // // // // // //           </div>
// // // // // // //         </CardFooter>
// // // // // // //       )}
// // // // // // //     </Card>
// // // // // // //   );
// // // // // // // }
// // // // // // // // // src/components/shop/ShopCard.tsx
// // // // // // // // import { ShopDto } from '@/types/api';
// // // // // // // // import Link from 'next/link';
// // // // // // // // import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // // // import { Badge } from "@/components/ui/badge";
// // // // // // // // import { MapPin, Phone, Clock, Settings } from "lucide-react";

// // // // // // // // interface ShopCardProps {
// // // // // // // //   shop: ShopDto;
// // // // // // // // }

// // // // // // // // export default function ShopCard({ shop }: ShopCardProps) {
// // // // // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // // // // //   const displayAddress = shop.address;
// // // // // // // //   const servicesPreview = shop.servicesOffered?.split(',').map(s => s.trim()).filter(Boolean);

// // // // // // // //   return (
// // // // // // // //     <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200 ease-in-out border border-gray-200">
// // // // // // // //       <CardHeader className="pb-2 px-3 pt-3">
// // // // // // // //         <CardTitle className="text-sm sm:text-base font-semibold tracking-tight leading-tight">
// // // // // // // //           <Link 
// // // // // // // //             href={`/shops/${shop.id}`} 
// // // // // // // //             className="hover:text-primary transition-colors block"
// // // // // // // //           >
// // // // // // // //             <span className="line-clamp-2">{displayName}</span>
// // // // // // // //           </Link>
// // // // // // // //         </CardTitle>
// // // // // // // //         <CardDescription className="text-xs flex items-start pt-0.5">
// // // // // // // //           <MapPin className="w-3 h-3 mr-1 flex-shrink-0 mt-0.5" />
// // // // // // // //           <span className="line-clamp-2 leading-snug">{displayAddress}</span>
// // // // // // // //         </CardDescription>
// // // // // // // //       </CardHeader>
      
// // // // // // // //       <CardContent className="flex-grow px-3 py-2 space-y-2">
// // // // // // // //         {servicesPreview && servicesPreview.length > 0 && (
// // // // // // // //           <div>
// // // // // // // //             <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center">
// // // // // // // //               <Settings className="w-3 h-3 mr-1 flex-shrink-0" /> 
// // // // // // // //               Services:
// // // // // // // //             </p>
// // // // // // // //             <div className="flex flex-wrap gap-1">
// // // // // // // //               {servicesPreview.slice(0, 2).map((service, index) => (
// // // // // // // //                 <Badge 
// // // // // // // //                   variant="secondary" 
// // // // // // // //                   key={index} 
// // // // // // // //                   className="text-xs font-normal px-1.5 py-0.5 truncate max-w-full"
// // // // // // // //                 >
// // // // // // // //                   {service}
// // // // // // // //                 </Badge>
// // // // // // // //               ))}
// // // // // // // //               {servicesPreview.length > 2 && (
// // // // // // // //                 <Badge 
// // // // // // // //                   variant="outline" 
// // // // // // // //                   className="text-xs font-normal px-1.5 py-0.5"
// // // // // // // //                 >
// // // // // // // //                   +{servicesPreview.length - 2} more
// // // // // // // //                 </Badge>
// // // // // // // //               )}
// // // // // // // //             </div>
// // // // // // // //           </div>
// // // // // // // //         )}
        
// // // // // // // //         {shop.openingHours && (
// // // // // // // //           <div className="text-xs text-muted-foreground flex items-start">
// // // // // // // //             <Clock className="w-3 h-3 mr-1 flex-shrink-0 mt-0.5" />
// // // // // // // //             <span className="line-clamp-2 leading-snug">{shop.openingHours}</span>
// // // // // // // //           </div>
// // // // // // // //         )}
// // // // // // // //       </CardContent>
      
// // // // // // // //       {(shop.phoneNumber || shop.distanceInMeters !== null) && (
// // // // // // // //         <CardFooter className="px-3 pb-3 pt-2 flex flex-col gap-1.5">
// // // // // // // //           {shop.phoneNumber && (
// // // // // // // //             <a 
// // // // // // // //               href={`tel:${shop.phoneNumber.replace(/\s+/g, '')}`} 
// // // // // // // //               className="text-xs sm:text-sm text-primary hover:underline flex items-center w-full"
// // // // // // // //               aria-label={`Call ${displayName}`}
// // // // // // // //             >
// // // // // // // //               <Phone className="w-3 h-3 mr-1 flex-shrink-0" /> 
// // // // // // // //               <span className="truncate">{shop.phoneNumber}</span>
// // // // // // // //             </a>
// // // // // // // //           )}
          
// // // // // // // //           {shop.distanceInMeters !== undefined && shop.distanceInMeters !== null && (
// // // // // // // //             <div className="text-xs font-medium text-green-600 flex items-center">
// // // // // // // //               <MapPin className="w-3 h-3 mr-1 text-green-500 flex-shrink-0" />
// // // // // // // //               <span>{(shop.distanceInMeters / 1000).toFixed(1)} km away</span>
// // // // // // // //             </div>
// // // // // // // //           )}
// // // // // // // //         </CardFooter>
// // // // // // // //       )}
// // // // // // // //     </Card>
// // // // // // // //   );
// // // // // // // // }
// // // // // // // // // src/components/shop/ShopCard.tsx
// // // // // // // // import { ShopDto } from '@/types/api';
// // // // // // // // import Link from 'next/link';
// // // // // // // // import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // // // import { Badge } from "@/components/ui/badge";
// // // // // // // // import { MapPin, Phone, Clock, Settings } from "lucide-react";

// // // // // // // // interface ShopCardProps {
// // // // // // // //   shop: ShopDto;
// // // // // // // // }

// // // // // // // // export default function ShopCard({ shop }: ShopCardProps) {
// // // // // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // // // // //   const displayAddress = shop.address;
// // // // // // // //   const servicesPreview = shop.servicesOffered?.split(',').map(s => s.trim()).filter(Boolean);

// // // // // // // //   return (
// // // // // // // //     <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200 ease-in-out border border-gray-200">
// // // // // // // //       <CardHeader className="pb-3 px-4 pt-4">
// // // // // // // //         <CardTitle className="text-base sm:text-lg font-semibold tracking-tight leading-tight">
// // // // // // // //           <Link 
// // // // // // // //             href={`/shops/${shop.id}`} 
// // // // // // // //             className="hover:text-primary transition-colors block"
// // // // // // // //           >
// // // // // // // //             <span className="line-clamp-2">{displayName}</span>
// // // // // // // //           </Link>
// // // // // // // //         </CardTitle>
// // // // // // // //         <CardDescription className="text-xs sm:text-sm flex items-start pt-1">
// // // // // // // //           <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5" />
// // // // // // // //           <span className="line-clamp-2 leading-relaxed">{displayAddress}</span>
// // // // // // // //         </CardDescription>
// // // // // // // //       </CardHeader>
      
// // // // // // // //       <CardContent className="flex-grow px-4 py-3 space-y-3">
// // // // // // // //         {servicesPreview && servicesPreview.length > 0 && (
// // // // // // // //           <div>
// // // // // // // //             <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
// // // // // // // //               <Settings className="w-3 h-3 mr-1.5 flex-shrink-0" /> 
// // // // // // // //               Services:
// // // // // // // //             </p>
// // // // // // // //             <div className="flex flex-wrap gap-1.5">
// // // // // // // //               {servicesPreview.slice(0, 2).map((service, index) => (
// // // // // // // //                 <Badge 
// // // // // // // //                   variant="secondary" 
// // // // // // // //                   key={index} 
// // // // // // // //                   className="text-xs font-normal px-2 py-1 truncate max-w-full"
// // // // // // // //                 >
// // // // // // // //                   {service}
// // // // // // // //                 </Badge>
// // // // // // // //               ))}
// // // // // // // //               {servicesPreview.length > 2 && (
// // // // // // // //                 <Badge 
// // // // // // // //                   variant="outline" 
// // // // // // // //                   className="text-xs font-normal px-2 py-1"
// // // // // // // //                 >
// // // // // // // //                   +{servicesPreview.length - 2} more
// // // // // // // //                 </Badge>
// // // // // // // //               )}
// // // // // // // //             </div>
// // // // // // // //           </div>
// // // // // // // //         )}
        
// // // // // // // //         {shop.openingHours && (
// // // // // // // //           <div className="text-xs text-muted-foreground flex items-start">
// // // // // // // //             <Clock className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5" />
// // // // // // // //             <span className="line-clamp-2 leading-relaxed">{shop.openingHours}</span>
// // // // // // // //           </div>
// // // // // // // //         )}
// // // // // // // //       </CardContent>
      
// // // // // // // //       {(shop.phoneNumber || shop.distanceInMeters !== null) && (
// // // // // // // //         <CardFooter className="px-4 pb-4 pt-3 flex flex-col gap-2">
// // // // // // // //           {shop.phoneNumber && (
// // // // // // // //             <a 
// // // // // // // //               href={`tel:${shop.phoneNumber.replace(/\s+/g, '')}`} 
// // // // // // // //               className="text-xs sm:text-sm text-primary hover:underline flex items-center w-full"
// // // // // // // //               aria-label={`Call ${displayName}`}
// // // // // // // //             >
// // // // // // // //               <Phone className="w-3 h-3 mr-1.5 flex-shrink-0" /> 
// // // // // // // //               <span className="truncate">{shop.phoneNumber}</span>
// // // // // // // //             </a>
// // // // // // // //           )}
          
// // // // // // // //           {shop.distanceInMeters !== undefined && shop.distanceInMeters !== null && (
// // // // // // // //             <div className="text-xs font-medium text-green-600 flex items-center">
// // // // // // // //               <MapPin className="w-3 h-3 mr-1.5 text-green-500 flex-shrink-0" />
// // // // // // // //               <span>{(shop.distanceInMeters / 1000).toFixed(1)} km away</span>
// // // // // // // //             </div>
// // // // // // // //           )}
// // // // // // // //         </CardFooter>
// // // // // // // //       )}
// // // // // // // //     </Card>
// // // // // // // //   );
// // // // // // // // }
// // // // // // // // // // src/components/shop/ShopCard.tsx
// // // // // // // // // import { ShopDto } from '@/types/api';
// // // // // // // // // import Link from 'next/link';
// // // // // // // // // import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // // // // import { Badge } from "@/components/ui/badge";
// // // // // // // // // import { MapPin, Phone, Clock, Settings, Star } from "lucide-react"; // Added Settings for services, Star for placeholder

// // // // // // // // // interface ShopCardProps {
// // // // // // // // //   shop: ShopDto;
// // // // // // // // //   // currentLang?: 'en' | 'ar'; // For future localization
// // // // // // // // // }

// // // // // // // // // export default function ShopCard({ shop }: ShopCardProps) {
// // // // // // // // //   // For now, default to English names. Localization will handle this later.
// // // // // // // // //   const displayName = shop.nameEn || shop.nameAr;
// // // // // // // // //   const displayAddress = shop.address;
// // // // // // // // //   // Truncate services offered for display in card
// // // // // // // // //   const servicesPreview = shop.servicesOffered?.split(',').map(s => s.trim()).filter(Boolean);

// // // // // // // // //   return (
// // // // // // // // //     <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200 ease-in-out">
// // // // // // // // //       <CardHeader className="pb-3">
// // // // // // // // //         <CardTitle className="text-lg tracking-tight">
// // // // // // // // //           <Link href={`/shops/${shop.id}`} className="hover:text-primary transition-colors">
// // // // // // // // //             {displayName}
// // // // // // // // //           </Link>
// // // // // // // // //         </CardTitle>
// // // // // // // // //         <CardDescription className="text-xs flex items-center pt-1">
// // // // // // // // //           <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0" />
// // // // // // // // //           <span className="truncate">{displayAddress}</span>
// // // // // // // // //         </CardDescription>
// // // // // // // // //       </CardHeader>
// // // // // // // // //       <CardContent className="flex-grow py-3 space-y-2">
// // // // // // // // //         {servicesPreview && servicesPreview.length > 0 && (
// // // // // // // // //           <div className="text-xs">
// // // // // // // // //             <p className="font-medium text-muted-foreground mb-1 flex items-center">
// // // // // // // // //               <Settings className="w-3 h-3 mr-1.5 flex-shrink-0" /> Services:
// // // // // // // // //             </p>
// // // // // // // // //             <div className="flex flex-wrap gap-1">
// // // // // // // // //               {servicesPreview.slice(0, 3).map((service, index) => (
// // // // // // // // //                 <Badge variant="secondary" key={index} className="font-normal">{service}</Badge>
// // // // // // // // //               ))}
// // // // // // // // //               {servicesPreview.length > 3 && (
// // // // // // // // //                 <Badge variant="outline" className="font-normal">+{servicesPreview.length - 3} more</Badge>
// // // // // // // // //               )}
// // // // // // // // //             </div>
// // // // // // // // //           </div>
// // // // // // // // //         )}
// // // // // // // // //         {shop.openingHours && (
// // // // // // // // //           <div className="text-xs text-muted-foreground flex items-center">
// // // // // // // // //             <Clock className="w-3 h-3 mr-1.5 flex-shrink-0" />
// // // // // // // // //             <span>{shop.openingHours}</span>
// // // // // // // // //           </div>
// // // // // // // // //         )}
// // // // // // // // //       </CardContent>
// // // // // // // // //       {(shop.phoneNumber || shop.distanceInMeters !== null) && (
// // // // // // // // //         <CardFooter className="pt-3 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-2">
// // // // // // // // //           {shop.phoneNumber && (
// // // // // // // // //             <a 
// // // // // // // // //               href={`tel:${shop.phoneNumber.replace(/\s+/g, '')}`} 
// // // // // // // // //               className="text-xs text-primary hover:underline flex items-center"
// // // // // // // // //               aria-label={`Call ${displayName}`}
// // // // // // // // //             >
// // // // // // // // //               <Phone className="w-3 h-3 mr-1.5 flex-shrink-0" /> {shop.phoneNumber}
// // // // // // // // //             </a>
// // // // // // // // //           )}
// // // // // // // // //           {shop.distanceInMeters !== undefined && shop.distanceInMeters !== null && (
// // // // // // // // //             <p className="text-xs font-medium text-green-600 flex items-center">
// // // // // // // // //               <MapPin className="w-3 h-3 mr-1.5 text-green-500 flex-shrink-0" /> {/* Using MapPin for distance too */}
// // // // // // // // //               {(shop.distanceInMeters / 1000).toFixed(1)} km away
// // // // // // // // //             </p>
// // // // // // // // //           )}
// // // // // // // // //         </CardFooter>
// // // // // // // // //       )}
// // // // // // // // //     </Card>
// // // // // // // // //   );
// // // // // // // // // }