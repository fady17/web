// src/lib/leaflet-setup.ts
// This file will attempt to configure Leaflet icons as soon as it's imported on the client.

if (typeof window !== 'undefined') {
  // We need to get a reference to the Leaflet 'L' object.
  // Option 1: Try to import it. This might still be async if not bundled carefully.
  // Option 2: Assume Leaflet might attach itself to `window.L` if its main script is loaded.

  // Let's try a robust way: dynamically import, then configure.
  // This setup should ideally run once.
  (async () => {
    try {
      const L = (await import('leaflet')).default; // Or simply `await import('leaflet');` if L becomes window.L

      // Ensure these image files are in your `public/leaflet-images/` directory
      const iconRetinaUrl = '/leaflet-images/marker-icon-2x.png';
      const iconUrl = '/leaflet-images/marker-icon.png';
      const shadowUrl = '/leaflet-images/marker-shadow.png';

      // Check if already configured to prevent re-running unnecessarily
      // This check is a bit naive, assumes if iconUrl is set to our path, it's done.
      if (L.Icon.Default.prototype.options.iconUrl === iconUrl) {
        // console.log("Global Leaflet icons already configured.");
        return;
      }
      
      // The workaround for default icon loading issues
      if (L.Icon.Default.prototype instanceof L.Icon) {
          delete (L.Icon.Default.prototype as any)._getIconUrl;
      }

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: iconRetinaUrl,
        iconUrl: iconUrl,
        shadowUrl: shadowUrl,
      });

      console.log("Global Leaflet default icon paths configured by leaflet-setup.ts.");

    } catch (error) {
      console.error('Error setting up Leaflet global icons in leaflet-setup.ts:', error);
    }
  })(); // Immediately invoked async function expression (IIAFE)
}
// // src/lib/leaflet-setup.ts
// // This file now ONLY contains the function to set up icons.
// // It should NOT be a hook itself.

// // Ensure this runs only on the client side
// export const configureLeafletIcons = async () => {
//   if (typeof window === 'undefined') {
//     return;
//   }

//   try {
//     // Dynamically import Leaflet 'L' object
//     const L = (await import('leaflet')).default; // Or just `await import('leaflet')` if L is default
    
//     // Ensure these image files are in your `public/leaflet-images/` directory
//     const iconRetinaUrl = '/leaflet-images/marker-icon-2x.png';
//     const iconUrl = '/leaflet-images/marker-icon.png';
//     const shadowUrl = '/leaflet-images/marker-shadow.png';

//     // Workaround for default icon loading issues
//     if (L.Icon.Default.prototype instanceof L.Icon) { // Check to ensure it's the prototype
//         delete (L.Icon.Default.prototype as any)._getIconUrl;
//     }

//     L.Icon.Default.mergeOptions({
//       iconRetinaUrl: iconRetinaUrl,
//       iconUrl: iconUrl,
//       shadowUrl: shadowUrl,
//     });

//     // console.log("Global Leaflet default icon paths configured.");
//   } catch (error) {
//     console.error('Error setting up Leaflet global icons:', error);
//   }
// };
// // // src/lib/leaflet-setup.ts

// // import { useEffect, useState } from 'react';

// // // This function should only be called on the client side
// // export const setupLeafletIcons = async () => {
// //   // Only run on client side
// //   if (typeof window === 'undefined') {
// //     return;
// //   }

// //   try {
// //     const L = await import('leaflet');
    
// //     // Ensure these image files are in your `public/leaflet-images/` directory
// //     const iconRetinaUrl = '/leaflet-images/marker-icon-2x.png';
// //     const iconUrl = '/leaflet-images/marker-icon.png';
// //     const shadowUrl = '/leaflet-images/marker-shadow.png';

// //     // This is a common workaround for issues with Webpack/Next.js and Leaflet's default icon loading
// //     delete (L.Icon.Default.prototype as any)._getIconUrl;

// //     L.Icon.Default.mergeOptions({
// //       iconRetinaUrl: iconRetinaUrl,
// //       iconUrl: iconUrl,
// //       shadowUrl: shadowUrl,
// //     });

// //     console.log("Leaflet default icon paths configured via JS.");
// //   } catch (error) {
// //     console.error('Error setting up Leaflet icons:', error);
// //   }
// // };

// // // Export a hook for easy use in components
// // export const useLeafletSetup = () => {
// //   const [isSetup, setIsSetup] = useState(false);

// //   useEffect(() => {
// //     setupLeafletIcons().then(() => {
// //       setIsSetup(true);
// //     });
// //   }, []);

// //   return isSetup;
// // };

// // // // src/lib/leaflet-setup.ts
// // // import L from 'leaflet';

// // // // Ensure these image files are in your `public/leaflet-images/` directory
// // // // (or adjust the path as needed)
// // // const iconRetinaUrl = '/leaflet-images/marker-icon-2x.png';
// // // const iconUrl = '/leaflet-images/marker-icon.png';
// // // const shadowUrl = '/leaflet-images/marker-shadow.png';

// // // // This is a common workaround for issues with Webpack/Next.js and Leaflet's default icon loading
// // // // @ts-ignore
// // // delete L.Icon.Default.prototype._getIconUrl;

// // // L.Icon.Default.mergeOptions({
// // //   iconRetinaUrl: iconRetinaUrl, // No .src needed when providing direct string paths
// // //   iconUrl: iconUrl,
// // //   shadowUrl: shadowUrl,
// // // });

// // // // console.log("Leaflet default icon paths configured via JS.");