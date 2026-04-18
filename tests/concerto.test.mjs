import test from 'node:test';
import assert from 'node:assert/strict';

import { getConcertoMethodInventory, planOperation } from '../dist/index.js';

test('concerto inventory includes documented keyboard, raw input, and vision methods', () => {
  const inventory = getConcertoMethodInventory();
  assert.ok(inventory.some((item) => item.id === 'keyboard-native'));
  assert.ok(inventory.some((item) => item.id === 'os-input-injection'));
  assert.ok(inventory.some((item) => item.id === 'vision-analysis'));
  assert.ok(inventory.some((item) => item.id === 'browser-cdp'));
});

test('concerto planner picks keyboard for command operations', () => {
  const plan = planOperation('office-com+uia', 'hotkey', ['win-uia', 'vision']);
  assert.equal(plan.primaryMethod, 'keyboard-native');
  assert.deepEqual(plan.fallbackMethods, ['office-com+uia', 'win-uia', 'vision']);
});

test('concerto planner picks raw input for spatial operations', () => {
  const plan = planOperation('win-uia', 'drag', ['vision']);
  assert.equal(plan.primaryMethod, 'os-input-injection');
  assert.deepEqual(plan.fallbackMethods, ['vision']);
});

test('concerto planner uses vision analysis for describe workflows', () => {
  const plan = planOperation('electron-cdp', 'describe', ['win-uia', 'vision']);
  assert.equal(plan.primaryMethod, 'vision-analysis');
  assert.deepEqual(plan.fallbackMethods, ['vision']);
});
