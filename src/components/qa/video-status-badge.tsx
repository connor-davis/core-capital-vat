import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { VideoStatus } from '../../../shared/qa';

const statusLabels: Record<VideoStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  deleted: 'Deleted',
};

const statusClasses: Record<VideoStatus, string> = {
  queued: 'bg-secondary text-secondary-foreground',
  processing: 'bg-primary text-primary-foreground',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  deleted: 'bg-muted text-muted-foreground',
};

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  return (
    <Badge className={cn('border-transparent', statusClasses[status])}>
      {statusLabels[status]}
    </Badge>
  );
}
