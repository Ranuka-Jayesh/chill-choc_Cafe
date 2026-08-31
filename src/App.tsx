import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { GlobalConfirmModal } from './components/ui/GlobalConfirmModal';
import { router } from './app/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <GlobalConfirmModal />
      <Toaster
        position="top-center"
        richColors
        closeButton
        icons={{
          success: <img src="/logobg.webp" alt="Cafe MM" className="w-5 h-5 rounded-full object-contain shrink-0" />,
          info: <img src="/logobg.webp" alt="Cafe MM" className="w-5 h-5 rounded-full object-contain shrink-0" />,
          warning: <img src="/logobg.webp" alt="Cafe MM" className="w-5 h-5 rounded-full object-contain shrink-0" />,
          error: <img src="/logobg.webp" alt="Cafe MM" className="w-5 h-5 rounded-full object-contain shrink-0" />,
        }}
        toastOptions={{
          style: {
            borderRadius: '18px',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '13px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
    </QueryClientProvider>
  );
};
