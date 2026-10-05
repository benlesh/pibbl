import {
  type PibblParticleBurstAcceptedEvent,
  type PibblParticleBurstRejectedEvent,
  type PibblParticleDiagnostic,
  type PibblParticleDrainStartEvent,
  type PibblParticleFinishEvent,
  type PibblParticleStartEvent,
  type PibblParticleSystemEvent,
} from "@pibbl/core/particles";

const started: PibblParticleStartEvent = { type: "start" };
const accepted: PibblParticleBurstAcceptedEvent = {
  type: "burst-accepted",
  emitter: "spark",
  requested: 12,
  accepted: 12,
};
const rejected: PibblParticleBurstRejectedEvent = {
  type: "burst-rejected",
  emitter: "spark",
  requested: 12,
  accepted: 0,
  reason: "capacity",
};
const draining: PibblParticleDrainStartEvent = { type: "drain-start" };
const finished: PibblParticleFinishEvent = { type: "finish" };
const events: PibblParticleSystemEvent[] = [
  started,
  accepted,
  rejected,
  draining,
  finished,
];
const diagnostic: PibblParticleDiagnostic = {
  type: "capacity-rejected",
  message: "The emitter has reached its capacity.",
  emitter: rejected.emitter,
};

const output = document.createElement("pre");
output.textContent = [
  ...events.map((event) => event.type),
  diagnostic.message,
].join("\n");
document.body.append(output);
