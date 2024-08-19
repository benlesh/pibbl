/// <reference types="cypress" />
/// <reference types="../../cypress/support/support.d.ts" />
/// <reference types="cypress-real-events" />
import { core } from './index';

let onClickSpy: ReturnType<typeof cy.spy>;

beforeEach(() => {
  onClickSpy = cy.spy().as('onClickSpy');
});

it('renders an h1', () => {
  const h1 = document.createElement('h1')
  h1.innerText = 'Hello, World!'
  document.body.appendChild(h1)
  cy.setDeviceMetricsOverride({
    deviceScaleFactor: 1,
    width: 0,
    height: 0,
  })
})

it.skip('renders', () => {
  const canvas = document.createElement('canvas')

  core(canvas)

  cy.mount(canvas)
    .realClick({
      x: 150,
      y: 150,
    })
    .get('canvas')
    .should('exist')
});
