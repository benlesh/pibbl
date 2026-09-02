import type { CRCNode } from '@crc/core';
import type { ReactElement } from './react-stub/jsx-runtime';
import { crcScene } from './crc-scene.crc';
import { reactScene } from './react-scene';

declare function mountCRC(node: CRCNode): void;
declare function mountReact(node: ReactElement): void;

mountCRC(crcScene);
mountReact(reactScene);

// @ts-expect-error React elements are not CRC nodes
mountCRC(reactScene);
// @ts-expect-error CRC elements are not React elements
mountReact(crcScene);
