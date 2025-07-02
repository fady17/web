// src/components/concept/FeatureConceptCard.tsx
'use client';

import React from 'react';
import { FeatureConceptConfig } from '@/config/categories'; // Assuming this is updated
import { Loader2, Store } from 'lucide-react'; // Default icon

interface FeatureConceptCardProps {
  concept: FeatureConceptConfig;
  onClick: () => void;
  isLoading?: boolean;
}

const FeatureConceptCard: React.FC<FeatureConceptCardProps> = ({ concept, onClick, isLoading }) => {
  const IconComponent = concept.icon || Store; // Use provided icon or a default

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`group relative w-full text-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out overflow-hidden focus:outline-none focus:ring-4 focus:ring-offset-2 ${concept.id === 'maintenance' ? 'focus:ring-sky-300' : 'focus:ring-orange-300'} ${concept.containerClassName}`}
      style={{
        minHeight: '280px', // Ensure consistent height
        // Aspect ratio can be controlled by parent grid or specific height/width classes
      }}
    >
      {concept.imageSrc && (
        <img
          src={concept.imageSrc}
          alt={`${concept.nameEn} background`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
      )}
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent group-hover:from-black/80 group-hover:via-black/50 transition-opacity duration-300"></div>
      
      <div className="relative z-10 p-6 flex flex-col items-center justify-center text-center h-full">
        <IconComponent className="w-12 h-12 md:w-14 md:h-14 mb-4 transition-transform duration-300 group-hover:scale-110" size={48} />
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{concept.nameEn}</h2>
        <p className="text-sm md:text-base opacity-90 mb-4">{concept.descriptionEn}</p>
        {isLoading ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : (
          <span className="inline-block px-5 py-2 text-sm font-semibold bg-white/20 backdrop-blur-sm rounded-full group-hover:bg-white/30 transition-colors duration-300">
            Explore {concept.nameEn.split(' ')[0]}
          </span>
        )}
      </div>
    </button>
  );
};

export default FeatureConceptCard;