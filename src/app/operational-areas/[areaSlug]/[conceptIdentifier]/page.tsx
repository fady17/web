'use client';

import React, { Suspense, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // useRouter needed for navigation
import { useQuery } from '@tanstack/react-query';
import { 
    fetchSubCategoriesByOperationalArea,
    fetchOperationalAreasForMap 
} from '@/lib/apiClient';
import { 
    SubCategoryDto, 
    APIError, 
    OperationalAreaDto,
    OperationalAreaFeatureProperties, // Import this type
    HighLevelConceptQueryParam 
} from '@/types/api';
import { featureConcepts, FeatureConceptConfig } from '@/config/categories';
import SubCategoryCard from '@/components/subcategory/SubCategoryCard';
import HeroBillboard from '@/components/common/HeroBillboard';    
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUserGeoLocation } from '@/contexts/UserGeoLocationContext';
import { useGeoData } from '@/contexts/GeoDataContext';
import { cn } from '@/lib/utils';

// --- ConceptPageClient component remains the same as your last version ---
interface ConceptPageClientProps {
  areaSlug: string; 
  conceptIdentifier: string;
  initialUserLat?: string | null;
  initialUserLon?: string | null;
  initialRadius?: string | null;
  initialSortBy?: string | null;
  initialSearchTerm?: string | null;
}

function ConceptPageClient({
  areaSlug,
  conceptIdentifier,
  initialUserLat,
  initialUserLon,
  initialRadius,
  initialSortBy,
  initialSearchTerm,
}: ConceptPageClientProps) {
  const router = useRouter(); // Can keep if used for other internal nav
  const {
    currentLocation: contextLocation,
    setCurrentLocation: setContextLocation,
  } = useUserGeoLocation();

  useEffect(() => {
    if (initialUserLat && initialUserLon) {
      const lat = parseFloat(initialUserLat);
      const lon = parseFloat(initialUserLon);
      const radius = initialRadius ? parseInt(initialRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE);
      
      if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
           setContextLocation({ 
               latitude: lat, 
               longitude: lon, 
               radiusInMeters: radius, 
               timestamp: Date.now() 
            }, 'url_param'); 
         }
      }
    }
  }, [initialUserLat, initialUserLon, initialRadius, setContextLocation, contextLocation]);

  const currentFeatureConcept = useMemo(() =>
    featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
    [conceptIdentifier]
  );
  const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

  const { data: operationalAreaDetails, isLoading: isLoadingAreaDetails } = useQuery<OperationalAreaDto | undefined, APIError>({
    queryKey: ['operationalAreaDetails', areaSlug],
    queryFn: async () => {
      if (!areaSlug) return undefined;
      const areas = await fetchOperationalAreasForMap(); 
      return areas.find(oa => oa.slug === areaSlug);
    },
    enabled: !!areaSlug,
    staleTime: 1000 * 60 * 60, 
    refetchOnWindowFocus: false,
  });

  const {
    data: subCategories,
    isLoading: isLoadingSubCategories,
    error: subCategoriesError
  } = useQuery<SubCategoryDto[], APIError>({
      queryKey: ['subCategoriesByAreaAndConcept', areaSlug, apiConceptFilter],
      queryFn: () => {
        if (!areaSlug || !apiConceptFilter) return Promise.resolve([]);
        return fetchSubCategoriesByOperationalArea(areaSlug, apiConceptFilter as HighLevelConceptQueryParam);
      },
      enabled: !!areaSlug && !!apiConceptFilter && !!operationalAreaDetails, 
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });

  const areaDisplayNameForMessages = areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const conceptDisplayNameForMessages = currentFeatureConcept?.nameEn || conceptIdentifier.replace(/-/g, ' ');

  if (!currentFeatureConcept) {
    return (
      <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <Alert variant="destructive" className="max-w-lg mx-auto bg-red-700/20 border-red-500/50 text-red-200 backdrop-blur-md">
          <Info className="h-5 w-5" />
          <AlertTitle>Invalid Service Category</AlertTitle>
          <AlertDescription>The category "{conceptIdentifier}" is not recognized.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
          <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
        </Button>
      </div>
    );
  }
  
  const areaDisplayName = operationalAreaDetails?.nameEn || areaDisplayNameForMessages;
  const conceptDisplayName = currentFeatureConcept.nameEn;

  const constructSubCategoryLink = (subCategorySlugParam: string): string => {
    const query = new URLSearchParams();
    if (initialSearchTerm) query.set("name", initialSearchTerm);

    const latStr = initialUserLat || contextLocation?.latitude?.toString();
    const lonStr = initialUserLon || contextLocation?.longitude?.toString();
    const radiusStr = initialRadius || contextLocation?.radiusInMeters?.toString();
    let sortByStr = initialSortBy;

    if (latStr && lonStr) {
        query.set("userLatitude", latStr);
        query.set("userLongitude", lonStr);
        if (radiusStr) query.set("radiusInMeters", radiusStr);
        if (!sortByStr) sortByStr = "distance_asc";
    }
    if (sortByStr) query.set("sortBy", sortByStr);
    
    let link = `/operational-areas/${areaSlug}/categories/${subCategorySlugParam}/shops`;
    const queryString = query.toString();
    if (queryString) {
      link += `?${queryString}`;
    }
    return link;
  };
  
  if (isLoadingAreaDetails && !operationalAreaDetails) { 
      return <LoadingFallback message={`Loading details for ${areaDisplayNameForMessages}...`} glassEffect={true} />;
  }
  if (!isLoadingAreaDetails && !operationalAreaDetails) { 
      return (
           <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
                <Alert variant="default" className="max-w-xl mx-auto bg-yellow-600/20 border-yellow-500/50 text-yellow-100 backdrop-blur-md">
                <Info className="h-5 w-5" />
                <AlertTitle>Area Not Found</AlertTitle>
                <AlertDescription>
                    The area "{areaDisplayNameForMessages}" could not be found or is not active.
                </AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/')} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
                </Button>
            </div>
      );
  }

  return (
    <>
      <div className="bg-black/10 backdrop-blur-md py-8 md:py-12 border-b border-white/10 text-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white text-shadow-strong tracking-tight">
                {conceptDisplayName}
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-slate-300 text-shadow-medium">
                in {areaDisplayName}
            </p>
          </div>
      </div>

      <nav aria-label="Breadcrumb" className="bg-black/30 backdrop-blur-lg border-b border-white/10 shadow-md sticky top-[68px] sm:top-[84px] z-10"> 
        <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300">
          <li><Link href="/" className="hover:text-emerald-400 hover:underline">Home</Link></li>
          <li><span className="text-slate-400">/</span></li>
          <li>
            <Link
              href={`/?area=${areaSlug}`} 
              className="hover:text-emerald-400 hover:underline"
              aria-label={`Back to ${areaDisplayName} overview on homepage`}
            >
              {areaDisplayName}
            </Link>
          </li>
          <li><span className="text-slate-400">/</span></li>
          <li className="font-medium text-white" aria-current="page">{conceptDisplayName}</li>
        </ol>
      </nav>

      <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {initialSearchTerm && (
            <p className="text-center text-slate-300 mb-6 text-sm text-shadow-soft">
                (Searching for services related to: "{initialSearchTerm}")
            </p>
        )}

        {isLoadingSubCategories && !subCategories ? (
          <LoadingFallback message={`Loading ${conceptDisplayNameForMessages.toLowerCase()} categories...`} glassEffect={true} />
        ) : subCategoriesError ? (
          <Alert variant="destructive" className="my-6 max-w-xl mx-auto bg-red-700/20 border-red-500/50 text-red-200 backdrop-blur-md">
            <Info className="h-5 w-5" />
            <AlertTitle className="font-semibold">Could Not Load Categories</AlertTitle>
            <AlertDescription>
              {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        ) : subCategories && subCategories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {subCategories.map((subCat) => (
              <SubCategoryCard
                key={subCat.slug}
                subCategory={subCat}
                areaSlug={areaSlug} 
                href={constructSubCategoryLink(subCat.slug)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
            <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 mb-2 text-shadow-medium">No Categories Found</h3>
            <p className="text-base text-slate-400 max-w-md mx-auto text-shadow-soft">
              There are currently no specific "{conceptDisplayNameForMessages.toLowerCase()}" categories listed for {areaDisplayName}.
            </p>
            <Button onClick={() => router.back()} variant="outline" className="mt-8 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
                <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
// --- End of ConceptPageClient ---


export default function ConceptCategorizationPageWrapper() {
  const params = useParams();
  const searchParamsHook = useSearchParams();
  const router = useRouter(); // <<< Import and use useRouter here for navigation

  const areaSlugFromUrl = typeof params.areaSlug === 'string' ? params.areaSlug : ""; 
  const conceptIdentifier = typeof params.conceptIdentifier === 'string' ? params.conceptIdentifier : "";

  const { egyptBoundaryGeoJsonString, isLoadingEgyptBoundary } = useGeoData();

  const { data: allOperationalAreas, isLoading: isLoadingAllAreas } = useQuery<OperationalAreaDto[], APIError>({
    queryKey: ['operationalAreasForMap'],
    queryFn: fetchOperationalAreasForMap,
    staleTime: 1000 * 60 * 60, 
    refetchOnWindowFocus: false,
  });

  const searchTermFromUrl = searchParamsHook.get('name');
  const userLatFromUrl = searchParamsHook.get('userLatitude');
  const userLonFromUrl = searchParamsHook.get('userLongitude');
  const radiusFromUrl = searchParamsHook.get('radiusInMeters');
  const sortByFromUrl = searchParamsHook.get('sortBy');

  const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

  // Define the callback for map polygon clicks
  const handleMapAreaSelect = useCallback((selectedAreaProperties: OperationalAreaFeatureProperties) => {
    const newAreaSlug = selectedAreaProperties.slug;
    if (newAreaSlug && newAreaSlug !== areaSlugFromUrl) {
      // Construct the new URL, preserving existing search params if desired
      const currentQueryParams = new URLSearchParams(searchParamsHook.toString());
      // You might want to clear or update location-specific params if the area changes drastically
      // For now, let's assume we keep them or they are re-evaluated.
      
      const newPath = `/operational-areas/${newAreaSlug}/${conceptIdentifier}?${currentQueryParams.toString()}`;
      router.push(newPath);
    }
  }, [areaSlugFromUrl, conceptIdentifier, router, searchParamsHook]);


  if (!areaSlugFromUrl || !conceptIdentifier) {
    return <LoadingFallback message="Loading page details..." glassEffect={true} />;
  }
  
  const currentAreaForMap = allOperationalAreas?.find(oa => oa.slug === areaSlugFromUrl);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <HeroBillboard
          minHeight="min-h-screen"
          isMapMode={true}
          operationalAreas={allOperationalAreas || []}
          isLoadingMapData={isLoadingAllAreas || isLoadingEgyptBoundary}
          onOperationalAreaSelect={handleMapAreaSelect} // <<< PASS THE HANDLER
          activeOperationalAreaSlug={areaSlugFromUrl} 
          initialMapCenter={currentAreaForMap ? [currentAreaForMap.centroidLatitude, currentAreaForMap.centroidLongitude] : [26.8206, 30.8025]}
          initialMapZoom={currentAreaForMap ? (currentAreaForMap.defaultMapZoomLevel || 10) : 6}
          egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
        />
      </div>

      <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
        <div className="flex-1 flex flex-col w-full bg-black/60 backdrop-blur-xl overflow-y-auto pointer-events-auto rounded-t-2xl sm:rounded-t-3xl mt-[5vh] sm:mt-[10vh] shadow-2xl border-t-2 border-white/10"> 
          <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories...`} glassEffect={true} />}>
            <ConceptPageClient
              areaSlug={areaSlugFromUrl} // Pass the current areaSlug from URL
              conceptIdentifier={conceptIdentifier}
              initialSearchTerm={searchTermFromUrl}
              initialUserLat={userLatFromUrl}
              initialUserLon={userLonFromUrl}
              initialRadius={radiusFromUrl}
              initialSortBy={sortByFromUrl}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback({ message = "Loading...", glassEffect = false }: { message?: string, glassEffect?: boolean }) {
  return (
    <div className={cn(
        "flex flex-col min-h-[calc(100vh-250px)] justify-center items-center text-center px-4",
        glassEffect ? "text-slate-200" : "bg-slate-50 text-slate-600"
    )}>
      <Loader2 className={cn("h-12 w-12 animate-spin mb-4", glassEffect ? "text-emerald-400" : "text-orange-500")} />
      <p className="text-lg">{message}</p>
    </div>
  );
}

const DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE = 50000;
// 'use client';

// import React, { Suspense, useEffect, useMemo } from 'react';
// import { useParams, useRouter, useSearchParams } from 'next/navigation';
// import { useQuery } from '@tanstack/react-query';
// import { 
//     fetchSubCategoriesByOperationalArea,
//     fetchOperationalAreasForMap 
// } from '@/lib/apiClient';
// import { 
//     SubCategoryDto, 
//     APIError, 
//     OperationalAreaDto,
//     HighLevelConceptQueryParam 
// } from '@/types/api';
// import { featureConcepts, FeatureConceptConfig } from '@/config/categories';
// import SubCategoryCard from '@/components/subcategory/SubCategoryCard'; // Will need glass styling
// import HeroBillboard from '@/components/common/HeroBillboard';    // For map background
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// import Link from 'next/link';
// import { Button } from '@/components/ui/button';
// import { useUserGeoLocation } from '@/contexts/UserGeoLocationContext';
// import { cn } from '@/lib/utils'; // Import cn
// import { useGeoData } from '@/contexts/GeoDataContext'; // <<< NEW IMPORT


// interface ConceptPageClientProps {
//   areaSlug: string;
//   conceptIdentifier: string;
//   initialUserLat?: string | null;
//   initialUserLon?: string | null;
//   initialRadius?: string | null;
//   initialSortBy?: string | null;
//   initialSearchTerm?: string | null;
//   // For passing down to the HeroBillboard map background
//   mapOperationalAreas?: OperationalAreaDto[];
//   isLoadingMapData?: boolean;
//   activeOperationalAreaSlug?: string | null;
//   egyptBoundaryGeoJson?: string | null; // If you use this on other pages too
// }

// function ConceptPageClient({
//   areaSlug,
//   conceptIdentifier,
//   initialUserLat,
//   initialUserLon,
//   initialRadius,
//   initialSortBy,
//   initialSearchTerm,
//   mapOperationalAreas,    // For HeroBillboard background map
//   isLoadingMapData,       // For HeroBillboard background map
//   activeOperationalAreaSlug, // For HeroBillboard background map
//   egyptBoundaryGeoJson,    // For HeroBillboard background map
// }: ConceptPageClientProps) {
//   const router = useRouter();
//   const {
//     currentLocation: contextLocation,
//     setCurrentLocation: setContextLocation,
//   } = useUserGeoLocation();

//   useEffect(() => {
//     if (initialUserLat && initialUserLon) {
//       const lat = parseFloat(initialUserLat);
//       const lon = parseFloat(initialUserLon);
//       const radius = initialRadius ? parseInt(initialRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE);
      
//       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
//          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
//            setContextLocation({ 
//                latitude: lat, 
//                longitude: lon, 
//                radiusInMeters: radius, 
//                timestamp: Date.now() 
//             }, 'url_param'); 
//          }
//       }
//     }
//   }, [initialUserLat, initialUserLon, initialRadius, setContextLocation, contextLocation]);

//   const currentFeatureConcept = useMemo(() =>
//     featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
//     [conceptIdentifier]
//   );
//   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

//   const { data: operationalAreaDetails, isLoading: isLoadingAreaDetails } = useQuery<OperationalAreaDto | undefined, APIError>({
//     queryKey: ['operationalAreaDetails', areaSlug],
//     queryFn: async () => {
//       if (!areaSlug) return undefined;
//       const areas = await fetchOperationalAreasForMap(); 
//       return areas.find(oa => oa.slug === areaSlug);
//     },
//     enabled: !!areaSlug,
//     staleTime: 1000 * 60 * 60, 
//     refetchOnWindowFocus: false,
//   });

//   const {
//     data: subCategories,
//     isLoading: isLoadingSubCategories,
//     error: subCategoriesError
//   } = useQuery<SubCategoryDto[], APIError>({
//       queryKey: ['subCategoriesByAreaAndConcept', areaSlug, apiConceptFilter],
//       queryFn: () => {
//         if (!areaSlug || !apiConceptFilter) return Promise.resolve([]);
//         return fetchSubCategoriesByOperationalArea(areaSlug, apiConceptFilter as HighLevelConceptQueryParam);
//       },
//       enabled: !!areaSlug && !!apiConceptFilter && !!operationalAreaDetails, 
//       staleTime: 1000 * 60 * 5,
//       refetchOnWindowFocus: false,
//     });

//   // Enhanced Loading/Error States for Glass UI
//   const areaDisplayNameForMessages = areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//   const conceptDisplayNameForMessages = currentFeatureConcept?.nameEn || conceptIdentifier.replace(/-/g, ' ');

//   if (!currentFeatureConcept) {
//     return (
//       <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <Alert variant="destructive" className="max-w-lg mx-auto bg-red-700/20 border-red-500/50 text-red-200 backdrop-blur-md">
//           <Info className="h-5 w-5" />
//           <AlertTitle>Invalid Service Category</AlertTitle>
//           <AlertDescription>The category "{conceptIdentifier}" is not recognized.</AlertDescription>
//         </Alert>
//         <Button onClick={() => router.push('/')} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
//           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
//         </Button>
//       </div>
//     );
//   }
  
//   const areaDisplayName = operationalAreaDetails?.nameEn || areaDisplayNameForMessages;
//   const conceptDisplayName = currentFeatureConcept.nameEn;

//   const constructSubCategoryLink = (subCategorySlugParam: string): string => {
//     const query = new URLSearchParams();
//     if (initialSearchTerm) query.set("name", initialSearchTerm);

//     const latStr = initialUserLat || contextLocation?.latitude?.toString();
//     const lonStr = initialUserLon || contextLocation?.longitude?.toString();
//     const radiusStr = initialRadius || contextLocation?.radiusInMeters?.toString();
//     let sortByStr = initialSortBy;

//     if (latStr && lonStr) {
//         query.set("userLatitude", latStr);
//         query.set("userLongitude", lonStr);
//         if (radiusStr) query.set("radiusInMeters", radiusStr);
//         if (!sortByStr) sortByStr = "distance_asc";
//     }
//     if (sortByStr) query.set("sortBy", sortByStr);
    
//     let link = `/operational-areas/${areaSlug}/categories/${subCategorySlugParam}/shops`;
//     const queryString = query.toString();
//     if (queryString) {
//       link += `?${queryString}`;
//     }
//     return link;
//   };
  
//   if (isLoadingAreaDetails && !operationalAreaDetails) { 
//       return <LoadingFallback message={`Loading details for ${areaDisplayNameForMessages}...`} glassEffect={true} />;
//   }
//   if (!isLoadingAreaDetails && !operationalAreaDetails) { 
//       return (
//            <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//                 <Alert variant="default" className="max-w-xl mx-auto bg-yellow-600/20 border-yellow-500/50 text-yellow-100 backdrop-blur-md">
//                 <Info className="h-5 w-5" />
//                 <AlertTitle>Area Not Found</AlertTitle>
//                 <AlertDescription>
//                     The area "{areaDisplayNameForMessages}" could not be found or is not active.
//                 </AlertDescription>
//                 </Alert>
//                 <Button onClick={() => router.push('/')} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
//                     <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
//                 </Button>
//             </div>
//       );
//   }

//   // Main Content: Hero text, breadcrumbs, and subcategory list
//   // This content will be inside the scrollable glass panel
//   return (
//     <>
//       {/* Page Title Section (Concept & Area) - This is a small hero-like banner, not the main map billboard */}
//       {/* It will sit at the top of the glass panel, under the sticky search (if we add one) or site header */}
//       <div className="bg-black/10 backdrop-blur-md py-8 md:py-12 border-b border-white/10 text-center">
//           <div className="container mx-auto px-4 sm:px-6 lg:px-8">
//             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white text-shadow-strong tracking-tight">
//                 {conceptDisplayName}
//             </h1>
//             <p className="mt-2 text-lg sm:text-xl text-slate-300 text-shadow-medium">
//                 in {areaDisplayName}
//             </p>
//           </div>
//       </div>

//       {/* Breadcrumbs with glass effect */}
//       <nav aria-label="Breadcrumb" className="bg-black/30 backdrop-blur-lg border-b border-white/10 shadow-md sticky top-[68px] sm:top-[84px] z-10"> 
//       {/* Assuming header height is 68px/84px. Adjust if different. This makes breadcrumbs stick under the main header. */}
//         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300">
//           <li><Link href="/" className="hover:text-emerald-400 hover:underline">Home</Link></li>
//           <li><span className="text-slate-400">/</span></li>
//           <li>
//             <Link
//               href={`/?area=${areaSlug}`} 
//               className="hover:text-emerald-400 hover:underline"
//               aria-label={`Back to ${areaDisplayName} overview on homepage`}
//             >
//               {areaDisplayName}
//             </Link>
//           </li>
//           <li><span className="text-slate-400">/</span></li>
//           <li className="font-medium text-white" aria-current="page">{conceptDisplayName}</li>
//         </ol>
//       </nav>

//       {/* Main content for subcategories */}
//       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
//         {initialSearchTerm && (
//             <p className="text-center text-slate-300 mb-6 text-sm text-shadow-soft">
//                 (Searching for services related to: "{initialSearchTerm}")
//             </p>
//         )}

//         {isLoadingSubCategories && !subCategories ? (
//           <LoadingFallback message={`Loading ${conceptDisplayNameForMessages.toLowerCase()} categories...`} glassEffect={true} />
//         ) : subCategoriesError ? (
//           <Alert variant="destructive" className="my-6 max-w-xl mx-auto bg-red-700/20 border-red-500/50 text-red-200 backdrop-blur-md">
//             <Info className="h-5 w-5" />
//             <AlertTitle className="font-semibold">Could Not Load Categories</AlertTitle>
//             <AlertDescription>
//               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
//             </AlertDescription>
//           </Alert>
//         ) : subCategories && subCategories.length > 0 ? (
//           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
//             {subCategories.map((subCat) => (
//               <SubCategoryCard // This component needs internal styling for glass
//                 key={subCat.slug}
//                 subCategory={subCat}
//                 areaSlug={areaSlug} 
//                 href={constructSubCategoryLink(subCat.slug)}
//                 // className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg" // Example: Pass glass style if component accepts
//               />
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-12 px-4">
//             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
//             <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 mb-2 text-shadow-medium">No Categories Found</h3>
//             <p className="text-base text-slate-400 max-w-md mx-auto text-shadow-soft">
//               There are currently no specific "{conceptDisplayNameForMessages.toLowerCase()}" categories listed for {areaDisplayName}.
//             </p>
//             <Button onClick={() => router.back()} variant="outline" className="mt-8 text-slate-100 border-slate-100/30 hover:bg-slate-50/10">
//                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
//             </Button>
//           </div>
//         )}
//       </section>
//     </>
//   );
// }

// // Main page component that wraps Client component and provides fixed map background
// export default function ConceptCategorizationPageWrapper() {
//   const params = useParams();
//   const searchParamsHook = useSearchParams();

//   const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : ""; 
//   const conceptIdentifier = typeof params.conceptIdentifier === 'string' ? params.conceptIdentifier : "";

//    const { egyptBoundaryGeoJsonString, isLoadingEgyptBoundary } = useGeoData(); // <<< USE CONTEXT

//   // Fetch all operational areas once for the background map context
//   // This is similar to homepage, providing a consistent map background
//   const { data: allOperationalAreas, isLoading: isLoadingAllAreas } = useQuery<OperationalAreaDto[], APIError>({
//     queryKey: ['operationalAreasForMap'], // Use same key as homepage to leverage cache
//     queryFn: fetchOperationalAreasForMap,
//     staleTime: 1000 * 60 * 60, 
//     refetchOnWindowFocus: false,
//   });

//   // Reuse egyptBoundaryGeoJsonString from homepage if available globally or via context,
//   // or re-fetch/re-import here if necessary. For simplicity, assuming it might be passed or re-imported.
//   // const egyptBoundaryGeoJsonString = useMemo(() => {
//   //   if (typeof window !== 'undefined' && (window as any).egyptBoundaryData) { // Example: if loaded globally
//   //       return JSON.stringify((window as any).egyptBoundaryData);
//   //   }
//   //   if (egyptBoundaryData) { // If imported locally
//   //       return JSON.stringify(egyptBoundaryData);
//   //   }
//   //   return null;
//   // }, []);


//   const searchTermFromUrl = searchParamsHook.get('name');
//   const userLatFromUrl = searchParamsHook.get('userLatitude');
//   const userLonFromUrl = searchParamsHook.get('userLongitude');
//   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
//   const sortByFromUrl = searchParamsHook.get('sortBy');

//   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]"; // From your layout

//   if (!areaSlug || !conceptIdentifier) {
//     // This should ideally be caught by Next.js routing if params are required
//     return <LoadingFallback message="Loading page details..." glassEffect={true} />;
//   }
  
//   const currentAreaForMap = allOperationalAreas?.find(oa => oa.slug === areaSlug);

//   return (
//     <div className="relative min-h-screen overflow-x-hidden">
//       {/* FIXED MAP BACKGROUND */}
//       <div className="fixed inset-0 z-0">
//         <HeroBillboard
//           minHeight="min-h-screen"
//           isMapMode={true}
//           operationalAreas={allOperationalAreas || []}
//           isLoadingMapData={isLoadingAllAreas}
//           // onOperationalAreaSelect might not be needed for background map, or could navigate
//           activeOperationalAreaSlug={areaSlug} // Highlight current area on background map
//           initialMapCenter={currentAreaForMap ? [currentAreaForMap.centroidLatitude, currentAreaForMap.centroidLongitude] : [26.8206, 30.8025]}
//           initialMapZoom={currentAreaForMap ? (currentAreaForMap.defaultMapZoomLevel || 10) : 6}
//           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
//         />
//       </div>

//       {/* SCROLLABLE CONTENT AREA ON TOP OF MAP */}
//       <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
//         {/* This div below is the main scrollable container FOR THE CONTENT ON THIS PAGE (excluding the fixed header) */}
//         {/* It re-enables pointer events for its children. */}
//         <div className="flex-1 flex flex-col w-full bg-black/60 backdrop-blur-xl overflow-y-auto pointer-events-auto rounded-t-2xl sm:rounded-t-3xl mt-[5vh] sm:mt-[10vh] shadow-2xl border-t-2 border-white/10"> 
//         {/* mt-[5vh] creates some initial map visibility above this panel */}
//           <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories...`} glassEffect={true} />}>
//             <ConceptPageClient
//               areaSlug={areaSlug}
//               conceptIdentifier={conceptIdentifier}
//               initialSearchTerm={searchTermFromUrl}
//               initialUserLat={userLatFromUrl}
//               initialUserLon={userLonFromUrl}
//               initialRadius={radiusFromUrl}
//               initialSortBy={sortByFromUrl}
//               // Pass map related data for the background HeroBillboard instance if needed, though it's self-contained
//               // mapOperationalAreas={allOperationalAreas}
//               // isLoadingMapData={isLoadingAllAreas}
//               // activeOperationalAreaSlug={areaSlug}
//               // egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
//             />
//           </Suspense>
//         </div>
//       </div>
//     </div>
//   );
// }


// function LoadingFallback({ message = "Loading...", glassEffect = false }: { message?: string, glassEffect?: boolean }) {
//   return (
//     <div className={cn(
//         "flex flex-col min-h-[calc(100vh-250px)] justify-center items-center text-center px-4", // Adjusted min-height
//         glassEffect ? "text-slate-200" : "bg-slate-50 text-slate-600"
//     )}>
//       <Loader2 className={cn("h-12 w-12 animate-spin mb-4", glassEffect ? "text-emerald-400" : "text-orange-500")} />
//       <p className="text-lg">{message}</p>
//     </div>
//   );
// }

// const DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE = 50000;
// // // src/app/operational-areas/[areaSlug]/[conceptIdentifier]/page.tsx
// // 'use client';

// // import React, { Suspense, useEffect, useMemo } from 'react';
// // import { useParams, useRouter, useSearchParams } from 'next/navigation';
// // import { useQuery } from '@tanstack/react-query';
// // import { 
// //     fetchSubCategoriesByOperationalArea, // UPDATED
// //     fetchOperationalAreasForMap // To get current area details for display
// // } from '@/lib/apiClient';
// // import { 
// //     SubCategoryDto, 
// //     APIError, 
// //     OperationalAreaDto, // UPDATED
// //     HighLevelConceptQueryParam 
// // } from '@/types/api';
// // import { featureConcepts, FeatureConceptConfig } from '@/config/categories';
// // import SubCategoryCard from '@/components/subcategory/SubCategoryCard';
// // import HeroBillboard from '@/components/common/HeroBillboard';
// // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// // import Link from 'next/link';
// // import { Button } from '@/components/ui/button';
// // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';

// // const DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE = 50000; // Consistent with homepage

// // interface ConceptPageClientProps {
// //   areaSlug: string; // UPDATED from citySlug
// //   conceptIdentifier: string;
// //   initialUserLat?: string | null;
// //   initialUserLon?: string | null;
// //   initialRadius?: string | null;
// //   initialSortBy?: string | null;
// //   initialSearchTerm?: string | null;
// // }

// // function ConceptPageClient({
// //   areaSlug, // UPDATED
// //   conceptIdentifier,
// //   initialUserLat,
// //   initialUserLon,
// //   initialRadius,
// //   initialSortBy,
// //   initialSearchTerm
// // }: ConceptPageClientProps) {
// //   const router = useRouter();
// //   const {
// //     currentLocation: contextLocation,
// //     setCurrentLocation: setContextLocation,
// //     // isLoading: isLoadingContextLocation // Not directly used here for primary loading state
// //   } = useUserGeoLocation();

// //   useEffect(() => {
// //     if (initialUserLat && initialUserLon) {
// //       const lat = parseFloat(initialUserLat);
// //       const lon = parseFloat(initialUserLon);
// //       const radius = initialRadius ? parseInt(initialRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE);
      
// //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// //            setContextLocation({ 
// //                latitude: lat, 
// //                longitude: lon, 
// //                radiusInMeters: radius, 
// //                timestamp: Date.now() 
// //             }, 'url_param'); 
// //          }
// //       }
// //     }
// //   }, [initialUserLat, initialUserLon, initialRadius, setContextLocation, contextLocation]);

// //   const currentFeatureConcept = useMemo(() =>
// //     featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
// //     [conceptIdentifier]
// //   );
// //   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

// //   // Fetch details for the current Operational Area for display purposes
// //   const { data: operationalAreaDetails, isLoading: isLoadingAreaDetails } = useQuery<OperationalAreaDto | undefined, APIError>({
// //     queryKey: ['operationalAreaDetails', areaSlug], // UPDATED
// //     queryFn: async () => {
// //       if (!areaSlug) return undefined;
// //       // Fetching all and finding one; a dedicated endpoint would be better for performance
// //       const areas = await fetchOperationalAreasForMap(); 
// //       return areas.find(oa => oa.slug === areaSlug);
// //     },
// //     enabled: !!areaSlug,
// //     staleTime: 1000 * 60 * 60, 
// //     refetchOnWindowFocus: false,
// //   });

// //   const {
// //     data: subCategories,
// //     isLoading: isLoadingSubCategories,
// //     error: subCategoriesError
// //   } = useQuery<SubCategoryDto[], APIError>({
// //       queryKey: ['subCategoriesByAreaAndConcept', areaSlug, apiConceptFilter], // UPDATED
// //       queryFn: () => {
// //         if (!areaSlug || !apiConceptFilter) return Promise.resolve([]);
// //         return fetchSubCategoriesByOperationalArea(areaSlug, apiConceptFilter as HighLevelConceptQueryParam); // UPDATED
// //       },
// //       enabled: !!areaSlug && !!apiConceptFilter && !!operationalAreaDetails, // UPDATED
// //       staleTime: 1000 * 60 * 5,
// //       refetchOnWindowFocus: false,
// //     });

// //   if (!currentFeatureConcept) {
// //     return (
// //       <div className="container mx-auto px-4 py-10 text-center">
// //         <Alert variant="destructive" className="max-w-lg mx-auto">
// //           <Info className="h-5 w-5" />
// //           <AlertTitle>Invalid Service Category</AlertTitle>
// //           <AlertDescription>The selected service category type "{conceptIdentifier}" is not recognized.</AlertDescription>
// //         </Alert>
// //         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// //           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
// //         </Button>
// //       </div>
// //     );
// //   }

// //   // Display name logic after null/loading checks
// //   const areaDisplayName = operationalAreaDetails?.nameEn || areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // UPDATED
// //   const conceptDisplayName = currentFeatureConcept.nameEn;

// //   const constructSubCategoryLink = (subCategorySlugParam: string): string => {
// //     const query = new URLSearchParams();
// //     if (initialSearchTerm) query.set("name", initialSearchTerm);

// //     const latStr = initialUserLat || contextLocation?.latitude?.toString();
// //     const lonStr = initialUserLon || contextLocation?.longitude?.toString();
// //     const radiusStr = initialRadius || contextLocation?.radiusInMeters?.toString();
// //     let sortByStr = initialSortBy;

// //     if (latStr && lonStr) {
// //         query.set("userLatitude", latStr);
// //         query.set("userLongitude", lonStr);
// //         if (radiusStr) query.set("radiusInMeters", radiusStr);
// //         if (!sortByStr) sortByStr = "distance_asc";
// //     }
// //     if (sortByStr) query.set("sortBy", sortByStr);
    
// //     // UPDATED link structure
// //     let link = `/operational-areas/${areaSlug}/categories/${subCategorySlugParam}/shops`;
// //     const queryString = query.toString();
// //     if (queryString) {
// //       link += `?${queryString}`;
// //     }
// //     return link;
// //   };
  
// //   if (isLoadingAreaDetails && !operationalAreaDetails) { // UPDATED loading check
// //       return <LoadingFallback message={`Loading details for ${areaSlug.replace(/-/g, ' ')}...`} />;
// //   }
// //   if (!isLoadingAreaDetails && !operationalAreaDetails) { // UPDATED not found check
// //       return (
// //            <div className="container mx-auto px-4 py-10 text-center">
// //                 <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// //                 <Info className="h-5 w-5 text-yellow-600" />
// //                 <AlertTitle className="text-yellow-800">Area Not Found</AlertTitle>
// //                 <AlertDescription className="text-yellow-700">
// //                     The area "{areaSlug.replace(/-/g, ' ')}" could not be found or is not active.
// //                 </AlertDescription>
// //                 </Alert>
// //                 <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// //                     <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// //                 </Button>
// //             </div>
// //       );
// //   }

// //   return (
// //     <div className="flex flex-col bg-slate-50">
// //       <HeroBillboard
// //         title={conceptDisplayName}
// //         highlightText={`in ${areaDisplayName}`} // UPDATED
// //         subtitle={`Browse all ${conceptDisplayName.toLowerCase()} categories available in ${areaDisplayName}.`} // UPDATED
// //         //showSearch={false} // No main search bar on this page usually
// //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// //         // Assuming headerHeightClass is handled by a global layout or not needed for this specific billboard style
// //       />

// //       {/* --- BREADCRUMB UPDATED --- */}
// //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// //           {/* <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li> */}
// //           <li><span className="text-slate-400">»</span></li>
// //           <li>
// //             <Link
// //               href={`/?area=${areaSlug}`} // Link back to homepage with area context
// //               className="hover:text-orange-600 hover:underline"
// //               aria-label={`Back to ${areaDisplayName} overview on homepage`}
// //             >
// //               {areaDisplayName}
// //             </Link>
// //           </li>
// //           <li><span className="text-slate-400">»</span></li>
// //           <li className="font-medium text-slate-700" aria-current="page">{conceptDisplayName}</li>
// //         </ol>
// //       </nav>

// //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// //         <div className="text-center mb-8 md:mb-10">
// //             <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">
// //                 All {conceptDisplayName} Categories
// //             </h1>
// //             {initialSearchTerm && (
// //                 <p className="text-slate-600 mt-1 text-sm">
// //                     (Searching for services related to: "{initialSearchTerm}")
// //                 </p>
// //             )}
// //         </div>

// //         {isLoadingSubCategories && !subCategories ? (
// //           <div className="text-center py-10">
// //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// //             <p className="mt-3 text-slate-600">Loading {conceptDisplayName.toLowerCase()} categories for {areaDisplayName}...</p>
// //           </div>
// //         ) : subCategoriesError ? (
// //           <Alert variant="destructive" className="my-6 max-w-xl mx-auto">
// //             <Info className="h-5 w-5" />
// //             <AlertTitle className="font-semibold">Could Not Load Categories</AlertTitle>
// //             <AlertDescription>
// //               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
// //             </AlertDescription>
// //           </Alert>
// //         ) : subCategories && subCategories.length > 0 ? (
// //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
// //             {subCategories.map((subCat) => (
// //               <SubCategoryCard
// //                 key={subCat.slug}
// //                 subCategory={subCat}
// //                 // citySlug prop on SubCategoryCard should be renamed to areaSlug if it's used for link construction
// //                 // For now, assuming SubCategoryCard constructs its link with subCat.slug and current area/concept context
// //                 // If SubCategoryCard needs areaSlug explicitly:
// //                 areaSlug={areaSlug} 
// //                 href={constructSubCategoryLink(subCat.slug)}
// //               />
// //             ))}
// //           </div>
// //         ) : (
// //           <div className="text-center py-12 px-4">
// //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Categories Found</h3>
// //             <p className="text-base text-slate-500 max-w-md mx-auto">
// //               There are currently no specific "{conceptDisplayName.toLowerCase()}" categories listed for {areaDisplayName}.
// //             </p>
// //             <Button onClick={() => router.back()} variant="outline" className="mt-6">
// //                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
// //             </Button>
// //           </div>
// //         )}
// //       </section>
// //     </div>
// //   );
// // }

// // // Main page component that gets route params
// // export default function ConceptCategorizationPage() { // Renamed component for clarity
// //   const params = useParams();
// //   const searchParamsHook = useSearchParams(); // Consistent naming with other pages

// //   // UPDATED: Extract areaSlug
// //   const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : ""; 
// //   const conceptIdentifier = typeof params.conceptIdentifier === 'string' ? params.conceptIdentifier : "";

// //   const searchTermFromUrl = searchParamsHook.get('name');
// //   const userLatFromUrl = searchParamsHook.get('userLatitude');
// //   const userLonFromUrl = searchParamsHook.get('userLongitude');
// //   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
// //   const sortByFromUrl = searchParamsHook.get('sortBy');

// //   if (!areaSlug || !conceptIdentifier) { // UPDATED
// //     return <LoadingFallback message="Loading page details..." />;
// //   }

// //   return (
// //     <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories in ${areaSlug.replace(/-/g,' ')}...`} />}>
// //       <ConceptPageClient
// //         areaSlug={areaSlug} // UPDATED
// //         conceptIdentifier={conceptIdentifier}
// //         initialSearchTerm={searchTermFromUrl}
// //         initialUserLat={userLatFromUrl}
// //         initialUserLon={userLonFromUrl}
// //         initialRadius={radiusFromUrl}
// //         initialSortBy={sortByFromUrl}
// //       />
// //     </Suspense>
// //   );
// // }

// // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// //   return (
// //     <div className="flex flex-col min-h-[calc(100vh-150px)] justify-center items-center bg-slate-50">
// //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// //       <p className="text-slate-600 text-lg text-center">{message}</p>
// //     </div>
// //   );
// // }
// // // // src/app/cities/[citySlug]/[conceptIdentifier]/page.tsx
// // // 'use client';

// // // import React, { Suspense, useEffect, useMemo } from 'react';
// // // import { useParams, useRouter, useSearchParams } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import { fetchSubCategoriesByCity, fetchCities } from '@/lib/apiClient';
// // // import { SubCategoryDto, APIError, CityDto, HighLevelConceptQueryParam } from '@/types/api'; // Removed FrontendShopQueryParameters as not directly used here
// // // import { featureConcepts, FeatureConceptConfig } from '@/config/categories';
// // // import SubCategoryCard from '@/components/subcategory/SubCategoryCard';
// // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// // // import Link from 'next/link';
// // // import { Button } from '@/components/ui/button';
// // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext'; // UPDATED IMPORT

// // // const DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE = 500000; // Consistent default

// // // interface ConceptPageClientProps {
// // //   citySlug: string;
// // //   conceptIdentifier: string;
// // //   initialUserLat?: string | null;
// // //   initialUserLon?: string | null;
// // //   initialRadius?: string | null;
// // //   initialSortBy?: string | null;
// // //   initialSearchTerm?: string | null;
// // // }

// // // function ConceptPageClient({
// // //   citySlug,
// // //   conceptIdentifier,
// // //   initialUserLat,
// // //   initialUserLon,
// // //   initialRadius,
// // //   initialSortBy,
// // //   initialSearchTerm
// // // }: ConceptPageClientProps) {
// // //   const router = useRouter();
// // //   const {
// // //     currentLocation: contextLocation,      // UPDATED
// // //     setCurrentLocation: setContextLocation,  // UPDATED
// // //     isLoading: isLoadingContextLocation    // UPDATED (Combined state)
// // //   } = useUserGeoLocation();

// // //   // Effect to sync initial URL params to UserGeoLocationContext
// // //   useEffect(() => {
// // //     if (initialUserLat && initialUserLon) {
// // //       const lat = parseFloat(initialUserLat);
// // //       const lon = parseFloat(initialUserLon);
// // //       // Use contextLocation's radius only if initialRadius is not provided
// // //       const radius = initialRadius ? parseInt(initialRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_CONCEPT_PAGE);
      
// // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // //            setContextLocation({ 
// // //                latitude: lat, 
// // //                longitude: lon, 
// // //                radiusInMeters: radius, 
// // //                timestamp: Date.now() 
// // //             }, 'url_param'); // UPDATED: Added source
// // //          }
// // //       }
// // //     }
// // //   // eslint-disable-next-line react-hooks/exhaustive-deps
// // //   }, [initialUserLat, initialUserLon, initialRadius, setContextLocation]);
// // //   // contextLocation is omitted from deps here to prevent potential loops if it's also set by URL elsewhere.
// // //   // This effect is primarily for initializing from props.

// // //   const currentFeatureConcept = useMemo(() =>
// // //     featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
// // //     [conceptIdentifier]
// // //   );
// // //   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

// // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // //     queryKey: ['cityDetails', citySlug],
// // //     queryFn: async () => {
// // //       if (!citySlug) return undefined;
// // //       const cities = await fetchCities();
// // //       return cities.find(c => c.slug === citySlug);
// // //     },
// // //     enabled: !!citySlug,
// // //     staleTime: 1000 * 60 * 60, // City details don't change often
// // //     refetchOnWindowFocus: false,
// // //   });

// // //   const {
// // //     data: subCategories,
// // //     isLoading: isLoadingSubCategories,
// // //     error: subCategoriesError
// // //   } = useQuery<SubCategoryDto[], APIError>({
// // //       queryKey: ['subCategoriesByCityAndConcept', citySlug, apiConceptFilter], // More specific query key
// // //       queryFn: () => {
// // //         if (!citySlug || !apiConceptFilter) return Promise.resolve([]);
// // //         return fetchSubCategoriesByCity(citySlug, apiConceptFilter as HighLevelConceptQueryParam);
// // //       },
// // //       enabled: !!citySlug && !!apiConceptFilter && !!cityDetails, // Ensure cityDetails is loaded before fetching its subcategories
// // //       staleTime: 1000 * 60 * 5,
// // //       refetchOnWindowFocus: false,
// // //     });

// // //   // isLoadingPage now considers if essential data (city, concept) is loading
// // //   const isLoadingPage = isLoadingCity || (!!apiConceptFilter && isLoadingSubCategories) || (isLoadingContextLocation && !contextLocation);

// // //   if (!currentFeatureConcept) {
// // //     return (
// // //       <div className="container mx-auto px-4 py-10 text-center">
// // //         <Alert variant="destructive" className="max-w-lg mx-auto">
// // //           <Info className="h-5 w-5" />
// // //           <AlertTitle>Invalid Service Category</AlertTitle>
// // //           <AlertDescription>The selected service category type "{conceptIdentifier}" is not recognized.</AlertDescription>
// // //         </Alert>
// // //         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// // //           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
// // //         </Button>
// // //       </div>
// // //     );
// // //   }

// // //   // Display name logic after null/loading checks for cityDetails
// // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // //   const conceptDisplayName = currentFeatureConcept.nameEn;

// // //   const constructSubCategoryLink = (subCategorySlugParam: string): string => {
// // //     const query = new URLSearchParams();
// // //     // Carry forward initial search parameters from this page's load state
// // //     if (initialSearchTerm) query.set("name", initialSearchTerm);

// // //     // Use location data from props first, then context if available.
// // //     const latStr = initialUserLat || contextLocation?.latitude?.toString();
// // //     const lonStr = initialUserLon || contextLocation?.longitude?.toString();
// // //     const radiusStr = initialRadius || contextLocation?.radiusInMeters?.toString();
// // //     let sortByStr = initialSortBy;

// // //     if (latStr && lonStr) {
// // //         query.set("userLatitude", latStr);
// // //         query.set("userLongitude", lonStr);
// // //         if (radiusStr) query.set("radiusInMeters", radiusStr);
// // //         if (!sortByStr) sortByStr = "distance_asc"; // Default to distance if location present
// // //     }
// // //     if (sortByStr) query.set("sortBy", sortByStr);
    
// // //     let link = `/cities/${citySlug}/categories/${subCategorySlugParam}/shops`;
// // //     const queryString = query.toString();
// // //     if (queryString) {
// // //       link += `?${queryString}`;
// // //     }
// // //     return link;
// // //   };
  
// // //   // Initial loading state for the page content (city details must load first)
// // //   if (isLoadingCity && !cityDetails) {
// // //       return <LoadingFallback message={`Loading details for ${citySlug.replace(/-/g, ' ')}...`} />;
// // //   }
// // //   // If city query failed or city not found
// // //   if (!isLoadingCity && !cityDetails) {
// // //       return (
// // //            <div className="container mx-auto px-4 py-10 text-center">
// // //                 <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // //                 <Info className="h-5 w-5 text-yellow-600" />
// // //                 <AlertTitle className="text-yellow-800">City Not Found</AlertTitle>
// // //                 <AlertDescription className="text-yellow-700">
// // //                     The city "{citySlug.replace(/-/g, ' ')}" could not be found or is not active for these services.
// // //                 </AlertDescription>
// // //                 </Alert>
// // //                 <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// // //                     <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// // //                 </Button>
// // //             </div>
// // //       );
// // //   }


// // //   return (
// // //     <div className="flex flex-col bg-slate-50">
// // //       <HeroBillboard
// // //         title={conceptDisplayName}
// // //         highlightText={`in ${cityDisplayName}`}
// // //         subtitle={`Browse all ${conceptDisplayName.toLowerCase()} categories available in ${cityDisplayName}.`}
// // //         showSearch={false}
// // //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// // //       />

// // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li>
// // //             <Link
// // //               href={`/?city=${citySlug}`}
// // //               className="hover:text-orange-600 hover:underline"
// // //               aria-label={`Back to ${cityDisplayName} overview on homepage`}
// // //             >
// // //               {cityDisplayName}
// // //             </Link>
// // //           </li>
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li className="font-medium text-slate-700" aria-current="page">{conceptDisplayName}</li>
// // //         </ol>
// // //       </nav>

// // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // //         <div className="text-center mb-8 md:mb-10">
// // //             <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">
// // //                 All {conceptDisplayName} Categories
// // //             </h1>
// // //             {initialSearchTerm && (
// // //                 <p className="text-slate-600 mt-1 text-sm">
// // //                     (Searching for services related to: "{initialSearchTerm}")
// // //                 </p>
// // //             )}
// // //         </div>

// // //         {isLoadingSubCategories && !subCategories ? (
// // //           <div className="text-center py-10">
// // //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// // //             <p className="mt-3 text-slate-600">Loading {conceptDisplayName.toLowerCase()} categories for {cityDisplayName}...</p>
// // //           </div>
// // //         ) : subCategoriesError ? (
// // //           <Alert variant="destructive" className="my-6 max-w-xl mx-auto">
// // //             <Info className="h-5 w-5" />
// // //             <AlertTitle className="font-semibold">Could Not Load Categories</AlertTitle>
// // //             <AlertDescription>
// // //               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
// // //             </AlertDescription>
// // //           </Alert>
// // //         ) : subCategories && subCategories.length > 0 ? (
// // //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
// // //             {subCategories.map((subCat) => (
// // //               <SubCategoryCard
// // //                 key={subCat.slug}
// // //                 subCategory={subCat}
// // //                 citySlug={citySlug} // citySlug is available from props
// // //                 href={constructSubCategoryLink(subCat.slug)}
// // //               />
// // //             ))}
// // //           </div>
// // //         ) : (
// // //           <div className="text-center py-12 px-4">
// // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Categories Found</h3>
// // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // //               There are currently no specific "{conceptDisplayName.toLowerCase()}" categories listed for {cityDisplayName}.
// // //             </p>
// // //             <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // //                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
// // //             </Button>
// // //           </div>
// // //         )}
// // //       </section>
// // //     </div>
// // //   );
// // // }

// // // export default function ConceptPage() {
// // //   const params = useParams();
// // //   const searchParamsHook = useSearchParams();

// // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // //   const conceptIdentifier = typeof params.conceptIdentifier === 'string' ? params.conceptIdentifier : "";

// // //   const searchTermFromUrl = searchParamsHook.get('name'); // Use 'name' for consistency
// // //   const userLatFromUrl = searchParamsHook.get('userLatitude');
// // //   const userLonFromUrl = searchParamsHook.get('userLongitude');
// // //   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
// // //   const sortByFromUrl = searchParamsHook.get('sortBy');

// // //   if (!citySlug || !conceptIdentifier) {
// // //     return <LoadingFallback message="Loading page details..." />;
// // //   }

// // //   return (
// // //     <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories in ${citySlug.replace(/-/g,' ')}...`} />}>
// // //       <ConceptPageClient
// // //         citySlug={citySlug}
// // //         conceptIdentifier={conceptIdentifier}
// // //         initialSearchTerm={searchTermFromUrl}
// // //         initialUserLat={userLatFromUrl}
// // //         initialUserLon={userLonFromUrl}
// // //         initialRadius={radiusFromUrl}
// // //         initialSortBy={sortByFromUrl}
// // //       />
// // //     </Suspense>
// // //   );
// // // }

// // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // //   return (
// // //     <div className="flex flex-col min-h-[calc(100vh-150px)] justify-center items-center bg-slate-50">
// // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // //       <p className="text-slate-600 text-lg">{message}</p>
// // //     </div>
// // //   );
// // // }
// // // // // src/app/cities/[citySlug]/[conceptIdentifier]/page.tsx
// // // // 'use client';

// // // // import React, { Suspense, useEffect, useMemo } from 'react';
// // // // import { useParams, useRouter, useSearchParams } from 'next/navigation';
// // // // import { useQuery } from '@tanstack/react-query';
// // // // import { fetchSubCategoriesByCity, fetchCities } from '@/lib/apiClient';
// // // // import { SubCategoryDto, APIError, CityDto, HighLevelConceptQueryParam, FrontendShopQueryParameters } from '@/types/api'; // Added FrontendShopQueryParameters
// // // // import { featureConcepts, FeatureConceptConfig } from '@/config/categories'; 
// // // // import SubCategoryCard from '@/components/subcategory/SubCategoryCard'; 
// // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// // // // import Link from 'next/link';
// // // // import { Button } from '@/components/ui/button';
// // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/UserGeoLocationContext';

// // // // interface ConceptPageClientProps {
// // // //   citySlug: string;
// // // //   conceptIdentifier: string; 
// // // //   initialUserLat?: string | null;
// // // //   initialUserLon?: string | null;
// // // //   initialRadius?: string | null;
// // // //   initialSortBy?: string | null;
// // // //   initialSearchTerm?: string | null;
// // // // }

// // // // function ConceptPageClient({ 
// // // //   citySlug, 
// // // //   conceptIdentifier, 
// // // //   initialUserLat,
// // // //   initialUserLon,
// // // //   initialRadius,
// // // //   initialSortBy,
// // // //   initialSearchTerm 
// // // // }: ConceptPageClientProps) {
// // // //   const router = useRouter();
// // // //   const { 
// // // //     currentUserLocation: contextLocation,
// // // //     setCurrentUserLocation: setContextLocation,
// // // //     isLoading: isLoadingContextLocation 
// // // //   } = useSimpleLocation();

// // // //   useEffect(() => {
// // // //     if (initialUserLat && initialUserLon) {
// // // //       const lat = parseFloat(initialUserLat);
// // // //       const lon = parseFloat(initialUserLon);
// // // //       const radius = initialRadius ? parseInt(initialRadius) : (contextLocation?.radiusInMeters || 500000);
// // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() });
// // // //          }
// // // //       }
// // // //     }
// // // //   }, [initialUserLat, initialUserLon, initialRadius, contextLocation, setContextLocation]);

// // // //   const currentFeatureConcept = useMemo(() => 
// // // //     featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
// // // //     [conceptIdentifier]
// // // //   );
// // // //   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

// // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // //     queryKey: ['cityDetails', citySlug],
// // // //     queryFn: async () => {
// // // //       if (!citySlug) return undefined;
// // // //       const cities = await fetchCities();
// // // //       return cities.find(c => c.slug === citySlug);
// // // //     },
// // // //     enabled: !!citySlug,
// // // //     staleTime: 1000 * 60 * 10, // Same as before
// // // //     refetchOnWindowFocus: false,
// // // //   });

// // // //   const { 
// // // //     data: subCategories, 
// // // //     isLoading: isLoadingSubCategories, 
// // // //     error: subCategoriesError 
// // // //   } = useQuery<SubCategoryDto[], APIError>({
// // // //       queryKey: ['subCategoriesByCity', citySlug, apiConceptFilter],
// // // //       queryFn: () => {
// // // //         if (!citySlug || !apiConceptFilter) return Promise.resolve([]); 
// // // //         return fetchSubCategoriesByCity(citySlug, apiConceptFilter as HighLevelConceptQueryParam);
// // // //       },
// // // //       enabled: !!citySlug && !!apiConceptFilter,
// // // //       staleTime: 1000 * 60 * 5, // Same as before
// // // //       refetchOnWindowFocus: false,
// // // //     });
  
// // // //   const isLoadingPage = isLoadingCity || isLoadingSubCategories || isLoadingContextLocation;

// // // //   if (!currentFeatureConcept) {
// // // //     return (
// // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // //         <Alert variant="destructive">
// // // //           <AlertTitle>Invalid Service Category</AlertTitle>
// // // //           <AlertDescription>The selected service category type is not recognized.</AlertDescription>
// // // //         </Alert>
// // // //         <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
// // // //           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
// // // //         </Button>
// // // //       </div>
// // // //     );
// // // //   }
  
// // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // // //   const conceptDisplayName = currentFeatureConcept.nameEn;

// // // //   // This function constructs links for each SubCategoryCard
// // // //   const constructSubCategoryLink = (subCategorySlugParam: string): string => {
// // // //     const query = new URLSearchParams();
    
// // // //     // Carry forward existing query params (name, location) from this page's URL
// // // //     if (initialSearchTerm) query.set("name", initialSearchTerm);
// // // //     if (initialUserLat) query.set("userLatitude", initialUserLat);
// // // //     if (initialUserLon) query.set("userLongitude", initialUserLon);
// // // //     if (initialRadius) query.set("radiusInMeters", initialRadius);
// // // //     // sortBy might not be relevant here, but if it is, forward it.
// // // //     // If location is present, shops page will default to distance_asc if no sortBy.
// // // //     if (initialSortBy) query.set("sortBy", initialSortBy); 
// // // //     else if (initialUserLat && initialUserLon) query.set("sortBy", "distance_asc");


// // // //     let link = `/cities/${citySlug}/categories/${subCategorySlugParam}/shops`;
// // // //     const queryString = query.toString();
// // // //     if (queryString) {
// // // //       link += `?${queryString}`;
// // // //     }
// // // //     return link;
// // // //   };

// // // //   return (
// // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // //       <HeroBillboard
// // // //         title={conceptDisplayName}
// // // //         highlightText={`in ${cityDisplayName}`}
// // // //         subtitle={`Browse all ${conceptDisplayName.toLowerCase()} categories available in ${cityDisplayName}.`}
// // // //         showSearch={false} // No search bar needed in this HeroBillboard typically
// // // //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// // // //       />

// // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           {/* MODIFIED: City link now goes to homepage with city query param */}
// // // //           <li>
// // // //             <Link 
// // // //               href={`/?city=${citySlug}`} 
// // // //               className="hover:text-orange-600 hover:underline"
// // // //               aria-label={`Back to ${cityDisplayName} overview on homepage`}
// // // //             >
// // // //               {cityDisplayName}
// // // //             </Link>
// // // //           </li>
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           <li className="font-medium text-slate-700" aria-current="page">{conceptDisplayName}</li>
// // // //         </ol>
// // // //       </nav>

// // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // //         <div className="text-center mb-8">
// // // //             <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">
// // // //                 All {conceptDisplayName} Services
// // // //             </h1>
// // // //             {initialSearchTerm && (
// // // //                 <p className="text-slate-600 mt-1">
// // // //                     (Filtered by initial search: "{initialSearchTerm}")
// // // //                 </p>
// // // //             )}
// // // //         </div>

// // // //         {isLoadingPage && !subCategories ? ( 
// // // //           <div className="text-center py-10">
// // // //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// // // //             <p className="mt-3 text-slate-600">Loading {conceptDisplayName.toLowerCase()} categories for {cityDisplayName}...</p>
// // // //           </div>
// // // //         ) : subCategoriesError ? (
// // // //           <Alert variant="destructive" className="my-6 max-w-xl mx-auto">
// // // //             <Info className="h-5 w-5" />
// // // //             <AlertTitle className="font-semibold">Could Not Load Categories</AlertTitle>
// // // //             <AlertDescription>
// // // //               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
// // // //             </AlertDescription>
// // // //           </Alert>
// // // //         ) : subCategories && subCategories.length > 0 ? (
// // // //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
// // // //             {subCategories.map((subCat) => (
// // // //               <SubCategoryCard 
// // // //                 key={subCat.slug} 
// // // //                 subCategory={subCat} 
// // // //                 citySlug={citySlug} 
// // // //                 href={constructSubCategoryLink(subCat.slug)} 
// // // //               />
// // // //             ))}
// // // //           </div>
// // // //         ) : (
// // // //           <div className="text-center py-12 px-4">
// // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Categories Found</h3>
// // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // //               There are currently no specific "{conceptDisplayName.toLowerCase()}" categories listed for {cityDisplayName}.
// // // //             </p>
// // // //             <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // //                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
// // // //             </Button>
// // // //           </div>
// // // //         )}
// // // //       </section>
// // // //     </div>
// // // //   );
// // // // }

// // // // export default function ConceptPage() {
// // // //   const params = useParams();
// // // //   const searchParamsHook = useSearchParams();

// // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // //   const conceptIdentifier = Array.isArray(params.conceptIdentifier) ? params.conceptIdentifier[0] : params.conceptIdentifier || "";
  
// // // //   const searchTermFromUrl = searchParamsHook.get('name');
// // // //   const userLatFromUrl = searchParamsHook.get('userLatitude');
// // // //   const userLonFromUrl = searchParamsHook.get('userLongitude');
// // // //   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
// // // //   const sortByParam = searchParamsHook.get('sortBy');
// // // //   const sortByFromUrl = sortByParam === null ? undefined : sortByParam;

// // // //   if (!citySlug || !conceptIdentifier) {
// // // //     return <LoadingFallback message="Loading page details..." />;
// // // //   }

// // // //   return (
// // // //     <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories in ${citySlug.replace(/-/g,' ')}...`} />}>
// // // //       <ConceptPageClient 
// // // //         citySlug={citySlug} 
// // // //         conceptIdentifier={conceptIdentifier}
// // // //         initialSearchTerm={searchTermFromUrl} 
// // // //         initialUserLat={userLatFromUrl}
// // // //         initialUserLon={userLonFromUrl}
// // // //         initialRadius={radiusFromUrl}
// // // //         initialSortBy={sortByFromUrl}
// // // //       />
// // // //     </Suspense>
// // // //   );
// // // // }

// // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // //   return (
// // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // //     </div>
// // // //   );
// // // // }
// // // // // // src/app/cities/[citySlug]/[conceptIdentifier]/page.tsx
// // // // // 'use client';

// // // // // import React, { Suspense, useEffect, useMemo } from 'react';
// // // // // import { useParams, useRouter, useSearchParams } from 'next/navigation';
// // // // // import { useQuery } from '@tanstack/react-query';
// // // // // import { fetchSubCategoriesByCity, fetchCities } from '@/lib/apiClient';
// // // // // import { SubCategoryDto, APIError, CityDto, HighLevelConceptQueryParam } from '@/types/api';
// // // // // import { featureConcepts } from '@/config/categories'; 
// // // // // import SubCategoryCard from '@/components/subcategory/SubCategoryCard'; 
// // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// // // // // import Link from 'next/link';
// // // // // import { Button } from '@/components/ui/button';
// // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext'; // Import

// // // // // interface ConceptPageClientProps {
// // // // //   citySlug: string;
// // // // //   conceptIdentifier: string; 
// // // // //   initialUserLat?: string | null;
// // // // //   initialUserLon?: string | null;
// // // // //   initialRadius?: string | null;
// // // // //   initialSortBy?: string | null;
// // // // //   initialSearchTerm?: string | null;
// // // // // }

// // // // // function ConceptPageClient({ 
// // // // //   citySlug, 
// // // // //   conceptIdentifier, 
// // // // //   initialUserLat,
// // // // //   initialUserLon,
// // // // //   initialRadius,
// // // // //   initialSortBy,
// // // // //   initialSearchTerm 
// // // // // }: ConceptPageClientProps) {
// // // // //   const router = useRouter();
// // // // //   const { 
// // // // //     currentUserLocation: contextLocation,
// // // // //     setCurrentUserLocation: setContextLocation, // To update context if URL has authoritative location
// // // // //     isLoading: isLoadingContextLocation 
// // // // //   } = useSimpleLocation();

// // // // //   // Effect to update context if this page is loaded with location params in URL
// // // // //   useEffect(() => {
// // // // //     if (initialUserLat && initialUserLon) {
// // // // //       const lat = parseFloat(initialUserLat);
// // // // //       const lon = parseFloat(initialUserLon);
// // // // //       const radius = initialRadius ? parseInt(initialRadius) : (contextLocation?.radiusInMeters || 500000);
// // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius });
// // // // //          }
// // // // //       }
// // // // //     }
// // // // //   }, [initialUserLat, initialUserLon, initialRadius, contextLocation, setContextLocation]);

// // // // //   const currentFeatureConcept = useMemo(() => 
// // // // //     featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier),
// // // // //     [conceptIdentifier]
// // // // //   );
// // // // //   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter;

// // // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // // //     queryKey: ['cityDetails', citySlug],
// // // // //     queryFn: async () => {
// // // // //       if (!citySlug) return undefined;
// // // // //       const cities = await fetchCities();
// // // // //       return cities.find(c => c.slug === citySlug);
// // // // //     },
// // // // //     enabled: !!citySlug,
// // // // //     staleTime: 1000 * 60 * 10,
// // // // //   });

// // // // //   const { 
// // // // //     data: subCategories, 
// // // // //     isLoading: isLoadingSubCategories, 
// // // // //     error: subCategoriesError 
// // // // //   } = useQuery<SubCategoryDto[], APIError>({
// // // // //       queryKey: ['subCategoriesByCity', citySlug, apiConceptFilter],
// // // // //       queryFn: () => {
// // // // //         if (!citySlug || !apiConceptFilter) return Promise.resolve([]); 
// // // // //         return fetchSubCategoriesByCity(citySlug, apiConceptFilter as HighLevelConceptQueryParam);
// // // // //       },
// // // // //       enabled: !!citySlug && !!apiConceptFilter,
// // // // //       staleTime: 1000 * 60 * 5,
// // // // //     });
  
// // // // //   // Combine loading states. If context is loading location, we might want to wait before rendering links.
// // // // //   const isLoadingPage = isLoadingCity || isLoadingSubCategories || isLoadingContextLocation;

// // // // //   if (!currentFeatureConcept) {
// // // // //     return (
// // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // //         <Alert variant="destructive">
// // // // //           <AlertTitle>Invalid Service Category</AlertTitle>
// // // // //           <AlertDescription>The selected service category type is not recognized.</AlertDescription>
// // // // //         </Alert>
// // // // //         <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
// // // // //           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
// // // // //         </Button>
// // // // //       </div>
// // // // //     );
// // // // //   }
  
// // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // // // //   const conceptDisplayName = currentFeatureConcept.nameEn;

// // // // //   const constructSubCategoryLink = (subCategorySlugParam: string): string => {
// // // // //     const query = new URLSearchParams();
    
// // // // //     // Prioritize URL params for forwarding, then context
// // // // //     const effectiveSearchTerm = initialSearchTerm; // From this page's URL
// // // // //     const latToForward = initialUserLat || contextLocation?.latitude?.toString();
// // // // //     const lonToForward = initialUserLon || contextLocation?.longitude?.toString();
// // // // //     const radiusToForward = initialRadius || contextLocation?.radiusInMeters?.toString();
// // // // //     let sortByToForward = initialSortBy;

// // // // //     if (latToForward && lonToForward && !sortByToForward) { // If location is present and no specific sort from URL
// // // // //         sortByToForward = "distance_asc"; // Default to distance if location is being passed
// // // // //     }

// // // // //     if (effectiveSearchTerm) query.set("name", effectiveSearchTerm);
// // // // //     if (latToForward) query.set("userLatitude", latToForward);
// // // // //     if (lonToForward) query.set("userLongitude", lonToForward);
// // // // //     if (radiusToForward) query.set("radiusInMeters", radiusToForward);
// // // // //     if (sortByToForward) query.set("sortBy", sortByToForward);

// // // // //     let link = `/cities/${citySlug}/categories/${subCategorySlugParam}/shops`;
// // // // //     const queryString = query.toString();
// // // // //     if (queryString) {
// // // // //       link += `?${queryString}`;
// // // // //     }
// // // // //     return link;
// // // // //   };

// // // // //   return (
// // // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // // //       <HeroBillboard
// // // // //         title={conceptDisplayName}
// // // // //         highlightText={`in ${cityDisplayName}`}
// // // // //         subtitle={`Please choose a specific service category for ${conceptDisplayName.toLowerCase()} in ${cityDisplayName}.`}
// // // // //         showSearch={false} 
// // // // //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// // // // //       />

// // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li className="font-medium text-slate-700" aria-current="page">{conceptDisplayName}</li>
// // // // //         </ol>
// // // // //       </nav>

// // // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // // //         <div className="text-center mb-8">
// // // // //             <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
// // // // //                 Select a Service Category
// // // // //             </h2>
// // // // //             {initialSearchTerm && (
// // // // //                 <p className="text-slate-600 mt-1">
// // // // //                     Searching for "{initialSearchTerm}" within the chosen category.
// // // // //                 </p>
// // // // //             )}
// // // // //         </div>

// // // // //         {isLoadingPage && !subCategories ? ( 
// // // // //           <div className="text-center py-10">
// // // // //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// // // // //             <p className="mt-3 text-slate-600">Loading service categories for {cityDisplayName}...</p>
// // // // //           </div>
// // // // //         ) : subCategoriesError ? (
// // // // //           <Alert variant="destructive" className="my-6 max-w-xl mx-auto">
// // // // //             <Info className="h-5 w-5" />
// // // // //             <AlertTitle className="font-semibold">Could Not Load Service Categories</AlertTitle>
// // // // //             <AlertDescription>
// // // // //               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
// // // // //             </AlertDescription>
// // // // //           </Alert>
// // // // //         ) : subCategories && subCategories.length > 0 ? (
// // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
// // // // //             {subCategories.map((subCat) => (
// // // // //               <SubCategoryCard 
// // // // //                 key={subCat.slug} 
// // // // //                 subCategory={subCat} 
// // // // //                 citySlug={citySlug} 
// // // // //                 href={constructSubCategoryLink(subCat.slug)} 
// // // // //               />
// // // // //             ))}
// // // // //           </div>
// // // // //         ) : (
// // // // //           <div className="text-center py-12 px-4">
// // // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Service Categories Found</h3>
// // // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // // //               There are currently no specific "{conceptDisplayName.toLowerCase()}" categories listed for {cityDisplayName}.
// // // // //             </p>
// // // // //             <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // //                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
// // // // //             </Button>
// // // // //           </div>
// // // // //         )}
// // // // //       </section>
// // // // //     </div>
// // // // //   );
// // // // // }


// // // // // export default function ConceptPage() {
// // // // //   const params = useParams();
// // // // //   const searchParamsHook = useSearchParams();

// // // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // // //   const conceptIdentifier = Array.isArray(params.conceptIdentifier) ? params.conceptIdentifier[0] : params.conceptIdentifier || "";
  
// // // // //   const searchTermFromUrl = searchParamsHook.get('name');
// // // // //   const userLatFromUrl = searchParamsHook.get('userLatitude');
// // // // //   const userLonFromUrl = searchParamsHook.get('userLongitude');
// // // // //   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
// // // // //   const sortByParam = searchParamsHook.get('sortBy');
// // // // //   const sortByFromUrl = sortByParam === null ? undefined : sortByParam;


// // // // //   if (!citySlug || !conceptIdentifier) {
// // // // //     return <LoadingFallback message="Loading page details..." />;
// // // // //   }

// // // // //   return (
// // // // //     <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories in ${citySlug.replace(/-/g,' ')}...`} />}>
// // // // //       <ConceptPageClient 
// // // // //         citySlug={citySlug} 
// // // // //         conceptIdentifier={conceptIdentifier}
// // // // //         initialSearchTerm={searchTermFromUrl} 
// // // // //         initialUserLat={userLatFromUrl}
// // // // //         initialUserLon={userLonFromUrl}
// // // // //         initialRadius={radiusFromUrl}
// // // // //         initialSortBy={sortByFromUrl}
// // // // //       />
// // // // //     </Suspense>
// // // // //   );
// // // // // }

// // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // //   return (
// // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // //     </div>
// // // // //   );
// // // // // }
// // // // // // // src/app/cities/[citySlug]/[conceptIdentifier]/page.tsx
// // // // // // 'use client';

// // // // // // import React, { Suspense } from 'react';
// // // // // // import { useParams, useRouter, useSearchParams } from 'next/navigation';
// // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // import { fetchSubCategoriesByCity, fetchCities } from '@/lib/apiClient';
// // // // // // import { SubCategoryDto, APIError, CityDto, HighLevelConceptQueryParam } from '@/types/api';
// // // // // // import { featureConcepts } from '@/config/categories'; // To map conceptPageSlug back to API filter
// // // // // // import SubCategoryCard from '@/components/subcategory/SubCategoryCard'; // We created this earlier
// // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // // import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
// // // // // // import Link from 'next/link';
// // // // // // import { Button } from '@/components/ui/button';

// // // // // // interface ConceptPageClientProps {
// // // // // //   citySlug: string;
// // // // // //   conceptIdentifier: string; // This is "maintenance-services" or "auto-parts" from URL
// // // // // //   initialUserLat?: string | null;
// // // // // //   initialUserLon?: string | null;
// // // // // //   initialRadius?: string | null;
// // // // // //   initialSortBy?: string | null;
// // // // // //   initialSearchTerm?: string | null; // From query params, if any
// // // // // // }

// // // // // // // function ConceptPageClient({ citySlug, conceptIdentifier, initialSearchTerm }: ConceptPageClientProps) {
// // // // // // function ConceptPageClient({ 
// // // // // //   citySlug, 
// // // // // //   conceptIdentifier, 
// // // // // //   initialUserLat,
// // // // // //   initialUserLon,
// // // // // //   initialRadius,
// // // // // //   initialSortBy,
// // // // // //   initialSearchTerm 
// // // // // // }: ConceptPageClientProps) {
// // // // // //   const router = useRouter();

// // // // // //   // Find the corresponding FeatureConceptConfig to get the apiConceptFilter
// // // // // //   const currentFeatureConcept = featureConcepts.find(fc => fc.conceptPageSlug === conceptIdentifier);
// // // // // //   const apiConceptFilter = currentFeatureConcept?.apiConceptFilter; // "Maintenance" or "Marketplace"

// // // // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // // // //     queryKey: ['cityDetails', citySlug],
// // // // // //     queryFn: async () => {
// // // // // //       if (!citySlug) return undefined;
// // // // // //       const cities = await fetchCities();
// // // // // //       return cities.find(c => c.slug === citySlug);
// // // // // //     },
// // // // // //     enabled: !!citySlug,
// // // // // //     staleTime: 1000 * 60 * 10,
// // // // // //   });

// // // // // //   const { 
// // // // // //     data: subCategories, 
// // // // // //     isLoading: isLoadingSubCategories, 
// // // // // //     error: subCategoriesError 
// // // // // //   } = useQuery<SubCategoryDto[], APIError>({
// // // // // //       queryKey: ['subCategoriesByCity', citySlug, apiConceptFilter],
// // // // // //       queryFn: () => {
// // // // // //         if (!citySlug || !apiConceptFilter) {
// // // // // //           // This should ideally not happen if currentFeatureConcept is found
// // // // // //           // but as a guard:
// // // // // //           return Promise.resolve([]); 
// // // // // //         }
// // // // // //         return fetchSubCategoriesByCity(citySlug, apiConceptFilter);
// // // // // //       },
// // // // // //       enabled: !!citySlug && !!apiConceptFilter, // Only run if we have these
// // // // // //       staleTime: 1000 * 60 * 5,
// // // // // //     });

// // // // // //   if (!currentFeatureConcept) {
// // // // // //     // Should ideally redirect or show a more specific "Concept not found" page
// // // // // //     return (
// // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // //         <Alert variant="destructive">
// // // // // //           <AlertTitle>Invalid Service Category</AlertTitle>
// // // // // //           <AlertDescription>The selected service category type is not recognized.</AlertDescription>
// // // // // //         </Alert>
// // // // // //         <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
// // // // // //           <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
// // // // // //         </Button>
// // // // // //       </div>
// // // // // //     );
// // // // // //   }
  
// // // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // // // // //   const conceptDisplayName = currentFeatureConcept.nameEn;

// // // // // //   // If there was an initialSearchTerm, append it to the subcategory links
// // // // // //   // const constructSubCategoryLink = (subCategorySlug: string) => {
// // // // // //   //   let link = `/cities/${citySlug}/categories/${subCategorySlug}/shops`;
// // // // // //   //   if (initialSearchTerm) {
// // // // // //   //     link += `?name=${encodeURIComponent(initialSearchTerm)}`;
// // // // // //   //   }
// // // // // //   //   return link;
// // // // // //   // };
// // // // // //   const constructSubCategoryLink = (subCategorySlug: string): string => {
// // // // // //     const query = new URLSearchParams();
// // // // // //     if (initialSearchTerm) query.set("name", initialSearchTerm);
// // // // // //     if (initialUserLat) query.set("userLatitude", initialUserLat);
// // // // // //     if (initialUserLon) query.set("userLongitude", initialUserLon);
// // // // // //     if (initialRadius) query.set("radiusInMeters", initialRadius);
// // // // // //     if (initialSortBy) query.set("sortBy", initialSortBy);

// // // // // //     let link = `/cities/${citySlug}/categories/${subCategorySlug}/shops`;
// // // // // //     const queryString = query.toString();
// // // // // //     if (queryString) {
// // // // // //       link += `?${queryString}`;
// // // // // //     }
// // // // // //     return link;
// // // // // //   };

// // // // // //   return (
// // // // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // // // //       <HeroBillboard
// // // // // //         title={conceptDisplayName}
// // // // // //         highlightText={`in ${cityDisplayName}`}
// // // // // //         subtitle={`Please choose a specific service category for ${conceptDisplayName.toLowerCase()} in ${cityDisplayName}.`}
// // // // // //         showSearch={false} // No main search bar on this page, focus is on subcategory selection
// // // // // //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// // // // // //       />

// // // // // //       {/* Breadcrumbs */}
// // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li className="font-medium text-slate-700" aria-current="page">{conceptDisplayName}</li>
// // // // // //         </ol>
// // // // // //       </nav>

// // // // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // // // //         <div className="text-center mb-8">
// // // // // //             <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
// // // // // //                 Select a Service Category
// // // // // //             </h2>
// // // // // //             {initialSearchTerm && (
// // // // // //                 <p className="text-slate-600 mt-1">
// // // // // //                     Searching for "{initialSearchTerm}" within the chosen category.
// // // // // //                 </p>
// // // // // //             )}
// // // // // //         </div>

// // // // // //         {isLoadingCity || isLoadingSubCategories ? (
// // // // // //           <div className="text-center py-10">
// // // // // //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// // // // // //             <p className="mt-3 text-slate-600">Loading service categories for {cityDisplayName}...</p>
// // // // // //           </div>
// // // // // //         ) : subCategoriesError ? (
// // // // // //           <Alert variant="destructive" className="my-6 max-w-xl mx-auto">
// // // // // //             <Info className="h-5 w-5" />
// // // // // //             <AlertTitle className="font-semibold">Could Not Load Service Categories</AlertTitle>
// // // // // //             <AlertDescription>
// // // // // //               {subCategoriesError instanceof APIError ? subCategoriesError.message : "An unexpected error occurred."}
// // // // // //             </AlertDescription>
// // // // // //           </Alert>
// // // // // //         ) : subCategories && subCategories.length > 0 ? (
// // // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
// // // // // //             {subCategories.map((subCat) => (
// // // // // //               <SubCategoryCard 
// // // // // //                 key={subCat.slug} 
// // // // // //                 subCategory={subCat} 
// // // // // //                 citySlug={citySlug}
// // // // // //                 href={constructSubCategoryLink(subCat.slug)}
// // // // // //                 // The link is now constructed inside SubCategoryCard, or pass custom link here
// // // // // //                 // For custom link with search term:
// // // // // //                 // customLink={constructSubCategoryLink(subCat.slug)} 
// // // // // //               />
// // // // // //             ))}
// // // // // //           </div>
// // // // // //         ) : (
// // // // // //           <div className="text-center py-12 px-4">
// // // // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Service Categories Found</h3>
// // // // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // // // //               There are currently no specific "{conceptDisplayName.toLowerCase()}" categories listed for {cityDisplayName}.
// // // // // //             </p>
// // // // // //             <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // //                 <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // //             </Button>
// // // // // //           </div>
// // // // // //         )}
// // // // // //       </section>
// // // // // //     </div>
// // // // // //   );
// // // // // // }


// // // // // // export default function ConceptPage() {
// // // // // //   const params = useParams();
// // // // // //   const searchParamsHook = useSearchParams(); // To get query parameters like searchTerm

// // // // // //   // Ensure params are strings and provide fallbacks or handle undefined
// // // // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // // // //   const conceptIdentifier = Array.isArray(params.conceptIdentifier) ? params.conceptIdentifier[0] : params.conceptIdentifier || "";
// // // // // //   // const searchTerm = searchParamsHook.get('name') || searchParamsHook.get('searchTerm'); 
// // // // // //   const searchTerm = searchParamsHook.get('name'); // Expect 'name' from CityOverview
// // // // // //   const userLat = searchParamsHook.get('userLatitude');
// // // // // //   const userLon = searchParamsHook.get('userLongitude');
// // // // // //   const radius = searchParamsHook.get('radiusInMeters');
// // // // // //   const sortBy = searchParamsHook.get('sortBy');


// // // // // //   if (!citySlug || !conceptIdentifier) {
// // // // // //     return <LoadingFallback message="Loading page details..." />;
// // // // // //   }

// // // // // //   return (
// // // // // //     <Suspense fallback={<LoadingFallback message={`Loading ${conceptIdentifier.replace(/-/g,' ')} categories in ${citySlug.replace(/-/g,' ')}...`} />}>
// // // // // //       <ConceptPageClient 
// // // // // //         citySlug={citySlug} 
// // // // // //         conceptIdentifier={conceptIdentifier}
// // // // // //         initialSearchTerm={searchTerm} 
// // // // // //         initialUserLat={userLat}
// // // // // //         initialUserLon={userLon}
// // // // // //         initialRadius={radius}
// // // // // //         initialSortBy={sortBy}
// // // // // //       />
// // // // // //     </Suspense>
// // // // // //   );
// // // // // // }

// // // // // // // Reusable LoadingFallback (can be moved to a shared component)
// // // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // // //   return (
// // // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // // //     </div>
// // // // // //   );
// // // // // // }