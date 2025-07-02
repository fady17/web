'use client';

import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import {
    ShopDto,
    PaginatedResponse,
    FrontendShopQueryParameters,
    APIError,
    OperationalAreaDto,
    SubCategoryDto,
    HighLevelConceptQueryParam // Make sure this is correctly typed if used for casting
} from '@/types/api';
import { 
    fetchShops, 
    fetchOperationalAreasForMap, 
    fetchSubCategoriesByOperationalArea
} from '@/lib/apiClient';
import ShopCard from '@/components/shop/ShopCard';
import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import ShopSearchForm from '@/components/search/ShopSearchForm';
import { Info, Loader2, SearchX, ChevronLeft } from "lucide-react";
import Link from 'next/link';
import { useUserGeoLocation } from '@/contexts/UserGeoLocationContext';
import { cn } from '@/lib/utils';
import HeroBillboard from '@/components/common/HeroBillboard';
import { useGeoData } from '@/contexts/GeoDataContext';
import { featureConcepts, FeatureConceptConfig } from '@/config/categories';

const DEFAULT_SEARCH_RADIUS_SHOPS_PAGE = 50000;
const DEFAULT_DISTANCE_SORT = 'distance_asc';
// API_DEFAULT_SORT will mean 'sortBy' is not sent, relying on backend's true default
const API_DEFAULT_SORT_VALUE = undefined; // Or specific if API has one, e.g. 'name_asc'
const API_ACCEPTED_SORTS = ['distance_asc', 'name_asc', 'name_desc'];


interface ShopsPageClientProps {
  areaSlug: string;
  subCategorySlug: string;
}

function ShopsPageClient({ areaSlug, subCategorySlug }: ShopsPageClientProps) {
  const router = useRouter();
  const queryParamsFromUrl = useSearchParams();
  const {
    currentLocation: contextLocation,
    setCurrentLocation: setContextLocation,
    isLoading: isLoadingContextLocation,
  } = useUserGeoLocation();

  useEffect(() => {
    const urlLat = queryParamsFromUrl.get('userLatitude');
    const urlLon = queryParamsFromUrl.get('userLongitude');
    const urlRadius = queryParamsFromUrl.get('radiusInMeters');

    if (urlLat && urlLon) {
      const lat = parseFloat(urlLat);
      const lon = parseFloat(urlLon);
      if (!isNaN(lat) && !isNaN(lon)) {
        const radius = urlRadius ? parseInt(urlRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE);
        if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
          setContextLocation(
            { latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 
            'url_param'
          );
        }
      }
    }
  }, [queryParamsFromUrl, contextLocation, setContextLocation]);

  const { data: operationalAreaDetails, isLoading: isLoadingAreaDetails } = useQuery<OperationalAreaDto | null, APIError>({
    queryKey: ['operationalAreaDetails', areaSlug] as const,
    queryFn: async (): Promise<OperationalAreaDto | null> => {
      if (!areaSlug) return null;
      try {
        const areas = await fetchOperationalAreasForMap(); 
        return areas.find(oa => oa.slug === areaSlug) || null;
      } catch (e) {
        if (e instanceof APIError && e.status === 404) return null;
        console.error("Error fetching operationalAreaDetails:", e);
        throw e;
      }
    },
    enabled: !!areaSlug,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false
  });

  const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | null, APIError>({
    queryKey: ['subCategoryDetails', areaSlug, subCategorySlug] as const,
    queryFn: async (): Promise<SubCategoryDto | null> => {
      if (!areaSlug || !subCategorySlug) return null;
      try {
        const subCategories = await fetchSubCategoriesByOperationalArea(areaSlug); 
        const foundSubCategory = subCategories.find(sc => sc.slug === subCategorySlug);
        return foundSubCategory || null;
      } catch (e) {
        if (e instanceof APIError && e.status === 404) return null;
        console.error("Error fetching subCategoryDetails:", e);
        throw e;
      }
    },
    enabled: !!areaSlug && !!subCategorySlug && !!operationalAreaDetails,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof APIError && error.status === 404) return false;
      return failureCount < 3;
    }
  });

  const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'>>(() => {
    const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'> = {};
    const nameParam = queryParamsFromUrl.get('name');
    const servicesParam = queryParamsFromUrl.get('services');
    let sortByParam = queryParamsFromUrl.get('sortBy');
    const latParam = queryParamsFromUrl.get('userLatitude');
    const lonParam = queryParamsFromUrl.get('userLongitude');
    const radiusParam = queryParamsFromUrl.get('radiusInMeters');

    if (nameParam) params.name = nameParam;
    if (servicesParam) params.services = servicesParam;

    let userHasProvidedLocationForSearch = false;
    if (latParam && lonParam) {
        const lat = parseFloat(latParam);
        const lon = parseFloat(lonParam);
        if(!isNaN(lat) && !isNaN(lon)) {
            params.userLatitude = lat;
            params.userLongitude = lon;
            params.radiusInMeters = radiusParam ? parseInt(radiusParam, 10) : DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
            userHasProvidedLocationForSearch = true;
        }
    }
    
    if (userHasProvidedLocationForSearch) {
        params.sortBy = sortByParam && API_ACCEPTED_SORTS.includes(sortByParam) ? sortByParam : DEFAULT_DISTANCE_SORT;
    } else {
        if (sortByParam && API_ACCEPTED_SORTS.includes(sortByParam) && sortByParam !== DEFAULT_DISTANCE_SORT) {
            params.sortBy = sortByParam; // e.g. name_asc, name_desc
        } else {
            params.sortBy = API_DEFAULT_SORT_VALUE; // Let backend use its true default
        }
        delete params.userLatitude;
        delete params.userLongitude;
        delete params.radiusInMeters;
    }
    return params;
  });
  
  const [pageSize] = useState(9);

  const shopsQueryKey = useMemo(() =>
    ['shops', areaSlug, subCategorySlug, { ...searchFilters, pageSize }] as const,
    [areaSlug, subCategorySlug, searchFilters, pageSize]
  );

  const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
    queryKey: shopsQueryKey,
    queryFn: ({ pageParam = 1 }) => {
      const apiFilters: FrontendShopQueryParameters = {
        pageNumber: pageParam,
        pageSize: pageSize,
      };
      if (searchFilters.name) apiFilters.name = searchFilters.name;
      if (searchFilters.services) apiFilters.services = searchFilters.services;
      if (searchFilters.sortBy) apiFilters.sortBy = searchFilters.sortBy; // Will be undefined if not set

      if (searchFilters.userLatitude !== undefined && searchFilters.userLongitude !== undefined) {
        apiFilters.userLatitude = searchFilters.userLatitude;
        apiFilters.userLongitude = searchFilters.userLongitude;
        apiFilters.radiusInMeters = searchFilters.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
      }
      
      // console.log("ShopsPageClient: Calling fetchShops with apiFilters:", JSON.stringify(apiFilters, null, 2));
      return fetchShops(areaSlug, subCategorySlug, apiFilters);
    },
    getNextPageParam: (lastPage) =>
        lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
    enabled: !!areaSlug && !!subCategorySlug && !!operationalAreaDetails && !!subCategoryDetails,
    staleTime: 1 * 60 * 1000, 
    refetchOnWindowFocus: false,
  });

  const data = queryResult.data;
  const { 
    error: shopsError, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading: isLoadingShops, 
    isFetching: isFetchingShopsQuery, 
    isError, 
    refetch 
  } = queryResult;

  const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);
  const isLoadingInitialData = (isLoadingAreaDetails || isLoadingSubCategory || (isLoadingShops && !data?.pages?.length)) && allShops.length === 0;

  const handleSearchFormSubmit = (newFiltersFromForm: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'>) => {
    const formSpecifiesLocation = newFiltersFromForm.userLatitude !== undefined && newFiltersFromForm.userLongitude !== undefined;
    let formSortBy = newFiltersFromForm.sortBy === 'default' ? undefined : newFiltersFromForm.sortBy;

    const updatedFiltersState: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'> = {
        name: newFiltersFromForm.name,
        services: newFiltersFromForm.services,
    };

    if (formSpecifiesLocation) {
        updatedFiltersState.userLatitude = newFiltersFromForm.userLatitude;
        updatedFiltersState.userLongitude = newFiltersFromForm.userLongitude;
        updatedFiltersState.radiusInMeters = newFiltersFromForm.radiusInMeters || operationalAreaDetails?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
        
        if (!formSortBy || (formSortBy && !API_ACCEPTED_SORTS.includes(formSortBy))) {
            updatedFiltersState.sortBy = DEFAULT_DISTANCE_SORT;
        } else {
            updatedFiltersState.sortBy = formSortBy;
        }
        
        if (typeof newFiltersFromForm.userLatitude === 'number' && typeof newFiltersFromForm.userLongitude === 'number') {
            setContextLocation({
                latitude: newFiltersFromForm.userLatitude,
                longitude: newFiltersFromForm.userLongitude,
                radiusInMeters: updatedFiltersState.radiusInMeters,
                timestamp: Date.now()
            }, 'manual'); 
        }
    } else {
      if (formSortBy === DEFAULT_DISTANCE_SORT) {
        updatedFiltersState.sortBy = API_DEFAULT_SORT_VALUE;
      } else if (formSortBy && API_ACCEPTED_SORTS.includes(formSortBy)) {
        updatedFiltersState.sortBy = formSortBy;
      } else {
        updatedFiltersState.sortBy = API_DEFAULT_SORT_VALUE;
      }
    }

    setSearchFilters(updatedFiltersState);

    const newUrlSearchParams = new URLSearchParams();
    if (updatedFiltersState.name) newUrlSearchParams.set('name', updatedFiltersState.name);
    if (updatedFiltersState.services) newUrlSearchParams.set('services', updatedFiltersState.services);
    if (updatedFiltersState.sortBy) newUrlSearchParams.set('sortBy', updatedFiltersState.sortBy);
    if (updatedFiltersState.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', updatedFiltersState.userLatitude.toString());
    if (updatedFiltersState.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', updatedFiltersState.userLongitude.toString());
    if (updatedFiltersState.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', updatedFiltersState.radiusInMeters.toString());

    const newUrl = `/operational-areas/${areaSlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
    router.push(newUrl, { scroll: false });
  };

  const { ref: intersectionObserverRef, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const subCategoryDisplayName = useMemo(() => {
    if (!subCategoryDetails) return subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return subCategoryDetails.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [subCategoryDetails, subCategorySlug]);

  const areaDisplayName = useMemo(() => { 
    if (!operationalAreaDetails) return areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return operationalAreaDetails.nameEn || areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, [operationalAreaDetails, areaSlug]);
  
  const currentFeatureConceptForBreadcrumb = useMemo(() => {
    if (!subCategoryDetails) return null;
    const numericConcept = subCategoryDetails.concept;
    const apiFilter: HighLevelConceptQueryParam | undefined = numericConcept === 1 ? "Maintenance" : numericConcept === 2 ? "Marketplace" : undefined;
    if (!apiFilter) return null;
    return featureConcepts.find(fc => fc.apiConceptFilter === apiFilter);
  }, [subCategoryDetails]);

  const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
        name: searchFilters.name,
        services: searchFilters.services,
        sortBy: searchFilters.sortBy || 'default', // For ShopSearchForm, 'default' can mean "let API decide"
        userLatitude: searchFilters.userLatitude,
        userLongitude: searchFilters.userLongitude,
        radiusInMeters: searchFilters.radiusInMeters,
    }), [searchFilters]);

  const glassPanelBase = "bg-black/60 backdrop-blur-xl border-white/10";
  const glassPanelText = "text-slate-100";
  const glassPanelSubtleText = "text-slate-300";
  
  const HEADER_TOP_OFFSET_CLASS = "top-[68px] sm:top-[84px]"; 
  const BREADCRUMB_HEIGHT_CSS = "h-[3.1rem]"; 
  const SEARCH_FORM_STICKY_TOP_CLASS = `top-[calc(68px+3.1rem)] sm:top-[calc(84px+3.1rem)]`; // Example calculation

  if (isLoadingAreaDetails || (isLoadingSubCategory && !subCategoryDetails)) {
      return <LoadingFallback message={`Loading details for ${subCategorySlug.replace(/-/g,' ')} in ${areaSlug.replace(/-/g,' ')}...`} glassEffect={true} />;
  }

  if (!operationalAreaDetails || !subCategoryDetails) {
    return (
      <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <Alert variant="destructive" className="max-w-lg mx-auto bg-red-700/20 border-red-500/50 text-red-200 backdrop-blur-md">
          <Info className="h-5 w-5" />
          <AlertTitle>Information Missing</AlertTitle>
          <AlertDescription>
            Could not load critical page details. Please try again.
            {!operationalAreaDetails && ` Area "${areaSlug}" not found.`}
            {!subCategoryDetails && ` Subcategory "${subCategorySlug}" not found.`}
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-slate-50/10 active:bg-slate-50/20">
          <ChevronLeft className="mr-2 h-4 w-4" /> Go Back Home
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", glassPanelText)}> 
      <nav aria-label="Breadcrumb" className={cn(
          "border-b shadow-md sticky z-30", 
          HEADER_TOP_OFFSET_CLASS, 
          "bg-black/70 backdrop-blur-lg", 
          "border-white/10 border-t-0",
          BREADCRUMB_HEIGHT_CSS 
      )}>
        <ol className="container mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300">
          <li><Link href="/" className="hover:text-emerald-400">Home</Link></li>
          <li><span className="text-slate-400">/</span></li>
          <li>
            <Link
              href={`/?area=${areaSlug}`} // Corrected: Link to homepage with area context
              className="hover:text-emerald-400"
              aria-label={`Back to ${areaDisplayName} overview on homepage`}
            >
              {areaDisplayName}
            </Link>
          </li>
          {currentFeatureConceptForBreadcrumb && (
            <>
              <li><span className="text-slate-400">/</span></li>
              <li><Link href={`/operational-areas/${areaSlug}/${currentFeatureConceptForBreadcrumb.conceptPageSlug}`} className="hover:text-emerald-400">{currentFeatureConceptForBreadcrumb.nameEn}</Link></li>
            </>
          )}
          <li><span className="text-slate-400">/</span></li>
          <li className="font-medium text-white truncate" aria-current="page">{subCategoryDisplayName}</li>
        </ol>
      </nav>

      <div className={cn("w-full", "bg-black/50 backdrop-blur-lg", "border-b border-white/10 py-6 md:py-8 text-center")}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-shadow-strong tracking-tight">
                {subCategoryDisplayName}
            </h1>
            <p className={cn("mt-1.5 text-md sm:text-lg text-shadow-medium", glassPanelSubtleText)}>
                in {areaDisplayName}
            </p>
          </div>
      </div>
      
      <section className={cn("flex-grow w-full", "bg-black/70 backdrop-blur-xl", "pt-0")}> {/* Main content panel starts */}
        <div className={cn(
            "sticky z-20", 
            SEARCH_FORM_STICKY_TOP_CLASS,
            "bg-black/50 backdrop-filter backdrop-blur-xl border-b border-white/10 py-3 sm:py-4"
          )}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <ShopSearchForm
              onSubmit={handleSearchFormSubmit}
              initialValues={shopSearchFormInitialValues}
              isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
              formInstanceId="shops-list-page"
              showDetectLocationButton={true}
            />
          </div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {isLoadingInitialData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
                {Array.from({ length: pageSize }).map((_, index) => (
                <ShopCardSkeleton key={index} className="bg-black/20 border-white/10" />
                ))}
            </div>
            ) : isError && shopsError ? (
            <Alert variant="destructive" className="my-6 bg-red-700/30 border-red-500/50 text-red-100 backdrop-blur-md">
                <Info className="h-5 w-5" />
                <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
                <AlertDescription>
                {shopsError instanceof APIError
                    ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
                    : 'An unexpected error occurred'
                }
                </AlertDescription>
                <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3 text-slate-100 border-slate-100/40 hover:bg-slate-50/10 active:bg-slate-50/20">
                Try Again
                </Button>
            </Alert>
            ) : allShops.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
                {allShops.map((shop) => (
                <ShopCard
                    key={shop.id}
                    shop={shop}
                    areaSlug={areaSlug}
                    className="bg-black/30 border-white/10 shadow-lg backdrop-blur-md text-white" 
                />
                ))}
            </div>
            ) : (
            <div className="text-center py-12 px-4">
                <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
                <h3 className={cn("text-xl sm:text-2xl font-semibold mb-2 text-shadow-medium", glassPanelText)}>No Shops Found</h3>
                <p className={cn("text-base max-w-md mx-auto text-shadow-soft", glassPanelSubtleText)}>
                No shops currently match "{subCategoryDisplayName}" in {areaDisplayName} with your selected filters.
                </p>
            </div>
            )}

            {!(isLoadingInitialData) && !isError && (
            <div ref={intersectionObserverRef} className="flex justify-center items-center py-8 min-h-[80px]">
                {hasNextPage && (
                <Button 
                    variant="outline" 
                    onClick={() => fetchNextPage()} 
                    disabled={isFetchingNextPage} 
                    className="px-6 py-3 text-base text-slate-100 border-slate-100/40 hover:bg-slate-50/10 active:bg-slate-50/20"
                >
                    {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
                </Button>
                )}
                {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && (
                <p className={cn("text-sm", glassPanelSubtleText)}>You've reached the end of the list.</p>
                )}
            </div>
            )}
        </div>
      </section>
    </div>
  );
}


export default function ShopsPageWrapper() {
  const params = useParams();
  const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : "";
  const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
  
  const { egyptBoundaryGeoJsonString, isLoadingEgyptBoundary } = useGeoData();
  const { data: allOperationalAreas, isLoading: isLoadingAllAreas } = useQuery<OperationalAreaDto[], APIError>({
    queryKey: ['operationalAreasForMap'],
    queryFn: fetchOperationalAreasForMap,
    staleTime: 1000 * 60 * 60, 
    refetchOnWindowFocus: false,
  });
  
  const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

  if (!areaSlug || !subCategorySlug) {
    return <LoadingFallback message="Loading page parameters..." glassEffect={true} />;
  }
  
  const currentAreaForMap = allOperationalAreas?.find(oa => oa.slug === areaSlug);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <HeroBillboard
          minHeight="min-h-screen"
          isMapMode={true}
          operationalAreas={allOperationalAreas || []}
          isLoadingMapData={isLoadingAllAreas || isLoadingEgyptBoundary}
          activeOperationalAreaSlug={areaSlug} 
          initialMapCenter={currentAreaForMap ? [currentAreaForMap.centroidLatitude, currentAreaForMap.centroidLongitude] : [26.8206, 30.8025]}
          initialMapZoom={currentAreaForMap ? (currentAreaForMap.defaultMapZoomLevel || 10) : 6}
          egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
        />
      </div>

      <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
        <div className="flex-1 flex flex-col w-full bg-black/70 backdrop-blur-2xl overflow-y-auto pointer-events-auto shadow-2xl"> 
          <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops...`} glassEffect={true} />}>
            <ShopsPageClient areaSlug={areaSlug} subCategorySlug={subCategorySlug} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback({ message = "Loading...", glassEffect = false }: { message?: string, glassEffect?: boolean }) {
  return (
    <div className={cn(
        "flex flex-col min-h-[calc(100vh-150px)] justify-center items-center text-center px-4",
        glassEffect ? "text-slate-200" : "bg-slate-50 text-slate-600" 
    )}>
      <Loader2 className={cn("h-12 w-12 animate-spin mb-4", glassEffect ? "text-emerald-400" : "text-orange-500")} />
      <p className="text-lg">{message}</p>
    </div>
  );
}
// // src/app/operational-areas/[areaSlug]/categories/[subCategorySlug]/shops/page.tsx
// // ^^^ RENAMED FILE PATH ^^^
// 'use client';

// import React, { useState, useEffect, useMemo, Suspense } from 'react';
// import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// import { useInView } from 'react-intersection-observer';
// import {
//     ShopDto,
//     PaginatedResponse,
//     FrontendShopQueryParameters,
//     APIError,
//     OperationalAreaDto, // Using OperationalAreaDto
//     SubCategoryDto
// } from '@/types/api';
// import { 
//     fetchShops, 
//     fetchOperationalAreasForMap, // To get current area details
//     fetchSubCategoriesByOperationalArea // Updated function
// } from '@/lib/apiClient';
// import ShopCard from '@/components/shop/ShopCard';
// import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Button } from '@/components/ui/button';
// import { useParams, useSearchParams, useRouter } from 'next/navigation';
// import ShopSearchForm from '@/components/search/ShopSearchForm';
// import { Info, Loader2, SearchX } from "lucide-react";
// import Link from 'next/link';
// import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';

// const DEFAULT_SEARCH_RADIUS_SHOPS_PAGE = 50000; // Consistent naming

// interface ShopsPageClientProps {
//   areaSlug: string; // UPDATED from citySlug
//   subCategorySlug: string;
// }

// function ShopsPageClient({ areaSlug, subCategorySlug }: ShopsPageClientProps) {
//   const router = useRouter();
//   const queryParamsFromUrl = useSearchParams();
//   const {
//     currentLocation: contextLocation,
//     setCurrentLocation: setContextLocation,
//     isLoading: isLoadingContextLocation,
//   } = useUserGeoLocation();

//   useEffect(() => {
//     const urlLat = queryParamsFromUrl.get('userLatitude');
//     const urlLon = queryParamsFromUrl.get('userLongitude');
//     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

//     if (urlLat && urlLon) {
//       const lat = parseFloat(urlLat);
//       const lon = parseFloat(urlLon);
//       const radius = urlRadius ? parseInt(urlRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE);
//       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
//          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
//            setContextLocation(
//              { latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 
//              'url_param'
//            );
//          }
//       }
//     }
//   }, [queryParamsFromUrl, contextLocation, setContextLocation]);

//   // Fetch details for the current Operational Area
//   const { data: operationalAreaDetails, isLoading: isLoadingAreaDetails } = useQuery<OperationalAreaDto | null, APIError>({
//     queryKey: ['operationalAreaDetails', areaSlug] as const,
//     queryFn: async (): Promise<OperationalAreaDto | null> => {
//       if (!areaSlug) return null;
//       try {
//         // For now, fetch all and find. A dedicated endpoint would be better.
//         const areas = await fetchOperationalAreasForMap(); 
//         return areas.find(oa => oa.slug === areaSlug) || null;
//       } catch (e) {
//         if (e instanceof APIError && e.status === 404) return null;
//         throw e;
//       }
//     },
//     enabled: !!areaSlug,
//     staleTime: 1000 * 60 * 10, // Cache for 10 mins
//     refetchOnWindowFocus: false
//   });

//   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | null, APIError>({
//     queryKey: ['subCategoryDetails', areaSlug, subCategorySlug] as const,
//     queryFn: async (): Promise<SubCategoryDto | null> => {
//       if (!areaSlug || !subCategorySlug) return null;
//       try {
//         const subCategories = await fetchSubCategoriesByOperationalArea(areaSlug); // UPDATED
//         const foundSubCategory = subCategories.find(sc => sc.slug === subCategorySlug);
//         return foundSubCategory || null;
//       } catch (e) {
//         if (e instanceof APIError && e.status === 404) return null;
//         throw e;
//       }
//     },
//     enabled: !!areaSlug && !!subCategorySlug && !!operationalAreaDetails, // Enable if area details are loaded
//     staleTime: 1000 * 60 * 10,
//     refetchOnWindowFocus: false,
//     retry: (failureCount, error) => {
//       if (error instanceof APIError && error.status === 404) return false;
//       return failureCount < 3;
//     }
//   });

//   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'>>(() => {
//     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'> = {};
//     // Initialize from URL params as before
//     const nameParam = queryParamsFromUrl.get('name');
//     const servicesParam = queryParamsFromUrl.get('services');
//     const sortByParam = queryParamsFromUrl.get('sortBy');
//     const latParam = queryParamsFromUrl.get('userLatitude');
//     const lonParam = queryParamsFromUrl.get('userLongitude');
//     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

//     if (nameParam) params.name = nameParam;
//     if (servicesParam) params.services = servicesParam;

//     if (latParam && lonParam) {
//         const lat = parseFloat(latParam);
//         const lon = parseFloat(lonParam);
//         if(!isNaN(lat) && !isNaN(lon)) {
//             params.userLatitude = lat;
//             params.userLongitude = lon;
//             params.radiusInMeters = radiusParam ? parseInt(radiusParam, 10) : (contextLocation?.radiusInMeters || operationalAreaDetails?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE);
//             params.sortBy = sortByParam || 'distance_asc';
//         }
//     } else if (contextLocation) { // If no location in URL, but context has one
//         params.userLatitude = contextLocation.latitude;
//         params.userLongitude = contextLocation.longitude;
//         params.radiusInMeters = contextLocation.radiusInMeters || operationalAreaDetails?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
//         params.sortBy = sortByParam || 'distance_asc';
//     } else if (operationalAreaDetails) { // Fallback to operational area centroid if no other location
//         params.userLatitude = operationalAreaDetails.centroidLatitude;
//         params.userLongitude = operationalAreaDetails.centroidLongitude;
//         params.radiusInMeters = operationalAreaDetails.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
//         params.sortBy = sortByParam || 'distance_asc'; // Or 'relevance_desc' if no location context
//     } else if (sortByParam) {
//         params.sortBy = sortByParam;
//     }
//     return params;
//   });
  
//   // Update searchFilters if operationalAreaDetails (and its default radius) loads after initial state set
//   useEffect(() => {
//     if (operationalAreaDetails && !searchFilters.userLatitude && !searchFilters.userLongitude) {
//         // If no location is set in filters yet, and area details are available,
//         // initialize with area's centroid and default radius.
//         setSearchFilters(prev => ({
//             ...prev,
//             userLatitude: prev.userLatitude ?? operationalAreaDetails.centroidLatitude,
//             userLongitude: prev.userLongitude ?? operationalAreaDetails.centroidLongitude,
//             radiusInMeters: prev.radiusInMeters ?? operationalAreaDetails.defaultSearchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_SHOPS_PAGE,
//             sortBy: prev.sortBy ?? 'distance_asc' // Default to distance if using area centroid
//         }));
//     }
//   }, [operationalAreaDetails, searchFilters.userLatitude, searchFilters.userLongitude]);


//   const [pageSize] = useState(9);

//   const shopsQueryKey = useMemo(() =>
//     ['shops', areaSlug, subCategorySlug, { ...searchFilters, pageSize }] as const, // UPDATED: areaSlug
//     [areaSlug, subCategorySlug, searchFilters, pageSize]
//   );

//   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
//     queryKey: shopsQueryKey,
//     queryFn: ({ pageParam = 1 }) =>
//       fetchShops(areaSlug, subCategorySlug, { // UPDATED: areaSlug
//         ...searchFilters,
//         pageNumber: pageParam,
//         pageSize: pageSize
//       }),
//     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) =>
//         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
//     enabled: !!areaSlug && !!subCategorySlug && !isLoadingAreaDetails && !isLoadingSubCategory, // UPDATED
//     staleTime: 1 * 60 * 1000,
//     refetchOnWindowFocus: false,
//   });

//   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
//   const { error: shopsError, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isLoadingShops, isFetching: isFetchingShopsQuery, isError, refetch } = queryResult;
//   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);
//   const isLoadingInitialData = (isLoadingAreaDetails || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;


//   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize' | 'areaSlug'>) => {
//     const combinedFilters = { ...searchFilters, ...newFilters }; // Merge to keep existing location if not in newFilters
//     setSearchFilters(combinedFilters);

//     if (combinedFilters.userLatitude !== undefined && combinedFilters.userLongitude !== undefined) {
//         setContextLocation({
//             latitude: combinedFilters.userLatitude,
//             longitude: combinedFilters.userLongitude,
//             radiusInMeters: combinedFilters.radiusInMeters || contextLocation?.radiusInMeters || operationalAreaDetails?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE,
//             timestamp: Date.now()
//         }, 'manual'); 
//     }

//     const newUrlSearchParams = new URLSearchParams();
//     if (combinedFilters.name) newUrlSearchParams.set('name', combinedFilters.name);
//     if (combinedFilters.services) newUrlSearchParams.set('services', combinedFilters.services);
//     if (combinedFilters.sortBy) newUrlSearchParams.set('sortBy', combinedFilters.sortBy);
//     if (combinedFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', combinedFilters.userLatitude.toString());
//     if (combinedFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', combinedFilters.userLongitude.toString());
//     if (combinedFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', combinedFilters.radiusInMeters.toString());

//     // UPDATED URL Structure
//     const newUrl = `/operational-areas/${areaSlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
//     router.push(newUrl, { scroll: false });
//   };

//   const { ref: intersectionObserverRef, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

//   useEffect(() => {
//     if (inView && hasNextPage && !isFetchingNextPage) {
//       fetchNextPage();
//     }
//   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

//   const subCategoryDisplayName = useMemo(() => {
//     if (!subCategoryDetails) return subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//     return subCategoryDetails.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//   }, [subCategoryDetails, subCategorySlug]);

//   const areaDisplayName = useMemo(() => { // UPDATED
//     if (!operationalAreaDetails) return areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//     return operationalAreaDetails.nameEn || areaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
//   }, [operationalAreaDetails, areaSlug]);

//   let conceptPageSlugForBreadcrumb = ""; 
//   let conceptDisplayNameForBreadcrumb = ""; 
//   if (subCategoryDetails) {
//     if (subCategoryDetails.concept === 1) { conceptPageSlugForBreadcrumb = "maintenance-services"; conceptDisplayNameForBreadcrumb = "Maintenance"; }
//     else if (subCategoryDetails.concept === 2) { conceptPageSlugForBreadcrumb = "auto-parts"; conceptDisplayNameForBreadcrumb = "Marketplace"; }
//   }

//   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
//         name: searchFilters.name,
//         services: searchFilters.services,
//         sortBy: searchFilters.sortBy,
//         userLatitude: searchFilters.userLatitude,
//         userLongitude: searchFilters.userLongitude,
//         radiusInMeters: searchFilters.radiusInMeters,
//     }), [searchFilters]);

//   return (
//     <div className="flex flex-col min-h-screen bg-slate-50">
//       {/* --- BREADCRUMB UPDATED --- */}
//       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
//         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
//           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
//           <li><span className="text-slate-400">»</span></li>
//           <li>
//             <Link
//               href={`/?area=${areaSlug}`} // Link back to homepage with area context
//               className="hover:text-orange-600 hover:underline"
//               aria-label={`Back to ${areaDisplayName} overview on homepage`}
//             >
//               {areaDisplayName}
//             </Link>
//           </li>
//           {conceptPageSlugForBreadcrumb && conceptDisplayNameForBreadcrumb && (
//             <>
//               <li><span className="text-slate-400">»</span></li>
//               {/* Link to the high-level concept page for the current operational area */}
//               <li><Link href={`/operational-areas/${areaSlug}/${conceptPageSlugForBreadcrumb}`} className="hover:text-orange-600 hover:underline">{conceptDisplayNameForBreadcrumb}</Link></li>
//             </>
//           )}
//           <li><span className="text-slate-400">»</span></li>
//           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
//         </ol>
//       </nav>

//       <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
//         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
//             {subCategoryDisplayName} <span className="font-normal text-slate-600">in {areaDisplayName}</span>
//         </h1>
//         <p className="text-sm text-slate-500 mb-6">
//             Browse and filter shops offering {subCategoryDisplayName.toLowerCase()} services.
//         </p>
//       </div>

//       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-6 md:pb-8">
//         <div className="mb-6 sticky top-[calc(var(--header-height,60px)+2.6rem)] bg-slate-50/80 backdrop-blur-sm py-3 z-10 rounded-b-lg">
//           <ShopSearchForm
//             onSubmit={handleSearchFormSubmit}
//             initialValues={shopSearchFormInitialValues}
//             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
//             formInstanceId="shops-list"
//             showDetectLocationButton={true} // Enable if user might want to re-detect location on this page
//           />
//         </div>

//         {isLoadingInitialData ? (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
//             {Array.from({ length: pageSize }).map((_, index) => (
//               <ShopCardSkeleton key={index} />
//             ))}
//           </div>
//         ) : isError && shopsError ? (
//           <Alert variant="destructive" className="my-6">
//             <Info className="h-5 w-5" />
//             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
//             <AlertDescription>
//               {shopsError instanceof APIError
//                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
//                 : 'An unexpected error occurred'
//               }
//             </AlertDescription>
//             <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
//               Try Again
//             </Button>
//           </Alert>
//         ) : allShops.length > 0 ? (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
//             {allShops.map((shop) => (
//               <ShopCard
//                 key={shop.id}
//                 shop={shop}
//                 areaSlug={areaSlug} // UPDATED: Pass areaSlug
//                 // subCategorySlug is no longer needed as shop.categorySlug can be used in ShopCard
//               />
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-12 px-4">
//             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
//             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
//             <p className="text-base text-slate-500 max-w-md mx-auto">
//               No shops currently match "{subCategoryDisplayName}" in {areaDisplayName} with your selected filters.
//             </p>
//           </div>
//         )}

//         {!(isLoadingInitialData) && !isError && (
//           <div ref={intersectionObserverRef} className="flex justify-center items-center py-8 min-h-[80px]">
//             {hasNextPage && (
//               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
//                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
//               </Button>
//             )}
//             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && (
//               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
//             )}
//           </div>
//         )}
//       </section>
//     </div>
//   );
// }

// // Main page component that gets route params
// export default function ShopsPage() {
//   const params = useParams();
//   // Ensure params are strings
//   const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : ""; // UPDATED
//   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";

//   if (!areaSlug || !subCategorySlug) {
//     return <LoadingFallback message="Loading page parameters..." />;
//   }

//   return (
//     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${areaSlug.replace(/-/g, ' ')}...`} />}>
//       <ShopsPageClient areaSlug={areaSlug} subCategorySlug={subCategorySlug} />
//     </Suspense>
//   );
// }

// function LoadingFallback({ message = "Loading..." }: { message?: string }) {
//   return (
//     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
//       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
//       <p className="text-slate-600 text-lg">{message}</p>
//     </div>
//   );
// }
// // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // 'use client';

// // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // import { useInView } from 'react-intersection-observer';
// // import {
// //     ShopDto,
// //     PaginatedResponse,
// //     FrontendShopQueryParameters,
// //     APIError,
// //     CityDto,
// //     SubCategoryDto
// // } from '@/types/api';
// // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // import ShopCard from '@/components/shop/ShopCard';
// // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // import { Button } from '@/components/ui/button';
// // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // import { Info, Loader2, SearchX } from "lucide-react";
// // import Link from 'next/link';
// // // Updated context import and type
// // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';

// // const DEFAULT_SEARCH_RADIUS_SHOPS_PAGE = 500000; // Added definition based on usage

// // interface ShopsPageClientProps {
// //   citySlug: string;
// //   subCategorySlug: string;
// // }

// // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// //   const router = useRouter();
// //   const queryParamsFromUrl = useSearchParams();
// //   const {
// //     currentLocation: contextLocation,         // UPDATED from currentUserLocation
// //     setCurrentLocation: setContextLocation,     // UPDATED from setCurrentUserLocation
// //     isLoading: isLoadingContextLocation,        // UPDATED (name remains, but source is new context)
// //     // error: contextGeoError, // (If you need error from context)
// //     // clearError: clearContextGeoError, // (If you need to clear context error)
// //     // attemptBrowserGpsLocation, // (If you need to trigger GPS detection)
// //   } = useUserGeoLocation(); // UPDATED from useSimpleLocation

// //   useEffect(() => {
// //     const urlLat = queryParamsFromUrl.get('userLatitude');
// //     const urlLon = queryParamsFromUrl.get('userLongitude');
// //     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

// //     if (urlLat && urlLon) {
// //       const lat = parseFloat(urlLat);
// //       const lon = parseFloat(urlLon);
// //       const radius = urlRadius ? parseInt(urlRadius, 10) : (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE); // Used defined const
// //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// //            // When calling the new setContextLocation, a 'source' is required.
// //            // Assuming this sync from URL params is a 'url_param' source.
// //            setContextLocation(
// //              { 
// //                 latitude: lat, 
// //                 longitude: lon, 
// //                 radiusInMeters: radius, 
// //                 timestamp: Date.now() 
// //                 // source: 'url_param' // Adding source
// //              }, 
// //              'url_param' // Pass source here
// //            );
// //          }
// //       }
// //     }
// //   // Using your original dependencies, but setContextLocation should ideally be stable
// //   }, [queryParamsFromUrl, contextLocation, setContextLocation]);

// //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | null, APIError>({
// //     queryKey: ['cityDetails', citySlug] as const,
// //     queryFn: async (): Promise<CityDto | null> => {
// //       if (!citySlug) return null;
// //       try {
// //         const cities = await fetchCities();
// //         return cities.find(c => c.slug === citySlug) || null;
// //       } catch (e) {
// //         if (e instanceof APIError && e.status === 404) return null;
// //         throw e;
// //       }
// //     },
// //     enabled: !!citySlug,
// //     staleTime: 1000 * 60 * 10,
// //     refetchOnWindowFocus: false
// //   });

// //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | null, APIError>({
// //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug] as const,
// //     queryFn: async (): Promise<SubCategoryDto | null> => {
// //       if (!citySlug || !subCategorySlug) return null;
// //       try {
// //         const subCategories = await fetchSubCategoriesByCity(citySlug);
// //         const foundSubCategory = subCategories.find(sc => sc.slug === subCategorySlug);
// //         return foundSubCategory || null;
// //       } catch (e) {
// //         if (e instanceof APIError && e.status === 404) return null;
// //         throw e;
// //       }
// //     },
// //     enabled: !!citySlug && !!subCategorySlug && !!cityDetails, // Added !!cityDetails
// //     staleTime: 1000 * 60 * 10,
// //     refetchOnWindowFocus: false,
// //     retry: (failureCount, error) => {
// //       if (error instanceof APIError && error.status === 404) return false;
// //       return failureCount < 3; // Your original retry count
// //     }
// //   });

// //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// //     const nameParam = queryParamsFromUrl.get('name');
// //     const servicesParam = queryParamsFromUrl.get('services');
// //     const sortByParam = queryParamsFromUrl.get('sortBy');
// //     const latParam = queryParamsFromUrl.get('userLatitude');
// //     const lonParam = queryParamsFromUrl.get('userLongitude');
// //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// //     if (nameParam) params.name = nameParam;
// //     if (servicesParam) params.services = servicesParam;

// //     if (latParam && lonParam) {
// //         const lat = parseFloat(latParam);
// //         const lon = parseFloat(lonParam);
// //         if(!isNaN(lat) && !isNaN(lon)) {
// //             params.userLatitude = lat;
// //             params.userLongitude = lon;
// //             if (radiusParam && !isNaN(parseInt(radiusParam, 10))) {
// //                 params.radiusInMeters = parseInt(radiusParam, 10);
// //             } else {
// //                 params.radiusInMeters = contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE;
// //             }
// //             params.sortBy = sortByParam || 'distance_asc';
// //         }
// //     } else if (contextLocation) {
// //         params.userLatitude = contextLocation.latitude;
// //         params.userLongitude = contextLocation.longitude;
// //         params.radiusInMeters = contextLocation.radiusInMeters;
// //         params.sortBy = sortByParam || 'distance_asc';
// //     } else if (sortByParam) {
// //         params.sortBy = sortByParam;
// //     }
// //     return params;
// //   });

// //   const [pageSize] = useState(9);

// //   const shopsQueryKey = useMemo(() =>
// //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const,
// //     [citySlug, subCategorySlug, searchFilters, pageSize]
// //   );

// //   // Using your original useInfiniteQuery structure
// //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
// //     queryKey: shopsQueryKey,
// //     queryFn: ({ pageParam = 1 }) =>
// //       fetchShops(citySlug, subCategorySlug, {
// //         ...searchFilters,
// //         pageNumber: pageParam,
// //         pageSize: pageSize
// //       }),
// //     // initialPageParam: 1, // This is for v5. Your original didn't have it, v4 infers.
// //                          // If you are on v5, this is needed. If v4, remove.
// //                          // Assuming you are on v4 or it worked without it:
// //     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) =>
// //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// //     enabled: !!citySlug && !!subCategorySlug && !isLoadingCity && !isLoadingSubCategory,
// //     // keepPreviousData: true, // in v5, this is `placeholderData: keepPreviousData` or just remove if not needed
// //     staleTime: 1 * 60 * 1000,
// //     refetchOnWindowFocus: false,
// //   });

// //   // Using your original data destructuring and cast
// //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;

// //   const {
// //     error: shopsError,
// //     fetchNextPage,
// //     hasNextPage,
// //     isFetchingNextPage,
// //     isLoading: isLoadingShops,
// //     isFetching: isFetchingShopsQuery,
// //     isError,
// //     refetch
// //   } = queryResult;

// //   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);

// //   // isLoadingInitialData using the updated context loading state name
// //   const isLoadingInitialData = (isLoadingCity || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;

// //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// //     setSearchFilters(newFilters);

// //     // If newFilters contain location, update the context
// //     if (newFilters.userLatitude !== undefined && newFilters.userLongitude !== undefined) {
// //         setContextLocation({
// //             latitude: newFilters.userLatitude,
// //             longitude: newFilters.userLongitude,
// //             radiusInMeters: newFilters.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS_SHOPS_PAGE,
// //             timestamp: Date.now()
// //             // source: 'manual' // Adding source
// //         }, 'manual'); // Pass source here
// //     }

// //     const newUrlSearchParams = new URLSearchParams();
// //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
// //     router.push(newUrl, { scroll: false });
// //   };

// //   const { ref: intersectionObserverRef, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

// //   useEffect(() => {
// //     if (inView && hasNextPage && !isFetchingNextPage) {
// //       fetchNextPage();
// //     }
// //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// //   const subCategoryDisplayName = useMemo(() => {
// //     if (!subCategoryDetails) return subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //     return subCategoryDetails.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //   }, [subCategoryDetails, subCategorySlug]);

// //   const cityDisplayName = useMemo(() => {
// //     if (!cityDetails) return citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //     return cityDetails.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// //   }, [cityDetails, citySlug]);

// //   let conceptPageSlugForBreadcrumb = ""; // Renamed from conceptPageSlug to avoid conflict
// //   let conceptDisplayNameForBreadcrumb = ""; // Renamed
// //   if (subCategoryDetails) {
// //     if (subCategoryDetails.concept === 1) { conceptPageSlugForBreadcrumb = "maintenance-services"; conceptDisplayNameForBreadcrumb = "Maintenance"; }
// //     else if (subCategoryDetails.concept === 2) { conceptPageSlugForBreadcrumb = "auto-parts"; conceptDisplayNameForBreadcrumb = "Marketplace"; }
// //   }

// //   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
// //         name: searchFilters.name,
// //         services: searchFilters.services,
// //         sortBy: searchFilters.sortBy,
// //         userLatitude: searchFilters.userLatitude,
// //         userLongitude: searchFilters.userLongitude,
// //         radiusInMeters: searchFilters.radiusInMeters,
// //     }), [searchFilters]);

// //   return (
// //     <div className="flex flex-col min-h-screen bg-slate-50">
// //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
// //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// //           <li><span className="text-slate-400">»</span></li>
// //           <li>
// //             <Link
// //               href={`/?city=${citySlug}`}
// //               className="hover:text-orange-600 hover:underline"
// //               aria-label={`Back to ${cityDisplayName} overview on homepage`}
// //             >
// //               {cityDisplayName}
// //             </Link>
// //           </li>
// //           {conceptPageSlugForBreadcrumb && conceptDisplayNameForBreadcrumb && ( // Use renamed vars
// //             <> {/* Corrected typo here */}
// //               <li><span className="text-slate-400">»</span></li>
// //               <li><Link href={`/cities/${citySlug}/${conceptPageSlugForBreadcrumb}`} className="hover:text-orange-600 hover:underline">{conceptDisplayNameForBreadcrumb}</Link></li>
// //             </>
// //           )}
// //           <li><span className="text-slate-400">»</span></li>
// //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// //         </ol>
// //       </nav>

// //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
// //         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
// //             {subCategoryDisplayName} <span className="font-normal text-slate-600">in {cityDisplayName}</span>
// //         </h1>
// //         <p className="text-sm text-slate-500 mb-6">
// //             Browse and filter shops offering {subCategoryDisplayName.toLowerCase()} services.
// //         </p>
// //       </div>

// //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-6 md:pb-8">
// //         <div className="mb-6 sticky top-[calc(var(--header-height,60px)+2.6rem)] bg-slate-50/80 backdrop-blur-sm py-3 z-10 rounded-b-lg">
// //           <ShopSearchForm
// //             onSubmit={handleSearchFormSubmit}
// //             initialValues={shopSearchFormInitialValues}
// //             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
// //             formInstanceId="shops-list"
// //             showDetectLocationButton={false} // On this page, location is usually from context or URL
// //           />
// //         </div>

// //         {isLoadingInitialData ? (
// //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// //             {Array.from({ length: pageSize }).map((_, index) => (
// //               <ShopCardSkeleton key={index} />
// //             ))}
// //           </div>
// //         ) : isError && shopsError ? (
// //           <Alert variant="destructive" className="my-6">
// //             <Info className="h-5 w-5" />
// //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// //             <AlertDescription>
// //               {shopsError instanceof APIError
// //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// //                 : 'An unexpected error occurred'
// //               }
// //             </AlertDescription>
// //             <Button
// //               onClick={() => refetch()}
// //               variant="outline"
// //               size="sm"
// //               className="mt-3"
// //             >
// //               Try Again
// //             </Button>
// //           </Alert>
// //         ) : allShops.length > 0 ? (
// //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// //             {allShops.map((shop) => (
// //               <ShopCard
// //                 key={shop.id}
// //                 shop={shop}
// //                 citySlug={citySlug}
// //                 subCategorySlug={subCategorySlug}
// //               />
// //             ))}
// //           </div>
// //         ) : (
// //           <div className="text-center py-12 px-4">
// //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// //             <p className="text-base text-slate-500 max-w-md mx-auto">
// //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// //             </p>
// //           </div>
// //         )}

// //         {!(isLoadingInitialData) && !isError && (
// //           <div ref={intersectionObserverRef} className="flex justify-center items-center py-8 min-h-[80px]">
// //             {hasNextPage && (
// //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// //               </Button>
// //             )}
// //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && (
// //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// //             )}
// //           </div>
// //         )}
// //       </section>
// //     </div>
// //   );
// // }

// // export default function ShopsPage() {
// //   const params = useParams();
// //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// //   if (!citySlug || !subCategorySlug) {
// //     return <LoadingFallback message="Loading page parameters..." />;
// //   }

// //   return (
// //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
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
// // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // 'use client';

// // // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // // import { useInView } from 'react-intersection-observer';
// // // import { 
// // //     ShopDto, 
// // //     PaginatedResponse, 
// // //     FrontendShopQueryParameters,
// // //     APIError,
// // //     CityDto,
// // //     SubCategoryDto
// // // } from '@/types/api';
// // // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // import ShopCard from '@/components/shop/ShopCard'; 
// // // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // import { Button } from '@/components/ui/button';
// // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // import { Info, Loader2, SearchX } from "lucide-react";
// // // import Link from 'next/link';
// // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/UserGeoLocationContext';

// // // interface ShopsPageClientProps {
// // //   citySlug: string;
// // //   subCategorySlug: string;
// // // }

// // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // //   const router = useRouter();
// // //   const queryParamsFromUrl = useSearchParams();
// // //   const { 
// // //     currentUserLocation: contextLocation, 
// // //     setCurrentUserLocation: setContextLocation,
// // //     isLoading: isLoadingContextLocation 
// // //   } = useSimpleLocation();

// // //   useEffect(() => {
// // //     const urlLat = queryParamsFromUrl.get('userLatitude');
// // //     const urlLon = queryParamsFromUrl.get('userLongitude');
// // //     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

// // //     if (urlLat && urlLon) {
// // //       const lat = parseFloat(urlLat);
// // //       const lon = parseFloat(urlLon);
// // //       const radius = urlRadius ? parseInt(urlRadius) : (contextLocation?.radiusInMeters || 500000);
// // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() });
// // //          }
// // //       }
// // //     }
// // //   }, [queryParamsFromUrl, contextLocation, setContextLocation]);

// // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | null, APIError>({
// // //     queryKey: ['cityDetails', citySlug] as const,
// // //     queryFn: async (): Promise<CityDto | null> => {
// // //       if (!citySlug) return null;
// // //       try {
// // //         const cities = await fetchCities();
// // //         return cities.find(c => c.slug === citySlug) || null;
// // //       } catch (e) {
// // //         if (e instanceof APIError && e.status === 404) return null;
// // //         throw e;
// // //       }
// // //     },
// // //     enabled: !!citySlug, 
// // //     staleTime: 1000 * 60 * 10, 
// // //     refetchOnWindowFocus: false 
// // //   });

// // //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | null, APIError>({
// // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug] as const,
// // //     queryFn: async (): Promise<SubCategoryDto | null> => {
// // //       if (!citySlug || !subCategorySlug) return null;
// // //       try {
// // //         const subCategories = await fetchSubCategoriesByCity(citySlug);
// // //         const foundSubCategory = subCategories.find(sc => sc.slug === subCategorySlug);
// // //         return foundSubCategory || null;
// // //       } catch (e) {
// // //         if (e instanceof APIError && e.status === 404) return null;
// // //         throw e;
// // //       }
// // //     },
// // //     enabled: !!citySlug && !!subCategorySlug, 
// // //     staleTime: 1000 * 60 * 10, 
// // //     refetchOnWindowFocus: false,
// // //     retry: (failureCount, error) => {
// // //       if (error instanceof APIError && error.status === 404) return false;
// // //       return failureCount < 3;
// // //     }
// // //   });
  
// // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// // //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// // //     const nameParam = queryParamsFromUrl.get('name');
// // //     const servicesParam = queryParamsFromUrl.get('services');
// // //     const sortByParam = queryParamsFromUrl.get('sortBy');
// // //     const latParam = queryParamsFromUrl.get('userLatitude');
// // //     const lonParam = queryParamsFromUrl.get('userLongitude');
// // //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// // //     if (nameParam) params.name = nameParam;
// // //     if (servicesParam) params.services = servicesParam;

// // //     if (latParam && lonParam) {
// // //         const lat = parseFloat(latParam);
// // //         const lon = parseFloat(lonParam);
// // //         if(!isNaN(lat) && !isNaN(lon)) {
// // //             params.userLatitude = lat;
// // //             params.userLongitude = lon;
// // //             if (radiusParam && !isNaN(parseInt(radiusParam, 10))) {
// // //                 params.radiusInMeters = parseInt(radiusParam, 10);
// // //             } else {
// // //                 params.radiusInMeters = contextLocation?.radiusInMeters || 500000;
// // //             }
// // //             params.sortBy = sortByParam || 'distance_asc';
// // //         }
// // //     } else if (contextLocation) {
// // //         params.userLatitude = contextLocation.latitude;
// // //         params.userLongitude = contextLocation.longitude;
// // //         params.radiusInMeters = contextLocation.radiusInMeters;
// // //         params.sortBy = sortByParam || 'distance_asc';
// // //     } else if (sortByParam) {
// // //         params.sortBy = sortByParam;
// // //     }
// // //     return params;
// // //   });

// // //   const [pageSize] = useState(9);

// // //   const shopsQueryKey = useMemo(() => 
// // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // //   );

// // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
// // //     queryKey: shopsQueryKey, 
// // //     queryFn: ({ pageParam = 1 }) => 
// // //       fetchShops(citySlug, subCategorySlug, { 
// // //         ...searchFilters, 
// // //         pageNumber: pageParam,
// // //         pageSize: pageSize 
// // //       }),
// // //     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // //     enabled: !!citySlug && !!subCategorySlug && !isLoadingCity && !isLoadingSubCategory,
// // //     keepPreviousData: true,    
// // //     staleTime: 1 * 60 * 1000, 
// // //     refetchOnWindowFocus: false,
// // //   });

// // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
  
// // //   const {
// // //     error: shopsError,
// // //     fetchNextPage,
// // //     hasNextPage,
// // //     isFetchingNextPage,
// // //     isLoading: isLoadingShops, 
// // //     isFetching: isFetchingShopsQuery, 
// // //     isError,
// // //     refetch
// // //   } = queryResult;

// // //   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);

// // //   const isLoadingInitialData = (isLoadingCity || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;

// // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // //     setSearchFilters(newFilters); 

// // //     const newUrlSearchParams = new URLSearchParams();
// // //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// // //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// // //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// // //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// // //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// // //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// // //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
// // //     router.push(newUrl, { scroll: false });
// // //   };

// // //   const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

// // //   useEffect(() => {
// // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // //       fetchNextPage();
// // //     }
// // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // //   const subCategoryDisplayName = useMemo(() => {
// // //     if (!subCategoryDetails) return subCategorySlug.replace(/-/g, ' ');
// // //     return subCategoryDetails.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' ');
// // //   }, [subCategoryDetails, subCategorySlug]);

// // //   const cityDisplayName = useMemo(() => {
// // //     if (!cityDetails) return citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // //     return cityDetails.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // //   }, [cityDetails, citySlug]);
  
// // //   let conceptPageSlug = "";
// // //   let conceptDisplayName = "";
// // //   if (subCategoryDetails) { // Check if subCategoryDetails is not null
// // //     if (subCategoryDetails.concept === 1) { conceptPageSlug = "maintenance-services"; conceptDisplayName = "Maintenance"; } 
// // //     else if (subCategoryDetails.concept === 2) { conceptPageSlug = "auto-parts"; conceptDisplayName = "Marketplace"; }
// // //   }


// // //   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
// // //         name: searchFilters.name,
// // //         services: searchFilters.services,
// // //         sortBy: searchFilters.sortBy,
// // //         userLatitude: searchFilters.userLatitude,
// // //         userLongitude: searchFilters.userLongitude,
// // //         radiusInMeters: searchFilters.radiusInMeters,
// // //     }), [searchFilters]);

// // //   return (
// // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
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
// // //           {conceptPageSlug && (
// // //             <>
// // //               <li><span className="text-slate-400">»</span></li>
// // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // //             </>
// // //           )}
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// // //         </ol>
// // //       </nav>
      
// // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
// // //         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
// // //             {subCategoryDisplayName} <span className="font-normal text-slate-600">in {cityDisplayName}</span>
// // //         </h1>
// // //         <p className="text-sm text-slate-500 mb-6">
// // //             Browse and filter shops offering {subCategoryDisplayName.toLowerCase()} services.
// // //         </p>
// // //       </div>

// // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-6 md:pb-8">
// // //         <div className="mb-6 sticky top-[calc(var(--header-height,60px)+2.6rem)] bg-slate-50/80 backdrop-blur-sm py-3 z-10 rounded-b-lg"> 
// // //           <ShopSearchForm 
// // //             onSubmit={handleSearchFormSubmit}
// // //             initialValues={shopSearchFormInitialValues} 
// // //             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
// // //             formInstanceId="shops-list" 
// // //             showDetectLocationButton={false} 
// // //           />
// // //         </div>

// // //         {isLoadingInitialData ? (
// // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// // //             {Array.from({ length: pageSize }).map((_, index) => (
// // //               <ShopCardSkeleton key={index} />
// // //             ))}
// // //           </div>
// // //         ) : isError && shopsError ? ( 
// // //           <Alert variant="destructive" className="my-6">
// // //             <Info className="h-5 w-5" />
// // //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// // //             <AlertDescription>
// // //               {shopsError instanceof APIError 
// // //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// // //                 : 'An unexpected error occurred'
// // //               }
// // //             </AlertDescription>
// // //             <Button 
// // //               onClick={() => refetch()}
// // //               variant="outline" 
// // //               size="sm" 
// // //               className="mt-3"
// // //             >
// // //               Try Again
// // //             </Button>
// // //           </Alert>
// // //         ) : allShops.length > 0 ? (
// // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// // //             {allShops.map((shop) => (
// // //               <ShopCard 
// // //                 key={shop.id} 
// // //                 shop={shop} 
// // //                 citySlug={citySlug}
// // //                 subCategorySlug={subCategorySlug}
// // //               />
// // //             ))}
// // //           </div>
// // //         ) : (
// // //           <div className="text-center py-12 px-4">
// // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// // //             </p>
// // //           </div>
// // //         )}

// // //         {!(isLoadingInitialData) && !isError && (
// // //           <div ref={ref} className="flex justify-center items-center py-8 min-h-[80px]">
// // //             {hasNextPage && (
// // //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// // //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// // //               </Button>
// // //             )}
// // //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && ( 
// // //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// // //             )}
// // //           </div>
// // //         )}
// // //       </section>
// // //     </div>
// // //   );
// // // }

// // // export default function ShopsPage() {
// // //   const params = useParams();
// // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// // //   if (!citySlug || !subCategorySlug) {
// // //     return <LoadingFallback message="Loading page parameters..." />;
// // //   }

// // //   return (
// // //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
// // //     </Suspense>
// // //   );
// // // }

// // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // //   return (
// // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // //       <p className="text-slate-600 text-lg">{message}</p>
// // //     </div>
// // //   );
// // // }
// // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // // 'use client';

// // // // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // // // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // // // import { useInView } from 'react-intersection-observer';
// // // // import { 
// // // //     ShopDto, 
// // // //     PaginatedResponse, 
// // // //     FrontendShopQueryParameters,
// // // //     APIError,
// // // //     CityDto,
// // // //     SubCategoryDto
// // // // } from '@/types/api';
// // // // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // import ShopCard from '@/components/shop/ShopCard'; 
// // // // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // // // // Removed HeroBillboard import
// // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // import { Button } from '@/components/ui/button';
// // // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // import { Info, Loader2, SearchX } from "lucide-react";
// // // // import Link from 'next/link';
// // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // interface ShopsPageClientProps {
// // // //   citySlug: string;
// // // //   subCategorySlug: string;
// // // // }

// // // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // // //   const router = useRouter();
// // // //   const queryParamsFromUrl = useSearchParams();
// // // //   const { 
// // // //     currentUserLocation: contextLocation, 
// // // //     setCurrentUserLocation: setContextLocation,
// // // //     isLoading: isLoadingContextLocation 
// // // //   } = useSimpleLocation();

// // // //   useEffect(() => {
// // // //     const urlLat = queryParamsFromUrl.get('userLatitude');
// // // //     const urlLon = queryParamsFromUrl.get('userLongitude');
// // // //     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

// // // //     if (urlLat && urlLon) {
// // // //       const lat = parseFloat(urlLat);
// // // //       const lon = parseFloat(urlLon);
// // // //       const radius = urlRadius ? parseInt(urlRadius) : (contextLocation?.radiusInMeters || 500000);
// // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() });
// // // //          }
// // // //       }
// // // //     }
// // // //   }, [queryParamsFromUrl, contextLocation, setContextLocation]);

// // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // //     queryKey: ['cityDetails', citySlug] as const,
// // // //     queryFn: async () => {
// // // //       if (!citySlug) return undefined;
// // // //       const cities = await fetchCities();
// // // //       return cities.find(c => c.slug === citySlug);
// // // //     },
// // // //     enabled: !!citySlug, 
// // // //     staleTime: 1000 * 60 * 10, 
// // // //     refetchOnWindowFocus: false 
// // // //   });

// // // //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>({
// // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug] as const,
// // // //     queryFn: async () => {
// // // //       if (!citySlug || !subCategorySlug) return undefined;
// // // //       const subCategories = await fetchSubCategoriesByCity(citySlug);
// // // //       return subCategories.find(sc => sc.slug === subCategorySlug);
// // // //     },
// // // //     enabled: !!citySlug && !!subCategorySlug, 
// // // //     staleTime: 1000 * 60 * 10, 
// // // //     refetchOnWindowFocus: false 
// // // //   });
  
// // // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// // // //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// // // //     const nameParam = queryParamsFromUrl.get('name');
// // // //     const servicesParam = queryParamsFromUrl.get('services');
// // // //     const sortByParam = queryParamsFromUrl.get('sortBy');
// // // //     const latParam = queryParamsFromUrl.get('userLatitude');
// // // //     const lonParam = queryParamsFromUrl.get('userLongitude');
// // // //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// // // //     if (nameParam) params.name = nameParam;
// // // //     if (servicesParam) params.services = servicesParam;

// // // //     if (latParam && lonParam) {
// // // //         const lat = parseFloat(latParam);
// // // //         const lon = parseFloat(lonParam);
// // // //         if(!isNaN(lat) && !isNaN(lon)) {
// // // //             params.userLatitude = lat;
// // // //             params.userLongitude = lon;
// // // //             if (radiusParam && !isNaN(parseInt(radiusParam, 10))) {
// // // //                 params.radiusInMeters = parseInt(radiusParam, 10);
// // // //             } else {
// // // //                 params.radiusInMeters = contextLocation?.radiusInMeters || 500000;
// // // //             }
// // // //             params.sortBy = sortByParam || 'distance_asc';
// // // //         }
// // // //     } else if (contextLocation) {
// // // //         params.userLatitude = contextLocation.latitude;
// // // //         params.userLongitude = contextLocation.longitude;
// // // //         params.radiusInMeters = contextLocation.radiusInMeters;
// // // //         params.sortBy = sortByParam || 'distance_asc';
// // // //     } else if (sortByParam) {
// // // //         params.sortBy = sortByParam;
// // // //     }
// // // //     return params;
// // // //   });

// // // //   const [pageSize] = useState(9);

// // // //   const shopsQueryKey = useMemo(() => 
// // // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // // //   );

// // // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
// // // //     queryKey: shopsQueryKey, 
// // // //     queryFn: ({ pageParam = 1 }) => 
// // // //       fetchShops(citySlug, subCategorySlug, { 
// // // //         ...searchFilters, 
// // // //         pageNumber: pageParam,
// // // //         pageSize: pageSize 
// // // //       }),
// // // //     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // // //     enabled: !!citySlug && !!subCategorySlug && !isLoadingCity && !isLoadingSubCategory,
// // // //     keepPreviousData: true,    
// // // //     staleTime: 1 * 60 * 1000, 
// // // //     refetchOnWindowFocus: false,
// // // //   });

// // // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
  
// // // //   const {
// // // //     error: shopsError,
// // // //     fetchNextPage,
// // // //     hasNextPage,
// // // //     isFetchingNextPage,
// // // //     isLoading: isLoadingShops, 
// // // //     isFetching: isFetchingShopsQuery, 
// // // //     isError,
// // // //     refetch
// // // //   } = queryResult;

// // // //   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);

// // // //   const isLoadingInitialData = (isLoadingCity || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;

// // // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // //     setSearchFilters(newFilters); 

// // // //     const newUrlSearchParams = new URLSearchParams();
// // // //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// // // //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// // // //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// // // //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// // // //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// // // //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// // // //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
// // // //     router.push(newUrl, { scroll: false });
// // // //   };

// // // //   const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

// // // //   useEffect(() => {
// // // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // // //       fetchNextPage();
// // // //     }
// // // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // // //   const subCategoryDisplayName = useMemo(() => 
// // // //     subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' '), 
// // // //     [subCategoryDetails, subCategorySlug]
// // // //   );
// // // //   const cityDisplayName = useMemo(() => 
// // // //     cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
// // // //     [cityDetails, citySlug]
// // // //   );
  
// // // //   let conceptPageSlug = "";
// // // //   let conceptDisplayName = "";
// // // //   if (subCategoryDetails?.concept === 1) { conceptPageSlug = "maintenance-services"; conceptDisplayName = "Maintenance"; } 
// // // //   else if (subCategoryDetails?.concept === 2) { conceptPageSlug = "auto-parts"; conceptDisplayName = "Marketplace"; }

// // // //   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
// // // //         name: searchFilters.name,
// // // //         services: searchFilters.services,
// // // //         sortBy: searchFilters.sortBy,
// // // //         userLatitude: searchFilters.userLatitude,
// // // //         userLongitude: searchFilters.userLongitude,
// // // //         radiusInMeters: searchFilters.radiusInMeters,
// // // //     }), [searchFilters]);

// // // //   return (
// // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // //       {/* HeroBillboard removed from here */}
// // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20"> {/* Made breadcrumbs sticky */}
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
// // // //           {conceptPageSlug && (
// // // //             <>
// // // //               <li><span className="text-slate-400">»</span></li>
// // // //               {/* This link correctly goes to the concept's subcategory list page */}
// // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // //             </>
// // // //           )}
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// // // //         </ol>
// // // //       </nav>
      
// // // //       {/* Page title now directly in the section */}
// // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
// // // //         <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
// // // //             {subCategoryDisplayName} <span className="font-normal text-slate-600">in {cityDisplayName}</span>
// // // //         </h1>
// // // //         <p className="text-sm text-slate-500 mb-6">
// // // //             Browse and filter shops offering {subCategoryDisplayName.toLowerCase()} services.
// // // //         </p>
// // // //       </div>

// // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-6 md:pb-8"> {/* Adjusted padding */}
// // // //         <div className="mb-6 sticky top-[calc(var(--header-height,60px)+2.6rem)] bg-slate-50/80 backdrop-blur-sm py-3 z-10 rounded-b-lg"> 
// // // //           {/* Made search form sticky */}
// // // //           <ShopSearchForm 
// // // //             onSubmit={handleSearchFormSubmit}
// // // //             initialValues={shopSearchFormInitialValues} 
// // // //             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
// // // //             formInstanceId="shops-list" 
// // // //             showDetectLocationButton={false} 
// // // //           />
// // // //         </div>

// // // //         {isLoadingInitialData ? (
// // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// // // //             {Array.from({ length: pageSize }).map((_, index) => (
// // // //               <ShopCardSkeleton key={index} />
// // // //             ))}
// // // //           </div>
// // // //         ) : isError && shopsError ? ( 
// // // //           <Alert variant="destructive" className="my-6">
// // // //             <Info className="h-5 w-5" />
// // // //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// // // //             <AlertDescription>
// // // //               {shopsError instanceof APIError 
// // // //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// // // //                 : 'An unexpected error occurred'
// // // //               }
// // // //             </AlertDescription>
// // // //             <Button 
// // // //               onClick={() => refetch()}
// // // //               variant="outline" 
// // // //               size="sm" 
// // // //               className="mt-3"
// // // //             >
// // // //               Try Again
// // // //             </Button>
// // // //           </Alert>
// // // //         ) : allShops.length > 0 ? (
// // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-4">
// // // //             {allShops.map((shop) => (
// // // //               <ShopCard 
// // // //                 key={shop.id} 
// // // //                 shop={shop} 
// // // //                 citySlug={citySlug}
// // // //                 subCategorySlug={subCategorySlug}
// // // //               />
// // // //             ))}
// // // //           </div>
// // // //         ) : (
// // // //           <div className="text-center py-12 px-4">
// // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// // // //             </p>
// // // //           </div>
// // // //         )}

// // // //         {!(isLoadingInitialData) && !isError && (
// // // //           <div ref={ref} className="flex justify-center items-center py-8 min-h-[80px]">
// // // //             {hasNextPage && (
// // // //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// // // //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// // // //               </Button>
// // // //             )}
// // // //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && ( 
// // // //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// // // //             )}
// // // //           </div>
// // // //         )}
// // // //       </section>
// // // //     </div>
// // // //   );
// // // // }

// // // // export default function ShopsPage() {
// // // //   const params = useParams();
// // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// // // //   if (!citySlug || !subCategorySlug) {
// // // //     return <LoadingFallback message="Loading page parameters..." />;
// // // //   }

// // // //   return (
// // // //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // // //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
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
// // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // // // 'use client';

// // // // // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // // // // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // // // // import { useInView } from 'react-intersection-observer';
// // // // // import { 
// // // // //     ShopDto, 
// // // // //     PaginatedResponse, 
// // // // //     FrontendShopQueryParameters,
// // // // //     APIError,
// // // // //     CityDto,
// // // // //     SubCategoryDto
// // // // // } from '@/types/api';
// // // // // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // import ShopCard from '@/components/shop/ShopCard'; 
// // // // // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // import { Button } from '@/components/ui/button';
// // // // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // import { Info, Loader2, SearchX } from "lucide-react";
// // // // // import Link from 'next/link';
// // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // // interface ShopsPageClientProps {
// // // // //   citySlug: string;
// // // // //   subCategorySlug: string;
// // // // // }

// // // // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // // // //   const router = useRouter();
// // // // //   const queryParamsFromUrl = useSearchParams();
// // // // //   const { 
// // // // //     currentUserLocation: contextLocation, 
// // // // //     setCurrentUserLocation: setContextLocation,
// // // // //     isLoading: isLoadingContextLocation 
// // // // //   } = useSimpleLocation();

// // // // //   useEffect(() => {
// // // // //     const urlLat = queryParamsFromUrl.get('userLatitude');
// // // // //     const urlLon = queryParamsFromUrl.get('userLongitude');
// // // // //     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

// // // // //     if (urlLat && urlLon) {
// // // // //       const lat = parseFloat(urlLat);
// // // // //       const lon = parseFloat(urlLon);
// // // // //       const radius = urlRadius ? parseInt(urlRadius) : (contextLocation?.radiusInMeters || 500000);
// // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius });
// // // // //          }
// // // // //       }
// // // // //     }
// // // // //   }, [queryParamsFromUrl, contextLocation, setContextLocation]);

// // // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // // //     queryKey: ['cityDetails', citySlug] as const,
// // // // //     queryFn: async () => {
// // // // //       if (!citySlug) return undefined;
// // // // //       const cities = await fetchCities();
// // // // //       return cities.find(c => c.slug === citySlug);
// // // // //     },
// // // // //     enabled: !!citySlug, 
// // // // //     staleTime: 1000 * 60 * 10, 
// // // // //     refetchOnWindowFocus: false 
// // // // //   });

// // // // //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug] as const,
// // // // //     queryFn: async () => {
// // // // //       if (!citySlug || !subCategorySlug) return undefined;
// // // // //       const subCategories = await fetchSubCategoriesByCity(citySlug);
// // // // //       return subCategories.find(sc => sc.slug === subCategorySlug);
// // // // //     },
// // // // //     enabled: !!citySlug && !!subCategorySlug, 
// // // // //     staleTime: 1000 * 60 * 10, 
// // // // //     refetchOnWindowFocus: false 
// // // // //   });
  
// // // // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// // // // //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// // // // //     const nameParam = queryParamsFromUrl.get('name');
// // // // //     const servicesParam = queryParamsFromUrl.get('services');
// // // // //     const sortByParam = queryParamsFromUrl.get('sortBy');
// // // // //     const latParam = queryParamsFromUrl.get('userLatitude');
// // // // //     const lonParam = queryParamsFromUrl.get('userLongitude');
// // // // //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// // // // //     if (nameParam) params.name = nameParam;
// // // // //     if (servicesParam) params.services = servicesParam;

// // // // //     if (latParam && lonParam) {
// // // // //         const lat = parseFloat(latParam);
// // // // //         const lon = parseFloat(lonParam);
// // // // //         if(!isNaN(lat) && !isNaN(lon)) {
// // // // //             params.userLatitude = lat;
// // // // //             params.userLongitude = lon;
// // // // //             if (radiusParam && !isNaN(parseInt(radiusParam, 10))) {
// // // // //                 params.radiusInMeters = parseInt(radiusParam, 10);
// // // // //             } else { // Fallback to context or default if URL radius is missing/invalid
// // // // //                 params.radiusInMeters = contextLocation?.radiusInMeters || 500000;
// // // // //             }
// // // // //             params.sortBy = sortByParam || 'distance_asc';
// // // // //         }
// // // // //     } else if (contextLocation) {
// // // // //         params.userLatitude = contextLocation.latitude;
// // // // //         params.userLongitude = contextLocation.longitude;
// // // // //         params.radiusInMeters = contextLocation.radiusInMeters;
// // // // //         params.sortBy = sortByParam || 'distance_asc';
// // // // //     } else if (sortByParam) {
// // // // //         params.sortBy = sortByParam;
// // // // //     }
// // // // //     return params;
// // // // //   });

// // // // //   const [pageSize] = useState(9);

// // // // //   const shopsQueryKey = useMemo(() => 
// // // // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // // // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // // // //   );

// // // // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
// // // // //     queryKey: shopsQueryKey, 
// // // // //     queryFn: ({ pageParam = 1 }) => 
// // // // //       fetchShops(citySlug, subCategorySlug, { 
// // // // //         ...searchFilters, 
// // // // //         pageNumber: pageParam,
// // // // //         pageSize: pageSize 
// // // // //       }),
// // // // //     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // // // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // // // //     enabled: !!citySlug && !!subCategorySlug && !isLoadingCity && !isLoadingSubCategory,
// // // // //     keepPreviousData: true,    
// // // // //     staleTime: 1 * 60 * 1000, 
// // // // //     refetchOnWindowFocus: false,
// // // // //   });

// // // // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
  
// // // // //   const {
// // // // //     error: shopsError,
// // // // //     fetchNextPage,
// // // // //     hasNextPage,
// // // // //     isFetchingNextPage,
// // // // //     isLoading: isLoadingShops, 
// // // // //     isFetching: isFetchingShopsQuery, 
// // // // //     isError,
// // // // //     refetch
// // // // //   } = queryResult;

// // // // //   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);

// // // // //   const isLoadingInitialData = (isLoadingCity || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;

// // // // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // // //     setSearchFilters(newFilters); 

// // // // //     const newUrlSearchParams = new URLSearchParams();
// // // // //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// // // // //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// // // // //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// // // // //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// // // // //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// // // // //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// // // // //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
// // // // //     router.push(newUrl, { scroll: false });
// // // // //   };

// // // // //   const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

// // // // //   useEffect(() => {
// // // // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // // // //       fetchNextPage();
// // // // //     }
// // // // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // // // //   const subCategoryDisplayName = useMemo(() => 
// // // // //     subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' '), 
// // // // //     [subCategoryDetails, subCategorySlug]
// // // // //   );
// // // // //   const cityDisplayName = useMemo(() => 
// // // // //     cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
// // // // //     [cityDetails, citySlug]
// // // // //   );
  
// // // // //   let conceptPageSlug = "";
// // // // //   let conceptDisplayName = "";
// // // // //   if (subCategoryDetails?.concept === 1) { conceptPageSlug = "maintenance-services"; conceptDisplayName = "Maintenance"; } 
// // // // //   else if (subCategoryDetails?.concept === 2) { conceptPageSlug = "auto-parts"; conceptDisplayName = "Marketplace"; }

// // // // //   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
// // // // //         name: searchFilters.name,
// // // // //         services: searchFilters.services,
// // // // //         sortBy: searchFilters.sortBy,
// // // // //         userLatitude: searchFilters.userLatitude,
// // // // //         userLongitude: searchFilters.userLongitude,
// // // // //         radiusInMeters: searchFilters.radiusInMeters,
// // // // //     }), [searchFilters]);

// // // // //   return (
// // // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // // //       {/* <HeroBillboard
// // // // //         title={subCategoryDisplayName}
// // // // //         highlightText={`in ${cityDisplayName}`}
// // // // //         subtitle={`Browse ${subCategoryDisplayName.toLowerCase()} services and shops available in ${cityDisplayName}.`}
// // // // //         showSearch={true}
// // // // //         searchProps={{
// // // // //           onSubmit: handleSearchFormSubmit,
// // // // //           initialValues: shopSearchFormInitialValues,
// // // // //           isLoading: (isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation,
// // // // //           formInstanceId: "shops-list", // For unique input IDs
// // // // //           showDetectLocationButton: false // Disable detect button on this page
// // // // //         }}
// // // // //         minHeight="min-h-[30vh] md:min-h-[35vh]"
// // // // //       /> */}

// // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // //           {conceptPageSlug && (
// // // // //             <>
// // // // //               <li><span className="text-slate-400">»</span></li>
// // // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // // //             </>
// // // // //           )}
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// // // // //         </ol>
// // // // //       </nav>
      
// // // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
// // // // //         <div className="mb-6">
// // // // //           <ShopSearchForm 
// // // // //             onSubmit={handleSearchFormSubmit}
// // // // //             initialValues={shopSearchFormInitialValues} 
// // // // //             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
// // // // //             formInstanceId="shops-list" 
// // // // //             showDetectLocationButton={false} // Explicitly disable here too
// // // // //           />
// // // // //         </div>

// // // // //         {isLoadingInitialData ? (
// // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // //             {Array.from({ length: pageSize }).map((_, index) => (
// // // // //               <ShopCardSkeleton key={index} />
// // // // //             ))}
// // // // //           </div>
// // // // //         ) : isError && shopsError ? ( 
// // // // //           <Alert variant="destructive" className="my-6">
// // // // //             <Info className="h-5 w-5" />
// // // // //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// // // // //             <AlertDescription>
// // // // //               {shopsError instanceof APIError 
// // // // //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// // // // //                 : 'An unexpected error occurred'
// // // // //               }
// // // // //             </AlertDescription>
// // // // //             <Button 
// // // // //               onClick={() => refetch()}
// // // // //               variant="outline" 
// // // // //               size="sm" 
// // // // //               className="mt-3"
// // // // //             >
// // // // //               Try Again
// // // // //             </Button>
// // // // //           </Alert>
// // // // //         ) : allShops.length > 0 ? (
// // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // //             {allShops.map((shop) => (
// // // // //               <ShopCard 
// // // // //                 key={shop.id} 
// // // // //                 shop={shop} 
// // // // //                 citySlug={citySlug}
// // // // //                 subCategorySlug={subCategorySlug}
// // // // //               />
// // // // //             ))}
// // // // //           </div>
// // // // //         ) : (
// // // // //           <div className="text-center py-12 px-4">
// // // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// // // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // // //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// // // // //             </p>
// // // // //           </div>
// // // // //         )}

// // // // //         {!(isLoadingInitialData) && !isError && (
// // // // //           <div ref={ref} className="flex justify-center items-center py-8 min-h-[80px]">
// // // // //             {hasNextPage && (
// // // // //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// // // // //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// // // // //               </Button>
// // // // //             )}
// // // // //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && ( 
// // // // //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// // // // //             )}
// // // // //           </div>
// // // // //         )}
// // // // //       </section>
// // // // //     </div>
// // // // //   );
// // // // // }

// // // // // export default function ShopsPage() {
// // // // //   const params = useParams();
// // // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // // //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// // // // //   if (!citySlug || !subCategorySlug) {
// // // // //     return <LoadingFallback message="Loading page parameters..." />;
// // // // //   }

// // // // //   return (
// // // // //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // // // //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
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
// // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // // // // 'use client';

// // // // // // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // // // // // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // // // // // import { useInView } from 'react-intersection-observer';
// // // // // // import { 
// // // // // //     ShopDto, 
// // // // // //     PaginatedResponse, 
// // // // // //     FrontendShopQueryParameters,
// // // // // //     APIError,
// // // // // //     CityDto,
// // // // // //     SubCategoryDto
// // // // // // } from '@/types/api';
// // // // // // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // import ShopCard from '@/components/shop/ShopCard'; 
// // // // // // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // // import { Info, Loader2, SearchX } from "lucide-react";
// // // // // // import Link from 'next/link';
// // // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // // // interface ShopsPageClientProps {
// // // // // //   citySlug: string;
// // // // // //   subCategorySlug: string;
// // // // // // }

// // // // // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // // // // //   const router = useRouter();
// // // // // //   const queryParamsFromUrl = useSearchParams();
// // // // // //   const { 
// // // // // //     currentUserLocation: contextLocation, 
// // // // // //     setCurrentUserLocation: setContextLocation,
// // // // // //     isLoading: isLoadingContextLocation 
// // // // // //   } = useSimpleLocation();

// // // // // //   useEffect(() => {
// // // // // //     const urlLat = queryParamsFromUrl.get('userLatitude');
// // // // // //     const urlLon = queryParamsFromUrl.get('userLongitude');
// // // // // //     const urlRadius = queryParamsFromUrl.get('radiusInMeters');

// // // // // //     if (urlLat && urlLon) {
// // // // // //       const lat = parseFloat(urlLat);
// // // // // //       const lon = parseFloat(urlLon);
// // // // // //       const radius = urlRadius ? parseInt(urlRadius) : (contextLocation?.radiusInMeters || 500000);
// // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // //          if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // //            setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius });
// // // // // //          }
// // // // // //       }
// // // // // //     }
// // // // // //   }, [queryParamsFromUrl, contextLocation, setContextLocation]);


// // // // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // // // //     queryKey: ['cityDetails', citySlug] as const,
// // // // // //     queryFn: async () => {
// // // // // //       if (!citySlug) return undefined;
// // // // // //       const cities = await fetchCities();
// // // // // //       return cities.find(c => c.slug === citySlug);
// // // // // //     },
// // // // // //     enabled: !!citySlug, 
// // // // // //     staleTime: 1000 * 60 * 10, 
// // // // // //     refetchOnWindowFocus: false 
// // // // // //   });

// // // // // //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug] as const,
// // // // // //     queryFn: async () => {
// // // // // //       if (!citySlug || !subCategorySlug) return undefined;
// // // // // //       const subCategories = await fetchSubCategoriesByCity(citySlug);
// // // // // //       return subCategories.find(sc => sc.slug === subCategorySlug);
// // // // // //     },
// // // // // //     enabled: !!citySlug && !!subCategorySlug, 
// // // // // //     staleTime: 1000 * 60 * 10, 
// // // // // //     refetchOnWindowFocus: false 
// // // // // //   });
  
// // // // // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// // // // // //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// // // // // //     const nameParam = queryParamsFromUrl.get('name');
// // // // // //     const servicesParam = queryParamsFromUrl.get('services');
// // // // // //     const sortByParam = queryParamsFromUrl.get('sortBy');
// // // // // //     const latParam = queryParamsFromUrl.get('userLatitude');
// // // // // //     const lonParam = queryParamsFromUrl.get('userLongitude');
// // // // // //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// // // // // //     if (nameParam) params.name = nameParam;
// // // // // //     if (servicesParam) params.services = servicesParam;

// // // // // //     if (latParam && lonParam) {
// // // // // //         const lat = parseFloat(latParam);
// // // // // //         const lon = parseFloat(lonParam);
// // // // // //         if(!isNaN(lat) && !isNaN(lon)) {
// // // // // //             params.userLatitude = lat;
// // // // // //             params.userLongitude = lon;
// // // // // //             if (radiusParam && !isNaN(parseInt(radiusParam, 10))) {
// // // // // //                 params.radiusInMeters = parseInt(radiusParam, 10);
// // // // // //             } else {
// // // // // //                 params.radiusInMeters = contextLocation?.radiusInMeters || 500000;
// // // // // //             }
// // // // // //             params.sortBy = sortByParam || 'distance_asc';
// // // // // //         }
// // // // // //     } else if (contextLocation) {
// // // // // //         params.userLatitude = contextLocation.latitude;
// // // // // //         params.userLongitude = contextLocation.longitude;
// // // // // //         params.radiusInMeters = contextLocation.radiusInMeters;
// // // // // //         params.sortBy = sortByParam || 'distance_asc';
// // // // // //     } else if (sortByParam) {
// // // // // //         params.sortBy = sortByParam;
// // // // // //     }
// // // // // //     return params;
// // // // // //   });

// // // // // //   const [pageSize] = useState(9);

// // // // // //   const shopsQueryKey = useMemo(() => 
// // // // // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // // // // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // // // // //   );

// // // // // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>({
// // // // // //     queryKey: shopsQueryKey, 
// // // // // //     queryFn: ({ pageParam = 1 }) => 
// // // // // //       fetchShops(citySlug, subCategorySlug, { 
// // // // // //         ...searchFilters, 
// // // // // //         pageNumber: pageParam,
// // // // // //         pageSize: pageSize 
// // // // // //       }),
// // // // // //     getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // // // // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // // // // //     enabled: !!citySlug && !!subCategorySlug && !isLoadingCity && !isLoadingSubCategory,
// // // // // //     keepPreviousData: true,    
// // // // // //     staleTime: 1 * 60 * 1000, 
// // // // // //     refetchOnWindowFocus: false,
// // // // // //   });

// // // // // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
  
// // // // // //   const {
// // // // // //     error: shopsError,
// // // // // //     fetchNextPage,
// // // // // //     hasNextPage,
// // // // // //     isFetchingNextPage,
// // // // // //     isLoading: isLoadingShops, 
// // // // // //     isFetching: isFetchingShopsQuery, 
// // // // // //     isError,
// // // // // //     refetch
// // // // // //   } = queryResult;

// // // // // //   const allShops = useMemo(() => data?.pages?.flatMap(page => page.data) ?? [], [data]);

// // // // // //   const isLoadingInitialData = (isLoadingCity || isLoadingSubCategory || isLoadingContextLocation || isLoadingShops) && allShops.length === 0;

// // // // // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // // // //     setSearchFilters(newFilters); 

// // // // // //     const newUrlSearchParams = new URLSearchParams();
// // // // // //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// // // // // //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// // // // // //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// // // // // //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// // // // // //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// // // // // //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// // // // // //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
// // // // // //     router.push(newUrl, { scroll: false });
// // // // // //   };

// // // // // //   const { ref, inView } = useInView({ threshold: 0.1, rootMargin: '100px' });

// // // // // //   useEffect(() => {
// // // // // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // // // // //       fetchNextPage();
// // // // // //     }
// // // // // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // // // // //   const subCategoryDisplayName = useMemo(() => 
// // // // // //     subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' '), 
// // // // // //     [subCategoryDetails, subCategorySlug]
// // // // // //   );
// // // // // //   const cityDisplayName = useMemo(() => 
// // // // // //     cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
// // // // // //     [cityDetails, citySlug]
// // // // // //   );
  
// // // // // //   let conceptPageSlug = "";
// // // // // //   let conceptDisplayName = "";
// // // // // //   if (subCategoryDetails?.concept === 1) { conceptPageSlug = "maintenance-services"; conceptDisplayName = "Maintenance"; } 
// // // // // //   else if (subCategoryDetails?.concept === 2) { conceptPageSlug = "auto-parts"; conceptDisplayName = "Marketplace"; }

// // // // // //   const shopSearchFormInitialValues = useMemo((): Partial<FrontendShopQueryParameters> => ({
// // // // // //         name: searchFilters.name,
// // // // // //         services: searchFilters.services,
// // // // // //         sortBy: searchFilters.sortBy,
// // // // // //         userLatitude: searchFilters.userLatitude,
// // // // // //         userLongitude: searchFilters.userLongitude,
// // // // // //         radiusInMeters: searchFilters.radiusInMeters,
// // // // // //     }), [searchFilters]);


// // // // // //   return (
// // // // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // // // //       <HeroBillboard
// // // // // //         title={subCategoryDisplayName}
// // // // // //         highlightText={`in ${cityDisplayName}`}
// // // // // //         subtitle={`Browse ${subCategoryDisplayName.toLowerCase()} services and shops available in ${cityDisplayName}.`}
// // // // // //         showSearch={true}
// // // // // //         searchProps={{
// // // // // //           onSubmit: handleSearchFormSubmit,
// // // // // //           initialValues: shopSearchFormInitialValues,
// // // // // //           isLoading: (isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation,
// // // // // //         }}
// // // // // //         minHeight="min-h-[30vh] md:min-h-[35vh]"
// // // // // //       />

// // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // // //           {conceptPageSlug && (
// // // // // //             <>
// // // // // //               <li><span className="text-slate-400">»</span></li>
// // // // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // // // //             </>
// // // // // //           )}
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// // // // // //         </ol>
// // // // // //       </nav>
      
// // // // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
// // // // // //         <div className="mb-6">
// // // // // //           <ShopSearchForm 
// // // // // //             onSubmit={handleSearchFormSubmit}
// // // // // //             initialValues={shopSearchFormInitialValues} 
// // // // // //             isLoading={(isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData) || isLoadingContextLocation}
// // // // // //             formInstanceId="shops-list" 
// // // // // //           />
// // // // // //         </div>

// // // // // //         {isLoadingInitialData ? (
// // // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // // //             {Array.from({ length: pageSize }).map((_, index) => (
// // // // // //               <ShopCardSkeleton key={index} />
// // // // // //             ))}
// // // // // //           </div>
// // // // // //         ) : isError && shopsError ? ( 
// // // // // //           <Alert variant="destructive" className="my-6">
// // // // // //             <Info className="h-5 w-5" />
// // // // // //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// // // // // //             <AlertDescription>
// // // // // //               {shopsError instanceof APIError 
// // // // // //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// // // // // //                 : 'An unexpected error occurred'
// // // // // //               }
// // // // // //             </AlertDescription>
// // // // // //             <Button 
// // // // // //               onClick={() => refetch()}
// // // // // //               variant="outline" 
// // // // // //               size="sm" 
// // // // // //               className="mt-3"
// // // // // //             >
// // // // // //               Try Again
// // // // // //             </Button>
// // // // // //           </Alert>
// // // // // //         ) : allShops.length > 0 ? (
// // // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // // //             {allShops.map((shop) => (
// // // // // //               <ShopCard 
// // // // // //                 key={shop.id} 
// // // // // //                 shop={shop} 
// // // // // //                 citySlug={citySlug}
// // // // // //                 subCategorySlug={subCategorySlug}
// // // // // //               />
// // // // // //             ))}
// // // // // //           </div>
// // // // // //         ) : (
// // // // // //           <div className="text-center py-12 px-4">
// // // // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// // // // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // // // //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// // // // // //             </p>
// // // // // //           </div>
// // // // // //         )}

// // // // // //         {!(isLoadingInitialData) && !isError && (
// // // // // //           <div ref={ref} className="flex justify-center items-center py-8 min-h-[80px]">
// // // // // //             {hasNextPage && (
// // // // // //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// // // // // //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// // // // // //               </Button>
// // // // // //             )}
// // // // // //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && ( 
// // // // // //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// // // // // //             )}
// // // // // //           </div>
// // // // // //         )}
// // // // // //       </section>
// // // // // //     </div>
// // // // // //   );
// // // // // // }

// // // // // // export default function ShopsPage() {
// // // // // //   const params = useParams();
// // // // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // // // //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// // // // // //   if (!citySlug || !subCategorySlug) {
// // // // // //     return <LoadingFallback message="Loading page parameters..." />;
// // // // // //   }

// // // // // //   return (
// // // // // //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // // // // //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
// // // // // //     </Suspense>
// // // // // //   );
// // // // // // }

// // // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // // //   return (
// // // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // // //     </div>
// // // // // //   );
// // // // // // }
// // // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // // // // // 'use client';

// // // // // // // import React, { useState, useEffect, useMemo, Suspense } from 'react';
// // // // // // // import { useInfiniteQuery, useQuery, InfiniteData } from '@tanstack/react-query';
// // // // // // // import { useInView } from 'react-intersection-observer';
// // // // // // // import { 
// // // // // // //     ShopDto, 
// // // // // // //     PaginatedResponse, 
// // // // // // //     FrontendShopQueryParameters,
// // // // // // //     APIError,
// // // // // // //     CityDto,
// // // // // // //     SubCategoryDto
// // // // // // // } from '@/types/api';
// // // // // // // import { fetchShops, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // // import ShopCard from '@/components/shop/ShopCard'; 
// // // // // // // import ShopCardSkeleton from '@/components/shop/ShopCardSkeleton';
// // // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // import { useParams, useSearchParams, useRouter } from 'next/navigation';
// // // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // // // // // import { Info, Loader2, SearchX } from "lucide-react";
// // // // // // // import Link from 'next/link';

// // // // // // // interface ShopsPageClientProps {
// // // // // // //   citySlug: string;
// // // // // // //   subCategorySlug: string;
// // // // // // // }

// // // // // // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // // // // // //   const router = useRouter();
// // // // // // //   const queryParamsFromUrl = useSearchParams();

// // // // // // //   const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>(
// // // // // // //     ['cityDetails', citySlug] as const,
// // // // // // //     async () => {
// // // // // // //       if (!citySlug) return undefined;
// // // // // // //       const cities = await fetchCities();
// // // // // // //       return cities.find(c => c.slug === citySlug);
// // // // // // //     },
// // // // // // //     { enabled: !!citySlug, staleTime: 1000 * 60 * 10, refetchOnWindowFocus: false }
// // // // // // //   );

// // // // // // //   const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>(
// // // // // // //     ['subCategoryDetails', citySlug, subCategorySlug] as const,
// // // // // // //     async () => {
// // // // // // //       if (!citySlug || !subCategorySlug) return undefined;
// // // // // // //       const subCategories = await fetchSubCategoriesByCity(citySlug);
// // // // // // //       return subCategories.find(sc => sc.slug === subCategorySlug);
// // // // // // //     },
// // // // // // //     { enabled: !!citySlug && !!subCategorySlug, staleTime: 1000 * 60 * 10, refetchOnWindowFocus: false }
// // // // // // //   );
  
// // // // // // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>(() => {
// // // // // // //     const params: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'> = {};
// // // // // // //     const nameParam = queryParamsFromUrl.get('name');
// // // // // // //     const servicesParam = queryParamsFromUrl.get('services');
// // // // // // //     const sortByParam = queryParamsFromUrl.get('sortBy');
// // // // // // //     const latParam = queryParamsFromUrl.get('userLatitude');
// // // // // // //     const lonParam = queryParamsFromUrl.get('userLongitude');
// // // // // // //     const radiusParam = queryParamsFromUrl.get('radiusInMeters');

// // // // // // //     if (nameParam) params.name = nameParam;
// // // // // // //     if (servicesParam) params.services = servicesParam;
// // // // // // //     if (sortByParam) params.sortBy = sortByParam;
// // // // // // //     if (latParam && !isNaN(parseFloat(latParam))) params.userLatitude = parseFloat(latParam);
// // // // // // //     if (lonParam && !isNaN(parseFloat(lonParam))) params.userLongitude = parseFloat(lonParam);
// // // // // // //     if (radiusParam && !isNaN(parseInt(radiusParam, 10))) params.radiusInMeters = parseInt(radiusParam, 10);
// // // // // // //     return params;
// // // // // // //   });
// // // // // // //   const [pageSize] = useState(9);

// // // // // // //   const shopsQueryKey = useMemo(() => 
// // // // // // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // // // // // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // // // // // //   );

// // // // // // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>( 
// // // // // // //     shopsQueryKey, 
// // // // // // //     ({ pageParam = 1 }) => 
// // // // // // //       fetchShops(citySlug, subCategorySlug, { 
// // // // // // //         ...searchFilters, 
// // // // // // //         pageNumber: pageParam,
// // // // // // //         pageSize: pageSize 
// // // // // // //       }),
// // // // // // //     { 
// // // // // // //       getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // // // // // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // // // // // //       enabled: !!citySlug && !!subCategorySlug,
// // // // // // //       cacheTime: 10 * 60 * 1000, 
// // // // // // //       keepPreviousData: true,    
// // // // // // //       staleTime: 1 * 60 * 1000, 
// // // // // // //       refetchOnWindowFocus: false,
// // // // // // //     }
// // // // // // //   );

// // // // // // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
  
// // // // // // //   const {
// // // // // // //     error: shopsError,
// // // // // // //     fetchNextPage,
// // // // // // //     hasNextPage,
// // // // // // //     isFetchingNextPage,
// // // // // // //     isLoading: isLoadingShops, // True when the query is first loading or refetching
// // // // // // //     isFetching: isFetchingShopsQuery, // True when any fetch is in progress (initial, refetch, next page)
// // // // // // //     isError,
// // // // // // //     refetch
// // // // // // //   } = queryResult;

// // // // // // //   const allShops = useMemo(() => {
// // // // // // //     return data?.pages?.flatMap(page => page.data) ?? []; 
// // // // // // //   }, [data]);

// // // // // // //   const isLoadingInitialData = isLoadingShops && (!data || !data.pages || data.pages.length === 0);

// // // // // // //   // const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // // // // //   //   setSearchFilters(newFilters);
// // // // // // //   // };
// // // // // // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // // // // //     // console.log("ShopsPageClient: handleSearchFormSubmit received newFilters:", newFilters);
    
// // // // // // //     // Update local state to trigger re-fetch via queryKey change
// // // // // // //     setSearchFilters(newFilters); 

// // // // // // //     // Construct new query parameters for the URL
// // // // // // //     const newUrlSearchParams = new URLSearchParams();
// // // // // // //     if (newFilters.name) newUrlSearchParams.set('name', newFilters.name);
// // // // // // //     if (newFilters.services) newUrlSearchParams.set('services', newFilters.services);
// // // // // // //     if (newFilters.sortBy) newUrlSearchParams.set('sortBy', newFilters.sortBy);
// // // // // // //     if (newFilters.userLatitude !== undefined) newUrlSearchParams.set('userLatitude', newFilters.userLatitude.toString());
// // // // // // //     if (newFilters.userLongitude !== undefined) newUrlSearchParams.set('userLongitude', newFilters.userLongitude.toString());
// // // // // // //     if (newFilters.radiusInMeters !== undefined) newUrlSearchParams.set('radiusInMeters', newFilters.radiusInMeters.toString());

// // // // // // //     const newUrl = `/cities/${citySlug}/categories/${subCategorySlug}/shops?${newUrlSearchParams.toString()}`;
    
// // // // // // //     // console.log("ShopsPageClient: Pushing to new URL:", newUrl);
// // // // // // //     router.push(newUrl, { scroll: false }); // Use { scroll: false } to prevent page jump
// // // // // // //   };

// // // // // // //   const { ref, inView } = useInView({
// // // // // // //     threshold: 0.1, 
// // // // // // //     rootMargin: '100px'
// // // // // // //   });

// // // // // // //   useEffect(() => {
// // // // // // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // // // // // //       fetchNextPage();
// // // // // // //     }
// // // // // // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // // // // // //   const subCategoryDisplayName = useMemo(() => subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || subCategorySlug.replace(/-/g, ' '), [subCategoryDetails, subCategorySlug]);
// // // // // // //   const cityDisplayName = useMemo(() => cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), [cityDetails, citySlug]);
  
// // // // // // //   let conceptPageSlug = "";
// // // // // // //   let conceptDisplayName = "";
// // // // // // //   if (subCategoryDetails?.concept === 1) { conceptPageSlug = "maintenance-services"; conceptDisplayName = "Maintenance"; } 
// // // // // // //   else if (subCategoryDetails?.concept === 2) { conceptPageSlug = "auto-parts"; conceptDisplayName = "Marketplace"; }

// // // // // // //   const shopSearchFormInitialValues = useMemo(() => ({
// // // // // // //         name: searchFilters.name,
// // // // // // //         services: searchFilters.services,
// // // // // // //         sortBy: searchFilters.sortBy,
// // // // // // //         userLatitude: searchFilters.userLatitude,
// // // // // // //         userLongitude: searchFilters.userLongitude,
// // // // // // //         radiusInMeters: searchFilters.radiusInMeters,
// // // // // // //     }), [searchFilters]);


// // // // // // //   return (
// // // // // // //     <div className="flex flex-col min-h-screen bg-slate-50">
// // // // // // //       <HeroBillboard
// // // // // // //         title={subCategoryDisplayName}
// // // // // // //         highlightText={`in ${cityDisplayName}`}
// // // // // // //         subtitle={`Browse ${subCategoryDisplayName.toLowerCase()} services and shops available in ${cityDisplayName}.`}
// // // // // // //         showSearch={true}
// // // // // // //         searchProps={{
// // // // // // //           onSubmit: handleSearchFormSubmit,
// // // // // // //           initialValues: shopSearchFormInitialValues,
// // // // // // //           // initialValues: { 
// // // // // // //           //     name: searchFilters.name,
// // // // // // //           //     services: searchFilters.services,
// // // // // // //           //     sortBy: searchFilters.sortBy,
// // // // // // //           //     userLatitude: searchFilters.userLatitude,
// // // // // // //           //     userLongitude: searchFilters.userLongitude,
// // // // // // //           //     radiusInMeters: searchFilters.radiusInMeters
// // // // // // //           //  },
// // // // // // //           isLoading: isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData, // Use isFetchingShopsQuery
// // // // // // //         }}
// // // // // // //         minHeight="min-h-[30vh] md:min-h-[35vh]"
// // // // // // //       />

// // // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // // // //           {conceptPageSlug && (
// // // // // // //             <>
// // // // // // //               <li><span className="text-slate-400">»</span></li>
// // // // // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // // // // //             </>
// // // // // // //           )}
// // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // //           <li className="font-medium text-slate-700" aria-current="page">{subCategoryDisplayName}</li>
// // // // // // //         </ol>
// // // // // // //       </nav>
      
// // // // // // //       <section className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
// // // // // // //         <div className="mb-6">
// // // // // // //           <ShopSearchForm 
// // // // // // //             onSubmit={handleSearchFormSubmit}
// // // // // // //             initialValues={shopSearchFormInitialValues}
// // // // // // //             // initialValues={{
// // // // // // //             //     name: searchFilters.name,
// // // // // // //             //     services: searchFilters.services,
// // // // // // //             //     sortBy: searchFilters.sortBy,
// // // // // // //             //     userLatitude: searchFilters.userLatitude,
// // // // // // //             //     userLongitude: searchFilters.userLongitude,
// // // // // // //             //     radiusInMeters: searchFilters.radiusInMeters,
// // // // // // //             // }}
// // // // // // //             isLoading={isFetchingShopsQuery && !isFetchingNextPage && !isLoadingInitialData} // Use isFetchingShopsQuery
// // // // // // //           />
// // // // // // //         </div>

// // // // // // //         {(isLoadingCity || isLoadingSubCategory || isLoadingInitialData) ? (
// // // // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // // // //             {Array.from({ length: pageSize }).map((_, index) => (
// // // // // // //               <ShopCardSkeleton key={index} />
// // // // // // //             ))}
// // // // // // //           </div>
// // // // // // //         ) : isError && shopsError ? ( 
// // // // // // //           <Alert variant="destructive" className="my-6">
// // // // // // //             <Info className="h-5 w-5" />
// // // // // // //             <AlertTitle className="font-semibold">Error loading shops</AlertTitle>
// // // // // // //             <AlertDescription>
// // // // // // //               {shopsError instanceof APIError 
// // // // // // //                 ? `${shopsError.status !== 0 ? `(${shopsError.status}) ` : ''}${shopsError.message}`
// // // // // // //                 : 'An unexpected error occurred'
// // // // // // //               }
// // // // // // //             </AlertDescription>
// // // // // // //             <Button 
// // // // // // //               onClick={() => refetch()}
// // // // // // //               variant="outline" 
// // // // // // //               size="sm" 
// // // // // // //               className="mt-3"
// // // // // // //             >
// // // // // // //               Try Again
// // // // // // //             </Button>
// // // // // // //           </Alert>
// // // // // // //         ) : allShops.length > 0 ? (
// // // // // // //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
// // // // // // //             {allShops.map((shop) => (
// // // // // // //               <ShopCard 
// // // // // // //                 key={shop.id} 
// // // // // // //                 shop={shop} 
// // // // // // //                 citySlug={citySlug}
// // // // // // //                 subCategorySlug={subCategorySlug}
// // // // // // //               />
// // // // // // //             ))}
// // // // // // //           </div>
// // // // // // //         ) : (
// // // // // // //           <div className="text-center py-12 px-4">
// // // // // // //             <SearchX className="mx-auto h-16 w-16 text-slate-400 mb-5" />
// // // // // // //             <h3 className="text-xl sm:text-2xl font-semibold text-slate-700 mb-2">No Shops Found</h3>
// // // // // // //             <p className="text-base text-slate-500 max-w-md mx-auto">
// // // // // // //               No shops currently match "{subCategoryDisplayName}" in {cityDisplayName} with your selected filters.
// // // // // // //             </p>
// // // // // // //           </div>
// // // // // // //         )}

// // // // // // //         {!(isLoadingCity || isLoadingSubCategory || isLoadingInitialData) && !isError && (
// // // // // // //           <div ref={ref} className="flex justify-center items-center py-8 min-h-[80px]">
// // // // // // //             {hasNextPage && (
// // // // // // //               <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="px-6 py-3 text-base">
// // // // // // //                 {isFetchingNextPage ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 'Load More Shops'}
// // // // // // //               </Button>
// // // // // // //             )}
// // // // // // //             {/* Use isFetchingShopsQuery for the "end of list" message to avoid showing it during a general refetch */}
// // // // // // //             {!hasNextPage && allShops.length > 0 && !isFetchingShopsQuery && ( 
// // // // // // //               <p className="text-sm text-slate-500">You've reached the end of the list.</p>
// // // // // // //             )}
// // // // // // //           </div>
// // // // // // //         )}
// // // // // // //       </section>
// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }

// // // // // // // export default function ShopsPage() {
// // // // // // //   const params = useParams();
// // // // // // //   const citySlug = Array.isArray(params.citySlug) ? params.citySlug[0] : params.citySlug || "";
// // // // // // //   const subCategorySlug = Array.isArray(params.subCategorySlug) ? params.subCategorySlug[0] : params.subCategorySlug || "";

// // // // // // //   if (!citySlug || !subCategorySlug) {
// // // // // // //     return <LoadingFallback message="Loading page parameters..." />;
// // // // // // //   }

// // // // // // //   return (
// // // // // // //     <Suspense fallback={<LoadingFallback message={`Loading ${subCategorySlug.replace(/-/g, ' ')} shops in ${citySlug.replace(/-/g, ' ')}...`} />}>
// // // // // // //       {/* Corrected component name here */}
// // // // // // //       <ShopsPageClient citySlug={citySlug} subCategorySlug={subCategorySlug} />
// // // // // // //     </Suspense>
// // // // // // //   );
// // // // // // // }

// // // // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // // // //   return (
// // // // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }
// // // // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/page.tsx
// // // // // // // // 'use client';

// // // // // // // // import React, { useState, useEffect, useMemo } from 'react';
// // // // // // // // import { useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
// // // // // // // // import { useInView } from 'react-intersection-observer';
// // // // // // // // import { ShopDto, PaginatedResponse, FrontendShopQueryParameters, APIError } from '@/types/api';
// // // // // // // // import { fetchShops } from '@/lib/apiClient';

// // // // // // // // interface ShopsPageClientProps {
// // // // // // // //   citySlug: string;
// // // // // // // //   subCategorySlug: string;
// // // // // // // // }

// // // // // // // // function ShopsPageClient({ citySlug, subCategorySlug }: ShopsPageClientProps) {
// // // // // // // //   const [searchFilters, setSearchFilters] = useState<Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>>({});
// // // // // // // //   const [pageSize] = useState(9);

// // // // // // // //   const shopsQueryKey = useMemo(() => 
// // // // // // // //     ['shops', citySlug, subCategorySlug, { ...searchFilters, pageSize }] as const, 
// // // // // // // //     [citySlug, subCategorySlug, searchFilters, pageSize]
// // // // // // // //   );

// // // // // // // //   const queryResult = useInfiniteQuery<PaginatedResponse<ShopDto>, APIError>(
// // // // // // // //     shopsQueryKey, 
// // // // // // // //     ({ pageParam = 1 }) => 
// // // // // // // //       fetchShops(citySlug, subCategorySlug, { 
// // // // // // // //         ...searchFilters, 
// // // // // // // //         pageNumber: pageParam,
// // // // // // // //         pageSize: pageSize 
// // // // // // // //       }),
// // // // // // // //     { 
// // // // // // // //       getNextPageParam: (lastPage: PaginatedResponse<ShopDto>) => 
// // // // // // // //         lastPage.pagination.hasNextPage ? lastPage.pagination.currentPage + 1 : undefined,
// // // // // // // //       enabled: !!citySlug && !!subCategorySlug,
// // // // // // // //       cacheTime: 10 * 60 * 1000, 
// // // // // // // //       keepPreviousData: true,    
// // // // // // // //     }
// // // // // // // //   );

// // // // // // // //   // DIRECT FIX: Explicitly type the data
// // // // // // // //   const data = queryResult.data as InfiniteData<PaginatedResponse<ShopDto>> | undefined;
// // // // // // // //   const {
// // // // // // // //     error: shopsError,
// // // // // // // //     fetchNextPage,
// // // // // // // //     hasNextPage,
// // // // // // // //     isFetchingNextPage,
// // // // // // // //     isLoading: isLoadingShops,
// // // // // // // //     isError,
// // // // // // // //     refetch
// // // // // // // //   } = queryResult;

// // // // // // // //   const allShops = useMemo(() => {
// // // // // // // //     return data?.pages?.flatMap(page => page.data) ?? []; 
// // // // // // // //   }, [data]);

// // // // // // // //   const isLoadingInitialData = isLoadingShops && (!data || !data.pages || data.pages.length === 0);

// // // // // // // //   const handleSearchFormSubmit = (newFilters: Omit<FrontendShopQueryParameters, 'pageNumber' | 'pageSize'>) => {
// // // // // // // //     setSearchFilters(newFilters);
// // // // // // // //   };

// // // // // // // //   const { ref, inView } = useInView({
// // // // // // // //     threshold: 0,
// // // // // // // //     rootMargin: '100px'
// // // // // // // //   });

// // // // // // // //   useEffect(() => {
// // // // // // // //     if (inView && hasNextPage && !isFetchingNextPage) {
// // // // // // // //       fetchNextPage();
// // // // // // // //     }
// // // // // // // //   }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

// // // // // // // //   if (isError && shopsError) {
// // // // // // // //     return (
// // // // // // // //       <div className="p-4">
// // // // // // // //         <div className="bg-red-50 border border-red-200 rounded-md p-4">
// // // // // // // //           <h3 className="text-red-800 font-medium">Error loading shops</h3>
// // // // // // // //           <p className="text-red-600 mt-1">
// // // // // // // //             {shopsError instanceof APIError 
// // // // // // // //               ? `${shopsError.status}: ${shopsError.message}`
// // // // // // // //               : 'An unexpected error occurred'
// // // // // // // //             }
// // // // // // // //           </p>
// // // // // // // //           <button 
// // // // // // // //             onClick={() => refetch()}
// // // // // // // //             className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
// // // // // // // //           >
// // // // // // // //             Retry
// // // // // // // //           </button>
// // // // // // // //         </div>
// // // // // // // //       </div>
// // // // // // // //     );
// // // // // // // //   }

// // // // // // // //   return (
// // // // // // // //     <div className="container mx-auto px-4 py-8">
// // // // // // // //       <div className="mb-6">
// // // // // // // //         <input type="text" placeholder="Search form placeholder" />
// // // // // // // //       </div>

// // // // // // // //       {isLoadingInitialData && (
// // // // // // // //         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
// // // // // // // //           {Array.from({ length: pageSize }).map((_, index) => (
// // // // // // // //             <div key={index} className="border rounded-lg p-4 animate-pulse">
// // // // // // // //               <div className="h-4 bg-gray-200 rounded mb-2"></div>
// // // // // // // //               <div className="h-3 bg-gray-200 rounded w-2/3"></div>
// // // // // // // //             </div>
// // // // // // // //           ))}
// // // // // // // //         </div>
// // // // // // // //       )}

// // // // // // // //       {!isLoadingInitialData && (
// // // // // // // //         <>
// // // // // // // //           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
// // // // // // // //             {allShops.map((shop) => (
// // // // // // // //               <div key={shop.id} className="border rounded-lg p-4">
// // // // // // // //                 <h3 className="font-semibold">{shop.nameEn}</h3>
// // // // // // // //                 <p className="text-gray-600">{shop.subCategoryName}</p>
// // // // // // // //               </div>
// // // // // // // //             ))}
// // // // // // // //           </div>

// // // // // // // //           {allShops.length === 0 && !isLoadingShops && (
// // // // // // // //             <div className="text-center py-8">
// // // // // // // //               <p className="text-gray-500">No shops found matching your criteria.</p>
// // // // // // // //             </div>
// // // // // // // //           )}

// // // // // // // //           {hasNextPage && (
// // // // // // // //             <div ref={ref} className="flex justify-center py-4">
// // // // // // // //               {isFetchingNextPage && (
// // // // // // // //                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
// // // // // // // //               )}
// // // // // // // //             </div>
// // // // // // // //           )}

// // // // // // // //           {!hasNextPage && allShops.length > 0 && (
// // // // // // // //             <div className="text-center py-4">
// // // // // // // //               <p className="text-gray-500">You've reached the end of the results.</p>
// // // // // // // //             </div>
// // // // // // // //           )}
// // // // // // // //         </>
// // // // // // // //       )}
// // // // // // // //     </div>
// // // // // // // //   );
// // // // // // // // }

// // // // // // // // export default function ShopsPage() {
// // // // // // // //   return (
// // // // // // // //     <ShopsPageClient 
// // // // // // // //       citySlug="example-city"
// // // // // // // //       subCategorySlug="example-category"
// // // // // // // //     />
// // // // // // // //   );
// // // // // // // // }