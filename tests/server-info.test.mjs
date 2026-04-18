import test from 'node:test';
import assert from 'node:assert/strict';

import { UABServer } from '../dist/server.js';

test('server info publishes hook, framework signature, and concerto inventory', async () => {
  const server = new UABServer({
    port: 0,
    connector: {
      persistent: false,
      extensionBridge: false,
      loadProfiles: false,
    },
  });

  await server.start();
  try {
    const response = await fetch(`${server.address}/info`);
    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.name, 'Universal App Bridge Server');
    assert.ok(Array.isArray(payload.frameworkHooks));
    assert.ok(Array.isArray(payload.frameworkSignatures));
    assert.ok(Array.isArray(payload.concertoMethods));
    assert.ok(payload.frameworkHooks.some(item => item.id === 'office-com+uia'));
    assert.ok(payload.frameworkSignatures.some(item => item.framework === 'electron'));
    assert.ok(payload.concertoMethods.some(item => item.id === 'keyboard-native'));
  } finally {
    await server.stop();
  }
});
