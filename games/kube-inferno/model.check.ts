import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  advance,
  purchase,
  connect,
  retire,
  investigate,
} from "./model.ts";

test("new capacity costs cash once, waits for build and routing, then relieves load", () => {
  const g = createGame();
  const before = g.bank;
  const n = purchase(g, "large", 600, 400)!;
  assert.equal(g.bank, before - 600);
  assert.equal(n.ready, false);
  assert.equal(connect(g, "gateway", n.id), true);
  assert.equal(connect(g, n.id, "database"), true);
  for (let i = 0; i < 190; i++) advance(g, 0.1);
  assert.equal(n.ready, false);
  for (let i = 0; i < 20; i++) advance(g, 0.1);
  assert.equal(n.ready, true);
  assert.ok(g.quality > 0.7);
  assert.ok(g.revenue > 0);
  const cost = g.costs;
  retire(g, n.id);
  advance(g, 0.1);
  assert.ok(g.costs < cost);
});

test("invalid purchases and routes do not change money or topology", () => {
  const g = createGame();
  g.bank = 50;
  assert.equal(purchase(g, "small", 100, 100), null);
  assert.equal(g.bank, 50);
  assert.equal(connect(g, "database", "gateway"), false);
  assert.equal(connect(g, "gateway", "gateway"), false);
});

test("investigation has a real delayed efficiency benefit", () => {
  const g = createGame();
  assert.equal(investigate(g), true);
  assert.equal(investigate(g), false);
  for (let i = 0; i < 260; i++) advance(g, 0.1);
  assert.equal(g.efficiency, 1.5);
});

test("unconnected read replicas cannot silently add database capacity", () => {
  const a = createGame(),
    b = createGame();
  a.users = b.users = 400000;
  a.efficiency = b.efficiency = 10;
  for (const g of [a, b])
    for (const n of g.nodes) if (n.kind === "small") n.kind = "large";
  const extra = purchase(b, "database", 800, 500)!;
  extra.ready = true;
  advance(a, 0.1);
  advance(b, 0.1);
  assert.equal(a.quality, b.quality);
});
