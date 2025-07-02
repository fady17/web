// src/types/anonymous.ts

export interface DecodedAnonymousSessionToken {
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  sub_type: "anonymous_session";
  anon_id: string;
}

export interface AnonymousCartItem {
  anonymousCartItemId: string; // PK for AnonymousCartItem entity
  shopId: string;
  shopServiceId: string;
  quantity: number;
  serviceNameEn: string;
  serviceNameAr: string;
  priceAtAddition: number;
  currencyCode?: string;
  shopNameSnapshotEn?: string | null;
  shopNameSnapshotAr?: string | null;
  serviceImageUrlSnapshot?: string | null;
  addedAt: string; // From API's AddedAtUtc
  // If API DTO for AnonymousCartItemDto includes updatedAtUtc, add it here too
  // updatedAt?: string; 
}

export interface AddToAnonymousCartRequest {
  shopId: string;
  shopServiceId: string;
  quantity: number;
}

export interface UpdateAnonymousCartItemApiBody { // For PUT request body to API
  newQuantity: number;
}

export interface AnonymousCartApiResponse {
  anonymousUserId: string;
  items: AnonymousCartItem[]; // This uses the frontend AnonymousCartItem type
  totalItems: number;
  totalAmount: number;
  currencyCode?: string;
  lastUpdatedAt: string;
}

export interface AnonymousUserPreferenceDto {
  lastKnownLatitude?: number | null;
  lastKnownLongitude?: number | null;
  lastKnownLocationAccuracy?: number | null;
  locationSource?: string | null;
  lastSetAtUtc: string;
}

export interface UpdateAnonymousLocationRequestDto {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  source: string;
}

export interface MergeAnonymousDataRequest {
  anonymousSessionToken: string;
}

export interface MergeAnonymousDataResponse {
  success: boolean;
  message: string;
  details?: {
    cartItemsMerged: number;
    cartItemsSkippedOrConflicted?: number;
    preferencesMerged: boolean;
  };
}

export const ANONYMOUS_API_PATHS = {
    SESSIONS_CREATE: '/api/anonymous/sessions',
    CART: '/api/anonymous/cart',
    CART_ITEMS: '/api/anonymous/cart/items',
    CART_ITEM_BY_ID: (anonymousCartItemId: string) => `/api/anonymous/cart/items/${anonymousCartItemId}`,
    PREFERENCES_LOCATION: '/api/anonymous/preferences/location',
    USER_MERGE_ANONYMOUS_DATA: '/api/users/me/merge-anonymous-data'
} as const;

export const ANONYMOUS_SESSION_TOKEN_HEADER = 'X-Anonymous-Token';
// // src/types/anonymous.ts

// // --- Client-Side Anonymous Session Management ---

// /**
//  * Represents the payload of the decoded anonymous session JWT.
//  */
// export interface DecodedAnonymousSessionToken {
//   jti: string;
//   iat: number;
//   exp: number;
//   iss: string;
//   aud: string;
//   sub_type: "anonymous_session";
//   anon_id: string; // The persistent anonymous UUID for this session
// }


// // --- Anonymous Cart ---

// export interface AnonymousCartItem {
//   anonymousCartItemId: string;
//   shopId: string;
//   shopServiceId: string;
//   quantity: number;
//   serviceNameEn: string;
//   serviceNameAr: string;
//   priceAtAddition: number;
//   currencyCode?: string;
//   shopNameSnapshotEn?: string | null;
//   shopNameSnapshotAr?: string | null;
//   serviceImageUrlSnapshot?: string | null;
//   addedAt: string; // ISO string
// }

// export interface AddToAnonymousCartRequest {
//   shopId: string;
//   shopServiceId: string;
//   quantity: number;
// }

// export interface UpdateAnonymousCartItemApiBody {
//   newQuantity: number;
// }

// export interface AnonymousCartApiResponse {
//   anonymousUserId: string;
//   items: AnonymousCartItem[];
//   totalItems: number;
//   totalAmount: number;
//   currencyCode?: string;
//   lastUpdatedAt: string;
// }


// // --- Anonymous User Preferences (Focused on Location for now) ---

// /**
//  * DTO for returning an anonymous user's preferences (primarily location) from the API.
//  */
// export interface AnonymousUserPreferenceDto {
//   // anonymousUserId: string; // Usually not needed in response body as it's implicit
//   lastKnownLatitude?: number | null;
//   lastKnownLongitude?: number | null;
//   lastKnownLocationAccuracy?: number | null; // In meters
//   locationSource?: string | null; // e.g., "gps", "ip_geoloc", "manual_city"
//   lastSetAtUtc: string; // ISO string for when these preferences were last set/updated

//   // Future: otherPreferences?: Record<string, any>; // For generic JSON preferences
// }

// /**
//  * DTO for the client to send updated location preferences for an anonymous user.
//  */
// export interface UpdateAnonymousLocationRequestDto {
//   latitude: number;
//   longitude: number;
//   accuracy?: number | null; // Optional accuracy in meters
//   source: string; // e.g., "gps", "ip_geoloc"
// }

// // Placeholder for a more general preferences update DTO if needed later
// // export interface UpdateAnonymousPreferencesRequest {
// //   location?: UpdateAnonymousLocationRequestDto;
// //   favoriteShopIds?: string[];
// //   preferredCategories?: string[];
// // }


// // --- Anonymous Data Merge (When user authenticates) ---

// export interface MergeAnonymousDataRequest {
//   anonymousSessionToken: string;
// }

// export interface MergeAnonymousDataResponse {
//   success: boolean;
//   message: string;
//   details?: {
//     cartItemsMerged: number;
//     cartItemsSkippedOrConflicted?: number;
//     preferencesMerged: boolean; // Indicate if preferences were also merged
//   };
// }


// // --- API Paths and Headers Constants ---

// export const ANONYMOUS_API_PATHS = {
//     SESSIONS_CREATE: '/api/anonymous/sessions',
//     CART: '/api/anonymous/cart',
//     CART_ITEMS: '/api/anonymous/cart/items',
//     CART_ITEM_BY_ID: (anonymousCartItemId: string) => `/api/anonymous/cart/items/${anonymousCartItemId}`,
//     PREFERENCES_LOCATION: '/api/anonymous/preferences/location', // This is the correct constant
//     USER_MERGE_ANONYMOUS_DATA: '/api/users/me/merge-anonymous-data'
// } as const;

// export const ANONYMOUS_SESSION_TOKEN_HEADER = 'X-Anonymous-Token';
// // // src/types/anonymous.ts

// // // --- Client-Side Anonymous Session Management ---

// // /**
// //  * Represents the payload of the decoded anonymous session JWT.
// //  * The client might decode this for quick access to anon_id or client-side expiry checks.
// //  * The API will always validate the signature and claims authoritatively.
// //  */
// // export interface DecodedAnonymousSessionToken {
// //   jti: string;         // JWT ID
// //   iat: number;         // Issued At (Unix timestamp)
// //   exp: number;         // Expiration Time (Unix timestamp)
// //   iss: string;         // Issuer (e.g., your API's URL)
// //   aud: string;         // Audience (e.g., "urn:automotiveservices:anonymous_session")
// //   sub_type: "anonymous_session"; // Custom claim identifying token type
// //   anon_id: string;     // The persistent anonymous UUID for this session
// // }


// // // --- Anonymous Cart (Reflecting Production-Grade Item Details) ---

// // /**
// //  * Represents an item in an anonymous user's cart on the client-side.
// //  * This structure aims for rich display and accurate merging later.
// //  */
// // export interface AnonymousCartItem {
// //   // Client-side temporary ID for list keys, if needed, or use shopServiceId if unique enough in cart
// //   // tempId?: string; 
// //   anonymousCartItemId: string;
  
// //   shopId: string;           // Guid: ID of the shop offering the service
// //   shopServiceId: string;    // Guid: Unique ID of the ShopService entity
  
// //   quantity: number;         // How many of this service (usually 1 for services)
  
// //   // Snapshotted details at the time of adding to cart
// //   // These are crucial for display and if prices/names change before checkout/merge
// //   serviceNameEn: string;
// //   serviceNameAr: string;
// //   priceAtAddition: number; // Store as number (e.g., 150.00 for EGP 150.00)
// //   currencyCode?: string;    // e.g., "EGP" - good practice if multi-currency ever becomes a thing
// //    // --- ADD THESE SNAPSHOTTED FIELDS ---
// //   shopNameSnapshotEn?: string | null; // Make nullable to match C# entity
// //   shopNameSnapshotAr?: string | null; // Make nullable
// //   serviceImageUrlSnapshot?: string | null; // Make nullable
// //   // --- END ADDED SNAPSHOTTED FIELDS ---

// // //   shopNameEn?: string;      // Denormalized for easier cart display
// // //   shopNameAr?: string;
// // //   serviceImageUrl?: string; // URL for a representative image

// //   addedAt: string;          // ISO string timestamp
// // }

// // /**
// //  * Request body for adding an item to the anonymous cart.
// //  */
// // export interface AddToAnonymousCartRequest {
// //   shopId: string;
// //   shopServiceId: string; // Client sends the ID of the priced service from the shop
// //   quantity: number;
// // }

// // /**
// //  * Request body for updating an item's quantity in the anonymous cart.
// //  * Item identified by shopId and shopServiceId.
// //  */
// // // export interface UpdateAnonymousCartItemRequest {
// // //   shopId: string;
// // //   shopServiceId: string;
// // //   newQuantity: number; // Can be 0 to remove, or API handles separate remove
// // // }
// // /**
// //  * Request body for updating an item's quantity in the anonymous cart.
// //  * The item is identified by 'anonymousCartItemId' in the URL path.
// //  */
// // export interface UpdateAnonymousCartItemApiBody { // Renamed for clarity
// //   newQuantity: number;
// // }
// // /**
// //  * API response for anonymous cart operations (GET, POST, PUT, DELETE item).
// //  */
// // export interface AnonymousCartApiResponse {
// //   anonymousUserId: string; // The anon_id from the validated anonymous session token
// //   items: AnonymousCartItem[];
// //   totalItems: number;
// //   totalAmount: number; // Calculated by the API based on priceAtAddition
// //   currencyCode?: string;
// //   lastUpdatedAt: string; // ISO string
// // }


// // // --- Anonymous Preferences (Placeholder for Future) ---

// // export interface AnonymousUserPreferences {
// //   favoriteShopIds?: string[];
// //   preferredCategories?: string[]; // Slugs or enums
// //   // ... other preference fields ...
// //   lastUpdatedAt?: string; // ISO string
// // }

// // export interface UpdateAnonymousPreferencesRequest {
// //   favoriteShopIds?: string[];
// //   preferredCategories?: string[];
// // }


// // // --- Anonymous Data Merge (When user authenticates) ---

// // /**
// //  * Request body for the authenticated endpoint to merge anonymous data.
// //  */
// // export interface MergeAnonymousDataRequest {
// //   // Client sends the *raw anonymous session token* it was using.
// //   // The API will validate this token, extract anon_id, and perform the merge.
// //   // This is more secure than client sending just the anon_id.
// //   anonymousSessionToken: string; 
// // }

// // export interface MergeAnonymousDataResponse {
// //   success: boolean;
// //   message: string;
// //   details?: {
// //     cartItemsMerged: number;
// //     cartItemsSkippedOrConflicted?: number; // If there were conflicts
// //     preferencesMerged: boolean;
// //     // Potentially list conflicts if complex merge logic is implemented
// //     // conflicts?: Array<{ type: 'cart_item', originalItemId: string, issue: string }>;
// //   };
// // }


// // // --- API Paths and Headers Constants ---

// // export const ANONYMOUS_API_PATHS = {
// //     SESSIONS_CREATE: '/api/anonymous/sessions',
// //     CART: '/api/anonymous/cart',
// //     CART_ITEMS: '/api/anonymous/cart/items', // POST to add an item
// //     // --- CORRECTED PATH BUILDER ---
// //     CART_ITEM_BY_ID: (anonymousCartItemId: string) => `/api/anonymous/cart/items/${anonymousCartItemId}`, // PUT or DELETE by item's own ID
// //     PREFERENCES: '/api/anonymous/preferences',
// //     USER_MERGE_ANONYMOUS_DATA: '/api/users/me/merge-anonymous-data'
// // } as const;


// // /**
// //  * Header name used by the client to send the signed anonymous session JWT to the API.
// //  */
// // export const ANONYMOUS_SESSION_TOKEN_HEADER = 'X-Anonymous-Token';