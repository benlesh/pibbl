import {
  getSignalNode,
  installSignalWriterLeasePolicy,
  type SignalNode,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  activateProgram,
  preflightProgramActivation,
  type ProgramActivation,
} from './evaluate.js';
import { getProgramRecord } from './program.js';
import type { CRCAnimationProgram } from './types.js';

export interface AnimationWriterLeaseOwner {
  readonly token: object;
  readonly registrationOrder: number;
  readonly debugName?: string;
  cancel(): void;
}

export interface ProgramWriterLease {
  readonly activation: ProgramActivation;
  readonly outputs: readonly WritableSignal<unknown>[];
  release(): void;
}

export interface ProgramWriterLeaseOptions {
  readonly conflict?: 'error' | 'replace';
}

export interface WriterLeaseSnapshot {
  readonly active: number;
  readonly acquired: number;
  readonly released: number;
  readonly duplicateReleases: number;
  readonly conflicts: number;
  readonly replacements: number;
  readonly activeOutputs: readonly string[];
}

interface WriterLease {
  readonly owner: AnimationWriterLeaseOwner;
  readonly outputs: readonly WritableSignal<unknown>[];
  readonly nodes: readonly SignalNode<unknown>[];
  readonly registrationSequence: number;
  readonly release: () => void;
}

const leases = new Map<SignalNode<unknown>, WriterLease>();
let registrationSequence = 0;
let acquired = 0;
let released = 0;
let duplicateReleases = 0;
let conflicts = 0;
let replacements = 0;

function signalName(node: SignalNode<unknown>): string {
  return node.debugName ?? '<unnamed signal>';
}

function playbackName(lease: WriterLease): string {
  return lease.owner.debugName ?? '<unnamed playback>';
}

function conflictError(node: SignalNode<unknown>, lease: WriterLease): Error {
  return new Error(
    `CRC animation signal "${signalName(node)}" is already leased by playback ` +
      `"${playbackName(lease)}". Cancel it or request conflict replacement.`,
  );
}

function staleWriterError(
  node: SignalNode<unknown>,
  lease: WriterLease | undefined,
): Error {
  const owner = lease === undefined ? '<released playback>' : playbackName(lease);
  return new Error(
    `CRC animation writer cannot commit signal "${signalName(node)}" because it ` +
      `does not own the active lease for playback "${owner}".`,
  );
}

const leasePolicy = Object.freeze({
  assertDirectWriteAllowed(node: SignalNode<unknown>): void {
    const lease = leases.get(node);
    if (lease === undefined) return;
    throw new Error(
      `Cannot write animation-leased signal "${signalName(node)}" while playback ` +
        `"${playbackName(lease)}" is active. Cancel the playback first.`,
    );
  },
  captureStagedWrite(node: SignalNode<unknown>): unknown {
    return leases.get(node);
  },
  assertStagedWriteAllowed(
    node: SignalNode<unknown>,
    writer: object,
    authorization: unknown,
  ): void {
    const current = leases.get(node);
    const captured = authorization as WriterLease | undefined;
    if (current === undefined && captured === undefined) return;
    if (current !== undefined && current === captured && current.owner.token === writer) {
      return;
    }
    throw staleWriterError(node, current ?? captured);
  },
});

installSignalWriterLeasePolicy(leasePolicy);

function assertOwner(owner: AnimationWriterLeaseOwner): void {
  if (typeof owner !== 'object' || owner === null) {
    throw new TypeError('CRC animation writer lease owner must be an object.');
  }
  if (typeof owner.token !== 'object' || owner.token === null) {
    throw new TypeError('CRC animation writer token must be an object.');
  }
  if (!Number.isSafeInteger(owner.registrationOrder) || owner.registrationOrder < 0) {
    throw new RangeError(
      'CRC animation writer registration order must be a nonnegative safe integer.',
    );
  }
  if (owner.debugName !== undefined &&
    (typeof owner.debugName !== 'string' || owner.debugName.length === 0)) {
    throw new TypeError('CRC animation playback debug name must be nonempty when provided.');
  }
  if (typeof owner.cancel !== 'function') {
    throw new TypeError('CRC animation writer lease owner must provide cancel().');
  }
}

function uniqueConflicts(nodes: readonly SignalNode<unknown>[]): WriterLease[] {
  const found = new Set<WriterLease>();
  for (const node of nodes) {
    const lease = leases.get(node);
    if (lease !== undefined) found.add(lease);
  }
  return [...found].sort((first, second) =>
    first.owner.registrationOrder - second.owner.registrationOrder ||
    first.registrationSequence - second.registrationSequence,
  );
}

function firstConflict(nodes: readonly SignalNode<unknown>[]): {
  readonly node: SignalNode<unknown>;
  readonly lease: WriterLease;
} | undefined {
  for (const node of nodes) {
    const lease = leases.get(node);
    if (lease !== undefined) return { node, lease };
  }
  return undefined;
}

function cancelReplacedOwners(conflicting: readonly WriterLease[]): void {
  const failures: unknown[] = [];
  for (const lease of conflicting) {
    replacements++;
    try {
      lease.owner.cancel();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'CRC animation replacement cancellation failed.');
  }
}

function acquireLease(
  outputs: readonly WritableSignal<unknown>[],
  nodes: readonly SignalNode<unknown>[],
  owner: AnimationWriterLeaseOwner,
): Pick<ProgramWriterLease, 'outputs' | 'release'> {
  const remainingConflict = firstConflict(nodes);
  if (remainingConflict !== undefined) {
    conflicts++;
    throw conflictError(remainingConflict.node, remainingConflict.lease);
  }

  let isReleased = false;
  let lease: WriterLease;
  const release = (): void => {
    if (isReleased) {
      duplicateReleases++;
      return;
    }
    isReleased = true;
    for (const node of nodes) {
      if (leases.get(node) === lease) {
        leases.delete(node);
        released++;
      }
    }
  };
  lease = Object.freeze({
    owner: Object.freeze({
      token: owner.token,
      registrationOrder: owner.registrationOrder,
      debugName: owner.debugName,
      cancel: owner.cancel,
    }),
    outputs,
    nodes,
    registrationSequence: registrationSequence++,
    release,
  });
  for (const node of nodes) {
    leases.set(node, lease);
    acquired++;
  }
  return { outputs, release };
}

/** @internal Test-only deterministic ownership evidence. */
export function writerLeaseSnapshot(): WriterLeaseSnapshot {
  return Object.freeze({
    active: leases.size,
    acquired,
    released,
    duplicateReleases,
    conflicts,
    replacements,
    activeOutputs: Object.freeze([...leases.keys()].map(signalName)),
  });
}

/** @internal Acquires every program output for one future playback run. */
export function acquireProgramWriterLeases(
  program: CRCAnimationProgram,
  registration: object,
  owner: AnimationWriterLeaseOwner,
  options: ProgramWriterLeaseOptions = {},
): ProgramWriterLease {
  assertOwner(owner);
  if (typeof registration !== 'object' || registration === null) {
    throw new TypeError('CRC animation registration identity must be an object.');
  }
  const conflict = options.conflict ?? 'error';
  if (conflict !== 'error' && conflict !== 'replace') {
    throw new TypeError('CRC animation writer conflict must be "error" or "replace".');
  }

  preflightProgramActivation(program);
  const outputs = Object.freeze([...getProgramRecord(program).outputs]);
  const nodes = Object.freeze(outputs.map(output => getSignalNode(output)));
  const conflicting = uniqueConflicts(nodes);
  if (conflicting.length > 0 && conflict === 'error') {
    conflicts++;
    const occupied = firstConflict(nodes)!;
    throw conflictError(occupied.node, occupied.lease);
  }
  if (conflicting.length > 0) cancelReplacedOwners(conflicting);

  const remainingConflict = firstConflict(nodes);
  if (remainingConflict !== undefined) {
    conflicts++;
    throw conflictError(remainingConflict.node, remainingConflict.lease);
  }

  const activation = activateProgram(program, registration);
  const acquiredLease = acquireLease(outputs, nodes, owner);
  return Object.freeze({ activation, ...acquiredLease });
}
