import { readBlockConfig } from '../../scripts/aem.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';
import { getCartSnapshot } from '../../scripts/cart-store.js';
import { buildFormDataLayerUpdates, DEFAULT_FORM_FIELD_MAP } from '../../scripts/form-data-layer.js';

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

function formatMoney(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '$0.00';
  return `$${v.toFixed(2)}`;
}

function radioGroupName(id, name) {
  return `${id}_${name}`;
}

function getRadioValue(form, id, name) {
  const n = radioGroupName(id, name);
  const el = form.querySelector(`input[type="radio"][name="${n}"]:checked`);
  return el?.value ?? '';
}

function collectCheckoutShippingData(form) {
  const data = {};
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    const { name: n } = el;
    if (!n || el.type === 'radio') return;
    if (el.type === 'checkbox') {
      data[n] = el.checked;
    } else {
      data[n] = el.value ?? '';
    }
  });
  data.paymentMethod = getRadioValue(form, 'paymentMethod', 'paymentMethod');
  data.shippingMethod = getRadioValue(form, 'shippingMethod', 'shippingMethod');
  return data;
}

function mapPaymentType(paymentMethod) {
  return String(paymentMethod || '').toLowerCase() === 'paypal' ? 'paypal' : 'cards';
}

function mapShippingSelection(shippingMethod) {
  const normalized = String(shippingMethod || '').toLowerCase();
  switch (normalized) {
    case 'ground':
      return { shippingMethod: 'groundShipping', shippingAmount: 10 };
    case 'priority':
      return { shippingMethod: 'priorityShipping', shippingAmount: 20 };
    case 'express':
      return { shippingMethod: 'expressShipping', shippingAmount: 30 };
    case 'pickup':
      return { shippingMethod: 'pickupShipping', shippingAmount: 0 };
    case 'standard':
    default:
      return { shippingMethod: 'standardShipping', shippingAmount: 0 };
  }
}

function mountSummaryBox(block) {
  const col = block.querySelector('.checkout-shipping--summary-col.panel-wrapper');
  if (!col) return null;
  const existing = col.querySelector('.checkout-shipping-summary-box');
  if (existing) return existing;
  const box = document.createElement('div');
  box.className = 'checkout-shipping-summary-box';
  col.appendChild(box);
  return box;
}

function refreshSummary(block) {
  const box = mountSummaryBox(block);
  if (!box) return;
  const cart = getCartSnapshot();
  const subtotal = cart.subTotal ?? cart.total ?? 0;
  box.innerHTML = `
    <div class="checkout-shipping-summary-row"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
    <div class="checkout-shipping-summary-row"><span>Shipping</span><span>—</span></div>
    <div class="checkout-shipping-summary-row"><span>Discount</span><span>—</span></div>
    <div class="checkout-shipping-summary-row checkout-shipping-summary-total"><span>Total</span><span>${formatMoney(subtotal)}</span></div>
  `;
}

function prefillFromRegistration(block) {
  try {
    const raw = localStorage.getItem('project_registered_user');
    if (!raw) return;
    const u = JSON.parse(raw);
    const form = block.querySelector('form');
    if (!form) return;
    ['firstName', 'lastName', 'email', 'phone'].forEach((n) => {
      const el = form.querySelector(`[name="${n}"]`);
      if (el && u[n]) el.value = u[n];
    });
  } catch {
    /* ignore */
  }
}

function attachBackButton(block) {
  const backBtn = block.querySelector('#btn-back');
  if (!backBtn || backBtn.tagName !== 'BUTTON') return;
  backBtn.type = 'button';
  backBtn.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });
}

function persistShippingStep(data) {
  try {
    sessionStorage.setItem('checkout_shipping_step', JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

function getOrderSummaryFallbackPath() {
  const currentPath = (window.location.pathname || '/').replace(/\/$/, '');
  const lastSlash = currentPath.lastIndexOf('/');
  const basePath = lastSlash > 0 ? currentPath.substring(0, lastSlash) : '';
  const targetPage = currentPath.endsWith('.html') ? 'order-summary.html' : 'order-summary';
  return `${basePath}/${targetPage}`;
}

function attachSubmitHandler(block, config) {
  const form = block.querySelector('form');
  if (!form) return;

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const required = [
        { name: 'firstName', id: 'firstName' },
        { name: 'lastName', id: 'lastName' },
        { name: 'email', id: 'email' },
      ];
      let ok = true;
      required.forEach(({ name }) => {
        const field = form.querySelector(`[name="${name}"]`);
        if (!field) return;
        if (!field.value || !String(field.value).trim()) {
          ok = false;
          field.classList.add('field-invalid');
        } else {
          field.classList.remove('field-invalid');
        }
      });

      if (!ok) return;

      const data = collectCheckoutShippingData(form);
      persistShippingStep(data);

      const shipping = mapShippingSelection(data.shippingMethod);
      const paymentType = mapPaymentType(data.paymentMethod);
      const createAccountConsent = Boolean(data.createAccount);
      const joinLumaLoyaltyConsent = Boolean(data.lumaLoyalty);
      const baseFormUpdates = buildFormDataLayerUpdates(form, DEFAULT_FORM_FIELD_MAP) || {};

      if (typeof window.updateDataLayer === 'function') {
        window.updateDataLayer(
          {
            ...baseFormUpdates,
            shipping,
            paymentType,
            createAccountConsent,
            joinLumaLoyaltyConsent,
          },
          true
        );
      }

      const submitBtn = form.querySelector("button[type='submit']");
      const authoredEvent = submitBtn?.dataset?.buttonEventType?.trim() || 'checkout';
      if (authoredEvent) dispatchCustomEvent(authoredEvent);

      const next = (config['continue-path'] || config.continuepath || '').toString().trim();
      if (next) window.location.href = next;
      else {
        window.location.href = getOrderSummaryFallbackPath();
      }
    },
    true
  );
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => {
    row.style.display = 'none';
  });

  block.classList.add('checkout-shipping-block');

  const formDef = {
    id: 'checkout-shipping',
    fieldType: 'form',
    appliedCssClassNames: 'checkout-shipping-form',
    items: [
      {
        id: 'heading-checkout',
        fieldType: 'heading',
        label: { value: 'CHECKOUT' },
        appliedCssClassNames: 'col-12 checkout-shipping-page-title',
      },
      {
        id: 'panel-columns',
        name: 'columns',
        fieldType: 'panel',
        properties: { colspan: 12 },
        appliedCssClassNames: 'checkout-shipping-columns',
        items: [
          {
            id: 'col-personal',
            name: 'personal',
            fieldType: 'panel',
            properties: { colspan: 4 },
            appliedCssClassNames: 'checkout-shipping--personal-col',
            items: [
              {
                id: 'h-personal',
                fieldType: 'heading',
                label: { value: 'Personal information' },
                appliedCssClassNames: 'col-12 checkout-shipping-subheading',
              },
              {
                id: 'firstName',
                name: 'firstName',
                fieldType: 'text-input',
                label: { value: 'First name *' },
                required: true,
                properties: { colspan: 6 },
              },
              {
                id: 'lastName',
                name: 'lastName',
                fieldType: 'text-input',
                label: { value: 'Last name *' },
                required: true,
                properties: { colspan: 6 },
              },
              {
                id: 'email',
                name: 'email',
                fieldType: 'email',
                label: { value: 'Email *' },
                required: true,
                properties: { colspan: 6 },
              },
              {
                id: 'phone',
                name: 'phone',
                fieldType: 'text-input',
                label: { value: 'Phone number' },
                properties: { colspan: 6 },
              },
              {
                id: 'street',
                name: 'streetAddress',
                fieldType: 'text-input',
                label: { value: 'Street address' },
                properties: { colspan: 6 },
              },
              {
                id: 'city',
                name: 'city',
                fieldType: 'text-input',
                label: { value: 'City' },
                properties: { colspan: 6 },
              },
              {
                id: 'postalCode',
                name: 'zipCode',
                fieldType: 'text-input',
                label: { value: 'Postal code' },
                properties: { colspan: 6 },
              },
              {
                id: 'country',
                name: 'country',
                fieldType: 'drop-down',
                label: { value: 'Country' },
                type: 'string',
                enum: ['', 'US', 'CA', 'GB', 'DE', 'FR'],
                enumNames: ['Select...', 'United States', 'Canada', 'United Kingdom', 'Germany', 'France'],
                properties: { colspan: 6 },
              },
            ],
          },
          {
            id: 'col-payment-shipping',
            name: 'paymentShipping',
            fieldType: 'panel',
            properties: { colspan: 4 },
            appliedCssClassNames: 'checkout-shipping--payment-col',
            items: [
              {
                id: 'paymentMethod',
                name: 'paymentMethod',
                fieldType: 'radio-group',
                label: { value: 'Payment' },
                type: 'string',
                value: 'card',
                enum: ['card', 'paypal'],
                enumNames: ['Credit or Debit Card', 'Paypal'],
                properties: { 'afs:layout': { orientation: 'vertical' } },
                appliedCssClassNames: 'col-12',
              },
              {
                id: 'shippingMethod',
                name: 'shippingMethod',
                fieldType: 'radio-group',
                label: { value: 'Shipping' },
                type: 'string',
                value: 'standard',
                enum: ['standard', 'ground', 'priority', 'express', 'pickup'],
                enumNames: [
                  'Standard: 5-14 business days',
                  'Ground: 3-7 business days',
                  'Priority: 2 business days',
                  'Express: 1 business day',
                  'Next-day pickup',
                ],
                properties: { 'afs:layout': { orientation: 'vertical' } },
                appliedCssClassNames: 'col-12',
              },
            ],
          },
          {
            id: 'col-summary',
            name: 'summary',
            fieldType: 'panel',
            properties: { colspan: 4 },
            appliedCssClassNames: 'checkout-shipping--summary-col',
            items: [
              {
                id: 'h-account',
                fieldType: 'heading',
                label: { value: 'Account' },
                appliedCssClassNames: 'col-12 checkout-shipping-subheading',
              },
              {
                id: 'lumaLoyalty',
                name: 'lumaLoyalty',
                fieldType: 'checkbox',
                label: { value: 'I want to join Luma+ Loyalty Program' },
                enum: ['true'],
                type: 'string',
                properties: {
                  variant: 'switch',
                  alignment: 'horizontal',
                  colspan: 12,
                },
              },
              {
                id: 'createAccount',
                name: 'createAccount',
                fieldType: 'checkbox',
                label: { value: 'I want to create the account' },
                enum: ['true'],
                type: 'string',
                properties: {
                  variant: 'switch',
                  alignment: 'horizontal',
                  colspan: 12,
                },
              },
              {
                id: 'h-summary',
                fieldType: 'heading',
                label: { value: 'Summary' },
                appliedCssClassNames: 'col-12 checkout-shipping-subheading',
              },
            ],
          },
        ],
      },
      {
        id: 'panel-actions',
        name: 'actions',
        fieldType: 'panel',
        properties: { colspan: 12 },
        appliedCssClassNames: 'checkout-shipping-actions-panel',
        items: [
          {
            id: 'btn-back',
            name: 'back',
            fieldType: 'button',
            buttonType: 'button',
            label: { value: 'BACK' },
            appliedCssClassNames: 'submit-wrapper col-6',
          },
          {
            id: 'btn-continue',
            name: 'continue',
            fieldType: 'button',
            buttonType: 'submit',
            label: { value: 'CONTINUE' },
            appliedCssClassNames: 'submit-wrapper col-6',
          },
        ],
      },
    ],
  };

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

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config);
    prefillFromRegistration(block);
    attachBackButton(block);
    refreshSummary(block);
    attachSubmitHandler(block, config);
  }, 120);
}
