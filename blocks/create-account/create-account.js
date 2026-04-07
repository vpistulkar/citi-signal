import { readBlockConfig, applyFormCustomStyles } from "../../scripts/aem.js";
import { dispatchCustomEvent } from "../../scripts/custom-events.js";
import { syncFormDataLayer, DEFAULT_FORM_FIELD_MAP, attachLiveFormSync } from "../../scripts/form-data-layer.js";

function isTruthy(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function normalizeVariant(value) {
  return String(value || "default").trim().toLowerCase();
}

function withConditionalClasses(baseClassName, isVisible) {
  return isVisible ? baseClassName : `${baseClassName} is-hidden`;
}

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

function clearProductObject() {
  if (typeof window.updateDataLayer === "function") {
    window.updateDataLayer({ product: {} }, false);
  }
}

function buildCreateAccountFormDef(config = {}) {
  const isLumaVariant = normalizeVariant(config.variant) === "luma";
  const showLoyaltyProgram = isTruthy(config.showloyaltyprogram);
  const shoeSizes = ["", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
  const shirtSizes = ["", "s", "m", "l", "xl", "xxl"];
  const favoriteColors = ["", "black", "blue", "green", "orange", "pink", "purple", "red", "white", "yellow"];

  return {
    id: "create-account",
    fieldType: "form",
    appliedCssClassNames: "create-account-form",
    items: [
      {
        id: "heading-create-account",
        fieldType: "heading",
        label: { value: "Create an account" },
        appliedCssClassNames: "col-12",
      },
      {
        id: "panel-main",
        name: "main",
        fieldType: "panel",
        items: [
          {
            id: "firstName",
            name: "firstName",
            fieldType: "text-input",
            label: { value: "First name" },
            properties: { colspan: 6 },
          },
          {
            id: "lastName",
            name: "lastName",
            fieldType: "text-input",
            label: { value: "Last name" },
            properties: { colspan: 6 },
          },
          {
            id: "email",
            name: "email",
            fieldType: "text-input",
            label: { value: "Email address" },
            autoComplete: "email",
            properties: { colspan: 12 },
          },
          {
            id: "phone",
            name: "phone",
            fieldType: "text-input",
            label: { value: "Phone number" },
            autoComplete: "tel",
            properties: { colspan: 12 },
          },
          {
            id: "address",
            name: "streetAddress",
            fieldType: "text-input",
            label: { value: "Address" },
            autoComplete: "street-address",
            properties: { colspan: 12 },
          },
          {
            id: "zipCode",
            name: "zipCode",
            fieldType: "text-input",
            label: { value: "ZIP code" },
            autoComplete: "postal-code",
            properties: { colspan: 6 },
          },
          {
            id: "city",
            name: "city",
            fieldType: "text-input",
            label: { value: "City" },
            autoComplete: "address-level2",
            properties: { colspan: 6 },
          },
          {
            id: "dateOfBirth",
            name: "dateOfBirth",
            fieldType: "text-input",
            label: { value: "Date of birth (YYYY-MM-DD)" },
            placeholder: "YYYY-MM-DD",
            properties: { colspan: 12 },
          },
          {
            id: "joinLoyaltyProgram",
            name: "joinLoyaltyProgram",
            fieldType: "checkbox",
            label: { value: "I want to join loyalty program" },
            enum: ["true"],
            type: "string",
            appliedCssClassNames: withConditionalClasses("col-12 loyalty-program-field", showLoyaltyProgram),
            properties: {
              variant: "switch",
              alignment: "horizontal",
              colspan: 12,
            },
          },
          {
            id: "communicationHeading",
            fieldType: "heading",
            label: { value: "Communication preferences" },
            appliedCssClassNames: "col-12 communication-heading",
          },
          {
            id: "prefEmail",
            name: "prefEmail",
            fieldType: "checkbox",
            label: { value: "Email" },
            enum: ["true"],
            type: "string",
            properties: {
              variant: "switch",
              alignment: "horizontal",
              colspan: 4,
            },
          },
          {
            id: "prefPhone",
            name: "prefPhone",
            fieldType: "checkbox",
            label: { value: "Phone" },
            enum: ["true"],
            type: "string",
            properties: {
              variant: "switch",
              alignment: "horizontal",
              colspan: 4,
            },
          },
          {
            id: "prefSms",
            name: "prefSms",
            fieldType: "checkbox",
            label: { value: "SMS" },
            enum: ["true"],
            type: "string",
            properties: {
              variant: "switch",
              alignment: "horizontal",
              colspan: 4,
            },
          },
          {
            id: "heading-know-you-better",
            fieldType: "heading",
            label: { value: "LET US KNOW YOU BETTER" },
            appliedCssClassNames: withConditionalClasses("col-12 know-you-better-heading", isLumaVariant),
          },
          {
            id: "shoeSize",
            name: "shoeSize",
            fieldType: "drop-down",
            label: { value: "Shoe size" },
            enum: shoeSizes,
            enumNames: ["Select...", ...shoeSizes.slice(1)],
            appliedCssClassNames: withConditionalClasses("col-6 luma-preference-field", isLumaVariant),
            properties: { colspan: 6 },
          },
          {
            id: "shirtSize",
            name: "shirtSize",
            fieldType: "drop-down",
            label: { value: "Shirt size" },
            enum: shirtSizes,
            enumNames: ["Select...", "S", "M", "L", "XL", "XXL"],
            appliedCssClassNames: withConditionalClasses("col-6 luma-preference-field", isLumaVariant),
            properties: { colspan: 6 },
          },
          {
            id: "favoriteColor",
            name: "favoriteColor",
            fieldType: "drop-down",
            label: { value: "Favorite color" },
            enum: favoriteColors,
            enumNames: ["Select...", "Black", "Blue", "Green", "Orange", "Pink", "Purple", "Red", "White", "Yellow"],
            appliedCssClassNames: withConditionalClasses("col-12 luma-preference-field", isLumaVariant),
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
}

export default async function decorate(block) {
  const config = readBlockConfig(block) || {};
  [...block.children].forEach((row) => { row.style.display = "none"; });

  const formDef = buildCreateAccountFormDef(config);
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

  setTimeout(() => {
    applyButtonConfigToSubmitButton(block, config, 'form-submit');
    prePopulateFormFromDataLayer(block);
    attachCreateAccountSubmitHandler(block);
    const form = block.querySelector("form");
    if (form) {
      applyFormCustomStyles(form, config);
      syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
      attachLiveFormSync(form, DEFAULT_FORM_FIELD_MAP);
    }
  }, 100);
}

function attachCreateAccountSubmitHandler(block) {
  const form = block.querySelector("form");
  if (!form) return;

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const formData = {};

      const allFields = form.querySelectorAll("input, select, textarea");
      allFields.forEach((field) => {
        const fieldName = field.name || field.id;
        if (!fieldName) return;

        if (field.type === "checkbox") {
          formData[fieldName] = field.checked ? field.value || "true" : "";
        } else {
          formData[fieldName] = field.value;
        }
      });

      const dobValue = String(formData.dateOfBirth || "").trim();
      if (dobValue && !/^\d{4}-\d{2}-\d{2}$/.test(dobValue)) {
        const dobField = form.querySelector('[name="dateOfBirth"]');
        dobField?.classList.add("error");
        return;
      } else {
        const dobField = form.querySelector('[name="dateOfBirth"]');
        dobField?.classList.remove("error");
      }

      try {
        const registrationData = {
          ...formData,
          communicationPreferences: {
            email: formData.prefEmail === "true" ? "y" : "n",
            phone: formData.prefPhone === "true" ? "y" : "n",
            sms: formData.prefSms === "true" ? "y" : "n",
          },
          registeredAt: new Date().toISOString(),
          userId: generateUserId(),
        };

        localStorage.setItem(
          "com.adobe.reactor.dataElements.Identities",
          JSON.stringify({
            Email: [
              {
                id: formData.email,
                primary: true,
                authenticatedState: "authenticated",
              },
            ],
          })
        );

        sessionStorage.setItem(
          "com.adobe.reactor.dataElements.Identity Map",
          JSON.stringify({
            Email: [
              {
                id: formData.email,
                primary: true,
                authenticatedState: "authenticated",
              },
            ],
          })
        );

        if (registrationData.email) {
          try {
            localStorage.setItem("com.adobe.reactor.dataElements.Profile - Email", registrationData.email);
            if (typeof window._satellite !== "undefined" && typeof window._satellite.setVar === "function") {
              window._satellite.setVar("Profile - Email", registrationData.email);
            }
          } catch (e) {
            // ignore storage errors
          }
        }

        localStorage.setItem("project_registered_user", JSON.stringify(registrationData));

        if (window.dataLayer?.projectName === 'luma3') {
          window.dataLayer.createAccountConsent = true;
        }

        syncFormDataLayer(form, DEFAULT_FORM_FIELD_MAP);
        clearProductObject();

        const submitBtn = form.querySelector("button[type='submit']");
        const authoredEventType = submitBtn?.dataset?.buttonEventType?.trim() || 'form-submit';
        dispatchCustomEvent(authoredEventType);

        showSuccessMessage(form, "Account created successfully! Redirecting to sign-in...");

        setTimeout(() => {
          window.location.href = "/en/sign-in";
        }, 2000);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Create account error:", error);
        showErrorMessage(form, "Account creation failed. Please try again.");
      }
    },
    true
  );
}

function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function showSuccessMessage(form, message) {
  const existingMessages = form.querySelectorAll(".form-message");
  existingMessages.forEach((msg) => msg.remove());

  const messageEl = document.createElement("div");
  messageEl.className = "form-message success";
  messageEl.textContent = message;

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.parentNode.insertBefore(messageEl, submitButton);
    submitButton.disabled = true;
  } else {
    form.appendChild(messageEl);
  }
}

function showErrorMessage(form, message) {
  const existingMessages = form.querySelectorAll(".form-message");
  existingMessages.forEach((msg) => msg.remove());

  const messageEl = document.createElement("div");
  messageEl.className = "form-message error";
  messageEl.textContent = message;

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.parentNode.insertBefore(messageEl, submitButton);
  } else {
    form.appendChild(messageEl);
  }
}

function prePopulateFormFromDataLayer(block) {
  if (!window.dataLayer) return;

  const form = block.querySelector("form");
  if (!form) return;

  const getNestedProperty = (obj, path) => path.split(".").reduce((current, prop) => current?.[prop], obj);

  Object.entries(DEFAULT_FORM_FIELD_MAP).forEach(([fieldName, path]) => {
    const value = getNestedProperty(window.dataLayer, path);
    if (value === undefined || value === null || value === "") return;

    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = value === true || value === "true" || value === "y";
    } else {
      field.value = value;
    }
  });
}
