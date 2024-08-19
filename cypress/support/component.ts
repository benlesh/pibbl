/// <reference types="cypress" />
/// <reference types="./support.d.ts" />
// ***********************************************************
// This example support/component.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
import 'cypress-real-events/support';

import { mount } from './mount';
import { screenshot } from './screenshot';
import { setDeviceMetricsOverride } from './setDeviceMetricsOverride';

Cypress.Commands.add('mount', mount);
Cypress.Commands.add('setDeviceMetricsOverride', setDeviceMetricsOverride)
Cypress.Commands.overwrite('screenshot', screenshot)

Cypress.Screenshot.defaults({
  scale: true,
  overwrite: true,
})
