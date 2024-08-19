/// <reference types="cypress" />
/// <reference types="../../cypress/support/vanilla-mount.d.ts" />
/// <reference types="cypress-real-events" />
import { core } from './index';

let onClickSpy: ReturnType<typeof cy.spy>;

beforeEach(() => {
  onClickSpy = cy.spy().as('onClickSpy');
});

it.only('renders', () => {
  const canvas = document.createElement('canvas')

  core(canvas)

  cy.mount(canvas)
    .realClick({
    x: 150,
    y: 150,
    })
    .get('canvas')
    .should('exist');
});
