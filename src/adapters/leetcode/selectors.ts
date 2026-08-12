export const LEETCODE_SELECTORS = {
  submitButton: [
    '[data-e2e-locator="console-submit-button"]',
    '[data-cy="submit-code-btn"]',
    'button[aria-label*="submit" i]',
    '[role="button"][aria-label*="submit" i]',
    'button[aria-label*="提交"]',
    '[role="button"][aria-label*="提交"]',
  ].join(', '),
  submitButtonText: /(?:^|\s)(提交|Submit)(?:\s|$)/i,
  resultRegion: [
    '[data-e2e-locator="console-result"]',
    '[data-e2e-locator="submission-result"]',
    '[data-cy="submission-result"]',
    '[class*="result"]',
  ].join(', '),
  renderedCode: '.cm-content, .monaco-editor textarea.inputarea',
  renderedCodeLines: '.cm-content .cm-line',
  textarea: '.monaco-editor textarea.inputarea, .cm-editor textarea, textarea[data-mode-id], textarea',
  languageButtons: [
    '[data-e2e-locator="language-select"]',
    '[data-cy="lang-select"]',
    'button[id*="headlessui-listbox-button"]',
  ].join(', '),
  observerRoot: '#qd-content, #__next, main',
  heading: 'h1, [data-cy="question-title"], [class*="question-title"], [class*="text-title"]',
  button: '[data-e2e-locator*="submit" i], [data-cy*="submit" i], button, [role="button"], input[type="submit"]',
} as const;
