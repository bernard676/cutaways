import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/tables';

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Appends -2, -3, ... until the slug is free. */
export async function uniqueSlug(base: string): Promise<string> {
  const normalized = toSlug(base);
  let candidate = normalized || `topic-${Date.now()}`;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase
      .from(Tables.topics)
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${normalized}-${suffix}`;
  }
}
