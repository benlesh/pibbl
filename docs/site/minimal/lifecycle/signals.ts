import {
  signal,
  computed,
  batch,
  untracked,
  isSignal,
  resolveSignalValue,
  type Signal,
  type WritableSignal,
  type SignalValue,
  type SignalEquals,
  type SignalOptions,
} from "@pibbl/core";

const equals: SignalEquals<number> = (a, b) => a === b;
const options: SignalOptions<number> = { equals, debugName: "count" };
const count: WritableSignal<number> = signal(1, options);
const readonlyCount: Signal<number> = count.asReadonly();
const doubled = computed(() => readonlyCount.get() * 2);
const input: SignalValue<number> = count;
const output = document.createElement("pre");
const button = document.createElement("button");
button.textContent = "Increment twice in one batch";
function show() {
  output.textContent = `Count: ${resolveSignalValue(input)}; doubled: ${doubled.get()}; is signal: ${isSignal(input)}; untracked read: ${untracked(() => count.get())}`;
}
button.addEventListener("click", () => {
  batch(() => {
    count.update((value) => value + 1);
    count.update((value) => value + 1);
  });
  show();
});
document.body.append(button, output);
show();
