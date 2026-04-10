import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import { ConvexProviderWithAuthKit } from '@convex-dev/workos';

import { useAuthSync } from './hooks/use-auth-sync';
import './index.css';
// Import the generated route tree
import { routeTree } from './routeTree.gen';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AuthSyncProvider({ children }: { children: ReactNode }) {
  useAuthSync();
  return children;
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <AuthKitProvider
        clientId={import.meta.env.VITE_WORKOS_CLIENT_ID}
        redirectUri={import.meta.env.VITE_WORKOS_REDIRECT_URI}
      >
        <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
          <AuthSyncProvider>
            <RouterProvider router={router} />
          </AuthSyncProvider>
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    </StrictMode>
  );
}
