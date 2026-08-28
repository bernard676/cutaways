import {
  mapBookmark,
  mapChatMessage,
  mapComponent,
  mapGeneration,
  mapRelationship,
  mapSearchHistoryEntry,
  mapTopic,
  Row,
} from '@/lib/db-mappers';

const topicRow: Row.Topic = {
  id: 't1',
  slug: 'suspension-bridge',
  title: 'Suspension Bridge',
  description: 'A bridge hung from cables.',
  domain: 'Civil engineering',
  structured_knowledge: {
    overview: 'o',
    materials: [],
    construction: [],
    science: { principle: 'p', formula: 'f', formulaNote: 'n' },
    failureModes: [],
    sources: [],
    relatedTopicSlugs: [],
    flow: [],
    howItWorks: '',
  },
  image_url: 'https://img/t1.png',
  image_storage_path: 't1.png',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

describe('db-mappers', () => {
  it('mapTopic converts snake_case to camelCase without dropping fields', () => {
    const topic = mapTopic(topicRow);
    expect(topic).toMatchObject({
      id: 't1',
      slug: 'suspension-bridge',
      imageUrl: 'https://img/t1.png',
      imageStoragePath: 't1.png',
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });
    expect(topic.structuredKnowledge).toBe(topicRow.structured_knowledge);
  });

  it('mapComponent maps the narrative fields', () => {
    const component = mapComponent({
      id: 'c1',
      topic_id: 't1',
      name: 'Main cable',
      description: 'A bundle of steel wire.',
      does: 'carries the deck load',
      why: 'because steel is strong in tension',
      materials: ['steel'],
      metadata: { bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
      sort_order: 2,
    });
    expect(component).toMatchObject({
      topicId: 't1',
      does: 'carries the deck load',
      why: 'because steel is strong in tension',
      sortOrder: 2,
    });
    expect(component.metadata.bbox).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  });

  it('mapRelationship preserves the typed edge', () => {
    expect(
      mapRelationship({
        id: 'r1',
        topic_id: 't1',
        from_component_id: 'c1',
        to_component_id: 'c2',
        type: 'transfersLoadTo',
        description: 'd',
      })
    ).toMatchObject({ fromComponentId: 'c1', toComponentId: 'c2', type: 'transfersLoadTo' });
  });

  it('mapGeneration keeps a null topic_id null', () => {
    expect(
      mapGeneration({
        id: 'g1',
        topic_id: null,
        query: 'q',
        status: 'failed',
        error: 'boom',
        created_by: 'u1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })
    ).toMatchObject({ topicId: null, status: 'failed', error: 'boom' });
  });

  it('mapBookmark / mapSearchHistoryEntry / mapChatMessage map user_id and component context', () => {
    expect(mapBookmark({ id: 'b1', user_id: 'u1', topic_id: 't1', created_at: 'ts' })).toMatchObject({
      userId: 'u1',
      topicId: 't1',
    });
    expect(
      mapSearchHistoryEntry({ id: 's1', user_id: 'u1', query: 'q', topic_id: null, created_at: 'ts' })
    ).toMatchObject({ userId: 'u1', topicId: null });
    expect(
      mapChatMessage({
        id: 'm1',
        topic_id: 't1',
        user_id: 'u1',
        role: 'assistant',
        content: 'hi',
        component_context_id: 'c1',
        created_at: 'ts',
      })
    ).toMatchObject({ role: 'assistant', componentContextId: 'c1' });
  });
});
