// // src/app/cities/[citySlug]/page.tsx
// 'use client';

// import React, { Suspense, useMemo, useEffect, useCallback } from 'react';
// import { useParams, useSearchParams, useRouter } from 'next/navigation';
// import { useQuery } from '@tanstack/react-query';
// import { fetchCities } from '@/lib/apiClient';
// import { CityDto, APIError, FrontendShopQueryParameters } from '@/types/api';
// import { featureConcepts, FeatureConceptConfig } from '@/config/categories';
// import FeatureConceptCard from '@/components/concept/FeatureConceptCard';
// import HeroBillboard from '@/components/common/HeroBillboard';
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Info, Loader2, ChevronLeft } from "lucide-react";
// import Link from 'next/link';
// import { Button } from '@/components/ui/button';
// import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext'; // UPDATED IMPORT

// const DEFAULT_SEARCH_RADIUS = 500000; // Define default if not imported

// interface CityOverviewClientProps {
//   citySlug: string;
//   initialUserLat?: string | null;
//   initialUserLon?: string | null;
//   initialRadius?: string | null;
//   initialSortBy?: string | null;
//   initialSearchTerm?: string | null;
// }

// function CityOverviewClient({
//   citySlug,
//   initialUserLat,
//   initialUserLon,
//   initialRadius,
//   initialSortBy,
//   initialSearchTerm
// }: CityOverviewClientProps) {

//   const router = useRouter();
//   const {
//     currentLocation: contextLocation,      // UPDATED
//     setCurrentLocation: setContextLocation,  // UPDATED
//     isLoading: isLoadingContextLocation,   // This is combined (GPS + initial pref load)
//     // error: contextGeoError, // Not used in this component directly, but available
//     // clearError: clearContextGeoError, // Not used
//     // attemptBrowserGpsLocation, // Not used
//   } = useUserGeoLocation();

//   const { data: cityDetailsFromQuery, isLoading: isLoadingCity, error: cityError } =
//     useQuery<CityDto | undefined, APIError>({
//       queryKey: ['cityDetails', citySlug],
//       queryFn: async () => {
//         if (!citySlug) return undefined;
//         // Consider adding a fetchCityBySlug if available for single fetch
//         const cities = await fetchCities();
//         return cities.find(c => c.slug === citySlug);
//       },
//       enabled: !!citySlug,
//       staleTime: 1000 * 60 * 60, // 1 hour, city details don't change often
//       refetchOnWindowFocus: false,
//     });

//   // Effect to sync initial URL params to UserGeoLocationContext
//   useEffect(() => {
//     if (initialUserLat && initialUserLon) {
//       const lat = parseFloat(initialUserLat);
//       const lon = parseFloat(initialUserLon);
//       const radius = initialRadius ? parseInt(initialRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS);
//       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
//          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
//            setContextLocation({ 
//                latitude: lat, 
//                longitude: lon, 
//                radiusInMeters: radius, 
//                timestamp: Date.now() 
//             }, 'url_param'); // UPDATED: Added source
//          }
//       }
//     }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [initialUserLat, initialUserLon, initialRadius, setContextLocation]); 
//   // contextLocation is intentionally omitted from deps to prevent loops if it's also set by URL params elsewhere

//   const cityDetails = cityDetailsFromQuery; // No need for useMemo if just passing through

//   const heroBillboardInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => {
//     // Prioritize initial prop values, then context values for the form
//     const lat = initialUserLat ? parseFloat(initialUserLat) : contextLocation?.latitude;
//     const lon = initialUserLon ? parseFloat(initialUserLon) : contextLocation?.longitude;
//     const radius = initialRadius ? parseInt(initialRadius, 10) : contextLocation?.radiusInMeters ?? DEFAULT_SEARCH_RADIUS;
//     let sort = initialSortBy ?? (contextLocation?.latitude && contextLocation?.longitude ? 'distance_asc' : undefined);

//     return {
//         name: initialSearchTerm || undefined,
//         services: undefined, // This form doesn't have service filter input
//         userLatitude: lat,
//         userLongitude: lon,
//         radiusInMeters: radius,
//         sortBy: sort,
//     };
//   }, [initialSearchTerm, initialUserLat, initialUserLon, initialRadius, initialSortBy, contextLocation]);

//   const handleConceptClickForCity = useCallback((concept: FeatureConceptConfig) => {
//     const query = new URLSearchParams();
    
//     // Carry forward relevant search params from this page's initial state or current context
//     const effectiveSearchTerm = initialSearchTerm || heroBillboardInitialValues.name;
//     const latToForward = heroBillboardInitialValues.userLatitude?.toString();
//     const lonToForward = heroBillboardInitialValues.userLongitude?.toString();
//     const radiusToForward = heroBillboardInitialValues.radiusInMeters?.toString();
//     let sortByToForward = heroBillboardInitialValues.sortBy;

//     if (latToForward && lonToForward && !sortByToForward) {
//         sortByToForward = "distance_asc";
//     }

//     if (effectiveSearchTerm) query.set("name", effectiveSearchTerm); // Use "name" for consistency
//     if (latToForward) query.set("userLatitude", latToForward);
//     if (lonToForward) query.set("userLongitude", lonToForward);
//     if (radiusToForward) query.set("radiusInMeters", radiusToForward);
//     if (sortByToForward) query.set("sortBy", sortByToForward);
    
//     const path = `/cities/${citySlug}/${concept.conceptPageSlug}?${query.toString()}`;
//     router.push(path);
//   }, [router, citySlug, initialSearchTerm, heroBillboardInitialValues]);
  
//   const handleHeroSearchSubmitOnCityPage = useCallback((submittedCriteria: Partial<FrontendShopQueryParameters>) => {
//     const query = new URLSearchParams();

//     if (submittedCriteria.name) query.set("name", submittedCriteria.name); // Changed from searchTerm to name
    
//     // Update context if new location info is submitted via form's detect location
//     if (submittedCriteria.userLatitude && submittedCriteria.userLongitude) {
//         const newLocationFromForm: UserGeoLocation = {
//             latitude: submittedCriteria.userLatitude,
//             longitude: submittedCriteria.userLongitude,
//             radiusInMeters: submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
//             source: 'gps', // Assuming detect location in form uses GPS
//             timestamp: Date.now()
//         };
//         setContextLocation(newLocationFromForm, 'gps');
        
//         query.set("userLatitude", newLocationFromForm.latitude.toString());
//         query.set("userLongitude", newLocationFromForm.longitude.toString());
//         query.set("radiusInMeters", newLocationFromForm.radiusInMeters.toString());
//         query.set("sortBy", submittedCriteria.sortBy || "distance_asc");
//     } else if (contextLocation) { // No new location from form, but context has one, preserve it
//         query.set("userLatitude", contextLocation.latitude.toString());
//         query.set("userLongitude", contextLocation.longitude.toString());
//         query.set("radiusInMeters", contextLocation.radiusInMeters.toString());
//         if (submittedCriteria.sortBy) query.set("sortBy", submittedCriteria.sortBy);
//         else if (contextLocation.latitude && contextLocation.longitude) query.set("sortBy", "distance_asc");
//     } else if (submittedCriteria.sortBy) {
//         query.set("sortBy", submittedCriteria.sortBy);
//     }
    
//     // Navigate to this same page but with updated query params for the search term
//     router.push(`/cities/${citySlug}?${query.toString()}`, { scroll: false });
//   }, [router, citySlug, contextLocation, setContextLocation]);

//   const isLoadingPage = isLoadingCity || (isLoadingContextLocation && !contextLocation); // Show loading if context is loading *and* has no location yet

//   if (isLoadingPage && !cityDetails) {
//     return <LoadingFallback message={`Loading details for ${citySlug.replace(/-/g, ' ')}...`} />;
//   }

//   if (cityError) {
//     return (
//       <div className="container mx-auto px-4 py-10 text-center">
//         <Alert variant="destructive" className="max-w-xl mx-auto">
//           <Info className="h-5 w-5" />
//           <AlertTitle>Error Loading City</AlertTitle>
//           <AlertDescription>
//             {cityError instanceof APIError ? cityError.message : "Could not load city details."}
//           </AlertDescription>
//         </Alert>
//         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
//              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
//         </Button>
//       </div>
//     );
//   }

//   if (!cityDetails) {
//     // This might also be shown if citySlug is invalid but page still loads
//     return (
//       <div className="container mx-auto px-4 py-10 text-center">
//         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
//           <Info className="h-5 w-5 text-yellow-600" />
//           <AlertTitle className="text-yellow-800">City Not Found</AlertTitle>
//           <AlertDescription className="text-yellow-700">
//             The city "{citySlug.replace(/-/g, ' ')}" could not be found or is not active.
//           </AlertDescription>
//         </Alert>
//          <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
//             <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
//         </Button>
//       </div>
//     );
//   }

//   const cityDisplayName = cityDetails.nameEn;

//   return (
//     <div className="flex flex-col bg-slate-50"> {/* Removed min-h-screen, layout provides it */}
//       <HeroBillboard
//         title="Services & Parts"
//         highlightText={`in ${cityDisplayName}`}
//         subtitle={`Explore vehicle maintenance and auto parts options available in ${cityDisplayName}.`}
//         showSearch={true}
//         searchProps={{
//             onSubmit: handleHeroSearchSubmitOnCityPage,
//             initialValues: heroBillboardInitialValues,
//             isLoading: isLoadingContextLocation, // Loading state for the form's detect location button
//             formInstanceId: "city-overview",
//             showDetectLocationButton: true
//         }}
//         minHeight="min-h-[30vh] md:min-h-[35vh]" // Slightly adjusted height
//       />

//       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
//         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
//           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
//           <li><span className="text-slate-400">»</span></li>
//           {/* MODIFIED: City link in breadcrumb now goes to homepage with city query param */}
//           <li className="font-medium text-slate-700" aria-current="page">
//             <Link 
//               href={`/?city=${citySlug}`} 
//               className="hover:text-orange-600 hover:underline"
//               aria-label={`Back to ${cityDisplayName} overview on homepage`}
//             >
//                 {cityDisplayName}
//             </Link>
//           </li>
//         </ol>
//       </nav>

//       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
//         <div className="text-center mb-8 md:mb-10">
//             <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
//                 Choose a Service Type in {cityDisplayName}
//             </h2>
//             {(initialSearchTerm || heroBillboardInitialValues.name) && ( // Show search term if present
//                 <p className="text-slate-600 mt-1">
//                     (Searching for "{initialSearchTerm || heroBillboardInitialValues.name}")
//                 </p>
//             )}
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
//           {featureConcepts.map((concept) => (
//             <FeatureConceptCard
//               key={concept.id}
//               concept={concept}
//               onClick={() => handleConceptClickForCity(concept)}
//               isLoading={isLoadingContextLocation && !contextLocation} // Show loading on cards if context is still initializing
//             />
//           ))}
//         </div>
//       </section>
//     </div>
//   );
// }

// export default function CityOverviewPage() {
//   const params = useParams();
//   const searchParamsHook = useSearchParams();

//   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
  
//   // Ensure query param names are consistent: 'name', 'userLatitude', etc.
//   const searchTermFromUrl = searchParamsHook.get('name'); // Prefer 'name' over 'searchTerm'
//   const userLatFromUrl = searchParamsHook.get('userLatitude');
//   const userLonFromUrl = searchParamsHook.get('userLongitude');
//   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
//   const sortByFromUrl = searchParamsHook.get('sortBy'); // No need to check for null here

//   if (!citySlug) {
//     // This case should ideally be caught by Next.js routing if citySlug is mandatory
//     // For robustness, can return a fallback or redirect.
//     return <LoadingFallback message="City information is missing..." />;
//   }

//   return (
//     <Suspense fallback={<LoadingFallback message={`Loading services in ${citySlug.replace(/-/g, ' ')}...`} />}>
//       <CityOverviewClient
//         citySlug={citySlug}
//         initialSearchTerm={searchTermFromUrl}
//         initialUserLat={userLatFromUrl}
//         initialUserLon={userLonFromUrl}
//         initialRadius={radiusFromUrl}
//         initialSortBy={sortByFromUrl}
//       />
//     </Suspense>
//   );
// }

// function LoadingFallback({ message = "Loading..." }: { message?: string }) {
//   return (
//     <div className="flex flex-col min-h-[calc(100vh-150px)] justify-center items-center bg-slate-50"> {/* Adjusted height */}
//       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
//       <p className="text-slate-600 text-lg">{message}</p>
//     </div>
//   );
// }
// // // src/app/cities/[citySlug]/page.tsx
// // 'use client';

// // import React, { Suspense, useMemo, useEffect, useCallback } from 'react'; // Added useCallback
// // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // import { useQuery } from '@tanstack/react-query';
// // import { fetchCities } from '@/lib/apiClient'; 
// // import { CityDto, APIError, FrontendShopQueryParameters } from '@/types/api';
// // import { featureConcepts, FeatureConceptConfig } from '@/config/categories'; 
// // import FeatureConceptCard from '@/components/concept/FeatureConceptCard'; 
// // import HeroBillboard from '@/components/common/HeroBillboard'; 
// // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // import { Info, Loader2, ChevronLeft } from "lucide-react";
// // import Link from 'next/link';
// // import { Button } from '@/components/ui/button';
// // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/UserGeoLocationContext';

// // interface CityOverviewClientProps {
// //   citySlug: string;
// //   initialUserLat?: string | null;
// //   initialUserLon?: string | null;
// //   initialRadius?: string | null;
// //   initialSortBy?: string | null;
// //   initialSearchTerm?: string | null;
// // }

// // function CityOverviewClient({ 
// //   citySlug, 
// //   initialUserLat, 
// //   initialUserLon, 
// //   initialRadius,
// //   initialSortBy,
// //   initialSearchTerm 
// // }: CityOverviewClientProps) {
  
// //   // --- ALL HOOKS AT THE TOP ---
// //   const router = useRouter();
// //   const { 
// //     currentUserLocation: contextLocation, 
// //     setCurrentUserLocation: setContextLocation,
// //     isLoading: isLoadingContextLocation,
// //   } = useSimpleLocation();

// //   const { data: cityDetailsFromQuery, isLoading: isLoadingCity, error: cityError } = 
// //     useQuery<CityDto | undefined, APIError>({
// //       queryKey: ['cityDetails', citySlug],
// //       queryFn: async () => {
// //         if (!citySlug) return undefined;
// //         const cities = await fetchCities(); 
// //         return cities.find(c => c.slug === citySlug);
// //       },
// //       enabled: !!citySlug,
// //       staleTime: 1000 * 60 * 10, 
// //       refetchOnWindowFocus: false,
// //     });

// //   useEffect(() => {
// //     if (initialUserLat && initialUserLon) {
// //       const lat = parseFloat(initialUserLat);
// //       const lon = parseFloat(initialUserLon);
// //       const radius = initialRadius ? parseInt(initialRadius) : (contextLocation?.radiusInMeters || 500000);
// //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius });
// //          }
// //       }
// //     }
// //   }, [initialUserLat, initialUserLon, initialRadius, contextLocation, setContextLocation]);

// //   const cityDetails = useMemo(() => cityDetailsFromQuery, [cityDetailsFromQuery]);

// //   const heroBillboardInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => {
// //     const lat = initialUserLat ? parseFloat(initialUserLat) : contextLocation?.latitude;
// //     const lon = initialUserLon ? parseFloat(initialUserLon) : contextLocation?.longitude;
// //     const radius = initialRadius ? parseInt(initialRadius) : contextLocation?.radiusInMeters;
// //     let sort: string | undefined = initialSortBy === null ? undefined : initialSortBy;

// //     if (lat && lon && !sort) {
// //         sort = 'distance_asc';
// //     }
    
// //     return { 
// //         name: initialSearchTerm || undefined, 
// //         services: undefined, 
// //         userLatitude: lat,
// //         userLongitude: lon,
// //         radiusInMeters: radius,
// //         sortBy: sort, 
// //     };
// //   }, [initialSearchTerm, initialUserLat, initialUserLon, initialRadius, initialSortBy, contextLocation]);

// //   const handleConceptClickForCity = useCallback((concept: FeatureConceptConfig) => {
// //     const query = new URLSearchParams();
    
// //     const effectiveSearchTerm = initialSearchTerm;
// //     const latToForward = initialUserLat || contextLocation?.latitude?.toString();
// //     const lonToForward = initialUserLon || contextLocation?.longitude?.toString();
// //     const radiusToForward = initialRadius || contextLocation?.radiusInMeters?.toString();
// //     let sortByToForward = initialSortBy;

// //     if (latToForward && lonToForward && !sortByToForward) {
// //         sortByToForward = "distance_asc"; 
// //     }

// //     if (effectiveSearchTerm) query.set("name", effectiveSearchTerm); 
// //     if (latToForward) query.set("userLatitude", latToForward);
// //     if (lonToForward) query.set("userLongitude", lonToForward);
// //     if (radiusToForward) query.set("radiusInMeters", radiusToForward);
// //     if (sortByToForward) query.set("sortBy", sortByToForward);
    
// //     let pathSegmentForConcept = concept.conceptPageSlug;
// //     // console.log("CityOverviewClient: Clicked concept.id:", concept.id, "concept.conceptPageSlug:", pathSegmentForConcept);

// //     let path = `/cities/${citySlug}/${pathSegmentForConcept}`; 
// //     const queryString = query.toString();
// //     if (queryString) {
// //       path += `?${queryString}`;
// //     }
    
// //     // console.log("CityOverviewClient: Navigating from concept click.");
// //     // console.log("   Props: initialUserLat:", initialUserLat, "initialUserLon:", initialUserLon, "initialRadius:", initialRadius, "initialSortBy:", initialSortBy, "initialSearchTerm:", initialSearchTerm);
// //     // console.log("   Context: contextLocation:", JSON.stringify(contextLocation)); 
// //     // console.log("   Forwarding: latToForward:", latToForward, "lonToForward:", lonToForward, "radiusToForward:", radiusToForward, "sortByToForward:", sortByToForward);
// //     // console.log("   Final path for navigation:", path);
    
// //     router.push(path);
// //   }, [router, citySlug, initialSearchTerm, initialUserLat, initialUserLon, initialRadius, initialSortBy, contextLocation]);
  
// //   const handleHeroSearchSubmitOnCityPage = useCallback((submittedCriteria: Partial<FrontendShopQueryParameters>) => {
// //     const query = new URLSearchParams();

// //     if (submittedCriteria.name) query.set("searchTerm", submittedCriteria.name);
    
// //     const lat = submittedCriteria.userLatitude ?? (initialUserLat ? parseFloat(initialUserLat) : contextLocation?.latitude);
// //     const lon = submittedCriteria.userLongitude ?? (initialUserLon ? parseFloat(initialUserLon) : contextLocation?.longitude);
// //     const radius = submittedCriteria.radiusInMeters ?? (initialRadius ? parseInt(initialRadius) : contextLocation?.radiusInMeters);
// //     let sort = submittedCriteria.sortBy ?? initialSortBy;

// //     if (lat && lon) {
// //         query.set("userLatitude", lat.toString());
// //         query.set("userLongitude", lon.toString());
// //         if (radius) query.set("radiusInMeters", radius.toString());
// //         query.set("sortBy", sort || "distance_asc");
// //     } else if (sort) { 
// //         query.set("sortBy", sort);
// //     }
// //     router.push(`/cities/${citySlug}?${query.toString()}`, { scroll: false }); 
// //   }, [router, citySlug, initialUserLat, initialUserLon, initialRadius, initialSortBy, contextLocation]);

// //   // --- CONDITIONAL RENDERING AFTER ALL HOOKS ---
// //   const isLoadingPage = isLoadingCity || isLoadingContextLocation; 

// //   if (isLoadingPage && !cityDetails) { 
// //     return <LoadingFallback message={`Loading details for ${citySlug.replace(/-/g, ' ')}...`} />;
// //   }

// //   if (cityError) {
// //     return (
// //       <div className="container mx-auto px-4 py-10 text-center">
// //         <Alert variant="destructive" className="max-w-xl mx-auto">
// //           <Info className="h-5 w-5" />
// //           <AlertTitle>Error Loading City</AlertTitle>
// //           <AlertDescription>
// //             {cityError instanceof APIError ? cityError.message : "Could not load city details."}
// //           </AlertDescription>
// //         </Alert>
// //         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// //              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// //         </Button>
// //       </div>
// //     );
// //   }

// //   if (!cityDetails) {
// //     return (
// //       <div className="container mx-auto px-4 py-10 text-center">
// //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// //           <Info className="h-5 w-5 text-yellow-600" />
// //           <AlertTitle className="text-yellow-800">City Not Found</AlertTitle>
// //           <AlertDescription className="text-yellow-700">
// //             The city "{citySlug.replace(/-/g, ' ')}" could not be found or is not active.
// //           </AlertDescription>
// //         </Alert>
// //          <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// //             <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// //         </Button>
// //       </div>
// //     );
// //   }

// //   const cityDisplayName = cityDetails.nameEn;

// //   return (
// //     <div className="flex flex-col min-h-screen bg-slate-50">
// //       <HeroBillboard
// //         title="Services & Parts"
// //         highlightText={`in ${cityDisplayName}`}
// //         subtitle={`Explore vehicle maintenance and auto parts options available in ${cityDisplayName}.`}
// //         showSearch={true} 
// //         searchProps={{
// //             onSubmit: handleHeroSearchSubmitOnCityPage,
// //             initialValues: heroBillboardInitialValues,
// //             isLoading: isLoadingContextLocation, 
// //             formInstanceId: "city-overview",
// //             showDetectLocationButton: true 
// //         }}
// //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// //       />

// //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// //           <li><span className="text-slate-400">»</span></li>
// //           <li className="font-medium text-slate-700" aria-current="page">{cityDisplayName}</li>
// //         </ol>
// //       </nav>

// //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// //         <div className="text-center mb-8 md:mb-10">
// //             <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
// //                 Choose a Service Type in {cityDisplayName}
// //             </h2>
// //             {initialSearchTerm && (
// //                 <p className="text-slate-600 mt-1">
// //                     Searching for "{initialSearchTerm}" within the chosen service type.
// //                 </p>
// //             )}
// //         </div>

// //         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
// //           {featureConcepts.map((concept) => (
// //             <FeatureConceptCard
// //               key={concept.id}
// //               concept={concept}
// //               onClick={() => handleConceptClickForCity(concept)}
// //               isLoading={isLoadingContextLocation} 
// //             />
// //           ))}
// //         </div>
// //       </section>
// //     </div>
// //   );
// // }

// // export default function CityOverviewPage() {
// //   const params = useParams();
// //   const searchParamsHook = useSearchParams();

// //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
  
// //   const searchTermFromUrl = searchParamsHook.get('searchTerm') || searchParamsHook.get('name');
// //   const userLatFromUrl = searchParamsHook.get('userLat') || searchParamsHook.get('userLatitude');
// //   const userLonFromUrl = searchParamsHook.get('userLon') || searchParamsHook.get('userLongitude');
// //   const radiusFromUrl = searchParamsHook.get('radiusInMeters');
// //   const sortByParam = searchParamsHook.get('sortBy');
// //   const sortByFromUrl = sortByParam === null ? undefined : sortByParam;


// //   if (!citySlug) {
// //     return <LoadingFallback message="Loading city information..." />;
// //   }

// //   return (
// //     <Suspense fallback={<LoadingFallback message={`Loading services in ${citySlug.replace(/-/g, ' ')}...`} />}>
// //       <CityOverviewClient 
// //         citySlug={citySlug} 
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
// //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// //       <p className="text-slate-600 text-lg">{message}</p>
// //     </div>
// //   );
// // }
// // // // src/app/cities/[citySlug]/page.tsx
// // // 'use client';

// // // import React, { Suspense } from 'react';
// // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import { fetchCities } from '@/lib/apiClient'; // To get city details
// // // import { CityDto, APIError } from '@/types/api';
// // // import { featureConcepts, FeatureConceptConfig } from '@/config/categories'; // To display concept cards
// // // import FeatureConceptCard from '@/components/concept/FeatureConceptCard'; // Re-using the card
// // // import HeroBillboard from '@/components/common/HeroBillboard'; // Optional, for consistent header
// // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // import { Info, Loader2, ChevronLeft } from "lucide-react";
// // // import Link from 'next/link';
// // // import { Button } from '@/components/ui/button';

// // // interface CityOverviewClientProps {
// // //   citySlug: string;
// // //   initialUserLat?: string | null;
// // //   initialUserLon?: string | null;
// // //   initialRadius?: string | null;
// // //   initialSortBy?: string | null;
// // //   initialSearchTerm?: string | null;
// // //   // initialSearchTerm?: string | null;
// // // }

// // // // function CityOverviewClient({ citySlug, initialSearchTerm }: CityOverviewClientProps) {
// // // function CityOverviewClient({ 
// // //   citySlug, 
// // //   initialUserLat, 
// // //   initialUserLon, 
// // //   initialRadius,
// // //   initialSortBy,
// // //   initialSearchTerm 
// // // }: CityOverviewClientProps) {
// // //   const router = useRouter();

// // //   const { data: cityDetails, isLoading: isLoadingCity, error: cityError } = 
// // //     useQuery<CityDto | undefined, APIError>({
// // //       queryKey: ['cityDetails', citySlug],
// // //       queryFn: async () => {
// // //         if (!citySlug) return undefined;
// // //         const cities = await fetchCities(); // Fetches all, then finds one
// // //         return cities.find(c => c.slug === citySlug);
// // //       },
// // //       enabled: !!citySlug,
// // //       staleTime: 1000 * 60 * 10, // Cache city details for 10 mins
// // //     });

// // //   if (isLoadingCity) {
// // //     return <LoadingFallback message={`Loading details for ${citySlug.replace(/-/g, ' ')}...`} />;
// // //   }

// // //   if (cityError) {
// // //     return (
// // //       <div className="container mx-auto px-4 py-10 text-center">
// // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // //           <Info className="h-5 w-5" />
// // //           <AlertTitle>Error Loading City</AlertTitle>
// // //           <AlertDescription>
// // //             {cityError instanceof APIError ? cityError.message : "Could not load city details."}
// // //           </AlertDescription>
// // //         </Alert>
// // //         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// // //              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// // //         </Button>
// // //       </div>
// // //     );
// // //   }

// // //   if (!cityDetails) {
// // //     return (
// // //       <div className="container mx-auto px-4 py-10 text-center">
// // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // //           <Info className="h-5 w-5 text-yellow-600" />
// // //           <AlertTitle className="text-yellow-800">City Not Found</AlertTitle>
// // //           <AlertDescription className="text-yellow-700">
// // //             The city "{citySlug.replace(/-/g, ' ')}" could not be found or is not active.
// // //           </AlertDescription>
// // //         </Alert>
// // //          <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
// // //             <ChevronLeft className="mr-2 h-4 w-4" /> Back to Home
// // //         </Button>
// // //       </div>
// // //     );
// // //   }

// // //   const cityDisplayName = cityDetails.nameEn;

// // //   // const handleConceptClickForCity = (concept: FeatureConceptConfig) => {
// // //   //   let path = `/cities/${citySlug}/${concept.conceptPageSlug}`;
// // //   //   if (initialSearchTerm) {
// // //   //     // Append searchTerm as 'name' for the shop list page eventually
// // //   //     path += `?name=${encodeURIComponent(initialSearchTerm)}`; 
// // //   //   }
// // //   //   router.push(path);
// // //   // };

// // //    const handleConceptClickForCity = (concept: FeatureConceptConfig) => {
// // //     const query = new URLSearchParams();
// // //     if (initialSearchTerm) {
// // //       // The next page (Concept Page) will expect 'name' or 'searchTerm'
// // //       // and then the Shops page expects 'name' for shop name filtering.
// // //       query.set("name", initialSearchTerm); 
// // //     }
// // //     if (initialUserLat) query.set("userLatitude", initialUserLat);
// // //     if (initialUserLon) query.set("userLongitude", initialUserLon);
// // //     if (initialRadius) query.set("radiusInMeters", initialRadius);
// // //     if (initialSortBy) query.set("sortBy", initialSortBy);
    
// // //     let path = `/cities/${citySlug}/${concept.conceptPageSlug}`;
// // //     const queryString = query.toString();
// // //     if (queryString) {
// // //       path += `?${queryString}`;
// // //     }
// // //     router.push(path);
// // //   };
  
// // //   // For the HeroBillboard on this page, a search might refine within this city's concepts
// // //   // const handleHeroSearchSubmit = (searchParams: { name?: string }) => {
// // //   //   // For now, let's assume this search should apply to the concepts on this page
// // //   //   // If a concept is then clicked, the search term is passed along.
// // //   //   // This is a bit indirect; a more direct search might go to a city-specific search results page.
// // //   //   if (searchParams.name) {
// // //   //       const query = new URLSearchParams();
// // //   //       query.set("searchTerm", searchParams.name);
// // //   //       // Reload the page with the searchTerm, which will then be appended to concept links
// // //   //       router.push(`/cities/${citySlug}?${query.toString()}`); 
// // //   //   }
// // //   // };

// // //    const handleHeroSearchSubmit = (searchParams: { name?: string }) => {
// // //     // This search on the city overview page should also preserve existing location data
// // //     // if it was passed in the URL.
// // //     const query = new URLSearchParams();
// // //     if (searchParams.name) {
// // //         query.set("searchTerm", searchParams.name); // Or "name"
// // //     }
// // //     // Preserve existing location params if they came from the homepage
// // //     if (initialUserLat) query.set("userLatitude", initialUserLat);
// // //     if (initialUserLon) query.set("userLongitude", initialUserLon);
// // //     if (initialRadius) query.set("radiusInMeters", initialRadius);
// // //     if (initialSortBy) query.set("sortBy", initialSortBy); // Usually hero search implies distance sort

// // //     router.push(`/cities/${citySlug}?${query.toString()}`); 
// // //   };


// // //   return (
// // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // //       <HeroBillboard
// // //         title="Services & Parts"
// // //         highlightText={`in ${cityDisplayName}`}
// // //         subtitle={`Explore vehicle maintenance and auto parts options available in ${cityDisplayName}.`}
// // //         showSearch={true} // Show search, but it will just add searchTerm to concept links
// // //         searchProps={{
// // //             onSubmit: handleHeroSearchSubmit,
// // //             // initialValues: { name: initialSearchTerm || ""},
// // //             initialValues: { 
// // //               name: initialSearchTerm || "",
// // //               // Pass through existing location data to the form if available
// // //               userLatitude: initialUserLat ? parseFloat(initialUserLat) : undefined,
// // //               userLongitude: initialUserLon ? parseFloat(initialUserLon) : undefined,
// // //               radiusInMeters: initialRadius ? parseInt(initialRadius) : undefined,
// // //               sortBy: initialSortBy || undefined,
// // //             },
// // //             isLoading: false, // No async operation for this search form directly
// // //         }}
// // //         minHeight="min-h-[25vh] md:min-h-[30vh]"
// // //       />

// // //       {/* Breadcrumbs */}
// // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li className="font-medium text-slate-700" aria-current="page">{cityDisplayName}</li>
// // //         </ol>
// // //       </nav>

// // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // //         <div className="text-center mb-8 md:mb-10">
// // //             <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
// // //                 Choose a Service Type in {cityDisplayName}
// // //             </h2>
// // //             {initialSearchTerm && (
// // //                 <p className="text-slate-600 mt-1">
// // //                     Searching for "{initialSearchTerm}" within the chosen service type.
// // //                 </p>
// // //             )}
// // //         </div>

// // //         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
// // //           {featureConcepts.map((concept) => (
// // //             <FeatureConceptCard
// // //               key={concept.id}
// // //               concept={concept}
// // //               onClick={() => handleConceptClickForCity(concept)}
// // //               // No isLoading prop needed here as it's a direct navigation
// // //             />
// // //           ))}
// // //         </div>
// // //       </section>
// // //     </div>
// // //   );
// // // }


// // // export default function CityOverviewPage() {
// // //   const params = useParams();
// // //   const searchParamsHook = useSearchParams();

// // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // //   const searchTerm = searchParamsHook.get('searchTerm');
// // //   searchParamsHook.get('name');
// // //   const userLat = searchParamsHook.get('userLat') || searchParamsHook.get('userLatitude');
// // //   const userLon = searchParamsHook.get('userLon') || searchParamsHook.get('userLongitude');
// // //   const radius = searchParamsHook.get('radiusInMeters');
// // //   const sortBy = searchParamsHook.get('sortBy');


// // //   if (!citySlug) {
// // //     return <LoadingFallback message="Loading city information..." />;
// // //   }

// // //   return (
// // //     <Suspense fallback={<LoadingFallback message={`Loading services in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // //       {/* <CityOverviewClient citySlug={citySlug} initialSearchTerm={searchTerm} /> */}
// // //       <CityOverviewClient 
// // //         citySlug={citySlug} 
// // //         initialSearchTerm={searchTerm}
// // //         initialUserLat={userLat}
// // //         initialUserLon={userLon}
// // //         initialRadius={radius}
// // //         initialSortBy={sortBy}
// // //       />
// // //     </Suspense>
// // //   );
// // // }

// // // // Reusable LoadingFallback
// // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // //   return (
// // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // //       <p className="text-slate-600 text-lg">{message}</p>
// // //     </div>
// // //   );
// // // }