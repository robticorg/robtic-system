import v8 from 'v8';

const snapshot = (v8 as unknown as { startupSnapshot?: Record<string, unknown> }).startupSnapshot;
if (snapshot) {
  snapshot.isBuildingSnapshot = () => false;
}

// Settings from the admin console (token, database, every variable) before any other module reads process.env.
// A no-op unless ROBTIC_CONFIG_MONGO_URI, ROBTIC_CONFIG_KEY and ROBTIC_BOT are set. See remote-config.ts.
await import('./remote-config');
