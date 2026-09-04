import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { GlobalConfirmModal } from './components/ui/GlobalConfirmModal';
import { RealtimeNotificationListener } from './components/common/RealtimeNotificationListener';
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
      <RealtimeNotificationListener />
      <Toaster
        position="top-center"
        closeButton
        duration={3500}
        icons={{
          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.3]" />,
          info: <Info className="w-5 h-5 text-sky-600 shrink-0 stroke-[2.3]" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 stroke-[2.3]" />,
          error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 stroke-[2.3]" />,
          loading: <Loader2 className="w-5 h-5 text-brand-teal animate-spin shrink-0 stroke-[2.3]" />,
        }}
      />
    </QueryClientProvider>
  );
};
