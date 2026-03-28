import { GraphNode, GraphRelationship, KnowledgeGraph, RelationshipType } from '../graph/types';

/**
 * Cross-Repo Processor identifies dependencies between separate repositories.
 * e.g., microservice A calling microservice B via an API endpoint.
 */
export const findCrossRepoEdges = (
    sourceGraph: KnowledgeGraph,
    targetGraph: KnowledgeGraph
): GraphRelationship[] => {
    const crossRepoEdges: GraphRelationship[] = [];

    // Potential cross-repo signal: 
    // 1. Source repo has a node with a URL or API call property.
    // 2. Target repo has a Project node with a name matching that URL or service name.

    const sourceNodes = sourceGraph.nodes;
    const targetNodes = targetGraph.nodes;

    sourceNodes.forEach(sourceNode => {
        // Look for hints in properties (e.g., "apiUrl", "serviceName", or imports)
        const possibleServiceToken = sourceNode.properties.name.toLowerCase();

        targetNodes.forEach(targetNode => {
            if (targetNode.label === 'Project') {
                const targetProjectName = targetNode.properties.name.toLowerCase();

                // Simple heuristic: if a node in Repo A mentions the name of Repo B
                if (possibleServiceToken.includes(targetProjectName) ||
                    targetProjectName.includes(possibleServiceToken)) {

                    crossRepoEdges.push({
                        id: `cross-${sourceNode.id}-${targetNode.id}`,
                        sourceId: sourceNode.id,
                        targetId: targetNode.id,
                        type: 'CALLS', // Or a new type like 'DEPENDS_ON_SERVICE'
                        confidence: 0.7,
                        reason: 'heuristic-service-match'
                    });
                }
            }
        });
    });

    return crossRepoEdges;
};
