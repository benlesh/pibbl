const storageKey = "kube-inferno:quick-start:v1";
const tips = [
  {
    title: "Fire? Share the load.",
    body: "A burning server has too much work. Select it and use Add replica for quick relief, or Investigate for a lasting speed-up.",
    target: "app-2",
    highlight: "#replica",
  },
  {
    title: "Sparks mean it’s offline.",
    body: "Dark machines serve no customers but still cost money. Add a replacement, then select the broken machine and Retire it.",
    target: "app-3",
    highlight: "#retire",
  },
  {
    title: "Build. Connect. Let it boot.",
    body: "Drag a server onto the map. Connect gateway → server → database using its ports. It starts helping when construction finishes.",
    target: null,
    highlight: "#build-tray",
  },
];

/** Optional, nonmodal onboarding. No timers and no simulation side effects. */
export function mountQuickGuide(
  host: HTMLElement,
  select: (id: string) => void,
) {
  const panel = document.createElement("section");
  panel.className = "quick-guide";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Quick start");
  panel.hidden = true;
  panel.innerHTML = `<div class="guide-top"><span>QUICK START <b class="guide-count"></b></span><button class="guide-skip">Skip tips</button></div><div aria-live="polite"><h2></h2><p></p></div><div class="guide-bottom"><span>No rush. You can keep playing.</span><button class="guide-next">Next tip →</button></div>`;
  host.append(panel);
  let index = 0;
  const clearHighlight = () =>
    document
      .querySelectorAll(".tutorial-target")
      .forEach((el) => el.classList.remove("tutorial-target"));
  const render = () => {
    const tip = tips[index];
    panel.querySelector("h2")!.textContent = tip.title;
    panel.querySelector("p")!.textContent = tip.body;
    panel.querySelector(".guide-count")!.textContent =
      `${index + 1} / ${tips.length}`;
    panel.querySelector(".guide-next")!.textContent =
      index === tips.length - 1 ? "Let me try" : "Next tip →";
    clearHighlight();
    document.querySelector(tip.highlight)?.classList.add("tutorial-target");
    if (tip.target) select(tip.target);
  };
  const dismiss = () => {
    panel.hidden = true;
    clearHighlight();
    try {
      localStorage.setItem(storageKey, "seen");
    } catch {
      /* Optional persistence. */
    }
  };
  const show = () => {
    index = 0;
    panel.hidden = false;
    render();
  };
  panel.querySelector<HTMLButtonElement>(".guide-skip")!.onclick = dismiss;
  panel.querySelector<HTMLButtonElement>(".guide-next")!.onclick = () => {
    if (index === tips.length - 1) dismiss();
    else {
      index++;
      render();
    }
  };
  let seen = false;
  try {
    seen = localStorage.getItem(storageKey) === "seen";
  } catch {
    /* Still show tips once this session. */
  }
  if (!seen) show();
  return {
    show,
    dispose() {
      clearHighlight();
      panel.remove();
    },
  };
}
