'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api';
import { Loader2, MapPin } from 'lucide-react';
import * as GeoJSONTypes from 'geojson';

// Leaflet CSS should be imported globally (e.g., in layout.tsx or globals.css)
// import 'leaflet/dist/leaflet.css'; 

interface ReactLeafletComponents {
  MapContainer: typeof import('react-leaflet').MapContainer;
  TileLayer: typeof import('react-leaflet').TileLayer;
  // We are using L.geoJSON directly now, so react-leaflet's GeoJSON component isn't strictly needed here
  // GeoJSON: typeof import('react-leaflet').GeoJSON; 
  L: typeof import('leaflet');
}

type LeafletMapInstance = import('leaflet').Map;
type LeafletLayer = import('leaflet').Layer;
type LeafletGeoJSONLayer = import('leaflet').GeoJSON; // For storing layer refs
type LeafletLatLngBounds = import('leaflet').LatLngBounds;

// Constants for display levels from HomePage (ensure they match)
const DISPLAY_LEVEL_GOVERNORATE = "Governorate";
const DISPLAY_LEVEL_AGGREGATED = "AggregatedUrbanArea";
const DISPLAY_LEVEL_MAJOR_NEW_CITY = "MajorNewCity";
const DISPLAY_LEVEL_DISTRICT = "District";
const DEFAULT_INITIAL_ZOOM = 6;


interface HeroBillboardProps {
  minHeight?: string;
  isMapMode?: boolean;
  operationalAreas?: OperationalAreaDto[]; // This list is filtered by HomePage
  isLoadingMapData?: boolean;
  onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
  activeOperationalAreaSlug?: string | null;
  initialMapCenter?: [number, number] | number[];
  initialMapZoom?: number;
  onMapZoomChange?: (newZoom: number) => void;
  egyptBoundaryGeoJson?: string | null;
  title?: string;
  subtitle?: string;
  highlightText?: string;
  headerHeightClass?: string;
  textColor?: string;
  highlightColor?: string;
}

const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: {
    L_Instance: typeof import('leaflet');
    areas: OperationalAreaDto[] | undefined;
    activeAreaSlug: string | null | undefined;
    initialCenter: [number, number];
    initialZoom: number;
    mapRef: React.RefObject<LeafletMapInstance | null>;
}) => {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L_Instance || !initialCenter || isNaN(initialCenter[0]) || isNaN(initialCenter[1]) || isNaN(initialZoom)) {
      return;
    }
    
    const timer = setTimeout(() => {
      if (map) {
        map.invalidateSize();

        if (activeAreaSlug) {
            const activeArea = areas?.find(area => area.slug === activeAreaSlug);
            if (activeArea) {
                if (activeArea.geometry) {
                    try {
                        const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.GeoJsonObject;
                        const geoJsonLayerForBounds = L_Instance.geoJSON(parsedGeometry);
                        if (geoJsonLayerForBounds.getBounds().isValid()) {
                            map.fitBounds(geoJsonLayerForBounds.getBounds(), { 
                                padding: [50, 50], 
                                maxZoom: activeArea.defaultMapZoomLevel || map.getZoom() 
                            });
                        } else {
                            map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom);
                        }
                    } catch (e) {
                        console.error("MapViewController: Error parsing/fitting active area geometry:", e, activeArea);
                        map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom);
                    }
                } else {
                     map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom);
                }
            } else { 
                 map.setView(initialCenter, initialZoom); 
            }
        } else if (areas && areas.length > 0) {
            try {
                const featuresWithGeometry = areas
                    .filter(a => a.geometry)
                    .map(a => JSON.parse(a.geometry!) as GeoJSONTypes.GeoJsonObject);

                if (featuresWithGeometry.length > 0) {
                    const featureGroup = L_Instance.featureGroup(
                        featuresWithGeometry.map(geom => L_Instance.geoJSON(geom))
                    );
                    if (featureGroup.getBounds().isValid()) {
                        map.fitBounds(featureGroup.getBounds(), { padding: [20, 20] });
                    } else {
                        map.setView(initialCenter, initialZoom);
                    }
                } else { 
                    map.setView(initialCenter, initialZoom);
                }
            } catch(e) {
                 console.error("MapViewController: Error processing all areas for bounds fitting:", e);
                 map.setView(initialCenter, initialZoom); 
            }
        } else { 
            map.setView(initialCenter, initialZoom);
        }
      }
    }, 150); 
    
    return () => clearTimeout(timer);

  }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

  return null;
};


export default function HeroBillboard({
  minHeight = "min-h-screen",
  isMapMode = true,
  operationalAreas = [],
  isLoadingMapData = false,
  onOperationalAreaSelect,
  activeOperationalAreaSlug,
  initialMapCenter: propsInitialMapCenter = [27.18, 31.18],
  initialMapZoom: propsInitialMapZoom = 6, // This prop now comes from HomePage's mapCurrentZoom
  onMapZoomChange,
  egyptBoundaryGeoJson = null,
  title,
  subtitle,
  highlightText,
  headerHeightClass,
  textColor = "text-slate-100",
  highlightColor = "text-sky-400",
}: HeroBillboardProps) {

  const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
  const [egyptMapBounds, setEgyptMapBounds] = useState<LeafletLatLngBounds | null>(null);
  const geoJsonLayersRef = useRef<Record<string, LeafletGeoJSONLayer | null>>({});

  const validInitialMapCenter = useMemo<[number, number]>(() => { 
    if (Array.isArray(propsInitialMapCenter) && propsInitialMapCenter.length === 2 && typeof propsInitialMapCenter[0] === 'number' && !isNaN(propsInitialMapCenter[0]) && typeof propsInitialMapCenter[1] === 'number' && !isNaN(propsInitialMapCenter[1])) { return propsInitialMapCenter as [number, number]; } return [27.18, 31.18]; }, [propsInitialMapCenter]);
  
  useEffect(() => { 
    const loadMapDependencies = async () => {
      try {
        const L = (await import('leaflet')).default;
        const RLeaflet = await import('react-leaflet');
        if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', });
            (L.Icon.Default.prototype as any)._iconUrlFixed = true;
        }
        setMapComponents({ MapContainer: RLeaflet.MapContainer, TileLayer: RLeaflet.TileLayer, L: L });
      } catch (error) { console.error("HeroBillboard: Error loading map dependencies:", error); setMapLoadError("Map components could not be loaded."); }
    };
    if (isMapMode && typeof window !== 'undefined') { loadMapDependencies(); }
  }, [isMapMode]);

  useEffect(() => { 
    if (isMapMode && mapComponents?.L && egyptBoundaryGeoJson) {
      try {
        const parsedEgyptBoundary = JSON.parse(egyptBoundaryGeoJson) as GeoJSONTypes.FeatureCollection | GeoJSONTypes.Feature;
        const L = mapComponents.L; const egyptLayer = L.geoJSON(parsedEgyptBoundary); const bounds = egyptLayer.getBounds();
        if (bounds.isValid()) { setEgyptMapBounds(bounds); } else { console.warn("HeroBillboard: Egypt boundary GeoJSON produced invalid bounds."); setEgyptMapBounds(null); }
      } catch (error) { console.error("HeroBillboard: Error parsing Egypt boundary GeoJSON.", error); setEgyptMapBounds(null); }
    } else if (!egyptBoundaryGeoJson) { setEgyptMapBounds(null); }
  }, [isMapMode, mapComponents, egyptBoundaryGeoJson]);

  const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
    const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
    const displayLevel = feature?.properties?.displayLevel;

    let style: L.PathOptions = {
      weight: isActive ? 2.5 : 1.5,
      opacity: 1,
      color: isActive ? "#D97706" : "#FFFFFF", 
      fillOpacity: isActive ? 0.65 : 0.4,
    };

    if (displayLevel === DISPLAY_LEVEL_GOVERNORATE) {
      style.fillColor = isActive ? "#F59E0B" : "#38BDF8"; 
      style.dashArray = isActive ? "" : "6, 6";
      style.weight = isActive ? 3 : 1.5; 
      style.fillOpacity = isActive ? 0.6 : 0.35; // More transparent for governorates
    } else if (displayLevel === DISPLAY_LEVEL_AGGREGATED || displayLevel === DISPLAY_LEVEL_MAJOR_NEW_CITY) {
      style.fillColor = isActive ? "#F59E0B" : "#2DD4BF"; 
      style.dashArray = isActive ? "" : "4, 4";
    } else if (displayLevel === DISPLAY_LEVEL_DISTRICT) {
      style.fillColor = isActive ? "#F59E0B" : "#34D399"; 
    } else { 
      style.fillColor = isActive ? "#F59E0B" : "#60A5FA"; 
    }
    return style;
  }, [activeOperationalAreaSlug]);

  const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: LeafletLayer) => {
    if (!mapComponents) return;
    const { L } = mapComponents;
    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        const targetLayer = e.target as L.Path;
        if (feature.properties.slug !== activeOperationalAreaSlug) {
          targetLayer.setStyle({ weight: 3, color: '#FACC15', fillOpacity: 0.65 }); 
        }
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          targetLayer.bringToFront();
        }
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        (e.target as L.Path).setStyle(getPolygonStyle(feature));
      },
      click: (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (onOperationalAreaSelect && feature.properties) {
          onOperationalAreaSelect(feature.properties);
        }
      },
    });
  }, [onOperationalAreaSelect, getPolygonStyle, activeOperationalAreaSlug, mapComponents]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapComponents) return;
    const { L } = mapComponents;

    Object.values(geoJsonLayersRef.current).forEach(layer => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    geoJsonLayersRef.current = {};

    const areasByLevel: Record<string, OperationalAreaDto[]> = {};
    operationalAreas.forEach(oa => {
      if (oa.displayLevel) {
        if (!areasByLevel[oa.displayLevel]) areasByLevel[oa.displayLevel] = [];
        areasByLevel[oa.displayLevel].push(oa);
      }
    });

    const drawOrder = [DISPLAY_LEVEL_GOVERNORATE, DISPLAY_LEVEL_AGGREGATED, DISPLAY_LEVEL_MAJOR_NEW_CITY, DISPLAY_LEVEL_DISTRICT];
    
    drawOrder.forEach(level => {
      if (areasByLevel[level] && areasByLevel[level].length > 0) {
        const levelFeatures = areasByLevel[level].map(area => {
          try {
            if (!area.geometry) return null;
            const parsedGeometry = JSON.parse(area.geometry) as GeoJSONTypes.GeoJsonObject; // Parse here
            return {
              type: "Feature" as const,
              geometry: parsedGeometry,
              properties: { ...area } as OperationalAreaFeatureProperties,
            };
          } catch (e) { console.error(`Error parsing geometry for ${area.slug}`, e); return null; }
        }).filter(Boolean) as GeoJSONTypes.Feature<GeoJSONTypes.GeometryObject, OperationalAreaFeatureProperties>[];

        if (levelFeatures.length > 0) {
          const featureCollection = { type: "FeatureCollection" as const, features: levelFeatures };
          const geoJsonLayer = L.geoJSON(featureCollection, {
            style: getPolygonStyle,
            onEachFeature: onEachFeature,
          });
          geoJsonLayer.addTo(map);
          geoJsonLayersRef.current[level] = geoJsonLayer;
        }
      }
    });
  }, [operationalAreas, mapInstanceRef.current, mapComponents, getPolygonStyle, onEachFeature, activeOperationalAreaSlug]); // Added activeOperationalAreaSlug to re-style layers if it changes

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !onMapZoomChange) return;
    const handleZoom = () => { onMapZoomChange(map.getZoom()); };
    map.on('zoomend', handleZoom);
    // Call handler once initially if map is ready
    if(map. whenReady) { // Leaflet map has 'whenReady' not 'ότανReady'
        map.whenReady(handleZoom);
    } else { // If map already ready (e.g. from ref of existing map)
        handleZoom();
    }
    return () => { map.off('zoomend', handleZoom); };
  }, [onMapZoomChange]); // mapInstanceRef.current is not a standard dependency for effects

  const renderMapContent = () => {
    if (!mapComponents) { return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-800 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> ); }
    if (mapLoadError) { return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-200 z-10"> <MapPin className="w-12 h-12 text-red-500 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> ); }
    if (isLoadingMapData && operationalAreas.length === 0 && !egyptMapBounds) { return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Map Data...</p> </div> );}

    const { MapContainer, TileLayer, L } = mapComponents;
    const mapKey = `${validInitialMapCenter.join(',')}-${propsInitialMapZoom}-${activeOperationalAreaSlug || 'all'}-${operationalAreas.length}-${egyptMapBounds ? 'egypt-bounded' : 'unbounded'}`;

    const mapOptions: import('leaflet').MapOptions = { scrollWheelZoom: true, dragging: true, zoomControl: true, minZoom: 5, };
    if (egyptMapBounds) { mapOptions.maxBounds = egyptMapBounds; mapOptions.maxBoundsViscosity = 1.0; }
    
    let currentCenter: [number, number] = validInitialMapCenter; 
    let currentZoom = propsInitialMapZoom || DEFAULT_INITIAL_ZOOM; 

    if (egyptMapBounds && L) { 
        const leafletCenter = L.latLng(currentCenter[0], currentCenter[1]); 
        if (!egyptMapBounds.contains(leafletCenter)) { 
            const egyptCenterLatLng = egyptMapBounds.getCenter(); 
            currentCenter = [egyptCenterLatLng.lat, egyptCenterLatLng.lng]; 
            currentZoom = Math.max(mapOptions.minZoom || 5, 6); 
        }
    }

    return (
      <MapContainer
        key={mapKey} 
        center={currentCenter}
        zoom={currentZoom} 
        minZoom={mapOptions.minZoom}
        maxBounds={mapOptions.maxBounds}
        maxBoundsViscosity={mapOptions.maxBoundsViscosity}
        scrollWheelZoom={mapOptions.scrollWheelZoom}
        dragging={mapOptions.dragging}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
        ref={mapInstanceRef}
        whenReady={() => { 
            const map = mapInstanceRef.current; 
            if (map) { 
                setTimeout(() => map.invalidateSize(), 50); 
                if(onMapZoomChange) onMapZoomChange(map.getZoom()); // Call initial zoom
            } 
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
        {mapComponents.L && (
          <MapViewController
            L_Instance={mapComponents.L}
            areas={operationalAreas} 
            activeAreaSlug={activeOperationalAreaSlug}
            initialCenter={currentCenter} 
            initialZoom={currentZoom}     
            mapRef={mapInstanceRef}
          />
        )}
      </MapContainer>
    );
  };

  return (
    <section className={`relative bg-slate-800 ${minHeight} w-full`}>
        {isMapMode && ( <div className="absolute inset-0 w-full h-full"> {renderMapContent()} </div> )}
        {isMapMode && title && subtitle && (
            <div className={`absolute top-0 left-0 right-0 z-[5] w-full max-w-4xl mx-auto text-center ${headerHeightClass || ''} px-6 pointer-events-none`}>
                <div className="bg-black/20 backdrop-blur-sm p-3 sm:p-4 rounded-lg mt-4 shadow-lg">
                    <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight !leading-tight text-shadow-strong ${textColor}`}> {highlightText ? ( <>{title} <span className={highlightColor}>{highlightText}</span></> ) : ( title )} </h1>
                    <p className={`mt-2 text-sm sm:text-md max-w-xl mx-auto text-shadow-medium ${textColor === 'text-slate-100' ? 'text-slate-200' : textColor}`}> {subtitle} </p>
                </div>
            </div>
        )}
    </section>
  );
}
// 'use client';

// import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// import { FrontendShopQueryParameters, OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api'; // Assuming FrontendShopQueryParameters is used if title/subtitle were more complex
// import { Loader2, MapPin } from 'lucide-react';
// import * as GeoJSONTypes from 'geojson';

// // Ensure Leaflet CSS is imported globally (e.g., in layout.tsx or globals.css)
// // import 'leaflet/dist/leaflet.css'; 

// interface ReactLeafletComponents {
//   MapContainer: typeof import('react-leaflet').MapContainer;
//   TileLayer: typeof import('react-leaflet').TileLayer;
//   GeoJSON: typeof import('react-leaflet').GeoJSON;
//   L: typeof import('leaflet');
// }

// type LeafletMapInstance = import('leaflet').Map;
// type LeafletLatLngBounds = import('leaflet').LatLngBounds;

// interface HeroBillboardProps {
//   minHeight?: string; 
//   isMapMode?: boolean; 
//   operationalAreas?: OperationalAreaDto[];
//   isLoadingMapData?: boolean;
//   onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
//   activeOperationalAreaSlug?: string | null;
//   initialMapCenter?: [number, number] | number[]; // Allow number[] initially from props for flexibility
//   initialMapZoom?: number;
//   egyptBoundaryGeoJson?: string | null;
//   title?: string;
//   subtitle?: string;
//   highlightText?: string;
//   headerHeightClass?: string; 
//   textColor?: string;
//   highlightColor?: string;
// }

// const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: {
//     L_Instance: typeof import('leaflet'),
//     areas: OperationalAreaDto[] | undefined, // Can be undefined initially
//     activeAreaSlug: string | null | undefined,
//     initialCenter: [number, number], // Strictly typed here
//     initialZoom: number, // Strictly typed here
//     mapRef: React.RefObject<LeafletMapInstance | null>,
// }) => {
//   useEffect(() => {
//     const map = mapRef.current;
//     // Guard against uninitialized map, L_Instance, or invalid initial view parameters
//     if (!map || !L_Instance || 
//         !(initialCenter && typeof initialCenter[0] === 'number' && typeof initialCenter[1] === 'number' && !isNaN(initialCenter[0]) && !isNaN(initialCenter[1])) ||
//         !(typeof initialZoom === 'number' && !isNaN(initialZoom))
//     ) {
//         // console.warn("MapViewController: Prerequisites not met (map, L, initialCenter, initialZoom, or areas). Current state:", { map, L_Instance, initialCenter, initialZoom, areasDefined: !!areas });
//         return;
//     }
    
//     // Proceed with map operations only if map and essential data are ready
//     const timer = setTimeout(() => {
//         if (map) { // Double check map instance
//             map.invalidateSize();

//             if (!areas || areas.length === 0) {
//                 // console.log("MapViewController: No operational areas, setting initial view.", initialCenter, initialZoom);
//                 map.setView(initialCenter, initialZoom);
//                 return;
//             }

//             if (activeAreaSlug) {
//                 const activeArea = areas.find(area => area.slug === activeAreaSlug);
//                 if (activeArea) {
//                     const areaLat = activeArea.centroidLatitude;
//                     const areaLon = activeArea.centroidLongitude;
//                     const areaZoom = activeArea.defaultMapZoomLevel || initialZoom;

//                     if (typeof areaLat === 'number' && !isNaN(areaLat) && typeof areaLon === 'number' && !isNaN(areaLon)) {
//                         if (activeArea.geometry) {
//                             try {
//                                 const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
//                                 const geoJsonLayer = L_Instance.geoJSON(parsedGeometry);
//                                 if (geoJsonLayer.getBounds().isValid()) {
//                                     map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: areaZoom });
//                                 } else {
//                                     // console.warn("MapViewController: Active area geometry bounds invalid, setting view to centroid.");
//                                     map.setView([areaLat, areaLon], areaZoom);
//                                 }
//                             } catch (e) {
//                                 console.error("MapViewController: Error parsing/fitting active area geometry:", e);
//                                 map.setView([areaLat, areaLon], areaZoom); // Fallback to centroid
//                             }
//                         } else {
//                             // console.log("MapViewController: Active area has no geometry, setting view to centroid.");
//                             map.setView([areaLat, areaLon], areaZoom);
//                         }
//                     } else {
//                         // console.warn("MapViewController: Active area centroid coords invalid, falling back to initial view.");
//                         map.setView(initialCenter, initialZoom);
//                     }
//                 } else {
//                     // console.warn("MapViewController: Active area slug not found, setting initial view.");
//                     map.setView(initialCenter, initialZoom); // Active area not found
//                 }
//             } else { // No activeAreaSlug, fit all areas
//                 try {
//                     const featuresWithGeometry = areas
//                         .filter(a => a.geometry && typeof a.centroidLatitude === 'number' && typeof a.centroidLongitude === 'number')
//                         .map(a => {
//                             try {
//                                 return ({ type: "Feature", geometry: JSON.parse(a.geometry!), properties: {} } as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>);
//                             } catch (parseError) {
//                                 console.error(`MapViewController: Failed to parse geometry for area ${a.slug}`, parseError);
//                                 return null;
//                             }
//                         })
//                         .filter(Boolean) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>[];
                    
//                     if (featuresWithGeometry.length > 0) {
//                         const featureCollection = { type: "FeatureCollection", features: featuresWithGeometry } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>;
//                         const allAreasLayer = L_Instance.geoJSON(featureCollection);
//                         if (allAreasLayer.getBounds().isValid()) {
//                             // console.log("MapViewController: Fitting to all areas bounds.");
//                             map.fitBounds(allAreasLayer.getBounds(), { padding: [20, 20] }); 
//                         } else {
//                             // console.warn("MapViewController: All areas bounds invalid, setting initial view.");
//                             map.setView(initialCenter, initialZoom);
//                         }
//                     } else {
//                         // console.log("MapViewController: No valid features with geometry to fit, setting initial view.");
//                         map.setView(initialCenter, initialZoom);
//                     }
//                 } catch(e) {
//                      console.error("MapViewController: Error processing all areas for bounds fitting:", e);
//                      map.setView(initialCenter, initialZoom); // Fallback
//                 }
//             }
//         }
//     }, 100); // Timeout for invalidateSize and DOM readiness
    
//     return () => clearTimeout(timer);

//   }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

//   return null;
// };


// export default function HeroBillboard({
//   minHeight = "min-h-screen",
//   isMapMode = true,
//   operationalAreas = [],
//   isLoadingMapData = false,
//   onOperationalAreaSelect,
//   activeOperationalAreaSlug,
//   initialMapCenter: propsInitialMapCenter = [27.18, 31.18], // Default if prop undefined
//   initialMapZoom: propsInitialMapZoom = 6, // Default if prop undefined
//   egyptBoundaryGeoJson = null,
//   title,
//   subtitle,
//   highlightText,
//   headerHeightClass,
//   textColor = "text-slate-100",
//   highlightColor = "text-sky-400",
// }: HeroBillboardProps) {

//   const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
//   const [mapLoadError, setMapLoadError] = useState<string | null>(null);
//   const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
//   const [egyptMapBounds, setEgyptMapBounds] = useState<LeafletLatLngBounds | null>(null);

//   // Sanitize initialMapCenter to ensure it's a valid [number, number] tuple
//   const validInitialMapCenter = useMemo<[number, number]>(() => {
//     if (Array.isArray(propsInitialMapCenter) && 
//         propsInitialMapCenter.length === 2 &&
//         typeof propsInitialMapCenter[0] === 'number' && !isNaN(propsInitialMapCenter[0]) &&
//         typeof propsInitialMapCenter[1] === 'number' && !isNaN(propsInitialMapCenter[1])) {
//       return propsInitialMapCenter as [number, number];
//     }
//     // console.warn("HeroBillboard: Invalid initialMapCenter prop, using default.", propsInitialMapCenter);
//     return [27.18, 31.18]; // Fallback to a hardcoded valid default
//   }, [propsInitialMapCenter]);

//   // Sanitize initialMapZoom to ensure it's a valid number
//   const validInitialMapZoom = useMemo<number>(() => {
//     if (typeof propsInitialMapZoom === 'number' && !isNaN(propsInitialMapZoom)) {
//       return propsInitialMapZoom;
//     }
//     // console.warn("HeroBillboard: Invalid initialMapZoom prop, using default.", propsInitialMapZoom);
//     return 6; // Fallback to a hardcoded valid default
//   }, [propsInitialMapZoom]);


//   useEffect(() => {
//     const loadMapDependencies = async () => {
//       try {
//         const L = (await import('leaflet')).default;
//         const RLeaflet = await import('react-leaflet');

//         if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
//             delete (L.Icon.Default.prototype as any)._getIconUrl;
//             L.Icon.Default.mergeOptions({
//                 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
//                 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
//                 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
//             });
//             (L.Icon.Default.prototype as any)._iconUrlFixed = true;
//         }

//         setMapComponents({
//           MapContainer: RLeaflet.MapContainer,
//           TileLayer: RLeaflet.TileLayer,
//           GeoJSON: RLeaflet.GeoJSON,
//           L: L,
//         });
//       } catch (error) {
//         console.error("HeroBillboard: Error loading map dependencies:", error);
//         setMapLoadError("Map components could not be loaded.");
//       }
//     };

//     if (isMapMode && typeof window !== 'undefined') {
//       loadMapDependencies();
//     }
//   }, [isMapMode]);

//   useEffect(() => {
//     if (isMapMode && mapComponents?.L && egyptBoundaryGeoJson) {
//       try {
//         const parsedEgyptBoundary = JSON.parse(egyptBoundaryGeoJson) as GeoJSONTypes.FeatureCollection | GeoJSONTypes.Feature;
//         const L = mapComponents.L;
//         const egyptLayer = L.geoJSON(parsedEgyptBoundary);
//         const bounds = egyptLayer.getBounds();

//         if (bounds.isValid()) {
//           setEgyptMapBounds(bounds);
//         } else {
//           console.warn("HeroBillboard: Egypt boundary GeoJSON produced invalid bounds.");
//           setEgyptMapBounds(null);
//         }
//       } catch (error) {
//         console.error("HeroBillboard: Error parsing Egypt boundary GeoJSON.", error);
//         setEgyptMapBounds(null);
//       }
//     } else if (!egyptBoundaryGeoJson) {
//         setEgyptMapBounds(null);
//     }
//   }, [isMapMode, mapComponents, egyptBoundaryGeoJson]);


//   const geoJsonData = useMemo(() => {
//     if (!isMapMode || !operationalAreas || !mapComponents) return null; // Removed areas.length === 0 check here, let it pass empty array
//     try {
//       const features = operationalAreas
//         .filter(area => area.geometry) 
//         .map(area => {
//           try {
//             const parsedGeometry = JSON.parse(area.geometry!) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
//             if (!parsedGeometry || !['Polygon', 'MultiPolygon'].includes(parsedGeometry.type)) {
//               console.warn(`HeroBillboard: Skipping area ${area.slug} due to invalid geometry type: ${parsedGeometry?.type}`);
//               return null;
//             }
//             return {
//               type: "Feature" as const,
//               geometry: parsedGeometry,
//               properties: {
//                 id: area.id, nameEn: area.nameEn, nameAr: area.nameAr, slug: area.slug,
//                 centroidLatitude: area.centroidLatitude, centroidLongitude: area.centroidLongitude,
//                 defaultSearchRadiusMeters: area.defaultSearchRadiusMeters,
//                 defaultMapZoomLevel: area.defaultMapZoomLevel
//               } as OperationalAreaFeatureProperties,
//             };
//           } catch (parseError) {
//             console.error(`HeroBillboard: Failed to parse geometry for area ${area.slug}:`, parseError);
//             return null;
//           }
//       }).filter(feature => feature !== null) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>[];

//       // Return FeatureCollection even if features array is empty, MapViewController handles no areas.
//       return {
//         type: "FeatureCollection" as const,
//         features: features,
//       } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>;
//     } catch (e) {
//         console.error("HeroBillboard: Error creating GeoJSON FeatureCollection:", e);
//         return null; // Or return an empty FeatureCollection: { type: "FeatureCollection", features: [] }
//     }
//   }, [isMapMode, operationalAreas, mapComponents]);

//   const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
//     const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
//     return {
//       fillColor: isActive ? "#F97316" : "#3B82F6",
//       weight: isActive ? 3 : 1.5,
//       opacity: 1,
//       color: isActive ? "#EA580C" : 'white',
//       dashArray: isActive ? '' : '4',
//       fillOpacity: isActive ? 0.75 : 0.5,
//     };
//   }, [activeOperationalAreaSlug]);

//   const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: L.Layer) => {
//     if (!mapComponents) return;
//     const { L } = mapComponents;

//     layer.on({
//       mouseover: (e: L.LeafletMouseEvent) => {
//         const l = e.target;
//         if (feature.properties.slug !== activeOperationalAreaSlug) {
//             l.setStyle({ weight: 2.5, fillOpacity: 0.65, color: '#FDE047' });
//         }
//         if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
//           l.bringToFront();
//         }
//       },
//       mouseout: (e: L.LeafletMouseEvent) => {
//         e.target.setStyle(getPolygonStyle(feature));
//       },
//       click: (e: L.LeafletMouseEvent) => {
//         L.DomEvent.stopPropagation(e);
//         if (onOperationalAreaSelect && feature.properties) {
//           onOperationalAreaSelect(feature.properties);
//         }
//       },
//     });
//   }, [onOperationalAreaSelect, getPolygonStyle, mapComponents, activeOperationalAreaSlug]);

//   const renderMapContent = () => {
//     if (!mapComponents) {
//         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-800 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> );
//     }
//     if (mapLoadError) {
//         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-200 z-10"> <MapPin className="w-12 h-12 text-red-500 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> );
//     }
//     // Display loading only if truly no data is ready to be shown on map.
//     // If we have egyptMapBounds, we can show the base map.
//     // If we have geoJsonData (even if empty features), we can render GeoJSON layer.
//     if (isLoadingMapData && !geoJsonData && !egyptMapBounds) {
//       return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Map Data...</p> </div> );
//     }

//     const { MapContainer, TileLayer, GeoJSON: GeoJSONComponent, L } = mapComponents;
//     const mapKey = `${validInitialMapCenter.join(',')}-${validInitialMapZoom}-${activeOperationalAreaSlug || 'all'}-${egyptMapBounds ? 'egypt-bounded' : 'unbounded'}`;

//     const mapOptions: import('leaflet').MapOptions = {
//         scrollWheelZoom: true,
//         dragging: true,
//         zoomControl: true,
//         minZoom: 5,
//     };

//     if (egyptMapBounds) {
//         mapOptions.maxBounds = egyptMapBounds;
//         mapOptions.maxBoundsViscosity = 1.0;
//     }

//     let currentCenter: [number, number] = [...validInitialMapCenter]; // Use sanitized values
//     let currentZoom = validInitialMapZoom; // Use sanitized values

//     if (egyptMapBounds) {
//         // Ensure currentCenter is a valid LatLngExpression for Leaflet's contains method
//         const leafletCenter = L.latLng(currentCenter[0], currentCenter[1]);
//         if (!egyptMapBounds.contains(leafletCenter)) {
//             const egyptCenterLatLng = egyptMapBounds.getCenter();
//             currentCenter = [egyptCenterLatLng.lat, egyptCenterLatLng.lng];
//             currentZoom = Math.max(mapOptions.minZoom || 5, 6); 
//         }
//     }

//     return (
//       <MapContainer
//         key={mapKey}
//         center={currentCenter}
//         zoom={currentZoom}
//         minZoom={mapOptions.minZoom}
//         maxBounds={mapOptions.maxBounds}
//         maxBoundsViscosity={mapOptions.maxBoundsViscosity}
//         scrollWheelZoom={mapOptions.scrollWheelZoom}
//         dragging={mapOptions.dragging}
//         zoomControl={mapOptions.zoomControl}
//         style={{ height: '100%', width: '100%' }}
//         ref={mapInstanceRef}
//         whenReady={() => { // This is called once when the map is initialized
//             const map = mapInstanceRef.current;
//             if (map) {
//                 // Initial invalidateSize is good practice.
//                 // Further view adjustments should ideally be handled by MapViewController
//                 // based on data changes (areas, activeAreaSlug).
//                 const timer = setTimeout(() => {
//                     map.invalidateSize();
//                 }, 50);
//                 // No direct cleanup here, but subsequent effects in MapViewController will manage view.
//             }
//         }}
//       >
//         <TileLayer
//           attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//         />
//         {/* Render GeoJSON layer only if geoJsonData is not null */}
//         {geoJsonData && (
//           <GeoJSONComponent
//             key={`geojson-${activeOperationalAreaSlug || 'all'}-${operationalAreas?.length || 0}`} // Key changes if data changes
//             data={geoJsonData} // This can be an empty FeatureCollection
//             style={getPolygonStyle}
//             onEachFeature={onEachFeature}
//           />
//         )}
//         {/* MapViewController is responsible for fitting bounds/setting view based on data */}
//         {mapComponents.L && ( // Render if L is available
//           <MapViewController
//             L_Instance={mapComponents.L}
//             areas={operationalAreas} // Pass operationalAreas, can be empty or undefined initially
//             activeAreaSlug={activeOperationalAreaSlug}
//             initialCenter={currentCenter} 
//             initialZoom={currentZoom}    
//             mapRef={mapInstanceRef}
//           />
//         )}
//       </MapContainer>
//     );
//   };

//   return (
//     <section
//       className={`relative bg-slate-800 ${minHeight} w-full`}
//     >
//         {isMapMode && (
//             <div className="absolute inset-0 w-full h-full">
//                 {renderMapContent()}
//             </div>
//         )}
//         {isMapMode && title && subtitle && (
//             <div className={`absolute top-0 left-0 right-0 z-[5] w-full max-w-4xl mx-auto text-center ${headerHeightClass || ''} px-6 pointer-events-none`}>
//                 <div className="bg-black/20 backdrop-blur-sm p-3 sm:p-4 rounded-lg mt-4 shadow-lg">
//                     <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight !leading-tight text-shadow-strong ${textColor}`}>
//                         {highlightText ? (
//                         <>{title} <span className={highlightColor}>{highlightText}</span></>
//                         ) : ( title )}
//                     </h1>
//                     <p className={`mt-2 text-sm sm:text-md max-w-xl mx-auto text-shadow-medium ${textColor === 'text-slate-100' ? 'text-slate-200' : textColor}`}>
//                         {subtitle}
//                     </p>
//                 </div>
//             </div>
//         )}
//     </section>
//   );
// }
// // 'use client';

// // import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// // import { FrontendShopQueryParameters, OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api';
// // import { Loader2, MapPin } from 'lucide-react';
// // import * as GeoJSONTypes from 'geojson';

// // // Ensure Leaflet CSS is imported globally
// // // import 'leaflet/dist/leaflet.css'; 

// // interface ReactLeafletComponents {
// //   MapContainer: typeof import('react-leaflet').MapContainer;
// //   TileLayer: typeof import('react-leaflet').TileLayer;
// //   GeoJSON: typeof import('react-leaflet').GeoJSON;
// //   L: typeof import('leaflet');
// // }

// // type LeafletMapInstance = import('leaflet').Map;
// // type LeafletLatLngBounds = import('leaflet').LatLngBounds;

// // interface HeroBillboardProps {
// //   minHeight?: string; 
// //   isMapMode?: boolean; 
// //   operationalAreas?: OperationalAreaDto[];
// //   isLoadingMapData?: boolean;
// //   onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
// //   activeOperationalAreaSlug?: string | null;
// //   initialMapCenter?: [number, number];
// //   initialMapZoom?: number;
// //   egyptBoundaryGeoJson?: string | null;
// //   title?: string;
// //   subtitle?: string;
// //   highlightText?: string;
// //   headerHeightClass?: string; 
// //   textColor?: string;
// //   highlightColor?: string;
// // }

// // const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: {
// //     L_Instance: typeof import('leaflet'),
// //     areas: OperationalAreaDto[] | undefined,
// //     activeAreaSlug: string | null | undefined,
// //     initialCenter: [number,number],
// //     initialZoom: number,
// //     mapRef: React.RefObject<LeafletMapInstance | null>,
// // }) => {
// //   useEffect(() => {
// //     const map = mapRef.current;
// //     if (!map || !L_Instance || !areas) return;
    
// //     if (map) {
// //         setTimeout(() => {
// //             map.invalidateSize(); // Invalidate size first

// //             // Then proceed with fitting bounds or setting view
// //             if (areas.length > 0) {
// //                 if (activeAreaSlug) {
// //                     const activeArea = areas.find(area => area.slug === activeAreaSlug);
// //                     if (activeArea?.geometry) {
// //                         try {
// //                             const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
// //                             const geoJsonLayer = L_Instance.geoJSON(parsedGeometry);
// //                             if (geoJsonLayer.getBounds().isValid()) {
// //                                 map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: activeArea.defaultMapZoomLevel || initialZoom || 12 });
// //                             } else if (activeArea) {
// //                                  map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// //                             }
// //                         } catch (e) {
// //                             console.error("MapViewController: Error fitting bounds to active area:", e);
// //                             if (activeArea) {
// //                                  map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// //                             }
// //                         }
// //                     } else if (activeArea) { 
// //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// //                     }
// //                 } else { 
// //                     try {
// //                         const featuresWithGeometry = areas
// //                             .filter(a => a.geometry)
// //                             .map(a => ({ type: "Feature", geometry: JSON.parse(a.geometry!), properties: {} } as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>));
                        
// //                         if (featuresWithGeometry.length > 0) {
// //                             const featureCollection = { type: "FeatureCollection", features: featuresWithGeometry } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>;
// //                             const allAreasLayer = L_Instance.geoJSON(featureCollection);
// //                             if (allAreasLayer.getBounds().isValid()) {
// //                                 map.fitBounds(allAreasLayer.getBounds(), { padding: [20, 20] }); 
// //                             } else {
// //                                  map.setView(initialCenter, initialZoom);
// //                             }
// //                         } else {
// //                              map.setView(initialCenter, initialZoom);
// //                         }
// //                     } catch(e) {
// //                          console.error("MapViewController: Error fitting bounds to all areas:", e);
// //                          map.setView(initialCenter, initialZoom);
// //                     }
// //                 }
// //             } else { 
// //                 map.setView(initialCenter, initialZoom);
// //             }

// //         }, 10); // Small timeout can help with race conditions on initial render
// //     }

// //   }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

// //   return null;
// // };


// // export default function HeroBillboard({
// //   minHeight = "min-h-screen",
// //   isMapMode = true,
// //   operationalAreas = [],
// //   isLoadingMapData = false,
// //   onOperationalAreaSelect,
// //   activeOperationalAreaSlug,
// //   initialMapCenter = [27.18, 31.18],
// //   initialMapZoom = 6,
// //   egyptBoundaryGeoJson = null,
// //   title,
// //   subtitle,
// //   highlightText,
// //   headerHeightClass,
// //   textColor = "text-slate-100",
// //   highlightColor = "text-sky-400",
// // }: HeroBillboardProps) {

// //   const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
// //   const [mapLoadError, setMapLoadError] = useState<string | null>(null);
// //   const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
// //   const [egyptMapBounds, setEgyptMapBounds] = useState<LeafletLatLngBounds | null>(null);

// //   useEffect(() => {
// //     const loadMapDependencies = async () => {
// //       try {
// //         const L = (await import('leaflet')).default;
// //         const RLeaflet = await import('react-leaflet');

// //         if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
// //             delete (L.Icon.Default.prototype as any)._getIconUrl;
// //             L.Icon.Default.mergeOptions({
// //                 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
// //                 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
// //                 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
// //             });
// //             (L.Icon.Default.prototype as any)._iconUrlFixed = true;
// //         }

// //         setMapComponents({
// //           MapContainer: RLeaflet.MapContainer,
// //           TileLayer: RLeaflet.TileLayer,
// //           GeoJSON: RLeaflet.GeoJSON,
// //           L: L,
// //         });
// //       } catch (error) {
// //         console.error("HeroBillboard: Error loading map dependencies:", error);
// //         setMapLoadError("Map components could not be loaded.");
// //       }
// //     };

// //     if (isMapMode && typeof window !== 'undefined') {
// //       loadMapDependencies();
// //     }
// //   }, [isMapMode]);

// //   useEffect(() => {
// //     if (isMapMode && mapComponents?.L && egyptBoundaryGeoJson) {
// //       try {
// //         const parsedEgyptBoundary = JSON.parse(egyptBoundaryGeoJson) as GeoJSONTypes.FeatureCollection | GeoJSONTypes.Feature;
// //         const L = mapComponents.L;
// //         const egyptLayer = L.geoJSON(parsedEgyptBoundary);
// //         const bounds = egyptLayer.getBounds();

// //         if (bounds.isValid()) {
// //           setEgyptMapBounds(bounds);
// //         } else {
// //           setEgyptMapBounds(null);
// //         }
// //       } catch (error) {
// //         setEgyptMapBounds(null);
// //       }
// //     } else if (!egyptBoundaryGeoJson) {
// //         setEgyptMapBounds(null);
// //     }
// //   }, [isMapMode, mapComponents, egyptBoundaryGeoJson]);


// //   const geoJsonData = useMemo(() => {
// //     if (!isMapMode || !operationalAreas || operationalAreas.length === 0 || !mapComponents) return null;
// //     try {
// //       const features = operationalAreas.map(area => {
// //         if (!area.geometry) return null;
// //         return {
// //           type: "Feature" as const,
// //           geometry: JSON.parse(area.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon,
// //           properties: {
// //             id: area.id, nameEn: area.nameEn, nameAr: area.nameAr, slug: area.slug,
// //             centroidLatitude: area.centroidLatitude, centroidLongitude: area.centroidLongitude,
// //             defaultSearchRadiusMeters: area.defaultSearchRadiusMeters,
// //             defaultMapZoomLevel: area.defaultMapZoomLevel
// //           } as OperationalAreaFeatureProperties,
// //         };
// //       }).filter(feature => feature !== null) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>[];

// //       if (features.length === 0) return null;

// //       return {
// //         type: "FeatureCollection" as const,
// //         features: features,
// //       } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>;
// //     } catch (e) {
// //         return null;
// //     }
// //   }, [isMapMode, operationalAreas, mapComponents]);

// //   const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
// //     const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
// //     return {
// //       fillColor: isActive ? "#F97316" : "#3B82F6",
// //       weight: isActive ? 3 : 1.5,
// //       opacity: 1,
// //       color: isActive ? "#EA580C" : 'white',
// //       dashArray: isActive ? '' : '4',
// //       fillOpacity: isActive ? 0.75 : 0.5,
// //     };
// //   }, [activeOperationalAreaSlug]);

// //   const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: L.Layer) => {
// //     if (!mapComponents) return;
// //     const { L } = mapComponents;

// //     layer.on({
// //       mouseover: (e: L.LeafletMouseEvent) => {
// //         const l = e.target;
// //         if (feature.properties.slug !== activeOperationalAreaSlug) {
// //             l.setStyle({ weight: 2.5, fillOpacity: 0.65, color: '#FDE047' });
// //         }
// //         if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
// //           l.bringToFront();
// //         }
// //       },
// //       mouseout: (e: L.LeafletMouseEvent) => {
// //         e.target.setStyle(getPolygonStyle(feature));
// //       },
// //       click: (e: L.LeafletMouseEvent) => {
// //         L.DomEvent.stopPropagation(e);
// //         if (onOperationalAreaSelect && feature.properties) {
// //           onOperationalAreaSelect(feature.properties);
// //         }
// //       },
// //     });
// //   }, [onOperationalAreaSelect, getPolygonStyle, mapComponents, activeOperationalAreaSlug]);

// //   const renderMapContent = () => {
// //     if (!mapComponents) {
// //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-800 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> );
// //     }
// //     if (mapLoadError) {
// //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-200 z-10"> <MapPin className="w-12 h-12 text-red-500 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> );
// //     }
// //     if (isLoadingMapData && !geoJsonData && !egyptMapBounds) {
// //       return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Map Data...</p> </div> );
// //     }

// //     const { MapContainer, TileLayer, GeoJSON: GeoJSONComponent, L } = mapComponents;
// //     const mapKey = `${initialMapCenter.join(',')}-${initialMapZoom}-${activeOperationalAreaSlug || 'all'}-${egyptMapBounds ? 'egypt-bounded' : 'unbounded'}`;

// //     const mapOptions: import('leaflet').MapOptions = {
// //         scrollWheelZoom: true,
// //         dragging: true,
// //         zoomControl: true,
// //         minZoom: 5,
// //     };

// //     if (egyptMapBounds) {
// //         mapOptions.maxBounds = egyptMapBounds;
// //         mapOptions.maxBoundsViscosity = 1.0;
// //     }

// //     let currentCenter: [number, number] = [...initialMapCenter];
// //     let currentZoom = initialMapZoom;

// //     if (egyptMapBounds) {
// //         if (!egyptMapBounds.contains(currentCenter as L.LatLngExpression)) {
// //             const egyptCenter = egyptMapBounds.getCenter();
// //             currentCenter = [egyptCenter.lat, egyptCenter.lng];
// //             currentZoom = Math.max(mapOptions.minZoom || 5, 6);
// //         }
// //     }

// //     return (
// //       <MapContainer
// //         key={mapKey}
// //         center={currentCenter}
// //         zoom={currentZoom}
// //         minZoom={mapOptions.minZoom}
// //         maxBounds={mapOptions.maxBounds}
// //         maxBoundsViscosity={mapOptions.maxBoundsViscosity}
// //         scrollWheelZoom={mapOptions.scrollWheelZoom}
// //         dragging={mapOptions.dragging}
// //         zoomControl={mapOptions.zoomControl}
// //         style={{ height: '100%', width: '100%' }}
// //         ref={mapInstanceRef}
// //         whenReady={() => {
// //             const map = mapInstanceRef.current;
// //             if (map) {
// //                 map.invalidateSize();
// //                 if (egyptMapBounds) {
// //                     if (!egyptMapBounds.contains(map.getCenter())) {
// //                         map.fitBounds(egyptMapBounds);
// //                     }
// //                     if (map.getZoom() < (mapOptions.minZoom || 5)) {
// //                         map.setZoom(mapOptions.minZoom || 5);
// //                     }
// //                 }
// //             }
// //         }}
// //       >
// //         <TileLayer
// //           attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// //         />
// //         {geoJsonData && (
// //           <GeoJSONComponent
// //             key={activeOperationalAreaSlug || 'all-areas-geojson'}
// //             data={geoJsonData}
// //             style={getPolygonStyle}
// //             onEachFeature={onEachFeature}
// //           />
// //         )}
// //         {mapComponents.L && operationalAreas && operationalAreas.length > 0 && (
// //           <MapViewController
// //             L_Instance={mapComponents.L}
// //             areas={operationalAreas}
// //             activeAreaSlug={activeOperationalAreaSlug}
// //             initialCenter={currentCenter}
// //             initialZoom={currentZoom}
// //             mapRef={mapInstanceRef}
// //           />
// //         )}
// //       </MapContainer>
// //     );
// //   };

// //   return (
// //     <section
// //       className={`relative bg-slate-800 ${minHeight} w-full`}
// //     >
// //         {isMapMode && (
// //             <div className="absolute inset-0 w-full h-full">
// //                 {renderMapContent()}
// //             </div>
// //         )}
// //         {isMapMode && title && subtitle && (
// //             <div className={`absolute top-0 left-0 right-0 z-[5] w-full max-w-4xl mx-auto text-center ${headerHeightClass || ''} px-6 pointer-events-none`}> {/* z-index lower than header but above map controls */}
// //                 <div className="bg-black/20 backdrop-blur-sm p-3 sm:p-4 rounded-lg mt-4 shadow-lg">
// //                     <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight !leading-tight text-shadow-strong ${textColor}`}>
// //                         {highlightText ? (
// //                         <>{title} <span className={highlightColor}>{highlightText}</span></>
// //                         ) : ( title )}
// //                     </h1>
// //                     <p className={`mt-2 text-sm sm:text-md max-w-xl mx-auto text-shadow-medium ${textColor === 'text-slate-100' ? 'text-slate-200' : textColor}`}>
// //                         {subtitle}
// //                     </p>
// //                 </div>
// //             </div>
// //         )}
// //     </section>
// //   );
// // }
// // // 'use client';

// // // import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// // // import { FrontendShopQueryParameters, OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api';
// // // import { Loader2, MapPin } from 'lucide-react';
// // // import * as GeoJSONTypes from 'geojson';

// // // // Make sure Leaflet CSS is imported globally (e.g., in layout.tsx or globals.css)
// // // // import 'leaflet/dist/leaflet.css'; 

// // // interface ReactLeafletComponents {
// // //   MapContainer: typeof import('react-leaflet').MapContainer;
// // //   TileLayer: typeof import('react-leaflet').TileLayer;
// // //   GeoJSON: typeof import('react-leaflet').GeoJSON;
// // //   L: typeof import('leaflet');
// // // }

// // // type LeafletMapInstance = import('leaflet').Map;
// // // type LeafletLatLngBounds = import('leaflet').LatLngBounds;

// // // interface HeroBillboardProps {
// // //   // title: string; // Title and subtitle might be removed if not displayed directly on map
// // //   // subtitle: string;
// // //   // highlightText?: string;
// // //   minHeight?: string; // e.g., "h-[40vh]" will be passed from page.tsx
// // //   headerHeightClass?: string; // For padding if any text overlay is used (less likely now)
// // //   isMapMode?: boolean; // Should always be true for this use case
// // //   operationalAreas?: OperationalAreaDto[];
// // //   isLoadingMapData?: boolean;
// // //   onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
// // //   activeOperationalAreaSlug?: string | null;
// // //   initialMapCenter?: [number, number];
// // //   initialMapZoom?: number;
// // //   egyptBoundaryGeoJson?: string | null;
// // // }

// // // const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: {
// // //     L_Instance: typeof import('leaflet'),
// // //     areas: OperationalAreaDto[] | undefined,
// // //     activeAreaSlug: string | null | undefined,
// // //     initialCenter: [number,number],
// // //     initialZoom: number,
// // //     mapRef: React.RefObject<LeafletMapInstance | null>,
// // // }) => {
// // //   useEffect(() => {
// // //     const map = mapRef.current;
// // //     if (!map || !L_Instance || !areas) return;

// // //     // Invalidate size to ensure map recalculates its dimensions
// // //     // This is helpful if the container size changes after initial render
// // //     if (map) {
// // //         setTimeout(() => map.invalidateSize(), 0);
// // //     }


// // //     if (areas.length > 0) {
// // //         if (activeAreaSlug) {
// // //             const activeArea = areas.find(area => area.slug === activeAreaSlug);
// // //             if (activeArea?.geometry) {
// // //                 try {
// // //                     const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
// // //                     const geoJsonLayer = L_Instance.geoJSON(parsedGeometry);
// // //                     if (geoJsonLayer.getBounds().isValid()) {
// // //                         map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: activeArea.defaultMapZoomLevel || initialZoom || 12 });
// // //                     } else if (activeArea) {
// // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // //                     }
// // //                 } catch (e) {
// // //                     console.error("MapViewController: Error fitting bounds to active area:", e);
// // //                     if (activeArea) {
// // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // //                     }
// // //                 }
// // //             } else if (activeArea) {
// // //                  map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // //             }
// // //         } else {
// // //             try {
// // //                 const featuresWithGeometry = areas
// // //                     .filter(a => a.geometry)
// // //                     .map(a => ({ type: "Feature", geometry: JSON.parse(a.geometry!), properties: {} } as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>));

// // //                 if (featuresWithGeometry.length > 0) {
// // //                     const featureCollection = { type: "FeatureCollection", features: featuresWithGeometry } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>;
// // //                     const allAreasLayer = L_Instance.geoJSON(featureCollection);
// // //                     if (allAreasLayer.getBounds().isValid()) {
// // //                         map.fitBounds(allAreasLayer.getBounds(), { padding: [20, 20] });
// // //                     } else {
// // //                          map.setView(initialCenter, initialZoom);
// // //                     }
// // //                 } else {
// // //                      map.setView(initialCenter, initialZoom);
// // //                 }
// // //             } catch(e) {
// // //                  console.error("MapViewController: Error fitting bounds to all areas:", e);
// // //                  map.setView(initialCenter, initialZoom);
// // //             }
// // //         }
// // //     } else {
// // //         map.setView(initialCenter, initialZoom);
// // //     }
// // //   }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

// // //   return null;
// // // };


// // // export default function HeroBillboard({
// // //   // title, // Removed or made optional
// // //   // subtitle,
// // //   // highlightText,
// // //   minHeight = "h-[40vh]", // Default if not passed, but page.tsx will control this
// // //   // headerHeightClass = "pt-[68px] sm:pt-[84px]", // Less relevant if no text overlay
// // //   isMapMode = true, // Should be true
// // //   operationalAreas = [],
// // //   isLoadingMapData = false,
// // //   onOperationalAreaSelect,
// // //   activeOperationalAreaSlug,
// // //   initialMapCenter = [27.18, 31.18],
// // //   initialMapZoom = 6,
// // //   egyptBoundaryGeoJson = null,
// // // }: HeroBillboardProps) {

// // //   const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
// // //   const [mapLoadError, setMapLoadError] = useState<string | null>(null);
// // //   const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
// // //   const [egyptMapBounds, setEgyptMapBounds] = useState<LeafletLatLngBounds | null>(null);

// // //   useEffect(() => {
// // //     const loadMapDependencies = async () => {
// // //       try {
// // //         const L = (await import('leaflet')).default;
// // //         const RLeaflet = await import('react-leaflet');

// // //         if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
// // //             delete (L.Icon.Default.prototype as any)._getIconUrl;
// // //             L.Icon.Default.mergeOptions({
// // //                 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
// // //                 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
// // //                 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
// // //             });
// // //             (L.Icon.Default.prototype as any)._iconUrlFixed = true;
// // //         }

// // //         setMapComponents({
// // //           MapContainer: RLeaflet.MapContainer,
// // //           TileLayer: RLeaflet.TileLayer,
// // //           GeoJSON: RLeaflet.GeoJSON,
// // //           L: L,
// // //         });
// // //       } catch (error) {
// // //         console.error("HeroBillboard: Error loading map dependencies:", error);
// // //         setMapLoadError("Map components could not be loaded.");
// // //       }
// // //     };

// // //     if (isMapMode && typeof window !== 'undefined') {
// // //       loadMapDependencies();
// // //     }
// // //   }, [isMapMode]);

// // //   useEffect(() => {
// // //     if (isMapMode && mapComponents?.L && egyptBoundaryGeoJson) {
// // //       try {
// // //         const parsedEgyptBoundary = JSON.parse(egyptBoundaryGeoJson) as GeoJSONTypes.FeatureCollection | GeoJSONTypes.Feature;
// // //         const L = mapComponents.L;
// // //         const egyptLayer = L.geoJSON(parsedEgyptBoundary);
// // //         const bounds = egyptLayer.getBounds();

// // //         if (bounds.isValid()) {
// // //           setEgyptMapBounds(bounds);
// // //         } else {
// // //           console.warn("HeroBillboard: Egypt boundary GeoJSON is invalid or does not produce valid map bounds.");
// // //           setEgyptMapBounds(null);
// // //         }
// // //       } catch (error) {
// // //         console.error("HeroBillboard: Error parsing Egypt boundary GeoJSON:", error);
// // //         setEgyptMapBounds(null);
// // //       }
// // //     } else if (!egyptBoundaryGeoJson) {
// // //         setEgyptMapBounds(null);
// // //     }
// // //   }, [isMapMode, mapComponents, egyptBoundaryGeoJson]);


// // //   const geoJsonData = useMemo(() => {
// // //     if (!isMapMode || !operationalAreas || operationalAreas.length === 0 || !mapComponents) return null;
// // //     try {
// // //       const features = operationalAreas.map(area => {
// // //         if (!area.geometry) return null;
// // //         return {
// // //           type: "Feature" as const,
// // //           geometry: JSON.parse(area.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon,
// // //           properties: {
// // //             id: area.id, nameEn: area.nameEn, nameAr: area.nameAr, slug: area.slug,
// // //             centroidLatitude: area.centroidLatitude, centroidLongitude: area.centroidLongitude,
// // //             defaultSearchRadiusMeters: area.defaultSearchRadiusMeters,
// // //             defaultMapZoomLevel: area.defaultMapZoomLevel
// // //           } as OperationalAreaFeatureProperties,
// // //         };
// // //       }).filter(feature => feature !== null) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>[];

// // //       if (features.length === 0) return null;

// // //       return {
// // //         type: "FeatureCollection" as const,
// // //         features: features,
// // //       } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>;
// // //     } catch (e) {
// // //         console.error("Error creating GeoJSON FeatureCollection:", e);
// // //         return null;
// // //     }
// // //   }, [isMapMode, operationalAreas, mapComponents]);

// // //   const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
// // //     const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
// // //     return {
// // //       fillColor: isActive ? "#F97316" : "#3B82F6",
// // //       weight: isActive ? 3 : 1.5,
// // //       opacity: 1,
// // //       color: isActive ? "#EA580C" : 'white',
// // //       dashArray: isActive ? '' : '4',
// // //       fillOpacity: isActive ? 0.75 : 0.5,
// // //     };
// // //   }, [activeOperationalAreaSlug]);

// // //   const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: L.Layer) => {
// // //     if (!mapComponents) return;
// // //     const { L } = mapComponents;

// // //     layer.on({
// // //       mouseover: (e: L.LeafletMouseEvent) => {
// // //         const l = e.target;
// // //         if (feature.properties.slug !== activeOperationalAreaSlug) {
// // //             l.setStyle({ weight: 2.5, fillOpacity: 0.65, color: '#FDE047' });
// // //         }
// // //         if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
// // //           l.bringToFront();
// // //         }
// // //       },
// // //       mouseout: (e: L.LeafletMouseEvent) => {
// // //         e.target.setStyle(getPolygonStyle(feature));
// // //       },
// // //       click: (e: L.LeafletMouseEvent) => {
// // //         L.DomEvent.stopPropagation(e);
// // //         if (onOperationalAreaSelect && feature.properties) {
// // //           onOperationalAreaSelect(feature.properties);
// // //         }
// // //       },
// // //     });
// // //   }, [onOperationalAreaSelect, getPolygonStyle, mapComponents, activeOperationalAreaSlug]);

// // //   const renderMapContent = () => {
// // //     if (!mapComponents) {
// // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> );
// // //     }
// // //     if (mapLoadError) {
// // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-100 z-10"> <MapPin className="w-12 h-12 text-red-400 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> );
// // //     }
// // //     if (isLoadingMapData && !geoJsonData) {
// // //       return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Areas Map...</p> </div> );
// // //     }
// // //     // Allow rendering the map container even if GeoJSON data isn't ready, if Egypt bounds are available.
// // //     if (!egyptMapBounds && !geoJsonData && !isLoadingMapData) {
// // //          return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <MapPin className="w-12 h-12 text-slate-300 mb-4" /> <p className="text-slate-200 text-lg">No map data available.</p> </div> );
// // //     }

// // //     const { MapContainer, TileLayer, GeoJSON: GeoJSONComponent, L } = mapComponents;
// // //     const mapKey = `${initialMapCenter.join(',')}-${initialMapZoom}-${activeOperationalAreaSlug || 'all'}-${egyptMapBounds ? 'egypt-bounded' : 'unbounded'}`;

// // //     const mapOptions: import('leaflet').MapOptions = {
// // //         scrollWheelZoom: true,
// // //         dragging: true,
// // //         zoomControl: true,
// // //         minZoom: 5,
// // //     };

// // //     if (egyptMapBounds) {
// // //         mapOptions.maxBounds = egyptMapBounds;
// // //         mapOptions.maxBoundsViscosity = 1.0;
// // //     }

// // //     let currentCenter: [number, number] = [...initialMapCenter];
// // //     let currentZoom = initialMapZoom;

// // //     if (egyptMapBounds) {
// // //         if (!egyptMapBounds.contains(currentCenter as L.LatLngExpression)) {
// // //             const egyptCenter = egyptMapBounds.getCenter();
// // //             currentCenter = [egyptCenter.lat, egyptCenter.lng];
// // //             currentZoom = Math.max(mapOptions.minZoom || 5, 6);
// // //         }
// // //     }

// // //     return (
// // //       <MapContainer
// // //         key={mapKey}
// // //         center={currentCenter}
// // //         zoom={currentZoom}
// // //         minZoom={mapOptions.minZoom}
// // //         maxBounds={mapOptions.maxBounds}
// // //         maxBoundsViscosity={mapOptions.maxBoundsViscosity}
// // //         scrollWheelZoom={mapOptions.scrollWheelZoom}
// // //         dragging={mapOptions.dragging}
// // //         zoomControl={mapOptions.zoomControl}
// // //         style={{ height: '100%', width: '100%' }} // MapContainer takes full size of its parent section
// // //         ref={mapInstanceRef}
// // //         whenReady={() => {
// // //             const map = mapInstanceRef.current;
// // //             if (map) {
// // //                 map.invalidateSize(); // Crucial after container might have resized
// // //                 if (egyptMapBounds) {
// // //                     if (!egyptMapBounds.contains(map.getCenter())) {
// // //                         map.fitBounds(egyptMapBounds);
// // //                     }
// // //                     if (map.getZoom() < (mapOptions.minZoom || 5)) {
// // //                         map.setZoom(mapOptions.minZoom || 5);
// // //                     }
// // //                 }
// // //             }
// // //         }}
// // //       >
// // //         <TileLayer
// // //           attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// // //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// // //         />
// // //         {geoJsonData && (
// // //           <GeoJSONComponent
// // //             key={activeOperationalAreaSlug || 'all-areas-geojson'}
// // //             data={geoJsonData}
// // //             style={getPolygonStyle}
// // //             onEachFeature={onEachFeature}
// // //           />
// // //         )}
// // //         {mapComponents.L && operationalAreas && (
// // //           <MapViewController
// // //             L_Instance={mapComponents.L}
// // //             areas={operationalAreas}
// // //             activeAreaSlug={activeOperationalAreaSlug}
// // //             initialCenter={currentCenter}
// // //             initialZoom={currentZoom}
// // //             mapRef={mapInstanceRef}
// // //           />
// // //         )}
// // //       </MapContainer>
// // //     );
// // //   };

// // //   return (
// // //     // The section itself defines the height (e.g., h-[40vh])
// // //     // It is relative to allow the map to be absolute inset-0 within it.
// // //     <section
// // //       className={`relative bg-slate-700 ${minHeight}`} // minHeight controls the section's height
// // //       // style={{ height: minHeight }} // Alternative if minHeight is a direct style string like "40vh"
// // //     >
// // //         {isMapMode && (
// // //             // This div ensures map content is absolutely positioned within the section
// // //             <div className="absolute inset-0 w-full h-full">
// // //                 {renderMapContent()}
// // //             </div>
// // //         )}
// // //         {/* Any text or simple overlays that should appear *on top* of the map within this section
// // //             would go here, with appropriate z-index. For now, we assume none to keep clicks clear.
// // //         */}
// // //     </section>
// // //   );
// // // }
// // // // 'use client';

// // // // import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// // // // import ShopSearchForm from '@/components/search/ShopSearchForm'; // Assuming this component exists
// // // // import { FrontendShopQueryParameters, OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api';
// // // // import { Loader2, MapPin } from 'lucide-react';

// // // // import * as GeoJSONTypes from 'geojson'; // For GeoJSON type definitions

// // // // // Interface for dynamically loaded Leaflet components
// // // // interface ReactLeafletComponents {
// // // //   MapContainer: typeof import('react-leaflet').MapContainer;
// // // //   TileLayer: typeof import('react-leaflet').TileLayer;
// // // //   GeoJSON: typeof import('react-leaflet').GeoJSON;
// // // //   L: typeof import('leaflet');
// // // // }

// // // // // Type for Leaflet Map instance
// // // // type LeafletMapInstance = import('leaflet').Map;
// // // // type LeafletLatLngBounds = import('leaflet').LatLngBounds;

// // // // interface HeroBillboardProps {
// // // //   title: string;
// // // //   subtitle: string;
// // // //   highlightText?: string;
// // // //   showSearch?: boolean;
// // // //   searchProps?: {
// // // //     onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // //     initialValues: Partial<FrontendShopQueryParameters>;
// // // //     isLoading: boolean;
// // // //     formInstanceId?: string;
// // // //     showDetectLocationButton?: boolean;
// // // //   };
// // // //   backgroundColor?: string;
// // // //   textColor?: string;
// // // //   highlightColor?: string;
// // // //   minHeight?: string;
// // // //   headerHeightClass?: string;
// // // //   isMapMode?: boolean;
// // // //   operationalAreas?: OperationalAreaDto[];
// // // //   isLoadingMapData?: boolean;
// // // //   onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
// // // //   activeOperationalAreaSlug?: string | null;
// // // //   initialMapCenter?: [number, number];
// // // //   initialMapZoom?: number;
// // // //   egyptBoundaryGeoJson?: string | null;
// // // // }

// // // // const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: {
// // // //     L_Instance: typeof import('leaflet'),
// // // //     areas: OperationalAreaDto[] | undefined,
// // // //     activeAreaSlug: string | null | undefined,
// // // //     initialCenter: [number,number],
// // // //     initialZoom: number,
// // // //     mapRef: React.RefObject<LeafletMapInstance | null>,
// // // // }) => {
// // // //   useEffect(() => {
// // // //     const map = mapRef.current;
// // // //     if (!map || !L_Instance || !areas) return;

// // // //     if (areas.length > 0) {
// // // //         if (activeAreaSlug) {
// // // //             const activeArea = areas.find(area => area.slug === activeAreaSlug);
// // // //             if (activeArea?.geometry) {
// // // //                 try {
// // // //                     const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
// // // //                     const geoJsonLayer = L_Instance.geoJSON(parsedGeometry);
// // // //                     if (geoJsonLayer.getBounds().isValid()) {
// // // //                         map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: activeArea.defaultMapZoomLevel || initialZoom || 12 });
// // // //                     } else if (activeArea) {
// // // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // //                     }
// // // //                 } catch (e) {
// // // //                     console.error("MapViewController: Error fitting bounds to active area:", e);
// // // //                     if (activeArea) {
// // // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // //                     }
// // // //                 }
// // // //             } else if (activeArea) {
// // // //                  map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // //             }
// // // //         } else {
// // // //             try {
// // // //                 const featuresWithGeometry = areas
// // // //                     .filter(a => a.geometry)
// // // //                     .map(a => ({ type: "Feature", geometry: JSON.parse(a.geometry!), properties: {} } as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>));

// // // //                 if (featuresWithGeometry.length > 0) {
// // // //                     const featureCollection = { type: "FeatureCollection", features: featuresWithGeometry } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>;
// // // //                     const allAreasLayer = L_Instance.geoJSON(featureCollection);
// // // //                     if (allAreasLayer.getBounds().isValid()) {
// // // //                         map.fitBounds(allAreasLayer.getBounds(), { padding: [20, 20] });
// // // //                     } else {
// // // //                          map.setView(initialCenter, initialZoom);
// // // //                     }
// // // //                 } else {
// // // //                      map.setView(initialCenter, initialZoom);
// // // //                 }
// // // //             } catch(e) {
// // // //                  console.error("MapViewController: Error fitting bounds to all areas:", e);
// // // //                  map.setView(initialCenter, initialZoom);
// // // //             }
// // // //         }
// // // //     } else {
// // // //         map.setView(initialCenter, initialZoom);
// // // //     }
// // // //   }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

// // // //   return null;
// // // // };


// // // // export default function HeroBillboard({
// // // //   title,
// // // //   subtitle,
// // // //   highlightText,
// // // //   showSearch = true,
// // // //   searchProps,
// // // //   backgroundColor = "bg-slate-700",
// // // //   textColor = "text-slate-100",
// // // //   highlightColor = "text-sky-400",
// // // //   minHeight = "min-h-screen",
// // // //   headerHeightClass = "pt-[68px] sm:pt-[84px]",
// // // //   isMapMode = false,
// // // //   operationalAreas = [],
// // // //   isLoadingMapData = false,
// // // //   onOperationalAreaSelect,
// // // //   activeOperationalAreaSlug,
// // // //   initialMapCenter = [27.18, 31.18],
// // // //   initialMapZoom = 6,
// // // //   egyptBoundaryGeoJson = null,
// // // // }: HeroBillboardProps) {

// // // //   const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
// // // //   const [mapLoadError, setMapLoadError] = useState<string | null>(null);
// // // //   const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
// // // //   const [egyptMapBounds, setEgyptMapBounds] = useState<LeafletLatLngBounds | null>(null);

// // // //   useEffect(() => {
// // // //     const loadMapDependencies = async () => {
// // // //       try {
// // // //         const L = (await import('leaflet')).default;
// // // //         const RLeaflet = await import('react-leaflet');

// // // //         if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
// // // //             delete (L.Icon.Default.prototype as any)._getIconUrl;
// // // //             L.Icon.Default.mergeOptions({
// // // //                 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
// // // //                 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
// // // //                 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
// // // //             });
// // // //             (L.Icon.Default.prototype as any)._iconUrlFixed = true;
// // // //         }

// // // //         setMapComponents({
// // // //           MapContainer: RLeaflet.MapContainer,
// // // //           TileLayer: RLeaflet.TileLayer,
// // // //           GeoJSON: RLeaflet.GeoJSON,
// // // //           L: L,
// // // //         });
// // // //       } catch (error) {
// // // //         console.error("HeroBillboard: Error loading map dependencies:", error);
// // // //         setMapLoadError("Map components could not be loaded.");
// // // //       }
// // // //     };

// // // //     if (isMapMode && typeof window !== 'undefined') {
// // // //       loadMapDependencies();
// // // //     }
// // // //   }, [isMapMode]);

// // // //   useEffect(() => {
// // // //     if (isMapMode && mapComponents?.L && egyptBoundaryGeoJson) {
// // // //       try {
// // // //         const parsedEgyptBoundary = JSON.parse(egyptBoundaryGeoJson) as GeoJSONTypes.FeatureCollection | GeoJSONTypes.Feature;
// // // //         const L = mapComponents.L;
// // // //         const egyptLayer = L.geoJSON(parsedEgyptBoundary);
// // // //         const bounds = egyptLayer.getBounds();

// // // //         if (bounds.isValid()) {
// // // //           setEgyptMapBounds(bounds);
// // // //         } else {
// // // //           console.warn("HeroBillboard: Egypt boundary GeoJSON is invalid or does not produce valid map bounds.");
// // // //           setEgyptMapBounds(null);
// // // //         }
// // // //       } catch (error) {
// // // //         console.error("HeroBillboard: Error parsing Egypt boundary GeoJSON:", error);
// // // //         setEgyptMapBounds(null);
// // // //       }
// // // //     } else if (!egyptBoundaryGeoJson) {
// // // //         setEgyptMapBounds(null);
// // // //     }
// // // //   }, [isMapMode, mapComponents, egyptBoundaryGeoJson]);


// // // //   const geoJsonData = useMemo(() => {
// // // //     if (!isMapMode || !operationalAreas || operationalAreas.length === 0 || !mapComponents) return null;
// // // //     try {
// // // //       const features = operationalAreas.map(area => {
// // // //         if (!area.geometry) return null;
// // // //         return {
// // // //           type: "Feature" as const,
// // // //           geometry: JSON.parse(area.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon,
// // // //           properties: {
// // // //             id: area.id, nameEn: area.nameEn, nameAr: area.nameAr, slug: area.slug,
// // // //             centroidLatitude: area.centroidLatitude, centroidLongitude: area.centroidLongitude,
// // // //             defaultSearchRadiusMeters: area.defaultSearchRadiusMeters,
// // // //             defaultMapZoomLevel: area.defaultMapZoomLevel
// // // //           } as OperationalAreaFeatureProperties,
// // // //         };
// // // //       }).filter(feature => feature !== null) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>[];

// // // //       if (features.length === 0) return null;

// // // //       return {
// // // //         type: "FeatureCollection" as const,
// // // //         features: features,
// // // //       } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>;
// // // //     } catch (e) {
// // // //         console.error("Error creating GeoJSON FeatureCollection:", e);
// // // //         return null;
// // // //     }
// // // //   }, [isMapMode, operationalAreas, mapComponents]);

// // // //   const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
// // // //     const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
// // // //     return {
// // // //       fillColor: isActive ? "#F97316" : "#3B82F6",
// // // //       weight: isActive ? 3 : 1.5,
// // // //       opacity: 1,
// // // //       color: isActive ? "#EA580C" : 'white',
// // // //       dashArray: isActive ? '' : '4',
// // // //       fillOpacity: isActive ? 0.75 : 0.5,
// // // //     };
// // // //   }, [activeOperationalAreaSlug]);

// // // //   const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: L.Layer) => {
// // // //     if (!mapComponents) return;
// // // //     const { L } = mapComponents;

// // // //     layer.on({
// // // //       mouseover: (e: L.LeafletMouseEvent) => {
// // // //         const l = e.target;
// // // //         if (feature.properties.slug !== activeOperationalAreaSlug) {
// // // //             l.setStyle({ weight: 2.5, fillOpacity: 0.65, color: '#FDE047' });
// // // //         }
// // // //         if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
// // // //           l.bringToFront();
// // // //         }
// // // //       },
// // // //       mouseout: (e: L.LeafletMouseEvent) => {
// // // //         e.target.setStyle(getPolygonStyle(feature));
// // // //       },
// // // //       click: (e: L.LeafletMouseEvent) => {
// // // //         L.DomEvent.stopPropagation(e);
// // // //         if (onOperationalAreaSelect && feature.properties) {
// // // //           onOperationalAreaSelect(feature.properties);
// // // //         }
// // // //       },
// // // //     });
// // // //   }, [onOperationalAreaSelect, getPolygonStyle, mapComponents, activeOperationalAreaSlug]);


// // // //   const renderMapContent = () => {
// // // //     if (!mapComponents) {
// // // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> );
// // // //     }
// // // //     if (mapLoadError) {
// // // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-100 z-10"> <MapPin className="w-12 h-12 text-red-400 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> );
// // // //     }
// // // //     if (isLoadingMapData && !geoJsonData) {
// // // //       return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Areas Map...</p> </div> );
// // // //     }
// // // //     if (!egyptMapBounds && !geoJsonData && !isLoadingMapData) {
// // // //          return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <MapPin className="w-12 h-12 text-slate-300 mb-4" /> <p className="text-slate-200 text-lg">No operational areas to display.</p> </div> );
// // // //     }

// // // //     const { MapContainer, TileLayer, GeoJSON: GeoJSONComponent, L } = mapComponents;
// // // //     const mapKey = `${initialMapCenter.join(',')}-${initialMapZoom}-${activeOperationalAreaSlug || 'all'}-${egyptMapBounds ? 'egypt-bounded' : 'unbounded'}`;

// // // //     const mapOptions: import('leaflet').MapOptions = {
// // // //         scrollWheelZoom: true,
// // // //         dragging: true,
// // // //         zoomControl: true,
// // // //         minZoom: 5,
// // // //     };

// // // //     if (egyptMapBounds) {
// // // //         mapOptions.maxBounds = egyptMapBounds;
// // // //         mapOptions.maxBoundsViscosity = 1.0;
// // // //     }

// // // //     let currentCenter: [number, number] = [...initialMapCenter];
// // // //     let currentZoom = initialMapZoom;

// // // //     if (egyptMapBounds) {
// // // //         if (!egyptMapBounds.contains(currentCenter as L.LatLngExpression)) {
// // // //             const egyptCenter = egyptMapBounds.getCenter();
// // // //             currentCenter = [egyptCenter.lat, egyptCenter.lng];
// // // //             // We cannot reliably call getBoundsZoom here before the map is truly ready and sized.
// // // //             // Best to set a sensible default zoom if we have to re-center.
// // // //             currentZoom = Math.max(mapOptions.minZoom || 5, 6); // Default to 6 or minZoom
// // // //             console.warn("HeroBillboard: Initial map center is outside Egypt's bounds. Adjusting center and zoom for initial render.");
// // // //         }
// // // //     }


// // // //     return (
// // // //       <MapContainer
// // // //         key={mapKey}
// // // //         center={currentCenter}
// // // //         zoom={currentZoom}
// // // //         minZoom={mapOptions.minZoom}
// // // //         maxBounds={mapOptions.maxBounds}
// // // //         maxBoundsViscosity={mapOptions.maxBoundsViscosity}
// // // //         scrollWheelZoom={mapOptions.scrollWheelZoom}
// // // //         dragging={mapOptions.dragging}
// // // //         zoomControl={mapOptions.zoomControl}
// // // //         style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
// // // //         ref={mapInstanceRef}
// // // //         whenReady={() => { // Corrected: No arguments for whenReady
// // // //             const map = mapInstanceRef.current; // Access map instance via ref
// // // //             if (map && egyptMapBounds) {
// // // //                 // If map initialized outside bounds, or zoom is too low, adjust it.
// // // //                 // This acts as a secondary check after initial props are set.
// // // //                 if (!egyptMapBounds.contains(map.getCenter())) {
// // // //                     map.fitBounds(egyptMapBounds);
// // // //                 }
// // // //                 if (map.getZoom() < (mapOptions.minZoom || 5)) {
// // // //                     map.setZoom(mapOptions.minZoom || 5);
// // // //                 }
// // // //             }
// // // //         }}
// // // //       >
// // // //         <TileLayer
// // // //           attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// // // //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// // // //         />
// // // //         {geoJsonData && (
// // // //           <GeoJSONComponent
// // // //             key={activeOperationalAreaSlug || 'all-areas-geojson'}
// // // //             data={geoJsonData}
// // // //             style={getPolygonStyle}
// // // //             onEachFeature={onEachFeature}
// // // //           />
// // // //         )}
// // // //         {mapComponents.L && operationalAreas && (
// // // //           <MapViewController
// // // //             L_Instance={mapComponents.L}
// // // //             areas={operationalAreas}
// // // //             activeAreaSlug={activeOperationalAreaSlug}
// // // //             initialCenter={currentCenter} // Pass the potentially adjusted center
// // // //             initialZoom={currentZoom}     // Pass the potentially adjusted zoom
// // // //             mapRef={mapInstanceRef}
// // // //           />
// // // //         )}
// // // //       </MapContainer>
// // // //     );
// // // //   };

// // // //   return (
// // // //     <section
// // // //       className={`relative ${isMapMode ? 'bg-transparent' : backgroundColor} ${textColor} flex flex-col justify-center items-center text-center ${headerHeightClass}`}
// // // //       style={{ minHeight }}
// // // //     >
// // // //       {isMapMode && (
// // // //         <div className="absolute inset-0 w-full h-full">
// // // //           {renderMapContent()}
// // // //         </div>
// // // //       )}

// // // //       <div className={`relative z-10 w-full max-w-2xl mx-auto p-6 sm:p-10 md:p-16 ${isMapMode ? 'pt-8' : ''}`}>
// // // //         {!isMapMode && (
// // // //           <>
// // // //             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !leading-tight">
// // // //               {highlightText ? (
// // // //                 <>{title} <span className={highlightColor}>{highlightText}</span></>
// // // //               ) : ( title )}
// // // //             </h1>
// // // //             <p className="mt-3 sm:mt-4 text-md sm:text-lg text-slate-300 max-w-xl mx-auto">
// // // //               {subtitle}
// // // //             </p>
// // // //           </>
// // // //         )}

// // // //         {showSearch && searchProps && (
// // // //           <div className={`w-full max-w-lg mx-auto
// // // //             ${isMapMode ? 'mt-4 p-3 bg-slate-800/60 backdrop-blur-md rounded-xl shadow-2xl' : 'mt-6 sm:mt-8'}`}
// // // //           >
// // // //             <ShopSearchForm
// // // //               onSubmit={searchProps.onSubmit}
// // // //               initialValues={searchProps.initialValues}
// // // //               isLoading={searchProps.isLoading}
// // // //               formInstanceId={searchProps.formInstanceId}
// // // //               showDetectLocationButton={searchProps.showDetectLocationButton}
// // // //             />
// // // //           </div>
// // // //         )}
// // // //       </div>
// // // //     </section>
// // // //   );
// // // // }
// // // // // // src/components/common/HeroBillboard.tsx
// // // // // 'use client';

// // // // // import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
// // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // import { FrontendShopQueryParameters, OperationalAreaDto, OperationalAreaFeatureProperties } from '@/types/api';
// // // // // import { Loader2, MapPin } from 'lucide-react';

// // // // // import * as GeoJSONTypes from 'geojson'; // For GeoJSON type definitions

// // // // // // Leaflet CSS: Ensure this is imported globally ONCE (e.g., in globals.css or layout.tsx)
// // // // // // import 'leaflet/dist/leaflet.css'; 

// // // // // // Interface for dynamically loaded Leaflet components
// // // // // interface ReactLeafletComponents {
// // // // //   MapContainer: typeof import('react-leaflet').MapContainer;
// // // // //   TileLayer: typeof import('react-leaflet').TileLayer;
// // // // //   GeoJSON: typeof import('react-leaflet').GeoJSON;
// // // // //   L: typeof import('leaflet'); 
// // // // //   // REMOVED useMap from here
// // // // // }

// // // // // // Type for Leaflet Map instance
// // // // // type LeafletMapInstance = import('leaflet').Map;

// // // // // interface HeroBillboardProps {
// // // // //   title: string;
// // // // //   subtitle: string;
// // // // //   highlightText?: string;
// // // // //   showSearch?: boolean;
// // // // //   searchProps?: {
// // // // //     onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // //     initialValues: Partial<FrontendShopQueryParameters>;
// // // // //     isLoading: boolean;
// // // // //     formInstanceId?: string;
// // // // //     showDetectLocationButton?: boolean;
// // // // //   };
// // // // //   backgroundColor?: string;
// // // // //   textColor?: string;
// // // // //   highlightColor?: string;
// // // // //   minHeight?: string;
// // // // //   headerHeightClass?: string;
// // // // //   isMapMode?: boolean;
// // // // //   operationalAreas?: OperationalAreaDto[];
// // // // //   isLoadingMapData?: boolean;
// // // // //   onOperationalAreaSelect?: (areaProperties: OperationalAreaFeatureProperties) => void;
// // // // //   activeOperationalAreaSlug?: string | null;
// // // // //   initialMapCenter?: [number, number];
// // // // //   initialMapZoom?: number;
// // // // //    egyptBoundaryGeoJson?: string | null;
// // // // // }

// // // // // const MapViewController = ({ L_Instance, areas, activeAreaSlug, initialCenter, initialZoom, mapRef }: { 
// // // // //     L_Instance: typeof import('leaflet'),
// // // // //     areas: OperationalAreaDto[] | undefined, 
// // // // //     activeAreaSlug: string | null | undefined,
// // // // //     initialCenter: [number,number],
// // // // //     initialZoom: number,
// // // // //     mapRef: React.RefObject<LeafletMapInstance | null>,
// // // // //     egyptBoundaryGeoJsonString?: string | null;
// // // // // }) => {
// // // // //   useEffect(() => {
// // // // //     const map = mapRef.current;
// // // // //     if (!map || !L_Instance || !areas) return; 

// // // // //     if (areas.length > 0) {
// // // // //         if (activeAreaSlug) {
// // // // //             const activeArea = areas.find(area => area.slug === activeAreaSlug);
// // // // //             if (activeArea?.geometry) {
// // // // //                 try {
// // // // //                     const parsedGeometry = JSON.parse(activeArea.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon;
// // // // //                     const geoJsonLayer = L_Instance.geoJSON(parsedGeometry);
// // // // //                     if (geoJsonLayer.getBounds().isValid()) {
// // // // //                         map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50], maxZoom: activeArea.defaultMapZoomLevel || initialZoom || 12 });
// // // // //                     } else if (activeArea) {
// // // // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // // //                     }
// // // // //                 } catch (e) {
// // // // //                     console.error("MapViewController: Error fitting bounds to active area:", e);
// // // // //                     if (activeArea) {
// // // // //                          map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // // //                     }
// // // // //                 }
// // // // //             } else if (activeArea) { 
// // // // //                  map.setView([activeArea.centroidLatitude, activeArea.centroidLongitude], activeArea.defaultMapZoomLevel || initialZoom || 10);
// // // // //             }
// // // // //         } else { 
// // // // //             try {
// // // // //                 const featuresWithGeometry = areas
// // // // //                     .filter(a => a.geometry)
// // // // //                     .map(a => ({ type: "Feature", geometry: JSON.parse(a.geometry!), properties: {} } as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>));
                
// // // // //                 if (featuresWithGeometry.length > 0) {
// // // // //                     const featureCollection = { type: "FeatureCollection", features: featuresWithGeometry } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon>;
// // // // //                     const allAreasLayer = L_Instance.geoJSON(featureCollection);
// // // // //                     if (allAreasLayer.getBounds().isValid()) {
// // // // //                         map.fitBounds(allAreasLayer.getBounds(), { padding: [20, 20] }); // Less padding for all areas view
// // // // //                     } else {
// // // // //                          map.setView(initialCenter, initialZoom);
// // // // //                     }
// // // // //                 } else {
// // // // //                      map.setView(initialCenter, initialZoom);
// // // // //                 }
// // // // //             } catch(e) {
// // // // //                  console.error("MapViewController: Error fitting bounds to all areas:", e);
// // // // //                  map.setView(initialCenter, initialZoom);
// // // // //             }
// // // // //         }
// // // // //     } else { 
// // // // //         map.setView(initialCenter, initialZoom);
// // // // //     }
// // // // //   }, [areas, activeAreaSlug, mapRef, initialCenter, initialZoom, L_Instance]);

// // // // //   return null;
// // // // // };


// // // // // export default function HeroBillboard({
// // // // //   title,
// // // // //   subtitle,
// // // // //   highlightText,
// // // // //   showSearch = true,
// // // // //   searchProps,
// // // // //   backgroundColor = "bg-slate-700",
// // // // //   textColor = "text-slate-100",
// // // // //   highlightColor = "text-sky-400",
// // // // //   minHeight = "min-h-screen",
// // // // //   headerHeightClass = "pt-[68px] sm:pt-[84px]",
// // // // //   isMapMode = false,
// // // // //   operationalAreas = [],
// // // // //   isLoadingMapData = false,
// // // // //   onOperationalAreaSelect,
// // // // //   activeOperationalAreaSlug,
// // // // //   initialMapCenter = [27.18, 31.18], 
// // // // //   initialMapZoom = 6,
// // // // // }: HeroBillboardProps) {

// // // // //   const [mapComponents, setMapComponents] = useState<ReactLeafletComponents | null>(null);
// // // // //   const [mapLoadError, setMapLoadError] = useState<string | null>(null);
// // // // //   const mapInstanceRef = useRef<LeafletMapInstance | null>(null); 

// // // // //   useEffect(() => {
// // // // //     const loadMapDependencies = async () => {
// // // // //       try {
// // // // //         const L = (await import('leaflet')).default;
// // // // //         const RLeaflet = await import('react-leaflet');

// // // // //         if (!(L.Icon.Default.prototype as any)._iconUrlFixed) {
// // // // //             delete (L.Icon.Default.prototype as any)._getIconUrl;
// // // // //             L.Icon.Default.mergeOptions({
// // // // //                 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
// // // // //                 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
// // // // //                 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
// // // // //             });
// // // // //             (L.Icon.Default.prototype as any)._iconUrlFixed = true; 
// // // // //         }
        
// // // // //         setMapComponents({
// // // // //           MapContainer: RLeaflet.MapContainer,
// // // // //           TileLayer: RLeaflet.TileLayer,
// // // // //           GeoJSON: RLeaflet.GeoJSON,
// // // // //           L: L,
// // // // //           // REMOVED useMap from here
// // // // //         });
// // // // //       } catch (error) {
// // // // //         console.error("HeroBillboard: Error loading map dependencies:", error);
// // // // //         setMapLoadError("Map components could not be loaded.");
// // // // //       }
// // // // //     };

// // // // //     if (isMapMode && typeof window !== 'undefined') {
// // // // //       loadMapDependencies();
// // // // //     }
// // // // //   }, [isMapMode]); 


// // // // //   const geoJsonData = useMemo(() => {
// // // // //     if (!isMapMode || !operationalAreas || operationalAreas.length === 0 || !mapComponents) return null;
// // // // //     try {
// // // // //       const features = operationalAreas.map(area => {
// // // // //         if (!area.geometry) return null;
// // // // //         return {
// // // // //           type: "Feature" as const, 
// // // // //           geometry: JSON.parse(area.geometry) as GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, 
// // // // //           properties: { 
// // // // //             id: area.id, nameEn: area.nameEn, nameAr: area.nameAr, slug: area.slug,
// // // // //             centroidLatitude: area.centroidLatitude, centroidLongitude: area.centroidLongitude,
// // // // //             defaultSearchRadiusMeters: area.defaultSearchRadiusMeters,
// // // // //             defaultMapZoomLevel: area.defaultMapZoomLevel
// // // // //           } as OperationalAreaFeatureProperties, 
// // // // //         };
// // // // //       }).filter(feature => feature !== null) as GeoJSONTypes.Feature<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>[];

// // // // //       if (features.length === 0) return null;

// // // // //       return {
// // // // //         type: "FeatureCollection" as const,
// // // // //         features: features,
// // // // //       } as GeoJSONTypes.FeatureCollection<GeoJSONTypes.MultiPolygon | GeoJSONTypes.Polygon, OperationalAreaFeatureProperties>;
// // // // //     } catch (e) {
// // // // //         console.error("Error creating GeoJSON FeatureCollection:", e);
// // // // //         return null;
// // // // //     }
// // // // //   }, [isMapMode, operationalAreas, mapComponents]);

// // // // //   const getPolygonStyle = useCallback((feature?: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>) => {
// // // // //     const isActive = feature?.properties?.slug === activeOperationalAreaSlug;
// // // // //     return {
// // // // //       fillColor: isActive ? "#F97316" : "#3B82F6", 
// // // // //       weight: isActive ? 3 : 1.5, 
// // // // //       opacity: 1,
// // // // //       color: isActive ? "#EA580C" : 'white', 
// // // // //       dashArray: isActive ? '' : '4', 
// // // // //       fillOpacity: isActive ? 0.75 : 0.5, 
// // // // //     };
// // // // //   }, [activeOperationalAreaSlug]);

// // // // //   const onEachFeature = useCallback((feature: GeoJSONTypes.Feature<GeoJSONTypes.Geometry, OperationalAreaFeatureProperties>, layer: L.Layer) => {
// // // // //     if (!mapComponents) return;
// // // // //     const { L } = mapComponents;

// // // // //     layer.on({
// // // // //       mouseover: (e: L.LeafletMouseEvent) => {
// // // // //         const l = e.target;
// // // // //         if (feature.properties.slug !== activeOperationalAreaSlug) { 
// // // // //             l.setStyle({ weight: 2.5, fillOpacity: 0.65, color: '#FDE047' }); 
// // // // //         }
// // // // //         if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
// // // // //           l.bringToFront();
// // // // //         }
// // // // //       },
// // // // //       mouseout: (e: L.LeafletMouseEvent) => {
// // // // //         e.target.setStyle(getPolygonStyle(feature));
// // // // //       },
// // // // //       click: (e: L.LeafletMouseEvent) => {
// // // // //         L.DomEvent.stopPropagation(e); 
// // // // //         if (onOperationalAreaSelect && feature.properties) {
// // // // //           onOperationalAreaSelect(feature.properties);
// // // // //         }
// // // // //       },
// // // // //     });
// // // // //   }, [onOperationalAreaSelect, getPolygonStyle, mapComponents, activeOperationalAreaSlug]);


// // // // //   const renderMapContent = () => {
// // // // //     if (!mapComponents) { 
// // // // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-700 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Initializing Map...</p> </div> );
// // // // //     }
// // // // //     if (mapLoadError) {
// // // // //         return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-red-100 z-10"> <MapPin className="w-12 h-12 text-red-400 mb-4" /> <p className="text-red-700 text-lg">{mapLoadError}</p> </div> );
// // // // //     }
// // // // //     if (isLoadingMapData) {
// // // // //       return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <Loader2 className="w-12 h-12 text-white animate-spin mb-4" /> <p className="text-slate-200 text-lg">Loading Areas Map...</p> </div> );
// // // // //     }
// // // // //     if (!geoJsonData && !isLoadingMapData) {
// // // // //          return ( <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-600/80 z-10"> <MapPin className="w-12 h-12 text-slate-300 mb-4" /> <p className="text-slate-200 text-lg">No operational areas to display.</p> </div> );
// // // // //     }

// // // // //     const { MapContainer, TileLayer, GeoJSON: GeoJSONComponent, L } = mapComponents;
// // // // //     const mapKey = `${initialMapCenter.join(',')}-${initialMapZoom}-${activeOperationalAreaSlug || 'all'}`;

// // // // //     return (
// // // // //       <MapContainer
// // // // //         key={mapKey}
// // // // //         center={initialMapCenter}
// // // // //         zoom={initialMapZoom}
// // // // //         style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
// // // // //         scrollWheelZoom={true} 
// // // // //         dragging={true}      
// // // // //         zoomControl={true}
// // // // //         ref={mapInstanceRef} 
// // // // //         whenReady={() => {
// // // // //             // console.log("Map is ready, instance via ref:", mapInstanceRef.current);
// // // // //         }}
// // // // //       >
// // // // //         <TileLayer
// // // // //           attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// // // // //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
// // // // //         />
// // // // //         {geoJsonData && (
// // // // //           <GeoJSONComponent 
// // // // //             key={activeOperationalAreaSlug || 'all-areas-geojson'} 
// // // // //             data={geoJsonData} 
// // // // //             style={getPolygonStyle}
// // // // //             onEachFeature={onEachFeature}
// // // // //           />
// // // // //         )}
// // // // //         {mapComponents.L && <MapViewController L_Instance={mapComponents.L} areas={operationalAreas} activeAreaSlug={activeOperationalAreaSlug} initialCenter={initialMapCenter} initialZoom={initialMapZoom} mapRef={mapInstanceRef} />}
// // // // //       </MapContainer>
// // // // //     );
// // // // //   };

// // // // //   return (
// // // // //     <section
// // // // //       className={`relative ${isMapMode ? 'bg-transparent' : backgroundColor} ${textColor} flex flex-col justify-center items-center text-center ${headerHeightClass}`}
// // // // //       style={{ minHeight }}
// // // // //     >
// // // // //       {isMapMode && (
// // // // //         <div className="absolute inset-0 w-full h-full"> 
// // // // //           {renderMapContent()}
// // // // //         </div>
// // // // //       )}

// // // // //       <div className={`relative z-10 w-full max-w-2xl mx-auto p-6 sm:p-10 md:p-16 ${isMapMode ? 'pt-8' : ''}`}>
// // // // //         {!isMapMode && (
// // // // //           <>
// // // // //             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !leading-tight">
// // // // //               {highlightText ? (
// // // // //                 <>{title} <span className={highlightColor}>{highlightText}</span></>
// // // // //               ) : ( title )}
// // // // //             </h1>
// // // // //             <p className="mt-3 sm:mt-4 text-md sm:text-lg text-slate-300 max-w-xl mx-auto">
// // // // //               {subtitle}
// // // // //             </p>
// // // // //           </>
// // // // //         )}
        
// // // // //         {/* {showSearch && searchProps && (
// // // // //           <div className={`w-full max-w-lg mx-auto 
// // // // //             ${isMapMode ? 'mt-4 p-3 bg-slate-800/60 backdrop-blur-md rounded-xl shadow-2xl' : 'mt-6 sm:mt-8'}`}
// // // // //           >
// // // // //             <ShopSearchForm
// // // // //               onSubmit={searchProps.onSubmit}
// // // // //               initialValues={searchProps.initialValues}
// // // // //               isLoading={searchProps.isLoading}
// // // // //               formInstanceId={searchProps.formInstanceId}
// // // // //               showDetectLocationButton={searchProps.showDetectLocationButton}
// // // // //             />
// // // // //           </div>
// // // // //         )} */}  
// // // // //       </div>
// // // // //     </section>
// // // // //   );
// // // // // }
// // // // // // // src/components/common/HeroBillboard.tsx
// // // // // // 'use client';

// // // // // // import React from 'react';
// // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // // import { FrontendShopQueryParameters } from '@/types/api';

// // // // // // interface HeroBillboardProps {
// // // // // //   title: string;
// // // // // //   subtitle: string;
// // // // // //   highlightText?: string;
// // // // // //   showSearch?: boolean;
// // // // // //   searchProps?: {
// // // // // //     onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // // //     initialValues: Partial<FrontendShopQueryParameters>; // Changed to Partial to match ShopSearchForm
// // // // // //     isLoading: boolean;
// // // // // //     formInstanceId?: string; // Added
// // // // // //     showDetectLocationButton?: boolean; // Added
// // // // // //   };
// // // // // //   backgroundColor?: string;
// // // // // //   textColor?: string;
// // // // // //   highlightColor?: string;
// // // // // //   minHeight?: string;
// // // // // //   headerHeightClass?: string
// // // // // // }

// // // // // // export default function HeroBillboard({
// // // // // //   title,
// // // // // //   subtitle,
// // // // // //   highlightText,
// // // // // //   showSearch = true,
// // // // // //   searchProps,
// // // // // //   backgroundColor = "bg-slate-700",
// // // // // //   textColor = "text-slate-100",
// // // // // //   highlightColor = "text-sky-400",
// // // // // //   minHeight = "40vh",
// // // // // //   //
// // // // // //   headerHeightClass = "pt-16"
// // // // // // }: HeroBillboardProps) {
// // // // // //   return (
// // // // // //     <section 
// // // // // //       className={`${backgroundColor} ${textColor} flex flex-col justify-center items-center text-center p-6 sm:p-10 md:p-16 ${headerHeightClass}`}
// // // // // //       style={{ minHeight }}
// // // // // //     >
// // // // // //       <div className="max-w-2xl mx-auto">
// // // // // //         <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !leading-tight">
// // // // // //           {highlightText ? (
// // // // // //             <>
// // // // // //               {title} <span className={highlightColor}>{highlightText}</span>
// // // // // //             </>
// // // // // //           ) : (
// // // // // //             title
// // // // // //           )}
// // // // // //         </h1>
// // // // // //         <p className="mt-3 sm:mt-4 text-md sm:text-lg text-slate-300 max-w-xl mx-auto">
// // // // // //           {subtitle}
// // // // // //         </p>
        
// // // // // //         {showSearch && searchProps && (
// // // // // //           <div className="mt-6 sm:mt-8 w-full max-w-lg mx-auto">
// // // // // //             <ShopSearchForm
// // // // // //               onSubmit={searchProps.onSubmit}
// // // // // //               initialValues={searchProps.initialValues}
// // // // // //               isLoading={searchProps.isLoading}
// // // // // //               formInstanceId={searchProps.formInstanceId} // Pass down
// // // // // //               showDetectLocationButton={searchProps.showDetectLocationButton} // Pass down
// // // // // //             />
// // // // // //           </div>
// // // // // //         )}
// // // // // //       </div>
// // // // // //     </section>
// // // // // //   );
// // // // // // }
// // // // // // // // src/components/common/HeroBillboard.tsx
// // // // // // // 'use client';

// // // // // // // import React from 'react';
// // // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // // // import { FrontendShopQueryParameters } from '@/types/api';

// // // // // // // interface HeroBillboardProps {
// // // // // // //   title: string;
// // // // // // //   subtitle: string;
// // // // // // //   highlightText?: string;
// // // // // // //   showSearch?: boolean;
// // // // // // //   searchProps?: {
// // // // // // //     onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // // // //     initialValues: FrontendShopQueryParameters;
// // // // // // //     isLoading: boolean;
// // // // // // //   };
// // // // // // //   backgroundColor?: string;
// // // // // // //   textColor?: string;
// // // // // // //   highlightColor?: string;
// // // // // // //   minHeight?: string;
// // // // // // // }

// // // // // // // export default function HeroBillboard({
// // // // // // //   title,
// // // // // // //   subtitle,
// // // // // // //   highlightText,
// // // // // // //   showSearch = true,
// // // // // // //   searchProps,
// // // // // // //   backgroundColor = "bg-slate-700",
// // // // // // //   textColor = "text-slate-100",
// // // // // // //   highlightColor = "text-sky-400",
// // // // // // //   minHeight = "40vh"
// // // // // // // }: HeroBillboardProps) {
// // // // // // //   return (
// // // // // // //     <section 
// // // // // // //       className={`${backgroundColor} ${textColor} flex flex-col justify-center items-center text-center p-6 sm:p-10 md:p-16`}
// // // // // // //       style={{ minHeight }}
// // // // // // //     >
// // // // // // //       <div className="max-w-2xl mx-auto">
// // // // // // //         <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !leading-tight">
// // // // // // //           {highlightText ? (
// // // // // // //             <>
// // // // // // //               {title} <span className={highlightColor}>{highlightText}</span>
// // // // // // //             </>
// // // // // // //           ) : (
// // // // // // //             title
// // // // // // //           )}
// // // // // // //         </h1>
// // // // // // //         <p className="mt-3 sm:mt-4 text-md sm:text-lg text-slate-300 max-w-xl mx-auto">
// // // // // // //           {subtitle}
// // // // // // //         </p>
        
// // // // // // //         {showSearch && searchProps && (
// // // // // // //           <div className="mt-6 sm:mt-8 w-full max-w-lg mx-auto">
// // // // // // //             <ShopSearchForm
// // // // // // //               onSubmit={searchProps.onSubmit}
// // // // // // //               initialValues={searchProps.initialValues}
// // // // // // //               isLoading={searchProps.isLoading}
// // // // // // //             />
// // // // // // //           </div>
// // // // // // //         )}
// // // // // // //       </div>
// // // // // // //     </section>
// // // // // // //   );
// // // // // // // }
// // // // // // // // // src/components/common/HeroBillboard.tsx
// // // // // // // // 'use client';

// // // // // // // // import React from 'react';
// // // // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // // // // import { FrontendShopQueryParameters } from '@/types/api';

// // // // // // // // interface HeroBillboardProps {
// // // // // // // //   title: string;
// // // // // // // //   subtitle: string;
// // // // // // // //   highlightText?: string;
// // // // // // // //   showSearch?: boolean;
// // // // // // // //   searchProps?: {
// // // // // // // //     onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // // // // //     initialValues: FrontendShopQueryParameters;
// // // // // // // //     isLoading: boolean;
// // // // // // // //   };
// // // // // // // //   backgroundColor?: string;
// // // // // // // //   textColor?: string;
// // // // // // // //   highlightColor?: string;
// // // // // // // //   minHeight?: string;
// // // // // // // // }

// // // // // // // // export default function HeroBillboard({
// // // // // // // //   title,
// // // // // // // //   subtitle,
// // // // // // // //   highlightText,
// // // // // // // //   showSearch = false,
// // // // // // // //   searchProps,
// // // // // // // //   backgroundColor = "bg-slate-700",
// // // // // // // //   textColor = "text-slate-100",
// // // // // // // //   highlightColor = "text-sky-400",
// // // // // // // //   minHeight = "40vh"
// // // // // // // // }: HeroBillboardProps) {
// // // // // // // //   return (
// // // // // // // //     <section 
// // // // // // // //       className={`${backgroundColor} ${textColor} flex flex-col justify-center items-center text-center p-6 sm:p-10 md:p-16`}
// // // // // // // //       style={{ minHeight }}
// // // // // // // //     >
// // // // // // // //       <div className="max-w-2xl mx-auto">
// // // // // // // //         <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight !leading-tight">
// // // // // // // //           {highlightText ? (
// // // // // // // //             <>
// // // // // // // //               {title} <span className={highlightColor}>{highlightText}</span>
// // // // // // // //             </>
// // // // // // // //           ) : (
// // // // // // // //             title
// // // // // // // //           )}
// // // // // // // //         </h1>
// // // // // // // //         <p className="mt-3 sm:mt-4 text-md sm:text-lg text-slate-300 max-w-xl mx-auto">
// // // // // // // //           {subtitle}
// // // // // // // //         </p>
        
// // // // // // // //         {showSearch && searchProps && (
// // // // // // // //           <div className="mt-6 sm:mt-8 w-full max-w-lg mx-auto">
// // // // // // // //             <ShopSearchForm
// // // // // // // //               onSubmit={searchProps.onSubmit}
// // // // // // // //               initialValues={searchProps.initialValues}
// // // // // // // //               isLoading={searchProps.isLoading}
// // // // // // // //             />
// // // // // // // //           </div>
// // // // // // // //         )}
// // // // // // // //       </div>
// // // // // // // //     </section>
// // // // // // // //   );
// // // // // // // // }