export type RelationshipType =
  | 'partOf'
  | 'connectedTo'
  | 'supports'
  | 'transfersLoadTo'
  | 'madeOf'
  | 'powers'
  | 'causes';

export type GenerationStatus =
  | 'pending'
  | 'understanding'
  | 'knowledge'
  | 'components'
  | 'image'
  | 'finalizing'
  | 'complete'
  | 'failed';

export interface ConstructionStep {
  order: number;
  title: string;
  description: string;
}

export interface Material {
  name: string;
  spec: string;
  why: string;
}

export interface FailureMode {
  name: string;
  cause: string;
  mitigation: string;
}

export interface Science {
  principle: string;
  formula: string;
  formulaNote: string;
}

export interface Source {
  title: string;
  publisher: string;
}

export interface StructuredKnowledge {
  overview: string;
  materials: Material[];
  construction: ConstructionStep[];
  science: Science;
  failureModes: FailureMode[];
  sources: Source[];
  relatedTopicSlugs: string[];
  /** Ordered top-to-bottom causal/load chain for the "How it works" flow chart. */
  flow: string[];
  /**
   * Continuous prose (2-4 paragraphs, separated by blank lines) explaining how the components
   * work together as a system -- the "How it works" tab's primary content. Older topics
   * generated before this field existed won't have it; the UI falls back to `flow` for those.
   */
  howItWorks: string;
}

export interface Topic {
  id: string;
  slug: string;
  title: string;
  description: string;
  domain: string | null;
  structuredKnowledge: StructuredKnowledge;
  imageUrl: string | null;
  imageStoragePath: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TopicComponent {
  id: string;
  topicId: string;
  name: string;
  /** What it is. */
  description: string;
  /** What it does. */
  does: string;
  /** Why it exists. */
  why: string;
  materials: string[];
  metadata: {
    bbox?: ComponentBoundingBox;
    [key: string]: unknown;
  };
  sortOrder: number;
}

export interface ComponentRelationship {
  id: string;
  topicId: string;
  fromComponentId: string;
  toComponentId: string;
  type: RelationshipType;
  description: string;
}

export interface Generation {
  id: string;
  topicId: string | null;
  query: string;
  status: GenerationStatus;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  topicId: string;
  createdAt: string;
}

export interface SearchHistoryEntry {
  id: string;
  userId: string;
  query: string;
  topicId: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  topicId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  componentContextId: string | null;
  createdAt: string;
}

export interface TopicSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  similarity?: number;
}
