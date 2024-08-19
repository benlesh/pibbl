/// <reference types="cypress" />
/// <reference types="../../cypress/support/support.d.ts" />
/// <reference types="cypress-real-events" />
import { crc, rect } from './index';

it('renders', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const onClickSpy = cy.spy((e: MouseEvent) => {
    console.log({
      e,
    });
  });
  cy.mount(canvas)
    .then(() => {
      crc(
        canvas,
        rect({
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          fillStyle: 'red',
          onClick: onClickSpy,
        })
      );
    })
    .get('canvas')
    .realClick({
      x: 110,
      y: 110,
    })
    .get('canvas')
    .should('exist')
    .then(() => {
      expect(onClickSpy).to.have.been.calledOnce;
    });
});
