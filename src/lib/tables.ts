/** This Supabase project is shared across apps; every table/bucket is namespaced. */
export const Tables = {
  topics: 'visualpedia_topics',
  components: 'visualpedia_components',
  relationships: 'visualpedia_relationships',
  generations: 'visualpedia_generations',
  bookmarks: 'visualpedia_bookmarks',
  searchHistory: 'visualpedia_search_history',
  chatMessages: 'visualpedia_chat_messages',
} as const;

export const Buckets = {
  topicImages: 'visualpedia-topic-images',
} as const;

export const Rpc = {
  matchTopics: 'visualpedia_match_topics',
  relatedTopics: 'visualpedia_related_topics',
} as const;
