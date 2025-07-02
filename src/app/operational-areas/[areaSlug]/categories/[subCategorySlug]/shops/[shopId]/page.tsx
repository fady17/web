
'use client';

import React, { Suspense, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    fetchShopById,
    fetchServicesByShop
} from '@/lib/apiClient';
import {
    ShopDto, 
    APIError, 
    ShopServiceDto} from '@/types/api';
import { AddToAnonymousCartRequest } from '@/types/anonymous';
import { useCart } from '@/contexts/CartContext';

import { Button } from '@/components/ui/button';
// Card components are used within our custom components, not directly here for page layout
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    ArrowLeft, Info, Loader2, MapPin, Phone,
    MessageCircle, ExternalLink, PlusCircle, CheckCircle,
    ListChecks, InfoIcon as AboutIcon, PhoneCall, Layers // Added Layers as fallback for Service Icon
} from 'lucide-react';
import Link from 'next/link'; 
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { featureConcepts, FeatureConceptConfig } from '@/config/categories'; // For breadcrumb logic

// --- Dynamic Imports for Map used in ShopPageHeader ---
const LeafletMapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false, loading: () => <MapLoadingSkeleton /> });
const LeafletTileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const LeafletMarker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
// Popup might be needed if ShopPageHeader's map becomes interactive (currently not)
// const LeafletPopup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });


// --- Helper Components & Types ---
const MapLoadingSkeleton = () => (
  <div className="w-full h-full bg-slate-700/30 animate-pulse flex items-center justify-center">
    <MapPin className="w-12 h-12 text-slate-400" />
  </div>
);

type TabKey = "services" | "info" | "contact";

// --- INTERFACE DEFINITIONS ---
interface ShopPageHeaderProps {
  shop: ShopDto; 
  googleMapsLink: string;
  hasValidCoordinates: boolean;
  mapCenter: [number, number]; 
  openingStatus: { text: string; dotColor: string; textColor: string; bgClasses: string; };
}

interface ServicesTabContentProps {
  shop: ShopDto;
  shopServices: ShopServiceDto[] | undefined;
  isLoadingServices: boolean;
}

interface InfoTabContentProps { 
  shop: ShopDto; 
}

interface ContactTabContentProps { 
  shop: ShopDto; 
  googleMapsLink: string; 
  rawPhoneNumber?: string | null; 
  whatsappLink?: string | null;
}

interface ShopDetailsClientProps { 
  areaSlug: string; 
  subCategorySlug: string; 
  shopId: string; 
}
// --- END INTERFACE DEFINITIONS ---


// --- Custom Hooks for Data Fetching ---
const useShopPageData = (areaSlug: string, subCategorySlug: string, shopId: string) => {
    const { data: shop, isLoading: isLoadingShop, error: shopError } =
        useQuery<ShopDto, APIError>({
            queryKey: ['shopDetails', areaSlug, subCategorySlug, shopId],
            queryFn: () => fetchShopById(areaSlug, subCategorySlug, shopId),
            enabled: !!areaSlug && !!subCategorySlug && !!shopId,
            staleTime: 1000 * 60 * 5, 
            refetchOnWindowFocus: false,
        });
    
    const { data: shopServices, isLoading: isLoadingShopServices, error: shopServicesError } =
        useQuery<ShopServiceDto[], APIError>({
            queryKey: ['shopServices', shopId, areaSlug, subCategorySlug],
            queryFn: () => fetchServicesByShop(areaSlug, subCategorySlug, shopId),
            enabled: !!shop && !!areaSlug && !!subCategorySlug && !!shopId, 
            staleTime: 1000 * 60 * 2,
            refetchOnWindowFocus: false,
        });

    const anyError = shopError || shopServicesError; 
    const isLoading = isLoadingShop || (!!shop && isLoadingShopServices);

    return { 
        shop, 
        shopServices, 
        isLoading, 
        error: anyError 
    };
};


// --- UI Sub-Components ---
const ShopPageHeader: React.FC<ShopPageHeaderProps> = React.memo(({
  shop, googleMapsLink, hasValidCoordinates, mapCenter, openingStatus
}) => (
  <header className="relative group bg-black/20 backdrop-blur-md border-b border-white/10">
    <div className="relative h-48 sm:h-56 md:h-60">
        {hasValidCoordinates ? (
        <LeafletMapContainer center={mapCenter} zoom={15} className="w-full h-full z-0 opacity-50 group-hover:opacity-75 transition-opacity duration-300" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false} zoomControl={false}>
            <LeafletTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LeafletMarker position={mapCenter} />
        </LeafletMapContainer>
        ) : ( <div className="w-full h-full flex items-center justify-center bg-slate-700/50"><div className="text-center text-slate-400"><MapPin className="w-16 h-16 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Location map not available</p></div></div> )}
    </div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/20 flex flex-col justify-end p-4 sm:p-5 md:p-6 z-[1]">
      <div className="flex items-end justify-between">
        <div className="max-w-[calc(100%-56px)] sm:max-w-[calc(100%-72px)] min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-2 text-shadow-strong group-hover:text-emerald-300 transition-colors">
            {shop.nameEn || shop.nameAr}
          </h1>
          {shop.address && (
            <p className="text-xs text-slate-200 mt-1 sm:mt-1.5 flex items-center line-clamp-1 text-shadow-soft">
              <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-slate-300" />
              {shop.address}
            </p>
          )}
          <div className={cn(
            `inline-flex items-center px-2.5 py-1 rounded-full text-xs mt-2 sm:mt-3 font-medium`,
            openingStatus.bgClasses, openingStatus.textColor
          )}>
              <div className={`w-2 h-2 rounded-full ${openingStatus.dotColor} mr-2`} />
              <span className="truncate max-w-[150px] sm:max-w-[200px]">{openingStatus.text}</span>
          </div>
        </div>
        {shop.logoUrl && (
          <div className="ml-3 w-12 h-12 sm:w-16 sm:h-16 bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-md flex-shrink-0 border border-white/20">
            <Image src={shop.logoUrl} alt={`${shop.nameEn || shop.nameAr} logo`} width={60} height={60} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
          </div>
        )}
      </div>
      {hasValidCoordinates && (
        <Button asChild variant="outline" size="sm" className="mt-3 sm:mt-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border-white/30 text-white text-xs w-fit self-start active:bg-white/30">
          <a href={googleMapsLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5"/> View on Google Maps
          </a>
        </Button>
      )}
    </div>
  </header>
));
ShopPageHeader.displayName = 'ShopPageHeader';


const ServicesTabContent: React.FC<ServicesTabContentProps> = ({ shop, shopServices, isLoadingServices }) => {
  const { addItem, isUpdatingItemId, items: cartItems } = useCart();

  if (isLoadingServices) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-black/20 border-white/10 p-3 sm:p-4 rounded-lg">
            <div className="h-5 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-slate-600 rounded w-full mt-2"></div>
          </div>
        ))}
      </div>
    );
  }
  if (!shopServices || shopServices.length === 0) {
    return <p className="text-slate-400 text-center py-8">No specific services listed for this shop currently.</p>;
  }

  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {shopServices.map((service: ShopServiceDto) => {
          const itemInCart = cartItems.find(ci => ci.shopServiceId === service.shopServiceId && ci.shopId === shop.id);
          const currentQuantityInCart = itemInCart?.quantity || 0;
          const tempItemUpdatingIdentifier = `add-${shop.id}-${service.shopServiceId}`;
          const isThisItemCurrentlyBeingAdded = isUpdatingItemId === tempItemUpdatingIdentifier;
          const isThisCartItemUpdating = itemInCart ? isUpdatingItemId === itemInCart.id : false;
          const isButtonDisabled = isThisItemCurrentlyBeingAdded || isThisCartItemUpdating || currentQuantityInCart > 0;

          const handleAddItem = () => {
            if (isButtonDisabled && currentQuantityInCart === 0) return;
            if (currentQuantityInCart > 0) return; 

            const itemRequest: AddToAnonymousCartRequest = {
              shopId: shop.id,
              shopServiceId: service.shopServiceId,
              quantity: 1,
            };
            addItem(itemRequest);
          };

          return (
            <div key={service.shopServiceId} className={cn(
                `flex flex-col justify-between rounded-lg p-3 sm:p-4 transition-all duration-200 ease-in-out`,
                "bg-black/20 border border-white/10 shadow-lg",
                !(isButtonDisabled && !currentQuantityInCart) && "hover:bg-black/30 hover:border-white/20"
            )}>
              <div>
                <h3 className="text-sm sm:text-base font-medium text-slate-100 line-clamp-2 h-10 sm:h-12 text-shadow-soft">{service.nameEn}</h3>
                <p className="text-base text-emerald-400 font-semibold mt-1">{service.price.toFixed(2)} EGP</p>
                {service.durationMinutes && <p className="text-xs text-slate-400 mt-0.5">{service.durationMinutes} min (est.)</p>}
              </div>
              <Button 
                onClick={handleAddItem} 
                disabled={isButtonDisabled && currentQuantityInCart === 0}
                size="sm" 
                className={cn(
    "w-full text-xs mt-3 py-2 font-medium",
    currentQuantityInCart > 0 
        ? "bg-slate-500 hover:bg-slate-600 cursor-not-allowed text-slate-300" // Grayed out if in cart
        : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white", // Green if not in cart
    (isThisItemCurrentlyBeingAdded || isThisCartItemUpdating) && "opacity-70 cursor-wait"
)}
              >
                {(isThisItemCurrentlyBeingAdded || isThisCartItemUpdating) ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (currentQuantityInCart > 0 ? <CheckCircle className="w-4 h-4 mr-2"/> : <PlusCircle className="w-4 h-4 mr-2"/>)}
                {(isThisItemCurrentlyBeingAdded || isThisCartItemUpdating) ? 'Processing...' : (currentQuantityInCart > 0 ? `In Cart (${currentQuantityInCart})` : 'Add to Cart')}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
ServicesTabContent.displayName = 'ServicesTabContent';

const InfoTabContent: React.FC<InfoTabContentProps> = React.memo(({ shop }) => (
  <section className="text-slate-200">
    <h2 className="text-xl font-semibold text-white mb-4 text-shadow-medium">About {shop.nameEn || shop.nameAr}</h2>
    {shop.descriptionEn && <p className="leading-relaxed mb-3 text-sm whitespace-pre-line text-shadow-soft">{shop.descriptionEn}</p>}
    {shop.descriptionAr && <p className="leading-relaxed text-sm text-right whitespace-pre-line text-shadow-soft" dir="rtl">{shop.descriptionAr}</p>}
    {(!shop.descriptionEn && !shop.descriptionAr) && <p className="text-slate-400 text-sm">No description available for this shop.</p>}
    {shop.openingHours && (
        <div className="mt-5 pt-4 border-t border-white/10">
            <h3 className="text-md font-semibold text-white mb-2 text-shadow-medium">Full Opening Hours</h3>
            <p className="text-sm whitespace-pre-line text-shadow-soft">{shop.openingHours}</p>
        </div>
    )}
  </section>
));
InfoTabContent.displayName = 'InfoTabContent';

const ContactTabContent: React.FC<ContactTabContentProps> = React.memo(({ shop, googleMapsLink, rawPhoneNumber, whatsappLink }) => (
  <section className="text-slate-200">
    <h2 className="text-xl font-semibold text-white mb-5 text-shadow-medium">Get In Touch</h2>
    <div className="space-y-4 text-sm">
      {shop.address && (
        <div className="flex items-start"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-emerald-400 flex-shrink-0" /><div><p className="font-medium text-slate-100">Address</p><p className="text-slate-300 text-shadow-soft">{shop.address}</p><a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline mt-0.5 inline-flex items-center">View on Google Maps <ExternalLink className="w-3 h-3 ml-1"/></a></div></div>
      )}
      {shop.phoneNumber && rawPhoneNumber && (
        <div className="flex items-start"><Phone className="w-4 h-4 mr-3 mt-0.5 text-emerald-400 flex-shrink-0" /><div><p className="font-medium text-slate-100">Phone</p><a href={`tel:${rawPhoneNumber}`} className="text-slate-300 hover:text-emerald-300">{shop.phoneNumber}</a></div></div>
      )}
      {whatsappLink && (
        <div className="flex items-start"><MessageCircle className="w-4 h-4 mr-3 mt-0.5 text-emerald-400 flex-shrink-0" /><div><p className="font-medium text-slate-100">WhatsApp</p><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline">Chat on WhatsApp</a></div></div>
      )}
      {(!shop.address && !shop.phoneNumber && !whatsappLink) && <p className="text-slate-400 text-sm">No contact information available for this shop.</p>}
    </div>
  </section>
));
ContactTabContent.displayName = 'ContactTabContent';

const getOpeningStatusInfoPill = (openingHours?: string | null): { text: string; dotColor: string; textColor: string; bgClasses: string; } => {
    const text = openingHours ? openingHours.split('\n')[0] : "Hours not specified";
    if (openingHours?.toLowerCase().includes("open")) { 
        return { text, dotColor: "bg-emerald-400", textColor: "text-emerald-200", bgClasses: "bg-emerald-500/20" }; 
    } else if (openingHours?.toLowerCase().includes("closed")) { 
        return { text, dotColor: "bg-red-400", textColor: "text-red-200", bgClasses: "bg-red-500/20" }; 
    }
    return { text, dotColor: "bg-slate-400", textColor: "text-slate-300", bgClasses: "bg-slate-500/20" };
};
function ShopDetailsClient({ areaSlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("services");
  
  // CRITICAL: Call ALL hooks at the top level, before any conditional returns
  const { shop, shopServices, isLoading, error } = 
    useShopPageData(areaSlug, subCategorySlug, shopId);
  
  // Call useCart hook here, before any conditional returns
  const cart = useCart();

  const openingStatus = useMemo(() => getOpeningStatusInfoPill(shop?.openingHours), [shop?.openingHours]);
  
  const mapCenter = useMemo(() => 
    (shop?.latitude && shop?.longitude && typeof shop.latitude === 'number' && typeof shop.longitude === 'number' && !isNaN(shop.latitude) && !isNaN(shop.longitude))
      ? [shop.latitude, shop.longitude] as [number, number] 
      : null,
  [shop?.latitude, shop?.longitude]);
  
  const hasValidCoordinates = !!mapCenter;
  const googleMapsLink = hasValidCoordinates && mapCenter ? `https://www.google.com/maps/search/?api=1&query=${mapCenter[0]},${mapCenter[1]}` : "#";

  // NOW it's safe to do conditional returns, after all hooks have been called
  if (isLoading && !shop) return <LoadingFallback message="Loading shop details..." glassEffect={true}/>;
  
  if (error && !shop) { 
    return (
      <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <Alert variant="destructive" className="max-w-xl mx-auto bg-red-700/30 border-red-500/50 text-red-100 backdrop-blur-md">
          <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop</AlertTitle>
          <AlertDescription>{error.message || "Could not load shop information."}</AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-black/20 active:bg-black/30"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
      </div>
    );
  }
  if (!shop) {
    return (
      <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
        <Alert variant="default" className="max-w-xl mx-auto bg-yellow-600/20 border-yellow-500/50 text-yellow-100 backdrop-blur-md">
          <Info className="h-5 w-5" /> <AlertTitle>Shop Not Found</AlertTitle>
          <AlertDescription>The requested shop could not be found or is no longer available.</AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-black/20 active:bg-black/30"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
      </div>
    );
  }

  const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
  const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;

  const areaDisplayNameForBreadcrumb = shop.operationalAreaNameEn || areaSlug.replace(/-/g, ' ');
  const currentAreaSlugForBreadcrumb = shop.operationalAreaSlug || areaSlug;
  const categoryDisplayNameForBreadcrumb = shop.categoryName || subCategorySlug.replace(/-/g, ' ');
  const currentCategorySlugForBreadcrumb = shop.categorySlug || subCategorySlug;
  
  const currentFeatureConcept = featureConcepts.find(fc => 
    fc.apiConceptFilter === (shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : undefined)
  );

  const TABS_CONFIG = [
    { key: "services" as TabKey, label: "Services", icon: ListChecks, 
      content: <ServicesTabContent shop={shop} shopServices={shopServices} isLoadingServices={isLoading && !shopServices} /> },
    { key: "info" as TabKey, label: "About & Hours", icon: AboutIcon, 
      content: <InfoTabContent shop={shop} /> },
    { key: "contact" as TabKey, label: "Contact", icon: PhoneCall, 
      content: <ContactTabContent shop={shop} googleMapsLink={googleMapsLink} rawPhoneNumber={rawPhoneNumber} whatsappLink={whatsappLink} /> },
  ];
  const activeTabData = TABS_CONFIG.find(tab => tab.key === activeTab);

  // Use the cart that was initialized at the top of the component
  const itemsFromThisShopInCart = cart.items.filter(ci => ci.shopId === shop.id);

  // Determine sticky top position for breadcrumbs based on the actual header height
  const STICKY_BREADCRUMB_TOP = "top-0"; // Sticky to the top of its parent scrollable container

  return (
    // This root div of ShopDetailsClient applies the primary glass panel styling and handles scrolling
    <div className="h-full w-full bg-black/70 backdrop-blur-2xl shadow-2xl border-t-2 border-white/10 rounded-t-[2rem] sm:rounded-t-[3rem] flex flex-col overflow-hidden"> 
      
      {/* Sticky breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="bg-black/40 backdrop-blur-lg border-b border-white/10 shadow-sm sticky top-0 z-20 flex-shrink-0">
        <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300 overflow-x-auto whitespace-nowrap">
          <li><Link href={`/?area=${currentAreaSlugForBreadcrumb}`} className="hover:text-emerald-400">{areaDisplayNameForBreadcrumb}</Link></li>
          {currentFeatureConcept && (
            <>
              <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/${currentFeatureConcept.conceptPageSlug}`} className="hover:text-emerald-400">{currentFeatureConcept.nameEn}</Link></li>
            </>
          )}
          <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`} className="hover:text-emerald-400">{categoryDisplayNameForBreadcrumb}</Link></li>
          <li><span className="text-slate-400">/</span></li>
          <li className="font-medium text-white truncate max-w-[100px] xs:max-w-[120px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
        </ol>
      </nav>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Header with map */}
        {mapCenter && <ShopPageHeader 
          shop={shop} 
          googleMapsLink={googleMapsLink} 
          hasValidCoordinates={hasValidCoordinates} 
          mapCenter={mapCenter} 
          openingStatus={openingStatus} 
        />}
        {!mapCenter && shop && (
            <div className="bg-black/20 backdrop-blur-md py-6 text-center border-b border-white/10">
                <h1 className="text-xl sm:text-2xl font-bold text-white text-shadow-strong">{shop.nameEn || shop.nameAr}</h1>
                {shop.address && <p className="text-sm text-slate-300 mt-1 text-shadow-soft">{shop.address}</p>}
            </div>
        )}
        
        {/* Main content */}
        <div className="container mx-auto px-0 sm:px-4 py-6">
          <div className="bg-black/30 backdrop-blur-lg shadow-xl rounded-lg overflow-hidden border border-white/10">
            {/* Tab navigation */}
            <div className="border-b border-white/10">
              <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
                {TABS_CONFIG.map((tab) => (
                  <button 
                    key={tab.key} 
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      `group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-black/50`,
                      activeTab === tab.key 
                          ? 'border-emerald-400 text-emerald-300' 
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                    )}
                    aria-current={activeTab === tab.key ? 'page' : undefined}>
                    <tab.icon className={cn(
                        `-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5`,
                        activeTab === tab.key ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                    )}/>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
            
            {/* Tab content */}
            <div className="p-4 sm:p-6">
              {activeTabData?.content || <div className="text-slate-400">Content not available.</div>}
            </div>
          </div>
          
          {/* Cart summary */}
          {itemsFromThisShopInCart.length > 0 && (
               <div className="mt-6 p-4 bg-black/40 backdrop-blur-lg rounded-lg border border-white/10 text-center shadow-xl">
                  <h3 className="font-semibold text-slate-100 mb-2 text-sm sm:text-base text-shadow-medium">
                      You have {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0)} {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} from this shop in your request list.
                  </h3>
                  <Button 
                      size="lg" 
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:bg-emerald-800"
                      onClick={() => router.push('/cart')}
                  >
                  <ListChecks className="w-5 h-5 mr-2.5"/> View Request List & Proceed
                  </Button>
              </div>
          )}

          {/* Back button */}
          <div className="mt-8 mb-4 text-center">
            <Button 
              onClick={() => router.push(`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`)} 
              variant="outline" 
              size="lg" 
              className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 active:bg-emerald-500/20 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function ShopDetailsPageWrapper() {
  const params = useParams();
  const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : "";
  const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
  const shopId = typeof params.shopId === 'string' ? params.shopId : "";

  // No GLOBAL_HEADER_OFFSET_CLASS needed here anymore.

  if (!areaSlug || !subCategorySlug || !shopId) {
    // This fallback is for when parameters are missing.
    // It will be rendered inside <main> which already has top padding.
    // We make it fill the available space and provide a similar visual context as ShopDetailsClient.
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-black/70 backdrop-blur-2xl rounded-t-[2rem] sm:rounded-t-[3rem]">
            <LoadingFallback message="Invalid page parameters..." glassEffect={true} />
        </div>
    );
  }
  
  return (
    // This div is the direct child of <main> from RootLayout.
    // 1. `flex-1`: Makes it grow to fill the available vertical space IN <main> (which is already padded).
    // 2. `flex flex-col`: Allows ShopDetailsClient (which is h-full) to correctly size itself within this wrapper.
    <div className="flex-1 flex flex-col"> {/* REMOVED custom padding/offset */}
        <Suspense fallback={
          // This fallback is for when ShopDetailsClient is loading.
          // It should mimic the outer shell of ShopDetailsClient.
          <div className="h-full w-full bg-black/70 backdrop-blur-2xl shadow-2xl border-t-2 border-white/10 rounded-t-[2rem] sm:rounded-t-[3rem] flex flex-col items-center justify-center">
            <LoadingFallback message={`Loading shop details...`} glassEffect={true} />
          </div>
        }>
          <ShopDetailsClient areaSlug={areaSlug} subCategorySlug={subCategorySlug} shopId={shopId} />
        </Suspense>
    </div>
  );
}

// Ensure LoadingFallback is defined as you provided earlier
function LoadingFallback({ message = "Loading...", glassEffect = false }: { message?: string, glassEffect?: boolean }) {
  return (
    <div className={cn(
        // Removed flex-grow from here; parent centers it.
        "flex flex-col justify-center items-center text-center px-4 py-10",
        glassEffect ? "text-slate-200" : "bg-slate-50 text-slate-600" 
    )}>
      <Loader2 className={cn("h-12 w-12 animate-spin mb-4", glassEffect ? "text-emerald-400" : "text-orange-500")} />
      <p className="text-lg">{message}</p>
    </div>
  );
}
  //   <div className="flex flex-col min-h-full w-full bg-black/70 backdrop-blur-2xl shadow-2xl border-t-2 border-white/10 rounded-t-[2rem] sm:rounded-t-[3rem] overflow-y-auto"> 
  //     <nav aria-label="Breadcrumb" className={cn(
  //         "bg-black/40 backdrop-blur-lg border-b border-white/10 shadow-sm sticky z-10",
  //         STICKY_BREADCRUMB_TOP 
  //         )}>
  //       <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300 overflow-x-auto whitespace-nowrap">
  //         {/* <li><Link href="/" className="hover:text-emerald-400">Home</Link></li> */}
  //         {/* <li><span className="text-slate-400">/</span></li> */}
  //         <li><Link href={`/?area=${currentAreaSlugForBreadcrumb}`} className="hover:text-emerald-400">{areaDisplayNameForBreadcrumb}</Link></li>
  //         {currentFeatureConcept && (
  //           <>
  //             {/* <li><span className="text-slate-400">/</span></li> */}
  //             <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/${currentFeatureConcept.conceptPageSlug}`} className="hover:text-emerald-400">{currentFeatureConcept.nameEn}</Link></li>
  //           </>
  //         )}
  //         {/* <li><span className="text-slate-400">/</span></li> */}
  //         <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`} className="hover:text-emerald-400">{categoryDisplayNameForBreadcrumb}</Link></li>
  //         <li><span className="text-slate-400">/</span></li>
  //         <li className="font-medium text-white truncate max-w-[100px] xs:max-w-[120px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
  //       </ol>
  //     </nav>

  //     {mapCenter && <ShopPageHeader 
  //       shop={shop} 
  //       googleMapsLink={googleMapsLink} 
  //       hasValidCoordinates={hasValidCoordinates} 
  //       mapCenter={mapCenter} 
  //       openingStatus={openingStatus} 
  //     />}
  //     {!mapCenter && shop && (
  //         <div className="bg-black/20 backdrop-blur-md py-6 text-center border-b border-white/10">
  //             <h1 className="text-xl sm:text-2xl font-bold text-white text-shadow-strong">{shop.nameEn || shop.nameAr}</h1>
  //             {shop.address && <p className="text-sm text-slate-300 mt-1 text-shadow-soft">{shop.address}</p>}
  //         </div>
  //     )}
      
  //     <div className="container mx-auto px-0 sm:px-4 py-6">
  //       <div className="bg-black/30 backdrop-blur-lg shadow-xl rounded-lg overflow-hidden border border-white/10">
  //         <div className="border-b border-white/10">
  //           <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
  //             {TABS_CONFIG.map((tab) => (
  //               <button 
  //                 key={tab.key} 
  //                 onClick={() => setActiveTab(tab.key)}
  //                 className={cn(
  //                   `group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-black/50`,
  //                   activeTab === tab.key 
  //                       ? 'border-emerald-400 text-emerald-300' 
  //                       : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
  //                 )}
  //                 aria-current={activeTab === tab.key ? 'page' : undefined}>
  //                 <tab.icon className={cn(
  //                     `-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5`,
  //                     activeTab === tab.key ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
  //                 )}/>
  //                 <span>{tab.label}</span>
  //               </button>
  //             ))}
  //           </nav>
  //         </div>
  //         <div className="p-4 sm:p-6">
  //           {activeTabData?.content || <div className="text-slate-400">Content not available.</div>}
  //         </div>
  //       </div>
        
  //       {itemsFromThisShopInCart.length > 0 && (
  //            <div className="mt-6 p-4 bg-black/40 backdrop-blur-lg rounded-lg border border-white/10 text-center shadow-xl">
  //               <h3 className="font-semibold text-slate-100 mb-2 text-sm sm:text-base text-shadow-medium">
  //                   You have {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0)} {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} from this shop in your request list.
  //               </h3>
  //               <Button 
  //                   size="lg" 
  //                   className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:bg-emerald-800"
  //                   onClick={() => router.push('/cart')}
  //               >
  //               <ListChecks className="w-5 h-5 mr-2.5"/> View Request List & Proceed
  //               </Button>
  //           </div>
  //       )}

  //       <div className="mt-8 mb-4 text-center">
  //         <Button 
  //           onClick={() => router.push(`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`)} 
  //           variant="outline" 
  //           size="lg" 
  //           className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 active:bg-emerald-500/20 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-200"
  //         >
  //           <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
  //         </Button>
  //       </div>
  //     </div>
  //   </div>
  // );


// function ShopDetailsClient({ areaSlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
//   const router = useRouter();
//   const [activeTab, setActiveTab] = useState<TabKey>("services");
  
//   const { shop, shopServices, isLoading, error } = 
//     useShopPageData(areaSlug, subCategorySlug, shopId);

//   const openingStatus = useMemo(() => getOpeningStatusInfoPill(shop?.openingHours), [shop?.openingHours]);
  
//   const mapCenter = useMemo(() => 
//     (shop?.latitude && shop?.longitude && typeof shop.latitude === 'number' && typeof shop.longitude === 'number' && !isNaN(shop.latitude) && !isNaN(shop.longitude))
//       ? [shop.latitude, shop.longitude] as [number, number] 
//       : null,
//   [shop?.latitude, shop?.longitude]);
  
//   const hasValidCoordinates = !!mapCenter;
//   const googleMapsLink = hasValidCoordinates && mapCenter ? `https://www.google.com/maps/search/?api=1&query=${mapCenter[0]},${mapCenter[1]}` : "#";


//   if (isLoading && !shop) return <LoadingFallback message="Loading shop details..." glassEffect={true}/>;
  
//   if (error && !shop) { 
//     return (
//       <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <Alert variant="destructive" className="max-w-xl mx-auto bg-red-700/30 border-red-500/50 text-red-100 backdrop-blur-md">
//           <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop</AlertTitle>
//           <AlertDescription>{error.message || "Could not load shop information."}</AlertDescription>
//         </Alert>
//         <Button onClick={() => router.back()} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-black/20 active:bg-black/30"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
//       </div>
//     );
//   }
//   if (!shop) {
//     return (
//       <div className="container mx-auto px-4 py-10 text-center min-h-[calc(100vh-200px)] flex flex-col justify-center items-center">
//         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-600/20 border-yellow-500/50 text-yellow-100 backdrop-blur-md">
//           <Info className="h-5 w-5" /> <AlertTitle>Shop Not Found</AlertTitle>
//           <AlertDescription>The requested shop could not be found or is no longer available.</AlertDescription>
//         </Alert>
//         <Button onClick={() => router.back()} variant="outline" className="mt-6 text-slate-100 border-slate-100/30 hover:bg-black/20 active:bg-black/30"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
//       </div>
//     );
//   }

//   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
//   const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;

//   const areaDisplayNameForBreadcrumb = shop.operationalAreaNameEn || areaSlug.replace(/-/g, ' ');
//   const currentAreaSlugForBreadcrumb = shop.operationalAreaSlug || areaSlug;
//   const categoryDisplayNameForBreadcrumb = shop.categoryName || subCategorySlug.replace(/-/g, ' ');
//   const currentCategorySlugForBreadcrumb = shop.categorySlug || subCategorySlug;
  
//   const currentFeatureConcept = featureConcepts.find(fc => 
//     fc.apiConceptFilter === (shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : undefined)
//   );

//   const TABS_CONFIG = [
//     { key: "services" as TabKey, label: "Services", icon: ListChecks, 
//       content: <ServicesTabContent shop={shop} shopServices={shopServices} isLoadingServices={isLoading && !shopServices} /> },
//     { key: "info" as TabKey, label: "About & Hours", icon: AboutIcon, 
//       content: <InfoTabContent shop={shop} /> },
//     { key: "contact" as TabKey, label: "Contact", icon: PhoneCall, 
//       content: <ContactTabContent shop={shop} googleMapsLink={googleMapsLink} rawPhoneNumber={rawPhoneNumber} whatsappLink={whatsappLink} /> },
//   ];
//   const activeTabData = TABS_CONFIG.find(tab => tab.key === activeTab);

//   const cart = useCart();
//   const itemsFromThisShopInCart = cart.items.filter(ci => ci.shopId === shop.id);

//   // Determine sticky top position for breadcrumbs based on the actual header height
//   const STICKY_BREADCRUMB_TOP = "top-0"; // Sticky to the top of its parent scrollable container

//   return (
//     // This root div of ShopDetailsClient applies the primary glass panel styling and handles scrolling
//     <div className="flex flex-col min-h-full w-full bg-black/70 backdrop-blur-2xl shadow-2xl border-t-2 border-white/10 rounded-t-[2rem] sm:rounded-t-[3rem] overflow-y-auto"> 
//       <nav aria-label="Breadcrumb" className={cn(
//           "bg-black/40 backdrop-blur-lg border-b border-white/10 shadow-sm sticky z-10",
//           STICKY_BREADCRUMB_TOP 
//           )}>
//         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-300 overflow-x-auto whitespace-nowrap">
//           <li><Link href="/" className="hover:text-emerald-400">Home</Link></li>
//           <li><span className="text-slate-400">/</span></li>
//           <li><Link href={`/?area=${currentAreaSlugForBreadcrumb}`} className="hover:text-emerald-400">{areaDisplayNameForBreadcrumb}</Link></li>
//           {currentFeatureConcept && (
//             <>
//               <li><span className="text-slate-400">/</span></li>
//               <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/${currentFeatureConcept.conceptPageSlug}`} className="hover:text-emerald-400">{currentFeatureConcept.nameEn}</Link></li>
//             </>
//           )}
//           <li><span className="text-slate-400">/</span></li>
//           <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`} className="hover:text-emerald-400">{categoryDisplayNameForBreadcrumb}</Link></li>
//           <li><span className="text-slate-400">/</span></li>
//           <li className="font-medium text-white truncate max-w-[100px] xs:max-w-[120px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
//         </ol>
//       </nav>

//       {mapCenter && <ShopPageHeader 
//         shop={shop} 
//         googleMapsLink={googleMapsLink} 
//         hasValidCoordinates={hasValidCoordinates} 
//         mapCenter={mapCenter} 
//         openingStatus={openingStatus} 
//       />}
//       {!mapCenter && shop && (
//           <div className="bg-black/20 backdrop-blur-md py-6 text-center border-b border-white/10">
//               <h1 className="text-xl sm:text-2xl font-bold text-white text-shadow-strong">{shop.nameEn || shop.nameAr}</h1>
//               {shop.address && <p className="text-sm text-slate-300 mt-1 text-shadow-soft">{shop.address}</p>}
//           </div>
//       )}
      
//       <div className="container mx-auto px-0 sm:px-4 py-6">
//         <div className="bg-black/30 backdrop-blur-lg shadow-xl rounded-lg overflow-hidden border border-white/10">
//           <div className="border-b border-white/10">
//             <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
//               {TABS_CONFIG.map((tab) => (
//                 <button 
//                   key={tab.key} 
//                   onClick={() => setActiveTab(tab.key)}
//                   className={cn(
//                     `group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-black/50`,
//                     activeTab === tab.key 
//                         ? 'border-emerald-400 text-emerald-300' 
//                         : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
//                   )}
//                   aria-current={activeTab === tab.key ? 'page' : undefined}>
//                   <tab.icon className={cn(
//                       `-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5`,
//                       activeTab === tab.key ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
//                   )}/>
//                   <span>{tab.label}</span>
//                 </button>
//               ))}
//             </nav>
//           </div>
//           <div className="p-4 sm:p-6">
//             {activeTabData?.content || <div className="text-slate-400">Content not available.</div>}
//           </div>
//         </div>
        
//         {itemsFromThisShopInCart.length > 0 && (
//              <div className="mt-6 p-4 bg-black/40 backdrop-blur-lg rounded-lg border border-white/10 text-center shadow-xl">
//                 <h3 className="font-semibold text-slate-100 mb-2 text-sm sm:text-base text-shadow-medium">
//                     You have {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0)} {itemsFromThisShopInCart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} from this shop in your request list.
//                 </h3>
//                 <Button 
//                     size="lg" 
//                     className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:bg-emerald-800"
//                     onClick={() => router.push('/cart')}
//                 >
//                 <ListChecks className="w-5 h-5 mr-2.5"/> View Request List & Proceed
//                 </Button>
//             </div>
//         )}

//         <div className="mt-8 mb-4 text-center">
//           <Button 
//             onClick={() => router.push(`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`)} 
//             variant="outline" 
//             size="lg" 
//             className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 active:bg-emerald-500/20 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-200"
//           >
//             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }

// Wrapper component for the page
// export default function ShopDetailsPageWrapper() {
//   const params = useParams();
//   const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : "";
//   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
//   const shopId = typeof params.shopId === 'string' ? params.shopId : "";
  
//   // const HEADER_ACTUAL_HEIGHT_CLASS_FOR_PADDING = "pt-[68px] sm:pt-[84px]";

//   if (!areaSlug || !subCategorySlug || !shopId) {
//     // This LoadingFallback will be on the page background if used directly here.
//     return (
//         <div className={`relative min-h-screen overflow-x-hidden flex items-center justify-center bg-slate-900 `}>
//             <LoadingFallback message="Invalid page parameters..." glassEffect={true} />
//         </div>
//     );
//   }
  
//   return (
//     // The main div for the page, providing padding for the fixed header.
//     // The background of the body or html tag will show through.
//     <div className={`relative min-h-screen flex flex-col`}>
//         {/* ShopDetailsClient will now manage its own glass background and scrolling */}
//         <div className="flex-1 flex flex-col w-full overflow-y-auto"> {/* This allows content to scroll if it exceeds viewport */}
//           <Suspense fallback={<LoadingFallback message={`Loading shop details...`} glassEffect={true} />}>
//             <ShopDetailsClient areaSlug={areaSlug} subCategorySlug={subCategorySlug} shopId={shopId} />
//           </Suspense>
//         </div>
//     </div>
//   );
// }

// function LoadingFallback({ message = "Loading...", glassEffect = false }: { message?: string, glassEffect?: boolean }) {
//   return (
//     <div className={cn(
//         "flex flex-col flex-grow justify-center items-center text-center px-4 py-10",
//         // If glassEffect, text is light, assuming parent provides dark/blurred bg.
//         // If not glassEffect, it provides its own light bg and dark text.
//         glassEffect ? "text-slate-200" : "bg-slate-50 text-slate-600" 
//     )}>
//       <Loader2 className={cn("h-12 w-12 animate-spin mb-4", glassEffect ? "text-emerald-400" : "text-orange-500")} />
//       <p className="text-lg">{message}</p>
//     </div>
//   );
// }

// // // src/app/operational-areas/[areaSlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // 'use client';

// // import React, { Suspense, useState, useMemo } from 'react';
// // import { useParams, useRouter } from 'next/navigation';
// // import { useQuery } from '@tanstack/react-query';
// // import {
// //     fetchShopById,        // Expects areaSlug as first param
// //     fetchServicesByShop   // Expects areaSlug as first param
// // } from '@/lib/apiClient';
// // import {
// //     ShopDto, 
// //     APIError, 
// //     ShopServiceDto,
// //     // OperationalAreaDto, // Not directly fetched here unless for more detailed breadcrumbs
// //     // SubCategoryDto      // Not directly fetched here unless for more detailed breadcrumbs
// // } from '@/types/api';
// // import { AddToAnonymousCartRequest } from '@/types/anonymous';
// // import { useCart, DisplayableCartItem } from '@/contexts/CartContext';

// // import { Button } from '@/components/ui/button';
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // import {
// //     ArrowLeft, Info, Loader2, MapPin, Phone,
// //     MessageCircle, ExternalLink, PlusCircle, CheckCircle,
// //     ListChecks, InfoIcon as AboutIcon, PhoneCall
// // } from 'lucide-react';
// // import Link from 'next/link'; 
// // import Image from 'next/image';
// // import dynamic from 'next/dynamic';

// // // --- Dynamic Imports for Map ---
// // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false, loading: () => <MapLoadingSkeleton /> });
// // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// // // --- Helper Components & Types ---
// // const MapLoadingSkeleton = () => (
// //   <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
// //     <MapPin className="w-12 h-12 text-slate-400" />
// //   </div>
// // );

// // type TabKey = "services" | "info" | "contact";

// // // --- Custom Hooks for Data Fetching (Updated for areaSlug) ---
// // const useShopPageData = (areaSlug: string, subCategorySlug: string, shopId: string) => {
// //     const { data: shop, isLoading: isLoadingShop, error: shopError } =
// //         useQuery<ShopDto, APIError>({
// //             queryKey: ['shopDetails', areaSlug, subCategorySlug, shopId], // UPDATED
// //             queryFn: () => fetchShopById(areaSlug, subCategorySlug, shopId), // UPDATED
// //             enabled: !!areaSlug && !!subCategorySlug && !!shopId,
// //             staleTime: 1000 * 60 * 5,
// //             refetchOnWindowFocus: false,
// //         });
    
// //     const { data: shopServices, isLoading: isLoadingShopServices, error: shopServicesError } =
// //         useQuery<ShopServiceDto[], APIError>({
// //             queryKey: ['shopServices', shopId, areaSlug, subCategorySlug], // Added areaSlug, subCategorySlug for context
// //             queryFn: () => fetchServicesByShop(areaSlug, subCategorySlug, shopId), // UPDATED
// //             enabled: !!shop && !!areaSlug && !!subCategorySlug && !!shopId, 
// //             staleTime: 1000 * 60 * 2,
// //             refetchOnWindowFocus: false,
// //         });

// //     const anyError = shopError || shopServicesError; 

// //     return { 
// //         shop, 
// //         shopServices, 
// //         isLoadingShop: isLoadingShop,
// //         isLoadingServices: isLoadingShopServices,
// //         error: anyError 
// //     };
// // };


// // // --- UI Sub-Components ---
// // interface ShopPageHeaderProps {
// //   shop: ShopDto; 
// //   googleMapsLink: string;
// //   hasValidCoordinates: boolean;
// //   mapCenter: [number, number];
// //   openingStatus: { text: string; dotColor: string; textColor: string; bgColor: string; };
// // }

// // const ShopPageHeader: React.FC<ShopPageHeaderProps> = React.memo(({
// //   shop, googleMapsLink, hasValidCoordinates, mapCenter, openingStatus
// // }) => (
// //   <header className="relative h-60 sm:h-72 bg-slate-700 group">
// //     {hasValidCoordinates ? (
// //       <MapContainer center={mapCenter} zoom={15} className="w-full h-full z-0" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false} zoomControl={false}>
// //         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
// //         <Marker position={mapCenter} />
// //       </MapContainer>
// //     ) : ( <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400"><div className="text-center text-slate-600"><MapPin className="w-16 h-16 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Location map not available</p></div></div> )}
    
// //     <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 cursor-pointer" aria-label={`Open location of ${shop.nameEn || shop.nameAr} on Google Maps`}>
// //       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent flex flex-col justify-end p-4 sm:p-5 z-20">
// //         <div className="flex items-end justify-between">
// //           <div className="max-w-[calc(100%-56px)] sm:max-w-[calc(100%-72px)]">
// //             <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
// //               {shop.nameEn || shop.nameAr}
// //             </h1>
// //             {shop.address && (
// //               <p className="text-xs text-slate-200 mt-0.5 sm:mt-1 flex items-center line-clamp-1">
// //                 <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
// //                 {shop.address}
// //               </p>
// //             )}
// //             <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-1.5 sm:mt-2 ${openingStatus.bgColor} ${openingStatus.textColor}`}>
// //                 <div className={`w-1.5 h-1.5 rounded-full ${openingStatus.dotColor} mr-1.5`} />
// //                 <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{openingStatus.text}</span>
// //             </div>
// //           </div>
// //           {shop.logoUrl && (
// //             <div className="ml-3 w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-lg p-1 shadow-md flex-shrink-0">
// //               <Image src={shop.logoUrl} alt={`${shop.nameEn || shop.nameAr} logo`} width={52} height={52} className="w-full h-full object-contain" />
// //             </div>
// //           )}
// //         </div>
// //         <Button variant="outline" size="sm" className="mt-2 sm:mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30 text-white text-xs w-fit self-start">
// //           <ExternalLink className="w-3 h-3.5 mr-1.5"/> View on Google Maps
// //         </Button>
// //       </div>
// //     </a>
// //   </header>
// // ));
// // ShopPageHeader.displayName = 'ShopPageHeader';

// // interface ServicesTabContentProps {
// //   shop: ShopDto;
// //   shopServices: ShopServiceDto[] | undefined;
// //   isLoadingServices: boolean;
// // }
// // const ServicesTabContent: React.FC<ServicesTabContentProps> = ({ shop, shopServices, isLoadingServices }) => {
// //   const { addItem, isUpdatingItemId, items: cartItems } = useCart();
// //   const router = useRouter();

// //   if (isLoadingServices) {
// //     return (
// //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// //         {[...Array(3)].map((_, i) => (
// //           <Card key={i} className="animate-pulse">
// //             <CardHeader className="pb-2 pt-3 px-3 sm:px-4 "><div className="h-5 bg-slate-200 rounded w-3/4 mb-1"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></CardHeader>
// //             <CardContent className="px-3 sm:px-4 pb-3"><div className="h-8 bg-slate-200 rounded w-full mt-2"></div></CardContent>
// //           </Card>
// //         ))}
// //       </div>
// //     );
// //   }
// //   if (!shopServices || shopServices.length === 0) {
// //     return <p className="text-slate-500">No specific services listed for this shop currently. Please contact them for details.</p>;
// //   }

// //   const itemsFromThisShopInCart = cartItems.filter((cartItem: DisplayableCartItem) => cartItem.shopId === shop.id);

// //   return (
// //     <section>
// //       <h2 className="text-xl font-semibold text-slate-800 mb-1">Available Services</h2>
// //       <p className="text-sm text-slate-500 mb-5">Select services you're interested in.</p>
// //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// //         {shopServices.map((service: ShopServiceDto) => {
// //           const itemInCart = itemsFromThisShopInCart.find(ci => ci.shopServiceId === service.shopServiceId);
// //           const currentQuantityInCart = itemInCart?.quantity || 0;
// //           const tempItemUpdatingIdentifier = `add-${shop.id}-${service.shopServiceId}`;
// //           const isThisItemCurrentlyBeingAdded = isUpdatingItemId === tempItemUpdatingIdentifier;
// //           const isThisCartItemUpdating = itemInCart ? isUpdatingItemId === itemInCart.id : false;
// //           const isButtonDisabled = isThisItemCurrentlyBeingAdded || isThisCartItemUpdating || currentQuantityInCart > 0;

// //           const handleAddItem = () => {
// //             if (isButtonDisabled) return;
// //             const itemRequest: AddToAnonymousCartRequest = {
// //               shopId: shop.id,
// //               shopServiceId: service.shopServiceId,
// //               quantity: 1,
// //             };
// //             addItem(itemRequest);
// //           };

// //           return (
// //             <Card key={service.shopServiceId} className={`flex flex-col justify-between ${isButtonDisabled && !currentQuantityInCart ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg transition-shadow'}`}>
// //               <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
// //                 <CardTitle className="text-sm sm:text-base font-medium text-slate-700 line-clamp-2 h-10 sm:h-12">{service.nameEn}</CardTitle>
// //                 <p className="text-sm text-orange-600 font-semibold mt-1">{service.price.toFixed(2)} EGP</p>
// //                 {service.durationMinutes && <p className="text-xs text-slate-500 mt-0.5">{service.durationMinutes} min (est.)</p>}
// //               </CardHeader>
// //               <CardContent className="px-3 sm:px-4 pb-3 mt-auto">
// //                 <Button 
// //                   onClick={handleAddItem} 
// //                   disabled={isButtonDisabled}
// //                   size="sm" 
// //                   className="w-full text-xs bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:text-slate-100 disabled:cursor-not-allowed"
// //                 >
// //                   {isThisItemCurrentlyBeingAdded ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (currentQuantityInCart > 0 ? <CheckCircle className="w-4 h-4 mr-2"/> : <PlusCircle className="w-4 h-4 mr-2"/>)}
// //                   {isThisItemCurrentlyBeingAdded ? 'Adding...' : (currentQuantityInCart > 0 ? `In Cart (${currentQuantityInCart})` : 'Add to Cart')}
// //                 </Button>
// //               </CardContent>
// //             </Card>
// //           );
// //         })}
// //       </div>
// //       {itemsFromThisShopInCart.length > 0 && (
// //           <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
// //             <h3 className="font-semibold text-slate-700 mb-2 text-sm">
// //                 Services from {shop.nameEn} in your cart ({itemsFromThisShopInCart.reduce((sum: number, item: DisplayableCartItem) => sum + item.quantity, 0)}):
// //             </h3>
// //             <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mb-3">
// //               {itemsFromThisShopInCart.map((s: DisplayableCartItem) => <li key={s.id}>{s.serviceNameEn} (x{s.quantity})</li>)}
// //             </ul>
// //             <Button 
// //                 size="sm" 
// //                 className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
// //                 onClick={() => router.push('/cart')}
// //             >
// //               <MessageCircle className="w-3.5 h-3.5 mr-2"/> View Cart & Request Quote
// //             </Button>
// //           </div>
// //         )}
// //     </section>
// //   );
// // };
// // ServicesTabContent.displayName = 'ServicesTabContent';

// // interface InfoTabContentProps { shop: ShopDto; }
// // const InfoTabContent: React.FC<InfoTabContentProps> = React.memo(({ shop }) => (
// //   <section>
// //     <h2 className="text-xl font-semibold text-slate-800 mb-4">About {shop.nameEn || shop.nameAr}</h2>
// //     {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-3 text-sm whitespace-pre-line">{shop.descriptionEn}</p>}
// //     {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right whitespace-pre-line" dir="rtl">{shop.descriptionAr}</p>}
// //     {(!shop.descriptionEn && !shop.descriptionAr) && <p className="text-slate-500 text-sm">No description available for this shop.</p>}
// //     {shop.openingHours && (
// //         <div className="mt-5 pt-4 border-t border-slate-200">
// //             <h3 className="text-md font-semibold text-slate-700 mb-2">Full Opening Hours</h3>
// //             <p className="text-sm text-slate-600 whitespace-pre-line">{shop.openingHours}</p>
// //         </div>
// //     )}
// //   </section>
// // ));
// // InfoTabContent.displayName = 'InfoTabContent';

// // interface ContactTabContentProps { shop: ShopDto; googleMapsLink: string; rawPhoneNumber?: string | null; whatsappLink?: string | null;}
// // const ContactTabContent: React.FC<ContactTabContentProps> = React.memo(({ shop, googleMapsLink, rawPhoneNumber, whatsappLink }) => (
// //   <section>
// //     <h2 className="text-xl font-semibold text-slate-800 mb-5">Get In Touch</h2>
// //     <div className="space-y-4 text-sm">
// //       {shop.address && (
// //         <div className="flex items-start"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Address</p><p className="text-slate-600">{shop.address}</p><a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline mt-0.5 inline-flex items-center">View on Google Maps <ExternalLink className="w-3 h-3 ml-1"/></a></div></div>
// //       )}
// //       {shop.phoneNumber && rawPhoneNumber && (
// //         <div className="flex items-start"><Phone className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Phone</p><a href={`tel:${rawPhoneNumber}`} className="text-slate-600 hover:text-orange-600">{shop.phoneNumber}</a></div></div>
// //       )}
// //       {whatsappLink && (
// //         <div className="flex items-start"><MessageCircle className="w-4 h-4 mr-3 mt-0.5 text-green-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">WhatsApp</p><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Chat on WhatsApp</a></div></div>
// //       )}
// //       {(!shop.address && !shop.phoneNumber && !whatsappLink) && <p className="text-slate-500 text-sm">No contact information available for this shop.</p>}
// //     </div>
// //   </section>
// // ));
// // ContactTabContent.displayName = 'ContactTabContent';

// // const getOpeningStatusInfoPill = (openingHours?: string | null) => {
// //     const text = openingHours ? openingHours.split('\n')[0] : "Hours not specified";
// //     let dotColor = "bg-slate-400", textColor = "text-slate-700", bgColor = "bg-slate-100";
// //     if (openingHours?.toLowerCase().includes("open")) { dotColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50"; }
// //     else if (openingHours?.toLowerCase().includes("closed")) { dotColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50"; }
// //     return { text, dotColor, textColor, bgColor };
// // };

// // interface ShopDetailsClientProps { 
// //   areaSlug: string; // UPDATED
// //   subCategorySlug: string; 
// //   shopId: string; 
// // }

// // function ShopDetailsClient({ areaSlug, subCategorySlug, shopId }: ShopDetailsClientProps) { // UPDATED
// //   const router = useRouter();
// //   const [activeTab, setActiveTab] = useState<TabKey>("services");
  
// //   const { shop, shopServices, isLoadingShop, isLoadingServices, error } = 
// //     useShopPageData(areaSlug, subCategorySlug, shopId); // UPDATED

// //   const openingStatus = useMemo(() => getOpeningStatusInfoPill(shop?.openingHours), [shop?.openingHours]);
// //   const mapCenter = useMemo(() => shop?.latitude && shop?.longitude ? [shop.latitude, shop.longitude] as [number, number] : [30.0444, 31.2357] as [number, number], [shop?.latitude, shop?.longitude]);
// //   const hasValidCoordinates = !!(shop?.latitude && shop?.longitude);
// //   const googleMapsLink = hasValidCoordinates ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}` : "#";

// //   if (isLoadingShop) return <LoadingFallback message="Loading shop details..." />;
// //   if (error && !shop) { 
// //     return (
// //       <div className="container mx-auto px-4 py-10 text-center">
// //         <Alert variant="destructive" className="max-w-xl mx-auto">
// //           <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop Data</AlertTitle>
// //           <AlertDescription>{error.message || "Could not load shop information."}</AlertDescription>
// //         </Alert>
// //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// //       </div>
// //     );
// //   }
// //   if (!shop) {
// //     return (
// //       <div className="container mx-auto px-4 py-10 text-center">
// //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// //           <Info className="h-5 w-5 text-yellow-600" /> <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// //           <AlertDescription>Requested shop details are not available or could not be loaded.</AlertDescription>
// //         </Alert>
// //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// //       </div>
// //     );
// //   }

// //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// //   const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;

// //   // --- BREADCRUMB LOGIC UPDATED ---
// //   // Using shop data for breadcrumb elements where possible.
// //   // Assumes ShopDto now has operationalAreaNameEn, operationalAreaSlug, categoryName, categorySlug
// //   const areaDisplayNameForBreadcrumb = shop.operationalAreaNameEn || areaSlug.replace(/-/g, ' ');
// //   const currentAreaSlugForBreadcrumb = shop.operationalAreaSlug || areaSlug;
// //   const categoryDisplayNameForBreadcrumb = shop.categoryName || subCategorySlug.replace(/-/g, ' ');
// //   const currentCategorySlugForBreadcrumb = shop.categorySlug || subCategorySlug;
  
// //   // Determine concept for breadcrumb link to concept page (e.g., /operational-areas/{areaSlug}/maintenance-services)
// //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
// //   // --- END BREADCRUMB LOGIC ---


// //   const TABS_CONFIG = [
// //     { key: "services" as TabKey, label: "Services", icon: ListChecks, 
// //       content: <ServicesTabContent shop={shop} shopServices={shopServices} isLoadingServices={isLoadingServices} /> },
// //     { key: "info" as TabKey, label: "About & Hours", icon: AboutIcon, 
// //       content: <InfoTabContent shop={shop} /> },
// //     { key: "contact" as TabKey, label: "Contact", icon: PhoneCall, 
// //       content: <ContactTabContent shop={shop} googleMapsLink={googleMapsLink} rawPhoneNumber={rawPhoneNumber} whatsappLink={whatsappLink} /> },
// //   ];
// //   const activeTabData = TABS_CONFIG.find(tab => tab.key === activeTab);

// //   return (
// //     <div className="bg-slate-100 min-h-screen">
// //       {/* --- UPDATED BREADCRUMB --- */}
// //       <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
// //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// //           <li><span className="text-slate-400">»</span></li>
// //           <li><Link href={`/?area=${currentAreaSlugForBreadcrumb}`} className="hover:text-orange-600 hover:underline">{areaDisplayNameForBreadcrumb}</Link></li>
// //           {conceptPageSlug && conceptDisplayName && (
// //             <>
// //               <li><span className="text-slate-400">»</span></li>
// //               <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// //             </>
// //           )}
// //           <li><span className="text-slate-400">»</span></li>
// //           <li><Link href={`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`} className="hover:text-orange-600 hover:underline">{categoryDisplayNameForBreadcrumb}</Link></li>
// //           <li><span className="text-slate-400">»</span></li>
// //           <li className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// //         </ol>
// //       </nav>

// //       <ShopPageHeader 
// //         shop={shop} 
// //         googleMapsLink={googleMapsLink} 
// //         hasValidCoordinates={hasValidCoordinates} 
// //         mapCenter={mapCenter} 
// //         openingStatus={openingStatus} 
// //       />
      
// //       <div className="container mx-auto px-0 sm:px-4 py-6">
// //         <div className="bg-white shadow-lg rounded-lg overflow-hidden">
// //           <div className="border-b border-slate-200">
// //             <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
// //               {TABS_CONFIG.map((tab) => (
// //                 <button 
// //                   key={tab.key} 
// //                   onClick={() => setActiveTab(tab.key)}
// //                   className={`group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
// //                   aria-current={activeTab === tab.key ? 'page' : undefined}>
// //                   <tab.icon className={`-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 ${activeTab === tab.key ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-500'}`}/>
// //                   <span>{tab.label}</span>
// //                 </button>
// //               ))}
// //             </nav>
// //           </div>
// //           <div className="p-4 sm:p-6">
// //             {activeTabData?.content || <div className="text-slate-500">Content not available.</div>}
// //           </div>
// //         </div>
// //         <div className="mt-8 mb-4 text-center">
// //           <Button 
// //             onClick={() => router.push(`/operational-areas/${currentAreaSlugForBreadcrumb}/categories/${currentCategorySlugForBreadcrumb}/shops`)} 
// //             variant="outline" 
// //             size="lg" 
// //             className="hover:bg-slate-50 transition-colors">
// //             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
// //           </Button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // export default function ShopDetailsPage() {
// //   const params = useParams();
// //   const areaSlug = typeof params.areaSlug === 'string' ? params.areaSlug : "";       // UPDATED
// //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// //   if (!areaSlug || !subCategorySlug || !shopId) { // UPDATED
// //     return <LoadingFallback message="Invalid shop path..." />;
// //   }

// //   return (
// //     <Suspense fallback={<LoadingFallback message={`Loading details for shop...`} />}>
// //       {/* UPDATED: Pass areaSlug */}
// //       <ShopDetailsClient areaSlug={areaSlug} subCategorySlug={subCategorySlug} shopId={shopId} />
// //     </Suspense>
// //   );
// // }

// // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// //   return (
// //     <div className="flex flex-col min-h-[calc(100vh-var(--header-height,100px))] justify-center items-center bg-slate-100 p-4">
// //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// //       <p className="text-slate-600 text-lg text-center">{message}</p>
// //     </div>
// //   );
// // }

// // // Full definitions for ServicesTabContent, InfoTabContent, ContactTabContent
// // // should be placed here, as they were in your original file.
// // // I'm adding them back for completeness.

// // // const ServicesTabContent: React.FC<ServicesTabContentProps> = ({ shop, shopServices, isLoadingServices }) => { ... as provided before ... };
// // // const InfoTabContent: React.FC<InfoTabContentProps> = React.memo(({ shop }) => ( ... as provided before ... ));
// // // const ContactTabContent: React.FC<ContactTabContentProps> = React.memo(({ shop, googleMapsLink, rawPhoneNumber, whatsappLink }) => ( ... as provided before ... ));
// // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // 'use client';

// // // import React, { Suspense, useState, useMemo, useCallback } from 'react';
// // // import { useParams, useRouter } from 'next/navigation';
// // // import { useQuery } from '@tanstack/react-query';
// // // import {
// // //     fetchShopById,
// // //     fetchCities,
// // //     fetchSubCategoriesByCity,
// // //     fetchServicesByShop
// // // } from '@/lib/apiClient';
// // // import {
// // //     ShopDto, APIError, CityDto, SubCategoryDto, ShopServiceDto
// // // } from '@/types/api';
// // // import { AddToAnonymousCartRequest } from '@/types/anonymous';
// // // import { useCart, DisplayableCartItem } from '@/contexts/CartContext';

// // // import { Button } from '@/components/ui/button';
// // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // import {
// // //     ArrowLeft, Info, Loader2, MapPin, Phone, Clock,
// // //     MessageCircle, ExternalLink, PlusCircle, CheckCircle,
// // //     ListChecks, InfoIcon as AboutIcon, PhoneCall
// // // } from 'lucide-react';
// // // import Link from 'next/link';
// // // import Image from 'next/image';
// // // import dynamic from 'next/dynamic';

// // // // --- Dynamic Imports ---
// // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false, loading: () => <MapLoadingSkeleton /> });
// // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// // // // --- Helper Components & Types ---
// // // const MapLoadingSkeleton = () => (
// // //   <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
// // //     <MapPin className="w-12 h-12 text-slate-400" />
// // //   </div>
// // // );

// // // type TabKey = "services" | "info" | "contact";

// // // // --- Custom Hooks for Data Fetching ---
// // // const useShopPageData = (citySlug: string, subCategorySlug: string, shopId: string) => {
// // //     const { data: shop, isLoading: isLoadingShop, error: shopError } =
// // //         useQuery<ShopDto, APIError>({
// // //             queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // //             queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // //             enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // //             staleTime: 1000 * 60 * 5, // Shop details might change, so not infinite stale time
// // //             refetchOnWindowFocus: false,
// // //         });

// // //     const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // //         queryKey: ['cityDetails', citySlug],
// // //         queryFn: async () => (await fetchCities()).find(c => c.slug === citySlug),
// // //         enabled: !!citySlug, 
// // //         staleTime: 1000 * 60 * 60 * 24, // Cities list is very stable
// // //         refetchOnWindowFocus: false,
// // //     });

// // //     const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>({
// // //         queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // //         queryFn: async () => (await fetchSubCategoriesByCity(citySlug)).find(sc => sc.slug === subCategorySlug),
// // //         enabled: !!citySlug && !!subCategorySlug, 
// // //         staleTime: 1000 * 60 * 60, // Subcategories for a city are fairly stable
// // //         refetchOnWindowFocus: false,
// // //     });
    
// // //     const { data: shopServices, isLoading: isLoadingShopServices, error: shopServicesError } =
// // //         useQuery<ShopServiceDto[], APIError>({
// // //             queryKey: ['shopServices', shopId], // Query key includes shopId
// // //             queryFn: () => fetchServicesByShop(citySlug, subCategorySlug, shopId), 
// // //             enabled: !!shop && !!citySlug && !!subCategorySlug && !!shopId, // Only fetch if shop data is available
// // //             staleTime: 1000 * 60 * 2, // Shop services might change, 2 min stale time
// // //             refetchOnWindowFocus: false,
// // //         });

// // //     const isLoadingInitialShopData = isLoadingShop || isLoadingCity || isLoadingSubCategory;
// // //     const anyError = shopError || shopServicesError; 

// // //     return { 
// // //         shop, 
// // //         cityDetails, 
// // //         subCategoryDetails, 
// // //         shopServices, 
// // //         isLoadingShop: isLoadingInitialShopData,
// // //         isLoadingServices: isLoadingShopServices,
// // //         error: anyError 
// // //     };
// // // };


// // // // --- UI Sub-Components ---
// // // interface ShopPageHeaderProps {
// // //   shop: ShopDto;
// // //   googleMapsLink: string;
// // //   hasValidCoordinates: boolean;
// // //   mapCenter: [number, number];
// // //   openingStatus: { text: string; dotColor: string; textColor: string; bgColor: string; };
// // // }

// // // const ShopPageHeader: React.FC<ShopPageHeaderProps> = React.memo(({
// // //   shop, googleMapsLink, hasValidCoordinates, mapCenter, openingStatus
// // // }) => (
// // //   <header className="relative h-60 sm:h-72 bg-slate-700 group">
// // //     {hasValidCoordinates ? (
// // //       <MapContainer center={mapCenter} zoom={15} className="w-full h-full z-0" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false} zoomControl={false}>
// // //         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
// // //         <Marker position={mapCenter} />
// // //       </MapContainer>
// // //     ) : ( <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400"><div className="text-center text-slate-600"><MapPin className="w-16 h-16 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Location map not available</p></div></div> )}
    
// // //     <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 cursor-pointer" aria-label={`Open location of ${shop.nameEn || shop.nameAr} on Google Maps`}>
// // //       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent flex flex-col justify-end p-4 sm:p-5 z-20">
// // //         <div className="flex items-end justify-between">
// // //           <div className="max-w-[calc(100%-56px)] sm:max-w-[calc(100%-72px)]"> {/* Space for logo */}
// // //             <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
// // //               {shop.nameEn || shop.nameAr}
// // //             </h1>
// // //             {shop.address && (
// // //               <p className="text-xs text-slate-200 mt-0.5 sm:mt-1 flex items-center line-clamp-1">
// // //                 <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
// // //                 {shop.address}
// // //               </p>
// // //             )}
// // //             <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-1.5 sm:mt-2 ${openingStatus.bgColor} ${openingStatus.textColor}`}>
// // //                 <div className={`w-1.5 h-1.5 rounded-full ${openingStatus.dotColor} mr-1.5`} />
// // //                 <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{openingStatus.text}</span>
// // //             </div>
// // //           </div>
// // //           {shop.logoUrl && (
// // //             <div className="ml-3 w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-lg p-1 shadow-md flex-shrink-0">
// // //               <Image src={shop.logoUrl} alt={`${shop.nameEn || shop.nameAr} logo`} width={52} height={52} className="w-full h-full object-contain" />
// // //             </div>
// // //           )}
// // //         </div>
// // //         <Button variant="outline" size="sm" className="mt-2 sm:mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30 text-white text-xs w-fit self-start">
// // //           <ExternalLink className="w-3 h-3.5 mr-1.5"/> View on Google Maps
// // //         </Button>
// // //       </div>
// // //     </a>
// // //   </header>
// // // ));
// // // ShopPageHeader.displayName = 'ShopPageHeader';

// // // interface ServicesTabContentProps {
// // //   shop: ShopDto;
// // //   shopServices: ShopServiceDto[] | undefined;
// // //   isLoadingServices: boolean;
// // // }
// // // const ServicesTabContent: React.FC<ServicesTabContentProps> = ({ shop, shopServices, isLoadingServices }) => {
// // //   const { addItem, isUpdatingItemId, items: cartItems } = useCart(); // Use 'items' from useCart
// // //   const router = useRouter();

// // //   if (isLoadingServices) {
// // //     return (
// // //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// // //         {[...Array(3)].map((_, i) => (
// // //           <Card key={i} className="animate-pulse">
// // //             <CardHeader className="pb-2 pt-3 px-3 sm:px-4 "><div className="h-5 bg-slate-200 rounded w-3/4 mb-1"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></CardHeader>
// // //             <CardContent className="px-3 sm:px-4 pb-3"><div className="h-8 bg-slate-200 rounded w-full mt-2"></div></CardContent>
// // //           </Card>
// // //         ))}
// // //       </div>
// // //     );
// // //   }
// // //   if (!shopServices || shopServices.length === 0) {
// // //     return <p className="text-slate-500">No specific services listed for this shop currently. Please contact them for details.</p>;
// // //   }

// // //   const itemsFromThisShopInCart = cartItems.filter((cartItem: DisplayableCartItem) => cartItem.shopId === shop.id);

// // //   return (
// // //     <section>
// // //       <h2 className="text-xl font-semibold text-slate-800 mb-1">Available Services</h2>
// // //       <p className="text-sm text-slate-500 mb-5">Select services you're interested in.</p>
// // //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// // //         {shopServices.map((service: ShopServiceDto) => {
// // //           const itemInCart = itemsFromThisShopInCart.find(ci => ci.shopServiceId === service.shopServiceId);
// // //           const currentQuantityInCart = itemInCart?.quantity || 0;
// // //           const tempItemUpdatingIdentifier = `add-${shop.id}-${service.shopServiceId}`; // For add operation
// // //           const isThisItemCurrentlyBeingAdded = isUpdatingItemId === tempItemUpdatingIdentifier;
// // //           // Check if this specific item (if in cart) is being updated via its unique ID
// // //           const isThisCartItemUpdating = itemInCart ? isUpdatingItemId === itemInCart.id : false;
// // //           const isButtonDisabled = isThisItemCurrentlyBeingAdded || isThisCartItemUpdating || currentQuantityInCart > 0;


// // //           const handleAddItem = () => {
// // //             if (isButtonDisabled) return;
// // //             const itemRequest: AddToAnonymousCartRequest = {
// // //               shopId: shop.id,
// // //               shopServiceId: service.shopServiceId,
// // //               quantity: 1,
// // //             };
// // //             addItem(itemRequest);
// // //           };

// // //           return (
// // //             <Card key={service.shopServiceId} className={`flex flex-col justify-between ${isButtonDisabled && !currentQuantityInCart ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg transition-shadow'}`}>
// // //               <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
// // //                 <CardTitle className="text-sm sm:text-base font-medium text-slate-700 line-clamp-2 h-10 sm:h-12">{service.nameEn}</CardTitle>
// // //                 <p className="text-sm text-orange-600 font-semibold mt-1">{service.price.toFixed(2)} EGP</p>
// // //                 {service.durationMinutes && <p className="text-xs text-slate-500 mt-0.5">{service.durationMinutes} min (est.)</p>}
// // //               </CardHeader>
// // //               <CardContent className="px-3 sm:px-4 pb-3 mt-auto">
// // //                 <Button 
// // //                   onClick={handleAddItem} 
// // //                   disabled={isButtonDisabled}
// // //                   size="sm" 
// // //                   className="w-full text-xs bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:text-slate-100 disabled:cursor-not-allowed"
// // //                 >
// // //                   {isThisItemCurrentlyBeingAdded ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (currentQuantityInCart > 0 ? <CheckCircle className="w-4 h-4 mr-2"/> : <PlusCircle className="w-4 h-4 mr-2"/>)}
// // //                   {isThisItemCurrentlyBeingAdded ? 'Adding...' : (currentQuantityInCart > 0 ? `In Cart (${currentQuantityInCart})` : 'Add to Cart')}
// // //                 </Button>
// // //               </CardContent>
// // //             </Card>
// // //           );
// // //         })}
// // //       </div>
// // //       {itemsFromThisShopInCart.length > 0 && (
// // //           <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
// // //             <h3 className="font-semibold text-slate-700 mb-2 text-sm">
// // //                 Services from {shop.nameEn} in your cart ({itemsFromThisShopInCart.reduce((sum: number, item: DisplayableCartItem) => sum + item.quantity, 0)}):
// // //             </h3>
// // //             <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mb-3">
// // //               {itemsFromThisShopInCart.map((s: DisplayableCartItem) => <li key={s.id}>{s.serviceNameEn} (x{s.quantity})</li>)}
// // //             </ul>
// // //             <Button 
// // //                 size="sm" 
// // //                 className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
// // //                 onClick={() => router.push('/cart')}
// // //             >
// // //               <MessageCircle className="w-3.5 h-3.5 mr-2"/> View Cart & Request Quote
// // //             </Button>
// // //           </div>
// // //         )}
// // //     </section>
// // //   );
// // // };

// // // interface InfoTabContentProps { shop: ShopDto; }
// // // const InfoTabContent: React.FC<InfoTabContentProps> = React.memo(({ shop }) => (
// // //   <section>
// // //     <h2 className="text-xl font-semibold text-slate-800 mb-4">About {shop.nameEn}</h2>
// // //     {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-3 text-sm whitespace-pre-line">{shop.descriptionEn}</p>}
// // //     {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right whitespace-pre-line" dir="rtl">{shop.descriptionAr}</p>}
// // //     {shop.openingHours && (
// // //         <div className="mt-5 pt-4 border-t border-slate-200">
// // //             <h3 className="text-md font-semibold text-slate-700 mb-2">Full Opening Hours</h3>
// // //             <p className="text-sm text-slate-600 whitespace-pre-line">{shop.openingHours}</p>
// // //         </div>
// // //     )}
// // //   </section>
// // // ));
// // // InfoTabContent.displayName = 'InfoTabContent';

// // // interface ContactTabContentProps { shop: ShopDto; googleMapsLink: string; rawPhoneNumber?: string | null; whatsappLink?: string | null;}
// // // const ContactTabContent: React.FC<ContactTabContentProps> = React.memo(({ shop, googleMapsLink, rawPhoneNumber, whatsappLink }) => (
// // //   <section>
// // //     <h2 className="text-xl font-semibold text-slate-800 mb-5">Get In Touch</h2>
// // //     <div className="space-y-4 text-sm">
// // //       {shop.address && (
// // //         <div className="flex items-start"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Address</p><p className="text-slate-600">{shop.address}</p><a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline mt-0.5 inline-flex items-center">View on Google Maps <ExternalLink className="w-3 h-3 ml-1"/></a></div></div>
// // //       )}
// // //       {shop.phoneNumber && rawPhoneNumber && (
// // //         <div className="flex items-start"><Phone className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Phone</p><a href={`tel:${rawPhoneNumber}`} className="text-slate-600 hover:text-orange-600">{shop.phoneNumber}</a></div></div>
// // //       )}
// // //       {whatsappLink && (
// // //         <div className="flex items-start"><MessageCircle className="w-4 h-4 mr-3 mt-0.5 text-green-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">WhatsApp</p><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Chat on WhatsApp</a></div></div>
// // //       )}
// // //     </div>
// // //   </section>
// // // ));
// // // ContactTabContent.displayName = 'ContactTabContent';

// // // const getOpeningStatusInfoPill = (openingHours?: string | null) => {
// // //     const text = openingHours ? openingHours.split('\n')[0] : "Hours not specified";
// // //     let dotColor = "bg-slate-400", textColor = "text-slate-700", bgColor = "bg-slate-100";
// // //     if (openingHours?.toLowerCase().includes("open")) { dotColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50"; }
// // //     else if (openingHours?.toLowerCase().includes("closed")) { dotColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50"; }
// // //     return { text, dotColor, textColor, bgColor };
// // // };

// // // interface ShopDetailsClientProps { citySlug: string; subCategorySlug: string; shopId: string; }

// // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // //   const router = useRouter();
// // //   const [activeTab, setActiveTab] = useState<TabKey>("services");
// // //   const { shop, cityDetails, subCategoryDetails, shopServices, isLoadingShop, isLoadingServices, error } = useShopPageData(citySlug, subCategorySlug, shopId);
// // //   const openingStatus = useMemo(() => getOpeningStatusInfoPill(shop?.openingHours), [shop?.openingHours]);
// // //   const mapCenter = useMemo(() => shop?.latitude && shop?.longitude ? [shop.latitude, shop.longitude] as [number, number] : [30.0444, 31.2357] as [number, number], [shop?.latitude, shop?.longitude]);
// // //   const hasValidCoordinates = !!(shop?.latitude && shop?.longitude);
// // //   const googleMapsLink = hasValidCoordinates ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}` : "#";

// // //   if (isLoadingShop) return <LoadingFallback message="Loading shop details..." />;
// // //   if (error && !shop) { 
// // //     return (
// // //       <div className="container mx-auto px-4 py-10 text-center">
// // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // //           <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop Data</AlertTitle>
// // //           <AlertDescription>{error.message || "Could not load shop information."}</AlertDescription>
// // //         </Alert>
// // //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// // //       </div>
// // //     );
// // //   }
// // //   if (!shop) {
// // //     return (
// // //       <div className="container mx-auto px-4 py-10 text-center">
// // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // //           <Info className="h-5 w-5 text-yellow-600" /> <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // //           <AlertDescription>Requested shop details are not available or could not be loaded.</AlertDescription>
// // //         </Alert>
// // //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// // //       </div>
// // //     );
// // //   }

// // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ');
// // //   const subCategoryDisplayNameFromDetails = subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategoryName?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategorySlug.replace(/-/g, ' ');
// // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
// // //   const cityBreadcrumbLink = `/?city=${citySlug}`;
// // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // //   const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;

// // //   const TABS_CONFIG = [
// // //     { key: "services" as TabKey, label: "Services", icon: ListChecks, 
// // //       content: <ServicesTabContent shop={shop} shopServices={shopServices} isLoadingServices={isLoadingServices} /> },
// // //     { key: "info" as TabKey, label: "About & Hours", icon: AboutIcon, 
// // //       content: <InfoTabContent shop={shop} /> },
// // //     { key: "contact" as TabKey, label: "Contact", icon: PhoneCall, 
// // //       content: <ContactTabContent shop={shop} googleMapsLink={googleMapsLink} rawPhoneNumber={rawPhoneNumber} whatsappLink={whatsappLink} /> },
// // //   ];
// // //   const activeTabData = TABS_CONFIG.find(tab => tab.key === activeTab);

// // //   return (
// // //     <div className="bg-slate-100 min-h-screen">
// // //       <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
// // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li><Link href={cityBreadcrumbLink} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // //           {conceptPageSlug && conceptDisplayName && (
// // //             <>
// // //               <li><span className="text-slate-400">»</span></li>
// // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // //             </>
// // //           )}
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // //           <li><span className="text-slate-400">»</span></li>
// // //           <li className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // //         </ol>
// // //       </nav>

// // //       <ShopPageHeader shop={shop} googleMapsLink={googleMapsLink} hasValidCoordinates={hasValidCoordinates} mapCenter={mapCenter} openingStatus={openingStatus} />
      
// // //       <div className="container mx-auto px-0 sm:px-4 py-6">
// // //         <div className="bg-white shadow-lg rounded-lg">
// // //           <div className="border-b border-slate-200">
// // //             <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
// // //               {TABS_CONFIG.map((tab) => (
// // //                 <button key={tab.key} onClick={() => setActiveTab(tab.key)}
// // //                   className={`group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
// // //                   aria-current={activeTab === tab.key ? 'page' : undefined}>
// // //                   <tab.icon className={`-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 ${activeTab === tab.key ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-500'}`}/>
// // //                   <span>{tab.label}</span>
// // //                 </button>
// // //               ))}
// // //             </nav>
// // //           </div>
// // //           <div className="p-4 sm:p-6">{activeTabData?.content}</div>
// // //         </div>
// // //         <div className="mt-8 mb-4 text-center">
// // //           <Button onClick={() => router.back()} variant="outline" size="lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List</Button>
// // //         </div>
// // //       </div>
// // //     </div>
// // //   );
// // // }

// // // export default function ShopDetailsPage() {
// // //   const params = useParams();
// // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // //   if (!citySlug || !subCategorySlug || !shopId) {
// // //     return <LoadingFallback message="Invalid shop path..." />;
// // //   }

// // //   return (
// // //     <Suspense fallback={<LoadingFallback message={`Loading details for shop...`} />}>
// // //       <ShopDetailsClient citySlug={citySlug} subCategorySlug={subCategorySlug} shopId={shopId} />
// // //     </Suspense>
// // //   );
// // // }

// // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // //   return (
// // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-100">
// // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // //       <p className="text-slate-600 text-lg">{message}</p>
// // //     </div>
// // //   );
// // // }
// // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // // 'use client';

// // // // import React, { Suspense, useState, useMemo, useCallback } from 'react';
// // // // import { useParams, useRouter } from 'next/navigation';
// // // // import { useQuery } from '@tanstack/react-query';
// // // // import {
// // // //     fetchShopById,
// // // //     fetchCities,
// // // //     fetchSubCategoriesByCity,
// // // //     fetchServicesByShop // Ensure this is correctly implemented in apiClient.ts
// // // // } from '@/lib/apiClient';
// // // // import {
// // // //     ShopDto, APIError, CityDto, SubCategoryDto, ShopServiceDto
// // // // } from '@/types/api';
// // // // import { AddToAnonymousCartRequest } from '@/types/anonymous';
// // // // import { useCart } from '@/contexts/CartContext';

// // // // import { Button } from '@/components/ui/button';
// // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // import {
// // // //     ArrowLeft, Info, Loader2, MapPin, Phone, Clock,
// // // //     MessageCircle, ExternalLink, PlusCircle, CheckCircle,
// // // //     ListChecks, InfoIcon as AboutIcon, PhoneCall
// // // // } from 'lucide-react';
// // // // import Link from 'next/link';
// // // // import Image from 'next/image';
// // // // import dynamic from 'next/dynamic';

// // // // // --- Dynamic Imports ---
// // // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false, loading: () => <MapLoadingSkeleton /> });
// // // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // // const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// // // // // --- Helper Components & Types ---
// // // // const MapLoadingSkeleton = () => (
// // // //   <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
// // // //     <MapPin className="w-12 h-12 text-slate-400" />
// // // //   </div>
// // // // );

// // // // type TabKey = "services" | "info" | "contact";

// // // // // --- Custom Hooks for Data Fetching ---
// // // // const useShopPageData = (citySlug: string, subCategorySlug: string, shopId: string) => {
// // // //     const { data: shop, isLoading: isLoadingShop, error: shopError } =
// // // //         useQuery<ShopDto, APIError>({
// // // //             queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // // //             queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // // //             enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // // //         });

// // // //     const { data: cityDetails, isLoading: isLoadingCity } = useQuery<CityDto | undefined, APIError>({
// // // //         queryKey: ['cityDetails', citySlug],
// // // //         queryFn: async () => (await fetchCities()).find(c => c.slug === citySlug),
// // // //         enabled: !!citySlug, staleTime: Infinity,
// // // //     });

// // // //     const { data: subCategoryDetails, isLoading: isLoadingSubCategory } = useQuery<SubCategoryDto | undefined, APIError>({
// // // //         queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // // //         queryFn: async () => (await fetchSubCategoriesByCity(citySlug)).find(sc => sc.slug === subCategorySlug),
// // // //         enabled: !!citySlug && !!subCategorySlug, staleTime: Infinity,
// // // //     });
    
// // // //     const { data: shopServices, isLoading: isLoadingShopServices, error: shopServicesError } =
// // // //         useQuery<ShopServiceDto[], APIError>({
// // // //             queryKey: ['shopServices', shopId],
// // // //             queryFn: () => fetchServicesByShop(citySlug, subCategorySlug, shopId), 
// // // //             enabled: !!shop && !!citySlug && !!subCategorySlug && !!shopId,
// // // //         });

// // // //     const isLoadingInitialShopData = isLoadingShop || isLoadingCity || isLoadingSubCategory;
// // // //     // isLoading for services is handled separately in the ServicesTabContent
// // // //     const anyError = shopError || shopServicesError; 

// // // //     return { 
// // // //         shop, 
// // // //         cityDetails, 
// // // //         subCategoryDetails, 
// // // //         shopServices, 
// // // //         isLoadingShop: isLoadingInitialShopData, // Combined loading for main shop data
// // // //         isLoadingServices: isLoadingShopServices, // Separate loading for services
// // // //         error: anyError 
// // // //     };
// // // // };


// // // // // --- UI Sub-Components ---
// // // // interface ShopPageHeaderProps {
// // // //   shop: ShopDto;
// // // //   googleMapsLink: string;
// // // //   hasValidCoordinates: boolean;
// // // //   mapCenter: [number, number];
// // // //   openingStatus: { text: string; dotColor: string; textColor: string; bgColor: string; };
// // // // }

// // // // const ShopPageHeader: React.FC<ShopPageHeaderProps> = React.memo(({ // Memoize if props are stable
// // // //   shop, googleMapsLink, hasValidCoordinates, mapCenter, openingStatus
// // // // }) => (
// // // //   <header className="relative h-60 sm:h-72 bg-slate-700 group">
// // // //     {hasValidCoordinates ? (
// // // //       <MapContainer center={mapCenter} zoom={15} className="w-full h-full z-0" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false} zoomControl={false}>
// // // //         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
// // // //         <Marker position={mapCenter} />
// // // //       </MapContainer>
// // // //     ) : ( <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400"><div className="text-center text-slate-600"><MapPin className="w-16 h-16 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Location map not available</p></div></div> )}
    
// // // //     <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 cursor-pointer" aria-label={`Open location of ${shop.nameEn || shop.nameAr} on Google Maps`}>
// // // //       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent flex flex-col justify-end p-4 sm:p-5 z-20">
// // // //         <div className="flex items-end justify-between">
// // // //           <div className="max-w-[calc(100%-56px)] sm:max-w-[calc(100%-72px)]">
// // // //             <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
// // // //               {shop.nameEn || shop.nameAr}
// // // //             </h1>
// // // //             {shop.address && (
// // // //               <p className="text-xs text-slate-200 mt-0.5 sm:mt-1 flex items-center line-clamp-1">
// // // //                 <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
// // // //                 {shop.address}
// // // //               </p>
// // // //             )}
// // // //             <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-1.5 sm:mt-2 ${openingStatus.bgColor} ${openingStatus.textColor}`}>
// // // //                 <div className={`w-1.5 h-1.5 rounded-full ${openingStatus.dotColor} mr-1.5`} />
// // // //                 <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{openingStatus.text}</span>
// // // //             </div>
// // // //           </div>
// // // //           {shop.logoUrl && (
// // // //             <div className="ml-3 w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-lg p-1 shadow-md flex-shrink-0">
// // // //               <Image src={shop.logoUrl} alt={`${shop.nameEn} logo`} width={52} height={52} className="w-full h-full object-contain" />
// // // //             </div>
// // // //           )}
// // // //         </div>
// // // //         <Button variant="outline" size="sm" className="mt-2 sm:mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30 text-white text-xs w-fit self-start">
// // // //           <ExternalLink className="w-3 h-3.5 mr-1.5"/> View on Google Maps
// // // //         </Button>
// // // //       </div>
// // // //     </a>
// // // //   </header>
// // // // ));
// // // // ShopPageHeader.displayName = 'ShopPageHeader'; // For React DevTools

// // // // interface ServicesTabContentProps {
// // // //   shop: ShopDto; // Need shop.id for cart actions
// // // //   shopServices: ShopServiceDto[] | undefined;
// // // //   isLoadingServices: boolean;
// // // // }
// // // // const ServicesTabContent: React.FC<ServicesTabContentProps> = ({ shop, shopServices, isLoadingServices }) => {
// // // //   const { addItem, isUpdatingItemId, cart } = useCart();
// // // //   const router = useRouter(); // For navigating to cart

// // // //   if (isLoadingServices) {
// // // //     return (
// // // //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// // // //         {[...Array(3)].map((_, i) => (
// // // //           <Card key={i} className="animate-pulse">
// // // //             <CardHeader className="pb-2 pt-3 px-3 sm:px-4 "><div className="h-5 bg-slate-200 rounded w-3/4 mb-1"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></CardHeader>
// // // //             <CardContent className="px-3 sm:px-4 pb-3"><div className="h-8 bg-slate-200 rounded w-full mt-2"></div></CardContent>
// // // //           </Card>
// // // //         ))}
// // // //       </div>
// // // //     );
// // // //   }
// // // //   if (!shopServices || shopServices.length === 0) {
// // // //     return <p className="text-slate-500">No specific services listed for this shop currently. Please contact them for details.</p>;
// // // //   }

// // // //   return (
// // // //     <section>
// // // //       <h2 className="text-xl font-semibold text-slate-800 mb-1">Available Services</h2>
// // // //       <p className="text-sm text-slate-500 mb-5">Select services you're interested in.</p>
// // // //       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// // // //         {shopServices.map(service => {
// // // //           const itemInCart = cart?.items.find(ci => ci.shopId === shop.id && ci.shopServiceId === service.shopServiceId);
// // // //           const currentQuantityInCart = itemInCart?.quantity || 0;
// // // //           const itemUpdatingIdentifier = `${shop.id}-${service.shopServiceId}`;
// // // //           const isThisItemUpdating = isUpdatingItemId === itemUpdatingIdentifier;

// // // //           const handleAddItem = () => {
// // // //             if (isThisItemUpdating) return;
// // // //             const itemRequest: AddToAnonymousCartRequest = {
// // // //               shopId: shop.id,
// // // //               shopServiceId: service.shopServiceId,
// // // //               quantity: 1,
// // // //             };
// // // //             addItem(itemRequest);
// // // //           };

// // // //           return (
// // // //             <Card key={service.shopServiceId} className={`flex flex-col justify-between ${isThisItemUpdating ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg transition-shadow'}`}>
// // // //               <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
// // // //                 <CardTitle className="text-sm sm:text-base font-medium text-slate-700 line-clamp-2 h-10 sm:h-12">{service.nameEn}</CardTitle> {/* Fixed height for title */}
// // // //                 <p className="text-sm text-orange-600 font-semibold mt-1">{service.price.toFixed(2)} EGP</p>
// // // //                 {service.durationMinutes && <p className="text-xs text-slate-500 mt-0.5">{service.durationMinutes} min (est.)</p>}
// // // //               </CardHeader>
// // // //               <CardContent className="px-3 sm:px-4 pb-3 mt-auto">
// // // //                 <Button 
// // // //                   onClick={handleAddItem} 
// // // //                   disabled={isThisItemUpdating || currentQuantityInCart > 0}
// // // //                   size="sm" 
// // // //                   className="w-full text-xs bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:text-slate-100 disabled:cursor-not-allowed"
// // // //                 >
// // // //                   {isThisItemUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : (currentQuantityInCart > 0 ? <CheckCircle className="w-4 h-4 mr-2"/> : <PlusCircle className="w-4 h-4 mr-2"/>)}
// // // //                   {isThisItemUpdating ? 'Adding...' : (currentQuantityInCart > 0 ? `In Cart (${currentQuantityInCart})` : 'Add to Cart')}
// // // //                 </Button>
// // // //               </CardContent>
// // // //             </Card>
// // // //           );
// // // //         })}
// // // //       </div>
// // // //       {cart && cart.items.filter(item => item.shopId === shop.id).length > 0 && (
// // // //           <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
// // // //             <h3 className="font-semibold text-slate-700 mb-2 text-sm">
// // // //                 Services from {shop.nameEn} in your cart ({cart.items.filter(item => item.shopId === shop.id).reduce((sum, item) => sum + item.quantity, 0)}):
// // // //             </h3>
// // // //             <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mb-3">
// // // //               {cart.items.filter(item => item.shopId === shop.id).map(s => <li key={s.shopServiceId}>{s.serviceNameEn} (x{s.quantity})</li>)}
// // // //             </ul>
// // // //             <Button 
// // // //                 size="sm" 
// // // //                 className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
// // // //                 onClick={() => router.push('/cart')}
// // // //             >
// // // //               <MessageCircle className="w-3.5 h-3.5 mr-2"/> View Cart & Request Quote
// // // //             </Button>
// // // //           </div>
// // // //         )}
// // // //     </section>
// // // //   );
// // // // };

// // // // interface InfoTabContentProps { shop: ShopDto; }
// // // // const InfoTabContent: React.FC<InfoTabContentProps> = React.memo(({ shop }) => (
// // // //   <section>
// // // //     <h2 className="text-xl font-semibold text-slate-800 mb-4">About {shop.nameEn}</h2>
// // // //     {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-3 text-sm whitespace-pre-line">{shop.descriptionEn}</p>}
// // // //     {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right whitespace-pre-line" dir="rtl">{shop.descriptionAr}</p>}
// // // //     {shop.openingHours && (
// // // //         <div className="mt-5 pt-4 border-t border-slate-200">
// // // //             <h3 className="text-md font-semibold text-slate-700 mb-2">Full Opening Hours</h3>
// // // //             <p className="text-sm text-slate-600 whitespace-pre-line">{shop.openingHours}</p>
// // // //         </div>
// // // //     )}
// // // //   </section>
// // // // ));
// // // // InfoTabContent.displayName = 'InfoTabContent';

// // // // interface ContactTabContentProps { shop: ShopDto; googleMapsLink: string; rawPhoneNumber?: string | null; whatsappLink?: string | null;}
// // // // const ContactTabContent: React.FC<ContactTabContentProps> = React.memo(({ shop, googleMapsLink, rawPhoneNumber, whatsappLink }) => (
// // // //   <section>
// // // //     <h2 className="text-xl font-semibold text-slate-800 mb-5">Get In Touch</h2>
// // // //     <div className="space-y-4 text-sm">
// // // //       {shop.address && (
// // // //         <div className="flex items-start"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Address</p><p className="text-slate-600">{shop.address}</p><a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline mt-0.5 inline-flex items-center">View on Google Maps <ExternalLink className="w-3 h-3 ml-1"/></a></div></div>
// // // //       )}
// // // //       {shop.phoneNumber && rawPhoneNumber && (
// // // //         <div className="flex items-start"><Phone className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Phone</p><a href={`tel:${rawPhoneNumber}`} className="text-slate-600 hover:text-orange-600">{shop.phoneNumber}</a></div></div>
// // // //       )}
// // // //       {whatsappLink && (
// // // //         <div className="flex items-start"><MessageCircle className="w-4 h-4 mr-3 mt-0.5 text-green-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">WhatsApp</p><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Chat on WhatsApp</a></div></div>
// // // //       )}
// // // //     </div>
// // // //   </section>
// // // // ));
// // // // ContactTabContent.displayName = 'ContactTabContent';

// // // // // Helper for opening hours status pill
// // // // const getOpeningStatusInfoPill = (openingHours?: string | null) => {
// // // //     const text = openingHours ? openingHours.split('\n')[0] : "Hours not specified";
// // // //     let dotColor = "bg-slate-400", textColor = "text-slate-700", bgColor = "bg-slate-100";
// // // //     if (openingHours?.toLowerCase().includes("open")) { dotColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50"; }
// // // //     else if (openingHours?.toLowerCase().includes("closed")) { dotColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50"; }
// // // //     return { text, dotColor, textColor, bgColor };
// // // // };

// // // // // Props for the main client component
// // // // interface ShopDetailsClientProps {
// // // //   citySlug: string;
// // // //   subCategorySlug: string;
// // // //   shopId: string;
// // // // }

// // // // // --- Main Page Client Component ---
// // // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // // //   const router = useRouter();
// // // //   const [activeTab, setActiveTab] = useState<TabKey>("services");

// // // //   const { shop, cityDetails, subCategoryDetails, shopServices, isLoadingShop, isLoadingServices, error } =
// // // //     useShopPageData(citySlug, subCategorySlug, shopId);

// // // //   const openingStatus = useMemo(() => getOpeningStatusInfoPill(shop?.openingHours), [shop?.openingHours]);
// // // //   const mapCenter = useMemo(() => shop?.latitude && shop?.longitude ? [shop.latitude, shop.longitude] as [number, number] : [30.0444, 31.2357] as [number, number], [shop?.latitude, shop?.longitude]);
// // // //   const hasValidCoordinates = !!(shop?.latitude && shop?.longitude);
// // // //   const googleMapsLink = hasValidCoordinates ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}` : "#";

// // // //   if (isLoadingShop) return <LoadingFallback message="Loading shop details..." />;
// // // //   if (error && !shop) { // If error occurred and shop data is not available
// // // //     return (
// // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // // //           <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop Data</AlertTitle>
// // // //           <AlertDescription>{error.message || "Could not load shop information."}</AlertDescription>
// // // //         </Alert>
// // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// // // //       </div>
// // // //     );
// // // //   }
// // // //   if (!shop) {
// // // //     return (
// // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // // //           <Info className="h-5 w-5 text-yellow-600" /> <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // // //           <AlertDescription>Requested shop details are not available or could not be loaded.</AlertDescription>
// // // //         </Alert>
// // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
// // // //       </div>
// // // //     );
// // // //   }

// // // //   // Derived data for breadcrumbs etc. - ensure shop exists before accessing its properties
// // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ');
// // // //   const subCategoryDisplayNameFromDetails = subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategoryName?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategorySlug.replace(/-/g, ' ');
// // // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
// // // //   const cityBreadcrumbLink = `/?city=${citySlug}`;
// // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // //   const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;

// // // //   const TABS_CONFIG = [
// // // //     { key: "services", label: "Services", icon: ListChecks, 
// // // //       content: <ServicesTabContent shop={shop} shopServices={shopServices} isLoadingServices={isLoadingServices} /> },
// // // //     { key: "info", label: "About & Hours", icon: AboutIcon, 
// // // //       content: <InfoTabContent shop={shop} /> },
// // // //     { key: "contact", label: "Contact", icon: PhoneCall, 
// // // //       content: <ContactTabContent shop={shop} googleMapsLink={googleMapsLink} rawPhoneNumber={rawPhoneNumber} whatsappLink={whatsappLink} /> },
// // // //   ];
// // // //   const activeTabData = TABS_CONFIG.find(tab => tab.key === activeTab);

// // // //   return (
// // // //     <div className="bg-slate-100 min-h-screen">
// // // //       <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
// // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           <li><Link href={cityBreadcrumbLink} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // //           {conceptPageSlug && conceptDisplayName && (
// // // //             <> {/* Corrected from li_parent */}
// // // //               <li><span className="text-slate-400">»</span></li>
// // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // //             </>
// // // //           )}
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // // //           <li><span className="text-slate-400">»</span></li>
// // // //           <li className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // // //         </ol>
// // // //       </nav>

// // // //       <ShopPageHeader shop={shop} googleMapsLink={googleMapsLink} hasValidCoordinates={hasValidCoordinates} mapCenter={mapCenter} openingStatus={openingStatus} />
      
// // // //       <div className="container mx-auto px-0 sm:px-4 py-6">
// // // //         <div className="bg-white shadow-lg rounded-lg">
// // // //           <div className="border-b border-slate-200">
// // // //             <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
// // // //               {TABS_CONFIG.map((tab) => (
// // // //                 <button key={tab.key} onClick={() => setActiveTab(tab.key as TabKey)}
// // // //                   className={`group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
// // // //                   aria-current={activeTab === tab.key ? 'page' : undefined}>
// // // //                   <tab.icon className={`-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 ${activeTab === tab.key ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-500'}`}/>
// // // //                   <span>{tab.label}</span>
// // // //                 </button>
// // // //               ))}
// // // //             </nav>
// // // //           </div>
// // // //           <div className="p-4 sm:p-6">{activeTabData?.content}</div>
// // // //         </div>
// // // //         <div className="mt-8 mb-4 text-center">
// // // //           <Button onClick={() => router.back()} variant="outline" size="lg"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List</Button>
// // // //         </div>
// // // //       </div>
// // // //     </div>
// // // //   );
// // // // }

// // // // // --- Default Export & Loading Fallback ---
// // // // export default function ShopDetailsPage() {
// // // //   const params = useParams();
// // // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // // //   if (!citySlug || !subCategorySlug || !shopId) {
// // // //     return <LoadingFallback message="Invalid shop path..." />;
// // // //   }

// // // //   return (
// // // //     <Suspense fallback={<LoadingFallback message={`Loading details for shop...`} />}>
// // // //       <ShopDetailsClient citySlug={citySlug} subCategorySlug={subCategorySlug} shopId={shopId} />
// // // //     </Suspense>
// // // //   );
// // // // }

// // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // //   return (
// // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-100">
// // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // //     </div>
// // // //   );
// // // // }
// // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // // // 'use client';

// // // // // import React, { Suspense, useState, useMemo } from 'react';
// // // // // import { useParams, useRouter } from 'next/navigation';
// // // // // import { useQuery } from '@tanstack/react-query';
// // // // // import { fetchShopById, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // import { ShopDto, APIError, CityDto, SubCategoryDto } from '@/types/api';
// // // // // import { Button } from '@/components/ui/button';
// // // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// // // // // import { 
// // // // //     ArrowLeft, Info, Loader2, MapPin, Phone, Clock, Settings, 
// // // // //     MessageCircle, ExternalLink, Tag, PlusCircle, CheckCircle, 
// // // // //     Building2, ListChecks, InfoIcon as AboutIcon, PhoneCall // For Contact Tab
// // // // // } from 'lucide-react';
// // // // // import Link from 'next/link';
// // // // // import Image from 'next/image';
// // // // // import dynamic from 'next/dynamic';

// // // // // // Assumes leaflet-setup.ts is imported globally (e.g., in layout.tsx)
// // // // // // import '@/lib/leaflet-setup'; // Not needed here if done globally

// // // // // const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false, loading: () => <MapLoadingSkeleton /> });
// // // // // const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
// // // // // const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// // // // // const MapLoadingSkeleton = () => (
// // // // //   <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
// // // // //     <MapPin className="w-12 h-12 text-slate-400" />
// // // // //   </div>
// // // // // );


// // // // // interface ShopDetailsClientProps {
// // // // //   citySlug: string;
// // // // //   subCategorySlug: string;
// // // // //   shopId: string;
// // // // // }

// // // // // // Helper function to determine status color and text for Opening Hours Pill
// // // // // const getOpeningStatusInfo = (openingHours?: string | null) => {
// // // // //   // THIS IS A PLACEHOLDER - REPLACE WITH ACTUAL LOGIC
// // // // //   // For now, it just displays the text.
// // // // //   // Future: Parse openingHours to determine if "Open", "Closed", "Opens at X"
// // // // //   const text = openingHours ? openingHours.split('\n')[0] : "Hours not specified"; // Show first line or fallback
// // // // //   let dotColor = "bg-slate-400";
// // // // //   let textColor = "text-slate-700";
// // // // //   let bgColor = "bg-slate-100";

// // // // //   // Example future logic (very simplified)
// // // // //   if (openingHours?.toLowerCase().includes("open")) { // Crude check
// // // // //       dotColor = "bg-green-500"; textColor = "text-green-700"; bgColor = "bg-green-50";
// // // // //   } else if (openingHours?.toLowerCase().includes("closed")) {
// // // // //       dotColor = "bg-red-500"; textColor = "text-red-700"; bgColor = "bg-red-50";
// // // // //   }
  
// // // // //   return { text, dotColor, textColor, bgColor };
// // // // // };


// // // // // interface ShopDetailsClientProps {
// // // // //   citySlug: string;
// // // // //   subCategorySlug: string;
// // // // //   shopId: string;
// // // // // }

// // // // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // // // //   const router = useRouter();
// // // // //   // Default to "services" tab
// // // // //   const [activeTab, setActiveTab] = useState<"services" | "info" | "contact">("services");
// // // // //   const [selectedServices, setSelectedServices] = React.useState<Set<string>>(new Set());

// // // // //   const { data: shop, isLoading: isLoadingShop, error: shopError } =
// // // // //     useQuery<ShopDto, APIError>({
// // // // //       queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // // // //       queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // // // //       enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // // // //       staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false,
// // // // //     });

// // // // //   // City and SubCategory details are mainly for breadcrumbs now
// // // // //   const { data: cityDetails } = useQuery<CityDto | undefined, APIError>({
// // // // //     queryKey: ['cityDetails', citySlug],
// // // // //     queryFn: async () => (await fetchCities()).find(c => c.slug === citySlug),
// // // // //     enabled: !!citySlug, staleTime: 1000 * 60 * 60, refetchOnWindowFocus: false,
// // // // //   });
// // // // //   const { data: subCategoryDetails } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // // // //     queryFn: async () => (await fetchSubCategoriesByCity(citySlug)).find(sc => sc.slug === subCategorySlug),
// // // // //     enabled: !!citySlug && !!subCategorySlug, staleTime: 1000 * 60 * 15, refetchOnWindowFocus: false,
// // // // //   });

// // // // //   const toggleServiceSelection = (serviceName: string) => {
// // // // //     setSelectedServices(prev => {
// // // // //       const newSet = new Set(prev);
// // // // //       if (newSet.has(serviceName)) newSet.delete(serviceName);
// // // // //       else newSet.add(serviceName);
// // // // //       return newSet;
// // // // //     });
// // // // //   };

// // // // //   const mapCenter = useMemo(() => shop?.latitude && shop?.longitude ? [shop.latitude, shop.longitude] as [number, number] : [30.0444, 31.2357] as [number, number], [shop?.latitude, shop?.longitude]);
// // // // //   const hasValidCoordinates = shop?.latitude && shop?.longitude;
// // // // //   const googleMapsLink = hasValidCoordinates ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}` : "#";
  
// // // // //   const openingStatus = useMemo(() => getOpeningStatusInfo(shop?.openingHours), [shop?.openingHours]);

// // // // //   if (isLoadingShop || (!!citySlug && !cityDetails) || (!!subCategorySlug && !subCategoryDetails && shop?.subCategorySlug !== subCategorySlug)) {
// // // // //   return <LoadingFallback message="Loading shop details..." />;
// // // // // }

// // // // //   if (shopError) {
// // // // //     return (
// // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // // // //           <Info className="h-5 w-5" /> <AlertTitle>Error Loading Shop Details</AlertTitle>
// // // // //           <AlertDescription>
// // // // //             {shopError.status === 404 ? "Shop not found or does not match city/category." : shopError.message || "Could not load shop details."}
// // // // //           </AlertDescription>
// // // // //         </Alert>
// // // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // //           <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // //         </Button>
// // // // //       </div>
// // // // //     );
// // // // //   }

// // // // //   if (!shop) {
// // // // //     return (
// // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // // // //           <Info className="h-5 w-5 text-yellow-600" /> <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // // // //           <AlertDescription className="text-yellow-700">Requested shop details are not available.</AlertDescription>
// // // // //         </Alert>
// // // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // //           <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // //         </Button>
// // // // //       </div>
// // // // //     );
// // // // //   }


// // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ');
// // // // //   const subCategoryDisplayNameFromDetails = subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategoryName?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategorySlug.replace(/-/g, ' ');
// // // // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // // // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
// // // // //   const cityBreadcrumbLink = `/?city=${citySlug}`;
// // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // //   const whatsappLink = rawPhoneNumber ? `https://wa.me/${rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber}` : null;
// // // // //   const servicesList = shop.servicesOffered?.split(',').map(s => s.trim()).filter(s => s.length > 0) || [];

// // // // //    return (
// // // // //     <div className="bg-slate-100 min-h-screen">
// // // // //       <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
// // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li><Link href={cityBreadcrumbLink} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // //           {conceptPageSlug && conceptDisplayName && (
// // // // //             <><li><span className="text-slate-400">»</span></li><li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li></>
// // // // //           )}
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // // // //           <li><span className="text-slate-400">»</span></li>
// // // // //           <li className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // // // //         </ol>
// // // // //       </nav>

// // // // //       <header className="relative h-60 sm:h-72 bg-slate-700 group">
// // // // //         {hasValidCoordinates ? (
// // // // //           <MapContainer center={mapCenter} zoom={15} className="w-full h-full z-0" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false} zoomControl={false}>
// // // // //             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
// // // // //             <Marker position={mapCenter} />
// // // // //           </MapContainer>
// // // // //         ) : ( <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400"><div className="text-center text-slate-600"><MapPin className="w-16 h-16 mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Location map not available</p></div></div> )}
        
// // // // //         <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 cursor-pointer" aria-label={`Open location of ${shop.nameEn || shop.nameAr} on Google Maps`}>
// // // // //           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent flex flex-col justify-end p-4 sm:p-5 z-20">
// // // // //             <div className="flex items-end justify-between">
// // // // //               <div className="max-w-[calc(100%-56px)] sm:max-w-[calc(100%-72px)]"> {/* Space for logo */}
// // // // //                 <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
// // // // //                   {shop.nameEn || shop.nameAr}
// // // // //                 </h1>
// // // // //                 {shop.address && (
// // // // //                   <p className="text-xs text-slate-200 mt-0.5 sm:mt-1 flex items-center line-clamp-1">
// // // // //                     <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
// // // // //                     {shop.address}
// // // // //                   </p>
// // // // //                 )}
// // // // //                 {/* Opening Hours Status Pill */}
// // // // //                 <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-1.5 sm:mt-2 ${openingStatus.bgColor} ${openingStatus.textColor}`}>
// // // // //                     <div className={`w-1.5 h-1.5 rounded-full ${openingStatus.dotColor} mr-1.5`} />
// // // // //                     <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{openingStatus.text}</span>
// // // // //                 </div>
// // // // //               </div>
// // // // //               {shop.logoUrl && (
// // // // //                 <div className="ml-3 w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-lg p-1 shadow-md flex-shrink-0">
// // // // //                   <Image src={shop.logoUrl} alt={`${shop.nameEn} logo`} width={52} height={52} className="w-full h-full object-contain" />
// // // // //                 </div>
// // // // //               )}
// // // // //             </div>
// // // // //             <Button variant="outline" size="sm" className="mt-2 sm:mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30 text-white text-xs w-fit self-start">
// // // // //               <ExternalLink className="w-3 h-3.5 mr-1.5"/> View on Google Maps
// // // // //             </Button>
// // // // //           </div>
// // // // //         </a>
// // // // //       </header>
      
// // // // //       <div className="container mx-auto px-0 sm:px-4 py-6">
// // // // //         <div className="bg-white shadow-lg rounded-lg">
// // // // //           <div className="border-b border-slate-200">
// // // // //             <nav className="flex space-x-1 sm:space-x-2 px-3 sm:px-4 -mb-px" aria-label="Tabs">
// // // // //               {[
// // // // //                 { key: "services", label: "Services", icon: ListChecks },
// // // // //                 { key: "info", label: "About & Hours", icon: AboutIcon },
// // // // //                 { key: "contact", label: "Contact", icon: PhoneCall },
// // // // //               ].map((tab) => (
// // // // //                 <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
// // // // //                   className={`group inline-flex items-center py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
// // // // //                   aria-current={activeTab === tab.key ? 'page' : undefined}>
// // // // //                   <tab.icon className={`-ml-0.5 mr-1.5 h-4 w-4 sm:h-5 sm:w-5 ${activeTab === tab.key ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-500'}`}/>
// // // // //                   <span>{tab.label}</span>
// // // // //                 </button>
// // // // //               ))}
// // // // //             </nav>
// // // // //           </div>

// // // // //           <div className="p-4 sm:p-6">
// // // // //             {activeTab === 'services' && (
// // // // //               <section>
// // // // //                 <h2 className="text-xl font-semibold text-slate-800 mb-1">Available Services</h2>
// // // // //                 <p className="text-sm text-slate-500 mb-5">Select services you're interested in to request a quote or contact the shop.</p>
// // // // //                 {servicesList.length > 0 ? (
// // // // //                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
// // // // //                     {servicesList.map(service => {
// // // // //                       const isSelected = selectedServices.has(service);
// // // // //                       return (
// // // // //                         <Card key={service} onClick={() => toggleServiceSelection(service)}
// // // // //                           className={`cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md ${isSelected ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50/60' : 'border-slate-200 hover:border-orange-300'}`}>
// // // // //                           <CardHeader className="pb-2 pt-3 px-3 sm:px-4 flex flex-row items-center justify-between">
// // // // //                             <CardTitle className="text-sm font-medium text-slate-700">{service}</CardTitle>
// // // // //                             <div className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'bg-orange-500 border-orange-600' : 'border-slate-300 group-hover:border-orange-400' } flex items-center justify-center`}>
// // // // //                                 {isSelected && <CheckCircle className="w-2.5 h-2.5 text-white"/>}
// // // // //                             </div>
// // // // //                           </CardHeader>
// // // // //                           {/* Future: Add price/duration here if available from API */}
// // // // //                           {/* <CardContent className="px-3 sm:px-4 pb-3 text-xs text-slate-500">Price: Est. EGP 150-200</CardContent> */}
// // // // //                         </Card>
// // // // //                       );
// // // // //                     })}
// // // // //                   </div>
// // // // //                 ) : ( <p className="text-slate-500">Detailed services not listed for this shop.</p> )}
// // // // //                 {selectedServices.size > 0 && (
// // // // //                   <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
// // // // //                     <h3 className="font-semibold text-slate-700 mb-2 text-sm">Selected Services ({selectedServices.size}):</h3>
// // // // //                     <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 mb-3">
// // // // //                       {Array.from(selectedServices).map(s => <li key={s}>{s}</li>)}
// // // // //                     </ul>
// // // // //                     <Button size="sm" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
// // // // //                       <MessageCircle className="w-3.5 h-3.5 mr-2"/> Request Quote / Contact
// // // // //                     </Button>
// // // // //                   </div>
// // // // //                 )}
// // // // //               </section>
// // // // //             )}
// // // // //             {activeTab === 'info' && (
// // // // //               <section>
// // // // //                 <h2 className="text-xl font-semibold text-slate-800 mb-4">About {shop.nameEn}</h2>
// // // // //                 {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-3 text-sm whitespace-pre-line">{shop.descriptionEn}</p>}
// // // // //                 {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right whitespace-pre-line" dir="rtl">{shop.descriptionAr}</p>}
// // // // //                 {shop.openingHours && (
// // // // //                     <div className="mt-5 pt-4 border-t border-slate-200">
// // // // //                         <h3 className="text-md font-semibold text-slate-700 mb-2">Full Opening Hours</h3>
// // // // //                         <p className="text-sm text-slate-600 whitespace-pre-line">{shop.openingHours}</p>
// // // // //                     </div>
// // // // //                 )}
// // // // //               </section>
// // // // //             )}
// // // // //             {activeTab === 'contact' && (
// // // // //               <section>
// // // // //                 <h2 className="text-xl font-semibold text-slate-800 mb-5">Get In Touch</h2>
// // // // //                 <div className="space-y-4 text-sm">
// // // // //                   {shop.address && (
// // // // //                     <div className="flex items-start"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Address</p><p className="text-slate-600">{shop.address}</p><a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline mt-0.5 inline-flex items-center">View on Google Maps <ExternalLink className="w-3 h-3 ml-1"/></a></div></div>
// // // // //                   )}
// // // // //                   {shop.phoneNumber && (
// // // // //                     <div className="flex items-start"><Phone className="w-4 h-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">Phone</p><a href={`tel:${rawPhoneNumber}`} className="text-slate-600 hover:text-orange-600">{shop.phoneNumber}</a></div></div>
// // // // //                   )}
// // // // //                   {whatsappLink && (
// // // // //                     <div className="flex items-start"><MessageCircle className="w-4 h-4 mr-3 mt-0.5 text-green-500 flex-shrink-0" /><div><p className="font-medium text-slate-700">WhatsApp</p><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Chat on WhatsApp</a></div></div>
// // // // //                   )}
// // // // //                 </div>
// // // // //               </section>
// // // // //             )}
// // // // //           </div>
// // // // //         </div>
// // // // //         <div className="mt-8 mb-4 text-center">
// // // // //           <Button onClick={() => router.back()} variant="outline" size="lg">
// // // // //             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
// // // // //           </Button>
// // // // //         </div>
// // // // //       </div>
// // // // //     </div>
// // // // //   );
// // // // // }

// // // // // export default function ShopDetailsPage() {
// // // // //   const params = useParams();
// // // // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // // // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // // // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // // // //   if (!citySlug || !subCategorySlug || !shopId) {
// // // // //     return <LoadingFallback message="Invalid shop path..." />;
// // // // //   }

// // // // //   return (
// // // // //     <Suspense fallback={<LoadingFallback message="Loading shop..." />}>
// // // // //       <ShopDetailsClient citySlug={citySlug} subCategorySlug={subCategorySlug} shopId={shopId} />
// // // // //     </Suspense>
// // // // //   );
// // // // // }

// // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // //   return (
// // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-100"> {/* Match page bg */}
// // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // //     </div>
// // // // //   );
// // // // // }
// // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // // // // 'use client';

// // // // // // import React, { Suspense } from 'react';
// // // // // // import { useParams, useRouter } from 'next/navigation';
// // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // import { fetchShopById, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // import { ShopDto, APIError, CityDto, SubCategoryDto } from '@/types/api';
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// // // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// // // // // // import { ArrowLeft, Info, Loader2, MapPin, Phone, Clock, Settings, MessageCircle, ExternalLink, Tag, PlusCircle, CheckCircle } from 'lucide-react';
// // // // // // import Link from 'next/link';

// // // // // // interface ShopDetailsClientProps {
// // // // // //   citySlug: string;
// // // // // //   subCategorySlug: string;
// // // // // //   shopId: string;
// // // // // // }

// // // // // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // // // // //   const router = useRouter();

// // // // // //   const { data: shop, isLoading: isLoadingShop, error: shopError } = // Removed refetch as it's not used
// // // // // //     useQuery<ShopDto, APIError>({
// // // // // //       queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // // // // //       queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // // // // //       enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // // // // //       staleTime: 1000 * 60 * 5, // 5 minutes
// // // // // //       refetchOnWindowFocus: false,
// // // // // //     });

// // // // // //   const { data: cityDetails } = useQuery<CityDto | undefined, APIError>({
// // // // // //     queryKey: ['cityDetails', citySlug],
// // // // // //     queryFn: async () => {
// // // // // //         const cities = await fetchCities();
// // // // // //         return cities.find(c => c.slug === citySlug);
// // // // // //     },
// // // // // //     enabled: !!citySlug,
// // // // // //     staleTime: 1000 * 60 * 60, // 1 hour, or Infinity if cities rarely change
// // // // // //     refetchOnWindowFocus: false,
// // // // // //   });

// // // // // //   const { data: subCategoryDetails } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // // // // //     queryFn: async () => {
// // // // // //         const subCategories = await fetchSubCategoriesByCity(citySlug); // Fetch all for the city
// // // // // //         return subCategories.find(sc => sc.slug === subCategorySlug);
// // // // // //     },
// // // // // //     enabled: !!citySlug && !!subCategorySlug,
// // // // // //     staleTime: 1000 * 60 * 15, // 15 minutes, or more if less volatile
// // // // // //     refetchOnWindowFocus: false,
// // // // // //   });

// // // // // //   // State to simulate "adding" a service (UI only)
// // // // // //   const [selectedServices, setSelectedServices] = React.useState<Set<string>>(new Set());

// // // // // //   const toggleServiceSelection = (serviceName: string) => {
// // // // // //     setSelectedServices(prev => {
// // // // // //       const newSet = new Set(prev);
// // // // // //       if (newSet.has(serviceName)) {
// // // // // //         newSet.delete(serviceName);
// // // // // //       } else {
// // // // // //         newSet.add(serviceName);
// // // // // //       }
// // // // // //       return newSet;
// // // // // //     });
// // // // // //   };


// // // // // //   if (isLoadingShop || (!!citySlug && !cityDetails) || (!!subCategorySlug && !subCategoryDetails && shop?.subCategorySlug !== subCategorySlug)) {
// // // // // //     // A more specific check for subCategoryDetails:
// // // // // //     // If subCategoryDetails is explicitly fetched and is null (not found), but the shop data has a different subCategorySlug,
// // // // // //     // it might indicate an inconsistent URL or data.
// // // // // //     // However, the primary loading condition is simpler:
// // // // // //     // isLoadingShop || (citySlug && !cityDetails) || (subCategorySlug && !subCategoryDetails)
// // // // // //     // The shop?.subCategorySlug !== subCategorySlug check is more for data integrity after loading.
// // // // // //     return <LoadingFallback message="Loading shop details..." />;
// // // // // //   }

// // // // // //   if (shopError) {
// // // // // //     return (
// // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // // // // //           <Info className="h-5 w-5" />
// // // // // //           <AlertTitle>Error Loading Shop Details</AlertTitle>
// // // // // //           <AlertDescription>
// // // // // //             {shopError.status === 404
// // // // // //               ? "The shop you are looking for could not be found or does not match the provided city/category."
// // // // // //               : shopError instanceof APIError ? shopError.message : "Could not load shop details."}
// // // // // //           </AlertDescription>
// // // // // //         </Alert>
// // // // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // //              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // //         </Button>
// // // // // //       </div>
// // // // // //     );
// // // // // //   }

// // // // // //   if (!shop) {
// // // // // //     // This case should ideally be covered by shopError.status === 404,
// // // // // //     // but as a fallback if the API returns 200 with null/undefined.
// // // // // //     return (
// // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // // // // //           <Info className="h-5 w-5 text-yellow-600" />
// // // // // //           <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // // // // //           <AlertDescription className="text-yellow-700">
// // // // // //             The requested shop details are not available.
// // // // // //           </AlertDescription>
// // // // // //         </Alert>
// // // // // //          <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // //             <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // //         </Button>
// // // // // //       </div>
// // // // // //     );
// // // // // //   }

// // // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
// // // // // //   // Prefer subCategoryDetails for display name if available, fallback to shop.subCategoryName
// // // // // //   const subCategoryDisplayNameFromDetails =
// // // // // //     subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() ||
// // // // // //     shop.subCategoryName?.replace(/([A-Z])/g, ' $1').trim() ||
// // // // // //     shop.subCategorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

// // // // // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // // // // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";

// // // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // // //   let whatsappLink = null;
// // // // // //   if (rawPhoneNumber) {
// // // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber;
// // // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // // //   }

// // // // // //   const servicesList = shop.servicesOffered?.split(',').map(s => s.trim()).filter(s => s.length > 0);
// // // // // //   const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;

// // // // // //   // Construct the correct city link for breadcrumbs
// // // // // //   const cityBreadcrumbLink = `/?city=${citySlug}`;
// // // // // //   // Preserve other relevant query params if needed, e.g., location from previous page
// // // // // //   // For simplicity, this example just links to the city on homepage.
// // // // // //   // const cityBreadcrumbLink = `/?city=${citySlug}${router.query.userLatitude ? `&userLatitude=${router.query.userLatitude}&userLongitude=${router.query.userLongitude}` : '' }`;


// // // // // //   return (
// // // // // //     <div className="bg-slate-50 min-h-screen">
// // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           {/* MODIFIED CITY LINK */}
// // // // // //           <li><Link href={cityBreadcrumbLink} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // // //           {conceptPageSlug && conceptDisplayName && ( // Ensure both exist before rendering
// // // // // //             <>
// // // // // //               <li><span className="text-slate-400">»</span></li>
// // // // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // // // //             </>
// // // // // //           )}
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // //           <li className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-xs" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // // // // //         </ol>
// // // // // //       </nav>

// // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // // // //         {/* Shop Header Card */}
// // // // // //         <Card className="mb-8 shadow-lg">
// // // // // //           <div className="flex flex-col md:flex-row">
// // // // // //             {shop.logoUrl && (
// // // // // //               <div className="md:w-1/3 flex-shrink-0 p-4">
// // // // // //                 <img
// // // // // //                   src={shop.logoUrl}
// // // // // //                   alt={`${shop.nameEn || shop.nameAr} logo`}
// // // // // //                   className="w-full h-48 md:h-full object-contain rounded-md bg-gray-100 p-2"
// // // // // //                 />
// // // // // //               </div>
// // // // // //             )}
// // // // // //             <div className={`p-6 ${shop.logoUrl ? 'md:w-2/3' : 'w-full'}`}>
// // // // // //               <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-1">{shop.nameEn}</h1>
// // // // // //               {shop.nameAr && <h2 className="text-lg lg:text-xl font-semibold text-slate-600 text-right mb-3" dir="rtl">{shop.nameAr}</h2>}

// // // // // //               {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-2 text-sm">{shop.descriptionEn}</p>}
// // // // // //               {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right" dir="rtl">{shop.descriptionAr}</p>}

// // // // // //               <Link
// // // // // //                 href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`}
// // // // // //                 className="text-xs text-orange-600 hover:text-orange-700 hover:underline flex items-center mt-3"
// // // // // //               >
// // // // // //                 <Tag className="w-3 h-3 mr-1.5" />
// // // // // //                 {subCategoryDisplayNameFromDetails} in {cityDisplayName}
// // // // // //               </Link>
// // // // // //             </div>
// // // // // //           </div>
// // // // // //         </Card>

// // // // // //         {/* Main Content: Services and Contact Info */}
// // // // // //         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
// // // // // //           {/* Services Section (takes more space) */}
// // // // // //           <div className="lg:col-span-8">
// // // // // //             <h2 className="text-2xl font-semibold text-slate-800 mb-6">
// // // // // //               Our Services
// // // // // //             </h2>
// // // // // //             {servicesList && servicesList.length > 0 ? (
// // // // // //               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6"> {/* Removed md:grid-cols-2, sm is enough */}
// // // // // //                 {servicesList.map(service => {
// // // // // //                   const isSelected = selectedServices.has(service);
// // // // // //                   return (
// // // // // //                     <Card key={service} className={`transition-all duration-200 ease-in-out hover:shadow-lg ${isSelected ? 'border-orange-500 ring-2 ring-orange-500' : 'border-slate-200'}`}>
// // // // // //                       <CardHeader className="pb-3">
// // // // // //                         <CardTitle className="text-md font-semibold text-slate-700">{service}</CardTitle>
// // // // // //                         {/* <CardDescription className="text-xs pt-1">Brief description of {service.toLowerCase()}.</CardDescription> */}
// // // // // //                       </CardHeader>
// // // // // //                       <CardFooter>
// // // // // //                         <Button
// // // // // //                           variant={isSelected ? "default" : "outline"}
// // // // // //                           size="sm"
// // // // // //                           className={`w-full ${isSelected ? 'bg-orange-500 hover:bg-orange-600' : 'text-orange-600 border-orange-500 hover:bg-orange-50'}`}
// // // // // //                           onClick={() => toggleServiceSelection(service)}
// // // // // //                         >
// // // // // //                           {isSelected ? <CheckCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
// // // // // //                           {isSelected ? "Selected" : "Select Service"}
// // // // // //                         </Button>
// // // // // //                       </CardFooter>
// // // // // //                     </Card>
// // // // // //                   );
// // // // // //                 })}
// // // // // //               </div>
// // // // // //             ) : (
// // // // // //               <p className="text-slate-500">Services offered by this shop are not listed in detail.</p>
// // // // // //             )}
// // // // // //           </div>

// // // // // //           {/* Contact & Hours Sidebar (takes less space) */}
// // // // // //           <div className="lg:col-span-4 space-y-6">
// // // // // //             <div>
// // // // // //               <h3 className="text-xl font-semibold text-slate-700 mb-3">Contact & Location</h3>
// // // // // //               <div className="space-y-3 bg-white p-4 rounded-md shadow">
// // // // // //                 {shop.address && (
// // // // // //                   <div className="flex items-start text-sm">
// // // // // //                     <MapPin className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // //                     <span className="text-slate-700">{shop.address}</span>
// // // // // //                   </div>
// // // // // //                 )}
// // // // // //                  <a
// // // // // //                     href={googleMapsLink}
// // // // // //                     target="_blank" rel="noopener noreferrer"
// // // // // //                     className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium py-1"
// // // // // //                   >
// // // // // //                     View on Google Maps <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
// // // // // //                   </a>
// // // // // //                 {shop.phoneNumber && (
// // // // // //                   <div className="flex items-center text-sm">
// // // // // //                     <Phone className="w-5 h-5 mr-2.5 text-slate-500 flex-shrink-0" />
// // // // // //                     <a href={`tel:${rawPhoneNumber}`} className="text-slate-700 hover:text-orange-600">{shop.phoneNumber}</a>
// // // // // //                   </div>
// // // // // //                 )}
// // // // // //                 {whatsappLink && (
// // // // // //                    <a
// // // // // //                      href={whatsappLink}
// // // // // //                      target="_blank" rel="noopener noreferrer"
// // // // // //                      className="inline-flex items-center text-sm text-green-600 hover:text-green-700 font-medium py-1"
// // // // // //                     >
// // // // // //                      <MessageCircle className="w-5 h-5 mr-2"/> Message on WhatsApp
// // // // // //                    </a>
// // // // // //                 )}
// // // // // //               </div>
// // // // // //             </div>

// // // // // //             {shop.openingHours && (
// // // // // //               <div>
// // // // // //                 <h3 className="text-xl font-semibold text-slate-700 mb-3">Opening Hours</h3>
// // // // // //                 <div className="flex items-start text-sm bg-white p-4 rounded-md shadow">
// // // // // //                   <Clock className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // //                   <p className="text-slate-700 whitespace-pre-line">{shop.openingHours}</p>
// // // // // //                 </div>
// // // // // //               </div>
// // // // // //             )}
// // // // // //           </div>
// // // // // //         </div>

// // // // // //         <div className="mt-10 text-center">
// // // // // //             <Button onClick={() => router.back()} variant="outline" size="lg">
// // // // // //                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
// // // // // //             </Button>
// // // // // //         </div>
// // // // // //       </div>
// // // // // //     </div>
// // // // // //   );
// // // // // // }

// // // // // // export default function ShopDetailsPage() {
// // // // // //   const params = useParams();
// // // // // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // // // // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // // // // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // // // // //   if (!citySlug || !subCategorySlug || !shopId) {
// // // // // //     return <LoadingFallback message="Invalid shop path..." />;
// // // // // //   }

// // // // // //   return (
// // // // // //     <Suspense fallback={<LoadingFallback message="Loading shop..." />}>
// // // // // //       <ShopDetailsClient
// // // // // //         citySlug={citySlug}
// // // // // //         subCategorySlug={subCategorySlug}
// // // // // //         shopId={shopId}
// // // // // //       />
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
// // // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // // // // // 'use client';

// // // // // // // import React, { Suspense } from 'react';
// // // // // // // import { useParams, useRouter } from 'next/navigation';
// // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // import { fetchShopById, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // // import { ShopDto, APIError, CityDto, SubCategoryDto } from '@/types/api';
// // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Import more Card parts
// // // // // // // import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// // // // // // // import { ArrowLeft, Info, Loader2, MapPin, Phone, Clock, Settings, MessageCircle, ExternalLink, Tag, PlusCircle, CheckCircle } from 'lucide-react'; // Added PlusCircle
// // // // // // // import Link from 'next/link';

// // // // // // // interface ShopDetailsClientProps {
// // // // // // //   citySlug: string;
// // // // // // //   subCategorySlug: string;
// // // // // // //   shopId: string;
// // // // // // // }

// // // // // // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // // // // // //   const router = useRouter();

// // // // // // //   const { data: shop, isLoading: isLoadingShop, error: shopError, refetch } = 
// // // // // // //     useQuery<ShopDto, APIError>({
// // // // // // //       queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // // // // // //       queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // // // // // //       enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // // // // // //       staleTime: 1000 * 60 * 5, 
// // // // // // //       refetchOnWindowFocus: false,
// // // // // // //     });

// // // // // // //   const { data: cityDetails } = useQuery<CityDto | undefined, APIError>({
// // // // // // //     queryKey: ['cityDetails', citySlug],
// // // // // // //     queryFn: async () => (await fetchCities()).find(c => c.slug === citySlug),
// // // // // // //     enabled: !!citySlug, staleTime: Infinity 
// // // // // // //   });

// // // // // // //   const { data: subCategoryDetails } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // // // // // //     queryFn: async () => (await fetchSubCategoriesByCity(citySlug)).find(sc => sc.slug === subCategorySlug),
// // // // // // //     enabled: !!citySlug && !!subCategorySlug, staleTime: Infinity
// // // // // // //   });

// // // // // // //   // State to simulate "adding" a service (UI only)
// // // // // // //   const [selectedServices, setSelectedServices] = React.useState<Set<string>>(new Set());

// // // // // // //   const toggleServiceSelection = (serviceName: string) => {
// // // // // // //     setSelectedServices(prev => {
// // // // // // //       const newSet = new Set(prev);
// // // // // // //       if (newSet.has(serviceName)) {
// // // // // // //         newSet.delete(serviceName);
// // // // // // //       } else {
// // // // // // //         newSet.add(serviceName);
// // // // // // //       }
// // // // // // //       return newSet;
// // // // // // //     });
// // // // // // //   };


// // // // // // //   if (isLoadingShop || (!!citySlug && !cityDetails) || (!!subCategorySlug && !subCategoryDetails && shop?.subCategorySlug !== subCategorySlug)) {
// // // // // // //     return <LoadingFallback message="Loading shop details..." />;
// // // // // // //   }

// // // // // // //   if (shopError) {
// // // // // // //     return (
// // // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // // // // // //           <Info className="h-5 w-5" />
// // // // // // //           <AlertTitle>Error Loading Shop Details</AlertTitle>
// // // // // // //           <AlertDescription>
// // // // // // //             {shopError.status === 404 
// // // // // // //               ? "The shop you are looking for could not be found or does not match the provided city/category." 
// // // // // // //               : shopError instanceof APIError ? shopError.message : "Could not load shop details."}
// // // // // // //           </AlertDescription>
// // // // // // //         </Alert>
// // // // // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // // //              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // // //         </Button>
// // // // // // //       </div>
// // // // // // //     );
// // // // // // //   }

// // // // // // //   if (!shop) {
// // // // // // //     return (
// // // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // // // // // //           <Info className="h-5 w-5 text-yellow-600" />
// // // // // // //           <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // // // // // //           <AlertDescription className="text-yellow-700">
// // // // // // //             The requested shop details are not available.
// // // // // // //           </AlertDescription>
// // // // // // //         </Alert>
// // // // // // //          <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // // //             <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // // //         </Button>
// // // // // // //       </div>
// // // // // // //     );
// // // // // // //   }

// // // // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ');
// // // // // // //   const subCategoryDisplayNameFromDetails = subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategoryName.replace(/([A-Z])/g, ' $1').trim();
  
// // // // // // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // // // // // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
  
// // // // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // // // //   let whatsappLink = null;
// // // // // // //   if (rawPhoneNumber) {
// // // // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber; 
// // // // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // // // //   }

// // // // // // //   const servicesList = shop.servicesOffered?.split(',').map(s => s.trim()).filter(s => s.length > 0);
// // // // // // //   const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;

// // // // // // //   return (
// // // // // // //     <div className="bg-slate-50 min-h-screen">
// // // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
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
// // // // // // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // //           <li className="font-medium text-slate-700 truncate" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // // // // // //         </ol>
// // // // // // //       </nav>

// // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // // // // //         {/* Shop Header Card */}
// // // // // // //         <Card className="mb-8 shadow-lg">
// // // // // // //           <div className="flex flex-col md:flex-row">
// // // // // // //             {shop.logoUrl && (
// // // // // // //               <div className="md:w-1/3 flex-shrink-0 p-4">
// // // // // // //                 <img 
// // // // // // //                   src={shop.logoUrl} 
// // // // // // //                   alt={`${shop.nameEn} logo`} 
// // // // // // //                   className="w-full h-48 md:h-full object-contain rounded-md bg-gray-100 p-2"
// // // // // // //                 />
// // // // // // //               </div>
// // // // // // //             )}
// // // // // // //             <div className={`p-6 ${shop.logoUrl ? 'md:w-2/3' : 'w-full'}`}>
// // // // // // //               <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-1">{shop.nameEn}</h1>
// // // // // // //               {shop.nameAr && <h2 className="text-lg lg:text-xl font-semibold text-slate-600 text-right mb-3" dir="rtl">{shop.nameAr}</h2>}
              
// // // // // // //               {shop.descriptionEn && <p className="text-slate-600 leading-relaxed mb-2 text-sm">{shop.descriptionEn}</p>}
// // // // // // //               {shop.descriptionAr && <p className="text-slate-600 leading-relaxed text-sm text-right" dir="rtl">{shop.descriptionAr}</p>}
              
// // // // // // //               <Link 
// // // // // // //                 href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} 
// // // // // // //                 className="text-xs text-orange-600 hover:text-orange-700 hover:underline flex items-center mt-3"
// // // // // // //               >
// // // // // // //                 <Tag className="w-3 h-3 mr-1.5" />
// // // // // // //                 {subCategoryDisplayNameFromDetails} in {cityDisplayName}
// // // // // // //               </Link>
// // // // // // //             </div>
// // // // // // //           </div>
// // // // // // //         </Card>

// // // // // // //         {/* Main Content: Services and Contact Info */}
// // // // // // //         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
// // // // // // //           {/* Services Section (takes more space) */}
// // // // // // //           <div className="lg:col-span-8">
// // // // // // //             <h2 className="text-2xl font-semibold text-slate-800 mb-6">
// // // // // // //               Our Services
// // // // // // //             </h2>
// // // // // // //             {servicesList && servicesList.length > 0 ? (
// // // // // // //               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
// // // // // // //                 {servicesList.map(service => {
// // // // // // //                   const isSelected = selectedServices.has(service);
// // // // // // //                   return (
// // // // // // //                     <Card key={service} className={`transition-all duration-200 ease-in-out hover:shadow-lg ${isSelected ? 'border-orange-500 ring-2 ring-orange-500' : 'border-slate-200'}`}>
// // // // // // //                       <CardHeader className="pb-3">
// // // // // // //                         <CardTitle className="text-md font-semibold text-slate-700">{service}</CardTitle>
// // // // // // //                         {/* Placeholder for service description if available in future */}
// // // // // // //                         {/* <CardDescription className="text-xs pt-1">Brief description of {service.toLowerCase()}.</CardDescription> */}
// // // // // // //                       </CardHeader>
// // // // // // //                       <CardFooter>
// // // // // // //                         <Button 
// // // // // // //                           variant={isSelected ? "default" : "outline"} 
// // // // // // //                           size="sm" 
// // // // // // //                           className={`w-full ${isSelected ? 'bg-orange-500 hover:bg-orange-600' : 'text-orange-600 border-orange-500 hover:bg-orange-50'}`}
// // // // // // //                           onClick={() => toggleServiceSelection(service)}
// // // // // // //                         >
// // // // // // //                           {isSelected ? <CheckCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
// // // // // // //                           {isSelected ? "Selected" : "Select Service"}
// // // // // // //                         </Button>
// // // // // // //                       </CardFooter>
// // // // // // //                     </Card>
// // // // // // //                   );
// // // // // // //                 })}
// // // // // // //               </div>
// // // // // // //             ) : (
// // // // // // //               <p className="text-slate-500">Services offered by this shop are not listed in detail.</p>
// // // // // // //             )}
// // // // // // //           </div>

// // // // // // //           {/* Contact & Hours Sidebar (takes less space) */}
// // // // // // //           <div className="lg:col-span-4 space-y-6">
// // // // // // //             <div>
// // // // // // //               <h3 className="text-xl font-semibold text-slate-700 mb-3">Contact & Location</h3>
// // // // // // //               <div className="space-y-3 bg-white p-4 rounded-md shadow">
// // // // // // //                 {shop.address && (
// // // // // // //                   <div className="flex items-start text-sm">
// // // // // // //                     <MapPin className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // // //                     <span className="text-slate-700">{shop.address}</span>
// // // // // // //                   </div>
// // // // // // //                 )}
// // // // // // //                  <a 
// // // // // // //                     href={googleMapsLink} 
// // // // // // //                     target="_blank" rel="noopener noreferrer"
// // // // // // //                     className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium py-1"
// // // // // // //                   >
// // // // // // //                     View on Google Maps <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
// // // // // // //                   </a>
// // // // // // //                 {shop.phoneNumber && (
// // // // // // //                   <div className="flex items-center text-sm">
// // // // // // //                     <Phone className="w-5 h-5 mr-2.5 text-slate-500 flex-shrink-0" />
// // // // // // //                     <a href={`tel:${rawPhoneNumber}`} className="text-slate-700 hover:text-orange-600">{shop.phoneNumber}</a>
// // // // // // //                   </div>
// // // // // // //                 )}
// // // // // // //                 {whatsappLink && (
// // // // // // //                    <a 
// // // // // // //                      href={whatsappLink} 
// // // // // // //                      target="_blank" rel="noopener noreferrer" 
// // // // // // //                      className="inline-flex items-center text-sm text-green-600 hover:text-green-700 font-medium py-1"
// // // // // // //                     >
// // // // // // //                      <MessageCircle className="w-5 h-5 mr-2"/> Message on WhatsApp
// // // // // // //                    </a>
// // // // // // //                 )}
// // // // // // //               </div>
// // // // // // //             </div>

// // // // // // //             {shop.openingHours && (
// // // // // // //               <div>
// // // // // // //                 <h3 className="text-xl font-semibold text-slate-700 mb-3">Opening Hours</h3>
// // // // // // //                 <div className="flex items-start text-sm bg-white p-4 rounded-md shadow">
// // // // // // //                   <Clock className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // // //                   <p className="text-slate-700 whitespace-pre-line">{shop.openingHours}</p>
// // // // // // //                 </div>
// // // // // // //               </div>
// // // // // // //             )}
// // // // // // //           </div>
// // // // // // //         </div>
        
// // // // // // //         <div className="mt-10 text-center">
// // // // // // //             <Button onClick={() => router.back()} variant="outline" size="lg">
// // // // // // //                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shops List
// // // // // // //             </Button>
// // // // // // //         </div>
// // // // // // //       </div>
// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }

// // // // // // // export default function ShopDetailsPage() {
// // // // // // //   const params = useParams();
// // // // // // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // // // // // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // // // // // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // // // // // //   if (!citySlug || !subCategorySlug || !shopId) {
// // // // // // //     return <LoadingFallback message="Invalid shop path..." />;
// // // // // // //   }

// // // // // // //   return (
// // // // // // //     <Suspense fallback={<LoadingFallback message="Loading shop..." />}>
// // // // // // //       <ShopDetailsClient 
// // // // // // //         citySlug={citySlug} 
// // // // // // //         subCategorySlug={subCategorySlug} 
// // // // // // //         shopId={shopId} 
// // // // // // //       />
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
// // // // // // // // // src/app/cities/[citySlug]/categories/[subCategorySlug]/shops/[shopId]/page.tsx
// // // // // // // // 'use client';

// // // // // // // // import React, { Suspense } from 'react';
// // // // // // // // import { useParams, useRouter } from 'next/navigation';
// // // // // // // // import { useQuery } from '@tanstack/react-query';
// // // // // // // // import { fetchShopById, fetchCities, fetchSubCategoriesByCity } from '@/lib/apiClient';
// // // // // // // // import { ShopDto, APIError, CityDto, SubCategoryDto } from '@/types/api';
// // // // // // // // import { Button } from '@/components/ui/button';
// // // // // // // // import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// // // // // // // // import { ArrowLeft, Info, Loader2, MapPin, Phone, Clock, Settings, MessageCircle, ExternalLink, Tag } from 'lucide-react';
// // // // // // // // import Link from 'next/link';
// // // // // // // // // We might want a simple map component later, for now, maybe a link to Google Maps
// // // // // // // // // import ShopMap from '@/components/shop/ShopMap'; 

// // // // // // // // interface ShopDetailsClientProps {
// // // // // // // //   citySlug: string;
// // // // // // // //   subCategorySlug: string;
// // // // // // // //   shopId: string;
// // // // // // // // }

// // // // // // // // function ShopDetailsClient({ citySlug, subCategorySlug, shopId }: ShopDetailsClientProps) {
// // // // // // // //   const router = useRouter();

// // // // // // // //   const { data: shop, isLoading: isLoadingShop, error: shopError, refetch } = 
// // // // // // // //     useQuery<ShopDto, APIError>({
// // // // // // // //       queryKey: ['shopDetails', citySlug, subCategorySlug, shopId],
// // // // // // // //       queryFn: () => fetchShopById(citySlug, subCategorySlug, shopId),
// // // // // // // //       enabled: !!citySlug && !!subCategorySlug && !!shopId,
// // // // // // // //       staleTime: 1000 * 60 * 5, // Cache for 5 minutes
// // // // // // // //       refetchOnWindowFocus: false,
// // // // // // // //     });

// // // // // // // //   // Optional: Fetch city and subcategory details for breadcrumbs/context if not readily available
// // // // // // // //   // These might already be cached by Tanstack Query if visited recently
// // // // // // // //   const { data: cityDetails } = useQuery<CityDto | undefined, APIError>({
// // // // // // // //     queryKey: ['cityDetails', citySlug],
// // // // // // // //     queryFn: async () => (await fetchCities()).find(c => c.slug === citySlug),
// // // // // // // //     enabled: !!citySlug, staleTime: Infinity 
// // // // // // // //   });

// // // // // // // //   const { data: subCategoryDetails } = useQuery<SubCategoryDto | undefined, APIError>({
// // // // // // // //     queryKey: ['subCategoryDetails', citySlug, subCategorySlug],
// // // // // // // //     queryFn: async () => (await fetchSubCategoriesByCity(citySlug)).find(sc => sc.slug === subCategorySlug), // Potentially filter by concept too
// // // // // // // //     enabled: !!citySlug && !!subCategorySlug, staleTime: Infinity
// // // // // // // //   });


// // // // // // // //   if (isLoadingShop || (!!citySlug && !cityDetails) || (!!subCategorySlug && !subCategoryDetails && shop?.subCategorySlug !== subCategorySlug)) {
// // // // // // // //     // Show loading if shop is loading, or if context data (city/subcat) for breadcrumbs is still loading
// // // // // // // //     // and the shop data itself doesn't yet provide the subCategorySlug to match the URL's subCategorySlug.
// // // // // // // //     // This condition might need refinement based on how critical breadcrumb data is before showing shop data.
// // // // // // // //     return <LoadingFallback message="Loading shop details..." />;
// // // // // // // //   }

// // // // // // // //   if (shopError) {
// // // // // // // //     return (
// // // // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // // // //         <Alert variant="destructive" className="max-w-xl mx-auto">
// // // // // // // //           <Info className="h-5 w-5" />
// // // // // // // //           <AlertTitle>Error Loading Shop Details</AlertTitle>
// // // // // // // //           <AlertDescription>
// // // // // // // //             {shopError.status === 404 
// // // // // // // //               ? "The shop you are looking for could not be found or does not match the provided city/category." 
// // // // // // // //               : shopError instanceof APIError ? shopError.message : "Could not load shop details."}
// // // // // // // //           </AlertDescription>
// // // // // // // //         </Alert>
// // // // // // // //         <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // // // //              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // // // //         </Button>
// // // // // // // //       </div>
// // // // // // // //     );
// // // // // // // //   }

// // // // // // // //   if (!shop) {
// // // // // // // //     // This case handles if queryFn returns undefined or if there's no error but no shop
// // // // // // // //     return (
// // // // // // // //       <div className="container mx-auto px-4 py-10 text-center">
// // // // // // // //         <Alert variant="default" className="max-w-xl mx-auto bg-yellow-50 border-yellow-300">
// // // // // // // //           <Info className="h-5 w-5 text-yellow-600" />
// // // // // // // //           <AlertTitle className="text-yellow-800">Shop Not Found</AlertTitle>
// // // // // // // //           <AlertDescription className="text-yellow-700">
// // // // // // // //             The requested shop details are not available.
// // // // // // // //           </AlertDescription>
// // // // // // // //         </Alert>
// // // // // // // //          <Button onClick={() => router.back()} variant="outline" className="mt-6">
// // // // // // // //             <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
// // // // // // // //         </Button>
// // // // // // // //       </div>
// // // // // // // //     );
// // // // // // // //   }

// // // // // // // //   const cityDisplayName = cityDetails?.nameEn || citySlug.replace(/-/g, ' ');
// // // // // // // //   const subCategoryDisplayNameFromDetails = subCategoryDetails?.name?.replace(/([A-Z])/g, ' $1').trim() || shop.subCategoryName.replace(/([A-Z])/g, ' $1').trim();
  
// // // // // // // //   const conceptPageSlug = shop.concept === 1 ? "maintenance-services" : shop.concept === 2 ? "auto-parts" : "";
// // // // // // // //   const conceptDisplayName = shop.concept === 1 ? "Maintenance" : shop.concept === 2 ? "Marketplace" : "";
  
// // // // // // // //   const rawPhoneNumber = shop.phoneNumber?.replace(/\s+/g, '');
// // // // // // // //   let whatsappLink = null;
// // // // // // // //   if (rawPhoneNumber) {
// // // // // // // //     const internationalNumber = rawPhoneNumber.startsWith('0') ? `2${rawPhoneNumber}` : rawPhoneNumber; 
// // // // // // // //     whatsappLink = `https://wa.me/${internationalNumber}`;
// // // // // // // //   }

// // // // // // // //   const servicesList = shop.servicesOffered?.split(',').map(s => s.trim()).filter(s => s.length > 0);

// // // // // // // //   const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;


// // // // // // // //   return (
// // // // // // // //     <div className="bg-slate-50 min-h-screen">
// // // // // // // //       {/* Breadcrumbs */}
// // // // // // // //       <nav aria-label="Breadcrumb" className="bg-slate-100 border-b border-slate-200">
// // // // // // // //         <ol className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500">
// // // // // // // //           <li><Link href="/" className="hover:text-orange-600 hover:underline">Home</Link></li>
// // // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // // //           <li><Link href={`/cities/${citySlug}`} className="hover:text-orange-600 hover:underline">{cityDisplayName}</Link></li>
// // // // // // // //           {conceptPageSlug && (
// // // // // // // //             <>
// // // // // // // //               <li><span className="text-slate-400">»</span></li>
// // // // // // // //               <li><Link href={`/cities/${citySlug}/${conceptPageSlug}`} className="hover:text-orange-600 hover:underline">{conceptDisplayName}</Link></li>
// // // // // // // //             </>
// // // // // // // //           )}
// // // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // // //           <li><Link href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} className="hover:text-orange-600 hover:underline">{subCategoryDisplayNameFromDetails}</Link></li>
// // // // // // // //           <li><span className="text-slate-400">»</span></li>
// // // // // // // //           <li className="font-medium text-slate-700 truncate" aria-current="page">{shop.nameEn || shop.nameAr}</li>
// // // // // // // //         </ol>
// // // // // // // //       </nav>

// // // // // // // //       <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
// // // // // // // //         <div className="bg-white shadow-xl rounded-lg overflow-hidden">
// // // // // // // //           {/* Optional Header Image / Logo Section */}
// // // // // // // //           {shop.logoUrl && (
// // // // // // // //             <div className="h-48 md:h-64 bg-gray-200 flex items-center justify-center">
// // // // // // // //               <img src={shop.logoUrl} alt={`${shop.nameEn} logo`} className="max-h-full max-w-full object-contain p-4"/>
// // // // // // // //             </div>
// // // // // // // //           )}

// // // // // // // //           <div className="p-6 md:p-8 lg:p-10">
// // // // // // // //             <div className="mb-6">
// // // // // // // //               <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">{shop.nameEn}</h1>
// // // // // // // //               {shop.nameAr && <h2 className="text-xl md:text-2xl font-semibold text-slate-600 text-right" dir="rtl">{shop.nameAr}</h2>}
// // // // // // // //               <Link 
// // // // // // // //                 href={`/cities/${citySlug}/categories/${shop.subCategorySlug}/shops`} 
// // // // // // // //                 className="text-sm text-orange-600 hover:text-orange-700 hover:underline flex items-center mt-2"
// // // // // // // //               >
// // // // // // // //                 <Tag className="w-4 h-4 mr-1.5" />
// // // // // // // //                 {subCategoryDisplayNameFromDetails} in {cityDisplayName}
// // // // // // // //               </Link>
// // // // // // // //             </div>

// // // // // // // //             {/* Main Content Grid */}
// // // // // // // //             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
// // // // // // // //               {/* Left Column / Main Info */}
// // // // // // // //               <div className="lg:col-span-2 space-y-6">
// // // // // // // //                 {shop.descriptionEn && (
// // // // // // // //                   <div>
// // // // // // // //                     <h3 className="text-lg font-semibold text-slate-700 mb-2">About Us</h3>
// // // // // // // //                     <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{shop.descriptionEn}</p>
// // // // // // // //                   </div>
// // // // // // // //                 )}
// // // // // // // //                 {shop.descriptionAr && (
// // // // // // // //                   <div dir="rtl">
// // // // // // // //                     <h3 className="text-lg font-semibold text-slate-700 mb-2 text-right">نبذة عنا</h3>
// // // // // // // //                     <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-right">{shop.descriptionAr}</p>
// // // // // // // //                   </div>
// // // // // // // //                 )}

// // // // // // // //                 {servicesList && servicesList.length > 0 && (
// // // // // // // //                   <div>
// // // // // // // //                     <h3 className="text-lg font-semibold text-slate-700 mb-3">Services Offered</h3>
// // // // // // // //                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
// // // // // // // //                       {servicesList.map(service => (
// // // // // // // //                         <li key={service} className="flex items-center text-slate-600 text-sm">
// // // // // // // //                           <Settings className="w-4 h-4 mr-2 text-orange-500 flex-shrink-0" />
// // // // // // // //                           {service}
// // // // // // // //                         </li>
// // // // // // // //                       ))}
// // // // // // // //                     </ul>
// // // // // // // //                   </div>
// // // // // // // //                 )}
// // // // // // // //               </div>

// // // // // // // //               {/* Right Column / Contact & Hours */}
// // // // // // // //               <div className="lg:col-span-1 space-y-6">
// // // // // // // //                 <div>
// // // // // // // //                   <h3 className="text-lg font-semibold text-slate-700 mb-2">Contact & Location</h3>
// // // // // // // //                   <div className="space-y-3">
// // // // // // // //                     {shop.address && (
// // // // // // // //                       <div className="flex items-start text-sm">
// // // // // // // //                         <MapPin className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // // // //                         <span className="text-slate-600">{shop.address}</span>
// // // // // // // //                       </div>
// // // // // // // //                     )}
// // // // // // // //                      <a 
// // // // // // // //                         href={googleMapsLink} 
// // // // // // // //                         target="_blank" rel="noopener noreferrer"
// // // // // // // //                         className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium py-1"
// // // // // // // //                       >
// // // // // // // //                         View on Google Maps <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
// // // // // // // //                       </a>
// // // // // // // //                     {shop.phoneNumber && (
// // // // // // // //                       <div className="flex items-center text-sm">
// // // // // // // //                         <Phone className="w-5 h-5 mr-2.5 text-slate-500 flex-shrink-0" />
// // // // // // // //                         <a href={`tel:${rawPhoneNumber}`} className="text-slate-600 hover:text-orange-600">{shop.phoneNumber}</a>
// // // // // // // //                       </div>
// // // // // // // //                     )}
// // // // // // // //                     {whatsappLink && (
// // // // // // // //                        <a 
// // // // // // // //                          href={whatsappLink} 
// // // // // // // //                          target="_blank" rel="noopener noreferrer" 
// // // // // // // //                          className="inline-flex items-center text-sm text-green-600 hover:text-green-700 font-medium py-1"
// // // // // // // //                         >
// // // // // // // //                          <MessageCircle className="w-5 h-5 mr-2"/> Message on WhatsApp
// // // // // // // //                        </a>
// // // // // // // //                     )}
// // // // // // // //                   </div>
// // // // // // // //                 </div>

// // // // // // // //                 {shop.openingHours && (
// // // // // // // //                   <div>
// // // // // // // //                     <h3 className="text-lg font-semibold text-slate-700 mb-2">Opening Hours</h3>
// // // // // // // //                     <div className="flex items-start text-sm">
// // // // // // // //                       <Clock className="w-5 h-5 mr-2.5 mt-0.5 text-slate-500 flex-shrink-0" />
// // // // // // // //                       <p className="text-slate-600 whitespace-pre-line">{shop.openingHours}</p>
// // // // // // // //                     </div>
// // // // // // // //                   </div>
// // // // // // // //                 )}
// // // // // // // //                  {/* Simple Map Placeholder - Replace with actual map component later */}
// // // // // // // //                 {/* <div className="h-64 bg-gray-300 rounded-md flex items-center justify-center text-slate-500">
// // // // // // // //                     Map Placeholder (e.g., Leaflet or Google Maps Embed)
// // // // // // // //                 </div> */}
// // // // // // // //               </div>
// // // // // // // //             </div>
// // // // // // // //           </div>
// // // // // // // //         </div>
// // // // // // // //         <div className="mt-8 text-center">
// // // // // // // //             <Button onClick={() => router.back()} variant="outline">
// // // // // // // //                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
// // // // // // // //             </Button>
// // // // // // // //         </div>
// // // // // // // //       </div>
// // // // // // // //     </div>
// // // // // // // //   );
// // // // // // // // }

// // // // // // // // export default function ShopDetailsPage() {
// // // // // // // //   const params = useParams();
// // // // // // // //   const citySlug = typeof params.citySlug === 'string' ? params.citySlug : "";
// // // // // // // //   const subCategorySlug = typeof params.subCategorySlug === 'string' ? params.subCategorySlug : "";
// // // // // // // //   const shopId = typeof params.shopId === 'string' ? params.shopId : "";

// // // // // // // //   if (!citySlug || !subCategorySlug || !shopId) {
// // // // // // // //     // This should ideally not happen if routes are set up correctly, but good for safety
// // // // // // // //     return <LoadingFallback message="Invalid shop path..." />;
// // // // // // // //   }

// // // // // // // //   return (
// // // // // // // //     <Suspense fallback={<LoadingFallback message="Loading shop..." />}>
// // // // // // // //       <ShopDetailsClient 
// // // // // // // //         citySlug={citySlug} 
// // // // // // // //         subCategorySlug={subCategorySlug} 
// // // // // // // //         shopId={shopId} 
// // // // // // // //       />
// // // // // // // //     </Suspense>
// // // // // // // //   );
// // // // // // // // }

// // // // // // // // function LoadingFallback({ message = "Loading..." }: { message?: string }) {
// // // // // // // //   return (
// // // // // // // //     <div className="flex flex-col min-h-screen justify-center items-center bg-slate-50">
// // // // // // // //       <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
// // // // // // // //       <p className="text-slate-600 text-lg">{message}</p>
// // // // // // // //     </div>
// // // // // // // //   );
// // // // // // // // }