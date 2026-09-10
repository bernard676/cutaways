# Planning

Business setup, cost model, and direction for Loupe. Living document — update as
vendors, prices, and priorities firm up.

## First-time (one-off) costs

| Item | What it covers | Link |
| --- | --- | --- |
| Product branding + consult | Naming, positioning, brand strategy session | _tbd_ |
| Web domains | Register the primary domain + defensive variants (`.com`, `.app`, common misspellings) | _tbd_ |
| Business entity setup | Incorporate (LLC / equivalent) so taxes are handled cleanly and the founder's **personal address stays hidden** (registered-agent service) | _tbd_ |
| Designer — brand + design system | Contract a designer to deliver the trademark artwork and a full design system (see [`../DESIGN.md`](../DESIGN.md)) | _tbd_ |
| Trademark registration | File the wordmark + logo | _tbd_ |
| Name clearance — "Loupe" | Search existing marks / apps / domains for "Loupe" conflicts (note: generic optics term — the mark is in software/knowledge-tools class); secure `loupe.app` + defensive `.com`; set up Google Workspace on the brand domain | <https://www.google.com> |

## Infrastructure (recurring) costs

| Service | What it's for | Link |
| --- | --- | --- |
| Supabase | Postgres + Auth + Storage (no Edge Functions — see [`ARCHITECTURE.md`](ARCHITECTURE.md)) | <https://supabase.com/dashboard> |
| AI — Claude (Anthropic) | Structured knowledge, chat, vision | <https://console.anthropic.com> |
| AI — OpenAI | Reserved — future embeddings / fallback (removed for now, no embeddings API on Claude) | <https://platform.openai.com> |
| AI — Gemini (Google AI Studio) | Infographic image generation (`gemini-3-pro-image-preview`) | <https://aistudio.google.com/projects> |
| Hosting | App distribution (EAS) + web output hosting | _tbd_ |

## Direction

- **AEO rising.** Answer Engine Optimization — being cited by AI answer engines — is becoming
  as load-bearing as classic SEO. Structure generated content and metadata so LLM-backed
  search surfaces and attributes it.
- **MVP.** Ship the minimum loop: search → generated cutaway infographic + structured
  knowledge, camera scan, component drill-down, contextual chat. Defer semantic search,
  content moderation, and multi-provider switching.

## Resources

| Resource | Link |
| --- | --- |
| UX / flow reference (latest iOS apps) | <https://mobbin.com/discover/apps/ios/latest> |
| Google AI Studio projects | <https://aistudio.google.com/projects> |
