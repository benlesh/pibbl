export function screenshot(originalFn, prevSubject) {
  if (Cypress.env('TAKE_SCREENSHOTS')) {
    return originalFn(prevSubject)
  }

  return cy.log('Skipping screenshot', prevSubject)
    .wrap(prevSubject, { log: false })
}
