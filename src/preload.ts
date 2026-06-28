// Bun implements node:v8 partially — startupSnapshot.isBuildingSnapshot() throws
// NotImplementedError. BSON 6 (used by mongoose 9) calls it at module init time,
// so we stub it out here via --preload before any other module loads.
import v8 from 'node:v8';

const snapshot = (v8 as unknown as { startupSnapshot?: Record<string, unknown> }).startupSnapshot;
if (snapshot) {
  snapshot.isBuildingSnapshot = () => false;
}
