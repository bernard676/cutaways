import {
  Bookmark,
  ChatMessage,
  ComponentRelationship,
  Generation,
  SearchHistoryEntry,
  StructuredKnowledge,
  Topic,
  TopicComponent,
} from '@/types/knowledge';

/** Raw row shapes as returned by supabase-js from the visualpedia_* tables (snake_case). */
export namespace Row {
  export interface Topic {
    id: string;
    slug: string;
    title: string;
    description: string;
    domain: string | null;
    structured_knowledge: StructuredKnowledge;
    image_url: string | null;
    image_storage_path: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }

  export interface Component {
    id: string;
    topic_id: string;
    name: string;
    description: string;
    does: string;
    why: string;
    materials: string[];
    metadata: Record<string, unknown>;
    sort_order: number;
  }

  export interface Relationship {
    id: string;
    topic_id: string;
    from_component_id: string;
    to_component_id: string;
    type: ComponentRelationship['type'];
    description: string;
  }

  export interface Generation {
    id: string;
    topic_id: string | null;
    query: string;
    status: import('@/types/knowledge').GenerationStatus;
    error: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }

  export interface Bookmark {
    id: string;
    user_id: string;
    topic_id: string;
    created_at: string;
  }

  export interface SearchHistoryEntry {
    id: string;
    user_id: string;
    query: string;
    topic_id: string | null;
    created_at: string;
  }

  export interface ChatMessage {
    id: string;
    topic_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    component_context_id: string | null;
    created_at: string;
  }
}

export function mapTopic(row: Row.Topic): Topic {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    domain: row.domain,
    structuredKnowledge: row.structured_knowledge,
    imageUrl: row.image_url,
    imageStoragePath: row.image_storage_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapComponent(row: Row.Component): TopicComponent {
  return {
    id: row.id,
    topicId: row.topic_id,
    name: row.name,
    description: row.description,
    does: row.does,
    why: row.why,
    materials: row.materials,
    metadata: row.metadata,
    sortOrder: row.sort_order,
  };
}

export function mapRelationship(row: Row.Relationship): ComponentRelationship {
  return {
    id: row.id,
    topicId: row.topic_id,
    fromComponentId: row.from_component_id,
    toComponentId: row.to_component_id,
    type: row.type,
    description: row.description,
  };
}

export function mapGeneration(row: Row.Generation): Generation {
  return {
    id: row.id,
    topicId: row.topic_id,
    query: row.query,
    status: row.status,
    error: row.error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBookmark(row: Row.Bookmark): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    topicId: row.topic_id,
    createdAt: row.created_at,
  };
}

export function mapSearchHistoryEntry(row: Row.SearchHistoryEntry): SearchHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    query: row.query,
    topicId: row.topic_id,
    createdAt: row.created_at,
  };
}

export function mapChatMessage(row: Row.ChatMessage): ChatMessage {
  return {
    id: row.id,
    topicId: row.topic_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    componentContextId: row.component_context_id,
    createdAt: row.created_at,
  };
}
