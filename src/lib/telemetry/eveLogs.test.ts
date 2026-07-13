import { describe, expect, it } from 'vitest';

import { getEveLogStatus, startEveLogWatcher } from './eveLogs';

describe('EVE log telemetry browser fallback', () => {
  it('stays disabled when Tauri APIs are unavailable', async () => {
    await expect(startEveLogWatcher()).resolves.toMatchObject({
      watching: false,
      gamelogFiles: 0,
      chatlogFiles: 0,
    });
    await expect(getEveLogStatus()).resolves.toMatchObject({ watching: false });
  });
});
