// src/components/layout/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { SheetTrigger } from '@/components/ui/sheet';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
  const { data: session, status: sessionStatus } = useSession();

  // Loading state logic
  const shouldShowCartLoading = () => {
    if (activeCartType !== 'none') return false;
    if (sessionStatus === 'loading') return true;
    if (isLoadingCartData && activeCartType === 'none') return true;
    return false;
  };

  const shouldShowSessionLoading = () => {
    return sessionStatus === 'loading';
  };

  const isCartLoading = shouldShowCartLoading();
  const isSessionLoading = shouldShowSessionLoading();

  const renderCartIcon = () => {
    if (isCartLoading) {
      return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
    }
    return <ShoppingCart className="w-5 h-5" />;
  };

  const renderBadge = () => {
    if (!isCartLoading && itemCount > 0) {
      return (
        <span
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full 
                     bg-gradient-to-r from-emerald-500 to-blue-500 
                     text-white text-[10px] font-bold flex items-center justify-center 
                     ring-2 ring-white/30 shadow-lg backdrop-blur-sm"
          key={itemCount}
        >
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      );
    }
    return null;
  };

  return (
    // Completely transparent header - only individual elements are visible
    <header 
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-2">
        <div className="flex justify-between items-center">
          
          <Link 
            href="/" 
            className="flex items-center space-x-2 sm:space-x-3 group"
          >
            <div className="relative">
              {/* Logo with individual glass effect */}
              <div className="relative p-2 rounded-xl 
                              bg-black/40 backdrop-blur-lg
                              border border-white/30
                              shadow-xl shadow-black/30
                              group-hover:border-white/50 group-hover:bg-black/50
                              transition-all duration-300"
              >
                <MapPin className="w-5 h-5 text-white drop-shadow-lg" />
              </div>
            </div>
            {/* <div className="flex flex-col space-y-1">
            
              <div className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-lg border border-white/30 shadow-lg">
                <span className="text-lg font-bold text-white 
                               drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  OrjnzOracle
                </span>
              </div>
              <div className="hidden sm:block px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-md border border-white/20 shadow-md">
                <span className="text-xs text-white/95 font-medium tracking-wide 
                               drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  Find • Discover • Connect
                </span>
              </div>
            </div> */}
          </Link>

          <nav className="flex items-center space-x-3">
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="View Cart"
                className="relative h-10 w-10 rounded-full text-white
                           bg-black/40 hover:bg-black/60 
                           backdrop-blur-lg border border-white/30 hover:border-white/50
                           shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40
                           transition-all duration-300 ease-in-out
                           focus-visible:ring-2 focus-visible:ring-white/50"
                disabled={isCartLoading}
              >
                {renderCartIcon()}
                {renderBadge()}
              </Button>
            </SheetTrigger>

            {isSessionLoading ? (
              <div className="h-10 w-10 rounded-full flex items-center justify-center
                              bg-black/40 backdrop-blur-lg border border-white/30
                              shadow-xl shadow-black/30">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
              </div>
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-10 w-10 rounded-full p-0 text-white
                                bg-black/40 hover:bg-black/60 
                                backdrop-blur-lg border border-white/30 hover:border-white/50
                                shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40
                                transition-all duration-300 ease-in-out
                                focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    <span className="sr-only">Open user menu</span>
                    {session.user.image ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <Image
                          src={session.user.image as string}
                          alt={session.user.name || "User Avatar"}
                          width={28} 
                          height={28}
                          className="w-7 h-7 rounded-full object-cover 
                                   border-2 border-white/40 shadow-lg"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 
                                        bg-emerald-400 rounded-full 
                                        border-2 border-white/60 shadow-lg"></div>
                      </div>
                    ) : (
                      <UserCircle className="h-6 w-6 drop-shadow-lg" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-56 bg-black/20 backdrop-blur-xl border border-white/20 text-white 
                           shadow-2xl shadow-black/40 mt-2 rounded-lg" 
                  align="end" 
                  forceMount
                >
                  <DropdownMenuLabel className="font-normal px-3 py-2.5 border-b border-white/10">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none text-white truncate 
                                   drop-shadow-sm">{session.user.name || "User"}</p>
                      <p className="text-xs leading-none text-white/80 truncate">{session.user.email}</p>
                      <div className="flex items-center space-x-1.5 mt-1.5">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-sm"></div>
                        <span className="text-xs text-emerald-300 font-medium">Online</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-red-400 hover:!bg-red-500/20 hover:!text-red-300 
                             focus:bg-red-500/20 focus:text-red-300 
                             mx-1.5 my-1 p-2.5 rounded-md transition-colors cursor-pointer
                             backdrop-blur-sm border border-transparent hover:border-red-500/30"
                  >
                    <LogOut className="mr-2.5 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => signIn('rallyidp')}
                className="h-10 px-4 text-white font-medium rounded-full
                          bg-black/40 hover:bg-black/60
                          backdrop-blur-lg border border-white/30 hover:border-white/50
                          shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40
                          transition-all duration-300 ease-in-out
                          focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <div className="flex items-center space-x-2">
                  <LogIn className="w-4 h-4 drop-shadow-sm" />
                  <span className="text-sm drop-shadow-sm">Sign In</span>
                </div>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
// // src/components/layout/Header.tsx
// 'use client';

// import Link from 'next/link';
// import Image from 'next/image';
// import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
// import { useCart } from '@/contexts/CartContext';
// import { SheetTrigger } from '@/components/ui/sheet';
// import { useSession, signIn, signOut } from 'next-auth/react';
// import { Button } from '@/components/ui/button';
// import {
//     DropdownMenu,
//     DropdownMenuContent,
//     DropdownMenuItem,
//     DropdownMenuLabel,
//     DropdownMenuSeparator,
//     DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// export default function Header() {
//   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
//   const { data: session, status: sessionStatus } = useSession();

//   // Loading state logic
//   const shouldShowCartLoading = () => {
//     if (activeCartType !== 'none') return false;
//     if (sessionStatus === 'loading') return true;
//     if (isLoadingCartData && activeCartType === 'none') return true;
//     return false;
//   };

//   const shouldShowSessionLoading = () => {
//     return sessionStatus === 'loading';
//   };

//   const isCartLoading = shouldShowCartLoading();
//   const isSessionLoading = shouldShowSessionLoading();

//   const renderCartIcon = () => {
//     if (isCartLoading) {
//       return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
//     }
//     return <ShoppingCart className="w-5 h-5" />;
//   };

//   const renderBadge = () => {
//     if (!isCartLoading && itemCount > 0) {
//       return (
//         <span
//           className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full 
//                      bg-gradient-to-r from-emerald-500 to-blue-500 
//                      text-white text-[10px] font-bold flex items-center justify-center 
//                      ring-2 ring-white/30 shadow-lg backdrop-blur-sm"
//           key={itemCount}
//         >
//           {itemCount > 9 ? '9+' : itemCount}
//         </span>
//       );
//     }
//     return null;
//   };

//   return (
//     // Ultra-transparent liquid glass header
//     <header 
//       className="fixed top-0 left-0 right-0 z-50 
//                  backdrop-blur-md backdrop-saturate-150
//                  bg-white/5
//                  border-b border-white/10"
//     >
//       <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
//         <div className="flex justify-between items-center">
          
//           <Link 
//             href="/" 
//             className="flex items-center space-x-2 sm:space-x-3 group"
//           >
//             <div className="relative">
//               {/* Logo with glass border effect */}
//               <div className="relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl 
//                               bg-gradient-to-br from-emerald-500/20 to-blue-500/20
//                               backdrop-blur-sm border border-white/20
//                               shadow-lg shadow-black/10
//                               group-hover:border-white/30 group-hover:bg-gradient-to-br group-hover:from-emerald-500/30 group-hover:to-blue-500/30
//                               transition-all duration-300"
//               >
//                 <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-lg" />
//               </div>
//             </div>
//             <div className="flex flex-col">
//               {/* Enhanced text with stronger shadows and glass borders */}
//               <div className="px-3 py-1 rounded-lg bg-black/10 backdrop-blur-sm border border-white/15">
//                 <span className="text-lg sm:text-xl font-bold text-white 
//                                drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]
//                                [text-shadow:0_0_10px_rgba(255,255,255,0.3)]">
//                   OrjnzOracle
//                 </span>
//               </div>
//               <div className="hidden sm:block mt-1 px-2 py-0.5 rounded-md bg-black/5 backdrop-blur-sm border border-white/10">
//                 <span className="text-xs text-white/95 font-medium tracking-wide 
//                                drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
//                   Find • Discover • Connect
//                 </span>
//               </div>
//             </div>
//           </Link>

//           <nav className="flex items-center space-x-2 sm:space-x-3">
//             <SheetTrigger asChild>
//               <Button
//                 variant="ghost"
//                 size="icon"
//                 aria-label="View Cart"
//                 className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full text-white
//                            bg-white/10 hover:bg-white/20 
//                            backdrop-blur-md border border-white/20 hover:border-white/40
//                            shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30
//                            transition-all duration-300 ease-in-out
//                            focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
//                 disabled={isCartLoading}
//               >
//                 {renderCartIcon()}
//                 {renderBadge()}
//               </Button>
//             </SheetTrigger>

//             {isSessionLoading ? (
//               <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center
//                               bg-white/10 backdrop-blur-md border border-white/20
//                               shadow-lg shadow-black/20">
//                 <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
//               </div>
//             ) : session?.user ? (
//               <DropdownMenu>
//                 <DropdownMenuTrigger asChild>
//                   <Button 
//                     variant="ghost" 
//                     className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0 text-white
//                                 bg-white/10 hover:bg-white/20 
//                                 backdrop-blur-md border border-white/20 hover:border-white/40
//                                 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30
//                                 transition-all duration-300 ease-in-out
//                                 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
//                   >
//                     <span className="sr-only">Open user menu</span>
//                     {session.user.image ? (
//                       <div className="relative w-full h-full flex items-center justify-center">
//                         <Image
//                           src={session.user.image as string}
//                           alt={session.user.name || "User Avatar"}
//                           width={28} 
//                           height={28}
//                           className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover 
//                                    border-2 border-white/30 shadow-lg"
//                         />
//                         <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 
//                                         bg-emerald-400 rounded-full 
//                                         border-2 border-white/50 shadow-lg backdrop-blur-sm"></div>
//                       </div>
//                     ) : (
//                       <UserCircle className="h-5 w-5 sm:h-6 drop-shadow-lg" />
//                     )}
//                   </Button>
//                 </DropdownMenuTrigger>
//                 <DropdownMenuContent 
//                   className="w-56 bg-black/20 backdrop-blur-xl border border-white/20 text-white 
//                            shadow-2xl shadow-black/40 mt-2 rounded-lg" 
//                   align="end" 
//                   forceMount
//                 >
//                   <DropdownMenuLabel className="font-normal px-3 py-2.5 border-b border-white/10">
//                     <div className="flex flex-col space-y-1">
//                       <p className="text-sm font-semibold leading-none text-white truncate 
//                                    drop-shadow-sm">{session.user.name || "User"}</p>
//                       <p className="text-xs leading-none text-white/80 truncate">{session.user.email}</p>
//                       <div className="flex items-center space-x-1.5 mt-1.5">
//                         <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-sm"></div>
//                         <span className="text-xs text-emerald-300 font-medium">Online</span>
//                       </div>
//                     </div>
//                   </DropdownMenuLabel>
//                   <DropdownMenuSeparator className="bg-white/10" />
//                   <DropdownMenuItem
//                     onClick={() => signOut({ callbackUrl: '/' })}
//                     className="text-red-400 hover:!bg-red-500/20 hover:!text-red-300 
//                              focus:bg-red-500/20 focus:text-red-300 
//                              mx-1.5 my-1 p-2.5 rounded-md transition-colors cursor-pointer
//                              backdrop-blur-sm border border-transparent hover:border-red-500/30"
//                   >
//                     <LogOut className="mr-2.5 h-4 w-4" />
//                     <span>Sign out</span>
//                   </DropdownMenuItem>
//                 </DropdownMenuContent>
//               </DropdownMenu>
//             ) : (
//               <Button
//                 onClick={() => signIn('rallyidp')}
//                 className="h-9 sm:h-10 px-3.5 sm:px-4 text-white font-medium rounded-full
//                           bg-gradient-to-r from-emerald-500/30 to-blue-500/30 
//                           hover:from-emerald-500/40 hover:to-blue-500/40
//                           backdrop-blur-md border border-white/20 hover:border-white/40
//                           shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30
//                           transition-all duration-300 ease-in-out
//                           focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
//               >
//                 <div className="flex items-center space-x-1.5 sm:space-x-2">
//                   <LogIn className="w-4 h-4 drop-shadow-sm" />
//                   <span className="text-xs sm:text-sm drop-shadow-sm">Sign In</span>
//                 </div>
//               </Button>
//             )}
//           </nav>
//         </div>
//       </div>
//     </header>
//   );
// }
// // // src/components/layout/Header.tsx
// // 'use client';

// // import Link from 'next/link';
// // import Image from 'next/image';
// // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
// // import { useCart } from '@/contexts/CartContext';
// // import { SheetTrigger } from '@/components/ui/sheet';
// // import { useSession, signIn, signOut } from 'next-auth/react';
// // import { Button } from '@/components/ui/button';
// // import {
// //     DropdownMenu,
// //     DropdownMenuContent,
// //     DropdownMenuItem,
// //     DropdownMenuLabel,
// //     DropdownMenuSeparator,
// //     DropdownMenuTrigger,
// // } from "@/components/ui/dropdown-menu";
// // // No useState or useEffect needed as the style is static

// // export default function Header() {
// //   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
// //   const { data: session, status: sessionStatus } = useSession();

// //   // Loading state logic
// //   const shouldShowCartLoading = () => {
// //     if (activeCartType !== 'none') return false;
// //     if (sessionStatus === 'loading') return true;
// //     if (isLoadingCartData && activeCartType === 'none') return true;
// //     return false;
// //   };

// //   const shouldShowSessionLoading = () => {
// //     return sessionStatus === 'loading';
// //   };

// //   const isCartLoading = shouldShowCartLoading();
// //   const isSessionLoading = shouldShowSessionLoading();

// //   const renderCartIcon = () => {
// //     if (isCartLoading) {
// //       return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
// //     }
// //     // Icon color will be white due to button's text-white class
// //     return <ShoppingCart className="w-5 h-5" />;
// //   };

// //   const renderBadge = () => {
// //     if (!isCartLoading && itemCount > 0) {
// //       return (
// //         <span
// //           className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full 
// //                      bg-gradient-to-r from-emerald-500 to-blue-500 
// //                      text-white text-[10px] font-bold flex items-center justify-center 
// //                      ring-2 ring-slate-700 shadow-lg" // Ring color against the defined header
// //           key={itemCount}
// //         >
// //           {itemCount > 9 ? '9+' : itemCount}
// //         </span>
// //       );
// //     }
// //     return null;
// //   };

// //   return (
// //     // Header with consistent, defined glassmorphism effect (like the scrolled state in Image 2)
// //     <header 
// //       className="fixed top-0 left-0 right-0 z-50 
// //                  backdrop-blur-lg  
// //                  bg-slate-800/80   
// //                  shadow-xl         
// //                  border-b border-slate-700/60" // Consistent subtle bottom border
// //     >
// //       <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
// //         <div className="flex justify-between items-center">
          
// //           <Link 
// //             href="/" 
// //             className="flex items-center space-x-2 sm:space-x-3 group"
// //           >
// //             <div className="relative">
// //               {/* Logo icon background */}
// //               <div className="relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg 
// //                               bg-gradient-to-br from-emerald-500/90 to-blue-500/90 group-hover:shadow-emerald-400/40 transition-shadow"
// //               >
// //                 <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
// //               </div>
// //             </div>
// //             <div className="flex flex-col">
// //               {/* Text shadow for legibility on the semi-transparent header */}
// //               <span className="text-lg sm:text-xl font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
// //                 OrjnzOracle
// //               </span>
// //               <span className="hidden sm:block text-xs text-white/90 font-medium tracking-wide [text-shadow:0_1px_1px_rgba(0,0,0,0.2)]">
// //                 Find • Discover • Connect
// //               </span>
// //             </div>
// //           </Link>

// //           <nav className="flex items-center space-x-2 sm:space-x-3">
// //             <SheetTrigger asChild>
// //               <Button
// //                 variant="ghost" // Base for custom styling
// //                 size="icon"
// //                 aria-label="View Cart"
// //                 className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full text-white shadow-md hover:shadow-lg
// //                            bg-white/10 hover:bg-white/20 backdrop-blur-sm 
// //                            border border-white/20 hover:border-white/30 
// //                            transition-all duration-300 ease-in-out
// //                            focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
// //                 disabled={isCartLoading}
// //               >
// //                 {renderCartIcon()}
// //                 {renderBadge()}
// //               </Button>
// //             </SheetTrigger>

// //             {isSessionLoading ? (
// //               <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shadow-md
// //                               bg-white/10 backdrop-blur-sm border border-white/20">
// //                 <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
// //               </div>
// //             ) : session?.user ? (
// //               <DropdownMenu>
// //                 <DropdownMenuTrigger asChild>
// //                   <Button 
// //                     variant="ghost" 
// //                     className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0 shadow-md text-white
// //                                 bg-white/10 hover:bg-white/20 backdrop-blur-sm 
// //                                 border border-white/20 hover:border-white/30
// //                                 transition-all duration-300 ease-in-out
// //                                 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
// //                   >
// //                     <span className="sr-only">Open user menu</span>
// //                     {session.user.image ? (
// //                       <div className="relative w-full h-full flex items-center justify-center">
// //                         <Image
// //                           src={session.user.image as string}
// //                           alt={session.user.name || "User Avatar"}
// //                           width={28} 
// //                           height={28}
// //                           className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/30"
// //                         />
// //                         <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 
// //                                         bg-emerald-400 rounded-full 
// //                                         border-2 border-slate-800 shadow"></div>
// //                       </div>
// //                     ) : (
// //                       <UserCircle className="h-5 w-5 sm:h-6" />
// //                     )}
// //                   </Button>
// //                 </DropdownMenuTrigger>
// //                 <DropdownMenuContent 
// //                   className="w-56 bg-slate-800/95 backdrop-blur-xl border border-slate-700/70 text-white shadow-2xl mt-2 rounded-lg" 
// //                   align="end" 
// //                   forceMount
// //                 >
// //                   <DropdownMenuLabel className="font-normal px-3 py-2.5">
// //                     <div className="flex flex-col space-y-1">
// //                       <p className="text-sm font-semibold leading-none text-white truncate">{session.user.name || "User"}</p>
// //                       <p className="text-xs leading-none text-slate-300 truncate">{session.user.email}</p>
// //                       <div className="flex items-center space-x-1.5 mt-1.5">
// //                         <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
// //                         <span className="text-xs text-emerald-300 font-medium">Online</span>
// //                       </div>
// //                     </div>
// //                   </DropdownMenuLabel>
// //                   <DropdownMenuSeparator className="bg-slate-700/50" />
// //                   <DropdownMenuItem
// //                     onClick={() => signOut({ callbackUrl: '/' })}
// //                     className="text-red-400 hover:!bg-red-600/30 hover:!text-red-300 focus:bg-red-600/30 focus:text-red-300 mx-1.5 my-1 p-2.5 rounded-md transition-colors cursor-pointer"
// //                   >
// //                     <LogOut className="mr-2.5 h-4 w-4" />
// //                     <span>Sign out</span>
// //                   </DropdownMenuItem>
// //                 </DropdownMenuContent>
// //               </DropdownMenu>
// //             ) : (
// //               <Button
// //                 onClick={() => signIn('rallyidp')}
// //                 className="h-9 sm:h-10 px-3.5 sm:px-4 text-white font-medium rounded-full shadow-md hover:shadow-lg backdrop-blur-sm
// //                             bg-gradient-to-r from-emerald-600/90 to-blue-600/90 hover:from-emerald-600 hover:to-blue-600
// //                             transition-all duration-300 ease-in-out
// //                             focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
// //               >
// //                 <div className="flex items-center space-x-1.5 sm:space-x-2">
// //                   <LogIn className="w-4 h-4" />
// //                   <span className="text-xs sm:text-sm">Sign In</span>
// //                 </div>
// //               </Button>
// //             )}
// //           </nav>
// //         </div>
// //       </div>
// //     </header>
// //   );
// // }
// // // // src/components/layout/Header.tsx
// // // 'use client';

// // // import Link from 'next/link';
// // // import Image from 'next/image';
// // // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
// // // import { useCart } from '@/contexts/CartContext';
// // // import { SheetTrigger } from '@/components/ui/sheet';
// // // import { useSession, signIn, signOut } from 'next-auth/react';
// // // import { Button } from '@/components/ui/button';
// // // import {
// // //     DropdownMenu,
// // //     DropdownMenuContent,
// // //     DropdownMenuItem,
// // //     DropdownMenuLabel,
// // //     DropdownMenuSeparator,
// // //     DropdownMenuTrigger,
// // // } from "@/components/ui/dropdown-menu";
// // // // Removed useState and useEffect as there's no scroll-based state

// // // export default function Header() {
// // //   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
// // //   const { data: session, status: sessionStatus } = useSession();

// // //   // Loading state logic
// // //   const shouldShowCartLoading = () => {
// // //     if (activeCartType !== 'none') {
// // //       return false;
// // //     }
// // //     if (sessionStatus === 'loading') {
// // //       return true;
// // //     }
// // //     if (isLoadingCartData && activeCartType === 'none') {
// // //       return true;
// // //     }
// // //     return false;
// // //   };

// // //   const shouldShowSessionLoading = () => {
// // //     return sessionStatus === 'loading';
// // //   };

// // //   const isCartLoading = shouldShowCartLoading();
// // //   const isSessionLoading = shouldShowSessionLoading();

// // //   const renderCartIcon = () => {
// // //     if (isCartLoading) {
// // //       return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
// // //     }
// // //     return <ShoppingCart className="w-5 h-5" />;
// // //   };

// // //   const renderBadge = () => {
// // //     if (!isCartLoading && itemCount > 0) {
// // //       return (
// // //         <span
// // //           className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 text-white text-xs font-bold flex items-center justify-center ring-2 ring-slate-700 shadow-lg" // Ring color for defined header
// // //           key={itemCount}
// // //         >
// // //           {itemCount > 9 ? '9+' : itemCount}
// // //         </span>
// // //       );
// // //     }
// // //     return null;
// // //   };

// // //   return (
// // //     // Header with consistent, defined glassmorphism effect
// // //     <header 
// // //       className="fixed top-0 left-0 right-0 z-50 
// // //                  backdrop-blur-lg 
// // //                  bg-slate-800/80  // Consistent semi-transparent dark background
// // //                  shadow-xl 
// // //                  border-b border-slate-700/60" // Consistent border
// // //     >
// // //       <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3">
// // //         <div className="flex justify-between items-center">
          
// // //           <Link 
// // //             href="/" 
// // //             className="flex items-center space-x-2 sm:space-x-3 group"
// // //           >
// // //             <div className="relative">
// // //               <div className="relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg 
// // //                               bg-gradient-to-br from-emerald-500/80 to-blue-500/80 group-hover:shadow-emerald-400/40 transition-shadow"
// // //               >
// // //                 <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
// // //               </div>
// // //             </div>
// // //             <div className="flex flex-col">
// // //               <span className="text-lg sm:text-xl font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
// // //                 OrjnzOracle
// // //               </span>
// // //               <span className="hidden sm:block text-xs text-white/90 font-medium tracking-wide [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
// // //                 Find • Discover • Connect
// // //               </span>
// // //             </div>
// // //           </Link>

// // //           <nav className="flex items-center space-x-2 sm:space-x-3">
// // //             <SheetTrigger asChild>
// // //               <Button
// // //                 variant="ghost"
// // //                 size="icon"
// // //                 aria-label="View Cart"
// // //                 className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full backdrop-blur-md text-white shadow-md hover:shadow-lg 
// // //                             bg-white/10 hover:bg-white/20 border border-white/20 
// // //                             focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800" // Adjusted ring offset color
// // //                 disabled={isCartLoading}
// // //               >
// // //                 {renderCartIcon()}
// // //                 {renderBadge()}
// // //               </Button>
// // //             </SheetTrigger>

// // //             {isSessionLoading ? (
// // //               <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full backdrop-blur-md flex items-center justify-center shadow-md 
// // //                               bg-white/10 border border-white/20">
// // //                 <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
// // //               </div>
// // //             ) : session?.user ? (
// // //               <DropdownMenu>
// // //                 <DropdownMenuTrigger asChild>
// // //                   <Button 
// // //                     variant="ghost" 
// // //                     className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full backdrop-blur-md p-0 shadow-md 
// // //                                 bg-white/10 hover:bg-white/20 border border-white/20
// // //                                 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800" // Adjusted ring offset color
// // //                   >
// // //                     <span className="sr-only">Open user menu</span>
// // //                     {session.user.image ? (
// // //                       <div className="relative">
// // //                         <Image
// // //                           src={session.user.image as string}
// // //                           alt={session.user.name || "User Avatar"}
// // //                           width={28} 
// // //                           height={28}
// // //                           className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/30"
// // //                         />
// // //                         <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-400 rounded-full border-2 shadow border-slate-800"></div>
// // //                       </div>
// // //                     ) : (
// // //                       <UserCircle className="h-5 w-5 sm:h-6 text-white" />
// // //                     )}
// // //                   </Button>
// // //                 </DropdownMenuTrigger>
// // //                 <DropdownMenuContent 
// // //                   className="w-56 bg-slate-800/90 backdrop-blur-xl border border-slate-700/70 text-white shadow-2xl mt-2 rounded-lg" 
// // //                   align="end" 
// // //                   forceMount
// // //                 >
// // //                   <DropdownMenuLabel className="font-normal px-3 py-2.5">
// // //                     <div className="flex flex-col space-y-1">
// // //                       <p className="text-sm font-semibold leading-none text-white truncate">{session.user.name || "User"}</p>
// // //                       <p className="text-xs leading-none text-slate-300 truncate">{session.user.email}</p>
// // //                       <div className="flex items-center space-x-1.5 mt-1.5">
// // //                         <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
// // //                         <span className="text-xs text-emerald-300 font-medium">Online</span>
// // //                       </div>
// // //                     </div>
// // //                   </DropdownMenuLabel>
// // //                   <DropdownMenuSeparator className="bg-slate-700/50" />
// // //                   <DropdownMenuItem
// // //                     onClick={() => signOut({ callbackUrl: '/' })}
// // //                     className="text-red-400 hover:!bg-red-600/30 hover:!text-red-300 focus:bg-red-600/30 focus:text-red-300 mx-1.5 my-1 p-2.5 rounded-md transition-colors cursor-pointer"
// // //                   >
// // //                     <LogOut className="mr-2.5 h-4 w-4" />
// // //                     <span>Sign out</span>
// // //                   </DropdownMenuItem>
// // //                 </DropdownMenuContent>
// // //               </DropdownMenu>
// // //             ) : (
// // //               <Button
// // //                 onClick={() => signIn('rallyidp')}
// // //                 className="h-9 sm:h-10 px-3.5 sm:px-4 text-white font-medium rounded-full shadow-md hover:shadow-lg backdrop-blur-sm 
// // //                             bg-gradient-to-r from-emerald-600/90 to-blue-600/90 hover:from-emerald-600 hover:to-blue-600
// // //                             focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800" // Adjusted ring offset color
// // //               >
// // //                 <div className="flex items-center space-x-1.5 sm:space-x-2">
// // //                   <LogIn className="w-4 h-4" />
// // //                   <span className="text-xs sm:text-sm">Sign In</span>
// // //                 </div>
// // //               </Button>
// // //             )}
// // //           </nav>
// // //         </div>
// // //       </div>
// // //     </header>
// // //   );
// // // }
// // // // // src/components/layout/Header.tsx
// // // // 'use client';

// // // // import Link from 'next/link';
// // // // import Image from 'next/image';
// // // // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
// // // // import { useCart } from '@/contexts/CartContext';
// // // // import { SheetTrigger } from '@/components/ui/sheet';
// // // // import { useSession, signIn, signOut } from 'next-auth/react';
// // // // import { Button } from '@/components/ui/button';
// // // // import {
// // // //     DropdownMenu,
// // // //     DropdownMenuContent,
// // // //     DropdownMenuItem,
// // // //     DropdownMenuLabel,
// // // //     DropdownMenuSeparator,
// // // //     DropdownMenuTrigger,
// // // // } from "@/components/ui/dropdown-menu";

// // // // export default function Header() {
// // // //   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
// // // //   const { data: session, status: sessionStatus } = useSession();

// // // //   // Loading state logic (keeping your fixed logic)
// // // //   const shouldShowCartLoading = () => {
// // // //     if (activeCartType !== 'none') {
// // // //       return false;
// // // //     }
// // // //     if (sessionStatus === 'loading') {
// // // //       return true;
// // // //     }
// // // //     if (isLoadingCartData && activeCartType === 'none') {
// // // //       return true;
// // // //     }
// // // //     return false;
// // // //   };

// // // //   const shouldShowSessionLoading = () => {
// // // //     return sessionStatus === 'loading';
// // // //   };

// // // //   const isCartLoading = shouldShowCartLoading();
// // // //   const isSessionLoading = shouldShowSessionLoading();

// // // //   const renderCartIcon = () => {
// // // //     if (isCartLoading) {
// // // //       return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
// // // //     }
// // // //     return <ShoppingCart className="w-5 h-5" />;
// // // //   };

// // // //   const renderBadge = () => {
// // // //     if (!isCartLoading && itemCount > 0) {
// // // //       return (
// // // //         <span
// // // //           className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/20 shadow-lg animate-pulse"
// // // //           key={itemCount}
// // // //         >
// // // //           {itemCount > 9 ? '9+' : itemCount}
// // // //         </span>
// // // //       );
// // // //     }
// // // //     return null;
// // // //   };

// // // //   return (
// // // //     <>
// // // //       {/* Glass Effect Header - Map Visible Through */}
// // // //       <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-white/5 border-b border-white/10">
// // // //         {/* Subtle glass tint */}
// // // //         <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5"></div>
        
// // // //         <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
// // // //           <div className="flex justify-between items-center">
            
// // // //             {/* Logo Section - Enhanced contrast for visibility */}
// // // //             <Link 
// // // //               href="/" 
// // // //               className="flex items-center space-x-2 sm:space-x-3 group transition-all duration-300 hover:scale-105"
// // // //             >
// // // //               <div className="relative">
// // // //                 <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-lg sm:rounded-xl blur-sm opacity-70 group-hover:opacity-90 transition-opacity"></div>
// // // //                 <div className="relative bg-gradient-to-r from-emerald-500 to-blue-500 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-xl">
// // // //                   <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-lg" />
// // // //                 </div>
// // // //               </div>
// // // //               <div className="flex flex-col">
// // // //                 <span className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">
// // // //                   OrjnzOracle
// // // //                 </span>
// // // //                 <span className="hidden sm:block text-xs text-white/80 font-medium tracking-wide drop-shadow-sm">
// // // //                   Find • Discover • Connect
// // // //                 </span>
// // // //               </div>
// // // //             </Link>

// // // //             {/* Navigation Section - Enhanced for better visibility on map */}
// // // //             <nav className="flex items-center space-x-2 sm:space-x-4">
              
// // // //               {/* Cart Button with enhanced contrast */}
// // // //               <SheetTrigger asChild>
// // // //                 <Button
// // // //                   variant="ghost"
// // // //                   size="icon"
// // // //                   aria-label="View Cart"
// // // //                   className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white hover:text-white hover:bg-white/30 hover:border-emerald-400/60 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
// // // //                   disabled={isCartLoading}
// // // //                 >
// // // //                   {renderCartIcon()}
// // // //                   {renderBadge()}
// // // //                 </Button>
// // // //               </SheetTrigger>

// // // //               {/* Authentication Section - Enhanced visibility */}
// // // //               {isSessionLoading ? (
// // // //                 <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
// // // //                   <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
// // // //                 </div>
// // // //               ) : session?.user ? (
// // // //                 <DropdownMenu>
// // // //                   <DropdownMenuTrigger asChild>
// // // //                     <Button 
// // // //                       variant="ghost" 
// // // //                       className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 hover:border-emerald-400/60 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40 p-0 shadow-lg"
// // // //                     >
// // // //                       <span className="sr-only">Open user menu</span>
// // // //                       {session.user.image ? (
// // // //                         <div className="relative">
// // // //                           <Image
// // // //                             src={session.user.image as string}
// // // //                             alt={session.user.name || "User Avatar"}
// // // //                             width={32}
// // // //                             height={32}
// // // //                             className="sm:w-9 sm:h-9 rounded-full border-2 border-emerald-400/40 shadow-lg"
// // // //                           />
// // // //                           <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full border-2 border-slate-800 shadow-lg"></div>
// // // //                         </div>
// // // //                       ) : (
// // // //                         <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
// // // //                       )}
// // // //                     </Button>
// // // //                   </DropdownMenuTrigger>
// // // //                   <DropdownMenuContent 
// // // //                     className="w-56 sm:w-64 bg-white/10 backdrop-blur-xl border border-white/30 text-white shadow-2xl" 
// // // //                     align="end" 
// // // //                     forceMount
// // // //                   >
// // // //                     <DropdownMenuLabel className="font-normal px-3 sm:px-4 py-2 sm:py-3">
// // // //                       <div className="flex flex-col space-y-1 sm:space-y-2">
// // // //                         <p className="text-sm font-semibold leading-none text-white truncate">{session.user.name || "User"}</p>
// // // //                         <p className="text-xs leading-none text-slate-400 truncate">{session.user.email}</p>
// // // //                         <div className="flex items-center space-x-2 mt-1 sm:mt-2">
// // // //                           <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
// // // //                           <span className="text-xs text-emerald-400 font-medium">Online</span>
// // // //                         </div>
// // // //                       </div>
// // // //                     </DropdownMenuLabel>
// // // //                     <DropdownMenuSeparator className="bg-white/30" />
// // // //                     <DropdownMenuItem
// // // //                       onClick={() => signOut({ callbackUrl: '/' })}
// // // //                       className="hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 mx-2 my-1 rounded-lg transition-colors"
// // // //                     >
// // // //                       <LogOut className="mr-3 h-4 w-4" />
// // // //                       <span>Sign out</span>
// // // //                     </DropdownMenuItem>
// // // //                   </DropdownMenuContent>
// // // //                 </DropdownMenu>
// // // //               ) : (
// // // //                 <Button
// // // //                   onClick={() => signIn('rallyidp')}
// // // //                   className="relative h-10 px-4 sm:h-11 sm:px-6 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-full border-0 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent backdrop-blur-sm"
// // // //                 >
// // // //                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/40 to-blue-400/40 rounded-full blur-sm"></div>
// // // //                   <div className="relative flex items-center space-x-1 sm:space-x-2">
// // // //                     <LogIn className="w-4 h-4" />
// // // //                     <span className="text-sm sm:text-base">Sign In</span>
// // // //                   </div>
// // // //                 </Button>
// // // //               )}
// // // //             </nav>
// // // //           </div>
// // // //         </div>
// // // //       </header>
      
     
// // // //     </>
// // // //   );
// // // // }

// // // // //#LAST GOOD 
// // // // // // src/components/layout/Header.tsx
// // // // // 'use client';

// // // // // import Link from 'next/link';
// // // // // import Image from 'next/image';
// // // // // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle, MapPin } from 'lucide-react';
// // // // // import { useCart } from '@/contexts/CartContext';
// // // // // import { SheetTrigger } from '@/components/ui/sheet';
// // // // // import { useSession, signIn, signOut } from 'next-auth/react';
// // // // // import { Button } from '@/components/ui/button';
// // // // // import {
// // // // //     DropdownMenu,
// // // // //     DropdownMenuContent,
// // // // //     DropdownMenuItem,
// // // // //     DropdownMenuLabel,
// // // // //     DropdownMenuSeparator,
// // // // //     DropdownMenuTrigger,
// // // // // } from "@/components/ui/dropdown-menu";

// // // // // export default function Header() {
// // // // //   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
// // // // //   const { data: session, status: sessionStatus } = useSession();

// // // // //   // Loading state logic (keeping your fixed logic)
// // // // //   const shouldShowCartLoading = () => {
// // // // //     if (activeCartType !== 'none') {
// // // // //       return false;
// // // // //     }
// // // // //     if (sessionStatus === 'loading') {
// // // // //       return true;
// // // // //     }
// // // // //     if (isLoadingCartData && activeCartType === 'none') {
// // // // //       return true;
// // // // //     }
// // // // //     return false;
// // // // //   };

// // // // //   const shouldShowSessionLoading = () => {
// // // // //     return sessionStatus === 'loading';
// // // // //   };

// // // // //   const isCartLoading = shouldShowCartLoading();
// // // // //   const isSessionLoading = shouldShowSessionLoading();

// // // // //   const renderCartIcon = () => {
// // // // //     if (isCartLoading) {
// // // // //       return <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />;
// // // // //     }
// // // // //     return <ShoppingCart className="w-5 h-5" />;
// // // // //   };

// // // // //   const renderBadge = () => {
// // // // //     if (!isCartLoading && itemCount > 0) {
// // // // //       return (
// // // // //         <span
// // // // //           className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/20 shadow-lg animate-pulse"
// // // // //           key={itemCount}
// // // // //         >
// // // // //           {itemCount > 9 ? '9+' : itemCount}
// // // // //         </span>
// // // // //       );
// // // // //     }
// // // // //     return null;
// // // // //   };

// // // // //   return (
// // // // //     <>
// // // // //       {/* More Transparent Glassmorphism Header */}
// // // // //       <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-gradient-to-r from-slate-900/60 via-slate-800/50 to-slate-900/60 border-b border-white/5 shadow-lg">
// // // // //         {/* Subtle gradient overlay - more transparent */}
// // // // //         <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/3 via-blue-500/3 to-teal-500/3"></div>
        
// // // // //         <div className="relative container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
// // // // //           <div className="flex justify-between items-center">
            
// // // // //             {/* Logo Section - Responsive */}
// // // // //             <Link 
// // // // //               href="/" 
// // // // //               className="flex items-center space-x-2 sm:space-x-3 group transition-all duration-300 hover:scale-105"
// // // // //             >
// // // // //               <div className="relative">
// // // // //                 <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-lg sm:rounded-xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity"></div>
// // // // //                 <div className="relative bg-gradient-to-r from-emerald-500 to-blue-500 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg">
// // // // //                   <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
// // // // //                 </div>
// // // // //               </div>
// // // // //               <div className="flex flex-col">
// // // // //                 <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
// // // // //                   OrjnzOracle
// // // // //                 </span>
// // // // //                 <span className="hidden sm:block text-xs text-slate-400 font-medium tracking-wide">
// // // // //                   Find • Discover • Connect
// // // // //                 </span>
// // // // //               </div>
// // // // //             </Link>

// // // // //             {/* Navigation Section - Responsive */}
// // // // //             <nav className="flex items-center space-x-2 sm:space-x-4">
              
// // // // //               {/* Cart Button with Mobile-Optimized Glassmorphism */}
// // // // //               <SheetTrigger asChild>
// // // // //                 <Button
// // // // //                   variant="ghost"
// // // // //                   size="icon"
// // // // //                   aria-label="View Cart"
// // // // //                   className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-emerald-400/30 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100"
// // // // //                   disabled={isCartLoading}
// // // // //                 >
// // // // //                   {renderCartIcon()}
// // // // //                   {renderBadge()}
// // // // //                 </Button>
// // // // //               </SheetTrigger>

// // // // //               {/* Authentication Section - Responsive */}
// // // // //               {isSessionLoading ? (
// // // // //                 <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
// // // // //                   <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
// // // // //                 </div>
// // // // //               ) : session?.user ? (
// // // // //                 <DropdownMenu>
// // // // //                   <DropdownMenuTrigger asChild>
// // // // //                     <Button 
// // // // //                       variant="ghost" 
// // // // //                       className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-emerald-400/30 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 p-0"
// // // // //                     >
// // // // //                       <span className="sr-only">Open user menu</span>
// // // // //                       {session.user.image ? (
// // // // //                         <div className="relative">
// // // // //                           <Image
// // // // //                             src={session.user.image as string}
// // // // //                             alt={session.user.name || "User Avatar"}
// // // // //                             width={32}
// // // // //                             height={32}
// // // // //                             className="sm:w-9 sm:h-9 rounded-full border-2 border-emerald-400/30"
// // // // //                           />
// // // // //                           <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full border-2 border-slate-800"></div>
// // // // //                         </div>
// // // // //                       ) : (
// // // // //                         <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300" />
// // // // //                       )}
// // // // //                     </Button>
// // // // //                   </DropdownMenuTrigger>
// // // // //                   <DropdownMenuContent 
// // // // //                     className="w-56 sm:w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl" 
// // // // //                     align="end" 
// // // // //                     forceMount
// // // // //                   >
// // // // //                     <DropdownMenuLabel className="font-normal px-3 sm:px-4 py-2 sm:py-3">
// // // // //                       <div className="flex flex-col space-y-1 sm:space-y-2">
// // // // //                         <p className="text-sm font-semibold leading-none text-white truncate">{session.user.name || "User"}</p>
// // // // //                         <p className="text-xs leading-none text-slate-400 truncate">{session.user.email}</p>
// // // // //                         <div className="flex items-center space-x-2 mt-1 sm:mt-2">
// // // // //                           <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
// // // // //                           <span className="text-xs text-emerald-400 font-medium">Online</span>
// // // // //                         </div>
// // // // //                       </div>
// // // // //                     </DropdownMenuLabel>
// // // // //                     <DropdownMenuSeparator className="bg-white/10" />
// // // // //                     <DropdownMenuItem
// // // // //                       onClick={() => signOut({ callbackUrl: '/' })}
// // // // //                       className="hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 mx-2 my-1 rounded-lg transition-colors"
// // // // //                     >
// // // // //                       <LogOut className="mr-3 h-4 w-4" />
// // // // //                       <span>Sign out</span>
// // // // //                     </DropdownMenuItem>
// // // // //                   </DropdownMenuContent>
// // // // //                 </DropdownMenu>
// // // // //               ) : (
// // // // //                 <Button
// // // // //                   onClick={() => signIn('rallyidp')}
// // // // //                   className="relative h-10 px-4 sm:h-11 sm:px-6 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-full border-0 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/25 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
// // // // //                 >
// // // // //                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full blur-sm opacity-60"></div>
// // // // //                   <div className="relative flex items-center space-x-1 sm:space-x-2">
// // // // //                     <LogIn className="w-4 h-4" />
// // // // //                     <span className="text-sm sm:text-base">Sign In</span>
// // // // //                   </div>
// // // // //                 </Button>
// // // // //               )}
// // // // //             </nav>
// // // // //           </div>
// // // // //         </div>
// // // // //       </header>
      
     
// // // // //     </>
// // // // //   );
// // // // // }
// // // // // // // src/components/layout/Header.tsx
// // // // // // 'use client';

// // // // // // import Link from 'next/link';
// // // // // // import Image from 'next/image';
// // // // // // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle } from 'lucide-react';
// // // // // // import { useCart } from '@/contexts/CartContext';
// // // // // // import { SheetTrigger } from '@/components/ui/sheet';
// // // // // // import { useSession, signIn, signOut } from 'next-auth/react';
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import {
// // // // // //     DropdownMenu,
// // // // // //     DropdownMenuContent,
// // // // // //     DropdownMenuItem,
// // // // // //     DropdownMenuLabel,
// // // // // //     DropdownMenuSeparator,
// // // // // //     DropdownMenuTrigger,
// // // // // // } from "@/components/ui/dropdown-menu";

// // // // // // export default function Header() {
// // // // // //   const { itemCount, isLoading: isLoadingCartData, activeCartType } = useCart();
// // // // // //   const { data: session, status: sessionStatus } = useSession();

// // // // // //   // The ONLY time we should show cart loading is:
// // // // // //   // 1. Initial page load when we have no cart type determined yet
// // // // // //   // 2. When session is loading initially
// // // // // //   const shouldShowCartLoading = () => {
// // // // // //     // If we have a determined cart type, never show loading (even if cart is refetching)
// // // // // //     if (activeCartType !== 'none') {
// // // // // //       return false;
// // // // // //     }
    
// // // // // //     // If session is loading, show loading
// // // // // //     if (sessionStatus === 'loading') {
// // // // // //       return true;
// // // // // //     }
    
// // // // // //     // If cart is loading and we have no active cart type, show loading
// // // // // //     if (isLoadingCartData && activeCartType === 'none') {
// // // // // //       return true;
// // // // // //     }
    
// // // // // //     return false;
// // // // // //   };

// // // // // //   // The ONLY time we should show session loading is:
// // // // // //   // 1. When session status is 'loading'
// // // // // //   const shouldShowSessionLoading = () => {
// // // // // //     return sessionStatus === 'loading';
// // // // // //   };

// // // // // //   const isCartLoading = shouldShowCartLoading();
// // // // // //   const isSessionLoading = shouldShowSessionLoading();

// // // // // //   const renderCartIcon = () => {
// // // // // //     if (isCartLoading) {
// // // // // //       return <Loader2 className="w-[22px] h-[22px] animate-spin text-slate-400" />;
// // // // // //     }
// // // // // //     return <ShoppingCart className="w-[22px] h-[22px]" />;
// // // // // //   };

// // // // // //   const renderBadge = () => {
// // // // // //     // Show badge if we're not loading and have items
// // // // // //     if (!isCartLoading && itemCount > 0) {
// // // // // //       return (
// // // // // //         <span
// // // // // //           className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-slate-800"
// // // // // //           key={itemCount}
// // // // // //         >
// // // // // //           {itemCount > 9 ? '9+' : itemCount}
// // // // // //         </span>
// // // // // //       );
// // // // // //     }
// // // // // //     return null;
// // // // // //   };

// // // // // //   return (
// // // // // //     <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50">
// // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
// // // // // //         <Link href="/" className="text-lg sm:text-xl font-bold hover:text-orange-400 transition-colors">
// // // // // //           OrjnzOracle
// // // // // //         </Link>
// // // // // //         <nav className="flex items-center space-x-3 sm:space-x-4">
// // // // // //           <SheetTrigger asChild>
// // // // // //             <Button
// // // // // //               variant="ghost"
// // // // // //               size="icon"
// // // // // //               aria-label="View Cart"
// // // // // //               className="relative p-2 rounded-full text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors disabled:opacity-50"
// // // // // //               disabled={isCartLoading}
// // // // // //             >
// // // // // //               {renderCartIcon()}
// // // // // //               {renderBadge()}
// // // // // //             </Button>
// // // // // //           </SheetTrigger>

// // // // // //           {isSessionLoading ? (
// // // // // //             <div className="p-2">
// // // // // //                 <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
// // // // // //             </div>
// // // // // //           ) : session?.user ? (
// // // // // //             <DropdownMenu>
// // // // // //               <DropdownMenuTrigger asChild>
// // // // // //                 <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 text-white hover:bg-slate-700">
// // // // // //                   <span className="sr-only">Open user menu</span>
// // // // // //                   {session.user.image ? (
// // // // // //                     <Image
// // // // // //                       src={session.user.image as string}
// // // // // //                       alt={session.user.name || "User Avatar"}
// // // // // //                       width={36}
// // // // // //                       height={36}
// // // // // //                       className="rounded-full"
// // // // // //                     />
// // // // // //                   ) : (
// // // // // //                     <UserCircle className="h-6 w-6" />
// // // // // //                   )}
// // // // // //                 </Button>
// // // // // //               </DropdownMenuTrigger>
// // // // // //               <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700 text-white" align="end" forceMount>
// // // // // //                 <DropdownMenuLabel className="font-normal px-2 py-1.5">
// // // // // //                   <div className="flex flex-col space-y-1">
// // // // // //                     <p className="text-sm font-medium leading-none">{session.user.name || "User"}</p>
// // // // // //                     <p className="text-xs leading-none text-slate-400">{session.user.email}</p>
// // // // // //                   </div>
// // // // // //                 </DropdownMenuLabel>
// // // // // //                 <DropdownMenuSeparator className="bg-slate-700" />
// // // // // //                 <DropdownMenuItem
// // // // // //                   onClick={() => signOut({ callbackUrl: '/' })}
// // // // // //                   className="hover:bg-slate-700 focus:bg-slate-700 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
// // // // // //                 >
// // // // // //                   <LogOut className="mr-2 h-4 w-4" />
// // // // // //                   <span>Log out</span>
// // // // // //                 </DropdownMenuItem>
// // // // // //               </DropdownMenuContent>
// // // // // //             </DropdownMenu>
// // // // // //           ) : (
// // // // // //             <Button
// // // // // //               variant="outline"
// // // // // //               onClick={() => signIn('rallyidp')}
// // // // // //               className="text-sm px-3 py-1.5 h-auto border-slate-600 hover:bg-slate-700 hover:text-white focus-visible:ring-offset-slate-800"
// // // // // //             >
// // // // // //               <LogIn className="mr-2 h-4 w-4" />
// // // // // //               Sign In
// // // // // //             </Button>
// // // // // //           )}
// // // // // //         </nav>
// // // // // //       </div>
// // // // // //     </header>
// // // // // //   );
// // // // // // }
// // // // // // // // src/components/layout/Header.tsx
// // // // // // // 'use client';

// // // // // // // import Link from 'next/link';
// // // // // // // import Image from 'next/image'; // CRITICAL: Ensure this is from 'next/image'
// // // // // // // import { ShoppingCart, Loader2, LogIn, LogOut, UserCircle } from 'lucide-react';
// // // // // // // import { useCart } from '@/contexts/CartContext';
// // // // // // // import { SheetTrigger } from '@/components/ui/sheet';
// // // // // // // import { useSession, signIn, signOut } from 'next-auth/react';
// // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // import {
// // // // // // //     DropdownMenu,
// // // // // // //     DropdownMenuContent,
// // // // // // //     DropdownMenuItem,
// // // // // // //     DropdownMenuLabel,
// // // // // // //     DropdownMenuSeparator,
// // // // // // //     DropdownMenuTrigger,
// // // // // // // } from "@/components/ui/dropdown-menu";

// // // // // // // export default function Header() {
// // // // // // //   const { itemCount, isLoading: isLoadingCartData } = useCart();
// // // // // // //   const { data: session, status: sessionStatus } = useSession();

// // // // // // //   const isLoadingSession = sessionStatus === 'loading';

// // // // // // //   const renderCartIcon = () => {
// // // // // // //     if ((isLoadingCartData && itemCount === 0) || isLoadingSession) {
// // // // // // //       return <Loader2 className="w-[22px] h-[22px] animate-spin text-slate-400" />;
// // // // // // //     }
// // // // // // //     return <ShoppingCart className="w-[22px] h-[22px]" />;
// // // // // // //   };

// // // // // // //   const renderBadge = () => {
// // // // // // //     if (!isLoadingCartData && !isLoadingSession && itemCount > 0) {
// // // // // // //       return (
// // // // // // //         <span
// // // // // // //           className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-slate-800"
// // // // // // //           key={itemCount}
// // // // // // //         >
// // // // // // //           {itemCount > 9 ? '9+' : itemCount}
// // // // // // //         </span>
// // // // // // //       );
// // // // // // //     }
// // // // // // //     return null;
// // // // // // //   };

// // // // // // //   return (
// // // // // // //     <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50">
// // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
// // // // // // //         <Link href="/" className="text-lg sm:text-xl font-bold hover:text-orange-400 transition-colors">
// // // // // // //           OrjnzOracle
// // // // // // //         </Link>
// // // // // // //         <nav className="flex items-center space-x-3 sm:space-x-4">
// // // // // // //           <SheetTrigger asChild>
// // // // // // //             <Button
// // // // // // //               variant="ghost"
// // // // // // //               size="icon"
// // // // // // //               aria-label="View Cart"
// // // // // // //               className="relative p-2 rounded-full text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors disabled:opacity-50"
// // // // // // //               disabled={(isLoadingCartData && itemCount === 0) || isLoadingSession}
// // // // // // //             >
// // // // // // //               {renderCartIcon()}
// // // // // // //               {renderBadge()}
// // // // // // //             </Button>
// // // // // // //           </SheetTrigger>

// // // // // // //           {isLoadingSession ? (
// // // // // // //             <div className="p-2">
// // // // // // //                 <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
// // // // // // //             </div>
// // // // // // //           ) : session?.user ? (
// // // // // // //             <DropdownMenu>
// // // // // // //               <DropdownMenuTrigger asChild>
// // // // // // //                 <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 text-white hover:bg-slate-700">
// // // // // // //                   <span className="sr-only">Open user menu</span>
// // // // // // //                   {session.user.image ? (
// // // // // // //                     <Image
// // // // // // //                       src={session.user.image as string} // Explicit cast to string for src
// // // // // // //                       alt={session.user.name || "User Avatar"}
// // // // // // //                       width={36}
// // // // // // //                       height={36}
// // // // // // //                       className="rounded-full"
// // // // // // //                     />
// // // // // // //                   ) : (
// // // // // // //                     <UserCircle className="h-6 w-6" />
// // // // // // //                   )}
// // // // // // //                 </Button>
// // // // // // //               </DropdownMenuTrigger>
// // // // // // //               <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700 text-white" align="end" forceMount>
// // // // // // //                 <DropdownMenuLabel className="font-normal px-2 py-1.5">
// // // // // // //                   <div className="flex flex-col space-y-1">
// // // // // // //                     <p className="text-sm font-medium leading-none">{session.user.name || "User"}</p>
// // // // // // //                     <p className="text-xs leading-none text-slate-400">{session.user.email}</p>
// // // // // // //                   </div>
// // // // // // //                 </DropdownMenuLabel>
// // // // // // //                 <DropdownMenuSeparator className="bg-slate-700" />
// // // // // // //                 <DropdownMenuItem
// // // // // // //                   onClick={() => signOut({ callbackUrl: '/' })}
// // // // // // //                   className="hover:bg-slate-700 focus:bg-slate-700 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
// // // // // // //                 >
// // // // // // //                   <LogOut className="mr-2 h-4 w-4" />
// // // // // // //                   <span>Log out</span>
// // // // // // //                 </DropdownMenuItem>
// // // // // // //               </DropdownMenuContent>
// // // // // // //             </DropdownMenu>
// // // // // // //           ) : (
// // // // // // //             <Button
// // // // // // //               variant="outline"
// // // // // // //               onClick={() => signIn('rallyidp')}
// // // // // // //               className="text-sm px-3 py-1.5 h-auto border-slate-600 hover:bg-slate-700 hover:text-white focus-visible:ring-offset-slate-800"
// // // // // // //             >
// // // // // // //               <LogIn className="mr-2 h-4 w-4" />
// // // // // // //               Sign In
// // // // // // //             </Button>
// // // // // // //           )}
// // // // // // //         </nav>
// // // // // // //       </div>
// // // // // // //     </header>
// // // // // // //   );
// // // // // // // }
// // // // // // // // // src/components/layout/Header.tsx
// // // // // // // // 'use client';

// // // // // // // // import Link from 'next/link';
// // // // // // // // import { ShoppingCart, Loader2 } from 'lucide-react';
// // // // // // // // import { useCart } from '@/contexts/CartContext';
// // // // // // // // import { SheetTrigger } from '@/components/ui/sheet';

// // // // // // // // export default function Header() {
// // // // // // // //   const { itemCount, isLoading: isLoadingCartData } = useCart();

// // // // // // // //   const renderCartIcon = () => {
// // // // // // // //     if (isLoadingCartData && itemCount === 0) {
// // // // // // // //       return <Loader2 className="w-[22px] h-[22px] animate-spin" />;
// // // // // // // //     }
// // // // // // // //     return <ShoppingCart className="w-[22px] h-[22px]" />;
// // // // // // // //   };

// // // // // // // //   const renderBadge = () => {
// // // // // // // //     if (!isLoadingCartData && itemCount > 0) {
// // // // // // // //       return (
// // // // // // // //         <span
// // // // // // // //           className="absolute -top-1 -right-1 block h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-slate-800"
// // // // // // // //           key={itemCount} // key for potential re-animation
// // // // // // // //         >
// // // // // // // //           {itemCount > 9 ? '9+' : itemCount}
// // // // // // // //         </span>
// // // // // // // //       );
// // // // // // // //     }
// // // // // // // //     return null;
// // // // // // // //   };

// // // // // // // //   return (
// // // // // // // //     <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50">
// // // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
// // // // // // // //         <Link href="/" className="text-lg sm:text-xl font-bold hover:text-orange-400 transition-colors">
// // // // // // // //           OrjnzOracle
// // // // // // // //         </Link>
// // // // // // // //         <nav className="flex items-center space-x-4">
// // // // // // // //           <SheetTrigger asChild>
// // // // // // // //             <button
// // // // // // // //               aria-label="View Cart"
// // // // // // // //               className="relative p-2 rounded-full hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors disabled:opacity-50"
// // // // // // // //               disabled={isLoadingCartData && itemCount === 0}
// // // // // // // //             >
// // // // // // // //               {/* Ensure these are always rendered, even if one part is null */}
// // // // // // // //               {renderCartIcon()}
// // // // // // // //               {renderBadge()}
// // // // // // // //             </button>
// // // // // // // //           </SheetTrigger>
// // // // // // // //         </nav>
// // // // // // // //       </div>
// // // // // // // //     </header>
// // // // // // // //   );
// // // // // // // // }
// // // // // // // // // // src/components/layout/Header.tsx
// // // // // // // // // 'use client'; // Header now uses a hook, so it must be a client component

// // // // // // // // // import Link from 'next/link';
// // // // // // // // // import { useRouter } from 'next/navigation'; // For navigating to cart page
// // // // // // // // // import { ShoppingCart, Loader2 } from 'lucide-react';
// // // // // // // // // import { useCart } from '@/contexts/CartContext'; // Import useCart

// // // // // // // // // export default function Header() {
// // // // // // // // //   const { itemCount, isLoading: isLoadingCartData } = useCart(); // Get cart data
// // // // // // // // //   const router = useRouter();

// // // // // // // // //   const handleCartClick = () => {
// // // // // // // // //     // Future: Could open a mini-cart/drawer first.
// // // // // // // // //     // For now, let's navigate to a dedicated cart page (we'll create this page later).
// // // // // // // // //     router.push('/cart'); 
// // // // // // // // //   };

// // // // // // // // //   return (
// // // // // // // // //     <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50">
// // // // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
// // // // // // // // //         <Link href="/" className="text-lg sm:text-xl font-bold hover:text-orange-400 transition-colors">
// // // // // // // // //           OrjnzOracle {/* Your app name */}
// // // // // // // // //         </Link>
// // // // // // // // //         <nav className="flex items-center space-x-4">
// // // // // // // // //           {/* Placeholder for future nav links */}
// // // // // // // // //           {/* <Link href="/some-page" className="text-sm hover:text-orange-300">Example Link</Link> */}
          
// // // // // // // // //           <button 
// // // // // // // // //             onClick={handleCartClick}
// // // // // // // // //             aria-label="View Cart" 
// // // // // // // // //             className="relative p-2 rounded-full hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors"
// // // // // // // // //             disabled={isLoadingCartData} // Disable button while cart data is initially loading
// // // // // // // // //           >
// // // // // // // // //             {isLoadingCartData && itemCount === 0 ? ( // Show loader only on initial load if cart is empty
// // // // // // // // //               <Loader2 className="w-[22px] h-[22px] animate-spin" />
// // // // // // // // //             ) : (
// // // // // // // // //               <ShoppingCart className="w-[22px] h-[22px]" />
// // // // // // // // //             )}
            
// // // // // // // // //             {!isLoadingCartData && itemCount > 0 && (
// // // // // // // // //               <span 
// // // // // // // // //                 className="absolute -top-1 -right-1 block h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-semibold  items-center justify-center ring-2 ring-slate-800"
// // // // // // // // //                 key={itemCount} // Add key to help React re-animate if needed on count change
// // // // // // // // //               >
// // // // // // // // //                 {itemCount > 9 ? '9+' : itemCount}
// // // // // // // // //               </span>
// // // // // // // // //             )}
// // // // // // // // //           </button>
// // // // // // // // //         </nav>
// // // // // // // // //       </div>
// // // // // // // // //     </header>
// // // // // // // // //   );
// // // // // // // // // }
// // // // // // // // // // // src/components/layout/Header.tsx
// // // // // // // // // // "use client" 
// // // // // // // // // // // No changes needed to this file based on the provider setup alone.
// // // // // // // // // // // Cart icon logic will be added later.
// // // // // // // // // // import Link from 'next/link';
// // // // // // // // // // // import { useCart } from '@/contexts/CartContext'; // Will be used later

// // // // // // // // // // export default function Header() {
// // // // // // // // // //   // const { itemCount, isLoading } = useCart(); // Will be used later

// // // // // // // // // //   return (
// // // // // // // // // //     <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50"> {/* Added sticky and z-index */}
// // // // // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
// // // // // // // // // //         <Link href="/" className="text-lg sm:text-xl font-bold hover:text-orange-400 transition-colors">
// // // // // // // // // //           OrjnzOracle {/* Or your app name */}
// // // // // // // // // //         </Link>
// // // // // // // // // //         <nav className="flex items-center space-x-4">
// // // // // // // // // //           {/* Placeholder for future nav links */}
// // // // // // // // // //           {/* <Link href="/some-page" className="text-sm hover:text-orange-300">Services</Link> */}
          
// // // // // // // // // //           {/* --- Cart Icon Placeholder (to be enhanced later) --- */}
// // // // // // // // // //           <button 
// // // // // // // // // //             aria-label="View Cart" 
// // // // // // // // // //             className="relative p-2 rounded-full hover:bg-slate-700 transition-colors"
// // // // // // // // // //             onClick={() => { /* Future: Open cart drawer/modal or navigate to cart page */ }}
// // // // // // // // // //           >
// // // // // // // // // //             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-cart"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
// // // // // // // // // //             {/* Future badge: 
// // // // // // // // // //             {isLoadingCart ? (
// // // // // // // // // //               <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-slate-400 animate-pulse" />
// // // // // // // // // //             ) : cartItemCount > 0 ? (
// // // // // // // // // //               <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center ring-2 ring-slate-800">
// // // // // // // // // //                 {cartItemCount > 9 ? '9+' : cartItemCount}
// // // // // // // // // //               </span>
// // // // // // // // // //             ) : null}
// // // // // // // // // //             */}
// // // // // // // // // //           </button>
// // // // // // // // // //           {/* --- End Cart Icon Placeholder --- */}

// // // // // // // // // //         </nav>
// // // // // // // // // //       </div>
// // // // // // // // // //     </header>
// // // // // // // // // //   );
// // // // // // // // // // }
// // // // // // // // // // // "use client"
// // // // // // // // // // // // src/components/layout/Header.tsx
// // // // // // // // // // // import { ShoppingCart } from 'lucide-react';
// // // // // // // // // // // import Link from 'next/link';
// // // // // // // // // // // import { useCart } from '@/contexts/CartContext';

// // // // // // // // // // // export default function Header() {
// // // // // // // // // // //   const { itemCount, isLoading } = useCart();

// // // // // // // // // // //   return (
// // // // // // // // // // //     <header className="bg-slate-800 text-white shadow-md">
// // // // // // // // // // //       <div className="container mx-auto px-4 py-4 flex justify-between items-center">
// // // // // // // // // // //         <Link href="/" className="text-xl font-bold hover:text-slate-300">
// // // // // // // // // // //           OrjnzOracle {/* Or your app name */}
// // // // // // // // // // //         </Link>
// // // // // // // // // // //         <nav>
// // // // // // // // // // //           {/* Placeholder for future nav links, e.g., language switcher */}
// // // // // // // // // // //           {/* <Link href="/about" className="ml-4 hover:text-slate-300">About</Link> */}
// // // // // // // // // // //         </nav>
// // // // // // // // // // //       </div>
// // // // // // // // // // //       <button aria-label="View Cart">
// // // // // // // // // // //         <ShoppingCart />
// // // // // // // // // // //         {isLoading ? (
// // // // // // // // // // //           <span className="badge-loading">...</span> 
// // // // // // // // // // //         ) : itemCount > 0 ? (
// // // // // // // // // // //           <span className="badge">{itemCount}</span>
// // // // // // // // // // //         ) : null}
// // // // // // // // // // //       </button>
// // // // // // // // // // //     </header>
// // // // // // // // // // //   );
// // // // // // // // // // // }