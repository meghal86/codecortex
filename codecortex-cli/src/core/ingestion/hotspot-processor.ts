import { KnowledgeGraph } from '../graph/types.js';

export interface HotspotStats {
    maxInDegree: number;
    maxOutDegree: number;
    avgInDegree: number;
    avgOutDegree: number;
}

/**
 * Calculate hotspot scores (centrality) for all nodes in the graph.
 * Hotspot score is based on the number of incoming and outgoing CALLS edges.
 */
export const processHotspots = (graph: KnowledgeGraph): HotspotStats => {
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();

    // Initialize
    graph.forEachNode(node => {
        inDegrees.set(node.id, 0);
        outDegrees.set(node.id, 0);
    });

    // Count CALLS and IMPORTS as traffic
    for (const rel of graph.iterRelationships()) {
        if (rel.type === 'CALLS' || rel.type === 'IMPORTS') {
            outDegrees.set(rel.sourceId, (outDegrees.get(rel.sourceId) || 0) + 1);
            inDegrees.set(rel.targetId, (inDegrees.get(rel.targetId) || 0) + 1);
        }
    }

    let totalIn = 0;
    let totalOut = 0;
    let maxIn = 0;
    let maxOut = 0;
    const nodeCount = graph.nodeCount;

    graph.forEachNode(node => {
        const inD = inDegrees.get(node.id) || 0;
        const outD = outDegrees.get(node.id) || 0;

        totalIn += inD;
        totalOut += outD;
        if (inD > maxIn) maxIn = inD;
        if (outD > maxOut) maxOut = outD;

        // Hotspot score: Weighted sum of connectivity
        // Incoming traffic is weighted more as it indicates "dependency hotspots"
        const hotspotScore = (inD * 2) + outD;

        node.properties.hotspotScore = hotspotScore;
        node.properties.inDegree = inD;
        node.properties.outDegree = outD;
    });

    return {
        maxInDegree: maxIn,
        maxOutDegree: maxOut,
        avgInDegree: nodeCount > 0 ? totalIn / nodeCount : 0,
        avgOutDegree: nodeCount > 0 ? totalOut / nodeCount : 0,
    };
};
