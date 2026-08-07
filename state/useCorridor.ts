import { useSyncExternalStore } from 'react';

import { getState, subscribe, type CorridorState } from '../services/corridor';

/**
 * The only way a screen reads state.
 *
 * `useSyncExternalStore` rather than context so the in-process service stays a
 * plain module, the same shape it would have as an HTTP client against a deployed
 * Corridor API, with no React coupling to unpick when it becomes one.
 */
export function useCorridor(): CorridorState {
  return useSyncExternalStore(subscribe, getState, getState);
}
