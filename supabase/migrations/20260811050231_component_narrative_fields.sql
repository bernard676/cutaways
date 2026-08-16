-- Split the single visualpedia_components.purpose field into the two narrative
-- fields the design's component sheet actually renders: "what it does" and
-- "why it exists". structured_knowledge stays jsonb, so its internal reshape
-- (materials/failureModes/sources objects, new science/flow fields) needs no
-- schema change here -- only the Edge Function and app-side types change.

alter table visualpedia_components
  drop column purpose,
  add column does text not null default '',
  add column why text not null default '';
