export function measureRepairTrace(trace) {
  const events = trace
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const turns = events.filter((e) => e.type === "turn.completed");
  if (
    !turns.length ||
    turns.some(
      (e) =>
        !Number.isFinite(e.usage?.input_tokens) ||
        !Number.isFinite(e.usage?.cached_input_tokens) ||
        !Number.isFinite(e.usage?.output_tokens),
    )
  )
    return { uncachedTokenProxy: null, commandExecutions: null };
  const inputTokens = turns.reduce((n, e) => n + e.usage.input_tokens, 0),
    cachedInputTokens = turns.reduce(
      (n, e) => n + e.usage.cached_input_tokens,
      0,
    ),
    outputTokens = turns.reduce((n, e) => n + e.usage.output_tokens, 0);
  if (cachedInputTokens > inputTokens) throw new Error("Invalid token usage");
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    uncachedTokenProxy: inputTokens - cachedInputTokens + outputTokens,
    commandExecutions: events.filter(
      (e) =>
        e.type === "item.completed" && e.item?.type === "command_execution",
    ).length,
  };
}
