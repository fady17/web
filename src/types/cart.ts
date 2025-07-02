// src/types/cart.ts 
export interface DisplayableCartItem {
  id: string; // This will hold either anonymousCartItemId or userCartItemId
  itemType: 'anonymous' | 'user'; // To distinguish if needed by handlers
  shopId: string;
  shopServiceId: string;
  quantity: number;
  serviceNameEn: string;
  serviceNameAr: string;
  priceAtAddition: number;
  shopNameSnapshotEn?: string | null;
  shopNameSnapshotAr?: string | null;
  serviceImageUrlSnapshot?: string | null;
  // addedAt: string; // Not strictly needed for display item but good for sorting
}