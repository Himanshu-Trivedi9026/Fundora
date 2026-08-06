# Knowledge Engine

## Overview

The knowledge engine (`lib/ai/knowledgeEngine.js`) manages a searchable knowledge base with semantic vector search. It handles document chunking, embedding creation, multi-source context retrieval, and article lifecycle management.

All functions follow the "never throw" pattern and return `{ success: boolean, data?, error? }`.

## Document Chunking

### `chunkDocument({ content, chunkSize, overlap })`

Splits text into overlapping chunks optimised for embedding. This is a pure function with no side effects.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `chunkSize` | 500 | Maximum characters per chunk |
| `overlap` | 50 | Character overlap between consecutive chunks |

### Chunking Algorithm

1. If content fits in a single chunk, return as-is
2. Walk through content in `chunkSize - overlap` steps
3. At each chunk boundary, search backwards for a natural break point:
   - First priority: sentence-ending punctuation (`.`, `!`, `?`) followed by space
   - Second priority: whitespace (space or newline)
   - Fallback: hard break at chunk boundary
4. Skip empty or whitespace-only chunks
5. Guard against zero-progress loops when overlap ≥ chunkSize

### Output

```javascript
{
  chunks: [
    { text: "First chunk content...", index: 0, charStart: 0, charEnd: 487 },
    { text: "Second chunk content...", index: 1, charStart: 437, charEnd: 924 }
  ]
}
```

Each chunk records its character offsets for traceability back to the source document.

## Embedding Creation and Storage

### `indexKnowledgeArticle({ title, content, category, tags, source, metadata })`

Full indexing pipeline for a knowledge article.

### Pipeline

1. **Validate** — Title, content, and category are required; content must be ≤ 500,000 characters
2. **Chunk** — Split content using `chunkDocument()` with default settings (500 chars, 50 overlap)
3. **Store metadata** — Insert article record into `knowledge_articles` table with chunk count and content length
4. **Create embeddings** — For each chunk, call `createEmbedding()` which:
   - Calls the active provider's `createEmbedding()` method
   - Stores the vector in `ai_embeddings` table with `entity_type = "knowledge_article"`
   - Records metadata: article title, category, tags, chunk index, character offsets
5. **Audit log** — Records the indexing event with total and successful chunk counts

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_CHUNK_SIZE` | 500 | Characters per chunk |
| `DEFAULT_CHUNK_OVERLAP` | 50 | Overlap between chunks |
| `MAX_CONTENT_LENGTH` | 500,000 | Maximum article size |

## Semantic Search

### `searchKnowledge({ query, category, matchCount, threshold })`

Searches the knowledge base using vector similarity with keyword fallback.

### Search Flow

1. **Semantic search** — Creates a query embedding and searches `ai_embeddings` via Supabase RPC for cosine similarity
2. **Deduplicate** — Groups results by article ID (multiple chunks per article)
3. **Enrich** — Fetches article metadata (title, content snippet, category) from `knowledge_articles`
4. **Filter** — Applies category filter if specified; excludes non-"active" articles
5. **Keyword fallback** — If no semantic results, falls back to `ILIKE` keyword search on title and content

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `query` | required | Search query text |
| `category` | null | Optional category filter |
| `matchCount` | 5 | Maximum results to return |
| `threshold` | 0.6 | Minimum similarity score (0–1) |

### Output

```javascript
[
  {
    articleId: "uuid",
    title: "How to Create a Campaign",
    snippet: "Creating a successful campaign starts with...",
    score: 0.845,
    category: "guide"
  }
]
```

## Keyword Fallback Search

When semantic search yields no results (e.g. embeddings not yet created), the engine falls back to keyword-based search:

1. Split query into keywords (words > 2 characters)
2. Build OR filter: `title.ilike.%keyword% OR content.ilike.%keyword%`
3. Apply category filter if specified
4. Return results with approximate relevance score of 0.4

## Multi-Source Context Building

### `getRelevantContext({ query, entityTypes, maxTokens })`

Retrieves relevant context from multiple sources for AI prompt construction. This is used by the copilot engine to build context-rich prompts.

### Source Types

| Entity Type | Search Method | Max Results |
|-------------|--------------|-------------|
| `knowledge_article` | `searchKnowledge()` | 5 articles |
| `campaign` | Keyword search on `campaigns` table | 3 campaigns |
| `creator` | Keyword search on `creators` table | 3 creators |

### Token Budget Management

- Approximates 4 characters per token
- Stops adding context when the token budget is exhausted
- Each source type is searched independently and concatenated
- Sources are tagged with type headers: `[Knowledge: Title]`, `[Campaign: Title]`, `[Creator: Name]`

### Output

```javascript
{
  contextString: "[Knowledge: Guide]\nCreating a campaign...\n\n[Campaign: My Project]\nHelp us build...",
  sources: [
    { type: "knowledge_article", id: "uuid", relevance: 0.845 },
    { type: "campaign", id: "uuid", relevance: 0.5 }
  ]
}
```

## Article Management

### `manageKnowledgeArticle(articleId, action, performedBy, updates)`

Full lifecycle management for knowledge articles.

| Action | Description |
|--------|-------------|
| `update` | Updates article metadata. If content changes, deletes old embeddings and re-embeds all chunks |
| `delete` | Removes the article and all associated embeddings from `ai_embeddings` |
| `archive` | Sets article status to "archived" (soft delete — removed from search but preserved) |

### Update Flow (with content change)

1. Update article record in `knowledge_articles`
2. Delete all embeddings where `entity_type = "knowledge_article"` and `entity_id = articleId`
3. Re-chunk the new content
4. Create new embeddings for each chunk
5. Audit log the update

### Delete Flow

1. Delete all embeddings for the article
2. Delete the article record from `knowledge_articles`
3. Audit log the deletion

All lifecycle operations produce audit events:
- `knowledge.article_indexed` — On initial indexing
- `knowledge.article_update` — On update
- `knowledge.article_delete` — On deletion
- `knowledge.article_archive` — On archival

## Storage

| Table | Purpose |
|-------|---------|
| `knowledge_articles` | Article metadata (title, content, category, tags, status) |
| `ai_embeddings` | Vector embeddings linked to articles by `entity_type = "knowledge_article"` |

## Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_CHUNK_SIZE` | 500 | Characters per embedding chunk |
| `DEFAULT_CHUNK_OVERLAP` | 50 | Overlap between chunks |
| `DEFAULT_SEARCH_MATCH_COUNT` | 5 | Default max search results |
| `DEFAULT_SEARCH_THRESHOLD` | 0.6 | Minimum similarity for semantic search |
| `MAX_CONTENT_LENGTH` | 500,000 | Maximum article content size |
| `DEFAULT_MAX_TOKENS` | 2,000 | Token budget for context retrieval |
