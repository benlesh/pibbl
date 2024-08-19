/// <reference types="cypress" />
/// <reference types="../../cypress/support/support.d.ts" />
/// <reference types="cypress-real-events" />
import { CRCMouseEvent, crcState, defineComp, rect } from './index';

function ToggleRectangle(props: { color1: string; color2: string, onClick: (e: CRCMouseEvent) => void }) {
  const [color, setColor] = crcState(props.color1);

  return rect({
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    onClick: (e) => {
      if (color === props.color1) {
        setColor(props.color2);
      } else {
        setColor(props.color1);
      }
      props.onClick(e)
    },
    fillStyle: color,
  });
}

let onClickSpy: ReturnType<typeof cy.spy>

beforeEach(() => {
  onClickSpy = cy.spy().as('onClick');
})

it('renders', () => {
  const centerCoords = { x: 150, y: 150 };
  const myToggleRect = defineComp(ToggleRectangle);

  cy.mount(myToggleRect({ color1: 'red', color2: 'blue', onClick: onClickSpy }))
    .screenshot()
    .realClick(centerCoords)
    .screenshot()
    .realClick(centerCoords)
    .screenshot()
    .get('@onClick').should('have.been.calledTwice');
});
