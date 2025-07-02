// src/hooks/useAnonymousSession.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { anonymousUserManager } from '@/lib/anonymousUser'; // Your singleton
import { DecodedAnonymousSessionToken } from '@/types/anonymous';

export function useAnonymousSession() {
  const [anonymousToken, setAnonymousToken] = useState<string | null>(null);
  const [decodedPayload, setDecodedPayload] = useState<DecodedAnonymousSessionToken | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isInitialized, setIsInitialized] = useState(false); // <-- NEW STATE

  const fetchAndUpdateState = useCallback(async (isInitialCall: boolean = false) => {
    if (isInitialCall) { // Only set isLoading true for the very first call
      setIsLoading(true);
    }
    // For subsequent refreshes, we might not want to set isLoading globally,
    // or we can, depending on desired UX for refresh.
    // If not initial, let's assume silent refresh.
    if (!isInitialCall) console.log("useAnonymousSession: Refreshing session state...");


    try {
      // getValidAnonymousToken internally calls ensureInitialized, which handles the initial fetch if needed.
      const token = await anonymousUserManager.getValidAnonymousToken();
      setAnonymousToken(token);

      if (token) {
        const payload = anonymousUserManager.getDecodedPayloadInternal();
        setDecodedPayload(payload);
        setAnonId(payload?.anon_id || null);
        // console.log("useAnonymousSession: Token updated/validated:", token ? 'Exists' : 'Null', payload);
      } else {
        // console.log("useAnonymousSession: No valid token found.");
        setDecodedPayload(null);
        setAnonId(null);
      }
    } catch (error) {
      console.error("useAnonymousSession: Error fetching/updating session state:", error);
      setAnonymousToken(null);
      setDecodedPayload(null);
      setAnonId(null);
    } finally {
      if (isInitialCall) {
        setIsLoading(false);
      }
      setIsInitialized(true); // <-- SET INITIALIZED TO TRUE AFTER FIRST ATTEMPT
      // console.log("useAnonymousSession: fetchAndUpdateState finished. Initialized:", isInitialized, "Loading:", isLoading);
    }
  }, []); 

  useEffect(() => {
    // console.log("useAnonymousSession: Mounting, calling initial fetchAndUpdateState.");
    fetchAndUpdateState(true); // Pass true for initial call
  }, [fetchAndUpdateState]);

  const clearAnonymousSessionStateHook = useCallback(async () => {
    // This function updates the hook's state after the manager clears its state
    setIsLoading(true);
    await anonymousUserManager.clearCurrentAnonymousSession();
    setAnonymousToken(null);
    setDecodedPayload(null);
    setAnonId(null);
    // After clearing, we might want to immediately try to get a new anonymous session
    // or let the next getValidAnonymousToken call handle it.
    // For now, just clear state. A subsequent getValidAnonymousToken will fetch new.
    console.log("useAnonymousSession: Hook state cleared after manager clear.");
    setIsLoading(false);
    // isInitialized remains true, as the system has been through an init cycle.
  }, []);
  
  // This is more for external calls to re-sync if manager state changed elsewhere
  const refreshAnonymousSession = useCallback(async () => {
    // console.log("useAnonymousSession: Refresh triggered.");
    await fetchAndUpdateState(false); // Non-initial call
  }, [fetchAndUpdateState]);


  // Expose a function to be called by anonymousUserManager when it gets a new token after logout
  // This is a bit of a workaround for the singleton not directly updating hook state.
  // A better approach might be an event emitter or global state manager for the token itself.
  useEffect(() => {
    const handleTokenChangeAfterLogout = async () => {
        console.log("useAnonymousSession: Detected potential token update from manager (e.g., after logout/new session). Re-fetching state.");
        await fetchAndUpdateState(false); // Refresh silently
    };

    // This is a simplified listener. In a real app, anonymousUserManager would emit an event.
    // For now, we can tie it to a global event or a prop if anonymousUserManager could notify.
    // As a temporary measure, we might re-fetch if isInitialized is true but token is null,
    // assuming something external (like logout) might have cleared it. This is imperfect.

    // A better way: anonymousUserManager could have a callback mechanism
    // anonymousUserManager.onTokenRefreshed = handleTokenChangeAfterLogout;
    // return () => { anonymousUserManager.onTokenRefreshed = null; }

    return () => {}; // Placeholder for cleanup
  }, []);


  return {
    anonymousToken,    
    anonId,            
    decodedPayload,    
    isLoading,      // True during the very initial load
    isInitialized, // True after the first attempt to load/fetch token is done
    clearAnonymousSessionStateHook, // Renamed to avoid conflict if manager also has one exposed differently
    refreshAnonymousSession,
  };
}
// // src/hooks/useAnonymousSession.ts
// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { anonymousUserManager } from '@/lib/anonymousUser'; // Your singleton
// import { DecodedAnonymousSessionToken } from '@/types/anonymous';

// export function useAnonymousSession() {
//   const [anonymousToken, setAnonymousToken] = useState<string | null>(null);
//   const [decodedPayload, setDecodedPayload] = useState<DecodedAnonymousSessionToken | null>(null);
//   const [anonId, setAnonId] = useState<string | null>(null); // Extracted for convenience
//   const [isLoading, setIsLoading] = useState(true); // True initially until first check completes
//    const [isInitialized, setIsInitialized] = useState(false);

//   const fetchAndUpdateState = useCallback(async () => {
//     setIsLoading(true);
//     try {
//       const token = await anonymousUserManager.getValidAnonymousToken();
//       setAnonymousToken(token);

//       if (token) {
//         const payload = anonymousUserManager.getDecodedPayloadInternal(); // Get already decoded payload
//         setDecodedPayload(payload);
//         setAnonId(payload?.anon_id || null);
//       } else {
//         setDecodedPayload(null);
//         setAnonId(null);
//       }
//     } catch (error) {
//       console.error("useAnonymousSession: Error fetching/updating session state:", error);
//       setAnonymousToken(null);
//       setDecodedPayload(null);
//       setAnonId(null);
//     } finally {
//       setIsLoading(false);
      
//     }
//   }, []); // No dependencies, relies on singleton's internal state management

//   useEffect(() => {
//     fetchAndUpdateState(); // Initial fetch on mount
//   }, [fetchAndUpdateState]);

//   const clearAnonymousSession = useCallback(async () => {
//     setIsLoading(true); // Indicate activity
//     await anonymousUserManager.clearCurrentAnonymousSession();
//     setAnonymousToken(null);
//     setDecodedPayload(null);
//     setAnonId(null);
//     setIsLoading(false);
//   }, []);

//   // refreshAnonymousSession can just re-trigger the fetchAndUpdateState
//   const refreshAnonymousSession = useCallback(async () => {
//     await fetchAndUpdateState();
//   }, [fetchAndUpdateState]);

//   return {
//     anonymousToken,    // The raw JWT string
//     anonId,            // The extracted anon_id (persistent UUID)
//     decodedPayload,    // The full decoded payload of the token
//     isLoading,         // True during initial load or refresh
//     clearAnonymousSession,
//     refreshAnonymousSession,
//   };
// }