import {
  getSignalNode,
  installSignalWriterLeasePolicy,
  type SignalNode,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  activateProgram,
  preflightProgramActivation,
  releaseProgramActivation,
  type ProgramActivation,
} from './evaluate.js';
import { getProgramRecord } from './program.js';
import type { CRCAnimationProgram } from './types.js';

export interface AnimationWriterLeaseOwner {
  readonly token: object;
  readonly registrationOrder: number;
  readonly debugName?: string;
  cancel(): void;
  beginReplacement?(): AnimationWriterLeaseReplacement;
}

export interface AnimationWriterLeaseReplacement {
  commit(): void;
  rollback(): void;
}

export interface ProgramWriterLease {
  readonly activation: ProgramActivation;
  readonly outputs: readonly WritableSignal<unknown>[];
  release(): void;
}

export interface TransactionalProgramWriterLease extends ProgramWriterLease {
  readonly replacedOwnerCount: number;
  commitReplacement(): void;
  rollbackReplacement(): void;
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
const leaseStacks = new Map<SignalNode<unknown>, WriterLease[]>();
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

function firstConflictExcept(
  nodes: readonly SignalNode<unknown>[],
  ignoredToken: object | undefined,
): {
  readonly node: SignalNode<unknown>;
  readonly lease: WriterLease;
} | undefined {
  for (const node of nodes) {
    const lease = leases.get(node);
    if (lease !== undefined && lease.owner.token !== ignoredToken) {
      return { node, lease };
    }
  }
  return undefined;
}

function pushLease(node: SignalNode<unknown>, lease: WriterLease): void {
  const stack = leaseStacks.get(node);
  if (stack === undefined) {
    leaseStacks.set(node, [lease]);
  } else {
    stack.push(lease);
  }
  leases.set(node, lease);
}

function removeLease(node: SignalNode<unknown>, lease: WriterLease): void {
  const stack = leaseStacks.get(node);
  if (stack === undefined) return;
  const index = stack.lastIndexOf(lease);
  if (index < 0) return;
  stack.splice(index, 1);
  const active = stack.at(-1);
  if (active === undefined) {
    leaseStacks.delete(node);
    leases.delete(node);
  } else {
    leases.set(node, active);
  }
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

function beginReplacedOwners(
  conflicting: readonly WriterLease[],
): AnimationWriterLeaseReplacement[] {
  const replacementTransactions: AnimationWriterLeaseReplacement[] = [];
  try {
    for (const lease of conflicting) {
      if (lease.owner.beginReplacement === undefined) {
        throw new Error(
          `CRC animation playback "${playbackName(lease)}" cannot be replaced ` +
            'transactionally.',
        );
      }
      replacements++;
      replacementTransactions.push(lease.owner.beginReplacement());
    }
    return replacementTransactions;
  } catch (error) {
    for (let index = replacementTransactions.length - 1; index >= 0; index--) {
      replacementTransactions[index]!.rollback();
    }
    throw error;
  }
}

function acquireLease(
  outputs: readonly WritableSignal<unknown>[],
  nodes: readonly SignalNode<unknown>[],
  owner: AnimationWriterLeaseOwner,
  allowOccupied = false,
): Pick<ProgramWriterLease, 'outputs' | 'release'> {
  const remainingConflict = allowOccupied ? undefined : firstConflict(nodes);
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
      removeLease(node, lease);
      released++;
    }
  };
  lease = Object.freeze({
    owner: Object.freeze({
      token: owner.token,
      registrationOrder: owner.registrationOrder,
      debugName: owner.debugName,
      cancel: owner.cancel,
      beginReplacement: owner.beginReplacement,
    }),
    outputs,
    nodes,
    registrationSequence: registrationSequence++,
    release,
  });
  for (const node of nodes) {
    pushLease(node, lease);
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

/** @internal Validates activation and conflicts without disturbing one current owner. */
export function preflightProgramWriterLeaseAcquisition(
  program: CRCAnimationProgram,
  ignoredToken?: object,
): void {
  preflightProgramActivation(program);
  const outputs = getProgramRecord(program).outputs;
  const nodes = outputs.map(output => getSignalNode(output));
  const occupied = firstConflictExcept(nodes, ignoredToken);
  if (occupied !== undefined) {
    conflicts++;
    throw conflictError(occupied.node, occupied.lease);
  }
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

/** @internal Acquires provisional ownership that can restore displaced leases. */
export function acquireTransactionalProgramWriterLeases(
  program: CRCAnimationProgram,
  registration: object,
  owner: AnimationWriterLeaseOwner,
  options: ProgramWriterLeaseOptions & { readonly ignoredToken?: object } = {},
): TransactionalProgramWriterLease {
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
  const forbiddenConflict = conflicting.find(
    lease => conflict === 'error' && lease.owner.token !== options.ignoredToken,
  );
  if (forbiddenConflict !== undefined) {
    conflicts++;
    const occupiedNode = nodes.find(node => leases.get(node) === forbiddenConflict)!;
    throw conflictError(occupiedNode, forbiddenConflict);
  }

  const activation = activateProgram(program, registration);
  let replacementTransactions: AnimationWriterLeaseReplacement[];
  try {
    replacementTransactions = beginReplacedOwners(conflicting);
  } catch (error) {
    releaseProgramActivation(activation);
    throw error;
  }
  const acquiredLease = acquireLease(outputs, nodes, owner, true);
  let replacementPending = conflicting.length > 0;

  const rollbackReplacement = (): void => {
    if (!replacementPending) return;
    replacementPending = false;
    acquiredLease.release();
    for (let index = replacementTransactions.length - 1; index >= 0; index--) {
      replacementTransactions[index]!.rollback();
    }
  };
  const commitReplacement = (): void => {
    if (!replacementPending) return;
    replacementPending = false;
    for (const replacement of replacementTransactions) replacement.commit();
  };
  const release = (): void => {
    if (replacementPending) rollbackReplacement();
    else acquiredLease.release();
  };

  return Object.freeze({
    activation,
    outputs: acquiredLease.outputs,
    replacedOwnerCount: conflicting.length,
    release,
    commitReplacement,
    rollbackReplacement,
  });
}
