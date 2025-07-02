// src/components/cart/CartSheet.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetDescription, // Keep this import
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart, DisplayableCartItem } from '@/contexts/CartContext'; // Import DisplayableCartItem
import { Trash2, Loader2, ShoppingBag, XIcon, ArrowRight, AlertCircle } from 'lucide-react';
import CartListItem from './CartListItem';

export function CartSheet() {
  const {
    items: cartItems, // Use 'items' which is DisplayableCartItem[]
    isLoading,
    error,
    itemCount,
    totalAmount,
    // lastUpdatedAt, // Not directly used in this component's UI
    // activeCartType, // Not directly used in this component's UI
    updateItemQuantity,
    removeItem,
    clearClientCart,
    isUpdatingItemId,
  } = useCart();
  const router = useRouter();

  const navigateToCartPageAndClose = () => {
    router.push('/cart');
    // Programmatic close would require controlling Sheet's open state
  };

  return (
    <SheetContent
        side="right"
        className="w-full max-w-[calc(100vw-2rem)] xs:w-[90vw] sm:max-w-sm p-0 flex flex-col bg-white shadow-xl" // xs for slightly less than full on very small
        onCloseAutoFocus={(e) => e.preventDefault()}
        aria-describedby="cart-sheet-description" // Link to description
    >
      <SheetHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 sticky top-0 bg-white z-10">
        <div className="flex justify-between items-center">
            <SheetTitle className="text-lg font-semibold text-slate-800">Your Cart</SheetTitle>
            <SheetClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-500 hover:text-slate-800">
                    <XIcon className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </Button>
            </SheetClose>
        </div>
        {/* This ID matches aria-describedby on SheetContent */}
        <SheetDescription id="cart-sheet-description" className="sr-only">
            A summary of services you have selected. You can manage quantities, remove items, or proceed to view your full cart.
        </SheetDescription>
      </SheetHeader>

      {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center mx-4 sm:mx-6 my-2 rounded-md border border-red-200">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>{error}</span>
          </div>
      )}

      {/* Use itemCount from context for initial loading check, cartItems can be empty array initially */}
      {isLoading && itemCount === 0 && !error ? (
        <div className="flex flex-col items-center justify-center flex-grow p-4 text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500">Loading your cart...</p>
        </div>
      ) : itemCount === 0 ? (
        <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
          <ShoppingBag className="w-24 h-24 text-slate-300 mb-6" />
          <p className="text-xl font-semibold text-slate-700 mb-2">Your cart is empty</p>
          <p className="text-sm text-slate-500 mb-6">Add some services to get started!</p>
          <SheetClose asChild>
            <Button variant="default" className="bg-orange-500 hover:bg-orange-600 text-white px-6">
                Browse Services
            </Button>
          </SheetClose>
        </div>
      ) : (
        <ScrollArea className="flex-grow">
          <div className="px-4 sm:px-6 divide-y divide-slate-100">
            {cartItems.map((item: DisplayableCartItem) => ( // item is now DisplayableCartItem
              <CartListItem
                key={item.id} // Use item.id (which is unique anonymousCartItemId or userCartItemId)
                item={item}
                onUpdateQuantity={updateItemQuantity}
                onRemove={removeItem}
                isUpdating={isUpdatingItemId === item.id} // Compare with item.id
                variant="sheet"
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {itemCount > 0 && (
        <SheetFooter className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex-shrink-0 sticky bottom-0 z-10">
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center font-semibold text-lg">
              <span className="text-slate-700">Subtotal</span>
              <span className="text-slate-900">{totalAmount.toFixed(2)} EGP</span>
            </div>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-md py-3 rounded-lg"
              onClick={navigateToCartPageAndClose}
              disabled={isLoading || !!isUpdatingItemId}
            >
              View Cart & Request Quote <ArrowRight className="w-5 h-5 ml-2"/>
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={clearClientCart}
                className="w-full text-sm text-red-600 border-red-500 hover:bg-red-50 hover:text-red-700"
                disabled={isLoading || !!isUpdatingItemId}
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Clear Entire Cart
            </Button>
          </div>
        </SheetFooter>
      )}
    </SheetContent>
  );
}
// // src/components/cart/CartSheet.tsx
// 'use client';

// import React from 'react';
// import { useRouter } from 'next/navigation';
// import {
//   Sheet,
//   SheetContent,
//   SheetFooter,
//   SheetHeader,
//   SheetTitle,
//   SheetClose,
//   SheetDescription,
// } from "@/components/ui/sheet";
// import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { useCart } from '@/contexts/CartContext';
// import { Trash2, Loader2, ShoppingBag, XIcon, ArrowRight, AlertCircle } from 'lucide-react';
// import CartListItem from './CartListItem'; // Import the reusable component

// export function CartSheet() {
//   const {
//     cart, isLoading, error, itemCount, totalAmount,
//     updateItemQuantity, removeItem, clearClientCart, isUpdatingItemId,
//   } = useCart();
//   const router = useRouter();

//   const navigateToCartPageAndClose = () => {
//     router.push('/cart');
//     // Consider controlling sheet open state via context/props if programmatic close is vital
//     // For now, SheetClose button or Esc/outside click handles closing.
//   };

//   return (
//     <SheetContent
//         side="right"
//         className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm p-0 flex flex-col bg-white shadow-xl"
//         //onOpenAutoFocus={(e) => e.preventDefault()}
//         onCloseAutoFocus={(e) => e.preventDefault()}
//         //aria-describedby="cart-sheet-description"
//     >
//       <SheetHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b flex-shrink-0 sticky top-0 bg-white z-10">
//         <div className="flex justify-between items-center">
//             <SheetTitle className="text-lg font-semibold text-slate-800">Your Cart</SheetTitle>
//             <SheetClose asChild>
//                 <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-500 hover:text-slate-800">
//                     <XIcon className="h-5 w-5" />
//                     <span className="sr-only">Close</span>
//                 </Button>
//             </SheetClose>
//         </div>
//         <SheetDescription className="sr-only"> {/* Apply sr-only to the component itself */}
//             A summary of services you have selected. You can manage quantities, remove items, or proceed to view your full cart.
//         </SheetDescription>
//          <p id="cart-sheet-description" className="sr-only"> 
//             A summary of services you have selected. You can manage quantities, remove items, or proceed to view your full cart.
//         </p>
//       </SheetHeader>

//       {error && (
//           <div className="p-4 bg-red-50 text-red-700 text-sm flex items-center mx-4 sm:mx-6 my-2 rounded-md border border-red-200">
//               <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> <span>{error}</span>
//           </div>
//       )}

//       {isLoading && !cart && itemCount === 0 ? (
//         <div className="flex flex-col items-center justify-center flex-grow p-4 text-center">
//           <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
//           <p className="text-sm text-slate-500">Loading your cart...</p>
//         </div>
//       ) : itemCount === 0 ? (
//         <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
//           <ShoppingBag className="w-24 h-24 text-slate-300 mb-6" />
//           <p className="text-xl font-semibold text-slate-700 mb-2">Your cart is empty</p>
//           <p className="text-sm text-slate-500 mb-6">Add some services to get started!</p>
//           <SheetClose asChild>
//             <Button variant="default" className="bg-orange-500 hover:bg-orange-600 text-white px-6">
//                 Browse Services
//             </Button>
//           </SheetClose>
//         </div>
//       ) : (
//         <ScrollArea className="flex-grow">
//           <div className="px-4 sm:px-6 divide-y divide-slate-100">
//             {cart?.items.map((item) => (
//               <CartListItem // Use the reusable component
//                 key={item.anonymousCartItemId}
//                 item={item}
//                 onUpdateQuantity={updateItemQuantity} // Pass context methods directly
//                 onRemove={removeItem}                 // Pass context methods directly
//                 isUpdating={isUpdatingItemId === item.anonymousCartItemId}
//                 variant="sheet" // Specify the variant for styling
//               />
//             ))}
//           </div>
//         </ScrollArea>
//       )}

//       {itemCount > 0 && (
//         <SheetFooter className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex-shrink-0 sticky bottom-0 z-10">
//           <div className="w-full space-y-4">
//             <div className="flex justify-between items-center font-semibold text-lg">
//               <span className="text-slate-700">Subtotal</span>
//               <span className="text-slate-900">{totalAmount.toFixed(2)} EGP</span>
//             </div>
//             <Button
//               className="w-full bg-orange-500 hover:bg-orange-600 text-white text-md py-3 rounded-lg"
//               onClick={navigateToCartPageAndClose}
//               disabled={isLoading || !!isUpdatingItemId}
//             >
//               View Cart & Request Quote <ArrowRight className="w-5 h-5 ml-2"/>
//             </Button>
//             <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={clearClientCart}
//                 className="w-full text-sm text-red-600 border-red-500 hover:bg-red-50 hover:text-red-700"
//                 disabled={isLoading || !!isUpdatingItemId}
//               >
//                 <Trash2 className="w-4 h-4 mr-1.5" /> Clear Entire Cart
//             </Button>
//           </div>
//         </SheetFooter>
//       )}
//     </SheetContent>
//   );
// }