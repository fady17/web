'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    fetchCities,
    fetchOperationalAreasForMap,
    fetchSubCategoriesByOperationalArea
} from '@/lib/apiClient';
import {
    CityDto,
    OperationalAreaDto,
    OperationalAreaFeatureProperties,
    APIError,
    FrontendShopQueryParameters,
    SubCategoryDto,
    HighLevelConceptQueryParam
} from '@/types/api';
import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
import HeroBillboard from '@/components/common/HeroBillboard';
import CityCard from '@/components/city/CityCard';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
import ShopSearchForm from '@/components/search/ShopSearchForm';
import { cn } from '@/lib/utils';
import { useGeoData } from '@/contexts/GeoDataContext';

const DISPLAY_LEVEL_GOVERNORATE = "Governorate";
const DISPLAY_LEVEL_AGGREGATED = "AggregatedUrbanArea";
const DISPLAY_LEVEL_MAJOR_NEW_CITY = "MajorNewCity";
const DISPLAY_LEVEL_DISTRICT = "District";

const ZOOM_THRESHOLD_TO_SHOW_AGGREGATED = 8;
const ZOOM_THRESHOLD_TO_HIDE_GOVERNORATE = 9;
const ZOOM_THRESHOLD_TO_SHOW_DISTRICT = 10;
const ZOOM_THRESHOLD_TO_HIDE_AGGREGATED = 12;

type HeroSearchSubmitParams = Pick<
  FrontendShopQueryParameters,
  'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
>;

const DEFAULT_SEARCH_RADIUS = 50000;
const DEFAULT_INITIAL_ZOOM = 6;

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { egyptBoundaryGeoJsonString, isLoadingEgyptBoundary } = useGeoData();

  const {
    currentLocation: contextLocation,
    setCurrentLocation: setContextLocation,
    isLoading: isLoadingContextLocation,
    error: contextGeoError,
    clearError: clearContextGeoError,
    attemptBrowserGpsLocation,
    isLoadingInitialPreference,
  } = useUserGeoLocation();

  const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
  const [pageLevelError, setPageLevelError] = useState<string | null>(null);
  const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
  const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

  const [mapCurrentZoom, setMapCurrentZoom] = useState<number>(DEFAULT_INITIAL_ZOOM);
  const [mapCurrentDisplayLevels, setMapCurrentDisplayLevels] = useState<string[]>([DISPLAY_LEVEL_GOVERNORATE]);

  const {
    data: allOperationalAreasRaw,
    isLoading: isLoadingOperationalAreas,
    error: operationalAreasError
  } = useQuery<OperationalAreaDto[], APIError>({
    queryKey: ['allOperationalAreasForMap'],
    queryFn: () => fetchOperationalAreasForMap(undefined),
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const levels: string[] = [];
    if (mapCurrentZoom < ZOOM_THRESHOLD_TO_HIDE_GOVERNORATE) {
      levels.push(DISPLAY_LEVEL_GOVERNORATE);
    }
    if (mapCurrentZoom >= ZOOM_THRESHOLD_TO_SHOW_AGGREGATED && mapCurrentZoom < ZOOM_THRESHOLD_TO_HIDE_AGGREGATED) {
      levels.push(DISPLAY_LEVEL_AGGREGATED);
      levels.push(DISPLAY_LEVEL_MAJOR_NEW_CITY);
    }
    if (mapCurrentZoom >= ZOOM_THRESHOLD_TO_SHOW_DISTRICT) {
      levels.push(DISPLAY_LEVEL_DISTRICT);
      if (!levels.includes(DISPLAY_LEVEL_AGGREGATED)) levels.push(DISPLAY_LEVEL_AGGREGATED);
      if (!levels.includes(DISPLAY_LEVEL_MAJOR_NEW_CITY)) levels.push(DISPLAY_LEVEL_MAJOR_NEW_CITY);
    }
    if (levels.length === 0 && mapCurrentZoom >= ZOOM_THRESHOLD_TO_SHOW_DISTRICT) { 
        levels.push(DISPLAY_LEVEL_DISTRICT);
    } else if (levels.length === 0) { // Default fallback if no conditions met (e.g. intermediate zoom)
        levels.push(DISPLAY_LEVEL_GOVERNORATE);
    }
    setMapCurrentDisplayLevels(levels);
  }, [mapCurrentZoom]);

  const operationalAreasToDisplayOnMap = useMemo(() => {
    if (!allOperationalAreasRaw) return [];
    return allOperationalAreasRaw.filter(oa => oa.displayLevel && mapCurrentDisplayLevels.includes(oa.displayLevel));
  }, [allOperationalAreasRaw, mapCurrentDisplayLevels]);

  const handleMapZoomChange = useCallback((newZoom: number) => {
    setMapCurrentZoom(newZoom);
  }, []);

  const {
    data: legacyCities,
    isLoading: isLoadingLegacyCities,
    error: legacyCitiesError
  } = useQuery<CityDto[], APIError>({
      queryKey: ['legacyCities'],
      queryFn: fetchCities,
      staleTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
    });

  const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
      queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
      queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
      enabled: !!activeOperationalArea?.slug,
      staleTime: 1000 * 60 * 5,
  });

  const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
      queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
      queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
      enabled: !!activeOperationalArea?.slug,
      staleTime: 1000 * 60 * 5,
  });

  const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
    if (!areas || areas.length === 0) return null;
    const relevantAreas = areas.filter(a => 
        a.displayLevel === DISPLAY_LEVEL_DISTRICT || 
        a.displayLevel === DISPLAY_LEVEL_AGGREGATED || 
        a.displayLevel === DISPLAY_LEVEL_MAJOR_NEW_CITY
    );
    const areasToSearch = relevantAreas.length > 0 ? relevantAreas : areas;
    return areasToSearch.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
      const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
      const distance = haversineDistance(userCoords, areaCoords);
      if (closest === null) return currentArea;
      const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
      const closestDistance = haversineDistance(userCoords, closestAreaCoords);
      return distance < closestDistance ? currentArea : closest;
    }, null);
  }, []);

  useEffect(() => {
    const areaSlugFromUrl = searchParams.get('area');
    let initialOaToSetActive: OperationalAreaDto | null = null;
    let derivedInitialZoom = mapCurrentZoom; // Start with current map zoom

    if (areaSlugFromUrl && allOperationalAreasRaw) {
        initialOaToSetActive = allOperationalAreasRaw.find(oa => oa.slug === areaSlugFromUrl) || null;
    } else if (contextLocation && allOperationalAreasRaw && !isLoadingInitialPreference && !activeOperationalArea) {
        initialOaToSetActive = findNearestOperationalArea(contextLocation, allOperationalAreasRaw);
    }

    if (initialOaToSetActive) {
        if (activeOperationalArea?.slug !== initialOaToSetActive.slug) {
            setActiveOperationalArea(initialOaToSetActive);
        }
        derivedInitialZoom = initialOaToSetActive.defaultMapZoomLevel || derivedInitialZoom; 
        
        if (areaSlugFromUrl !== initialOaToSetActive.slug || !searchParams.has('area')) {
            const newUrlParams = new URLSearchParams(searchParams.toString());
            newUrlParams.set('area', initialOaToSetActive.slug);
            if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
                newUrlParams.set('userLatitude', initialOaToSetActive.centroidLatitude.toString());
                newUrlParams.set('userLongitude', initialOaToSetActive.centroidLongitude.toString());
                newUrlParams.set('radiusInMeters', (initialOaToSetActive.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
            }
            newUrlParams.delete('city');
            router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
        }
    }
    // Only set map zoom if it's different, to avoid unnecessary re-renders/effects
    if (mapCurrentZoom !== derivedInitialZoom) {
      setMapCurrentZoom(derivedInitialZoom);
    }

  }, [allOperationalAreasRaw, contextLocation, searchParams, isLoadingInitialPreference, activeOperationalArea, findNearestOperationalArea, router, setContextLocation, mapCurrentZoom]);


  useEffect(() => {
    const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
    const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
    const urlRadiusStr = searchParams.get('radiusInMeters');

    if (urlLatStr && urlLonStr) {
      const lat = parseFloat(urlLatStr);
      const lon = parseFloat(urlLonStr);
      const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
      if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
        if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
          setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
        }
      }
    }
  }, [searchParams, contextLocation, setContextLocation]);
  

  const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
    clearContextGeoError();
    setPageLevelError(null);

    const selectedOA = allOperationalAreasRaw?.find(oa => oa.slug === areaProperties.slug);
    if (!selectedOA) {
        console.warn("Selected OA properties not found in allOperationalAreasRaw:", areaProperties);
        return;
    }

    setActiveOperationalArea(selectedOA);

    const areaLocation: UserGeoLocation = {
        latitude: selectedOA.centroidLatitude,
        longitude: selectedOA.centroidLongitude,
        radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
        timestamp: Date.now()
    };
    setContextLocation(areaLocation, 'manual');

    const newUrlParams = new URLSearchParams(searchParams.toString());
    newUrlParams.set("area", selectedOA.slug);
    newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
    newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
    newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
    newUrlParams.delete('city');

    const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
    const searchName = mainSearchInput?.value.trim();
    if (searchName) newUrlParams.set("name", searchName);
    else newUrlParams.delete("name");

    router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
    
    // Let MapViewController handle zoom via activeOperationalAreaSlug prop.
    // The zoom change will trigger handleMapZoomChange, updating display levels.
    if(selectedOA.defaultMapZoomLevel && mapCurrentZoom !== selectedOA.defaultMapZoomLevel) {
        setMapCurrentZoom(selectedOA.defaultMapZoomLevel);
    }

  }, [allOperationalAreasRaw, contextLocation?.radiusInMeters, router, searchParams, setContextLocation, clearContextGeoError, mapCurrentZoom]);

  const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
    setProcessingSubCategoryId(subCategorySlug);
    setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

    const queryForNextPage = new URLSearchParams();
    const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
    const searchName = mainSearchInput?.value.trim();
    if (searchName) queryForNextPage.set("name", searchName);

    let locationToUse: UserGeoLocation | null = contextLocation;
    let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

    if (!areaToUseSlug) {
        let detectedLocationForSubCat: UserGeoLocation | null = null;
        if (!locationToUse) {
            detectedLocationForSubCat = await attemptBrowserGpsLocation({
                onError: (errMsg, errCode) => {
                    if (errCode !== 1 ) {
                        setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
                    }
                }
            });
            locationToUse = detectedLocationForSubCat;
        }
        if (locationToUse && allOperationalAreasRaw && allOperationalAreasRaw.length > 0) {
            const nearestArea = findNearestOperationalArea(locationToUse, allOperationalAreasRaw);
            if (nearestArea) {
                areaToUseSlug = nearestArea.slug;
                if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
                    setActiveOperationalArea(nearestArea);
                }
            } else {
                setPageLevelError("Could not determine a nearby operational area based on your location.");
            }
        }
        if (!areaToUseSlug) {
            setIsRedirecting(true);
            const redirectParams = new URLSearchParams();
            if (searchName) redirectParams.set("name", searchName);
            redirectParams.set("subCategory", subCategorySlug);
            redirectParams.set("concept", conceptPageSlugForFallback);
            router.push(`/select-area?${redirectParams.toString()}`);
            setProcessingSubCategoryId(null); return;
        }
    }
    if (locationToUse) {
        queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
        queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
        queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
        queryForNextPage.set("sortBy", "distance_asc");
    }
    router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
    setProcessingSubCategoryId(null);
  };

  const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
    setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
    const searchName = submittedCriteria.name;
    const newUrlParams = new URLSearchParams();
    if (searchName) newUrlParams.set("name", searchName);

    let targetOperationalArea = activeOperationalArea;

    if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
        if (isLoadingOperationalAreas || !allOperationalAreasRaw || allOperationalAreasRaw.length === 0) {
            setPageLevelError("Operational area data is loading. Please try again shortly.");
            setIsProcessingHeroAction(false); return;
        }
        const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
        const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
        const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

        setContextLocation(newGpsLocation, 'gps');

        const nearestArea = findNearestOperationalArea(userCoords, allOperationalAreasRaw);
        if (nearestArea) {
            targetOperationalArea = nearestArea;
            if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
            newUrlParams.set('area', nearestArea.slug);
        } else {
            newUrlParams.delete('area');
            setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
        }
        newUrlParams.set("userLatitude", userCoords.latitude.toString());
        newUrlParams.set("userLongitude", userCoords.longitude.toString());
        newUrlParams.set("radiusInMeters", searchRadius.toString());
        newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
    } else {
        if (targetOperationalArea) {
            newUrlParams.set('area', targetOperationalArea.slug);
            if (contextLocation) {
                newUrlParams.set("userLatitude", contextLocation.latitude.toString());
                newUrlParams.set("userLongitude", contextLocation.longitude.toString());
                newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
            } else {
                newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
                newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
                newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
            }
        } else if (contextLocation) {
             newUrlParams.set("userLatitude", contextLocation.latitude.toString());
             newUrlParams.set("userLongitude", contextLocation.longitude.toString());
             newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
        }
        if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
    }

    const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
    const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
                                            ? firstPredefinedConceptGroup.subCategories[0].slug
                                            : "general-maintenance";

    if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
        router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
    } else if (searchName && !targetOperationalArea) {
        router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
        setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
    } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
    } else {
        router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
    }
    setIsProcessingHeroAction(false);
  };

  const handleCityCardClick = (city: CityDto) => {
    clearContextGeoError(); setPageLevelError(null);
    const correspondingOA = allOperationalAreasRaw?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
    if (correspondingOA) {
        setActiveOperationalArea(correspondingOA);
        const areaLocation: UserGeoLocation = {
            latitude: correspondingOA.centroidLatitude,
            longitude: correspondingOA.centroidLongitude,
            radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
            timestamp: Date.now()
        };
        setContextLocation(areaLocation, 'manual');

        const newUrlParams = new URLSearchParams(searchParams.toString());
        newUrlParams.set("area", correspondingOA.slug);
        newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
        newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
        newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
        newUrlParams.delete('city');
        router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
    } else {
        setActiveLegacyCity(city);
        const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
        setContextLocation(cityLocation, 'manual_city');
        const newUrlParams = new URLSearchParams(searchParams.toString());
        newUrlParams.set("city", city.slug);
        newUrlParams.set("userLatitude", city.latitude.toString());
        newUrlParams.set("userLongitude", city.longitude.toString());
        newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
        newUrlParams.delete('area');
        router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
    }
  };

  const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
    if (!activeOperationalArea) {
        setPageLevelError("Please select an operational area first to explore services.");
        return;
    }
    const query = new URLSearchParams(searchParams.toString());
    query.delete('city');
    query.set('area', activeOperationalArea.slug);
    router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
  };

  const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
    const nameFromUrl = searchParams.get('name') || '';
    const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
    const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
    const urlRadius = searchParams.get('radiusInMeters');
    const urlSortBy = searchParams.get('sortBy');

    if (urlLat && urlLon) {
        return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
    } else if (contextLocation) {
        const sortByValue = urlSortBy ||
                            (contextLocation.source &&
                             (contextLocation.source.startsWith('gps') ||
                              contextLocation.source === 'preference_loaded' ||
                              contextLocation.source === 'manual'
                             ) ? 'distance_asc' : undefined);
        return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
    }
    return { name: nameFromUrl, sortBy: urlSortBy || undefined };
  }, [searchParams, contextLocation, activeOperationalArea]);

  const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
    if (!activeOperationalArea?.slug) {
        const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
        return conceptGroup?.subCategories.map(sc => ({
            name: sc.name, slug: sc.slug, shopCount: 0, subCategoryEnum: 0, 
            concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
        })) || []; 
    }
    if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
    if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
    return [];
  };
  
  const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
    if (!activeOperationalArea?.slug) return false; 
    if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
    if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
    return false;
  };

  const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
  const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;
  const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";
  const STICKY_SEARCH_TOP_OFFSET = "top-0"; 

  return (
     <div className="relative min-h-screen overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <HeroBillboard
          minHeight="min-h-screen" 
          isMapMode={true}
          operationalAreas={operationalAreasToDisplayOnMap} 
          isLoadingMapData={isLoadingOperationalAreas || isLoadingEgyptBoundary}
          onOperationalAreaSelect={handleOperationalAreaSelect}
          activeOperationalAreaSlug={activeOperationalArea?.slug || null}
          initialMapCenter={ activeOperationalArea ? 
                                [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : 
                                (contextLocation ? [contextLocation.latitude, contextLocation.longitude] : [26.8206, 30.8025])
                          }
          initialMapZoom={mapCurrentZoom} 
          onMapZoomChange={handleMapZoomChange} 
          egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
          title="Automotive Services & Parts"
          subtitle="Click an area on the map or use the search below to find what you need."
          headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} 
        />
      </div>

      <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
          <div className="h-[calc(40vh)] flex-shrink-0">
          </div>
          
          <div className="flex-grow w-full bg-black/60 backdrop-blur-xl border-t-2 border-white/20 shadow-2xl rounded-t-[2rem] sm:rounded-t-[3rem] overflow-hidden pointer-events-auto">
            <div className={`w-full bg-black/40 backdrop-filter backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 md:p-5 sticky ${STICKY_SEARCH_TOP_OFFSET} z-20`}>
              <div className="max-w-3xl mx-auto">
                <ShopSearchForm
                  onSubmit={handlePageSearchSubmit}
                  initialValues={initialPageSearchValues}
                  isLoading={isProcessingHeroAction || isLoadingGeo}
                  formInstanceId="page-shop-search"
                  showDetectLocationButton={true}
                />
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
              {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
                <div className="mb-6 p-3 sm:p-4 bg-blue-600/30 backdrop-blur-sm border border-blue-500/50 rounded-lg text-center shadow-md">
                  <p className="text-sm sm:text-base text-blue-100">
                    {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
                  </p>
                </div>
              )}
              {activeOperationalArea && (
                <div className="mb-6 sm:mb-8 text-center p-3 bg-black/40 backdrop-blur-md rounded-lg shadow-xl">
                  <p className="text-base sm:text-lg text-slate-50">
                    Showing services and parts for: <span className="font-semibold text-emerald-300">{activeOperationalArea.nameEn}</span>
                    {activeOperationalArea.displayLevel && (
                        <span className="text-xs text-slate-400 ml-2">({activeOperationalArea.displayLevel})</span>
                    )}
                  </p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setActiveOperationalArea(null);
                      setMapCurrentZoom(DEFAULT_INITIAL_ZOOM);
                      const newUrlParams = new URLSearchParams(searchParams.toString());
                      newUrlParams.delete('area');
                      router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
                    }}
                    className="text-xs text-slate-300 hover:text-emerald-200 active:text-emerald-100 mt-1"
                  >
                    (Change area or use current location)
                  </Button>
                </div>
              )}

              {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
                <div className="text-center my-4 sm:my-6 p-3 bg-blue-600/40 backdrop-blur-sm text-blue-50 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
                </div>
              )}
              {pageLevelError && !isRedirecting && (
                <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
                  {pageLevelError}
                </div>
              )}
              {showGenericGeoError && contextGeoError && (
                <div className="text-center my-4 sm:my-6 p-3 bg-yellow-600/40 backdrop-blur-sm text-yellow-50 rounded-md shadow-md text-sm">
                  Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
                </div>
              )}
              {operationalAreasError && (
                  <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
                    Error loading operational areas: {operationalAreasError.message}
                  </div>
              )}

            {predefinedHomepageConcepts.map((conceptGroup) => {
                const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
                const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

                if (!conceptGroup.concept) return null;
                
                return (
                  <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
                    <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
                      <div className="flex-1 min-w-0"> 
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
                          {conceptGroup.concept.nameEn}
                          {activeOperationalArea && (
                            <span className="block text-sm sm:text-lg font-normal text-slate-300 mt-0.5 sm:mt-0 sm:ml-2 sm:inline text-shadow-medium">
                              in {activeOperationalArea.nameEn}
                            </span>
                          )}
                        </h2>
                      </div>
                      {activeOperationalArea && actualSubCategories.length > 0 && (
                        <Button
                          variant="default" 
                          size="sm"
                          onClick={() => handleExploreMoreClick(conceptGroup.concept)}
                          className={cn(
                            "font-medium flex-shrink-0",
                            "bg-black/50 active:bg-black/60",
                            "text-emerald-400 active:text-emerald-300", 
                            "border border-black/20", 
                            "backdrop-blur-sm shadow-lg", 
                            "transition-all duration-150 ease-in-out rounded-md px-3 py-1.5 sm:px-4",
                            "focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-transparent"
                          )}
                        >
                          Explore All <ChevronRight className="w-4 h-4 ml-1 sm:ml-1.5"/>
                        </Button>
                      )}
                    </div>

                    {isLoadingThisCarousel ? (
                      <div className="h-32 sm:h-40 flex justify-center items-center">
                        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-300"/>
                      </div>
                    ) : actualSubCategories.length > 0 ? (
                      <div className="relative">
                        <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
                          <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
                            {actualSubCategories.map((subCat, index) => (
                              <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
                                <div className="p-0.5 h-full"> 
                                  <SubCategoryCarouselItem 
                                    subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
                                    onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
                                    shopCount={subCat.shopCount}
                                    isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
                                    className="bg-black/30 border border-white/10 shadow-lg" 
                                    textClassName="text-slate-100 text-shadow-medium" 
                                    iconClassName="text-emerald-400"   
                                  />
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <div className="flex justify-center items-center gap-6 mt-6 sm:hidden">
                            <CarouselPrevious 
                                className="static translate-y-0 h-10 w-10 text-white bg-black/50 active:bg-black/60 border border-white/20 backdrop-blur-md shadow-lg rounded-full"
                            />
                            <CarouselNext 
                                className="static translate-y-0 h-10 w-10 text-white bg-black/50 active:bg-black/60 border border-white/20 backdrop-blur-md shadow-lg rounded-full"
                            />
                          </div>
                          <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 active:bg-black/50 border border-white/30 backdrop-blur-md shadow-lg" />
                          <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 active:bg-black/50 border border-white/30 backdrop-blur-md shadow-lg" />
                        </Carousel>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
                                              : "Select an area on the map or allow location access to see available services."}
                      </p>
                    )}
                  </section>
                );
            })}

            <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
              <div className="text-center mb-8 md:mb-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
                  Or, Browse by City (Legacy)
                </h2>
                <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
                  {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
                </p>
              </div>

              {isLoadingLegacyCities ? (
                <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-300 animate-spin mx-auto" /></div>
              ) : legacyCitiesError ? (
                <div className="my-6 p-4 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
              ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
                  <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
              ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                  {legacyCities.map((city: CityDto) => (
                    <div key={city.id} className="p-0.5">
                        <CityCard 
                          city={city}
                          onClick={() => handleCityCardClick(city)}
                          className="bg-black/30 border border-white/10 shadow-lg" 
                        />
                    </div>
                  ))}
                </div>
              ): null}
            </section>
            </div> 
          </div> 
      </div> 
    </div> 
  );
}
// 'use client';

// import React, { useState, useMemo, useEffect, useCallback } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { useQuery } from '@tanstack/react-query';
// import {
//     fetchCities,
//     fetchOperationalAreasForMap,
//     fetchSubCategoriesByOperationalArea
// } from '@/lib/apiClient';
// import {
//     CityDto,
//     OperationalAreaDto,
//     OperationalAreaFeatureProperties,
//     APIError,
//     FrontendShopQueryParameters,
//     SubCategoryDto,
//     HighLevelConceptQueryParam
// } from '@/types/api';
// import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// import HeroBillboard from '@/components/common/HeroBillboard';
// import CityCard from '@/components/city/CityCard';
// import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// import { Button } from '@/components/ui/button';
// import {
//   Carousel,
//   CarouselContent,
//   CarouselItem,
//   CarouselNext,
//   CarouselPrevious,
// } from "@/components/ui/carousel";
// import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
// import ShopSearchForm from '@/components/search/ShopSearchForm';
// import { cn } from '@/lib/utils';

// //import egyptBoundaryData from '@/data/egypt_boundary.json';
// import { useGeoData } from '@/contexts/GeoDataContext';

// // Define constants for display levels and zoom thresholds (tune these)
// const DISPLAY_LEVEL_GOVERNORATE = "Governorate";
// const DISPLAY_LEVEL_AGGREGATED = "AggregatedUrbanArea"; // Includes MajorNewCity for simplicity here
// const DISPLAY_LEVEL_MAJOR_NEW_CITY = "MajorNewCity";
// const DISPLAY_LEVEL_DISTRICT = "District";

// const ZOOM_THRESHOLD_GOV_TO_AGG = 8; // Zoom level to switch from Governorate to Aggregated/MajorNewCity
// const ZOOM_THRESHOLD_AGG_TO_DISTRICT = 10; // Zoom level to switch from Aggregated to District


// type HeroSearchSubmitParams = Pick<
//   FrontendShopQueryParameters,
//   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// >;

// const DEFAULT_SEARCH_RADIUS = 50000;

// export default function HomePage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const { egyptBoundaryGeoJsonString, isLoadingEgyptBoundary } = useGeoData(); // <<< USE CONTEXT

  

//   const {
//     currentLocation: contextLocation,
//     setCurrentLocation: setContextLocation,
//     isLoading: isLoadingContextLocation,
//     error: contextGeoError,
//     clearError: clearContextGeoError,
//     attemptBrowserGpsLocation,
//     isLoadingInitialPreference,
//   } = useUserGeoLocation();

//   // const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
//   // const [pageLevelError, setPageLevelError] = useState<string | null>(null);
//   // const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
//   // const [isRedirecting, setIsRedirecting] = useState(false);

//   // const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
//   // const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

//   // const [currentMapDisplayLevel, setCurrentMapDisplayLevel] = useState<string | null>(null); // e.g., "Governorate", "District", null for default
//   // const [parentOASlugForFilter, setParentOASlugForFilter] = useState<string | null>(null); // To filter districts within a selected governorate


//   // const {
//   //   data: operationalAreas,
//   //   isLoading: isLoadingOperationalAreas,
//   //   error: operationalAreasError
//   // } = useQuery<OperationalAreaDto[], APIError>({
//   //   queryKey: ['operationalAreasForMap'],
//   //   queryFn: fetchOperationalAreasForMap,
//   //   staleTime: 1000 * 60 * 60,
//   //   refetchOnWindowFocus: false,
//   // });
//    const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
//   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
//   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
//   const [isRedirecting, setIsRedirecting] = useState(false);

//   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
//   // const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null); // Keep if used

//   // State for map's current view characteristics
//   const [mapCurrentZoom, setMapCurrentZoom] = useState<number>(6); // Initial default zoom
//   const [mapCurrentDisplayLevels, setMapCurrentDisplayLevels] = useState<string[]>([DISPLAY_LEVEL_GOVERNORATE]);

//   // const {
//   //   data: operationalAreasRaw, // Raw data from API
//   //   isLoading: isLoadingOperationalAreas,
//   //   error: operationalAreasError,
//   //   refetch: refetchOperationalAreas // To refetch if displayLevel changes
//   // } = useQuery<OperationalAreaDto[], APIError>({
//   //   // Query key could include currentMapDisplayLevel if fetchOperationalAreasForMap uses it
//   //   queryKey: ['operationalAreasForMap', currentMapDisplayLevel],
//   //   queryFn: () => fetchOperationalAreasForMap(currentMapDisplayLevel || undefined), // Pass displayLevel or undefined
//   //   staleTime: 1000 * 60 * 60,
//   //   refetchOnWindowFocus: false,
//   // });
//   const {
//     data: allOperationalAreasRaw,
//     isLoading: isLoadingOperationalAreas,
//     error: operationalAreasError
//   } = useQuery<OperationalAreaDto[], APIError>({
//     queryKey: ['allOperationalAreasForMap'], // Fetch all, no displayLevel filter here
//     queryFn: () => fetchOperationalAreasForMap(undefined), // Pass undefined to fetch all
//     staleTime: 1000 * 60 * 60, // 1 hour
//     refetchOnWindowFocus: false,
//   });

//    // Memoized list of OAs to actually display on the map based on current zoom-derived display levels
//   const operationalAreasToDisplayOnMap = useMemo(() => {
//     if (!allOperationalAreasRaw) return [];
//     return allOperationalAreasRaw.filter(oa => oa.displayLevel && mapCurrentDisplayLevels.includes(oa.displayLevel));
//   }, [allOperationalAreasRaw, mapCurrentDisplayLevels]);

//    // This effect updates which OA levels should be visible based on map zoom
//   useEffect(() => {
//     if (mapCurrentZoom < ZOOM_THRESHOLD_GOV_TO_AGG) {
//       setMapCurrentDisplayLevels([DISPLAY_LEVEL_GOVERNORATE]);
//     } else if (mapCurrentZoom < ZOOM_THRESHOLD_AGG_TO_DISTRICT) {
//       setMapCurrentDisplayLevels([DISPLAY_LEVEL_AGGREGATED, DISPLAY_LEVEL_MAJOR_NEW_CITY]);
//     } else {
//       setMapCurrentDisplayLevels([DISPLAY_LEVEL_DISTRICT, DISPLAY_LEVEL_AGGREGATED, DISPLAY_LEVEL_MAJOR_NEW_CITY]); // Show districts and potentially still aggregated ones
//     }
//   }, [mapCurrentZoom]);

//   // Callback for HeroBillboard to inform HomePage of map zoom changes
//   const handleMapZoomChange = useCallback((newZoom: number) => {
//     setMapCurrentZoom(newZoom);
//   }, []);



//   const {
//     data: legacyCities,
//     isLoading: isLoadingLegacyCities,
//     error: legacyCitiesError
//   } = useQuery<CityDto[], APIError>({
//       queryKey: ['legacyCities'],
//       queryFn: fetchCities,
//       staleTime: 1000 * 60 * 60,
//       refetchOnWindowFocus: false,
//     });

//   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
//       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
//       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
//       enabled: !!activeOperationalArea?.slug,
//       staleTime: 1000 * 60 * 5,
//   });

//   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
//       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
//       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
//       enabled: !!activeOperationalArea?.slug,
//       staleTime: 1000 * 60 * 5,
//   });

//   // const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
//   //   if (!areas || areas.length === 0) return null;
//   //   return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
//   //     const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
//   //     const distance = haversineDistance(userCoords, areaCoords);
//   //     if (closest === null) return currentArea;
//   //     const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
//   //     const closestDistance = haversineDistance(userCoords, closestAreaCoords);
//   //     return distance < closestDistance ? currentArea : closest;
//   //   }, null);
//   // }, []);
//    const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
//     if (!areas || areas.length === 0) return null;
//     // Filter for more granular areas for nearest matching, or allow all if needed
//     const relevantAreas = areas.filter(a => a.displayLevel === DISPLAY_LEVEL_DISTRICT || a.displayLevel === DISPLAY_LEVEL_AGGREGATED || a.displayLevel === DISPLAY_LEVEL_MAJOR_NEW_CITY );
//     if(relevantAreas.length === 0 && areas.length > 0) return areas[0]; // fallback if no granular areas

//     return relevantAreas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
//       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
//       const distance = haversineDistance(userCoords, areaCoords);
//       if (closest === null) return currentArea;
//       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
//       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
//       return distance < closestDistance ? currentArea : closest;
//     }, null);
//   }, []);

//   useEffect(() => {
//     if (contextLocation && allOperationalAreasRaw && allOperationalAreasRaw.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
//       // When finding nearest, use allOperationalAreasRaw which contains all levels.
//       // The findNearestOperationalArea function can then decide which levels are appropriate for "nearest".
//       const nearestArea = findNearestOperationalArea(contextLocation, allOperationalAreasRaw);
//       if (nearestArea) {
//         setActiveOperationalArea(nearestArea);
//         const areaSlugFromUrl = searchParams.get('area');
//         if (areaSlugFromUrl !== nearestArea.slug) {
//             const newUrlParams = new URLSearchParams(searchParams.toString());
//             newUrlParams.set('area', nearestArea.slug);
//             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
//             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
//             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
//             newUrlParams.delete('city');
//             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//         }
//       }
//     }
//   }, [contextLocation, allOperationalAreasRaw, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

//   useEffect(() => {
//     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
//     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
//     const urlRadiusStr = searchParams.get('radiusInMeters');

//     if (urlLatStr && urlLonStr) {
//       const lat = parseFloat(urlLatStr);
//       const lon = parseFloat(urlLonStr);
//       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
//       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
//         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
//           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
//         }
//       }
//     }
//   }, [searchParams, contextLocation, setContextLocation]);

//   useEffect(() => {
//     const areaSlugFromUrl = searchParams.get('area');
//     if (areaSlugFromUrl && allOperationalAreasRaw && allOperationalAreasRaw.length > 0) {
//         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
//             const areaFromUrl = allOperationalAreasRaw.find(oa => oa.slug === areaSlugFromUrl);
//             if (areaFromUrl) {
//                 setActiveOperationalArea(areaFromUrl);
//                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
//                     setContextLocation({
//                         latitude: areaFromUrl.centroidLatitude,
//                         longitude: areaFromUrl.centroidLongitude,
//                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
//                         timestamp: Date.now()
//                     }, 'url_param');
//                 }
//             }
//         }
//     }
//   }, [searchParams, allOperationalAreasRaw, activeOperationalArea, setContextLocation]);

//   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
//     clearContextGeoError();
//     setPageLevelError(null);


//      // Find the full OA object from allOperationalAreasRaw using the slug from areaProperties
//     const selectedOA = allOperationalAreasRaw?.find(oa => oa.slug === areaProperties.slug);
//     if (!selectedOA) {
//         console.warn("Selected OA properties not found in allOperationalAreasRaw:", areaProperties);
//         return;
//     }


//     setActiveOperationalArea(selectedOA);

//      // Update location context to the centroid of the clicked area
//     const areaLocation: UserGeoLocation = {
//         latitude: selectedOA.centroidLatitude,
//         longitude: selectedOA.centroidLongitude,
//         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
//         timestamp: Date.now()
//     };
//     setContextLocation(areaLocation, 'manual');

//     // Update URL params for context
//     const newUrlParams = new URLSearchParams(searchParams.toString());
//     newUrlParams.set("area", selectedOA.slug);
//     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
//     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
//     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
//     newUrlParams.delete('city'); // Assuming city is legacy

//     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
//     const searchName = mainSearchInput?.value.trim();
//     if (searchName) newUrlParams.set("name", searchName);
//     else newUrlParams.delete("name");

//     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });

//   }, [allOperationalAreasRaw, contextLocation?.radiusInMeters, router, searchParams, setContextLocation, clearContextGeoError]);


//   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
//     setProcessingSubCategoryId(subCategorySlug);
//     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

//     const queryForNextPage = new URLSearchParams();
//     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
//     const searchName = mainSearchInput?.value.trim();
//     if (searchName) queryForNextPage.set("name", searchName);

//     let locationToUse: UserGeoLocation | null = contextLocation;
//     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

//     if (!areaToUseSlug) {
//         let detectedLocationForSubCat: UserGeoLocation | null = null;
//         if (!locationToUse) {
//             detectedLocationForSubCat = await attemptBrowserGpsLocation({
//                 onError: (errMsg, errCode) => {
//                     if (errCode !== 1 ) {
//                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
//                     }
//                 }
//             });
//             locationToUse = detectedLocationForSubCat;
//         }
//         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
//             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
//             if (nearestArea) {
//                 areaToUseSlug = nearestArea.slug;
//                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
//                     setActiveOperationalArea(nearestArea);
//                 }
//             } else {
//                 setPageLevelError("Could not determine a nearby operational area based on your location.");
//             }
//         }
//         if (!areaToUseSlug) {
//             setIsRedirecting(true);
//             const redirectParams = new URLSearchParams();
//             if (searchName) redirectParams.set("name", searchName);
//             redirectParams.set("subCategory", subCategorySlug);
//             redirectParams.set("concept", conceptPageSlugForFallback);
//             router.push(`/select-area?${redirectParams.toString()}`);
//             setProcessingSubCategoryId(null); return;
//         }
//     }
//     if (locationToUse) {
//         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
//         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
//         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
//         queryForNextPage.set("sortBy", "distance_asc");
//     }
//     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
//     setProcessingSubCategoryId(null);
//   };

//   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
//     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
//     const searchName = submittedCriteria.name;
//     const newUrlParams = new URLSearchParams();
//     if (searchName) newUrlParams.set("name", searchName);

//     let targetOperationalArea = activeOperationalArea;

//     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
//         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
//             setPageLevelError("Operational area data is loading. Please try again shortly.");
//             setIsProcessingHeroAction(false); return;
//         }
//         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
//         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
//         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

//         setContextLocation(newGpsLocation, 'gps');

//         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
//         if (nearestArea) {
//             targetOperationalArea = nearestArea;
//             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
//             newUrlParams.set('area', nearestArea.slug);
//         } else {
//             newUrlParams.delete('area');
//             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
//         }
//         newUrlParams.set("userLatitude", userCoords.latitude.toString());
//         newUrlParams.set("userLongitude", userCoords.longitude.toString());
//         newUrlParams.set("radiusInMeters", searchRadius.toString());
//         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
//     } else {
//         if (targetOperationalArea) {
//             newUrlParams.set('area', targetOperationalArea.slug);
//             if (contextLocation) {
//                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
//                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
//                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
//             } else {
//                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
//                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
//                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
//             }
//         } else if (contextLocation) {
//              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
//              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
//              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
//         }
//         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
//     }

//     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
//     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
//                                             ? firstPredefinedConceptGroup.subCategories[0].slug
//                                             : "general-maintenance";

//     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
//         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
//     } else if (searchName && !targetOperationalArea) {
//         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
//     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
//          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//     } else {
//         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//     }
//     setIsProcessingHeroAction(false);
//   };

//   const handleCityCardClick = (city: CityDto) => {
//     clearContextGeoError(); setPageLevelError(null);
//     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
//     if (correspondingOA) {
//         setActiveOperationalArea(correspondingOA);
//         const areaLocation: UserGeoLocation = {
//             latitude: correspondingOA.centroidLatitude,
//             longitude: correspondingOA.centroidLongitude,
//             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
//             timestamp: Date.now()
//         };
//         setContextLocation(areaLocation, 'manual');

//         const newUrlParams = new URLSearchParams(searchParams.toString());
//         newUrlParams.set("area", correspondingOA.slug);
//         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
//         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
//         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
//         newUrlParams.delete('city');
//         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//     } else {
//         setActiveLegacyCity(city);
//         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
//         setContextLocation(cityLocation, 'manual_city');
//         const newUrlParams = new URLSearchParams(searchParams.toString());
//         newUrlParams.set("city", city.slug);
//         newUrlParams.set("userLatitude", city.latitude.toString());
//         newUrlParams.set("userLongitude", city.longitude.toString());
//         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
//         newUrlParams.delete('area');
//         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//     }
//   };

//   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
//     if (!activeOperationalArea) {
//         setPageLevelError("Please select an operational area first to explore services.");
//         return;
//     }
//     const query = new URLSearchParams(searchParams.toString());
//     query.delete('city');
//     query.set('area', activeOperationalArea.slug);

//     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
//   };

//   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
//     const nameFromUrl = searchParams.get('name') || '';
//     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
//     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
//     const urlRadius = searchParams.get('radiusInMeters');
//     const urlSortBy = searchParams.get('sortBy');

//     if (urlLat && urlLon) {
//         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
//     } else if (contextLocation) {
//         const sortByValue = urlSortBy ||
//                             (contextLocation.source &&
//                              (contextLocation.source.startsWith('gps') ||
//                               contextLocation.source === 'preference_loaded' ||
//                               contextLocation.source === 'manual'
//                              ) ? 'distance_asc' : undefined);
//         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
//     }
//     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
//   }, [searchParams, contextLocation, activeOperationalArea]);

//   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
//   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

//   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
//     if (!activeOperationalArea?.slug) {
//         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
//         return conceptGroup?.subCategories.map(sc => ({
//             name: sc.name,
//             slug: sc.slug,
//             shopCount: 0,
//             subCategoryEnum: 0, 
//             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
//         })) || []; 
//     }
//     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
//     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
//     return [];
//   };
  
//   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
//     if (!activeOperationalArea?.slug) return false; 
//     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
//     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
//     return false;
//   };

//   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";
//   const STICKY_SEARCH_TOP_OFFSET = "top-0"; 

//   return (
//      <div className="relative min-h-screen overflow-x-hidden">
//       <div className="fixed inset-0 z-0">
//         <HeroBillboard
//           minHeight="min-h-screen" 
//           isMapMode={true}
//           operationalAreas={operationalAreas || []}
//           isLoadingMapData={isLoadingOperationalAreas}
//           onOperationalAreaSelect={handleOperationalAreaSelect}
//           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
//           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
//           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
//           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
//           title="Automotive Services & Parts"
//           subtitle="Click an area on the map or use the search below to find what you need."
//           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} 
//         />
//       </div>

//       <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
//           <div className="h-[calc(40vh)] flex-shrink-0">
//           </div>
          
//           <div className="flex-grow w-full bg-black/60 backdrop-blur-xl border-t-2 border-white/20 shadow-2xl rounded-t-[2rem] sm:rounded-t-[3rem] overflow-hidden pointer-events-auto">
//             <div className={`w-full bg-black/40 backdrop-filter backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 md:p-5 sticky ${STICKY_SEARCH_TOP_OFFSET} z-20`}>
//               <div className="max-w-3xl mx-auto">
//                 <ShopSearchForm
//                   onSubmit={handlePageSearchSubmit}
//                   initialValues={initialPageSearchValues}
//                   isLoading={isProcessingHeroAction || isLoadingGeo}
//                   formInstanceId="page-shop-search"
//                   showDetectLocationButton={true}
//                 />
//               </div>
//             </div>

//             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
//               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
//                 <div className="mb-6 p-3 sm:p-4 bg-blue-600/30 backdrop-blur-sm border border-blue-500/50 rounded-lg text-center shadow-md">
//                   <p className="text-sm sm:text-base text-blue-100">
//                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
//                   </p>
//                 </div>
//               )}
//               {activeOperationalArea && (
//                 <div className="mb-6 sm:mb-8 text-center p-3 bg-black/40 backdrop-blur-md rounded-lg shadow-xl">
//                   <p className="text-base sm:text-lg text-slate-50">
//                     Showing services and parts for: <span className="font-semibold text-emerald-300">{activeOperationalArea.nameEn}</span>
//                   </p>
//                   <Button
//                     variant="link"
//                     onClick={() => {
//                       setActiveOperationalArea(null);
//                       const newUrlParams = new URLSearchParams(searchParams.toString());
//                       newUrlParams.delete('area');
//                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
//                     }}
//                     className="text-xs text-slate-300 hover:text-emerald-200 active:text-emerald-100 mt-1"
//                   >
//                     (Change area or use current location)
//                   </Button>
//                 </div>
//               )}

//               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
//                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-600/40 backdrop-blur-sm text-blue-50 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
//                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
//                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
//                 </div>
//               )}
//               {pageLevelError && !isRedirecting && (
//                 <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
//                   {pageLevelError}
//                 </div>
//               )}
//               {showGenericGeoError && contextGeoError && (
//                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-600/40 backdrop-blur-sm text-yellow-50 rounded-md shadow-md text-sm">
//                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
//                 </div>
//               )}
//               {operationalAreasError && (
//                   <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
//                     Error loading operational areas: {operationalAreasError.message}
//                   </div>
//               )}

//             {predefinedHomepageConcepts.map((conceptGroup) => {
//                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
//                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

//                 if (!conceptGroup.concept) return null;
//                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;
                
//                 return (
//                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
//                     {/* MODIFIED: Title and Explore All button layout for mobile */}
//                     <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
//                       <div className="flex-1 min-w-0"> {/* Wrapper for title */}
//                         <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
//                           {conceptGroup.concept.nameEn}
//                           {activeOperationalArea && (
//                             <span className="block text-sm sm:text-lg font-normal text-slate-300 mt-0.5 sm:mt-0 sm:ml-2 sm:inline text-shadow-medium">
//                               in {activeOperationalArea.nameEn}
//                             </span>
//                           )}
//                         </h2>
//                       </div>
//                       {activeOperationalArea && actualSubCategories.length > 0 && (
//                         <Button
//                           variant="default" 
//                           size="sm"
//                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
//                           className={cn(
//                             "font-medium flex-shrink-0", // flex-shrink-0 to prevent button from shrinking
//                             "bg-black/50 active:bg-black/60",
//                             "text-emerald-400 active:text-emerald-300", 
//                             "border border-black/20", 
//                             "backdrop-blur-sm shadow-lg", 
//                             "transition-all duration-150 ease-in-out rounded-md px-3 py-1.5 sm:px-4",
//                             "focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-transparent"
//                           )}
//                         >
//                           Explore All <ChevronRight className="w-4 h-4 ml-1 sm:ml-1.5"/>
//                         </Button>
//                       )}
//                     </div>
//                     {/* END MODIFIED Section Header */}

//                     {isLoadingThisCarousel ? (
//                       <div className="h-32 sm:h-40 flex justify-center items-center">
//                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-300"/>
//                       </div>
//                     ) : actualSubCategories.length > 0 ? (
//                       <div className="relative">
//                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
//                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
//                             {actualSubCategories.map((subCat, index) => (
//                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
//                                 <div className="p-0.5 h-full"> 
//                                   <SubCategoryCarouselItem 
//                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
//                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
//                                     shopCount={subCat.shopCount}
//                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
//                                     className="bg-black/30 border border-white/10 shadow-lg" 
//                                     textClassName="text-slate-100 text-shadow-medium" 
//                                     iconClassName="text-emerald-400"   
//                                   />
//                                 </div>
//                               </CarouselItem>
//                             ))}
//                           </CarouselContent>
//                           {/* MODIFIED: Mobile Carousel Arrows */}
//                           <div className="flex justify-center items-center gap-6 mt-6 sm:hidden">
//                             <CarouselPrevious 
//                                 className="static translate-y-0 h-10 w-10 text-white bg-black/50 active:bg-black/60 border border-white/20 backdrop-blur-md shadow-lg rounded-full"
//                             />
//                             <CarouselNext 
//                                 className="static translate-y-0 h-10 w-10 text-white bg-black/50 active:bg-black/60 border border-white/20 backdrop-blur-md shadow-lg rounded-full"
//                             />
//                           </div>
//                           {/* END MODIFIED Arrows */}
//                           <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 active:bg-black/50 border border-white/30 backdrop-blur-md shadow-lg" />
//                           <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 active:bg-black/50 border border-white/30 backdrop-blur-md shadow-lg" />
//                         </Carousel>
//                       </div>
//                     ) : (
//                       <p className="text-slate-400 text-sm">
//                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
//                                               : "Select an area on the map or allow location access to see available services."}
//                       </p>
//                     )}
//                   </section>
//                 );
//             })}

//             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
//               <div className="text-center mb-8 md:mb-10">
//                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
//                   Or, Browse by City (Legacy)
//                 </h2>
//                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
//                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
//                 </p>
//               </div>

//               {isLoadingLegacyCities ? (
//                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-300 animate-spin mx-auto" /></div>
//               ) : legacyCitiesError ? (
//                 <div className="my-6 p-4 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
//               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
//                   <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
//               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
//                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
//                   {legacyCities.map((city: CityDto) => (
//                     <div key={city.id} className="p-0.5">
//                         <CityCard 
//                           city={city}
//                           onClick={() => handleCityCardClick(city)}
//                           className="bg-black/30 border border-white/10 shadow-lg" 
//                         />
//                     </div>
//                   ))}
//                 </div>
//               ): null}
//             </section>
//             </div> 
//           </div> 
//       </div> 
//     </div> 
//   );
// }
// // 'use client';

// // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // import { useRouter, useSearchParams } from 'next/navigation';
// // import { useQuery } from '@tanstack/react-query';
// // import {
// //     fetchCities,
// //     fetchOperationalAreasForMap,
// //     fetchSubCategoriesByOperationalArea
// // } from '@/lib/apiClient';
// // import {
// //     CityDto,
// //     OperationalAreaDto,
// //     OperationalAreaFeatureProperties,
// //     APIError,
// //     FrontendShopQueryParameters,
// //     SubCategoryDto,
// //     HighLevelConceptQueryParam
// // } from '@/types/api';
// // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // import HeroBillboard from '@/components/common/HeroBillboard';
// // import CityCard from '@/components/city/CityCard';
// // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // import { Button } from '@/components/ui/button';
// // import {
// //   Carousel,
// //   CarouselContent,
// //   CarouselItem,
// //   CarouselNext,
// //   CarouselPrevious,
// // } from "@/components/ui/carousel";
// // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
// // import ShopSearchForm from '@/components/search/ShopSearchForm';

// // import egyptBoundaryData from '@/data/egypt_boundary.json';

// // type HeroSearchSubmitParams = Pick<
// //   FrontendShopQueryParameters,
// //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // >;

// // const DEFAULT_SEARCH_RADIUS = 50000;

// // export default function HomePage() {
// //   const router = useRouter();
// //   const searchParams = useSearchParams();

// //   const {
// //     currentLocation: contextLocation,
// //     setCurrentLocation: setContextLocation,
// //     isLoading: isLoadingContextLocation,
// //     error: contextGeoError,
// //     clearError: clearContextGeoError,
// //     attemptBrowserGpsLocation,
// //     isLoadingInitialPreference,
// //   } = useUserGeoLocation();

// //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// //   const [isRedirecting, setIsRedirecting] = useState(false);

// //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// //   const egyptBoundaryGeoJsonString = useMemo(() => {
// //     if (!egyptBoundaryData) return null;
// //     try {
// //       return JSON.stringify(egyptBoundaryData);
// //     } catch (e) {
// //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// //       return null;
// //     }
// //   }, []);

// //   const {
// //     data: operationalAreas,
// //     isLoading: isLoadingOperationalAreas,
// //     error: operationalAreasError
// //   } = useQuery<OperationalAreaDto[], APIError>({
// //     queryKey: ['operationalAreasForMap'],
// //     queryFn: fetchOperationalAreasForMap,
// //     staleTime: 1000 * 60 * 60,
// //     refetchOnWindowFocus: false,
// //   });

// //   const {
// //     data: legacyCities,
// //     isLoading: isLoadingLegacyCities,
// //     error: legacyCitiesError
// //   } = useQuery<CityDto[], APIError>({
// //       queryKey: ['legacyCities'],
// //       queryFn: fetchCities,
// //       staleTime: 1000 * 60 * 60,
// //       refetchOnWindowFocus: false,
// //     });

// //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// //       enabled: !!activeOperationalArea?.slug,
// //       staleTime: 1000 * 60 * 5,
// //   });

// //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// //       enabled: !!activeOperationalArea?.slug,
// //       staleTime: 1000 * 60 * 5,
// //   });

// //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// //     if (!areas || areas.length === 0) return null;
// //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// //       const distance = haversineDistance(userCoords, areaCoords);
// //       if (closest === null) return currentArea;
// //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// //       return distance < closestDistance ? currentArea : closest;
// //     }, null);
// //   }, []);

// //   useEffect(() => {
// //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// //       if (nearestArea) {
// //         setActiveOperationalArea(nearestArea);
// //         const areaSlugFromUrl = searchParams.get('area');
// //         if (areaSlugFromUrl !== nearestArea.slug) {
// //             const newUrlParams = new URLSearchParams(searchParams.toString());
// //             newUrlParams.set('area', nearestArea.slug);
// //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// //             newUrlParams.delete('city');
// //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //         }
// //       }
// //     }
// //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// //   useEffect(() => {
// //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// //     const urlRadiusStr = searchParams.get('radiusInMeters');

// //     if (urlLatStr && urlLonStr) {
// //       const lat = parseFloat(urlLatStr);
// //       const lon = parseFloat(urlLonStr);
// //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// //         }
// //       }
// //     }
// //   }, [searchParams, contextLocation, setContextLocation]);

// //   useEffect(() => {
// //     const areaSlugFromUrl = searchParams.get('area');
// //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// //             if (areaFromUrl) {
// //                 setActiveOperationalArea(areaFromUrl);
// //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// //                     setContextLocation({
// //                         latitude: areaFromUrl.centroidLatitude,
// //                         longitude: areaFromUrl.centroidLongitude,
// //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// //                         timestamp: Date.now()
// //                     }, 'url_param');
// //                 }
// //             }
// //         }
// //     }
// //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// //     clearContextGeoError();
// //     setPageLevelError(null);

// //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// //     if (!selectedOA) return;

// //     setActiveOperationalArea(selectedOA);

// //     const areaLocation: UserGeoLocation = {
// //         latitude: selectedOA.centroidLatitude,
// //         longitude: selectedOA.centroidLongitude,
// //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// //         timestamp: Date.now()
// //     };
// //     setContextLocation(areaLocation, 'manual');

// //     const newUrlParams = new URLSearchParams(searchParams.toString());
// //     newUrlParams.set("area", selectedOA.slug);
// //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// //     newUrlParams.delete('city');

// //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// //     const searchName = mainSearchInput?.value.trim();
// //     if (searchName) newUrlParams.set("name", searchName);
// //     else newUrlParams.delete("name");

// //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// //     setProcessingSubCategoryId(subCategorySlug);
// //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// //     const queryForNextPage = new URLSearchParams();
// //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// //     const searchName = mainSearchInput?.value.trim();
// //     if (searchName) queryForNextPage.set("name", searchName);

// //     let locationToUse: UserGeoLocation | null = contextLocation;
// //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// //     if (!areaToUseSlug) {
// //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// //         if (!locationToUse) {
// //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// //                 onError: (errMsg, errCode) => {
// //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// //                     }
// //                 }
// //             });
// //             locationToUse = detectedLocationForSubCat;
// //         }
// //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// //             if (nearestArea) {
// //                 areaToUseSlug = nearestArea.slug;
// //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// //                     setActiveOperationalArea(nearestArea);
// //                 }
// //             } else {
// //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// //             }
// //         }
// //         if (!areaToUseSlug) {
// //             setIsRedirecting(true);
// //             const redirectParams = new URLSearchParams();
// //             if (searchName) redirectParams.set("name", searchName);
// //             redirectParams.set("subCategory", subCategorySlug);
// //             redirectParams.set("concept", conceptPageSlugForFallback);
// //             router.push(`/select-area?${redirectParams.toString()}`);
// //             setProcessingSubCategoryId(null); return;
// //         }
// //     }
// //     if (locationToUse) {
// //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// //         queryForNextPage.set("sortBy", "distance_asc");
// //     }
// //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// //     setProcessingSubCategoryId(null);
// //   };

// //   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// //     const searchName = submittedCriteria.name;
// //     const newUrlParams = new URLSearchParams();
// //     if (searchName) newUrlParams.set("name", searchName);

// //     let targetOperationalArea = activeOperationalArea;

// //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// //             setIsProcessingHeroAction(false); return;
// //         }
// //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// //         setContextLocation(newGpsLocation, 'gps');

// //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// //         if (nearestArea) {
// //             targetOperationalArea = nearestArea;
// //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// //             newUrlParams.set('area', nearestArea.slug);
// //         } else {
// //             newUrlParams.delete('area');
// //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// //         }
// //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// //     } else {
// //         if (targetOperationalArea) {
// //             newUrlParams.set('area', targetOperationalArea.slug);
// //             if (contextLocation) {
// //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// //             } else {
// //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// //             }
// //         } else if (contextLocation) {
// //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// //         }
// //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// //     }

// //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// //                                             : "general-maintenance";

// //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// //     } else if (searchName && !targetOperationalArea) {
// //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
// //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //     } else {
// //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //     }
// //     setIsProcessingHeroAction(false);
// //   };

// //   const handleCityCardClick = (city: CityDto) => {
// //     clearContextGeoError(); setPageLevelError(null);
// //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// //     if (correspondingOA) {
// //         setActiveOperationalArea(correspondingOA);
// //         const areaLocation: UserGeoLocation = {
// //             latitude: correspondingOA.centroidLatitude,
// //             longitude: correspondingOA.centroidLongitude,
// //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// //             timestamp: Date.now()
// //         };
// //         setContextLocation(areaLocation, 'manual');

// //         const newUrlParams = new URLSearchParams(searchParams.toString());
// //         newUrlParams.set("area", correspondingOA.slug);
// //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// //         newUrlParams.delete('city');
// //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //     } else {
// //         setActiveLegacyCity(city);
// //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// //         setContextLocation(cityLocation, 'manual_city');
// //         const newUrlParams = new URLSearchParams(searchParams.toString());
// //         newUrlParams.set("city", city.slug);
// //         newUrlParams.set("userLatitude", city.latitude.toString());
// //         newUrlParams.set("userLongitude", city.longitude.toString());
// //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// //         newUrlParams.delete('area');
// //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //     }
// //   };

// //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// //     if (!activeOperationalArea) {
// //         setPageLevelError("Please select an operational area first to explore services.");
// //         return;
// //     }
// //     const query = new URLSearchParams(searchParams.toString());
// //     query.delete('city');
// //     query.set('area', activeOperationalArea.slug);

// //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// //   };

// //   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// //     const nameFromUrl = searchParams.get('name') || '';
// //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// //     const urlRadius = searchParams.get('radiusInMeters');
// //     const urlSortBy = searchParams.get('sortBy');

// //     if (urlLat && urlLon) {
// //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// //     } else if (contextLocation) {
// //         const sortByValue = urlSortBy ||
// //                             (contextLocation.source &&
// //                              (contextLocation.source.startsWith('gps') ||
// //                               contextLocation.source === 'preference_loaded' ||
// //                               contextLocation.source === 'manual'
// //                              ) ? 'distance_asc' : undefined);
// //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// //     }
// //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// //   }, [searchParams, contextLocation, activeOperationalArea]);

// //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// //     if (!activeOperationalArea?.slug) {
// //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// //         return conceptGroup?.subCategories.map(sc => ({
// //             name: sc.name,
// //             slug: sc.slug,
// //             shopCount: 0,
// //             subCategoryEnum: 0, 
// //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// //         })) || []; 
// //     }
// //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// //     return [];
// //   };
  
// //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// //     if (!activeOperationalArea?.slug) return false; 
// //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// //     return false;
// //   };

// //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";
// //   // This needs to match exactly what Header.tsx uses for its actual height
// //   // For sticky positioning of search bar relative to the glass panel, not viewport.
// //   // const STICKY_SEARCH_TOP_OFFSET = "top-[68px] sm:top-[84px]"; 
// //   const STICKY_SEARCH_TOP_OFFSET = "top-0"; // Sticky to the top of its scrolling container


// //   return (
// //      <div className="relative min-h-screen overflow-x-hidden">
// //       {/* MAP BACKGROUND: Fixed and behind all content. z-0 */}
// //       <div className="fixed inset-0 z-0">
// //         <HeroBillboard
// //           minHeight="min-h-screen" 
// //           isMapMode={true}
// //           operationalAreas={operationalAreas || []}
// //           isLoadingMapData={isLoadingOperationalAreas}
// //           onOperationalAreaSelect={handleOperationalAreaSelect}
// //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// //           title="Automotive Services & Parts"
// //           subtitle="Click an area to explore or use the search below"
// //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} 
// //         />
// //       </div>

// //       {/* PAGE CONTENT WRAPPER: Sits on top of the map. z-10 or higher. */}
// //       {/* It has padding for the fixed header. CRITICAL: pointer-events-none on this wrapper, pointer-events-auto on its children that need interaction. */}
// //       <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} pointer-events-none`}>
// //           {/* SPACER for initial map view. Inherits pointer-events-none from parent. */}
// //           <div className="h-[calc(40vh)] flex-shrink-0">
// //             {/* This space shows the map and does not block clicks. */}
// //           </div>
          
// //           {/* CONTENT PANEL with Glass Effect. This panel MUST re-enable pointer events. */}
// //           <div className="flex-grow w-full bg-black/60 backdrop-blur-2xl border-t-2 border-white/20 shadow-2xl rounded-t-[2rem] sm:rounded-t-[3rem] overflow-hidden pointer-events-auto">
// //             {/* Search form: sticky within this glass panel. */}
// //             <div className={`w-full bg-black/40 backdrop-filter backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 md:p-5 sticky ${STICKY_SEARCH_TOP_OFFSET} z-20`}>
// //               <div className="max-w-3xl mx-auto">
// //                 <ShopSearchForm
// //                   onSubmit={handlePageSearchSubmit}
// //                   initialValues={initialPageSearchValues}
// //                   isLoading={isProcessingHeroAction || isLoadingGeo}
// //                   formInstanceId="page-shop-search"
// //                   showDetectLocationButton={true}
// //                 />
// //               </div>
// //             </div>

// //             {/* Main Content Scroll Area within the Glass Panel */}
// //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
// //               {/* Messages and errors */}
// //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// //                 <div className="mb-6 p-3 sm:p-4 bg-blue-600/30 backdrop-blur-sm border border-blue-500/50 rounded-lg text-center shadow-md">
// //                   <p className="text-sm sm:text-base text-blue-100">
// //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// //                   </p>
// //                 </div>
// //               )}
// //               {activeOperationalArea && (
// //                 <div className="mb-6 sm:mb-8 text-center p-3 bg-black/40 backdrop-blur-md rounded-lg shadow-xl">
// //                   <p className="text-base sm:text-lg text-slate-50">
// //                     Showing services and parts for: <span className="font-semibold text-emerald-300">{activeOperationalArea.nameEn}</span>
// //                   </p>
// //                   <Button
// //                     variant="link"
// //                     onClick={() => {
// //                       setActiveOperationalArea(null);
// //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// //                       newUrlParams.delete('area');
// //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// //                     }}
// //                     className="text-xs text-slate-300 hover:text-emerald-200 mt-1"
// //                   >
// //                     (Change area or use current location)
// //                   </Button>
// //                 </div>
// //               )}

// //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-600/40 backdrop-blur-sm text-blue-50 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
// //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// //                 </div>
// //               )}
// //               {pageLevelError && !isRedirecting && (
// //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// //                   {pageLevelError}
// //                 </div>
// //               )}
// //               {showGenericGeoError && contextGeoError && (
// //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-600/40 backdrop-blur-sm text-yellow-50 rounded-md shadow-md text-sm">
// //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// //                 </div>
// //               )}
// //               {operationalAreasError && (
// //                   <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// //                     Error loading operational areas: {operationalAreasError.message}
// //                   </div>
// //               )}

// //             {/* Carousels and other content sections */}
// //             {predefinedHomepageConcepts.map((conceptGroup) => {
// //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// //                 if (!conceptGroup.concept) return null;
// //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;
                
// //                 return (
// //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
// //                         {conceptGroup.concept.nameEn}
// //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-300 mt-1 sm:mt-0 text-shadow-medium"> in {activeOperationalArea.nameEn}</span>}
// //                       </h2>
// //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// //                         <Button
// //                           variant="outline"
// //                           size="sm"
// //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// //                           className="self-start sm:self-auto text-slate-100 border-slate-100/30 hover:bg-slate-50/10 hover:border-slate-100/50 backdrop-blur-sm shadow-md"
// //                         >
// //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// //                         </Button>
// //                       )}
// //                     </div>
// //                     {isLoadingThisCarousel ? (
// //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-300"/>
// //                       </div>
// //                     ) : actualSubCategories.length > 0 ? (
// //                       <div className="relative">
// //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// //                             {actualSubCategories.map((subCat, index) => (
// //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// //                                 <div className="p-0.5 h-full"> 
// //                                   <SubCategoryCarouselItem 
// //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// //                                     shopCount={subCat.shopCount}
// //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// //                                     className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all text-white h-full"
// //                                     textClassName="text-slate-100 text-shadow-medium" // Ensure these are applied by SubCategoryCarouselItem
// //                                     iconClassName="text-emerald-400"   // Ensure these are applied by SubCategoryCarouselItem
// //                                   />
// //                                 </div>
// //                               </CarouselItem>
// //                             ))}
// //                           </CarouselContent>
// //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// //                             <CarouselPrevious className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// //                             <CarouselNext className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// //                           </div>
// //                           <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// //                           <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// //                         </Carousel>
// //                       </div>
// //                     ) : (
// //                       <p className="text-slate-400 text-sm">
// //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// //                                               : "Select an area on the map or allow location access to see available services."}
// //                       </p>
// //                     )}
// //                   </section>
// //                 );
// //             })}

// //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
// //               <div className="text-center mb-8 md:mb-10">
// //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
// //                   Or, Browse by City (Legacy)
// //                 </h2>
// //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
// //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// //                 </p>
// //               </div>

// //               {isLoadingLegacyCities ? (
// //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-300 animate-spin mx-auto" /></div>
// //               ) : legacyCitiesError ? (
// //                 <div className="my-6 p-4 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// //                   <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
// //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// //                   {legacyCities.map((city: CityDto) => (
// //                     <div key={city.id} className="p-0.5">
// //                         <CityCard 
// //                           city={city}
// //                           onClick={() => handleCityCardClick(city)}
// //                           //className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all text-white h-full"
// //                           // textClassName="text-slate-100" // If CityCard takes such props
// //                         />
// //                     </div>
// //                   ))}
// //                 </div>
// //               ): null}
// //             </section>
// //             </div> {/* End of main content padding div */}
// //           </div> {/* End of glass content panel */}
// //       </div> {/* End of page content wrapper */}
// //     </div> 
// //   );
// // }
// // // 'use client';

// // // // ... (all your imports remain the same)
// // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // import { useRouter, useSearchParams } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import {
// // //     fetchCities,
// // //     fetchOperationalAreasForMap,
// // //     fetchSubCategoriesByOperationalArea
// // // } from '@/lib/apiClient';
// // // import {
// // //     CityDto,
// // //     OperationalAreaDto,
// // //     OperationalAreaFeatureProperties,
// // //     APIError,
// // //     FrontendShopQueryParameters,
// // //     SubCategoryDto,
// // //     HighLevelConceptQueryParam
// // // } from '@/types/api';
// // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // import CityCard from '@/components/city/CityCard';
// // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // import { Button } from '@/components/ui/button';
// // // import {
// // //   Carousel,
// // //   CarouselContent,
// // //   CarouselItem,
// // //   CarouselNext,
// // //   CarouselPrevious,
// // // } from "@/components/ui/carousel";
// // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
// // // import ShopSearchForm from '@/components/search/ShopSearchForm';
// // // import egyptBoundaryData from '@/data/egypt_boundary.json';


// // // type HeroSearchSubmitParams = Pick<
// // //   FrontendShopQueryParameters,
// // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // >;

// // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // export default function HomePage() {
// // //   // ... (all your state, hooks, functions remain the same)
// // //   const router = useRouter();
// // //   const searchParams = useSearchParams();

// // //   const {
// // //     currentLocation: contextLocation,
// // //     setCurrentLocation: setContextLocation,
// // //     isLoading: isLoadingContextLocation,
// // //     error: contextGeoError,
// // //     clearError: clearContextGeoError,
// // //     attemptBrowserGpsLocation,
// // //     isLoadingInitialPreference,
// // //   } = useUserGeoLocation();

// // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // //     if (!egyptBoundaryData) return null;
// // //     try {
// // //       return JSON.stringify(egyptBoundaryData);
// // //     } catch (e) {
// // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // //       return null;
// // //     }
// // //   }, []);

// // //   const {
// // //     data: operationalAreas,
// // //     isLoading: isLoadingOperationalAreas,
// // //     error: operationalAreasError
// // //   } = useQuery<OperationalAreaDto[], APIError>({
// // //     queryKey: ['operationalAreasForMap'],
// // //     queryFn: fetchOperationalAreasForMap,
// // //     staleTime: 1000 * 60 * 60,
// // //     refetchOnWindowFocus: false,
// // //   });

// // //   const {
// // //     data: legacyCities,
// // //     isLoading: isLoadingLegacyCities,
// // //     error: legacyCitiesError
// // //   } = useQuery<CityDto[], APIError>({
// // //       queryKey: ['legacyCities'],
// // //       queryFn: fetchCities,
// // //       staleTime: 1000 * 60 * 60,
// // //       refetchOnWindowFocus: false,
// // //     });

// // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // //       enabled: !!activeOperationalArea?.slug,
// // //       staleTime: 1000 * 60 * 5,
// // //   });

// // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // //       enabled: !!activeOperationalArea?.slug,
// // //       staleTime: 1000 * 60 * 5,
// // //   });

// // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // //     if (!areas || areas.length === 0) return null;
// // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // //       const distance = haversineDistance(userCoords, areaCoords);
// // //       if (closest === null) return currentArea;
// // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // //       return distance < closestDistance ? currentArea : closest;
// // //     }, null);
// // //   }, []);

// // //   useEffect(() => {
// // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // //       if (nearestArea) {
// // //         setActiveOperationalArea(nearestArea);
// // //         const areaSlugFromUrl = searchParams.get('area');
// // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // //             newUrlParams.set('area', nearestArea.slug);
// // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             newUrlParams.delete('city');
// // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //         }
// // //       }
// // //     }
// // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // //   useEffect(() => {
// // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // //     if (urlLatStr && urlLonStr) {
// // //       const lat = parseFloat(urlLatStr);
// // //       const lon = parseFloat(urlLonStr);
// // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // //         }
// // //       }
// // //     }
// // //   }, [searchParams, contextLocation, setContextLocation]);

// // //   useEffect(() => {
// // //     const areaSlugFromUrl = searchParams.get('area');
// // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // //             if (areaFromUrl) {
// // //                 setActiveOperationalArea(areaFromUrl);
// // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // //                     setContextLocation({
// // //                         latitude: areaFromUrl.centroidLatitude,
// // //                         longitude: areaFromUrl.centroidLongitude,
// // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // //                         timestamp: Date.now()
// // //                     }, 'url_param');
// // //                 }
// // //             }
// // //         }
// // //     }
// // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // //     clearContextGeoError();
// // //     setPageLevelError(null);

// // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // //     if (!selectedOA) return;

// // //     setActiveOperationalArea(selectedOA);

// // //     const areaLocation: UserGeoLocation = {
// // //         latitude: selectedOA.centroidLatitude,
// // //         longitude: selectedOA.centroidLongitude,
// // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // //         timestamp: Date.now()
// // //     };
// // //     setContextLocation(areaLocation, 'manual');

// // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // //     newUrlParams.set("area", selectedOA.slug);
// // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // //     newUrlParams.delete('city');

// // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // //     const searchName = mainSearchInput?.value.trim();
// // //     if (searchName) newUrlParams.set("name", searchName);
// // //     else newUrlParams.delete("name");

// // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // //     setProcessingSubCategoryId(subCategorySlug);
// // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // //     const queryForNextPage = new URLSearchParams();
// // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // //     const searchName = mainSearchInput?.value.trim();
// // //     if (searchName) queryForNextPage.set("name", searchName);

// // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // //     if (!areaToUseSlug) {
// // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // //         if (!locationToUse) {
// // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // //                 onError: (errMsg, errCode) => {
// // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // //                     }
// // //                 }
// // //             });
// // //             locationToUse = detectedLocationForSubCat;
// // //         }
// // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // //             if (nearestArea) {
// // //                 areaToUseSlug = nearestArea.slug;
// // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // //                     setActiveOperationalArea(nearestArea);
// // //                 }
// // //             } else {
// // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // //             }
// // //         }
// // //         if (!areaToUseSlug) {
// // //             setIsRedirecting(true);
// // //             const redirectParams = new URLSearchParams();
// // //             if (searchName) redirectParams.set("name", searchName);
// // //             redirectParams.set("subCategory", subCategorySlug);
// // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // //             router.push(`/select-area?${redirectParams.toString()}`);
// // //             setProcessingSubCategoryId(null); return;
// // //         }
// // //     }
// // //     if (locationToUse) {
// // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //         queryForNextPage.set("sortBy", "distance_asc");
// // //     }
// // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // //     setProcessingSubCategoryId(null);
// // //   };

// // //   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // //     const searchName = submittedCriteria.name;
// // //     const newUrlParams = new URLSearchParams();
// // //     if (searchName) newUrlParams.set("name", searchName);

// // //     let targetOperationalArea = activeOperationalArea;

// // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // //             setIsProcessingHeroAction(false); return;
// // //         }
// // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // //         setContextLocation(newGpsLocation, 'gps');

// // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // //         if (nearestArea) {
// // //             targetOperationalArea = nearestArea;
// // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // //             newUrlParams.set('area', nearestArea.slug);
// // //         } else {
// // //             newUrlParams.delete('area');
// // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // //         }
// // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // //     } else {
// // //         if (targetOperationalArea) {
// // //             newUrlParams.set('area', targetOperationalArea.slug);
// // //             if (contextLocation) {
// // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             } else {
// // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             }
// // //         } else if (contextLocation) {
// // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //         }
// // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // //     }

// // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // //                                             : "general-maintenance";

// // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // //     } else if (searchName && !targetOperationalArea) {
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
// // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     } else {
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     }
// // //     setIsProcessingHeroAction(false);
// // //   };

// // //   const handleCityCardClick = (city: CityDto) => {
// // //     clearContextGeoError(); setPageLevelError(null);
// // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // //     if (correspondingOA) {
// // //         setActiveOperationalArea(correspondingOA);
// // //         const areaLocation: UserGeoLocation = {
// // //             latitude: correspondingOA.centroidLatitude,
// // //             longitude: correspondingOA.centroidLongitude,
// // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // //             timestamp: Date.now()
// // //         };
// // //         setContextLocation(areaLocation, 'manual');

// // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // //         newUrlParams.set("area", correspondingOA.slug);
// // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // //         newUrlParams.delete('city');
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     } else {
// // //         setActiveLegacyCity(city);
// // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // //         setContextLocation(cityLocation, 'manual_city');
// // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // //         newUrlParams.set("city", city.slug);
// // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // //         newUrlParams.delete('area');
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     }
// // //   };

// // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // //     if (!activeOperationalArea) {
// // //         setPageLevelError("Please select an operational area first to explore services.");
// // //         return;
// // //     }
// // //     const query = new URLSearchParams(searchParams.toString());
// // //     query.delete('city');
// // //     query.set('area', activeOperationalArea.slug);

// // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // //   };

// // //   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // //     const nameFromUrl = searchParams.get('name') || '';
// // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // //     const urlRadius = searchParams.get('radiusInMeters');
// // //     const urlSortBy = searchParams.get('sortBy');

// // //     if (urlLat && urlLon) {
// // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // //     } else if (contextLocation) {
// // //         const sortByValue = urlSortBy ||
// // //                             (contextLocation.source &&
// // //                              (contextLocation.source.startsWith('gps') ||
// // //                               contextLocation.source === 'preference_loaded' ||
// // //                               contextLocation.source === 'manual'
// // //                              ) ? 'distance_asc' : undefined);
// // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // //     }
// // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // //     if (!activeOperationalArea?.slug) {
// // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // //         return conceptGroup?.subCategories.map(sc => ({
// // //             name: sc.name,
// // //             slug: sc.slug,
// // //             shopCount: 0,
// // //             subCategoryEnum: 0, 
// // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // //         })) || []; 
// // //     }
// // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // //     return [];
// // //   };
  
// // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // //     if (!activeOperationalArea?.slug) return false; 
// // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // //     return false;
// // //   };

// // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

// // //   return (
// // //      <div className="relative min-h-screen overflow-x-hidden">
// // //       {/* MAP BACKGROUND: Fixed and behind all content */}
// // //       <div className="fixed inset-0 z-0"> {/* z-0 for map background */}
// // //         <HeroBillboard
// // //           minHeight="min-h-screen" 
// // //           isMapMode={true}
// // //           operationalAreas={operationalAreas || []}
// // //           isLoadingMapData={isLoadingOperationalAreas}
// // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// // //           title="Explore Automotive Services" // Optional: if you want a title on the map
// // //           subtitle="Click on an area or use search below"
// // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}
// // //         />
// // //       </div>

// // //       {/* PAGE CONTENT WRAPPER: Sits on top of the map, handles scrolling */}
// // //       <div 
// // //         className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}`}
// // //         // The pointer-events-none here could be problematic if not managed carefully with children.
// // //         // Let's remove it from the main wrapper and ensure children that SHOULD allow events have pointer-events-auto.
// // //       >
// // //           {/* SPACER for initial map view. This div itself should not block pointer events. */}
// // //           <div className="h-[calc(40vh)] pointer-events-none flex-shrink-0">
// // //             {/* This space is transparent and shows the map. */}
// // //           </div>
          
// // //           {/* CONTENT PANEL with Glass Effect. This panel *should* receive pointer events. */}
// // //           <div className="flex-grow w-full bg-black/60 backdrop-blur-xl border-t-2 border-white/20 shadow-2xl rounded-t-[2rem] sm:rounded-t-[3rem] overflow-hidden pointer-events-auto"> {/* Added pointer-events-auto */}
// // //             {/* Search form inside the glass panel, at its top, sticky within this panel */}
// // //             <div className="w-full bg-black/40 backdrop-filter backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 md:p-5 sticky top-[0] z-20"> {/* Sticky search bar needs z-index within its stacking context */}
// // //               <div className="max-w-3xl mx-auto">
// // //                 <ShopSearchForm
// // //                   onSubmit={handlePageSearchSubmit}
// // //                   initialValues={initialPageSearchValues}
// // //                   isLoading={isProcessingHeroAction || isLoadingGeo}
// // //                   formInstanceId="page-shop-search"
// // //                   showDetectLocationButton={true}
// // //                 />
// // //               </div>
// // //             </div>

// // //             {/* Main Content Sections (Carousels, Legacy Cities, etc.) */}
// // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
// // //               {/* ... (rest of your content: messages, carousels, city list) ... */}
// // //               {/* Ensure all interactive elements like buttons, carousel items, city cards
// // //                   are effectively `pointer-events-auto` (which is default, but ensure no parent
// // //                   is overriding it with `pointer-events-none` unless intended for specific overlays)
// // //               */}
// // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-600/30 backdrop-blur-sm border border-blue-500/50 rounded-lg text-center shadow-md">
// // //                   <p className="text-sm sm:text-base text-blue-100">
// // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // //                   </p>
// // //                 </div>
// // //               )}
// // //               {activeOperationalArea && (
// // //                 <div className="mb-6 sm:mb-8 text-center p-3 bg-black/40 backdrop-blur-md rounded-lg shadow-xl">
// // //                   <p className="text-base sm:text-lg text-slate-50">
// // //                     Showing services and parts for: <span className="font-semibold text-emerald-300">{activeOperationalArea.nameEn}</span>
// // //                   </p>
// // //                   <Button
// // //                     variant="link"
// // //                     onClick={() => {
// // //                       setActiveOperationalArea(null);
// // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // //                       newUrlParams.delete('area');
// // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //                     }}
// // //                     className="text-xs text-slate-300 hover:text-emerald-200 mt-1"
// // //                   >
// // //                     (Change area or use current location)
// // //                   </Button>
// // //                 </div>
// // //               )}

// // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-600/40 backdrop-blur-sm text-blue-50 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
// // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // //                 </div>
// // //               )}
// // //               {pageLevelError && !isRedirecting && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// // //                   {pageLevelError}
// // //                 </div>
// // //               )}
// // //               {showGenericGeoError && contextGeoError && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-600/40 backdrop-blur-sm text-yellow-50 rounded-md shadow-md text-sm">
// // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // //                 </div>
// // //               )}
// // //               {operationalAreasError && (
// // //                   <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// // //                     Error loading operational areas: {operationalAreasError.message}
// // //                   </div>
// // //               )}

// // //             {/* Carousels and other content sections */}
// // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // //                 if (!conceptGroup.concept) return null;
// // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;
                
// // //                 return (
// // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
// // //                         {conceptGroup.concept.nameEn}
// // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-300 mt-1 sm:mt-0 text-shadow-medium"> in {activeOperationalArea.nameEn}</span>}
// // //                       </h2>
// // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // //                         <Button
// // //                           variant="outline"
// // //                           size="sm"
// // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // //                           className="self-start sm:self-auto text-slate-100 border-slate-100/30 hover:bg-slate-50/10 hover:border-slate-100/50 backdrop-blur-sm shadow-md"
// // //                         >
// // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // //                         </Button>
// // //                       )}
// // //                     </div>
// // //                     {isLoadingThisCarousel ? (
// // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-300"/>
// // //                       </div>
// // //                     ) : actualSubCategories.length > 0 ? (
// // //                       <div className="relative">
// // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // //                             {actualSubCategories.map((subCat, index) => (
// // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // //                                 <div className="p-0.5 h-full"> {/* Reduced padding around the card itself */}
// // //                                   <SubCategoryCarouselItem 
// // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // //                                     shopCount={subCat.shopCount}
// // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // //                                     // Assuming SubCategoryCarouselItem has a translucent background or is adapted
// // //                                     // Forcing a glass background on its wrapper:
// // //                                     className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all text-white h-full"
// // //                                     textClassName="text-slate-100 text-shadow-medium"
// // //                                     iconClassName="text-emerald-400"
// // //                                   />
// // //                                 </div>
// // //                               </CarouselItem>
// // //                             ))}
// // //                           </CarouselContent>
// // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                             <CarouselNext className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                           </div>
// // //                           <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                           <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                         </Carousel>
// // //                       </div>
// // //                     ) : (
// // //                       <p className="text-slate-400 text-sm">
// // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // //                                               : "Select an area on the map or allow location access to see available services."}
// // //                       </p>
// // //                     )}
// // //                   </section>
// // //                 );
// // //             })}

// // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
// // //               <div className="text-center mb-8 md:mb-10">
// // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
// // //                   Or, Browse by City (Legacy)
// // //                 </h2>
// // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
// // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // //                 </p>
// // //               </div>

// // //               {isLoadingLegacyCities ? (
// // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-300 animate-spin mx-auto" /></div>
// // //               ) : legacyCitiesError ? (
// // //                 <div className="my-6 p-4 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // //                   <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
// // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // //                   {legacyCities.map((city: CityDto) => (
// // //                     <div key={city.id} className="p-0.5"> {/* Reduced padding around card */}
// // //                         <CityCard 
// // //                           city={city}
// // //                           onClick={() => handleCityCardClick(city)}
// // //                           // Assuming CityCard has a translucent background or is adapted
// // //                           // Forcing a glass background on its wrapper:
// // //                           //className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all text-white h-full"
// // //                           // If CityCard accepts text/icon classNames:
// // //                           // textClassName="text-slate-100" 
// // //                         />
// // //                     </div>
// // //                   ))}
// // //                 </div>
// // //               ): null}
// // //             </section>
// // //             </div> {/* End of main content padding div */}
// // //           </div> {/* End of glass content panel */}
// // //       </div> {/* End of page content wrapper */}
// // //     </div> 
// // //   );
// // // }
// // // 'use client';

// // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // import { useRouter, useSearchParams } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import {
// // //     fetchCities,
// // //     fetchOperationalAreasForMap,
// // //     fetchSubCategoriesByOperationalArea
// // // } from '@/lib/apiClient';
// // // import {
// // //     CityDto,
// // //     OperationalAreaDto,
// // //     OperationalAreaFeatureProperties,
// // //     APIError,
// // //     FrontendShopQueryParameters,
// // //     SubCategoryDto,
// // //     HighLevelConceptQueryParam
// // // } from '@/types/api';
// // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // import CityCard from '@/components/city/CityCard';
// // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // import { Button } from '@/components/ui/button';
// // // import {
// // //   Carousel,
// // //   CarouselContent,
// // //   CarouselItem,
// // //   CarouselNext,
// // //   CarouselPrevious,
// // // } from "@/components/ui/carousel";
// // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
// // // import ShopSearchForm from '@/components/search/ShopSearchForm';

// // // import egyptBoundaryData from '@/data/egypt_boundary.json';
// // // // Ensure Leaflet CSS is imported (ideally globally in layout.tsx or globals.css)
// // // // import 'leaflet/dist/leaflet.css';

// // // type HeroSearchSubmitParams = Pick<
// // //   FrontendShopQueryParameters,
// // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // >;

// // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // export default function HomePage() {
// // //   const router = useRouter();
// // //   const searchParams = useSearchParams();

// // //   const {
// // //     currentLocation: contextLocation,
// // //     setCurrentLocation: setContextLocation,
// // //     isLoading: isLoadingContextLocation,
// // //     error: contextGeoError,
// // //     clearError: clearContextGeoError,
// // //     attemptBrowserGpsLocation,
// // //     isLoadingInitialPreference,
// // //   } = useUserGeoLocation();

// // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // //     if (!egyptBoundaryData) return null;
// // //     try {
// // //       return JSON.stringify(egyptBoundaryData);
// // //     } catch (e) {
// // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // //       return null;
// // //     }
// // //   }, []);

// // //   const {
// // //     data: operationalAreas,
// // //     isLoading: isLoadingOperationalAreas,
// // //     error: operationalAreasError
// // //   } = useQuery<OperationalAreaDto[], APIError>({
// // //     queryKey: ['operationalAreasForMap'],
// // //     queryFn: fetchOperationalAreasForMap,
// // //     staleTime: 1000 * 60 * 60,
// // //     refetchOnWindowFocus: false,
// // //   });

// // //   const {
// // //     data: legacyCities,
// // //     isLoading: isLoadingLegacyCities,
// // //     error: legacyCitiesError
// // //   } = useQuery<CityDto[], APIError>({
// // //       queryKey: ['legacyCities'],
// // //       queryFn: fetchCities,
// // //       staleTime: 1000 * 60 * 60,
// // //       refetchOnWindowFocus: false,
// // //     });

// // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // //       enabled: !!activeOperationalArea?.slug,
// // //       staleTime: 1000 * 60 * 5,
// // //   });

// // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // //       enabled: !!activeOperationalArea?.slug,
// // //       staleTime: 1000 * 60 * 5,
// // //   });

// // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // //     if (!areas || areas.length === 0) return null;
// // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // //       const distance = haversineDistance(userCoords, areaCoords);
// // //       if (closest === null) return currentArea;
// // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // //       return distance < closestDistance ? currentArea : closest;
// // //     }, null);
// // //   }, []);

// // //   useEffect(() => {
// // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // //       if (nearestArea) {
// // //         setActiveOperationalArea(nearestArea);
// // //         const areaSlugFromUrl = searchParams.get('area');
// // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // //             newUrlParams.set('area', nearestArea.slug);
// // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             newUrlParams.delete('city');
// // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //         }
// // //       }
// // //     }
// // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // //   useEffect(() => {
// // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // //     if (urlLatStr && urlLonStr) {
// // //       const lat = parseFloat(urlLatStr);
// // //       const lon = parseFloat(urlLonStr);
// // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // //         }
// // //       }
// // //     }
// // //   }, [searchParams, contextLocation, setContextLocation]);

// // //   useEffect(() => {
// // //     const areaSlugFromUrl = searchParams.get('area');
// // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // //             if (areaFromUrl) {
// // //                 setActiveOperationalArea(areaFromUrl);
// // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // //                     setContextLocation({
// // //                         latitude: areaFromUrl.centroidLatitude,
// // //                         longitude: areaFromUrl.centroidLongitude,
// // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // //                         timestamp: Date.now()
// // //                     }, 'url_param');
// // //                 }
// // //             }
// // //         }
// // //     }
// // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // //     clearContextGeoError();
// // //     setPageLevelError(null);

// // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // //     if (!selectedOA) return;

// // //     setActiveOperationalArea(selectedOA);

// // //     const areaLocation: UserGeoLocation = {
// // //         latitude: selectedOA.centroidLatitude,
// // //         longitude: selectedOA.centroidLongitude,
// // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // //         timestamp: Date.now()
// // //     };
// // //     setContextLocation(areaLocation, 'manual');

// // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // //     newUrlParams.set("area", selectedOA.slug);
// // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // //     newUrlParams.delete('city');

// // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // //     const searchName = mainSearchInput?.value.trim();
// // //     if (searchName) newUrlParams.set("name", searchName);
// // //     else newUrlParams.delete("name");

// // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // //     setProcessingSubCategoryId(subCategorySlug);
// // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // //     const queryForNextPage = new URLSearchParams();
// // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // //     const searchName = mainSearchInput?.value.trim();
// // //     if (searchName) queryForNextPage.set("name", searchName);

// // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // //     if (!areaToUseSlug) {
// // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // //         if (!locationToUse) {
// // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // //                 onError: (errMsg, errCode) => {
// // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // //                     }
// // //                 }
// // //             });
// // //             locationToUse = detectedLocationForSubCat;
// // //         }
// // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // //             if (nearestArea) {
// // //                 areaToUseSlug = nearestArea.slug;
// // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // //                     setActiveOperationalArea(nearestArea);
// // //                 }
// // //             } else {
// // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // //             }
// // //         }
// // //         if (!areaToUseSlug) {
// // //             setIsRedirecting(true);
// // //             const redirectParams = new URLSearchParams();
// // //             if (searchName) redirectParams.set("name", searchName);
// // //             redirectParams.set("subCategory", subCategorySlug);
// // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // //             router.push(`/select-area?${redirectParams.toString()}`);
// // //             setProcessingSubCategoryId(null); return;
// // //         }
// // //     }
// // //     if (locationToUse) {
// // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //         queryForNextPage.set("sortBy", "distance_asc");
// // //     }
// // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // //     setProcessingSubCategoryId(null);
// // //   };

// // //   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // //     const searchName = submittedCriteria.name;
// // //     const newUrlParams = new URLSearchParams();
// // //     if (searchName) newUrlParams.set("name", searchName);

// // //     let targetOperationalArea = activeOperationalArea;

// // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // //             setIsProcessingHeroAction(false); return;
// // //         }
// // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // //         setContextLocation(newGpsLocation, 'gps');

// // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // //         if (nearestArea) {
// // //             targetOperationalArea = nearestArea;
// // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // //             newUrlParams.set('area', nearestArea.slug);
// // //         } else {
// // //             newUrlParams.delete('area');
// // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // //         }
// // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // //     } else {
// // //         if (targetOperationalArea) {
// // //             newUrlParams.set('area', targetOperationalArea.slug);
// // //             if (contextLocation) {
// // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             } else {
// // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //             }
// // //         } else if (contextLocation) {
// // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // //         }
// // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // //     }

// // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // //                                             : "general-maintenance";

// // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // //     } else if (searchName && !targetOperationalArea) {
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
// // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     } else {
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     }
// // //     setIsProcessingHeroAction(false);
// // //   };

// // //   const handleCityCardClick = (city: CityDto) => {
// // //     clearContextGeoError(); setPageLevelError(null);
// // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // //     if (correspondingOA) {
// // //         setActiveOperationalArea(correspondingOA);
// // //         const areaLocation: UserGeoLocation = {
// // //             latitude: correspondingOA.centroidLatitude,
// // //             longitude: correspondingOA.centroidLongitude,
// // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // //             timestamp: Date.now()
// // //         };
// // //         setContextLocation(areaLocation, 'manual');

// // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // //         newUrlParams.set("area", correspondingOA.slug);
// // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // //         newUrlParams.delete('city');
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     } else {
// // //         setActiveLegacyCity(city);
// // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // //         setContextLocation(cityLocation, 'manual_city');
// // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // //         newUrlParams.set("city", city.slug);
// // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // //         newUrlParams.delete('area');
// // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //     }
// // //   };

// // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // //     if (!activeOperationalArea) {
// // //         setPageLevelError("Please select an operational area first to explore services.");
// // //         return;
// // //     }
// // //     const query = new URLSearchParams(searchParams.toString());
// // //     query.delete('city');
// // //     query.set('area', activeOperationalArea.slug);

// // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // //   };

// // //   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // //     const nameFromUrl = searchParams.get('name') || '';
// // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // //     const urlRadius = searchParams.get('radiusInMeters');
// // //     const urlSortBy = searchParams.get('sortBy');

// // //     if (urlLat && urlLon) {
// // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // //     } else if (contextLocation) {
// // //         const sortByValue = urlSortBy ||
// // //                             (contextLocation.source &&
// // //                              (contextLocation.source.startsWith('gps') ||
// // //                               contextLocation.source === 'preference_loaded' ||
// // //                               contextLocation.source === 'manual'
// // //                              ) ? 'distance_asc' : undefined);
// // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // //     }
// // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // //     if (!activeOperationalArea?.slug) {
// // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // //         return conceptGroup?.subCategories.map(sc => ({
// // //             name: sc.name,
// // //             slug: sc.slug,
// // //             shopCount: 0,
// // //             subCategoryEnum: 0, 
// // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // //         })) || []; 
// // //     }
// // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // //     return [];
// // //   };
  
// // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // //     if (!activeOperationalArea?.slug) return false; 
// // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // //     return false;
// // //   };

// // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

// // //   return (
// // //      <div className="relative min-h-screen overflow-x-hidden">
// // //       {/* MAP BACKGROUND: Fixed and behind all content */}
// // //       <div className="fixed inset-0 z-0">
// // //         <HeroBillboard
// // //           minHeight="min-h-screen" 
// // //           isMapMode={true}
// // //           operationalAreas={operationalAreas || []}
// // //           isLoadingMapData={isLoadingOperationalAreas}
// // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// // //           // Optional subtle title on map
// // //           //title="Explore Automotive Services"
// // //           //subtitle="Click on an area to get started or use the search below"
// // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} // For positioning the title overlay
// // //         />
// // //       </div>

// // //       {/* PAGE CONTENT WRAPPER: Sits on top of the map, handles scrolling */}
// // //       <div className={`relative z-10 min-h-screen flex flex-col ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}`}>
// // //           {/* Spacer div to create the "initial map view" effect. 
// // //               Height is approx. 40vh MINUS the header's top padding already on this parent.
// // //               If header padding is ~10vh, then 30vh here + 10vh padding = 40vh map view.
// // //               Adjust "h-[calc(40vh_-_84px)]" or "h-[30vh]" carefully.
// // //               Let's try a simpler approach: make the spacer itself define the 40vh map view area.
// // //               The parent already has padding for the header. The actual content starts after this.
// // //            */}
// // //           <div className="h-[calc(40vh)] pointer-events-none flex-shrink-0">
// // //             {/* This space shows the map. No content here. */}
// // //           </div>
          
// // //           {/* CONTENT PANEL with Glass Effect */}
// // //           {/* This panel starts after the 40vh map view area (and header). */}
// // //           <div className="flex-grow w-full bg-black/50 backdrop-blur-2xl border-t-2 border-white/20 shadow-2xl rounded-t-[2rem] sm:rounded-t-[3rem] overflow-hidden"> {/* Increased blur and opacity slightly */}
// // //             {/* Search form inside the glass panel, at its top, sticky within this panel */}
// // //             <div className="w-full bg-black/30 backdrop-filter backdrop-blur-md border-b border-white/10 p-3 sm:p-4 md:p-5 sticky top-[0] z-20"> {/* Sticky to the top of its parent glass panel */}
// // //               <div className="max-w-3xl mx-auto">
// // //                 <ShopSearchForm
// // //                   onSubmit={handlePageSearchSubmit}
// // //                   initialValues={initialPageSearchValues}
// // //                   isLoading={isProcessingHeroAction || isLoadingGeo}
// // //                   formInstanceId="page-shop-search"
// // //                   showDetectLocationButton={true}
// // //                 />
// // //               </div>
// // //             </div>

// // //             {/* Main Content Sections (Carousels, Legacy Cities, etc.) */}
// // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
// // //               {/* Messages and errors - styled for glass */}
// // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-600/30 backdrop-blur-sm border border-blue-500/50 rounded-lg text-center shadow-md">
// // //                   <p className="text-sm sm:text-base text-blue-100">
// // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // //                   </p>
// // //                 </div>
// // //               )}
// // //               {activeOperationalArea && (
// // //                 <div className="mb-6 sm:mb-8 text-center p-3 bg-black/40 backdrop-blur-md rounded-lg shadow-xl">
// // //                   <p className="text-base sm:text-lg text-slate-50">
// // //                     Showing services and parts for: <span className="font-semibold text-emerald-300">{activeOperationalArea.nameEn}</span>
// // //                   </p>
// // //                   <Button
// // //                     variant="link"
// // //                     onClick={() => {
// // //                       setActiveOperationalArea(null);
// // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // //                       newUrlParams.delete('area');
// // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // //                     }}
// // //                     className="text-xs text-slate-300 hover:text-emerald-200 mt-1"
// // //                   >
// // //                     (Change area or use current location)
// // //                   </Button>
// // //                 </div>
// // //               )}

// // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-600/40 backdrop-blur-sm text-blue-50 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
// // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // //                 </div>
// // //               )}
// // //               {pageLevelError && !isRedirecting && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// // //                   {pageLevelError}
// // //                 </div>
// // //               )}
// // //               {showGenericGeoError && contextGeoError && (
// // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-600/40 backdrop-blur-sm text-yellow-50 rounded-md shadow-md text-sm">
// // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // //                 </div>
// // //               )}
// // //               {operationalAreasError && (
// // //                   <div className="text-center my-4 sm:my-6 p-3 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-md shadow-md text-sm">
// // //                     Error loading operational areas: {operationalAreasError.message}
// // //                   </div>
// // //               )}

// // //             {/* Carousels and other content sections - styled for glass */}
// // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // //                 if (!conceptGroup.concept) return null;
// // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;
                
// // //                 return (
// // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
// // //                         {conceptGroup.concept.nameEn}
// // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-300 mt-1 sm:mt-0 text-shadow-medium"> in {activeOperationalArea.nameEn}</span>}
// // //                       </h2>
// // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // //                         <Button
// // //                           variant="outline"
// // //                           size="sm"
// // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // //                           // Style for glass: light text, translucent border/bg
// // //                           className="self-start sm:self-auto text-slate-100 border-slate-100/30 hover:bg-slate-50/10 hover:border-slate-100/50 backdrop-blur-sm shadow-md"
// // //                         >
// // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // //                         </Button>
// // //                       )}
// // //                     </div>
// // //                     {isLoadingThisCarousel ? (
// // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-300"/>
// // //                       </div>
// // //                     ) : actualSubCategories.length > 0 ? (
// // //                       <div className="relative">
// // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // //                             {actualSubCategories.map((subCat, index) => (
// // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // //                                 {/* Wrap SubCategoryCarouselItem to apply glass background if it doesn't have it internally */}
// // //                                 <div className="p-1 h-full bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all">
// // //                                   <SubCategoryCarouselItem 
// // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // //                                     shopCount={subCat.shopCount}
// // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // //                                     textClassName="text-slate-100 text-shadow-medium"
// // //                                     iconClassName="text-emerald-400"
// // //                                     // Make sure SubCategoryCarouselItem's internal text/icons are light-colored
// // //                                   />
// // //                                 </div>
// // //                               </CarouselItem>
// // //                             ))}
// // //                           </CarouselContent>
// // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                             <CarouselNext className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                           </div>
// // //                           <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                           <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // //                         </Carousel>
// // //                       </div>
// // //                     ) : (
// // //                       <p className="text-slate-400 text-sm">
// // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // //                                               : "Select an area on the map or allow location access to see available services."}
// // //                       </p>
// // //                     )}
// // //                   </section>
// // //                 );
// // //             })}

// // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
// // //               <div className="text-center mb-8 md:mb-10">
// // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
// // //                   Or, Browse by City (Legacy)
// // //                 </h2>
// // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
// // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // //                 </p>
// // //               </div>

// // //               {isLoadingLegacyCities ? (
// // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-300 animate-spin mx-auto" /></div>
// // //               ) : legacyCitiesError ? (
// // //                 <div className="my-6 p-4 bg-red-600/40 backdrop-blur-sm text-red-100 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // //                   <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
// // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // //                   {legacyCities.map((city: CityDto) => (
// // //                     // Wrap CityCard to apply glass background if it doesn't have it internally
// // //                     <div key={city.id} className="bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl shadow-lg transition-all">
// // //                         <CityCard 
// // //                           city={city}
// // //                           onClick={() => handleCityCardClick(city)}
// // //                           // Make sure CityCard's internal text/icons are light-colored
// // //                         />
// // //                     </div>
// // //                   ))}
// // //                 </div>
// // //               ): null}
// // //             </section>
// // //             </div> {/* End of main content padding div */}
// // //           </div> {/* End of glass content panel */}
// // //       </div> {/* End of page content wrapper */}
// // //     </div> 
// // //   );
// // // }
// // // // // 'use client';

// // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // import { useQuery } from '@tanstack/react-query';
// // // // // import {
// // // // //     fetchCities,
// // // // //     fetchOperationalAreasForMap,
// // // // //     fetchSubCategoriesByOperationalArea
// // // // // } from '@/lib/apiClient';
// // // // // import {
// // // // //     CityDto,
// // // // //     OperationalAreaDto,
// // // // //     OperationalAreaFeatureProperties,
// // // // //     APIError,
// // // // //     FrontendShopQueryParameters,
// // // // //     SubCategoryDto,
// // // // //     HighLevelConceptQueryParam
// // // // // } from '@/types/api';
// // // // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // import CityCard from '@/components/city/CityCard';
// // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // // // import { Button } from '@/components/ui/button';
// // // // // import {
// // // // //   Carousel,
// // // // //   CarouselContent,
// // // // //   CarouselItem,
// // // // //   CarouselNext,
// // // // //   CarouselPrevious,
// // // // // } from "@/components/ui/carousel";
// // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';
// // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';

// // // // // import egyptBoundaryData from '@/data/egypt_boundary.json'; // Ensure this path is correct


// // // // // type HeroSearchSubmitParams = Pick<
// // // // //   FrontendShopQueryParameters,
// // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // >;

// // // // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // // // // Ensure Leaflet CSS is imported globally if not done in layout.tsx
// // // // // // For example: import 'leaflet/dist/leaflet.css'; (usually in layout or globals)

// // // // // export default function HomePage() {
// // // // //   const router = useRouter();
// // // // //   const searchParams = useSearchParams();

// // // // //   const {
// // // // //     currentLocation: contextLocation,
// // // // //     setCurrentLocation: setContextLocation,
// // // // //     isLoading: isLoadingContextLocation,
// // // // //     error: contextGeoError,
// // // // //     clearError: clearContextGeoError,
// // // // //     attemptBrowserGpsLocation,
// // // // //     isLoadingInitialPreference,
// // // // //   } = useUserGeoLocation();

// // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // // // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // // // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // // // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // // // //     if (!egyptBoundaryData) return null;
// // // // //     try {
// // // // //       return JSON.stringify(egyptBoundaryData);
// // // // //     } catch (e) {
// // // // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // // // //       return null;
// // // // //     }
// // // // //   }, []);

// // // // //   const {
// // // // //     data: operationalAreas,
// // // // //     isLoading: isLoadingOperationalAreas,
// // // // //     error: operationalAreasError
// // // // //   } = useQuery<OperationalAreaDto[], APIError>({
// // // // //     queryKey: ['operationalAreasForMap'],
// // // // //     queryFn: fetchOperationalAreasForMap,
// // // // //     staleTime: 1000 * 60 * 60,
// // // // //     refetchOnWindowFocus: false,
// // // // //   });

// // // // //   const {
// // // // //     data: legacyCities,
// // // // //     isLoading: isLoadingLegacyCities,
// // // // //     error: legacyCitiesError
// // // // //   } = useQuery<CityDto[], APIError>({
// // // // //       queryKey: ['legacyCities'],
// // // // //       queryFn: fetchCities,
// // // // //       staleTime: 1000 * 60 * 60,
// // // // //       refetchOnWindowFocus: false,
// // // // //     });

// // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // // // //       enabled: !!activeOperationalArea?.slug,
// // // // //       staleTime: 1000 * 60 * 5,
// // // // //   });

// // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // // // //       enabled: !!activeOperationalArea?.slug,
// // // // //       staleTime: 1000 * 60 * 5,
// // // // //   });

// // // // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // // // //     if (!areas || areas.length === 0) return null;
// // // // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // // // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // // // //       const distance = haversineDistance(userCoords, areaCoords);
// // // // //       if (closest === null) return currentArea;
// // // // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // // // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // // // //       return distance < closestDistance ? currentArea : closest;
// // // // //     }, null);
// // // // //   }, []);

// // // // //   useEffect(() => {
// // // // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // // // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // // // //       if (nearestArea) {
// // // // //         setActiveOperationalArea(nearestArea);
// // // // //         const areaSlugFromUrl = searchParams.get('area');
// // // // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // // // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // // // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // //             newUrlParams.delete('city');
// // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //         }
// // // // //       }
// // // // //     }
// // // // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // // // //   useEffect(() => {
// // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // //     if (urlLatStr && urlLonStr) {
// // // // //       const lat = parseFloat(urlLatStr);
// // // // //       const lon = parseFloat(urlLonStr);
// // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // //         }
// // // // //       }
// // // // //     }
// // // // //   }, [searchParams, contextLocation, setContextLocation]);

// // // // //   useEffect(() => {
// // // // //     const areaSlugFromUrl = searchParams.get('area');
// // // // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // // // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // // // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // // // //             if (areaFromUrl) {
// // // // //                 setActiveOperationalArea(areaFromUrl);
// // // // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // // // //                     setContextLocation({
// // // // //                         latitude: areaFromUrl.centroidLatitude,
// // // // //                         longitude: areaFromUrl.centroidLongitude,
// // // // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // // // //                         timestamp: Date.now()
// // // // //                     }, 'url_param');
// // // // //                 }
// // // // //             }
// // // // //         }
// // // // //     }
// // // // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // // // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // // // //     clearContextGeoError();
// // // // //     setPageLevelError(null);

// // // // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // // // //     if (!selectedOA) return;

// // // // //     setActiveOperationalArea(selectedOA);

// // // // //     const areaLocation: UserGeoLocation = {
// // // // //         latitude: selectedOA.centroidLatitude,
// // // // //         longitude: selectedOA.centroidLongitude,
// // // // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // //         timestamp: Date.now()
// // // // //     };
// // // // //     setContextLocation(areaLocation, 'manual');

// // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // //     newUrlParams.set("area", selectedOA.slug);
// // // // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // // // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // // // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // //     newUrlParams.delete('city');

// // // // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // // // //     const searchName = mainSearchInput?.value.trim();
// // // // //     if (searchName) newUrlParams.set("name", searchName);
// // // // //     else newUrlParams.delete("name");

// // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // // // //     const queryForNextPage = new URLSearchParams();
// // // // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // // // //     const searchName = mainSearchInput?.value.trim();
// // // // //     if (searchName) queryForNextPage.set("name", searchName);

// // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // // // //     if (!areaToUseSlug) {
// // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // //         if (!locationToUse) {
// // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // //                 onError: (errMsg, errCode) => {
// // // // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // // // //                     }
// // // // //                 }
// // // // //             });
// // // // //             locationToUse = detectedLocationForSubCat;
// // // // //         }
// // // // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // // // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // // // //             if (nearestArea) {
// // // // //                 areaToUseSlug = nearestArea.slug;
// // // // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // // // //                     setActiveOperationalArea(nearestArea);
// // // // //                 }
// // // // //             } else {
// // // // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // // // //             }
// // // // //         }
// // // // //         if (!areaToUseSlug) {
// // // // //             setIsRedirecting(true);
// // // // //             const redirectParams = new URLSearchParams();
// // // // //             if (searchName) redirectParams.set("name", searchName);
// // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // //             router.push(`/select-area?${redirectParams.toString()}`);
// // // // //             setProcessingSubCategoryId(null); return;
// // // // //         }
// // // // //     }
// // // // //     if (locationToUse) {
// // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // //     }
// // // // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // //     setProcessingSubCategoryId(null);
// // // // //   };

// // // // //   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // //     const searchName = submittedCriteria.name;
// // // // //     const newUrlParams = new URLSearchParams();
// // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // //     let targetOperationalArea = activeOperationalArea;

// // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // // // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // // // //             setIsProcessingHeroAction(false); return;
// // // // //         }
// // // // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // // // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // // // //         setContextLocation(newGpsLocation, 'gps');

// // // // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // // // //         if (nearestArea) {
// // // // //             targetOperationalArea = nearestArea;
// // // // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // //         } else {
// // // // //             newUrlParams.delete('area');
// // // // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // // // //         }
// // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // // // //     } else {
// // // // //         if (targetOperationalArea) {
// // // // //             newUrlParams.set('area', targetOperationalArea.slug);
// // // // //             if (contextLocation) {
// // // // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // //             } else {
// // // // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // // // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // // // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // //             }
// // // // //         } else if (contextLocation) {
// // // // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // //         }
// // // // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // // // //     }

// // // // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // // // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // // // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // // // //                                             : "general-maintenance";

// // // // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // // // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // // // //     } else if (searchName && !targetOperationalArea) {
// // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
// // // // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // // // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //     } else {
// // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //     }
// // // // //     setIsProcessingHeroAction(false);
// // // // //   };

// // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // // // //     if (correspondingOA) {
// // // // //         setActiveOperationalArea(correspondingOA);
// // // // //         const areaLocation: UserGeoLocation = {
// // // // //             latitude: correspondingOA.centroidLatitude,
// // // // //             longitude: correspondingOA.centroidLongitude,
// // // // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // //             timestamp: Date.now()
// // // // //         };
// // // // //         setContextLocation(areaLocation, 'manual');

// // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // //         newUrlParams.set("area", correspondingOA.slug);
// // // // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // // // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // // // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // //         newUrlParams.delete('city');
// // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //     } else {
// // // // //         setActiveLegacyCity(city);
// // // // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // // // //         setContextLocation(cityLocation, 'manual_city');
// // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // //         newUrlParams.set("city", city.slug);
// // // // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // // // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // // // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // // // //         newUrlParams.delete('area');
// // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //     }
// // // // //   };

// // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // //     if (!activeOperationalArea) {
// // // // //         setPageLevelError("Please select an operational area first to explore services.");
// // // // //         return;
// // // // //     }
// // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // //     query.delete('city');
// // // // //     query.set('area', activeOperationalArea.slug);

// // // // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // //   };

// // // // //   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // //     const urlSortBy = searchParams.get('sortBy');

// // // // //     if (urlLat && urlLon) {
// // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // // // //     } else if (contextLocation) {
// // // // //         const sortByValue = urlSortBy ||
// // // // //                             (contextLocation.source &&
// // // // //                              (contextLocation.source.startsWith('gps') ||
// // // // //                               contextLocation.source === 'preference_loaded' ||
// // // // //                               contextLocation.source === 'manual'
// // // // //                              ) ? 'distance_asc' : undefined);
// // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // // // //     }
// // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // // // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // //     if (!activeOperationalArea?.slug) {
// // // // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // // // //         return conceptGroup?.subCategories.map(sc => ({
// // // // //             name: sc.name,
// // // // //             slug: sc.slug,
// // // // //             shopCount: 0,
// // // // //             subCategoryEnum: 0,
// // // // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // // // //         })) || [];
// // // // //     }
// // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // //     return [];
// // // // //   };

// // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // //     if (!activeOperationalArea?.slug) return false;
// // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // //     return false;
// // // // //   };

// // // // //   // Header height class is now used to push content below the fixed actual header
// // // // //   const HEADER_OFFSET_CLASS = "pt-[68px] sm:pt-[84px]"; 

// // // // //   return (
// // // // //      <div className="flex flex-col min-h-screen"> {/* Main container for the page */}
// // // // //       {/* HeroBillboard (Map Area) - Takes specific height, no overlay from here */}
// // // // //       <div className={`${HEADER_OFFSET_CLASS} w-full`}> {/* This div accounts for the fixed header height */}
// // // // //         <HeroBillboard
// // // // //           minHeight="h-[40vh]" // Tailwind class for height: 40vh
// // // // //           isMapMode={true}
// // // // //           operationalAreas={operationalAreas || []}
// // // // //           isLoadingMapData={isLoadingOperationalAreas}
// // // // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // // // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // // // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// // // // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// // // // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// // // // //         />
// // // // //       </div>

// // // // //       {/* Content Area Below Map - With Glass Effect and Scrolling */}
// // // // //       {/* This div will take the remaining height and allow internal scrolling if content overflows */}
// // // // //       <div className="flex-grow w-full bg-black/20 backdrop-blur-lg border-t border-white/10 shadow-xl overflow-y-auto">
// // // // //         <div className="max-w-7xl mx-auto"> {/* Centering content */}
// // // // //           {/* Search Form Area - Glass effect, part of the scrollable content */}
// // // // //           <div className="w-full bg-black/30 backdrop-blur-md border-b border-white/20 shadow-lg p-3 sm:p-4 sticky top-0 z-10"> {/* Sticky search form within this scrollable area */}
// // // // //             <div className="max-w-3xl mx-auto">
// // // // //               <ShopSearchForm
// // // // //                 onSubmit={handlePageSearchSubmit}
// // // // //                 initialValues={initialPageSearchValues}
// // // // //                 isLoading={isProcessingHeroAction || isLoadingGeo}
// // // // //                 formInstanceId="page-shop-search"
// // // // //                 showDetectLocationButton={true}
// // // // //               />
// // // // //             </div>
// // // // //           </div>

// // // // //           {/* Main Content Sections (Carousels, Legacy Cities, etc.) */}
// // // // //           <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
// // // // //             {/* Messages and errors - styled for glass */}
// // // // //             {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // // // //               <div className="mb-6 p-3 sm:p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-400/40 rounded-lg text-center shadow-md">
// // // // //                 <p className="text-sm sm:text-base text-blue-200">
// // // // //                   {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // // // //                 </p>
// // // // //               </div>
// // // // //             )}
// // // // //             {activeOperationalArea && (
// // // // //               <div className="mb-6 sm:mb-8 text-center p-3 bg-black/30 backdrop-blur-sm rounded-lg shadow-lg">
// // // // //                 <p className="text-base sm:text-lg text-slate-100">
// // // // //                   Showing services and parts for: <span className="font-semibold text-emerald-400">{activeOperationalArea.nameEn}</span>
// // // // //                 </p>
// // // // //                 <Button
// // // // //                   variant="link"
// // // // //                   onClick={() => {
// // // // //                     setActiveOperationalArea(null);
// // // // //                     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // //                     newUrlParams.delete('area');
// // // // //                     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // //                   }}
// // // // //                   className="text-xs text-slate-400 hover:text-emerald-300 mt-1"
// // // // //                 >
// // // // //                   (Change area or use current location)
// // // // //                 </Button>
// // // // //               </div>
// // // // //             )}

// // // // //             {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // //               <div className="text-center my-4 sm:my-6 p-3 bg-blue-500/30 backdrop-blur-sm text-blue-100 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
// // // // //                 <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // //                 <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // //               </div>
// // // // //             )}
// // // // //             {pageLevelError && !isRedirecting && (
// // // // //               <div className="text-center my-4 sm:my-6 p-3 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-md shadow-md text-sm">
// // // // //                 {pageLevelError}
// // // // //               </div>
// // // // //             )}
// // // // //             {showGenericGeoError && contextGeoError && (
// // // // //               <div className="text-center my-4 sm:my-6 p-3 bg-yellow-500/30 backdrop-blur-sm text-yellow-100 rounded-md shadow-md text-sm">
// // // // //                 Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // // // //               </div>
// // // // //             )}
// // // // //             {operationalAreasError && (
// // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-md shadow-md text-sm">
// // // // //                   Error loading operational areas: {operationalAreasError.message}
// // // // //                 </div>
// // // // //             )}

// // // // //           {/* Carousels and other content sections - styled for glass */}
// // // // //           {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // //               const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // //               const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // // // //               if (!conceptGroup.concept) return null;
// // // // //               if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;

// // // // //               return (
// // // // //                 <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // //                   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // //                     <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
// // // // //                       {conceptGroup.concept.nameEn}
// // // // //                       {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-300 mt-1 sm:mt-0 text-shadow-medium"> in {activeOperationalArea.nameEn}</span>}
// // // // //                     </h2>
// // // // //                     {activeOperationalArea && actualSubCategories.length > 0 && (
// // // // //                       <Button
// // // // //                         variant="outline" // This variant needs glass-friendly styling from your Button component or overrides
// // // // //                         size="sm"
// // // // //                         onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // //                         className="self-start sm:self-auto text-white border-white/30 hover:bg-black/50 hover:border-white/50 backdrop-blur-sm shadow-md"
// // // // //                       >
// // // // //                         Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // //                       </Button>
// // // // //                     )}
// // // // //                   </div>
// // // // //                   {isLoadingThisCarousel ? (
// // // // //                     <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // //                       <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-400"/>
// // // // //                     </div>
// // // // //                   ) : actualSubCategories.length > 0 ? (
// // // // //                     <div className="relative">
// // // // //                       <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // // // //                         <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // //                           {actualSubCategories.map((subCat, index) => (
// // // // //                             <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // // // //                               <div className="p-1 h-full">
// // // // //                                 <SubCategoryCarouselItem // Apply glass theme
// // // // //                                   //theme="glass" 
// // // // //                                   subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // // // //                                   onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // //                                   shopCount={subCat.shopCount}
// // // // //                                   isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // //                                 />
// // // // //                               </div>
// // // // //                             </CarouselItem>
// // // // //                           ))}
// // // // //                         </CarouselContent>
// // // // //                         <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // // // //                           <CarouselPrevious className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // //                           <CarouselNext className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // //                         </div>
// // // // //                         <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // //                         <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // //                       </Carousel>
// // // // //                     </div>
// // // // //                   ) : (
// // // // //                     <p className="text-slate-400 text-sm">
// // // // //                       {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // // // //                                               : "Select an area on the map or allow location access to see available services."}
// // // // //                     </p>
// // // // //                   )}
// // // // //                 </section>
// // // // //               );
// // // // //             })}

// // // // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
// // // // //               <div className="text-center mb-8 md:mb-10">
// // // // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
// // // // //                   Or, Browse by City (Legacy)
// // // // //                 </h2>
// // // // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
// // // // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // //                 </p>
// // // // //               </div>

// // // // //               {isLoadingLegacyCities ? (
// // // // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" /></div>
// // // // //               ) : legacyCitiesError ? (
// // // // //                 <div className="my-6 p-4 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // // // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // // // //                   <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
// // // // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // // // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // //                   {legacyCities.map((city: CityDto) => (
// // // // //                     <CityCard // Apply glass theme
// // // // //                       //theme="glass"
// // // // //                       key={city.id}
// // // // //                       city={city}
// // // // //                       onClick={() => handleCityCardClick(city)}
// // // // //                     />
// // // // //                   ))}
// // // // //                 </div>
// // // // //               ): null}
// // // // //             </section>
// // // // //           </div>
// // // // //         </div>
// // // // //       </div>
// // // // //     </div>
// // // // //   );
// // // // // }
// // // // // // 'use client';

// // // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // import {
// // // // // //     fetchCities,
// // // // // //     fetchOperationalAreasForMap,
// // // // // //     fetchSubCategoriesByOperationalArea
// // // // // // } from '@/lib/apiClient';
// // // // // // import {
// // // // // //     CityDto,
// // // // // //     OperationalAreaDto,
// // // // // //     OperationalAreaFeatureProperties,
// // // // // //     APIError,
// // // // // //     FrontendShopQueryParameters,
// // // // // //     SubCategoryDto,
// // // // // //     HighLevelConceptQueryParam
// // // // // // } from '@/types/api';
// // // // // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // import CityCard from '@/components/city/CityCard'; // Assume this will be themed
// // // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import {
// // // // // //   Carousel,
// // // // // //   CarouselContent,
// // // // // //   CarouselItem,
// // // // // //   CarouselNext,
// // // // // //   CarouselPrevious,
// // // // // // } from "@/components/ui/carousel";
// // // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem'; // Assume this will be themed
// // // // // // import ShopSearchForm from '@/components/search/ShopSearchForm';

// // // // // // import egyptBoundaryData from '@/data/egypt_boundary.json';


// // // // // // type HeroSearchSubmitParams = Pick<
// // // // // //   FrontendShopQueryParameters,
// // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // >;

// // // // // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // // // // export default function HomePage() {
// // // // // //   const router = useRouter();
// // // // // //   const searchParams = useSearchParams();

// // // // // //   const {
// // // // // //     currentLocation: contextLocation,
// // // // // //     setCurrentLocation: setContextLocation,
// // // // // //     isLoading: isLoadingContextLocation,
// // // // // //     error: contextGeoError,
// // // // // //     clearError: clearContextGeoError,
// // // // // //     attemptBrowserGpsLocation,
// // // // // //     isLoadingInitialPreference,
// // // // // //   } = useUserGeoLocation();

// // // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // // // // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // // // // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // // // // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // // // // //     if (!egyptBoundaryData) return null;
// // // // // //     try {
// // // // // //       return JSON.stringify(egyptBoundaryData);
// // // // // //     } catch (e) {
// // // // // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // // // // //       return null;
// // // // // //     }
// // // // // //   }, []);

// // // // // //   const {
// // // // // //     data: operationalAreas,
// // // // // //     isLoading: isLoadingOperationalAreas,
// // // // // //     error: operationalAreasError
// // // // // //   } = useQuery<OperationalAreaDto[], APIError>({
// // // // // //     queryKey: ['operationalAreasForMap'],
// // // // // //     queryFn: fetchOperationalAreasForMap,
// // // // // //     staleTime: 1000 * 60 * 60,
// // // // // //     refetchOnWindowFocus: false,
// // // // // //   });

// // // // // //   const {
// // // // // //     data: legacyCities,
// // // // // //     isLoading: isLoadingLegacyCities,
// // // // // //     error: legacyCitiesError
// // // // // //   } = useQuery<CityDto[], APIError>({
// // // // // //       queryKey: ['legacyCities'],
// // // // // //       queryFn: fetchCities,
// // // // // //       staleTime: 1000 * 60 * 60,
// // // // // //       refetchOnWindowFocus: false,
// // // // // //     });

// // // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // //       staleTime: 1000 * 60 * 5,
// // // // // //   });

// // // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // //       staleTime: 1000 * 60 * 5,
// // // // // //   });

// // // // // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // // // // //     if (!areas || areas.length === 0) return null;
// // // // // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // // // // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // // // // //       const distance = haversineDistance(userCoords, areaCoords);
// // // // // //       if (closest === null) return currentArea;
// // // // // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // // // // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // // // // //       return distance < closestDistance ? currentArea : closest;
// // // // // //     }, null);
// // // // // //   }, []);

// // // // // //   useEffect(() => {
// // // // // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // // // // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // // // // //       if (nearestArea) {
// // // // // //         setActiveOperationalArea(nearestArea);
// // // // // //         const areaSlugFromUrl = searchParams.get('area');
// // // // // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // // // // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // // // // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // //             newUrlParams.delete('city');
// // // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //         }
// // // // // //       }
// // // // // //     }
// // // // // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // // // // //   useEffect(() => {
// // // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // // //     if (urlLatStr && urlLonStr) {
// // // // // //       const lat = parseFloat(urlLatStr);
// // // // // //       const lon = parseFloat(urlLonStr);
// // // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // // //         }
// // // // // //       }
// // // // // //     }
// // // // // //   }, [searchParams, contextLocation, setContextLocation]);

// // // // // //   useEffect(() => {
// // // // // //     const areaSlugFromUrl = searchParams.get('area');
// // // // // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // // // // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // // // // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // // // // //             if (areaFromUrl) {
// // // // // //                 setActiveOperationalArea(areaFromUrl);
// // // // // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // // // // //                     setContextLocation({
// // // // // //                         latitude: areaFromUrl.centroidLatitude,
// // // // // //                         longitude: areaFromUrl.centroidLongitude,
// // // // // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // // // // //                         timestamp: Date.now()
// // // // // //                     }, 'url_param');
// // // // // //                 }
// // // // // //             }
// // // // // //         }
// // // // // //     }
// // // // // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // // // // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // // // // //     clearContextGeoError();
// // // // // //     setPageLevelError(null);

// // // // // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // // // // //     if (!selectedOA) return;

// // // // // //     setActiveOperationalArea(selectedOA);

// // // // // //     const areaLocation: UserGeoLocation = {
// // // // // //         latitude: selectedOA.centroidLatitude,
// // // // // //         longitude: selectedOA.centroidLongitude,
// // // // // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // //         timestamp: Date.now()
// // // // // //     };
// // // // // //     setContextLocation(areaLocation, 'manual');

// // // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // //     newUrlParams.set("area", selectedOA.slug);
// // // // // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // // // // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // // // // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // //     newUrlParams.delete('city');

// // // // // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // // // // //     const searchName = mainSearchInput?.value.trim();
// // // // // //     if (searchName) newUrlParams.set("name", searchName);
// // // // // //     else newUrlParams.delete("name");

// // // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // // // // //     const queryForNextPage = new URLSearchParams();
// // // // // //     const mainSearchInput = document.getElementById('page-shop-search-mainSearchInput') as HTMLInputElement;
// // // // // //     const searchName = mainSearchInput?.value.trim();
// // // // // //     if (searchName) queryForNextPage.set("name", searchName);

// // // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // // // // //     if (!areaToUseSlug) {
// // // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // // //         if (!locationToUse) {
// // // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // // //                 onError: (errMsg, errCode) => {
// // // // // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // // // // //                     }
// // // // // //                 }
// // // // // //             });
// // // // // //             locationToUse = detectedLocationForSubCat;
// // // // // //         }
// // // // // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // // // // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // // // // //             if (nearestArea) {
// // // // // //                 areaToUseSlug = nearestArea.slug;
// // // // // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // // // // //                     setActiveOperationalArea(nearestArea);
// // // // // //                 }
// // // // // //             } else {
// // // // // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // // // // //             }
// // // // // //         }
// // // // // //         if (!areaToUseSlug) {
// // // // // //             setIsRedirecting(true);
// // // // // //             const redirectParams = new URLSearchParams();
// // // // // //             if (searchName) redirectParams.set("name", searchName);
// // // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // // //             router.push(`/select-area?${redirectParams.toString()}`);
// // // // // //             setProcessingSubCategoryId(null); return;
// // // // // //         }
// // // // // //     }
// // // // // //     if (locationToUse) {
// // // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // // //     }
// // // // // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // // //     setProcessingSubCategoryId(null);
// // // // // //   };

// // // // // //   const handlePageSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // // //     const searchName = submittedCriteria.name;
// // // // // //     const newUrlParams = new URLSearchParams();
// // // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // // //     let targetOperationalArea = activeOperationalArea;

// // // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // // // // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // // // // //             setIsProcessingHeroAction(false); return;
// // // // // //         }
// // // // // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // // // // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // // // // //         setContextLocation(newGpsLocation, 'gps');

// // // // // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // // // // //         if (nearestArea) {
// // // // // //             targetOperationalArea = nearestArea;
// // // // // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // //         } else {
// // // // // //             newUrlParams.delete('area');
// // // // // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // // // // //         }
// // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // // // // //     } else {
// // // // // //         if (targetOperationalArea) {
// // // // // //             newUrlParams.set('area', targetOperationalArea.slug);
// // // // // //             if (contextLocation) {
// // // // // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // //             } else {
// // // // // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // // // // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // // // // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // //             }
// // // // // //         } else if (contextLocation) {
// // // // // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // //         }
// // // // // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // // // // //     }

// // // // // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // // // // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // // // // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // // // // //                                             : "general-maintenance";

// // // // // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // // // // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // // // // //     } else if (searchName && !targetOperationalArea) {
// // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //         setPageLevelError("Please select an operational area on the map to search within, or allow location access for automatic area detection.");
// // // // // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // // // // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //     } else {
// // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //     }
// // // // // //     setIsProcessingHeroAction(false);
// // // // // //   };

// // // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // // // // //     if (correspondingOA) {
// // // // // //         setActiveOperationalArea(correspondingOA);
// // // // // //         const areaLocation: UserGeoLocation = {
// // // // // //             latitude: correspondingOA.centroidLatitude,
// // // // // //             longitude: correspondingOA.centroidLongitude,
// // // // // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // //             timestamp: Date.now()
// // // // // //         };
// // // // // //         setContextLocation(areaLocation, 'manual');

// // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // //         newUrlParams.set("area", correspondingOA.slug);
// // // // // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // // // // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // // // // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // //         newUrlParams.delete('city');
// // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //     } else {
// // // // // //         setActiveLegacyCity(city);
// // // // // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // // // // //         setContextLocation(cityLocation, 'manual_city');
// // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // //         newUrlParams.set("city", city.slug);
// // // // // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // // // // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // // // // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // // // // //         newUrlParams.delete('area');
// // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //     }
// // // // // //   };

// // // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // // //     if (!activeOperationalArea) {
// // // // // //         setPageLevelError("Please select an operational area first to explore services.");
// // // // // //         return;
// // // // // //     }
// // // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // // //     query.delete('city');
// // // // // //     query.set('area', activeOperationalArea.slug);

// // // // // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // // //   };

// // // // // //   const initialPageSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // // //     const urlSortBy = searchParams.get('sortBy');

// // // // // //     if (urlLat && urlLon) {
// // // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // // // // //     } else if (contextLocation) {
// // // // // //         const sortByValue = urlSortBy ||
// // // // // //                             (contextLocation.source &&
// // // // // //                              (contextLocation.source.startsWith('gps') ||
// // // // // //                               contextLocation.source === 'preference_loaded' ||
// // // // // //                               contextLocation.source === 'manual'
// // // // // //                              ) ? 'distance_asc' : undefined);
// // // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // // // // //     }
// // // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // // // // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // // //     if (!activeOperationalArea?.slug) {
// // // // // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // // // // //         return conceptGroup?.subCategories.map(sc => ({
// // // // // //             name: sc.name,
// // // // // //             slug: sc.slug,
// // // // // //             shopCount: 0,
// // // // // //             subCategoryEnum: 0,
// // // // // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // // // // //         })) || [];
// // // // // //     }
// // // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // // //     return [];
// // // // // //   };

// // // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // // //     if (!activeOperationalArea?.slug) return false;
// // // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // // //     return false;
// // // // // //   };

// // // // // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

// // // // // //   return (
// // // // // //     // This main div is the scroll container for the page content.
// // // // // //     // The map will be fixed behind it.
// // // // // //     //  <div className="relative min-h-screen overflow-x-hidden">
// // // // // //       {/* MAP BACKGROUND: Fixed and behind content */}
// // // // // //       <div className="fixed inset-0 z-0">
// // // // // //         <HeroBillboard
// // // // // //           title="" // Minimal or no title directly on map overlay
// // // // // //           subtitle=""
// // // // // //           minHeight="min-h-screen"
// // // // // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} // For text overlay if used
// // // // // //           isMapMode={true}
// // // // // //           operationalAreas={operationalAreas || []}
// // // // // //           isLoadingMapData={isLoadingOperationalAreas}
// // // // // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // // // // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // // // // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// // // // // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// // // // // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// // // // // //         />
// // // // // //       {/* </div> */}

// // // // // //       {/* PAGE CONTENT WRAPPER: Sits on top of the map, handles scrolling */}
// // // // // //       {/* The Header component is fixed with z-50. This content starts below it. */}
// // // // // //       <div className={`relative z-10 ${HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} min-h-screen flex flex-col`}>
// // // // // //           {/* SEARCH FORM Area: Glass effect, at the top of the scrollable content */}
// // // // // //           <div className="w-full bg-black/40 backdrop-blur-lg border-b border-white/20 shadow-lg sticky top-[68px] sm:top-[84px] z-20"> {/* Sticky to keep it visible under header */}
// // // // // //             <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
// // // // // //               <ShopSearchForm
// // // // // //                 onSubmit={handlePageSearchSubmit}
// // // // // //                 initialValues={initialPageSearchValues}
// // // // // //                 isLoading={isProcessingHeroAction || isLoadingGeo}
// // // // // //                 formInstanceId="page-shop-search"
// // // // // //                 showDetectLocationButton={true}
// // // // // //               />
// // // // // //             </div>
// // // // // //           </div>

// // // // // //           {/* MAIN CONTENT Area: Rest of the content, also with glass effect or within a glass container */}
// // // // // //           {/* This part will scroll. The bg-black/20 is to ensure if content is shorter than viewport, the glass effect continues */}
// // // // // //           <div className="flex-grow w-full bg-black/10 backdrop-blur-md"> {/* Lighter backdrop for content distinction if desired */}
// // // // // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
// // // // // //               {/* Messages and errors - styled for glass */}
// // // // // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // // // // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-500/20 backdrop-blur-sm border border-blue-400/40 rounded-lg text-center shadow-md">
// // // // // //                   <p className="text-sm sm:text-base text-blue-200">
// // // // // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // // // // //                   </p>
// // // // // //                 </div>
// // // // // //               )}
// // // // // //               {activeOperationalArea && (
// // // // // //                 <div className="mb-6 sm:mb-8 text-center p-3 bg-black/30 backdrop-blur-sm rounded-lg shadow-lg">
// // // // // //                   <p className="text-base sm:text-lg text-slate-100">
// // // // // //                     Showing services and parts for: <span className="font-semibold text-emerald-400">{activeOperationalArea.nameEn}</span>
// // // // // //                   </p>
// // // // // //                   <Button
// // // // // //                     variant="link"
// // // // // //                     onClick={() => {
// // // // // //                       setActiveOperationalArea(null);
// // // // // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // //                       newUrlParams.delete('area');
// // // // // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // //                     }}
// // // // // //                     className="text-xs text-slate-400 hover:text-emerald-300 mt-1"
// // // // // //                   >
// // // // // //                     (Change area or use current location)
// // // // // //                   </Button>
// // // // // //                 </div>
// // // // // //               )}

// // // // // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-500/30 backdrop-blur-sm text-blue-100 rounded-md shadow-md flex items-center justify-center space-x-2 text-sm">
// // // // // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // //                 </div>
// // // // // //               )}
// // // // // //               {pageLevelError && !isRedirecting && (
// // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-md shadow-md text-sm">
// // // // // //                   {pageLevelError}
// // // // // //                 </div>
// // // // // //               )}
// // // // // //               {showGenericGeoError && contextGeoError && (
// // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-500/30 backdrop-blur-sm text-yellow-100 rounded-md shadow-md text-sm">
// // // // // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // // // // //                 </div>
// // // // // //               )}
// // // // // //               {operationalAreasError && (
// // // // // //                  <div className="text-center my-4 sm:my-6 p-3 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-md shadow-md text-sm">
// // // // // //                     Error loading operational areas: {operationalAreasError.message}
// // // // // //                  </div>
// // // // // //               )}

// // // // // //             {/* Carousels and other content sections - styled for glass */}
// // // // // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // // // // //                 if (!conceptGroup.concept) return null;
// // // // // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;

// // // // // //                 return (
// // // // // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-shadow-strong">
// // // // // //                         {conceptGroup.concept.nameEn}
// // // // // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-300 mt-1 sm:mt-0 text-shadow-medium"> in {activeOperationalArea.nameEn}</span>}
// // // // // //                       </h2>
// // // // // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // // // // //                         <Button
// // // // // //                           variant="outline"
// // // // // //                           size="sm"
// // // // // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // // //                           className="self-start sm:self-auto text-white border-white/30 hover:bg-black/50 hover:border-white/50 backdrop-blur-sm shadow-md"
// // // // // //                         >
// // // // // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // //                         </Button>
// // // // // //                       )}
// // // // // //                     </div>
// // // // // //                     {isLoadingThisCarousel ? (
// // // // // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-emerald-400"/>
// // // // // //                       </div>
// // // // // //                     ) : actualSubCategories.length > 0 ? (
// // // // // //                       <div className="relative">
// // // // // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // // // // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // // //                             {actualSubCategories.map((subCat, index) => (
// // // // // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // // // // //                                 <div className="p-1 h-full">
// // // // // //                                   <SubCategoryCarouselItem // Needs to be styled for glass background
// // // // // //                                     //theme="glass" // Pass a theme prop
// // // // // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // // // // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // //                                     shopCount={subCat.shopCount}
// // // // // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // //                                   />
// // // // // //                                 </div>
// // // // // //                               </CarouselItem>
// // // // // //                             ))}
// // // // // //                           </CarouselContent>
// // // // // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden"> {/* Mobile arrows */}
// // // // // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // // //                             <CarouselNext className="static translate-y-0 h-8 w-8 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // // //                           </div>
// // // // // //                           {/* Desktop arrows */}
// // // // // //                           <CarouselPrevious className="hidden sm:flex -left-3 lg:-left-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // // //                           <CarouselNext className="hidden sm:flex -right-3 lg:-right-5 h-9 w-9 text-white bg-black/40 hover:bg-black/60 border border-white/30 backdrop-blur-md shadow-lg" />
// // // // // //                         </Carousel>
// // // // // //                       </div>
// // // // // //                     ) : (
// // // // // //                       <p className="text-slate-400 text-sm">
// // // // // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // // // // //                                                : "Select an area on the map or allow location access to see available services."}
// // // // // //                       </p>
// // // // // //                     )}
// // // // // //                   </section>
// // // // // //                 );
// // // // // //               })}

// // // // // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-white/20">
// // // // // //               <div className="text-center mb-8 md:mb-10">
// // // // // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-shadow-strong">
// // // // // //                   Or, Browse by City (Legacy)
// // // // // //                 </h2>
// // // // // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-slate-300 text-shadow-medium">
// // // // // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // // //                 </p>
// // // // // //               </div>

// // // // // //               {isLoadingLegacyCities ? (
// // // // // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" /></div>
// // // // // //               ) : legacyCitiesError ? (
// // // // // //                 <div className="my-6 p-4 bg-red-500/30 backdrop-blur-sm text-red-200 rounded-lg shadow-md text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // // // // //                  <p className="text-center text-slate-400 text-lg py-10">No cities are currently listed.</p>
// // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // // // // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // // //                   {legacyCities.map((city: CityDto) => (
// // // // // //                     <CityCard // Needs to be styled for glass background
// // // // // //                       //theme="glass" // Pass a theme prop
// // // // // //                       key={city.id}
// // // // // //                       city={city}
// // // // // //                       onClick={() => handleCityCardClick(city)}
// // // // // //                     />
// // // // // //                   ))}
// // // // // //                 </div>
// // // // // //               ): null}
// // // // // //             </section>
// // // // // //             </div>
// // // // // //           </div>
// // // // // //       </div>
// // // // // //     </div>
// // // // // //   );
// // // // // // }
// // // // // // // 'use client';

// // // // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // import {
// // // // // // //     fetchCities,
// // // // // // //     fetchOperationalAreasForMap,
// // // // // // //     fetchSubCategoriesByOperationalArea
// // // // // // // } from '@/lib/apiClient';
// // // // // // // import {
// // // // // // //     CityDto,
// // // // // // //     OperationalAreaDto,
// // // // // // //     OperationalAreaFeatureProperties,
// // // // // // //     APIError,
// // // // // // //     FrontendShopQueryParameters,
// // // // // // //     SubCategoryDto,
// // // // // // //     HighLevelConceptQueryParam
// // // // // // // } from '@/types/api';
// // // // // // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // // import CityCard from '@/components/city/CityCard';
// // // // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // import {
// // // // // // //   Carousel,
// // // // // // //   CarouselContent,
// // // // // // //   CarouselItem,
// // // // // // //   CarouselNext,
// // // // // // //   CarouselPrevious,
// // // // // // // } from "@/components/ui/carousel";
// // // // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';

// // // // // // // import egyptBoundaryData from '@/data/egypt_boundary.json';


// // // // // // // type HeroSearchSubmitParams = Pick<
// // // // // // //   FrontendShopQueryParameters,
// // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // >;

// // // // // // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // // // // // export default function HomePage() {
// // // // // // //   const router = useRouter();
// // // // // // //   const searchParams = useSearchParams();

// // // // // // //   const {
// // // // // // //     currentLocation: contextLocation,
// // // // // // //     setCurrentLocation: setContextLocation,
// // // // // // //     isLoading: isLoadingContextLocation,
// // // // // // //     error: contextGeoError,
// // // // // // //     clearError: clearContextGeoError,
// // // // // // //     attemptBrowserGpsLocation,
// // // // // // //     isLoadingInitialPreference,
// // // // // // //   } = useUserGeoLocation();

// // // // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // // // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // // // // // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // // // // // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // // // // // //   const [carouselItemsToShow, setCarouselItemsToShow] = useState(5);

// // // // // // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // // // // // //     if (!egyptBoundaryData) return null;
// // // // // // //     try {
// // // // // // //       return JSON.stringify(egyptBoundaryData);
// // // // // // //     } catch (e) {
// // // // // // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // // // // // //       return null;
// // // // // // //     }
// // // // // // //   }, []);

// // // // // // //   useEffect(() => {
// // // // // // //     const updateVisibleItems = () => {
// // // // // // //       if (typeof window !== 'undefined') {
// // // // // // //         if (window.innerWidth < 640) setCarouselItemsToShow(2);
// // // // // // //         else if (window.innerWidth < 768) setCarouselItemsToShow(3);
// // // // // // //         else if (window.innerWidth < 1024) setCarouselItemsToShow(4);
// // // // // // //         else setCarouselItemsToShow(5);
// // // // // // //       }
// // // // // // //     };
// // // // // // //     updateVisibleItems();
// // // // // // //     window.addEventListener('resize', updateVisibleItems);
// // // // // // //     return () => window.removeEventListener('resize', updateVisibleItems);
// // // // // // //   }, []);

// // // // // // //   const {
// // // // // // //     data: operationalAreas,
// // // // // // //     isLoading: isLoadingOperationalAreas,
// // // // // // //     error: operationalAreasError
// // // // // // //   } = useQuery<OperationalAreaDto[], APIError>({
// // // // // // //     queryKey: ['operationalAreasForMap'],
// // // // // // //     queryFn: fetchOperationalAreasForMap,
// // // // // // //     staleTime: 1000 * 60 * 60,
// // // // // // //     refetchOnWindowFocus: false,
// // // // // // //   });

// // // // // // //   const {
// // // // // // //     data: legacyCities,
// // // // // // //     isLoading: isLoadingLegacyCities,
// // // // // // //     error: legacyCitiesError
// // // // // // //   } = useQuery<CityDto[], APIError>({
// // // // // // //       queryKey: ['legacyCities'],
// // // // // // //       queryFn: fetchCities,
// // // // // // //       staleTime: 1000 * 60 * 60,
// // // // // // //       refetchOnWindowFocus: false,
// // // // // // //     });

// // // // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // //   });

// // // // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // //   });

// // // // // // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // // // // // //     if (!areas || areas.length === 0) return null;
// // // // // // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // // // // // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // // // // // //       const distance = haversineDistance(userCoords, areaCoords);
// // // // // // //       if (closest === null) return currentArea;
// // // // // // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // // // // // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // // // // // //       return distance < closestDistance ? currentArea : closest;
// // // // // // //     }, null);
// // // // // // //   }, []);

// // // // // // //   useEffect(() => {
// // // // // // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // // // // // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // // // // // //       if (nearestArea) {
// // // // // // //         setActiveOperationalArea(nearestArea);
// // // // // // //         const areaSlugFromUrl = searchParams.get('area');
// // // // // // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // // // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // // // // // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // // // // // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // //             newUrlParams.delete('city');
// // // // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //         }
// // // // // // //       }
// // // // // // //     }
// // // // // // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // // // // // //   useEffect(() => {
// // // // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // // // //     if (urlLatStr && urlLonStr) {
// // // // // // //       const lat = parseFloat(urlLatStr);
// // // // // // //       const lon = parseFloat(urlLonStr);
// // // // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // // // //         }
// // // // // // //       }
// // // // // // //     }
// // // // // // //   }, [searchParams, contextLocation, setContextLocation]);

// // // // // // //   useEffect(() => {
// // // // // // //     const areaSlugFromUrl = searchParams.get('area');
// // // // // // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // // // // // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // // // // // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // // // // // //             if (areaFromUrl) {
// // // // // // //                 setActiveOperationalArea(areaFromUrl);
// // // // // // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // // // // // //                     setContextLocation({
// // // // // // //                         latitude: areaFromUrl.centroidLatitude,
// // // // // // //                         longitude: areaFromUrl.centroidLongitude,
// // // // // // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // //                         timestamp: Date.now()
// // // // // // //                     }, 'url_param');
// // // // // // //                 }
// // // // // // //             }
// // // // // // //         }
// // // // // // //     }
// // // // // // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // // // // // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // // // // // //     clearContextGeoError();
// // // // // // //     setPageLevelError(null);

// // // // // // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // // // // // //     if (!selectedOA) return;

// // // // // // //     setActiveOperationalArea(selectedOA);

// // // // // // //     const areaLocation: UserGeoLocation = {
// // // // // // //         latitude: selectedOA.centroidLatitude,
// // // // // // //         longitude: selectedOA.centroidLongitude,
// // // // // // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // //         timestamp: Date.now()
// // // // // // //     };
// // // // // // //     setContextLocation(areaLocation, 'manual');

// // // // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // //     newUrlParams.set("area", selectedOA.slug);
// // // // // // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // // // // // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // // // // // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // //     newUrlParams.delete('city');

// // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // //     if (heroSearchName) newUrlParams.set("name", heroSearchName);
// // // // // // //     else newUrlParams.delete("name");

// // // // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // // // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // // // // // //     const queryForNextPage = new URLSearchParams();
// // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // //     if (heroSearchName) queryForNextPage.set("name", heroSearchName);

// // // // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // // // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // // // // // //     if (!areaToUseSlug) {
// // // // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // // // //         if (!locationToUse) {
// // // // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // // // //                 onError: (errMsg, errCode) => {
// // // // // // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // // // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // // // // // //                     }
// // // // // // //                 }
// // // // // // //             });
// // // // // // //             locationToUse = detectedLocationForSubCat;
// // // // // // //         }
// // // // // // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // // // // // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // // // // // //             if (nearestArea) {
// // // // // // //                 areaToUseSlug = nearestArea.slug;
// // // // // // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // // // // // //                     setActiveOperationalArea(nearestArea);
// // // // // // //                 }
// // // // // // //             } else {
// // // // // // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // // // // // //             }
// // // // // // //         }
// // // // // // //         if (!areaToUseSlug) {
// // // // // // //             setIsRedirecting(true);
// // // // // // //             const redirectParams = new URLSearchParams();
// // // // // // //             if (heroSearchName) redirectParams.set("name", heroSearchName);
// // // // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // // // //             router.push(`/select-area?${redirectParams.toString()}`);
// // // // // // //             setProcessingSubCategoryId(null); return;
// // // // // // //         }
// // // // // // //     }
// // // // // // //     if (locationToUse) {
// // // // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // // // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // // // //     }
// // // // // // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // // // //     setProcessingSubCategoryId(null);
// // // // // // //   };

// // // // // // //   const handleHeroSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // // // //     const searchName = submittedCriteria.name;
// // // // // // //     const newUrlParams = new URLSearchParams();
// // // // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // // // //     let targetOperationalArea = activeOperationalArea;

// // // // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // // // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // // // // // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // // // // // //             setIsProcessingHeroAction(false); return;
// // // // // // //         }
// // // // // // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // // // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // // // // // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // // // // // //         setContextLocation(newGpsLocation, 'gps');

// // // // // // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // // // // // //         if (nearestArea) {
// // // // // // //             targetOperationalArea = nearestArea;
// // // // // // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // //         } else {
// // // // // // //             newUrlParams.delete('area');
// // // // // // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // // // // // //         }
// // // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // // // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // // // // // //     } else {
// // // // // // //         if (targetOperationalArea) {
// // // // // // //             newUrlParams.set('area', targetOperationalArea.slug);
// // // // // // //             if (contextLocation) {
// // // // // // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // //             } else {
// // // // // // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // // // // // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // // // // // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // //             }
// // // // // // //         } else if (contextLocation) {
// // // // // // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // //         }
// // // // // // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // // // // // //     }

// // // // // // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // // // // // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // // // // // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // // // // // //                                             : "general-maintenance";

// // // // // // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // // // // // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // // // // // //     } else if (searchName && !targetOperationalArea) {
// // // // // // //         setPageLevelError("Please select an operational area to search within, or allow location access.");
// // // // // // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // // // // // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //     } else {
// // // // // // //         router.push(`/select-area?${newUrlParams.toString()}`);
// // // // // // //     }
// // // // // // //     setIsProcessingHeroAction(false);
// // // // // // //   };

// // // // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // // // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // // // // // //     if (correspondingOA) {
// // // // // // //         setActiveOperationalArea(correspondingOA);
// // // // // // //         const areaLocation: UserGeoLocation = {
// // // // // // //             latitude: correspondingOA.centroidLatitude,
// // // // // // //             longitude: correspondingOA.centroidLongitude,
// // // // // // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // //             timestamp: Date.now()
// // // // // // //         };
// // // // // // //         setContextLocation(areaLocation, 'manual');

// // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // //         newUrlParams.set("area", correspondingOA.slug);
// // // // // // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // // // // // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // // // // // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // //         newUrlParams.delete('city');
// // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //     } else {
// // // // // // //         setActiveLegacyCity(city);
// // // // // // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // // // // // //         setContextLocation(cityLocation, 'manual_city');
// // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // //         newUrlParams.set("city", city.slug);
// // // // // // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // // // // // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // // // // // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // // // // // //         newUrlParams.delete('area');
// // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //     }
// // // // // // //   };

// // // // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // // // //     if (!activeOperationalArea) {
// // // // // // //         setPageLevelError("Please select an operational area first to explore services.");
// // // // // // //         return;
// // // // // // //     }
// // // // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // // // //     query.delete('city');
// // // // // // //     query.set('area', activeOperationalArea.slug);

// // // // // // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // // // //   };

// // // // // // //   const initialHeroSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // // // //     const urlSortBy = searchParams.get('sortBy');

// // // // // // //     if (urlLat && urlLon) {
// // // // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // // // // // //     } else if (contextLocation) {
// // // // // // //         const sortByValue = urlSortBy ||
// // // // // // //                             (contextLocation.source &&
// // // // // // //                              (contextLocation.source.startsWith('gps') ||
// // // // // // //                               contextLocation.source === 'preference_loaded' ||
// // // // // // //                               contextLocation.source === 'manual'
// // // // // // //                              ) ? 'distance_asc' : undefined);
// // // // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // // // // // //     }
// // // // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // // // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // // // // // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // // // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // // // //     if (!activeOperationalArea?.slug) {
// // // // // // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // // // // // //         return conceptGroup?.subCategories.map(sc => ({
// // // // // // //             name: sc.name,
// // // // // // //             slug: sc.slug,
// // // // // // //             shopCount: 0,
// // // // // // //             subCategoryEnum: 0,
// // // // // // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // // // // // //         })) || [];
// // // // // // //     }
// // // // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // // // //     return [];
// // // // // // //   };

// // // // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // // // //     if (!activeOperationalArea?.slug) return false;
// // // // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // // // //     return false;
// // // // // // //   };

// // // // // // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

// // // // // // //   return (
// // // // // // //      <div className="relative min-h-screen overflow-x-hidden">
// // // // // // //       <div className="relative z-30">
// // // // // // //         <HeroBillboard
// // // // // // //           title="Automotive Services & Parts" highlightText="Simplified"
// // // // // // //           subtitle="Find reliable maintenance centers and a diverse auto parts marketplace."
// // // // // // //           showSearch={true}
// // // // // // //           searchProps={{
// // // // // // //             onSubmit: handleHeroSearchSubmit,
// // // // // // //             initialValues: initialHeroSearchValues,
// // // // // // //             isLoading: isProcessingHeroAction || isLoadingGeo,
// // // // // // //             formInstanceId: "hero",
// // // // // // //             showDetectLocationButton: true
// // // // // // //           }}
// // // // // // //           minHeight="min-h-screen" // Keeping billboard height at 100vh
// // // // // // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}
// // // // // // //           isMapMode={true}
// // // // // // //           operationalAreas={operationalAreas || []}
// // // // // // //           isLoadingMapData={isLoadingOperationalAreas}
// // // // // // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // // // // // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // // // // // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]}
// // // // // // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6}
// // // // // // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString}
// // // // // // //         />
// // // // // // //       </div>

// // // // // // //       {/* MODIFIED SECTION FOR REDUCED OVERLAP */}
// // // // // // //       <div className="relative -mt-[20vh] md:-mt-[25vh] lg:-mt-[30vh] z-20"> {/* Values reduced from 40/45/50vh */}
// // // // // // //         <div className="w-full max-w-none">
// // // // // // //           <div className="h-[20vh] md:h-[25vh] lg:h-[30vh]"></div>
// // // // // // //           <div className="bg-white/95 backdrop-blur-sm">
// // // // // // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">

// // // // // // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // // // // // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
// // // // // // //                   <p className="text-sm sm:text-base text-blue-700">
// // // // // // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // // // // // //                   </p>
// // // // // // //                 </div>
// // // // // // //               )}
// // // // // // //               {activeOperationalArea && (
// // // // // // //                 <div className="mb-6 sm:mb-8 text-center">
// // // // // // //                   <p className="text-base sm:text-lg text-slate-700">
// // // // // // //                     Showing services and parts for: <span className="font-semibold text-orange-600">{activeOperationalArea.nameEn}</span>
// // // // // // //                   </p>
// // // // // // //                   <Button
// // // // // // //                     variant="link"
// // // // // // //                     onClick={() => {
// // // // // // //                       setActiveOperationalArea(null);
// // // // // // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // //                       newUrlParams.delete('area');
// // // // // // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // //                     }}
// // // // // // //                     className="text-xs text-slate-500 hover:text-orange-600 mt-1"
// // // // // // //                   >
// // // // // // //                     (Change area or use current location)
// // // // // // //                   </Button>
// // // // // // //                 </div>
// // // // // // //               )}

// // // // // // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-100 text-blue-700 rounded-md shadow-sm flex items-center justify-center space-x-2 text-sm">
// // // // // // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // // // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // // //                 </div>
// // // // // // //               )}
// // // // // // //               {pageLevelError && !isRedirecting && (
// // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // //                   {pageLevelError}
// // // // // // //                 </div>
// // // // // // //               )}
// // // // // // //               {showGenericGeoError && contextGeoError && (
// // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-100 text-yellow-700 rounded-md shadow-sm text-sm">
// // // // // // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // // // // // //                 </div>
// // // // // // //               )}
// // // // // // //               {operationalAreasError && (
// // // // // // //                  <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // //                     Error loading operational areas: {operationalAreasError.message}
// // // // // // //                  </div>
// // // // // // //               )}

// // // // // // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // // // // // //                 if (!conceptGroup.concept) return null;

// // // // // // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null;

// // // // // // //                 return (
// // // // // // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // // // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // // // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
// // // // // // //                         {conceptGroup.concept.nameEn}
// // // // // // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-500 mt-1 sm:mt-0"> in {activeOperationalArea.nameEn}</span>}
// // // // // // //                       </h2>
// // // // // // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // // // // // //                         <Button
// // // // // // //                           variant="outline"
// // // // // // //                           size="sm"
// // // // // // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // // // //                           className="self-start sm:self-auto"
// // // // // // //                         >
// // // // // // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // // //                         </Button>
// // // // // // //                       )}
// // // // // // //                     </div>
// // // // // // //                     {isLoadingThisCarousel ? (
// // // // // // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // // // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-orange-500"/>
// // // // // // //                       </div>
// // // // // // //                     ) : actualSubCategories.length > 0 ? (
// // // // // // //                       <div className="relative">
// // // // // // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // // // // // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // // // //                             {actualSubCategories.map((subCat, index) => (
// // // // // // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // // // // // //                                 <div className="p-1 h-full">
// // // // // // //                                   <SubCategoryCarouselItem
// // // // // // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // // // // // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // // //                                     shopCount={subCat.shopCount}
// // // // // // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // // //                                   />
// // // // // // //                                 </div>
// // // // // // //                               </CarouselItem>
// // // // // // //                             ))}
// // // // // // //                           </CarouselContent>
// // // // // // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // // // // // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8" />
// // // // // // //                             <CarouselNext className="static translate-y-0 h-8 w-8" />
// // // // // // //                           </div>
// // // // // // //                           <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-6" />
// // // // // // //                           <CarouselNext className="hidden sm:flex -right-4 lg:-right-6" />
// // // // // // //                         </Carousel>
// // // // // // //                       </div>
// // // // // // //                     ) : (
// // // // // // //                       <p className="text-slate-500 text-sm">
// // // // // // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // // // // // //                                                : "Select an area on the map or allow location access to see available services."}
// // // // // // //                       </p>
// // // // // // //                     )}
// // // // // // //                   </section>
// // // // // // //                 );
// // // // // // //               })}

// // // // // // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-slate-200">
// // // // // // //               <div className="text-center mb-8 md:mb-10">
// // // // // // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">
// // // // // // //                   Or, Browse by City (Legacy)
// // // // // // //                 </h2>
// // // // // // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-gray-600">
// // // // // // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // // // //                 </p>
// // // // // // //               </div>

// // // // // // //               {isLoadingLegacyCities ? (
// // // // // // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" /></div>
// // // // // // //               ) : legacyCitiesError ? (
// // // // // // //                 <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // // // // // //                  <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // // // // // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // // // //                   {legacyCities.map((city: CityDto) => (
// // // // // // //                     <CityCard
// // // // // // //                       key={city.id}
// // // // // // //                       city={city}
// // // // // // //                       onClick={() => handleCityCardClick(city)}
// // // // // // //                     />
// // // // // // //                   ))}
// // // // // // //                 </div>
// // // // // // //               ): null}
// // // // // // //             </section>

// // // // // // //             </div>
// // // // // // //           </div>
// // // // // // //         </div>
// // // // // // //       </div>
// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }
// // // // // // // // 'use client';

// // // // // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // // import {
// // // // // // // //     fetchCities,
// // // // // // // //     fetchOperationalAreasForMap,
// // // // // // // //     fetchSubCategoriesByOperationalArea
// // // // // // // // } from '@/lib/apiClient';
// // // // // // // // import {
// // // // // // // //     CityDto,
// // // // // // // //     OperationalAreaDto,
// // // // // // // //     OperationalAreaFeatureProperties,
// // // // // // // //     APIError,
// // // // // // // //     FrontendShopQueryParameters,
// // // // // // // //     SubCategoryDto,
// // // // // // // //     HighLevelConceptQueryParam
// // // // // // // // } from '@/types/api';
// // // // // // // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories';
// // // // // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // // // import CityCard from '@/components/city/CityCard';
// // // // // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // // // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // // import {
// // // // // // // //   Carousel,
// // // // // // // //   CarouselContent,
// // // // // // // //   CarouselItem,
// // // // // // // //   CarouselNext,
// // // // // // // //   CarouselPrevious,
// // // // // // // // } from "@/components/ui/carousel";
// // // // // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';

// // // // // // // // // Import the Egypt boundary GeoJSON data
// // // // // // // // // Make sure this path is correct and the file exists.
// // // // // // // // import egyptBoundaryData from '@/data/egypt_boundary.json';

// // // // // // // // // Leaflet dynamic imports (placeholders if not used directly, which they aren't in this file now)
// // // // // // // // // import dynamic from 'next/dynamic';
// // // // // // // // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
// // // // // // // // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // // // // // // // const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });


// // // // // // // // type HeroSearchSubmitParams = Pick<
// // // // // // // //   FrontendShopQueryParameters,
// // // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // // >;

// // // // // // // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // // // // // // export default function HomePage() {
// // // // // // // //   const router = useRouter();
// // // // // // // //   const searchParams = useSearchParams();

// // // // // // // //   const {
// // // // // // // //     currentLocation: contextLocation,
// // // // // // // //     setCurrentLocation: setContextLocation,
// // // // // // // //     isLoading: isLoadingContextLocation,
// // // // // // // //     error: contextGeoError,
// // // // // // // //     clearError: clearContextGeoError,
// // // // // // // //     attemptBrowserGpsLocation,
// // // // // // // //     isLoadingInitialPreference,
// // // // // // // //   } = useUserGeoLocation();

// // // // // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // // // // //   const [isRedirecting, setIsRedirecting] = useState(false);

// // // // // // // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // // // // // // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null);

// // // // // // // //   const [carouselItemsToShow, setCarouselItemsToShow] = useState(5);

// // // // // // // //   const egyptBoundaryGeoJsonString = useMemo(() => {
// // // // // // // //     if (!egyptBoundaryData) return null;
// // // // // // // //     try {
// // // // // // // //       return JSON.stringify(egyptBoundaryData);
// // // // // // // //     } catch (e) {
// // // // // // // //       console.error("HomePage: Error stringifying Egypt boundary data:", e);
// // // // // // // //       return null;
// // // // // // // //     }
// // // // // // // //   }, []); // egyptBoundaryData is a static import, so dependencies are stable

// // // // // // // //   useEffect(() => {
// // // // // // // //     const updateVisibleItems = () => {
// // // // // // // //       if (typeof window !== 'undefined') {
// // // // // // // //         if (window.innerWidth < 640) setCarouselItemsToShow(2);
// // // // // // // //         else if (window.innerWidth < 768) setCarouselItemsToShow(3);
// // // // // // // //         else if (window.innerWidth < 1024) setCarouselItemsToShow(4);
// // // // // // // //         else setCarouselItemsToShow(5);
// // // // // // // //       }
// // // // // // // //     };
// // // // // // // //     updateVisibleItems();
// // // // // // // //     window.addEventListener('resize', updateVisibleItems);
// // // // // // // //     return () => window.removeEventListener('resize', updateVisibleItems);
// // // // // // // //   }, []);

// // // // // // // //   const {
// // // // // // // //     data: operationalAreas,
// // // // // // // //     isLoading: isLoadingOperationalAreas,
// // // // // // // //     error: operationalAreasError
// // // // // // // //   } = useQuery<OperationalAreaDto[], APIError>({
// // // // // // // //     queryKey: ['operationalAreasForMap'],
// // // // // // // //     queryFn: fetchOperationalAreasForMap,
// // // // // // // //     staleTime: 1000 * 60 * 60,
// // // // // // // //     refetchOnWindowFocus: false,
// // // // // // // //   });

// // // // // // // //   const {
// // // // // // // //     data: legacyCities,
// // // // // // // //     isLoading: isLoadingLegacyCities,
// // // // // // // //     error: legacyCitiesError
// // // // // // // //   } = useQuery<CityDto[], APIError>({
// // // // // // // //       queryKey: ['legacyCities'],
// // // // // // // //       queryFn: fetchCities,
// // // // // // // //       staleTime: 1000 * 60 * 60,
// // // // // // // //       refetchOnWindowFocus: false,
// // // // // // // //     });

// // // // // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // // // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // //   });

// // // // // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // // // // // // //       enabled: !!activeOperationalArea?.slug,
// // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // //   });

// // // // // // // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // // // // // // //     if (!areas || areas.length === 0) return null;
// // // // // // // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // // // // // // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // // // // // // //       const distance = haversineDistance(userCoords, areaCoords);
// // // // // // // //       if (closest === null) return currentArea;
// // // // // // // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // // // // // // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // // // // // // //       return distance < closestDistance ? currentArea : closest;
// // // // // // // //     }, null);
// // // // // // // //   }, []);

// // // // // // // //   useEffect(() => {
// // // // // // // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // // // // // // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // // // // // // //       if (nearestArea) {
// // // // // // // //         setActiveOperationalArea(nearestArea);
// // // // // // // //         const areaSlugFromUrl = searchParams.get('area');
// // // // // // // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // // // // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // // // // // // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // // // // // // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // //             newUrlParams.delete('city');
// // // // // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //         }
// // // // // // // //       }
// // // // // // // //     }
// // // // // // // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);

// // // // // // // //   useEffect(() => {
// // // // // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // // // // //     if (urlLatStr && urlLonStr) {
// // // // // // // //       const lat = parseFloat(urlLatStr);
// // // // // // // //       const lon = parseFloat(urlLonStr);
// // // // // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // // // // //         }
// // // // // // // //       }
// // // // // // // //     }
// // // // // // // //   }, [searchParams, contextLocation, setContextLocation]);

// // // // // // // //   useEffect(() => {
// // // // // // // //     const areaSlugFromUrl = searchParams.get('area');
// // // // // // // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // // // // // // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // // // // // // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // // // // // // //             if (areaFromUrl) {
// // // // // // // //                 setActiveOperationalArea(areaFromUrl);
// // // // // // // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // // // // // // //                     setContextLocation({
// // // // // // // //                         latitude: areaFromUrl.centroidLatitude,
// // // // // // // //                         longitude: areaFromUrl.centroidLongitude,
// // // // // // // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // // //                         timestamp: Date.now()
// // // // // // // //                     }, 'url_param');
// // // // // // // //                 }
// // // // // // // //             }
// // // // // // // //         }
// // // // // // // //     }
// // // // // // // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // // // // // // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // // // // // // //     clearContextGeoError();
// // // // // // // //     setPageLevelError(null);

// // // // // // // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // // // // // // //     if (!selectedOA) return;

// // // // // // // //     setActiveOperationalArea(selectedOA);

// // // // // // // //     const areaLocation: UserGeoLocation = {
// // // // // // // //         latitude: selectedOA.centroidLatitude,
// // // // // // // //         longitude: selectedOA.centroidLongitude,
// // // // // // // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // // //         timestamp: Date.now()
// // // // // // // //     };
// // // // // // // //     setContextLocation(areaLocation, 'manual');

// // // // // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // //     newUrlParams.set("area", selectedOA.slug);
// // // // // // // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // // // // // // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // // // // // // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // // //     newUrlParams.delete('city');

// // // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement; // Assuming this ID exists for ShopSearchForm input
// // // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // // //     if (heroSearchName) newUrlParams.set("name", heroSearchName);
// // // // // // // //     else newUrlParams.delete("name");

// // // // // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // // // // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();

// // // // // // // //     const queryForNextPage = new URLSearchParams();
// // // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // // //     if (heroSearchName) queryForNextPage.set("name", heroSearchName);

// // // // // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // // // // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // // // // // // //     if (!areaToUseSlug) {
// // // // // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // // // // //         if (!locationToUse) {
// // // // // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // // // // //                 onError: (errMsg, errCode) => {
// // // // // // // //                     // Assuming GeolocationPositionError is available globally or imported
// // // // // // // //                     // if (typeof GeolocationPositionError !== 'undefined' && errCode !== GeolocationPositionError.PERMISSION_DENIED) {
// // // // // // // //                     // For now, let's assume PERMISSION_DENIED is 1
// // // // // // // //                     if (errCode !== 1 /* GeolocationPositionError.PERMISSION_DENIED */) {
// // // // // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // // // // // // //                     }
// // // // // // // //                 }
// // // // // // // //             });
// // // // // // // //             locationToUse = detectedLocationForSubCat;
// // // // // // // //         }
// // // // // // // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // // // // // // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // // // // // // //             if (nearestArea) {
// // // // // // // //                 areaToUseSlug = nearestArea.slug;
// // // // // // // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // // // // // // //                     setActiveOperationalArea(nearestArea);
// // // // // // // //                 }
// // // // // // // //             } else {
// // // // // // // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // // // // // // //             }
// // // // // // // //         }
// // // // // // // //         if (!areaToUseSlug) {
// // // // // // // //             setIsRedirecting(true);
// // // // // // // //             const redirectParams = new URLSearchParams();
// // // // // // // //             if (heroSearchName) redirectParams.set("name", heroSearchName);
// // // // // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // // // // //             router.push(`/select-area?${redirectParams.toString()}`);
// // // // // // // //             setProcessingSubCategoryId(null); return;
// // // // // // // //         }
// // // // // // // //     }
// // // // // // // //     if (locationToUse) {
// // // // // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // // // // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // // // // //     }
// // // // // // // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // // // // //     setProcessingSubCategoryId(null);
// // // // // // // //   };

// // // // // // // //   const handleHeroSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // // // // //     const searchName = submittedCriteria.name;
// // // // // // // //     const newUrlParams = new URLSearchParams();
// // // // // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // // // // //     let targetOperationalArea = activeOperationalArea;

// // // // // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // // // // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // // // // // // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // // // // // // //             setIsProcessingHeroAction(false); return;
// // // // // // // //         }
// // // // // // // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // // // // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // // // // // // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };

// // // // // // // //         setContextLocation(newGpsLocation, 'gps');

// // // // // // // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // // // // // // //         if (nearestArea) {
// // // // // // // //             targetOperationalArea = nearestArea;
// // // // // // // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea);
// // // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // // //         } else {
// // // // // // // //             newUrlParams.delete('area');
// // // // // // // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // // // // // // //         }
// // // // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // // // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // // // // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc"));
// // // // // // // //     } else {
// // // // // // // //         if (targetOperationalArea) {
// // // // // // // //             newUrlParams.set('area', targetOperationalArea.slug);
// // // // // // // //             if (contextLocation) {
// // // // // // // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // //             } else {
// // // // // // // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // // // // // // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // // // // // // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // //             }
// // // // // // // //         } else if (contextLocation) {
// // // // // // // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // //         }
// // // // // // // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // // // // // // //     }

// // // // // // // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // // // // // // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0)
// // // // // // // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug
// // // // // // // //                                             : "general-maintenance";

// // // // // // // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) {
// // // // // // // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // // // // // // //     } else if (searchName && !targetOperationalArea) {
// // // // // // // //         setPageLevelError("Please select an operational area to search within, or allow location access.");
// // // // // // // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // // // // // // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //     } else {
// // // // // // // //         router.push(`/select-area?${newUrlParams.toString()}`);
// // // // // // // //     }
// // // // // // // //     setIsProcessingHeroAction(false);
// // // // // // // //   };

// // // // // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // // // // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // // // // // // //     if (correspondingOA) {
// // // // // // // //         setActiveOperationalArea(correspondingOA);
// // // // // // // //         const areaLocation: UserGeoLocation = {
// // // // // // // //             latitude: correspondingOA.centroidLatitude,
// // // // // // // //             longitude: correspondingOA.centroidLongitude,
// // // // // // // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // // //             timestamp: Date.now()
// // // // // // // //         };
// // // // // // // //         setContextLocation(areaLocation, 'manual');

// // // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // //         newUrlParams.set("area", correspondingOA.slug);
// // // // // // // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // // // // // // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // // // // // // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // // //         newUrlParams.delete('city');
// // // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //     } else {
// // // // // // // //         setActiveLegacyCity(city);
// // // // // // // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // // // // // // //         setContextLocation(cityLocation, 'manual_city');
// // // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // //         newUrlParams.set("city", city.slug);
// // // // // // // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // // // // // // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // // // // // // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // // // // // // //         newUrlParams.delete('area');
// // // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //     }
// // // // // // // //   };

// // // // // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // // // // //     if (!activeOperationalArea) {
// // // // // // // //         setPageLevelError("Please select an operational area first to explore services.");
// // // // // // // //         return;
// // // // // // // //     }
// // // // // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // // // // //     query.delete('city');
// // // // // // // //     query.set('area', activeOperationalArea.slug);

// // // // // // // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // // // // //   };

// // // // // // // //   const initialHeroSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // // // // //     const urlSortBy = searchParams.get('sortBy');

// // // // // // // //     if (urlLat && urlLon) {
// // // // // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // // // // // // //     } else if (contextLocation) {
// // // // // // // //         const sortByValue = urlSortBy ||
// // // // // // // //                             (contextLocation.source &&
// // // // // // // //                              (contextLocation.source.startsWith('gps') ||
// // // // // // // //                               contextLocation.source === 'preference_loaded' ||
// // // // // // // //                               contextLocation.source === 'manual'
// // // // // // // //                              ) ? 'distance_asc' : undefined);
// // // // // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // // // // // // //     }
// // // // // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // // // // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // // // // // // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // // // // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // // // // //     if (!activeOperationalArea?.slug) {
// // // // // // // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // // // // // // //         return conceptGroup?.subCategories.map(sc => ({
// // // // // // // //             name: sc.name,
// // // // // // // //             slug: sc.slug,
// // // // // // // //             shopCount: 0,
// // // // // // // //             subCategoryEnum: 0,
// // // // // // // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // // // // // // //         })) || [];
// // // // // // // //     }
// // // // // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // // // // //     return [];
// // // // // // // //   };

// // // // // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // // // // //     if (!activeOperationalArea?.slug) return false;
// // // // // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // // // // //     return false;
// // // // // // // //   };

// // // // // // // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

// // // // // // // //   return (
// // // // // // // //      <div className="relative min-h-screen overflow-x-hidden">
// // // // // // // //       <div className="relative z-30">
// // // // // // // //         <HeroBillboard
// // // // // // // //           title="Automotive Services & Parts" highlightText="Simplified"
// // // // // // // //           subtitle="Find reliable maintenance centers and a diverse auto parts marketplace."
// // // // // // // //           showSearch={true}
// // // // // // // //           searchProps={{
// // // // // // // //             onSubmit: handleHeroSearchSubmit,
// // // // // // // //             initialValues: initialHeroSearchValues,
// // // // // // // //             isLoading: isProcessingHeroAction || isLoadingGeo,
// // // // // // // //             formInstanceId: "hero", // ensure ID 'hero-mainSearchInput' is used in ShopSearchForm for this instance
// // // // // // // //             showDetectLocationButton: true
// // // // // // // //           }}
// // // // // // // //           minHeight="min-h-screen"
// // // // // // // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}
// // // // // // // //           isMapMode={true}
// // // // // // // //           operationalAreas={operationalAreas || []}
// // // // // // // //           isLoadingMapData={isLoadingOperationalAreas}
// // // // // // // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // // // // // // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // // // // // // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]} // Default Egypt center
// // // // // // // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 6} // Default zoom for Egypt
// // // // // // // //           egyptBoundaryGeoJson={egyptBoundaryGeoJsonString} // Pass the stringified GeoJSON
// // // // // // // //         />
// // // // // // // //       </div>

// // // // // // // //       <div className="relative -mt-[40vh] md:-mt-[45vh] lg:-mt-[50vh] z-20">
// // // // // // // //       {/* <div className="relative -mt-[20vh] md:-mt-[25vh] lg:-mt-[30vh] z-20">  */}
// // // // // // // //         <div className="w-full max-w-none">
// // // // // // // //           <div className="h-[40vh] md:h-[45vh] lg:h-[50vh]"></div>
          
// // // // // // // //           <div className="bg-white/95 backdrop-blur-sm">
// // // // // // // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">

// // // // // // // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // // // // // // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
// // // // // // // //                   <p className="text-sm sm:text-base text-blue-700">
// // // // // // // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // // // // // // //                   </p>
// // // // // // // //                 </div>
// // // // // // // //               )}
// // // // // // // //               {activeOperationalArea && (
// // // // // // // //                 <div className="mb-6 sm:mb-8 text-center">
// // // // // // // //                   <p className="text-base sm:text-lg text-slate-700">
// // // // // // // //                     Showing services and parts for: <span className="font-semibold text-orange-600">{activeOperationalArea.nameEn}</span>
// // // // // // // //                   </p>
// // // // // // // //                   <Button
// // // // // // // //                     variant="link"
// // // // // // // //                     onClick={() => {
// // // // // // // //                       setActiveOperationalArea(null);
// // // // // // // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // //                       newUrlParams.delete('area');
// // // // // // // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // //                     }}
// // // // // // // //                     className="text-xs text-slate-500 hover:text-orange-600 mt-1"
// // // // // // // //                   >
// // // // // // // //                     (Change area or use current location)
// // // // // // // //                   </Button>
// // // // // // // //                 </div>
// // // // // // // //               )}

// // // // // // // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-100 text-blue-700 rounded-md shadow-sm flex items-center justify-center space-x-2 text-sm">
// // // // // // // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // // // // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // // // //                 </div>
// // // // // // // //               )}
// // // // // // // //               {pageLevelError && !isRedirecting && (
// // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // // //                   {pageLevelError}
// // // // // // // //                 </div>
// // // // // // // //               )}
// // // // // // // //               {showGenericGeoError && contextGeoError && (
// // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-100 text-yellow-700 rounded-md shadow-sm text-sm">
// // // // // // // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // // // // // // //                 </div>
// // // // // // // //               )}
// // // // // // // //               {operationalAreasError && (
// // // // // // // //                  <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // // //                     Error loading operational areas: {operationalAreasError.message}
// // // // // // // //                  </div>
// // // // // // // //               )}

// // // // // // // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // // // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // // // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea;

// // // // // // // //                 if (!conceptGroup.concept) return null;

// // // // // // // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0 && !isLoadingThisCarousel) return null; // Hide if no area and no default items and not loading

// // // // // // // //                 return (
// // // // // // // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // // // // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // // // // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
// // // // // // // //                         {conceptGroup.concept.nameEn}
// // // // // // // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-500 mt-1 sm:mt-0"> in {activeOperationalArea.nameEn}</span>}
// // // // // // // //                       </h2>
// // // // // // // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // // // // // // //                         <Button
// // // // // // // //                           variant="outline"
// // // // // // // //                           size="sm"
// // // // // // // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // // // // //                           className="self-start sm:self-auto"
// // // // // // // //                         >
// // // // // // // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // // // //                         </Button>
// // // // // // // //                       )}
// // // // // // // //                     </div>
// // // // // // // //                     {isLoadingThisCarousel ? (
// // // // // // // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // // // // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-orange-500"/>
// // // // // // // //                       </div>
// // // // // // // //                     ) : actualSubCategories.length > 0 ? (
// // // // // // // //                       <div className="relative">
// // // // // // // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // // // // // // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // // // // //                             {actualSubCategories.map((subCat, index) => (
// // // // // // // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // // // // // // //                                 <div className="p-1 h-full">
// // // // // // // //                                   <SubCategoryCarouselItem
// // // // // // // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }}
// // // // // // // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // // // //                                     shopCount={subCat.shopCount}
// // // // // // // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // // // //                                   />
// // // // // // // //                                 </div>
// // // // // // // //                               </CarouselItem>
// // // // // // // //                             ))}
// // // // // // // //                           </CarouselContent>
// // // // // // // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // // // // // // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8" />
// // // // // // // //                             <CarouselNext className="static translate-y-0 h-8 w-8" />
// // // // // // // //                           </div>
// // // // // // // //                           <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-6" />
// // // // // // // //                           <CarouselNext className="hidden sm:flex -right-4 lg:-right-6" />
// // // // // // // //                         </Carousel>
// // // // // // // //                       </div>
// // // // // // // //                     ) : (
// // // // // // // //                       <p className="text-slate-500 text-sm">
// // // // // // // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.`
// // // // // // // //                                                : "Select an area on the map or allow location access to see available services."}
// // // // // // // //                       </p>
// // // // // // // //                     )}
// // // // // // // //                   </section>
// // // // // // // //                 );
// // // // // // // //               })}

// // // // // // // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-slate-200">
// // // // // // // //               <div className="text-center mb-8 md:mb-10">
// // // // // // // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">
// // // // // // // //                   Or, Browse by City (Legacy)
// // // // // // // //                 </h2>
// // // // // // // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-gray-600">
// // // // // // // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // // // // //                 </p>
// // // // // // // //               </div>

// // // // // // // //               {isLoadingLegacyCities ? (
// // // // // // // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" /></div>
// // // // // // // //               ) : legacyCitiesError ? (
// // // // // // // //                 <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // // // // // // //                  <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// // // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? (
// // // // // // // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // // // // //                   {legacyCities.map((city: CityDto) => (
// // // // // // // //                     <CityCard
// // // // // // // //                       key={city.id}
// // // // // // // //                       city={city}
// // // // // // // //                       onClick={() => handleCityCardClick(city)}
// // // // // // // //                     />
// // // // // // // //                   ))}
// // // // // // // //                 </div>
// // // // // // // //               ): null}
// // // // // // // //             </section>

// // // // // // // //             </div>
// // // // // // // //           </div>
// // // // // // // //         </div>
// // // // // // // //       </div>
// // // // // // // //     </div>
// // // // // // // //   );
// // // // // // // // }

// // // // // // // // // // src/app/page.tsx
// // // // // // // // // 'use client';

// // // // // // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // // // import { 
// // // // // // // // //     fetchCities, 
// // // // // // // // //     fetchOperationalAreasForMap, 
// // // // // // // // //     fetchSubCategoriesByOperationalArea 
// // // // // // // // // } from '@/lib/apiClient';
// // // // // // // // // import { 
// // // // // // // // //     CityDto, 
// // // // // // // // //     OperationalAreaDto, 
// // // // // // // // //     OperationalAreaFeatureProperties, 
// // // // // // // // //     APIError, 
// // // // // // // // //     FrontendShopQueryParameters, 
// // // // // // // // //     SubCategoryDto, 
// // // // // // // // //     HighLevelConceptQueryParam 
// // // // // // // // // } from '@/types/api';
// // // // // // // // // import { predefinedHomepageConcepts, FeatureConceptConfig, PredefinedSubCategory } from '@/config/categories'; // Import PredefinedSubCategory
// // // // // // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // // // // // import HeroBillboard from '@/components/common/HeroBillboard'; 
// // // // // // // // // import CityCard from '@/components/city/CityCard';
// // // // // // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
// // // // // // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext'; 
// // // // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // // // import {
// // // // // // // // //   Carousel,
// // // // // // // // //   CarouselContent,
// // // // // // // // //   CarouselItem,
// // // // // // // // //   CarouselNext,
// // // // // // // // //   CarouselPrevious,
// // // // // // // // // } from "@/components/ui/carousel";
// // // // // // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';

// // // // // // // // // // Leaflet dynamic imports
// // // // // // // // // import dynamic from 'next/dynamic';
// // // // // // // // // // These are placeholders if HeroBillboard doesn't render them directly
// // // // // // // // // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
// // // // // // // // // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // // // // // // // // const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });


// // // // // // // // // type HeroSearchSubmitParams = Pick<
// // // // // // // // //   FrontendShopQueryParameters,
// // // // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // // // >;

// // // // // // // // // const DEFAULT_SEARCH_RADIUS = 50000;

// // // // // // // // // export default function HomePage() {
// // // // // // // // //   const router = useRouter();
// // // // // // // // //   const searchParams = useSearchParams();

// // // // // // // // //   const {
// // // // // // // // //     currentLocation: contextLocation,
// // // // // // // // //     setCurrentLocation: setContextLocation,
// // // // // // // // //     isLoading: isLoadingContextLocation,
// // // // // // // // //     error: contextGeoError,
// // // // // // // // //     clearError: clearContextGeoError,
// // // // // // // // //     attemptBrowserGpsLocation,
// // // // // // // // //     isLoadingInitialPreference,
// // // // // // // // //   } = useUserGeoLocation();

// // // // // // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // // // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // // // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // // // // // //   const [isRedirecting, setIsRedirecting] = useState(false);
  
// // // // // // // // //   const [activeOperationalArea, setActiveOperationalArea] = useState<OperationalAreaDto | null>(null);
// // // // // // // // //   const [activeLegacyCity, setActiveLegacyCity] = useState<CityDto | null>(null); 

// // // // // // // // //   const [carouselItemsToShow, setCarouselItemsToShow] = useState(5);

// // // // // // // // //   useEffect(() => {
// // // // // // // // //     const updateVisibleItems = () => {
// // // // // // // // //       if (typeof window !== 'undefined') {
// // // // // // // // //         if (window.innerWidth < 640) setCarouselItemsToShow(2);
// // // // // // // // //         else if (window.innerWidth < 768) setCarouselItemsToShow(3);
// // // // // // // // //         else if (window.innerWidth < 1024) setCarouselItemsToShow(4);
// // // // // // // // //         else setCarouselItemsToShow(5);
// // // // // // // // //       }
// // // // // // // // //     };
// // // // // // // // //     updateVisibleItems();
// // // // // // // // //     window.addEventListener('resize', updateVisibleItems);
// // // // // // // // //     return () => window.removeEventListener('resize', updateVisibleItems);
// // // // // // // // //   }, []);

// // // // // // // // //   const { 
// // // // // // // // //     data: operationalAreas, 
// // // // // // // // //     isLoading: isLoadingOperationalAreas,
// // // // // // // // //     error: operationalAreasError 
// // // // // // // // //   } = useQuery<OperationalAreaDto[], APIError>({
// // // // // // // // //     queryKey: ['operationalAreasForMap'],
// // // // // // // // //     queryFn: fetchOperationalAreasForMap,
// // // // // // // // //     staleTime: 1000 * 60 * 60, 
// // // // // // // // //     refetchOnWindowFocus: false,
// // // // // // // // //   });

// // // // // // // // //   const {
// // // // // // // // //     data: legacyCities, 
// // // // // // // // //     isLoading: isLoadingLegacyCities,
// // // // // // // // //     error: legacyCitiesError
// // // // // // // // //   } = useQuery<CityDto[], APIError>({
// // // // // // // // //       queryKey: ['legacyCities'],
// // // // // // // // //       queryFn: fetchCities,
// // // // // // // // //       staleTime: 1000 * 60 * 60,
// // // // // // // // //       refetchOnWindowFocus: false,
// // // // // // // // //     });

// // // // // // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Maintenance'],
// // // // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Maintenance') : Promise.resolve([]),
// // // // // // // // //       enabled: !!activeOperationalArea?.slug, 
// // // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // // //   });

// // // // // // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // // //       queryKey: ['subCategories', activeOperationalArea?.slug, 'Marketplace'],
// // // // // // // // //       queryFn: () => activeOperationalArea?.slug ? fetchSubCategoriesByOperationalArea(activeOperationalArea.slug, 'Marketplace') : Promise.resolve([]),
// // // // // // // // //       enabled: !!activeOperationalArea?.slug, 
// // // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // // //   });

// // // // // // // // //   const findNearestOperationalArea = useCallback((userCoords: Coordinates, areas: OperationalAreaDto[]): OperationalAreaDto | null => {
// // // // // // // // //     if (!areas || areas.length === 0) return null;
// // // // // // // // //     return areas.reduce((closest: OperationalAreaDto | null, currentArea: OperationalAreaDto) => {
// // // // // // // // //       const areaCoords: Coordinates = { latitude: currentArea.centroidLatitude, longitude: currentArea.centroidLongitude };
// // // // // // // // //       const distance = haversineDistance(userCoords, areaCoords);
// // // // // // // // //       if (closest === null) return currentArea;
// // // // // // // // //       const closestAreaCoords: Coordinates = { latitude: closest.centroidLatitude, longitude: closest.centroidLongitude };
// // // // // // // // //       const closestDistance = haversineDistance(userCoords, closestAreaCoords);
// // // // // // // // //       return distance < closestDistance ? currentArea : closest;
// // // // // // // // //     }, null);
// // // // // // // // //   }, []);

// // // // // // // // //   useEffect(() => {
// // // // // // // // //     if (contextLocation && operationalAreas && operationalAreas.length > 0 && !activeOperationalArea && !isLoadingInitialPreference) {
// // // // // // // // //       const nearestArea = findNearestOperationalArea(contextLocation, operationalAreas);
// // // // // // // // //       if (nearestArea) {
// // // // // // // // //         setActiveOperationalArea(nearestArea);
// // // // // // // // //         const areaSlugFromUrl = searchParams.get('area'); 
// // // // // // // // //         if (areaSlugFromUrl !== nearestArea.slug) {
// // // // // // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // // // //             newUrlParams.set('userLatitude', contextLocation.latitude.toString());
// // // // // // // // //             newUrlParams.set('userLongitude', contextLocation.longitude.toString());
// // // // // // // // //             newUrlParams.set('radiusInMeters', (contextLocation.radiusInMeters || nearestArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // //             newUrlParams.delete('city'); 
// // // // // // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //         }
// // // // // // // // //       }
// // // // // // // // //     }
// // // // // // // // //   }, [contextLocation, operationalAreas, activeOperationalArea, isLoadingInitialPreference, findNearestOperationalArea, router, searchParams]);
  
// // // // // // // // //   useEffect(() => {
// // // // // // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // // // // // //     if (urlLatStr && urlLonStr) {
// // // // // // // // //       const lat = parseFloat(urlLatStr);
// // // // // // // // //       const lon = parseFloat(urlLonStr);
// // // // // // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // // // // // //         }
// // // // // // // // //       }
// // // // // // // // //     }
// // // // // // // // //   }, [searchParams, contextLocation, setContextLocation]);
  
// // // // // // // // //   useEffect(() => {
// // // // // // // // //     const areaSlugFromUrl = searchParams.get('area'); 
// // // // // // // // //     if (areaSlugFromUrl && operationalAreas && operationalAreas.length > 0) {
// // // // // // // // //         if (!activeOperationalArea || activeOperationalArea.slug !== areaSlugFromUrl) {
// // // // // // // // //             const areaFromUrl = operationalAreas.find(oa => oa.slug === areaSlugFromUrl);
// // // // // // // // //             if (areaFromUrl) {
// // // // // // // // //                 setActiveOperationalArea(areaFromUrl);
// // // // // // // // //                 if (!searchParams.has('userLatitude') && !searchParams.has('userLongitude')) {
// // // // // // // // //                     setContextLocation({
// // // // // // // // //                         latitude: areaFromUrl.centroidLatitude,
// // // // // // // // //                         longitude: areaFromUrl.centroidLongitude,
// // // // // // // // //                         radiusInMeters: areaFromUrl.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // // // //                         timestamp: Date.now()
// // // // // // // // //                     }, 'url_param'); // CORRECTED: Mapped 'area_param_centroid' to 'url_param'
// // // // // // // // //                 }
// // // // // // // // //             }
// // // // // // // // //         }
// // // // // // // // //     }
// // // // // // // // //   }, [searchParams, operationalAreas, activeOperationalArea, setContextLocation]);

// // // // // // // // //   const handleOperationalAreaSelect = useCallback((areaProperties: OperationalAreaFeatureProperties) => {
// // // // // // // // //     clearContextGeoError(); 
// // // // // // // // //     setPageLevelError(null);

// // // // // // // // //     const selectedOA = operationalAreas?.find(oa => oa.slug === areaProperties.slug);
// // // // // // // // //     if (!selectedOA) return;

// // // // // // // // //     setActiveOperationalArea(selectedOA);
    
// // // // // // // // //     const areaLocation: UserGeoLocation = {
// // // // // // // // //         latitude: selectedOA.centroidLatitude,
// // // // // // // // //         longitude: selectedOA.centroidLongitude,
// // // // // // // // //         radiusInMeters: selectedOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS,
// // // // // // // // //         timestamp: Date.now() 
// // // // // // // // //     };
// // // // // // // // //     setContextLocation(areaLocation, 'manual'); // CORRECTED: Mapped 'manual_area_selection' to 'manual'

// // // // // // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // //     newUrlParams.set("area", selectedOA.slug); 
// // // // // // // // //     newUrlParams.set("userLatitude", selectedOA.centroidLatitude.toString());
// // // // // // // // //     newUrlParams.set("userLongitude", selectedOA.centroidLongitude.toString());
// // // // // // // // //     newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // // // //     newUrlParams.delete('city'); 
    
// // // // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // // // //     if (heroSearchName) newUrlParams.set("name", heroSearchName);
// // // // // // // // //     else newUrlParams.delete("name");
    
// // // // // // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //   }, [clearContextGeoError, contextLocation?.radiusInMeters, operationalAreas, router, searchParams, setContextLocation]);

// // // // // // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // // // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // // // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();
    
// // // // // // // // //     const queryForNextPage = new URLSearchParams();
// // // // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // // // //     if (heroSearchName) queryForNextPage.set("name", heroSearchName);

// // // // // // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // // // // // //     let areaToUseSlug: string | null = activeOperationalArea?.slug || null;

// // // // // // // // //     if (!areaToUseSlug) {
// // // // // // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // // // // // //         if (!locationToUse) {
// // // // // // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // // // // // //                 onError: (errMsg, errCode) => {
// // // // // // // // //                     if (errCode !== GeolocationPositionError.PERMISSION_DENIED) {
// // // // // // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select an area.`);
// // // // // // // // //                     }
// // // // // // // // //                 }
// // // // // // // // //             });
// // // // // // // // //             locationToUse = detectedLocationForSubCat;
// // // // // // // // //         }
// // // // // // // // //         if (locationToUse && operationalAreas && operationalAreas.length > 0) {
// // // // // // // // //             const nearestArea = findNearestOperationalArea(locationToUse, operationalAreas);
// // // // // // // // //             if (nearestArea) {
// // // // // // // // //                 areaToUseSlug = nearestArea.slug;
// // // // // // // // //                 if (!activeOperationalArea || activeOperationalArea.slug !== nearestArea.slug) {
// // // // // // // // //                     setActiveOperationalArea(nearestArea); 
// // // // // // // // //                 }
// // // // // // // // //             } else {
// // // // // // // // //                 setPageLevelError("Could not determine a nearby operational area based on your location.");
// // // // // // // // //             }
// // // // // // // // //         }
// // // // // // // // //         if (!areaToUseSlug) {
// // // // // // // // //             setIsRedirecting(true);
// // // // // // // // //             const redirectParams = new URLSearchParams();
// // // // // // // // //             if (heroSearchName) redirectParams.set("name", heroSearchName);
// // // // // // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // // // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // // // // // //             router.push(`/select-area?${redirectParams.toString()}`); 
// // // // // // // // //             setProcessingSubCategoryId(null); return;
// // // // // // // // //         }
// // // // // // // // //     }
// // // // // // // // //     if (locationToUse) {
// // // // // // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // // // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // // // // // //         queryForNextPage.set("radiusInMeters", (locationToUse.radiusInMeters || activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // // // // // //     }
// // // // // // // // //     router.push(`/operational-areas/${areaToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // // // // // //     setProcessingSubCategoryId(null);
// // // // // // // // //   };

// // // // // // // // //   const handleHeroSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // // // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // // // // // //     const searchName = submittedCriteria.name;
// // // // // // // // //     const newUrlParams = new URLSearchParams();
// // // // // // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // // // // // //     let targetOperationalArea = activeOperationalArea;

// // // // // // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // // // // // //         if (isLoadingOperationalAreas || !operationalAreas || operationalAreas.length === 0) {
// // // // // // // // //             setPageLevelError("Operational area data is loading. Please try again shortly.");
// // // // // // // // //             setIsProcessingHeroAction(false); return;
// // // // // // // // //         }
// // // // // // // // //         const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // // // // // //         const searchRadius = submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS;
// // // // // // // // //         const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: searchRadius, timestamp: Date.now() };
        
// // // // // // // // //         setContextLocation(newGpsLocation, 'gps'); // CORRECTED: Mapped 'gps_search' to 'gps'
        
// // // // // // // // //         const nearestArea = findNearestOperationalArea(userCoords, operationalAreas);
// // // // // // // // //         if (nearestArea) {
// // // // // // // // //             targetOperationalArea = nearestArea; 
// // // // // // // // //             if(activeOperationalArea?.slug !== nearestArea.slug) setActiveOperationalArea(nearestArea); 
// // // // // // // // //             newUrlParams.set('area', nearestArea.slug);
// // // // // // // // //         } else {
// // // // // // // // //             newUrlParams.delete('area'); 
// // // // // // // // //             setPageLevelError("Could not automatically determine your area. Results may not be localized. You can select an area manually.");
// // // // // // // // //         }
// // // // // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // // // // //         newUrlParams.set("radiusInMeters", searchRadius.toString());
// // // // // // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || (nearestArea ? "distance_asc" : "relevance_desc")); 
// // // // // // // // //     } else {
// // // // // // // // //         if (targetOperationalArea) {
// // // // // // // // //             newUrlParams.set('area', targetOperationalArea.slug);
// // // // // // // // //             if (contextLocation) { 
// // // // // // // // //                 newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // // //                 newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // // //                 newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // //             } else { 
// // // // // // // // //                 newUrlParams.set("userLatitude", targetOperationalArea.centroidLatitude.toString());
// // // // // // // // //                 newUrlParams.set("userLongitude", targetOperationalArea.centroidLongitude.toString());
// // // // // // // // //                 newUrlParams.set("radiusInMeters", (targetOperationalArea.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // //             }
// // // // // // // // //         } else if (contextLocation) { 
// // // // // // // // //              newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // // //              newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // // //              newUrlParams.set("radiusInMeters", (contextLocation.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // //         }
// // // // // // // // //         if(submittedCriteria.sortBy) newUrlParams.set("sortBy", submittedCriteria.sortBy);
// // // // // // // // //     }
    
// // // // // // // // //     // Determine the subCategorySlug for navigation based on the first concept or a default
// // // // // // // // //     const firstPredefinedConceptGroup = predefinedHomepageConcepts[0];
// // // // // // // // //     // CORRECTED: Check if subCategories exists and has items
// // // // // // // // //     const defaultSubCategoryForNavigation = (firstPredefinedConceptGroup?.subCategories && firstPredefinedConceptGroup.subCategories.length > 0) 
// // // // // // // // //                                             ? firstPredefinedConceptGroup.subCategories[0].slug 
// // // // // // // // //                                             : "general-maintenance"; // Fallback if no subcategories defined

// // // // // // // // //     if (targetOperationalArea?.slug && defaultSubCategoryForNavigation) { 
// // // // // // // // //         router.push(`/operational-areas/${targetOperationalArea.slug}/categories/${defaultSubCategoryForNavigation}/shops?${newUrlParams.toString()}`);
// // // // // // // // //     } else if (searchName && !targetOperationalArea) {
// // // // // // // // //         setPageLevelError("Please select an operational area to search within, or allow location access.");
// // // // // // // // //     } else if (!searchName && (submittedCriteria.userLatitude || targetOperationalArea) ) {
// // // // // // // // //          router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //     } else {
// // // // // // // // //         router.push(`/select-area?${newUrlParams.toString()}`); 
// // // // // // // // //     }
// // // // // // // // //     setIsProcessingHeroAction(false);
// // // // // // // // //   };

// // // // // // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // // // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // // // // // //     const correspondingOA = operationalAreas?.find(oa => oa.slug === city.slug || oa.nameEn.includes(city.nameEn));
// // // // // // // // //     if (correspondingOA) {
// // // // // // // // //         setActiveOperationalArea(correspondingOA);
// // // // // // // // //         const areaLocation: UserGeoLocation = { 
// // // // // // // // //             latitude: correspondingOA.centroidLatitude, 
// // // // // // // // //             longitude: correspondingOA.centroidLongitude, 
// // // // // // // // //             radiusInMeters: correspondingOA.defaultSearchRadiusMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, 
// // // // // // // // //             timestamp: Date.now() 
// // // // // // // // //         };
// // // // // // // // //         setContextLocation(areaLocation, 'manual'); // CORRECTED
        
// // // // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // //         newUrlParams.set("area", correspondingOA.slug);
// // // // // // // // //         newUrlParams.set("userLatitude", correspondingOA.centroidLatitude.toString());
// // // // // // // // //         newUrlParams.set("userLongitude", correspondingOA.centroidLongitude.toString());
// // // // // // // // //         newUrlParams.set("radiusInMeters", (areaLocation.radiusInMeters).toString());
// // // // // // // // //         newUrlParams.delete('city');
// // // // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //     } else { 
// // // // // // // // //         setActiveLegacyCity(city); 
// // // // // // // // //         const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, timestamp: Date.now() };
// // // // // // // // //         setContextLocation(cityLocation, 'manual_city');
// // // // // // // // //         const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // //         newUrlParams.set("city", city.slug); 
// // // // // // // // //         newUrlParams.set("userLatitude", city.latitude.toString());
// // // // // // // // //         newUrlParams.set("userLongitude", city.longitude.toString());
// // // // // // // // //         newUrlParams.set("radiusInMeters", (cityLocation.radiusInMeters).toString());
// // // // // // // // //         newUrlParams.delete('area');
// // // // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //     }
// // // // // // // // //   };

// // // // // // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // // // // // //     if (!activeOperationalArea) { 
// // // // // // // // //         setPageLevelError("Please select an operational area first to explore services."); 
// // // // // // // // //         return; 
// // // // // // // // //     }
// // // // // // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // // // // // //     query.delete('city'); 
// // // // // // // // //     query.set('area', activeOperationalArea.slug); 

// // // // // // // // //     // The conceptConfig.conceptPageSlug (e.g., "maintenance-services") is likely the page that lists subcategories
// // // // // // // // //     // So, we navigate to /operational-areas/{areaSlug}/{conceptPageSlug}
// // // // // // // // //     // That page will then display its own list of subcategories to click on.
// // // // // // // // //     router.push(`/operational-areas/${activeOperationalArea.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // // // // // //   };

// // // // // // // // //   const initialHeroSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // // // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // // // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // // // // // //     const urlSortBy = searchParams.get('sortBy'); 
    
// // // // // // // // //     if (urlLat && urlLon) {
// // // // // // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : (activeOperationalArea?.defaultSearchRadiusMeters || DEFAULT_SEARCH_RADIUS), sortBy: urlSortBy || 'distance_asc' };
// // // // // // // // //     } else if (contextLocation) {
// // // // // // // // //         // CORRECTED: Check for contextLocation.source before using startsWith/equality
// // // // // // // // //         const sortByValue = urlSortBy || 
// // // // // // // // //                             (contextLocation.source && 
// // // // // // // // //                              (contextLocation.source.startsWith('gps') || 
// // // // // // // // //                               contextLocation.source === 'preference_loaded' || 
// // // // // // // // //                               contextLocation.source === 'manual' // Assuming 'manual' implies location was set for proximity
// // // // // // // // //                              ) ? 'distance_asc' : undefined);
// // // // // // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: sortByValue };
// // // // // // // // //     }
// // // // // // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // // // // // //   }, [searchParams, contextLocation, activeOperationalArea]);

// // // // // // // // //   const isLoadingGeo = isLoadingContextLocation || isLoadingInitialPreference;
// // // // // // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // // // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // // // // // //     if (!activeOperationalArea?.slug) {
// // // // // // // // //         const conceptGroup = predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === conceptFilter);
// // // // // // // // //         return conceptGroup?.subCategories.map(sc => ({
// // // // // // // // //             name: sc.name,
// // // // // // // // //             slug: sc.slug,
// // // // // // // // //             // icon: sc.icon, // Type SubCategoryDto doesn't have icon, SubCategoryCarouselItem takes it separately
// // // // // // // // //             shopCount: 0, 
// // // // // // // // //             subCategoryEnum: 0, // This is a placeholder; actual enum value would need to be known/mapped
// // // // // // // // //             concept: conceptFilter === "Maintenance" ? 1 : (conceptFilter === "Marketplace" ? 2 : 0),
// // // // // // // // //         })) || []; 
// // // // // // // // //     }
// // // // // // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // // // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // // // // // //     return [];
// // // // // // // // //   };
  
// // // // // // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // // // // // //     if (!activeOperationalArea?.slug) return false; 
// // // // // // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // // // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // // // // // //     return false;
// // // // // // // // //   };

// // // // // // // // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]"; 

// // // // // // // // //   return (
// // // // // // // // //      <div className="relative min-h-screen overflow-x-hidden">
// // // // // // // // //       <div className="relative z-30"> 
// // // // // // // // //         <HeroBillboard
// // // // // // // // //           title="Automotive Services & Parts" highlightText="Simplified"
// // // // // // // // //           subtitle="Find reliable maintenance centers and a diverse auto parts marketplace."
// // // // // // // // //           showSearch={true}
// // // // // // // // //           searchProps={{
// // // // // // // // //             onSubmit: handleHeroSearchSubmit,
// // // // // // // // //             initialValues: initialHeroSearchValues,
// // // // // // // // //             isLoading: isProcessingHeroAction || isLoadingGeo,
// // // // // // // // //             formInstanceId: "hero",
// // // // // // // // //             showDetectLocationButton: true
// // // // // // // // //           }}
// // // // // // // // //           minHeight="min-h-screen" 
// // // // // // // // //           headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING} 

// // // // // // // // //           // --- PROPS FOR MAP MODE (Error here until HeroBillboard.tsx is updated) ---
// // // // // // // // //           isMapMode={true} 
// // // // // // // // //           operationalAreas={operationalAreas || []}
// // // // // // // // //           isLoadingMapData={isLoadingOperationalAreas}
// // // // // // // // //           onOperationalAreaSelect={handleOperationalAreaSelect}
// // // // // // // // //           activeOperationalAreaSlug={activeOperationalArea?.slug || null}
// // // // // // // // //           initialMapCenter={ activeOperationalArea ? [activeOperationalArea.centroidLatitude, activeOperationalArea.centroidLongitude] : [26.8206, 30.8025]} 
// // // // // // // // //           initialMapZoom={activeOperationalArea ? (activeOperationalArea.defaultMapZoomLevel || 10) : 5} 
// // // // // // // // //         />
// // // // // // // // //       </div>

// // // // // // // // //       <div className="relative -mt-[40vh] md:-mt-[45vh] lg:-mt-[50vh] z-20">
// // // // // // // // //         <div className="w-full max-w-none">
// // // // // // // // //           <div className="h-[40vh] md:h-[45vh] lg:h-[50vh]"></div> 
// // // // // // // // //           <div className="bg-white/95 backdrop-blur-sm">
// // // // // // // // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
              
// // // // // // // // //               {!activeOperationalArea && !isLoadingOperationalAreas && !isLoadingGeo && !operationalAreasError && !isLoadingInitialPreference && (
// // // // // // // // //                 <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
// // // // // // // // //                   <p className="text-sm sm:text-base text-blue-700">
// // // // // // // // //                     {isLoadingGeo ? "Determining your location..." : "Select an area on the map or allow location access to see local services."}
// // // // // // // // //                   </p>
// // // // // // // // //                 </div>
// // // // // // // // //               )}
// // // // // // // // //               {activeOperationalArea && (
// // // // // // // // //                 <div className="mb-6 sm:mb-8 text-center">
// // // // // // // // //                   <p className="text-base sm:text-lg text-slate-700">
// // // // // // // // //                     Showing services and parts for: <span className="font-semibold text-orange-600">{activeOperationalArea.nameEn}</span>
// // // // // // // // //                   </p>
// // // // // // // // //                   <Button 
// // // // // // // // //                     variant="link" 
// // // // // // // // //                     onClick={() => {
// // // // // // // // //                       setActiveOperationalArea(null);
// // // // // // // // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // //                       newUrlParams.delete('area');
// // // // // // // // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // //                     }} 
// // // // // // // // //                     className="text-xs text-slate-500 hover:text-orange-600 mt-1"
// // // // // // // // //                   >
// // // // // // // // //                     (Change area or use current location)
// // // // // // // // //                   </Button>
// // // // // // // // //                 </div>
// // // // // // // // //               )}

// // // // // // // // //               {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-blue-100 text-blue-700 rounded-md shadow-sm flex items-center justify-center space-x-2 text-sm">
// // // // // // // // //                   <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // // // // // //                   <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // // // // //                 </div>
// // // // // // // // //               )}
// // // // // // // // //               {pageLevelError && !isRedirecting && (
// // // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // // // //                   {pageLevelError}
// // // // // // // // //                 </div>
// // // // // // // // //               )}
// // // // // // // // //               {showGenericGeoError && contextGeoError && (
// // // // // // // // //                 <div className="text-center my-4 sm:my-6 p-3 bg-yellow-100 text-yellow-700 rounded-md shadow-sm text-sm">
// // // // // // // // //                   Location notice: {contextGeoError} <span className="italic">(You can select an area manually on the map.)</span>
// // // // // // // // //                 </div>
// // // // // // // // //               )}
// // // // // // // // //               {operationalAreasError && (
// // // // // // // // //                  <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // // // //                     Error loading operational areas: {operationalAreasError.message}
// // // // // // // // //                  </div>
// // // // // // // // //               )}

// // // // // // // // //             {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // // // // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // // // // //                 const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && !!activeOperationalArea; // Ensure activeOperationalArea check
                
// // // // // // // // //                 // Type guard for conceptGroup.concept to ensure it's not undefined if find fails (though unlikely with your setup)
// // // // // // // // //                 if (!conceptGroup.concept) return null;

// // // // // // // // //                 if (!activeOperationalArea?.slug && actualSubCategories.length === 0) return null;
                
// // // // // // // // //                 return (
// // // // // // // // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // // // // // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // // // // // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
// // // // // // // // //                         {conceptGroup.concept.nameEn}
// // // // // // // // //                         {activeOperationalArea && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-500 mt-1 sm:mt-0"> in {activeOperationalArea.nameEn}</span>}
// // // // // // // // //                       </h2>
// // // // // // // // //                       {activeOperationalArea && actualSubCategories.length > 0 && (
// // // // // // // // //                         <Button 
// // // // // // // // //                           variant="outline" 
// // // // // // // // //                           size="sm" 
// // // // // // // // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // // // // // //                           className="self-start sm:self-auto"
// // // // // // // // //                         >
// // // // // // // // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // // // // //                         </Button>
// // // // // // // // //                       )}
// // // // // // // // //                     </div>
// // // // // // // // //                     {isLoadingThisCarousel ? (
// // // // // // // // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // // // // // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-orange-500"/>
// // // // // // // // //                       </div>
// // // // // // // // //                     ) : actualSubCategories.length > 0 ? (
// // // // // // // // //                       <div className="relative">
// // // // // // // // //                         <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full" >
// // // // // // // // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // // // // // //                             {actualSubCategories.map((subCat, index) => (
// // // // // // // // //                               <CarouselItem key={subCat.slug + index} className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0" >
// // // // // // // // //                                 <div className="p-1 h-full">
// // // // // // // // //                                   <SubCategoryCarouselItem
// // // // // // // // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as PredefinedSubCategory).icon }} // Use PredefinedSubCategory for icon
// // // // // // // // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // // // // //                                     shopCount={subCat.shopCount} 
// // // // // // // // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // // // // //                                   />
// // // // // // // // //                                 </div>
// // // // // // // // //                               </CarouselItem>
// // // // // // // // //                             ))}
// // // // // // // // //                           </CarouselContent>
// // // // // // // // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // // // // // // // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8" />
// // // // // // // // //                             <CarouselNext className="static translate-y-0 h-8 w-8" />
// // // // // // // // //                           </div>
// // // // // // // // //                           <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-6" />
// // // // // // // // //                           <CarouselNext className="hidden sm:flex -right-4 lg:-right-6" />
// // // // // // // // //                         </Carousel>
// // // // // // // // //                       </div>
// // // // // // // // //                     ) : (
// // // // // // // // //                       <p className="text-slate-500 text-sm">
// // // // // // // // //                         {activeOperationalArea ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeOperationalArea.nameEn}.` 
// // // // // // // // //                                                : "Select an area on the map or allow location access to see available services."}
// // // // // // // // //                       </p>
// // // // // // // // //                     )}
// // // // // // // // //                   </section>
// // // // // // // // //                 );
// // // // // // // // //               })}

// // // // // // // // //             <section id="browse-by-city" className="mt-16 pt-8 border-t border-slate-200">
// // // // // // // // //               <div className="text-center mb-8 md:mb-10">
// // // // // // // // //                 <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">
// // // // // // // // //                   Or, Browse by City (Legacy)
// // // // // // // // //                 </h2>
// // // // // // // // //                 <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-gray-600">
// // // // // // // // //                   {activeLegacyCity ? `Currently showing for ${activeLegacyCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // // // // // //                 </p>
// // // // // // // // //               </div>
              
// // // // // // // // //               {isLoadingLegacyCities ? (
// // // // // // // // //                 <div className="text-center py-10"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" /></div>
// // // // // // // // //               ) : legacyCitiesError ? ( 
// // // // // // // // //                 <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">Could not load cities: {legacyCitiesError.message}</div>
// // // // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length === 0 ? (
// // // // // // // // //                  <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// // // // // // // // //               ) : Array.isArray(legacyCities) && legacyCities.length > 0 ? ( 
// // // // // // // // //                 <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // // // // // //                   {legacyCities.map((city: CityDto) => ( 
// // // // // // // // //                     <CityCard
// // // // // // // // //                       key={city.id}
// // // // // // // // //                       city={city} 
// // // // // // // // //                       onClick={() => handleCityCardClick(city)} 
// // // // // // // // //                     />
// // // // // // // // //                   ))}
// // // // // // // // //                 </div>
// // // // // // // // //               ): null}
// // // // // // // // //             </section>
            
// // // // // // // // //             </div> 
// // // // // // // // //           </div> 
// // // // // // // // //         </div> 
// // // // // // // // //       </div> 
// // // // // // // // //     </div> 
// // // // // // // // //   );
// // // // // // // // // }
// // // // // // // // // // // src/app/page.tsx
// // // // // // // // // // 'use client';

// // // // // // // // // // import React, { useState, useMemo, useEffect, useCallback } from 'react';
// // // // // // // // // // import { useRouter, useSearchParams } from 'next/navigation';
// // // // // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // // // // import { fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // // // // // import { CityDto, APIError, FrontendShopQueryParameters, SubCategoryDto, HighLevelConceptQueryParam } from '@/types/api';
// // // // // // // // // // import { predefinedHomepageConcepts, FeatureConceptConfig } from '@/config/categories';
// // // // // // // // // // import { haversineDistance, Coordinates } from '@/lib/geolocationUtils';
// // // // // // // // // // import HeroBillboard from '@/components/common/HeroBillboard';
// // // // // // // // // // import CityCard from '@/components/city/CityCard';
// // // // // // // // // // import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react'; // Ensured ChevronLeft is imported
// // // // // // // // // // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';
// // // // // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // // // // import {
// // // // // // // // // //   Carousel,
// // // // // // // // // //   CarouselContent,
// // // // // // // // // //   CarouselItem,
// // // // // // // // // //   CarouselNext,
// // // // // // // // // //   CarouselPrevious,
// // // // // // // // // // } from "@/components/ui/carousel";
// // // // // // // // // // import SubCategoryCarouselItem from '@/components/subcategory/SubCategoryCarouselItem';



// // // // // // // // // // type HeroSearchSubmitParams = Pick<
// // // // // // // // // //   FrontendShopQueryParameters,
// // // // // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // // // // >;

// // // // // // // // // // const DEFAULT_SEARCH_RADIUS = 500000;

// // // // // // // // // // export default function HomePage() {
// // // // // // // // // //   const router = useRouter();
// // // // // // // // // //   const searchParams = useSearchParams();

// // // // // // // // // //   const {
// // // // // // // // // //     currentLocation: contextLocation,
// // // // // // // // // //     setCurrentLocation: setContextLocation,
// // // // // // // // // //     isLoading: isLoadingContextLocation,
// // // // // // // // // //     error: contextGeoError,
// // // // // // // // // //     clearError: clearContextGeoError,
// // // // // // // // // //     attemptBrowserGpsLocation,
// // // // // // // // // //     isLoadingInitialPreference,
// // // // // // // // // //   } = useUserGeoLocation();

// // // // // // // // // //   const [isProcessingHeroAction, setIsProcessingHeroAction] = useState(false);
// // // // // // // // // //   const [pageLevelError, setPageLevelError] = useState<string | null>(null);
// // // // // // // // // //   const [processingSubCategoryId, setProcessingSubCategoryId] = useState<string | null>(null);
// // // // // // // // // //   const [isRedirecting, setIsRedirecting] = useState(false);
// // // // // // // // // //   const [activeCity, setActiveCity] = useState<CityDto | null>(null);

// // // // // // // // // //   const [carouselItemsToShow, setCarouselItemsToShow] = useState(5); // Default for desktop

// // // // // // // // // //   useEffect(() => {
// // // // // // // // // //     const updateVisibleItems = () => {
// // // // // // // // // //       if (typeof window !== 'undefined') {
// // // // // // // // // //         if (window.innerWidth < 640) setCarouselItemsToShow(2); // Tailwind 'sm'
// // // // // // // // // //         else if (window.innerWidth < 768) setCarouselItemsToShow(3); // Tailwind 'md'
// // // // // // // // // //         else if (window.innerWidth < 1024) setCarouselItemsToShow(4); // Tailwind 'lg'
// // // // // // // // // //         else setCarouselItemsToShow(5);
// // // // // // // // // //       }
// // // // // // // // // //     };
// // // // // // // // // //     updateVisibleItems();
// // // // // // // // // //     window.addEventListener('resize', updateVisibleItems);
// // // // // // // // // //     return () => window.removeEventListener('resize', updateVisibleItems);
// // // // // // // // // //   }, []);

// // // // // // // // // //   const {
// // // // // // // // // //     data: cities,
// // // // // // // // // //     isLoading: isLoadingCities,
// // // // // // // // // //     error: citiesError
// // // // // // // // // //   } = useQuery<CityDto[], APIError>({
// // // // // // // // // //       queryKey: ['cities'],
// // // // // // // // // //       queryFn: fetchCities,
// // // // // // // // // //       staleTime: 1000 * 60 * 60,
// // // // // // // // // //       refetchOnWindowFocus: false,
// // // // // // // // // //     });

// // // // // // // // // //   const { data: maintenanceSubCats, isLoading: isLoadingMaintSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // // // //       queryKey: ['subCategories', activeCity?.slug, 'Maintenance'],
// // // // // // // // // //       queryFn: () => activeCity?.slug ? fetchSubCategoriesByCity(activeCity.slug, 'Maintenance') : Promise.resolve([]),
// // // // // // // // // //       enabled: !!activeCity,
// // // // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // // // //   });

// // // // // // // // // //   const { data: marketplaceSubCats, isLoading: isLoadingMarketSubCats } = useQuery<SubCategoryDto[], APIError>({
// // // // // // // // // //       queryKey: ['subCategories', activeCity?.slug, 'Marketplace'],
// // // // // // // // // //       queryFn: () => activeCity?.slug ? fetchSubCategoriesByCity(activeCity.slug, 'Marketplace') : Promise.resolve([]),
// // // // // // // // // //       enabled: !!activeCity,
// // // // // // // // // //       staleTime: 1000 * 60 * 5,
// // // // // // // // // //   });

// // // // // // // // // //   const findNearestCity = useCallback((userCoords: Coordinates, allCities: CityDto[]): CityDto | null => {
// // // // // // // // // //     if (!allCities || allCities.length === 0) return null;
// // // // // // // // // //     return allCities.reduce((closest: CityDto | null, currentCity: CityDto) => {
// // // // // // // // // //       const cityCoords: Coordinates = { latitude: currentCity.latitude, longitude: currentCity.longitude };
// // // // // // // // // //       const distance = haversineDistance(userCoords, cityCoords);
// // // // // // // // // //       if (closest === null) return currentCity;
// // // // // // // // // //       const closestCityCoords: Coordinates = { latitude: closest.latitude, longitude: closest.longitude };
// // // // // // // // // //       const closestDistance = haversineDistance(userCoords, closestCityCoords);
// // // // // // // // // //       return distance < closestDistance ? currentCity : closest;
// // // // // // // // // //     }, null);
// // // // // // // // // //   }, []);

// // // // // // // // // //   useEffect(() => {
// // // // // // // // // //     if (contextLocation && cities && cities.length > 0 && !activeCity && !isLoadingInitialPreference) {
// // // // // // // // // //       const nearest = findNearestCity(contextLocation, cities);
// // // // // // // // // //       if (nearest) {
// // // // // // // // // //         setActiveCity(nearest);
// // // // // // // // // //         const citySlugFromUrl = searchParams.get('city');
// // // // // // // // // //         if (citySlugFromUrl !== nearest.slug) {
// // // // // // // // // //             const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // // //             newUrlParams.set('city', nearest.slug);
// // // // // // // // // //             router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //         }
// // // // // // // // // //       }
// // // // // // // // // //     }
// // // // // // // // // //   }, [contextLocation, cities, activeCity, isLoadingInitialPreference, findNearestCity, router, searchParams]);

// // // // // // // // // //   useEffect(() => {
// // // // // // // // // //     const urlLatStr = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // // // //     const urlLonStr = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // // // //     const urlRadiusStr = searchParams.get('radiusInMeters');

// // // // // // // // // //     if (urlLatStr && urlLonStr) {
// // // // // // // // // //       const lat = parseFloat(urlLatStr);
// // // // // // // // // //       const lon = parseFloat(urlLonStr);
// // // // // // // // // //       const radius = urlRadiusStr ? parseInt(urlRadiusStr, 10) : DEFAULT_SEARCH_RADIUS;
// // // // // // // // // //       if (!isNaN(lat) && !isNaN(lon) && !isNaN(radius)) {
// // // // // // // // // //         if (contextLocation?.latitude !== lat || contextLocation?.longitude !== lon || contextLocation?.radiusInMeters !== radius) {
// // // // // // // // // //           setContextLocation({ latitude: lat, longitude: lon, radiusInMeters: radius, timestamp: Date.now() }, 'url_param');
// // // // // // // // // //         }
// // // // // // // // // //       }
// // // // // // // // // //     }
// // // // // // // // // //   }, [searchParams, contextLocation, setContextLocation]);
  
// // // // // // // // // //   useEffect(() => {
// // // // // // // // // //     const citySlugFromUrl = searchParams.get('city');
// // // // // // // // // //     if (citySlugFromUrl && cities && cities.length > 0) {
// // // // // // // // // //         if (!activeCity || activeCity.slug !== citySlugFromUrl) {
// // // // // // // // // //             const cityFromUrl = cities.find(c => c.slug === citySlugFromUrl);
// // // // // // // // // //             if (cityFromUrl) {
// // // // // // // // // //                 setActiveCity(cityFromUrl);
// // // // // // // // // //             }
// // // // // // // // // //         }
// // // // // // // // // //     }
// // // // // // // // // //   }, [searchParams, cities, activeCity]);

// // // // // // // // // //   const handleSubCategoryCarouselItemClick = async (subCategorySlug: string, conceptPageSlugForFallback: string) => {
// // // // // // // // // //     setProcessingSubCategoryId(subCategorySlug);
// // // // // // // // // //     setPageLevelError(null); setIsRedirecting(false); clearContextGeoError();
// // // // // // // // // //     const queryForNextPage = new URLSearchParams(searchParams.toString());
// // // // // // // // // //     queryForNextPage.delete('city');
// // // // // // // // // //     const heroSearchInput = document.getElementById('hero-mainSearchInput') as HTMLInputElement;
// // // // // // // // // //     const heroSearchName = heroSearchInput?.value.trim();
// // // // // // // // // //     if (heroSearchName) queryForNextPage.set("name", heroSearchName);
// // // // // // // // // //     else queryForNextPage.delete("name");
// // // // // // // // // //     let locationToUse: UserGeoLocation | null = contextLocation;
// // // // // // // // // //     let cityToUseSlug: string | null = activeCity?.slug || null;

// // // // // // // // // //     if (!cityToUseSlug) {
// // // // // // // // // //         let detectedLocationForSubCat: UserGeoLocation | null = null;
// // // // // // // // // //         if (!locationToUse) {
// // // // // // // // // //             detectedLocationForSubCat = await attemptBrowserGpsLocation({
// // // // // // // // // //                 onError: (errMsg, errCode) => {
// // // // // // // // // //                     if (errCode !== GeolocationPositionError.PERMISSION_DENIED) {
// // // // // // // // // //                         setPageLevelError(`Location error: ${errMsg}. Please select a city.`);
// // // // // // // // // //                     }
// // // // // // // // // //                 }
// // // // // // // // // //             });
// // // // // // // // // //             locationToUse = detectedLocationForSubCat;
// // // // // // // // // //         }
// // // // // // // // // //         if (locationToUse) {
// // // // // // // // // //             if (isLoadingCities || !cities || cities.length === 0) {
// // // // // // // // // //                 setPageLevelError("City data is loading. Please select a city manually or try again.");
// // // // // // // // // //                 setProcessingSubCategoryId(null); return;
// // // // // // // // // //             }
// // // // // // // // // //             const nearest = findNearestCity(locationToUse, cities);
// // // // // // // // // //             if (nearest) {
// // // // // // // // // //                 cityToUseSlug = nearest.slug;
// // // // // // // // // //                 if (!activeCity || activeCity.slug !== nearest.slug) setActiveCity(nearest);
// // // // // // // // // //             } else {
// // // // // // // // // //                 setPageLevelError("Could not determine a nearby city based on your location.");
// // // // // // // // // //             }
// // // // // // // // // //         }
// // // // // // // // // //         if (!cityToUseSlug) {
// // // // // // // // // //             setIsRedirecting(true);
// // // // // // // // // //             const redirectParams = new URLSearchParams();
// // // // // // // // // //             if (heroSearchName) redirectParams.set("name", heroSearchName);
// // // // // // // // // //             redirectParams.set("subCategory", subCategorySlug);
// // // // // // // // // //             redirectParams.set("concept", conceptPageSlugForFallback);
// // // // // // // // // //             router.push(`/select-city?${redirectParams.toString()}`);
// // // // // // // // // //             setProcessingSubCategoryId(null); return;
// // // // // // // // // //         }
// // // // // // // // // //     }
// // // // // // // // // //     if (locationToUse) {
// // // // // // // // // //         queryForNextPage.set("userLatitude", locationToUse.latitude.toString());
// // // // // // // // // //         queryForNextPage.set("userLongitude", locationToUse.longitude.toString());
// // // // // // // // // //         queryForNextPage.set("radiusInMeters", locationToUse.radiusInMeters.toString());
// // // // // // // // // //         queryForNextPage.set("sortBy", "distance_asc");
// // // // // // // // // //     } else {
// // // // // // // // // //         queryForNextPage.delete("userLatitude"); queryForNextPage.delete("userLongitude"); queryForNextPage.delete("radiusInMeters");
// // // // // // // // // //     }
// // // // // // // // // //     router.push(`/cities/${cityToUseSlug}/categories/${subCategorySlug}/shops?${queryForNextPage.toString()}`);
// // // // // // // // // //     setProcessingSubCategoryId(null);
// // // // // // // // // //   };

// // // // // // // // // //   const handleHeroSearchSubmit = async (submittedCriteria: HeroSearchSubmitParams) => {
// // // // // // // // // //     setPageLevelError(null); setIsRedirecting(false); setIsProcessingHeroAction(true); clearContextGeoError();
// // // // // // // // // //     const searchName = submittedCriteria.name;
// // // // // // // // // //     const newUrlParams = new URLSearchParams();
// // // // // // // // // //     if (searchName) newUrlParams.set("name", searchName);

// // // // // // // // // //     if (submittedCriteria.userLatitude != null && submittedCriteria.userLongitude != null) {
// // // // // // // // // //       if (isLoadingCities || !cities || cities.length === 0) {
// // // // // // // // // //         setPageLevelError("City data is loading. Please try again shortly.");
// // // // // // // // // //         setIsProcessingHeroAction(false); return;
// // // // // // // // // //       }
// // // // // // // // // //       const userCoords: Coordinates = { latitude: submittedCriteria.userLatitude, longitude: submittedCriteria.userLongitude };
// // // // // // // // // //       const newGpsLocation: UserGeoLocation = { ...userCoords, radiusInMeters: submittedCriteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, source: 'gps', timestamp: Date.now() };
// // // // // // // // // //       setContextLocation(newGpsLocation, 'gps');
// // // // // // // // // //       const nearestCity = findNearestCity(userCoords, cities);
// // // // // // // // // //       if (nearestCity) {
// // // // // // // // // //         setActiveCity(nearestCity); newUrlParams.set('city', nearestCity.slug);
// // // // // // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // // // // // //         newUrlParams.set("radiusInMeters", newGpsLocation.radiusInMeters.toString());
// // // // // // // // // //         newUrlParams.set("sortBy", submittedCriteria.sortBy || "distance_asc");
// // // // // // // // // //       } else {
// // // // // // // // // //         newUrlParams.delete('city');
// // // // // // // // // //         newUrlParams.set("userLatitude", userCoords.latitude.toString());
// // // // // // // // // //         newUrlParams.set("userLongitude", userCoords.longitude.toString());
// // // // // // // // // //         if(submittedCriteria.radiusInMeters) newUrlParams.set("radiusInMeters", submittedCriteria.radiusInMeters.toString());
// // // // // // // // // //         setPageLevelError("Could not automatically determine your city. Results may not be localized. You can select a city manually.");
// // // // // // // // // //       }
// // // // // // // // // //       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //     } else {
// // // // // // // // // //       if (activeCity) {
// // // // // // // // // //         newUrlParams.set('city', activeCity.slug);
// // // // // // // // // //         if(contextLocation){
// // // // // // // // // //             newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // // // //             newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // // // //             newUrlParams.set("radiusInMeters", contextLocation.radiusInMeters.toString());
// // // // // // // // // //         } else {
// // // // // // // // // //             newUrlParams.delete("userLatitude"); newUrlParams.delete("userLongitude"); newUrlParams.delete("radiusInMeters");
// // // // // // // // // //         }
// // // // // // // // // //         router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //       } else {
// // // // // // // // // //         const queryForRedirect = new URLSearchParams();
// // // // // // // // // //         if (searchName) queryForRedirect.set("name", searchName);
// // // // // // // // // //         router.push(`/select-city?${queryForRedirect.toString()}`);
// // // // // // // // // //       }
// // // // // // // // // //     }
// // // // // // // // // //     setIsProcessingHeroAction(false);
// // // // // // // // // //   };

// // // // // // // // // //   const handleCityCardClick = (city: CityDto) => {
// // // // // // // // // //     clearContextGeoError(); setPageLevelError(null);
// // // // // // // // // //     setActiveCity(city);
// // // // // // // // // //     const cityLocation: UserGeoLocation = { latitude: city.latitude, longitude: city.longitude, radiusInMeters: contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS, source: 'manual_city', timestamp: Date.now() };
// // // // // // // // // //     setContextLocation(cityLocation, 'manual_city');
// // // // // // // // // //     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // // //     newUrlParams.set("city", city.slug);
// // // // // // // // // //     newUrlParams.set("userLatitude", city.latitude.toString());
// // // // // // // // // //     newUrlParams.set("userLongitude", city.longitude.toString());
// // // // // // // // // //     newUrlParams.set("radiusInMeters", (contextLocation?.radiusInMeters || DEFAULT_SEARCH_RADIUS).toString());
// // // // // // // // // //     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //   };

// // // // // // // // // //   const handleExploreMoreClick = (conceptConfig: FeatureConceptConfig) => {
// // // // // // // // // //     if (!activeCity) { setPageLevelError("Please select a city first to explore services."); return; }
// // // // // // // // // //     const query = new URLSearchParams(searchParams.toString());
// // // // // // // // // //     query.delete('city');
// // // // // // // // // //     router.push(`/cities/${activeCity.slug}/${conceptConfig.conceptPageSlug}?${query.toString()}`);
// // // // // // // // // //   };

// // // // // // // // // //   const initialHeroSearchValues: Partial<HeroSearchSubmitParams> = useMemo(() => {
// // // // // // // // // //     const nameFromUrl = searchParams.get('name') || '';
// // // // // // // // // //     const urlLat = searchParams.get('userLatitude') || searchParams.get('userLat');
// // // // // // // // // //     const urlLon = searchParams.get('userLongitude') || searchParams.get('userLon');
// // // // // // // // // //     const urlRadius = searchParams.get('radiusInMeters');
// // // // // // // // // //     const urlSortBy = searchParams.get('sortBy');
// // // // // // // // // //     if (urlLat && urlLon) {
// // // // // // // // // //         return { name: nameFromUrl, userLatitude: parseFloat(urlLat), userLongitude: parseFloat(urlLon), radiusInMeters: urlRadius ? parseInt(urlRadius) : DEFAULT_SEARCH_RADIUS, sortBy: urlSortBy || 'distance_asc' };
// // // // // // // // // //     } else if (contextLocation) {
// // // // // // // // // //         return { name: nameFromUrl, userLatitude: contextLocation.latitude, userLongitude: contextLocation.longitude, radiusInMeters: contextLocation.radiusInMeters, sortBy: urlSortBy || (contextLocation.source === 'gps' || contextLocation.source === 'preference_loaded' ? 'distance_asc' : undefined) };
// // // // // // // // // //     }
// // // // // // // // // //     return { name: nameFromUrl, sortBy: urlSortBy || undefined };
// // // // // // // // // //   }, [searchParams, contextLocation]);

// // // // // // // // // //   const isLoadingGeo = isLoadingContextLocation;
// // // // // // // // // //   const showGenericGeoError = contextGeoError && !pageLevelError && !isRedirecting && !isLoadingGeo && !processingSubCategoryId && !isProcessingHeroAction;

// // // // // // // // // //   const getSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): SubCategoryDto[] => {
// // // // // // // // // //     if (!activeCity && conceptFilter === 'Maintenance') return predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === 'Maintenance')?.subCategories.map(sc => ({...sc, shopCount:0, subCategoryEnum:0, concept:1})) as SubCategoryDto[] || [];
// // // // // // // // // //     if (!activeCity && conceptFilter === 'Marketplace') return predefinedHomepageConcepts.find(c => c.concept.apiConceptFilter === 'Marketplace')?.subCategories.map(sc => ({...sc, shopCount:0, subCategoryEnum:0, concept:2})) as SubCategoryDto[] || [];
// // // // // // // // // //     if (conceptFilter === 'Maintenance') return maintenanceSubCats || [];
// // // // // // // // // //     if (conceptFilter === 'Marketplace') return marketplaceSubCats || [];
// // // // // // // // // //     return [];
// // // // // // // // // //   };
  
// // // // // // // // // //   const isLoadingSubcategoriesForConcept = (conceptFilter: HighLevelConceptQueryParam): boolean => {
// // // // // // // // // //     if (!activeCity) return false; 
// // // // // // // // // //     if (conceptFilter === 'Maintenance') return isLoadingMaintSubCats;
// // // // // // // // // //     if (conceptFilter === 'Marketplace') return isLoadingMarketSubCats;
// // // // // // // // // //     return false;
// // // // // // // // // //   };

// // // // // // // // // //   const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-16";

// // // // // // // // // // //   console.log('Homepage Debug:', {
// // // // // // // // // // //   isProcessingHeroAction,
// // // // // // // // // // //   isLoadingGeo,
// // // // // // // // // // //   isLoadingContextLocation, 
// // // // // // // // // // //   isLoadingInitialPreference,
// // // // // // // // // // //   contextLocation,
// // // // // // // // // // //   contextGeoError
// // // // // // // // // // // });

// // // // // // // // // //   return (
// // // // // // // // // //     //<div className="flex flex-col"> {/* Removed min-h-screen bg-slate-50, handled by layout */}
// // // // // // // // // //      <div className="relative min-h-screen overflow-x-hidden">
// // // // // // // // // //       {/* Hero Billboard - Full viewport overlay */}
// // // // // // // // // //     <div className="relative z-30">
// // // // // // // // // //       <HeroBillboard
// // // // // // // // // //         title="Automotive Services & Parts" highlightText="Simplified"
// // // // // // // // // //         subtitle="Find reliable maintenance centers and a diverse auto parts marketplace."
// // // // // // // // // //         showSearch={true}
// // // // // // // // // //         searchProps={{
// // // // // // // // // //           onSubmit: handleHeroSearchSubmit,
// // // // // // // // // //           initialValues: initialHeroSearchValues,
// // // // // // // // // //           isLoading: isProcessingHeroAction || isLoadingGeo,
// // // // // // // // // //           formInstanceId: "hero",
// // // // // // // // // //           showDetectLocationButton: true
// // // // // // // // // //         }}
// // // // // // // // // //         minHeight="min-h-screen"
// // // // // // // // // //         headerHeightClass={HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING}
// // // // // // // // // //         //minHeight="min-h-[40vh] md:min-h-[45vh] lg:min-h-[50vh]"
// // // // // // // // // //       />
// // // // // // // // // //       </div>

// // // // // // // // // //       {/* Main Content - Overlaps hero */}
// // // // // // // // // //       <div className="relative -mt-[40vh] md:-mt-[45vh] lg:-mt-[50vh] z-20">
// // // // // // // // // //         {/* Content Container with proper mobile constraints */}
// // // // // // // // // //         <div className="w-full max-w-none">
// // // // // // // // // //           {/* Spacer to push content below hero search area */}
// // // // // // // // // //           <div className="h-[40vh] md:h-[45vh] lg:h-[50vh]"></div>
          
// // // // // // // // // //           {/* Content Section with contained width */}
// // // // // // // // // //           <div className="bg-white/95 backdrop-blur-sm">
// // // // // // // // // //             <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-10">
              
// // // // // // // // // //               {/* Status Messages

// // // // // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
// // // // // // // // // //         {!activeCity && !isLoadingCities && !isLoadingGeo && !citiesError && !isLoadingInitialPreference && (
// // // // // // // // // //           <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
// // // // // // // // // //             <p className="text-blue-700">
// // // // // // // // // //               {isLoadingGeo ? "Determining your location..." : "Select a city below or allow location access to see local services."}
// // // // // // // // // //             </p>
// // // // // // // // // //           </div>
// // // // // // // // // //         )} */}
// // // // // // // // // //         {/* Status Messages */}
// // // // // // // // // //         {!activeCity && !isLoadingCities && !isLoadingGeo && !citiesError && !isLoadingInitialPreference && (
// // // // // // // // // //           <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
// // // // // // // // // //             <p className="text-sm sm:text-base text-blue-700">
// // // // // // // // // //               {isLoadingGeo ? "Determining your location..." : "Select a city below or allow location access to see local services."}
// // // // // // // // // //             </p>
// // // // // // // // // //           </div>
// // // // // // // // // //         )}
// // // // // // // // // //         {/* {activeCity && (
// // // // // // // // // //              <div className="mb-8 text-center">
// // // // // // // // // //                 <p className="text-lg text-slate-700">
// // // // // // // // // //                     Showing services and parts for: <span className="font-semibold text-orange-600">{activeCity.nameEn}</span>
// // // // // // // // // //                 </p>
// // // // // // // // // //                 <Button variant="link" onClick={() => {
// // // // // // // // // //                     setActiveCity(null);
// // // // // // // // // //                     const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // // //                     newUrlParams.delete('city');
// // // // // // // // // //                     if (contextLocation) {
// // // // // // // // // //                         newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // // // //                         newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // // // //                         newUrlParams.set("radiusInMeters", contextLocation.radiusInMeters.toString());
// // // // // // // // // //                     } else {
// // // // // // // // // //                         newUrlParams.delete("userLatitude"); newUrlParams.delete("userLongitude"); newUrlParams.delete("radiusInMeters");
// // // // // // // // // //                     }
// // // // // // // // // //                     router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //                 }} className="text-xs text-slate-500 hover:text-orange-600">
// // // // // // // // // //                     (Change city or use current location)
// // // // // // // // // //                 </Button>
// // // // // // // // // //             </div>
// // // // // // // // // //         )} */}
// // // // // // // // // //         {activeCity && (
// // // // // // // // // //                 <div className="mb-6 sm:mb-8 text-center">
// // // // // // // // // //                   <p className="text-base sm:text-lg text-slate-700">
// // // // // // // // // //                     Showing services and parts for: <span className="font-semibold text-orange-600">{activeCity.nameEn}</span>
// // // // // // // // // //                   </p>
// // // // // // // // // //                   <Button 
// // // // // // // // // //                     variant="link" 
// // // // // // // // // //                     onClick={() => {
// // // // // // // // // //                       setActiveCity(null);
// // // // // // // // // //                       const newUrlParams = new URLSearchParams(searchParams.toString());
// // // // // // // // // //                       newUrlParams.delete('city');
// // // // // // // // // //                       if (contextLocation) {
// // // // // // // // // //                         newUrlParams.set("userLatitude", contextLocation.latitude.toString());
// // // // // // // // // //                         newUrlParams.set("userLongitude", contextLocation.longitude.toString());
// // // // // // // // // //                         newUrlParams.set("radiusInMeters", contextLocation.radiusInMeters.toString());
// // // // // // // // // //                       } else {
// // // // // // // // // //                         newUrlParams.delete("userLatitude"); 
// // // // // // // // // //                         newUrlParams.delete("userLongitude"); 
// // // // // // // // // //                         newUrlParams.delete("radiusInMeters");
// // // // // // // // // //                       }
// // // // // // // // // //                       router.replace(`/?${newUrlParams.toString()}`, { scroll: false });
// // // // // // // // // //                     }} 
// // // // // // // // // //                     className="text-xs text-slate-500 hover:text-orange-600 mt-1"
// // // // // // // // // //                   >
// // // // // // // // // //                     (Change city or use current location)
// // // // // // // // // //                   </Button>
// // // // // // // // // //                 </div>
// // // // // // // // // //               )}

// // // // // // // // // //         {/* {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // // // // // //             <div className="text-center my-6 p-3 bg-blue-100 text-blue-700 rounded-md shadow-sm flex items-center justify-center space-x-2 text-sm">
// // // // // // // // // //             <Loader2 className="w-5 h-5 animate-spin" />
// // // // // // // // // //             <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // // // // // //             </div>
// // // // // // // // // //         )}
// // // // // // // // // //         {pageLevelError && !isRedirecting && (
// // // // // // // // // //             <div className="text-center my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">{pageLevelError}</div>
// // // // // // // // // //         )}
// // // // // // // // // //         {showGenericGeoError && contextGeoError && (
// // // // // // // // // //             <div className="text-center my-6 p-3 bg-yellow-100 text-yellow-700 rounded-md shadow-sm text-sm">
// // // // // // // // // //             Location notice: {contextGeoError} <span className="italic">(You can select a city manually.)</span>
// // // // // // // // // //             </div>
// // // // // // // // // //         )} */}
// // // // // // // // // //         {/* Loading/Error States */}
// // // // // // // // // //           {(isProcessingHeroAction || (processingSubCategoryId && isLoadingGeo)) && !isRedirecting && (
// // // // // // // // // //             <div className="text-center my-4 sm:my-6 p-3 bg-blue-100 text-blue-700 rounded-md shadow-sm flex items-center justify-center space-x-2 text-sm">
// // // // // // // // // //               <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
// // // // // // // // // //               <span>{processingSubCategoryId ? "Getting location for subcategory..." : "Processing..."}</span>
// // // // // // // // // //             </div>
// // // // // // // // // //           )}

// // // // // // // // // //           {pageLevelError && !isRedirecting && (
// // // // // // // // // //             <div className="text-center my-4 sm:my-6 p-3 bg-red-100 text-red-700 rounded-md shadow-sm text-sm">
// // // // // // // // // //               {pageLevelError}
// // // // // // // // // //             </div>
// // // // // // // // // //           )}

// // // // // // // // // //           {showGenericGeoError && contextGeoError && (
// // // // // // // // // //             <div className="text-center my-4 sm:my-6 p-3 bg-yellow-100 text-yellow-700 rounded-md shadow-sm text-sm">
// // // // // // // // // //               Location notice: {contextGeoError} <span className="italic">(You can select a city manually.)</span>
// // // // // // // // // //             </div>
// // // // // // // // // //           )}

// // // // // // // // // //         {/* {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // // // // // //           const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // // // // // //           const subcategoriesToDisplay = 
// // // // // // // // // //             (!activeCity || (activeCity && actualSubCategories.length === 0 && !isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && conceptGroup.subCategories.length > 0)) 
// // // // // // // // // //             ? conceptGroup.subCategories.map(psc => ({ // Map predefined to have consistent structure for SubCategoryCarouselItem
// // // // // // // // // //                 name: psc.name,
// // // // // // // // // //                 slug: psc.slug,
// // // // // // // // // //                 icon: psc.icon,
// // // // // // // // // //                 shopCount: undefined, // Predefined don't have live shop counts
// // // // // // // // // //                 concept: conceptGroup.concept.apiConceptFilter === "Maintenance" ? 1 : 2, // Approximate concept number
// // // // // // // // // //                 subCategoryEnum: 0 // Placeholder
// // // // // // // // // //             }))
// // // // // // // // // //             : actualSubCategories.map(fetchedSubCat => ({
// // // // // // // // // //                 name: fetchedSubCat.name.replace(/([A-Z])/g, ' $1').trim(),
// // // // // // // // // //                 slug: fetchedSubCat.slug,
// // // // // // // // // //                 icon: predefinedHomepageConcepts.flatMap(pg => pg.subCategories).find(ps => ps.slug === fetchedSubCat.slug)?.icon || conceptGroup.concept.icon,
// // // // // // // // // //                 shopCount: fetchedSubCat.shopCount,
// // // // // // // // // //                 concept: fetchedSubCat.concept,
// // // // // // // // // //                 subCategoryEnum: fetchedSubCat.subCategoryEnum
// // // // // // // // // //             })); */}
// // // // // // // // // //             {/* Service Categories Sections */}
// // // // // // // // // //               {predefinedHomepageConcepts.map((conceptGroup) => {
// // // // // // // // // //                 const actualSubCategories = getSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter);
// // // // // // // // // //                 const subcategoriesToDisplay = 
// // // // // // // // // //                   (!activeCity || (activeCity && actualSubCategories.length === 0 && !isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && conceptGroup.subCategories.length > 0)) 
// // // // // // // // // //                   ? conceptGroup.subCategories.map(psc => ({
// // // // // // // // // //                       name: psc.name,
// // // // // // // // // //                       slug: psc.slug,
// // // // // // // // // //                       icon: psc.icon,
// // // // // // // // // //                       shopCount: undefined,
// // // // // // // // // //                       concept: conceptGroup.concept.apiConceptFilter === "Maintenance" ? 1 : 2,
// // // // // // // // // //                       subCategoryEnum: 0
// // // // // // // // // //                     }))
// // // // // // // // // //                   : actualSubCategories.map(fetchedSubCat => ({
// // // // // // // // // //                       name: fetchedSubCat.name.replace(/([A-Z])/g, ' $1').trim(),
// // // // // // // // // //                       slug: fetchedSubCat.slug,
// // // // // // // // // //                       icon: predefinedHomepageConcepts.flatMap(pg => pg.subCategories).find(ps => ps.slug === fetchedSubCat.slug)?.icon || conceptGroup.concept.icon,
// // // // // // // // // //                       shopCount: fetchedSubCat.shopCount,
// // // // // // // // // //                       concept: fetchedSubCat.concept,
// // // // // // // // // //                       subCategoryEnum: fetchedSubCat.subCategoryEnum
// // // // // // // // // //                     }));
            
// // // // // // // // // //         //   const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && activeCity;

// // // // // // // // // //         //   if (!activeCity && subcategoriesToDisplay.length === 0) return null;
          
// // // // // // // // // //         //   return (
// // // // // // // // // //         //     <section key={conceptGroup.concept.id} className="mb-12 md:mb-16">
// // // // // // // // // //         //       <div className="flex justify-between items-center mb-6">
// // // // // // // // // //         //         <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
// // // // // // // // // //         //           {conceptGroup.concept.nameEn}
// // // // // // // // // //         //           {activeCity && <span className="text-lg font-normal text-slate-500"> in {activeCity.nameEn}</span>}
// // // // // // // // // //         //         </h2>
// // // // // // // // // //         //         {activeCity && subcategoriesToDisplay.length > 0 && (
// // // // // // // // // //         //           <Button variant="outline" size="sm" onClick={() => handleExploreMoreClick(conceptGroup.concept)}>
// // // // // // // // // //         //             Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // // // // // //         //           </Button>
// // // // // // // // // //         //         )}
// // // // // // // // // //         //       </div>
              
// // // // // // // // // //         //       {isLoadingThisCarousel ? (
// // // // // // // // // //         //         <div className="h-40 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500"/></div>
// // // // // // // // // //         //       ) : subcategoriesToDisplay.length > 0 ? (
// // // // // // // // // //         //         <Carousel
// // // // // // // // // //         //           opts={{ 
// // // // // // // // // //         //             align: "start", 
// // // // // // // // // //         //             loop: subcategoriesToDisplay.length > carouselItemsToShow
// // // // // // // // // //         //           }}
// // // // // // // // // //         //           className="w-full"
// // // // // // // // // //         //         >
// // // // // // // // // //         //           <CarouselContent className="-ml-2 md:-ml-4">
// // // // // // // // // //         //             {subcategoriesToDisplay.map((subCat, index) => (
// // // // // // // // // //         //               <CarouselItem 
// // // // // // // // // //         //                 key={subCat.slug + index} 
// // // // // // // // // //         //                 className="pl-2 md:pl-4 basis-1/2 xxs:basis-1/2 xs:basis-1/3 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
// // // // // // // // // //         //               >
// // // // // // // // // //         //                 <div className="p-1 h-full">
// // // // // // // // // //         //                    <SubCategoryCarouselItem
// // // // // // // // // //         //                     // Cast to expected type if PredefinedSubCategory and SubCategoryDto have differences
// // // // // // // // // //         //                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as any).icon }} 
// // // // // // // // // //         //                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // // // // // //         //                     shopCount={(subCat as any).shopCount} 
// // // // // // // // // //         //                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // // // // // //         //                   />
// // // // // // // // // //         //                 </div>
// // // // // // // // // //         //               </CarouselItem>
// // // // // // // // // //         //             ))}
// // // // // // // // // //         //           </CarouselContent>
// // // // // // // // // //         //           {/* UPDATED: Carousel Arrows always flex, but hidden/shown by opacity via Carousel component's internal state */}
// // // // // // // // // //         //           <CarouselPrevious className="flex" /> 
// // // // // // // // // //         //           <CarouselNext className="flex" />
// // // // // // // // // //         //         </Carousel>
// // // // // // // // // //         //       ) : (
// // // // // // // // // //         //         <p className="text-slate-500 text-sm">
// // // // // // // // // //         //           {activeCity ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeCity.nameEn}.` : "Select a city or allow location access to see available services."}
// // // // // // // // // //         //         </p>
// // // // // // // // // //         //       )}
// // // // // // // // // //         //     </section>
// // // // // // // // // //         //   );
// // // // // // // // // //         // })}
// // // // // // // // // //          const isLoadingThisCarousel = isLoadingSubcategoriesForConcept(conceptGroup.concept.apiConceptFilter) && activeCity;

// // // // // // // // // //                 if (!activeCity && subcategoriesToDisplay.length === 0) return null;
                
// // // // // // // // // //                 return (
// // // // // // // // // //                   <section key={conceptGroup.concept.id} className="mb-8 sm:mb-12 md:mb-16">
// // // // // // // // // //                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
// // // // // // // // // //                       <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
// // // // // // // // // //                         {conceptGroup.concept.nameEn}
// // // // // // // // // //                         {activeCity && <span className="block sm:inline text-base sm:text-lg font-normal text-slate-500 mt-1 sm:mt-0"> in {activeCity.nameEn}</span>}
// // // // // // // // // //                       </h2>
// // // // // // // // // //                       {activeCity && subcategoriesToDisplay.length > 0 && (
// // // // // // // // // //                         <Button 
// // // // // // // // // //                           variant="outline" 
// // // // // // // // // //                           size="sm" 
// // // // // // // // // //                           onClick={() => handleExploreMoreClick(conceptGroup.concept)}
// // // // // // // // // //                           className="self-start sm:self-auto"
// // // // // // // // // //                         >
// // // // // // // // // //                           Explore All <ChevronRight className="w-4 h-4 ml-1"/>
// // // // // // // // // //                         </Button>
// // // // // // // // // //                       )}
// // // // // // // // // //                     </div>
                    
// // // // // // // // // //                     {isLoadingThisCarousel ? (
// // // // // // // // // //                       <div className="h-32 sm:h-40 flex justify-center items-center">
// // // // // // // // // //                         <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-orange-500"/>
// // // // // // // // // //                       </div>
// // // // // // // // // //                     ) : subcategoriesToDisplay.length > 0 ? (
// // // // // // // // // //                       <div className="relative">
// // // // // // // // // //                         <Carousel
// // // // // // // // // //                           opts={{ 
// // // // // // // // // //                             align: "start", 
// // // // // // // // // //                             loop: false,
// // // // // // // // // //                             dragFree: true
// // // // // // // // // //                           }}
// // // // // // // // // //                           className="w-full"
// // // // // // // // // //                         >
// // // // // // // // // //                           <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
// // // // // // // // // //                             {subcategoriesToDisplay.map((subCat, index) => (
// // // // // // // // // //                               <CarouselItem 
// // // // // // // // // //                                 key={subCat.slug + index} 
// // // // // // // // // //                                 className="pl-2 sm:pl-3 md:pl-4 basis-1/2 xs:basis-2/5 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 min-w-0"
// // // // // // // // // //                               >
// // // // // // // // // //                                 <div className="p-1 h-full">
// // // // // // // // // //                                   <SubCategoryCarouselItem
// // // // // // // // // //                                     subCategory={{ name: subCat.name, slug: subCat.slug, icon: (subCat as any).icon }} 
// // // // // // // // // //                                     onClick={() => handleSubCategoryCarouselItemClick(subCat.slug, conceptGroup.concept.conceptPageSlug)}
// // // // // // // // // //                                     shopCount={(subCat as any).shopCount} 
// // // // // // // // // //                                     isLoading={processingSubCategoryId === subCat.slug && isLoadingGeo}
// // // // // // // // // //                                   />
// // // // // // // // // //                                 </div>
// // // // // // // // // //                               </CarouselItem>
// // // // // // // // // //                             ))}
// // // // // // // // // //                           </CarouselContent>
                          
// // // // // // // // // //                           {/* Mobile-friendly carousel controls */}
// // // // // // // // // //                           <div className="flex justify-center gap-2 mt-4 sm:hidden">
// // // // // // // // // //                             <CarouselPrevious className="static translate-y-0 h-8 w-8" />
// // // // // // // // // //                             <CarouselNext className="static translate-y-0 h-8 w-8" />
// // // // // // // // // //                           </div>
                          
// // // // // // // // // //                           {/* Desktop carousel controls */}
// // // // // // // // // //                           <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-6" />
// // // // // // // // // //                           <CarouselNext className="hidden sm:flex -right-4 lg:-right-6" />
// // // // // // // // // //                         </Carousel>
// // // // // // // // // //                       </div>
// // // // // // // // // //                     ) : (
// // // // // // // // // //                       <p className="text-slate-500 text-sm">
// // // // // // // // // //                         {activeCity ? `No ${conceptGroup.concept.nameEn.toLowerCase()} currently listed for ${activeCity.nameEn}.` : "Select a city or allow location access to see available services."}
// // // // // // // // // //                       </p>
// // // // // // // // // //                     )}
// // // // // // // // // //                   </section>
// // // // // // // // // //                 );
// // // // // // // // // //               })}

// // // // // // // // // //         <section id="browse-by-city" className="mt-16 pt-8 border-t border-slate-200">
// // // // // // // // // //           <div className="text-center mb-8 md:mb-10">
// // // // // // // // // //             <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-800">
// // // // // // // // // //               Or, Choose Your City
// // // // // // // // // //             </h2>
// // // // // // // // // //             <p className="mt-2 max-w-2xl mx-auto text-md sm:text-lg text-gray-600">
// // // // // // // // // //               {activeCity ? `Currently showing for ${activeCity.nameEn}. Select another city:` : "Select a city to customize your view."}
// // // // // // // // // //             </p>
// // // // // // // // // //           </div>
          
// // // // // // // // // //           {isLoadingCities ? (
// // // // // // // // // //             <div className="text-center py-10"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" /></div>
// // // // // // // // // //           ) : citiesError ? ( 
// // // // // // // // // //             <div className="my-6 p-4 bg-red-100 text-red-600 rounded-lg shadow-sm text-center text-sm">Could not load cities: {citiesError.message}</div>
// // // // // // // // // //           ) : Array.isArray(cities) && cities.length === 0 ? (
// // // // // // // // // //              <p className="text-center text-slate-500 text-lg py-10">No cities are currently listed.</p>
// // // // // // // // // //           ) : Array.isArray(cities) && cities.length > 0 ? ( 
// // // // // // // // // //             <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
// // // // // // // // // //               {cities.map((city: CityDto) => ( 
// // // // // // // // // //                 <CityCard
// // // // // // // // // //                   key={city.id}
// // // // // // // // // //                   city={city} 
// // // // // // // // // //                   onClick={() => handleCityCardClick(city)}
// // // // // // // // // //                 />
// // // // // // // // // //               ))}
// // // // // // // // // //             </div>
// // // // // // // // // //           ): null}
// // // // // // // // // //         </section>
        
// // // // // // // // // //       </div>
// // // // // // // // // //     </div>
// // // // // // // // // //     </div>
  
// // // // // // // // // //         </div>     {/* This closes <div className="relative -mt-[40vh] md:-mt-[45vh] lg:-mt-[50vh] z-20"> (from line 337) */}

// // // // // // // // // //       </div>  
    
// // // // // // // // // //   ); // End of return statement
// // // // // // // // // // } // End of HomePage function
