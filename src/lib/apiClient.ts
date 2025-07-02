// src/lib/apiClient.ts
import {
    PaginatedResponse, ShopDto, FrontendShopQueryParameters, CityDto, SubCategoryDto,
    HighLevelConceptQueryParam, APIError, ShopServiceDto,
    UserCartApiResponseDto, AddToUserCartRequestDto, UpdateUserCartItemQuantityRequestDto,
    OperationalAreaDto // <<< NEW IMPORT
} from '@/types/api'; 
import {
    AnonymousCartApiResponse, AddToAnonymousCartRequest, UpdateAnonymousCartItemApiBody,
    AnonymousUserPreferenceDto, UpdateAnonymousLocationRequestDto,
    ANONYMOUS_API_PATHS as ANON_PATHS, 
    ANONYMOUS_SESSION_TOKEN_HEADER,
    MergeAnonymousDataRequest, MergeAnonymousDataResponse
} from '@/types/anonymous'; 
import { anonymousUserManager } from '@/lib/anonymousUser'; 
import { getSession } from 'next-auth/react'; 

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });
    return searchParams.toString();
}

async function apiFetch<T>(
    url: string,
    options?: RequestInit,
    isAnonymousResourceCall: boolean = false
): Promise<T> {
    if (!url.startsWith('http') && !API_BASE_URL) {
        console.error("API_BASE_URL is not defined for a relative URL. Check .env.local or build variables.");
        throw new Error("API configuration error. Base URL is missing for relative path.");
    }

    const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const headers = new Headers(options?.headers); 

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }
    if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const session = await getSession(); 

    if (isAnonymousResourceCall) {
        const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
        if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
            headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
            headers.delete('Authorization');
        } else {
            console.warn(`apiClient: 'isAnonymousResourceCall' was true for ${effectiveUrl}, but no anonymous token was available.`);
        }
    } else if (session?.accessToken) {
        headers.set('Authorization', `Bearer ${session.accessToken}`);
        headers.delete(ANONYMOUS_SESSION_TOKEN_HEADER);
    }

    let response: Response;
    try {
        response = await fetch(effectiveUrl, { ...options, headers });
    } catch (error: any) {
        console.error(`apiClient: Network error during fetch to ${effectiveUrl}:`, error);
        throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, effectiveUrl);
    }

    if (!response.ok) {
        let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
        let errorBody = null;
        try {
            const responseTextForError = await response.text(); 
            if (responseTextForError) {
                errorBody = JSON.parse(responseTextForError); 
                if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
                else if (errorBody.title) errorDetails = errorBody.title;
                else if (errorBody.detail) errorDetails = errorBody.detail;
                else if (errorBody.message) errorDetails = errorBody.message;
                else if (errorBody.errors) errorDetails = JSON.stringify(errorBody.errors);
                else errorDetails = responseTextForError; 
            }
        } catch (parseError) {
            errorDetails = await response.text().catch(() => response.statusText); 
        }
        console.error(`apiClient: API Error ${response.status} for ${effectiveUrl}. Details: ${errorDetails}`, errorBody);
        throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
    }

    if (response.status === 204) { 
        return undefined as T;
    }

    const responseText = await response.text();
    if ((!responseText && response.status === 200) || (responseText === "null" && response.status === 200)) {
        return null as unknown as T;
    }
    if (!responseText) {
         throw new APIError(response.status, response.statusText, "Empty response body for non-200/204 status.", effectiveUrl);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            const data = JSON.parse(responseText);
            return data as T; 
        } catch (error) {
            console.error(`apiClient: Failed to parse successful JSON response (text was: "${responseText}") from ${effectiveUrl}:`, error);
            throw new APIError(response.status, "JSON Parse Error", `Invalid JSON response from server. Text: ${responseText}`, effectiveUrl, responseText);
        }
    } else if (contentType && contentType.includes("text/plain")) {
        return responseText as unknown as T;
    } else {
        console.warn(`apiClient: Response from ${effectiveUrl} had Content-Type: ${contentType} but was not handled. Body: "${responseText}"`);
        throw new APIError(response.status, "Unexpected Content Type", `Expected JSON, text, or 204, but got ${contentType}. Body: ${responseText}`, effectiveUrl);
    }
}

// --- Standard API Functions (Updated for OperationalArea) ---

/**
 * Fetches legacy city data.
 */
export const fetchCities = async (): Promise<CityDto[]> => 
    apiFetch<CityDto[]>("/api/cities");

/**
 * Fetches operational areas with their geometries for map display.
 */
// export const fetchOperationalAreasForMap = async (): Promise<OperationalAreaDto[]> =>
//     apiFetch<OperationalAreaDto[]>("/api/operational-areas-for-map");
export const fetchOperationalAreasForMap = async (displayLevel?: string): Promise<OperationalAreaDto[]> => {
    const queryParams: Record<string, string | undefined> = {};
    if (displayLevel) {
        queryParams.displayLevel = displayLevel;
    }
    // Ensure this path is correct (as per previous discussion: /api/general/operational-areas-for-map)
    const queryString = buildQueryString(queryParams);
    const path = `/api/operational-areas-for-map${queryString ? `?${queryString}` : ''}`;
    return apiFetch<OperationalAreaDto[]>(path);
}

/**
 * Fetches operational areas with their geometries for map display.
 */
// export const fetchOperationalAreasForMap = async (displayLevel?: string): Promise<OperationalAreaDto[]> => { // Added optional displayLevel
//     const queryParams: Record<string, string | undefined> = {};
//     if (displayLevel) {
//         queryParams.displayLevel = displayLevel;
//     }
//     //                                          vvvvvvvvv
//     return apiFetch<OperationalAreaDto[]>(`/api/general/operational-areas-for-map?${buildQueryString(queryParams)}`);
//     //                                          ^^^^^^^^^
// }
/**
 * Fetches subcategories available within a specific operational area.
 * @param areaSlug The slug of the operational area.
 * @param concept Optional filter by high-level concept (Maintenance/Marketplace).
 */
export const fetchSubCategoriesByOperationalArea = async (areaSlug: string, concept?: HighLevelConceptQueryParam): Promise<SubCategoryDto[]> => 
    apiFetch<SubCategoryDto[]>(`/api/operational-areas/${encodeURIComponent(areaSlug)}/subcategories?${buildQueryString({ concept })}`);

/**
 * Fetches a paginated list of shops within a specific operational area and subcategory.
 * @param areaSlug The slug of the operational area.
 * @param subCategorySlug The slug of the subcategory.
 * @param queryParams Additional query parameters for filtering, sorting, and pagination.
 */
export const fetchShops = async (areaSlug: string, subCategorySlug: string, queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => 
    apiFetch<PaginatedResponse<ShopDto>>(`/api/operational-areas/${encodeURIComponent(areaSlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${buildQueryString(queryParams as any)}`);

/**
 * Fetches details for a specific shop by its ID, within the context of an operational area and subcategory.
 * @param areaSlug The slug of the operational area.
 * @param subCategorySlug The slug of the subcategory.
 * @param shopId The ID of the shop.
 */
export const fetchShopById = async (areaSlug: string, subCategorySlug: string, shopId: string): Promise<ShopDto> => 
    apiFetch<ShopDto>(`/api/operational-areas/${encodeURIComponent(areaSlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`);

/**
 * Fetches all services offered by a specific shop.
 * @param areaSlug The slug of the operational area.
 * @param subCategorySlug The slug of the subcategory.
 * @param shopId The ID of the shop.
 */
export const fetchServicesByShop = async (areaSlug: string, subCategorySlug: string, shopId: string): Promise<ShopServiceDto[]> => 
    apiFetch<ShopServiceDto[]>(`/api/operational-areas/${encodeURIComponent(areaSlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`);


// --- Anonymous Cart API Functions ---
export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);
export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);
export const updateAnonymousCartItem = async (anonymousCartItemId: string, itemUpdateBody: UpdateAnonymousCartItemApiBody): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, true);
export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);
export const clearAnonymousCart = async (): Promise<void> => apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);

// --- Anonymous User Preferences API Functions ---
export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => {
    try {
        return await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true) ?? null;
    } catch (error) {
        if (error instanceof APIError && (error.status === 401 || error.status === 404)) {
            console.warn(`getAnonymousLocationPreference: ${error.message}`);
        } else { console.error('getAnonymousLocationPreference failed:', error); }
        return null;
    }
};
export const updateAnonymousLocationPreference = async (locationData: UpdateAnonymousLocationRequestDto): Promise<AnonymousUserPreferenceDto | null> => {
    try {
        return await apiFetch<AnonymousUserPreferenceDto>(ANON_PATHS.PREFERENCES_LOCATION, { method: 'PUT', body: JSON.stringify(locationData) }, true);
    } catch (error) { console.error('updateAnonymousLocationPreference failed:', error); return null; }
};

// --- Authenticated User API Functions ---
export const getMyUserProfile = async (): Promise<any> => apiFetch<any>("/api/users/me/profile"); 

export const mergeAnonymousDataToUser = async (anonymousSessionToken: string): Promise<MergeAnonymousDataResponse> =>
    apiFetch<MergeAnonymousDataResponse>(
        ANON_PATHS.USER_MERGE_ANONYMOUS_DATA,
        { method: 'POST', body: JSON.stringify({ anonymousSessionToken }) }
    );

const USER_CART_API_BASE = "/api/users/me/cart";
export const getUserCart = async (): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(USER_CART_API_BASE);
export const addItemToUserCart = async (item: AddToUserCartRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items`, { method: 'POST', body: JSON.stringify(item) });
export const updateUserCartItem = async (userCartItemId: string, itemUpdateBody: UpdateUserCartItemQuantityRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'PUT', body: JSON.stringify(itemUpdateBody) });
export const removeUserCartItem = async (userCartItemId: string): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'DELETE' });
export const clearUserCart = async (): Promise<void> => apiFetch<void>(USER_CART_API_BASE, { method: 'DELETE' });
// // src/lib/apiClient.ts
// import {
//     PaginatedResponse, ShopDto, FrontendShopQueryParameters, CityDto, SubCategoryDto,
//     HighLevelConceptQueryParam, APIError, ShopServiceDto,
//     UserCartApiResponseDto, AddToUserCartRequestDto, UpdateUserCartItemQuantityRequestDto
// } from '@/types/api'; // Your API type definitions
// import {
//     AnonymousCartApiResponse, AddToAnonymousCartRequest, UpdateAnonymousCartItemApiBody,
//     AnonymousUserPreferenceDto, UpdateAnonymousLocationRequestDto,
//     ANONYMOUS_API_PATHS as ANON_PATHS, // Alias for brevity
//     ANONYMOUS_SESSION_TOKEN_HEADER,
//     MergeAnonymousDataRequest, MergeAnonymousDataResponse
// } from '@/types/anonymous'; // Your anonymous-related type definitions
// import { anonymousUserManager } from '@/lib/anonymousUser'; // Your anonymous user manager
// import { getSession } from 'next-auth/react'; // For client-side fetching of NextAuth session

// // CRITICAL: Ensure this points to your AutomotiveServices.Api backend URL
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // Helper function to construct query strings
// function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
//     const searchParams = new URLSearchParams();
//     Object.entries(params).forEach(([key, value]) => {
//         if (value !== undefined && value !== null && value !== '') {
//             searchParams.append(key, String(value));
//         }
//     });
//     return searchParams.toString();
// }

// // Generic fetch wrapper
// async function apiFetch<T>(
//     url: string,
//     options?: RequestInit,
//     isAnonymousResourceCall: boolean = false // True if this call specifically targets an anonymous resource
// ): Promise<T> {
//     if (!url.startsWith('http') && !API_BASE_URL) {
//         console.error("API_BASE_URL is not defined for a relative URL. Check .env.local or build variables.");
//         throw new Error("API configuration error. Base URL is missing for relative path.");
//     }

//     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
//     const headers = new Headers(options?.headers); // Start with existing headers from options

//     // Set default headers
//     if (!headers.has('Accept')) {
//         headers.set('Accept', 'application/json');
//     }
//     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
//         headers.set('Content-Type', 'application/json');
//     }

//     // Token handling logic
//     const session = await getSession(); // Get current NextAuth session

//     if (isAnonymousResourceCall) {
//         // This call is specifically for an anonymous resource (e.g., anonymous cart/prefs).
//         // It should use the anonymous token, even if a user session exists (e.g., during merge prep).
//         const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
//         if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
//             headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
//             // Ensure user's Authorization header is not sent for purely anonymous resource calls
//             headers.delete('Authorization');
//         } else {
//             console.warn(`apiClient: 'isAnonymousResourceCall' was true for ${effectiveUrl}, but no anonymous token was available from manager. The API might return 401.`);
//         }
//     } else if (session?.accessToken) {
//         // This is an authenticated user call (NOT specifically for an anonymous resource).
//         // console.log(`apiClient: User authenticated, using user access token for ${effectiveUrl}`);
//         headers.set('Authorization', `Bearer ${session.accessToken}`);
//         // Ensure X-Anonymous-Token is not sent for regular authenticated calls
//         headers.delete(ANONYMOUS_SESSION_TOKEN_HEADER);
//     }
//     // If neither isAnonymousResourceCall nor session.accessToken, it's a public call (no specific token headers added by this logic).

//     let response: Response;
//     try {
//         response = await fetch(effectiveUrl, { ...options, headers });
//     } catch (error: any) {
//         console.error(`apiClient: Network error during fetch to ${effectiveUrl}:`, error);
//         throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, effectiveUrl);
//     }

//     if (!response.ok) {
//         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
//         let errorBody = null;
//         try {
//             const responseTextForError = await response.text(); // Read as text first
//             if (responseTextForError) {
//                 errorBody = JSON.parse(responseTextForError); // Try to parse as JSON
//                 if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
//                 else if (errorBody.title) errorDetails = errorBody.title;
//                 else if (errorBody.detail) errorDetails = errorBody.detail;
//                 else if (errorBody.message) errorDetails = errorBody.message;
//                 else if (errorBody.errors) errorDetails = JSON.stringify(errorBody.errors);
//                 else errorDetails = responseTextForError; // Fallback to text if JSON props not found
//             }
//         } catch (parseError) {
//             // If JSON.parse fails, errorDetails remains response.statusText or the text itself
//             errorDetails = await response.text().catch(() => response.statusText); // Re-read if first try failed, or use statusText
//         }
//         console.error(`apiClient: API Error ${response.status} for ${effectiveUrl}. Details: ${errorDetails}`, errorBody);
//         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
//     }

//     if (response.status === 204) { // No Content
//         return undefined as T;
//     }

//     const responseText = await response.text();
//     // Handle 200 OK with truly empty body or body being the string "null"
//     if ((!responseText && response.status === 200) || (responseText === "null" && response.status === 200)) {
//         return null as unknown as T;
//     }
//     if (!responseText) { // Should not happen if not 204 or 200 with empty/null body
//          throw new APIError(response.status, response.statusText, "Empty response body for non-200/204 status.", effectiveUrl);
//     }

//     const contentType = response.headers.get("content-type");
//     if (contentType && contentType.includes("application/json")) {
//         try {
//             const data = JSON.parse(responseText);
//             return data as T; // `JSON.parse("null")` correctly results in `null`
//         } catch (error) {
//             console.error(`apiClient: Failed to parse successful JSON response (text was: "${responseText}") from ${effectiveUrl}:`, error);
//             throw new APIError(response.status, "JSON Parse Error", `Invalid JSON response from server. Text: ${responseText}`, effectiveUrl, responseText);
//         }
//     } else if (contentType && contentType.includes("text/plain")) {
//         return responseText as unknown as T;
//     } else {
//         console.warn(`apiClient: Response from ${effectiveUrl} had Content-Type: ${contentType} but was not handled as JSON or text. Body text: "${responseText}"`);
//         throw new APIError(response.status, "Unexpected Content Type", `Expected JSON, text, or 204, but got ${contentType}. Body: ${responseText}`, effectiveUrl);
//     }
// }

// // --- Standard API Functions ---
// // These are typically public or use user auth if available; not anonymous-specific.
// export const fetchCities = async (): Promise<CityDto[]> => apiFetch<CityDto[]>("/api/cities");
// export const fetchSubCategoriesByCity = async (citySlug: string, concept?: HighLevelConceptQueryParam): Promise<SubCategoryDto[]> => apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${buildQueryString({ concept })}`);
// export const fetchShops = async (citySlug: string, subCategorySlug: string, queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => apiFetch<PaginatedResponse<ShopDto>>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${buildQueryString(queryParams as any)}`);
// export const fetchShopById = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopDto> => apiFetch<ShopDto>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`);
// export const fetchServicesByShop = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopServiceDto[]> => apiFetch<ShopServiceDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`);

// // --- Anonymous Cart API Functions ---
// // These explicitly pass `isAnonymousResourceCall: true`
// export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);
// export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);
// export const updateAnonymousCartItem = async (anonymousCartItemId: string, itemUpdateBody: UpdateAnonymousCartItemApiBody): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, true);
// export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);
// export const clearAnonymousCart = async (): Promise<void> => apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);

// // --- Anonymous User Preferences API Functions ---
// // These explicitly pass `isAnonymousResourceCall: true`
// export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => {
//     try {
//         return await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true) ?? null;
//     } catch (error) {
//         if (error instanceof APIError && (error.status === 401 || error.status === 404)) {
//             console.warn(`getAnonymousLocationPreference: ${error.message}`);
//         } else { console.error('getAnonymousLocationPreference failed:', error); }
//         return null;
//     }
// };
// export const updateAnonymousLocationPreference = async (locationData: UpdateAnonymousLocationRequestDto): Promise<AnonymousUserPreferenceDto | null> => {
//     try {
//         return await apiFetch<AnonymousUserPreferenceDto>(ANON_PATHS.PREFERENCES_LOCATION, { method: 'PUT', body: JSON.stringify(locationData) }, true);
//     } catch (error) { console.error('updateAnonymousLocationPreference failed:', error); return null; }
// };

// // --- Authenticated User API Functions ---
// // These use `isAnonymousResourceCall: false` (default), so user access token will be sent.
// export const getMyUserProfile = async (): Promise<any> => apiFetch<any>("/api/users/me/profile"); // Default isAnonymousResourceCall = false

// export const mergeAnonymousDataToUser = async (anonymousSessionToken: string): Promise<MergeAnonymousDataResponse> =>
//     apiFetch<MergeAnonymousDataResponse>(
//         ANON_PATHS.USER_MERGE_ANONYMOUS_DATA,
//         { method: 'POST', body: JSON.stringify({ anonymousSessionToken }) }
//         // isAnonymousResourceCall defaults to false, so user's access token is sent.
//     );

// const USER_CART_API_BASE = "/api/users/me/cart";
// export const getUserCart = async (): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(USER_CART_API_BASE);
// export const addItemToUserCart = async (item: AddToUserCartRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items`, { method: 'POST', body: JSON.stringify(item) });
// export const updateUserCartItem = async (userCartItemId: string, itemUpdateBody: UpdateUserCartItemQuantityRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'PUT', body: JSON.stringify(itemUpdateBody) });
// export const removeUserCartItem = async (userCartItemId: string): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'DELETE' });
// export const clearUserCart = async (): Promise<void> => apiFetch<void>(USER_CART_API_BASE, { method: 'DELETE' });
// // // src/lib/apiClient.ts
// // import {
// //     PaginatedResponse, ShopDto, FrontendShopQueryParameters, CityDto, SubCategoryDto,
// //     HighLevelConceptQueryParam, APIError, ShopServiceDto,
// //     UserCartApiResponseDto, AddToUserCartRequestDto, UpdateUserCartItemQuantityRequestDto
// // } from '@/types/api';
// // import {
// //     AnonymousCartApiResponse, AddToAnonymousCartRequest, UpdateAnonymousCartItemApiBody,
// //     AnonymousUserPreferenceDto, UpdateAnonymousLocationRequestDto,
// //     ANONYMOUS_API_PATHS as ANON_PATHS, ANONYMOUS_SESSION_TOKEN_HEADER,
// //     MergeAnonymousDataRequest, MergeAnonymousDataResponse
// // } from '@/types/anonymous';
// // import { anonymousUserManager } from '@/lib/anonymousUser';
// // import { getSession } from 'next-auth/react';

// // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// //     const searchParams = new URLSearchParams();
// //     Object.entries(params).forEach(([key, value]) => {
// //         if (value !== undefined && value !== null && value !== '') {
// //             searchParams.append(key, String(value));
// //         }
// //     });
// //     return searchParams.toString();
// // }

// // async function apiFetch<T>(
// //     url: string, 
// //     options?: RequestInit, 
// //     isAnonymousResourceCall: boolean = false,
// //     retryCount: number = 0
// // ): Promise<T> {
// //     if (!url.startsWith('http') && !API_BASE_URL) {
// //         throw new Error("API configuration error. Base URL is missing for relative path.");
// //     }
    
// //     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
// //     const headers = new Headers(options?.headers);
    
// //     if (!headers.has('Accept')) headers.set('Accept', 'application/json');
// //     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
// //         headers.set('Content-Type', 'application/json');
// //     }

// //     // Enhanced authentication logic
// //     try {
// //         if (isAnonymousResourceCall) {
// //             const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// //             if (anonymousHeaderObject?.[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// //                 headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// //                 // Remove any existing Authorization header for anonymous calls
// //                 headers.delete('Authorization');
// //             } else {
// //                 console.warn(`apiClient: 'isAnonymousResourceCall' was true, but no anonymous token was available.`);
// //             }
// //         } else {
// //             // For authenticated calls, refresh session if needed
// //             const session = await getSession();
// //             if (session?.accessToken) {
// //                 headers.set('Authorization', `Bearer ${session.accessToken}`);
// //                 headers.delete(ANONYMOUS_SESSION_TOKEN_HEADER);
// //             } else {
// //                 console.warn('apiClient: No valid session found for authenticated call');
// //                 // Don't throw here - let the server respond with 401 if needed
// //             }
// //         }
// //     } catch (authError) {
// //         console.error('apiClient: Authentication setup failed:', authError);
// //         // Continue with request - let server handle auth failure
// //     }

// //     let response: Response;
// //     try {
// //         response = await fetch(effectiveUrl, { 
// //             ...options, 
// //             headers,
// //             // Add timeout and other fetch options for better reliability
// //             signal: options?.signal || AbortSignal.timeout(30000) // 30 second timeout
// //         });
// //     } catch (error: any) {
// //         // Handle specific error types
// //         if (error.name === 'AbortError') {
// //             console.error(`apiClient: Request timeout for ${effectiveUrl}`);
// //             throw new APIError(408, "Request Timeout", "Request timed out after 30 seconds", effectiveUrl);
// //         }
        
// //         // Retry logic for network errors
// //         if (retryCount < 2 && (error.message?.includes('ERR_HTTP2_PROTOCOL_ERROR') || error.name === 'TypeError')) {
// //             console.warn(`apiClient: Network error for ${effectiveUrl}, retrying... (attempt ${retryCount + 1})`);
// //             await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
// //             return apiFetch<T>(url, options, isAnonymousResourceCall, retryCount + 1);
// //         }
        
// //         console.error(`apiClient: Network error for ${effectiveUrl}:`, error);
// //         throw new APIError(0, "Network Error", error.message || 'Network request failed.', effectiveUrl);
// //     }

// //     // Handle 401 specifically for potential token refresh
// //     if (response.status === 401 && !isAnonymousResourceCall && retryCount === 0) {
// //         console.warn(`apiClient: 401 error for ${effectiveUrl}, attempting session refresh`);
        
// //         // Try to refresh the session
// //         try {
// //             // Force session refresh - this depends on your auth setup
// //             const refreshedSession = await getSession();
// //             if (refreshedSession?.accessToken) {
// //                 // Retry with refreshed session
// //                 return apiFetch<T>(url, options, isAnonymousResourceCall, 1);
// //             }
// //         } catch (refreshError) {
// //             console.error('apiClient: Session refresh failed:', refreshError);
// //         }
// //     }

// //     if (!response.ok) {
// //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// //         let errorBody = null;
        
// //         try {
// //             const responseClone = response.clone();
// //             errorBody = await responseClone.json();
            
// //             if (errorBody.title && errorBody.detail) {
// //                 errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// //             } else if (errorBody.title) {
// //                 errorDetails = errorBody.title;
// //             } else if (errorBody.detail) {
// //                 errorDetails = errorBody.detail;
// //             } else if (errorBody.message) {
// //                 errorDetails = errorBody.message;
// //             } else if (errorBody.errors) {
// //                 errorDetails = JSON.stringify(errorBody.errors);
// //             }
// //         } catch (parseError) {
// //             try {
// //                 errorDetails = await response.text();
// //             } catch {
// //                 errorDetails = response.statusText;
// //             }
// //         }
        
// //         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
// //     }

// //     if (response.status === 204) return undefined as T;
    
// //     const responseText = await response.text();
// //     if (!responseText && response.status === 200) return null as unknown as T;
    
// //     if (!responseText) {
// //         throw new APIError(response.status, response.statusText, "Empty response body for non-200/204 status.", effectiveUrl);
// //     }

// //     const contentType = response.headers.get("content-type");
// //     if (contentType?.includes("application/json")) {
// //         try {
// //             return JSON.parse(responseText) as T;
// //         } catch (error) {
// //             throw new APIError(response.status, "JSON Parse Error", `Invalid JSON: ${responseText}`, effectiveUrl, responseText);
// //         }
// //     } else if (contentType?.includes("text/plain")) {
// //         return responseText as unknown as T;
// //     }
    
// //     throw new APIError(response.status, "Unexpected Content Type", `Expected JSON/text/204, got ${contentType}. Body: ${responseText}`, effectiveUrl);
// // }

// // // Wrapper functions with better error handling
// // export const fetchCities = async (): Promise<CityDto[]> => {
// //     try {
// //         return await apiFetch<CityDto[]>("/api/cities");
// //     } catch (error) {
// //         console.error('fetchCities failed:', error);
// //         throw error;
// //     }
// // };

// // export const fetchSubCategoriesByCity = async (
// //     citySlug: string, 
// //     concept?: HighLevelConceptQueryParam
// // ): Promise<SubCategoryDto[]> => apiFetch<SubCategoryDto[]>(
// //     `/api/cities/${encodeURIComponent(citySlug)}/subcategories?${buildQueryString({ concept })}`
// // );

// // export const fetchShops = async (
// //     citySlug: string, 
// //     subCategorySlug: string, 
// //     queryParams: FrontendShopQueryParameters
// // ): Promise<PaginatedResponse<ShopDto>> => apiFetch<PaginatedResponse<ShopDto>>(
// //     `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${buildQueryString(queryParams as any)}`
// // );

// // export const fetchShopById = async (
// //     citySlug: string, 
// //     subCategorySlug: string, 
// //     shopId: string
// // ): Promise<ShopDto> => apiFetch<ShopDto>(
// //     `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`
// // );

// // export const fetchServicesByShop = async (
// //     citySlug: string, 
// //     subCategorySlug: string, 
// //     shopId: string
// // ): Promise<ShopServiceDto[]> => apiFetch<ShopServiceDto[]>(
// //     `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`
// // );

// // // Anonymous cart functions
// // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => 
// //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);

// // export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => 
// //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);

// // export const updateAnonymousCartItem = async (
// //     anonymousCartItemId: string, 
// //     itemUpdateBody: UpdateAnonymousCartItemApiBody
// // ): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(
// //     ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), 
// //     { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, 
// //     true
// // );

// // export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> => 
// //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);

// // export const clearAnonymousCart = async (): Promise<void> => 
// //     apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);

// // // Anonymous preferences with enhanced error handling
// // export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => {
// //     try {
// //         const result = await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true);
// //         return result ?? null;
// //     } catch (error) {
// //         console.error('getAnonymousLocationPreference failed:', error);
// //         return null;
// //     }
// // };

// // export const updateAnonymousLocationPreference = async (
// //     data: UpdateAnonymousLocationRequestDto
// // ): Promise<AnonymousUserPreferenceDto | null> => {
// //     try {
// //         return await apiFetch<AnonymousUserPreferenceDto>(
// //             ANON_PATHS.PREFERENCES_LOCATION, 
// //             { method: 'PUT', body: JSON.stringify(data) }, 
// //             true
// //         );
// //     } catch (error) {
// //         console.error('updateAnonymousLocationPreference failed:', error);
// //         return null;
// //     }
// // };

// // // User profile and merge functions
// // export const getMyUserProfile = async (): Promise<any> => apiFetch<any>("/api/me/profile");

// // export const mergeAnonymousDataToUser = async (anonymousSessionToken: string): Promise<MergeAnonymousDataResponse> => 
// //     apiFetch<MergeAnonymousDataResponse>(
// //         ANON_PATHS.USER_MERGE_ANONYMOUS_DATA, 
// //         { method: 'POST', body: JSON.stringify({ anonymousSessionToken }) }
// //     );

// // // Authenticated user cart functions
// // const USER_CART_API_BASE = "/api/users/me/cart";

// // export const getUserCart = async (): Promise<UserCartApiResponseDto> => 
// //     apiFetch<UserCartApiResponseDto>(USER_CART_API_BASE);

// // export const addItemToUserCart = async (item: AddToUserCartRequestDto): Promise<UserCartApiResponseDto> => 
// //     apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items`, { method: 'POST', body: JSON.stringify(item) });

// // export const updateUserCartItem = async (
// //     userCartItemId: string, 
// //     itemUpdateBody: UpdateUserCartItemQuantityRequestDto
// // ): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(
// //     `${USER_CART_API_BASE}/items/${userCartItemId}`, 
// //     { method: 'PUT', body: JSON.stringify(itemUpdateBody) }
// // );

// // export const removeUserCartItem = async (userCartItemId: string): Promise<UserCartApiResponseDto> => 
// //     apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'DELETE' });

// // export const clearUserCart = async (): Promise<void> => 
// //     apiFetch<void>(USER_CART_API_BASE, { method: 'DELETE' });
// // // // src/lib/apiClient.ts
// // // import {
// // //     PaginatedResponse, ShopDto, FrontendShopQueryParameters, CityDto, SubCategoryDto,
// // //     HighLevelConceptQueryParam, APIError, ShopServiceDto,
// // //     UserCartApiResponseDto, AddToUserCartRequestDto, UpdateUserCartItemQuantityRequestDto // For Auth User Cart
// // // } from '@/types/api';
// // // import {
// // //     AnonymousCartApiResponse, AddToAnonymousCartRequest, UpdateAnonymousCartItemApiBody,
// // //     AnonymousUserPreferenceDto, UpdateAnonymousLocationRequestDto,
// // //     ANONYMOUS_API_PATHS as ANON_PATHS, ANONYMOUS_SESSION_TOKEN_HEADER,
// // //     MergeAnonymousDataRequest, MergeAnonymousDataResponse // For Merge
// // // } from '@/types/anonymous';
// // // import { anonymousUserManager } from '@/lib/anonymousUser';
// // // import { getSession } from 'next-auth/react';

// // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// // //     const searchParams = new URLSearchParams();
// // //     Object.entries(params).forEach(([key, value]) => {
// // //         if (value !== undefined && value !== null && value !== '') {
// // //             searchParams.append(key, String(value));
// // //         }
// // //     });
// // //     return searchParams.toString();
// // // }

// // // async function apiFetch<T>(
// // //     url: string, options?: RequestInit, isAnonymousResourceCall: boolean = false
// // // ): Promise<T> {
// // //     if (!url.startsWith('http') && !API_BASE_URL) {
// // //         throw new Error("API configuration error. Base URL is missing for relative path.");
// // //     }
// // //     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
// // //     const headers = new Headers(options?.headers);
// // //     if (!headers.has('Accept')) headers.set('Accept', 'application/json');
// // //     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
// // //         headers.set('Content-Type', 'application/json');
// // //     }

// // //     const session = await getSession();
// // //     if (isAnonymousResourceCall) {
// // //         const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// // //         if (anonymousHeaderObject?.[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// // //             headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// // //         } else { console.warn(`apiClient: 'isAnonymousResourceCall' was true, but no anonymous token was available.`); }
// // //     } else if (session?.accessToken) {
// // //         headers.set('Authorization', `Bearer ${session.accessToken}`);
// // //         headers.delete(ANONYMOUS_SESSION_TOKEN_HEADER);
// // //     }

// // //     let response: Response;
// // //     try {
// // //         response = await fetch(effectiveUrl, { ...options, headers });
// // //     } catch (error: any) {
// // //         console.error(`apiClient: Network error for ${effectiveUrl}:`, error);
// // //         throw new APIError(0, "Network Error", error.message || 'Network request failed.', effectiveUrl);
// // //     }

// // //     if (!response.ok) {
// // //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// // //         let errorBody = null;
// // //         try {
// // //             errorBody = await response.json();
// // //             if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// // //             else if (errorBody.title) errorDetails = errorBody.title;
// // //             else if (errorBody.detail) errorDetails = errorBody.detail;
// // //             else if (errorBody.message) errorDetails = errorBody.message;
// // //             else if (errorBody.errors) errorDetails = JSON.stringify(errorBody.errors);
// // //         } catch (parseError) { errorDetails = await response.text().catch(() => response.statusText); }
// // //         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
// // //     }

// // //     if (response.status === 204) return undefined as T;
// // //     const responseText = await response.text();
// // //     if (!responseText && response.status === 200) return null as unknown as T;
// // //     if (!responseText) throw new APIError(response.status, response.statusText, "Empty response body for non-200/204 status.", effectiveUrl);

// // //     const contentType = response.headers.get("content-type");
// // //     if (contentType?.includes("application/json")) {
// // //         try { return JSON.parse(responseText) as T; }
// // //         catch (error) { throw new APIError(response.status, "JSON Parse Error", `Invalid JSON: ${responseText}`, effectiveUrl, responseText); }
// // //     } else if (contentType?.includes("text/plain")) {
// // //         return responseText as unknown as T;
// // //     }
// // //     throw new APIError(response.status, "Unexpected Content Type", `Expected JSON/text/204, got ${contentType}. Body: ${responseText}`, effectiveUrl);
// // // }

// // // export const fetchCities = async (): Promise<CityDto[]> => apiFetch<CityDto[]>("/api/cities");
// // // export const fetchSubCategoriesByCity = async (citySlug: string, concept?: HighLevelConceptQueryParam): Promise<SubCategoryDto[]> => apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${buildQueryString({ concept })}`);
// // // export const fetchShops = async (citySlug: string, subCategorySlug: string, queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => apiFetch<PaginatedResponse<ShopDto>>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${buildQueryString(queryParams as any)}`);
// // // export const fetchShopById = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopDto> => apiFetch<ShopDto>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`);
// // // export const fetchServicesByShop = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopServiceDto[]> => apiFetch<ShopServiceDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`);

// // // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);
// // // export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);
// // // export const updateAnonymousCartItem = async (anonymousCartItemId: string, itemUpdateBody: UpdateAnonymousCartItemApiBody): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, true);
// // // export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);
// // // export const clearAnonymousCart = async (): Promise<void> => apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);

// // // export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => { try { return await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true) ?? null; } catch (e) { console.error(e); return null; } };
// // // export const updateAnonymousLocationPreference = async (data: UpdateAnonymousLocationRequestDto): Promise<AnonymousUserPreferenceDto | null> => { try { return await apiFetch<AnonymousUserPreferenceDto>(ANON_PATHS.PREFERENCES_LOCATION, { method: 'PUT', body: JSON.stringify(data) }, true); } catch (e) { console.error(e); return null; }};

// // // export const getMyUserProfile = async (): Promise<any> => apiFetch<any>("/api/me/profile");
// // // export const mergeAnonymousDataToUser = async (anonymousSessionToken: string): Promise<MergeAnonymousDataResponse> => apiFetch<MergeAnonymousDataResponse>(ANON_PATHS.USER_MERGE_ANONYMOUS_DATA, { method: 'POST', body: JSON.stringify({ anonymousSessionToken }) });

// // // // --- AUTHENTICATED USER CART API Functions ---
// // // const USER_CART_API_BASE = "/api/users/me/cart";
// // // export const getUserCart = async (): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(USER_CART_API_BASE);
// // // export const addItemToUserCart = async (item: AddToUserCartRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items`, { method: 'POST', body: JSON.stringify(item) });
// // // export const updateUserCartItem = async (userCartItemId: string, itemUpdateBody: UpdateUserCartItemQuantityRequestDto): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'PUT', body: JSON.stringify(itemUpdateBody) });
// // // export const removeUserCartItem = async (userCartItemId: string): Promise<UserCartApiResponseDto> => apiFetch<UserCartApiResponseDto>(`${USER_CART_API_BASE}/items/${userCartItemId}`, { method: 'DELETE' });
// // // export const clearUserCart = async (): Promise<void> => apiFetch<void>(USER_CART_API_BASE, { method: 'DELETE' });
// // // // // src/lib/apiClient.ts
// // // // import {
// // // //     PaginatedResponse,
// // // //     ShopDto,
// // // //     FrontendShopQueryParameters,
// // // //     CityDto,
// // // //     SubCategoryDto,
// // // //     HighLevelConceptQueryParam,
// // // //     APIError,
// // // //     ShopServiceDto
// // // // } from '@/types/api';
// // // // import { UserCartApiResponseDto, AddToUserCartRequestDto, UpdateUserCartItemQuantityRequestDto } from '@/types/api'; // Assuming these 
// // // // import {
// // // //     AnonymousCartApiResponse,
// // // //     AddToAnonymousCartRequest,
// // // //     UpdateAnonymousCartItemApiBody,
// // // //     AnonymousUserPreferenceDto,
// // // //     UpdateAnonymousLocationRequestDto,
// // // //     ANONYMOUS_API_PATHS as ANON_PATHS,
// // // //     ANONYMOUS_SESSION_TOKEN_HEADER
// // // // } from '@/types/anonymous';

// // // // import { anonymousUserManager } from '@/lib/anonymousUser';
// // // // import { getSession } from 'next-auth/react'; // For client-side fetching of session

// // // // // CRITICAL: Ensure this points to your AutomotiveServices.Api backend URL
// // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // // // // Helper function to construct query strings
// // // // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// // // //     const searchParams = new URLSearchParams();
// // // //     Object.entries(params).forEach(([key, value]) => {
// // // //         if (value !== undefined && value !== null && value !== '') {
// // // //             searchParams.append(key, String(value));
// // // //         }
// // // //     });
// // // //     return searchParams.toString();
// // // // }

// // // // // Generic fetch wrapper
// // // // async function apiFetch<T>(
// // // //     url: string,
// // // //     options?: RequestInit,
// // // //     // This flag has a stronger meaning: "This call is FOR an anonymous resource"
// // // //     // OR "This call should prioritize anonymous token if both anon and user tokens are somehow possible"
// // // //     isAnonymousResourceCall: boolean = false
// // // // ): Promise<T> {
// // // //     if (!url.startsWith('http') && !API_BASE_URL) {
// // // //         console.error("API_BASE_URL is not defined for a relative URL. Check .env.local or build variables.");
// // // //         throw new Error("API configuration error. Base URL is missing for relative path.");
// // // //     }

// // // //     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
// // // //     const headers = new Headers(options?.headers);

// // // //     if (!headers.has('Accept')) {
// // // //         headers.set('Accept', 'application/json');
// // // //     }
// // // //     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
// // // //         headers.set('Content-Type', 'application/json');
// // // //     }

// // // //     const session = await getSession(); // Fetch current user session (null if not authenticated)

// // // //     if (isAnonymousResourceCall) {
// // // //         // This call is specifically for an anonymous resource.
// // // //         // It MUST use the anonymous token, even if a user session exists (e.g., for merging).
// // // //         const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// // // //         if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// // // //             headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// // // //             // If a user token also exists, the backend will decide how to handle it if both are present
// // // //             // For now, we prioritize X-Anonymous-Token for these specific calls.
// // // //             // If an Authorization header was already set for some reason, this doesn't remove it.
// // // //         } else {
// // // //             console.warn(`apiClient: 'isAnonymousResourceCall' was true, but no anonymous token was available.`);
// // // //             // The API endpoint expecting X-Anonymous-Token will likely return 401.
// // // //         }
// // // //     } else if (session?.accessToken) {
// // // //         // This is an authenticated user call (NOT specifically for an anonymous resource).
// // // //         // console.log("apiClient: User authenticated, using user access token.");
// // // //         headers.set('Authorization', `Bearer ${session.accessToken}`);
// // // //         // Ensure X-Anonymous-Token is not sent for regular authenticated calls
// // // //         headers.delete(ANONYMOUS_SESSION_TOKEN_HEADER);
// // // //     }
// // // //     // If neither isAnonymousResourceCall nor session.accessToken, it's a public call without specific tokens.

// // // //     let response: Response;
// // // //     try {
// // // //         response = await fetch(effectiveUrl, { ...options, headers });
// // // //     } catch (error: any) {
// // // //         console.error(`apiClient: Network error during fetch to ${effectiveUrl}:`, error);
// // // //         throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, effectiveUrl);
// // // //     }

// // // //     if (!response.ok) {
// // // //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// // // //         let errorBody = null;
// // // //         try {
// // // //             errorBody = await response.json();
// // // //             if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// // // //             else if (errorBody.title) errorDetails = errorBody.title;
// // // //             else if (errorBody.detail) errorDetails = errorBody.detail;
// // // //             else if (errorBody.message) errorDetails = errorBody.message;
// // // //             else if (errorBody.errors && typeof errorBody.errors === 'object') {
// // // //                 errorDetails = Object.entries(errorBody.errors).map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`).join('; ');
// // // //             }
// // // //         } catch (parseError) {
// // // //             const responseText = await response.text().catch(() => response.statusText);
// // // //             errorDetails = responseText || `HTTP Error ${response.status}`;
// // // //         }
// // // //         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
// // // //     }

// // // //     if (response.status === 204) { // No Content
// // // //         return undefined as T;
// // // //     }

// // // //     const contentType = response.headers.get("content-type");
// // // //     const responseText = await response.text();

// // // //     if (!responseText && response.status === 200) { // Handle 200 OK with truly empty body
// // // //         // console.log(`apiClient: Received 200 OK with empty body from ${effectiveUrl}. Returning null.`);
// // // //         return null as unknown as T;
// // // //     }
// // // //     if (!responseText && response.status !== 200 ) { // Handle other statuses with empty body
// // // //          throw new APIError(response.status, response.statusText, "Empty response body for non-200/204 status.", effectiveUrl);
// // // //     }


// // // //     if (contentType && contentType.includes("application/json")) {
// // // //         try {
// // // //             const data = JSON.parse(responseText);
// // // //             // Handles if API returns string "null" which parses to null
// // // //             return data === null ? null as unknown as T : data as T;
// // // //         } catch (error) {
// // // //             console.error(`apiClient: Failed to parse JSON response (text was: "${responseText}") from ${effectiveUrl}:`, error);
// // // //             throw new APIError(response.status, "JSON Parse Error", `Invalid JSON response from server. Text: ${responseText}`, effectiveUrl, responseText);
// // // //         }
// // // //     } else if (contentType && contentType.includes("text/plain")) {
// // // //         return responseText as unknown as T;
// // // //     } else {
// // // //         // If content type is not JSON or text, or if it's missing but there's a body
// // // //         console.warn(`apiClient: Response from ${effectiveUrl} had Content-Type: ${contentType} but was not handled as JSON or text. Body text: "${responseText}"`);
// // // //         throw new APIError(response.status, "Unexpected Content Type", `Expected JSON, text, or 204. Body: ${responseText}`, effectiveUrl);
// // // //     }
// // // // }

// // // // // --- Standard API Functions ---
// // // // export const fetchCities = async (): Promise<CityDto[]> => apiFetch<CityDto[]>("/api/cities");

// // // // export const fetchSubCategoriesByCity = async (citySlug: string, concept?: HighLevelConceptQueryParam): Promise<SubCategoryDto[]> => {
// // // //     if (!citySlug) throw new Error("City slug is required.");
// // // //     const queryParams: { concept?: HighLevelConceptQueryParam } = {};
// // // //     if (concept) queryParams.concept = concept;
// // // //     const queryString = buildQueryString(queryParams);
// // // //     return apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${queryString}`);
// // // // };

// // // // export const fetchShops = async (citySlug: string, subCategorySlug: string, queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => {
// // // //     if (!citySlug || !subCategorySlug) throw new Error("City and subcategory slugs are required.");
// // // //     const queryString = buildQueryString(queryParams as any);
// // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${queryString}`;
// // // //     return apiFetch<PaginatedResponse<ShopDto>>(url);
// // // // };

// // // // export const fetchShopById = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopDto> => {
// // // //     if (!citySlug || !subCategorySlug || !shopId) throw new Error("City slug, subcategory slug, and shop ID are required.");
// // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`;
// // // //     return apiFetch<ShopDto>(url);
// // // // };

// // // // export const fetchServicesByShop = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopServiceDto[]> => {
// // // //     if (!citySlug || !subCategorySlug || !shopId) throw new Error("City slug, subcategory slug, and shop ID are required.");
// // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`;
// // // //     return apiFetch<ShopServiceDto[]>(url);
// // // // };

// // // // // --- Anonymous Cart API Functions ---
// // // // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> =>
// // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true); // isAnonymousResourceCall = true

// // // // export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> =>
// // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);

// // // // export const updateAnonymousCartItem = async (anonymousCartItemId: string, itemUpdateBody: UpdateAnonymousCartItemApiBody): Promise<AnonymousCartApiResponse> =>
// // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, true);

// // // // export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> =>
// // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);

// // // // export const clearAnonymousCart = async (): Promise<void> =>
// // // //     apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);

// // // // // --- Anonymous User Preferences API Functions ---
// // // // export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => {
// // // //     try {
// // // //         const result = await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true); // isAnonymousResourceCall = true
// // // //         return result === undefined ? null : result;
// // // //     } catch (error) {
// // // //         if (error instanceof APIError && error.status === 401) {
// // // //             console.warn("getAnonymousLocationPreference: Unauthorized (likely no valid anonymous token).");
// // // //         } else if (error instanceof APIError && error.status === 404) {
// // // //             console.warn("getAnonymousLocationPreference: Preference endpoint not found (404). Check API routes.");
// // // //         } else {
// // // //             console.error("getAnonymousLocationPreference: Failed to fetch anonymous location preferences.", error);
// // // //         }
// // // //         return null;
// // // //     }
// // // // };

// // // // export const updateAnonymousLocationPreference = async (
// // // //     locationData: UpdateAnonymousLocationRequestDto
// // // // ): Promise<AnonymousUserPreferenceDto | null> => {
// // // //     try {
// // // //         return await apiFetch<AnonymousUserPreferenceDto>(
// // // //             ANON_PATHS.PREFERENCES_LOCATION,
// // // //             { method: 'PUT', body: JSON.stringify(locationData) },
// // // //             true // isAnonymousResourceCall = true
// // // //         );
// // // //     } catch (error) {
// // // //         console.error("updateAnonymousLocationPreference: Failed to update anonymous location preferences.", error);
// // // //         return null;
// // // //     }
// // // // };

// // // // // --- NEW: Authenticated User API Functions (Examples - to be expanded) ---
// // // // /**
// // // //  * Fetches the current authenticated user's profile from the API.
// // // //  * This call will automatically include the user's access token.
// // // //  */

// // // // // --- AUTHENTICATED USER CART API Functions ---
// // // // const USER_CART_BASE_PATH = "/api/users/me/cart";

// // // // export const getUserCart = async (): Promise<AnonymousCartApiResponse> => { // Or UserCartApiResponseDto
// // // //     // isAnonymousResourceCall is false by default, user token will be sent by apiFetch
// // // //     return await apiFetch<AnonymousCartApiResponse>(`${USER_CART_BASE_PATH}`);
// // // // };

// // // // export const addItemToUserCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => {
// // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // //         `${USER_CART_BASE_PATH}/items`,
// // // //         { method: 'POST', body: JSON.stringify(item) }
// // // //         // isAnonymousResourceCall is false, user token sent
// // // //     );
// // // // };

// // // // export const updateUserCartItem = async (
// // // //     userCartItemId: string, // This is the UserCartItem.UserCartItemId (GUID)
// // // //     itemUpdateBody: UpdateAnonymousCartItemApiBody // Reusing UpdateAnonymousCartItemApiBody: { newQuantity: number }
// // // // ): Promise<AnonymousCartApiResponse> => {
// // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // //         `${USER_CART_BASE_PATH}/items/${userCartItemId}`,
// // // //         { method: 'PUT', body: JSON.stringify(itemUpdateBody) }
// // // //     );
// // // // };

// // // // export const removeUserCartItem = async (
// // // //     userCartItemId: string // UserCartItem.UserCartItemId (GUID)
// // // // ): Promise<AnonymousCartApiResponse> => {
// // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // //         `${USER_CART_BASE_PATH}/items/${userCartItemId}`,
// // // //         { method: 'DELETE' }
// // // //     );
// // // // };

// // // // export const clearUserCart = async (): Promise<void> => {
// // // //     return await apiFetch<void>(`${USER_CART_BASE_PATH}`, { method: 'DELETE' });
// // // // };

// // // // export const getMyUserProfile = async (): Promise<any> => { // Replace 'any' with your actual UserProfile DTO
// // // //     // isAnonymousResourceCall is false by default, so user access token will be used if available
// // // //     return await apiFetch<any>("/api/me/profile"); 
// // // // };

// // // // /**
// // // //  * Example: Function to merge anonymous data to the authenticated user.
// // // //  * This function MUST be called when the user is authenticated.
// // // //  */
// // // // export const mergeAnonymousDataToUser = async (anonymousSessionToken: string): Promise<any> => { // Replace 'any' with MergeAnonymousDataResponse
// // // //     // This call is made by an authenticated user, so Authorization: Bearer will be set.
// // // //     // The anonymousSessionToken is part of the payload.
// // // //     return await apiFetch<any>(
// // // //         ANON_PATHS.USER_MERGE_ANONYMOUS_DATA, 
// // // //         {
// // // //             method: 'POST',
// // // //             body: JSON.stringify({ anonymousSessionToken }) // Body as defined in types/anonymous.ts
// // // //         }
// // // //         // isAnonymousResourceCall is false here, so user's access token is sent.
// // // //     );
// // // // };
// // // // // // src/lib/apiClient.ts
// // // // // import {
// // // // //     PaginatedResponse,
// // // // //     ShopDto,
// // // // //     FrontendShopQueryParameters,
// // // // //     CityDto,
// // // // //     SubCategoryDto,
// // // // //     HighLevelConceptQueryParam,
// // // // //     APIError,
// // // // //     ShopServiceDto
// // // // // } from '@/types/api';

// // // // // import {
// // // // //     AnonymousCartApiResponse,
// // // // //     AddToAnonymousCartRequest,
// // // // //     UpdateAnonymousCartItemApiBody,
// // // // //     // --- NEW Preference Types ---
// // // // //     AnonymousUserPreferenceDto,      // DTO for GET response
// // // // //     UpdateAnonymousLocationRequestDto, // DTO for PUT request body
// // // // //     // --- END NEW ---
// // // // //     ANONYMOUS_API_PATHS as ANON_PATHS, // Alias for brevity
// // // // //     ANONYMOUS_SESSION_TOKEN_HEADER
// // // // // } from '@/types/anonymous';

// // // // // import { anonymousUserManager } from '@/lib/anonymousUser';
// // // // // import { getSession } from 'next-auth/react';

// // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// // // // //     const searchParams = new URLSearchParams();
// // // // //     Object.entries(params).forEach(([key, value]) => {
// // // // //         if (value !== undefined && value !== null && value !== '') {
// // // // //             searchParams.append(key, String(value));
// // // // //         }
// // // // //     });
// // // // //     return searchParams.toString();
// // // // // }

// // // // // async function apiFetch<T>(
// // // // //     url: string,
// // // // //     options?: RequestInit,
// // // // //     includeAnonymousToken: boolean = false
// // // // // ): Promise<T> {
// // // // //     if (!url.startsWith('http') && !API_BASE_URL) {
// // // // //         console.error("API_BASE_URL is not defined for a relative URL. Check .env.local or build variables.");
// // // // //         throw new Error("API configuration error. Base URL is missing for relative path.");
// // // // //     }

// // // // //     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
// // // // //     const headers = new Headers(options?.headers);

// // // // //     if (!headers.has('Accept')) {
// // // // //         headers.set('Accept', 'application/json');
// // // // //     }
// // // // //     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
// // // // //         headers.set('Content-Type', 'application/json');
// // // // //     }

// // // // //     // if (includeAnonymousToken) {
// // // // //     //     const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// // // // //     //     if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// // // // //     //         headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// // // // //     //     } else {
// // // // //     //         console.warn(`apiClient: 'includeAnonymousToken' was true, but no anonymous token was available from manager.`);
// // // // //     //     }
// // // // //     // }
// // // // //     const session = await getSession(); // Fetch current session

// // // // //     if (session?.accessToken) {
// // // // //         // User is authenticated, use their access token
// // // // //         // console.log("apiClient: User authenticated, using user access token.");
// // // // //         headers.set('Authorization', `Bearer ${session.accessToken}`);
// // // // //         // If an anonymous token was somehow also requested, the user token takes precedence.
// // // // //         // No need to explicitly remove X-Anonymous-Token as it wouldn't have been added if session exists (see below)
// // // // //     } else if (includeAnonymousToken) {
// // // // //         // No user session, but an anonymous token is requested
// // // // //         const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// // // // //         if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// // // // //             headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// // // // //             // console.log(`apiClient: Including ${ANONYMOUS_SESSION_TOKEN_HEADER}`);
// // // // //         } else {
// // // // //             console.warn(`apiClient: 'includeAnonymousToken' was true, but no anonymous token was available.`);
// // // // //         }
// // // // //     }

// // // // //     let response: Response;
// // // // //     try {
// // // // //         response = await fetch(effectiveUrl, { ...options, headers });
// // // // //     } catch (error: any) {
// // // // //         console.error(`apiClient: Network error during fetch to ${effectiveUrl}:`, error);
// // // // //         throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, effectiveUrl);
// // // // //     }

// // // // //     if (!response.ok) {
// // // // //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// // // // //         let errorBody = null;
// // // // //         try {
// // // // //             errorBody = await response.json();
// // // // //             if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// // // // //             else if (errorBody.title) errorDetails = errorBody.title;
// // // // //             else if (errorBody.detail) errorDetails = errorBody.detail;
// // // // //             else if (errorBody.message) errorDetails = errorBody.message;
// // // // //             else if (errorBody.errors && typeof errorBody.errors === 'object') {
// // // // //                 errorDetails = Object.entries(errorBody.errors).map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`).join('; ');
// // // // //             }
// // // // //         } catch (parseError) {
// // // // //             const responseText = await response.text().catch(() => response.statusText);
// // // // //             errorDetails = responseText || `HTTP Error ${response.status}`;
// // // // //         }
// // // // //         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
// // // // //     }

// // // // //     if (response.status === 204) return undefined as T;

// // // // //     const contentType = response.headers.get("content-type");
// // // // //    const responseText = await response.text(); // Get text first to check if it's empty or "null"

// // // // //     if (!responseText) { // Handles empty body, which might come with 200 OK
// // // // //         // console.log(`apiClient: Received 200 OK with empty body from ${effectiveUrl}. Returning null.`);
// // // // //         return null as unknown as T; // Return null if body is empty
// // // // //     }

// // // // //     if (contentType && contentType.includes("application/json")) {
// // // // //         try {
// // // // //             // Attempt to parse the text we already fetched
// // // // //             const data = JSON.parse(responseText);
// // // // //             // If JSON.parse(responseText) results in null (e.g. API returned string "null"), it's a valid null
// // // // //             return data === null ? null as unknown as T : data as T;
// // // // //         } catch (error) {
// // // // //             console.error(`apiClient: Failed to parse JSON response (text was: "${responseText}") from ${effectiveUrl}:`, error);
// // // // //             throw new APIError(response.status, "JSON Parse Error", `Invalid JSON response from server. Text: ${responseText}`, effectiveUrl, responseText);
// // // // //         }
// // // // //     } else if (contentType && contentType.includes("text/plain")) {
// // // // //         return responseText as unknown as T;
// // // // //     } else {
// // // // //         console.warn(`apiClient: Response from ${effectiveUrl} was not JSON, text, or 204 (Content-Type: ${contentType}). Body text: "${responseText}"`);
// // // // //         // If it's not JSON but we have text, maybe it's still useful? Or treat as error.
// // // // //         // For now, if it's not explicitly JSON or text, and not 204, consider it unexpected.
// // // // //         throw new APIError(response.status, "Unexpected Content Type", `Expected JSON, text, or 204, but got ${contentType}. Body: ${responseText}`, effectiveUrl);
// // // // //     }
// // // // // }

// // // // // // --- Standard API Functions ---
// // // // // export const fetchCities = async (): Promise<CityDto[]> => apiFetch<CityDto[]>("/api/cities");

// // // // // export const fetchSubCategoriesByCity = async (citySlug: string, concept?: HighLevelConceptQueryParam): Promise<SubCategoryDto[]> => {
// // // // //     if (!citySlug) throw new Error("City slug is required.");
// // // // //     const queryParams: { concept?: HighLevelConceptQueryParam } = {};
// // // // //     if (concept) queryParams.concept = concept;
// // // // //     const queryString = buildQueryString(queryParams);
// // // // //     return apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${queryString}`);
// // // // // };

// // // // // export const fetchShops = async (citySlug: string, subCategorySlug: string, queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => {
// // // // //     if (!citySlug || !subCategorySlug) throw new Error("City and subcategory slugs are required.");
// // // // //     const queryString = buildQueryString(queryParams as any); // Cast to any if type issues with buildQueryString
// // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${queryString}`;
// // // // //     return apiFetch<PaginatedResponse<ShopDto>>(url);
// // // // // };

// // // // // export const fetchShopById = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopDto> => {
// // // // //     if (!citySlug || !subCategorySlug || !shopId) throw new Error("City slug, subcategory slug, and shop ID are required.");
// // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`;
// // // // //     return apiFetch<ShopDto>(url);
// // // // // };

// // // // // export const fetchServicesByShop = async (citySlug: string, subCategorySlug: string, shopId: string): Promise<ShopServiceDto[]> => {
// // // // //     if (!citySlug || !subCategorySlug || !shopId) throw new Error("City slug, subcategory slug, and shop ID are required.");
// // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`;
// // // // //     return apiFetch<ShopServiceDto[]>(url);
// // // // // };

// // // // // // --- Anonymous Cart API Functions ---
// // // // // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);

// // // // // export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> =>
// // // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEMS, { method: 'POST', body: JSON.stringify(item) }, true);

// // // // // export const updateAnonymousCartItem = async (anonymousCartItemId: string, itemUpdateBody: UpdateAnonymousCartItemApiBody): Promise<AnonymousCartApiResponse> =>
// // // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'PUT', body: JSON.stringify(itemUpdateBody) }, true);

// // // // // export const removeAnonymousCartItem = async (anonymousCartItemId: string): Promise<AnonymousCartApiResponse> =>
// // // // //     apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId), { method: 'DELETE' }, true);

// // // // // export const clearAnonymousCart = async (): Promise<void> =>
// // // // //     apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);


// // // // // // --- NEW: Anonymous User Preferences API Functions ---
// // // // // /**
// // // // //  * Fetches the anonymous user's saved location preference.
// // // // //  * Returns null if no preference is found or an error occurs that isn't a major APIError.
// // // // //  */
// // // // // export const getAnonymousLocationPreference = async (): Promise<AnonymousUserPreferenceDto | null> => {
// // // // //     try {
// // // // //         // Use the correct path constant
// // // // //         const result = await apiFetch<AnonymousUserPreferenceDto | null>(ANON_PATHS.PREFERENCES_LOCATION, {}, true);
// // // // //         return result === undefined ? null : result;
// // // // //     } catch (error) {
// // // // //         if (error instanceof APIError && error.status === 401) {
// // // // //             console.warn("getAnonymousLocationPreference: Unauthorized (likely no valid anonymous token).");
// // // // //         } else if (error instanceof APIError && error.status === 404) {
// // // // //             // This specific endpoint (GET /preferences/location) should return 200 OK with null body
// // // // //             // if prefs not found, so a 404 here would mean the /location path itself wasn't found.
// // // // //             console.warn("getAnonymousLocationPreference: Endpoint not found (404). Check API routes.");
// // // // //         } else {
// // // // //             console.error("getAnonymousLocationPreference: Failed to fetch anonymous location preferences.", error);
// // // // //         }
// // // // //         return null;
// // // // //     }
// // // // // };

// // // // // /**
// // // // //  * Updates (or creates) the anonymous user's location preference.
// // // // //  */
// // // // // export const updateAnonymousLocationPreference = async (
// // // // //     locationData: UpdateAnonymousLocationRequestDto
// // // // // ): Promise<AnonymousUserPreferenceDto | null> => {
// // // // //     try {
// // // // //         // Use the correct path constant
// // // // //         return await apiFetch<AnonymousUserPreferenceDto>(
// // // // //             ANON_PATHS.PREFERENCES_LOCATION, // Correct path
// // // // //             {
// // // // //                 method: 'PUT',
// // // // //                 body: JSON.stringify(locationData)
// // // // //             },
// // // // //             true // Include anonymous token
// // // // //         );
// // // // //     } catch (error) {
// // // // //         console.error("updateAnonymousLocationPreference: Failed to update anonymous location preferences.", error);
// // // // //         return null;
// // // // //     }
// // // // // };
// // // // // // // src/lib/apiClient.ts
// // // // // // import {
// // // // // //     PaginatedResponse,
// // // // // //     ShopDto,
// // // // // //     FrontendShopQueryParameters,
// // // // // //     CityDto,
// // // // // //     SubCategoryDto,
// // // // // //     HighLevelConceptQueryParam,
// // // // // //     APIError,
// // // // // //     ShopServiceDto // Assuming you've added this to types/api.ts or similar
// // // // // // } from '@/types/api'; // Make sure ShopServiceDto is defined in your api types

// // // // // // import {
// // // // // //      AnonymousCartApiResponse,
// // // // // //     AddToAnonymousCartRequest,
// // // // // //     UpdateAnonymousCartItemApiBody, // Use the corrected request body type
// // // // // //     ANONYMOUS_API_PATHS as ANON_PATHS,
// // // // // //     ANONYMOUS_SESSION_TOKEN_HEADER
// // // // // // } from '@/types/anonymous'; // Import anonymous types and constants

// // // // // // import { anonymousUserManager } from '@/lib/anonymousUser'; // Import the manager

// // // // // // // CRITICAL: Ensure this points to your AutomotiveServices.Api backend URL
// // // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7039';

// // // // // // // Helper function to construct query strings
// // // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// // // // // //     const searchParams = new URLSearchParams();
// // // // // //     Object.entries(params).forEach(([key, value]) => {
// // // // // //         if (value !== undefined && value !== null && value !== '') {
// // // // // //             searchParams.append(key, String(value));
// // // // // //         }
// // // // // //     });
// // // // // //     return searchParams.toString();
// // // // // // }

// // // // // // // Generic fetch wrapper
// // // // // // async function apiFetch<T>(
// // // // // //     url: string,
// // // // // //     options?: RequestInit,
// // // // // //     includeAnonymousToken: boolean = false
// // // // // // ): Promise<T> {
// // // // // //     // Check for API_BASE_URL only if url is relative
// // // // // //     if (!url.startsWith('http') && !API_BASE_URL) {
// // // // // //         console.error("API_BASE_URL is not defined for a relative URL. Check .env.local or build variables.");
// // // // // //         throw new Error("API configuration error. Base URL is missing for relative path.");
// // // // // //     }

// // // // // //     const effectiveUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
// // // // // //     // console.log(`apiClient: ${options?.method || 'GET'} ${effectiveUrl}`);

// // // // // //     const headers = new Headers(options?.headers); // Start with existing headers from options

// // // // // //     // Default headers
// // // // // //     if (!headers.has('Accept')) {
// // // // // //         headers.set('Accept', 'application/json');
// // // // // //     }
// // // // // //     if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
// // // // // //         headers.set('Content-Type', 'application/json');
// // // // // //     }

// // // // // //     // Add Anonymous Session Token if requested
// // // // // //     if (includeAnonymousToken) {
// // // // // //         const anonymousHeaderObject = await anonymousUserManager.getAnonymousTokenHeader();
// // // // // //         if (anonymousHeaderObject && anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]) {
// // // // // //             headers.set(ANONYMOUS_SESSION_TOKEN_HEADER, anonymousHeaderObject[ANONYMOUS_SESSION_TOKEN_HEADER]);
// // // // // //             // console.log(`apiClient: Including ${ANONYMOUS_SESSION_TOKEN_HEADER}`);
// // // // // //         } else {
// // // // // //             console.warn(`apiClient: 'includeAnonymousToken' was true, but no anonymous token was available from manager.`);
// // // // // //             // Depending on API requirements, this might lead to an error from the server
// // // // // //             // if the anonymous token is mandatory for the endpoint.
// // // // // //         }
// // // // // //     }
    
// // // // // //     // --- Placeholder for Future User Authentication Token ---
// // // // // //     // if (isUserAuthenticatedCall && !includeAnonymousToken) { // Ensure it's not an anonymous call
// // // // // //     //     const userAccessToken = await getUserAccessToken(); // Function to get from NextAuth session
// // // // // //     //     if (userAccessToken) {
// // // // // //     //         headers.set('Authorization', `Bearer ${userAccessToken}`);
// // // // // //     //     }
// // // // // //     // }
// // // // // //     // --- End Placeholder ---

// // // // // //     let response: Response;
// // // // // //     try {
// // // // // //         response = await fetch(effectiveUrl, {
// // // // // //             ...options,
// // // // // //             headers, // Use the combined headers object
// // // // // //         });
// // // // // //     } catch (error: any) {
// // // // // //         console.error(`apiClient: Network error during fetch to ${effectiveUrl}:`, error);
// // // // // //         throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, effectiveUrl);
// // // // // //     }

// // // // // //     if (!response.ok) {
// // // // // //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// // // // // //         let errorBody = null;
// // // // // //         try {
// // // // // //             errorBody = await response.json();
// // // // // //             // console.error(`apiClient: API Error response from ${effectiveUrl} (Status ${response.status}):`, errorBody);
// // // // // //             if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// // // // // //             else if (errorBody.title) errorDetails = errorBody.title;
// // // // // //             else if (errorBody.detail) errorDetails = errorBody.detail;
// // // // // //             else if (errorBody.message) errorDetails = errorBody.message;
// // // // // //             else if (errorBody.errors && typeof errorBody.errors === 'object') {
// // // // // //                 errorDetails = Object.entries(errorBody.errors)
// // // // // //                     .map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`)
// // // // // //                     .join('; ');
// // // // // //             }
// // // // // //         } catch (parseError) {
// // // // // //             // console.warn(`apiClient: Failed to parse error response as JSON from ${effectiveUrl} (Status ${response.status}). Reading as text.`, parseError);
// // // // // //             const responseText = await response.text().catch(() => response.statusText); // Fallback to statusText
// // // // // //             errorDetails = responseText || `HTTP Error ${response.status}`;
// // // // // //         }
// // // // // //         throw new APIError(response.status, response.statusText, errorDetails, effectiveUrl, errorBody);
// // // // // //     }

// // // // // //     if (response.status === 204) { // No Content
// // // // // //         return undefined as T;
// // // // // //     }

// // // // // //     const contentType = response.headers.get("content-type");
// // // // // //     if (contentType && contentType.includes("application/json")) {
// // // // // //         try {
// // // // // //             const data = await response.json();
// // // // // //             return data as T;
// // // // // //         } catch (error) {
// // // // // //             console.error(`apiClient: Failed to parse successful JSON response from ${effectiveUrl}:`, error);
// // // // // //             throw new APIError(response.status, "JSON Parse Error", `Invalid JSON response from server.`, effectiveUrl, await response.text().catch(() => ""));
// // // // // //         }
// // // // // //     } else if (contentType && contentType.includes("text/plain")) {
// // // // // //         const textData = await response.text();
// // // // // //         return textData as unknown as T; // Caller must expect text
// // // // // //     } else if (!contentType && response.body === null) { // For GET requests that might succeed with no body and no content-type
// // // // // //          return undefined as T;
// // // // // //     }
// // // // // //      else {
// // // // // //         console.warn(`apiClient: Response from ${effectiveUrl} was not JSON (Content-Type: ${contentType}). Returning response object directly for further handling.`);
// // // // // //         // This case is tricky. If T is not Response, this will fail.
// // // // // //         // For now, let's assume caller handles this or it's an error if not JSON and not 204.
// // // // // //         // A more robust solution might be to check if T is 'Response' or throw.
// // // // // //         // Or read as blob/text and let caller decide.
// // // // // //         // Forcing an error if unexpected content type might be safer for now if only JSON/204 is expected.
// // // // // //         const blob = await response.blob(); // Read as blob to avoid issues
// // // // // //         console.log("apiClient: Received non-JSON, non-204 response. Blob size:", blob.size);
// // // // // //         throw new APIError(response.status, "Unexpected Content Type", `Expected JSON or 204, but got ${contentType}`, effectiveUrl);
// // // // // //     }
// // // // // // }


// // // // // // // --- Existing API Client Functions (No change to their signature unless they need anonymous token) ---

// // // // // // export const fetchCities = async (): Promise<CityDto[]> => {
// // // // // //     return await apiFetch<CityDto[]>("/api/cities"); // includeAnonymousToken defaults to false
// // // // // // };

// // // // // // export const fetchSubCategoriesByCity = async (
// // // // // //     citySlug: string,
// // // // // //     concept?: HighLevelConceptQueryParam
// // // // // // ): Promise<SubCategoryDto[]> => {
// // // // // //     if (!citySlug) throw new Error("City slug is required to fetch subcategories.");
// // // // // //     const queryParams: { concept?: HighLevelConceptQueryParam } = {};
// // // // // //     if (concept) queryParams.concept = concept;
// // // // // //     const queryString = buildQueryString(queryParams);
// // // // // //     return await apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${queryString}`);
// // // // // // };

// // // // // // export const fetchShops = async (
// // // // // //     citySlug: string,
// // // // // //     subCategorySlug: string,
// // // // // //     queryParams: FrontendShopQueryParameters
// // // // // // ): Promise<PaginatedResponse<ShopDto>> => {
// // // // // //     if (!citySlug) throw new Error("City slug is required.");
// // // // // //     if (!subCategorySlug) throw new Error("Subcategory slug is required.");
// // // // // //     const apiParams: Record<string, any> = {
// // // // // //         Name: queryParams.name, Services: queryParams.services,
// // // // // //         UserLatitude: queryParams.userLatitude, UserLongitude: queryParams.userLongitude,
// // // // // //         RadiusInMeters: queryParams.radiusInMeters, SortBy: queryParams.sortBy,
// // // // // //         PageNumber: queryParams.pageNumber, PageSize: queryParams.pageSize,
// // // // // //     };
// // // // // //     const queryString = buildQueryString(apiParams);
// // // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${queryString}`;
// // // // // //     return await apiFetch<PaginatedResponse<ShopDto>>(url);
// // // // // // };

// // // // // // export const fetchShopById = async (
// // // // // //     citySlug: string,
// // // // // //     subCategorySlug: string,
// // // // // //     shopId: string
// // // // // // ): Promise<ShopDto> => {
// // // // // //     if (!citySlug || !subCategorySlug || !shopId) throw new Error("City slug, subcategory slug, and shop ID are required.");
// // // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`;
// // // // // //     return await apiFetch<ShopDto>(url);
// // // // // // };

// // // // // // // --- NEW: fetchServicesByShopId (Requires citySlug and subCategorySlug for the designed endpoint) ---
// // // // // // export const fetchServicesByShop = async (
// // // // // //     citySlug: string,
// // // // // //     subCategorySlug: string,
// // // // // //     shopId: string
// // // // // // ): Promise<ShopServiceDto[]> => {
// // // // // //     if (!citySlug || !subCategorySlug || !shopId) {
// // // // // //         throw new Error("City slug, subcategory slug, and shop ID are required to fetch shop services.");
// // // // // //     }
// // // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}/services`;
// // // // // //     return await apiFetch<ShopServiceDto[]>(url); // Anonymous token not typically needed for public listing
// // // // // // };


// // // // // // // --- NEW: API client functions for ANONYMOUS CART ---
// // // // // // // These WILL use includeAnonymousToken: true

// // // // // // // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => {
// // // // // // //     return await apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);
// // // // // // // };

// // // // // // export const getAnonymousCart = async (): Promise<AnonymousCartApiResponse> => {
// // // // // //     return await apiFetch<AnonymousCartApiResponse>(ANON_PATHS.CART, {}, true);
// // // // // // };

// // // // // // export const addToAnonymousCart = async (item: AddToAnonymousCartRequest): Promise<AnonymousCartApiResponse> => {
// // // // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // // // //         ANON_PATHS.CART_ITEMS,
// // // // // //         {
// // // // // //             method: 'POST',
// // // // // //             body: JSON.stringify(item)
// // // // // //         },
// // // // // //         true
// // // // // //     );
// // // // // // };

// // // // // // export const updateAnonymousCartItem = async (
// // // // // //     anonymousCartItemId: string, // Item identified by its own GUID
// // // // // //     itemUpdateBody: UpdateAnonymousCartItemApiBody // Body contains { newQuantity: number }
// // // // // // ): Promise<AnonymousCartApiResponse> => {
// // // // // //     const path = ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId); 
// // // // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // // // //         path,
// // // // // //         {
// // // // // //             method: 'PUT',
// // // // // //             body: JSON.stringify(itemUpdateBody)
// // // // // //         },
// // // // // //         true
// // // // // //     );
// // // // // // };


// // // // // // export const removeAnonymousCartItem = async (
// // // // // //     anonymousCartItemId: string // Item identified by its own GUID
// // // // // // ): Promise<AnonymousCartApiResponse> => { 
// // // // // //     const path = ANON_PATHS.CART_ITEM_BY_ID(anonymousCartItemId);
// // // // // //     return await apiFetch<AnonymousCartApiResponse>(
// // // // // //         path,
// // // // // //         { method: 'DELETE' },
// // // // // //         true
// // // // // //     );
// // // // // // };

// // // // // // export const clearAnonymousCart = async (): Promise<void> => {
// // // // // //     return await apiFetch<void>(ANON_PATHS.CART, { method: 'DELETE' }, true);
// // // // // // };
// // // // // // // // src/lib/apiClient.ts
// // // // // // // import { 
// // // // // // //     PaginatedResponse, 
// // // // // // //     ShopDto, 
// // // // // // //     FrontendShopQueryParameters,
// // // // // // //     CityDto,
// // // // // // //     SubCategoryDto,
// // // // // // //     HighLevelConceptQueryParam,
// // // // // // //     APIError
// // // // // // // } from '@/types/api';

// // // // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5068'; // Fallback for safety


// // // // // // // // Helper function to construct query strings
// // // // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
// // // // // // //     const searchParams = new URLSearchParams();
// // // // // // //     Object.entries(params).forEach(([key, value]) => {
// // // // // // //         if (value !== undefined && value !== null && value !== '') {
// // // // // // //             searchParams.append(key, String(value));
// // // // // // //         }
// // // // // // //     });
// // // // // // //     return searchParams.toString();
// // // // // // // }

// // // // // // // // Generic fetch wrapper
// // // // // // // async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
// // // // // // //     if (!API_BASE_URL) {
// // // // // // //         // This should ideally not happen if NEXT_PUBLIC_API_BASE_URL is set
// // // // // // //         console.error("API_BASE_URL is not defined. Check .env.local or build variables.");
// // // // // // //         throw new Error("API configuration error. Base URL is missing.");
// // // // // // //     }

// // // // // // //     console.log("Frontend API Request:", `${API_BASE_URL}${url}`);
// // // // // // //     let response: Response;
    
// // // // // // //     try {
// // // // // // //         response = await fetch(`${API_BASE_URL}${url}`, {
// // // // // // //             headers: {
// // // // // // //                 'Accept': 'application/json', // Explicitly ask for JSON
// // // // // // //                 'Content-Type': 'application/json', // If sending a body
// // // // // // //                 ...options?.headers,
// // // // // // //             },
// // // // // // //             ...options,
// // // // // // //         });
// // // // // // //     } catch (error: any) {
// // // // // // //         console.error(`Network error during fetch to ${API_BASE_URL}${url}:`, error);
// // // // // // //         throw new APIError(0, "Network Error", `Network error: ${error.message || 'Please check your internet connection.'}`, `${API_BASE_URL}${url}`);
// // // // // // //     }

// // // // // // //     if (!response.ok) {
// // // // // // //         let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
// // // // // // //         let errorBody = null;
// // // // // // //         try {
// // // // // // //             errorBody = await response.json();
// // // // // // //             console.error(`API Error response from ${API_BASE_URL}${url} (Status ${response.status}):`, errorBody);
// // // // // // //             if (errorBody.title && errorBody.detail) errorDetails = `${errorBody.title}: ${errorBody.detail}`;
// // // // // // //             else if (errorBody.title) errorDetails = errorBody.title;
// // // // // // //             else if (errorBody.detail) errorDetails = errorBody.detail;
// // // // // // //             else if (errorBody.message) errorDetails = errorBody.message;
// // // // // // //             // Handle ASP.NET Core ValidationProblemDetails
// // // // // // //             else if (errorBody.errors && typeof errorBody.errors === 'object') {
// // // // // // //                 errorDetails = Object.entries(errorBody.errors)
// // // // // // //                     .map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`)
// // // // // // //                     .join('; ');
// // // // // // //             }
// // // // // // //         } catch (parseError) {
// // // // // // //             console.warn(`Failed to parse error response as JSON from ${API_BASE_URL}${url} (Status ${response.status}):`, parseError);
// // // // // // //             // Use the statusText if body parsing fails
// // // // // // //             errorDetails = response.statusText || `HTTP Error ${response.status}`;
// // // // // // //         }
// // // // // // //         throw new APIError(response.status, response.statusText, errorDetails, `${API_BASE_URL}${url}`, errorBody);
// // // // // // //     }

// // // // // // //     // Handle 204 No Content (or other successful but empty responses)
// // // // // // //     if (response.status === 204) {
// // // // // // //         return undefined as T; 
// // // // // // //     }

// // // // // // //     try {
// // // // // // //         const data = await response.json();
// // // // // // //         return data;
// // // // // // //     } catch (error) {
// // // // // // //         console.error(`Failed to parse successful JSON response from ${API_BASE_URL}${url}:`, error);
// // // // // // //         throw new Error(`Invalid response format. Server returned OK but response was not valid JSON.`);
// // // // // // //     }
// // // // // // // }

// // // // // // // // --- New API Client Functions ---

// // // // // // // export const fetchCities = async (): Promise<CityDto[]> => {
// // // // // // //     return await apiFetch<CityDto[]>("/api/cities");
// // // // // // // };

// // // // // // // export const fetchSubCategoriesByCity = async (
// // // // // // //     citySlug: string, 
// // // // // // //     concept?: HighLevelConceptQueryParam // "Maintenance" or "Marketplace"
// // // // // // // ): Promise<SubCategoryDto[]> => {
// // // // // // //     if (!citySlug) throw new Error("City slug is required to fetch subcategories.");
    
// // // // // // //     const queryParams: { concept?: HighLevelConceptQueryParam } = {};
// // // // // // //     if (concept) {
// // // // // // //         queryParams.concept = concept;
// // // // // // //     }
// // // // // // //     const queryString = buildQueryString(queryParams);
    
// // // // // // //     return await apiFetch<SubCategoryDto[]>(`/api/cities/${encodeURIComponent(citySlug)}/subcategories?${queryString}`);
// // // // // // // };

// // // // // // // // --- Modified API Client Functions ---

// // // // // // // export const fetchShops = async (
// // // // // // //     citySlug: string,
// // // // // // //     subCategorySlug: string,
// // // // // // //     queryParams: FrontendShopQueryParameters // These are for filtering, sorting, pagination
// // // // // // // ): Promise<PaginatedResponse<ShopDto>> => {
// // // // // // //     if (!citySlug) throw new Error("City slug is required for fetching shops.");
// // // // // // //     if (!subCategorySlug) throw new Error("Subcategory slug is required for fetching shops.");

// // // // // // //     const apiParams: Record<string, any> = {
// // // // // // //         Name: queryParams.name,
// // // // // // //         Services: queryParams.services,
// // // // // // //         UserLatitude: queryParams.userLatitude,
// // // // // // //         UserLongitude: queryParams.userLongitude,
// // // // // // //         RadiusInMeters: queryParams.radiusInMeters,
// // // // // // //         SortBy: queryParams.sortBy,
// // // // // // //         PageNumber: queryParams.pageNumber,
// // // // // // //         PageSize: queryParams.pageSize,
// // // // // // //     };
    
// // // // // // //     const queryString = buildQueryString(apiParams);
// // // // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops?${queryString}`;
    
// // // // // // //     return await apiFetch<PaginatedResponse<ShopDto>>(url);
// // // // // // // };

// // // // // // // export const fetchShopById = async (
// // // // // // //     citySlug: string,
// // // // // // //     subCategorySlug: string,
// // // // // // //     shopId: string // This is a GUID string
// // // // // // // ): Promise<ShopDto> => {
// // // // // // //     if (!citySlug) throw new Error("City slug is required for fetching shop details.");
// // // // // // //     if (!subCategorySlug) throw new Error("Subcategory slug is required for fetching shop details.");
// // // // // // //     if (!shopId || shopId.trim() === '') throw new Error("Shop ID is required for fetching shop details.");

// // // // // // //     const url = `/api/cities/${encodeURIComponent(citySlug)}/categories/${encodeURIComponent(subCategorySlug)}/shops/${encodeURIComponent(shopId.trim())}`;
    
// // // // // // //     return await apiFetch<ShopDto>(url);
// // // // // // // };
// // // // // // // // // src/lib/apiClient.ts
// // // // // // // // import { PaginatedResponse, ShopDto, FrontendShopQueryParameters } from '@/types/api';

// // // // // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// // // // // // // // // Custom API Error class (remains the same)
// // // // // // // // export class APIError extends Error {
// // // // // // // //   constructor(
// // // // // // // //     public status: number,
// // // // // // // //     public statusText: string,
// // // // // // // //     message: string,
// // // // // // // //     public url: string
// // // // // // // //   ) {
// // // // // // // //     super(message);
// // // // // // // //     this.name = 'APIError';
// // // // // // // //   }
// // // // // // // // }

// // // // // // // // // Helper function to construct query strings (remains the same)
// // // // // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
// // // // // // // //     const searchParams = new URLSearchParams();
// // // // // // // //     for (const key in params) {
// // // // // // // //         const value = params[key];
// // // // // // // //         if (value !== undefined && value !== null && value !== '') {
// // // // // // // //             if (typeof value === 'boolean') {
// // // // // // // //                 searchParams.append(key, String(value));
// // // // // // // //             } else {
// // // // // // // //                 searchParams.append(key, String(value));
// // // // // // // //             }
// // // // // // // //         }
// // // // // // // //     }
// // // // // // // //     return searchParams.toString();
// // // // // // // // }

// // // // // // // // // Generic fetch wrapper (remains the same)
// // // // // // // // async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
// // // // // // // //     if (!API_BASE_URL) {
// // // // // // // //         throw new Error("API_BASE_URL is not defined. Please check your .env.local file.");
// // // // // // // //     }
// // // // // // // //     console.log("API Request:", url); // For debugging
// // // // // // // //     let response: Response;
// // // // // // // //     try {
// // // // // // // //         response = await fetch(url, {
// // // // // // // //             headers: { 'Content-Type': 'application/json', ...options?.headers, },
// // // // // // // //             ...options,
// // // // // // // //         });
// // // // // // // //     } catch (error) {
// // // // // // // //         console.error("Network error:", error);
// // // // // // // //         throw new Error("Network error: Please check your internet connection and try again.");
// // // // // // // //     }
// // // // // // // //     console.log("API Response status:", response.status, response.statusText); // For debugging
// // // // // // // //     if (!response.ok) {
// // // // // // // //         let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
// // // // // // // //         try {
// // // // // // // //             const errorData = await response.json();
// // // // // // // //             console.error("API Error response:", errorData);
// // // // // // // //             if (errorData.title) errorDetails = errorData.title;
// // // // // // // //             else if (errorData.errors) errorDetails = Object.entries(errorData.errors).map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`).join('; ');
// // // // // // // //             else if (errorData.detail) errorDetails = errorData.detail;
// // // // // // // //             else if (typeof errorData === 'string') errorDetails = errorData;
// // // // // // // //             else if (errorData.message) errorDetails = errorData.message;
// // // // // // // //         } catch (parseError) { console.warn("Failed to parse error response as JSON:", parseError); }
// // // // // // // //         throw new APIError(response.status, response.statusText, errorDetails, url);
// // // // // // // //     }
// // // // // // // //     try {
// // // // // // // //         const data = await response.json();
// // // // // // // //         // console.log("API Response data:", data); // For debugging, can be verbose
// // // // // // // //         return data;
// // // // // // // //     } catch (error) {
// // // // // // // //         console.error("Failed to parse response as JSON:", error);
// // // // // // // //         throw new Error("Invalid response format: Expected JSON but received invalid data.");
// // // // // // // //     }
// // // // // // // // }

// // // // // // // // export const fetchShops = async (queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => {
// // // // // // // //     if (queryParams.pageNumber && queryParams.pageNumber < 1) {
// // // // // // // //         throw new Error("Page number must be greater than 0");
// // // // // // // //     }
// // // // // // // //     if (queryParams.pageSize && (queryParams.pageSize < 1 || queryParams.pageSize > 100)) { // Max page size check can be more aligned with backend
// // // // // // // //         throw new Error("Page size must be between 1 and 100");
// // // // // // // //     }

// // // // // // // //     const apiParams: Record<string, any> = {
// // // // // // // //         Name: queryParams.name?.trim() || undefined,
// // // // // // // //         Category: queryParams.category || undefined, // Add Category parameter
// // // // // // // //         Services: queryParams.services?.trim() || undefined,
// // // // // // // //         UserLatitude: queryParams.userLatitude,
// // // // // // // //         UserLongitude: queryParams.userLongitude,
// // // // // // // //         RadiusInMeters: queryParams.radiusInMeters,
// // // // // // // //         SortBy: queryParams.sortBy?.trim() || undefined,
// // // // // // // //         PageNumber: queryParams.pageNumber || 1,
// // // // // // // //         PageSize: queryParams.pageSize || 10,
// // // // // // // //     };
    
// // // // // // // //     const queryString = buildQueryString(apiParams);
// // // // // // // //     const url = `${API_BASE_URL}/shops?${queryString}`;
    
// // // // // // // //     const result = await apiFetch<PaginatedResponse<ShopDto>>(url);
    
// // // // // // // //     if (!result || typeof result !== 'object' || !Array.isArray(result.data) || !result.pagination || typeof result.pagination !== 'object') {
// // // // // // // //         throw new Error("Invalid response structure from fetchShops");
// // // // // // // //     }
// // // // // // // //     const pagination = result.pagination;
// // // // // // // //     if (typeof pagination.currentPage !== 'number' || typeof pagination.totalPages !== 'number' || typeof pagination.hasNextPage !== 'boolean') {
// // // // // // // //         throw new Error("Invalid response: pagination object is missing required properties");
// // // // // // // //     }
// // // // // // // //     return result;
// // // // // // // // };

// // // // // // // // // fetchShopById remains the same
// // // // // // // // export const fetchShopById = async (id: string): Promise<ShopDto> => {
// // // // // // // //     if (!id || typeof id !== 'string' || id.trim() === '') {
// // // // // // // //         throw new Error("Shop ID is required and must be a non-empty string");
// // // // // // // //     }
// // // // // // // //     const url = `${API_BASE_URL}/shops/${encodeURIComponent(id.trim())}`;
// // // // // // // //     const result = await apiFetch<ShopDto>(url);
// // // // // // // //     if (!result || typeof result !== 'object' || !result.id || typeof result.id !== 'string') {
// // // // // // // //         throw new Error("Invalid response: Expected a shop object with a valid ID");
// // // // // // // //     }
// // // // // // // //     return result;
// // // // // // // // };
// // // // // // // // // // src/lib/apiClient.ts
// // // // // // // // // import { PaginatedResponse, ShopDto, FrontendShopQueryParameters } from '@/types/api';

// // // // // // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// // // // // // // // // // Custom API Error class for better error handling
// // // // // // // // // export class APIError extends Error {
// // // // // // // // //   constructor(
// // // // // // // // //     public status: number,
// // // // // // // // //     public statusText: string,
// // // // // // // // //     message: string,
// // // // // // // // //     public url: string
// // // // // // // // //   ) {
// // // // // // // // //     super(message);
// // // // // // // // //     this.name = 'APIError';
// // // // // // // // //   }
// // // // // // // // // }

// // // // // // // // // // Helper function to construct query strings, handling undefined values
// // // // // // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
// // // // // // // // //     const searchParams = new URLSearchParams();
// // // // // // // // //     for (const key in params) {
// // // // // // // // //         const value = params[key];
// // // // // // // // //         if (value !== undefined && value !== null && value !== '') {
// // // // // // // // //             // Ensure boolean true is "true", false is "false"
// // // // // // // // //             if (typeof value === 'boolean') {
// // // // // // // // //                 searchParams.append(key, String(value));
// // // // // // // // //             } else {
// // // // // // // // //                 searchParams.append(key, String(value));
// // // // // // // // //             }
// // // // // // // // //         }
// // // // // // // // //     }
// // // // // // // // //     return searchParams.toString();
// // // // // // // // // }

// // // // // // // // // // Generic fetch wrapper with better error handling
// // // // // // // // // async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
// // // // // // // // //     if (!API_BASE_URL) {
// // // // // // // // //         throw new Error("API_BASE_URL is not defined. Please check your .env.local file.");
// // // // // // // // //     }

// // // // // // // // //     console.log("API Request:", url);

// // // // // // // // //     let response: Response;
    
// // // // // // // // //     try {
// // // // // // // // //         response = await fetch(url, {
// // // // // // // // //             headers: {
// // // // // // // // //                 'Content-Type': 'application/json',
// // // // // // // // //                 ...options?.headers,
// // // // // // // // //             },
// // // // // // // // //             ...options,
// // // // // // // // //         });
// // // // // // // // //     } catch (error) {
// // // // // // // // //         // Network errors (no internet, server down, etc.)
// // // // // // // // //         console.error("Network error:", error);
// // // // // // // // //         throw new Error("Network error: Please check your internet connection and try again.");
// // // // // // // // //     }

// // // // // // // // //     console.log("API Response status:", response.status, response.statusText);

// // // // // // // // //     if (!response.ok) {
// // // // // // // // //         let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
// // // // // // // // //         let errorDetails = errorMessage;

// // // // // // // // //         try {
// // // // // // // // //             const errorData = await response.json();
// // // // // // // // //             console.error("API Error response:", errorData);

// // // // // // // // //             if (errorData.title) {
// // // // // // // // //                 errorDetails = errorData.title;
// // // // // // // // //             } else if (errorData.errors) { 
// // // // // // // // //                 errorDetails = Object.entries(errorData.errors)
// // // // // // // // //                     .map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`)
// // // // // // // // //                     .join('; ');
// // // // // // // // //             } else if (errorData.detail) {
// // // // // // // // //                 errorDetails = errorData.detail;
// // // // // // // // //             } else if (typeof errorData === 'string') {
// // // // // // // // //                 errorDetails = errorData;
// // // // // // // // //             } else if (errorData.message) {
// // // // // // // // //                 errorDetails = errorData.message;
// // // // // // // // //             }
// // // // // // // // //         } catch (parseError) {
// // // // // // // // //             console.warn("Failed to parse error response as JSON:", parseError);
// // // // // // // // //             // Use the default HTTP status message
// // // // // // // // //         }

// // // // // // // // //         throw new APIError(response.status, response.statusText, errorDetails, url);
// // // // // // // // //     }

// // // // // // // // //     try {
// // // // // // // // //         const data = await response.json();
// // // // // // // // //         console.log("API Response data:", data);
// // // // // // // // //         return data;
// // // // // // // // //     } catch (error) {
// // // // // // // // //         console.error("Failed to parse response as JSON:", error);
// // // // // // // // //         throw new Error("Invalid response format: Expected JSON but received invalid data.");
// // // // // // // // //     }
// // // // // // // // // }

// // // // // // // // // export const fetchShops = async (queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => {
// // // // // // // // //     // Validate required parameters
// // // // // // // // //     if (queryParams.pageNumber && queryParams.pageNumber < 1) {
// // // // // // // // //         throw new Error("Page number must be greater than 0");
// // // // // // // // //     }
    
// // // // // // // // //     if (queryParams.pageSize && (queryParams.pageSize < 1 || queryParams.pageSize > 100)) {
// // // // // // // // //         throw new Error("Page size must be between 1 and 100");
// // // // // // // // //     }

// // // // // // // // //     // Map FrontendShopQueryParameters to backend expected names (case-sensitive)
// // // // // // // // //     const apiParams: Record<string, any> = {
// // // // // // // // //         Name: queryParams.name?.trim() || undefined,
// // // // // // // // //         Services: queryParams.services?.trim() || undefined,
// // // // // // // // //         UserLatitude: queryParams.userLatitude,
// // // // // // // // //         UserLongitude: queryParams.userLongitude,
// // // // // // // // //         RadiusInMeters: queryParams.radiusInMeters,
// // // // // // // // //         SortBy: queryParams.sortBy?.trim() || undefined,
// // // // // // // // //         PageNumber: queryParams.pageNumber || 1,
// // // // // // // // //         PageSize: queryParams.pageSize || 10,
// // // // // // // // //     };
    
// // // // // // // // //     const queryString = buildQueryString(apiParams);
// // // // // // // // //     const url = `${API_BASE_URL}/shops?${queryString}`;
    
// // // // // // // // //     const result = await apiFetch<PaginatedResponse<ShopDto>>(url);
    
// // // // // // // // //     // Validate the response structure
// // // // // // // // //     if (!result || typeof result !== 'object') {
// // // // // // // // //         throw new Error("Invalid response: Expected an object");
// // // // // // // // //     }
    
// // // // // // // // //     if (!Array.isArray(result.data)) {
// // // // // // // // //         throw new Error("Invalid response: 'data' should be an array");
// // // // // // // // //     }
    
// // // // // // // // //     if (!result.pagination || typeof result.pagination !== 'object') {
// // // // // // // // //         throw new Error("Invalid response: 'pagination' should be an object");
// // // // // // // // //     }
    
// // // // // // // // //     // Ensure pagination properties exist
// // // // // // // // //     const pagination = result.pagination;
// // // // // // // // //     if (typeof pagination.currentPage !== 'number' || 
// // // // // // // // //         typeof pagination.totalPages !== 'number' || 
// // // // // // // // //         typeof pagination.hasNextPage !== 'boolean') {
// // // // // // // // //         throw new Error("Invalid response: pagination object is missing required properties");
// // // // // // // // //     }
    
// // // // // // // // //     return result;
// // // // // // // // // };

// // // // // // // // // export const fetchShopById = async (id: string): Promise<ShopDto> => {
// // // // // // // // //     if (!id || typeof id !== 'string' || id.trim() === '') {
// // // // // // // // //         throw new Error("Shop ID is required and must be a non-empty string");
// // // // // // // // //     }

// // // // // // // // //     const url = `${API_BASE_URL}/shops/${encodeURIComponent(id.trim())}`;
    
// // // // // // // // //     const result = await apiFetch<ShopDto>(url);
    
// // // // // // // // //     // Validate the response structure
// // // // // // // // //     if (!result || typeof result !== 'object') {
// // // // // // // // //         throw new Error("Invalid response: Expected a shop object");
// // // // // // // // //     }
    
// // // // // // // // //     if (!result.id || typeof result.id !== 'string') {
// // // // // // // // //         throw new Error("Invalid response: Shop must have a valid ID");
// // // // // // // // //     }
    
// // // // // // // // //     return result;
// // // // // // // // // };
// // // // // // // // // // // src/lib/apiClient.ts
// // // // // // // // // // import { PaginatedResponse, ShopDto, FrontendShopQueryParameters } from '@/types/api'; // We'll create these types next

// // // // // // // // // // const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// // // // // // // // // // // Helper function to construct query strings, handling undefined values
// // // // // // // // // // function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
// // // // // // // // // //     const searchParams = new URLSearchParams();
// // // // // // // // // //     for (const key in params) {
// // // // // // // // // //         if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
// // // // // // // // // //              // Ensure boolean true is "true", false is "false"
// // // // // // // // // //             if (typeof params[key] === 'boolean') {
// // // // // // // // // //                 searchParams.append(key, String(params[key]));
// // // // // // // // // //             } else {
// // // // // // // // // //                 searchParams.append(key, String(params[key]));
// // // // // // // // // //             }
// // // // // // // // // //         }
// // // // // // // // // //     }
// // // // // // // // // //     return searchParams.toString();
// // // // // // // // // // }


// // // // // // // // // // export const fetchShops = async (queryParams: FrontendShopQueryParameters): Promise<PaginatedResponse<ShopDto>> => {
// // // // // // // // // //     if (!API_BASE_URL) {
// // // // // // // // // //         throw new Error("API_BASE_URL is not defined. Please check your .env.local file.");
// // // // // // // // // //     }

// // // // // // // // // //     // Map FrontendShopQueryParameters to backend expected names (case-sensitive)
// // // // // // // // // //     const apiParams: Record<string, any> = {
// // // // // // // // // //         Name: queryParams.name,
// // // // // // // // // //         Services: queryParams.services,
// // // // // // // // // //         UserLatitude: queryParams.userLatitude,
// // // // // // // // // //         UserLongitude: queryParams.userLongitude,
// // // // // // // // // //         RadiusInMeters: queryParams.radiusInMeters,
// // // // // // // // // //         SortBy: queryParams.sortBy,
// // // // // // // // // //         PageNumber: queryParams.pageNumber || 1, // Backend expects PageNumber, not pageNumber
// // // // // // // // // //         PageSize: queryParams.pageSize || 10,   // Backend expects PageSize, not pageSize
// // // // // // // // // //     };
    
// // // // // // // // // //     const queryString = buildQueryString(apiParams);
// // // // // // // // // //     const url = `${API_BASE_URL}/shops?${queryString}`;
    
// // // // // // // // // //     console.log("Fetching shops from URL:", url); // For debugging

// // // // // // // // // //     const response = await fetch(url);
    
// // // // // // // // // //     if (!response.ok) {
// // // // // // // // // //         let errorDetails = `Failed to fetch shops. Status: ${response.status}`;
// // // // // // // // // //         try {
// // // // // // // // // //             const errorData = await response.json();
// // // // // // // // // //             if (errorData.title) {
// // // // // // // // // //                  errorDetails = errorData.title;
// // // // // // // // // //             } else if (errorData.errors) { 
// // // // // // // // // //                 errorDetails = Object.entries(errorData.errors)
// // // // // // // // // //                     .map(([key, messages]) => `${key}: ${(messages as string[]).join(', ')}`)
// // // // // // // // // //                     .join('; ');
// // // // // // // // // //             } else if (errorData.detail) {
// // // // // // // // // //                 errorDetails = errorData.detail;
// // // // // // // // // //             } else if (typeof errorData === 'string') {
// // // // // // // // // //                 errorDetails = errorData;
// // // // // // // // // //             }
// // // // // // // // // //         } catch (e) { /* Failed to parse error JSON, use default status text or generic message */ 
// // // // // // // // // //             errorDetails = response.statusText || "An unknown error occurred while fetching shops.";
// // // // // // // // // //         }
// // // // // // // // // //         throw new Error(errorDetails);
// // // // // // // // // //     }
// // // // // // // // // //     return response.json();
// // // // // // // // // // };

// // // // // // // // // // export const fetchShopById = async (id: string): Promise<ShopDto> => {
// // // // // // // // // //     if (!API_BASE_URL) {
// // // // // // // // // //         throw new Error("API_BASE_URL is not defined. Please check your .env.local file.");
// // // // // // // // // //     }
// // // // // // // // // //     const url = `${API_BASE_URL}/shops/${id}`;
// // // // // // // // // //     console.log("Fetching shop by ID from URL:", url); // For debugging

// // // // // // // // // //     const response = await fetch(url);
// // // // // // // // // //     if (!response.ok) {
// // // // // // // // // //         let errorDetails = `Failed to fetch shop details. Status: ${response.status}`;
// // // // // // // // // //          try {
// // // // // // // // // //             const errorData = await response.json();
// // // // // // // // // //             if (errorData.title) errorDetails = errorData.title;
// // // // // // // // // //             else if (errorData.detail) errorDetails = errorData.detail;
// // // // // // // // // //         } catch (e) { /* Failed to parse error JSON */ }
// // // // // // // // // //         throw new Error(errorDetails);
// // // // // // // // // //     }
// // // // // // // // // //     return response.json();
// // // // // // // // // // };