/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('boots to the login screen when there is no saved session', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // Login has the username/password inputs.
  const inputs = tree.root.findAll(n => (n.type as unknown) === 'TextInput');
  expect(inputs.length).toBeGreaterThanOrEqual(2);
  await ReactTestRenderer.act(async () => tree.unmount());
});
