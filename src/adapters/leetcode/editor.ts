import type { CodeSnapshot, SnapshotProvider } from '../types';
import { LEETCODE_SELECTORS } from './selectors';

function language(): string {
  for (const element of document.querySelectorAll(LEETCODE_SELECTORS.languageButtons)) {
    const text = element.textContent?.trim();
    if (text && text.length <= 30) return text;
  }
  return '';
}

function readRenderedCode(): string {
  const lines = [...document.querySelectorAll(LEETCODE_SELECTORS.renderedCodeLines)]
    .map((line) => line.textContent ?? '');
  if (lines.length) return lines.join('\n');

  const content = document.querySelector(LEETCODE_SELECTORS.renderedCode)?.textContent ?? '';
  return content;
}

function readTextareaCode(): string {
  for (const element of document.querySelectorAll<HTMLTextAreaElement>(LEETCODE_SELECTORS.textarea)) {
    if (element.value.trim()) return element.value;
  }
  return '';
}

export async function readLeetCodeSnapshot(bridge: SnapshotProvider): Promise<CodeSnapshot | null> {
  const value = await bridge.getEditorSnapshot();
  if (value?.code.trim()) {
    return { code: value.code, language: value.language || language(), method: 'editor-model' };
  }

  const textareaCode = readTextareaCode();
  if (textareaCode.trim()) {
    return { code: textareaCode, language: language(), method: 'textarea' };
  }

  const renderedCode = readRenderedCode();
  return renderedCode.trim()
    ? { code: renderedCode, language: language(), method: 'rendered-code' }
    : null;
}
