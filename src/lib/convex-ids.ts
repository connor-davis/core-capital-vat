import type { Id } from '../../convex/_generated/dataModel';

function assertConvexId(
  value: unknown,
  label: string
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected a valid ${label}.`);
  }
}

export function asStorageId(value: unknown) {
  assertConvexId(value, 'storage ID');
  return value as Id<'_storage'>;
}

export function asVideoId(value: unknown) {
  assertConvexId(value, 'video ID');
  return value as Id<'videos'>;
}
