  'use client';

  import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
  // Import your static GeoJSON data for Egypt
  // Make sure this path is correct and the file exists.
  import egyptBoundaryJsonFile from '@/data/egypt_boundary.json'; // Assuming this is your static file

  interface GeoDataContextType {
    egyptBoundaryGeoJsonString: string | null;
    isLoadingEgyptBoundary: boolean;
    // You could add more boundaries here in the future, e.g., for other countries or regions
    // anotherCountryBoundaryGeoJsonString: string | null;
    // isLoadingAnotherCountryBoundary: boolean;
  }

  const GeoDataContext = createContext<GeoDataContextType | undefined>(undefined);

  export const GeoDataProvider = ({ children }: { children: ReactNode }) => {
    const [egyptBoundaryGeoJsonString, setEgyptBoundaryGeoJsonString] = useState<string | null>(null);
    const [isLoadingEgyptBoundary, setIsLoadingEgyptBoundary] = useState<boolean>(true);

    useEffect(() => {
      // Simulate loading or actual fetch if it were an API
      setIsLoadingEgyptBoundary(true);
      try {
        if (egyptBoundaryJsonFile) {
          //
          // const response = await fetch('/api/boundaries/egypt');
          // const data = await response.json();
          // setEgyptBoundaryGeoJsonString(JSON.stringify(data));

          // For static import:
          setEgyptBoundaryGeoJsonString(JSON.stringify(egyptBoundaryJsonFile));
        } else {
          console.warn("GeoDataContext: Egypt boundary JSON file not found or empty.");
          setEgyptBoundaryGeoJsonString(null);
        }
      } catch (error) {
        console.error("GeoDataContext: Error processing Egypt boundary data:", error);
        setEgyptBoundaryGeoJsonString(null);
      } finally {
        setIsLoadingEgyptBoundary(false);
      }
    }, []); // Empty dependency array: load once on mount

    const value = useMemo(() => ({
      egyptBoundaryGeoJsonString,
      isLoadingEgyptBoundary,
    }), [egyptBoundaryGeoJsonString, isLoadingEgyptBoundary]);

    return (
      <GeoDataContext.Provider value={value}>
        {children}
      </GeoDataContext.Provider>
    );
  };

  export const useGeoData = (): GeoDataContextType => {
    const context = useContext(GeoDataContext);
    if (context === undefined) {
      throw new Error('useGeoData must be used within a GeoDataProvider');
    }
    return context;
  };