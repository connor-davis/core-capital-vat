import { useAuth } from '@workos-inc/authkit-react';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';

import { api } from '../../convex/_generated/api';

/**
 * Syncs the authenticated WorkOS user and their active organization into
 * Convex. Call this once near the app root so the server-side auth helpers
 * can resolve the user and organization records for every subsequent query
 * and mutation.
 */
export function useAuthSync() {
  const { user, organizationId } = useAuth();
  const syncUser = useMutation(api.userSync.syncUser);
  const lastSyncKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !organizationId) {
      lastSyncKey.current = null;
      return;
    }

    const syncKey = `${user.id}:${organizationId}`;

    if (lastSyncKey.current === syncKey) {
      return;
    }

    lastSyncKey.current = syncKey;
    void syncUser({ workosOrgId: organizationId });
  }, [user, organizationId, syncUser]);
}
