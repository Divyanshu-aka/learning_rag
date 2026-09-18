# 🧠 RAG Notebook — Infosys Specialist Engineer Interview Prep
### *Deep Dive Edition — Components, Diagrams, Core Concepts*

> **Project:** `learning_rag` — AI-powered document Q&A (like Google NotebookLM)  
> **Role:** Specialist Engineer  
> **Stack:** Next.js 15 · LangChain · Google Gemini · Qdrant · Docker · TailwindCSS

---

## 📋 Table of Contents
1. [What is this App?](#1-what-is-this-app)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component Map & How They Interact](#3-component-map--how-they-interact)
4. [Core Concept: RAG — Deep Dive](#4-core-concept-rag--deep-dive)
5. [Core Concept: Vector Embeddings — Deep Dive](#5-core-concept-vector-embeddings--deep-dive)
6. [Core Concept: Qdrant & HNSW — Deep Dive](#6-core-concept-qdrant--hnsw--deep-dive)
7. [Core Concept: LangChain Internals](#7-core-concept-langchain-internals)
8. [Core Concept: Chunking Strategy](#8-core-concept-chunking-strategy)
9. [Core Concept: Intent-Aware Prompting](#9-core-concept-intent-aware-prompting)
10. [Sequence Diagrams — All 3 Source Types](#10-sequence-diagrams--all-3-source-types)
11. [Frontend State Machine](#11-frontend-state-machine)
12. [Tech Stack — Every Tool & Why](#12-tech-stack--every-tool--why)
13. [API Routes Deep Dive](#13-api-routes-deep-dive)
14. [Key Design Decisions (Why Not That?)](#14-key-design-decisions-why-not-that)
15. [Scalability & Future Improvements](#15-scalability--future-improvements)
16. [Interview Questions & Answers](#16-interview-questions--answers)

---

## 1. What is this App?

**RAG Notebook** is a full-stack AI application that allows users to upload sources (PDFs, websites, YouTube videos) and **chat with those documents** using natural language. The AI answers are grounded in the uploaded content, not made up.

Think of it as a personal **Google NotebookLM clone** — open-source and self-hostable.

```
USER PERSPECTIVE:
─────────────────────────────────────────────────────────
  📄 Upload PDF / 🌐 Paste URL / ▶️ YouTube link
              ↓
  [Processing... Indexing...]
              ↓
  💬 "What are the main points of chapter 3?"
              ↓
  🤖 AI gives a precise, cited, grounded answer
─────────────────────────────────────────────────────────
```

---

## 2. High-Level Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                        CLIENT LAYER                              ║
║  ┌────────────┐    ┌─────────────────┐    ┌──────────────────┐  ║
║  │  TopBar    │    │  FileUpload     │    │  Chat Interface  │  ║
║  │  .jsx      │    │  .jsx (Modal)   │    │  page.jsx        │  ║
║  └────────────┘    └─────────────────┘    └──────────────────┘  ║
║                            │                       │             ║
║                     fetch() REST calls     fetch() REST calls   ║
╚════════════════════════════╪═══════════════════════╪════════════╝
                             │                       │
╔════════════════════════════▼═══════════════════════▼════════════╗
║                      SERVER LAYER (Next.js API Routes)           ║
║                                                                  ║
║  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────┐  ┌────────┐  ║
║  │ /upload  │  │/indexing │  │ /url  │  │/ytube │  │ /chat  │  ║
║  └────┬─────┘  └────┬─────┘  └───┬───┘  └───┬───┘  └───┬────┘  ║
║       │             │            │           │           │       ║
║  ┌────▼─────────────▼────────────▼───────────▼───────────▼────┐  ║
║  │              LangChain Orchestration Layer                  │  ║
║  │  PDFLoader │ CheerioLoader │ TextSplitter │ VectorStore     │  ║
║  └──────────────────────────┬────────────────────────────────┘  ║
╚═════════════════════════════╪══════════════════════════════════╝
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
╔═════════▼══════╗  ╔═════════▼══════╗  ╔══════════▼══════╗
║  Google Gemini ║  ║    Qdrant      ║  ║  OS Temp Dir    ║
║  ─────────────  ║  ║  ─────────── ║  ║  /tmp/uploads/  ║
║  Embeddings:   ║  ║  Vector DB    ║  ║  (ephemeral PDF  ║
║  gemini-embed  ║  ║  per-doc      ║  ║   storage)       ║
║  -001          ║  ║  collections  ║  ╚═════════════════╝
║                ║  ║               ║
║  Generation:   ║  ║  Port: 6333   ║
║  gemini-3.6-   ║  ║  (Docker)     ║
║  flash         ║  ╚═══════════════╝
╚════════════════╝
```

---

## 3. Component Map & How They Interact

### Component Hierarchy & Props Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  RootLayout (layout.jsx) — Server Component                     │
│  Loads fonts, global CSS, wraps everything                      │
│                                                                 │
│  └─ Home (page.jsx) — 'use client'  ◄── ALL STATE LIVES HERE   │
│     │                                                           │
│     │  STATE:                                                   │
│     │  • messages[]         → chat history                      │
│     │  • uploadedFiles[]    → sidebar file list                 │
│     │  • selectedFile       → active file for chat              │
│     │  • inputValue         → textarea text                     │
│     │  • isLoading          → loading spinner flag              │
│     │  • showUpload         → modal open/close                  │
│     │                                                           │
│     ├─ TopBar.jsx                                               │
│     │  RECEIVES: uploadedFiles, onNewNotebook, onSettingsClick  │
│     │  EMITS: triggers handleNewNotebook() via callback         │
│     │                                                           │
│     ├─ <aside> Sources Panel (inline JSX in page.jsx)           │
│     │  READS: uploadedFiles, selectedFile                       │
│     │  WRITES: setSelectedFile() on file click                  │
│     │  CALLS: handleFileRemoved() on × click                    │
│     │                                                           │
│     ├─ <section> Chat Panel (inline JSX in page.jsx)            │
│     │  READS: messages, isLoading, selectedFile, inputValue     │
│     │  CALLS: handleSendMessage() on button/Enter               │
│     │  RENDERS: MarkdownMessage for assistant messages          │
│     │    └─ MarkdownMessage.jsx                                 │
│     │       RECEIVES: content (markdown string)                 │
│     │       RENDERS: parsed markdown with syntax highlighting   │
│     │         └─ CodeBlock (internal) — copy button             │
│     │                                                           │
│     └─ FileUpload.jsx (Modal)                                   │
│        RECEIVES: onFileUploaded, onFileRemoved,                 │
│                  uploadedFiles, isOpen, onClose                 │
│        MANAGES: isDragOver, isUploading, uploadProgress,        │
│                 activeTab, urlInput, youtubeInput               │
│        CALLS: /api/files/upload → /api/files/indexing (PDF)     │
│               /api/files/url (website)                          │
│               /api/files/youtube (youtube)                      │
│        EMITS: onFileUploaded(fileInfo) to parent                │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Flow Diagram — User Uploads a PDF

```
User           FileUpload.jsx        page.jsx         /api/upload    /api/indexing    Qdrant
 │                   │                  │                  │                │            │
 │  drops PDF        │                  │                  │                │            │
 │──────────────────►│                  │                  │                │            │
 │                   │ handleFileUpload()                   │                │            │
 │                   │─────────────────────────────────────►│               │            │
 │                   │  POST /api/files/upload (FormData)   │               │            │
 │                   │                  │        Save to    │               │            │
 │                   │                  │        /tmp/...   │               │            │
 │                   │◄─────────────────────────────────────│               │            │
 │                   │  {filename, filepath}                │               │            │
 │   progress: 50%   │                  │                  │                │            │
 │◄──────────────────│                  │                  │                │            │
 │                   │─────────────────────────────────────────────────────►│            │
 │                   │  POST /api/files/indexing {filename, filepath}        │            │
 │                   │                  │                  │    PDFLoader   │            │
 │                   │                  │                  │    + Split     │            │
 │                   │                  │                  │    + Embed     │            │
 │                   │                  │                  │────────────────────────────►│
 │                   │                  │                  │   QdrantVectorStore         │
 │                   │                  │                  │   .fromDocuments()          │
 │                   │◄─────────────────────────────────────────────────────│            │
 │                   │  {chunksCount, pagesCount}           │               │            │
 │   progress: 100%  │                  │                  │                │            │
 │◄──────────────────│                  │                  │                │            │
 │                   │ onFileUploaded(fileInfo)             │                │            │
 │                   │─────────────────►│                  │                │            │
 │                   │                  │ setUploadedFiles()│               │            │
 │                   │                  │ setSelectedFile() │               │            │
 │                   │  onClose()        │                  │                │            │
 │                   │◄─────────────────│                  │                │            │
 │  File appears     │                  │                  │                │            │
 │  in sidebar ✅    │                  │                  │                │            │
```

### Interaction Flow Diagram — User Sends a Chat Message

```
User           page.jsx          /api/files/chat      Qdrant         Google Gemini
 │                │                     │                │                 │
 │  types query   │                     │                │                 │
 │  presses Enter │                     │                │                 │
 │───────────────►│                     │                │                 │
 │                │ handleSendMessage()  │                │                 │
 │                │ setMessages([...prev, {role:'user'}]) │                 │
 │                │ setIsLoading(true)   │                │                 │
 │                │─────────────────────►│               │                 │
 │                │  POST /api/files/chat                 │                 │
 │                │  {userQuery, collectionName,          │                 │
 │                │   sourceType, conversationHistory}    │                 │
 │ [loading...]   │                     │  embed query   │                 │
 │◄───────────────│                     │  via Gemini    │                 │
 │                │                     │────────────────────────────────►│
 │                │                     │◄────────────────────────────────│
 │                │                     │ [768-dim query vector]           │
 │                │                     │─────────────────►│              │
 │                │                     │ cosine similarity│              │
 │                │                     │ search (k=15)    │              │
 │                │                     │◄─────────────────│              │
 │                │                     │ [15 relevant chunks]            │
 │                │                     │ detectIntent()   │              │
 │                │                     │ buildSystemPrompt()             │
 │                │                     │ format context   │              │
 │                │                     │────────────────────────────────►│
 │                │                     │  generateContent()              │
 │                │                     │  (gemini-3.6-flash)             │
 │                │                     │◄────────────────────────────────│
 │                │                     │ [generated markdown response]   │
 │                │◄─────────────────────│               │                │
 │                │  {result, sources, intent}            │                │
 │                │ setMessages([...prev, {role:'assistant'}])             │
 │                │ setIsLoading(false)  │               │                │
 │ AI response    │                      │               │                │
 │ displayed 🤖  │                      │               │                │
```

---

## 4. Core Concept: RAG — Deep Dive

### What Problem Does RAG Solve?

LLMs (Large Language Models) are trained on massive datasets up to a **cutoff date**. They have:
- **No knowledge** of your private documents
- **No real-time information** (after training cutoff)
- **Hallucination tendency** — they confidently make up answers

RAG solves this by **injecting relevant context** into every prompt at inference time.

### The 3-Phase RAG Pipeline

```
═══════════════════════════════════════════════════════════════
                     PHASE 1: INDEXING
          (Happens once, when user uploads a document)
═══════════════════════════════════════════════════════════════

  📄 Raw Document
       │
       ▼
  ┌──────────────┐
  │  Document    │  PDFLoader → pages of text
  │  Loader      │  CheerioLoader → scraped HTML
  │              │  YoutubeTranscript → caption segments
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │    Text      │  RecursiveCharacterTextSplitter
  │   Splitter   │  chunkSize=1500, overlap=300
  └──────┬───────┘
         │  (produces N chunks of ~1500 chars each)
         ▼
  ┌──────────────┐
  │  Embedding   │  GoogleGenerativeAIEmbeddings
  │   Model      │  model: "gemini-embedding-001"
  └──────┬───────┘
         │  (each chunk → 768-dimensional float vector)
         ▼
  ┌──────────────┐
  │   Vector     │  QdrantVectorStore.fromDocuments()
  │   Store      │  collection per document
  └──────────────┘

═══════════════════════════════════════════════════════════════
                     PHASE 2: RETRIEVAL
               (Happens on every user query)
═══════════════════════════════════════════════════════════════

  💬 User Query: "What are the main skills?"
       │
       ▼
  ┌──────────────┐
  │  Embed       │  Same model: gemini-embedding-001
  │  Query       │  → [0.12, -0.34, 0.87, ...] (768 floats)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Similarity  │  Qdrant HNSW Index
  │   Search     │  cosine similarity against all stored vectors
  │   (k=15)     │  returns top-15 most similar chunks
  └──────┬───────┘
         │
         ▼
  [Chunk 1: Page 2 — "Skills include Python, ML..."]
  [Chunk 2: Page 3 — "Technical competencies: ..."]
  [Chunk 3: Page 1 — "Experienced in React, Node..."]
  ... 12 more chunks

═══════════════════════════════════════════════════════════════
                    PHASE 3: GENERATION
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │                  PROMPT CONSTRUCTION                    │
  │                                                         │
  │  System Prompt:                                         │
  │  "You are an expert AI analyzing a PDF document.        │
  │   Answer strictly using the provided context.           │
  │   Cite page numbers when referencing specific info."    │
  │                                                         │
  │  Context (15 retrieved chunks):                         │
  │  "[1] Page 2:\nSkills include Python, ML, RAG..."       │
  │  "[2] Page 3:\nTechnical competencies: React..."        │
  │  ... 13 more chunks ...                                 │
  │                                                         │
  │  User Question: "What are the main skills?"             │
  └─────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  Gemini 3.6  │  Temperature: 0.2 (factual intent)
  │    Flash     │  maxOutputTokens: 8192
  └──────┬───────┘
         │
         ▼
  "Based on the document, the main skills listed are:
   **Python**, **Machine Learning** (Page 2), and
   **React/Node.js** (Page 3)..."
```

### RAG vs Fine-Tuning vs Prompt-Stuffing

```
METHOD          │ HOW                    │ COST    │ FRESHNESS │ HALLUCINATION
────────────────┼────────────────────────┼─────────┼───────────┼──────────────
Fine-Tuning     │ Retrain model weights  │ $$$$$   │ Static    │ High (memorizes)
                │ on your data           │         │           │
────────────────┼────────────────────────┼─────────┼───────────┼──────────────
Prompt-Stuffing │ Paste entire doc       │ $$      │ Real-time │ Medium
                │ in context window      │         │           │ (long context
                │                        │         │           │  degrades quality)
────────────────┼────────────────────────┼─────────┼───────────┼──────────────
RAG ✅          │ Retrieve relevant      │ $       │ Real-time │ Low (grounded
                │ chunks only            │         │ (re-index)│  in doc)
```

---

## 5. Core Concept: Vector Embeddings — Deep Dive

### What is an Embedding?

An embedding is a function that maps text → a point in high-dimensional space, such that **similar text maps to nearby points**.

```
TEXT                        EMBEDDING VECTOR (768 dimensions, shown simplified)

"Machine learning"    →   [ 0.12,  0.87, -0.34,  0.56, ... ] (768 numbers)
"Deep learning"       →   [ 0.11,  0.82, -0.31,  0.58, ... ] (768 numbers)
"Python programming"  →   [ 0.45, -0.12,  0.78, -0.23, ... ] (768 numbers)
"Italian cuisine"     →   [-0.67,  0.23, -0.89,  0.11, ... ] (768 numbers)

Semantic distance:
  "Machine learning" ↔ "Deep learning"   → CLOSE   (similar topic)
  "Machine learning" ↔ "Italian cuisine" → FAR      (different topic)
```

### How Transformers Create Embeddings (Simplified)

The embedding model (Gemini, BERT, etc.) is a **Transformer** neural network:

```
Input text: "What are the main skills?"
                    │
                    ▼
       ┌────────────────────────┐
       │     TOKENIZATION       │
       │                        │
       │  "What" "are" "the"    │
       │  "main" "skills" "?"   │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   POSITIONAL ENCODING  │
       │  (adds position info   │
       │   to each token)       │
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │   SELF-ATTENTION       │  ← THE KEY INNOVATION
       │                        │
       │  Each token "attends"  │
       │  to every other token  │
       │                        │
       │  "skills" pays high    │
       │  attention to "main"   │
       │  and "are" — understands│
       │  it's asking about     │
       │  important competencies│
       └───────────┬────────────┘
                   │ (repeated N times in N layers)
                   ▼
       ┌────────────────────────┐
       │   POOLING LAYER        │
       │  (collapse all token   │
       │   vectors into one     │
       │   sentence vector)     │
       └───────────┬────────────┘
                   │
                   ▼
       [0.23, -0.11, 0.67, ...] ← 768-dimensional sentence embedding
```

### Cosine Similarity — The Math

Given two vectors **A** and **B**:

```
cosine_similarity(A, B) = (A · B) / (|A| × |B|)

Where:
  A · B  = dot product = sum of (Ai × Bi)
  |A|    = magnitude of A = sqrt(sum of Ai squared)
  |B|    = magnitude of B = sqrt(sum of Bi squared)

Result range: -1 to +1
  1.0  → identical direction (most similar)
  0.0  → perpendicular (unrelated)
 -1.0  → opposite (antonyms)

EXAMPLE (simplified 3D):
  Query: "What skills do you have?"   → A = [0.8, 0.6, 0.0]
  Doc1:  "Skills: Python, ML, React"  → B = [0.7, 0.7, 0.1]
  Doc2:  "About the weather today"    → C = [0.1, 0.2, 0.9]

  cosine(A, B) = (0.56 + 0.42 + 0.0) / (1.0 × 1.0) ≈ 0.98 ✅ HIGH
  cosine(A, C) = (0.08 + 0.12 + 0.0) / (1.0 × 1.0) ≈ 0.20 ❌ LOW
```

**Why cosine and not Euclidean distance?**
- Cosine is scale-invariant: a long document and a short one about the same topic will have vectors pointing in the same *direction* even if different *magnitudes*
- Euclidean distance would penalize the longer document unfairly

### What "768 dimensions" means

```
Each dimension captures some abstract feature of meaning.
No single dimension has a human-readable label, but roughly:

Dim 1:   How "technical" is the text?
Dim 2:   How "emotional" is it?
Dim 3:   Is it about people or things?
Dim 17:  Is it question or statement?
...
Dim 768: [complex learned feature]

In reality: these features are learned by the neural network
and cannot be directly interpreted — they emerge from
training on billions of text examples.

WHY 768? → Chosen by Google for gemini-embedding-001.
           Tradeoff: more dims = richer representation
           but more storage and computation.
           OpenAI's large model uses 3072 dims.
           Google's 768 is well-balanced for retrieval tasks.
```

---

## 6. Core Concept: Qdrant & HNSW — Deep Dive

### What is a Vector Database?

A vector database is a specialized database that stores vectors (arrays of floats) and efficiently finds the **nearest neighbors** — vectors most similar to a query vector.

### Why Not Regular SQL/NoSQL?

```
Regular DB:  SELECT * FROM docs WHERE content LIKE '%skills%'
             → Only finds EXACT keyword match
             → "competencies" won't match "skills"

Vector DB:   "skills" query → [0.8, 0.6, ...] (embed query)
             → finds "competencies", "expertise", "abilities"
             → because they're semantically close in vector space
             → SEMANTIC SEARCH, not keyword search
```

### HNSW — How Qdrant Searches in Milliseconds

**HNSW = Hierarchical Navigable Small World**

The naive approach to finding the nearest vector: compare query to ALL stored vectors. With 1 million vectors at 768 dimensions, that's 768 million multiplications per query — too slow.

HNSW builds a **multi-layer graph** that enables fast approximate search:

```
LAYER 2 (top, few nodes, long-range connections):
    ●───────────────●───────────────●
    │               │               │

LAYER 1 (medium density):
    ●────●───────────●────●──────────●
    │    │           │    │          │

LAYER 0 (bottom, ALL vectors, dense connections):
    ●──●──●──●──●──●──●──●──●──●──●──●
       (your 23 document chunks live here)

SEARCH ALGORITHM:
1. Enter at random node in Layer 2 (sparse)
2. Greedily move toward query vector (minimize distance)
3. "Zoom in" — descend to Layer 1, continue greedy walk
4. "Zoom in" — descend to Layer 0, final refinement
5. Return top-k nearest neighbors

RESULT: O(log N) search instead of O(N) brute force
         For 1M vectors: ~1000 operations instead of 1,000,000
```

### Qdrant Collection Strategy

**This app uses one collection per document:**

```
QDRANT SERVER
├── Collection: "1234567890-resume.pdf"
│   ├── Vector [0.12, 0.87, ...] → "Skills: Python, ML" (Page 2)
│   ├── Vector [0.34, 0.11, ...] → "Education: B.Tech" (Page 1)
│   └── Vector [0.56, -0.23,...] → "Projects: RAG App" (Page 3)
│
├── Collection: "youtube_dQw4w9WgXcQ"
│   ├── Vector [...] → "At 02:14 the speaker explains..."
│   └── Vector [...] → "At 05:30 they demonstrate..."
│
└── Collection: "docs_example_com_blog_rag_"
    ├── Vector [...] → "Introduction to RAG..."
    └── Vector [...] → "Vector databases are..."

DELETION: client.deleteCollection("1234567890-resume.pdf")
          → removes the ENTIRE collection instantly
          → no need to find-and-delete individual vectors
```

### Qdrant Payload (Metadata Storage)

Each vector stored in Qdrant also has a **payload** (JSON metadata):

```json
{
  "vector": [0.12, 0.87, -0.34, "..."],
  "payload": {
    "page_content": "Skills include Python, ML, React...",
    "metadata": {
      "source": "1234567890-resume.pdf",
      "loc": { "pageNumber": 2 },
      "type": "pdf"
    }
  }
}
```

For YouTube:
```json
{
  "vector": ["..."],
  "payload": {
    "page_content": "[05:23] The speaker explains RAG...",
    "metadata": {
      "timestamp": "05:23",
      "startTime": 323,
      "youtubeUrl": "https://youtube.com/watch?v=abc&t=323s",
      "videoId": "abc123",
      "type": "youtube"
    }
  }
}
```

---

## 7. Core Concept: LangChain Internals

### What is LangChain?

LangChain is an **orchestration framework** for LLM-powered applications. It provides standardized abstractions so you can swap components without rewriting code.

### LangChain Abstraction Layers Used

```
LANGCHAIN LAYER CAKE:
─────────────────────────────────────────────────────────
@langchain/core           → Base types: Document, Runnable, BaseMessage
                            The "interfaces" / abstract classes
─────────────────────────────────────────────────────────
@langchain/google-genai   → GoogleGenerativeAIEmbeddings
                            Implements: embed(text) → float[]
─────────────────────────────────────────────────────────
@langchain/qdrant         → QdrantVectorStore
                            Implements: addDocuments(), similaritySearch()
─────────────────────────────────────────────────────────
@langchain/community      → PDFLoader, CheerioWebBaseLoader
                            Implements: load() → Document[]
─────────────────────────────────────────────────────────
@langchain/textsplitters  → RecursiveCharacterTextSplitter
  (part of @langchain/core) Implements: splitDocuments(docs) → Document[]
─────────────────────────────────────────────────────────
```

### The `Document` Object — Universal Currency

```javascript
// Every source type ultimately produces LangChain Documents:
class Document {
  pageContent: string;   // The actual text chunk
  metadata: Record<string, any>;  // Arbitrary metadata
}

// PDF chunk example:
{
  pageContent: "The candidate demonstrates proficiency in Python...",
  metadata: {
    source: "1234567890-resume.pdf",
    loc: { pageNumber: 2, lines: { from: 10, to: 25 } },
    type: "pdf"
  }
}

// YouTube chunk example:
{
  pageContent: "[05:23] So when we talk about transformers...",
  metadata: {
    source: "https://youtube.com/watch?v=abc",
    videoId: "abc123",
    timestamp: "05:23",
    startTime: 323,
    type: "youtube"
  }
}
```

### `QdrantVectorStore.fromDocuments()` — Internal Steps

```javascript
await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: filename,
});

// INTERNALLY, this does:
// 1. Creates Qdrant collection (if not exists)
//    DELETE + CREATE with vector config (size=768, distance=Cosine)
// 2. Batch-embeds all documents:
//    embeddings.embedDocuments(splitDocs.map(d => d.pageContent))
//    → returns float[][] (N arrays of 768 floats)
// 3. Upserts all vectors with payloads into Qdrant via REST API
```

### `vectorStore.asRetriever({ k: 15 })` — The Bridge

```javascript
// asRetriever() wraps the vector store as a LangChain Retriever
// A Retriever is a Runnable with invoke(query) → Document[]

const retriever = vectorStore.asRetriever({ k: 15 });
const chunks = await retriever.invoke(userQuery);

// INTERNALLY:
// 1. embeddings.embedQuery(userQuery) → float[] (768 dims)
// 2. qdrantClient.search(collectionName, {
//      vector: queryEmbedding,
//      limit: 15,
//      with_payload: true
//    })
// 3. Map Qdrant results → LangChain Document[]
// 4. Return top-15 Documents
```

---

## 8. Core Concept: Chunking Strategy

### Why Chunk at All?

```
PROBLEM: "Embed entire document as one vector"
         → You lose granularity
         → Query about "Chapter 3 skills" retrieves ENTIRE doc
         → The relevant sentence is buried in noise

SOLUTION: Split into chunks → embed each → retrieve only relevant pieces

TRADEOFF: Too big chunks → noise in retrieval
          Too small chunks → lose context, sentence split mid-thought
          SWEET SPOT → 1000-2000 chars with overlap
```

### `RecursiveCharacterTextSplitter` — Step by Step

```
Input: A 10,000-char PDF page
Target: chunkSize=1500, overlap=300

ALGORITHM (recursive split priority order):
1. Try to split on "\n\n" (paragraph breaks)
   → If resulting chunks ≤ 1500 chars: DONE ✅
   → If still too large: proceed to step 2

2. Try to split on "\n" (line breaks)
   → If resulting chunks ≤ 1500 chars: DONE ✅
   → If still too large: proceed to step 3

3. Try to split on ". " (sentence ends)
   → If resulting chunks ≤ 1500 chars: DONE ✅
   → If still too large: proceed to step 4

4. Try to split on " " (word boundary)
   → If resulting chunks ≤ 1500 chars: DONE ✅
   → If still too large: proceed to step 5

5. Hard split at character level (last resort)

WHY THIS ORDER?
  Preserves semantic units:
  paragraph > sentence > word > character
  Always tries the "softest" split first.
```

### Overlap Visualization

```
WITHOUT OVERLAP (bad):
  Chunk 1: "...The candidate has experience in Python and machine"
  Chunk 2: "learning. They also worked on deep learning projects..."

  Problem: "machine learning" is SPLIT — retrieving Chunk 1
  for "machine learning" query may MISS it!

WITH OVERLAP (chunkOverlap=300):
  Chunk 1: "...The candidate has experience in Python and machine"
           |←─────────── overlap (300 chars) ──────────────→|
  Chunk 2: "Python and machine learning. They also worked on deep learning..."
           |←─────────── overlap ───────────────────────────→|
  Chunk 3: "They also worked on deep learning projects and neural networks..."

  "machine learning" query now retrieves Chunk 2 which has the FULL phrase ✅
```

### Chunk Sizes Per Source Type — Reasoning

```
SOURCE   │ chunkSize │ overlap │ REASON
─────────┼───────────┼─────────┼──────────────────────────────────────────
PDF      │  1500     │  300    │ Dense structured text. Pages are
         │           │         │ well-defined. 1500 ≈ half a page.
─────────┼───────────┼─────────┼──────────────────────────────────────────
Website  │  2000     │  400    │ Web content is looser, more verbose.
         │           │         │ Larger chunks preserve article context.
─────────┼───────────┼─────────┼──────────────────────────────────────────
YouTube  │  1500     │  200    │ Already pre-chunked into 1500-char
         │           │         │ timestamp windows. Less overlap needed
         │           │         │ because boundaries are natural pauses.
```

---

## 9. Core Concept: Intent-Aware Prompting

### Why Intent Detection?

A RAG system that answers every query the same way is limited. Consider:
- "What is the deadline?" → Answer ONLY from the doc (factual)
- "Explain what RAG means" → Start with doc, expand with general knowledge
- "How can I improve this resume?" → Analyze + suggest beyond what's written

### Intent Detection Flow

```
                  ┌─────────────────────────────────────────┐
                  │           User Query                     │
                  └─────────────────┬───────────────────────┘
                                    │
         ┌──────────────────────────▼────────────────────────────┐
         │  /\b(summar|overview|briefly|tldr|recap|              │
         │    what (is|are) this (about|document))\b/            │
         │  Match? YES → intent = "summarize"                    │
         └──────────────────────────┬────────────────────────────┘
                                  NO↓
                    ┌──────────────▼───────────────────────────┐
                    │  /\b(explain|what (is|are|does)|define|  │
                    │   how does|steps to|guide|tutorial)\b/   │
                    │  Match? YES → intent = "explain"          │
                    └──────────────┬───────────────────────────┘
                                  NO↓
                    ┌─────────────▼────────────────────────────┐
                    │  /\b(recommend|suggest|improve|better|   │
                    │   tips|advice|best practice|optimize)\b/ │
                    │  Match? YES → intent = "recommend"        │
                    └─────────────┬────────────────────────────┘
                                 NO↓
                           intent = "factual"

Each intent maps to:
  "factual"   → temperature 0.2, DOCUMENT-ONLY mode
  "explain"   → temperature 0.6, AUGMENTED mode
  "recommend" → temperature 0.6, AUGMENTED mode
  "summarize" → temperature 0.6, AUGMENTED mode
```

### How LLM Temperature Affects Responses

```
TEMPERATURE = randomness in token selection

Model produces token probabilities at each step:
  "The"  → 45%
  "A"    → 30%
  "This" → 15%
  "One"  → 10%

TEMPERATURE = 0.2 (factual):
  → Heavily favors "The" (highest prob)
  → Deterministic, precise, grounded
  → "The candidate has Python skills listed on Page 2."

TEMPERATURE = 0.6 (augmented):
  → More varied selection
  → "Python is a versatile language. Beyond what's in the doc,
      here's why it's especially relevant for ML engineering..."

TEMPERATURE = 1.0+:
  → Very creative, potentially incoherent
  → Not used here
```

### Augmented vs Document-Only Mode

```
DOCUMENT-ONLY MODE (factual intent):
─────────────────────────────────────
System prompt:
  "Answer STRICTLY using the provided context.
   If not found: 'I cannot find this in the document.'"

Response:
  ┌─────────────────────────────────────┐
  │ The document states that... (Page 3) │
  └─────────────────────────────────────┘

AUGMENTED MODE (explain/recommend/summarize):
─────────────────────────────────────────────
System prompt:
  "First answer from the document.
   Then expand with your own knowledge.
   Use '## 📚 From the Document' and '## 🌐 Additional Context'"

Response:
  ┌─────────────────────────────────────────────────────┐
  │ ## 📚 From the Document                              │
  │ The document mentions RAG as...                      │
  │                                                     │
  │ ## 🌐 Additional Context                             │
  │ More broadly, RAG is used in enterprise settings ... │
  └─────────────────────────────────────────────────────┘
```

---

## 10. Sequence Diagrams — All 3 Source Types

### Sequence 1: PDF Upload & Indexing

```
User → FileUpload.jsx → /api/upload → /api/indexing → Qdrant
 │          │               │              │             │
 │ Drop PDF │               │              │             │
 │─────────►│               │              │             │
 │          │ POST /upload  │              │             │
 │          │ FormData{file}│              │             │
 │          │──────────────►│              │             │
 │          │               │ timestamp-   │             │
 │          │               │ file.pdf     │             │
 │          │◄──────────────│              │             │
 │          │ {filename,filepath}           │             │
 │ 50% prog │               │              │             │
 │◄─────────│               │              │             │
 │          │ POST /indexing {filename,filepath}          │
 │          │──────────────────────────────►             │
 │          │               │ PDFLoader → 5 pages        │
 │          │               │ TextSplitter → 23 chunks   │
 │          │               │ Embed 23 chunks via Gemini  │
 │          │               │─────────────────────────────────────►
 │          │               │ Qdrant upsert 23 vectors    │       │
 │          │◄──────────────────────────────│             │
 │          │ {chunksCount:23, pagesCount:5}│             │
 │ 100%     │               │              │             │
 │◄─────────│               │              │             │
 │          │ onFileUploaded(fileInfo)       │             │
 │          │──────────────►page.jsx        │             │
 │ File in  │               │              │             │
 │ sidebar  │               │              │             │
```

### Sequence 2: Website URL Indexing

```
User → FileUpload.jsx → /api/files/url → Website → Qdrant
 │          │               │               │          │
 │ Paste URL│               │               │          │
 │─────────►│               │               │          │
 │          │ POST /url {url}│               │          │
 │          │──────────────►│               │          │
 │          │               │ Validate URL  │          │
 │          │               │               │          │
 │          │               │ Try "article" selector   │
 │          │               │ HTTP GET ────────────────►
 │          │               │◄──────────────────────────
 │          │               │ HTML response │          │
 │          │               │ Parse with Cheerio       │
 │          │               │ > 200 chars? → use it    │
 │          │               │ else try "main","body"   │
 │          │               │               │          │
 │          │               │ Enrich metadata          │
 │          │               │ {source:url, pageTitle}  │
 │          │               │ TextSplitter (2000 chars)│
 │          │               │ Collection name from URL │
 │          │               │ Embed + Store in Qdrant ─────►
 │          │◄──────────────│               │          │
 │          │ {collectionName, chunksCount} │          │
 │ File in  │               │               │          │
 │ sidebar  │               │               │          │
```

### Sequence 3: YouTube Video Indexing

```
User → FileUpload.jsx → /api/files/youtube → YouTube API → Qdrant
 │          │               │                    │            │
 │ Paste URL│               │                    │            │
 │─────────►│               │                    │            │
 │          │ POST /youtube {url}                 │            │
 │          │──────────────►│                    │            │
 │          │               │ extractVideoId()   │            │
 │          │               │ regex → "videoId"  │            │
 │          │               │                    │            │
 │          │               │ YoutubeTranscript  │            │
 │          │               │ .fetchTranscript() │            │
 │          │               │────────────────────►            │
 │          │               │ timedtext API      │            │
 │          │               │◄────────────────────            │
 │          │               │ [{text,offset,dur} × N]         │
 │          │               │                    │            │
 │          │               │ Group into 1500-char windows    │
 │          │               │ with timestamp metadata         │
 │          │               │ formatTimestamp(offset/1000)    │
 │          │               │                    │            │
 │          │               │ TextSplitter (secondary split)  │
 │          │               │ Collection: "youtube_videoId"   │
 │          │               │ Embed + Store ──────────────────►
 │          │◄──────────────│                    │            │
 │          │ {collectionName, chunksCount, videoId}          │
 │ File in  │               │                    │            │
 │ sidebar  │               │                    │            │
```

---

## 11. Frontend State Machine

### `page.jsx` State Transitions

```
                        ┌─────────────────────────┐
                        │        INITIAL           │
                        │   messages = []          │
                        │   uploadedFiles = []     │
                        │   selectedFile = null    │
                        │   showUpload = false     │
                        └───────────┬─────────────┘
                                    │
                    User clicks "+ Add" button
                                    │
                        ┌───────────▼─────────────┐
                        │     UPLOAD MODAL OPEN    │
                        │   showUpload = true      │
                        └───────────┬─────────────┘
                                    │
                    User uploads PDF/URL/YouTube
                                    │
                        ┌───────────▼─────────────┐
                        │       UPLOADING          │
                        │   isUploading = true     │
                        │   uploadProgress = 0→100 │
                        └───────────┬─────────────┘
                                    │
                    onFileUploaded(fileInfo) callback
                                    │
                        ┌───────────▼─────────────┐
                        │     FILE INDEXED         │
                        │   uploadedFiles = [f1]   │
                        │   selectedFile = f1      │
                        │   showUpload = false     │
                        └───────────┬─────────────┘
                                    │
                    User types query & presses Enter
                                    │
                        ┌───────────▼─────────────┐
                        │       LOADING            │
                        │   isLoading = true       │
                        │   messages = [...,       │
                        │     {role:'user',...}]   │
                        └───────────┬─────────────┘
                                    │
                    API returns response
                                    │
                        ┌───────────▼─────────────┐
                        │      RESPONSE READY      │
                        │   isLoading = false      │
                        │   messages = [...,       │
                        │   {role:'user',...},     │
                        │   {role:'assistant',...} │
                        │   ]                      │
                        └───────────┬─────────────┘
                                    │
                    User clicks "New notebook"
                                    │
                        ┌───────────▼─────────────┐
                        │          RESET           │
                        │   messages = []          │
                        │   uploadedFiles = []     │
                        │   selectedFile = null    │
                        │   showUpload = false     │
                        └─────────────────────────┘
```

### React Render Lifecycle

```
INITIAL MOUNT:
  RootLayout renders (Server Component)
  └─ page.jsx renders ('use client' — Client Component)
     ├─ useState initializes all 6 state variables
     ├─ useEffect(scrollIntoView) registered
     ├─ TopBar renders (no files yet)
     ├─ aside renders (empty state: "Saved sources will appear here")
     ├─ section renders (empty state: "Add a source to get started")
     └─ FileUpload: isOpen=false → returns null (not rendered)

AFTER FILE UPLOAD (state change → re-render):
  Only components that READ changed state re-render:
  ├─ aside (reads uploadedFiles) → shows file card ✅
  ├─ section (reads uploadedFiles, selectedFile) → updates ✅
  ├─ FileUpload (isOpen=false still) → returns null ✅
  └─ TopBar (no uploadedFiles dependency) → NO re-render ✅

AFTER MESSAGE SENT (state change → re-render):
  ├─ section (reads messages, isLoading) → shows message ✅
  └─ useEffect fires → scrollIntoView(messagesEndRef) ✅
```

---

## 12. Tech Stack — Every Tool & Why

| Category | Technology | Version | Why Chosen | Alternative Rejected |
|---|---|---|---|---|
| **Framework** | Next.js App Router | 15.5.9 | Full-stack, Turbopack, API routes | Express + Vite (separate FE/BE) |
| **UI Library** | React | 19.1.0 | Hooks, component model, ecosystem | Vue (smaller ecosystem for AI apps) |
| **Styling** | Tailwind CSS | v4 | Utility-first, no CSS files needed | MUI (heavy, opinionated) |
| **LLM** | Gemini Flash | 3.6 | Fast, cheap, 1M context, free tier | GPT-4o (expensive, no free tier) |
| **Embedding** | gemini-embedding-001 | — | MTEB top rank, 768 dims, free tier | text-embedding-3-small (paid) |
| **Vector DB** | Qdrant | latest | Open-source, Rust, HNSW, Docker | Pinecone (paid), FAISS (no persist) |
| **AI Framework** | LangChain JS | 0.3.x | Unified abstractions, swap-friendly | Raw API calls (too much boilerplate) |
| **PDF Parser** | pdf-parse (via LC) | 1.1.1 | Pure JS, no binaries | poppler (requires system binary) |
| **Web Scraper** | Cheerio | 1.1.2 | Fast, no browser, static HTML | Puppeteer (2s startup, 100MB RAM) |
| **YouTube** | youtube-transcript | 1.2.1 | No API key, direct timedtext fetch | YouTube Data API v3 (quota limits) |
| **Markdown** | react-markdown | 10.1.0 | Safe React elements, plugin system | dangerouslySetInnerHTML (XSS risk) |
| **Syntax HL** | react-syntax-highlighter | 16.1.0 | VSCode theme, language detection | Highlight.js (less React-native) |
| **Container** | Docker Compose | — | Cross-platform Qdrant, one command | Manual Qdrant install (OS-specific) |
| **Bundler** | Turbopack (via Next.js) | — | 10x faster HMR than Webpack | Webpack (slower) |

---

## 13. API Routes Deep Dive

### Next.js App Router — How API Routes Work

```
FILE SYSTEM:
  app/
  └── api/
      └── files/
          ├── upload/route.js    ← exports: async function POST(request)
          ├── indexing/route.js  ← exports: async function POST(request)
          ├── url/route.js       ← exports: async function POST(request)
          ├── youtube/route.js   ← exports: async function POST(request)
          ├── chat/route.js      ← exports: async function POST(request)
          └── delete/route.js    ← exports: async function DELETE(request)

NEXT.JS MAPS:
  POST /api/files/upload    → upload/route.js  → export POST()
  DELETE /api/files/delete  → delete/route.js  → export DELETE()

EACH HANDLER:
  RECEIVES: Request (Web API standard, not Node.js IncomingMessage)
  RETURNS:  NextResponse (extends Response)
```

### `/api/files/chat` — Full Logic Walkthrough

```javascript
// Step 1: Parse request body
const { userQuery, collectionName, sourceType, conversationHistory } = body;

// Step 2: Initialize Gemini AI + Embeddings
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
const embeddings = new GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-001" });

// Step 3: Connect to EXISTING Qdrant collection (no creation)
const vectorStore = await QdrantVectorStore.fromExistingCollection(
  embeddings, { url, apiKey, collectionName }
);

// Step 4: Semantic search for relevant chunks
const retriever = vectorStore.asRetriever({ k: 15 });
const chunks = await retriever.invoke(userQuery);
// chunks = 15 most semantically similar Documents

// Step 5: Format context with source-type-specific references
const context = chunks.map((doc, i) => {
  if (sourceType === "youtube")
    return `[${i+1}] @${doc.metadata.timestamp}:\n${doc.pageContent}`;
  if (sourceType === "website")
    return `[${i+1}] ${doc.metadata.pageTitle}:\n${doc.pageContent}`;
  return `[${i+1}] Page ${doc.metadata.loc?.pageNumber}:\n${doc.pageContent}`;
}).join("\n---\n");

// Step 6: Detect query intent
const intent = detectIntent(userQuery);
// → "factual" | "explain" | "recommend" | "summarize"

// Step 7: Build dynamic, intent-aware system prompt
const systemPrompt = buildSystemPrompt({ sourceType, intent, context });

// Step 8: Build multi-turn conversation history
const historyMessages = conversationHistory.slice(-6).map(msg => ({
  role: msg.role === "user" ? "user" : "model",
  parts: [{ text: msg.content }]
}));

// Step 9: Construct full contents array
const contents = [
  ...historyMessages,
  { role: "user", parts: [{ text: systemPrompt + "\n\n---\n" + userQuery }] }
];

// Step 10: Generate LLM response
const response = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents,
  config: {
    temperature: intent === "factual" ? 0.2 : 0.6,
    maxOutputTokens: 8192
  }
});
```

---

## 14. Key Design Decisions (Why Not That?)

### 1. One Qdrant Collection Per File

```
OPTION A (chosen): Per-file collections
  "1234567890-resume.pdf" → its own collection
  PROS: Delete = deleteCollection() — O(1); No cross-doc contamination
  CONS: Many collections for many users; Can't query across docs

OPTION B: Single global collection, filter by filename
  All chunks in one "documents" collection
  PROS: Cross-doc queries possible; Fewer collections
  CONS: Deletion requires batch-delete by payload filter; Contamination risk
```

### 2. No Redux/Zustand for State Management

```
State is 6 variables, max 2 levels of prop drilling.
Redux/Zustand would add: store boilerplate, actions/reducers,
provider wrappers, devtools setup — all for NO benefit.

Rule of thumb: introduce global state manager only when:
  - State is shared across 5+ unrelated components
  - State needs to persist across page navigation
  - Team size > 3 engineers
```

### 3. Why `Date.now()` prefix for filenames?

```javascript
const filename = `${Date.now()}-${file.name}`;
// Example: "1694942400000-resume.pdf"

Without prefix:
  User A uploads "resume.pdf" → collection "resume.pdf"
  User B uploads "resume.pdf" → COLLIDES with User A's collection!
  New upload → same collection → old + new vectors mixed up!

Date.now() ensures:
  → Unique per upload → unique Qdrant collection name → no collision
```

### 4. Stateless Server — History Sent by Client

```
OPTION A (chosen): Client sends last 6 messages in each request
  → Server is STATELESS — scales horizontally trivially
  → Simple: any server instance handles any request
  → Client controls history depth

OPTION B: Server stores session in Redis
  → Needs session ID cookie, Redis infrastructure
  → Session cleanup logic, TTL management
  → Over-engineering for current scale
```

### 5. Manual Orchestration vs LangChain Chains

```
OPTION A (chosen): Manual step-by-step in route.js
  retriever → detect intent → build prompt → generate
  PROS: Full control, easy to debug, transparent, no LangChain lock-in

OPTION B: LangChain RetrievalQAChain
  chain.call({ query }) — one line
  CONS: Less control, harder to add intent detection,
        harder to customize prompts, abstraction hides behavior
```

---

## 15. Scalability & Future Improvements

### Current Bottlenecks

```
BOTTLENECK 1: PDF Indexing is Synchronous
  Client blocks on HTTP until full indexing done.
  Large PDFs → timeout (Vercel: 10s limit).
  FIX: BullMQ job queue → return job_id → client polls /api/status/[id]

BOTTLENECK 2: No Streaming
  User waits for full LLM response before seeing anything.
  FIX: generateContentStream() → ReadableStream → SSE → incremental UI

BOTTLENECK 3: State is In-Memory Only
  Browser refresh → all files gone. No multi-user support.
  FIX: PostgreSQL (metadata) + NextAuth.js (auth) + S3 (PDF storage)

BOTTLENECK 4: Single Embedding Rate Limit
  Large PDFs → many chunks → hits Gemini free tier (100 RPM).
  FIX: Retry with backoff, Redis cache for duplicate content
```

### Production Architecture (Future)

```
                    ┌─────────────────────────────────────────────────┐
                    │              USERS (1000+)                      │
                    └─────────────────┬───────────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────────────┐
                    │         CDN / Load Balancer (Vercel Edge)        │
                    └──────────────────┬──────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────┐
                    │       Next.js App (multiple instances)          │
                    └──┬──────────────┬──────────────┬───────────────┘
                       │              │              │
             ┌─────────▼──┐   ┌───────▼─────┐   ┌───▼──────────────┐
             │ PostgreSQL  │   │   Redis     │   │  Qdrant Cluster  │
             │ (metadata)  │   │ (cache +    │   │  (multi-node)    │
             │ users/files │   │  BullMQ     │   │  HNSW sharding   │
             └─────────────┘   │  job queue) │   │  ~100M vectors   │
                               └─────────────┘   └──────────────────┘
                                                        │
                    ┌───────────────────────────────────▼─────────────┐
                    │                S3 / GCS                         │
                    │          (persistent PDF storage)               │
                    └─────────────────────────────────────────────────┘
```

### RAG Quality Improvements Roadmap

```
CURRENT:
  Query → Embed → Search k=15 → Generate

LEVEL 1: HyDE (Hypothetical Document Embedding)
  Query → Generate hypothetical answer → Embed hypothesis
        → Search with hypothesis vector (more "doc-like") → Generate
  WHY: Hypothesis is closer in vector space to actual doc chunks
       → retrieves more relevant results

LEVEL 2: Reranking
  Query → Search k=50 → Cross-encoder reranker → Top 10 → Generate
  WHY: Cross-encoder does deep pairwise comparison (query vs each chunk)
       → much better precision than approximate vector search

LEVEL 3: Query Expansion
  Query → LLM generates 3 similar phrasings → Search all 3
        → Merge + deduplicate → Generate
  WHY: Different phrasings retrieve different chunks; ensemble is robust

LEVEL 4: Sentence-Level Chunking
  Current: RecursiveCharacterTextSplitter (character count)
  Better:  NLP sentence tokenizer (spaCy, nltk)
  WHY: Semantic units preserved perfectly; no mid-sentence splits
```

---

## 16. Interview Questions & Answers

### Core RAG

**Q: Explain RAG like I'm 5**
> Imagine you have a huge library and someone asks you a question. Instead of reading every book (too slow), you first find the 15 most relevant pages using a smart index, then read just those before answering. RAG does the same — finds relevant chunks from your document, gives them to the AI as context, so it answers based on YOUR content.

**Q: What's the difference between `embedDocuments` and `embedQuery`?**
> Both use the same model (`gemini-embedding-001`), but some models are asymmetric — they use different task objectives. `embedDocuments` uses `RETRIEVAL_DOCUMENT` task type (optimized for indexing), `embedQuery` uses `RETRIEVAL_QUERY` task type (optimized for retrieval). This asymmetry is intentional — queries and documents are fundamentally different in nature, so different objectives produce better retrieval performance.

**Q: What happens if the user asks something not in the document?**
> In DOCUMENT-ONLY mode (factual intent), the system prompt instructs: "If you cannot find this, say: 'I cannot find this in the provided document.'" Even with 15 chunks retrieved, they won't contain relevant context, so the model outputs the fallback response rather than hallucinating. In AUGMENTED mode, it can draw from general knowledge.

**Q: How did you choose `k=15`?**
> `k=15` balances coverage vs. cost/latency. Gemini Flash has a 1M token context window, so 15 chunks of ~1500 chars = ~22,500 chars — well within limits. In testing, `k=5` missed edge cases for multi-topic queries while `k=15` gave comprehensive coverage. Higher k increases API cost and latency linearly.

### Architecture

**Q: What is a Server Component and how is it different from a Client Component?**
> A Server Component (default in Next.js App Router) runs only on the server, generates HTML, ships zero JavaScript to the browser. It can access databases, APIs, secrets directly. A Client Component (`'use client'`) runs in the browser, can use React hooks (`useState`, `useEffect`), handle events, access browser APIs (clipboard, localStorage). In this app: `layout.jsx` is a Server Component (just renders HTML). All interactive components (`page.jsx`, `FileUpload.jsx`, `MarkdownMessage.jsx`, `TopBar.jsx`) are Client Components.

**Q: Why no Redux for state management?**
> Redux is warranted when: state is shared across 5+ unrelated components, state needs cross-page persistence, or team size is large. Here, all state is in one component (`page.jsx`), props are passed 2 levels deep at most, and the app is single-page. Redux would add action/reducer boilerplate with zero architectural benefit — classic over-engineering.

**Q: How do you prevent XSS in the markdown renderer?**
> `react-markdown` renders markdown as React elements (not `innerHTML`), so script injection via markdown is impossible. `rehype-raw` (which allows raw HTML) could be risky for user-provided content — should add `rehype-sanitize` to strip dangerous tags like `<script>`. Links use `rel="noopener noreferrer"` to prevent tab-napping where a new tab can control the opener.

### Vector DBs & HNSW

**Q: What's the difference between exact search and ANN (Approximate Nearest Neighbor)?**
> Exact search compares the query vector against every stored vector — guaranteed to find the TRUE nearest neighbor. O(N) time. ANN (what HNSW does) visits only a small fraction of vectors using the graph structure. Results are slightly suboptimal (0.1-1% accuracy loss) but O(log N) — orders of magnitude faster. For RAG, this trade-off is totally acceptable — you don't need the exact nearest 15 chunks, just 15 very relevant ones.

**Q: Why cosine similarity and not Euclidean distance?**
> Cosine similarity measures the ANGLE between vectors — it's scale-invariant. A 1000-word article and a 50-word summary about the same topic will have vectors pointing in roughly the same direction, but very different magnitudes. Cosine similarity correctly identifies them as similar. Euclidean distance would incorrectly penalize the longer article for having a larger magnitude.

**Q: What is the "curse of dimensionality"?**
> As dimensions increase, the ratio of the nearest to farthest neighbor approaches 1 — all points become approximately equidistant. This makes "nearest" neighbor less meaningful. At 768 dimensions, this effect is present but embedding models are specifically trained so that semantically relevant texts remain reliably closer than irrelevant ones, even at high dimensions. It's why specialized embedding models beat generic random projections.

### Code & Implementation

**Q: Walk me through what happens when I press Enter in the chat**
> 1. `handleKeyPress`: Enter without Shift calls `handleSendMessage()`. 2. Guards: `inputValue.trim()` and `selectedFile` must exist. 3. User message appended to `messages`, `inputValue` cleared, `isLoading = true`. 4. `fetch('/api/files/chat', POST, { userQuery, collectionName, sourceType, conversationHistory.slice(-6) })`. 5. API: connects to Qdrant → retrieves 15 chunks → detects intent → builds prompt → calls Gemini. 6. Response: `setMessages([...prev, { role: 'assistant', content: data.result }])`, `isLoading = false`. 7. `useEffect` fires → `messagesEndRef.scrollIntoView({ behavior: 'smooth' })`.

**Q: Why `useCallback` on drag handlers in FileUpload?**
> `useCallback(fn, [])` memoizes the function — returns the SAME function reference across renders. Without it, `handleDragOver` is a NEW function object every render. When passed as a prop to the drag zone `<div>`, React sees a "changed prop" and would unnecessarily re-render. With `useCallback(fn, [])`, it's created once and reused — avoids unnecessary re-renders for performance.

**Q: Why does the YouTube route group transcript segments into 1500-char windows before splitting?**
> Each transcript segment is a tiny 2-5 word subtitle. If we split directly on these, each chunk would be meaninglessly short. By grouping segments into 1500-char windows with their START timestamp preserved, each chunk represents a coherent topic window (~30-60 seconds of speech) with a meaningful timestamp reference. The secondary `RecursiveCharacterTextSplitter` then handles any windows that exceed 1500 chars.

**Q: What happens if a user uploads the same PDF twice?**
> Each upload creates a new `Date.now()`-prefixed filename: `1694942400000-resume.pdf` and `1694942500000-resume.pdf`. These become different Qdrant collections. The user would see two files in the sidebar. Both can be chatted with independently. This is intentional — the user might want separate sessions for the same document with different chat histories. A future optimization: SHA-256 hash the content, use hash as collection name, skip re-indexing if collection already exists.

### Scaling

**Q: How would you add authentication?**
> 1. Install `next-auth`. 2. Create `app/api/auth/[...nextauth]/route.js` with Google OAuth. 3. Wrap `layout.jsx` with `SessionProvider`. 4. Add `auth()` check to all API routes, reject unauthenticated. 5. Prefix Qdrant collection names with `userId_` for isolation. 6. Store file metadata in PostgreSQL (`userId`, `collectionName`, `originalName`, `createdAt`). 7. On UI load, fetch user's files from DB and restore sidebar state. The `app/auth/` folder is already scaffolded.

**Q: If user uploads a 500-page book, what breaks and how do you fix it?**
> 1. **Timeout**: HTTP request blocks for minutes. Fix: BullMQ job queue — return `jobId` immediately, client polls `/api/status/[jobId]`. 2. **Memory**: 500 pages loaded into Node.js RAM. Fix: Stream PDFLoader in batches. 3. **Rate limit**: 500+ chunks → exceeds Gemini 100 RPM free tier. Fix: Batch with retry-after-delay and exponential backoff. 4. **Cost**: ~500 embedding API calls. Fix: Cache embeddings in Redis using SHA-256 hash of chunk content.

**Q: How would you support multiple files in one chat session?**
> Option A: Multi-collection retrieval — search top `k/N` from each of `N` selected collections, merge results, deduplicate by `pageContent` hash, pick overall top-k. The UI already has `uploadedFiles[]` — change `selectedFile` to `selectedFiles[]`. Option B: Re-index all selected files into a temporary merged collection, query it, delete when session ends. Option A is simpler and avoids duplicate indexing cost.

---

## Quick Reference Card

| Concept | One-liner |
|---|---|
| **RAG** | Retrieve relevant doc chunks → inject as LLM context → grounded answer |
| **Embedding** | Text → 768-float vector preserving semantic meaning |
| **Cosine similarity** | Angle between vectors; 1=identical, 0=unrelated |
| **HNSW** | Multi-layer graph; O(log N) approximate nearest neighbor search |
| **Chunk overlap** | Ensures boundary text appears in adjacent chunks for retrieval |
| **Intent detection** | Regex classifier → controls prompt mode + temperature |
| **Augmented mode** | LLM answers from doc THEN expands with general knowledge |
| **Collection per file** | Isolation + trivial deletion via deleteCollection() |
| **`'use client'`** | Marks component as browser-side (enables hooks + events) |
| **Turbopack** | Rust-based bundler; 10x faster HMR than Webpack |
| **os.tmpdir()** | Serverless-safe temp file storage (only writable dir on Vercel) |
| **k=15** | Chunks retrieved; more = better coverage, higher token cost |
| **Temperature 0.2** | Precise, deterministic — used for factual queries |
| **Temperature 0.6** | Creative, varied — used for explain/recommend/summarize |
| **Date.now() prefix** | Unique filename → unique Qdrant collection → no collision |

---

*Enhanced Deep Dive Edition — Generated for Infosys Specialist Engineer Interview — September 2026*
