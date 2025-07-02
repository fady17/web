'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import {
    AnonymousCartApiResponse,
    AddToAnonymousCartRequest,
    AnonymousCartItem as AnonymousCartItemFromApi, 
    UpdateAnonymousCartItemApiBody,
} from '@/types/anonymous';
import {
    UserCartApiResponseDto,
    UserCartItemDto, 
    AddToUserCartRequestDto, 
    UpdateUserCartItemQuantityRequestDto, 
} from '@/types/api';
import {
    getAnonymousCart, addToAnonymousCart, updateAnonymousCartItem, removeAnonymousCartItem, clearAnonymousCart,
    getUserCart, addItemToUserCart, updateUserCartItem, removeUserCartItem, clearUserCart,
} from '@/lib/apiClient';
import { useAnonymousSession } from '@/hooks/useAnonymousSession';
import { useSession } from 'next-auth/react';
import { anonymousUserManager } from '@/lib/anonymousUser'; // Import for anonymousId in clear

export interface DisplayableCartItem {
  id: string; 
  itemType: 'anonymous' | 'user';
  shopId: string;
  shopServiceId: string;
  quantity: number;
  serviceNameEn: string;
  serviceNameAr: string;
  priceAtAddition: number;
  shopNameSnapshotEn?: string | null;
  shopNameSnapshotAr?: string | null;
  serviceImageUrlSnapshot?: string | null;
  addedAt: string; 
}

export interface UpdateCartItemContextPayload {
    itemId: string; 
    newQuantity: number;
    itemType: 'anonymous' | 'user';
}

export interface RemoveCartItemContextPayload {
    itemId: string; 
    itemType: 'anonymous' | 'user';
}

export interface CartContextType {
  items: DisplayableCartItem[]; 
  isLoading: boolean; 
  error: string | null; 
  itemCount: number;
  totalAmount: number;
  lastUpdatedAt: string | null; 
  activeCartType: 'anonymous' | 'user' | 'none'; 
  fetchCart: (silent?: boolean) => Promise<void>;
  addItem: (item: AddToAnonymousCartRequest) => Promise<void>; 
  updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
  removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
  clearClientCart: () => Promise<void>;
  isUpdatingItemId: string | null; 
  handleLogout: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { 
    anonymousToken, 
    isLoading: isLoadingAnonTokenState, 
    isInitialized: isAnonSessionInitialized,
    anonId // Assuming useAnonymousSession hook provides this (the anonymous user's UUID)
  } = useAnonymousSession();
  const { data: authSession, status: sessionStatus } = useSession();

  const [rawCartApiResponse, setRawCartApiResponse] = useState<AnonymousCartApiResponse | UserCartApiResponseDto | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState<boolean>(true); 
  const [cartError, setCartError] = useState<string | null>(null);
  const [activeCartType, setActiveCartType] = useState<'anonymous' | 'user' | 'none'>('none');
  const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

  const prevSessionStatusRef = useRef<string | null>(sessionStatus);
  const hasAttemptedInitialFetchRef = useRef<boolean>(false);


  const displayItems = useMemo((): DisplayableCartItem[] => {
    if (!rawCartApiResponse?.items || activeCartType === 'none') {
      // If activeCartType is 'none', there should be no items from rawCartApiResponse.
      // If rawCartApiResponse has items but activeCartType is 'none', it's a state inconsistency.
      if (rawCartApiResponse?.items && rawCartApiResponse.items.length > 0 && activeCartType === 'none') {
        console.warn("CartContext: displayItems - rawCart has items but activeCartType is 'none'. Clearing items.");
      }
      return [];
    }
    
    return rawCartApiResponse.items.map((item: AnonymousCartItemFromApi | UserCartItemDto) => {
        if (activeCartType === 'anonymous') {
            const anonItem = item as AnonymousCartItemFromApi;
            return {
                id: anonItem.anonymousCartItemId, itemType: 'anonymous', shopId: anonItem.shopId,
                shopServiceId: anonItem.shopServiceId, quantity: anonItem.quantity, serviceNameEn: anonItem.serviceNameEn,
                serviceNameAr: anonItem.serviceNameAr, priceAtAddition: anonItem.priceAtAddition,
                shopNameSnapshotEn: anonItem.shopNameSnapshotEn, shopNameSnapshotAr: anonItem.shopNameSnapshotAr,
                serviceImageUrlSnapshot: anonItem.serviceImageUrlSnapshot, addedAt: anonItem.addedAt,
            };
        } else { // 'user'
            const userItem = item as UserCartItemDto;
            return {
                id: userItem.userCartItemId, itemType: 'user', shopId: userItem.shopId,
                shopServiceId: userItem.shopServiceId, quantity: userItem.quantity, serviceNameEn: userItem.serviceNameEn,
                serviceNameAr: userItem.serviceNameAr, priceAtAddition: userItem.priceAtAddition,
                shopNameSnapshotEn: userItem.shopNameSnapshotEn, shopNameSnapshotAr: userItem.shopNameSnapshotAr,
                serviceImageUrlSnapshot: userItem.serviceImageUrlSnapshot, addedAt: userItem.addedAtUtc,
            };
        }
    });
  }, [rawCartApiResponse, activeCartType]);

  const itemCount = useMemo(() => rawCartApiResponse?.totalItems || 0, [rawCartApiResponse]);
  const totalAmount = useMemo(() => rawCartApiResponse?.totalAmount || 0, [rawCartApiResponse]);
  const lastUpdatedAt = useMemo(() => rawCartApiResponse?.lastUpdatedAt || null, [rawCartApiResponse]);

  const handleApiError = useCallback((err: any, operation: string) => {
    console.error(`CartContext: Operation (${operation}) failed:`, err);
    const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
    setCartError(message);
  }, []);

  const fetchCart = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoadingCart(true);
    setCartError(null);
    // console.log(`CartContext: fetchCart called. Silent: ${silent}, Session: ${sessionStatus}, AnonToken: ${!!anonymousToken}, AnonSessionInitialized: ${isAnonSessionInitialized}`);

    const readyToFetchUserCart = sessionStatus === 'authenticated';
    const readyToFetchAnonCart = sessionStatus === 'unauthenticated' && isAnonSessionInitialized && !!anonymousToken;
    const anonCartShouldBeEmpty = sessionStatus === 'unauthenticated' && isAnonSessionInitialized && !anonymousToken;
    const stillWaitingForSessions = sessionStatus === 'loading' || (sessionStatus === 'unauthenticated' && !isAnonSessionInitialized);

    try {
      if (readyToFetchUserCart) {
        // console.log('CartContext: Fetching user cart...');
        const userCart = await getUserCart();
        setRawCartApiResponse(userCart);
        setActiveCartType('user');
        // console.log('CartContext: User cart fetched.', userCart);
      } else if (readyToFetchAnonCart) {
        // console.log('CartContext: Fetching anonymous cart...');
        const anonCart = await getAnonymousCart();
        setRawCartApiResponse(anonCart);
        setActiveCartType('anonymous');
        // console.log('CartContext: Anonymous cart fetched.', anonCart);
      } else if (anonCartShouldBeEmpty) {
        // console.log('CartContext: Anon session initialized, no token. Setting cart to empty.');
        setRawCartApiResponse(null); 
        setActiveCartType('none'); 
      }
       else if (stillWaitingForSessions) {
        // console.log('CartContext: Still waiting for session or anonymous user manager initialization.');
        if (!silent && !isLoadingCart) setIsLoadingCart(true);
        return; 
      }
      else {
        // console.log('CartContext: No clear session state for cart fetch. Setting to empty.');
        setRawCartApiResponse(null);
        setActiveCartType('none');
      }
    } catch (err) {
      handleApiError(err, 'fetch cart');
      setRawCartApiResponse(null); 
      setActiveCartType('none');
    } finally {
      if (!stillWaitingForSessions) {
         setIsLoadingCart(false);
      }
      // console.log(`CartContext: fetchCart finished. isLoadingCart: ${isLoadingCart}, ActiveCart: ${activeCartType}`);
    }
  }, [sessionStatus, anonymousToken, isAnonSessionInitialized, handleApiError, isLoadingCart]); 

  useEffect(() => {
    // console.log(`CartContext Effect Trigger: sessionStatus=${sessionStatus}, prevStatus=${prevSessionStatusRef.current}, anonTokenReady=${!!anonymousToken}, anonSessionInitialized=${isAnonSessionInitialized}, initialFetchAttempted=${hasAttemptedInitialFetchRef.current}`);

    const justLoggedIn = prevSessionStatusRef.current !== 'authenticated' && sessionStatus === 'authenticated';
    const justLoggedOut = prevSessionStatusRef.current === 'authenticated' && sessionStatus === 'unauthenticated';

    if (justLoggedIn) {
      // console.log("CartContext: User just logged in. AppInitializer should handle merge. Cart will refetch.");
      setRawCartApiResponse(null); 
      setActiveCartType('none');   
      setIsLoadingCart(true); 
      hasAttemptedInitialFetchRef.current = false; 
    } else if (justLoggedOut) {
      // console.log("CartContext: User just logged out. Clearing user cart display.");
      setRawCartApiResponse(null);
      setActiveCartType('none');
      setIsLoadingCart(true); 
      hasAttemptedInitialFetchRef.current = false; 
    }

    if (sessionStatus !== 'loading' && isAnonSessionInitialized) {
      if (!hasAttemptedInitialFetchRef.current) {
        // console.log("CartContext: Conditions met for initial cart fetch.");
        fetchCart(false); 
        hasAttemptedInitialFetchRef.current = true;
      } else if (justLoggedIn || justLoggedOut) {
        // console.log("CartContext: Login/logout detected, ensuring cart fetch (non-silent).");
        fetchCart(false);
      }
    }
    prevSessionStatusRef.current = sessionStatus;
  }, [sessionStatus, anonymousToken, isAnonSessionInitialized, fetchCart]); 
  

  const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
    if (activeCartType === 'none' && !(sessionStatus === 'authenticated' || (sessionStatus === 'unauthenticated' && anonymousToken && isAnonSessionInitialized))) {
      handleApiError(new Error("No active session (user or anonymous ready) to add item to."), "add item");
      return;
    }
    if (isLoadingCart && isUpdatingItemId === null) { 
        console.warn("CartContext: Add item called while cart is globally loading. Aborting.");
        return;
    }

    const tempUpdatingId = `add-${itemRequest.shopServiceId}-${itemRequest.shopId}`;
    setIsUpdatingItemId(tempUpdatingId); 
    setCartError(null);
    
    try {
      let updatedCart;
      if (sessionStatus === 'authenticated') {
        updatedCart = await addItemToUserCart(itemRequest as AddToUserCartRequestDto);
        setRawCartApiResponse(updatedCart);
        setActiveCartType('user'); 
      } else if (anonymousToken && isAnonSessionInitialized) { 
        updatedCart = await addToAnonymousCart(itemRequest);
        setRawCartApiResponse(updatedCart);
        setActiveCartType('anonymous'); 
      } else { 
        throw new Error("Cannot add item: No authenticated session and anonymous session not ready or no token."); 
      }
    } catch (err) { 
      handleApiError(err, 'add item'); 
    } finally { 
      setIsUpdatingItemId(null); 
    }
  };

  const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
    // CORRECTED CHECK FOR ERROR 1
    if (activeCartType === 'none') {
      handleApiError(new Error("No active cart for update operation."), "update item quantity");
      return;
    }
    if (activeCartType !== payload.itemType) {
      handleApiError(new Error("Cart type mismatch for update operation."), "update item quantity");
      return;
    }
    // END CORRECTED CHECK

     if (isLoadingCart && isUpdatingItemId === null) {
        console.warn("CartContext: Update item called while cart is globally loading. Aborting.");
        return;
    }

    setIsUpdatingItemId(payload.itemId); 
    setCartError(null);
    
    try {
      let updatedCart;
      if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
        updatedCart = await updateUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
        setRawCartApiResponse(updatedCart);
      } else if (payload.itemType === 'anonymous' && anonymousToken && isAnonSessionInitialized) {
        updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
        setRawCartApiResponse(updatedCart);
      } else { 
        throw new Error("Session/ItemType mismatch or anonymous session not ready for update."); 
      }
    } catch (err) { 
      handleApiError(err, 'update item quantity'); 
    } finally { 
      setIsUpdatingItemId(null); 
    }
  };

  const removeItem = async (payload: RemoveCartItemContextPayload) => {
    // CORRECTED CHECK FOR ERROR 1
    if (activeCartType === 'none') {
        handleApiError(new Error("No active cart for remove operation."), "remove item");
        return;
    }
    if (activeCartType !== payload.itemType) {
        handleApiError(new Error("Cart type mismatch for remove operation."), "remove item");
        return;
    }
    // END CORRECTED CHECK

    if (isLoadingCart && isUpdatingItemId === null) {
        console.warn("CartContext: Remove item called while cart is globally loading. Aborting.");
        return;
    }

    setIsUpdatingItemId(payload.itemId); 
    setCartError(null);
    
    try {
      let updatedCart;
      if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
        updatedCart = await removeUserCartItem(payload.itemId);
        setRawCartApiResponse(updatedCart);
      } else if (payload.itemType === 'anonymous' && anonymousToken && isAnonSessionInitialized) {
        updatedCart = await removeAnonymousCartItem(payload.itemId);
        setRawCartApiResponse(updatedCart);
      } else { 
        throw new Error("Session/ItemType mismatch or anonymous session not ready for remove."); 
      }
    } catch (err) { 
      handleApiError(err, 'remove item'); 
    } finally { 
      setIsUpdatingItemId(null); 
    }
  };

  const clearClientCart = async () => {
    if (activeCartType === 'none' && !isLoadingCart) { // Also check not already loading
        // If already clear and not loading, no need to do anything or set loading state.
        return;
    }
    if (isLoadingCart && isUpdatingItemId === null) {
        console.warn("CartContext: Clear cart called while cart is globally loading. Aborting.");
        return;
    }

    setIsLoadingCart(true); 
    setCartError(null);
    
    try {
      if (sessionStatus === 'authenticated' && authSession?.user?.id) {
        await clearUserCart();
        // CORRECTED: Provide all required fields for UserCartApiResponseDto
        setRawCartApiResponse({ 
            userId: authSession.user.id, 
            items: [], 
            totalItems: 0, 
            totalAmount: 0, 
            lastUpdatedAt: new Date().toISOString(),
            currencyCode: rawCartApiResponse?.currencyCode || 'EGP' // Preserve currency or default
        }); 
        // setActiveCartType('user'); // Already user
      } else if (anonymousToken && isAnonSessionInitialized && anonId) { 
        // anonId from useAnonymousSession should be the anonymousSessionId
        await clearAnonymousCart();
        // CORRECTED: Provide all required fields for AnonymousCartApiResponse
        setRawCartApiResponse({ 
            anonymousUserId: anonId, 
            items: [], 
            totalItems: 0, 
            totalAmount: 0, 
            lastUpdatedAt: new Date().toISOString(), 
            currencyCode: (rawCartApiResponse as AnonymousCartApiResponse)?.currencyCode || 'EGP' // Preserve or default
        }); 
        // setActiveCartType('anonymous'); // Already anonymous
      } else { 
        // If no session to clear, just reset local state
        setRawCartApiResponse(null); 
        setActiveCartType('none'); 
      }
    } catch (err) { 
      handleApiError(err, 'clear cart'); 
      setRawCartApiResponse(null);
      setActiveCartType('none');
    } finally { 
      setIsLoadingCart(false); 
    }
  };
  
  const handleLogout = useCallback(async () => {
    console.log('CartContext: handleLogout signaled by external component.');
    // The actual state changes (clearing user cart, fetching anon cart)
    // are driven by the useEffect watching `sessionStatus`.
    // This function itself doesn't need to do much beyond logging or
    // perhaps an immediate local clear if desired, but useEffect is more robust.
    // setRawCartApiResponse(null); // Optional: immediate visual clear
    // setActiveCartType('none'); // Optional: immediate visual clear
  }, []);
  
  const contextValue: CartContextType = {
    items: displayItems,
    isLoading: isLoadingCart,
    error: cartError,
    itemCount,
    totalAmount,
    lastUpdatedAt,
    activeCartType,
    fetchCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearClientCart,
    isUpdatingItemId,
    handleLogout,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
};
// // src/contexts/CartContext.tsx
// 'use client';

// import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
// import {
//     AnonymousCartApiResponse,
//     AddToAnonymousCartRequest,
//     AnonymousCartItem as AnonymousCartItemFromApi, // From types/anonymous
//     UpdateAnonymousCartItemApiBody,
// } from '@/types/anonymous';
// import {
//     UserCartApiResponseDto,
//     UserCartItemDto, // From types/api
//     AddToUserCartRequestDto, // From types/api, assume structure matches AddToAnonymousCartRequest
//     UpdateUserCartItemQuantityRequestDto, // From types/api, assume structure matches UpdateAnonymousCartItemApiBody
// } from '@/types/api';
// import {
//     getAnonymousCart, addToAnonymousCart, updateAnonymousCartItem, removeAnonymousCartItem, clearAnonymousCart,
//     getUserCart, addItemToUserCart, updateUserCartItem, removeUserCartItem, clearUserCart,
// } from '@/lib/apiClient';
// import { useAnonymousSession } from '@/hooks/useAnonymousSession';
// import { useSession } from 'next-auth/react';

// // Common structure for items displayed in the UI
// export interface DisplayableCartItem {
//   id: string; // Holds anonymousCartItemId OR userCartItemId
//   itemType: 'anonymous' | 'user';
//   // All other common display properties from AnonymousCartItem or UserCartItemDto
//   shopId: string;
//   shopServiceId: string;
//   quantity: number;
//   serviceNameEn: string;
//   serviceNameAr: string;
//   priceAtAddition: number;
//   shopNameSnapshotEn?: string | null;
//   shopNameSnapshotAr?: string | null;
//   serviceImageUrlSnapshot?: string | null;
//   addedAt: string; // Normalized from addedAt or addedAtUtc
//   // If UserCartItemDto has updatedAtUtc and you want it:
//   // updatedAt?: string;
// }

// // Payloads for context's update/remove methods, expecting the unified 'id'
// export interface UpdateCartItemContextPayload {
//     itemId: string; // This is DisplayableCartItem.id
//     newQuantity: number;
//     itemType: string;
// }

// export interface RemoveCartItemContextPayload {
//     itemId: string; // This is DisplayableCartItem.id
//     itemType: string;
// }

// // This is what the context will provide to consumers
// export interface CartContextType {
//   items: DisplayableCartItem[]; // The transformed items for UI
//   isLoading: boolean; // True if fetching/clearing main cart
//   error: string | null; // Error messages
//   itemCount: number;
//   totalAmount: number;
//   lastUpdatedAt: string | null; // From the cart API response
//   activeCartType: 'anonymous' | 'user' | 'none'; // Indicates which cart is currently active
//   fetchCart: (silent?: boolean) => Promise<void>;
//   addItem: (item: AddToAnonymousCartRequest) => Promise<void>; // Request DTO for adding
//   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
//   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
//   clearClientCart: () => Promise<void>;
//   isUpdatingItemId: string | null; // Stores DisplayableCartItem.id of the item being modified
//   // NEW: Method to handle logout transition
//   handleLogout: () => Promise<void>;
// }

// const CartContext = createContext<CartContextType | undefined>(undefined);

// // Initial state for the context value
// const initialCartContextValue: CartContextType = {
//     items: [],
//     isLoading: true,
//     error: null,
//     itemCount: 0,
//     totalAmount: 0,
//     lastUpdatedAt: null,
//     activeCartType: 'none',
//     fetchCart: async () => {},
//     addItem: async () => {},
//     updateItemQuantity: async () => {},
//     removeItem: async () => {},
//     clearClientCart: async () => {},
//     isUpdatingItemId: null,
//     handleLogout: async () => {},
// };

// export const CartProvider = ({ children }: { children: ReactNode }) => {
//   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();
//   const { data: authSession, status: sessionStatus } = useSession();

//   // Holds the direct API response (either anonymous or user)
//   const [rawCartApiResponse, setRawCartApiResponse] = useState<AnonymousCartApiResponse | UserCartApiResponseDto | null>(null);
//   const [isLoadingCart, setIsLoadingCart] = useState<boolean>(true);
//   const [cartError, setCartError] = useState<string | null>(null);
//   const [activeCartType, setActiveCartType] = useState<'anonymous' | 'user' | 'none'>('none');
//   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

//   // Track previous session status to detect logout
//   const prevSessionStatusRef = useRef<string | null>(null);
//   const isLogoutTransitionRef = useRef<boolean>(false);

//   // Transform raw API items to DisplayableCartItem[]
//   const displayItems = useMemo((): DisplayableCartItem[] => {
//     if (!rawCartApiResponse?.items) return [];
//     return rawCartApiResponse.items.map((item: AnonymousCartItemFromApi | UserCartItemDto) => {
//         const isAnonymous = activeCartType === 'anonymous';
//         return {
//             shopId: item.shopId,
//             shopServiceId: item.shopServiceId,
//             quantity: item.quantity,
//             serviceNameEn: item.serviceNameEn,
//             serviceNameAr: item.serviceNameAr,
//             priceAtAddition: item.priceAtAddition,
//             shopNameSnapshotEn: item.shopNameSnapshotEn,
//             shopNameSnapshotAr: item.shopNameSnapshotAr,
//             serviceImageUrlSnapshot: item.serviceImageUrlSnapshot,
//             id: isAnonymous ? (item as AnonymousCartItemFromApi).anonymousCartItemId : (item as UserCartItemDto).userCartItemId,
//             itemType: activeCartType as 'anonymous' | 'user', // Type assertion based on activeCartType
//             addedAt: isAnonymous ? (item as AnonymousCartItemFromApi).addedAt : (item as UserCartItemDto).addedAtUtc,
//         };
//     });
//   }, [rawCartApiResponse, activeCartType]);

//   const itemCount = useMemo(() => rawCartApiResponse?.totalItems || 0, [rawCartApiResponse]);
//   const totalAmount = useMemo(() => rawCartApiResponse?.totalAmount || 0, [rawCartApiResponse]);
//   const lastUpdatedAt = useMemo(() => rawCartApiResponse?.lastUpdatedAt || null, [rawCartApiResponse]);

//   const handleApiError = useCallback((err: any, operation: string) => {
//     console.error(`CartContext: Operation (${operation}) failed:`, err);
//     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
//     setCartError(message);
//     setIsLoadingCart(false); // Ensure loading is stopped on error
//   }, []);

//   const fetchCart = useCallback(async (silent: boolean = false) => {
//     if (!silent) setIsLoadingCart(true);
//     setCartError(null);

//     try {
//       if (sessionStatus === 'authenticated') {
//         console.log('CartContext: Fetching user cart');
//         const userCart = await getUserCart();
//         setRawCartApiResponse(userCart);
//         setActiveCartType('user');
//       } else if (sessionStatus === 'unauthenticated' && anonymousToken) {
//         console.log('CartContext: Fetching anonymous cart');
//         const anonCart = await getAnonymousCart();
//         setRawCartApiResponse(anonCart);
//         setActiveCartType('anonymous');
//       } else if (sessionStatus === 'loading' || isLoadingAnonSession) {
//         console.log('CartContext: Sessions still loading, waiting...');
//         if (!silent) setIsLoadingCart(true);
//         return;
//       } else { // No session, no anon token
//         console.log('CartContext: No active session, clearing cart');
//         setRawCartApiResponse(null);
//         setActiveCartType('none');
//       }
//     } catch (err) {
//       handleApiError(err, 'fetch cart');
//       setRawCartApiResponse(null); // Clear raw cart on error
//       setActiveCartType('none');
//     } finally {
//       if (!silent) setIsLoadingCart(false);
//     }
//   }, [anonymousToken, isLoadingAnonSession, sessionStatus, handleApiError]);

//   // Detect logout transition
//   useEffect(() => {
//     const prevStatus = prevSessionStatusRef.current;
    
//     // Detect logout: was authenticated, now unauthenticated
//     if (prevStatus === 'authenticated' && sessionStatus === 'unauthenticated') {
//       console.log('CartContext: Logout detected, transitioning to anonymous cart');
//       isLogoutTransitionRef.current = true;
      
//       // Clear user cart data immediately
//       setRawCartApiResponse(null);
//       setActiveCartType('none');
      
//       // Wait a bit for anonymous token to be ready, then fetch
//       setTimeout(() => {
//         if (anonymousToken) {
//           fetchCart(true);
//         }
//         isLogoutTransitionRef.current = false;
//       }, 100);
//     }
    
//     prevSessionStatusRef.current = sessionStatus;
//   }, [sessionStatus, anonymousToken, fetchCart]);

//   // Main effect for cart fetching
//   useEffect(() => {
//     // Skip if we're in the middle of a logout transition
//     if (isLogoutTransitionRef.current) {
//       return;
//     }

//     if (sessionStatus !== 'loading' && !isLoadingAnonSession) {
//       console.log('CartContext: Session state changed, fetching cart');
//       fetchCart(true); // Initial fetch is silent
//     }
//   }, [sessionStatus, anonymousToken, isLoadingAnonSession, fetchCart]);

//   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
//     if (sessionStatus === 'loading' || isLoadingAnonSession) { 
//       handleApiError(new Error("Session loading"), "add item"); 
//       return; 
//     }
    
//     const tempUpdatingId = `add-${itemRequest.shopServiceId}-${itemRequest.shopId}`;
//     setIsUpdatingItemId(tempUpdatingId); 
//     setCartError(null);
    
//     try {
//       if (sessionStatus === 'authenticated') {
//         const updatedCart = await addItemToUserCart(itemRequest as AddToUserCartRequestDto);
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('user');
//       } else if (anonymousToken) {
//         const updatedCart = await addToAnonymousCart(itemRequest);
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('anonymous');
//       } else { 
//         throw new Error("No active session to add item."); 
//       }
//     } catch (err) { 
//       handleApiError(err, 'add item'); 
//     } finally { 
//       setIsUpdatingItemId(null); 
//     }
//   };

//   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
//     if (sessionStatus === 'loading' || isLoadingAnonSession) { 
//       handleApiError(new Error("Session loading"), "update item"); 
//       return; 
//     }
    
//     setIsUpdatingItemId(payload.itemId); 
//     setCartError(null);
    
//     try {
//       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
//         const updatedCart = await updateUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('user');
//       } else if (payload.itemType === 'anonymous' && anonymousToken) {
//         const updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('anonymous');
//       } else { 
//         throw new Error("Session/ItemType mismatch or no active session for update."); 
//       }
//     } catch (err) { 
//       handleApiError(err, 'update item quantity'); 
//     } finally { 
//       setIsUpdatingItemId(null); 
//     }
//   };

//   const removeItem = async (payload: RemoveCartItemContextPayload) => {
//     if (sessionStatus === 'loading' || isLoadingAnonSession) { 
//       handleApiError(new Error("Session loading"), "remove item"); 
//       return; 
//     }
    
//     setIsUpdatingItemId(payload.itemId); 
//     setCartError(null);
    
//     try {
//       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
//         const updatedCart = await removeUserCartItem(payload.itemId);
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('user');
//       } else if (payload.itemType === 'anonymous' && anonymousToken) {
//         const updatedCart = await removeAnonymousCartItem(payload.itemId);
//         setRawCartApiResponse(updatedCart);
//         setActiveCartType('anonymous');
//       } else { 
//         throw new Error("Session/ItemType mismatch or no active session for remove."); 
//       }
//     } catch (err) { 
//       handleApiError(err, 'remove item'); 
//     } finally { 
//       setIsUpdatingItemId(null); 
//     }
//   };

//   const clearClientCart = async () => {
//     if (sessionStatus === 'loading' || isLoadingAnonSession) { 
//       handleApiError(new Error("Session loading"), "clear cart"); 
//       return; 
//     }
    
//     setIsLoadingCart(true); 
//     setCartError(null);
    
//     try {
//       if (sessionStatus === 'authenticated') {
//         await clearUserCart();
//         setRawCartApiResponse(null); 
//         setActiveCartType('user'); // Cart is now empty for user
//       } else if (anonymousToken) {
//         await clearAnonymousCart();
//         setRawCartApiResponse(null); 
//         setActiveCartType('anonymous'); // Cart is now empty for anon
//       } else { 
//         setRawCartApiResponse(null); 
//         setActiveCartType('none'); // No session, already clear
//         setIsLoadingCart(false); 
//         return; 
//       }
//     } catch (err) { 
//       handleApiError(err, 'clear cart'); 
//     } finally { 
//       setIsLoadingCart(false); 
//     }
//   };

//   // NEW: Handle logout transition
//   const handleLogout = useCallback(async () => {
//     console.log('CartContext: Handling logout...');
    
//     // Clear user cart data immediately
//     setRawCartApiResponse(null);
//     setActiveCartType('none');
//     setCartError(null);
    
//     // Wait for anonymous token to be ready and fetch anonymous cart
//     // This will be handled by the useEffect that detects logout
//   }, []);
  
//   const contextValue: CartContextType = {
//     items: displayItems,
//     isLoading: isLoadingCart,
//     error: cartError,
//     itemCount,
//     totalAmount,
//     lastUpdatedAt,
//     activeCartType,
//     fetchCart,
//     addItem,
//     updateItemQuantity,
//     removeItem,
//     clearClientCart,
//     isUpdatingItemId,
//     handleLogout,
//   };

//   return (
//     <CartContext.Provider value={contextValue}>
//       {children}
//     </CartContext.Provider>
//   );
// };

// export const useCart = (): CartContextType => {
//   const context = useContext(CartContext);
//   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
//   return context;
// };
// // // src/contexts/CartContext.tsx
// // 'use client';

// // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // import {
// //     AnonymousCartApiResponse,
// //     AddToAnonymousCartRequest,
// //     AnonymousCartItem as AnonymousCartItemFromApi, // From types/anonymous
// //     UpdateAnonymousCartItemApiBody,
// // } from '@/types/anonymous';
// // import {
// //     UserCartApiResponseDto,
// //     UserCartItemDto, // From types/api
// //     AddToUserCartRequestDto, // From types/api, assume structure matches AddToAnonymousCartRequest
// //     UpdateUserCartItemQuantityRequestDto, // From types/api, assume structure matches UpdateAnonymousCartItemApiBody
// // } from '@/types/api';
// // import {
// //     getAnonymousCart, addToAnonymousCart, updateAnonymousCartItem, removeAnonymousCartItem, clearAnonymousCart,
// //     getUserCart, addItemToUserCart, updateUserCartItem, removeUserCartItem, clearUserCart,
// // } from '@/lib/apiClient';
// // import { useAnonymousSession } from '@/hooks/useAnonymousSession';
// // import { useSession } from 'next-auth/react';

// // // Common structure for items displayed in the UI
// // export interface DisplayableCartItem {
// //   id: string; // Holds anonymousCartItemId OR userCartItemId
// //   itemType: 'anonymous' | 'user';
// //   // All other common display properties from AnonymousCartItem or UserCartItemDto
// //   shopId: string;
// //   shopServiceId: string;
// //   quantity: number;
// //   serviceNameEn: string;
// //   serviceNameAr: string;
// //   priceAtAddition: number;
// //   shopNameSnapshotEn?: string | null;
// //   shopNameSnapshotAr?: string | null;
// //   serviceImageUrlSnapshot?: string | null;
// //   addedAt: string; // Normalized from addedAt or addedAtUtc
// //   // If UserCartItemDto has updatedAtUtc and you want it:
// //   // updatedAt?: string;
// // }

// // // Payloads for context's update/remove methods, expecting the unified 'id'
// // export interface UpdateCartItemContextPayload {
// //     itemId: string; // This is DisplayableCartItem.id
// //     newQuantity: number;
// //     itemType: string;

// // }
// // export interface RemoveCartItemContextPayload {
// //     itemId: string; // This is DisplayableCartItem.id
// //     itemType: string;
// // }

// // // This is what the context will provide to consumers
// // export interface CartContextType {
// //   items: DisplayableCartItem[]; // The transformed items for UI
// //   isLoading: boolean; // True if fetching/clearing main cart
// //   error: string | null; // Error messages
// //   itemCount: number;
// //   totalAmount: number;
// //   lastUpdatedAt: string | null; // From the cart API response
// //   activeCartType: 'anonymous' | 'user' | 'none'; // Indicates which cart is currently active
// //   fetchCart: (silent?: boolean) => Promise<void>;
// //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>; // Request DTO for adding
// //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// //   clearClientCart: () => Promise<void>;
// //   isUpdatingItemId: string | null; // Stores DisplayableCartItem.id of the item being modified
// // }

// // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // Initial state for the context value
// // const initialCartContextValue: CartContextType = {
// //     items: [],
// //     isLoading: true,
// //     error: null,
// //     itemCount: 0,
// //     totalAmount: 0,
// //     lastUpdatedAt: null,
// //     activeCartType: 'none',
// //     fetchCart: async () => {},
// //     addItem: async () => {},
// //     updateItemQuantity: async () => {},
// //     removeItem: async () => {},
// //     clearClientCart: async () => {},
// //     isUpdatingItemId: null,
// // };

// // export const CartProvider = ({ children }: { children: ReactNode }) => {
// //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();
// //   const { data: authSession, status: sessionStatus } = useSession();

// //   // Holds the direct API response (either anonymous or user)
// //   const [rawCartApiResponse, setRawCartApiResponse] = useState<AnonymousCartApiResponse | UserCartApiResponseDto | null>(null);
// //   const [isLoadingCart, setIsLoadingCart] = useState<boolean>(true);
// //   const [cartError, setCartError] = useState<string | null>(null);
// //   const [activeCartType, setActiveCartType] = useState<'anonymous' | 'user' | 'none'>('none');
// //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

// //   // Transform raw API items to DisplayableCartItem[]
// //   const displayItems = useMemo((): DisplayableCartItem[] => {
// //     if (!rawCartApiResponse?.items) return [];
// //     return rawCartApiResponse.items.map((item: AnonymousCartItemFromApi | UserCartItemDto) => {
// //         const isAnonymous = activeCartType === 'anonymous';
// //         return {
// //             shopId: item.shopId,
// //             shopServiceId: item.shopServiceId,
// //             quantity: item.quantity,
// //             serviceNameEn: item.serviceNameEn,
// //             serviceNameAr: item.serviceNameAr,
// //             priceAtAddition: item.priceAtAddition,
// //             shopNameSnapshotEn: item.shopNameSnapshotEn,
// //             shopNameSnapshotAr: item.shopNameSnapshotAr,
// //             serviceImageUrlSnapshot: item.serviceImageUrlSnapshot,
// //             id: isAnonymous ? (item as AnonymousCartItemFromApi).anonymousCartItemId : (item as UserCartItemDto).userCartItemId,
// //             itemType: activeCartType as 'anonymous' | 'user', // Type assertion based on activeCartType
// //             addedAt: isAnonymous ? (item as AnonymousCartItemFromApi).addedAt : (item as UserCartItemDto).addedAtUtc,
// //         };
// //     });
// //   }, [rawCartApiResponse, activeCartType]);

// //   const itemCount = useMemo(() => rawCartApiResponse?.totalItems || 0, [rawCartApiResponse]);
// //   const totalAmount = useMemo(() => rawCartApiResponse?.totalAmount || 0, [rawCartApiResponse]);
// //   const lastUpdatedAt = useMemo(() => rawCartApiResponse?.lastUpdatedAt || null, [rawCartApiResponse]);

// //   const handleApiError = useCallback((err: any, operation: string) => {
// //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// //     setCartError(message);
// //     setIsLoadingCart(false); // Ensure loading is stopped on error
// //   }, []);

// //   const fetchCart = useCallback(async (silent: boolean = false) => {
// //     if (!silent) setIsLoadingCart(true);
// //     setCartError(null);

// //     try {
// //       if (sessionStatus === 'authenticated') {
// //         const userCart = await getUserCart();
// //         setRawCartApiResponse(userCart);
// //         setActiveCartType('user');
// //       } else if (sessionStatus === 'unauthenticated' && anonymousToken) {
// //         const anonCart = await getAnonymousCart();
// //         setRawCartApiResponse(anonCart);
// //         setActiveCartType('anonymous');
// //       } else if (sessionStatus === 'loading' || isLoadingAnonSession) {
// //         if (!silent) setIsLoadingCart(true);
// //         return;
// //       } else { // No session, no anon token
// //         setRawCartApiResponse(null);
// //         setActiveCartType('none');
// //       }
// //     } catch (err) {
// //       handleApiError(err, 'fetch cart');
// //       setRawCartApiResponse(null); // Clear raw cart on error
// //       setActiveCartType('none');
// //     } finally {
// //       if (!silent) setIsLoadingCart(false);
// //     }
// //   }, [anonymousToken, isLoadingAnonSession, sessionStatus, handleApiError]);

// //   useEffect(() => {
// //     if (sessionStatus !== 'loading' && !isLoadingAnonSession) {
// //       fetchCart(true); // Initial fetch is silent
// //     }
// //   }, [sessionStatus, anonymousToken, isLoadingAnonSession, fetchCart]);

// //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "add item"); return; }
// //     const tempUpdatingId = `add-${itemRequest.shopServiceId}-${itemRequest.shopId}`;
// //     setIsUpdatingItemId(tempUpdatingId); setCartError(null);
// //     try {
// //       if (sessionStatus === 'authenticated') {
// //         const updatedCart = await addItemToUserCart(itemRequest as AddToUserCartRequestDto); // Cast if needed
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('user');
// //       } else if (anonymousToken) {
// //         const updatedCart = await addToAnonymousCart(itemRequest);
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('anonymous');
// //       } else { throw new Error("No active session to add item."); }
// //     } catch (err) { handleApiError(err, 'add item'); } 
// //     finally { setIsUpdatingItemId(null); }
// //   };

// //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "update item"); return; }
// //     setIsUpdatingItemId(payload.itemId); setCartError(null);
// //     try {
// //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// //         const updatedCart = await updateUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('user');
// //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// //         const updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('anonymous');
// //       } else { throw new Error("Session/ItemType mismatch or no active session for update."); }
// //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// //     finally { setIsUpdatingItemId(null); }
// //   };

// //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "remove item"); return; }
// //     setIsUpdatingItemId(payload.itemId); setCartError(null);
// //     try {
// //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// //         const updatedCart = await removeUserCartItem(payload.itemId);
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('user');
// //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// //         const updatedCart = await removeAnonymousCartItem(payload.itemId);
// //         setRawCartApiResponse(updatedCart);
// //         setActiveCartType('anonymous');
// //       } else { throw new Error("Session/ItemType mismatch or no active session for remove."); }
// //     } catch (err) { handleApiError(err, 'remove item'); } 
// //     finally { setIsUpdatingItemId(null); }
// //   };

// //   const clearClientCart = async () => {
// //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "clear cart"); return; }
// //     setIsLoadingCart(true); setCartError(null);
// //     try {
// //       if (sessionStatus === 'authenticated') {
// //         await clearUserCart();
// //         setRawCartApiResponse(null); setActiveCartType('user'); // Cart is now empty for user
// //       } else if (anonymousToken) {
// //         await clearAnonymousCart();
// //         setRawCartApiResponse(null); setActiveCartType('anonymous'); // Cart is now empty for anon
// //       } else { 
// //         setRawCartApiResponse(null); setActiveCartType('none'); // No session, already clear
// //         setIsLoadingCart(false); return; 
// //       }
// //     } catch (err) { 
// //         handleApiError(err, 'clear cart'); 
// //         // Optionally refetch after a clear error to ensure consistency,
// //         // though setting to null might be desired UI behavior.
// //         // fetchCart(); 
// //     } finally { setIsLoadingCart(false); }
// //   };
  
// //   const contextValue: CartContextType = {
// //     items: displayItems,
// //     isLoading: isLoadingCart,
// //     error: cartError,
// //     itemCount,
// //     totalAmount,
// //     lastUpdatedAt,
// //     activeCartType,
// //     fetchCart,
// //     addItem,
// //     updateItemQuantity,
// //     removeItem,
// //     clearClientCart,
// //     isUpdatingItemId,
// //   };

// //   return (
// //     <CartContext.Provider value={contextValue}>
// //       {children}
// //     </CartContext.Provider>
// //   );
// // };

// // export const useCart = (): CartContextType => {
// //   const context = useContext(CartContext);
// //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// //   return context;
// // };
// // // // src/contexts/CartContext.tsx
// // // 'use client';

// // // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // // import {
// // //     AnonymousCartApiResponse,
// // //     AddToAnonymousCartRequest,
// // //     AnonymousCartItem as AnonymousCartItemFromApiType,
// // // } from '@/types/anonymous';
// // // import {
// // //     UserCartApiResponseDto,
// // //     UserCartItemDto,
// // // } from '@/types/api';
// // // import {
// // //     getAnonymousCart, addToAnonymousCart, updateAnonymousCartItem, removeAnonymousCartItem, clearAnonymousCart,
// // //     getUserCart, addItemToUserCart, updateUserCartItem, removeUserCartItem, clearUserCart,
// // // } from '@/lib/apiClient';
// // // import { useAnonymousSession } from '@/hooks/useAnonymousSession';
// // // import { useSession } from 'next-auth/react';

// // // // Common structure for items displayed in the UI
// // // export interface DisplayableCartItem {
// // //   id: string;
// // //   itemType: 'anonymous' | 'user';
// // //   shopId: string;
// // //   shopServiceId: string;
// // //   quantity: number;
// // //   serviceNameEn: string;
// // //   serviceNameAr: string;
// // //   priceAtAddition: number;
// // //   shopNameSnapshotEn?: string | null;
// // //   shopNameSnapshotAr?: string | null;
// // //   serviceImageUrlSnapshot?: string | null;
// // //   addedAt: string;
// // // }

// // // // Payloads for context's update/remove methods
// // // export interface UpdateCartItemContextPayload {
// // //     itemId: string;
// // //     itemType: 'anonymous' | 'user';
// // //     newQuantity: number;
// // // }
// // // export interface RemoveCartItemContextPayload {
// // //     itemId: string;
// // //     itemType: 'anonymous' | 'user';
// // // }

// // // // This is the actual state managed internally by the provider
// // // interface InternalCartState {
// // //   displayItems: DisplayableCartItem[];
// // //   rawCartResponse: AnonymousCartApiResponse | UserCartApiResponseDto | null;
// // //   isLoading: boolean;
// // //   error: string | null;
// // //   activeCartType: 'anonymous' | 'user' | 'none';
// // // }

// // // // This is what the context will provide to consumers
// // // export interface CartContextType {
// // //   items: DisplayableCartItem[];
// // //   isLoading: boolean;
// // //   error: string | null;
// // //   itemCount: number;
// // //   totalAmount: number;
// // //   lastUpdatedAt: string | null;
// // //   activeCartType: 'anonymous' | 'user' | 'none';
// // //   fetchCart: (silent?: boolean) => Promise<void>;
// // //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>;
// // //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// // //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// // //   clearClientCart: () => Promise<void>;
// // //   isUpdatingItemId: string | null;
// // // }

// // // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // const initialInternalCartState: InternalCartState = {
// // //     displayItems: [],
// // //     rawCartResponse: null,
// // //     isLoading: true,
// // //     error: null,
// // //     activeCartType: 'none',
// // // };

// // // export const CartProvider = ({ children }: { children: ReactNode }) => {
// // //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();
// // //   const { data: authSession, status: sessionStatus } = useSession();

// // //   const [internalCartState, setInternalCartState] = useState<InternalCartState>(initialInternalCartState);
// // //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

// // //   // Derived values based on the raw API response stored in internalCartState
// // //   const itemCount = useMemo(() => internalCartState.rawCartResponse?.totalItems || 0, [internalCartState.rawCartResponse]);
// // //   const totalAmount = useMemo(() => internalCartState.rawCartResponse?.totalAmount || 0, [internalCartState.rawCartResponse]);
// // //   const lastUpdatedAt = useMemo(() => internalCartState.rawCartResponse?.lastUpdatedAt || null, [internalCartState.rawCartResponse]);

// // //   const transformApiResponseToInternalState = (
// // //     apiResponse: AnonymousCartApiResponse | UserCartApiResponseDto | null,
// // //     type: 'anonymous' | 'user' | 'none'
// // //   ): InternalCartState => {
// // //     if (!apiResponse || !apiResponse.items || type === 'none') {
// // //       return { ...initialInternalCartState, isLoading: false, activeCartType: 'none', rawCartResponse: null };
// // //     }

// // //     const displayItems: DisplayableCartItem[] = apiResponse.items.map((item: AnonymousCartItemFromApiType | UserCartItemDto) => ({
// // //       shopId: item.shopId,
// // //       shopServiceId: item.shopServiceId,
// // //       quantity: item.quantity,
// // //       serviceNameEn: item.serviceNameEn,
// // //       serviceNameAr: item.serviceNameAr,
// // //       priceAtAddition: item.priceAtAddition,
// // //       shopNameSnapshotEn: item.shopNameSnapshotEn,
// // //       shopNameSnapshotAr: item.shopNameSnapshotAr,
// // //       serviceImageUrlSnapshot: item.serviceImageUrlSnapshot,
// // //       id: type === 'anonymous' ? (item as AnonymousCartItemFromApiType).anonymousCartItemId : (item as UserCartItemDto).userCartItemId,
// // //       itemType: type,
// // //       addedAt: type === 'anonymous' ? (item as AnonymousCartItemFromApiType).addedAt : (item as UserCartItemDto).addedAtUtc,
// // //     }));

// // //     return {
// // //       displayItems,
// // //       rawCartResponse: apiResponse, // Store the raw response
// // //       isLoading: false,
// // //       error: null, // Clear error on successful update
// // //       activeCartType: type,
// // //     };
// // //   };
  
// // //   const handleApiError = useCallback((err: any, operation: string) => {
// // //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// // //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// // //     setInternalCartState(prev => ({ ...prev, error: message, isLoading: false }));
// // //   }, []);

// // //   const fetchCart = useCallback(async (silent: boolean = false) => {
// // //     if (!silent) setInternalCartState(prev => ({ ...prev, isLoading: true, error: null }));
// // //     let currentActiveTypeForError = internalCartState.activeCartType;

// // //     try {
// // //       if (sessionStatus === 'authenticated') {
// // //         currentActiveTypeForError = 'user';
// // //         const userCart = await getUserCart();
// // //         setInternalCartState(transformApiResponseToInternalState(userCart, 'user'));
// // //       } else if (sessionStatus === 'unauthenticated' && anonymousToken) {
// // //         currentActiveTypeForError = 'anonymous';
// // //         const anonCart = await getAnonymousCart();
// // //         setInternalCartState(transformApiResponseToInternalState(anonCart, 'anonymous'));
// // //       } else if (sessionStatus === 'loading' || isLoadingAnonSession) {
// // //         if (!silent) setInternalCartState(prev => ({ ...prev, isLoading: true }));
// // //         return;
// // //       } else {
// // //         currentActiveTypeForError = 'none';
// // //         setInternalCartState(transformApiResponseToInternalState(null, 'none'));
// // //       }
// // //     } catch (err) {
// // //       handleApiError(err, 'fetch cart');
// // //       // On fetch error, we might want to reset to initial state or keep previous items but show error
// // //       setInternalCartState(prev => ({...initialInternalCartState, isLoading: false, error: (err as Error).message, activeCartType: prev.activeCartType}));
// // //     }
// // //   }, [anonymousToken, isLoadingAnonSession, sessionStatus, handleApiError, internalCartState.activeCartType]);

// // //   useEffect(() => {
// // //     if (sessionStatus !== 'loading' && !isLoadingAnonSession) {
// // //       fetchCart(true);
// // //     }
// // //   }, [sessionStatus, anonymousToken, isLoadingAnonSession, fetchCart]);

// // //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading, please try again."), "add item"); return; }
// // //     const tempUpdatingId = `add-${itemRequest.shopServiceId}-${itemRequest.shopId}`;
// // //     setIsUpdatingItemId(tempUpdatingId); setInternalCartState(prev => ({ ...prev, error: null }));
// // //     try {
// // //       if (sessionStatus === 'authenticated') {
// // //         const updatedCart = await addItemToUserCart(itemRequest);
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'user'));
// // //       } else if (anonymousToken) {
// // //         const updatedCart = await addToAnonymousCart(itemRequest);
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'anonymous'));
// // //       } else { throw new Error("No active session to add item."); }
// // //     } catch (err) { handleApiError(err, 'add item'); } 
// // //     finally { setIsUpdatingItemId(null); }
// // //   };

// // //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading, please try again."), "update item"); return; }
// // //     setIsUpdatingItemId(payload.itemId); setInternalCartState(prev => ({ ...prev, error: null }));
// // //     try {
// // //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// // //         const updatedCart = await updateUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'user'));
// // //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// // //         const updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'anonymous'));
// // //       } else { throw new Error("Session/ItemType mismatch or no active session for update."); }
// // //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// // //     finally { setIsUpdatingItemId(null); }
// // //   };

// // //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading, please try again."), "remove item"); return; }
// // //     setIsUpdatingItemId(payload.itemId); setInternalCartState(prev => ({ ...prev, error: null }));
// // //     try {
// // //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// // //         const updatedCart = await removeUserCartItem(payload.itemId);
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'user'));
// // //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// // //         const updatedCart = await removeAnonymousCartItem(payload.itemId);
// // //         setInternalCartState(transformApiResponseToInternalState(updatedCart, 'anonymous'));
// // //       } else { throw new Error("Session/ItemType mismatch or no active session for remove."); }
// // //     } catch (err) { handleApiError(err, 'remove item'); } 
// // //     finally { setIsUpdatingItemId(null); }
// // //   };

// // //   const clearClientCart = async () => {
// // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading, please try again."), "clear cart"); return; }
// // //     setInternalCartState(prev => ({ ...prev, isLoading: true, error: null }));
// // //     try {
// // //       const currentActiveType = internalCartState.activeCartType;
// // //       if (sessionStatus === 'authenticated') {
// // //         await clearUserCart();
// // //         setInternalCartState(transformApiResponseToInternalState(null, 'user'));
// // //       } else if (anonymousToken) {
// // //         await clearAnonymousCart();
// // //         setInternalCartState(transformApiResponseToInternalState(null, 'anonymous'));
// // //       } else { 
// // //         setInternalCartState(transformApiResponseToInternalState(null, 'none'));
// // //         return; 
// // //       }
// // //     } catch (err) { 
// // //         handleApiError(err, 'clear cart'); 
// // //         fetchCart();
// // //     }
// // //   };

// // //   return (
// // //     <CartContext.Provider value={{
// // //       items: internalCartState.displayItems,
// // //       isLoading: internalCartState.isLoading,
// // //       error: internalCartState.error,
// // //       activeCartType: internalCartState.activeCartType,
// // //       itemCount, // Derived via useMemo
// // //       totalAmount, // Derived via useMemo
// // //       lastUpdatedAt, // Derived via useMemo
// // //       fetchCart, 
// // //       addItem, 
// // //       updateItemQuantity, 
// // //       removeItem, 
// // //       clearClientCart, 
// // //       isUpdatingItemId,
// // //     }}>
// // //       {children}
// // //     </CartContext.Provider>
// // //   );
// // // };

// // // export const useCart = (): CartContextType => {
// // //   const context = useContext(CartContext);
// // //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// // //   return context;
// // // };
// // // // // src/contexts/CartContext.tsx
// // // // 'use client';

// // // // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // // // import {
// // // //     AnonymousCartApiResponse,
// // // //     AddToAnonymousCartRequest, // This structure can be used for both AddToUserCartRequestDto if payload is same
// // // //     AnonymousCartItem as AnonymousCartItemType, // Renaming for clarity within this file
// // // // } from '@/types/anonymous';
// // // // import {
// // // //     UserCartApiResponseDto,
// // // //     UserCartItemDto,
// // // //     // AddToUserCartRequestDto, // If different from AddToAnonymousCartRequest
// // // //     // UpdateUserCartItemQuantityRequestDto, // If different from UpdateAnonymousCartItemApiBody
// // // // } from '@/types/api';
// // // // import {
// // // //     getAnonymousCart, addToAnonymousCart, updateAnonymousCartItem, removeAnonymousCartItem, clearAnonymousCart,
// // // //     getUserCart, addItemToUserCart, updateUserCartItem, removeUserCartItem, clearUserCart,
// // // // } from '@/lib/apiClient';
// // // // import { useAnonymousSession } from '@/hooks/useAnonymousSession';
// // // // import { useSession } from 'next-auth/react';
// // // // import { DisplayableCartItem } from '@/types/cart';

// // // // // Common structure for items displayed in the UI, abstracting specific ID names
// // // // export interface DisplayCartItem {
// // // //   id: string; // Holds anonymousCartItemId OR userCartItemId
// // // //   itemType: 'anonymous' | 'user';
// // // //   // All other display properties from AnonymousCartItemType or UserCartItemDto
// // // //   shopId: string;
// // // //   shopServiceId: string;
// // // //   quantity: number;
// // // //   serviceNameEn: string;
// // // //   serviceNameAr: string;
// // // //   priceAtAddition: number;
// // // //   shopNameSnapshotEn?: string | null;
// // // //   shopNameSnapshotAr?: string | null;
// // // //   serviceImageUrlSnapshot?: string | null;
// // // //   addedAt: string; // From AnonymousCartItemType.addedAt or UserCartItemDto.addedAtUtc
// // // // }

// // // // // Payloads for context's update/remove methods
// // // // export interface UpdateCartItemContextPayload {
// // // //     itemId: string;
// // // //     itemType: 'anonymous' | 'user';
// // // //     newQuantity: number;
// // // // }
// // // // export interface RemoveCartItemContextPayload {
// // // //     itemId: string;
// // // //     itemType: 'anonymous' | 'user';
// // // // }

// // // // interface CartContextState {
// // // //   items: DisplayableCartItem[];
// // // //   isLoading: boolean;
// // // //   error: string | null;
// // // //   itemCount: number;
// // // //   totalAmount: number;
// // // //   lastUpdatedAt: string | null;
// // // //   // To know which cart type is active
// // // //   activeCartType: 'anonymous' | 'user' | 'none';
// // // // }

// // // // interface CartContextType extends CartContextState {
// // // //   fetchCart: (silent?: boolean) => Promise<void>;
// // // //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>; // Request type is same for adding
// // // //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// // // //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// // // //   clearClientCart: () => Promise<void>;
// // // //   isUpdatingItemId: string | null; // Stores the specific item's unique ID (id from DisplayCartItem)
// // // // }

// // // // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // // const initialCartContextState: CartContextState = {
// // // //     items: [],
// // // //     isLoading: true, // Start with loading true for initial fetch attempt
// // // //     error: null,
// // // //     itemCount: 0,
// // // //     totalAmount: 0,
// // // //     lastUpdatedAt: null,
// // // //     activeCartType: 'none',
// // // // };

// // // // export const CartProvider = ({ children }: { children: ReactNode }) => {
// // // //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();
// // // //   const { data: session, status: sessionStatus } = useSession();

// // // //   const [cartState, setCartState] = useState<CartContextState>(initialCartContextState);
// // // //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

// // // //   const transformApiResponseToDisplayableCart = (
// // // //     apiResponse: AnonymousCartApiResponse | UserCartApiResponseDto | null,
// // // //     type: 'anonymous' | 'user'
// // // //   ): DisplayableCartItem[] => {
// // // //     if (!apiResponse || !apiResponse.items) return [];
// // // //     return apiResponse.items.map((item: AnonymousCartItemType | UserCartItemDto) => ({
// // // //       ...(item as any), // Spread all properties
// // // //       id: type === 'anonymous' ? (item as AnonymousCartItemType).anonymousCartItemId : (item as UserCartItemDto).userCartItemId,
// // // //       itemType: type,
// // // //       addedAt: type === 'anonymous' ? (item as AnonymousCartItemType).addedAt : (item as UserCartItemDto).addedAtUtc, // Normalize date field if names differ
// // // //     }));
// // // //   };
  
// // // //   const updateStateFromApiResponse = (
// // // //       apiResponse: AnonymousCartApiResponse | UserCartApiResponseDto | null,
// // // //       type: 'anonymous' | 'user' | 'none'
// // // //     ) => {
// // // //       if (!apiResponse) {
// // // //         setCartState({...initialCartContextState, isLoading: false, activeCartType: type === 'none' ? 'none' : cartState.activeCartType });
// // // //         return;
// // // //       }
// // // //       setCartState({
// // // //         items: transformApiResponseToDisplayableCart(apiResponse, type as 'anonymous' | 'user'), // Type assertion
// // // //         isLoading: false, error: null,
// // // //         itemCount: apiResponse.totalItems,
// // // //         totalAmount: apiResponse.totalAmount,
// // // //         lastUpdatedAt: apiResponse.lastUpdatedAt,
// // // //         activeCartType: type,
// // // //       });
// // // //   };


// // // //   const handleApiError = useCallback((err: any, operation: string) => {
// // // //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// // // //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// // // //     setCartState(prev => ({ ...prev, error: message, isLoading: false }));
// // // //   }, []);

// // // //   const fetchCart = useCallback(async (silent: boolean = false) => {
// // // //     if (!silent) setCartState(prev => ({ ...prev, isLoading: true, error: null }));

// // // //     try {
// // // //       if (sessionStatus === 'authenticated') {
// // // //         const userCart = await getUserCart();
// // // //         updateStateFromApiResponse(userCart, 'user');
// // // //       } else if (sessionStatus === 'unauthenticated' && anonymousToken) {
// // // //         const anonCart = await getAnonymousCart();
// // // //         updateStateFromApiResponse(anonCart, 'anonymous');
// // // //       } else if (sessionStatus === 'loading' || isLoadingAnonSession) {
// // // //         if (!silent) setCartState(prev => ({ ...prev, isLoading: true }));
// // // //         return;
// // // //       } else { // No session, no anon token
// // // //         updateStateFromApiResponse(null, 'none');
// // // //       }
// // // //     } catch (err) {
// // // //       handleApiError(err, 'fetch cart');
// // // //       updateStateFromApiResponse(null, cartState.activeCartType === 'none' ? 'none' : cartState.activeCartType); // Preserve current cart type on error if possible
// // // //     }
// // // //   }, [anonymousToken, isLoadingAnonSession, sessionStatus, handleApiError, cartState.activeCartType]); // Added cartState.activeCartType

// // // //   useEffect(() => {
// // // //     if (sessionStatus !== 'loading' && !isLoadingAnonSession) {
// // // //       fetchCart(true); // Initial fetch can be silent if UI handles initial loading state
// // // //     }
// // // //   }, [sessionStatus, anonymousToken, isLoadingAnonSession, fetchCart]);

// // // //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "add item"); return; }
// // // //     const tempUpdatingId = `add-${itemRequest.shopServiceId}-${itemRequest.shopId}`; // Using composite for add
// // // //     setIsUpdatingItemId(tempUpdatingId); setError(null);
// // // //     try {
// // // //       if (sessionStatus === 'authenticated') {
// // // //         const updatedCart = await addItemToUserCart(itemRequest); // Assuming AddToUserCartRequestDto is compatible
// // // //         updateStateFromApiResponse(updatedCart, 'user');
// // // //       } else if (anonymousToken) {
// // // //         const updatedCart = await addToAnonymousCart(itemRequest);
// // // //         updateStateFromApiResponse(updatedCart, 'anonymous');
// // // //       } else { throw new Error("No active session to add item."); }
// // // //     } catch (err) { handleApiError(err, 'add item'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "update item"); return; }
// // // //     setIsUpdatingItemId(payload.itemId); setError(null);
// // // //     try {
// // // //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// // // //         const updatedCart = await updateUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // // //         updateStateFromApiResponse(updatedCart, 'user');
// // // //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// // // //         const updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // // //         updateStateFromApiResponse(updatedCart, 'anonymous');
// // // //       } else { throw new Error("Session/ItemType mismatch or no active session for update."); }
// // // //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "remove item"); return; }
// // // //     setIsUpdatingItemId(payload.itemId); setError(null);
// // // //     try {
// // // //       if (payload.itemType === 'user' && sessionStatus === 'authenticated') {
// // // //         const updatedCart = await removeUserCartItem(payload.itemId);
// // // //         updateStateFromApiResponse(updatedCart, 'user');
// // // //       } else if (payload.itemType === 'anonymous' && anonymousToken) {
// // // //         const updatedCart = await removeAnonymousCartItem(payload.itemId);
// // // //         updateStateFromApiResponse(updatedCart, 'anonymous');
// // // //       } else { throw new Error("Session/ItemType mismatch or no active session for remove."); }
// // // //     } catch (err) { handleApiError(err, 'remove item'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const clearClientCart = async () => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) { handleApiError(new Error("Session loading"), "clear cart"); return; }
// // // //     setCartState(prev => ({ ...prev, isLoading: true, error: null }));
// // // //     try {
// // // //       if (sessionStatus === 'authenticated') {
// // // //         await clearUserCart();
// // // //       } else if (anonymousToken) {
// // // //         await clearAnonymousCart();
// // // //       } else { throw new Error("No active session to clear cart."); }
// // // //       updateStateFromApiResponse(null, sessionStatus === 'authenticated' ? 'user' : (anonymousToken ? 'anonymous' : 'none'));
// // // //     } catch (err) { handleApiError(err, 'clear cart'); } 
// // // //     finally { setCartState(prev => ({ ...prev, isLoading: false}));}
// // // //   };

// // // //   return (
// // // //     <CartContext.Provider value={{
// // // //       ...cartState, // Spread all properties from cartState
// // // //       fetchCart, addItem, updateItemQuantity, removeItem, clearClientCart, isUpdatingItemId,
// // // //     }}>
// // // //       {children}
// // // //     </CartContext.Provider>
// // // //   );
// // // // };

// // // // export const useCart = (): CartContextType => {
// // // //   const context = useContext(CartContext);
// // // //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// // // //   return context;
// // // // };

// // // // function setError(arg0: null) {
// // // //     throw new Error('Function not implemented.');
// // // // }
// // // // // src/contexts/CartContext.tsx
// // // // 'use client';

// // // // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // // // import {
// // // //     AnonymousCartApiResponse,
// // // //     AnonymousCartItem, // This type represents the structure of a cart item
// // // //     AddToAnonymousCartRequest, // Used for both anon and user if payload is same
// // // //     // UpdateAnonymousCartItemApiBody, // Used by apiClient
// // // // } from '@/types/anonymous';
// // // // import {
// // // //     // Anonymous API functions
// // // //     getAnonymousCart,
// // // //     addToAnonymousCart,
// // // //     updateAnonymousCartItem,
// // // //     removeAnonymousCartItem,
// // // //     clearAnonymousCart,
// // // //     // Authenticated User API functions (ensure these are correctly named and imported)
// // // //     getUserCart as getAuthUserCart,
// // // //     addItemToUserCart as addAuthItemToUserCart,
// // // //     updateUserCartItem as updateAuthUserCartItem,
// // // //     removeUserCartItem as removeAuthUserCartItem,
// // // //     clearUserCart as clearAuthUserCart,
// // // // } from '@/lib/apiClient';
// // // // import { useAnonymousSession } from '@/hooks/useAnonymousSession';
// // // // import { useSession } from 'next-auth/react'; // Import NextAuth useSession
// // // // import { UserCartItemDto } from '@/types/api';

// // // // // Union type for items that can be in the cart display
// // // // export type DisplayCartItem = (AnonymousCartItem & { type: 'anonymous' }) | (UserCartItemDto & { type: 'user' });

// // // // // Context payload types (now use generic 'itemId' which will be anonymousCartItemId or userCartItemId)
// // // // export interface UpdateCartItemContextPayload {
// // // //     itemId: string; // Will be anonymousCartItemId or userCartItemId
// // // //     itemType: 'anonymous' | 'user';
// // // //     newQuantity: number;
// // // //     // Add shopId, shopServiceId if needed for optimistic updates before API responds
// // // //     // For now, relying on itemId being sufficient for API call
// // // // }
// // // // export interface RemoveCartItemContextPayload {
// // // //     itemId: string; // Will be anonymousCartItemId or userCartItemId
    
// // // // }

// // // // // Unified Cart State - Can hold data from either anonymous or user cart API response
// // // // // Assuming AnonymousCartApiResponse and UserCartApiResponseDto have compatible 'items' structure
// // // // interface CartState {
// // // //   cart: AnonymousCartApiResponse | null; // The structure is similar enough for now
// // // //   isLoading: boolean;
// // // //   error: string | null;
// // // //   itemCount: number;
// // // //   totalAmount: number;
// // // // }

// // // // interface CartContextType extends CartState {
// // // //   fetchCart: (silent?: boolean) => Promise<void>;
// // // //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>; // AddToUserCartRequestDto might be same
// // // //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// // // //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// // // //   clearClientCart: () => Promise<void>;
// // // //   isUpdatingItemId: string | null; // Stores itemId (anonymousCartItemId or userCartItemId)
// // // // }

// // // // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // // interface CartProviderProps {
// // // //   children: ReactNode;
// // // // }

// // // // export const CartProvider = ({ children }: CartProviderProps) => {
// // // //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();
// // // //   const { data: session, status: sessionStatus } = useSession(); // Get NextAuth session

// // // //   const [cart, setCart] = useState<AnonymousCartApiResponse | null>(null);
// // // //   const [isLoading, setIsLoading] = useState<boolean>(true);
// // // //   const [error, setError] = useState<string | null>(null);
// // // //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

// // // //   const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0, [cart]);
// // // //   const totalAmount = useMemo(() => cart?.totalAmount || 0, [cart]); // Assuming API provides this

// // // //   const handleApiError = useCallback((err: any, operation: string) => {
// // // //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// // // //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// // // //     setError(message);
// // // //     // Consider not clearing cart on all errors, maybe only on fetch errors if data becomes invalid
// // // //   }, []);

// // // //   const fetchCart = useCallback(async (silent: boolean = false) => {
// // // //     if (!silent) setIsLoading(true);
// // // //     setError(null);

// // // //     try {
// // // //       let fetchedCart: AnonymousCartApiResponse | null = null;
// // // //       if (sessionStatus === 'authenticated') {
// // // //         // console.log("CartContext: User authenticated, fetching user cart.");
// // // //         fetchedCart = await getAuthUserCart();
// // // //       } else if (sessionStatus === 'unauthenticated' && anonymousToken) {
// // // //         // console.log("CartContext: User anonymous, fetching anonymous cart.");
// // // //         fetchedCart = await getAnonymousCart();
// // // //       } else if (sessionStatus === 'loading' || isLoadingAnonSession) {
// // // //         // console.log("CartContext: Session or anonymous token still loading, delaying cart fetch.");
// // // //         if (!silent) setIsLoading(true); // Keep loading true if sessions are not settled
// // // //         return; // Don't fetch yet
// // // //       }
// // // //       setCart(fetchedCart);
// // // //     } catch (err) {
// // // //       handleApiError(err, 'fetch cart');
// // // //       setCart(null); // Clear cart on error
// // // //     } finally {
// // // //       if (!silent) setIsLoading(false);
// // // //     }
// // // //   }, [anonymousToken, isLoadingAnonSession, sessionStatus, handleApiError]);

// // // //   // Effect to fetch cart based on session status or anonymous token changes
// // // //   useEffect(() => {
// // // //     // Only fetch if session status is not loading AND anonymous session loading is also done
// // // //     if (sessionStatus !== 'loading' && !isLoadingAnonSession) {
// // // //       fetchCart();
// // // //     }
// // // //   }, [sessionStatus, anonymousToken, isLoadingAnonSession, fetchCart]);


// // // //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) {setError("Session loading, please wait."); return;}
    
// // // //     const tempUpdatingId = `${itemRequest.shopId}-${itemRequest.shopServiceId}`; // For UI feedback
// // // //     setIsUpdatingItemId(tempUpdatingId);
// // // //     setError(null);
// // // //     try {
// // // //       let updatedCart;
// // // //       if (sessionStatus === 'authenticated') {
// // // //         updatedCart = await addAuthItemToUserCart(itemRequest);
// // // //       } else if (anonymousToken) {
// // // //         updatedCart = await addToAnonymousCart(itemRequest);
// // // //       } else {
// // // //         setError("Cannot add item: No active session."); return;
// // // //       }
// // // //       setCart(updatedCart);
// // // //     } catch (err) { handleApiError(err, 'add item'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) {setError("Session loading, please wait."); return;}
// // // //     setIsUpdatingItemId(payload.itemId);
// // // //     setError(null);
// // // //     try {
// // // //       let updatedCart;
// // // //       if (sessionStatus === 'authenticated') {
// // // //         updatedCart = await updateAuthUserCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // // //       } else if (anonymousToken) {
// // // //         updatedCart = await updateAnonymousCartItem(payload.itemId, { newQuantity: payload.newQuantity });
// // // //       } else {
// // // //         setError("Cannot update item: No active session."); return;
// // // //       }
// // // //       setCart(updatedCart);
// // // //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) {setError("Session loading, please wait."); return;}
// // // //     setIsUpdatingItemId(payload.itemId);
// // // //     setError(null);
// // // //     try {
// // // //       let updatedCart;
// // // //       if (sessionStatus === 'authenticated') {
// // // //         updatedCart = await removeAuthUserCartItem(payload.itemId);
// // // //       } else if (anonymousToken) {
// // // //         updatedCart = await removeAnonymousCartItem(payload.itemId);
// // // //       } else {
// // // //         setError("Cannot remove item: No active session."); return;
// // // //       }
// // // //       setCart(updatedCart);
// // // //     } catch (err) { handleApiError(err, 'remove item'); } 
// // // //     finally { setIsUpdatingItemId(null); }
// // // //   };

// // // //   const clearClientCart = async () => {
// // // //     if (sessionStatus === 'loading' || isLoadingAnonSession) {setError("Session loading, please wait."); return;}
// // // //     setIsLoading(true); 
// // // //     setError(null);
// // // //     try {
// // // //       if (sessionStatus === 'authenticated') {
// // // //         await clearAuthUserCart();
// // // //       } else if (anonymousToken) {
// // // //         await clearAnonymousCart();
// // // //       } else {
// // // //         setError("Cannot clear cart: No active session."); 
// // // //         setIsLoading(false); 
// // // //         return;
// // // //       }
// // // //       setCart(null); 
// // // //     } catch (err) { handleApiError(err, 'clear cart'); } 
// // // //     finally { setIsLoading(false); }
// // // //   };

// // // //   return (
// // // //     <CartContext.Provider value={{
// // // //       cart, isLoading, error, itemCount, totalAmount,
// // // //       fetchCart, addItem, updateItemQuantity, removeItem, clearClientCart, isUpdatingItemId,
// // // //     }}>
// // // //       {children}
// // // //     </CartContext.Provider>
// // // //   );
// // // // };

// // // // export const useCart = (): CartContextType => {
// // // //   const context = useContext(CartContext);
// // // //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// // // //   return context;
// // // // };
// // // // // // src/contexts/CartContext.tsx
// // // // // 'use client';

// // // // // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // // // // import {
// // // // //     AnonymousCartApiResponse,
// // // // //     AddToAnonymousCartRequest,
// // // // //     // UpdateAnonymousCartItemApiBody will be used by apiClient
// // // // // } from '@/types/anonymous';
// // // // // import {
// // // // //     getAnonymousCart,
// // // // //     addToAnonymousCart,
// // // // //     updateAnonymousCartItem, // Correctly imported from apiClient
// // // // //     removeAnonymousCartItem, // Correctly imported from apiClient
// // // // //     clearAnonymousCart
// // // // // } from '@/lib/apiClient';
// // // // // import { useAnonymousSession } from '@/hooks/useAnonymousSession';

// // // // // // Payloads for context methods, these take the item's unique ID
// // // // // export interface UpdateCartItemContextPayload {
// // // // //     anonymousCartItemId: string;
// // // // //     newQuantity: number;
// // // // // }
// // // // // export interface RemoveCartItemContextPayload {
// // // // //     anonymousCartItemId: string;
// // // // // }

// // // // // interface CartState {
// // // // //   cart: AnonymousCartApiResponse | null;
// // // // //   isLoading: boolean;
// // // // //   error: string | null;
// // // // //   itemCount: number;
// // // // //   totalAmount: number;
// // // // // }

// // // // // interface CartContextType extends CartState {
// // // // //   fetchCart: (silent?: boolean) => Promise<void>;
// // // // //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>;
// // // // //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// // // // //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// // // // //   clearClientCart: () => Promise<void>;
// // // // //   isUpdatingItemId: string | null; // Stores anonymousCartItemId of the item being modified
// // // // // }

// // // // // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // // // interface CartProviderProps {
// // // // //   children: ReactNode;
// // // // // }

// // // // // export const CartProvider = ({ children }: CartProviderProps) => {
// // // // //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();

// // // // //   const [cart, setCart] = useState<AnonymousCartApiResponse | null>(null);
// // // // //   const [isLoading, setIsLoading] = useState<boolean>(true); // Initial cart load
// // // // //   const [error, setError] = useState<string | null>(null);
// // // // //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null); // Stores anonymousCartItemId

// // // // //   const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0, [cart]);
// // // // //   const totalAmount = useMemo(() => cart?.totalAmount || 0, [cart]);

// // // // //   const handleApiError = useCallback((err: any, operation: string) => {
// // // // //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// // // // //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// // // // //     setError(message);
// // // // //   }, []);

// // // // //   const fetchCart = useCallback(async (silent: boolean = false) => {
// // // // //     if (isLoadingAnonSession) {
// // // // //         if (!silent) setIsLoading(true);
// // // // //         return;
// // // // //     }
// // // // //     if (!anonymousToken) {
// // // // //       if (!silent) setIsLoading(false);
// // // // //       setCart(null);
// // // // //       return;
// // // // //     }

// // // // //     if (!silent) setIsLoading(true);
// // // // //     setError(null);
// // // // //     try {
// // // // //       const fetchedCart = await getAnonymousCart();
// // // // //       setCart(fetchedCart);
// // // // //     } catch (err) {
// // // // //       handleApiError(err, 'fetch cart');
// // // // //       setCart(null);
// // // // //     } finally {
// // // // //       if (!silent) setIsLoading(false);
// // // // //     }
// // // // //   }, [anonymousToken, isLoadingAnonSession, handleApiError]);

// // // // //   useEffect(() => {
// // // // //     if (!isLoadingAnonSession) {
// // // // //         if (anonymousToken) {
// // // // //             fetchCart();
// // // // //         } else {
// // // // //             setCart(null);
// // // // //             setIsLoading(false);
// // // // //         }
// // // // //     }
// // // // //   }, [anonymousToken, isLoadingAnonSession, fetchCart]);

// // // // //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// // // // //     if (!anonymousToken) { setError("Cannot add item: No anonymous session."); return; }
    
// // // // //     // For addItem, a temporary ID for UI feedback might be composite,
// // // // //     // as we don't know the anonymousCartItemId until the API responds.
// // // // //     // Or, we can disable the button and show a general cart loading state.
// // // // //     // For now, let's assume the global isLoading might cover this, or set a generic string.
// // // // //     setIsUpdatingItemId(`add-${itemRequest.shopServiceId}-${itemRequest.shopId}`); 
// // // // //     setError(null);
// // // // //     try {
// // // // //       const updatedCart = await addToAnonymousCart(itemRequest);
// // // // //       setCart(updatedCart);
// // // // //     } catch (err) { handleApiError(err, 'add item'); } 
// // // // //     finally { setIsUpdatingItemId(null); }
// // // // //   };

// // // // //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// // // // //     if (!anonymousToken) { setError("Cannot update item: No anonymous session."); return; }
// // // // //     setIsUpdatingItemId(payload.anonymousCartItemId);
// // // // //     setError(null);
// // // // //     try {
// // // // //       const updatedCart = await updateAnonymousCartItem(
// // // // //         payload.anonymousCartItemId,
// // // // //         { newQuantity: payload.newQuantity } // This is UpdateAnonymousCartItemApiBody
// // // // //       );
// // // // //       setCart(updatedCart);
// // // // //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// // // // //     finally { setIsUpdatingItemId(null); }
// // // // //   };

// // // // //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// // // // //     if (!anonymousToken) { setError("Cannot remove item: No anonymous session."); return; }
// // // // //     setIsUpdatingItemId(payload.anonymousCartItemId);
// // // // //     setError(null);
// // // // //     try {
// // // // //       const updatedCart = await removeAnonymousCartItem(payload.anonymousCartItemId);
// // // // //       setCart(updatedCart);
// // // // //     } catch (err) { handleApiError(err, 'remove item'); } 
// // // // //     finally { setIsUpdatingItemId(null); }
// // // // //   };

// // // // //   const clearClientCart = async () => {
// // // // //     if (!anonymousToken) { setError("Cannot clear cart: No anonymous session."); return; }
// // // // //     setIsLoading(true); 
// // // // //     setError(null);
// // // // //     try {
// // // // //       await clearAnonymousCart(); 
// // // // //       setCart(null); 
// // // // //     } catch (err) { handleApiError(err, 'clear cart'); } 
// // // // //     finally { setIsLoading(false); }
// // // // //   };

// // // // //   return (
// // // // //     <CartContext.Provider value={{
// // // // //       cart, isLoading, error, itemCount, totalAmount,
// // // // //       fetchCart, addItem, updateItemQuantity, removeItem, clearClientCart, isUpdatingItemId,
// // // // //     }}>
// // // // //       {children}
// // // // //     </CartContext.Provider>
// // // // //   );
// // // // // };

// // // // // export const useCart = (): CartContextType => {
// // // // //   const context = useContext(CartContext);
// // // // //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// // // // //   return context;
// // // // // };
// // // // // // // src/contexts/CartContext.tsx
// // // // // // 'use client';

// // // // // // import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
// // // // // // import {
// // // // // //     AnonymousCartApiResponse,
// // // // // //     // AnonymousCartItem, // Not directly used for state type here, API response is source of truth
// // // // // //     AddToAnonymousCartRequest,
// // // // // //     // UpdateAnonymousCartItemRequest is defined in types/anonymous and used by apiClient
// // // // // // } from '@/types/anonymous';
// // // // // // import {
// // // // // //     getAnonymousCart,
// // // // // //     addToAnonymousCart,
// // // // // //     updateAnonymousCartItem, // Direct import from apiClient
// // // // // //     removeAnonymousCartItem, // Direct import from apiClient
// // // // // //     clearAnonymousCart
// // // // // // } from '@/lib/apiClient';
// // // // // // import { useAnonymousSession } from '@/hooks/useAnonymousSession';

// // // // // // // --- Types for Cart Context ---
// // // // // // export interface UpdateCartItemContextPayload { // What the context's update function expects
// // // // // //     anonymousCartItemId: string;
// // // // // //     newQuantity: number;
// // // // // // }
// // // // // // export interface RemoveCartItemContextPayload { // What the context's remove function expects
// // // // // //     anonymousCartItemId: string;
// // // // // // }

// // // // // // interface CartState {
// // // // // //   cart: AnonymousCartApiResponse | null;
// // // // // //   isLoading: boolean; // Global loading for fetch/clear
// // // // // //   error: string | null;
// // // // // //   itemCount: number;
// // // // // //   totalAmount: number;
// // // // // // }

// // // // // // interface CartContextType extends CartState {
// // // // // //   fetchCart: (silent?: boolean) => Promise<void>;
// // // // // //   addItem: (item: AddToAnonymousCartRequest) => Promise<void>;
// // // // // //   updateItemQuantity: (payload: UpdateCartItemContextPayload) => Promise<void>;
// // // // // //   removeItem: (payload: RemoveCartItemContextPayload) => Promise<void>;
// // // // // //   clearClientCart: () => Promise<void>;
// // // // // //   isUpdatingItemId: string | null; // Stores anonymousCartItemId of item being modified
// // // // // // }

// // // // // // const CartContext = createContext<CartContextType | undefined>(undefined);

// // // // // // interface CartProviderProps {
// // // // // //   children: ReactNode;
// // // // // // }

// // // // // // export const CartProvider = ({ children }: CartProviderProps) => {
// // // // // //   const { anonymousToken, isLoading: isLoadingAnonSession } = useAnonymousSession();

// // // // // //   const [cart, setCart] = useState<AnonymousCartApiResponse | null>(null);
// // // // // //   const [isLoading, setIsLoading] = useState<boolean>(true);
// // // // // //   const [error, setError] = useState<string | null>(null);
// // // // // //   const [isUpdatingItemId, setIsUpdatingItemId] = useState<string | null>(null);

// // // // // //   const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0, [cart]);
// // // // // //   const totalAmount = useMemo(() => cart?.totalAmount || 0, [cart]);

// // // // // //   const handleApiError = (err: any, operation: string) => {
// // // // // //     console.error(`CartContext: Operation (${operation}) failed:`, err);
// // // // // //     const message = err instanceof Error ? err.message : `Failed to ${operation} cart.`;
// // // // // //     setError(message);
// // // // // //     // Consider if UI should show previous cart state or clear it on error
// // // // // //   };

// // // // // //   const fetchCart = useCallback(async (silent: boolean = false) => {
// // // // // //     if (isLoadingAnonSession) { // Still waiting for anonymous session to initialize
// // // // // //         if (!silent) setIsLoading(true); // Reflect that we are effectively loading
// // // // // //         return;
// // // // // //     }
// // // // // //     if (!anonymousToken) { // No anonymous session, so no cart to fetch
// // // // // //       if (!silent) setIsLoading(false);
// // // // // //       setCart(null);
// // // // // //       return;
// // // // // //     }

// // // // // //     if (!silent) setIsLoading(true);
// // // // // //     setError(null);
// // // // // //     try {
// // // // // //       const fetchedCart = await getAnonymousCart();
// // // // // //       setCart(fetchedCart);
// // // // // //     } catch (err) {
// // // // // //       handleApiError(err, 'fetch cart');
// // // // // //       setCart(null); // Clear cart on fetch error to avoid stale data
// // // // // //     } finally {
// // // // // //       if (!silent) setIsLoading(false);
// // // // // //     }
// // // // // //   }, [anonymousToken, isLoadingAnonSession]);

// // // // // //   useEffect(() => {
// // // // // //     // Fetch cart when anonymousToken becomes available (after initial session loading)
// // // // // //     // or when anonymousToken changes (e.g., new session after old one expired)
// // // // // //     if (!isLoadingAnonSession) { // Only proceed if anonymous session loading is complete
// // // // // //         if (anonymousToken) {
// // // // // //             // console.log("CartContext: Anonymous session ready, fetching cart.");
// // // // // //             fetchCart();
// // // // // //         } else {
// // // // // //             // console.log("CartContext: No anonymous session, clearing local cart state.");
// // // // // //             setCart(null);
// // // // // //             setIsLoading(false); // No cart to load
// // // // // //         }
// // // // // //     }
// // // // // //   }, [anonymousToken, isLoadingAnonSession, fetchCart]);


// // // // // //   const addItem = async (itemRequest: AddToAnonymousCartRequest) => {
// // // // // //     if (!anonymousToken) { setError("Cannot add item: No anonymous session."); return; }
    
// // // // // //     // For addItem, the temporary updating ID might be based on shopId+serviceId
// // // // // //     // as anonymousCartItemId doesn't exist until after it's added.
// // // // // //     const tempUpdatingId = `${itemRequest.shopId}-${itemRequest.shopServiceId}`;
// // // // // //     setIsUpdatingItemId(tempUpdatingId);
// // // // // //     setError(null);
// // // // // //     try {
// // // // // //       const updatedCart = await addToAnonymousCart(itemRequest);
// // // // // //       setCart(updatedCart);
// // // // // //     } catch (err) { handleApiError(err, 'add item'); } 
// // // // // //     finally { setIsUpdatingItemId(null); } // Clear general or specific ID
// // // // // //   };

// // // // // //   const updateItemQuantity = async (payload: UpdateCartItemContextPayload) => {
// // // // // //     if (!anonymousToken) { setError("Cannot update item: No anonymous session."); return; }
// // // // // //     setIsUpdatingItemId(payload.anonymousCartItemId);
// // // // // //     setError(null);
// // // // // //     try {
// // // // // //       // `updateAnonymousCartItem` from apiClient takes (itemId, { newQuantity })
// // // // // //       const updatedCart = await updateAnonymousCartItem(
// // // // // //         payload.anonymousCartItemId,
// // // // // //         { newQuantity: payload.newQuantity } // This matches UpdateCartItemQuantityRequestDto from API DTOs
// // // // // //                                               // and the body expected by the API endpoint
// // // // // //       );
// // // // // //       setCart(updatedCart);
// // // // // //     } catch (err) { handleApiError(err, 'update item quantity'); } 
// // // // // //     finally { setIsUpdatingItemId(null); }
// // // // // //   };

// // // // // //   const removeItem = async (payload: RemoveCartItemContextPayload) => {
// // // // // //     if (!anonymousToken) { setError("Cannot remove item: No anonymous session."); return; }
// // // // // //     setIsUpdatingItemId(payload.anonymousCartItemId);
// // // // // //     setError(null);
// // // // // //     try {
// // // // // //       // `removeAnonymousCartItem` from apiClient takes (itemId)
// // // // // //       const updatedCart = await removeAnonymousCartItem(payload.anonymousCartItemId);
// // // // // //       setCart(updatedCart);
// // // // // //     } catch (err) { handleApiError(err, 'remove item'); } 
// // // // // //     finally { setIsUpdatingItemId(null); }
// // // // // //   };

// // // // // //   const clearClientCart = async () => {
// // // // // //     if (!anonymousToken) { setError("Cannot clear cart: No anonymous session."); return; }
// // // // // //     setIsLoading(true); 
// // // // // //     setError(null);
// // // // // //     try {
// // // // // //       await clearAnonymousCart(); 
// // // // // //       setCart(null); 
// // // // // //     } catch (err) { handleApiError(err, 'clear cart'); } 
// // // // // //     finally { setIsLoading(false); }
// // // // // //   };

// // // // // //   return (
// // // // // //     <CartContext.Provider value={{
// // // // // //       cart, isLoading, error, itemCount, totalAmount,
// // // // // //       fetchCart, addItem, updateItemQuantity, removeItem, clearClientCart, isUpdatingItemId,
// // // // // //     }}>
// // // // // //       {children}
// // // // // //     </CartContext.Provider>
// // // // // //   );
// // // // // // };

// // // // // // export const useCart = (): CartContextType => {
// // // // // //   const context = useContext(CartContext);
// // // // // //   if (context === undefined) throw new Error('useCart must be used within a CartProvider');
// // // // // //   return context;
// // // // // // };