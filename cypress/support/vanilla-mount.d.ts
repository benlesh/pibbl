import { mount } from './vanilla-mount';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}
