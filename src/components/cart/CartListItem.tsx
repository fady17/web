// src/components/cart/CartListItem.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
// Assuming DisplayableCartItem, UpdateCartItemContextPayload, RemoveCartItemContextPayload
// are exported from CartContext.tsx or a shared types file (e.g., src/types/cart.ts)
import { DisplayableCartItem, UpdateCartItemContextPayload, RemoveCartItemContextPayload } from '@/contexts/CartContext'; 
import { Trash2, Plus, Minus, Loader2, ShoppingBag, XIcon } from 'lucide-react';

interface CartListItemProps {
  item: DisplayableCartItem;
  onUpdateQuantity: (payload: UpdateCartItemContextPayload) => void;
  onRemove: (payload: RemoveCartItemContextPayload) => void;
  isUpdating: boolean; // True if this specific item is being updated/removed
  variant?: 'sheet' | 'page'; // For minor stylistic differences
}

const CartListItem: React.FC<CartListItemProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
  isUpdating,
  variant = 'page', // Default to 'page' styling
}) => {

  const handleDecrease = () => {
    // The context's updateItemQuantity and backend service should handle
    // quantity 0 or less by removing the item.
    onUpdateQuantity({ 
        itemId: item.id, 
        itemType: item.itemType,
        newQuantity: item.quantity - 1 
    });
  };

  const handleIncrease = () => {
    onUpdateQuantity({ 
        itemId: item.id, 
        itemType: item.itemType,
        newQuantity: item.quantity + 1 
    });
  };

  const handleExplicitRemove = () => {
    onRemove({ 
        itemId: item.id,
        itemType: item.itemType
    });
  };

  // Define sizes and classes based on variant for better readability
  const imageSize = variant === 'sheet' ? 60 : 80;
  const imageWrapperClasses = variant === 'sheet' ? 'w-[60px] h-[60px]' : 'w-20 h-20';
  const titleTextSize = variant === 'sheet' ? 'text-sm' : 'text-md';
  const priceTextSize = variant === 'sheet' ? 'text-sm font-semibold' : 'text-base font-bold';
  const quantityControlHeight = 'h-8'; // Consistent height for quantity controls
  const quantityButtonSize = 'h-full w-8';

  const removeButtonWrapperClasses = variant === 'sheet' 
    ? 'absolute top-2 right-1' 
    : 'ml-2 self-start'; // More space on full page
  const removeButtonIconSize = 'w-4 h-4';


  return (
    <div className={`flex items-start space-x-3 sm:space-x-4 py-4 ${variant === 'page' ? 'relative' : ''}`}>
      {/* Image Section */}
      <div className={`${imageWrapperClasses} rounded-lg border flex-shrink-0 bg-slate-100 flex items-center justify-center`}>
        {item.serviceImageUrlSnapshot ? (
          <Image
            src={item.serviceImageUrlSnapshot}
            alt={item.serviceNameEn}
            width={imageSize}
            height={imageSize}
            className="rounded-md object-cover w-full h-full" // Ensure image fills its container
          />
        ) : (
          <ShoppingBag className={`text-slate-400 ${variant === 'sheet' ? 'w-6 h-6' : 'w-10 h-10'}`} />
        )}
      </div>

      {/* Details Section */}
      <div className="flex-1 min-w-0">
        <p className={`${titleTextSize} font-semibold text-slate-800 line-clamp-2 leading-snug`}>
          {item.serviceNameEn}
        </p>
        {item.shopNameSnapshotEn && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            From: {item.shopNameSnapshotEn}
          </p>
        )}
        <p className={`${priceTextSize} text-orange-600 mt-1`}>
          {(item.priceAtAddition * item.quantity).toFixed(2)} EGP
        </p>
        {/* Quantity Controls */}
        <div className={`flex items-center mt-2 ${quantityControlHeight}`}>
          <Button
            variant="outline"
            size="icon"
            className={`${quantityButtonSize} rounded-r-none border-r-0 disabled:opacity-60 hover:bg-slate-100 focus:z-10`}
            onClick={handleDecrease}
            disabled={isUpdating}
            aria-label={item.quantity === 1 ? "Remove item" : "Decrease quantity"}
          >
            {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
          </Button>
          <span className="px-2 text-sm w-10 min-w-[2.5rem] text-center font-medium border-y h-full flex items-center justify-center bg-white">
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : item.quantity}
          </span>
          <Button
            variant="outline"
            size="icon"
            className={`${quantityButtonSize} rounded-l-none border-l-0 disabled:opacity-60 hover:bg-slate-100 focus:z-10`}
            onClick={handleIncrease}
            disabled={isUpdating}
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Explicit Remove Button */}
      <div className={removeButtonWrapperClasses}>
        <Button
          variant="ghost"
          size="icon"
          className={`text-slate-400 hover:text-red-500 h-7 w-7 p-1 disabled:opacity-50 ${variant === 'page' ? 'h-8 w-8' : ''}`}
          onClick={handleExplicitRemove}
          disabled={isUpdating}
          aria-label="Remove item from cart"
        >
          {/* Show loader only if this specific item is being removed by this button, not by quantity decrease */}
          {isUpdating ? <Loader2 className={`${removeButtonIconSize} animate-spin`} /> : <XIcon className={removeButtonIconSize} />}
        </Button>
      </div>
    </div>
  );
};
export default CartListItem;
// // src/components/cart/CartListItem.tsx
// 'use client';

// import React from 'react';
// import Image from 'next/image';
// import { Button } from '@/components/ui/button';
// import {  UpdateCartItemContextPayload, RemoveCartItemContextPayload } from '@/contexts/CartContext';
// import { Trash2, Plus, Minus, Loader2, ShoppingBag, XIcon } from 'lucide-react';

// interface CartListItemProps {
//   item: DisplayCartItem;
//   onUpdateQuantity: (payload: UpdateCartItemContextPayload) => void;
//   onRemove: (payload: RemoveCartItemContextPayload) => void;
//   isUpdating: boolean;
//   variant?: 'sheet' | 'page';
// }

// const CartListItem: React.FC<CartListItemProps> = ({
//   item,
//   onUpdateQuantity,
//   onRemove,
//   isUpdating,
//   variant = 'page',
// }) => {
//   const handleDecrease = () => {
//     onUpdateQuantity({ 
//         itemId: item.id,
//         itemType: item.itemType,
//         newQuantity: item.quantity - 1 
//     });
//   };

//   const handleIncrease = () => {
//     onUpdateQuantity({ 
//         itemId: item.id, 
//         itemType: item.itemType,
//         newQuantity: item.quantity + 1 
//     });
//   };

//   const handleRemove = () => {
//     onRemove({ 
//         itemId: item.id,
//         itemType: item.itemType 
//     });
//   };

//   const imageSize = variant === 'sheet' ? 60 : 80;
//   const imageWrapperClasses = variant === 'sheet' ? 'w-[60px] h-[60px]' : 'w-20 h-20';
//   const titleTextSize = variant === 'sheet' ? 'text-sm' : 'text-md';
//   const priceTextSize = variant === 'sheet' ? 'text-sm' : 'text-base font-semibold'; // Adjusted page price to be bolder
//   const removeButtonClasses = variant === 'sheet' 
//     ? 'absolute top-2 right-1 text-slate-400 hover:text-red-500 h-7 w-7 p-1' 
//     : 'text-slate-500 hover:text-red-600 h-8 w-8 self-start ml-2 p-1'; // Page remove is a bit larger and more spaced

//   return (
//     <div className={`flex items-start space-x-3 sm:space-x-4 py-4 ${variant === 'page' ? 'relative' : ''}`}>
//       {item.serviceImageUrlSnapshot ? (
//         <Image
//           src={item.serviceImageUrlSnapshot}
//           alt={item.serviceNameEn}
//           width={imageSize}
//           height={imageSize}
//           className={`rounded-lg object-cover ${imageWrapperClasses} border flex-shrink-0 bg-slate-100`}
//         />
//       ) : (
//         <div className={`${imageWrapperClasses} bg-slate-100 rounded-lg flex items-center justify-center border flex-shrink-0`}>
//           <ShoppingBag className={`text-slate-400 ${variant === 'sheet' ? 'w-6 h-6' : 'w-10 h-10'}`} />
//         </div>
//       )}

//       <div className="flex-1 min-w-0">
//         <p className={`${titleTextSize} font-semibold text-slate-800 line-clamp-2 leading-snug`}>
//           {item.serviceNameEn}
//         </p>
//         {item.shopNameSnapshotEn && (
//           <p className="text-xs text-slate-500 truncate mt-0.5">
//             From: {item.shopNameSnapshotEn}
//           </p>
//         )}
//         <p className={`${priceTextSize} text-orange-600 mt-1`}>
//           {(item.priceAtAddition * item.quantity).toFixed(2)} EGP
//         </p>
//         <div className="flex items-center mt-2">
//           <Button
//             variant="outline"
//             size="icon"
//             className="h-7 w-7 rounded-r-none border-r-0 disabled:opacity-60 hover:bg-slate-100 focus:z-10"
//             onClick={handleDecrease}
//             disabled={isUpdating}
//             aria-label="Decrease quantity or remove item"
//           >
//             {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
//           </Button>
//           <span className="px-2 text-sm w-10 min-w-[2.5rem] text-center font-medium border-y h-7 flex items-center justify-center bg-white">
//             {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : item.quantity}
//           </span>
//           <Button
//             variant="outline"
//             size="icon"
//             className="h-7 w-7 rounded-l-none border-l-0 disabled:opacity-60 hover:bg-slate-100 focus:z-10"
//             onClick={handleIncrease}
//             disabled={isUpdating}
//             aria-label="Increase quantity"
//           >
//             <Plus className="w-3.5 h-3.5" />
//           </Button>
//         </div>
//       </div>

//       <Button
//         variant="ghost"
//         size="icon"
//         className={removeButtonClasses}
//         onClick={handleRemove}
//         disabled={isUpdating}
//         aria-label="Remove item from cart"
//       >
//         {isUpdating ? <Loader2 className="w-4 h-4 animate-spin"/> : <XIcon className="w-4 h-4" />}
//       </Button>
//     </div>
//   );
// };
// export default CartListItem;
// // // src/components/cart/CartListItem.tsx
// // 'use client';

// // import React from 'react';
// // import Image from 'next/image';
// // import { Button } from '@/components/ui/button';
// // // Import DisplayableCartItem and context payload types

// // import { UpdateCartItemContextPayload, RemoveCartItemContextPayload } from '@/contexts/CartContext';
// // import { Trash2, Plus, Minus, Loader2, ShoppingBag, XIcon } from 'lucide-react';
// // import { DisplayableCartItem } from '@/types/cart';

// // interface CartListItemProps {
// //   item: DisplayableCartItem; // Use the common displayable type
// //   onUpdateQuantity: (payload: UpdateCartItemContextPayload) => void;
// //   onRemove: (payload: RemoveCartItemContextPayload) => void;
// //   isUpdating: boolean;
// //   variant?: 'sheet' | 'page';
// // }

// // const CartListItem: React.FC<CartListItemProps> = ({
// //   item,
// //   onUpdateQuantity,
// //   onRemove,
// //   isUpdating,
// //   variant = 'page',
// // }) => {
// //   const handleDecrease = () => {
// //     onUpdateQuantity({ 
// //         itemId: item.id, // Use generic item.id
// //         itemType: item.itemType, // Pass item type
// //         newQuantity: item.quantity - 1 
// //     });
// //   };

// //   const handleIncrease = () => {
// //     onUpdateQuantity({ 
// //         itemId: item.id, 
// //         itemType: item.itemType,
// //         newQuantity: item.quantity + 1 
// //     });
// //   };

// //   const handleRemove = () => {
// //     onRemove({ 
// //         itemId: item.id,
// //         itemType: item.itemType 
// //     });
// //   };

// //   const imageSize = variant === 'sheet' ? 60 : 80;
// //   const imageWrapperClasses = variant === 'sheet' ? 'w-[60px] h-[60px]' : 'w-20 h-20'; // Use fixed px for consistency
// //   const titleTextSize = variant === 'sheet' ? 'text-sm' : 'text-md';
// //   const priceTextSize = variant === 'sheet' ? 'text-sm' : 'text-base font-bold';
// //   const removeButtonClasses = variant === 'sheet' 
// //     ? 'absolute top-2 right-1 text-slate-400 hover:text-red-500 h-7 w-7 p-1' 
// //     : 'text-slate-400 hover:text-red-500 h-8 w-8 self-start ml-2'; // Added ml-2 for page variant

// //   return (
// //     <div className={`flex items-start space-x-3 sm:space-x-4 py-4 ${variant === 'page' ? 'relative' : ''}`}>
// //       {item.serviceImageUrlSnapshot ? (
// //         <Image
// //           src={item.serviceImageUrlSnapshot}
// //           alt={item.serviceNameEn}
// //           width={imageSize}
// //           height={imageSize}
// //           className={`rounded-lg object-cover ${imageWrapperClasses} border flex-shrink-0 bg-slate-100`}
// //         />
// //       ) : (
// //         <div className={`${imageWrapperClasses} bg-slate-100 rounded-lg flex items-center justify-center border flex-shrink-0`}>
// //           <ShoppingBag className={`text-slate-400 ${variant === 'sheet' ? 'w-6 h-6' : 'w-10 h-10'}`} />
// //         </div>
// //       )}

// //       <div className="flex-1 min-w-0">
// //         <p className={`${titleTextSize} font-semibold text-slate-800 line-clamp-2 leading-snug`}>
// //           {item.serviceNameEn}
// //         </p>
// //         {item.shopNameSnapshotEn && (
// //           <p className="text-xs text-slate-500 truncate mt-0.5">
// //             From: {item.shopNameSnapshotEn}
// //           </p>
// //         )}
// //         <p className={`${priceTextSize} text-orange-600 mt-1`}>
// //           {(item.priceAtAddition * item.quantity).toFixed(2)} EGP
// //         </p>
// //         <div className="flex items-center mt-2">
// //           <Button
// //             variant="outline"
// //             size="icon"
// //             className="h-7 w-7 rounded-r-none border-r-0 disabled:opacity-60 hover:bg-slate-50"
// //             onClick={handleDecrease}
// //             disabled={isUpdating}
// //             aria-label="Decrease quantity or remove item"
// //           >
// //             {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
// //           </Button>
// //           <span className="px-2 text-sm w-10 min-w-[2.5rem] text-center font-medium border-y h-7 flex items-center justify-center bg-white">
// //             {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : item.quantity}
// //           </span>
// //           <Button
// //             variant="outline"
// //             size="icon"
// //             className="h-7 w-7 rounded-l-none border-l-0 disabled:opacity-60 hover:bg-slate-50"
// //             onClick={handleIncrease}
// //             disabled={isUpdating}
// //             aria-label="Increase quantity"
// //           >
// //             <Plus className="w-3.5 h-3.5" />
// //           </Button>
// //         </div>
// //       </div>

// //       <Button
// //         variant="ghost"
// //         size="icon"
// //         className={removeButtonClasses}
// //         onClick={handleRemove}
// //         disabled={isUpdating}
// //         aria-label="Remove item from cart"
// //       >
// //         {isUpdating && variant === 'page' && !isUpdating /* This logic needs review, loader on X button */ ? 
// //           <Loader2 className="w-4 h-4 animate-spin"/> : <XIcon className="w-4 h-4" />}
// //       </Button>
// //     </div>
// //   );
// // };
// // export default CartListItem;
// // // // src/components/cart/CartListItem.tsx
// // // 'use client';

// // // import React from 'react';
// // // import Image from 'next/image';
// // // import { Button } from '@/components/ui/button';
// // // import { AnonymousCartItem } from '@/types/anonymous';
// // // import { UpdateCartItemContextPayload, RemoveCartItemContextPayload } from '@/contexts/CartContext'; // Assuming these are exported from CartContext
// // // import { Trash2, Plus, Minus, Loader2, ShoppingBag, XIcon } from 'lucide-react';

// // // interface CartListItemProps {
// // //   item: AnonymousCartItem;
// // //   onUpdateQuantity: (payload: UpdateCartItemContextPayload) => void;
// // //   onRemove: (payload: RemoveCartItemContextPayload) => void;
// // //   isUpdating: boolean;
// // //   variant?: 'sheet' | 'page';
// // // }

// // // const CartListItem: React.FC<CartListItemProps> = ({
// // //   item,
// // //   onUpdateQuantity,
// // //   onRemove,
// // //   isUpdating,
// // //   variant = 'page',
// // // }) => {
// // //   const handleDecrease = () => {
// // //     // The context's updateItemQuantity (and backend service) should handle quantity 0 as removal
// // //     onUpdateQuantity({ anonymousCartItemId: item.anonymousCartItemId, newQuantity: item.quantity - 1 });
// // //   };

// // //   const handleIncrease = () => {
// // //     onUpdateQuantity({ anonymousCartItemId: item.anonymousCartItemId, newQuantity: item.quantity + 1 });
// // //   };

// // //   const handleRemove = () => {
// // //     onRemove({ anonymousCartItemId: item.anonymousCartItemId });
// // //   };

// // //   const imageSize = variant === 'sheet' ? 60 : 80;
// // //   const imageWrapperClasses = variant === 'sheet' ? 'w-15 h-15' : 'w-20 h-20';
// // //   const titleTextSize = variant === 'sheet' ? 'text-sm' : 'text-md';
// // //   const priceTextSize = variant === 'sheet' ? 'text-sm' : 'text-base font-bold';
// // //   const removeButtonClasses = variant === 'sheet' 
// // //     ? 'absolute top-2 right-0 text-slate-400 hover:text-red-500 h-7 w-7 p-1' 
// // //     : 'text-slate-400 hover:text-red-500 h-8 w-8 self-start'; // self-start for page variant if needed

// // //   return (
// // //     <div className={`flex items-start space-x-3 sm:space-x-4 py-4 ${variant === 'page' ? 'relative' : ''}`}>
// // //       {item.serviceImageUrlSnapshot ? (
// // //         <Image
// // //           src={item.serviceImageUrlSnapshot}
// // //           alt={item.serviceNameEn}
// // //           width={imageSize}
// // //           height={imageSize}
// // //           className={`rounded-lg object-cover ${imageWrapperClasses} border flex-shrink-0 bg-slate-100`}
// // //         />
// // //       ) : (
// // //         <div className={`${imageWrapperClasses} bg-slate-100 rounded-lg flex items-center justify-center border flex-shrink-0`}>
// // //           <ShoppingBag className={`text-slate-400 ${variant === 'sheet' ? 'w-6 h-6' : 'w-10 h-10'}`} />
// // //         </div>
// // //       )}

// // //       <div className="flex-1 min-w-0">
// // //         <p className={`${titleTextSize} font-semibold text-slate-800 line-clamp-2 leading-snug`}>
// // //           {item.serviceNameEn}
// // //         </p>
// // //         {item.shopNameSnapshotEn && (
// // //           <p className="text-xs text-slate-500 truncate mt-0.5">
// // //             From: {item.shopNameSnapshotEn}
// // //           </p>
// // //         )}
// // //         <p className={`${priceTextSize} text-orange-600 mt-1`}>
// // //           {(item.priceAtAddition * item.quantity).toFixed(2)} EGP
// // //         </p>
// // //         <div className="flex items-center mt-2">
// // //           <Button
// // //             variant="outline"
// // //             size="icon"
// // //             className="h-7 w-7 rounded-r-none border-r-0 disabled:opacity-60 hover:bg-slate-50"
// // //             onClick={handleDecrease}
// // //             disabled={isUpdating}
// // //             aria-label="Decrease quantity or remove item"
// // //           >
// // //             {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
// // //           </Button>
// // //           <span className="px-2 text-sm w-10 min-w-[2.5rem] text-center font-medium border-y h-7 flex items-center justify-center bg-white">
// // //             {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : item.quantity}
// // //           </span>
// // //           <Button
// // //             variant="outline"
// // //             size="icon"
// // //             className="h-7 w-7 rounded-l-none border-l-0 disabled:opacity-60 hover:bg-slate-50"
// // //             onClick={handleIncrease}
// // //             disabled={isUpdating}
// // //             aria-label="Increase quantity"
// // //           >
// // //             <Plus className="w-3.5 h-3.5" />
// // //           </Button>
// // //         </div>
// // //       </div>

// // //       <Button
// // //         variant="ghost"
// // //         size="icon"
// // //         className={removeButtonClasses}
// // //         onClick={handleRemove}
// // //         disabled={isUpdating}
// // //         aria-label="Remove item from cart"
// // //       >
// // //         {isUpdating && variant === 'page' ? <Loader2 className="w-4 h-4 animate-spin"/> : <XIcon className="w-4 h-4" />}
// // //       </Button>
// // //     </div>
// // //   );
// // // };
// // // export default CartListItem;