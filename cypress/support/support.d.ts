import { mount } from './mount';
import { setDeviceMetricsOverride } from './setDeviceMetricsOverride';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
      setDeviceMetricsOverride: typeof setDeviceMetricsOverride;
    }
  }
}
