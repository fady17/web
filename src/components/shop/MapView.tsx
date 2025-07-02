'use client';

import { useEffect, useState, useRef } from 'react';
import { MapPin, Loader2 } from "lucide-react";
import LDefault, { Map as LeafletMapType } from 'leaflet'; // Import LeafletMapType for the ref

// Define types for React-Leaflet components explicitly
type MapContainerType = typeof import('react-leaflet').MapContainer;
type TileLayerType = typeof import('react-leaflet').TileLayer;
type MarkerType = typeof import('react-leaflet').Marker;
type PopupType = typeof import('react-leaflet').Popup;

interface ReactLeafletComponents {
  MapContainer: MapContainerType;
  TileLayer: TileLayerType;
  Marker: MarkerType;
  Popup: PopupType;
  L: typeof LDefault; // Use LDefault for Leaflet's L
}

interface MapViewProps {
  center: [number, number] | null;
  displayName: string;
  displayAddress: string;
}

export default function MapView({ center, displayName, displayAddress }: MapViewProps) {
  const [MapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
  const [errorLoadingMap, setErrorLoadingMap] = useState<boolean>(false);
  const mapRef = useRef<LeafletMapType | null>(null); // Correctly typed ref for Leaflet Map instance

  useEffect(() => {
    let isMounted = true;

    const loadLeafletComponents = async () => {
      try {
        const L = (await import('leaflet')).default;
        
        if (typeof window !== 'undefined' && !(L.Icon.Default.prototype as any)._iconUrlFixed) {
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
            (L.Icon.Default.prototype as any)._iconUrlFixed = true;
        }

        const RLeaflet = await import('react-leaflet');
        
        if (isMounted) {
          setMapComponents({
            MapContainer: RLeaflet.MapContainer,
            TileLayer: RLeaflet.TileLayer,
            Marker: RLeaflet.Marker,
            Popup: RLeaflet.Popup,
            L: L, 
          });
        }
      } catch (error) {
        console.error('MapView: Error loading Leaflet components:', error);
        if (isMounted) {
          setErrorLoadingMap(true);
        }
      }
    };

    loadLeafletComponents();

    return () => {
      isMounted = false;
    };
  }, []);

  // Effect to handle center changes after map is initialized
  useEffect(() => {
    const map = mapRef.current;
    if (map && center && MapComponents) {
      // Check if the current map center is different enough from the new center
      const currentMapCenter = map.getCenter();
      if (currentMapCenter.lat !== center[0] || currentMapCenter.lng !== center[1]) {
        // console.log("MapView: Center prop changed, setting map view:", center);
        map.setView(center, map.getZoom() || 15, { animate: false }); // Often better not to animate on card maps
      }
    }
  }, [center, MapComponents]); // mapRef.current is not a dependency for effects typically


  if (errorLoadingMap) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-500/10 text-red-300 p-2">
        <MapPin className="w-6 h-6 mr-2 flex-shrink-0" />
        <p className="text-xs text-center">Map could not be loaded.</p>
      </div>
    );
  }

  if (!MapComponents) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-700/40">
        <div className="text-center text-slate-300">
          <Loader2 className="w-8 h-8 mx-auto mb-1 animate-spin" />
          <p className="text-xs">Initializing map...</p>
        </div>
      </div>
    );
  }
  
  if (!center) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-700/40">
        <div className="text-center text-slate-400">
          <MapPin className="w-10 h-10 mx-auto mb-1 opacity-60" />
          <p className="text-xs">Map location unavailable</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  return (
    <div className="w-full h-full relative leaflet-map-container-shop-card">
      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full z-0" 
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        zoomControl={false}
        ref={mapRef} // Assign the ref to MapContainer
        whenReady={() => { // Use whenReady
            const map = mapRef.current; // Access map instance via ref
            if (map) {
                // console.log("MapView: MapContainer whenReady, instance available via ref.");
                // Ensure map is correctly sized, especially if container was hidden or resized
                const timer = setTimeout(() => {
                    if (mapRef.current) { // Check ref again inside timeout
                        mapRef.current.invalidateSize();
                        // If center prop was already set, ensure view is correct
                        if (center && (mapRef.current.getCenter().lat !== center[0] || mapRef.current.getCenter().lng !== center[1])) {
                            mapRef.current.setView(center, mapRef.current.getZoom() || 15);
                        }
                    }
                }, 0); 
                // Proper cleanup for timeout would be in a returned function from useEffect,
                // but whenReady is a one-time callback. The timeout is very short.
            }
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center}>
          <Popup>
            <div className="text-sm font-sans"> 
              <strong className="font-semibold block mb-0.5">{displayName}</strong>
              <span className="text-slate-600">{displayAddress}</span>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      
      <div className="absolute inset-0 z-10 bg-transparent cursor-pointer" aria-hidden="true" />
    </div>
  );
}
// // src/components/shop/MapView.tsx
// 'use client';

// import { useEffect, useState } from 'react';
// import { MapPin } from "lucide-react";

// interface ReactLeafletComponents {
//   MapContainer: any;
//   TileLayer: any;
//   Marker: any;
//   Popup: any;
// }

// interface MapViewProps {
//   center: [number, number];
//   displayName: string;
//   displayAddress: string;
// }

// export default function MapView({ center, displayName, displayAddress }: MapViewProps) {
//   const [MapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
//   const [errorLoadingMap, setErrorLoadingMap] = useState<boolean>(false);

//   useEffect(() => {
//     const loadLeafletComponents = async () => {
//       try {
//         // Only dynamically import React-Leaflet components here.
//         // Assume 'L' and its icon defaults are globally configured by leaflet-setup.ts
//         const RLeaflet = await import('react-leaflet');
//         // const L = await import('leaflet'); // Optional: if you need L directly for other things

//         setMapComponents({
//           MapContainer: RLeaflet.MapContainer,
//           TileLayer: RLeaflet.TileLayer,
//           Marker: RLeaflet.Marker,
//           Popup: RLeaflet.Popup,
//         });
//       } catch (error) {
//         console.error('Error loading Leaflet components in MapView:', error);
//         setErrorLoadingMap(true);
//       }
//     };

//     loadLeafletComponents();
//   }, []); // Empty dependency array, runs once on mount


//   if (errorLoadingMap) {
//     return (
//       <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-700">
//         <p className="text-xs">Map could not be loaded.</p>
//       </div>
//     );
//   }

//   if (!MapComponents) {
//     // This is the loading state defined in ShopCard's dynamic import for DynamicMapView
//     // but MapView itself can also have an internal "components not yet loaded" state.
//     // For consistency, ShopCard's loading UI will likely show first.
//     return (
//       <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
//         <div className="text-center text-slate-400">
//           <MapPin className="w-10 h-10 mx-auto mb-1 opacity-50 animate-pulse" />
//           <p className="text-xs">Initializing map...</p>
//         </div>
//       </div>
//     );
//   }

//   const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

//   return (
//     <div className="w-full h-full relative leaflet-map-container-shop-card"> {/* Added a class for potential specific styling */}
//       <MapContainer
//         center={center}
//         zoom={15}
//         className="w-full h-full z-0" // Ensure MapContainer itself takes full dimensions
//         dragging={false}
//         scrollWheelZoom={false}
//         doubleClickZoom={false}
//         touchZoom={false}
//         keyboard={false}
//         attributionControl={false}
//         zoomControl={false}
//       >
//         <TileLayer
//           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//           // No attribution needed here if hidden by global CSS for cards
//         />
//         <Marker position={center}>
//           <Popup>
//             <div className="text-sm">
//               <strong className="font-semibold">{displayName}</strong>
//               <br />
//               {displayAddress}
//             </div>
//           </Popup>
//         </Marker>
//       </MapContainer>
      
//       {/* Map overlay to prevent interaction and ensure link works */}
//       <div className="absolute inset-0 z-10 bg-transparent cursor-pointer" aria-hidden="true" />
//     </div>
//   );
// }
// // // src/components/shop/MapView.tsx
// // import { useEffect, useState } from 'react';
// // import { MapPin } from "lucide-react";

// // interface MapViewProps {
// //   center: [number, number];
// //   displayName: string;
// //   displayAddress: string;
// // }

// // export default function MapView({ center, displayName, displayAddress }: MapViewProps) {
// //   const [isClient, setIsClient] = useState(false);
// //   const [MapComponents, setMapComponents] = useState<any>(null);

// //   useEffect(() => {
// //     setIsClient(true);
    
// //     const loadLeaflet = async () => {
// //       try {
// //         // Dynamically import Leaflet and its components
// //         const [
// //           { MapContainer },
// //           { TileLayer },
// //           { Marker },
// //           { Popup },
// //           L
// //         ] = await Promise.all([
// //           import('react-leaflet').then(mod => ({ MapContainer: mod.MapContainer })),
// //           import('react-leaflet').then(mod => ({ TileLayer: mod.TileLayer })),
// //           import('react-leaflet').then(mod => ({ Marker: mod.Marker })),
// //           import('react-leaflet').then(mod => ({ Popup: mod.Popup })),
// //           import('leaflet')
// //         ]);

// //         // Configure Leaflet icons (only on client side)
// //         if (typeof window !== 'undefined') {
// //           // Fix for default markers
// //           delete (L.Icon.Default.prototype as any)._getIconUrl;
// //           L.Icon.Default.mergeOptions({
// //             iconRetinaUrl: '/leaflet-images/marker-icon-2x.png',
// //             iconUrl: '/leaflet-images/marker-icon.png',
// //             shadowUrl: '/leaflet-images/marker-shadow.png',
// //           });
// //         }

// //         setMapComponents({ MapContainer, TileLayer, Marker, Popup });
// //       } catch (error) {
// //         console.error('Error loading Leaflet:', error);
// //       }
// //     };

// //     loadLeaflet();
// //   }, []);

// //   if (!isClient || !MapComponents) {
// //     return (
// //       <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
// //         <div className="text-center text-slate-400">
// //           <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
// //           <p className="text-xs">Loading map...</p>
// //         </div>
// //       </div>
// //     );
// //   }

// //   const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

// //   return (
// //     <div className="w-full h-full relative">
// //       <MapContainer
// //         center={center}
// //         zoom={15}
// //         className="w-full h-full z-0"
// //         dragging={false}
// //         scrollWheelZoom={false}
// //         doubleClickZoom={false}
// //         touchZoom={false}
// //         keyboard={false}
// //         attributionControl={false}
// //         zoomControl={false}
// //       >
// //         <TileLayer
// //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// //           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
// //         />
// //         <Marker position={center}>
// //           <Popup>
// //             <div className="text-sm">
// //               <strong>{displayName}</strong>
// //               <br />
// //               {displayAddress}
// //             </div>
// //           </Popup>
// //         </Marker>
// //       </MapContainer>
      
// //       {/* Map overlay to prevent interaction */}
// //       <div className="absolute inset-0 z-10 bg-transparent cursor-pointer" />
// //     </div>
// //   );
// // }