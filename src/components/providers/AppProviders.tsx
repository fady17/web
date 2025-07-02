'use client';

import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserGeoLocationProvider } from '@/contexts/UserGeoLocationContext';
import { CartProvider, useCart } from '@/contexts/CartContext';
import { GeoDataProvider } from '@/contexts/GeoDataContext'; // <<< NEW IMPORT
import '@/lib/leaflet-setup'; 
import { SessionProvider, useSession } from "next-auth/react"; 
import { anonymousUserManager } from '@/lib/anonymousUser'; 
import { mergeAnonymousDataToUser } from '@/lib/apiClient'; 

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const AppInitializer = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status: sessionStatus } = useSession();
  const { fetchCart } = useCart(); 
  const previousSessionStatusRef = useRef<typeof sessionStatus | null>(null);

  useEffect(() => {
    const handleAuthentication = async () => {
      if (
        sessionStatus === 'authenticated' &&
        previousSessionStatusRef.current !== 'authenticated'
      ) {
        // console.log("AppInitializer: User authenticated. Checking for anonymous data to merge.");
        const anonymousToken = await anonymousUserManager.getValidAnonymousToken();

        if (anonymousToken) {
          // console.log("AppInitializer: Anonymous token found, attempting merge for user:", session?.user?.id);
          try {
            const mergeResult = await mergeAnonymousDataToUser(anonymousToken);
            // console.log("AppInitializer: Merge API call result:", mergeResult);
            if (mergeResult.success) {
              // console.log("AppInitializer: Anonymous data merged successfully. Clearing anonymous session.");
              await anonymousUserManager.clearCurrentAnonymousSession();
              // console.log("AppInitializer: Re-fetching cart after successful merge.");
              await fetchCart(); 
            } else {
              // console.warn("AppInitializer: Merge API call reported failure:", mergeResult.message);
            }
          } catch (error) {
            // console.error("AppInitializer: Error calling merge API:", error);
          }
        } else {
          // console.log("AppInitializer: No anonymous token found to merge. Fetching user cart directly.");
          await fetchCart();
        }
      } else if (
        sessionStatus === 'unauthenticated' &&
        previousSessionStatusRef.current === 'authenticated' 
      ) {
        // console.log("AppInitializer: User logged out. Re-fetching cart (will be anonymous cart).");
        await anonymousUserManager.handleUserLogout(); // Ensure new anon token is fetched
        await fetchCart(); 
      }
      previousSessionStatusRef.current = sessionStatus;
    };

    handleAuthentication();
  }, [sessionStatus, session, fetchCart]); 

  return <>{children}</>;
};

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <UserGeoLocationProvider>
          <GeoDataProvider> {/* <<< WRAP WITH GeoDataProvider */}
            <CartProvider>
              <AppInitializer>
                {children}
              </AppInitializer>
            </CartProvider>
          </GeoDataProvider>
        </UserGeoLocationProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
// // src/components/providers/AppProviders.tsx
// 'use client';

// import React, { useEffect, useRef } from 'react'; // Added useRef
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { UserGeoLocationProvider } from '@/contexts/UserGeoLocationContext';
// import { CartProvider, useCart } from '@/contexts/CartContext'; // Import useCart
// import '@/lib/leaflet-setup'; // Global Leaflet icon setup runs on import
// import { SessionProvider, useSession } from "next-auth/react"; // Import useSession
// import { anonymousUserManager } from '@/lib/anonymousUser'; // For anonymous token
// import { mergeAnonymousDataToUser } from '@/lib/apiClient'; // API client function

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 1000 * 60 * 5,
//       refetchOnWindowFocus: false,
//     },
//   },
// });

// // Inner component to access useSession and useCart after SessionProvider and CartProvider
// const AppInitializer = ({ children }: { children: React.ReactNode }) => {
//   const { data: session, status: sessionStatus } = useSession();
//   const { fetchCart } = useCart(); // Get fetchCart from CartContext
//   const previousSessionStatusRef = useRef<typeof sessionStatus | null>(null);

//   useEffect(() => {
//     // Leaflet icon setup (runs only once due to how leaflet-setup.ts is structured)
//     // The import '@/lib/leaflet-setup'; ensures it runs.
//     // This useEffect is now primarily for the merge logic.

//     const handleAuthentication = async () => {
//       if (
//         sessionStatus === 'authenticated' &&
//         previousSessionStatusRef.current !== 'authenticated' // Trigger only on change to authenticated
//       ) {
//         console.log("AppInitializer: User authenticated. Checking for anonymous data to merge.");
//         const anonymousToken = await anonymousUserManager.getValidAnonymousToken();

//         if (anonymousToken) {
//           console.log("AppInitializer: Anonymous token found, attempting merge for user:", session?.user?.id);
//           try {
//             const mergeResult = await mergeAnonymousDataToUser(anonymousToken);
//             console.log("AppInitializer: Merge API call result:", mergeResult);
//             if (mergeResult.success) {
//               console.log("AppInitializer: Anonymous data merged successfully. Clearing anonymous session.");
//               await anonymousUserManager.clearCurrentAnonymousSession();
//               // Crucially, refetch the cart which should now be the user's (merged) cart
//               console.log("AppInitializer: Re-fetching cart after successful merge.");
//               await fetchCart(); // Fetch the (now potentially authenticated user's) cart
//             } else {
//               console.warn("AppInitializer: Merge API call reported failure:", mergeResult.message);
//               // Decide if anonymous token should still be cleared or kept for another attempt.
//               // For now, let's not clear it on API-reported failure.
//             }
//           } catch (error) {
//             console.error("AppInitializer: Error calling merge API:", error);
//             // Don't clear anonymous token if API call itself fails network-wise etc.
//           }
//         } else {
//           console.log("AppInitializer: No anonymous token found to merge. Fetching user cart directly.");
//           // No anonymous data to merge, but user is authenticated, so fetch their cart.
//           // CartContext's useEffect listening to anonymousToken (which would be null)
//           // and sessionStatus (which is now 'authenticated') should handle fetching user cart.
//           // Or explicitly call fetchCart here if needed.
//           await fetchCart();
//         }
//       } else if (
//         sessionStatus === 'unauthenticated' &&
//         previousSessionStatusRef.current === 'authenticated' // User just logged out
//       ) {
//         console.log("AppInitializer: User logged out. Re-fetching cart (will be anonymous cart).");
//         // Anonymous token might have been cleared on merge, or might still exist if merge didn't happen.
//         // anonymousUserManager will fetch a new one if needed.
//         await fetchCart(); // Fetch the (now anonymous) cart
//       }
//       previousSessionStatusRef.current = sessionStatus;
//     };

//     handleAuthentication();
//   }, [sessionStatus, session, fetchCart]); // Add session to dependencies

//   return <>{children}</>;
// };

// export default function AppProviders({ children }: { children: React.ReactNode }) {
//   return (
//     <SessionProvider>
//       <QueryClientProvider client={queryClient}>
//         <UserGeoLocationProvider>
//           <CartProvider>
//             <AppInitializer> {/* AppInitializer handles effects needing session/cart context */}
//               {children}
//             </AppInitializer>
//           </CartProvider>
//         </UserGeoLocationProvider>
//       </QueryClientProvider>
//     </SessionProvider>
//   );
// }
// // // src/components/providers/AppProviders.tsx
// // 'use client';

// // import React, { useEffect } from 'react';
// // import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// // import { UserGeoLocationProvider } from '@/contexts/UserGeoLocationContext';
// // import { CartProvider } from '@/contexts/CartContext';
// // import '@/lib/leaflet-setup';
// // import { SessionProvider } from "next-auth/react";

// // const queryClient = new QueryClient({
// //   defaultOptions: {
// //     queries: {
// //       staleTime: 1000 * 60 * 5,
// //       refetchOnWindowFocus: false,
// //     },
// //   },
// // });

// // export default function AppProviders({ children }: { children: React.ReactNode }) {
 
// //   return (
// //     <SessionProvider>
// //     <QueryClientProvider client={queryClient}>
// //       <UserGeoLocationProvider>
// //         <CartProvider>

// //             {children}
          
// //         </CartProvider>
// //       </UserGeoLocationProvider>
// //     </QueryClientProvider>
// //     </SessionProvider>
// //   );
// // }
// // // // src/components/providers/AppProviders.tsx
// // // 'use client'; // This whole file is a client component

// // // import React, { useEffect } from 'react';
// // // import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// // // import { SimpleLocationProvider } from '@/contexts/SimpleLocationContext';
// // // import { CartProvider } from '@/contexts/CartContext';
// // // import { configureLeafletIcons } from '@/lib/leaflet-setup'; // Import the setup function

// // // // Create a single QueryClient instance outside the component
// // // const queryClient = new QueryClient({
// // //   defaultOptions: {
// // //     queries: {
// // //       staleTime: 1000 * 60 * 5, // 5 minutes
// // //       refetchOnWindowFocus: false, // Optional: sensible default
// // //     },
// // //   },
// // // });

// // // export default function AppProviders({ children }: { children: React.ReactNode }) {
// // //   useEffect(() => {
// // //     // Run Leaflet icon configuration once on the client when providers mount
// // //     configureLeafletIcons();
// // //   }, []); // Empty dependency array ensures it runs only once

// // //   return (
// // //     <QueryClientProvider client={queryClient}>
// // //       <SimpleLocationProvider>
// // //         <CartProvider>
// // //           {children}
// // //         </CartProvider>
// // //       </SimpleLocationProvider>
// // //     </QueryClientProvider>
// // //   );
// // // }