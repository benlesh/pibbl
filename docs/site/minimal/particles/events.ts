import {
  type CRCParticleBurstAcceptedEvent,
  type CRCParticleBurstRejectedEvent,
  type CRCParticleDiagnostic,
  type CRCParticleDrainStartEvent,
  type CRCParticleFinishEvent,
  type CRCParticleStartEvent,
  type CRCParticleSystemEvent,
} from "@crc/core/particles";

const started: CRCParticleStartEvent = { type: "start" };
const accepted: CRCParticleBurstAcceptedEvent = {
  type: "burst-accepted",
  emitter: "spark",
  requested: 12,
  accepted: 12,
};
const rejected: CRCParticleBurstRejectedEvent = {
  type: "burst-rejected",
  emitter: "spark",
  requested: 12,
  accepted: 0,
  reason: "capacity",
};
const draining: CRCParticleDrainStartEvent = { type: "drain-start" };
const finished: CRCParticleFinishEvent = { type: "finish" };
const events: CRCParticleSystemEvent[] = [
  started,
  accepted,
  rejected,
  draining,
  finished,
];
const diagnostic: CRCParticleDiagnostic = {
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
