import { pibbl, Text } from "@pibbl/core";
import {
  assign,
  createMachine,
  defineMachine,
  fromCallback,
  useMachine,
  type CreateMachineOptions,
  type MachineAction,
  type MachineActionContext,
  type MachineActions,
  type MachineActor,
  type MachineDefinition,
  type MachineEvent,
  type MachineEventRoutes,
  type MachineInvocation,
  type MachineSnapshot,
  type MachineState,
  type MachineStatus,
  type MachineTask,
  type MachineTaskCleanup,
  type MachineTaskContext,
  type MachineTaskDoneEvent,
  type MachineTaskErrorEvent,
  type MachineTransition,
  type MachineTransitionConfig,
} from "@pibbl/core/machines";

type Context = { count: number };
interface Event extends MachineEvent {
  type: "START" | "RESET";
}
type Input = { delay: number };
type State = "idle" | "working" | "done" | "failed";
const log = document.createElement("output");
document.body.append(log);
const increment: MachineAction<Context, Event, Input> = assign(
  ({ context }: MachineActionContext<Context, Event, Input>) => ({
    count: context.count + 1,
  }),
);
const actions: MachineActions<Context, Event, Input> = [increment];
const start: MachineTransitionConfig<Context, Event, Input, State> = {
  target: "working",
  actions,
};
const reset: MachineTransition<Context, Event, Input, State> = "idle";
const routes: MachineEventRoutes<Context, Event, Input, State> = {
  START: start,
  RESET: reset,
};
const task: MachineTask<Context, Event, Input, string> = ({
  input,
  signal,
}: MachineTaskContext<Context, Event, Input>) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve("Completed"), input.delay);
    signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });
const invocation: MachineInvocation<Context, Event, Input, State> = {
  task,
  onDone: {
    target: "done",
    actions: ({
      event,
    }: MachineActionContext<Context, MachineTaskDoneEvent, Input>) => {
      log.textContent = String(event.output);
    },
  },
  onError: {
    target: "failed",
    actions: ({
      event,
    }: MachineActionContext<Context, MachineTaskErrorEvent, Input>) => {
      log.textContent = String(event.error);
    },
  },
};
const working: MachineState<Context, Event, Input, State> = {
  invoke: invocation,
};
const behavior: MachineDefinition<Context, Event, Input, State> = {
  initial: "idle",
  context: { count: 0 },
  on: routes,
  states: { idle: {}, working, done: {}, failed: {} },
};
const definition = defineMachine(behavior);
const options: CreateMachineOptions<Input> = { input: { delay: 800 } };
// A standalone actor has explicit start/stop ownership.
const standalone: MachineActor<Context, Event, Input, State> = createMachine(
  definition,
  options,
);
standalone.start();
standalone.send({ type: "START" });
let mounted: typeof standalone;
function Scene() {
  mounted = useMachine(definition, options);
  const snapshot: MachineSnapshot<Context, State> = mounted.snapshot.get();
  const status: MachineStatus = snapshot.status;
  return (
    <Text
      style={{ font: "18px sans-serif", fill: "#183153", top: 35 }}
    >{`${status}: ${snapshot.value}, runs ${snapshot.context.count}`}</Text>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 90;
document.body.append(canvas);
const app = pibbl(canvas, <Scene />);
const button = document.createElement("button");
button.textContent = "Start task";
document.body.append(button);
// A callback task owns its event listener and returns exact cleanup.
const listener = fromCallback<Context, Event, Input>(({ send }) => {
  const click = () => send({ type: "START" });
  button.addEventListener("click", click);
  const cleanup: MachineTaskCleanup = () =>
    button.removeEventListener("click", click);
  return cleanup;
});
const abort = new AbortController();
const cleanup = listener({
  context: { count: 0 },
  input: options.input,
  event: undefined,
  signal: abort.signal,
  send: (event) => mounted?.send(event),
});
window.addEventListener(
  "pagehide",
  () => {
    abort.abort();
    if (typeof cleanup === "function") cleanup();
    standalone.stop();
    app.dispose();
  },
  { once: true },
);
