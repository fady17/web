// src/app/cart/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useCart, DisplayableCartItem } from '@/contexts/CartContext'; // Import DisplayableCartItem
import { ShoppingBag, ArrowLeft, Trash2, Loader2, AlertCircle } from 'lucide-react';
// Removed: import { AnonymousCartItem } from '@/types/anonymous'; // Not needed directly if using DisplayableCartItem
// Removed: import { ShopServiceDto } from '@/types/api'; // Not needed directly
import { Button } from '@/components/ui/button';
import CartListItem from '@/components/cart/CartListItem'; // Import the reusable component

export default function CartPage() {
  const {
    items: cartItems, // Renamed from 'cart.items' for clarity, this is DisplayableCartItem[]
    isLoading,
    error,
    itemCount,
    totalAmount,
    updateItemQuantity, // This expects { itemId: string; itemType: 'anonymous' | 'user'; newQuantity: number; }
    removeItem,       // This expects { itemId: string; itemType: 'anonymous' | 'user'; }
    clearClientCart,
    isUpdatingItemId
  } = useCart();

  // Local handlers like handleQuantityChange and handleRemoveItem are no longer needed here
  // if CartListItem directly calls the context functions (updateItemQuantity, removeItem)
  // by constructing the correct payload { itemId: item.id, itemType: item.itemType, ... }

  if (isLoading && itemCount === 0 && !error) { // Show loading only if truly initial load and no items yet
    return (
      <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Loading your cart...</p>
      </div>
    );
  }

  if (error && itemCount === 0) { // Show critical error if cart is empty and there was an error loading
    return (
      <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center justify-center max-w-md mx-auto rounded-md border border-red-200">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>Error loading cart: {error}</span>
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <ShoppingBag className="w-24 h-24 text-slate-300 mx-auto mb-6" />
        <h1 className="text-2xl font-semibold text-slate-700 mb-2">Your Cart is Empty</h1>
        <p className="text-slate-500 mb-6">
          Looks like you haven't added any services to your cart yet.
        </p>
        <Link href="/" className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
          Browse Services
        </Link>
      </div>
    );
  }

  // Group items by shop for display
  const itemsByShop = cartItems.reduce((acc, item) => { // item is DisplayableCartItem
    const shopKey = item.shopId; // Use shopId for grouping
    if (!acc[shopKey]) {
      acc[shopKey] = {
        shopName: item.shopNameSnapshotEn || `Shop (ID: ...${item.shopId.slice(-6)})`,
        items: []
      };
    }
    acc[shopKey].items.push(item);
    return acc;
  }, {} as Record<string, { shopName: string; items: DisplayableCartItem[] }>);


  return (
    <div className="container mx-auto px-2 sm:px-4 py-8 min-h-[calc(100vh-200px)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 sm:mb-0">
            Your Cart ({itemCount} {itemCount === 1 ? 'service' : 'services'})
        </h1>
        {itemCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearClientCart}
            className="text-red-600 border-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 self-start sm:self-center"
            disabled={isLoading || !!isUpdatingItemId}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Clear Entire Cart
          </Button>
        )}
      </div>

      {error && ( // Display non-critical error above cart items if an operation failed but cart still has items
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>{error}</span>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 space-y-6">
          {Object.entries(itemsByShop).map(([shopId, shopGroup]) => (
            <div key={shopId} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-3">
                Services from: <span className="text-orange-600">{shopGroup.shopName}</span>
              </h2>
              <ul className="divide-y divide-slate-100">
                {shopGroup.items.map((item: DisplayableCartItem) => ( // Explicitly type item here
                  <li key={item.id} className="first:pt-0 last:pb-0 py-1">
                    <CartListItem
                      item={item} // item is DisplayableCartItem, which has .id and .itemType
                      onUpdateQuantity={updateItemQuantity} // Pass context function directly
                      onRemove={removeItem}                 // Pass context function directly
                      isUpdating={isUpdatingItemId === item.id} // Compare with item.id
                      variant="page"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Order Summary Section */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-xl shadow-lg sticky top-24">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">Order Summary</h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal ({itemCount} {itemCount === 1 ? 'service' : 'services'})</span>
                <span className="font-medium text-slate-800">{totalAmount.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Service Fees</span>
                <span className="text-green-600">Calculated at next step</span>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between items-baseline font-bold text-lg text-slate-800">
                <span>Estimated Total</span>
                <span>{totalAmount.toFixed(2)} EGP</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Final price, taxes, and fees will be confirmed upon quote.</p>
            </div>
            <Button
              className="w-full mt-6 bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70 text-md"
              disabled={isLoading || !!isUpdatingItemId || itemCount === 0}
              // onClick={() => router.push('/request-quote')} // Future navigation
            >
              {isLoading || isUpdatingItemId ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Proceed to Request Quote"}
            </Button>
            <Link href="/" className="block text-center mt-4 text-sm text-orange-600 hover:underline font-medium">
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Continue Browsing Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
// // src/app/cart/page.tsx
// 'use client';

// import React from 'react';
// import Link from 'next/link';
// import { useCart } from '@/contexts/CartContext'; // Import payload types from CartContext itself if they are exported there
// import { ShoppingBag, ArrowLeft, Trash2, Loader2, AlertCircle } from 'lucide-react';
// import { AnonymousCartItem } from '@/types/anonymous';
// import { Button } from '@/components/ui/button';
// import CartListItem from '@/components/cart/CartListItem'; // Import the reusable component

// export default function CartPage() {
//   const {
//     cart,
//     isLoading,
//     error,
//     itemCount,
//     totalAmount,
//     updateItemQuantity,
//     removeItem,
//     clearClientCart,
//     isUpdatingItemId
//   } = useCart();

//   // Local handlers are no longer needed as CartListItem calls context functions directly

//   if (isLoading && !cart) {
//     return (
//       <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
//         <p className="text-slate-600">Loading your cart...</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center justify-center max-w-md mx-auto rounded-md border border-red-200">
//             <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>Error loading cart: {error}</span>
//         </div>
//       </div>
//     );
//   }

//   if (!cart || itemCount === 0) {
//     return (
//       <div className="container mx-auto px-4 py-12 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <ShoppingBag className="w-24 h-24 text-slate-300 mx-auto mb-6" />
//         <h1 className="text-2xl font-semibold text-slate-700 mb-2">Your Cart is Empty</h1>
//         <p className="text-slate-500 mb-6">
//           Looks like you haven't added any services to your cart yet.
//         </p>
//         <Link href="/" className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
//           Browse Services
//         </Link>
//       </div>
//     );
//   }

//   const itemsByShop = cart.items.reduce((acc, item) => {
//     const shopKey = item.shopId;
//     if (!acc[shopKey]) {
//       acc[shopKey] = {
//         shopName: item.shopNameSnapshotEn || `Shop (ID ending ...${item.shopId.slice(-6)})`, // Improved fallback
//         items: []
//       };
//     }
//     acc[shopKey].items.push(item);
//     return acc;
//   }, {} as Record<string, { shopName: string; items: AnonymousCartItem[] }>);

//   return (
//     <div className="container mx-auto px-2 sm:px-4 py-8 min-h-[calc(100vh-200px)]">
//       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-slate-200">
//         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 sm:mb-0">
//             Your Cart ({itemCount} {itemCount === 1 ? 'service' : 'services'})
//         </h1>
//         {itemCount > 0 && (
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={clearClientCart}
//             className="text-red-600 border-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 self-start sm:self-center"
//             disabled={isLoading || !!isUpdatingItemId}
//           >
//             <Trash2 className="w-4 h-4 mr-1.5" /> Clear Entire Cart
//           </Button>
//         )}
//       </div>

//       {error && ( // Display error above cart items if any occurred during an operation
//           <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200 flex items-center">
//               <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>{error}</span>
//           </div>
//       )}

//       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
//         <div className="lg:col-span-8 space-y-6">
//           {Object.entries(itemsByShop).map(([shopId, shopGroup]) => (
//             <div key={shopId} className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
//               <h2 className="text-lg font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-3">
//                 Services from: <span className="text-orange-600">{shopGroup.shopName}</span>
//               </h2>
//               <ul className="divide-y divide-slate-100">
//                 {shopGroup.items.map((item) => (
//                   <li key={item.anonymousCartItemId} className="first:pt-0 last:pb-0 py-1"> {/* Adjusted padding for items */}
//                     <CartListItem
//                       item={item}
//                       onUpdateQuantity={updateItemQuantity}
//                       onRemove={removeItem}
//                       isUpdating={isUpdatingItemId === item.anonymousCartItemId}
//                       variant="page"
//                     />
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           ))}
//         </div>

//         <div className="lg:col-span-4">
//           <div className="bg-white p-6 rounded-xl shadow-lg sticky top-24"> {/* top-24 matches header height + some margin */}
//             <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">Order Summary</h2>
//             <div className="space-y-2 text-sm mb-4">
//               <div className="flex justify-between">
//                 <span className="text-slate-600">Subtotal ({itemCount} {itemCount === 1 ? 'service' : 'services'})</span>
//                 <span className="font-medium text-slate-800">{totalAmount.toFixed(2)} EGP</span>
//               </div>
//               <div className="flex justify-between text-slate-600">
//                 <span>Service Fees</span>
//                 <span className="text-green-600">Calculated at next step</span>
//               </div>
//             </div>
//             <div className="border-t border-slate-200 pt-4">
//               <div className="flex justify-between items-baseline font-bold text-lg text-slate-800">
//                 <span>Estimated Total</span>
//                 <span>{totalAmount.toFixed(2)} EGP</span>
//               </div>
//               <p className="text-xs text-slate-500 mt-1">Final price, taxes, and fees will be confirmed upon quote.</p>
//             </div>
//             <Button
//               className="w-full mt-6 bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70 text-md"
//               disabled={isLoading || !!isUpdatingItemId || itemCount === 0}
//               // onClick={() => router.push('/request-quote')} // Example future navigation
//             >
//               {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Proceed to Request Quote"}
//             </Button>
//             <Link href="/" className="block text-center mt-4 text-sm text-orange-600 hover:underline font-medium">
//               <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Continue Browsing Services
//             </Link>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
// // // src/app/cart/page.tsx
// // 'use client'; // This will be a client component to use useCart

// // import React from 'react';
// // import Link from 'next/link';
// // import { useCart } from '@/contexts/CartContext';
// // import { ShoppingBag, ArrowLeft, Trash2, PlusCircle, MinusCircle, Loader2 } from 'lucide-react';
// // // Assuming types are correctly defined
// // import { AnonymousCartItem } from '@/types/anonymous'; 
// // import { ShopServiceDto } from '@/types/api'; // If service DTO has image, etc.

// // // Mock a function to get image URL (replace with actual logic or remove if not used)
// // // const getImageUrl = (item: AnonymousCartItem): string => {
// // //   return item.serviceImageUrlSnapshot || '/images/placeholder-service.png'; // Fallback image
// // // }

// // export default function CartPage() {
// //   const { 
// //     cart, 
// //     isLoading, 
// //     error, 
// //     itemCount, 
// //     totalAmount,
// //     updateItemQuantity,
// //     removeItem,
// //     clearClientCart,
// //     isUpdatingItemId 
// //   } = useCart();

// //   const handleQuantityChange = (shopId: string, shopServiceId: string, newQuantity: number) => {
// //     if (newQuantity < 0) return; // Or handle removal if 0, depending on service logic
// //     updateItemQuantity({ shopId, shopServiceId, newQuantity });
// //   };

// //   const handleRemoveItem = (shopId: string, shopServiceId: string) => {
// //     removeItem({ shopId, shopServiceId });
// //   };

// //   if (isLoading && !cart) {
// //     return (
// //       <div className="container mx-auto px-4 py-12 text-center">
// //         <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
// //         <p className="text-slate-600">Loading your cart...</p>
// //       </div>
// //     );
// //   }

// //   if (error) {
// //     return (
// //       <div className="container mx-auto px-4 py-12 text-center text-red-600">
// //         <p>Error loading cart: {error}</p>
// //       </div>
// //     );
// //   }

// //   if (!cart || itemCount === 0) {
// //     return (
// //       <div className="container mx-auto px-4 py-12 text-center">
// //         <ShoppingBag className="w-24 h-24 text-slate-300 mx-auto mb-6" />
// //         <h1 className="text-2xl font-semibold text-slate-700 mb-2">Your Cart is Empty</h1>
// //         <p className="text-slate-500 mb-6">
// //           Looks like you haven't added any services to your cart yet.
// //         </p>
// //         <Link href="/" className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
// //           Browse Services
// //         </Link>
// //       </div>
// //     );
// //   }

// //   // Group items by shop for display
// //   const itemsByShop = cart.items.reduce((acc, item) => {
// //     const shopKey = item.shopId; // Or use item.shopNameEn if available and preferred for grouping key
// //     if (!acc[shopKey]) {
// //       acc[shopKey] = {
// //         shopName: item.shopNameSnapshotEn || `Shop ID: ${item.shopId}`, // Fallback if shopName not in cart item
// //         items: []
// //       };
// //     }
// //     acc[shopKey].items.push(item);
// //     return acc;
// //   }, {} as Record<string, { shopName: string; items: AnonymousCartItem[] }>);


// //   return (
// //     <div className="container mx-auto px-2 sm:px-4 py-8">
// //       <div className="flex items-center justify-between mb-6 pb-4 border-b">
// //         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Your Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})</h1>
// //         {itemCount > 0 && (
// //           <button
// //             onClick={clearClientCart}
// //             className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center disabled:opacity-50"
// //             disabled={isLoading}
// //           >
// //             <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Cart
// //           </button>
// //         )}
// //       </div>

// //       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
// //         {/* Cart Items Section */}
// //         <div className="lg:col-span-8">
// //           {Object.entries(itemsByShop).map(([shopId, shopGroup]) => (
// //             <div key={shopId} className="mb-6 bg-white p-4 sm:p-6 rounded-lg shadow">
// //               <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">
// //                 From: {shopGroup.shopName}
// //               </h2>
// //               <ul className="space-y-4">
// //                 {shopGroup.items.map((item) => {
// //                   const itemUpdatingIdentifier = `${item.shopId}-${item.shopServiceId}`;
// //                   const isThisItemUpdating = isUpdatingItemId === itemUpdatingIdentifier;
// //                   return (
// //                     <li key={`${item.shopId}-${item.shopServiceId}`} className="flex flex-col sm:flex-row items-start sm:items-center py-3 border-b border-slate-100 last:border-b-0">
// //                       {/* Image (Optional) */}
// //                       {/* <img src={getImageUrl(item)} alt={item.serviceNameEn} className="w-16 h-16 rounded object-cover mr-4 mb-2 sm:mb-0" /> */}
                      
// //                       <div className="flex-grow mb-2 sm:mb-0">
// //                         <h3 className="font-medium text-slate-800 text-sm sm:text-base">{item.serviceNameEn}</h3>
// //                         <p className="text-xs text-slate-500">{item.shopNameSnapshotEn || `Shop ID: ${item.shopId}`}</p>
// //                         <p className="text-xs text-orange-600 font-semibold mt-0.5">{item.priceAtAddition.toFixed(2)} EGP</p>
// //                       </div>

// //                       <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
// //                         <div className="flex items-center border rounded">
// //                           <button
// //                             onClick={() => handleQuantityChange(item.shopId, item.shopServiceId, item.quantity - 1)}
// //                             disabled={item.quantity <= 1 || isThisItemUpdating || isLoading}
// //                             className="p-1.5 sm:p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50"
// //                             aria-label="Decrease quantity"
// //                           >
// //                             <MinusCircle className="w-4 h-4" />
// //                           </button>
// //                           <span className="px-2 text-sm font-medium w-8 text-center">
// //                             {isThisItemUpdating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : item.quantity}
// //                           </span>
// //                           <button
// //                             onClick={() => handleQuantityChange(item.shopId, item.shopServiceId, item.quantity + 1)}
// //                             disabled={isThisItemUpdating || isLoading}
// //                             className="p-1.5 sm:p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50"
// //                             aria-label="Increase quantity"
// //                           >
// //                             <PlusCircle className="w-4 h-4" />
// //                           </button>
// //                         </div>
// //                         <button
// //                           onClick={() => handleRemoveItem(item.shopId, item.shopServiceId)}
// //                           disabled={isThisItemUpdating || isLoading}
// //                           className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50"
// //                           aria-label="Remove item"
// //                         >
// //                            {isThisItemUpdating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
// //                         </button>
// //                       </div>
// //                     </li>
// //                   );
// //                 })}
// //               </ul>
// //             </div>
// //           ))}
// //         </div>

// //         {/* Order Summary Section */}
// //         <div className="lg:col-span-4">
// //           <div className="bg-white p-6 rounded-lg shadow sticky top-24"> {/* sticky top for scroll */}
// //             <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-3 border-b">Order Summary</h2>
// //             <div className="space-y-2 text-sm mb-4">
// //               <div className="flex justify-between">
// //                 <span className="text-slate-600">Subtotal ({itemCount} items)</span>
// //                 <span className="font-medium text-slate-800">{totalAmount.toFixed(2)} EGP</span>
// //               </div>
// //               {/* Future: Discounts, Taxes */}
// //               <div className="flex justify-between text-slate-600">
// //                 <span>Service Fees (Est.)</span>
// //                 <span>TBD</span>
// //               </div>
// //             </div>
// //             <div className="border-t pt-4">
// //               <div className="flex justify-between items-baseline font-bold text-lg text-slate-800">
// //                 <span>Estimated Total</span>
// //                 <span>{totalAmount.toFixed(2)} EGP</span>
// //               </div>
// //               <p className="text-xs text-slate-500 mt-1">Final price may vary. Taxes and additional fees may apply.</p>
// //             </div>
// //             <button
// //               className="w-full mt-6 bg-orange-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70"
// //               disabled={isLoading || itemCount === 0}
// //             >
// //               {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Request Quote & Availability"}
// //             </button>
// //             <Link href="/" className="block text-center mt-4 text-sm text-orange-600 hover:underline">
// //               <ArrowLeft className="w-3 h-3 inline mr-1" /> Continue Browsing Services
// //             </Link>
// //           </div>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }