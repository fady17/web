// src/types/api.ts

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public url: string,
    public errorData?: any
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export type HighLevelConceptNumber = 1 | 2 | 0;
export type HighLevelConceptQueryParam = "Maintenance" | "Marketplace";

// CityDto remains for the legacy /api/cities endpoint or other uses
export interface CityDto {
    id: number;
    nameEn: string;
    nameAr: string;
    slug: string;
    stateProvince?: string | null;
    country: string;
    latitude: number; // Centroid
    longitude: number; // Centroid
    isActive: boolean;
}

// --- NEW: OperationalAreaDto for the /api/operational-areas-for-map endpoint ---
export interface OperationalAreaDto {
    id: number;
    nameEn: string;
    nameAr: string;
    slug: string;
    isActive: boolean;
    centroidLatitude: number;
    centroidLongitude: number;
    defaultSearchRadiusMeters?: number | null;
    defaultMapZoomLevel?: number | null;
    geometry?: string | null;
    displayLevel?: string | null; 
}

// --- NEW: Properties expected within a GeoJSON Feature for an Operational Area ---
// This will be used for interactions (e.g., onClick payload)
export interface OperationalAreaFeatureProperties {
    id: number;
    nameEn: string;
    nameAr: string;
    slug: string;
    centroidLatitude: number;
    centroidLongitude: number;
    defaultSearchRadiusMeters?: number | null;
    defaultMapZoomLevel?: number | null;
    displayLevel?: string | null;
    // Add any other properties from OperationalAreaDto (excluding geometry)

}
// --- END NEW ---


export interface SubCategoryDto {
    subCategoryEnum: number; // Expecting the integer value from the API
    name: string;
    slug: string;
    shopCount: number;
    concept: HighLevelConceptNumber; // Expecting 0, 1, or 2
}

export interface ShopDto {
    id: string;
    nameEn: string;
    nameAr: string;
    slug?: string | null; // Shop's own slug
    logoUrl?: string | null;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    address: string;
    latitude: number; // Shop's specific latitude
    longitude: number; // Shop's specific longitude
    phoneNumber?: string | null;
    servicesOffered?: string | null; 
    openingHours?: string | null;
    
    // Shop's Primary Category Information
    // Assuming the backend DTO's 'subCategory' field actually holds the ShopCategory enum value
    // and 'concept' holds the HighLevelConcept enum value.
    // The frontend DTO will receive these as numbers.
    category: number; // Represents ShopCategory enum value
    categoryName: string; // Derived on client or sent from backend
    categorySlug: string; // Derived on client or sent from backend
    
    // Operational Area Information (replaces CityId)
    operationalAreaId: number;
    operationalAreaNameEn?: string; // Optional: if backend includes it in ShopDto
    operationalAreaNameAr?: string;   // Optional
    operationalAreaSlug?: string;   // Optional

    concept: HighLevelConceptNumber; // e.g., 0, 1, or 2

    distanceInMeters?: number | null;

    // REMOVED: cityId, subCategory, subCategoryName, subCategorySlug (replaced by above)
}


export interface PaginationMetadata {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

export interface FrontendShopQueryParameters {
    name?: string;
    services?: string;
    userLatitude?: number;
    userLongitude?: number;
    radiusInMeters?: number;
    pageNumber?: number;
    pageSize?: number;
    sortBy?: string;
    // NEW: Optional parameter to filter by operational area slug when querying shops
    areaSlug?: string; 
}

export interface ShopServiceDto {
    shopServiceId: string;
    shopId: string;
    nameEn: string;
    nameAr: string;
    descriptionEn?: string | null;
    descriptionAr?: string | null;
    price: number;
    durationMinutes?: number | null;
    iconUrl?: string | null;
    isPopularAtShop: boolean;
    sortOrder: number;
    globalServiceId?: number | null;
    globalServiceCode?: string | null;
}

// --- AUTHENTICATED USER CART TYPES ---
export interface UserCartItemDto {
  userCartItemId: string; 
  shopId: string;
  shopServiceId: string;
  quantity: number;
  serviceNameEn: string;
  serviceNameAr: string;
  priceAtAddition: number;
  shopNameSnapshotEn?: string | null;
  shopNameSnapshotAr?: string | null;
  serviceImageUrlSnapshot?: string | null;
  addedAtUtc: string;
  updatedAtUtc: string;
}

export interface AddToUserCartRequestDto { 
  shopId: string;
  shopServiceId: string;
  quantity: number;
}

export interface UpdateUserCartItemQuantityRequestDto { 
  newQuantity: number;
}

export interface UserCartApiResponseDto {
  userId: string;
  items: UserCartItemDto[];
  totalItems: number;
  totalAmount: number;
  lastUpdatedAt: string;
  currencyCode?: string;
}
// // src/types/api.ts

// export class APIError extends Error {
//   constructor(
//     public status: number,
//     public statusText: string,
//     message: string,
//     public url: string,
//     public errorData?: any
//   ) {
//     super(message);
//     this.name = 'APIError';
//     Object.setPrototypeOf(this, APIError.prototype);
//   }
// }

// export type HighLevelConceptNumber = 1 | 2 | 0;
// export type HighLevelConceptQueryParam = "Maintenance" | "Marketplace";

// export interface CityDto {
//     id: number;
//     nameEn: string;
//     nameAr: string;
//     slug: string;
//     stateProvince?: string | null;
//     country: string;
//     latitude: number;
//     longitude: number;
//     isActive: boolean;
// }

// export interface SubCategoryDto {
//     subCategoryEnum: number;
//     name: string;
//     slug: string;
//     shopCount: number;
//     concept: HighLevelConceptNumber;
// }

// export interface ShopDto {
//     id: string;
//     nameEn: string;
//     nameAr: string;
//     slug?: string | null;
//     logoUrl?: string | null;
//     descriptionEn?: string | null;
//     descriptionAr?: string | null;
//     address: string;
//     latitude: number;
//     longitude: number;
//     phoneNumber?: string | null;
//     servicesOffered?: string | null;
//     openingHours?: string | null;
//     subCategory: number;
//     subCategoryName: string;
//     subCategorySlug: string;
//     concept: HighLevelConceptNumber;
//     cityId: number;
//     distanceInMeters?: number | null;
// }

// export interface PaginationMetadata {
//     totalCount: number;
//     pageSize: number;
//     currentPage: number;
//     totalPages: number;
//     hasPreviousPage: boolean;
//     hasNextPage: boolean;
// }

// export interface PaginatedResponse<T> {
//     data: T[];
//     pagination: PaginationMetadata;
// }

// export interface FrontendShopQueryParameters {
//     name?: string;
//     services?: string;
//     userLatitude?: number;
//     userLongitude?: number;
//     radiusInMeters?: number;
//     pageNumber?: number;
//     pageSize?: number;
//     sortBy?: string;
// }

// export interface ShopServiceDto {
//     shopServiceId: string;
//     shopId: string;
//     nameEn: string;
//     nameAr: string;
//     descriptionEn?: string | null;
//     descriptionAr?: string | null;
//     price: number;
//     durationMinutes?: number | null;
//     iconUrl?: string | null;
//     isPopularAtShop: boolean;
//     sortOrder: number;
//     globalServiceId?: number | null;
//     globalServiceCode?: string | null;
// }

// // --- AUTHENTICATED USER CART TYPES ---
// export interface UserCartItemDto {
//   userCartItemId: string; // PK for UserCartItem entity
//   shopId: string;
//   shopServiceId: string;
//   quantity: number;
//   serviceNameEn: string;
//   serviceNameAr: string;
//   priceAtAddition: number;
//   shopNameSnapshotEn?: string | null;
//   shopNameSnapshotAr?: string | null;
//   serviceImageUrlSnapshot?: string | null;
//   addedAtUtc: string;
//   updatedAtUtc: string;
// }

// export interface AddToUserCartRequestDto { // Can be same as AddToAnonymousCartRequest
//   shopId: string;
//   shopServiceId: string;
//   quantity: number;
// }

// export interface UpdateUserCartItemQuantityRequestDto { // For API request body
//   newQuantity: number;
// }

// export interface UserCartApiResponseDto {
//   userId: string;
//   items: UserCartItemDto[];
//   totalItems: number;
//   totalAmount: number;
//   lastUpdatedAt: string;
//   currencyCode?: string;
// }
// // // src/types/api.ts

// // // Custom API Error class
// // export class APIError extends Error {
// //   constructor(
// //     public status: number,
// //     public statusText: string,
// //     message: string,
// //     public url: string,
// //     public errorData?: any
// //   ) {
// //     super(message);
// //     this.name = 'APIError';
// //     Object.setPrototypeOf(this, APIError.prototype);
// //   }
// // }

// // // Corresponds to backend Models.HighLevelConcept enum
// // export type HighLevelConceptNumber = 1 | 2 | 0;
// // export type HighLevelConceptQueryParam = "Maintenance" | "Marketplace";

// // // Matches backend CityDto
// // export interface CityDto {
// //     id: number;
// //     nameEn: string;
// //     nameAr: string;
// //     slug: string;
// //     stateProvince?: string | null;
// //     country: string;
// //     latitude: number;
// //     longitude: number;
// //     isActive: boolean;
// // }

// // // Matches backend SubCategoryDto
// // export interface SubCategoryDto {
// //     subCategoryEnum: number;
// //     name: string;
// //     slug: string;
// //     shopCount: number;
// //     concept: HighLevelConceptNumber;
// // }

// // // Matches backend ShopDto
// // export interface ShopDto {
// //     id: string;
// //     nameEn: string;
// //     nameAr: string;
// //     slug?: string | null;
// //     logoUrl?: string | null;
// //     descriptionEn?: string | null;
// //     descriptionAr?: string | null;
// //     address: string;
// //     latitude: number;
// //     longitude: number;
// //     phoneNumber?: string | null;
// //     servicesOffered?: string | null; // Still here for now, as ShopCard might use it
// //     openingHours?: string | null;
// //     subCategory: number;
// //     subCategoryName: string;
// //     subCategorySlug: string;
// //     concept: HighLevelConceptNumber;
// //     cityId: number;
// //     distanceInMeters?: number | null;
// // }

// // // Matches backend PaginationMetadata
// // export interface PaginationMetadata {
// //     totalCount: number;
// //     pageSize: number;
// //     currentPage: number;
// //     totalPages: number;
// //     hasPreviousPage: boolean;
// //     hasNextPage: boolean;
// // }

// // // Matches backend PaginatedResponse<T>
// // export interface PaginatedResponse<T> {
// //     data: T[];
// //     pagination: PaginationMetadata;
// // }

// // // Query parameters for fetching a list of shops.
// // export interface FrontendShopQueryParameters {
// //     name?: string;
// //     services?: string;
// //     userLatitude?: number;
// //     userLongitude?: number;
// //     radiusInMeters?: number;
// //     pageNumber?: number;
// //     pageSize?: number;
// //     sortBy?: string;
// // }

// // // Matches backend ShopServiceDto
// // export interface ShopServiceDto {
// //     shopServiceId: string;
// //     shopId: string;
// //     nameEn: string;
// //     nameAr: string;
// //     descriptionEn?: string | null;
// //     descriptionAr?: string | null;
// //     price: number;
// //     durationMinutes?: number | null;
// //     iconUrl?: string | null;
// //     isPopularAtShop: boolean;
// //     sortOrder: number;
// //     globalServiceId?: number | null;
// //     globalServiceCode?: string | null;
// // }

// // // --- NEW: Types for Authenticated User Cart ---

// // /**
// //  * Represents an item in an authenticated user's cart.
// //  * Mirrors backend's UserCartItemDto.
// //  */
// // export interface UserCartItemDto {
// //   userCartItemId: string; // Unique ID for this cart item entry
// //   shopId: string;
// //   shopServiceId: string;
// //   quantity: number;
// //   serviceNameEn: string; // Snapshot
// //   serviceNameAr: string; // Snapshot
// //   priceAtAddition: number; // Snapshot
// //   shopNameSnapshotEn?: string | null;
// //   shopNameSnapshotAr?: string | null;
// //   serviceImageUrlSnapshot?: string | null;
// //   addedAtUtc: string; // ISO string
// //   updatedAtUtc: string; // ISO string
// // }

// // /**
// //  * Request DTO for adding an item to an authenticated user's cart.
// //  * Can often be the same structure as AddToAnonymousCartRequest.
// //  */
// // export interface AddToUserCartRequestDto {
// //   shopId: string;
// //   shopServiceId: string;
// //   quantity: number;
// // }

// // /**
// //  * Request DTO for updating an item's quantity in an authenticated user's cart.
// //  * The item is identified by userCartItemId in the URL.
// //  * Can often be the same structure as UpdateAnonymousCartItemApiBody.
// //  */
// // export interface UpdateUserCartItemQuantityRequestDto {
// //   newQuantity: number;
// // }

// // /**
// //  * API response for authenticated user's cart operations.
// //  */
// // export interface UserCartApiResponseDto {
// //   userId: string; // The authenticated user's ID
// //   items: UserCartItemDto[];
// //   totalItems: number;
// //   totalAmount: number;
// //   lastUpdatedAt: string; // ISO string
// //   currencyCode?: string; // e.g., "EGP"
// // }

// // // --- END NEW User Cart Types ---
// // // // src/types/api.ts

// // // // Custom API Error class
// // // export class APIError extends Error {
// // //   constructor(
// // //     public status: number,
// // //     public statusText: string,
// // //     message: string,
// // //     public url: string,
// // //     public errorData?: any // Optional: to store parsed error body
// // //   ) {
// // //     super(message);
// // //     this.name = 'APIError'; // So you can check error.name === 'APIError'
// // //     Object.setPrototypeOf(this, APIError.prototype); // For correct instanceof behavior
// // //   }
// // // }

// // // // Corresponds to backend Models.HighLevelConcept enum (Maintenance=1, Marketplace=2)
// // // export type HighLevelConceptNumber = 1 | 2 | 0; // 1: Maintenance, 2: Marketplace, 0: Unknown

// // // // String literal type for concept query parameters, if used
// // // export type HighLevelConceptQueryParam = "Maintenance" | "Marketplace";

// // // // Matches backend CityDto (now includes Latitude/Longitude)
// // // export interface CityDto {
// // //     id: number;
// // //     nameEn: string;
// // //     nameAr: string;
// // //     slug: string;
// // //     stateProvince?: string | null;
// // //     country: string;
// // //     latitude: number;
// // //     longitude: number;
// // //     isActive: boolean; 
// // // }

// // // // Matches backend SubCategoryDto
// // // export interface SubCategoryDto {
// // //     subCategoryEnum: number;
// // //     name: string;
// // //     slug: string;
// // //     shopCount: number;
// // //     concept: HighLevelConceptNumber;
// // // }

// // // // Matches backend ShopDto
// // // export interface ShopDto {
// // //     id: string; 
// // //     nameEn: string;
// // //     nameAr: string;
// // //     slug?: string | null;
// // //     logoUrl?: string | null;
// // //     descriptionEn?: string | null;
// // //     descriptionAr?: string | null;
// // //     address: string;
// // //     latitude: number;
// // //     longitude: number;
// // //     phoneNumber?: string | null;
// // //     servicesOffered?: string | null;
// // //     openingHours?: string | null;
// // //     subCategory: number;
// // //     subCategoryName: string;
// // //     subCategorySlug: string;
// // //     concept: HighLevelConceptNumber;
// // //     cityId: number;
// // //     distanceInMeters?: number | null;
// // // }

// // // // Matches backend PaginationMetadata
// // // export interface PaginationMetadata {
// // //     totalCount: number;
// // //     pageSize: number;
// // //     currentPage: number;
// // //     totalPages: number;
// // //     hasPreviousPage: boolean;
// // //     hasNextPage: boolean;
// // // }

// // // // Matches backend PaginatedResponse<T>
// // // export interface PaginatedResponse<T> {
// // //     data: T[];
// // //     pagination: PaginationMetadata;
// // // }

// // // // Query parameters for fetching a list of shops.
// // // export interface FrontendShopQueryParameters {
// // //     name?: string;
// // //     services?: string; 
// // //     userLatitude?: number;
// // //     userLongitude?: number;
// // //     radiusInMeters?: number;
// // //     pageNumber?: number;
// // //     pageSize?: number;
// // //     sortBy?: string;
// // // }
// // // export interface ShopServiceDto {
// // //     shopServiceId: string; // Guid
// // //     shopId: string;        // Guid
// // //     nameEn: string;
// // //     nameAr: string;
// // //     descriptionEn?: string | null;
// // //     descriptionAr?: string | null;
// // //     price: number;
// // //     durationMinutes?: number | null;
// // //     iconUrl?: string | null;
// // //     isPopularAtShop: boolean;
// // //     sortOrder: number;
// // //     globalServiceId?: number | null;
// // //     globalServiceCode?: string | null;
// // // }
// // // // // src/types/api.ts

// // // // // Corresponds to backend Models.HighLevelConcept enum (Maintenance=1, Marketplace=2)
// // // // // We'll use this numeric value directly from the backend.
// // // // // A string version can be derived on the frontend if needed for display or query params.
// // // // export type HighLevelConceptNumber = 1 | 2 | 0; // 1: Maintenance, 2: Marketplace, 0: Unknown

// // // // // String literal type for concept query parameters, if used
// // // // export type HighLevelConceptQueryParam = "Maintenance" | "Marketplace";


// // // // // Matches backend CityDto (now includes Latitude/Longitude)
// // // // export interface CityDto {
// // // //     id: number;
// // // //     nameEn: string;
// // // //     nameAr: string;
// // // //     slug: string;
// // // //     stateProvince?: string | null;
// // // //     country: string;
// // // //     latitude: number;
// // // //     longitude: number;
// // // //     isActive: boolean; 
// // // // }

// // // // // Matches backend SubCategoryDto
// // // // export interface SubCategoryDto {
// // // //     subCategoryEnum: number; // The int value of the ShopCategory enum from backend
// // // //     name: string;            // Name of the subcategory (e.g., "GeneralMaintenance")
// // // //     slug: string;            // URL slug for the subcategory (e.g., "general-maintenance")
// // // //     shopCount: number;
// // // //     concept: HighLevelConceptNumber; // Numeric value (1 for Maintenance, 2 for Marketplace)
// // // // }

// // // // // Matches backend ShopDto (as served by ShopDetailsView)
// // // // export interface ShopDto {
// // // //     id: string; // Guid
// // // //     nameEn: string;
// // // //     nameAr: string;
// // // //     slug?: string | null;       // Shop's own slug (from view's "ShopSlug" or "Slug" depending on view def)
// // // //     logoUrl?: string | null;

// // // //     descriptionEn?: string | null;
// // // //     descriptionAr?: string | null;
// // // //     address: string;
// // // //     latitude: number;           // Shop's own latitude (from view's "ShopLatitude")
// // // //     longitude: number;          // Shop's own longitude (from view's "ShopLongitude")
// // // //     phoneNumber?: string | null;
// // // //     servicesOffered?: string | null;
// // // //     openingHours?: string | null;
    
// // // //     // SubCategory Information
// // // //     subCategory: number;        // int value of ShopCategory enum (e.g., 1 for GeneralMaintenance)
// // // //     subCategoryName: string;    // string representation from DTO e.g., "GeneralMaintenance"
// // // //     subCategorySlug: string;    // slug from DTO e.g., "general-maintenance"
// // // //     concept: HighLevelConceptNumber; // Numeric value (1 for Maintenance, 2 for Marketplace)

// // // //     cityId: number; // Foreign key to City (int)
// // // //     distanceInMeters?: number | null; // Calculated dynamically
// // // // }

// // // // // Matches backend PaginationMetadata
// // // // export interface PaginationMetadata {
// // // //     totalCount: number;
// // // //     pageSize: number;
// // // //     currentPage: number;
// // // //     totalPages: number;
// // // //     hasPreviousPage: boolean;
// // // //     hasNextPage: boolean;
// // // // }

// // // // // Matches backend PaginatedResponse<T>
// // // // export interface PaginatedResponse<T> {
// // // //     data: T[];
// // // //     pagination: PaginationMetadata;
// // // // }

// // // // // Query parameters for fetching a list of shops.
// // // // // These are applied *after* city and subcategory are determined by the URL path.
// // // // export interface FrontendShopQueryParameters {
// // // //     name?: string;
// // // //     services?: string; 
// // // //     userLatitude?: number;
// // // //     userLongitude?: number;
// // // //     radiusInMeters?: number;
// // // //     pageNumber?: number;
// // // //     pageSize?: number;
// // // //     sortBy?: string; // e.g., 'distance_asc', 'name_asc'
// // // //     // No 'category' or 'subCategory' here, as they are part of the URL path.
// // // // }
// // // // // // src/types/api.ts

// // // // // // Matches backend ShopDto
// // // // // export interface ShopDto {
// // // // //     id: string; 
// // // // //     nameEn: string;
// // // // //     nameAr: string;
// // // // //     descriptionEn?: string | null;
// // // // //     descriptionAr?: string | null;
// // // // //     address: string;
// // // // //     latitude: number;
// // // // //     longitude: number;
// // // // //     phoneNumber?: string | null;
// // // // //     servicesOffered?: string | null;
// // // // //     openingHours?: string | null;
// // // // //     category: number; // The numeric value of the ShopCategory enum from backend
// // // // //     categoryName: string;
// // // // //     distanceInMeters?: number | null;
// // // // // }

// // // // // // Matches backend PaginationMetadata
// // // // // export interface PaginationMetadata {
// // // // //     totalCount: number;
// // // // //     pageSize: number;
// // // // //     currentPage: number;
// // // // //     totalPages: number;
// // // // //     hasPreviousPage: boolean;
// // // // //     hasNextPage: boolean;
// // // // // }

// // // // // // Matches backend PaginatedResponse<T>
// // // // // export interface PaginatedResponse<T> {
// // // // //     data: T[];
// // // // //     pagination: PaginationMetadata;
// // // // // }

// // // // // // Represents the query parameters the frontend will manage and send
// // // // // // These names can be camelCase for frontend consistency,
// // // // // // and mapped to PascalCase in apiClient.ts before sending to backend.
// // // // // export interface FrontendShopQueryParameters {
// // // // //     name?: string;
// // // // //     category?: string;
// // // // //     services?: string; 
// // // // //     userLatitude?: number;
// // // // //     userLongitude?: number;
// // // // //     radiusInMeters?: number;
// // // // //     pageNumber?: number;
// // // // //     pageSize?: number;
// // // // //     sortBy?: string; // e.g., 'distance_asc', 'name_asc'
// // // // // }