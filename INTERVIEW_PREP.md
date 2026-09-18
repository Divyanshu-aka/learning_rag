# 🧠 RAG Notebook — Infosys Specialist Engineer Interview Prep

> **Project:** `learning_rag` — An AI-powered document Q&A chatbot (like Google NotebookLM)  
> **Role:** Specialist Engineer  
> **Stack:** Next.js 15 · LangChain · Google Gemini · Qdrant · Docker · TailwindCSS

---

## 📋 Table of Contents
1. [What is this App?](#1-what-is-this-app)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Concept: RAG (Retrieval-Augmented Generation)](#3-core-concept-rag)
4. [Tech Stack — Every Tool & Why](#4-tech-stack--every-tool--why)
5. [API Routes Deep Dive](#5-api-routes-deep-dive)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Data Flow — End to End](#7-data-flow--end-to-end)
8. [Key Design Decisions (Why Not That?)](#8-key-design-decisions-why-not-that)
9. [Scalability & Future Improvements](#9-scalability--future-improvements)
10. [Likely Interview Questions & Answers](#10-likely-interview-questions--answers)

---

## 1. What is this App?

**RAG Notebook** is a full-stack AI application that lets users upload sources (PDFs, websites, YouTube videos) and then **chat with those documents** using natural language. The AI answers strictly based on what's in your document, but can optionally expand with general knowledge.

Think of it as a personal **Google NotebookLM clone** but open-source and self-hostable.

**Core user flows:**
- Upload a PDF → it gets chunked, embedded, indexed → ask questions → AI retrieves relevant chunks → generates a grounded answer
- Paste a website URL → content scraped, embedded, indexed → chat with it
- Paste a YouTube link → transcript extracted with timestamps → chat with video content (with timestamp references)

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    Browser (React 19)                  │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  TopBar  │  │ FileUpload  │  │  ChatInterface   │  │
│  └──────────┘  └─────────────┘  └──────────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │  Next.js API Routes (App Router)
┌────────────────────────▼───────────────────────────────┐
│              Next.js 15 Server (Node.js)                │
│                                                         │
│  /api/files/upload     → saves PDF to os.tmpdir()      │
│  /api/files/indexing   → PDFLoader → chunk → embed     │
│  /api/files/url        → Cheerio scrape → chunk → embed│
│  /api/files/youtube    → fetch transcript → embed      │
│  /api/files/chat       → retrieve chunks → LLM answer  │
│  /api/files/delete     → delete Qdrant collection      │
└──────────┬───────────────────────┬─────────────────────┘
           │                       │
┌──────────▼──────┐     ┌──────────▼──────────────────┐
│  Google Gemini  │     │   Qdrant Vector Database     │
│  (Embedding +   │     │   (Docker container, local   │
│   Generation)   │     │    or Qdrant Cloud)          │
└─────────────────┘     └─────────────────────────────┘
```

---

## 3. Core Concept: RAG

**RAG = Retrieval-Augmented Generation**

It's a design pattern that **grounds LLM responses in your own documents** rather than relying purely on training data.

### Why RAG over fine-tuning?
| Aspect | RAG | Fine-tuning |
|---|---|---|
| Cost | Low (API calls) | Very high (GPU training) |
| Update freshness | Real-time (just re-index) | Requires re-training |
| Hallucination control | Better (grounded in doc) | Worse (model memorizes) |
| Document-specific Q&A | Excellent | Overkill |

### RAG Pipeline (3 phases):

**Phase 1 — Indexing (one time per document)**
```
Document → Load → Split into Chunks → Embed each Chunk → Store in Vector DB
```

**Phase 2 — Retrieval (per user query)**
```
User Query → Embed Query → Cosine Similarity Search → Top-K Chunks retrieved
```

**Phase 3 — Generation**
```
Retrieved Chunks + User Query + System Prompt → LLM → Grounded Answer
```

### What is a Vector Embedding?
A high-dimensional numerical representation of text that captures *semantic meaning*. Two semantically similar sentences will have vectors that are close to each other in vector space (low cosine distance), even if they use different words.

Example:
- "What is the deadline?" → vector A
- "When is it due?" → vector B
- Cosine similarity(A, B) ≈ 0.95 → very similar → retrieved together

---

## 4. Tech Stack — Every Tool & Why

### 🏗️ Framework: Next.js 15

**What:** React framework with file-based routing, server-side rendering, and built-in API routes.

**Why Next.js?**
- **Full-stack in one project** — no need for a separate Express/FastAPI backend. API routes live in `app/api/`. This makes the project simpler and deployment trivial.
- **App Router** (new in Next.js 13+) allows server components + client components cleanly separated. API routes become `route.js` files inside the `app/` directory.
- **Turbopack** (the new Rust-based bundler) is used in dev: `next dev --turbopack` — 10× faster HMR (Hot Module Replacement) than Webpack.
- **Server Components** handle data fetching without client-side JS bloat.

**Why not Express.js?**
- You'd need a separate server, separate repo, CORS configuration, and more DevOps overhead.

**Why not Vite + React?**
- Vite is frontend-only. You'd still need a backend for the AI/Qdrant calls. Next.js combines both.

**Version:** 15.5.9 (latest stable with App Router)

---

### ⚛️ Frontend: React 19

**What:** UI library for building component-based interfaces.

**Why React 19?**
- Latest version with React Compiler optimizations (automatic memoization).
- `'use client'` directive explicitly marks components as client-side (important in App Router where everything is server-rendered by default).
- Used `useState`, `useRef`, `useEffect`, `useCallback` — the core hooks for state, DOM refs, side effects, and memoized handlers.

**Key React patterns used:**
- **Lifting state up**: `uploadedFiles` and `selectedFile` are managed in `page.jsx` and passed down via props to `FileUpload`, `TopBar` — single source of truth.
- **Controlled components**: `inputValue`, `urlInput`, `youtubeInput` are all controlled via state.
- **useCallback**: `handleDragOver`, `handleDragLeave`, `handleDrop` are wrapped in `useCallback` to prevent re-renders since they are passed as props to drag handlers.

---

### 🎨 Styling: Tailwind CSS v4

**What:** Utility-first CSS framework.

**Why Tailwind?**
- No need to write separate `.css` files — styles are applied directly in JSX via class names.
- Eliminates unused CSS automatically (PurgeCSS built-in).
- Consistent design system — spacing, color, border-radius all follow the same scale.
- Dark mode UI is very natural with Tailwind's `bg-gray-700`, `text-gray-400` etc.

**Version:** v4 (major rewrite — CSS-first configuration, no more `tailwind.config.js` required for basic setups).

**Why not plain CSS / SCSS?**
- More boilerplate, naming conflicts (BEM), harder to maintain as component library grows.

**Why not MUI / Chakra UI?**
- Heavier bundle, opinionated look, harder to customize. Tailwind gives full creative control.

---

### 🦜 LangChain (JS)

**What:** Framework for building LLM-powered applications. Provides abstractions for: document loaders, text splitters, vector stores, retrievers, chains, and agents.

**Packages used:**
| Package | Purpose |
|---|---|
| `@langchain/core` | Base abstractions (`Document`, `Runnable`) |
| `@langchain/community` | `PDFLoader`, `CheerioWebBaseLoader` |
| `@langchain/google-genai` | `GoogleGenerativeAIEmbeddings` |
| `@langchain/qdrant` | `QdrantVectorStore` integration |
| `@langchain/openai` | (Installed, not actively used) |

**Why LangChain?**
- Provides a uniform interface across different embedding models, vector stores, and LLMs.
- If you want to swap Qdrant for Pinecone, or Gemini for OpenAI — **just change 1-2 lines**.
- Built-in `RecursiveCharacterTextSplitter`, `PDFLoader`, `CheerioWebBaseLoader` save hundreds of lines of custom code.

**Why not raw API calls?**
- You'd need to manually handle document loading, chunking, batch embedding, metadata management, vector DB integration — LangChain does all this.

---

### 🤖 AI: Google Gemini

**Two separate SDK packages used (both):**

#### `@google/genai` (v1.16.0) — used in `chat/route.js`
- New unified Google AI SDK (replaces the older one).
- Used to call `gemini-3.6-flash` for text generation.
- `ai.models.generateContent()` with `contents` array for multi-turn conversations.

#### `@langchain/google-genai` — used in all indexing/retrieval routes
- LangChain's wrapper around Google's embedding API.
- `GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-001" })` to embed document chunks.

**Model choices:**

| Model | Usage | Reason |
|---|---|---|
| `gemini-embedding-001` | Embedding chunks + queries | State-of-the-art text embedding, 768-dim vectors, multi-lingual |
| `gemini-3.6-flash` | Chat generation | Fast, cheap, 1M context window — ideal for chatbot use-case |

**Why Google Gemini over OpenAI?**
- `openai` SDK is installed but not actively used.
- Gemini has **free tier** (important for a learning project), larger context window, and `gemini-embedding-001` is top-ranked on MTEB (Massive Text Embedding Benchmark).
- Gemini Flash is significantly cheaper than GPT-4o for generation.

**Why not local models (Ollama/LLaMA)?**
- Requires GPU hardware. Cloud APIs are simpler for development and demos.

---

### 🗄️ Vector Database: Qdrant

**What:** Open-source, high-performance vector similarity search engine.

**Two integration methods used:**

1. **`@langchain/qdrant`** (`QdrantVectorStore`) — for indexing documents and similarity search via LangChain abstraction.
2. **`@qdrant/js-client-rest`** (`QdrantClient`) — for direct REST API calls (used in `delete/route.js` to delete an entire collection).

**Why Qdrant?**
- **Open-source** and self-hostable — no vendor lock-in, no cost.
- **Performant**: written in Rust, supports HNSW (Hierarchical Navigable Small World) index — approximate nearest neighbor (ANN) search in milliseconds even on millions of vectors.
- **Per-document collections** strategy: each uploaded file gets its own Qdrant *collection* (named after the file). This makes deletion trivial (`deleteCollection`) and prevents cross-document contamination.
- **Docker-ready** — `docker-compose.yml` spins up Qdrant in one command.
- Supports filtering, payloads (metadata), and multiple vector types.

**Why not Pinecone?**
- Pinecone is managed but has cost and free tier limits. Qdrant is fully self-hosted.

**Why not pgvector (PostgreSQL extension)?**
- Qdrant is purpose-built for vectors — better performance, richer query capabilities, no SQL overhead.

**Why not FAISS (Facebook AI Similarity Search)?**
- FAISS is in-memory, no persistence, no REST API, no metadata filtering. Qdrant is production-grade.

**HNSW explained:** A graph-based data structure where nodes are vectors. Search traverses the graph from a coarse top layer to fine layers, visiting only a small fraction of vectors. This gives O(log N) search instead of O(N) for brute force.

---

### 🐳 Docker + Docker Compose

**What:** Containerizes the Qdrant vector DB for local development.

```yaml
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - 6333:6333
```

**Why Docker for Qdrant?**
- Qdrant has no native Windows binary — Docker makes it cross-platform.
- Reproducible environment — no manual installation, no dependency conflicts.
- In production, this would be replaced by Qdrant Cloud or a managed K8s deployment.

**Port 6333** is Qdrant's HTTP REST API port (also has gRPC on 6334).

---

### 📄 PDF Processing: `pdf-parse` + LangChain PDFLoader

**What:** `PDFLoader` from `@langchain/community` (which internally uses `pdf-parse`) extracts text content page-by-page from PDF files.

**Why `pdf-parse`?**
- Lightweight, pure JavaScript PDF text extraction.
- No external binaries required (unlike `pdftotext`, `poppler`).
- Preserves page metadata, which is used to show "Page X" citations.

**Flow:**
```
.pdf file → PDFLoader.load() → Array<Document> (one per page)
         → RecursiveCharacterTextSplitter → smaller chunks with metadata
```

**Why not read raw bytes?**
- PDF is a binary format with complex structure (fonts, encodings, XObjects). Direct parsing is non-trivial. `pdf-parse` handles this.

---

### ✂️ Text Splitting: `RecursiveCharacterTextSplitter`

**What:** Splits large text into smaller overlapping chunks suitable for embedding.

**Configuration used:**
| Source | `chunkSize` | `chunkOverlap` | Reason |
|---|---|---|---|
| PDF | 1500 chars | 300 chars | Moderate — PDFs have dense structured text |
| Website | 2000 chars | 400 chars | Larger — web content has more context needed |
| YouTube | 1500 chars | 200 chars | Already pre-chunked by timestamp windows |

**Why overlap?**
- If a sentence spans across two chunks, you'd lose context at boundaries. Overlap (300 chars = ~50-75 words) ensures the boundary content appears in both adjacent chunks — so retrieval doesn't miss it.

**Why `RecursiveCharacterTextSplitter` over `CharacterTextSplitter`?**
- Recursive version tries to split on `\n\n`, then `\n`, then `.`, then ` `, then characters — preserving semantic units (paragraphs, sentences) rather than splitting mid-word.

---

### 🌐 Web Scraping: Cheerio (`cheerio` + LangChain `CheerioWebBaseLoader`)

**What:** Server-side jQuery-like HTML parsing library. Used to extract meaningful text content from web pages.

**Smart selector cascade used:**
```js
const smartSelectors = ["article", "main", ".content", ".post-content", "#content"];
// Falls back to "body" if none found with >200 chars
```

**Why this approach?**
- Avoids scraping navbars, footers, cookie banners, ads — only extracts the main content.
- Reduces noise in the vector store → better retrieval quality.

**Why Cheerio over Puppeteer?**
- Cheerio is pure HTML parsing (no JavaScript execution) — very fast, no browser overhead.
- Puppeteer is needed only for JavaScript-heavy SPAs. Most documentation/blog pages serve static HTML.
- Lower memory footprint and no browser dependency.

---

### 📺 YouTube Transcripts: `youtube-transcript`

**What:** NPM package that fetches auto-generated or manual captions from YouTube using the video ID.

**Why not YouTube Data API v3?**
- Requires API key, OAuth for some content, has quota limits.
- `youtube-transcript` directly fetches the caption XML from YouTube's timedtext endpoint — simpler, no API key needed.

**Custom timestamp handling:**
```js
// Each transcript segment has: { text, offset (ms), duration (ms) }
// Grouped into 1500-char windows preserving start timestamp
metadata: {
  timestamp: "05:23",
  youtubeUrl: "https://youtube.com/watch?v=XYZ&t=323s"
}
```

This enables the AI to respond with timestamp citations like `[05:23]`.

---

### 🔁 Multipart Form Upload: Native Next.js FormData

**What:** The upload route uses the native `request.formData()` API (Node.js + Next.js built-in).

**File storage:** `os.tmpdir()` — OS temporary directory (e.g. `C:\Users\divya\AppData\Local\Temp\uploads\` on Windows).

**Why `os.tmpdir()` not a permanent `uploads/` folder?**
- Next.js App Router runs serverlessly — there's no guaranteed persistent filesystem.
- On Vercel/cloud deploys, `/tmp` is the only writable directory.
- Files are only needed temporarily (index → delete). Qdrant stores the vectors permanently.

**Why not Multer?**
- `multer` is installed but the actual upload route uses native FormData — Next.js 14+ handles multipart natively without middleware.

---

### 🔢 Axios

**What:** Promise-based HTTP client.

**Why installed?**
- Available for any custom HTTP calls. The YouTube transcript library and web scraping are handled via LangChain/native fetch, but `axios` is available as a utility for advanced HTTP needs.

---

### 📝 Markdown Rendering: `react-markdown` + `remark-gfm` + `rehype-raw`

**What:** Renders LLM-generated markdown responses as formatted HTML in the chat.

**Why?**
- LLMs generate markdown by default (`**bold**`, `## headings`, ` ```code``` `).
- Plain text rendering would show raw markdown syntax — terrible UX.
- `remark-gfm` adds GitHub Flavored Markdown support (tables, strikethrough, task lists).
- `rehype-raw` allows raw HTML in markdown (for safety-controlled cases).

---

### 🎨 Syntax Highlighting: `react-syntax-highlighter`

**What:** Highlights code blocks in AI responses with language-specific coloring.

**Theme used:** `vscDarkPlus` (VSCode dark theme).

**Custom `CodeBlock` component features:**
- Displays the programming language label
- "Copy to clipboard" button with 2-second "Copied!" feedback
- Line numbers via `showLineNumbers={true}`

---

### 🌍 Environment Config: `dotenv`

**What:** Loads `.env` file variables into `process.env`.

**Variables used:**
```env
GOOGLE_AI_API_KEY=...     # Gemini embedding + generation
QDRANT_URL=http://localhost:6333  # Qdrant REST endpoint
QDRANT_API_KEY=...        # Empty for local Docker, needed for Qdrant Cloud
```

**Why dotenv in Next.js?**
- Next.js has built-in `.env.local` support for client-side variables (prefixed `NEXT_PUBLIC_`).
- Server-side API routes can use `dotenv` or Next.js's built-in env loading interchangeably.
- `import "dotenv/config"` at the top of each API route explicitly loads the `.env` file.

---

### 🔍 Code Quality: ESLint v9

**Config:** `eslint.config.mjs` with `eslint-config-next` for Next.js-specific rules.

**Why ESLint?**
- Catches common bugs (undefined variables, unused imports).
- `eslint-config-next` includes React Hooks rules (enforces hook dependencies).

---

### 🖋️ Fonts: Geist (via `next/font`)

**What:** Vercel's open-source font optimized for code and UI. Loaded via `next/font/google`.

**Why `next/font`?**
- Fonts are self-hosted automatically — no external network request to Google Fonts at runtime.
- Zero layout shift (CLS = 0) because font metrics are inlined.
- `Geist` + `Geist_Mono` via CSS variables `--font-geist-sans` and `--font-geist-mono`.

---

## 5. API Routes Deep Dive

### App Router API Route Pattern
All routes follow the Next.js App Router convention: `app/api/[path]/route.js` with named exports `GET`, `POST`, `DELETE`, etc.

```
app/api/files/
├── upload/route.js     POST  — receives PDF, saves to /tmp
├── indexing/route.js   POST  — loads PDF, chunks, embeds, stores in Qdrant
├── url/route.js        POST  — scrapes website, chunks, embeds, stores in Qdrant
├── youtube/route.js    POST  — fetches transcript, chunks, embeds, stores in Qdrant
├── chat/route.js       POST  — retrieves relevant chunks, calls Gemini, returns answer
└── delete/route.js     DELETE — deletes entire Qdrant collection
```

### `/api/files/upload` — PDF Upload
- Reads `multipart/form-data` request
- Generates unique filename: `Date.now() + "-" + original_name` (prevents collisions)
- Saves to `os.tmpdir()/uploads/`
- Returns `{ filename, filepath, size, type }`

### `/api/files/indexing` — PDF Indexing
1. `PDFLoader(filepath).load()` — Array of Documents (1 per page)
2. `RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 300 })` — splits into chunks
3. Metadata enrichment: `{ type: "pdf", source: filename, loc.pageNumber }`
4. `GoogleGenerativeAIEmbeddings` — embeds all chunks
5. `QdrantVectorStore.fromDocuments()` — stores vectors in Qdrant collection named after file

### `/api/files/url` — Website Indexing
1. Validates URL format
2. Smart selector cascade: `article → main → .content → body`
3. Enriches metadata: `{ source: url, pageTitle, type: "website" }`
4. Chunks with larger `chunkSize: 2000`
5. Collection name derived from URL: `url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50)`

### `/api/files/youtube` — YouTube Indexing
1. Extracts video ID using regex patterns (handles `youtube.com/watch?v=`, `youtu.be/`, `embed/`)
2. `YoutubeTranscript.fetchTranscript(videoId)` — returns `{ text, offset (ms), duration }`
3. Groups segments into 1500-char timestamp windows preserving `startTime`
4. Creates `Document` objects with rich metadata: `{ timestamp, youtubeUrl, videoId }`
5. Secondary split with `RecursiveCharacterTextSplitter`
6. Collection name: `youtube_${videoId}`

### `/api/files/chat` — RAG Chat
The most sophisticated route:

**Step 1 — Intent Detection:**
```js
function detectIntent(query) {
  // "summarize" | "explain" | "recommend" | "factual"
}
```
Uses regex to detect user intent, which controls:
- **Temperature**: `factual → 0.2` (precise), `augmented → 0.6` (creative)
- **System prompt mode**: DOCUMENT-ONLY vs AUGMENTED

**Step 2 — Vector Retrieval:**
```js
const vectorSearcher = vectorStore.asRetriever({ k: 15 });
const relevantChunk = await vectorSearcher.invoke(userQuery);
```
Retrieves top-15 semantically similar chunks via cosine similarity.

**Step 3 — Context Formatting:**
- PDF: `[1] Page 3:\n<content>`
- YouTube: `[1] @05:23 (youtube.com/...&t=323s):\n<content>`
- Website: `[1] Site Title — https://...:\n<content>`

**Step 4 — Dynamic System Prompt:**
Built based on `sourceType` × `intent` combination:
- YouTube: mentions timestamps format `[MM:SS]`
- Website: cite URL
- PDF: cite page number
- Augmented mode: splits response into "📚 From the Document" + "🌐 Additional Context"

**Step 5 — Multi-turn Conversation:**
```js
conversationHistory.slice(-6)  // Last 6 messages = 3 user-assistant pairs
```
Passed as `historyMessages` in the `contents` array so the model maintains conversational context.

**Step 6 — Generation:**
`gemini-3.6-flash` with `maxOutputTokens: 8192`.

### `/api/files/delete` — Cleanup
```js
await client.deleteCollection(filename);
```
Deletes the entire Qdrant collection (all vectors for that document). Clean approach — no orphaned data.

---

## 6. Frontend Architecture

### Component Tree
```
RootLayout (layout.jsx)
└── Home (page.jsx) — all state lives here
    ├── TopBar.jsx — static header, New Notebook button
    ├── aside (Sources Panel) — file list, select active source
    ├── section (Chat Panel) — messages, input
    └── FileUpload.jsx (modal) — tabbed: PDF / URL / YouTube
        └── MarkdownMessage.jsx — renders AI responses
```

### State Management (No Redux/Zustand)
All state in `page.jsx`:
| State | Type | Purpose |
|---|---|---|
| `messages` | `Array<{role, content}>` | Chat history |
| `inputValue` | `string` | Textarea input |
| `isLoading` | `boolean` | Loading spinner |
| `uploadedFiles` | `Array<FileInfo>` | Uploaded sources sidebar |
| `selectedFile` | `FileInfo \| null` | Currently active source for chat |
| `showUpload` | `boolean` | Upload modal visibility |

**Why no global state manager?**
- The app is a single-page with straightforward state. Prop drilling is 2 levels deep at most. Redux would be over-engineering.

### FileUpload Component
- **Modal** with backdrop: `fixed inset-0 bg-black/70 z-50`
- **3 tabs**: PDF / Website / YouTube — renders different input UI per tab
- **Drag & drop**: `onDragOver`, `onDragLeave`, `onDrop` with visual feedback (`border-blue-400 bg-blue-500/10`)
- **2-step upload for PDFs**: Upload (50%) → Index (100%) — provides progress feedback
- **Auto-close on success** via `onClose()` callback

### MarkdownMessage Component
Custom renderer for all markdown elements:
- `code` → `CodeBlock` with syntax highlighting + copy button
- `p, h1-h3, ul, ol, li` → themed typography
- `a` → opens in new tab with `rel="noopener noreferrer"` (security)
- `table` → responsive overflow-x-auto container
- `blockquote` → blue left border accent

---

## 7. Data Flow — End to End

### PDF Upload Flow
```
1. User drops PDF on FileUpload component
2. POST /api/files/upload
   → Saves to /tmp/uploads/1234567890-resume.pdf
   → Returns { filename: "1234567890-resume.pdf", filepath: "/tmp/..." }
3. POST /api/files/indexing
   → PDFLoader loads /tmp/.../1234567890-resume.pdf → 5 page Documents
   → RecursiveCharacterTextSplitter → 23 chunks
   → Gemini embeds each chunk → 23 vectors (768-dim each)
   → QdrantVectorStore stores in collection "1234567890-resume.pdf"
4. UI shows file in sidebar with green dot (indexed)
```

### Chat Flow
```
1. User types "What are Divyanshu's skills?"
2. selectedFile.serverFilename = "1234567890-resume.pdf"
3. POST /api/files/chat { userQuery, collectionName, sourceType: "pdf" }
4. detectIntent → "factual" (no explain/recommend keywords)
5. Embed query with gemini-embedding-001 → 768-dim vector
6. Qdrant similarity search → Top 15 chunks retrieved
7. Format context: "[1] Page 2:\n..."
8. Build system prompt (DOCUMENT-ONLY mode, cite page numbers)
9. gemini-3.6-flash generates response (temperature 0.2)
10. { result: "Divyanshu has skills in..." } → rendered as markdown
```

### Delete Flow
```
1. User clicks × on a file in the sidebar
2. DELETE /api/files/delete { filename: "1234567890-resume.pdf" }
3. QdrantClient.deleteCollection("1234567890-resume.pdf")
4. Entire collection (vectors + metadata) removed from Qdrant
5. File removed from React state
```

---

## 8. Key Design Decisions (Why Not That?)

### Why one Qdrant collection per file, not one global collection?
- **Isolation**: Each file's vectors are completely separate — no cross-document contamination.
- **Deletion**: Just `deleteCollection(filename)` — no need to filter and delete individual vectors.
- **Retrieval clarity**: `k=15` chunks from a single document is always the same document's content.
- **Alternative**: Store all in one collection with a `filename` metadata filter. But this complicates deletion (need to batch-delete by filter) and risks cross-contamination if the retriever doesn't filter properly.

### Why `gemini-3.6-flash` and not `gemini-pro` or `gpt-4o`?
- **Speed**: Flash is 2-3× faster than Pro, critical for chat UX.
- **Cost**: Flash is ~10× cheaper than Pro-level models.
- **Quality**: For RAG (where context is provided), Flash is sufficient — the context does the heavy lifting, not the model's parametric knowledge.
- **GPT-4o**: Would require OpenAI API key + higher cost. `@langchain/openai` is installed but not used.

### Why `gemini-embedding-001` and not `text-embedding-3-small` (OpenAI)?
- Top-ranked on MTEB benchmark for text retrieval tasks.
- Free tier available.
- Native integration with `@langchain/google-genai`.

### Why `k=15` chunks retrieved instead of `k=5`?
- More context → better answers for long-form queries.
- LLMs (especially Flash with 1M context) can handle large context windows easily.
- Tradeoff: More tokens per request → slightly higher cost + latency. Acceptable for this use case.

### Why intent detection with regex instead of a classifier?
- Simple, deterministic, zero-latency (no extra LLM call).
- 4 intents (summarize/explain/recommend/factual) are sufficient for document Q&A.
- A full-intent classifier would add ~500ms per request. Regex is instant.
- **Improvement**: Could use an LLM call for more nuanced intent detection.

### Why conversation history limited to last 6 messages?
- LLMs have context window limits and latency/cost scales with input length.
- 6 messages = 3 full Q&A turns — adequate for conversational continuity.
- Older history is typically less relevant for the current question.

### Why `os.tmpdir()` for uploads instead of a permanent folder?
- Serverless compatibility (Vercel's file system is ephemeral).
- Files are temp artifacts — only needed until indexed into Qdrant.
- Auto-cleaned by the OS.

### Why Cheerio over Puppeteer for web scraping?
- Cheerio: ~50ms, no memory overhead, works for static HTML pages.
- Puppeteer: ~2-3s startup, 100MB+ RAM for headless Chrome.
- For documentation pages, blogs, Wikipedia — static HTML is sufficient.

---

## 9. Scalability & Future Improvements

### Current Limitations
| Issue | Impact | Solution |
|---|---|---|
| Auth page is empty | No user authentication | Add NextAuth.js / Clerk |
| State in React memory only | Refresh loses all files | Add database (PostgreSQL + Prisma) |
| Single user | No multi-tenancy | User-scoped Qdrant collections |
| Temp file storage | Files deleted on OS restart | S3/GCS for PDF storage |
| No streaming responses | Wait for full answer | Use Gemini streaming + SSE |
| Only 1 source active at a time | Can't cross-query | Multi-collection retrieval |

### Scalability Improvements

**Short-term:**
1. **Authentication**: NextAuth.js with Google OAuth — the `app/auth/` folder is already scaffolded.
2. **Streaming**: Switch to `ai.models.generateContentStream()` + Next.js `ReadableStream` response — eliminates waiting.
3. **Persistence**: Store file metadata in PostgreSQL (`filename`, `userId`, `collectionName`, `createdAt`).

**Medium-term:**
4. **Multi-file chat**: Merge retrieval from multiple Qdrant collections. Merge top-K from each.
5. **Reranking**: After retrieving 15 chunks, use a cross-encoder reranker to pick the best 5.
6. **HyDE (Hypothetical Document Embeddings)**: Generate a hypothetical answer to the query → embed that → use it for retrieval. Reduces the query-document embedding gap.
7. **Chunking improvements**: Sentence-level chunking (instead of character count) for better semantic boundaries.

**Long-term:**
8. **Multi-modal**: Add image extraction from PDFs (using `pdfjs-dist`) for chart/diagram understanding.
9. **Qdrant Cloud**: Replace local Docker with Qdrant Cloud for production reliability.
10. **Cache layer**: Redis for embedding cache — same chunk re-embedded unnecessarily.
11. **Kubernetes**: Containerize Next.js app itself + Qdrant in K8s for horizontal scaling.
12. **Agent loop**: Convert to a LangGraph agent that can: query the doc, do web search, compare results.

### Scaling numbers (rough estimates)
- Qdrant on a single node handles ~100M vectors comfortably.
- `gemini-embedding-001` API: 100 RPM on free tier, 1500 RPM on paid.
- Gemini Flash: 15 RPM free, 1000 RPM paid.
- For 1000 concurrent users → need Qdrant cluster + load balancer + rate limiting.

---

## 10. Likely Interview Questions & Answers

### Q: What is RAG and why did you use it?
**A:** RAG stands for Retrieval-Augmented Generation. Instead of relying solely on the LLM's training data, RAG retrieves relevant context from your own documents at query time and provides it to the LLM as part of the prompt. I used it because: (1) it grounds answers in the user's specific document — reducing hallucinations, (2) it's far cheaper than fine-tuning, (3) documents can be updated without retraining the model.

### Q: How does vector similarity search work?
**A:** Text is converted to a high-dimensional vector (embedding) that captures semantic meaning. Similar texts produce vectors that are geometrically close. At query time, the user's query is embedded, and we search the vector DB for the `k` nearest stored vectors using cosine similarity. Qdrant uses HNSW — a graph-based approximate nearest neighbor algorithm — for millisecond search even over millions of vectors.

### Q: What is HNSW?
**A:** Hierarchical Navigable Small World. It's a multi-layer graph where: the top layer has coarse long-range connections (few nodes), each layer below adds more nodes with shorter connections, and the bottom layer contains all vectors. Search starts at the top, greedily navigates to nearest neighbors, then descends to finer layers. This gives O(log N) search complexity — much faster than brute-force O(N).

### Q: Why Qdrant over Pinecone, Weaviate, or pgvector?
**A:** Qdrant is open-source, written in Rust (fast), self-hostable (no vendor lock-in/cost), has rich payload filtering, and Docker-friendly. Pinecone is managed but has cost. pgvector adds vectors to PostgreSQL — good if you already use Postgres but not purpose-built for vectors. Weaviate is more complex to set up. For a learning project prioritizing open-source and self-hosting, Qdrant was the best fit.

### Q: Why Next.js over separate React + Express?
**A:** Next.js unifies frontend and backend. API routes (`app/api/`) eliminate the need for a separate server, CORS config, and deployment complexity. The App Router enables server components for performance and easy API route creation. Turbopack gives much faster dev experience.

### Q: What is chunking and why is overlap important?
**A:** Chunking splits large documents into smaller pieces for embedding. Models have token limits, so you can't embed an entire document as one vector. Overlap (e.g., 300 chars) ensures that content at chunk boundaries appears in both adjacent chunks — so if a key sentence is split across chunks, retrieval still finds it.

### Q: How did you handle different source types (PDF/YouTube/Website)?
**A:** Each source type has a dedicated API route. PDFs use `PDFLoader` + file system. YouTube uses `youtube-transcript` to fetch captions with timestamps and groups them into windows preserving the start time. Websites use `CheerioWebBaseLoader` with smart CSS selectors to extract only main content. All three routes produce LangChain `Document` objects with rich metadata, which are then uniformly embedded and stored in Qdrant.

### Q: How does the intent detection work?
**A:** A simple regex-based classifier checks the user's query for keywords: `summarize/overview/recap` → "summarize", `explain/how does/steps to` → "explain", `recommend/improve/best practice` → "recommend", default → "factual". Intent controls the system prompt (DOCUMENT-ONLY vs AUGMENTED mode) and the generation temperature (0.2 for factual, 0.6 for augmented).

### Q: What security considerations did you have?
**A:** (1) File type validation — only PDFs accepted (`file.type !== 'application/pdf'`). (2) URL validation via `new URL(url)`. (3) Links in markdown use `rel="noopener noreferrer"` to prevent tab-napping. (4) Environment variables for API keys (not hardcoded). (5) File size limit (10MB shown in UI). **Gaps**: No auth, no rate limiting, no SSRF protection for URL scraping — would need to be added before production.

### Q: How would you add authentication?
**A:** The `app/auth/` folder is already scaffolded. I'd implement NextAuth.js with Google/GitHub OAuth. Each user would have a `userId`. Qdrant collections would be prefixed with `userId_filename` to isolate data. JWT tokens would protect API routes using Next.js middleware (`middleware.js`).

### Q: How would you add streaming responses?
**A:** Replace `generateContent` with `generateContentStream()` from `@google/genai`. The API route would return a `ReadableStream` using `new Response(stream)`. On the frontend, use `response.body.getReader()` to read chunks and update the message state incrementally — giving a ChatGPT-style streaming effect.

### Q: What is the `'use client'` directive?
**A:** In Next.js App Router, all components are Server Components by default (rendered on the server, no client-side JS). `'use client'` marks a component as a Client Component — it runs in the browser, can use React hooks (`useState`, `useEffect`), handle events, and access browser APIs. All components in this project that manage state or handle user interactions are marked `'use client'`.

### Q: How does the conversation history work?
**A:** The frontend maintains a `messages` array. When sending a chat request, the last 6 messages are sent as `conversationHistory`. In the API route, these are mapped to Gemini's `contents` format: `[{ role: "user"/"model", parts: [{ text }] }]`. This gives the model memory of recent exchanges without sending the entire history (which would increase tokens/cost).

### Q: What would you change if you had to scale this to 10,000 users?
**A:** (1) Move Qdrant to a managed cluster (Qdrant Cloud with multiple nodes). (2) Add Redis for embedding cache — if the same document chunk is queried repeatedly, serve cached embeddings. (3) Add a job queue (BullMQ + Redis) for document indexing — currently synchronous, would timeout for large PDFs. (4) Add rate limiting (per user, per API key). (5) Use S3 for PDF storage instead of tmpdir. (6) Add authentication and per-user data isolation. (7) Deploy Next.js on Vercel or containerize + Kubernetes.

### Q: What is `RecursiveCharacterTextSplitter` and why is it better?
**A:** It's a text splitter that recursively tries to split on natural boundaries: `\n\n` (paragraphs) → `\n` (lines) → `.` (sentences) → ` ` (words) → characters. It only falls back to a smaller unit if the larger unit doesn't produce chunks small enough. This preserves semantic structure better than `CharacterTextSplitter` (which blindly splits at a character limit, potentially mid-sentence).

### Q: What is `multer` and why is it installed but not used?
**A:** `multer` is a Node.js middleware for handling multipart/form-data (file uploads), typically used with Express.js. It's installed but the Next.js App Router's native `request.formData()` API handles file uploads directly without middleware. The `multer` package is a leftover dependency that could be removed.

---

## Quick Reference Card

| Category | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 15.5.9 |
| **UI Library** | React | 19.1.0 |
| **Styling** | Tailwind CSS | v4 |
| **LLM** | Google Gemini Flash | 3.6 |
| **Embedding Model** | gemini-embedding-001 | - |
| **Vector DB** | Qdrant | latest (Docker) |
| **AI Framework** | LangChain JS | 0.3.x |
| **PDF Parser** | pdf-parse (via LangChain) | 1.1.1 |
| **Web Scraper** | Cheerio | 1.1.2 |
| **YouTube** | youtube-transcript | 1.2.1 |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 |
| **Syntax HL** | react-syntax-highlighter | 16.1.0 |
| **Container** | Docker Compose | - |
| **HTTP Client** | Axios | 1.11.0 |
| **Env Config** | dotenv | 16.4.5 |
| **Linter** | ESLint v9 | 9.x |

---

*Generated for Infosys Specialist Engineer Interview — September 2026*
