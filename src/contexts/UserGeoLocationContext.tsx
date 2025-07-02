'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { anonymousUserManager } from '@/lib/anonymousUser';
import { 
    getAnonymousLocationPreference, 
    updateAnonymousLocationPreference 
} from '@/lib/apiClient';
import { UpdateAnonymousLocationRequestDto, AnonymousUserPreferenceDto } from '@/types/anonymous';
import { useSession } from 'next-auth/react'; // Import useSession

export interface UserGeoLocation {
  latitude: number;
  longitude: number;
  radiusInMeters: number;
  accuracy?: number;
  timestamp?: number;
  // Source 'user_preference_loaded' can be added later if you implement user-specific pref loading
  source?: 'gps' | 'ip_geoloc' | 'manual_city' | 'preference_loaded' | 'url_param' | 'initial_default' | 'manual' | 'area_param_centroid';
}

interface LocationAttemptOptions {
  onSuccess?: (location: UserGeoLocation) => void;
  onError?: (errorMsg: string, errorCode?: number) => void;
  targetRadius?: number;
}

interface UserGeoLocationContextType {
  currentLocation: UserGeoLocation | null;
  setCurrentLocation: (location: UserGeoLocation | null, source: NonNullable<UserGeoLocation['source']>) => void; 
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  attemptBrowserGpsLocation: (options?: LocationAttemptOptions) => Promise<UserGeoLocation | null>;
  isLoadingInitialPreference: boolean;
}

const UserGeoLocationContext = createContext<UserGeoLocationContextType | undefined>(undefined);

const DEFAULT_RADIUS_METERS = 500000;
const LOCATION_DETECTION_THROTTLE_MS = 3000;
const GEOLOCATION_TIMEOUT_MS = 8000;

export const UserGeoLocationProvider = ({ children }: { children: ReactNode }) => {
  const [currentLocation, setCurrentLocationState] = useState<UserGeoLocation | null>(null);
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isLoadingInitialPreference, setIsLoadingInitialPreference] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDetectingLocationRef = useRef(false);
  const lastDetectionAttemptTimeRef = useRef(0);

  const { data: authSession, status: sessionStatus } = useSession(); // Get session status

  useEffect(() => {
    const loadSavedPreference = async () => {
      // If location is already set by URL param or manual input, don't overwrite immediately
      if (currentLocation && currentLocation.source !== 'initial_default') {
          setIsLoadingInitialPreference(false);
          return;
      }
      setIsLoadingInitialPreference(true);

      // Only attempt to load anonymous preference if user is definitively unauthenticated
      if (sessionStatus === 'unauthenticated') {
        const anonToken = await anonymousUserManager.getValidAnonymousToken();
        if (anonToken) {
          try {
            const savedPref: AnonymousUserPreferenceDto | null = await getAnonymousLocationPreference();
            if (savedPref && typeof savedPref.lastKnownLatitude === 'number' && typeof savedPref.lastKnownLongitude === 'number') {
              setCurrentLocationState({
                latitude: savedPref.lastKnownLatitude,
                longitude: savedPref.lastKnownLongitude,
                accuracy: savedPref.lastKnownLocationAccuracy ?? undefined,
                radiusInMeters: DEFAULT_RADIUS_METERS, // Or a saved radius if you implement that
                timestamp: savedPref.lastSetAtUtc ? new Date(savedPref.lastSetAtUtc).getTime() : Date.now(),
                source: 'preference_loaded',
              });
            }
          } catch (e) {
            console.error("UserGeoLocationContext: Error loading anonymous location preference:", e);
          }
        }
      } else if (sessionStatus === 'authenticated') {
        // User is authenticated. Do not load anonymous preferences.
        // Future: Load authenticated user's preference here.
        // console.log("UserGeoLocationContext: User authenticated, skipping anonymous preference load.");
      }
      // If sessionStatus is 'loading', we wait for it to resolve.
      
      setIsLoadingInitialPreference(false);
    };

    if (sessionStatus !== 'loading') { // Only run once session status is determined
      loadSavedPreference();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]); // Dependency: sessionStatus. currentLocation removed to allow overwrite by URL params if they come later.

  const setCurrentLocation = useCallback((location: UserGeoLocation | null, source: NonNullable<UserGeoLocation['source']>) => {
    const newLocationWithSource = location ? { ...location, source, timestamp: Date.now() } : null;
    setCurrentLocationState(newLocationWithSource);

    if (newLocationWithSource) {
      setError(null);
      // --- THIS IS THE KEY SAFEGUARD ---
      // Only update ANONYMOUS preference if the user is NOT authenticated and source is GPS
      if (source === 'gps' && sessionStatus !== 'authenticated') { 
        (async () => {
          const anonToken = await anonymousUserManager.getValidAnonymousToken();
          if (anonToken && newLocationWithSource) {
            // console.log("UserGeoLocationContext: Updating ANONYMOUS location preference due to GPS event.");
            try {
              const payload: UpdateAnonymousLocationRequestDto = {
                latitude: newLocationWithSource.latitude,
                longitude: newLocationWithSource.longitude,
                accuracy: newLocationWithSource.accuracy,
                source: 'gps', 
              };
              await updateAnonymousLocationPreference(payload);
            } catch (saveError) {
              console.error("UserGeoLocationContext: Failed to save anonymous GPS location preference:", saveError);
            }
          } else if (!anonToken) {
             // console.warn("UserGeoLocationContext: GPS location obtained for anonymous user, but no anonymous token to save preference.");
          }
        })();
      } else if (source === 'gps' && sessionStatus === 'authenticated') {
        // User is logged in. Do NOT call the anonymous endpoint.
        // console.log("UserGeoLocationContext: User is authenticated. GPS location set in context. Backend save to user profile is a future TODO.");
        // If you had an endpoint for authenticated user preferences, you would call it here.
        // For now, the location is set in the context state only for the authenticated user.
      }
    }
  }, [sessionStatus, setCurrentLocationState, setError]); // Add sessionStatus as dependency

  const clearError = useCallback(() => { setError(null); }, []);

  const attemptBrowserGpsLocation = useCallback(async (options?: LocationAttemptOptions): Promise<UserGeoLocation | null> => {
    const now = Date.now();
    if (isDetectingLocationRef.current || (now - lastDetectionAttemptTimeRef.current < LOCATION_DETECTION_THROTTLE_MS)) {
      return currentLocation; 
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser.";
      setError(msg); options?.onError?.(msg); setIsLoadingGps(false);
      return null;
    }

    isDetectingLocationRef.current = true;
    lastDetectionAttemptTimeRef.current = now;
    setIsLoadingGps(true); 
    setError(null);

    return new Promise((resolve) => {
      const timerId = setTimeout(() => {
        if (isDetectingLocationRef.current) { 
          isDetectingLocationRef.current = false; 
          setIsLoadingGps(false);
          const msg = "Location request timed out.";
          console.warn("UserGeoLocationContext: " + msg);
          options?.onError?.(msg, GeolocationPositionError.TIMEOUT); 
          resolve(null);
        }
      }, GEOLOCATION_TIMEOUT_MS);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timerId);
          if (!isDetectingLocationRef.current) { resolve(null); return; } 
          isDetectingLocationRef.current = false;

          const determinedRadius = options?.targetRadius || 
                                 (currentLocation ? currentLocation.radiusInMeters : DEFAULT_RADIUS_METERS);

          const newLocation: UserGeoLocation = {
            latitude: parseFloat(position.coords.latitude.toFixed(6)),
            longitude: parseFloat(position.coords.longitude.toFixed(6)),
            radiusInMeters: determinedRadius,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(), 
            source: 'gps',
          };
          
          setCurrentLocation(newLocation, 'gps'); 
          setIsLoadingGps(false);
          options?.onSuccess?.(newLocation);
          resolve(newLocation);
        },
        (geoError) => {
          clearTimeout(timerId);
          if (!isDetectingLocationRef.current) { resolve(null); return; }
          isDetectingLocationRef.current = false; 
          setIsLoadingGps(false);
          
          let userFriendlyMessage = "Could not determine your location.";
          if (geoError.code === geoError.PERMISSION_DENIED) userFriendlyMessage = "Location access was denied.";
          else if (geoError.code === geoError.POSITION_UNAVAILABLE) userFriendlyMessage = "Location information is currently unavailable.";
          else if (geoError.code === geoError.TIMEOUT) userFriendlyMessage = "Location request timed out.";
          
          options?.onError?.(userFriendlyMessage, geoError.code);
          if (!options?.onError || geoError.code !== geoError.PERMISSION_DENIED) {
            setError(userFriendlyMessage);
          }
          console.warn("UserGeoLocationContext: Geolocation error:", geoError.message, "Code:", geoError.code);
          resolve(null);
        },
        { timeout: GEOLOCATION_TIMEOUT_MS - 500, enableHighAccuracy: false, maximumAge: 1000 * 60 * 1 }
      );
    });
  }, [currentLocation, setCurrentLocation]); // setCurrentLocation is a dependency


  return (
    <UserGeoLocationContext.Provider value={{
        currentLocation,
        setCurrentLocation,
        isLoading: isLoadingGps || isLoadingInitialPreference,
        error,
        clearError,
        attemptBrowserGpsLocation,
        isLoadingInitialPreference
    }}>
      {children}
    </UserGeoLocationContext.Provider>
  );
};

export const useUserGeoLocation = (): UserGeoLocationContextType => {
  const context = useContext(UserGeoLocationContext);
  if (context === undefined) {
    throw new Error('useUserGeoLocation must be used within a UserGeoLocationProvider');
  }
  return context;
};
// // src/contexts/UserGeoLocationContext.tsx
// 'use client';

// import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
// import { anonymousUserManager } from '@/lib/anonymousUser';
// import { 
//     getAnonymousLocationPreference, 
//     updateAnonymousLocationPreference 
// } from '@/lib/apiClient';
// import { UpdateAnonymousLocationRequestDto, AnonymousUserPreferenceDto } from '@/types/anonymous';

// export interface UserGeoLocation {
//   latitude: number;
//   longitude: number;
//   radiusInMeters: number;
//   accuracy?: number;
//   timestamp?: number;
//   source?: 'gps' | 'ip_geoloc' | 'manual_city' | 'preference_loaded' | 'url_param' | 'initial_default' | 'manual' | 'area_param_centroid';

// }

// interface LocationAttemptOptions {
//   onSuccess?: (location: UserGeoLocation) => void;
//   onError?: (errorMsg: string, errorCode?: number) => void;
//   targetRadius?: number;
// }

// interface UserGeoLocationContextType {
//   currentLocation: UserGeoLocation | null;
//   // Ensure the 'source' parameter here matches the updated UserGeoLocation['source'] type
//   setCurrentLocation: (location: UserGeoLocation | null, source: NonNullable<UserGeoLocation['source']>) => void; 
//   isLoading: boolean;
//   error: string | null;
//   clearError: () => void;
//   attemptBrowserGpsLocation: (options?: LocationAttemptOptions) => Promise<UserGeoLocation | null>;
//   isLoadingInitialPreference: boolean;
// }

// const UserGeoLocationContext = createContext<UserGeoLocationContextType | undefined>(undefined);

// const DEFAULT_RADIUS_METERS = 500000;
// const LOCATION_DETECTION_THROTTLE_MS = 3000;
// const GEOLOCATION_TIMEOUT_MS = 8000;

// export const UserGeoLocationProvider = ({ children }: { children: ReactNode }) => {
//   const [currentLocation, setCurrentLocationState] = useState<UserGeoLocation | null>(null);
//   const [isLoadingGps, setIsLoadingGps] = useState(false);
//   const [isLoadingInitialPreference, setIsLoadingInitialPreference] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const isDetectingLocationRef = useRef(false);
//   const lastDetectionAttemptTimeRef = useRef(0);

//   useEffect(() => {
//     const loadSavedPreference = async () => {
//       if (currentLocation) {
//           setIsLoadingInitialPreference(false);
//           return;
//       }
//       const anonToken = await anonymousUserManager.getValidAnonymousToken();
//       if (anonToken) {
//         try {
//           const savedPref: AnonymousUserPreferenceDto | null = await getAnonymousLocationPreference();
//           if (savedPref && typeof savedPref.lastKnownLatitude === 'number' && typeof savedPref.lastKnownLongitude === 'number') {
//             setCurrentLocationState({
//               latitude: savedPref.lastKnownLatitude,
//               longitude: savedPref.lastKnownLongitude,
//               accuracy: savedPref.lastKnownLocationAccuracy ?? undefined,
//               radiusInMeters: DEFAULT_RADIUS_METERS,
//               timestamp: savedPref.lastSetAtUtc ? new Date(savedPref.lastSetAtUtc).getTime() : Date.now(),
//               source: 'preference_loaded',
//             });
//           }
//         } catch (e) {
//           console.error("UserGeoLocationContext: Error loading anonymous location preference:", e);
//         } finally {
//           setIsLoadingInitialPreference(false);
//         }
//       } else {
//         setIsLoadingInitialPreference(false);
//       }
//     };
//     loadSavedPreference();
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const setCurrentLocation = useCallback((location: UserGeoLocation | null, source: NonNullable<UserGeoLocation['source']>) => {
//     const newLocationWithSource = location ? { ...location, source, timestamp: Date.now() } : null;
//     setCurrentLocationState(newLocationWithSource);

//     if (newLocationWithSource) {
//       setError(null);
//       if (source === 'gps') {
//         (async () => {
//           const anonToken = await anonymousUserManager.getValidAnonymousToken();
//           if (anonToken && newLocationWithSource) {
//             try {
//               const payload: UpdateAnonymousLocationRequestDto = {
//                 latitude: newLocationWithSource.latitude,
//                 longitude: newLocationWithSource.longitude,
//                 accuracy: newLocationWithSource.accuracy,
//                 source: 'gps',
//               };
//               await updateAnonymousLocationPreference(payload);
//             } catch (saveError) {
//               console.error("UserGeoLocationContext: Failed to save anonymous GPS location preference:", saveError);
//             }
//           }
//         })();
//       }
//     }
//   }, []);

//   const clearError = useCallback(() => { setError(null); }, []);

//   const attemptBrowserGpsLocation = useCallback(async (options?: LocationAttemptOptions): Promise<UserGeoLocation | null> => {
//     const now = Date.now();
//     if (isDetectingLocationRef.current || (now - lastDetectionAttemptTimeRef.current < LOCATION_DETECTION_THROTTLE_MS)) {
//       return currentLocation;
//     }

//     if (typeof navigator === 'undefined' || !navigator.geolocation) {
//       const msg = "Geolocation is not supported by your browser.";
//       setError(msg); options?.onError?.(msg); setIsLoadingGps(false);
//       return null;
//     }

//     isDetectingLocationRef.current = true;
//     lastDetectionAttemptTimeRef.current = now;
//     setIsLoadingGps(true); 
//     setError(null);

//     return new Promise((resolve) => {
//       const timerId = setTimeout(() => {
//         if (isDetectingLocationRef.current) {
//           isDetectingLocationRef.current = false; setIsLoadingGps(false);
//           const msg = "Location request timed out.";
//           options?.onError?.(msg, GeolocationPositionError.TIMEOUT); resolve(null);
//         }
//       }, GEOLOCATION_TIMEOUT_MS);

//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           clearTimeout(timerId);
//           if (!isDetectingLocationRef.current) { resolve(null); return; }
//           isDetectingLocationRef.current = false;

//           const determinedRadius = options?.targetRadius || 
//                                  (currentLocation ? currentLocation.radiusInMeters : DEFAULT_RADIUS_METERS);

//           const newLocation: UserGeoLocation = {
//             latitude: parseFloat(position.coords.latitude.toFixed(6)),
//             longitude: parseFloat(position.coords.longitude.toFixed(6)),
//             radiusInMeters: determinedRadius,
//             accuracy: position.coords.accuracy,
//             timestamp: Date.now(),
//             source: 'gps',
//           };
          
//           setCurrentLocation(newLocation, 'gps'); 
//           setIsLoadingGps(false);
//           options?.onSuccess?.(newLocation);
//           resolve(newLocation);
//         },
//         (geoError) => {
//           clearTimeout(timerId);
//           if (!isDetectingLocationRef.current) { resolve(null); return; }
//           isDetectingLocationRef.current = false; setIsLoadingGps(false);
          
//           let userFriendlyMessage = "Could not determine your location.";
//           if (geoError.code === geoError.PERMISSION_DENIED) userFriendlyMessage = "Location access was denied.";
//           else if (geoError.code === geoError.POSITION_UNAVAILABLE) userFriendlyMessage = "Location information is currently unavailable.";
//           else if (geoError.code === geoError.TIMEOUT) userFriendlyMessage = "Location request timed out.";
          
//           options?.onError?.(userFriendlyMessage, geoError.code);
//           if (!options?.onError || geoError.code !== geoError.PERMISSION_DENIED) {
//             setError(userFriendlyMessage);
//           }
//           console.warn("UserGeoLocationContext: Geolocation error:", geoError.message, "Code:", geoError.code);
//           resolve(null);
//         },
//         { timeout: GEOLOCATION_TIMEOUT_MS - 1000, enableHighAccuracy: false, maximumAge: 1000 * 60 * 1 }
//       );
//     });
//   }, [currentLocation, setCurrentLocation]);

//   return (
//     <UserGeoLocationContext.Provider value={{
//         currentLocation,
//         setCurrentLocation,
//         isLoading: isLoadingGps || isLoadingInitialPreference,
//         error,
//         clearError,
//         attemptBrowserGpsLocation,
//         isLoadingInitialPreference
//     }}>
//       {children}
//     </UserGeoLocationContext.Provider>
//   );
// };

// export const useUserGeoLocation = (): UserGeoLocationContextType => {
//   const context = useContext(UserGeoLocationContext);
//   if (context === undefined) {
//     throw new Error('useUserGeoLocation must be used within a UserGeoLocationProvider');
//   }
//   return context;
// };
// // // src/contexts/UserGeoLocationContext.tsx
// // 'use client';

// // import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
// // import { anonymousUserManager } from '@/lib/anonymousUser'; // For checking anonymous status
// // import { 
// //     getAnonymousLocationPreference, 
// //     updateAnonymousLocationPreference 
// // } from '@/lib/apiClient';
// // import { UpdateAnonymousLocationRequestDto, AnonymousUserPreferenceDto } from '@/types/anonymous'; // DTO for API

// // // Interface for the location object used within this context and by consumers
// // export interface UserGeoLocation {
// //   latitude: number;
// //   longitude: number;
// //   radiusInMeters: number; // Current search radius or area of interest around lat/lon
// //   accuracy?: number;     // GPS accuracy in meters
// //   timestamp?: number;    // When this location object was created/updated
// //   source?: 'gps' | 'ip_geoloc' | 'manual_city' | 'preference_loaded' | 'url_param' | 'initial_default'; // Source of location
// // }

// // // Options for when attempting to get GPS location
// // interface LocationAttemptOptions {
// //   onSuccess?: (location: UserGeoLocation) => void;
// //   onError?: (errorMsg: string, errorCode?: number) => void;
// //   targetRadius?: number; // If a specific radius should be set upon successful detection
// // }

// // // The shape of the context value
// // interface UserGeoLocationContextType {
// //   currentLocation: UserGeoLocation | null;
// //   setCurrentLocation: (location: UserGeoLocation | null, source: UserGeoLocation['source']) => void;
// //   isLoading: boolean; // True if actively trying to get GPS or loading initial preference
// //   error: string | null; // Geolocation specific errors
// //   clearError: () => void;
// //   attemptBrowserGpsLocation: (options?: LocationAttemptOptions) => Promise<UserGeoLocation | null>;
// //   isLoadingInitialPreference: boolean; // Specifically for the async load of saved preferences
// // }

// // const UserGeoLocationContext = createContext<UserGeoLocationContextType | undefined>(undefined);

// // const DEFAULT_RADIUS_METERS = 500000; // Default search radius (e.g., 50km)
// // const LOCATION_DETECTION_THROTTLE_MS = 3000; // Prevent rapid re-attempts
// // const GEOLOCATION_TIMEOUT_MS = 8000; // How long to wait for browser geolocation

// // export const UserGeoLocationProvider = ({ children }: { children: ReactNode }) => {
// //   const [currentLocation, setCurrentLocationState] = useState<UserGeoLocation | null>(null);
// //   const [isLoadingGps, setIsLoadingGps] = useState(false); // For active GPS detection attempts
// //   const [isLoadingInitialPreference, setIsLoadingInitialPreference] = useState(true);
// //   const [error, setError] = useState<string | null>(null);

// //   const isDetectingLocationRef = useRef(false);
// //   const lastDetectionAttemptTimeRef = useRef(0);

// //   // Effect to load saved anonymous location preference on initial mount
// //   useEffect(() => {
// //     const loadSavedPreference = async () => {
// //       // Ensure this runs only once if no location is set yet and anon user context is available
// //       if (currentLocation) { // If location already set (e.g. by URL param sync), don't overwrite with pref yet
// //           setIsLoadingInitialPreference(false);
// //           return;
// //       }

// //       const anonToken = await anonymousUserManager.getValidAnonymousToken(); // Ensures manager is initialized

// //       if (anonToken) {
// //         console.log("UserGeoLocationContext: Anonymous token found, attempting to load location preference.");
// //         // setIsLoadingInitialPreference(true); // Already true by default
// //         try {
// //           const savedPref: AnonymousUserPreferenceDto | null = await getAnonymousLocationPreference();
// //           if (savedPref && typeof savedPref.lastKnownLatitude === 'number' && typeof savedPref.lastKnownLongitude === 'number') {
// //             console.log("UserGeoLocationContext: Loaded saved anonymous location preference:", savedPref);
            
// //             setCurrentLocationState({
// //               latitude: savedPref.lastKnownLatitude,
// //               longitude: savedPref.lastKnownLongitude,
// //               accuracy: savedPref.lastKnownLocationAccuracy ?? undefined, // Use ?? for null/undefined
// //               radiusInMeters: DEFAULT_RADIUS_METERS, // Start with default radius when loading pref
// //               timestamp: savedPref.lastSetAtUtc ? new Date(savedPref.lastSetAtUtc).getTime() : Date.now(),
// //               source: 'preference_loaded',
// //             });
// //           } else {
// //             console.log("UserGeoLocationContext: No saved location preference found for anonymous user.");
// //           }
// //         } catch (e) {
// //           console.error("UserGeoLocationContext: Error loading anonymous location preference:", e);
// //         } finally {
// //           setIsLoadingInitialPreference(false);
// //         }
// //       } else {
// //         // No anonymous token, so no preference to load
// //         setIsLoadingInitialPreference(false);
// //       }
// //     };
    
// //     loadSavedPreference();
// //   // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, []); // Dependencies: empty to run once. Relies on anonymousUserManager internal state.

// //   const setCurrentLocation = useCallback((location: UserGeoLocation | null, source: UserGeoLocation['source']) => {
// //     const newLocationWithSource = location ? { ...location, source, timestamp: Date.now() } : null; // Always update timestamp
    
// //     console.log(`UserGeoLocationContext: Setting current location from source '${source}':`, newLocationWithSource);
// //     setCurrentLocationState(newLocationWithSource);

// //     if (newLocationWithSource) { // If location is being set (not cleared)
// //       setError(null); // Clear any previous location errors

// //       // If this location came from GPS and user is anonymous, save it as a preference
// //       if (source === 'gps') {
// //         (async () => {
// //           const anonToken = await anonymousUserManager.getValidAnonymousToken();
// //           if (anonToken && newLocationWithSource) { // Check newLocationWithSource again as it could be null in theory
// //             console.log("UserGeoLocationContext: GPS location obtained for anonymous user, saving preference...");
// //             try {
// //               const payload: UpdateAnonymousLocationRequestDto = {
// //                 latitude: newLocationWithSource.latitude,
// //                 longitude: newLocationWithSource.longitude,
// //                 accuracy: newLocationWithSource.accuracy,
// //                 source: 'gps', // The source of this specific data point
// //               };
// //               await updateAnonymousLocationPreference(payload);
// //               console.log("UserGeoLocationContext: Anonymous location preference saved via GPS.");
// //             } catch (saveError) {
// //               console.error("UserGeoLocationContext: Failed to save anonymous GPS location preference:", saveError);
// //             }
// //           }
// //         })();
// //       }
// //     }
// //   }, []); // No external dependencies that would cause re-creation unnecessarily

// //   const clearError = useCallback(() => { setError(null); }, []);

// //   const attemptBrowserGpsLocation = useCallback(async (options?: LocationAttemptOptions): Promise<UserGeoLocation | null> => {
// //     const now = Date.now();
// //     if (isDetectingLocationRef.current || (now - lastDetectionAttemptTimeRef.current < LOCATION_DETECTION_THROTTLE_MS)) {
// //       console.log("UserGeoLocationContext: Throttling GPS location attempt.");
// //       return currentLocation; // Return current known location if throttled
// //     }

// //     if (typeof navigator === 'undefined' || !navigator.geolocation) {
// //       const msg = "Geolocation is not supported by your browser.";
// //       setError(msg); options?.onError?.(msg); setIsLoadingGps(false);
// //       return null;
// //     }

// //     isDetectingLocationRef.current = true;
// //     lastDetectionAttemptTimeRef.current = now;
// //     setIsLoadingGps(true); // Loading state for active GPS attempt
// //     setError(null);

// //     return new Promise((resolve) => {
// //       const timerId = setTimeout(() => {
// //         if (isDetectingLocationRef.current) {
// //           isDetectingLocationRef.current = false; setIsLoadingGps(false);
// //           const msg = "Location request timed out.";
// //           options?.onError?.(msg, GeolocationPositionError.TIMEOUT); resolve(null);
// //         }
// //       }, GEOLOCATION_TIMEOUT_MS);

// //       navigator.geolocation.getCurrentPosition(
// //         (position) => {
// //           clearTimeout(timerId);
// //           if (!isDetectingLocationRef.current) { resolve(null); return; }
// //           isDetectingLocationRef.current = false;

// //           const determinedRadius = options?.targetRadius || 
// //                                  (currentLocation ? currentLocation.radiusInMeters : DEFAULT_RADIUS_METERS);

// //           const newLocation: UserGeoLocation = {
// //             latitude: parseFloat(position.coords.latitude.toFixed(6)),
// //             longitude: parseFloat(position.coords.longitude.toFixed(6)),
// //             radiusInMeters: determinedRadius,
// //             accuracy: position.coords.accuracy,
// //             timestamp: Date.now(),
// //             source: 'gps',
// //           };
          
// //           setCurrentLocation(newLocation, 'gps'); // This will also trigger save if anonymous
// //           setIsLoadingGps(false);
// //           options?.onSuccess?.(newLocation);
// //           resolve(newLocation);
// //         },
// //         (geoError) => {
// //           clearTimeout(timerId);
// //           if (!isDetectingLocationRef.current) { resolve(null); return; }
// //           isDetectingLocationRef.current = false; setIsLoadingGps(false);
          
// //           let userFriendlyMessage = "Could not determine your location.";
// //           if (geoError.code === geoError.PERMISSION_DENIED) userFriendlyMessage = "Location access was denied.";
// //           else if (geoError.code === geoError.POSITION_UNAVAILABLE) userFriendlyMessage = "Location information is currently unavailable.";
// //           else if (geoError.code === geoError.TIMEOUT) userFriendlyMessage = "Location request timed out.";
          
// //           options?.onError?.(userFriendlyMessage, geoError.code);
// //           if (!options?.onError || geoError.code !== geoError.PERMISSION_DENIED) {
// //             // Set general error if not permission denied or not handled by specific callback
// //             setError(userFriendlyMessage);
// //           }
// //           console.warn("UserGeoLocationContext: Geolocation error:", geoError.message, "Code:", geoError.code);
// //           resolve(null);
// //         },
// //         { timeout: GEOLOCATION_TIMEOUT_MS - 1000, enableHighAccuracy: false, maximumAge: 1000 * 60 * 1 } // 1 min cache for position
// //       );
// //     });
// //   }, [currentLocation, setCurrentLocation]); // Dependencies for attemptBrowserGpsLocation

// //   return (
// //     <UserGeoLocationContext.Provider value={{
// //         currentLocation,
// //         setCurrentLocation,
// //         isLoading: isLoadingGps || isLoadingInitialPreference, // Combined loading state
// //         error,
// //         clearError,
// //         attemptBrowserGpsLocation,
// //         isLoadingInitialPreference
// //     }}>
// //       {children}
// //     </UserGeoLocationContext.Provider>
// //   );
// // };

// // export const useUserGeoLocation = (): UserGeoLocationContextType => {
// //   const context = useContext(UserGeoLocationContext);
// //   if (context === undefined) {
// //     throw new Error('useUserGeoLocation must be used within a UserGeoLocationProvider');
// //   }
// //   return context;
// // };
// // // // src/contexts/UserGeoLocationContext.tsx
// // // 'use client';

// // // import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
// // // import { anonymousUserManager } from '@/lib/anonymousUser'; // For checking anonymous status and getting token
// // // import { 
// // //     getAnonymousLocationPreference, 
// // //     updateAnonymousLocationPreference 
// // // } from '@/lib/apiClient';
// // // import { UpdateAnonymousLocationRequestDto } from '@/types/anonymous';

// // // // SimpleUserLocation interface can remain largely the same
// // // export interface UserGeoLocation { // Renamed for clarity
// // //   latitude: number;
// // //   longitude: number;
// // //   radiusInMeters: number; // This might be more of a search preference than a core location attribute
// // //   accuracy?: number;
// // //   timestamp?: number;
// // //   source?: 'gps' | 'ip_geoloc' | 'manual' | 'preference'; // Added source
// // // }

// // // interface LocationAttemptOptions {
// // //   onSuccess?: (location: UserGeoLocation) => void;
// // //   onError?: (errorMsg: string, errorCode?: number) => void;
// // //   targetRadius?: number; // Could be removed if radius is a separate preference
// // // }

// // // interface UserGeoLocationContextType {
// // //   currentLocation: UserGeoLocation | null;
// // //   setCurrentLocation: (location: UserGeoLocation | null, source: UserGeoLocation['source']) => void; // Added source
// // //   isLoading: boolean; // Loading GPS or initial preference
// // //   error: string | null;
// // //   clearError: () => void;
// // //   attemptBrowserGpsLocation: (options?: LocationAttemptOptions) => Promise<UserGeoLocation | null>; // Renamed
// // //   isLoadingInitialPreference: boolean; // New state for clarity
// // // }

// // // const UserGeoLocationContext = createContext<UserGeoLocationContextType | undefined>(undefined);

// // // export const UserGeoLocationProvider = ({ children }: { children: ReactNode }) => {
// // //   const [currentLocation, setCurrentLocationState] = useState<UserGeoLocation | null>(null);
// // //   const [isLoading, setIsLoading] = useState(false); // For active GPS detection
// // //   const [isLoadingInitialPreference, setIsLoadingInitialPreference] = useState(true); // For loading saved pref
// // //   const [error, setError] = useState<string | null>(null);

// // //   const isDetectingLocationRef = useRef(false);
// // //   const lastDetectionAttemptTimeRef = useRef(0);

// // //   // Load preference on mount if anonymous user
// // //   useEffect(() => {
// // //     const loadSavedPreference = async () => {
// // //       // Check if there's an anonymous token available without triggering a fetch *from here*
// // //       // anonymousUserManager should handle its own token fetching if needed.
// // //       // We just need to know if a session is likely active to attempt preference load.
// // //       const anonToken = await anonymousUserManager.getValidAnonymousToken(); // Ensures manager is initialized

// // //       if (anonToken && !currentLocation) { // Only if no location is set yet
// // //         // console.log("UserGeoLocationContext: Anonymous token found, attempting to load location preference.");
// // //         setIsLoadingInitialPreference(true);
// // //         try {
// // //           const savedPref = await getAnonymousLocationPreference();
// // //           if (savedPref && savedPref.lastKnownLatitude && savedPref.lastKnownLongitude) {
// // //             console.log("UserGeoLocationContext: Loaded saved anonymous location preference:", savedPref);
// // //             setCurrentLocationState({
// // //               latitude: savedPref.lastKnownLatitude,
// // //               longitude: savedPref.lastKnownLongitude,
// // //               accuracy: savedPref.lastKnownLocationAccuracy || undefined,
// // //               radiusInMeters: currentLocation?.radiusInMeters || 500000, // Keep existing radius or default
// // //               timestamp: savedPref.lastSetAtUtc ? new Date(savedPref.lastSetAtUtc).getTime() : Date.now(),
// // //               source: 'preference',
// // //             });
// // //           } else {
// // //             // console.log("UserGeoLocationContext: No saved location preference found for anonymous user.");
// // //           }
// // //         } catch (e) {
// // //           console.error("UserGeoLocationContext: Error loading anonymous location preference:", e);
// // //         } finally {
// // //           setIsLoadingInitialPreference(false);
// // //         }
// // //       } else {
// // //         setIsLoadingInitialPreference(false); // No token or location already set
// // //       }
// // //     };
// // //     loadSavedPreference();
// // //   }, []); // Run once on mount; anonymousUserManager handles its token state

// // //   const setCurrentLocation = useCallback((location: UserGeoLocation | null, source: UserGeoLocation['source']) => {
// // //     // If new location is set, update its source
// // //     const newLocationWithSource = location ? { ...location, source } : null;
// // //     setCurrentLocationState(newLocationWithSource);
// // //     if (location) {
// // //       setError(null);
// // //       // If this location came from GPS and user is anonymous, save it
// // //       if (source === 'gps') {
// // //         (async () => {
// // //           const anonToken = await anonymousUserManager.getValidAnonymousToken();
// // //           if (anonToken && location) {
// // //             // console.log("UserGeoLocationContext: GPS location obtained for anonymous user, saving preference...");
// // //             try {
// // //               const payload: UpdateAnonymousLocationRequestDto = {
// // //                 latitude: location.latitude,
// // //                 longitude: location.longitude,
// // //                 accuracy: location.accuracy,
// // //                 source: 'gps',
// // //               };
// // //               await updateAnonymousLocationPreference(payload);
// // //               // console.log("UserGeoLocationContext: Anonymous location preference saved via GPS.");
// // //             } catch (saveError) {
// // //               console.error("UserGeoLocationContext: Failed to save anonymous GPS location preference:", saveError);
// // //             }
// // //           }
// // //         })();
// // //       }
// // //     }
// // //   }, []); // Add dependencies if they change how this function behaves, e.g. anonymousToken if used directly

// // //   const clearError = useCallback(() => { setError(null); }, []);

// // //   const attemptBrowserGpsLocation = useCallback(async (options?: LocationAttemptOptions): Promise<UserGeoLocation | null> => {
// // //     const now = Date.now();
// // //     if (isDetectingLocationRef.current || (now - lastDetectionAttemptTimeRef.current < 3000)) { // Increased throttle slightly
// // //         console.log("UserGeoLocationContext: Throttling GPS location attempt.");
// // //         return currentLocation; // Return current if already attempting or too soon
// // //     }

// // //     if (!navigator.geolocation) {
// // //       const msg = "Geolocation is not supported by your browser.";
// // //       setError(msg); options?.onError?.(msg); setIsLoading(false); return null;
// // //     }

// // //     isDetectingLocationRef.current = true;
// // //     lastDetectionAttemptTimeRef.current = now;
// // //     setIsLoading(true); // Active GPS detection loading
// // //     setError(null);

// // //     return new Promise((resolve) => {
// // //       const timeoutDuration = 8000;
// // //       const timerId = setTimeout(() => {
// // //         if (isDetectingLocationRef.current) {
// // //           isDetectingLocationRef.current = false; setIsLoading(false);
// // //           const msg = "Location request timed out.";
// // //           options?.onError?.(msg, GeolocationPositionError.TIMEOUT); resolve(null);
// // //         }
// // //       }, timeoutDuration);

// // //       navigator.geolocation.getCurrentPosition(
// // //         (position) => {
// // //           clearTimeout(timerId);
// // //           if (!isDetectingLocationRef.current) { resolve(null); return; }
// // //           isDetectingLocationRef.current = false;

// // //           const newLocation: UserGeoLocation = {
// // //             latitude: parseFloat(position.coords.latitude.toFixed(6)),
// // //             longitude: parseFloat(position.coords.longitude.toFixed(6)),
// // //             radiusInMeters: options?.targetRadius || currentLocation?.radiusInMeters || 500000,
// // //             accuracy: position.coords.accuracy,
// // //             timestamp: Date.now(),
// // //             source: 'gps', // Mark as from GPS
// // //           };
          
// // //           // Use the enhanced setCurrentLocation to handle saving if anonymous
// // //           setCurrentLocation(newLocation, 'gps'); 
          
// // //           setIsLoading(false);
// // //           options?.onSuccess?.(newLocation);
// // //           resolve(newLocation);
// // //         },
// // //         (geoError) => {
// // //           clearTimeout(timerId);
// // //           if (!isDetectingLocationRef.current) { resolve(null); return; }
// // //           isDetectingLocationRef.current = false; setIsLoading(false);
// // //           let userFriendlyMessage = "Could not determine your location.";
// // //           if (geoError.code === geoError.PERMISSION_DENIED) userFriendlyMessage = "Location access was denied.";
// // //           else if (geoError.code === geoError.POSITION_UNAVAILABLE) userFriendlyMessage = "Location information is currently unavailable.";
// // //           else if (geoError.code === geoError.TIMEOUT) userFriendlyMessage = "Location request timed out.";
          
// // //           options?.onError?.(userFriendlyMessage, geoError.code);
// // //           // Set context error only if not handled by a specific callback that might redirect
// // //           if(!options?.onError) setError(userFriendlyMessage);
// // //           console.warn("Geolocation error:", geoError.message, "Code:", geoError.code);
// // //           resolve(null);
// // //         },
// // //         { timeout: 7000, enableHighAccuracy: false, maximumAge: 1000 * 60 * 5 }
// // //       );
// // //     });
// // //   }, [currentLocation, setCurrentLocation]); // Added setCurrentLocation dependency

// // //   return (
// // //     <UserGeoLocationContext.Provider value={{
// // //         currentLocation,
// // //         setCurrentLocation, // Expose the enhanced version
// // //         isLoading: isLoading || isLoadingInitialPreference, // Combined loading state
// // //         error,
// // //         clearError,
// // //         attemptBrowserGpsLocation, // Renamed
// // //         isLoadingInitialPreference
// // //     }}>
// // //       {children}
// // //     </UserGeoLocationContext.Provider>
// // //   );
// // // };

// // // export const useUserGeoLocation = (): UserGeoLocationContextType => { // Renamed hook
// // //   const context = useContext(UserGeoLocationContext);
// // //   if (context === undefined) {
// // //     throw new Error('useUserGeoLocation must be used within a UserGeoLocationProvider');
// // //   }
// // //   return context;
// // // };
// // // // // src/contexts/SimpleLocationContext.tsx
// // // // 'use client';

// // // // import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

// // // // export interface SimpleUserLocation {
// // // //   latitude: number;
// // // //   longitude: number;
// // // //   radiusInMeters: number;
// // // //   accuracy?: number; // Optional from GPS
// // // //   timestamp?: number; // Optional: when this location was set/detected
// // // //   // No 'source' needed if only GPS or manual/URL
// // // // }

// // // // interface LocationAttemptOptions {
// // // //   onSuccess?: (location: SimpleUserLocation) => void;
// // // //   onError?: (errorMsg: string, errorCode?: number) => void; // Pass error code for more specific handling
// // // //   targetRadius?: number;
// // // // }

// // // // interface SimpleLocationContextType {
// // // //   currentUserLocation: SimpleUserLocation | null;
// // // //   setCurrentUserLocation: (location: SimpleUserLocation | null) => void; // For URL sync or manual overrides
// // // //   isLoading: boolean;
// // // //   error: string | null; // For general errors like "geolocation not supported"
// // // //   clearError: () => void; // To allow components to clear the context error
// // // //   attemptBrowserLocation: (options?: LocationAttemptOptions) => Promise<SimpleUserLocation | null>;
// // // // }

// // // // const SimpleLocationContext = createContext<SimpleLocationContextType | undefined>(undefined);

// // // // export const SimpleLocationProvider = ({ children }: { children: ReactNode }) => {
// // // //   const [currentUserLocation, setCurrentUserLocationState] = useState<SimpleUserLocation | null>(null);
// // // //   const [isLoading, setIsLoading] = useState(false);
// // // //   const [error, setError] = useState<string | null>(null); // Context's internal error state

// // // //   // Refs to prevent rapid re-attempts if user is clicking fast
// // // //   const isDetectingLocationRef = useRef(false);
// // // //   const lastDetectionAttemptTimeRef = useRef(0);


// // // //   const setCurrentUserLocation = useCallback((location: SimpleUserLocation | null) => {
// // // //     setCurrentUserLocationState(location);
// // // //     if (location) {
// // // //       setError(null); // Clear general context error if location is successfully set
// // // //     }
// // // //   }, []);

// // // //   const clearError = useCallback(() => {
// // // //     setError(null);
// // // //   }, []);

// // // //   const attemptBrowserLocation = useCallback(async (options?: LocationAttemptOptions): Promise<SimpleUserLocation | null> => {
// // // //     const now = Date.now();
// // // //     if (isDetectingLocationRef.current || (now - lastDetectionAttemptTimeRef.current < 2000)) {
// // // //       // console.log("SimpleLocationContext: Throttling location attempt.");
// // // //       // Return current location or null if an attempt is already in progress or too recent
// // // //       return currentUserLocation; 
// // // //     }

// // // //     if (!navigator.geolocation) {
// // // //       const msg = "Geolocation is not supported by your browser.";
// // // //       setError(msg); // Set general context error
// // // //       options?.onError?.(msg); // Inform caller
// // // //       setIsLoading(false); 
// // // //       return null;
// // // //     }

// // // //     isDetectingLocationRef.current = true;
// // // //     lastDetectionAttemptTimeRef.current = now;
// // // //     setIsLoading(true);
// // // //     setError(null); // Clear previous general errors before new attempt

// // // //     return new Promise((resolve) => {
// // // //       const timeoutDuration = 8000; // 8 seconds
// // // //       const timerId = setTimeout(() => {
// // // //         if (isDetectingLocationRef.current) { // Check if still relevant
// // // //             isDetectingLocationRef.current = false;
// // // //             setIsLoading(false);
// // // //             const msg = "Location request timed out.";
// // // //             // Don't set general context error for timeout if onError is expected to handle it (e.g. redirect)
// // // //             options?.onError?.(msg, GeolocationPositionError.TIMEOUT); 
// // // //             resolve(null);
// // // //         }
// // // //       }, timeoutDuration);

// // // //       navigator.geolocation.getCurrentPosition(
// // // //         (position) => {
// // // //           clearTimeout(timerId);
// // // //           if (!isDetectingLocationRef.current) return resolve(null); // Attempt was cancelled or timed out differently
// // // //           isDetectingLocationRef.current = false;
          
// // // //           const newLocation: SimpleUserLocation = {
// // // //             latitude: parseFloat(position.coords.latitude.toFixed(6)),
// // // //             longitude: parseFloat(position.coords.longitude.toFixed(6)),
// // // //             radiusInMeters: options?.targetRadius || currentUserLocation?.radiusInMeters || 500000,
// // // //             accuracy: position.coords.accuracy,
// // // //             timestamp: Date.now()
// // // //           };
          
// // // //           setCurrentUserLocationState(newLocation); // Update context state
// // // //           setIsLoading(false);
// // // //           options?.onSuccess?.(newLocation);
// // // //           resolve(newLocation);
// // // //         },
// // // //         (geoError) => {
// // // //           clearTimeout(timerId);
// // // //           if (!isDetectingLocationRef.current) return resolve(null);
// // // //           isDetectingLocationRef.current = false;
// // // //           setIsLoading(false);
          
// // // //           let userFriendlyMessage = "Could not determine your location.";
// // // //           if (geoError.code === geoError.PERMISSION_DENIED) {
// // // //             userFriendlyMessage = "Location access was denied."; // This specific message can be checked by caller
// // // //           } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
// // // //             userFriendlyMessage = "Location information is currently unavailable.";
// // // //           } else if (geoError.code === geoError.TIMEOUT) { // Should be caught by our own timer, but as a fallback
// // // //             userFriendlyMessage = "Location request timed out.";
// // // //           }
          
// // // //           // IMPORTANT: We call options.onError to let the consuming component handle UI (like redirecting).
// // // //           // We do NOT set the general context `error` state here for PERMISSION_DENIED,
// // // //           // as the redirect should happen instead of showing a persistent error message from context.
// // // //           // For other errors, we might set the context error if not handled by a redirect.
// // // //           if (geoError.code !== geoError.PERMISSION_DENIED) {
// // // //               // For errors other than explicit denial, it might be okay to set a general context error
// // // //               // if the caller's onError doesn't handle it with a redirect.
// // // //               // However, the primary mechanism is options.onError.
// // // //               // setError(userFriendlyMessage); // Reconsider if this is needed or if options.onError is sufficient
// // // //           }
          
// // // //           options?.onError?.(userFriendlyMessage, geoError.code);
// // // //           console.warn("Geolocation error:", geoError.message, "Code:", geoError.code);
// // // //           resolve(null); 
// // // //         },
// // // //         { 
// // // //           timeout: 7000, // Slightly less than our manual timeout
// // // //           enableHighAccuracy: false, // Faster, less battery, good enough for city-level
// // // //           maximumAge: 60000 * 5 // Accept a cached position up to 5 minutes old
// // // //         }
// // // //       );
// // // //     });
// // // //   }, [currentUserLocation?.radiusInMeters]); // Dependency for default radius if currentUserLocation exists

// // // //   return (
// // // //     <SimpleLocationContext.Provider value={{ 
// // // //         currentUserLocation, 
// // // //         setCurrentUserLocation, 
// // // //         isLoading, 
// // // //         error, 
// // // //         clearError,
// // // //         attemptBrowserLocation
// // // //     }}>
// // // //       {children}
// // // //     </SimpleLocationContext.Provider>
// // // //   );
// // // // };

// // // // export const useSimpleLocation = (): SimpleLocationContextType => {
// // // //   const context = useContext(SimpleLocationContext);
// // // //   if (context === undefined) {
// // // //     throw new Error('useSimpleLocation must be used within a SimpleLocationProvider');
// // // //   }
// // // //   return context;
// // // // };
// // // // // // src/contexts/SimpleLocationContext.tsx
// // // // // 'use client';

// // // // // import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// // // // // export interface SimpleUserLocation {
// // // // //   latitude: number;
// // // // //   longitude: number;
// // // // //   radiusInMeters: number;
// // // // // }

// // // // // interface SimpleLocationContextType {
// // // // //   currentUserLocation: SimpleUserLocation | null;
// // // // //   setCurrentUserLocation: (location: SimpleUserLocation | null) => void;
// // // // //   isLoading: boolean;
// // // // //   error: string | null;
// // // // //   attemptGeoLocation: (options?: {
// // // // //     onSuccess?: (location: SimpleUserLocation) => void;
// // // // //     onError?: (errorMsg: string) => void;
// // // // //     targetRadius?: number;
// // // // //   }) => Promise<SimpleUserLocation | null>;
// // // // // }

// // // // // const SimpleLocationContext = createContext<SimpleLocationContextType | undefined>(undefined);

// // // // // export const SimpleLocationProvider = ({ children }: { children: ReactNode }) => {
// // // // //   const [currentUserLocation, setCurrentUserLocationState] = useState<SimpleUserLocation | null>(null);
// // // // //   const [isLoading, setIsLoading] = useState(false);
// // // // //   const [error, setError] = useState<string | null>(null);

// // // // //   const setCurrentUserLocation = (location: SimpleUserLocation | null) => {
// // // // //     setCurrentUserLocationState(location);
// // // // //   };

// // // // //   const attemptGeoLocation = useCallback(async (options?: {
// // // // //     onSuccess?: (location: SimpleUserLocation) => void;
// // // // //     onError?: (errorMsg: string) => void;
// // // // //     targetRadius?: number;
// // // // //   }): Promise<SimpleUserLocation | null> => {
// // // // //     if (!navigator.geolocation) {
// // // // //       const msg = "Geolocation is not supported by your browser.";
// // // // //       setError(msg);
// // // // //       options?.onError?.(msg);
// // // // //       setIsLoading(false); // Ensure loading is set to false
// // // // //       return null;
// // // // //     }

// // // // //     setIsLoading(true);
// // // // //     setError(null);

// // // // //     return new Promise((resolve) => {
// // // // //       navigator.geolocation.getCurrentPosition(
// // // // //         (position) => {
// // // // //           const newLocation: SimpleUserLocation = {
// // // // //             latitude: parseFloat(position.coords.latitude.toFixed(6)),
// // // // //             longitude: parseFloat(position.coords.longitude.toFixed(6)),
// // // // //             radiusInMeters: options?.targetRadius || currentUserLocation?.radiusInMeters || 500000,
// // // // //           };
// // // // //           setCurrentUserLocationState(newLocation); // Update context state
// // // // //           setIsLoading(false);
// // // // //           options?.onSuccess?.(newLocation);
// // // // //           resolve(newLocation);
// // // // //         },
// // // // //         (geoError) => {
// // // // //           const msg = `Location Error: ${geoError.message}`;
// // // // //           setError(msg);
// // // // //           setIsLoading(false);
// // // // //           options?.onError?.(msg);
// // // // //           console.warn("Geolocation error:", geoError);
// // // // //           resolve(null); // Return null on error
// // // // //         },
// // // // //         { timeout: 10000, enableHighAccuracy: false }
// // // // //       );
// // // // //     });
// // // // //   }, [currentUserLocation?.radiusInMeters]);

// // // // //   return (
// // // // //     <SimpleLocationContext.Provider value={{ 
// // // // //         currentUserLocation, 
// // // // //         setCurrentUserLocation, 
// // // // //         isLoading, 
// // // // //         error, 
// // // // //         attemptGeoLocation 
// // // // //     }}>
// // // // //       {children}
// // // // //     </SimpleLocationContext.Provider>
// // // // //   );
// // // // // };

// // // // // export const useSimpleLocation = (): SimpleLocationContextType => {
// // // // //   const context = useContext(SimpleLocationContext);
// // // // //   if (context === undefined) {
// // // // //     throw new Error('useSimpleLocation must be used within a SimpleLocationProvider');
// // // // //   }
// // // // //   return context;
// // // // // };