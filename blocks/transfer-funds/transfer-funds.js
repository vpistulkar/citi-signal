import { readBlockConfig, applyFormCustomStyles } from '../../scripts/aem.js';
import { dispatchCustomEvent } from '../../scripts/custom-events.js';

function applyButtonConfigToSubmitButton(block, config, defaultEventType = 'transfer-funds-form-submit') {
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

function getSubmitLink(block, config) {
  const fromConfig = (config.submitlink ?? '').toString().trim();
  if (fromConfig) return fromConfig;
  // UE may use data-aue-prop="submitLink" or "submit-link"
  const propEl = block.querySelector('[data-aue-prop="submitLink"]') || block.querySelector('[data-aue-prop="submit-link"]');
  if (propEl) {
    const a = propEl.querySelector('a[href]');
    const href = a?.getAttribute('href')?.trim();
    if (href) return href;
    const text = (propEl.textContent || propEl.innerText || '').trim();
    if (text) return text;
  }
  return '';
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  const submitLink = getSubmitLink(block, config);

  const formDef = {
    id: "transfer-funds",
    fieldType: "form",
    appliedCssClassNames: "transfer-funds-form",
    ...(submitLink && { redirectUrl: submitLink }),
    items: [
      {
        id: "heading-transfer-funds",
        fieldType: "heading",
        label: { value: "Transfer funds" },
        appliedCssClassNames: "col-12",
      },
      {
        id: "panel-main",
        name: "main",
        fieldType: "panel",
        items: [
          {
            id: "transfer-from",
            name: "transferFrom",
            fieldType: "drop-down",
            label: { value: "Transfer from" },
            enum: ["Checking Account"],
            value: "checking-account",
            properties: { colspan: 12 },
          },
          {
            id: "transfer-to",
            name: "transferTo",
            fieldType: "drop-down",
            label: { value: "Transfer to" },
            enum: ["Retirement Account"],
            value: "retirement-account",
            properties: { colspan: 12 },
          },
          {
            id: "amount",
            name: "amount",
            fieldType: "text-input",
            label: { value: "Amount" },
            value: "$100.00",
            properties: { colspan: 12 },
          },
          {
            id: "submit-btn",
            name: "submitButton",
            fieldType: "button",
            buttonType: "submit",
            label: { value: "Submit" },
            appliedCssClassNames: "submit-wrapper col-12",
          },
        ],
      },
    ],
  };

  const formContainer = document.createElement("div");
  formContainer.className = "form";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = JSON.stringify(formDef);
  pre.append(code);
  formContainer.append(pre);
  block.replaceChildren(formContainer);

  const formModule = await import("../form/form.js");
  await formModule.default(formContainer);
  const form = formContainer.querySelector('form');
  if (!form) return;
  const REDIRECT_PATH_AFTER_TRANSFER = '/en/dashboard/submitted-successfully';
  function redirectAfterTransferSubmit() {
    setTimeout(() => {
      window.location.href = REDIRECT_PATH_AFTER_TRANSFER;
    }, 2000);
  }
  applyFormCustomStyles(form, config);
  applyButtonConfigToSubmitButton(block, config, 'transfer-funds-form-submit');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const submitButton = form.querySelector('button[type="submit"]');
    const authoredEventType = submitButton?.dataset?.buttonEventType?.trim() || 'transfer-funds-form-submit';
    dispatchCustomEvent(authoredEventType);
    redirectAfterTransferSubmit();
  });
}
