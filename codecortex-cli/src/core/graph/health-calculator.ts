import { initKuzu, executeQuery, closeKuzu } from '../kuzu/kuzu-adapter.js';
import type { HealthSnapshot } from '../../storage/repo-manager.js';

/**
 * Computes architecture health metrics by querying the graph structure in KuzuDB.
 */
export async function computeHealthMetrics(kuzuPath: string, commitInfo: { currentCommit: string }): Promise<HealthSnapshot> {
  const needsClose = false; 
  // We assume the caller might have already initialized Kuzu, but just in case:
  try {
    const result = await executeQuery('MATCH (n) RETURN count(n) LIMIT 1');
  } catch {
    await initKuzu(kuzuPath);
    // needsClose = true;
  }

  const snapshot: HealthSnapshot = {
    timestamp: new Date().toISOString(),
    commit: commitInfo.currentCommit || 'unknown',
    couplingScore: 0,
    busFactor: 0, // Requires git-level author blame analysis not currently in Kuzu
    deadCodePct: 0,
    communityCount: 0,
    cohesionAvg: 0,
    hotspotCount: 0, // Requires git history frequency analysis
    circularDeps: 0,
  };

  try {
    // 1. Coupling Score (avg degree for non-file/folder nodes)
    const couplingQuery = `
      MATCH (n) 
      WHERE NOT label(n) IN ['File', 'Folder', 'Project', 'Community', 'Process']
      OPTIONAL MATCH (n)-[r:CodeRelation]-()
      WITH n, count(r) AS degree
      RETURN avg(degree) AS avgCoupling
    `;
    const couplingRes = await executeQuery(couplingQuery);
    if (couplingRes.length > 0) {
      snapshot.couplingScore = Number(couplingRes[0].avgCoupling ?? couplingRes[0][0] ?? 0);
    }

    // 2. Dead Code % (functions/methods with 0 incoming CALLS)
    const deadQuery = `
      MATCH (n)
      WHERE label(n) IN ['Function', 'Method']
      OPTIONAL MATCH ()-[r:CodeRelation {type: 'CALLS'}]->(n)
      WITH n, count(r) AS inDegree
      RETURN 
        count(n) AS totalCallable,
        sum(CASE WHEN inDegree = 0 THEN 1 ELSE 0 END) AS deadCount
    `;
    const deadRes = await executeQuery(deadQuery);
    if (deadRes.length > 0) {
      const totalCallable = Number(deadRes[0].totalCallable ?? deadRes[0][0] ?? 0);
      const deadCount = Number(deadRes[0].deadCount ?? deadRes[0][1] ?? 0);
      snapshot.deadCodePct = totalCallable > 0 ? (deadCount / totalCallable) * 100 : 0;
    }

    // 3. Community Cohesion
    const communityQuery = `
      MATCH (c:Community)
      RETURN count(c) AS commCount, avg(c.cohesion) AS avgCohesion
    `;
    const commRes = await executeQuery(communityQuery);
    if (commRes.length > 0) {
      snapshot.communityCount = Number(commRes[0].commCount ?? commRes[0][0] ?? 0);
      snapshot.cohesionAvg = Number(commRes[0].avgCohesion ?? commRes[0][1] ?? 0);
    }

    // 4. Circular Dependencies (cross-file CALLS)
    const circularQuery = `
      MATCH (a)-[r1:CodeRelation {type: 'CALLS'}]->(b),
            (b)-[r2:CodeRelation {type: 'CALLS'}]->(a)
      WHERE a.filePath <> b.filePath AND id(a) < id(b)
      RETURN count(*) AS circularCount
    `;
    const circularRes = await executeQuery(circularQuery);
    if (circularRes.length > 0) {
      snapshot.circularDeps = Number(circularRes[0].circularCount ?? circularRes[0][0] ?? 0);
    }

  } catch (err) {
    console.error('CodeCortex: Error computing health metrics', err);
  }

  return snapshot;
}
