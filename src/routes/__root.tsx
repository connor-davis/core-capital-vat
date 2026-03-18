import { Outlet, createRootRoute } from '@tanstack/react-router';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const RootLayout = () => (
  <ThemeProvider storageKey="theme" defaultTheme="system">
    <TooltipProvider>
      <div className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden">
        <div className="flex flex-col w-full h-full overflow-y-auto">
          <Outlet />
        </div>

        <Toaster />
      </div>
    </TooltipProvider>
  </ThemeProvider>
);

export const Route = createRootRoute({ component: RootLayout });
