import type { FilterState } from '@/lib/filters';

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string; // ISO, from getSingaporeNow()
}

const PRESETS_KEY = 'todo-app:filter-presets';

/**
 * Reads saved filter presets from localStorage. Any failure (missing key,
 * invalid JSON, unexpected shape) is swallowed and surfaces as an empty
 * list rather than crashing the app.
 */
export function loadPresets(): FilterPreset[] {
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FilterPreset[]) : [];
  } catch (error) {
    console.error('Failed to load filter presets:', error);
    return [];
  }
}

export function savePreset(preset: FilterPreset): FilterPreset[] {
  const presets = [...loadPresets(), preset];
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save filter preset:', error);
    throw new Error('Could not save preset — storage full');
  }

  return presets;
}

export function deletePreset(id: string): FilterPreset[] {
  const presets = loadPresets().filter((preset) => preset.id !== id);
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  return presets;
}
