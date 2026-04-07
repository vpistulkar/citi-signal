/**
 * Get Offer block – email input and "Get offer" button.
 * No click handler on the button for now.
 */

import { readBlockConfig } from '../../scripts/aem.js';

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  const rows = [...block.children];
  const placeholder = config.placeholder?.trim() || rows[0]?.textContent?.trim() || 'me@adobetest.com';
  const buttonLabel = config['button-label']?.trim()
    || config.buttonLabel?.trim()
    || rows[1]?.textContent?.trim()
    || 'Get offer';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'get-offer-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'email';
  input.placeholder = placeholder;
  input.className = 'get-offer-input';
  input.setAttribute('aria-label', 'Email address');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'get-offer-button button';
  button.textContent = buttonLabel;
  // No click handler for now

  wrapper.append(input, button);
  block.append(wrapper);
}
