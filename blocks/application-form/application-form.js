/**
 * Application Form block – 3-step wizard matching reference look and feel.
 * Step 1: First name, Last name (side-by-side), Email address, Phone number.
 * Step 2: Address, State (dropdown), ZIP code + City (side-by-side), Country (dropdown).
 * Step 3: Date of birth, Social Security Number, Submit.
 * Back (grey) / step indicator (dots + "n/3 step") / Next or Submit (teal).
 */

import { readBlockConfig, loadCSS, applyFormCustomStyles } from '../../scripts/aem.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { syncFormDataLayer, DEFAULT_FORM_FIELD_MAP, attachLiveFormSync } from '../../scripts/form-data-layer.js';

const APPLICATION_FORM_WIZARD_NAME = 'Credit Card Application';
const APPLICATION_FORM_WIZARD_TITLE = 'Credit Card Application';

function getNestedProperty(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function hasExistingFieldValue(field) {
  if (!field) return false;
  return String(field.value || '').trim() !== '';
}

function setFieldValue(field, value) {
  if (!field || value === undefined || value === null) return false;
  if (field.tagName.toLowerCase() === 'select') {
    const normalized = String(value).trim();
    const optionExists = Array.from(field.options || []).some((option) => option.value === normalized);
    if (!optionExists) return false;
    field.value = normalized;
    return true;
  }
  field.value = String(value).trim();
  return true;
}

function prePopulateFormFromDataLayer(form) {
  if (!form || !window.dataLayer) return false;
  let hasPrefill = false;
  Object.entries(DEFAULT_FORM_FIELD_MAP).forEach(([fieldName, dataLayerPath]) => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field || hasExistingFieldValue(field)) return;
    const value = getNestedProperty(window.dataLayer, dataLayerPath);
    if (value === undefined || value === null || String(value).trim() === '') return;
    const isSet = setFieldValue(field, value);
    if (!isSet) return;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    hasPrefill = true;
  });
  return hasPrefill;
}

function setupApplicationFormPrefill(form) {
  if (!form) return;
  const applyPrefill = () => {
    prePopulateFormFromDataLayer(form);
  };

  applyPrefill();

  if (!window._dataLayerReady) {
    document.addEventListener('dataLayerUpdated', applyPrefill, { once: true });
  }
}

function buildStepMeta(stepIndex) {
  return {
    name: `credit-card-application-step-${stepIndex + 1}`,
    title: `Credit Card Application Step ${stepIndex + 1}`,
  };
}

function buildWizardPayload(currentStepIndex, totalSteps) {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) return null;
  const safeIndex = Number.isFinite(currentStepIndex)
    ? Math.min(Math.max(currentStepIndex, 0), totalSteps - 1)
    : 0;
  const steps = Array.from({ length: totalSteps }, (_, idx) => buildStepMeta(idx));
  return {
    name: APPLICATION_FORM_WIZARD_NAME,
    title: APPLICATION_FORM_WIZARD_TITLE,
    steps,
    currentStep: safeIndex + 1,
  };
}

function getTotalWizardSteps(wizard) {
  if (!wizard) return 0;
  return wizard.querySelectorAll('.panel-wrapper').length;
}

function updateApplicationFormWizardDataLayer(wizard, stepIndex) {
  if (!window.updateDataLayer) return;
  const totalSteps = getTotalWizardSteps(wizard);
  const payload = buildWizardPayload(stepIndex, totalSteps);
  if (!payload) return;
  window.updateDataLayer({
    wizard: payload,
  });
}

const REDIRECT_PATH_AFTER_APPLICATION = '/en/credit-cards/credit-card-application/credit-card-application-submitted';

function redirectAfterApplicationSubmit() {
  setTimeout(() => {
    window.location.href = REDIRECT_PATH_AFTER_APPLICATION;
  }, 2000);
}

const APPLICATION_FORM_TEAL = '#0d9488';
const APPLICATION_FORM_GREY = '#e5e7eb';

function applyButtonConfigToSubmitButton(block, config, defaultEventType = 'form-submit') {
  const submitButton = block.querySelector("form button[type='submit']");
  if (!submitButton) return;
  const eventType = config.buttoneventtype;
  const normalizedEvent = (eventType && String(eventType).trim()) || defaultEventType;
  if (normalizedEvent) submitButton.dataset.buttonEventType = normalizedEvent;
  const webhookUrl = config.buttonwebhookurl;
  if (webhookUrl && String(webhookUrl).trim()) submitButton.dataset.buttonWebhookUrl = String(webhookUrl).trim();
  const formId = config.buttonformid;
  if (formId && String(formId).trim()) submitButton.dataset.buttonFormId = String(formId).trim();
  const buttonData = config.buttondata;
  if (buttonData && String(buttonData).trim()) submitButton.dataset.buttonData = String(buttonData).trim();
}

function buildApplicationFormDef() {
  const stateOptions = ['', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
  const stateNames = ['Select...', ...stateOptions.slice(1)];
  return {
    id: 'application-form',
    fieldType: 'form',
    appliedCssClassNames: 'application-form-form application-form-wizard',
    items: [
      {
        id: 'heading-application-form',
        fieldType: 'heading',
        label: { value: 'Credit Card Application' },
        appliedCssClassNames: 'col-12 application-form-heading',
      },
      {
        id: 'panel-wizard',
        name: 'wizard',
        fieldType: 'panel',
        ':type': 'fd/panel/wizard',
        items: [
          {
            id: 'step-personal',
            name: 'personal',
            fieldType: 'panel',
            label: { value: 'Personal Information' },
            items: [
              { id: 'firstName', name: 'firstName', fieldType: 'text-input', label: { value: 'First name' }, properties: { colspan: 6 } },
              { id: 'lastName', name: 'lastName', fieldType: 'text-input', label: { value: 'Last name' }, properties: { colspan: 6 } },
              { id: 'email', name: 'email', fieldType: 'text-input', label: { value: 'Email address' }, properties: { colspan: 12 } },
              { id: 'phone', name: 'phone', fieldType: 'text-input', label: { value: 'Phone number' }, properties: { colspan: 12 } },
            ],
          },
          {
            id: 'step-address',
            name: 'address',
            fieldType: 'panel',
            label: { value: 'Address' },
            items: [
              { id: 'streetAddress', name: 'streetAddress', fieldType: 'text-input', label: { value: 'Address' }, properties: { colspan: 12 } },
              {
                id: 'state',
                name: 'state',
                fieldType: 'drop-down',
                label: { value: 'State' },
                enum: stateOptions,
                enumNames: stateNames,
                properties: { colspan: 12 },
              },
              { id: 'zipCode', name: 'zipCode', fieldType: 'text-input', label: { value: 'ZIP code' }, properties: { colspan: 6 } },
              { id: 'city', name: 'city', fieldType: 'text-input', label: { value: 'City' }, properties: { colspan: 6 } },
              {
                id: 'country',
                name: 'country',
                fieldType: 'drop-down',
                label: { value: 'Country' },
                enum: ['', 'US', 'CA', 'MX', 'GB', 'OTHER'],
                enumNames: ['Select...', 'United States of America', 'Canada', 'Mexico', 'United Kingdom', 'Other'],
                properties: { colspan: 12 },
              },
            ],
          },
          {
            id: 'step-details',
            name: 'details',
            fieldType: 'panel',
            label: { value: 'Details' },
            items: [
              { id: 'dateOfBirth', name: 'dateOfBirth', fieldType: 'text-input', label: { value: 'Date of birth' }, placeholder: 'MM/DD/YYYY', properties: { colspan: 12 } },
              { id: 'ssn', name: 'ssn', fieldType: 'text-input', label: { value: 'Social Security Number' }, properties: { colspan: 12 } },
              {
                id: 'submit-application-btn',
                name: 'submitApplication',
                fieldType: 'button',
                buttonType: 'submit',
                label: { value: 'Submit' },
                appliedCssClassNames: 'application-form-submit-btn',
              },
            ],
          },
        ],
      },
    ],
  };
}

function collectApplicationFormData(form) {
  const data = {};
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    const name = el.getAttribute('name');
    if (!name) return;
    if (el.type === 'checkbox') {
      data[name] = el.checked;
    } else {
      data[name] = el.value || '';
    }
  });
  return data;
}

function restrictNumericFields(form) {
  const numericNames = ['ssn'];
  numericNames.forEach((name) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '');
      if (el.value !== digits) el.value = digits;
    });
  });
}

function formatDateOfBirthInput(form) {
  const el = form.querySelector('[name="dateOfBirth"]');
  if (!el) return;
  el.addEventListener('input', () => {
    const digits = el.value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length > 0) formatted = digits.slice(0, 2);
    if (digits.length > 2) formatted += `/${digits.slice(2, 4)}`;
    if (digits.length > 4) formatted += `/${digits.slice(4, 8)}`;
    if (el.value !== formatted) el.value = formatted;
  });
}

function attachApplicationFormSubmitHandler(block) {
  const form = block.querySelector('form');
  if (!form) return;

  const submitSection = form.querySelector('#step-details')?.closest('fieldset') || form.querySelector('.panel-wrapper:last-of-type');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    formSubmitting = true;
    const data = collectApplicationFormData(form);
    // eslint-disable-next-line no-console
    console.log('Application form data:', data);

    const submitButton = form.querySelector("button[type='submit']");
    const authoredEventType = submitButton?.dataset?.buttonEventType?.trim() || 'form-submit';
    dispatchCustomEvent(authoredEventType);
    redirectAfterApplicationSubmit();
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => { row.style.display = 'none'; });

  block.classList.add('application-form-block');

  const codeBasePath = window.hlx?.codeBasePath || '';
  await loadCSS(`${codeBasePath}/blocks/form/form.css`);

  const formDef = buildApplicationFormDef();
  const formContainer = document.createElement('div');
  formContainer.className = 'application-form-wrapper form';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);
  block.append(formContainer);

  const formModule = await import('../form/form.js');
  await formModule.default(formContainer);

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config, 'form-submit');
    attachApplicationFormSubmitHandler(block);
    const form = block.querySelector('form');
    if (form) {
      setupApplicationFormPrefill(form);
      applyFormCustomStyles(form, config);
      restrictNumericFields(form);
      formatDateOfBirthInput(form);
    }
    setupApplicationFormStepIndicator(block);
  }, 100);
  setupApplicationFormAbandonEvents();
}

function setupApplicationFormStepIndicator(block) {
  const wizard = block.querySelector('form .wizard');
  if (!wizard) return;
  const totalSteps = wizard.querySelectorAll('.panel-wrapper').length;
  const menu = wizard.querySelector('.wizard-menu-items');
  const btnWrapper = wizard.querySelector('.wizard-button-wrapper');
  if (!btnWrapper || totalSteps === 0) return;

  const stepLabel = document.createElement('span');
  stepLabel.className = 'application-form-step-label';
  stepLabel.setAttribute('aria-live', 'polite');
  function updateStepLabel() {
    const current = wizard.querySelector('.current-wizard-step');
    const idx = current ? (parseInt(current.dataset.index, 10) + 1) : 1;
    stepLabel.textContent = `${idx}/${totalSteps} step`;
  }
  updateStepLabel();
  wizard.addEventListener('wizard:navigate', updateStepLabel);

  const nextBtn = btnWrapper.querySelector('.wizard-button-next, [id*="wizard-button-next"]');
  if (nextBtn) btnWrapper.insertBefore(stepLabel, nextBtn);
  else btnWrapper.appendChild(stepLabel);

  /* Move Submit into the wizard button row so it sits inline with Back and "n/3 step" */
  const submitWrapper = wizard.querySelector('.submit-wrapper');
  if (submitWrapper) btnWrapper.appendChild(submitWrapper);
  const form = block.querySelector('form');
  if (window.dataLayer && typeof window.updateDataLayer === 'function') {
    attachApplicationFormStepEvents(wizard, form);
  }
}

function getApplicationFormWizardStepIndex(wizard) {
  const current = wizard.querySelector('.current-wizard-step');
  if (current && typeof current.dataset.index !== 'undefined') {
    const index = Number.parseInt(current.dataset.index, 10);
    if (!Number.isNaN(index)) return index;
  }
  const first = wizard.querySelector('.panel-wrapper');
  if (first && typeof first.dataset.index !== 'undefined') {
    const fallbackIndex = Number.parseInt(first.dataset.index, 10);
    if (!Number.isNaN(fallbackIndex)) return fallbackIndex;
  }
  return 0;
}

function attachApplicationFormStepEvents(wizard, form) {
  if (!wizard) return;
  const handleNavigation = (event) => {
    const index = Number.isFinite(event?.detail?.currStep?.index)
      ? event.detail.currStep.index
      : getApplicationFormWizardStepIndex(wizard);
    if (form) {
      syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
    }
    const prevIndex = Number.isFinite(event?.detail?.prevStep?.index)
      ? event.detail.prevStep.index
      : index - 1;
    if (Number.isFinite(prevIndex) && index > prevIndex) {
      updateApplicationFormWizardDataLayer(wizard, index);
      dispatchCustomEvent('form-step');
    }
  };
  wizard.addEventListener('wizard:navigate', handleNavigation);
  if (form) {
    syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
    attachLiveFormSync(form, DEFAULT_FORM_FIELD_MAP);
  }
  const initialIndex = getApplicationFormWizardStepIndex(wizard);
  updateApplicationFormWizardDataLayer(wizard, initialIndex);
  dispatchCustomEvent('form-start');
}

let abandonEventsInitialized = false;
let abandonedEventDispatched = false;
let formSubmitting = false;

function dispatchFormAbandonedEvent() {
  if (abandonedEventDispatched || formSubmitting) return;
  abandonedEventDispatched = true;
  dispatchCustomEvent('form-abandoned');
}

function handleBeforeUnload() {
  if (formSubmitting) return;
  dispatchFormAbandonedEvent();
}

function handleVisibilityChange() {
  if (formSubmitting) return;
  if (document.visibilityState === 'hidden') {
    dispatchFormAbandonedEvent();
  }
}

function setupApplicationFormAbandonEvents() {
  if (abandonEventsInitialized) return;
  abandonEventsInitialized = true;
  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}
