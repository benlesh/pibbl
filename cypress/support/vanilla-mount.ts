const ROOT_SELECTOR = '[data-cy-root]';
const TARGET_SELECTOR = '__cy_target__';
/**
 * Gets the root element used to mount the component.
 * @returns {HTMLElement} The root element
 * @throws {Error} If the root element is not found
 */
const getContainerEl = () => {
  const el = document.querySelector(ROOT_SELECTOR);
  if (el) {
    return el;
  }
  throw Error(
    `No element found that matches selector ${ROOT_SELECTOR}. Please add a root element with data-cy-root attribute to your "component-index.html" file so that Cypress can attach your component to the DOM.`,
  );
};

/**
 * Utility function to register CT side effects and run cleanup code during the "test:before:run" Cypress hook
 * @param optionalCallback Callback to be called before the next test runs
 */
function setupHooks(optionalCallback) {
  // We don't want CT side effects to run when e2e
  // testing so we early return.
  // System test to verify CT side effects do not pollute e2e: system-tests/test/e2e_with_mount_import_spec.ts
  if (Cypress.testingType !== 'component') {
    return;
  }
  // When running component specs, we cannot allow "cy.visit"
  // because it will wipe out our preparation work, and does not make much sense
  // thus we overwrite "cy.visit" to throw an error
  Cypress.Commands.overwrite('visit', () => {
    throw new Error('cy.visit from a component spec is not allowed');
  });
  Cypress.Commands.overwrite('session', () => {
    throw new Error('cy.session from a component spec is not allowed');
  });
  Cypress.Commands.overwrite('origin', () => {
    throw new Error('cy.origin from a component spec is not allowed');
  });
  // @ts-ignore
  Cypress.on('test:before:after:run:async', () => {
    optionalCallback === null || optionalCallback === void 0
      ? void 0
      : optionalCallback();
  });
}

const cleanup = () => {
  Cypress.$(`#${TARGET_SELECTOR}`).remove();
};

/**
 * Mounts a component and returns a DOM node
 * @param options
 * @returns {Cypress.Chainable<{DOMElement: T}>}
 */
function mount(element: HTMLElement, options = {}) {
  // Remove last mounted component if cy.mount is called more than once in a test
  cleanup();

  debugger;
  // then wait for cypress to load
  return cy.then(() => {
    const el = getContainerEl();

    const target = document.createElement('div');
    target.setAttribute('id', TARGET_SELECTOR);
    target.appendChild(element);

    el.append(target);

    return cy.wait(1, { log: false }).then(() => {
      if (options.log !== false) {
        Cypress.log({
          name: 'mount',
          message: [`<${element.tagName} ... />`],
        });
      }
      return element;
    });
  });
}

// Side effects from "import { mount } from '@cypress/<my-framework>'" are annoying, we should avoid doing this
// by creating an explicit function/import that the user can register in their 'component.js' support file,
// such as:
//    import 'cypress/<my-framework>/support'
// or
//    import { registerCT } from 'cypress/<my-framework>'
//    registerCT()
// Note: This would be a breaking change
setupHooks(cleanup);

export { mount };
