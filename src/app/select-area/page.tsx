// src/app/select-area/page.tsx
'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchOperationalAreasForMap } from '@/lib/apiClient'; // UPDATED
import { OperationalAreaDto, APIError } from '@/types/api';    // UPDATED
// Assuming CityCard can be adapted or you have an OperationalAreaCard component
// For this example, I'll continue to use CityCard but pass OperationalAreaDto,
// implying CityCard's props need to be flexible or updated.
import CityCard from '@/components/city/CityCard'; 
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// If CityCard cannot directly take OperationalAreaDto, you'd need an OperationalAreaCard
// or adapt CityCard to accept props like 'name', 'slug', and an 'onClick' handler.

function SelectAreaPageContent() { // Renamed component
  const router = useRouter();
  const searchParams = useSearchParams();

  const conceptPageSlugFromUrl = searchParams.get('concept'); 
  const subCategorySlugFromUrl = searchParams.get('subCategory');
  const nameSearchTermFromUrl = searchParams.get('name'); 

  // Location parameters are less critical here as we are selecting an area which defines its own location context
  // but we can preserve them if they were explicitly passed to this page.
  const userLatFromUrl = searchParams.get('userLatitude') || searchParams.get('userLat');
  const userLonFromUrl = searchParams.get('userLongitude') || searchParams.get('userLon');
  const radiusFromUrl = searchParams.get('radiusInMeters');
  const sortByFromUrl = searchParams.get('sortBy');

  const [areaSearchTerm, setAreaSearchTerm] = useState(''); // UPDATED

  const {
    data: operationalAreas, // UPDATED
    isLoading: isLoadingAreas, // UPDATED
    error: areasError      // UPDATED
  } = useQuery<OperationalAreaDto[], APIError>({
      queryKey: ['operationalAreasForSelection'], // Use a distinct key
      queryFn: fetchOperationalAreasForMap,    // UPDATED
      staleTime: 1000 * 60 * 30, // Cache for 30 mins
      refetchOnWindowFocus: false,
    });

  const filteredAreas = useMemo(() => { // UPDATED
    if (!operationalAreas) return [];
    if (!areaSearchTerm.trim()) return operationalAreas;
    return operationalAreas.filter(area =>
      area.nameEn.toLowerCase().includes(areaSearchTerm.toLowerCase()) ||
      area.nameAr.includes(areaSearchTerm)
    );
  }, [operationalAreas, areaSearchTerm]);

  const handleAreaSelection = (selectedArea: OperationalAreaDto) => { // UPDATED
    const queryForNextPage = new URLSearchParams();

    if (nameSearchTermFromUrl) {
      queryForNextPage.set("name", nameSearchTermFromUrl);
    }

    // If specific location params were passed to this page, carry them over,
    // otherwise, the selected area's centroid will be used by the target page.
    if (userLatFromUrl) queryForNextPage.set("userLatitude", userLatFromUrl);
    if (userLonFromUrl) queryForNextPage.set("userLongitude", userLonFromUrl);
    if (radiusFromUrl) queryForNextPage.set("radiusInMeters", radiusFromUrl);
    
    // If sortBy was passed, keep it, otherwise let the target page decide or default
    if (sortByFromUrl) {
        queryForNextPage.set("sortBy", sortByFromUrl);
    } else if (userLatFromUrl && userLonFromUrl && !sortByFromUrl) {
        // If specific location was passed here and no sort, assume distance sort
        queryForNextPage.set("sortBy", "distance_asc");
    }


    let basePath = "";

    if (subCategorySlugFromUrl) {
      // Navigate to shops list for selected area and subcategory
      basePath = `/operational-areas/${selectedArea.slug}/categories/${subCategorySlugFromUrl}/shops`;
    } else if (conceptPageSlugFromUrl) {
      // Navigate to concept page for selected area
      basePath = `/operational-areas/${selectedArea.slug}/${conceptPageSlugFromUrl}`;
    } else {
      // Default: go to the homepage with the selected area active in query params
      // and use its centroid and default radius for location context.
      basePath = `/`;
      queryForNextPage.set("area", selectedArea.slug);
      queryForNextPage.set("userLatitude", selectedArea.centroidLatitude.toString());
      queryForNextPage.set("userLongitude", selectedArea.centroidLongitude.toString());
      if (selectedArea.defaultSearchRadiusMeters) {
        queryForNextPage.set("radiusInMeters", selectedArea.defaultSearchRadiusMeters.toString());
      }
      // If no specific sort by, homepage might default to distance if lat/lon are present
      if (!queryForNextPage.has("sortBy")) {
        queryForNextPage.set("sortBy", "distance_asc");
      }
    }

    const queryString = queryForNextPage.toString();
    const finalPath = queryString ? `${basePath}?${queryString}` : basePath;

    router.push(finalPath);
  };

  let pageTitle = "Select Your Area"; // UPDATED
  if (subCategorySlugFromUrl) {
    const subCatName = subCategorySlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    pageTitle = `Select Area for ${subCatName}`;
    if (nameSearchTermFromUrl) {
      pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
    }
  } else if (conceptPageSlugFromUrl) {
    const conceptName = conceptPageSlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    pageTitle = `Select Area for ${conceptName}`;
     if (nameSearchTermFromUrl) {
      pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
    }
  } else if (nameSearchTermFromUrl) {
    pageTitle = `Select Area to search for "${nameSearchTermFromUrl}"`;
  }


  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 min-h-[calc(100vh-150px)]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            {pageTitle}
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Please choose an area from the list below to continue your search or exploration.
          </p>
        </div>

        <div className="mb-6 relative">
          <Input
            type="text"
            placeholder="Search for an area..." // UPDATED
            value={areaSearchTerm}
            onChange={(e) => setAreaSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-base rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>

        {isLoadingAreas && ( // UPDATED
          <div className="text-center py-10">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
            <p className="mt-3 text-slate-600 text-base">Loading available areas...</p> {/* UPDATED */}
          </div>
        )}
        {areasError && ( // UPDATED
          <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">
            Could not load areas: {areasError instanceof APIError ? areasError.message : 'An unknown error occurred.'} {/* UPDATED */}
          </div>
        )}

        {filteredAreas && !isLoadingAreas && operationalAreas && operationalAreas.length > 0 && filteredAreas.length === 0 && areaSearchTerm && ( // UPDATED
             <p className="text-center text-slate-500 text-lg py-10">No areas found matching "{areaSearchTerm}".</p> // UPDATED
        )}
        {filteredAreas && !isLoadingAreas && operationalAreas && operationalAreas.length === 0 && !areaSearchTerm && ( // UPDATED
            <p className="text-center text-slate-500 text-lg py-10">No areas are currently listed.</p> // UPDATED
        )}


        {filteredAreas && filteredAreas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {filteredAreas.map((area) => ( // UPDATED
              // Assuming CityCard can take OperationalAreaDto by adapting its props or using 'as any'
              // Or you replace CityCard with an OperationalAreaCard component
              <CityCard 
                key={area.id}
                // city={area as any} // If CityCard expects CityDto strictly
                // Or, if CityCard is flexible with name/slug props:
                city={{ // Adapt OperationalAreaDto to what CityCard expects
                    id: area.id,
                    nameEn: area.nameEn,
                    nameAr: area.nameAr,
                    slug: area.slug,
                    latitude: area.centroidLatitude, // Pass centroid for any display
                    longitude: area.centroidLongitude,
                    isActive: area.isActive,
                    country: "Egypt" // Assuming, or add to OperationalAreaDto if needed
                }}
                onClick={() => handleAreaSelection(area)} // UPDATED
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SelectAreaPage() { // Renamed component
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    }>
      <SelectAreaPageContent />
    </Suspense>
  );
}

// LoadingFallback remains the same
function LoadingFallback({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-150px)] justify-center items-center bg-slate-100 p-4">
      <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
      <p className="text-slate-600 text-lg text-center">{message}</p>
    </div>
  );
}
// // src/app/select-area/page.tsx
// 'use client';

// import { Suspense } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { useQuery } from '@tanstack/react-query';
// import { fetchCities } from '@/lib/apiClient';
// import { CityDto, APIError } from '@/types/api';
// import CityCard from '@/components/city/CityCard';
// import { Loader2, Search } from 'lucide-react';
// import { Input } from '@/components/ui/input';
// import { useState, useMemo } from 'react';

// function SelectCityPageContent() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   // Read parameters from URL
//   const conceptPageSlugFromUrl = searchParams.get('concept'); // e.g., "maintenance-services"
//   const subCategorySlugFromUrl = searchParams.get('subCategory'); // e.g., "oil-change"
//   const nameSearchTermFromUrl = searchParams.get('name'); // For "name=" or "searchTerm="

//   // Location parameters that might need to be carried over
//   const userLatFromUrl = searchParams.get('userLatitude') || searchParams.get('userLat');
//   const userLonFromUrl = searchParams.get('userLongitude') || searchParams.get('userLon');
//   const radiusFromUrl = searchParams.get('radiusInMeters');
//   const sortByFromUrl = searchParams.get('sortBy');


//   const [citySearchTerm, setCitySearchTerm] = useState('');

//   const {
//     data: cities,
//     isLoading: isLoadingCities,
//     error: citiesError
//   } = useQuery<CityDto[], APIError>({
//       queryKey: ['cities'],
//       queryFn: fetchCities,
//       staleTime: 1000 * 60 * 60, // 1 hour
//       refetchOnWindowFocus: false,
//     });

//   const filteredCities = useMemo(() => {
//     if (!cities) return [];
//     if (!citySearchTerm.trim()) return cities;
//     return cities.filter(city =>
//       city.nameEn.toLowerCase().includes(citySearchTerm.toLowerCase()) ||
//       city.nameAr.includes(citySearchTerm)
//     );
//   }, [cities, citySearchTerm]);

//   const handleCitySelection = (selectedCitySlug: string) => {
//     const queryForNextPage = new URLSearchParams();

//     // Preserve existing search term if present
//     if (nameSearchTermFromUrl) {
//       queryForNextPage.set("name", nameSearchTermFromUrl);
//     }

//     // Preserve existing location parameters if present
//     if (userLatFromUrl) queryForNextPage.set("userLatitude", userLatFromUrl);
//     if (userLonFromUrl) queryForNextPage.set("userLongitude", userLonFromUrl);
//     if (radiusFromUrl) queryForNextPage.set("radiusInMeters", radiusFromUrl);
//     if (sortByFromUrl) queryForNextPage.set("sortBy", sortByFromUrl);
//     else if (userLatFromUrl && userLonFromUrl && !sortByFromUrl) {
//       // If location is present and sortBy isn't, default to distance_asc
//       queryForNextPage.set("sortBy", "distance_asc");
//     }


//     let basePath = "";

//     if (subCategorySlugFromUrl) {
//       // Highest priority: if a specific subCategory was being targeted
//       basePath = `/cities/${selectedCitySlug}/categories/${subCategorySlugFromUrl}/shops`;
//     } else if (conceptPageSlugFromUrl) {
//       // Next priority: if a concept page was being targeted
//       basePath = `/cities/${selectedCitySlug}/${conceptPageSlugFromUrl}`;
//     } else {
//       // Default: go to the homepage with the selected city active in query params
//       basePath = `/`;
//       queryForNextPage.set("city", selectedCitySlug);
//       // Ensure name is also carried for homepage general search context if present
//       // (already handled by the nameSearchTermFromUrl check above)
//     }

//     const queryString = queryForNextPage.toString();
//     const finalPath = queryString ? `${basePath}?${queryString}` : basePath;

//     router.push(finalPath);
//   };

//   // Determine page title based on available parameters
//   let pageTitle = "Select Your City";
//   if (subCategorySlugFromUrl) {
//     // Create a user-friendly name from slug (simple replace and capitalize)
//     const subCatName = subCategorySlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//     pageTitle = `Select City for ${subCatName}`;
//     if (nameSearchTermFromUrl) {
//       pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
//     }
//   } else if (conceptPageSlugFromUrl) {
//     const conceptName = conceptPageSlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//     pageTitle = `Select City for ${conceptName}`;
//      if (nameSearchTermFromUrl) {
//       pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
//     }
//   } else if (nameSearchTermFromUrl) {
//     pageTitle = `Select City to search for "${nameSearchTermFromUrl}"`;
//   }


//   return (
//     <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 min-h-[calc(100vh-150px)]">
//       <div className="max-w-3xl mx-auto">
//         <div className="text-center mb-8 md:mb-12">
//           <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
//             {pageTitle}
//           </h1>
//           <p className="mt-3 text-lg text-gray-600">
//             Please choose a city from the list below to continue your search or exploration.
//           </p>
//         </div>

//         <div className="mb-6 relative">
//           <Input
//             type="text"
//             placeholder="Search for a city..."
//             value={citySearchTerm}
//             onChange={(e) => setCitySearchTerm(e.target.value)}
//             className="w-full pl-10 pr-4 py-3 text-base rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
//           />
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
//         </div>

//         {isLoadingCities && (
//           <div className="text-center py-10">
//             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
//             <p className="mt-3 text-slate-600 text-base">Loading available cities...</p>
//           </div>
//         )}
//         {citiesError && (
//           <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">
//             Could not load cities: {citiesError instanceof APIError ? citiesError.message : 'An unknown error occurred.'}
//           </div>
//         )}

//         {filteredCities && !isLoadingCities && cities && cities.length > 0 && filteredCities.length === 0 && citySearchTerm && (
//              <p className="text-center text-slate-500 text-lg py-10">No cities found matching "{citySearchTerm}".</p>
//         )}
//         {/* Case where cities might be an empty array from API, and no search term */}
//         {filteredCities && !isLoadingCities && cities && cities.length === 0 && !citySearchTerm && (
//             <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
//         )}


//         {filteredCities && filteredCities.length > 0 && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
//             {filteredCities.map((city) => (
//               <CityCard
//                 key={city.id}
//                 city={city}
//                 onClick={() => handleCitySelection(city.slug)}
//               />
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default function SelectCityPage() {
//   return (
//     <Suspense fallback={
//       <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
//         <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
//       </div>
//     }>
//       <SelectCityPageContent />
//     </Suspense>
//   );
// }
// // // src/app/select-city/page.tsx
// // 'use client';

// // import { Suspense } from 'react'; 
// // import { useRouter, useSearchParams } from 'next/navigation';
// // import { useQuery } from '@tanstack/react-query';
// // import { fetchCities } from '@/lib/apiClient';
// // import { CityDto, APIError } from '@/types/api';
// // import CityCard from '@/components/city/CityCard'; 
// // import { Loader2, Search } from 'lucide-react';
// // import { Input } from '@/components/ui/input'; 
// // import { useState, useMemo } from 'react';

// // function SelectCityPageContent() {
// //   const router = useRouter();
// //   const searchParams = useSearchParams();

// //   // Read parameters from URL
// //   const conceptPageSlugFromUrl = searchParams.get('concept'); // e.g., "maintenance-services"
// //   const subCategorySlugFromUrl = searchParams.get('subCategory'); // e.g., "oil-change"
// //   const nameSearchTermFromUrl = searchParams.get('name'); // For "name=" or "searchTerm="

// //   const [citySearchTerm, setCitySearchTerm] = useState('');

// //   const { 
// //     data: cities, 
// //     isLoading: isLoadingCities, 
// //     error: citiesError 
// //   } = useQuery<CityDto[], APIError>({
// //       queryKey: ['cities'], 
// //       queryFn: fetchCities,
// //       staleTime: 1000 * 60 * 60,
// //     });

// //   const filteredCities = useMemo(() => {
// //     if (!cities) return [];
// //     if (!citySearchTerm.trim()) return cities;
// //     return cities.filter(city => 
// //       city.nameEn.toLowerCase().includes(citySearchTerm.toLowerCase()) ||
// //       city.nameAr.includes(citySearchTerm)
// //     );
// //   }, [cities, citySearchTerm]);

// //   const handleCitySelection = (selectedCitySlug: string) => {
// //     const queryForNextPage = new URLSearchParams();
// //     if (nameSearchTermFromUrl) {
// //       queryForNextPage.set("name", nameSearchTermFromUrl);
// //     }
// //     // Note: Location parameters (lat, lon, radius, sortBy) are not handled here by default.
// //     // If location was detected on a previous page and needs to be carried through even after
// //     // selecting a city here, those params would also need to be read from searchParams
// //     // and appended to queryForNextPage. For now, we assume selecting a city here might
// //     // reset or precede a new location-based search on the target page.

// //     let basePath = "";

// //     if (subCategorySlugFromUrl) {
// //       // Highest priority: if a specific subCategory was being targeted
// //       basePath = `/cities/${selectedCitySlug}/categories/${subCategorySlugFromUrl}/shops`;
// //     } else if (conceptPageSlugFromUrl) {
// //       // Next priority: if a concept page was being targeted
// //       basePath = `/cities/${selectedCitySlug}/${conceptPageSlugFromUrl}`;
// //     } else {
// //       // Default: go to the city overview page
// //       // If nameSearchTermFromUrl exists, it will be appended by the logic below.
// //       // If we want it to be `?searchTerm=` instead of `?name=`, we'd adjust here.
// //       // For consistency with shop search, `?name=` is often better.
// //       basePath = `/cities/${selectedCitySlug}`;
// //     }

// //     const queryString = queryForNextPage.toString();
// //     const finalPath = queryString ? `${basePath}?${queryString}` : basePath;
    
// //     router.push(finalPath);
// //   };

// //   // Determine page title based on available parameters
// //   let pageTitle = "Select Your City";
// //   if (subCategorySlugFromUrl) {
// //     // Create a user-friendly name from slug (simple replace and capitalize)
// //     const subCatName = subCategorySlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //     pageTitle = `Select City for ${subCatName}`;
// //     if (nameSearchTermFromUrl) {
// //       pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
// //     }
// //   } else if (conceptPageSlugFromUrl) {
// //     const conceptName = conceptPageSlugFromUrl.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //     pageTitle = `Select City for ${conceptName}`;
// //      if (nameSearchTermFromUrl) {
// //       pageTitle += ` (searching for "${nameSearchTermFromUrl}")`;
// //     }
// //   } else if (nameSearchTermFromUrl) {
// //     pageTitle = `Select City to search for "${nameSearchTermFromUrl}"`;
// //   }


// //   return (
// //     <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 min-h-[calc(100vh-150px)]">
// //       <div className="max-w-3xl mx-auto">
// //         <div className="text-center mb-8 md:mb-12">
// //           <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
// //             {pageTitle}
// //           </h1>
// //           <p className="mt-3 text-lg text-gray-600">
// //             Please choose a city from the list below to continue your search or exploration.
// //           </p>
// //         </div>

// //         <div className="mb-6 relative">
// //           <Input 
// //             type="text"
// //             placeholder="Search for a city..."
// //             value={citySearchTerm}
// //             onChange={(e) => setCitySearchTerm(e.target.value)}
// //             className="w-full pl-10 pr-4 py-3 text-base rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
// //           />
// //           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
// //         </div>

// //         {isLoadingCities && (
// //           <div className="text-center py-10">
// //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// //             <p className="mt-3 text-slate-600 text-base">Loading available cities...</p>
// //           </div>
// //         )}
// //         {citiesError && (
// //           <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">
// //             Could not load cities: {citiesError instanceof APIError ? citiesError.message : 'An unknown error occurred.'}
// //           </div>
// //         )}
        
// //         {filteredCities && !isLoadingCities && cities && cities.length > 0 && filteredCities.length === 0 && citySearchTerm && (
// //              <p className="text-center text-slate-500 text-lg py-10">No cities found matching "{citySearchTerm}".</p>
// //         )}
// //         {/* Case where cities might be an empty array from API, and no search term */}
// //         {filteredCities && !isLoadingCities && cities && cities.length === 0 && !citySearchTerm && (
// //             <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// //         )}


// //         {filteredCities && filteredCities.length > 0 && (
// //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
// //             {filteredCities.map((city) => (
// //               <CityCard
// //                 key={city.id}
// //                 city={city}
// //                 onClick={() => handleCitySelection(city.slug)}
// //               />
// //             ))}
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }

// // export default function SelectCityPage() {
// //   return (
// //     <Suspense fallback={
// //       <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
// //         <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
// //       </div>
// //     }>
// //       <SelectCityPageContent />
// //     </Suspense>
// //   );
// // }
// // // // src/app/select-city/page.tsx
// // // 'use client';

// // // import { Suspense } from 'react'; // For useSearchParams
// // // import { useRouter, useSearchParams } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import { fetchCities } from '@/lib/apiClient';
// // // import { CityDto, APIError } from '@/types/api';
// // // import CityCard from '@/components/city/CityCard'; // Reusing the CityCard
// // // import { Loader2, Search } from 'lucide-react';
// // // import { Input } from '@/components/ui/input'; // Assuming you have this
// // // import { useState, useMemo } from 'react';

// // // function SelectCityPageContent() {
// // //   const router = useRouter();
// // //   const searchParams = useSearchParams();
// // //   const conceptPageSlug = searchParams.get('concept'); // e.g., "maintenance-services" or "auto-parts"
// // //   const searchTerm = searchParams.get('searchTerm'); // e.g., from hero search

// // //   const [citySearchTerm, setCitySearchTerm] = useState('');

// // //   const { 
// // //     data: cities, 
// // //     isLoading: isLoadingCities, 
// // //     error: citiesError 
// // //   } = useQuery<CityDto[], APIError>({
// // //       queryKey: ['cities'], // Same query key as homepage, will use cache
// // //       queryFn: fetchCities,
// // //       staleTime: 1000 * 60 * 60,
// // //     });

// // //   const filteredCities = useMemo(() => {
// // //     if (!cities) return [];
// // //     if (!citySearchTerm.trim()) return cities;
// // //     return cities.filter(city => 
// // //       city.nameEn.toLowerCase().includes(citySearchTerm.toLowerCase()) ||
// // //       city.nameAr.includes(citySearchTerm) // Basic Arabic search
// // //     );
// // //   }, [cities, citySearchTerm]);

// // //   const handleCitySelection = (citySlug: string) => {
// // //     if (conceptPageSlug) {
// // //       // If a concept was passed (e.g., user clicked "Maintenance" then geolocation failed)
// // //       // redirect to the concept page for the selected city.
// // //       let path = `/cities/${citySlug}/${conceptPageSlug}`;
// // //       if (searchTerm) {
// // //         path += `?name=${encodeURIComponent(searchTerm)}`; // Pass hero search term as 'name' to shop list
// // //       }
// // //       router.push(path);
// // //     } else if (searchTerm) {
// // //       // If only a searchTerm was passed (e.g., from hero search, no concept chosen yet)
// // //       // redirect to a general search results page for that city, or city overview page.
// // //       // For now, let's assume we go to the city overview page and it handles the searchTerm.
// // //       router.push(`/cities/${citySlug}?searchTerm=${encodeURIComponent(searchTerm)}`);
// // //     } else {
// // //       // Default: go to the city overview page
// // //       router.push(`/cities/${citySlug}`);
// // //     }
// // //   };

// // //   let pageTitle = "Select Your City";
// // //   if (conceptPageSlug) {
// // //     const conceptName = conceptPageSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // //     pageTitle = `Select City for ${conceptName}`;
// // //   } else if (searchTerm) {
// // //     pageTitle = `Select City to search for "${searchTerm}"`;
// // //   }


// // //   return (
// // //     <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 min-h-[calc(100vh-150px)]"> {/* Adjust min-height based on header/footer */}
// // //       <div className="max-w-3xl mx-auto">
// // //         <div className="text-center mb-8 md:mb-12">
// // //           <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
// // //             {pageTitle}
// // //           </h1>
// // //           <p className="mt-3 text-lg text-gray-600">
// // //             Please choose a city from the list below to continue.
// // //           </p>
// // //         </div>

// // //         <div className="mb-6 relative">
// // //           <Input 
// // //             type="text"
// // //             placeholder="Search for a city..."
// // //             value={citySearchTerm}
// // //             onChange={(e) => setCitySearchTerm(e.target.value)}
// // //             className="w-full pl-10 pr-4 py-3 text-base rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
// // //           />
// // //           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
// // //         </div>


// // //         {isLoadingCities && (
// // //           <div className="text-center py-10">
// // //             <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
// // //             <p className="mt-3 text-slate-600 text-base">Loading available cities...</p>
// // //           </div>
// // //         )}
// // //         {citiesError && (
// // //           <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">
// // //             Could not load cities: {citiesError instanceof APIError ? citiesError.message : 'An unknown error occurred.'}
// // //           </div>
// // //         )}
        
// // //         {filteredCities && !isLoadingCities && filteredCities.length === 0 && citySearchTerm && (
// // //              <p className="text-center text-slate-500 text-lg py-10">No cities found matching "{citySearchTerm}".</p>
// // //         )}
// // //         {filteredCities && !isLoadingCities && filteredCities.length === 0 && !citySearchTerm && cities && cities.length > 0 && (
// // //             <p className="text-center text-slate-500 text-lg py-10">No cities match your search.</p>
// // //         )}
// // //          {filteredCities && !isLoadingCities && cities && cities.length === 0 && !citySearchTerm && (
// // //             <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// // //         )}


// // //         {filteredCities && filteredCities.length > 0 && (
// // //           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
// // //             {filteredCities.map((city) => (
// // //               <CityCard
// // //                 key={city.id}
// // //                 city={city}
// // //                 onClick={() => handleCitySelection(city.slug)}
// // //               />
// // //             ))}
// // //           </div>
// // //         )}
// // //       </div>
// // //     </div>
// // //   );
// // // }

// // // export default function SelectCityPage() {
// // //   // Suspense is crucial here because SelectCityPageContent uses useSearchParams
// // //   return (
// // //     <Suspense fallback={
// // //       <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
// // //         <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
// // //       </div>
// // //     }>
// // //       <SelectCityPageContent />
// // //     </Suspense>
// // //   );
// // // }