import { useEffect, useState } from 'react';

/**
 * Returns a value that only updates after `delayMs` has elapsed without the
 * input changing again. Used to avoid re-running `applyFilters` on every
 * keystroke while still giving the search `<input>` instant visual feedback.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
