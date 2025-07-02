'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FrontendShopQueryParameters } from '@/types/api';
import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext'; // UserGeoLocation not strictly used here but context is

type ShopSearchFormSubmitParams = Pick<
  FrontendShopQueryParameters,
  'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
>;

interface ShopSearchFormProps {
  onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
  initialValues: Partial<ShopSearchFormSubmitParams>; // These are the source of truth from the parent
  isLoading?: boolean;
  formInstanceId?: string;
  showDetectLocationButton?: boolean;
}

const DEFAULT_FORM_RADIUS = 500000; // Default for radius input if not otherwise specified
const DEFAULT_SORT_VALUE = 'default'; // Represents the "Default" option in the select

export default function ShopSearchForm({
    onSubmit,
    initialValues, // Parent component (e.g., ShopsPageClient) controls these based on URL/state
    isLoading: propIsLoading,
    formInstanceId = 'default-shop-search',
    showDetectLocationButton = true
}: ShopSearchFormProps) {
  const {
    // contextLocation is NOT directly used to set form fields anymore, initialValues drives that.
    // It's used by detect location.
    currentLocation: contextLocationFromHook, 
    setCurrentLocation: setContextLocation, // We might call this if form sets a location
    isLoading: isContextLoadingLocation,
    error: contextGeoError,
    clearError: clearContextGeoError,
    attemptBrowserGpsLocation
  } = useUserGeoLocation();

  // Internal form state, driven by initialValues prop
  const [mainSearchTerm, setMainSearchTerm] = useState('');
  const [filterServices, setFilterServices] = useState('');
  const [filterSortBy, setFilterSortBy] = useState(DEFAULT_SORT_VALUE);
  const [filterUserLatitude, setFilterUserLatitude] = useState('');
  const [filterUserLongitude, setFilterUserLongitude] = useState('');
  const [filterRadiusInMeters, setFilterRadiusInMeters] = useState('');

  const [isLocatingInForm, setIsLocatingInForm] = useState(false);
  const [formActionError, setFormActionError] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || isLocatingInForm;

  // CRITICAL EFFECT: Synchronize internal form state when initialValues prop changes
  useEffect(() => {
    // console.log("ShopSearchForm: initialValues received:", initialValues);
    setMainSearchTerm(initialValues.name || '');
    setFilterServices(initialValues.services || '');
    
    const latStr = initialValues.userLatitude?.toString() || '';
    const lonStr = initialValues.userLongitude?.toString() || '';
    setFilterUserLatitude(latStr);
    setFilterUserLongitude(lonStr);

    // Only set radius if lat/lon are present from initialValues
    if (latStr && lonStr) {
        setFilterRadiusInMeters((initialValues.radiusInMeters ?? DEFAULT_FORM_RADIUS).toString());
    } else {
        setFilterRadiusInMeters(DEFAULT_FORM_RADIUS.toString()); // Default if no location
    }
    
    // Handle sortBy carefully
    let newSortBy = initialValues.sortBy || DEFAULT_SORT_VALUE;
    const hasLocationInInitialValues = !!(initialValues.userLatitude && initialValues.userLongitude);
    if (newSortBy === DEFAULT_SORT_VALUE && hasLocationInInitialValues) {
        newSortBy = 'distance_asc';
    } else if (!hasLocationInInitialValues && newSortBy === 'distance_asc') {
        newSortBy = DEFAULT_SORT_VALUE;
    }
    setFilterSortBy(newSortBy);
    // console.log("ShopSearchForm: Internal state updated from initialValues:", { mainSearchTerm: initialValues.name || '', filterServices: initialValues.services || '', newSortBy, latStr, lonStr });

  }, [initialValues]); // Re-run ONLY when initialValues prop changes

  const parseNumericInput = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const parseIntegerInput = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  };
  
  // Builds submission criteria based on CURRENT internal form state
  const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
    const name = mainSearchTerm.trim() || undefined;
    const services = filterServices.trim() || undefined;
    let sortBy = filterSortBy === DEFAULT_SORT_VALUE ? undefined : filterSortBy.trim() || undefined;
    
    const lat = parseNumericInput(filterUserLatitude);
    const lon = parseNumericInput(filterUserLongitude);
    let radius = parseIntegerInput(filterRadiusInMeters);

    let userLatitude: number | undefined = undefined;
    let userLongitude: number | undefined = undefined;
    let radiusInMeters: number | undefined = undefined;

    const hasValidCoordsInForm = typeof lat === 'number' && typeof lon === 'number';

    if (hasValidCoordsInForm) {
        userLatitude = lat;
        userLongitude = lon;
        radiusInMeters = (radius === undefined || radius <= 0) ? DEFAULT_FORM_RADIUS : radius;
        if (sortBy === undefined) { // If sortBy was 'default' and we have location
            sortBy = 'distance_asc';
        }
    } else {
        // If no valid coords in form, ensure sortBy is not distance-based
        if (sortBy === 'distance_asc') {
            sortBy = undefined; // Revert to API default if location is removed but sort was distance
        }
        // Location fields remain undefined
    }
    
    return { name, services, sortBy, userLatitude, userLongitude, radiusInMeters };
  }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

  // Called by search button or enter key
  const triggerMainSubmit = useCallback(() => {
    if (effectiveIsLoading) return;
    clearContextGeoError(); // From UserGeoLocationContext
    setFormActionError(null);
    const criteria = buildSubmissionCriteria();
    // If the form submission includes location, update UserGeoLocationContext
    if (criteria.userLatitude !== undefined && criteria.userLongitude !== undefined) {
        setContextLocation({
            latitude: criteria.userLatitude,
            longitude: criteria.userLongitude,
            radiusInMeters: criteria.radiusInMeters || DEFAULT_FORM_RADIUS, // Use a sensible default if radius somehow undefined
            source: 'manual' // Source is manual input/selection from form
        }, 'manual');
    }
    onSubmit(criteria); // Calls parent's (ShopsPageClient) onSubmit
  }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, clearContextGeoError, setContextLocation]);

  const handleDetectLocationAndSubmit = useCallback(async () => {
    if (!showDetectLocationButton || effectiveIsLoading) return;

    setIsLocatingInForm(true);
    setFormActionError(null);
    clearContextGeoError();

    const detectedLocation = await attemptBrowserGpsLocation({
        targetRadius: parseIntegerInput(filterRadiusInMeters) || DEFAULT_FORM_RADIUS,
        onError: (errorMsg, errorCode) => {
            if (typeof GeolocationPositionError !== 'undefined' && errorCode === GeolocationPositionError.PERMISSION_DENIED) {
                console.warn("ShopSearchForm: User denied geolocation.");
                setFormActionError("Location access denied. Please allow or enter manually.");
            } else {
                setFormActionError(errorMsg);
            }
        }
    });
    setIsLocatingInForm(false);

    if (detectedLocation) {
        // Update internal form state with detected location
        setFilterUserLatitude(detectedLocation.latitude.toString());
        setFilterUserLongitude(detectedLocation.longitude.toString());
        setFilterRadiusInMeters((detectedLocation.radiusInMeters || DEFAULT_FORM_RADIUS).toString());
        setFilterSortBy('distance_asc'); // Default to distance sort with GPS

        // Update context immediately
        setContextLocation(detectedLocation, 'gps');

        // Submit with these new values
        onSubmit({
            name: mainSearchTerm.trim() || undefined,
            services: filterServices.trim() || undefined,
            sortBy: 'distance_asc',
            userLatitude: detectedLocation.latitude,
            userLongitude: detectedLocation.longitude,
            radiusInMeters: detectedLocation.radiusInMeters,
        });
    } else {
        // If detection failed but we didn't set an error (e.g. user cancelled), still submit with current form state
        // or just do nothing if no location. Let's submit with current form state.
        onSubmit(buildSubmissionCriteria());
    }
  }, [
      showDetectLocationButton, effectiveIsLoading, attemptBrowserGpsLocation, onSubmit, mainSearchTerm, 
      filterServices, filterRadiusInMeters, // filterSortBy removed, will be set by GPS result
      clearContextGeoError, parseIntegerInput, setContextLocation, buildSubmissionCriteria // Added buildSubmissionCriteria
    ]);

  // Called by "Apply Filters" button in Popover
  const handleApplyFiltersFromPopover = useCallback(() => {
    if (effectiveIsLoading) return;
    triggerMainSubmit(); // Uses the same logic as main search button
    setIsPopoverOpen(false);
  }, [effectiveIsLoading, triggerMainSubmit]);

  // Called by "Reset" button in Popover
  const handleClearAllFilters = useCallback(() => {
    if (effectiveIsLoading) return;
    clearContextGeoError(); 
    setFormActionError(null);

    // Reset internal form state to absolute defaults
    setMainSearchTerm(''); 
    setFilterServices(''); 
    setFilterSortBy(DEFAULT_SORT_VALUE); // Reset to 'default'
    setFilterUserLatitude(''); 
    setFilterUserLongitude(''); 
    setFilterRadiusInMeters(DEFAULT_FORM_RADIUS.toString());
    
    // Submit completely empty criteria to parent
    // This will cause parent to update URL and pass new empty initialValues back to this form
    onSubmit({ 
        name: undefined, services: undefined, sortBy: undefined, // sortBy: undefined for API default
        userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined 
    });
    setIsPopoverOpen(false);
  }, [effectiveIsLoading, onSubmit, clearContextGeoError]);

  const isGeoDataSetInForm = !!(parseNumericInput(filterUserLatitude) && parseNumericInput(filterUserLongitude));

  // Active filter count should compare internal state to what "empty" means,
  // not necessarily initialValues if initialValues can come from a previous search (URL).
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (mainSearchTerm.trim() !== '') count++;
    if (filterServices.trim() !== '') count++;
    if (filterSortBy !== DEFAULT_SORT_VALUE) count++; // Different from the "no sort preference" state
    if (filterUserLatitude.trim() !== '') count++; // Consider any lat as active
    if (filterUserLongitude.trim() !== '') count++; // Consider any lon as active
    if (isGeoDataSetInForm && filterRadiusInMeters !== DEFAULT_FORM_RADIUS.toString()) count++; // Radius different from default only if geo is set
    
    return count;
  } , [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, isGeoDataSetInForm]);

  const displayError = formActionError || (showDetectLocationButton && contextGeoError);

  return (
    // ... JSX remains largely the same, ensure all controlled inputs use the internal form states ...
    // Example for SortBy Select:
    // <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} ...>
    // Make sure all inputs (mainSearchTerm, filterServices, lat, lon, radius) are correctly bound
    // to their respective state variables and setters.
    <div className="flex items-stretch gap-0 w-full p-1">
      <div className="relative flex-1">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button" variant="ghost" size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 z-10 text-white hover:text-white rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/40 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={effectiveIsLoading} 
              aria-label="Open filters"
            >
              <FilterIcon className="h-5 w-5 drop-shadow-lg" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold ring-2 ring-white/30 shadow-lg animate-pulse">
                  {activeFilterCount > 9 ? '9+' : activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 sm:w-96 p-0 bg-black/20 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/40 rounded-xl mt-2">
            <div className="p-4 sm:p-5">
              <div className="mb-4 space-y-0.5">
                <h4 className="font-semibold text-lg text-white drop-shadow-sm">
                  Filters & Sort Options
                </h4>
                <p className="text-sm text-white/80">Customize your search results.</p>
              </div>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-white/90">
                    Services Offered (keywords)
                  </Label>
                  <Input 
                    id={`${formInstanceId}-filterServices`} 
                    placeholder="e.g., Oil Change, Brakes" 
                    value={filterServices} 
                    onChange={(e) => setFilterServices(e.target.value)} 
                    disabled={effectiveIsLoading} 
                    className="h-10 text-sm bg-black/30 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400/50 focus:ring-emerald-400/30 shadow-lg hover:bg-black/40 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-white/90">
                    Sort By
                  </Label>
                  <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
                    <SelectTrigger 
                      className="h-10 text-sm bg-black/30 backdrop-blur-md border border-white/20 text-white hover:bg-black/40 hover:border-white/30 focus:border-emerald-400/50 focus:ring-emerald-400/30 shadow-lg transition-all duration-200" 
                      id={`${formInstanceId}-filterSortBy`}
                    >
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/40 backdrop-blur-xl border border-white/20 text-white">
                        <SelectItem value="default" className="hover:!bg-white/10 focus:!bg-white/10"> {/* Added !important to override potential shadcn hover */}
                          Default (Best Match)
                        </SelectItem>
                        <SelectItem value="name_asc" className="hover:!bg-white/10 focus:!bg-white/10">
                          Name (A-Z)
                        </SelectItem>
                        <SelectItem value="name_desc" className="hover:!bg-white/10 focus:!bg-white/10">
                          Name (Z-A)
                        </SelectItem>
                        {/* Only show distance sort if location data is available in the form from a previous user action or context */}
                        {(isGeoDataSetInForm || (contextLocationFromHook && contextLocationFromHook.source !== 'initial_default')) && (
                            <SelectItem value="distance_asc" className="hover:!bg-white/10 focus:!bg-white/10">
                              Distance (Nearest)
                            </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 pt-3 border-t border-white/20">
                    <Label className="text-xs font-medium text-white/90 block">
                      Filter by Location (Optional)
                    </Label>
                    {displayError && (
                      <p className="text-xs text-red-400 px-1 pt-1 drop-shadow-sm">
                        {displayError}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Input 
                          id={`${formInstanceId}-lat`} 
                          type="number" 
                          placeholder="Latitude" 
                          value={filterUserLatitude} 
                          onChange={e => { setFilterUserLatitude(e.target.value); setFormActionError(null); clearContextGeoError(); }} 
                          disabled={effectiveIsLoading} 
                          step="any" 
                          className="h-10 text-sm bg-black/30 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400/50 focus:ring-emerald-400/30 shadow-lg hover:bg-black/40 transition-all duration-200"
                        />
                        <Input 
                          id={`${formInstanceId}-lon`} 
                          type="number" 
                          placeholder="Longitude" 
                          value={filterUserLongitude} 
                          onChange={e => { setFilterUserLongitude(e.target.value); setFormActionError(null); clearContextGeoError(); }} 
                          disabled={effectiveIsLoading} 
                          step="any" 
                          className="h-10 text-sm bg-black/30 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400/50 focus:ring-emerald-400/30 shadow-lg hover:bg-black/40 transition-all duration-200"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-white/90">
                          Search Radius (meters)
                        </Label>
                        <Input 
                          id={`${formInstanceId}-filterRadius`} 
                          type="number" 
                          placeholder={`e.g., ${DEFAULT_FORM_RADIUS/1000}km`} 
                          value={filterRadiusInMeters} 
                          onChange={e => setFilterRadiusInMeters(e.target.value)} 
                          disabled={effectiveIsLoading || !isGeoDataSetInForm} 
                          className="h-10 text-sm bg-black/30 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:border-emerald-400/50 focus:ring-emerald-400/30 shadow-lg hover:bg-black/40 transition-all duration-200 disabled:opacity-50" 
                          min="100" 
                          step="100"
                        />
                        {!isGeoDataSetInForm && (
                          <p className="text-xs text-white/60 mt-1">
                            Enter latitude & longitude to enable radius filter.
                          </p>
                        )}
                    </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/20">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleClearAllFilters} 
                  disabled={effectiveIsLoading} 
                  size="sm" 
                  className="text-xs text-white hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 shadow-lg transition-all duration-300"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 
                  Reset
                </Button>
                <Button 
                  type="button" 
                  onClick={handleApplyFiltersFromPopover} 
                  disabled={effectiveIsLoading} 
                  size="sm" 
                  className="bg-emerald-500/80 hover:bg-emerald-500/90 text-white px-4 py-2 font-medium shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 border border-emerald-400/30 hover:border-emerald-400/50 backdrop-blur-md transition-all duration-300"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          id={`${formInstanceId}-mainSearchInput`}
          type="text" 
          placeholder="Search by shop name or service..." 
          value={mainSearchTerm} 
          onChange={(e) => { setMainSearchTerm(e.target.value); setFormActionError(null); clearContextGeoError(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
          className={`pl-14 h-14 text-sm sm:text-base w-full rounded-l-2xl rounded-r-none bg-black/40 backdrop-blur-lg border border-white/30 border-r-0 text-white placeholder:text-white/70 hover:bg-black/50 hover:border-white/50 hover:border-r-0 focus:bg-black/50 focus:border-emerald-400/50 focus:ring-emerald-400/30 focus:border-r-0 shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${showDetectLocationButton ? 'pr-28 sm:pr-16' : 'pr-20 sm:pr-12'}`} // Adjusted padding for buttons
          disabled={effectiveIsLoading}
        />
        
        {showDetectLocationButton && (
            <Button
              type="button" variant="ghost" size="icon"
              className="absolute right-14 sm:right-12 top-1/2 -translate-y-1/2 h-10 w-10 z-10 text-white hover:text-white rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/40 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" // Moved left slightly
              onClick={handleDetectLocationAndSubmit} 
              disabled={effectiveIsLoading} 
              aria-label="Use current location"
            >
              {isLocatingInForm || (isContextLoadingLocation && !propIsLoading) ? 
                <Loader2 className="h-5 w-5 animate-spin text-emerald-300 drop-shadow-lg" /> : 
                <LocateFixed className="h-5 w-5 drop-shadow-lg" />
              }
            </Button>
        )}
      </div>

      <Button 
        type="button" 
        onClick={triggerMainSubmit} 
        disabled={effectiveIsLoading}
        size="icon"
        className="h-14 w-14 rounded-l-none rounded-r-2xl bg-black/40 hover:bg-black/50 text-white shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40 border border-white/30 hover:border-white/50 border-l-0 backdrop-blur-lg transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed active:bg-black/60 active:scale-95"
      >
        {effectiveIsLoading && !isLocatingInForm ? 
          <Loader2 className="h-5 w-5 animate-spin drop-shadow-lg" /> : 
          <Search className="h-5 w-5 drop-shadow-lg" />
        }
      </Button>
    </div>
  );
}
// // src/components/search/ShopSearchForm.tsx
// 'use client';

// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { FrontendShopQueryParameters } from '@/types/api';
// import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext';

// type ShopSearchFormSubmitParams = Pick<
//   FrontendShopQueryParameters,
//   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// >;

// interface ShopSearchFormProps {
//   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
//   initialValues: Partial<ShopSearchFormSubmitParams>;
//   isLoading?: boolean;
//   formInstanceId?: string;
//   showDetectLocationButton?: boolean;
// }

// const DEFAULT_FORM_RADIUS = 500000;

// export default function ShopSearchForm({
//     onSubmit,
//     initialValues,
//     isLoading: propIsLoading,
//     formInstanceId = 'default-shop-search',
//     showDetectLocationButton = true
// }: ShopSearchFormProps) {
//   const {
//     currentLocation: contextLocation,
//     setCurrentLocation: setContextLocation,
//     isLoading: isContextLoadingLocation,
//     error: contextGeoError,
//     clearError: clearContextGeoError,
//     attemptBrowserGpsLocation
//   } = useUserGeoLocation();

//   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
//   const [filterServices, setFilterServices] = useState(initialValues.services || '');
//   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
//   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(initialValues.userLatitude?.toString() || '');
//   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(initialValues.userLongitude?.toString() || '');
//   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>(
//     (initialValues.radiusInMeters ?? DEFAULT_FORM_RADIUS).toString()
//   );

//   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
//   const [formActionError, setFormActionError] = useState<string | null>(null);
//   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

//   const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || isLocatingInForm;

//   // Effect to initialize form fields from initialValues and contextLocation
//   useEffect(() => {
//     const initLat = initialValues.userLatitude ?? contextLocation?.latitude;
//     const initLon = initialValues.userLongitude ?? contextLocation?.longitude;
//     const initRadius = initialValues.radiusInMeters ?? contextLocation?.radiusInMeters ?? DEFAULT_FORM_RADIUS;
//     let initSort = initialValues.sortBy || 'default';

//     setMainSearchTerm(initialValues.name || '');
//     setFilterServices(initialValues.services || '');
//     setFilterUserLatitude(initLat?.toString() || '');
//     setFilterUserLongitude(initLon?.toString() || '');
//     setFilterRadiusInMeters(initRadius.toString());

//     const hasLocationData = typeof initLat === 'number' && typeof initLon === 'number';
//     if (initSort === 'default' && hasLocationData) {
//       initSort = 'distance_asc';
//     } else if (!hasLocationData && initSort === 'distance_asc') {
//       initSort = 'default';
//     }
//     setFilterSortBy(initSort);

//   }, [initialValues, contextLocation]);

//   const parseNumericInput = (value: string): number | undefined => {
//     if (value.trim() === '') return undefined;
//     const parsed = parseFloat(value);
//     return isNaN(parsed) ? undefined : parsed;
//   };

//   const parseIntegerInput = (value: string): number | undefined => {
//     if (value.trim() === '') return undefined;
//     const parsed = parseInt(value, 10);
//     return isNaN(parsed) ? undefined : parsed;
//   };

//   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
//     const lat = parseNumericInput(filterUserLatitude);
//     const lon = parseNumericInput(filterUserLongitude);
//     let radius = parseIntegerInput(filterRadiusInMeters);
//     let effectiveSortBy = filterSortBy;

//     const hasValidCoords = typeof lat === 'number' && typeof lon === 'number';

//     if (!hasValidCoords) {
//         radius = undefined;
//         if (effectiveSortBy === 'distance_asc') {
//             effectiveSortBy = 'default';
//         }
//     } else {
//         if (radius === undefined || radius <=0) radius = DEFAULT_FORM_RADIUS;
//         if (effectiveSortBy === 'default') {
//             effectiveSortBy = 'distance_asc';
//         }
//     }
    
//     return {
//       name: mainSearchTerm.trim() || undefined,
//       services: filterServices.trim() || undefined,
//       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
//       userLatitude: hasValidCoords ? lat : undefined,
//       userLongitude: hasValidCoords ? lon : undefined,
//       radiusInMeters: hasValidCoords ? radius : undefined,
//     };
//   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

//   const triggerMainSubmit = useCallback(() => {
//     if (effectiveIsLoading) return;
//     clearContextGeoError();
//     setFormActionError(null);
//     const criteria = buildSubmissionCriteria();
//     if (criteria.userLatitude && criteria.userLongitude) {
//         setContextLocation({
//             latitude: criteria.userLatitude,
//             longitude: criteria.userLongitude,
//             radiusInMeters: criteria.radiusInMeters || DEFAULT_FORM_RADIUS,
//             source: 'manual'
//         }, 'manual');
//     }
//     onSubmit(criteria);
//   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, clearContextGeoError, setContextLocation]);

//   const handleDetectLocationAndSubmit = useCallback(async () => {
//     if (!showDetectLocationButton || effectiveIsLoading) return;

//     setIsLocatingInForm(true);
//     setFormActionError(null);
//     clearContextGeoError();

//     const detectedLocation = await attemptBrowserGpsLocation({
//         targetRadius: parseIntegerInput(filterRadiusInMeters) || DEFAULT_FORM_RADIUS,
//         onError: (errorMsg, errorCode) => {
//             if (errorCode === GeolocationPositionError.PERMISSION_DENIED) {
//                 console.warn("ShopSearchForm: User denied geolocation from detect button.");
//                 setFormActionError("Location access denied. Please allow or enter manually.");
//             } else {
//                 setFormActionError(errorMsg);
//             }
//         }
//     });

//     setIsLocatingInForm(false);

//     const submissionCriteria: ShopSearchFormSubmitParams = {
//         name: mainSearchTerm.trim() || undefined,
//         services: filterServices.trim() || undefined,
//         sortBy: detectedLocation ? 'distance_asc' : filterSortBy,
//         userLatitude: detectedLocation?.latitude,
//         userLongitude: detectedLocation?.longitude,
//         radiusInMeters: detectedLocation?.radiusInMeters
//     };
    
//     if (detectedLocation) {
//         setFilterUserLatitude(detectedLocation.latitude.toString());
//         setFilterUserLongitude(detectedLocation.longitude.toString());
//         setFilterRadiusInMeters((detectedLocation.radiusInMeters || DEFAULT_FORM_RADIUS).toString());
//         setFilterSortBy('distance_asc');
//     }

//     onSubmit(submissionCriteria);

//   }, [
//       showDetectLocationButton, effectiveIsLoading, attemptBrowserGpsLocation, onSubmit, mainSearchTerm, 
//       filterServices, filterRadiusInMeters, filterSortBy, clearContextGeoError, parseIntegerInput
//     ]);

//   const handleApplyFiltersFromPopover = useCallback(() => {
//     if (effectiveIsLoading) return;
//     clearContextGeoError();
//     setFormActionError(null);
//     const criteria = buildSubmissionCriteria();

//     if (criteria.userLatitude && criteria.userLongitude) {
//         setContextLocation({
//             latitude: criteria.userLatitude,
//             longitude: criteria.userLongitude,
//             radiusInMeters: criteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_FORM_RADIUS,
//             timestamp: Date.now(),
//             source: 'manual'
//         }, 'manual');
//     }
//     onSubmit(criteria);
//     setIsPopoverOpen(false);
//   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation, clearContextGeoError]);

//   const handleClearAllFilters = useCallback(() => {
//     if (effectiveIsLoading) return;
//     clearContextGeoError(); 
//     setFormActionError(null);

//     setMainSearchTerm(''); 
//     setFilterServices(''); 
//     setFilterSortBy('default');
//     setFilterUserLatitude(''); 
//     setFilterUserLongitude(''); 
//     setFilterRadiusInMeters(DEFAULT_FORM_RADIUS.toString());
    
//     onSubmit({ 
//         name: undefined, services: undefined, sortBy: undefined, 
//         userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined 
//     });
//     setIsPopoverOpen(false);
//   }, [effectiveIsLoading, onSubmit, clearContextGeoError]);

//   const isGeoDataSetInForm = !!(parseNumericInput(filterUserLatitude) && parseNumericInput(filterUserLongitude));

//   const activeFilterCount = useMemo(() => {
//     let count = 0;
//     if (mainSearchTerm.trim() !== (initialValues.name || '')) count++;
//     if (filterServices.trim() !== (initialValues.services || '')) count++;
    
//     const initialSort = initialValues.sortBy || 'default';
//     if (filterSortBy !== initialSort) count++;
    
//     const initLatStr = initialValues.userLatitude?.toString() || '';
//     const initLonStr = initialValues.userLongitude?.toString() || '';
//     const initRadiusStr = (initialValues.radiusInMeters ?? DEFAULT_FORM_RADIUS).toString();

//     if (filterUserLatitude !== initLatStr) count++;
//     if (filterUserLongitude !== initLonStr) count++;
//     if (isGeoDataSetInForm && filterRadiusInMeters !== initRadiusStr) count++;
    
//     return count;
//   } , [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

//   const displayError = formActionError || (showDetectLocationButton && contextGeoError);

//   return (
//     <div className="flex items-stretch gap-0 w-full p-1">
//       <div className="relative flex-1">
//         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
//           <PopoverTrigger asChild>
//             <Button
//               type="button" variant="ghost" size="icon"
//               className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 z-10 
//                          text-white hover:text-white rounded-full
//                          bg-white/10 hover:bg-white/20 
//                          backdrop-blur-xl border border-white/20 hover:border-white/40
//                          shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30
//                          transition-all duration-300 ease-in-out
//                          disabled:opacity-50 disabled:cursor-not-allowed"
//               disabled={effectiveIsLoading} 
//               aria-label="Open filters"
//             >
//               <FilterIcon className="h-5 w-5 drop-shadow-lg" />
//               {activeFilterCount > 0 && (
//                 <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center 
//                                rounded-full bg-emerald-500/90 backdrop-blur-sm
//                                text-white text-[10px] font-bold 
//                                ring-2 ring-white/30 shadow-lg
//                                animate-pulse">
//                   {activeFilterCount > 9 ? '9+' : activeFilterCount}
//                 </span>
//               )}
//             </Button>
//           </PopoverTrigger>
//           <PopoverContent className="w-80 sm:w-96 p-0 
//                                      bg-black/20 backdrop-blur-xl 
//                                      border border-white/20 
//                                      shadow-2xl shadow-black/40 
//                                      rounded-xl mt-2">
//             <div className="p-4 sm:p-5">
//               <div className="mb-4 space-y-0.5">
//                 <h4 className="font-semibold text-lg text-white drop-shadow-sm">
//                   Filters & Sort Options
//                 </h4>
//                 <p className="text-sm text-white/80">Customize your search results.</p>
//               </div>
//               <div className="grid gap-4">
//                 <div className="space-y-1.5">
//                   <Label htmlFor={`${formInstanceId}-filterServices`} 
//                          className="text-xs font-medium text-white/90">
//                     Services Offered (keywords)
//                   </Label>
//                   <Input 
//                     id={`${formInstanceId}-filterServices`} 
//                     placeholder="e.g., Oil Change, Brakes" 
//                     value={filterServices} 
//                     onChange={(e) => setFilterServices(e.target.value)} 
//                     disabled={effectiveIsLoading} 
//                     className="h-10 text-sm 
//                                bg-black/30 backdrop-blur-md border border-white/20
//                                text-white placeholder:text-white/60
//                                focus:border-emerald-400/50 focus:ring-emerald-400/30
//                                shadow-lg hover:bg-black/40
//                                transition-all duration-200"
//                   />
//                 </div>
//                 <div className="space-y-1.5">
//                   <Label htmlFor={`${formInstanceId}-filterSortBy`} 
//                          className="text-xs font-medium text-white/90">
//                     Sort By
//                   </Label>
//                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
//                     <SelectTrigger 
//                       className="h-10 text-sm 
//                                  bg-black/30 backdrop-blur-md border border-white/20
//                                  text-white hover:bg-black/40 hover:border-white/30
//                                  focus:border-emerald-400/50 focus:ring-emerald-400/30
//                                  shadow-lg transition-all duration-200" 
//                       id={`${formInstanceId}-filterSortBy`}
//                     >
//                       <SelectValue placeholder="Default" />
//                     </SelectTrigger>
//                     <SelectContent className="bg-black/40 backdrop-blur-xl border border-white/20 text-white">
//                         <SelectItem value="default" className="hover:bg-white/10 focus:bg-white/10">
//                           Default (Best Match / Name)
//                         </SelectItem>
//                         <SelectItem value="name_asc" className="hover:bg-white/10 focus:bg-white/10">
//                           Name (A-Z)
//                         </SelectItem>
//                         <SelectItem value="name_desc" className="hover:bg-white/10 focus:bg-white/10">
//                           Name (Z-A)
//                         </SelectItem>
//                         {isGeoDataSetInForm && (
//                             <SelectItem value="distance_asc" className="hover:bg-white/10 focus:bg-white/10">
//                               Distance (Nearest)
//                             </SelectItem>
//                         )}
//                     </SelectContent>
//                   </Select>
//                 </div>
//                 <div className="space-y-2 pt-3 border-t border-white/20">
//                     <Label className="text-xs font-medium text-white/90 block">
//                       Filter by Location (Optional)
//                     </Label>
//                     {displayError && (
//                       <p className="text-xs text-red-400 px-1 pt-1 drop-shadow-sm">
//                         {displayError}
//                       </p>
//                     )}
//                     <div className="grid grid-cols-2 gap-3">
//                         <Input 
//                           id={`${formInstanceId}-lat`} 
//                           type="number" 
//                           placeholder="Latitude" 
//                           value={filterUserLatitude} 
//                           onChange={e => {
//                             setFilterUserLatitude(e.target.value); 
//                             setFormActionError(null); 
//                             clearContextGeoError();
//                           }} 
//                           disabled={effectiveIsLoading} 
//                           step="any" 
//                           className="h-10 text-sm 
//                                      bg-black/30 backdrop-blur-md border border-white/20
//                                      text-white placeholder:text-white/60
//                                      focus:border-emerald-400/50 focus:ring-emerald-400/30
//                                      shadow-lg hover:bg-black/40
//                                      transition-all duration-200"
//                         />
//                         <Input 
//                           id={`${formInstanceId}-lon`} 
//                           type="number" 
//                           placeholder="Longitude" 
//                           value={filterUserLongitude} 
//                           onChange={e => {
//                             setFilterUserLongitude(e.target.value); 
//                             setFormActionError(null); 
//                             clearContextGeoError();
//                           }} 
//                           disabled={effectiveIsLoading} 
//                           step="any" 
//                           className="h-10 text-sm 
//                                      bg-black/30 backdrop-blur-md border border-white/20
//                                      text-white placeholder:text-white/60
//                                      focus:border-emerald-400/50 focus:ring-emerald-400/30
//                                      shadow-lg hover:bg-black/40
//                                      transition-all duration-200"
//                         />
//                     </div>
//                     <div className="space-y-1.5">
//                         <Label htmlFor={`${formInstanceId}-filterRadius`} 
//                                className="text-xs font-medium text-white/90">
//                           Search Radius (meters)
//                         </Label>
//                         <Input 
//                           id={`${formInstanceId}-filterRadius`} 
//                           type="number" 
//                           placeholder={`e.g., ${DEFAULT_FORM_RADIUS/1000}km`} 
//                           value={filterRadiusInMeters} 
//                           onChange={e => setFilterRadiusInMeters(e.target.value)} 
//                           disabled={effectiveIsLoading || !isGeoDataSetInForm} 
//                           className="h-10 text-sm 
//                                      bg-black/30 backdrop-blur-md border border-white/20
//                                      text-white placeholder:text-white/60
//                                      focus:border-emerald-400/50 focus:ring-emerald-400/30
//                                      shadow-lg hover:bg-black/40
//                                      transition-all duration-200
//                                      disabled:opacity-50" 
//                           min="100" 
//                           step="100"
//                         />
//                         {!isGeoDataSetInForm && (
//                           <p className="text-xs text-white/60 mt-1">
//                             Enter latitude & longitude to enable radius filter.
//                           </p>
//                         )}
//                     </div>
//                 </div>
//               </div>
//               <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/20">
//                 <Button 
//                   type="button" 
//                   variant="ghost" 
//                   onClick={handleClearAllFilters} 
//                   disabled={effectiveIsLoading} 
//                   size="sm" 
//                   className="text-xs text-white hover:text-white
//                              bg-white/10 hover:bg-white/20
//                              backdrop-blur-md border border-white/20 hover:border-white/40
//                              shadow-lg transition-all duration-300"
//                 >
//                   <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 
//                   Reset
//                 </Button>
//                 <Button 
//                   type="button" 
//                   onClick={handleApplyFiltersFromPopover} 
//                   disabled={effectiveIsLoading} 
//                   size="sm" 
//                   className="bg-emerald-500/80 hover:bg-emerald-500/90 
//                              text-white px-4 py-2 font-medium
//                              shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30
//                              border border-emerald-400/30 hover:border-emerald-400/50
//                              backdrop-blur-md transition-all duration-300"
//                 >
//                   Apply Filters
//                 </Button>
//               </div>
//             </div>
//           </PopoverContent>
//         </Popover>

//         <Input
//           id={`${formInstanceId}-mainSearchInput`}
//           type="text" 
//           placeholder="Search by shop name or service..." 
//           value={mainSearchTerm} 
//           onChange={(e) => {
//             setMainSearchTerm(e.target.value); 
//             setFormActionError(null); 
//             clearContextGeoError();
//           }}
//           onKeyDown={(e) => { 
//             if (e.key === 'Enter') { 
//               e.preventDefault(); 
//               triggerMainSubmit(); 
//             }
//           }}
//           className={`pl-14 h-14 text-sm sm:text-base w-full rounded-l-2xl rounded-r-none
//                      bg-black/40 backdrop-blur-lg border border-white/30 border-r-0
//                      text-white placeholder:text-white/70
//                      hover:bg-black/50 hover:border-white/50 hover:border-r-0
//                      focus:bg-black/50 focus:border-emerald-400/50 focus:ring-emerald-400/30 focus:border-r-0
//                      shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40
//                      transition-all duration-300 ease-in-out
//                      disabled:opacity-50 disabled:cursor-not-allowed ${showDetectLocationButton ? 'pr-28' : 'pr-20'}`}
//           disabled={effectiveIsLoading}
//         />
        
//         {showDetectLocationButton && (
//             <Button
//               type="button" variant="ghost" size="icon"
//               className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 z-10 
//                          text-white hover:text-white rounded-full
//                          bg-white/10 hover:bg-white/20 
//                          backdrop-blur-xl border border-white/20 hover:border-white/40
//                          shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30
//                          transition-all duration-300 ease-in-out
//                          disabled:opacity-50 disabled:cursor-not-allowed"
//               onClick={handleDetectLocationAndSubmit} 
//               disabled={effectiveIsLoading} 
//               aria-label="Use current location"
//             >
//               {isLocatingInForm || (isContextLoadingLocation && !propIsLoading) ? 
//                 <Loader2 className="h-5 w-5 animate-spin text-emerald-300 drop-shadow-lg" /> : 
//                 <LocateFixed className="h-5 w-5 drop-shadow-lg" />
//               }
//             </Button>
//         )}
//       </div>

//       <Button 
//         type="button" 
//         onClick={triggerMainSubmit} 
//         disabled={effectiveIsLoading}
//         size="icon"
//         className="h-14 w-14 rounded-l-none rounded-r-2xl
//                    bg-black/40 hover:bg-black/50 
//                    text-white shadow-xl shadow-black/30 
//                    hover:shadow-2xl hover:shadow-black/40
//                    border border-white/30 hover:border-white/50 border-l-0
//                    backdrop-blur-lg transition-all duration-300 ease-in-out
//                    focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-transparent
//                    disabled:opacity-50 disabled:cursor-not-allowed
//                    active:bg-black/60 active:scale-95"
//       >
//         {effectiveIsLoading && !isLocatingInForm ? 
//           <Loader2 className="h-5 w-5 animate-spin drop-shadow-lg" /> : 
//           <Search className="h-5 w-5 drop-shadow-lg" />
//         }
//       </Button>
//     </div>
//   );
// }
// // // src/components/search/ShopSearchForm.tsx
// // 'use client';

// // import React, { useState, useEffect, useCallback, useMemo } from 'react';
// // import { Input } from "@/components/ui/input";
// // import { Button } from "@/components/ui/button";
// // import { Label } from "@/components/ui/label";
// // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // import { FrontendShopQueryParameters } from '@/types/api';
// // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // import { useUserGeoLocation, UserGeoLocation } from '@/contexts/UserGeoLocationContext'; // UPDATED IMPORT

// // type ShopSearchFormSubmitParams = Pick<
// //   FrontendShopQueryParameters,
// //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // >;

// // interface ShopSearchFormProps {
// //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// //   initialValues: Partial<ShopSearchFormSubmitParams>;
// //   isLoading?: boolean; // Loading state controlled by parent (e.g., page processing submit)
// //   formInstanceId?: string;
// //   showDetectLocationButton?: boolean;
// // }

// // const DEFAULT_FORM_RADIUS = 500000; // Default radius for form if not set

// // export default function ShopSearchForm({
// //     onSubmit,
// //     initialValues,
// //     isLoading: propIsLoading,
// //     formInstanceId = 'default-shop-search',
// //     showDetectLocationButton = true
// // }: ShopSearchFormProps) {
// //   const {
// //     currentLocation: contextLocation,      // UPDATED: from currentUserLocation
// //     setCurrentLocation: setContextLocation,  // UPDATED: from setCurrentUserLocation
// //     isLoading: isContextLoadingLocation,   // This is combined (GPS + initial pref load)
// //     error: contextGeoError,               // RENAMED
// //     clearError: clearContextGeoError,         // RENAMED
// //     attemptBrowserGpsLocation           // UPDATED: from attemptBrowserLocation
// //   } = useUserGeoLocation();

// //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default'); // 'default' can mean API default or 'name_asc'
// //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(initialValues.userLatitude?.toString() || '');
// //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(initialValues.userLongitude?.toString() || '');
// //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>(
// //     (initialValues.radiusInMeters ?? DEFAULT_FORM_RADIUS).toString()
// //   );

// //   const [isLocatingInForm, setIsLocatingInForm] = useState(false); // Specific to this form's "detect location" button
// //   const [formActionError, setFormActionError] = useState<string | null>(null); // Errors specific to form actions
// //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// //   // Overall loading state for disabling form elements
// //   const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || isLocatingInForm;

// //   // Effect to initialize form fields from initialValues and contextLocation
// //   useEffect(() => {
// //     // Prioritize initialValues from props, then contextLocation, then defaults
// //     const initLat = initialValues.userLatitude ?? contextLocation?.latitude;
// //     const initLon = initialValues.userLongitude ?? contextLocation?.longitude;
// //     const initRadius = initialValues.radiusInMeters ?? contextLocation?.radiusInMeters ?? DEFAULT_FORM_RADIUS;
// //     let initSort = initialValues.sortBy || 'default';

// //     setMainSearchTerm(initialValues.name || '');
// //     setFilterServices(initialValues.services || '');
// //     setFilterUserLatitude(initLat?.toString() || '');
// //     setFilterUserLongitude(initLon?.toString() || '');
// //     setFilterRadiusInMeters(initRadius.toString());

// //     const hasLocationData = typeof initLat === 'number' && typeof initLon === 'number';
// //     if (initSort === 'default' && hasLocationData) {
// //       initSort = 'distance_asc';
// //     } else if (!hasLocationData && initSort === 'distance_asc') {
// //       initSort = 'default'; // Or 'name_asc' if that's preferred default without location
// //     }
// //     setFilterSortBy(initSort);

// //   }, [initialValues, contextLocation]); // Re-run if initialValues or contextLocation changes

// //   const parseNumericInput = (value: string): number | undefined => {
// //     if (value.trim() === '') return undefined;
// //     const parsed = parseFloat(value);
// //     return isNaN(parsed) ? undefined : parsed;
// //   };

// //   const parseIntegerInput = (value: string): number | undefined => {
// //     if (value.trim() === '') return undefined;
// //     const parsed = parseInt(value, 10);
// //     return isNaN(parsed) ? undefined : parsed;
// //   };

// //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// //     const lat = parseNumericInput(filterUserLatitude);
// //     const lon = parseNumericInput(filterUserLongitude);
// //     let radius = parseIntegerInput(filterRadiusInMeters);
// //     let effectiveSortBy = filterSortBy;

// //     const hasValidCoords = typeof lat === 'number' && typeof lon === 'number';

// //     if (!hasValidCoords) { // If no valid coords, radius is irrelevant
// //         radius = undefined;
// //         if (effectiveSortBy === 'distance_asc') {
// //             effectiveSortBy = 'default'; // Or 'name_asc'
// //         }
// //     } else {
// //         if (radius === undefined || radius <=0) radius = DEFAULT_FORM_RADIUS; // Ensure valid radius if coords are present
// //         if (effectiveSortBy === 'default') {
// //             effectiveSortBy = 'distance_asc';
// //         }
// //     }
    
// //     return {
// //       name: mainSearchTerm.trim() || undefined,
// //       services: filterServices.trim() || undefined,
// //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// //       userLatitude: hasValidCoords ? lat : undefined,
// //       userLongitude: hasValidCoords ? lon : undefined,
// //       radiusInMeters: hasValidCoords ? radius : undefined,
// //     };
// //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// //   const triggerMainSubmit = useCallback(() => {
// //     if (effectiveIsLoading) return;
// //     clearContextGeoError();
// //     setFormActionError(null);
// //     const criteria = buildSubmissionCriteria();
// //     // Update context location if form values are being used for search
// //     if (criteria.userLatitude && criteria.userLongitude) {
// //         setContextLocation({
// //             latitude: criteria.userLatitude,
// //             longitude: criteria.userLongitude,
// //             radiusInMeters: criteria.radiusInMeters || DEFAULT_FORM_RADIUS,
// //             source: 'manual' // From form input, not direct GPS
// //         }, 'manual');
// //     }
// //     onSubmit(criteria);
// //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, clearContextGeoError, setContextLocation]);

// //   const handleDetectLocationAndSubmit = useCallback(async () => {
// //     if (!showDetectLocationButton || effectiveIsLoading) return;

// //     setIsLocatingInForm(true);
// //     setFormActionError(null);
// //     clearContextGeoError();

// //     const detectedLocation = await attemptBrowserGpsLocation({ // attemptBrowserGpsLocation from new context
// //         targetRadius: parseIntegerInput(filterRadiusInMeters) || DEFAULT_FORM_RADIUS,
// //         onError: (errorMsg, errorCode) => {
// //             if (errorCode === GeolocationPositionError.PERMISSION_DENIED) {
// //                 console.warn("ShopSearchForm: User denied geolocation from detect button.");
// //                 // Optionally inform user they need to allow or can input manually
// //                 setFormActionError("Location access denied. Please allow or enter manually.");
// //             } else {
// //                 setFormActionError(errorMsg);
// //             }
// //         }
// //     });

// //     setIsLocatingInForm(false);

// //     // `detectedLocation` is now UserGeoLocation | null
// //     // `setCurrentLocation` in the context already saved it if anonymous.
// //     // Now, submit the form with these detected values.
// //     const submissionCriteria: ShopSearchFormSubmitParams = {
// //         name: mainSearchTerm.trim() || undefined,
// //         services: filterServices.trim() || undefined,
// //         sortBy: detectedLocation ? 'distance_asc' : filterSortBy, // Default to distance if location detected
// //         userLatitude: detectedLocation?.latitude,
// //         userLongitude: detectedLocation?.longitude,
// //         radiusInMeters: detectedLocation?.radiusInMeters
// //     };
    
// //     // Update form fields to reflect detected location
// //     if (detectedLocation) {
// //         setFilterUserLatitude(detectedLocation.latitude.toString());
// //         setFilterUserLongitude(detectedLocation.longitude.toString());
// //         setFilterRadiusInMeters((detectedLocation.radiusInMeters || DEFAULT_FORM_RADIUS).toString());
// //         setFilterSortBy('distance_asc');
// //     }

// //     onSubmit(submissionCriteria);

// //   }, [
// //       showDetectLocationButton, effectiveIsLoading, attemptBrowserGpsLocation, onSubmit, mainSearchTerm, 
// //       filterServices, filterRadiusInMeters, filterSortBy, clearContextGeoError, parseIntegerInput
// //     ]);

// //   const handleApplyFiltersFromPopover = useCallback(() => {
// //     if (effectiveIsLoading) return;
// //     clearContextGeoError();
// //     setFormActionError(null);
// //     const criteria = buildSubmissionCriteria();

// //     if (criteria.userLatitude && criteria.userLongitude) {
// //         setContextLocation({
// //             latitude: criteria.userLatitude,
// //             longitude: criteria.userLongitude,
// //             radiusInMeters: criteria.radiusInMeters || contextLocation?.radiusInMeters || DEFAULT_FORM_RADIUS,
// //             timestamp: Date.now(),
// //             source: 'manual' // From form input
// //         }, 'manual');
// //     } else if (!criteria.userLatitude && !criteria.userLongitude && contextLocation) {
// //         // If user cleared location fields in form, clear from context too or handle as per UX decision
// //         // For now, if form is submitted without location, but context has one, the onSubmit might still use context.
// //         // This logic primarily updates context IF form provides location.
// //     }
// //     onSubmit(criteria);
// //     setIsPopoverOpen(false);
// //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation, clearContextGeoError]);

// //   const handleClearAllFilters = useCallback(() => {
// //     if (effectiveIsLoading) return;
// //     clearContextGeoError(); setFormActionError(null);

// //     setMainSearchTerm(''); setFilterServices(''); setFilterSortBy('default');
// //     setFilterUserLatitude(''); setFilterUserLongitude(''); setFilterRadiusInMeters(DEFAULT_FORM_RADIUS.toString());
    
// //     // If clearing filters also means clearing any context-set location for this search instance
// //     // setContextLocation(null, 'manual'); // Or 'initial_default' if resetting to no location state
    
// //     onSubmit({ 
// //         name: undefined, services: undefined, sortBy: undefined, 
// //         userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined 
// //     });
// //     setIsPopoverOpen(false);
// //   }, [effectiveIsLoading, onSubmit, clearContextGeoError /*, setContextLocation (if clearing context) */]);

// //   const isGeoDataSetInForm = !!(parseNumericInput(filterUserLatitude) && parseNumericInput(filterUserLongitude));

// //   const activeFilterCount = useMemo(() => {
// //     let count = 0;
// //     if (mainSearchTerm.trim() !== (initialValues.name || '')) count++;
// //     if (filterServices.trim() !== (initialValues.services || '')) count++;
    
// //     const initialSort = initialValues.sortBy || 'default';
// //     if (filterSortBy !== initialSort) count++;
    
// //     const initLatStr = initialValues.userLatitude?.toString() || '';
// //     const initLonStr = initialValues.userLongitude?.toString() || '';
// //     const initRadiusStr = (initialValues.radiusInMeters ?? DEFAULT_FORM_RADIUS).toString();

// //     if (filterUserLatitude !== initLatStr) count++;
// //     if (filterUserLongitude !== initLonStr) count++;
// //     if (isGeoDataSetInForm && filterRadiusInMeters !== initRadiusStr) count++;
    
// //     return count;
// //   } , [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// //   const displayError = formActionError || (showDetectLocationButton && contextGeoError);

// //   return (
// //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/90 backdrop-blur-sm p-2 sm:p-3 rounded-full shadow-lg border border-slate-200">
// //       <div className="relative flex-grow">
// //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// //           <PopoverTrigger asChild>
// //             <Button
// //               type="button" variant="ghost" size="icon"
// //               className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// //               disabled={effectiveIsLoading} aria-label="Open filters"
// //             >
// //               <FilterIcon className="h-5 w-5" />
// //               {activeFilterCount > 0 && (
// //                 <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-1 ring-white">
// //                   {activeFilterCount}
// //                 </span>
// //               )}
// //             </Button>
// //           </PopoverTrigger>
// //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// //             <div className="p-4 sm:p-5">
// //               <div className="mb-4 space-y-0.5">
// //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// //               </div>
// //               <div className="grid gap-4">
// //                 <div className="space-y-1.5">
// //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// //                 </div>
// //                 <div className="space-y-1.5">
// //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// //                     <SelectContent>
// //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// //                         {isGeoDataSetInForm && (
// //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// //                         )}
// //                     </SelectContent>
// //                   </Select>
// //                 </div>
// //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// //                     {displayError && <p className="text-xs text-red-600 px-1 pt-1">{displayError}</p>}
// //                     <div className="grid grid-cols-2 gap-3">
// //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormActionError(null); clearContextGeoError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormActionError(null); clearContextGeoError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// //                     </div>
// //                     <div className="space-y-1.5">
// //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder={`e.g., ${DEFAULT_FORM_RADIUS/1000}km`} value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// //                     </div>
// //                 </div>
// //               </div>
// //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// //               </div>
// //             </div>
// //           </PopoverContent>
// //         </Popover>

// //         <Input
// //           id={`${formInstanceId}-mainSearchInput`}
// //           type="text" placeholder="Search by shop name or service..." // Updated placeholder
// //           value={mainSearchTerm} onChange={(e) => {setMainSearchTerm(e.target.value); setFormActionError(null); clearContextGeoError();}}
// //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// //           disabled={effectiveIsLoading}
// //         />
        
// //         {showDetectLocationButton && (
// //             <Button
// //               type="button" variant="ghost" size="icon"
// //               className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// //               onClick={handleDetectLocationAndSubmit} 
// //               disabled={effectiveIsLoading} 
// //               aria-label="Use current location"
// //             >
// //               {isLocatingInForm || (isContextLoadingLocation && !propIsLoading) ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// //             </Button>
// //         )}
// //       </div>

// //       <Button 
// //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// //         className="h-12 px-4 sm:px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// //       >
// //         {effectiveIsLoading && !isLocatingInForm ? <Loader2 className="mr-0 sm:mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-0 sm:mr-2 h-4 w-4" />}
// //         <span className="hidden sm:inline">Search</span>
// //       </Button>
// //     </div>
// //   );
// // }
// // // // src/components/search/ShopSearchForm.tsx
// // // 'use client';

// // // import { useState, useEffect, useCallback, useMemo } from 'react';
// // // import { Input } from "@/components/ui/input";
// // // import { Button } from "@/components/ui/button";
// // // import { Label } from "@/components/ui/label";
// // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // import { FrontendShopQueryParameters } from '@/types/api';
// // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/UserGeoLocationContext';

// // // type ShopSearchFormSubmitParams = Pick<
// // //   FrontendShopQueryParameters, 
// // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // >;

// // // interface ShopSearchFormProps {
// // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // //   initialValues: Partial<ShopSearchFormSubmitParams>;
// // //   isLoading?: boolean; 
// // //   formInstanceId?: string; 
// // //   showDetectLocationButton?: boolean; 
// // // }

// // // export default function ShopSearchForm({ 
// // //     onSubmit, 
// // //     initialValues, 
// // //     isLoading: propIsLoading,
// // //     formInstanceId = 'default',
// // //     showDetectLocationButton = true 
// // // }: ShopSearchFormProps) {
// // //   const { 
// // //     currentUserLocation: contextLocation, 
// // //     setCurrentUserLocation: setContextLocation,
// // //     isLoading: isContextLoadingLocation, 
// // //     error: contextLocationError,
// // //     clearError: clearContextError,
// // //     attemptBrowserLocation // Corrected: Was attemptGeoLocation
// // //   } = useSimpleLocation();

// // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>('');
// // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>('');
// // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>('500000');
  
// // //   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
// // //   const [formActionError, setFormActionError] = useState<string | null>(null);
// // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // //   const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || (showDetectLocationButton && isLocatingInForm);

// // //   useEffect(() => {
// // //     let newLatStr = '';
// // //     let newLonStr = '';
// // //     let newRadiusStr = (contextLocation?.radiusInMeters ?? 500000).toString();
// // //     let newSortByState = initialValues.sortBy || 'default';

// // //     const initLatNum = initialValues.userLatitude;
// // //     const initLonNum = initialValues.userLongitude;
// // //     const initRadiusNum = initialValues.radiusInMeters;

// // //     if (initLatNum !== undefined && initLonNum !== undefined) {
// // //       newLatStr = initLatNum.toString();
// // //       newLonStr = initLonNum.toString();
// // //       newRadiusStr = (initRadiusNum ?? contextLocation?.radiusInMeters ?? 500000).toString();

// // //       const newContextCandidate: SimpleUserLocation = {
// // //         latitude: initLatNum,
// // //         longitude: initLonNum,
// // //         radiusInMeters: parseInt(newRadiusStr, 10) || 500000,
// // //         timestamp: Date.now()
// // //       };
// // //       if (
// // //         contextLocation?.latitude !== newContextCandidate.latitude ||
// // //         contextLocation?.longitude !== newContextCandidate.longitude ||
// // //         contextLocation?.radiusInMeters !== newContextCandidate.radiusInMeters
// // //       ) {
// // //         setContextLocation(newContextCandidate); 
// // //       }
// // //     } 
// // //     else if (contextLocation) {
// // //       newLatStr = contextLocation.latitude.toString();
// // //       newLonStr = contextLocation.longitude.toString();
// // //       newRadiusStr = contextLocation.radiusInMeters.toString();
// // //     }

// // //     setFilterUserLatitude(newLatStr);
// // //     setFilterUserLongitude(newLonStr);
// // //     setFilterRadiusInMeters(newRadiusStr);
// // //     setMainSearchTerm(initialValues.name || '');
// // //     setFilterServices(initialValues.services || '');

// // //     const hasLocationInForm = !!(newLatStr && newLonStr);
// // //     if (newSortByState === 'default' && hasLocationInForm) {
// // //       newSortByState = 'distance_asc';
// // //     } else if (!hasLocationInForm && newSortByState === 'distance_asc') {
// // //       newSortByState = 'default';
// // //     }
// // //     setFilterSortBy(newSortByState);

// // //   }, [
// // //       initialValues.name, 
// // //       initialValues.services, 
// // //       initialValues.sortBy,
// // //       initialValues.userLatitude, 
// // //       initialValues.userLongitude, 
// // //       initialValues.radiusInMeters,
// // //       contextLocation, 
// // //       setContextLocation 
// // //   ]);

// // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // //     if (value === undefined || value.trim() === '') return undefined;
// // //     const parsed = parseFloat(value);
// // //     return isNaN(parsed) ? undefined : parsed;
// // //   };

// // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // //     if (value === undefined || value.trim() === '') return undefined;
// // //     const parsed = parseInt(value, 10);
// // //     return isNaN(parsed) ? undefined : parsed;
// // //   };

// // //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// // //     const lat = parseNumericInput(filterUserLatitude);
// // //     const lon = parseNumericInput(filterUserLongitude);
// // //     const radius = parseIntegerInput(filterRadiusInMeters);
// // //     let effectiveSortBy = filterSortBy;

// // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // //       effectiveSortBy = 'distance_asc';
// // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // //       effectiveSortBy = 'default'; 
// // //     }
    
// // //     return {
// // //       name: mainSearchTerm.trim() || undefined,
// // //       services: filterServices.trim() || undefined,
// // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // //       userLatitude: lat,
// // //       userLongitude: lon,
// // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // //     };
// // //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// // //   const triggerMainSubmit = useCallback(() => {
// // //     if (effectiveIsLoading) return;
// // //     clearContextError(); 
// // //     setFormActionError(null); 
// // //     onSubmit(buildSubmissionCriteria());
// // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, clearContextError]);
  
// // //   const getCurrentLocationAndSubmit = useCallback(async () => {
// // //     if (!showDetectLocationButton || effectiveIsLoading) return;
    
// // //     setIsLocatingInForm(true);
// // //     setFormActionError(null); 
// // //     clearContextError();     

// // //     const detectedLocation = await attemptBrowserLocation({ // CORRECTED
// // //         targetRadius: parseIntegerInput(filterRadiusInMeters) || 500000,
// // //         onError: (errorMsg: string, errorCode?: number) => { // Added type for errorMsg
// // //             if (errorCode === GeolocationPositionError.PERMISSION_DENIED) {
// // //                 console.warn("ShopSearchForm: User denied geolocation from detect button.");
// // //             } else {
// // //                 setFormActionError(errorMsg); 
// // //             }
// // //         }
// // //     });
    
// // //     setIsLocatingInForm(false);

// // //     onSubmit({
// // //         name: mainSearchTerm.trim() || undefined,
// // //         services: filterServices.trim() || undefined,
// // //         sortBy: detectedLocation ? 'distance_asc' : filterSortBy, 
// // //         userLatitude: detectedLocation?.latitude,
// // //         userLongitude: detectedLocation?.longitude,
// // //         radiusInMeters: detectedLocation?.radiusInMeters
// // //     });

// // //   }, [showDetectLocationButton, effectiveIsLoading, attemptBrowserLocation, onSubmit, mainSearchTerm, filterServices, filterRadiusInMeters, filterSortBy, clearContextError]); 

// // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // //     if (effectiveIsLoading) return;
// // //     clearContextError();
// // //     setFormActionError(null);
// // //     const criteria = buildSubmissionCriteria();
    
// // //     const currentLat = parseNumericInput(filterUserLatitude);
// // //     const currentLon = parseNumericInput(filterUserLongitude);
// // //     const currentRadius = parseIntegerInput(filterRadiusInMeters) ?? contextLocation?.radiusInMeters ?? 500000;

// // //     if (typeof currentLat === 'number' && typeof currentLon === 'number') {
// // //         if (contextLocation?.latitude !== currentLat || contextLocation?.longitude !== currentLon || contextLocation?.radiusInMeters !== currentRadius) {
// // //             setContextLocation({
// // //                 latitude: currentLat,
// // //                 longitude: currentLon,
// // //                 radiusInMeters: currentRadius,
// // //                 timestamp: Date.now()
// // //             });
// // //         }
// // //     } else if (contextLocation) { 
// // //         setContextLocation(null);
// // //     }
// // //     onSubmit(criteria);
// // //     setIsPopoverOpen(false);
// // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation, clearContextError]);

// // //   const handleClearAllFilters = useCallback(() => {
// // //     if (effectiveIsLoading) return;
// // //     clearContextError();
// // //     setFormActionError(null);
// // //     setMainSearchTerm(''); 
// // //     setFilterServices(''); 
// // //     setFilterSortBy('default');
// // //     setFilterUserLatitude(''); 
// // //     setFilterUserLongitude(''); 
// // //     setFilterRadiusInMeters('500000');
// // //     setContextLocation(null); 
// // //     onSubmit({ name: undefined, services: undefined, sortBy: undefined, userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined });
// // //     setIsPopoverOpen(false);
// // //   }, [effectiveIsLoading, onSubmit, setContextLocation, clearContextError]);
  
// // //   const isGeoDataSetInForm = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // //   const activeFilterCount = useMemo(() => [
// // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // //     filterServices.trim() !== (initialValues.services || ''),
// // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetInForm),
// // //   ].filter(Boolean).length, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// // //   const displayError = formActionError || (showDetectLocationButton && contextLocationError);

// // //   return (
// // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // //       <div className="relative flex-grow">
// // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // //           <PopoverTrigger asChild>
// // //             <Button
// // //               type="button" variant="ghost" size="icon"
// // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // //               disabled={effectiveIsLoading} aria-label="Open filters"
// // //             >
// // //               <FilterIcon className="h-5 w-5" />
// // //               {activeFilterCount > 0 && (
// // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // //                   {activeFilterCount}
// // //                 </span>
// // //               )}
// // //             </Button>
// // //           </PopoverTrigger>
// // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // //             <div className="p-4 sm:p-5">
// // //               <div className="mb-4 space-y-0.5">
// // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // //               </div>
// // //               <div className="grid gap-4">
// // //                 <div className="space-y-1.5">
// // //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// // //                 </div>
// // //                 <div className="space-y-1.5">
// // //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// // //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// // //                     <SelectContent>
// // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // //                         {isGeoDataSetInForm && (
// // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // //                         )}
// // //                     </SelectContent>
// // //                   </Select>
// // //                 </div>
// // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // //                     {displayError && <p className="text-xs text-red-600 px-1 pt-1">{displayError}</p>}
// // //                     <div className="grid grid-cols-2 gap-3">
// // //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormActionError(null); clearContextError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormActionError(null); clearContextError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // //                     </div>
// // //                     <div className="space-y-1.5">
// // //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder="e.g., 50000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// // //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // //                     </div>
// // //                 </div>
// // //               </div>
// // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // //               </div>
// // //             </div>
// // //           </PopoverContent>
// // //         </Popover>

// // //         <Input
// // //           id={`${formInstanceId}-mainSearchInput`}
// // //           type="text" placeholder="Search by shop name..."
// // //           value={mainSearchTerm} onChange={(e) => {setMainSearchTerm(e.target.value); setFormActionError(null); clearContextError();}}
// // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // //           disabled={effectiveIsLoading}
// // //         />
        
// // //         {showDetectLocationButton && (
// // //             <Button
// // //               type="button" variant="ghost" size="icon"
// // //               className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // //               onClick={getCurrentLocationAndSubmit} 
// // //               disabled={effectiveIsLoading} 
// // //               aria-label="Use current location"
// // //             >
// // //               {isLocatingInForm || isContextLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // //             </Button>
// // //         )}
// // //       </div>

// // //       <Button 
// // //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // //       >
// // //         {(effectiveIsLoading && !isLocatingInForm && !(showDetectLocationButton && isContextLoadingLocation)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
// // //         Search
// // //       </Button>
// // //     </div>
// // //   );
// // // }
// // // // // src/components/search/ShopSearchForm.tsx
// // // // 'use client';

// // // // import { useState, useEffect, useCallback, useMemo } from 'react';
// // // // import { Input } from "@/components/ui/input";
// // // // import { Button } from "@/components/ui/button";
// // // // import { Label } from "@/components/ui/label";
// // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // type ShopSearchFormSubmitParams = Pick<
// // // //   FrontendShopQueryParameters, 
// // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // >;

// // // // interface ShopSearchFormProps {
// // // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // // //   initialValues: Partial<ShopSearchFormSubmitParams>;
// // // //   isLoading?: boolean; 
// // // //   formInstanceId?: string; 
// // // //   showDetectLocationButton?: boolean; 
// // // // }

// // // // export default function ShopSearchForm({ 
// // // //     onSubmit, 
// // // //     initialValues, 
// // // //     isLoading: propIsLoading,
// // // //     formInstanceId = 'default',
// // // //     showDetectLocationButton = true 
// // // // }: ShopSearchFormProps) {
// // // //   const { 
// // // //     currentUserLocation: contextLocation, 
// // // //     setCurrentUserLocation: setContextLocation,
// // // //     isLoading: isContextLoadingLocation, 
// // // //     error: contextLocationError, // General context error
// // // //     clearError: clearContextError, // Function to clear context error
// // // //     attemptBrowserLocation
// // // //   } = useSimpleLocation();

// // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>('');
// // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>('');
// // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>('500000');
  
// // // //   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
// // // //   const [formActionError, setFormActionError] = useState<string | null>(null); // For errors specific to this form's actions
// // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // //   const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || (showDetectLocationButton && isLocatingInForm);

// // // //   useEffect(() => {
// // // //     let newLatStr = '';
// // // //     let newLonStr = '';
// // // //     let newRadiusStr = (contextLocation?.radiusInMeters ?? 500000).toString();
// // // //     let newSortByState = initialValues.sortBy || 'default';

// // // //     const initLatNum = initialValues.userLatitude;
// // // //     const initLonNum = initialValues.userLongitude;
// // // //     const initRadiusNum = initialValues.radiusInMeters;

// // // //     if (initLatNum !== undefined && initLonNum !== undefined) {
// // // //       newLatStr = initLatNum.toString();
// // // //       newLonStr = initLonNum.toString();
// // // //       newRadiusStr = (initRadiusNum ?? contextLocation?.radiusInMeters ?? 500000).toString();

// // // //       const newContextCandidate: SimpleUserLocation = {
// // // //         latitude: initLatNum,
// // // //         longitude: initLonNum,
// // // //         radiusInMeters: parseInt(newRadiusStr, 10) || 500000,
// // // //         timestamp: Date.now()
// // // //       };
// // // //       if (
// // // //         contextLocation?.latitude !== newContextCandidate.latitude ||
// // // //         contextLocation?.longitude !== newContextCandidate.longitude ||
// // // //         contextLocation?.radiusInMeters !== newContextCandidate.radiusInMeters
// // // //       ) {
// // // //         setContextLocation(newContextCandidate); 
// // // //       }
// // // //     } 
// // // //     else if (contextLocation) {
// // // //       newLatStr = contextLocation.latitude.toString();
// // // //       newLonStr = contextLocation.longitude.toString();
// // // //       newRadiusStr = contextLocation.radiusInMeters.toString();
// // // //     }

// // // //     setFilterUserLatitude(newLatStr);
// // // //     setFilterUserLongitude(newLonStr);
// // // //     setFilterRadiusInMeters(newRadiusStr);
// // // //     setMainSearchTerm(initialValues.name || '');
// // // //     setFilterServices(initialValues.services || '');

// // // //     const hasLocationInForm = !!(newLatStr && newLonStr);
// // // //     if (newSortByState === 'default' && hasLocationInForm) {
// // // //       newSortByState = 'distance_asc';
// // // //     } else if (!hasLocationInForm && newSortByState === 'distance_asc') {
// // // //       newSortByState = 'default';
// // // //     }
// // // //     setFilterSortBy(newSortByState);

// // // //   }, [
// // // //       initialValues.name, 
// // // //       initialValues.services, 
// // // //       initialValues.sortBy,
// // // //       initialValues.userLatitude, 
// // // //       initialValues.userLongitude, 
// // // //       initialValues.radiusInMeters,
// // // //       contextLocation, 
// // // //       setContextLocation 
// // // //   ]);

// // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // //     if (value === undefined || value.trim() === '') return undefined;
// // // //     const parsed = parseFloat(value);
// // // //     return isNaN(parsed) ? undefined : parsed;
// // // //   };

// // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // //     if (value === undefined || value.trim() === '') return undefined;
// // // //     const parsed = parseInt(value, 10);
// // // //     return isNaN(parsed) ? undefined : parsed;
// // // //   };

// // // //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// // // //     const lat = parseNumericInput(filterUserLatitude);
// // // //     const lon = parseNumericInput(filterUserLongitude);
// // // //     const radius = parseIntegerInput(filterRadiusInMeters);
// // // //     let effectiveSortBy = filterSortBy;

// // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // // //       effectiveSortBy = 'distance_asc';
// // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // //       effectiveSortBy = 'default'; 
// // // //     }
    
// // // //     return {
// // // //       name: mainSearchTerm.trim() || undefined,
// // // //       services: filterServices.trim() || undefined,
// // // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // // //       userLatitude: lat,
// // // //       userLongitude: lon,
// // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // //     };
// // // //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// // // //   const triggerMainSubmit = useCallback(() => {
// // // //     if (effectiveIsLoading) return;
// // // //     clearContextError(); // Clear general context error before a new submission
// // // //     setFormActionError(null); // Clear form-specific error
// // // //     onSubmit(buildSubmissionCriteria());
// // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, clearContextError]);
  
// // // //   const getCurrentLocationAndSubmit = useCallback(async () => {
// // // //     if (!showDetectLocationButton || effectiveIsLoading) return;
    
// // // //     setIsLocatingInForm(true);
// // // //     setFormActionError(null); // Clear previous form action errors
// // // //     clearContextError();     // Clear general context error

// // // //     const detectedLocation = await attemptBrowserLocation({
// // // //         targetRadius: parseIntegerInput(filterRadiusInMeters) || 500000,
// // // //         onError: (errorMsg, errorCode) => {
// // // //             // If permission denied, we want to submit to parent so it can redirect
// // // //             // For other errors, we can set a local form error.
// // // //             if (errorCode === GeolocationPositionError.PERMISSION_DENIED) {
// // // //                 // Don't set formActionError here, let onSubmit handle the redirect logic
// // // //                 // by receiving null location.
// // // //                 console.warn("ShopSearchForm: User denied geolocation from detect button.");
// // // //             } else {
// // // //                 setFormActionError(errorMsg); // Show other errors locally in the form
// // // //             }
// // // //         }
// // // //     });
    
// // // //     setIsLocatingInForm(false);

// // // //     // Always call onSubmit. If detectedLocation is null, the parent (HomePage)
// // // //     // will see that userLatitude is undefined and redirect to /select-city.
// // // //     // If detectedLocation is valid, it will proceed with location.
// // // //     onSubmit({
// // // //         name: mainSearchTerm.trim() || undefined,
// // // //         services: filterServices.trim() || undefined,
// // // //         sortBy: detectedLocation ? 'distance_asc' : filterSortBy, // Use current sort if detection failed
// // // //         userLatitude: detectedLocation?.latitude,
// // // //         userLongitude: detectedLocation?.longitude,
// // // //         radiusInMeters: detectedLocation?.radiusInMeters
// // // //     });

// // // //   }, [showDetectLocationButton, effectiveIsLoading, attemptBrowserLocation, onSubmit, mainSearchTerm, filterServices, filterRadiusInMeters, filterSortBy, clearContextError]); 

// // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // //     if (effectiveIsLoading) return;
// // // //     clearContextError();
// // // //     setFormActionError(null);
// // // //     const criteria = buildSubmissionCriteria();
    
// // // //     const currentLat = parseNumericInput(filterUserLatitude);
// // // //     const currentLon = parseNumericInput(filterUserLongitude);
// // // //     const currentRadius = parseIntegerInput(filterRadiusInMeters) ?? contextLocation?.radiusInMeters ?? 500000;

// // // //     if (typeof currentLat === 'number' && typeof currentLon === 'number') {
// // // //         if (contextLocation?.latitude !== currentLat || contextLocation?.longitude !== currentLon || contextLocation?.radiusInMeters !== currentRadius) {
// // // //             setContextLocation({
// // // //                 latitude: currentLat,
// // // //                 longitude: currentLon,
// // // //                 radiusInMeters: currentRadius,
// // // //                 timestamp: Date.now()
// // // //             });
// // // //         }
// // // //     } else if (contextLocation) { 
// // // //         setContextLocation(null);
// // // //     }
// // // //     onSubmit(criteria);
// // // //     setIsPopoverOpen(false);
// // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation, clearContextError]);

// // // //   const handleClearAllFilters = useCallback(() => {
// // // //     if (effectiveIsLoading) return;
// // // //     clearContextError();
// // // //     setFormActionError(null);
// // // //     setMainSearchTerm(''); 
// // // //     setFilterServices(''); 
// // // //     setFilterSortBy('default');
// // // //     setFilterUserLatitude(''); 
// // // //     setFilterUserLongitude(''); 
// // // //     setFilterRadiusInMeters('500000');
// // // //     setContextLocation(null); 
// // // //     onSubmit({ name: undefined, services: undefined, sortBy: undefined, userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined });
// // // //     setIsPopoverOpen(false);
// // // //   }, [effectiveIsLoading, onSubmit, setContextLocation, clearContextError]);
  
// // // //   const isGeoDataSetInForm = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // //   const activeFilterCount = useMemo(() => [
// // // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // // //     filterServices.trim() !== (initialValues.services || ''),
// // // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetInForm),
// // // //   ].filter(Boolean).length, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// // // //   // Display form-specific action error first, then general context error if button is active
// // // //   const displayError = formActionError || (showDetectLocationButton && contextLocationError);

// // // //   return (
// // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // // //       <div className="relative flex-grow">
// // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // //           <PopoverTrigger asChild>
// // // //             <Button
// // // //               type="button" variant="ghost" size="icon"
// // // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // //               disabled={effectiveIsLoading} aria-label="Open filters"
// // // //             >
// // // //               <FilterIcon className="h-5 w-5" />
// // // //               {activeFilterCount > 0 && (
// // // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // // //                   {activeFilterCount}
// // // //                 </span>
// // // //               )}
// // // //             </Button>
// // // //           </PopoverTrigger>
// // // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // // //             <div className="p-4 sm:p-5">
// // // //               <div className="mb-4 space-y-0.5">
// // // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // // //               </div>
// // // //               <div className="grid gap-4">
// // // //                 <div className="space-y-1.5">
// // // //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // // //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// // // //                 </div>
// // // //                 <div className="space-y-1.5">
// // // //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// // // //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// // // //                     <SelectContent>
// // // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // // //                         {isGeoDataSetInForm && (
// // // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // // //                         )}
// // // //                     </SelectContent>
// // // //                   </Select>
// // // //                 </div>
// // // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // // //                     {/* Changed to displayError */}
// // // //                     {displayError && <p className="text-xs text-red-600 px-1 pt-1">{displayError}</p>}
// // // //                     <div className="grid grid-cols-2 gap-3">
// // // //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormActionError(null); clearContextError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormActionError(null); clearContextError();}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // //                     </div>
// // // //                     <div className="space-y-1.5">
// // // //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // // //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder="e.g., 50000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// // // //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // // //                     </div>
// // // //                 </div>
// // // //               </div>
// // // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // // //               </div>
// // // //             </div>
// // // //           </PopoverContent>
// // // //         </Popover>

// // // //         <Input
// // // //           id={`${formInstanceId}-mainSearchInput`}
// // // //           type="text" placeholder="Search by shop name..."
// // // //           value={mainSearchTerm} onChange={(e) => {setMainSearchTerm(e.target.value); setFormActionError(null); clearContextError();}}
// // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // // //           disabled={effectiveIsLoading}
// // // //         />
        
// // // //         {showDetectLocationButton && (
// // // //             <Button
// // // //               type="button" variant="ghost" size="icon"
// // // //               className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // //               onClick={getCurrentLocationAndSubmit} 
// // // //               disabled={effectiveIsLoading} 
// // // //               aria-label="Use current location"
// // // //             >
// // // //               {isLocatingInForm || isContextLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // // //             </Button>
// // // //         )}
// // // //       </div>

// // // //       <Button 
// // // //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// // // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // // //       >
// // // //         {(effectiveIsLoading && !isLocatingInForm && !(showDetectLocationButton && isContextLoadingLocation)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
// // // //         Search
// // // //       </Button>
// // // //     </div>
// // // //   );
// // // // }
// // // // // // src/components/search/ShopSearchForm.tsx
// // // // // 'use client';

// // // // // import { useState, useEffect, useCallback, useMemo } from 'react';
// // // // // import { Input } from "@/components/ui/input";
// // // // // import { Button } from "@/components/ui/button";
// // // // // import { Label } from "@/components/ui/label";
// // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // // type ShopSearchFormSubmitParams = Pick<
// // // // //   FrontendShopQueryParameters, 
// // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // >;

// // // // // interface ShopSearchFormProps {
// // // // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // // // //   initialValues: Partial<ShopSearchFormSubmitParams>;
// // // // //   isLoading?: boolean; 
// // // // //   formInstanceId?: string; 
// // // // //   showDetectLocationButton?: boolean; 
// // // // // }

// // // // // export default function ShopSearchForm({ 
// // // // //     onSubmit, 
// // // // //     initialValues, 
// // // // //     isLoading: propIsLoading,
// // // // //     formInstanceId = 'default',
// // // // //     showDetectLocationButton = true 
// // // // // }: ShopSearchFormProps) {
// // // // //   const { 
// // // // //     currentUserLocation: contextLocation, 
// // // // //     setCurrentUserLocation: setContextLocation,
// // // // //     isLoading: isContextLoadingLocation, 
// // // // //     error: contextLocationError,
// // // // //     attemptGeoLocation 
// // // // //   } = useSimpleLocation();

// // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>('');
// // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>('');
// // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>('500000');
  
// // // // //   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
// // // // //   const [formLocationError, setFormLocationError] = useState<string | null>(null);
// // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // //   const effectiveIsLoading = propIsLoading || (showDetectLocationButton && isContextLoadingLocation) || (showDetectLocationButton && isLocatingInForm);

// // // // //   useEffect(() => {
// // // // //     let newLatStr = '';
// // // // //     let newLonStr = '';
// // // // //     let newRadiusStr = (contextLocation?.radiusInMeters ?? 500000).toString();
// // // // //     let newSortByState = initialValues.sortBy || 'default';

// // // // //     const initLatNum = initialValues.userLatitude;
// // // // //     const initLonNum = initialValues.userLongitude;
// // // // //     const initRadiusNum = initialValues.radiusInMeters;

// // // // //     if (initLatNum !== undefined && initLonNum !== undefined) {
// // // // //       newLatStr = initLatNum.toString();
// // // // //       newLonStr = initLonNum.toString();
// // // // //       newRadiusStr = (initRadiusNum ?? contextLocation?.radiusInMeters ?? 500000).toString();

// // // // //       const newContextCandidate: SimpleUserLocation = {
// // // // //         latitude: initLatNum,
// // // // //         longitude: initLonNum,
// // // // //         radiusInMeters: parseInt(newRadiusStr, 10) || 500000
// // // // //       };
// // // // //       if (
// // // // //         contextLocation?.latitude !== newContextCandidate.latitude ||
// // // // //         contextLocation?.longitude !== newContextCandidate.longitude ||
// // // // //         contextLocation?.radiusInMeters !== newContextCandidate.radiusInMeters
// // // // //       ) {
// // // // //         setContextLocation(newContextCandidate); 
// // // // //       }
// // // // //     } 
// // // // //     else if (contextLocation) {
// // // // //       newLatStr = contextLocation.latitude.toString();
// // // // //       newLonStr = contextLocation.longitude.toString();
// // // // //       newRadiusStr = contextLocation.radiusInMeters.toString();
// // // // //     }

// // // // //     setFilterUserLatitude(newLatStr);
// // // // //     setFilterUserLongitude(newLonStr);
// // // // //     setFilterRadiusInMeters(newRadiusStr);
// // // // //     setMainSearchTerm(initialValues.name || '');
// // // // //     setFilterServices(initialValues.services || '');

// // // // //     const hasLocationInForm = !!(newLatStr && newLonStr);
// // // // //     if (newSortByState === 'default' && hasLocationInForm) {
// // // // //       newSortByState = 'distance_asc';
// // // // //     } else if (!hasLocationInForm && newSortByState === 'distance_asc') {
// // // // //       newSortByState = 'default';
// // // // //     }
// // // // //     setFilterSortBy(newSortByState);

// // // // //   }, [
// // // // //       initialValues.name, 
// // // // //       initialValues.services, 
// // // // //       initialValues.sortBy,
// // // // //       initialValues.userLatitude, 
// // // // //       initialValues.userLongitude, 
// // // // //       initialValues.radiusInMeters,
// // // // //       contextLocation, 
// // // // //       setContextLocation 
// // // // //   ]);

// // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // //     const parsed = parseFloat(value);
// // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // //   };

// // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // //     const parsed = parseInt(value, 10);
// // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // //   };

// // // // //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// // // // //     const lat = parseNumericInput(filterUserLatitude);
// // // // //     const lon = parseNumericInput(filterUserLongitude);
// // // // //     const radius = parseIntegerInput(filterRadiusInMeters);
// // // // //     let effectiveSortBy = filterSortBy;

// // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // // // //       effectiveSortBy = 'distance_asc';
// // // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // //       effectiveSortBy = 'default'; 
// // // // //     }
    
// // // // //     return {
// // // // //       name: mainSearchTerm.trim() || undefined,
// // // // //       services: filterServices.trim() || undefined,
// // // // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // // // //       userLatitude: lat,
// // // // //       userLongitude: lon,
// // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // //     };
// // // // //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// // // // //   const triggerMainSubmit = useCallback(() => {
// // // // //     if (effectiveIsLoading) return;
// // // // //     onSubmit(buildSubmissionCriteria());
// // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria]);
  
// // // // //   const getCurrentLocationAndSubmit = useCallback(async () => {
// // // // //     if (!showDetectLocationButton || effectiveIsLoading) return;
    
// // // // //     setIsLocatingInForm(true);
// // // // //     setFormLocationError(null);

// // // // //     const detectedLocation = await attemptGeoLocation({
// // // // //         targetRadius: parseIntegerInput(filterRadiusInMeters) || 500000,
// // // // //         onError: (errorMsg) => setFormLocationError(errorMsg)
// // // // //     });
    
// // // // //     setIsLocatingInForm(false);

// // // // //     if (detectedLocation) {
// // // // //         onSubmit({
// // // // //             name: mainSearchTerm.trim() || undefined,
// // // // //             services: filterServices.trim() || undefined,
// // // // //             sortBy: 'distance_asc', 
// // // // //             userLatitude: detectedLocation.latitude,
// // // // //             userLongitude: detectedLocation.longitude,
// // // // //             radiusInMeters: detectedLocation.radiusInMeters
// // // // //         });
// // // // //     }
// // // // //   }, [showDetectLocationButton, effectiveIsLoading, attemptGeoLocation, onSubmit, mainSearchTerm, filterServices, filterRadiusInMeters]); 

// // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // //     if (effectiveIsLoading) return;
// // // // //     const criteria = buildSubmissionCriteria();
    
// // // // //     const currentLat = parseNumericInput(filterUserLatitude);
// // // // //     const currentLon = parseNumericInput(filterUserLongitude);
// // // // //     const currentRadius = parseIntegerInput(filterRadiusInMeters) ?? contextLocation?.radiusInMeters ?? 500000;

// // // // //     if (typeof currentLat === 'number' && typeof currentLon === 'number') {
// // // // //         if (contextLocation?.latitude !== currentLat || contextLocation?.longitude !== currentLon || contextLocation?.radiusInMeters !== currentRadius) {
// // // // //             setContextLocation({
// // // // //                 latitude: currentLat,
// // // // //                 longitude: currentLon,
// // // // //                 radiusInMeters: currentRadius
// // // // //             });
// // // // //         }
// // // // //     } else if (contextLocation) { 
// // // // //         setContextLocation(null);
// // // // //     }
// // // // //     onSubmit(criteria);
// // // // //     setIsPopoverOpen(false);
// // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation]);

// // // // //   const handleClearAllFilters = useCallback(() => {
// // // // //     if (effectiveIsLoading) return;
// // // // //     setMainSearchTerm(''); 
// // // // //     setFilterServices(''); 
// // // // //     setFilterSortBy('default');
// // // // //     setFilterUserLatitude(''); 
// // // // //     setFilterUserLongitude(''); 
// // // // //     setFilterRadiusInMeters('500000');
// // // // //     setFormLocationError(null);
// // // // //     setContextLocation(null); 
// // // // //     onSubmit({ name: undefined, services: undefined, sortBy: undefined, userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined });
// // // // //     setIsPopoverOpen(false);
// // // // //   }, [effectiveIsLoading, onSubmit, setContextLocation]);
  
// // // // //   const isGeoDataSetInForm = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // //   const activeFilterCount = useMemo(() => [
// // // // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // // // //     filterServices.trim() !== (initialValues.services || ''),
// // // // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // // // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // // // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // // // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetInForm),
// // // // //   ].filter(Boolean).length, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// // // // //   const displayLocationError = formLocationError || (showDetectLocationButton ? contextLocationError : null);

// // // // //   return (
// // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // // // //       <div className="relative flex-grow">
// // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // //           <PopoverTrigger asChild>
// // // // //             <Button
// // // // //               type="button" variant="ghost" size="icon"
// // // // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // //               disabled={effectiveIsLoading} aria-label="Open filters"
// // // // //             >
// // // // //               <FilterIcon className="h-5 w-5" />
// // // // //               {activeFilterCount > 0 && (
// // // // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // // // //                   {activeFilterCount}
// // // // //                 </span>
// // // // //               )}
// // // // //             </Button>
// // // // //           </PopoverTrigger>
// // // // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // // // //             <div className="p-4 sm:p-5">
// // // // //               <div className="mb-4 space-y-0.5">
// // // // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // // // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // // // //               </div>
// // // // //               <div className="grid gap-4">
// // // // //                 <div className="space-y-1.5">
// // // // //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // // // //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// // // // //                 </div>
// // // // //                 <div className="space-y-1.5">
// // // // //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// // // // //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// // // // //                     <SelectContent>
// // // // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // // // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // // // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // // // //                         {isGeoDataSetInForm && (
// // // // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // // // //                         )}
// // // // //                     </SelectContent>
// // // // //                   </Select>
// // // // //                 </div>
// // // // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // // // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // // // //                     {displayLocationError && <p className="text-xs text-red-600 px-1 pt-1">{displayLocationError}</p>}
// // // // //                     <div className="grid grid-cols-2 gap-3">
// // // // //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // //                     </div>
// // // // //                     <div className="space-y-1.5">
// // // // //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // // // //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder="e.g., 50000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// // // // //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // // // //                     </div>
// // // // //                 </div>
// // // // //               </div>
// // // // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // // // //               </div>
// // // // //             </div>
// // // // //           </PopoverContent>
// // // // //         </Popover>

// // // // //         <Input
// // // // //           id={`${formInstanceId}-mainSearchInput`}
// // // // //           type="text" placeholder="Search by shop name..."
// // // // //           value={mainSearchTerm} onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // // // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // // // //           disabled={effectiveIsLoading}
// // // // //         />
        
// // // // //         {showDetectLocationButton && (
// // // // //             <Button
// // // // //               type="button" variant="ghost" size="icon"
// // // // //               className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // //               onClick={getCurrentLocationAndSubmit} 
// // // // //               disabled={effectiveIsLoading} 
// // // // //               aria-label="Use current location"
// // // // //             >
// // // // //               {isLocatingInForm || isContextLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // // // //             </Button>
// // // // //         )}
// // // // //       </div>

// // // // //       <Button 
// // // // //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// // // // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // // // //       >
// // // // //         {(effectiveIsLoading && !isLocatingInForm && !(showDetectLocationButton && isContextLoadingLocation)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
// // // // //         Search
// // // // //       </Button>
// // // // //     </div>
// // // // //   );
// // // // // }
// // // // // // // src/components/search/ShopSearchForm.tsx
// // // // // // 'use client';

// // // // // // import { useState, useEffect, useCallback, useMemo } from 'react';
// // // // // // import { Input } from "@/components/ui/input";
// // // // // // import { Button } from "@/components/ui/button";
// // // // // // import { Label } from "@/components/ui/label";
// // // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // // // type ShopSearchFormSubmitParams = Pick<
// // // // // //   FrontendShopQueryParameters, 
// // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // >;

// // // // // // interface ShopSearchFormProps {
// // // // // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // // // // //   initialValues: Partial<ShopSearchFormSubmitParams>;
// // // // // //   isLoading?: boolean; 
// // // // // //   formInstanceId?: string; 
// // // // // // }

// // // // // // export default function ShopSearchForm({ 
// // // // // //     onSubmit, 
// // // // // //     initialValues, 
// // // // // //     isLoading: propIsLoading,
// // // // // //     formInstanceId = 'default'
// // // // // // }: ShopSearchFormProps) {
// // // // // //   const { 
// // // // // //     currentUserLocation: contextLocation, 
// // // // // //     setCurrentUserLocation: setContextLocation,
// // // // // //     isLoading: isContextLoadingLocation, 
// // // // // //     error: contextLocationError,
// // // // // //     attemptGeoLocation 
// // // // // //   } = useSimpleLocation();

// // // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>('');
// // // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>('');
// // // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>('500000');
  
// // // // // //   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
// // // // // //   const [formLocationError, setFormLocationError] = useState<string | null>(null);
// // // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // // //   const effectiveIsLoading = propIsLoading || isContextLoadingLocation || isLocatingInForm;

// // // // // //   useEffect(() => {
// // // // // //     let newLatStr = '';
// // // // // //     let newLonStr = '';
// // // // // //     let newRadiusStr = (contextLocation?.radiusInMeters ?? 500000).toString();
// // // // // //     let newSortByState = initialValues.sortBy || 'default';

// // // // // //     const initLatNum = initialValues.userLatitude;
// // // // // //     const initLonNum = initialValues.userLongitude;
// // // // // //     const initRadiusNum = initialValues.radiusInMeters;

// // // // // //     if (initLatNum !== undefined && initLonNum !== undefined) {
// // // // // //       newLatStr = initLatNum.toString();
// // // // // //       newLonStr = initLonNum.toString();
// // // // // //       newRadiusStr = (initRadiusNum ?? contextLocation?.radiusInMeters ?? 500000).toString();

// // // // // //       const newContextCandidate: SimpleUserLocation = {
// // // // // //         latitude: initLatNum,
// // // // // //         longitude: initLonNum,
// // // // // //         radiusInMeters: parseInt(newRadiusStr, 10) 
// // // // // //       };
// // // // // //       if (
// // // // // //         contextLocation?.latitude !== newContextCandidate.latitude ||
// // // // // //         contextLocation?.longitude !== newContextCandidate.longitude ||
// // // // // //         contextLocation?.radiusInMeters !== newContextCandidate.radiusInMeters
// // // // // //       ) {
// // // // // //         setContextLocation(newContextCandidate); 
// // // // // //       }
// // // // // //     } 
// // // // // //     else if (contextLocation) {
// // // // // //       newLatStr = contextLocation.latitude.toString();
// // // // // //       newLonStr = contextLocation.longitude.toString();
// // // // // //       newRadiusStr = contextLocation.radiusInMeters.toString();
// // // // // //     }

// // // // // //     setFilterUserLatitude(newLatStr);
// // // // // //     setFilterUserLongitude(newLonStr);
// // // // // //     setFilterRadiusInMeters(newRadiusStr);
// // // // // //     setMainSearchTerm(initialValues.name || '');
// // // // // //     setFilterServices(initialValues.services || '');

// // // // // //     const hasLocationInForm = !!(newLatStr && newLonStr);
// // // // // //     if (newSortByState === 'default' && hasLocationInForm) {
// // // // // //       newSortByState = 'distance_asc';
// // // // // //     } else if (!hasLocationInForm && newSortByState === 'distance_asc') {
// // // // // //       newSortByState = 'default';
// // // // // //     }
// // // // // //     setFilterSortBy(newSortByState);

// // // // // //   }, [
// // // // // //       initialValues.name, 
// // // // // //       initialValues.services, 
// // // // // //       initialValues.sortBy,
// // // // // //       initialValues.userLatitude, 
// // // // // //       initialValues.userLongitude, 
// // // // // //       initialValues.radiusInMeters,
// // // // // //       contextLocation, 
// // // // // //       setContextLocation 
// // // // // //   ]);

// // // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // //     const parsed = parseFloat(value);
// // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // //   };

// // // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // //     const parsed = parseInt(value, 10);
// // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // //   };

// // // // // //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// // // // // //     const lat = parseNumericInput(filterUserLatitude);
// // // // // //     const lon = parseNumericInput(filterUserLongitude);
// // // // // //     const radius = parseIntegerInput(filterRadiusInMeters);
// // // // // //     let effectiveSortBy = filterSortBy;

// // // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // // // // //       effectiveSortBy = 'distance_asc';
// // // // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // // //       effectiveSortBy = 'default'; 
// // // // // //     }
    
// // // // // //     return {
// // // // // //       name: mainSearchTerm.trim() || undefined,
// // // // // //       services: filterServices.trim() || undefined,
// // // // // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // // // // //       userLatitude: lat,
// // // // // //       userLongitude: lon,
// // // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // // //     };
// // // // // //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// // // // // //   const triggerMainSubmit = useCallback(() => {
// // // // // //     if (effectiveIsLoading) return;
// // // // // //     onSubmit(buildSubmissionCriteria());
// // // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria]);
  
// // // // // //   const getCurrentLocationAndSubmit = useCallback(async () => {
// // // // // //     if (effectiveIsLoading) return;
// // // // // //     setIsLocatingInForm(true);
// // // // // //     setFormLocationError(null);

// // // // // //     const detectedLocation = await attemptGeoLocation({
// // // // // //         targetRadius: parseIntegerInput(filterRadiusInMeters) || 500000,
// // // // // //         onError: (errorMsg) => setFormLocationError(errorMsg)
// // // // // //     });
    
// // // // // //     setIsLocatingInForm(false);

// // // // // //     if (detectedLocation) {
// // // // // //         onSubmit({
// // // // // //             name: mainSearchTerm.trim() || undefined,
// // // // // //             services: filterServices.trim() || undefined,
// // // // // //             sortBy: 'distance_asc', 
// // // // // //             userLatitude: detectedLocation.latitude,
// // // // // //             userLongitude: detectedLocation.longitude,
// // // // // //             radiusInMeters: detectedLocation.radiusInMeters
// // // // // //         });
// // // // // //     }
// // // // // //   }, [effectiveIsLoading, attemptGeoLocation, onSubmit, mainSearchTerm, filterServices, filterRadiusInMeters]); 

// // // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // // //     if (effectiveIsLoading) return;
// // // // // //     const criteria = buildSubmissionCriteria();
    
// // // // // //     const currentLat = parseNumericInput(filterUserLatitude);
// // // // // //     const currentLon = parseNumericInput(filterUserLongitude);
// // // // // //     const currentRadius = parseIntegerInput(filterRadiusInMeters) ?? contextLocation?.radiusInMeters ?? 500000;

// // // // // //     if (typeof currentLat === 'number' && typeof currentLon === 'number') {
// // // // // //         if (contextLocation?.latitude !== currentLat || contextLocation?.longitude !== currentLon || contextLocation?.radiusInMeters !== currentRadius) {
// // // // // //             setContextLocation({
// // // // // //                 latitude: currentLat,
// // // // // //                 longitude: currentLon,
// // // // // //                 radiusInMeters: currentRadius
// // // // // //             });
// // // // // //         }
// // // // // //     } else if (contextLocation) { 
// // // // // //         setContextLocation(null);
// // // // // //     }
// // // // // //     onSubmit(criteria);
// // // // // //     setIsPopoverOpen(false);
// // // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, contextLocation, setContextLocation]);

// // // // // //   const handleClearAllFilters = useCallback(() => {
// // // // // //     if (effectiveIsLoading) return;
// // // // // //     setMainSearchTerm(''); 
// // // // // //     setFilterServices(''); 
// // // // // //     setFilterSortBy('default');
// // // // // //     setFilterUserLatitude(''); 
// // // // // //     setFilterUserLongitude(''); 
// // // // // //     setFilterRadiusInMeters('500000');
// // // // // //     setFormLocationError(null);
// // // // // //     setContextLocation(null); 
// // // // // //     onSubmit({ name: undefined, services: undefined, sortBy: undefined, userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined });
// // // // // //     setIsPopoverOpen(false);
// // // // // //   }, [effectiveIsLoading, onSubmit, setContextLocation]);
  
// // // // // //   const isGeoDataSetInForm = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // // //   const activeFilterCount = useMemo(() => [
// // // // // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // // // // //     filterServices.trim() !== (initialValues.services || ''),
// // // // // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // // // // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // // // // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // // // // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetInForm),
// // // // // //   ].filter(Boolean).length, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// // // // // //   const displayLocationError = formLocationError || contextLocationError;

// // // // // //   return (
// // // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // // // // //       <div className="relative flex-grow">
// // // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // // //           <PopoverTrigger asChild>
// // // // // //             <Button
// // // // // //               type="button" variant="ghost" size="icon"
// // // // // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // //               disabled={effectiveIsLoading} aria-label="Open filters"
// // // // // //             >
// // // // // //               <FilterIcon className="h-5 w-5" />
// // // // // //               {activeFilterCount > 0 && (
// // // // // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // // // // //                   {activeFilterCount}
// // // // // //                 </span>
// // // // // //               )}
// // // // // //             </Button>
// // // // // //           </PopoverTrigger>
// // // // // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // // // // //             <div className="p-4 sm:p-5">
// // // // // //               <div className="mb-4 space-y-0.5">
// // // // // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // // // // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // // // // //               </div>
// // // // // //               <div className="grid gap-4">
// // // // // //                 <div className="space-y-1.5">
// // // // // //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // // // // //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// // // // // //                 </div>
// // // // // //                 <div className="space-y-1.5">
// // // // // //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// // // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// // // // // //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// // // // // //                     <SelectContent>
// // // // // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // // // // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // // // // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // // // // //                         {isGeoDataSetInForm && (
// // // // // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // // // // //                         )}
// // // // // //                     </SelectContent>
// // // // // //                   </Select>
// // // // // //                 </div>
// // // // // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // // // // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // // // // //                     {displayLocationError && <p className="text-xs text-red-600 px-1 pt-1">{displayLocationError}</p>}
// // // // // //                     <div className="grid grid-cols-2 gap-3">
// // // // // //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // // //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // // //                     </div>
// // // // // //                     <div className="space-y-1.5">
// // // // // //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // // // // //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder="e.g., 50000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// // // // // //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // // // // //                     </div>
// // // // // //                 </div>
// // // // // //               </div>
// // // // // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           </PopoverContent>
// // // // // //         </Popover>

// // // // // //         <Input
// // // // // //           id={`${formInstanceId}-mainSearchInput`}
// // // // // //           type="text" placeholder="Search by shop name..."
// // // // // //           value={mainSearchTerm} onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // // // // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // // // // //           disabled={effectiveIsLoading}
// // // // // //         />
        
// // // // // //         <Button
// // // // // //           type="button" variant="ghost" size="icon"
// // // // // //           className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // //           onClick={getCurrentLocationAndSubmit} 
// // // // // //           disabled={effectiveIsLoading} 
// // // // // //           aria-label="Use current location"
// // // // // //         >
// // // // // //           {isLocatingInForm || isContextLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // // // // //         </Button>
// // // // // //       </div>

// // // // // //       <Button 
// // // // // //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// // // // // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // // // // //       >
// // // // // //         {effectiveIsLoading && !isLocatingInForm && !isContextLoadingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
// // // // // //         Search
// // // // // //       </Button>
// // // // // //     </div>
// // // // // //   );
// // // // // // }
// // // // // // // // src/components/search/ShopSearchForm.tsx
// // // // // // // 'use client';

// // // // // // // import { useState, useEffect, useCallback, useMemo } from 'react';
// // // // // // // import { Input } from "@/components/ui/input";
// // // // // // // import { Button } from "@/components/ui/button";
// // // // // // // import { Label } from "@/components/ui/label";
// // // // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';
// // // // // // // import { useSimpleLocation, SimpleUserLocation } from '@/contexts/SimpleLocationContext';

// // // // // // // type ShopSearchFormSubmitParams = Pick<
// // // // // // //   FrontendShopQueryParameters, 
// // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // >;

// // // // // // // interface ShopSearchFormProps {
// // // // // // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // // // // // //   initialValues: Partial<ShopSearchFormSubmitParams>;
// // // // // // //   isLoading?: boolean; // Parent component's loading state (e.g., API fetching)
// // // // // // //   formInstanceId?: string; // To create unique input IDs if multiple forms on a page
// // // // // // // }

// // // // // // // export default function ShopSearchForm({ 
// // // // // // //     onSubmit, 
// // // // // // //     initialValues, 
// // // // // // //     isLoading: propIsLoading,
// // // // // // //     formInstanceId = 'default'
// // // // // // // }: ShopSearchFormProps) {
// // // // // // //   const { 
// // // // // // //     currentUserLocation: contextLocation, 
// // // // // // //     setCurrentUserLocation: setContextLocation,
// // // // // // //     isLoading: isContextLoadingLocation, 
// // // // // // //     error: contextLocationError,
// // // // // // //     attemptGeoLocation 
// // // // // // //   } = useSimpleLocation();

// // // // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
  
// // // // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(
// // // // // // //     initialValues.userLatitude?.toString() ?? (contextLocation?.latitude.toString() || '')
// // // // // // //   );
// // // // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(
// // // // // // //     initialValues.userLongitude?.toString() ?? (contextLocation?.longitude.toString() || '')
// // // // // // //   );
// // // // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>(
// // // // // // //     (initialValues.radiusInMeters ?? contextLocation?.radiusInMeters ?? 500000).toString()
// // // // // // //   );
  
// // // // // // //   const [isLocatingInForm, setIsLocatingInForm] = useState(false);
// // // // // // //   const [formLocationError, setFormLocationError] = useState<string | null>(null);
// // // // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // // // //   const effectiveIsLoading = propIsLoading || isContextLoadingLocation || isLocatingInForm;

// // // // // // //   useEffect(() => {
// // // // // // //     setMainSearchTerm(initialValues.name || '');
// // // // // // //     setFilterServices(initialValues.services || '');
    
// // // // // // //     let newSortBy = initialValues.sortBy || 'default';
// // // // // // //     let newLat = initialValues.userLatitude?.toString() ?? '';
// // // // // // //     let newLon = initialValues.userLongitude?.toString() ?? '';
// // // // // // //     let newRadius = (initialValues.radiusInMeters ?? 500000).toString();

// // // // // // //     // Prioritize URL params for form fields
// // // // // // //     if (initialValues.userLatitude !== undefined && initialValues.userLongitude !== undefined) {
// // // // // // //       newLat = initialValues.userLatitude.toString();
// // // // // // //       newLon = initialValues.userLongitude.toString();
// // // // // // //       newRadius = (initialValues.radiusInMeters ?? contextLocation?.radiusInMeters ?? 500000).toString();

// // // // // // //       // If URL has location, update context to reflect URL's authority for the session
// // // // // // //       // This means if a user navigates with a location URL, that becomes the session's active location
// // // // // // //       if (
// // // // // // //         contextLocation?.latitude !== initialValues.userLatitude ||
// // // // // // //         contextLocation?.longitude !== initialValues.userLongitude ||
// // // // // // //         contextLocation?.radiusInMeters !== (initialValues.radiusInMeters ?? contextLocation?.radiusInMeters)
// // // // // // //       ) {
// // // // // // //         setContextLocation({
// // // // // // //           latitude: initialValues.userLatitude,
// // // // // // //           longitude: initialValues.userLongitude,
// // // // // // //           radiusInMeters: initialValues.radiusInMeters ?? contextLocation?.radiusInMeters ?? 500000,
// // // // // // //         });
// // // // // // //       }
// // // // // // //     } else if (contextLocation) { // No URL location, but context has one
// // // // // // //       newLat = contextLocation.latitude.toString();
// // // // // // //       newLon = contextLocation.longitude.toString();
// // // // // // //       newRadius = contextLocation.radiusInMeters.toString();
// // // // // // //     }

// // // // // // //     setFilterUserLatitude(newLat);
// // // // // // //     setFilterUserLongitude(newLon);
// // // // // // //     setFilterRadiusInMeters(newRadius);

// // // // // // //     // Adjust sortBy based on availability of location
// // // // // // //     const hasLocation = !!(newLat && newLon);
// // // // // // //     if (newSortBy === 'default' && hasLocation) {
// // // // // // //       newSortBy = 'distance_asc';
// // // // // // //     } else if (!hasLocation && newSortBy === 'distance_asc') {
// // // // // // //       newSortBy = 'default';
// // // // // // //     }
// // // // // // //     setFilterSortBy(newSortBy);

// // // // // // //   }, [initialValues, contextLocation, setContextLocation]);

// // // // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // //     const parsed = parseFloat(value);
// // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // //   };

// // // // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // //     const parsed = parseInt(value, 10);
// // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // //   };

// // // // // // //   const buildSubmissionCriteria = useCallback((): ShopSearchFormSubmitParams => {
// // // // // // //     const lat = parseNumericInput(filterUserLatitude);
// // // // // // //     const lon = parseNumericInput(filterUserLongitude);
// // // // // // //     const radius = parseIntegerInput(filterRadiusInMeters);
// // // // // // //     let effectiveSortBy = filterSortBy;

// // // // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // // // // // //       effectiveSortBy = 'distance_asc';
// // // // // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // // // //       effectiveSortBy = 'default'; 
// // // // // // //     }
    
// // // // // // //     return {
// // // // // // //       name: mainSearchTerm.trim() || undefined,
// // // // // // //       services: filterServices.trim() || undefined,
// // // // // // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // // // // // //       userLatitude: lat,
// // // // // // //       userLongitude: lon,
// // // // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // // // //     };
// // // // // // //   }, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters]);

// // // // // // //   const triggerMainSubmit = useCallback(() => {
// // // // // // //     if (effectiveIsLoading) return;
// // // // // // //     onSubmit(buildSubmissionCriteria());
// // // // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria]);
  
// // // // // // //   const getCurrentLocationAndSubmit = useCallback(async () => {
// // // // // // //     if (effectiveIsLoading) return;
// // // // // // //     setIsLocatingInForm(true);
// // // // // // //     setFormLocationError(null);

// // // // // // //     const detectedLocation = await attemptGeoLocation({
// // // // // // //         targetRadius: parseIntegerInput(filterRadiusInMeters) || 500000,
// // // // // // //         onError: (errorMsg) => setFormLocationError(errorMsg)
// // // // // // //     });
    
// // // // // // //     setIsLocatingInForm(false);

// // // // // // //     if (detectedLocation) {
// // // // // // //         // Form fields will be updated by the useEffect watching contextLocation.
// // // // // // //         // For immediate submission with new values:
// // // // // // //         onSubmit({
// // // // // // //             name: mainSearchTerm.trim() || undefined,
// // // // // // //             services: filterServices.trim() || undefined,
// // // // // // //             sortBy: 'distance_asc', // Force distance sort on new detection
// // // // // // //             userLatitude: detectedLocation.latitude,
// // // // // // //             userLongitude: detectedLocation.longitude,
// // // // // // //             radiusInMeters: detectedLocation.radiusInMeters
// // // // // // //         });
// // // // // // //     }
// // // // // // //   }, [effectiveIsLoading, attemptGeoLocation, onSubmit, mainSearchTerm, filterServices, filterRadiusInMeters]); 

// // // // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // // // //     if (effectiveIsLoading) return;
// // // // // // //     const criteria = buildSubmissionCriteria();
    
// // // // // // //     // If user manually entered/cleared lat/lon in popover, update context
// // // // // // //     if (typeof criteria.userLatitude === 'number' && typeof criteria.userLongitude === 'number') {
// // // // // // //         setContextLocation({
// // // // // // //             latitude: criteria.userLatitude,
// // // // // // //             longitude: criteria.userLongitude,
// // // // // // //             radiusInMeters: criteria.radiusInMeters ?? contextLocation?.radiusInMeters ?? 500000
// // // // // // //         });
// // // // // // //     } else if (criteria.userLatitude === undefined && criteria.userLongitude === undefined) {
// // // // // // //         setContextLocation(null); // Clear context if form fields are cleared
// // // // // // //     }
// // // // // // //     onSubmit(criteria);
// // // // // // //     setIsPopoverOpen(false);
// // // // // // //   }, [effectiveIsLoading, onSubmit, buildSubmissionCriteria, setContextLocation, contextLocation?.radiusInMeters]);

// // // // // // //   const handleClearAllFilters = useCallback(() => {
// // // // // // //     if (effectiveIsLoading) return;
// // // // // // //     setMainSearchTerm(''); 
// // // // // // //     setFilterServices(''); 
// // // // // // //     setFilterSortBy('default');
// // // // // // //     setFilterUserLatitude(''); 
// // // // // // //     setFilterUserLongitude(''); 
// // // // // // //     setFilterRadiusInMeters('500000');
// // // // // // //     setFormLocationError(null);
// // // // // // //     setContextLocation(null); // Clear context location
// // // // // // //     onSubmit({ name: undefined, services: undefined, sortBy: undefined, userLatitude: undefined, userLongitude: undefined, radiusInMeters: undefined });
// // // // // // //     setIsPopoverOpen(false);
// // // // // // //   }, [effectiveIsLoading, onSubmit, setContextLocation]);
  
// // // // // // //   const isGeoDataSetInForm = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // // // //   const activeFilterCount = useMemo(() => [
// // // // // // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // // // // // //     filterServices.trim() !== (initialValues.services || ''),
// // // // // // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // // // // // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // // // // // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // // // // // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetInForm),
// // // // // // //   ].filter(Boolean).length, [mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude, filterRadiusInMeters, initialValues, isGeoDataSetInForm]);

// // // // // // //   const displayLocationError = formLocationError || contextLocationError;

// // // // // // //   return (
// // // // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // // // // // //       <div className="relative flex-grow">
// // // // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // // // //           <PopoverTrigger asChild>
// // // // // // //             <Button
// // // // // // //               type="button" variant="ghost" size="icon"
// // // // // // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // // //               disabled={effectiveIsLoading} aria-label="Open filters"
// // // // // // //             >
// // // // // // //               <FilterIcon className="h-5 w-5" />
// // // // // // //               {activeFilterCount > 0 && (
// // // // // // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // // // // // //                   {activeFilterCount}
// // // // // // //                 </span>
// // // // // // //               )}
// // // // // // //             </Button>
// // // // // // //           </PopoverTrigger>
// // // // // // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // // // // // //             <div className="p-4 sm:p-5">
// // // // // // //               <div className="mb-4 space-y-0.5">
// // // // // // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // // // // // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // // // // // //               </div>
// // // // // // //               <div className="grid gap-4">
// // // // // // //                 <div className="space-y-1.5">
// // // // // // //                   <Label htmlFor={`${formInstanceId}-filterServices`} className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // // // // // //                   <Input id={`${formInstanceId}-filterServices`} placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={effectiveIsLoading} className="h-10 text-sm"/>
// // // // // // //                 </div>
// // // // // // //                 <div className="space-y-1.5">
// // // // // // //                   <Label htmlFor={`${formInstanceId}-filterSortBy`} className="text-xs font-medium text-slate-700">Sort By</Label>
// // // // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={effectiveIsLoading}>
// // // // // // //                     <SelectTrigger className="h-10 text-sm" id={`${formInstanceId}-filterSortBy`}><SelectValue placeholder="Default" /></SelectTrigger>
// // // // // // //                     <SelectContent>
// // // // // // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // // // // // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // // // // // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // // // // // //                         {isGeoDataSetInForm && (
// // // // // // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // // // // // //                         )}
// // // // // // //                     </SelectContent>
// // // // // // //                   </Select>
// // // // // // //                 </div>
// // // // // // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // // // // // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // // // // // //                     {displayLocationError && <p className="text-xs text-red-600 px-1 pt-1">{displayLocationError}</p>}
// // // // // // //                     <div className="grid grid-cols-2 gap-3">
// // // // // // //                         <Input id={`${formInstanceId}-lat`} type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // // // //                         <Input id={`${formInstanceId}-lon`} type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setFormLocationError(null);}} disabled={effectiveIsLoading} step="any" className="h-10 text-sm"/>
// // // // // // //                     </div>
// // // // // // //                     <div className="space-y-1.5">
// // // // // // //                         <Label htmlFor={`${formInstanceId}-filterRadius`} className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // // // // // //                         <Input id={`${formInstanceId}-filterRadius`} type="number" placeholder="e.g., 50000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={effectiveIsLoading || !isGeoDataSetInForm} className="h-10 text-sm" min="100" step="100"/>
// // // // // // //                         {!isGeoDataSetInForm && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // // // // // //                     </div>
// // // // // // //                 </div>
// // // // // // //               </div>
// // // // // // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // // // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={effectiveIsLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // // // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={effectiveIsLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // // // // // //               </div>
// // // // // // //             </div>
// // // // // // //           </PopoverContent>
// // // // // // //         </Popover>

// // // // // // //         <Input
// // // // // // //           id={`${formInstanceId}-mainSearchInput`}
// // // // // // //           type="text" placeholder="Search by shop name..."
// // // // // // //           value={mainSearchTerm} onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // // // // // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // // // // // //           disabled={effectiveIsLoading}
// // // // // // //         />
        
// // // // // // //         <Button
// // // // // // //           type="button" variant="ghost" size="icon"
// // // // // // //           className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // // //           onClick={getCurrentLocationAndSubmit} 
// // // // // // //           disabled={effectiveIsLoading} 
// // // // // // //           aria-label="Use current location"
// // // // // // //         >
// // // // // // //           {isLocatingInForm || isContextLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // // // // // //         </Button>
// // // // // // //       </div>

// // // // // // //       <Button 
// // // // // // //         type="button" onClick={triggerMainSubmit} disabled={effectiveIsLoading}
// // // // // // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // // // // // //       >
// // // // // // //         {effectiveIsLoading && !isLocatingInForm && !isContextLoadingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
// // // // // // //         Search
// // // // // // //       </Button>
// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }
// // // // // // // // // src/components/search/ShopSearchForm.tsx
// // // // // // // // 'use client';

// // // // // // // // import { useState, useEffect, useCallback } from 'react';
// // // // // // // // import { Input } from "@/components/ui/input";
// // // // // // // // import { Button } from "@/components/ui/button";
// // // // // // // // import { Label } from "@/components/ui/label";
// // // // // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // // // // import { FrontendShopQueryParameters } from '@/types/api'; // This type no longer has 'category'
// // // // // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, RotateCcw } from 'lucide-react';

// // // // // // // // // The parameters this form is responsible for submitting
// // // // // // // // type ShopSearchFormSubmitParams = Pick<
// // // // // // // //   FrontendShopQueryParameters, 
// // // // // // // //   'name' | 'services' | 'sortBy' | 'userLatitude' | 'userLongitude' | 'radiusInMeters'
// // // // // // // // >;

// // // // // // // // interface ShopSearchFormProps {
// // // // // // // //   onSubmit: (searchCriteria: ShopSearchFormSubmitParams) => void;
// // // // // // // //   initialValues: Partial<ShopSearchFormSubmitParams>; // Partial of the submit params
// // // // // // // //   isLoading?: boolean;
// // // // // // // // }

// // // // // // // // export default function ShopSearchForm({ onSubmit, initialValues, isLoading }: ShopSearchFormProps) {
// // // // // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // // // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(initialValues.userLatitude?.toString() ?? '');
// // // // // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(initialValues.userLongitude?.toString() ?? '');
// // // // // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>((initialValues.radiusInMeters || 500000).toString());
  
// // // // // // // //   const [isLocating, setIsLocating] = useState(false);
// // // // // // // //   const [locationError, setLocationError] = useState<string | null>(null);
// // // // // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // // // // //   useEffect(() => {
// // // // // // // //     // Reset form fields when initialValues change (e.g., from URL query params)
// // // // // // // //     setMainSearchTerm(initialValues.name || '');
// // // // // // // //     setFilterServices(initialValues.services || '');
// // // // // // // //     setFilterSortBy(initialValues.sortBy || 'default');
// // // // // // // //     setFilterUserLatitude(initialValues.userLatitude?.toString() ?? '');
// // // // // // // //     setFilterUserLongitude(initialValues.userLongitude?.toString() ?? '');
// // // // // // // //     setFilterRadiusInMeters((initialValues.radiusInMeters || 500000).toString());
// // // // // // // //   }, [initialValues]);

// // // // // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // //     const parsed = parseFloat(value);
// // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // //   };
// // // // // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // //     const parsed = parseInt(value, 10);
// // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // //   };

// // // // // // // //   const buildSubmissionCriteria = useCallback((
// // // // // // // //     currentMainSearchTerm: string,
// // // // // // // //     currentFilterServices: string,
// // // // // // // //     currentFilterSortBy: string,
// // // // // // // //     currentLatFromGeo?: number, // Latitude obtained from geolocation
// // // // // // // //     currentLonFromGeo?: number, // Longitude obtained from geolocation
// // // // // // // //     currentRadiusFromGeo?: number // Radius, potentially default if from geo
// // // // // // // //   ): ShopSearchFormSubmitParams => {
// // // // // // // //     const lat = currentLatFromGeo ?? parseNumericInput(filterUserLatitude);
// // // // // // // //     const lon = currentLonFromGeo ?? parseNumericInput(filterUserLongitude);
// // // // // // // //     const radius = currentRadiusFromGeo ?? parseIntegerInput(filterRadiusInMeters);

// // // // // // // //     let effectiveSortBy = currentFilterSortBy;
// // // // // // // //     // If location is provided, and current sort is default or not already distance, prefer distance sort.
// // // // // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || !['distance_asc', 'name_asc', 'name_desc'].includes(effectiveSortBy))) {
// // // // // // // //       effectiveSortBy = 'distance_asc';
// // // // // // // //     } 
// // // // // // // //     // If location is NOT provided, but sort is distance_asc, revert to default.
// // // // // // // //     else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // // // // //       effectiveSortBy = 'default'; 
// // // // // // // //     }
    
// // // // // // // //     return {
// // // // // // // //       name: currentMainSearchTerm.trim() || undefined,
// // // // // // // //       services: currentFilterServices.trim() || undefined,
// // // // // // // //       sortBy: effectiveSortBy === 'default' ? undefined : (effectiveSortBy.trim() || undefined),
// // // // // // // //       userLatitude: lat,
// // // // // // // //       userLongitude: lon,
// // // // // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // // // // //       // pageSize is handled by the parent component where useInfiniteQuery is defined.
// // // // // // // //     };
// // // // // // // //   }, [filterUserLatitude, filterUserLongitude, filterRadiusInMeters]); // Removed filterServices, filterSortBy as they are passed directly
  
// // // // // // // //   const triggerMainSubmit = useCallback(() => {
// // // // // // // //     if (isLoading || isLocating) return;
// // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy));
// // // // // // // //   }, [isLoading, isLocating, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy]);
  
// // // // // // // //   const getCurrentLocationAndSubmit = useCallback(() => {
// // // // // // // //     if (!navigator.geolocation) {
// // // // // // // //       setLocationError("Geolocation is not supported by your browser."); 
// // // // // // // //       return;
// // // // // // // //     }
// // // // // // // //     setIsLocating(true); 
// // // // // // // //     setLocationError(null);
// // // // // // // //     navigator.geolocation.getCurrentPosition(
// // // // // // // //       (position) => {
// // // // // // // //         const lat = parseFloat(position.coords.latitude.toFixed(6));
// // // // // // // //         const lon = parseFloat(position.coords.longitude.toFixed(6));
// // // // // // // //         // Keep current radius from form or use default if not set
// // // // // // // //         const currentRadiusValue = parseIntegerInput(filterRadiusInMeters) || 500000; 

// // // // // // // //         setFilterUserLatitude(lat.toString());
// // // // // // // //         setFilterUserLongitude(lon.toString());
// // // // // // // //         setFilterRadiusInMeters(currentRadiusValue.toString()); // Reflect update in form
// // // // // // // //         // setFilterSortBy('distance_asc'); // Let buildSubmissionCriteria handle this logic
// // // // // // // //         setIsLocating(false);
        
// // // // // // // //         // Submit with determined location and current services/name filters
// // // // // // // //         onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, 'distance_asc', lat, lon, currentRadiusValue));
// // // // // // // //       },
// // // // // // // //       (error) => { 
// // // // // // // //         setIsLocating(false); 
// // // // // // // //         setLocationError(`Location Error: ${error.message}`); 
// // // // // // // //         console.warn("Geolocation error:", error);
// // // // // // // //       },
// // // // // // // //       { timeout: 10000, enableHighAccuracy: false } // Slightly less accuracy for faster response
// // // // // // // //     );
// // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterRadiusInMeters]); 

// // // // // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // // // // //     if (isLoading) return;
// // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy, parseNumericInput(filterUserLatitude), parseNumericInput(filterUserLongitude)));
// // // // // // // //     setIsPopoverOpen(false);
// // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy, filterUserLatitude, filterUserLongitude]);

// // // // // // // //   const handleClearAllFilters = useCallback(() => {
// // // // // // // //     if (isLoading) return;
// // // // // // // //     const clearedCriteria: ShopSearchFormSubmitParams = {
// // // // // // // //         name: undefined,
// // // // // // // //         services: undefined,
// // // // // // // //         sortBy: undefined, // Backend default
// // // // // // // //         userLatitude: undefined,
// // // // // // // //         userLongitude: undefined,
// // // // // // // //         radiusInMeters: undefined // Or 500000 if you always want a default radius shown
// // // // // // // //     };
// // // // // // // //     setMainSearchTerm(''); 
// // // // // // // //     setFilterServices(''); 
// // // // // // // //     setFilterSortBy('default');
// // // // // // // //     setFilterUserLatitude(''); 
// // // // // // // //     setFilterUserLongitude(''); 
// // // // // // // //     setFilterRadiusInMeters('500000'); // Reset UI to default radius
// // // // // // // //     setLocationError(null);
// // // // // // // //     onSubmit(clearedCriteria); // Submit cleared criteria
// // // // // // // //     setIsPopoverOpen(false);
// // // // // // // //   }, [isLoading, onSubmit]);
  
// // // // // // // //   const isGeoDataSetForSortOption = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // // // // //   const activeFilterCount = [
// // // // // // // //     mainSearchTerm.trim() !== (initialValues.name || ''),
// // // // // // // //     filterServices.trim() !== (initialValues.services || ''),
// // // // // // // //     filterSortBy !== (initialValues.sortBy || 'default'),
// // // // // // // //     // Count location/radius only if they differ from initial or are actively set
// // // // // // // //     (filterUserLatitude && filterUserLatitude !== initialValues.userLatitude?.toString()),
// // // // // // // //     (filterUserLongitude && filterUserLongitude !== initialValues.userLongitude?.toString()),
// // // // // // // //     (filterRadiusInMeters && filterRadiusInMeters !== (initialValues.radiusInMeters || 500000).toString() && isGeoDataSetForSortOption),
// // // // // // // //   ].filter(Boolean).length;


// // // // // // // //   return (
// // // // // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-slate-200">
// // // // // // // //       <div className="relative flex-grow">
// // // // // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // // // // //           <PopoverTrigger asChild>
// // // // // // // //             <Button
// // // // // // // //               type="button" variant="ghost" size="icon"
// // // // // // // //               className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // // // //               disabled={isLoading || isLocating} aria-label="Open filters"
// // // // // // // //             >
// // // // // // // //               <FilterIcon className="h-5 w-5" />
// // // // // // // //               {activeFilterCount > 0 && (
// // // // // // // //                 <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white ring-2 ring-white">
// // // // // // // //                   {activeFilterCount}
// // // // // // // //                 </span>
// // // // // // // //               )}
// // // // // // // //             </Button>
// // // // // // // //           </PopoverTrigger>
// // // // // // // //           <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 rounded-xl shadow-2xl mt-2">
// // // // // // // //             <div className="p-4 sm:p-5">
// // // // // // // //               <div className="mb-4 space-y-0.5">
// // // // // // // //                 <h4 className="font-semibold text-lg text-slate-800">Filters & Sort Options</h4>
// // // // // // // //                 <p className="text-sm text-slate-500">Customize your search results.</p>
// // // // // // // //               </div>
// // // // // // // //               <div className="grid gap-4">
// // // // // // // //                 <div className="space-y-1.5">
// // // // // // // //                   <Label htmlFor="filterServices" className="text-xs font-medium text-slate-700">Services Offered (keywords)</Label>
// // // // // // // //                   <Input id="filterServices" placeholder="e.g., Oil Change, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={isLoading} className="h-10 text-sm"/>
// // // // // // // //                 </div>
// // // // // // // //                 <div className="space-y-1.5">
// // // // // // // //                   <Label htmlFor="filterSortBy" className="text-xs font-medium text-slate-700">Sort By</Label>
// // // // // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={isLoading}>
// // // // // // // //                     <SelectTrigger className="h-10 text-sm" id="filterSortBy"><SelectValue placeholder="Default" /></SelectTrigger>
// // // // // // // //                     <SelectContent>
// // // // // // // //                         <SelectItem value="default">Default (Best Match / Name)</SelectItem>
// // // // // // // //                         <SelectItem value="name_asc">Name (A-Z)</SelectItem>
// // // // // // // //                         <SelectItem value="name_desc">Name (Z-A)</SelectItem>
// // // // // // // //                         {isGeoDataSetForSortOption && ( // Only show distance sort if lat/lon are set in form
// // // // // // // //                             <SelectItem value="distance_asc">Distance (Nearest)</SelectItem>
// // // // // // // //                         )}
// // // // // // // //                     </SelectContent>
// // // // // // // //                   </Select>
// // // // // // // //                 </div>
// // // // // // // //                 <div className="space-y-2 pt-3 border-t border-slate-200">
// // // // // // // //                     <Label className="text-xs font-medium text-slate-700 block">Filter by Location (Optional)</Label>
// // // // // // // //                     {locationError && <p className="text-xs text-red-600">{locationError}</p>}
// // // // // // // //                     <div className="grid grid-cols-2 gap-3">
// // // // // // // //                         <Input type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => {setFilterUserLatitude(e.target.value); setLocationError(null);}} disabled={isLoading} step="any" className="h-10 text-sm"/>
// // // // // // // //                         <Input type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => {setFilterUserLongitude(e.target.value); setLocationError(null);}} disabled={isLoading} step="any" className="h-10 text-sm"/>
// // // // // // // //                     </div>
// // // // // // // //                     <div className="space-y-1.5">
// // // // // // // //                         <Label htmlFor="filterRadius" className="text-xs font-medium text-slate-700">Search Radius (meters)</Label>
// // // // // // // //                         <Input id="filterRadius" type="number" placeholder="e.g., 500000 for 5km" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={isLoading || !isGeoDataSetForSortOption} className="h-10 text-sm" min="100" step="100"/>
// // // // // // // //                         {!isGeoDataSetForSortOption && <p className="text-xs text-slate-400 mt-1">Enter latitude & longitude to enable radius filter.</p>}
// // // // // // // //                     </div>
// // // // // // // //                 </div>
// // // // // // // //               </div>
// // // // // // // //               <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200">
// // // // // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={isLoading} size="sm" className="text-xs text-slate-600 hover:text-slate-800"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
// // // // // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={isLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2">Apply Filters</Button>
// // // // // // // //               </div>
// // // // // // // //             </div>
// // // // // // // //           </PopoverContent>
// // // // // // // //         </Popover>

// // // // // // // //         <Input
// // // // // // // //           type="text" placeholder="Search by shop name..."
// // // // // // // //           value={mainSearchTerm} onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}}
// // // // // // // //           className="pl-12 pr-12 h-12 text-sm sm:text-base w-full rounded-full border-slate-300 focus:border-orange-500 focus:ring-orange-500"
// // // // // // // //           disabled={isLoading || isLocating}
// // // // // // // //         />
        
// // // // // // // //         <Button
// // // // // // // //           type="button" variant="ghost" size="icon"
// // // // // // // //           className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 z-10 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-full disabled:opacity-50"
// // // // // // // //           onClick={getCurrentLocationAndSubmit} disabled={isLoading || isLocating} aria-label="Use current location"
// // // // // // // //         >
// // // // // // // //           {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
// // // // // // // //         </Button>
// // // // // // // //       </div>

// // // // // // // //       <Button 
// // // // // // // //         type="button" onClick={triggerMainSubmit} disabled={isLoading || isLocating}
// // // // // // // //         className="h-12 px-6 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
// // // // // // // //       >
// // // // // // // //         <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
// // // // // // // //         Search
// // // // // // // //       </Button>
// // // // // // // //     </div>
// // // // // // // //   );
// // // // // // // // }
// // // // // // // // // // src/components/search/ShopSearchForm.tsx
// // // // // // // // // 'use client';

// // // // // // // // // import { useState, FormEvent, useEffect, useCallback } from 'react'; // Added useCallback
// // // // // // // // // import { Input } from "@/components/ui/input";
// // // // // // // // // import { Button } from "@/components/ui/button";
// // // // // // // // // import { Label } from "@/components/ui/label";
// // // // // // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // // // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // // // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, XCircle, RotateCcw } from 'lucide-react';

// // // // // // // // // interface ShopSearchFormProps {
// // // // // // // // //   onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // // // // // //   initialValues: Partial<FrontendShopQueryParameters>; 
// // // // // // // // //   isLoading?: boolean;
// // // // // // // // // }

// // // // // // // // // export default function ShopSearchForm({ onSubmit, initialValues, isLoading }: ShopSearchFormProps) {
// // // // // // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // // // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // // // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // // // // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(initialValues.userLatitude?.toString() ?? '');
// // // // // // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(initialValues.userLongitude?.toString() ?? '');
// // // // // // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>((initialValues.radiusInMeters || 500000).toString());
  
// // // // // // // // //   const [isLocating, setIsLocating] = useState(false);
// // // // // // // // //   const [locationError, setLocationError] = useState<string | null>(null);
// // // // // // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // // // // // //   useEffect(() => {
// // // // // // // // //     setMainSearchTerm(initialValues.name || '');
// // // // // // // // //     setFilterServices(initialValues.services || '');
// // // // // // // // //     setFilterSortBy(initialValues.sortBy || 'default');
// // // // // // // // //     setFilterUserLatitude(initialValues.userLatitude?.toString() ?? '');
// // // // // // // // //     setFilterUserLongitude(initialValues.userLongitude?.toString() ?? '');
// // // // // // // // //     setFilterRadiusInMeters((initialValues.radiusInMeters || 500000).toString());
// // // // // // // // //   }, [initialValues]);

// // // // // // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // // //     const parsed = parseFloat(value);
// // // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // // //   };
// // // // // // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // // //     const parsed = parseInt(value, 10);
// // // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // // //   };

// // // // // // // // //   const buildSubmissionCriteria = useCallback((
// // // // // // // // //     currentMainSearchTerm: string,
// // // // // // // // //     currentFilterServices: string,
// // // // // // // // //     currentFilterSortBy: string,
// // // // // // // // //     currentLatFromGeo?: number,
// // // // // // // // //     currentLonFromGeo?: number,
// // // // // // // // //     currentRadiusFromGeo?: number
// // // // // // // // //   ): Partial<FrontendShopQueryParameters> => {
// // // // // // // // //     const lat = currentLatFromGeo ?? parseNumericInput(filterUserLatitude);
// // // // // // // // //     const lon = currentLonFromGeo ?? parseNumericInput(filterUserLongitude);
// // // // // // // // //     const radius = currentRadiusFromGeo ?? parseIntegerInput(filterRadiusInMeters);

// // // // // // // // //     let effectiveSortBy = currentFilterSortBy;
// // // // // // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || effectiveSortBy !== 'distance_asc')) {
// // // // // // // // //       effectiveSortBy = 'distance_asc'; 
// // // // // // // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // // // // // //       effectiveSortBy = 'default'; 
// // // // // // // // //     }
    
// // // // // // // // //     return {
// // // // // // // // //       name: currentMainSearchTerm.trim() || undefined,
// // // // // // // // //       services: currentFilterServices.trim() || undefined,
// // // // // // // // //       sortBy: effectiveSortBy === 'default' ? undefined : effectiveSortBy.trim() || undefined,
// // // // // // // // //       userLatitude: lat,
// // // // // // // // //       userLongitude: lon,
// // // // // // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // // // // // //       pageSize: initialValues.pageSize,
// // // // // // // // //     };
// // // // // // // // //   }, [filterUserLatitude, filterUserLongitude, filterRadiusInMeters, filterServices, filterSortBy, initialValues.pageSize]); // Added dependencies for useCallback
  
// // // // // // // // //   // Handler for "Let's Go" button and Enter on main input
// // // // // // // // //   const triggerMainSubmit = useCallback(() => {
// // // // // // // // //     if (isLoading || isLocating) return;
// // // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy));
// // // // // // // // //   }, [isLoading, isLocating, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy]);
  
// // // // // // // // //   const getCurrentLocationAndSubmit = useCallback(() => {
// // // // // // // // //     if (!navigator.geolocation) {
// // // // // // // // //       setLocationError("Geolocation is not supported."); return;
// // // // // // // // //     }
// // // // // // // // //     setIsLocating(true); setLocationError(null);
// // // // // // // // //     navigator.geolocation.getCurrentPosition(
// // // // // // // // //       (position) => {
// // // // // // // // //         const lat = parseFloat(position.coords.latitude.toFixed(6));
// // // // // // // // //         const lon = parseFloat(position.coords.longitude.toFixed(6));
// // // // // // // // //         const currentRadiusValue = parseIntegerInput(filterRadiusInMeters) || 500000;

// // // // // // // // //         setFilterUserLatitude(lat.toString());
// // // // // // // // //         setFilterUserLongitude(lon.toString());
// // // // // // // // //         setFilterRadiusInMeters(currentRadiusValue.toString());
// // // // // // // // //         // setFilterSortBy('distance_asc'); // Not setting here, buildSubmissionCriteria will handle it
// // // // // // // // //         setIsLocating(false);
        
// // // // // // // // //         onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, 'distance_asc', lat, lon, currentRadiusValue));
// // // // // // // // //       },
// // // // // // // // //       (error) => { setIsLocating(false); setLocationError(`Location Error: ${error.message}`); },
// // // // // // // // //       { timeout: 10000, enableHighAccuracy: true }
// // // // // // // // //     );
// // // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterRadiusInMeters]); // Added dependencies

// // // // // // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // // // // // //     if (isLoading) return;
// // // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy));
// // // // // // // // //     setIsPopoverOpen(false);
// // // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy]);

// // // // // // // // //   const handleClearAllFilters = useCallback(() => {
// // // // // // // // //     if (isLoading) return;
// // // // // // // // //     setMainSearchTerm(''); 
// // // // // // // // //     setFilterServices(''); 
// // // // // // // // //     setFilterSortBy('default');
// // // // // // // // //     setFilterUserLatitude(''); 
// // // // // // // // //     setFilterUserLongitude(''); 
// // // // // // // // //     setFilterRadiusInMeters('500000');
// // // // // // // // //     setLocationError(null);
// // // // // // // // //     onSubmit({ pageSize: initialValues.pageSize });
// // // // // // // // //     setIsPopoverOpen(false);
// // // // // // // // //   }, [isLoading, onSubmit, initialValues.pageSize]);
  
// // // // // // // // //   const isGeoDataSetForSortOption = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // // // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // // // // // //   const activeFilterCount = [
// // // // // // // // //     mainSearchTerm.trim(), 
// // // // // // // // //     filterServices.trim(), 
// // // // // // // // //     filterSortBy !== 'default' ? filterSortBy.trim() : '',
// // // // // // // // //     isGeoDataSetForSortOption && parseIntegerInput(filterRadiusInMeters),
// // // // // // // // //   ].filter(v => v !== undefined && v !== null && v !== '' && v !== false && v !== 0).length;

// // // // // // // // //   return (
// // // // // // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full">
// // // // // // // // //       <div className="relative flex-grow">
// // // // // // // // //         {/* Filter Button - now in left position */}
// // // // // // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // // // // // //           <PopoverTrigger asChild>
// // // // // // // // //             <Button
// // // // // // // // //               type="button"
// // // // // // // // //               variant="ghost"
// // // // // // // // //               size="icon"
// // // // // // // // //               className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 z-10 text-slate-500 hover:text-slate-800 disabled:text-slate-400"
// // // // // // // // //               disabled={isLoading || isLocating}
// // // // // // // // //               aria-label="Open advanced filters"
// // // // // // // // //             >
// // // // // // // // //               <FilterIcon className="h-4 w-4 sm:h-5 sm:w-5" />
// // // // // // // // //               {activeFilterCount > 0 && (
// // // // // // // // //                 <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
// // // // // // // // //                   {activeFilterCount}
// // // // // // // // //                 </span>
// // // // // // // // //               )}
// // // // // // // // //             </Button>
// // // // // // // // //           </PopoverTrigger>
// // // // // // // // //           <PopoverContent className="w-80 p-0 bg-white border border-slate-200 rounded-lg shadow-lg">
// // // // // // // // //             <div className="p-4 sm:p-6 space-y-4">
// // // // // // // // //               <div className="space-y-1">
// // // // // // // // //                 <h4 className="font-semibold leading-none text-lg text-slate-800">Advanced Filters</h4>
// // // // // // // // //                 <p className="text-sm text-slate-500">Refine your search criteria.</p>
// // // // // // // // //               </div>
// // // // // // // // //               <div className="grid gap-3">
// // // // // // // // //                 <div className="space-y-1.5">
// // // // // // // // //                   <Label htmlFor="filterServices" className="text-xs text-slate-700">Services</Label>
// // // // // // // // //                   <Input id="filterServices" placeholder="e.g., Oil, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={isLoading} className="h-9 text-sm bg-white border-slate-300"/>
// // // // // // // // //                 </div>
// // // // // // // // //                 <div className="space-y-1.5">
// // // // // // // // //                   <Label htmlFor="filterSortBy" className="text-xs text-slate-700">Sort By</Label>
// // // // // // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={isLoading}>
// // // // // // // // //                     <SelectTrigger className="h-9 text-sm bg-white border-slate-300" id="filterSortBy">
// // // // // // // // //                         <SelectValue placeholder="Default (Name Asc)" />
// // // // // // // // //                     </SelectTrigger>
// // // // // // // // //                     <SelectContent className="bg-white">
// // // // // // // // //                         <SelectItem value="default" className="hover:bg-slate-100">Default (Name Asc)</SelectItem>
// // // // // // // // //                         <SelectItem value="name_asc" className="hover:bg-slate-100">Name (A-Z)</SelectItem>
// // // // // // // // //                         <SelectItem value="name_desc" className="hover:bg-slate-100">Name (Z-A)</SelectItem>
// // // // // // // // //                         {(isGeoDataSetForSortOption || (initialValues.userLatitude && initialValues.userLongitude)) && (
// // // // // // // // //                             <SelectItem value="distance_asc" className="hover:bg-slate-100">Distance (Nearest)</SelectItem>
// // // // // // // // //                         )}
// // // // // // // // //                     </SelectContent>
// // // // // // // // //                   </Select>
// // // // // // // // //                 </div>
// // // // // // // // //                 <div className="space-y-1.5 pt-2 border-t border-slate-200">
// // // // // // // // //                     <Label className="text-xs text-slate-700 font-medium block mb-1">Manual Location</Label>
// // // // // // // // //                     {locationError && <p className="text-xs text-red-500 mt-0.5">{locationError}</p>}
// // // // // // // // //                     <div className="grid grid-cols-2 gap-2">
// // // // // // // // //                         <Input type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => setFilterUserLatitude(e.target.value)} disabled={isLoading} step="any" className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // //                         <Input type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => setFilterUserLongitude(e.target.value)} disabled={isLoading} step="any" className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // //                     </div>
// // // // // // // // //                     <Label htmlFor="filterRadius" className="text-xs text-slate-700 pt-1 block">Radius (meters)</Label>
// // // // // // // // //                     <Input id="filterRadius" type="number" placeholder="e.g., 500000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={isLoading || !isGeoDataSetForSortOption} className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // //                 </div>
// // // // // // // // //               </div>
// // // // // // // // //               <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
// // // // // // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={isLoading} size="sm" className="text-xs"><RotateCcw className="mr-1.5 h-3 w-3" /> Reset All</Button>
// // // // // // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={isLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Apply Filters</Button>
// // // // // // // // //               </div>
// // // // // // // // //             </div>
// // // // // // // // //           </PopoverContent>
// // // // // // // // //         </Popover>

// // // // // // // // //         <Input
// // // // // // // // //           type="text"
// // // // // // // // //           placeholder="🔍 Search shop name, area..."
// // // // // // // // //           value={mainSearchTerm}
// // // // // // // // //           onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // // // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}} // Use triggerMainSubmit
// // // // // // // // //           className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 text-sm sm:text-base w-full rounded-full shadow-sm bg-white text-slate-900 placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
// // // // // // // // //           disabled={isLoading || isLocating}
// // // // // // // // //         />
        
// // // // // // // // //         {/* Location Button */}
// // // // // // // // //         <Button
// // // // // // // // //           type="button"
// // // // // // // // //           variant="ghost"
// // // // // // // // //           size="icon"
// // // // // // // // //           className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 z-10 text-slate-500 hover:text-slate-800 disabled:text-slate-400"
// // // // // // // // //           onClick={getCurrentLocationAndSubmit}
// // // // // // // // //           disabled={isLoading || isLocating}
// // // // // // // // //           aria-label="Use my current location"
// // // // // // // // //         >
// // // // // // // // //           {isLocating ? (
// // // // // // // // //             <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
// // // // // // // // //           ) : (
// // // // // // // // //             <LocateFixed className="h-4 w-4 sm:h-5 sm:w-5" />
// // // // // // // // //           )}
// // // // // // // // //         </Button>
// // // // // // // // //       </div>

// // // // // // // // //       <Button 
// // // // // // // // //         type="button" 
// // // // // // // // //         onClick={triggerMainSubmit} // Use the new handler
// // // // // // // // //         disabled={isLoading || isLocating}
// // // // // // // // //         className="h-12 sm:h-14 px-5 sm:px-6 rounded-full bg-orange-500 text-white text-sm sm:text-base font-semibold hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 flex-shrink-0"
// // // // // // // // //       >
// // // // // // // // //         Let's go
// // // // // // // // //       </Button>
// // // // // // // // //     </div>
// // // // // // // // //   );
// // // // // // // // // }
// // // // // // // // // // // src/components/search/ShopSearchForm.tsx
// // // // // // // // // // 'use client';

// // // // // // // // // // import { useState, FormEvent, useEffect, useCallback } from 'react'; // Added useCallback
// // // // // // // // // // import { Input } from "@/components/ui/input";
// // // // // // // // // // import { Button } from "@/components/ui/button";
// // // // // // // // // // import { Label } from "@/components/ui/label";
// // // // // // // // // // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// // // // // // // // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // // // // // // // import { FrontendShopQueryParameters } from '@/types/api';
// // // // // // // // // // import { Search, LocateFixed, Loader2, Filter as FilterIcon, XCircle, RotateCcw } from 'lucide-react';

// // // // // // // // // // interface ShopSearchFormProps {
// // // // // // // // // //   onSubmit: (searchCriteria: Partial<FrontendShopQueryParameters>) => void;
// // // // // // // // // //   initialValues: Partial<FrontendShopQueryParameters>; 
// // // // // // // // // //   isLoading?: boolean;
// // // // // // // // // // }

// // // // // // // // // // export default function ShopSearchForm({ onSubmit, initialValues, isLoading }: ShopSearchFormProps) {
// // // // // // // // // //   const [mainSearchTerm, setMainSearchTerm] = useState(initialValues.name || '');
// // // // // // // // // //   const [filterServices, setFilterServices] = useState(initialValues.services || '');
// // // // // // // // // //   const [filterSortBy, setFilterSortBy] = useState(initialValues.sortBy || 'default');
// // // // // // // // // //   const [filterUserLatitude, setFilterUserLatitude] = useState<string>(initialValues.userLatitude?.toString() ?? '');
// // // // // // // // // //   const [filterUserLongitude, setFilterUserLongitude] = useState<string>(initialValues.userLongitude?.toString() ?? '');
// // // // // // // // // //   const [filterRadiusInMeters, setFilterRadiusInMeters] = useState<string>((initialValues.radiusInMeters || 500000).toString());
  
// // // // // // // // // //   const [isLocating, setIsLocating] = useState(false);
// // // // // // // // // //   const [locationError, setLocationError] = useState<string | null>(null);
// // // // // // // // // //   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

// // // // // // // // // //   useEffect(() => {
// // // // // // // // // //     setMainSearchTerm(initialValues.name || '');
// // // // // // // // // //     setFilterServices(initialValues.services || '');
// // // // // // // // // //     setFilterSortBy(initialValues.sortBy || 'default');
// // // // // // // // // //     setFilterUserLatitude(initialValues.userLatitude?.toString() ?? '');
// // // // // // // // // //     setFilterUserLongitude(initialValues.userLongitude?.toString() ?? '');
// // // // // // // // // //     setFilterRadiusInMeters((initialValues.radiusInMeters || 500000).toString());
// // // // // // // // // //   }, [initialValues]);

// // // // // // // // // //   const parseNumericInput = (value: string | undefined): number | undefined => {
// // // // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // // // //     const parsed = parseFloat(value);
// // // // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // // // //   };
// // // // // // // // // //   const parseIntegerInput = (value: string | undefined): number | undefined => {
// // // // // // // // // //     if (value === undefined || value.trim() === '') return undefined;
// // // // // // // // // //     const parsed = parseInt(value, 10);
// // // // // // // // // //     return isNaN(parsed) ? undefined : parsed;
// // // // // // // // // //   };

// // // // // // // // // //   const buildSubmissionCriteria = useCallback((
// // // // // // // // // //     currentMainSearchTerm: string,
// // // // // // // // // //     currentFilterServices: string,
// // // // // // // // // //     currentFilterSortBy: string,
// // // // // // // // // //     currentLatFromGeo?: number,
// // // // // // // // // //     currentLonFromGeo?: number,
// // // // // // // // // //     currentRadiusFromGeo?: number
// // // // // // // // // //   ): Partial<FrontendShopQueryParameters> => {
// // // // // // // // // //     const lat = currentLatFromGeo ?? parseNumericInput(filterUserLatitude);
// // // // // // // // // //     const lon = currentLonFromGeo ?? parseNumericInput(filterUserLongitude);
// // // // // // // // // //     const radius = currentRadiusFromGeo ?? parseIntegerInput(filterRadiusInMeters);

// // // // // // // // // //     let effectiveSortBy = currentFilterSortBy;
// // // // // // // // // //     if (typeof lat === 'number' && typeof lon === 'number' && (effectiveSortBy === 'default' || effectiveSortBy !== 'distance_asc')) {
// // // // // // // // // //       effectiveSortBy = 'distance_asc'; 
// // // // // // // // // //     } else if ((typeof lat !== 'number' || typeof lon !== 'number') && effectiveSortBy === 'distance_asc') {
// // // // // // // // // //       effectiveSortBy = 'default'; 
// // // // // // // // // //     }
    
// // // // // // // // // //     return {
// // // // // // // // // //       name: currentMainSearchTerm.trim() || undefined,
// // // // // // // // // //       services: currentFilterServices.trim() || undefined,
// // // // // // // // // //       sortBy: effectiveSortBy === 'default' ? undefined : effectiveSortBy.trim() || undefined,
// // // // // // // // // //       userLatitude: lat,
// // // // // // // // // //       userLongitude: lon,
// // // // // // // // // //       radiusInMeters: (typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number' && radius > 0) ? radius : undefined,
// // // // // // // // // //       pageSize: initialValues.pageSize,
// // // // // // // // // //     };
// // // // // // // // // //   }, [filterUserLatitude, filterUserLongitude, filterRadiusInMeters, filterServices, filterSortBy, initialValues.pageSize]); // Added dependencies for useCallback
  
// // // // // // // // // //   // Handler for "Let's Go" button and Enter on main input
// // // // // // // // // //   const triggerMainSubmit = useCallback(() => {
// // // // // // // // // //     if (isLoading || isLocating) return;
// // // // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy));
// // // // // // // // // //   }, [isLoading, isLocating, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy]);
  
// // // // // // // // // //   const getCurrentLocationAndSubmit = useCallback(() => {
// // // // // // // // // //     if (!navigator.geolocation) {
// // // // // // // // // //       setLocationError("Geolocation is not supported."); return;
// // // // // // // // // //     }
// // // // // // // // // //     setIsLocating(true); setLocationError(null);
// // // // // // // // // //     navigator.geolocation.getCurrentPosition(
// // // // // // // // // //       (position) => {
// // // // // // // // // //         const lat = parseFloat(position.coords.latitude.toFixed(6));
// // // // // // // // // //         const lon = parseFloat(position.coords.longitude.toFixed(6));
// // // // // // // // // //         const currentRadiusValue = parseIntegerInput(filterRadiusInMeters) || 500000;

// // // // // // // // // //         setFilterUserLatitude(lat.toString());
// // // // // // // // // //         setFilterUserLongitude(lon.toString());
// // // // // // // // // //         setFilterRadiusInMeters(currentRadiusValue.toString());
// // // // // // // // // //         // setFilterSortBy('distance_asc'); // Not setting here, buildSubmissionCriteria will handle it
// // // // // // // // // //         setIsLocating(false);
        
// // // // // // // // // //         onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, 'distance_asc', lat, lon, currentRadiusValue));
// // // // // // // // // //       },
// // // // // // // // // //       (error) => { setIsLocating(false); setLocationError(`Location Error: ${error.message}`); },
// // // // // // // // // //       { timeout: 10000, enableHighAccuracy: true }
// // // // // // // // // //     );
// // // // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterRadiusInMeters]); // Added dependencies

// // // // // // // // // //   const handleApplyFiltersFromPopover = useCallback(() => {
// // // // // // // // // //     if (isLoading) return;
// // // // // // // // // //     onSubmit(buildSubmissionCriteria(mainSearchTerm, filterServices, filterSortBy));
// // // // // // // // // //     setIsPopoverOpen(false);
// // // // // // // // // //   }, [isLoading, onSubmit, buildSubmissionCriteria, mainSearchTerm, filterServices, filterSortBy]);

// // // // // // // // // //   const handleClearAllFilters = useCallback(() => {
// // // // // // // // // //     if (isLoading) return;
// // // // // // // // // //     setMainSearchTerm(''); 
// // // // // // // // // //     setFilterServices(''); 
// // // // // // // // // //     setFilterSortBy('default');
// // // // // // // // // //     setFilterUserLatitude(''); 
// // // // // // // // // //     setFilterUserLongitude(''); 
// // // // // // // // // //     setFilterRadiusInMeters('500000');
// // // // // // // // // //     setLocationError(null);
// // // // // // // // // //     onSubmit({ pageSize: initialValues.pageSize });
// // // // // // // // // //     setIsPopoverOpen(false);
// // // // // // // // // //   }, [isLoading, onSubmit, initialValues.pageSize]);
  
// // // // // // // // // //   const isGeoDataSetForSortOption = typeof parseNumericInput(filterUserLatitude) === 'number' && 
// // // // // // // // // //                                    typeof parseNumericInput(filterUserLongitude) === 'number';

// // // // // // // // // //   const activeFilterCount = [
// // // // // // // // // //     mainSearchTerm.trim(), 
// // // // // // // // // //     filterServices.trim(), 
// // // // // // // // // //     filterSortBy !== 'default' ? filterSortBy.trim() : '',
// // // // // // // // // //     isGeoDataSetForSortOption && parseIntegerInput(filterRadiusInMeters),
// // // // // // // // // //   ].filter(v => v !== undefined && v !== null && v !== '' && v !== false && v !== 0).length;

// // // // // // // // // //   return (
// // // // // // // // // //     <div className="flex items-stretch gap-2 sm:gap-3 w-full">
// // // // // // // // // //       <div className="relative flex-grow">
// // // // // // // // // //         <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 pointer-events-none z-10" />
// // // // // // // // // //         <Input
// // // // // // // // // //           type="text"
// // // // // // // // // //           placeholder="Search shop name, area..."
// // // // // // // // // //           value={mainSearchTerm}
// // // // // // // // // //           onChange={(e) => setMainSearchTerm(e.target.value)}
// // // // // // // // // //           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); triggerMainSubmit(); }}} // Use triggerMainSubmit
// // // // // // // // // //           className="pl-10 sm:pl-12 pr-20 sm:pr-24 h-12 sm:h-14 text-sm sm:text-base w-full rounded-full shadow-sm bg-white text-slate-900 placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
// // // // // // // // // //           disabled={isLoading || isLocating}
// // // // // // // // // //         />
        
// // // // // // // // // //         {/* Filter Button */}
// // // // // // // // // //         <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
// // // // // // // // // //           <PopoverTrigger asChild>
// // // // // // // // // //             <Button
// // // // // // // // // //               type="button"
// // // // // // // // // //               variant="ghost"
// // // // // // // // // //               size="icon"
// // // // // // // // // //               className="absolute right-11 sm:right-12 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 z-10 text-slate-500 hover:text-slate-800 disabled:text-slate-400"
// // // // // // // // // //               disabled={isLoading || isLocating}
// // // // // // // // // //               aria-label="Open advanced filters"
// // // // // // // // // //             >
// // // // // // // // // //               <FilterIcon className="h-4 w-4 sm:h-5 sm:w-5" />
// // // // // // // // // //               {activeFilterCount > 0 && (
// // // // // // // // // //                 <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
// // // // // // // // // //                   {activeFilterCount}
// // // // // // // // // //                 </span>
// // // // // // // // // //               )}
// // // // // // // // // //             </Button>
// // // // // // // // // //           </PopoverTrigger>
// // // // // // // // // //           <PopoverContent className="w-screen max-w-xs sm:max-w-sm p-0 bg-white text-slate-900 rounded-lg shadow-xl" align="end" sideOffset={8}>
// // // // // // // // // //             <div className="p-4 sm:p-6 space-y-4">
// // // // // // // // // //               <div className="space-y-1">
// // // // // // // // // //                 <h4 className="font-semibold leading-none text-lg text-slate-800">Advanced Filters</h4>
// // // // // // // // // //                 <p className="text-sm text-slate-500">Refine your search criteria.</p>
// // // // // // // // // //               </div>
// // // // // // // // // //               <div className="grid gap-3">
// // // // // // // // // //                 <div className="space-y-1.5">
// // // // // // // // // //                   <Label htmlFor="filterServices" className="text-xs text-slate-700">Services</Label>
// // // // // // // // // //                   <Input id="filterServices" placeholder="e.g., Oil, Brakes" value={filterServices} onChange={(e) => setFilterServices(e.target.value)} disabled={isLoading} className="h-9 text-sm bg-white border-slate-300"/>
// // // // // // // // // //                 </div>
// // // // // // // // // //                 <div className="space-y-1.5">
// // // // // // // // // //                   <Label htmlFor="filterSortBy" className="text-xs text-slate-700">Sort By</Label>
// // // // // // // // // //                   <Select value={filterSortBy} onValueChange={(value) => setFilterSortBy(value)} disabled={isLoading}>
// // // // // // // // // //                     <SelectTrigger className="h-9 text-sm bg-white border-slate-300" id="filterSortBy">
// // // // // // // // // //                         <SelectValue placeholder="Default (Name Asc)" />
// // // // // // // // // //                     </SelectTrigger>
// // // // // // // // // //                     <SelectContent className="bg-white">
// // // // // // // // // //                         <SelectItem value="default" className="hover:bg-slate-100">Default (Name Asc)</SelectItem>
// // // // // // // // // //                         <SelectItem value="name_asc" className="hover:bg-slate-100">Name (A-Z)</SelectItem>
// // // // // // // // // //                         <SelectItem value="name_desc" className="hover:bg-slate-100">Name (Z-A)</SelectItem>
// // // // // // // // // //                         {(isGeoDataSetForSortOption || (initialValues.userLatitude && initialValues.userLongitude)) && (
// // // // // // // // // //                             <SelectItem value="distance_asc" className="hover:bg-slate-100">Distance (Nearest)</SelectItem>
// // // // // // // // // //                         )}
// // // // // // // // // //                     </SelectContent>
// // // // // // // // // //                   </Select>
// // // // // // // // // //                 </div>
// // // // // // // // // //                 <div className="space-y-1.5 pt-2 border-t border-slate-200">
// // // // // // // // // //                     <Label className="text-xs text-slate-700 font-medium block mb-1">Manual Location</Label>
// // // // // // // // // //                     {locationError && <p className="text-xs text-red-500 mt-0.5">{locationError}</p>}
// // // // // // // // // //                     <div className="grid grid-cols-2 gap-2">
// // // // // // // // // //                         <Input type="number" placeholder="Latitude" value={filterUserLatitude} onChange={e => setFilterUserLatitude(e.target.value)} disabled={isLoading} step="any" className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // // //                         <Input type="number" placeholder="Longitude" value={filterUserLongitude} onChange={e => setFilterUserLongitude(e.target.value)} disabled={isLoading} step="any" className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // // //                     </div>
// // // // // // // // // //                     <Label htmlFor="filterRadius" className="text-xs text-slate-700 pt-1 block">Radius (meters)</Label>
// // // // // // // // // //                     <Input id="filterRadius" type="number" placeholder="e.g., 500000" value={filterRadiusInMeters} onChange={e => setFilterRadiusInMeters(e.target.value)} disabled={isLoading || !isGeoDataSetForSortOption} className="h-9 text-xs bg-white border-slate-300"/>
// // // // // // // // // //                 </div>
// // // // // // // // // //               </div>
// // // // // // // // // //               <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
// // // // // // // // // //                 <Button type="button" variant="ghost" onClick={handleClearAllFilters} disabled={isLoading} size="sm" className="text-xs"><RotateCcw className="mr-1.5 h-3 w-3" /> Reset All</Button>
// // // // // // // // // //                 <Button type="button" onClick={handleApplyFiltersFromPopover} disabled={isLoading} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">Apply Filters</Button>
// // // // // // // // // //               </div>
// // // // // // // // // //             </div>
// // // // // // // // // //           </PopoverContent>
// // // // // // // // // //         </Popover>
        
// // // // // // // // // //         {/* Location Button */}
// // // // // // // // // //         <Button
// // // // // // // // // //           type="button"
// // // // // // // // // //           variant="ghost"
// // // // // // // // // //           size="icon"
// // // // // // // // // //           className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 z-10 text-slate-500 hover:text-slate-800 disabled:text-slate-400"
// // // // // // // // // //           onClick={getCurrentLocationAndSubmit}
// // // // // // // // // //           disabled={isLoading || isLocating}
// // // // // // // // // //           aria-label="Use my current location"
// // // // // // // // // //         >
// // // // // // // // // //           {isLocating ? (
// // // // // // // // // //             <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
// // // // // // // // // //           ) : (
// // // // // // // // // //             <LocateFixed className="h-4 w-4 sm:h-5 sm:w-5" />
// // // // // // // // // //           )}
// // // // // // // // // //         </Button>
// // // // // // // // // //       </div>

// // // // // // // // // //       <Button 
// // // // // // // // // //         type="button" 
// // // // // // // // // //         onClick={triggerMainSubmit} // Use the new handler
// // // // // // // // // //         disabled={isLoading || isLocating}
// // // // // // // // // //         className="h-12 sm:h-14 px-5 sm:px-6 rounded-full bg-orange-500 text-white text-sm sm:text-base font-semibold hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 flex-shrink-0"
// // // // // // // // // //       >
// // // // // // // // // //         Let's go
// // // // // // // // // //       </Button>
// // // // // // // // // //     </div>
// // // // // // // // // //   );
// // // // // // // // // // }