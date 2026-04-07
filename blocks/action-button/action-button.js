import { div, a, span } from '../../scripts/dom-helpers.js';
import { isAuthorEnvironment } from '../../scripts/scripts.js';

function getTextFromSelector(block, selector) {
  const el = block.querySelector(selector);
  if (!el) return '';
  const text = (el.textContent || '').trim();
  return text;
}

export default function decorate(block) {
  const rowVal = (n) => {
    const row = block.querySelector(`:scope > div:nth-child(${n})`);
    if (!row?.children?.length) return undefined;
    const col = row.children[1] ?? row.children[0];
    if (col?.querySelector?.('a')) {
      const as = [...col.querySelectorAll('a')];
      return as.length === 1 ? as[0].href : as.map((a) => a.href);
    }
    return col?.textContent?.trim();
  };

  const normalizeRowValue = (value) => {
    if (Array.isArray(value)) return value.length ? value[0] : '';
    return value ?? '';
  };

  const appendHtmlIfAuthor = (value) => {
    if (!value) return value;
    if (!isAuthorEnvironment()) return value;
    return value.toLowerCase().endsWith('.html') ? value : `${value}.html`;
  };

  const rowLinkElement = block.querySelector(':scope > div:nth-child(1) a');
  const rowLink = appendHtmlIfAuthor(rowLinkElement?.textContent?.trim() || '');
  const rowLinkUrl = appendHtmlIfAuthor(rowLinkElement?.getAttribute('href')?.trim() || '');
  const rowLabel = normalizeRowValue(rowVal(2));
  const rowTitle = normalizeRowValue(rowVal(3));
  const rowStyle = normalizeRowValue(rowVal(4));

  const linkEl = block.querySelector('a[href]');
  const buttonLink = linkEl?.getAttribute('href')?.trim() || rowLinkUrl || '#';

  const buttonLabel = getTextFromSelector(block, '[data-aue-prop="label"]')
    || getTextFromSelector(block, '[data-aue-prop="title"]')
    || rowLabel
    || getTextFromSelector(block, 'p')
    || 'Button';

  const buttonTitle = getTextFromSelector(block, '[data-aue-prop="title"]') || rowTitle || '';

  const buttonStyle = (getTextFromSelector(block, '[data-aue-prop="style"]') || rowStyle || 'default-button').trim()
    || 'default-button';

  const buttonElement = div({ class: `button-container ${buttonStyle}` },
    a({
      href: buttonLink,
      class: 'button',
      title: buttonTitle || buttonLabel
    },
      span({ class: 'button-text' }, buttonLabel)
    )
  );

  /* Replace all block content with the single button so AUE metadata never shows (author + live) */
  block.replaceChildren(buttonElement);
}