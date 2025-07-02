// src/components/providers/QueryProvider.tsx
'use client'; // This component needs to be a client component

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures QueryClient is only created once on the client,
  // preventing re-creation on re-renders, suitable for App Router.
  const [queryClient] = useState(() => 
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes
          refetchOnWindowFocus: false, // Optional: adjust as needed
          retry: 1, // Retry failed requests once
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}