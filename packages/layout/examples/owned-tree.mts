import { createLayoutTree } from '@pibbl/layout';

const tree = createLayoutTree();
const label = tree.createNode({ style: { width: 120, height: 24 } });
const root = tree.createNode({ style: { width: 320, height: 80, flexDirection: 'row', gap: 8 } });
tree.appendChild(root, label);

const layout = tree.calculateLayout({ root, width: 320, height: 80, direction: 'ltr' });
void layout.getBox(label);
tree.dispose();
