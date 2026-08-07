export const LEETCODE_SELECTORS = {
  submitButton: '[data-e2e-locator="console-submit-button"]',
  submitButtonText: /^(提交|Submit)$/,
  resultRegion: '[data-e2e-locator="console-result"]',
  renderedCode: '.cm-content',
  languageButtons: '[data-e2e-locator="language-select"]',
  observerRoot: '#qd-content',
  heading: 'h1, [class*="question-title"], [class*="text-title"]',
  button: 'button',
} as const;
