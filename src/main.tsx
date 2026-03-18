import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { ConvexReactClient } from 'convex/react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import { ConvexProviderWithAuthKit } from '@convex-dev/workos';

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
          <RouterProvider router={router} />
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    </StrictMode>
  );
}
