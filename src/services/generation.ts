import { generateImage } from '@/lib/ai/image';
import { embedText } from '@/lib/ai/embeddings';
import { GeneratedKnowledge, generateStructuredKnowledge } from '@/lib/ai/llm';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { uniqueSlug } from '@/lib/slug';
import { Buckets, Rpc, Tables } from '@/lib/tables';
import { GenerationStatus, Topic, TopicComponent } from '@/types/knowledge';

const DUPLICATE_SIMILARITY_THRESHOLD = 0.92;

/** Generates the topic image, uploads it, and persists the URL on the topic row. */
async function generateAndStoreImage(topicId: string, knowledge: GeneratedKnowledge): Promise<string> {
  const image = await generateImage(knowledge);
  const path = `${topicId}.png`;
  const { error: uploadError } = await supabase.storage
    .from(Buckets.topicImages)
    .upload(path, image.bytes, { contentType: image.contentType, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from(Buckets.topicImages).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from(Tables.topics)
    .update({ image_url: publicUrlData.publicUrl, image_storage_path: path })
    .eq('id', topicId);
  if (updateError) throw new Error(updateError.message);

  return publicUrlData.publicUrl;
}

/**
 * Generates and persists an image for a topic that ended up without one (e.g. a prior
 * generation that failed or was interrupted after creating the topic/components but before
 * the image step finished). No-ops if the topic already has an image. The original
 * `imagePrompt` an in-flight generation used isn't stored on the topic, so it's rebuilt from
 * the topic's own description/overview.
 */
export async function ensureTopicImage(topic: Topic, components: TopicComponent[]): Promise<string> {
  if (topic.imageUrl) return topic.imageUrl;

  const sk = topic.structuredKnowledge;
  const knowledge: GeneratedKnowledge = {
    title: topic.title,
    slug: topic.slug,
    description: topic.description,
    domain: topic.domain ?? '',
    overview: sk.overview,
    materials: sk.materials,
    construction: sk.construction,
    science: sk.science,
    failureModes: sk.failureModes,
    sources: sk.sources,
    relatedTopicSlugs: sk.relatedTopicSlugs,
    flow: sk.flow,
    components: components.map((c) => ({
      name: c.name,
      description: c.description,
      does: c.does,
      why: c.why,
      materials: c.materials,
    })),
    relationships: [],
    imagePrompt: sk.overview || topic.description,
  };

  return generateAndStoreImage(topic.id, knowledge);
}

/**
 * Runs the whole search->knowledge->image pipeline in-process (no backend -- the app calls
 * OpenAI/Anthropic directly). onPhase drives the progress UI locally since nothing else needs
 * to observe intermediate state anymore.
 */
export async function runGeneration(
  query: string,
  onPhase: (phase: GenerationStatus) => void
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data: generation } = await supabase
    .from(Tables.generations)
    .insert({ query, created_by: userId, status: 'understanding' })
    .select()
    .single();
  const generationId: string | undefined = generation?.id;

  try {
    onPhase('understanding');
    // Dedup-check needs OpenAI for embeddings even when Claude is selected for everything
    // else (Anthropic has no embeddings API). That's a nice-to-have, not essential, so a
    // missing/failing OpenAI key should skip it rather than block generation entirely --
    // someone using only an Anthropic key must still be able to generate topics.
    let embedding: number[] | null = null;
    try {
      embedding = await embedText(query);
    } catch (err) {
      logger.warn('runGeneration', 'Embeddings unavailable, skipping duplicate check', { err });
    }

    if (embedding) {
      const { data: matches, error: matchError } = await supabase.rpc(Rpc.matchTopics, {
        query_embedding: embedding,
        match_threshold: DUPLICATE_SIMILARITY_THRESHOLD,
        match_count: 1,
      });
      if (matchError) throw matchError;
      if (matches && matches.length > 0) {
        const topicId = matches[0].id as string;
        if (generationId) {
          await supabase
            .from(Tables.generations)
            .update({ status: 'complete', topic_id: topicId })
            .eq('id', generationId);
        }
        onPhase('complete');
        return topicId;
      }
    }

    onPhase('knowledge');
    const knowledge = await generateStructuredKnowledge(query);

    onPhase('components');
    const slug = await uniqueSlug(knowledge.slug || knowledge.title);

    const { data: topic, error: topicError } = await supabase
      .from(Tables.topics)
      .insert({
        slug,
        title: knowledge.title,
        description: knowledge.description,
        domain: knowledge.domain,
        structured_knowledge: {
          overview: knowledge.overview,
          materials: knowledge.materials,
          construction: knowledge.construction,
          science: knowledge.science,
          failureModes: knowledge.failureModes,
          sources: knowledge.sources,
          relatedTopicSlugs: knowledge.relatedTopicSlugs,
          flow: knowledge.flow,
        },
        embedding,
        created_by: userId,
      })
      .select()
      .single();
    if (topicError || !topic) throw new Error(topicError?.message ?? 'Failed to create topic');

    if (knowledge.components.length > 0) {
      const componentRows = knowledge.components.map((c, index) => ({
        topic_id: topic.id,
        name: c.name,
        description: c.description,
        does: c.does,
        why: c.why,
        materials: c.materials,
        sort_order: index,
      }));
      const { data: insertedComponents, error: componentsError } = await supabase
        .from(Tables.components)
        .insert(componentRows)
        .select();
      if (componentsError || !insertedComponents) {
        throw new Error(componentsError?.message ?? 'Failed to create components');
      }

      const nameToId = new Map<string, string>(insertedComponents.map((c) => [c.name, c.id]));
      const relationshipRows = knowledge.relationships
        .filter((r) => nameToId.has(r.from) && nameToId.has(r.to))
        .map((r) => ({
          topic_id: topic.id,
          from_component_id: nameToId.get(r.from),
          to_component_id: nameToId.get(r.to),
          type: r.type,
          description: r.description,
        }));
      if (relationshipRows.length > 0) {
        const { error: relError } = await supabase.from(Tables.relationships).insert(relationshipRows);
        if (relError) throw new Error(relError.message);
      }
    }

    onPhase('image');
    await generateAndStoreImage(topic.id, knowledge);

    onPhase('finalizing');
    if (generationId) {
      await supabase
        .from(Tables.generations)
        .update({ status: 'complete', topic_id: topic.id })
        .eq('id', generationId);
    }

    onPhase('complete');
    return topic.id;
  } catch (error) {
    logger.error('runGeneration', 'Pipeline failed', error);
    if (generationId) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from(Tables.generations).update({ status: 'failed', error: message }).eq('id', generationId);
    }
    throw error;
  }
}
