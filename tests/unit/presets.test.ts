import { beforeEach, describe, expect, it } from 'vitest';
import { deletePreset, loadPresets, savePreset } from '@/lib/presets';
import { DEFAULT_FILTER_STATE } from '@/lib/filters';

const PRESETS_KEY = 'todo-app:filter-presets';

beforeEach(() => {
  window.localStorage.clear();
});

describe('loadPresets / savePreset / deletePreset', () => {
  it('returns an empty array when nothing is saved', () => {
    expect(loadPresets()).toEqual([]);
  });

  it('round-trips a saved preset', () => {
    const preset = { id: '1', name: 'Today', filters: DEFAULT_FILTER_STATE, createdAt: '2025-01-01T00:00:00+08:00' };
    savePreset(preset);
    expect(loadPresets()).toEqual([preset]);
  });

  it('appends subsequent presets rather than overwriting', () => {
    savePreset({ id: '1', name: 'A', filters: DEFAULT_FILTER_STATE, createdAt: '' });
    savePreset({ id: '2', name: 'B', filters: DEFAULT_FILTER_STATE, createdAt: '' });
    expect(loadPresets().map((p) => p.id)).toEqual(['1', '2']);
  });

  it('deletes a preset by id', () => {
    savePreset({ id: '1', name: 'A', filters: DEFAULT_FILTER_STATE, createdAt: '' });
    savePreset({ id: '2', name: 'B', filters: DEFAULT_FILTER_STATE, createdAt: '' });
    deletePreset('1');
    expect(loadPresets().map((p) => p.id)).toEqual(['2']);
  });

  it('returns [] when the stored value is malformed JSON', () => {
    window.localStorage.setItem(PRESETS_KEY, 'not valid json{{{');
    expect(loadPresets()).toEqual([]);
  });

  it('returns [] when the stored value is not an array', () => {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadPresets()).toEqual([]);
  });
});
