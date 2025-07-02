// src/config/categories.ts
import { Wrench, Store, Settings, Droplet, Package, Archive, LucideIcon, Car } from 'lucide-react'; 
import { HighLevelConceptQueryParam } from '@/types/api';

// FeatureConceptConfig remains the same as you had it
export interface FeatureConceptConfig {
  id: 'maintenance' | 'marketplace';
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  containerClassName?: string; 
  imageSrc?: string; 
  conceptPageSlug: string; // This will now link to a page listing all subcategories for this concept in a city
  apiConceptFilter: HighLevelConceptQueryParam; 
}

export const featureConcepts: FeatureConceptConfig[] = [
  { 
    id: "maintenance", 
    nameEn: "Vehicle Maintenance", 
    nameAr: "صيانة المركبات", 
    descriptionEn: "Find reliable workshops for all your vehicle repair and servicing needs.",
    icon: Wrench,
    containerClassName: "bg-gradient-to-br from-sky-500 to-sky-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300", 
    imageSrc: "/images/stock/maintenance-hero.jpg", 
    conceptPageSlug: "maintenance-services", // e.g., /cities/cairo/maintenance-services
    apiConceptFilter: "Maintenance",
  },
  { 
    id: "marketplace",
    nameEn: "Auto Parts Marketplace", 
    nameAr: "سوق قطع غيار السيارات", 
    descriptionEn: "Browse new and used auto parts from various suppliers.",
    icon: Store, 
    containerClassName: "bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300",
    imageSrc: "/images/stock/autoparts-hero.jpg",
    conceptPageSlug: "auto-parts", // e.g., /cities/cairo/auto-parts
    apiConceptFilter: "Marketplace",
  },
];

export const getFeatureConceptById = (id: 'maintenance' | 'marketplace'): FeatureConceptConfig | undefined => {
    return featureConcepts.find(fc => fc.id === id);
};

// --- NEW: Predefined Subcategories for Homepage Carousels ---
export interface PredefinedSubCategory {
  name: string; // User-friendly display name
  slug: string; // URL slug, must match API
  icon?: LucideIcon; // Optional icon
  // No shopCount here, as it's city-dependent
}

export interface PredefinedConceptGroup {
  concept: FeatureConceptConfig; // Link back to the main concept config
  subCategories: PredefinedSubCategory[];
}

export const predefinedHomepageConcepts: PredefinedConceptGroup[] = [
  {
    concept: featureConcepts.find(fc => fc.id === 'maintenance')!, // Assumes 'maintenance' concept exists
    subCategories: [
      { name: "General Maintenance", slug: "general-maintenance", icon: Settings },
      { name: "Oil Change", slug: "oil-change", icon: Droplet },
      { name: "Tire Services", slug: "tire-services", icon: Wrench }, // Re-using Wrench, replace if needed
      { name: "Car Wash", slug: "car-wash", icon: Car }, // Placeholder, replace with actual icon
      { name: "Brake Services", slug: "brakes", icon: Settings }, // Placeholder
      { name: "AC Repair", slug: "ac-repair", icon: Settings }, // Placeholder
      { name: "Diagnostics", slug: "diagnostics", icon: Settings }, // Placeholder
      // Add other maintenance subcategories as defined in your ShopCategory enum and CategoryInfo
    ],
  },
  {
    concept: featureConcepts.find(fc => fc.id === 'marketplace')!, // Assumes 'marketplace' concept exists
    subCategories: [
      { name: "New Auto Parts", slug: "new-auto-parts", icon: Package },
      { name: "Used Auto Parts", slug: "used-auto-parts", icon: Archive },
      { name: "Car Accessories", slug: "car-accessories", icon: Settings }, // Placeholder
      { name: "Performance Parts", slug: "performance-parts", icon: Settings }, // Placeholder
      // Add other marketplace subcategories
    ],
  }
];

// Helper to map numeric concept to query param (if still needed elsewhere, otherwise can be removed if not used)
export const mapNumericConceptToQueryParam = (numericConcept: number): HighLevelConceptQueryParam | undefined => {
    if (numericConcept === 1) return "Maintenance";
    if (numericConcept === 2) return "Marketplace";
    return undefined; 
};
// // src/config/categories.ts
// import { Wrench, Store } from 'lucide-react'; // Icons
// import { HighLevelConceptQueryParam } from '@/types/api'; // Import if needed

// // For the two main "Feature Cards" on the homepage
// export interface FeatureConceptConfig {
//   id: 'maintenance' | 'marketplace'; // Frontend identifier
//   nameEn: string;
//   nameAr: string;
//   descriptionEn?: string;
//   descriptionAr?: string;
//   icon?: React.ComponentType<{ className?: string; size?: number }>; // Allow size prop
//   // Styling for the large feature cards
//   containerClassName?: string; 
//   imageSrc?: string; // Background image for the feature card
  
//   // This slug will be part of the URL for the intermediate concept page
//   // e.g., /cities/{citySlug}/{conceptPageSlug} -> /cities/cairo/maintenance-services
//   conceptPageSlug: string; 

//   // This is the string value to pass as the 'concept' query parameter
//   // when fetching subcategories for this high-level concept.
//   // Matches HighLevelConceptQueryParam type.
//   apiConceptFilter: HighLevelConceptQueryParam; 
// }

// export const featureConcepts: FeatureConceptConfig[] = [
//   { 
//     id: "maintenance", 
//     nameEn: "Vehicle Maintenance", 
//     nameAr: "صيانة المركبات", 
//     descriptionEn: "Find reliable workshops for all your vehicle repair and servicing needs.",
//     icon: Wrench,
//     // Example styling for new homepage cards (wider, less height)
//     // You'll need to adjust Tailwind classes for the desired layout (e.g., md:col-span-1 if in a 2-col grid)
//     containerClassName: "bg-gradient-to-br from-sky-500 to-sky-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300", 
//     imageSrc: "/images/stock/maintenance-hero.jpg", // Replace with actual image path
//     conceptPageSlug: "maintenance-services", // e.g., /cities/cairo/maintenance-services
//     apiConceptFilter: "Maintenance",
//   },
//   { 
//     id: "marketplace",
//     nameEn: "Auto Parts Marketplace", 
//     nameAr: "سوق قطع غيار السيارات", 
//     descriptionEn: "Browse new and used auto parts from various suppliers.",
//     icon: Store, 
//     containerClassName: "bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300",
//     imageSrc: "/images/stock/autoparts-hero.jpg", // Replace with actual image path
//     conceptPageSlug: "auto-parts", // e.g., /cities/cairo/auto-parts
//     apiConceptFilter: "Marketplace",
//   },
// ];

// // Helper function to get a specific feature concept config by its ID
// export const getFeatureConceptById = (id: 'maintenance' | 'marketplace'): FeatureConceptConfig | undefined => {
//     return featureConcepts.find(fc => fc.id === id);
// };

// // Helper to map HighLevelConcept enum (numeric from backend SubCategoryDto.concept)
// // to the string query parameter value needed for fetchSubCategoriesByCity.
// // This might be better placed in a utils file if used more broadly.
// export const mapNumericConceptToQueryParam = (numericConcept: number): HighLevelConceptQueryParam | undefined => {
//     if (numericConcept === 1) return "Maintenance"; // Assuming 1 is Maintenance from backend enum
//     if (numericConcept === 2) return "Marketplace"; // Assuming 2 is Marketplace
//     return undefined; 
// };
// // // src/config/categories.ts
// // import { Wrench, Droplets, Zap } from 'lucide-react'; // Example icons for 3 categories

// // export interface ServiceCategory {
// //   id: string;
// //   backendCategoryValue: string;
// //   nameEn: string;
// //   nameAr: string;
// //   descriptionEn?: string;
// //   descriptionAr?: string;
// //   icon?: React.ComponentType<{ className?: string }>; // Optional icon
// //   // For WobbleCard styling
// //   containerClassName: string; // Controls background, grid span, min-height
// //   // Optional: any specific inner content styling
// //   contentClassName?: string; 
// //   // Optional: if you want to pass an image like in the WobbleCard demo
// //   imageSrc?: string;
// //   imageClassName?: string;
// // }

// // // Assuming you have only 3 top-level categories
// // export const serviceCategories: ServiceCategory[] = [
// //   { 
// //     id: "maintenance", 
// //     backendCategoryValue: "GeneralMaintenance",
// //     nameEn: "Full Vehicle Maintenance", 
// //     nameAr: "صيانة شاملة للمركبات", 
// //     descriptionEn: "Comprehensive checks, repairs, and routine servicing for all types of vehicles.",
// //     icon: Wrench, // Example
// //     containerClassName: "lg:col-span-1 bg-pink-700 min-h-[300px] sm:min-h-[400px]", // Example: Pink, standard height
// //     // imageSrc: "/some-image.webp", // If you have specific images for categories
// //     // imageClassName: "absolute -right-4 -bottom-4 object-contain h-40 w-40"
// //   },
// //   { 
// //     id: "specialized-services",
// //     backendCategoryValue: "Auto-Parts-Marketplace",
// //     nameEn: "AutoParts Marketplace", 
// //     nameAr: "قطع غيار", 
// //     descriptionEn: "Advanced diagnostics, EV care, performance tuning, and custom modifications.",
// //     icon: Zap, // Example
// //     containerClassName: "lg:col-span-1 bg-blue-700 min-h-[300px] sm:min-h-[400px]", // Example: Blue
// //   },
// //   { 
// //     id: "detailing-care",
// //     backendCategoryValue: "Car-Washing&Detailing",
// //     nameEn: "Detailing & Body Care", 
// //     nameAr: "العناية بمظهر وهيكل السيارة", 
// //     descriptionEn: "Professional car washes, detailing, paint correction, and bodywork repairs.",
// //     icon: Droplets, // Example
// //     containerClassName: "lg:col-span-1 bg-emerald-700 min-h-[300px] sm:min-h-[400px]", // Example: Green
// //   },
// // ];