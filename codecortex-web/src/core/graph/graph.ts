import { GraphNode, GraphRelationship, KnowledgeGraph, RelationshipType } from './types'

const EMPTY_ARR: GraphRelationship[] = [];

export const createKnowledgeGraph = (): KnowledgeGraph => {
  const nodeMap = new Map<string, GraphNode>();
  const relationshipMap = new Map<string, GraphRelationship>();

  // Pre-built adjacency indexes for O(1) lookups
  const outgoingIndex = new Map<string, GraphRelationship[]>();
  const incomingIndex = new Map<string, GraphRelationship[]>();
  const typeIndex = new Map<string, GraphRelationship[]>();

  const indexRelationship = (rel: GraphRelationship) => {
    // Outgoing: sourceId -> relationships[]
    let out = outgoingIndex.get(rel.sourceId);
    if (!out) { out = []; outgoingIndex.set(rel.sourceId, out); }
    out.push(rel);

    // Incoming: targetId -> relationships[]
    let inc = incomingIndex.get(rel.targetId);
    if (!inc) { inc = []; incomingIndex.set(rel.targetId, inc); }
    inc.push(rel);

    // By type: type -> relationships[]
    let byType = typeIndex.get(rel.type);
    if (!byType) { byType = []; typeIndex.set(rel.type, byType); }
    byType.push(rel);
  };

  const addNode = (node: GraphNode) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  };

  const addRelationship = (relationship: GraphRelationship) => {
    if (!relationshipMap.has(relationship.id)) {
      relationshipMap.set(relationship.id, relationship);
      indexRelationship(relationship);
    }
  };

  const mergeGraph = (other: KnowledgeGraph) => {
    other.nodes.forEach(addNode);
    other.relationships.forEach(addRelationship);
  };

  return {
    get nodes() {
      return Array.from(nodeMap.values())
    },

    get relationships() {
      return Array.from(relationshipMap.values())
    },

    // O(1) count getters - avoid creating arrays just for length
    get nodeCount() {
      return nodeMap.size;
    },

    get relationshipCount() {
      return relationshipMap.size;
    },

    addNode,
    addRelationship,
    mergeGraph,

    // O(1) adjacency lookups
    getNode: (nodeId: string) => nodeMap.get(nodeId),
    getOutgoing: (nodeId: string) => outgoingIndex.get(nodeId) || EMPTY_ARR,
    getIncoming: (nodeId: string) => incomingIndex.get(nodeId) || EMPTY_ARR,
    getByType: (type: RelationshipType) => typeIndex.get(type) || EMPTY_ARR,
  };
};