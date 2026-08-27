import { describe, expect, it } from 'vitest';
import { activeStreamFor, type StreamState } from './types';

const stream: StreamState = { scope: 'node', text: '分析中', target: 'cap-A' };

describe('activeStreamFor', () => {
  it('returns the stream when the current record is its target', () => {
    expect(activeStreamFor(stream, 'cap-A')).toBe(stream);
  });

  it('hides the stream when viewing a different record', () => {
    expect(activeStreamFor(stream, 'cap-B')).toBeNull();
  });

  it('returns null when nothing is streaming or no record is selected', () => {
    expect(activeStreamFor(null, 'cap-A')).toBeNull();
    expect(activeStreamFor(stream, undefined)).toBeNull();
  });
});
