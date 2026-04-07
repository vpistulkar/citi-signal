/**
 * Join Us block – same pattern as sign-in: adaptive form definition + form module.
 * Form: JOIN WKND FLY CLUB heading, First Name, Last Name, Email, Phone, consent toggle, JOIN US button. All optional.
 * On submit, show green success popup: "Thank you for joining WKND Fly Club..."
 * Button config (event type, webhook, form id, data) is authorable; custom event fired on success for Launch.
 */

import { readBlockConfig } from "../../scripts/aem.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { syncFormDataLayer, DEFAULT_FORM_FIELD_MAP, attachLiveFormSync } from "../../scripts/form-data-layer.js";

const DEFAULT_FORM_TITLE = 'JOIN WKND FLY CLUB';
const DEFAULT_SUCCESS_TOAST_MESSAGE = 'Thank you for joining WKND Fly Club. Check your email, new exciting travels are ahead of you!';

function normalizeVariant(value) {
  return String(value || "default").trim().toLowerCase();
}

function isTruthy(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function applyButtonConfigToSubmitButton(block, config) {
  const submitButton = block.querySelector("form button[type='submit']");
  if (!submitButton) return;
  const eventType = config.buttoneventtype ?? config['button-event-type'];
  if (eventType && String(eventType).trim()) submitButton.dataset.buttonEventType = String(eventType).trim();
  const webhookUrl = config.buttonwebhookurl ?? config['button-webhook-url'];
  if (webhookUrl && String(webhookUrl).trim()) submitButton.dataset.buttonWebhookUrl = String(webhookUrl).trim();
  const formId = config.buttonformid ?? config['button-form-id'];
  if (formId && String(formId).trim()) submitButton.dataset.buttonFormId = String(formId).trim();
  const buttonData = config.buttondata ?? config['button-data'];
  if (buttonData && String(buttonData).trim()) submitButton.dataset.buttonData = String(buttonData).trim();
}

function showSuccessPopup(message = DEFAULT_SUCCESS_TOAST_MESSAGE) {
  const overlay = document.createElement('div');
  overlay.className = 'join-us-success-overlay';
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="join-us-success-popup join-us-success-visible">
      <span class="join-us-success-icon" aria-hidden="true"></span>
      <p class="join-us-success-text">${message}</p>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.classList.add('join-us-success-overlay-visible');
  setTimeout(() => {
    overlay.classList.remove('join-us-success-overlay-visible');
    setTimeout(() => overlay.remove(), 300);
  }, 3500);
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => { row.style.display = 'none'; });
  const showConsentCheckbox = (config.showconsentcheckbox !== undefined)
    ? isTruthy(config.showconsentcheckbox)
    : normalizeVariant(config.variant) !== 'no-checkbox';
  const hideCheckbox = !showConsentCheckbox;
  const formActionId = (config.buttonformid ?? config['button-form-id'] ?? '').toString().trim();
  const formTitle = (config.formtitle ?? config['form-title'] ?? '').toString().trim() || DEFAULT_FORM_TITLE;
  const successToastMessage = (config.successmessage ?? config['success-message'] ?? '').toString().trim() || DEFAULT_SUCCESS_TOAST_MESSAGE;

  // Build Adaptive Form definition for Join Us (same pattern as sign-in)
  const formDef = {
    id: 'join-us',
    fieldType: 'form',
    appliedCssClassNames: 'join-us-form',
    items: [
      {
        id: 'heading-join-us',
        fieldType: 'heading',
        label: { value: formTitle },
        appliedCssClassNames: 'col-12',
      },
      {
        id: 'panel-main',
        name: 'main',
        fieldType: 'panel',
        items: [
          {
            id: 'firstName',
            name: 'firstName',
            fieldType: 'text-input',
            label: { value: 'First Name' },
            properties: { colspan: 12 },
          },
          {
            id: 'lastName',
            name: 'lastName',
            fieldType: 'text-input',
            label: { value: 'Last Name' },
            properties: { colspan: 12 },
          },
          {
            id: 'email',
            name: 'email',
            fieldType: 'email',
            label: { value: 'Email' },
            properties: { colspan: 12 },
          },
          {
            id: 'phone',
            name: 'phone',
            fieldType: 'text-input',
            label: { value: 'Phone number' },
            properties: { colspan: 12 },
          },
          ...(!hideCheckbox
            ? [
                {
                  id: 'consent',
                  name: 'consent',
                  fieldType: 'checkbox',
                  label: {
                    value: 'I want to join WKND Fly Club and I have read and understand the Privacy and Cookies Policy. I want to receive personalized communication by email.',
                  },
                  enum: ['true'],
                  type: 'string',
                  properties: {
                    variant: 'switch',
                    alignment: 'horizontal',
                    colspan: 12,
                  },
                },
              ]
            : []),
          {
            id: 'join-us-btn',
            name: 'joinUsButton',
            fieldType: 'button',
            buttonType: 'submit',
            label: { value: 'JOIN US' },
            appliedCssClassNames: 'submit-wrapper col-12',
          },
        ],
      },
    ],
  };

  // Create form container and inject definition (same as sign-in)
  const formContainer = document.createElement('div');
  formContainer.className = 'form';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);
  block.replaceChildren(formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  // After form is rendered, apply button config and attach submit handler
  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    const form = block.querySelector('form');
    if (form) {
      syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
      attachLiveFormSync(form, DEFAULT_FORM_FIELD_MAP);
    }
    attachFormSubmitHandler(block, formActionId, successToastMessage);
  }, 100);
}

/**
 * Attaches form submission handler.
 * Uses capture phase so we run first; stopImmediatePropagation prevents the Adaptive Form
 * runtime from doing a POST to the page URL (which returns 405 / "Error invoking a rest API").
 * @param {HTMLElement} block - The join-us block
 */
function attachFormSubmitHandler(block, formActionId = '', successToastMessage = DEFAULT_SUCCESS_TOAST_MESSAGE) {
  const form = block.querySelector('form');
  if (!form) {
    console.warn('Form not found in join-us block');
    return;
  }

  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = form.querySelector('input[name="email"]')?.value?.trim() || '';
      const firstName = form.querySelector('input[name="firstName"]')?.value?.trim() || '';
      const lastName = form.querySelector('input[name="lastName"]')?.value?.trim() || '';
      const consentField = form.querySelector('input[name="consent"]');
      const consent = consentField ? (consentField.checked ? 'true' : 'false') : 'false';

      // So Launch "Profile - Email from Storage" and Identity Map resolve when Registration rule runs
      if (email) {
        try {
          localStorage.setItem("com.adobe.reactor.dataElements.Profile - Email", email);
          if (typeof window._satellite !== "undefined" && typeof window._satellite.setVar === "function") {
            window._satellite.setVar("Profile - Email", email);
          }
        } catch (e) {
          // ignore storage/setVar errors
        }
      }

      syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
      if (typeof window.updateDataLayer === 'function') {
        const projectName = String(window.dataLayer?.projectName || '').trim().toLowerCase();
        const dataLayerPayload = {};

        if (projectName === 'luma3') {
          dataLayerPayload.joinLumaLoyaltyConsent = 'true';
        } else {
          // Keep existing behavior for wknd-fly and default fallback.
          dataLayerPayload.loyaltyConsent = consent;
        }

        if (formActionId) {
          dataLayerPayload.form = { action: formActionId };
        }
        window.updateDataLayer(dataLayerPayload);
      }
      showSuccessPopup(successToastMessage);
      // If button has an authored event type, fire it (for Launch, same pattern as flight-search)
      const submitBtn = form.querySelector("button[type='submit']");
      const authoredEventType = submitBtn?.dataset?.buttonEventType?.trim();
      if (authoredEventType) {
        dispatchCustomEvent(authoredEventType);
      }
    },
    true
  );
}
