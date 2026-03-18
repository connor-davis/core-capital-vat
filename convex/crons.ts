import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'delete processed source videos',
  { hours: 1 },
  internal.retention.cleanupSourceFiles,
  {}
);

crons.daily(
  'purge expired QA reports',
  { hourUTC: 2, minuteUTC: 0 },
  internal.retention.purgeExpiredReports,
  {}
);

export default crons;
