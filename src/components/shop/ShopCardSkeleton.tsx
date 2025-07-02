import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ShopCardSkeletonProps {
  className?: string;
}

export default function ShopCardSkeleton({ className }: ShopCardSkeletonProps) {
  return (
    <Card className={cn(
        "relative flex flex-col w-full h-[280px] border-white/10 rounded-xl overflow-hidden", // Base structure
        "bg-black/20 backdrop-blur-md", // Default glass effect
        className // Allow overrides
    )}>
      {/* Map Section Skeleton */}
      <div className="relative flex-1 bg-slate-700/30"> {/* Darker placeholder */}
        <Skeleton className="w-full h-full bg-slate-600/40" /> {/* Slightly darker skeleton */}

        {/* Header Overlay Skeleton */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent p-3 z-20">
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-3">
              <Skeleton className="h-4 w-3/4 mb-1.5 bg-slate-500/50" /> {/* Text skeleton */}
              <Skeleton className="h-3 w-full bg-slate-500/40" />    
            </div>
            <Skeleton className="w-10 h-10 rounded-lg bg-slate-400/40 flex-shrink-0" /> {/* Logo skeleton */}
          </div>
        </div>
      </div>

      {/* Bottom Section Skeleton: Status and Distance */}
      <div className="p-3 bg-black/30 border-t border-white/10"> {/* Darker bottom bar */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-20 rounded-full bg-slate-500/40" /> 
          <Skeleton className="h-4 w-16 bg-slate-500/40" /> 
        </div>
      </div>
    </Card>
  );
}
// // src/components/shop/ShopCardSkeleton.tsx
// import { Card } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";

// export default function ShopCardSkeleton() {
//   return (
//     <Card className="relative flex flex-col w-full h-[280px] bg-white border border-slate-200 rounded-xl overflow-hidden">
//       {/* Map Section Skeleton */}
//       <div className="relative flex-1 bg-slate-100">
//         {/* This div represents the map area */}
//         <Skeleton className="w-full h-full bg-slate-200" />

//         {/* Header Overlay Skeleton */}
//         <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent p-3 z-20">
//           <div className="flex items-start justify-between">
//             <div className="flex-1 mr-3">
//               <Skeleton className="h-4 w-3/4 mb-1.5 bg-slate-400/50" /> {/* Shop Name */}
//               <Skeleton className="h-3 w-full bg-slate-400/40" />    {/* Address */}
//             </div>
//             <Skeleton className="w-10 h-10 rounded-lg bg-slate-300/50 flex-shrink-0" /> {/* Logo */}
//           </div>
//         </div>
//       </div>

//       {/* Bottom Section Skeleton: Status and Distance */}
//       <div className="p-3 bg-white border-t border-slate-100">
//         <div className="flex justify-between items-center">
//           {/* Status Skeleton */}
//           <Skeleton className="h-5 w-20 rounded-full" /> {/* Status Pill */}
          
//           {/* Distance Skeleton */}
//           <Skeleton className="h-4 w-16" /> {/* Distance */}
//         </div>
//       </div>
//     </Card>
//   );
// }
// // // src/components/shop/ShopCardSkeleton.tsx
// // import { Card, CardFooter } from "@/components/ui/card"; // Removed CardHeader, CardContent
// // import { Skeleton } from "@/components/ui/skeleton";

// // export default function ShopCardSkeleton() {
// //   return (
// //     <Card className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white overflow-hidden">
// //       <div> {/* Wrapper for top content */}
// //         <div className="p-3 sm:p-4 space-y-1"> {/* Minimal vertical space */}
// //           {/* Title Skeleton */}
// //           <Skeleton className="h-5 w-3/4" />   
// //           {/* Address Skeleton */}
// //           <Skeleton className="h-3.5 w-full pt-0.5" />  
          
// //           {/* Opening Hours Skeleton */}
// //           <Skeleton className="h-3.5 w-2/3 pt-1" /> 
// //           {/* Services Text Skeleton */}
// //           <Skeleton className="h-3.5 w-full pt-1" /> {/* New line for services text */}
// //           {/* Distance Skeleton */}
// //           <Skeleton className="h-3.5 w-1/2 pt-1.5" />
// //         </div>
// //       </div>
      
// //       <CardFooter className="p-3 border-t border-slate-100">
// //         <div className="flex justify-between items-center w-full">
// //             <Skeleton className="h-4 w-24" /> {/* Phone placeholder */}
// //             <Skeleton className="h-6 w-6 rounded-full" /> {/* WhatsApp Icon placeholder */}
// //         </div>
// //       </CardFooter>
// //     </Card>
// //   );
// // }