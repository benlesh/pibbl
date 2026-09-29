export interface ParticleSystemOwnershipSnapshot {
  readonly activeSystems: number;
  readonly createdSystems: number;
  readonly releasedSystems: number;
  readonly activeBindings: number;
  readonly acquiredBindings: number;
  readonly releasedBindings: number;
  readonly activeParameterEpochs: number;
  readonly createdParameterEpochs: number;
  readonly releasedParameterEpochs: number;
  readonly queuedCommands: number;
  readonly createdCommands: number;
  readonly releasedCommands: number;
  readonly schedulerRegistrations: number;
  readonly canvasLedgers: number;
  readonly canvasRasterEntries: number;
}

let activeSystems = 0;
let createdSystems = 0;
let releasedSystems = 0;
let activeBindings = 0;
let acquiredBindings = 0;
let releasedBindings = 0;
let activeParameterEpochs = 0;
let createdParameterEpochs = 0;
let releasedParameterEpochs = 0;
let queuedCommands = 0;
let createdCommands = 0;
let releasedCommands = 0;
let schedulerRegistrations = 0;
let canvasLedgers = 0;
let canvasRasterEntries = 0;

/** @internal Deterministic controller resource counters for tests and diagnostics. */
export function particleSystemOwnershipSnapshot(): ParticleSystemOwnershipSnapshot {
  return Object.freeze({
    activeSystems,
    createdSystems,
    releasedSystems,
    activeBindings,
    acquiredBindings,
    releasedBindings,
    activeParameterEpochs,
    createdParameterEpochs,
    releasedParameterEpochs,
    queuedCommands,
    createdCommands,
    releasedCommands,
    schedulerRegistrations,
    canvasLedgers,
    canvasRasterEntries,
  });
}

export function recordParticleSystemCreated(): () => void {
  activeSystems += 1;
  createdSystems += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeSystems -= 1;
    releasedSystems += 1;
  };
}

export function recordParticleBindingAcquired(): () => void {
  activeBindings += 1;
  acquiredBindings += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeBindings -= 1;
    releasedBindings += 1;
  };
}

export function recordParticleParameterEpochCreated(): () => void {
  activeParameterEpochs += 1;
  createdParameterEpochs += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeParameterEpochs -= 1;
    releasedParameterEpochs += 1;
  };
}

export function recordParticleCommandCreated(): () => void {
  queuedCommands += 1;
  createdCommands += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    queuedCommands -= 1;
    releasedCommands += 1;
  };
}

function recordActiveResource(
  acquire: () => void,
  release: () => void,
): () => void {
  acquire();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}

export function recordParticleSchedulerRegistration(): () => void {
  return recordActiveResource(
    () => {
      schedulerRegistrations += 1;
    },
    () => {
      schedulerRegistrations -= 1;
    },
  );
}

export function recordCanvasParticleLedgerCreated(): () => void {
  return recordActiveResource(
    () => {
      canvasLedgers += 1;
    },
    () => {
      canvasLedgers -= 1;
    },
  );
}

export function recordCanvasParticleRasterEntryCreated(): () => void {
  return recordActiveResource(
    () => {
      canvasRasterEntries += 1;
    },
    () => {
      canvasRasterEntries -= 1;
    },
  );
}
