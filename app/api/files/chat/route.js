import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Intent detection — decides if we should augment beyond the document
function detectIntent(query) {
  const q = query.toLowerCase();

  // Summarization intent
  if (/\b(summar|overview|briefly|tldr|tl;dr|outline|recap|what (is|are) this (about|document|video|page|article))\b/.test(q)) {
    return "summarize";
  }
  // Explanation / teaching intent
  if (/\b(explain|what (is|are|does)|define|meaning of|tell me about|how (does|do|to|can i|do i)|steps? to|guide|tutorial|walk (me )?through|why (is|does|do)|elaborate|describe|setup|set up|configure|install)\b/.test(q)) {
    return "explain";
  }
  // Recommendation / improvement intent
  if (/\b(recommend|suggest|improve|better|tips|advice|should i|what (should|could|would)|how (can|could|should) i|best (way|practice)|optimize)\b/.test(q)) {
    return "recommend";
  }

  return "factual"; // Default: answer strictly from source
}

// Build source-type-aware system prompt
function buildSystemPrompt({ sourceType, intent, formattedContext, sourceDescription }) {
  const isAugmented = intent === "explain" || intent === "recommend" || intent === "summarize";

  const citationInstruction =
    sourceType === "youtube"
      ? "Include timestamps (e.g. [02:14]) when referencing specific parts. Link to specific moments when possible."
      : sourceType === "website"
      ? "Cite the source URL when referencing specific information."
      : "Mention the page number when citing specific information (e.g. Page 2).";

  const augmentNote = isAugmented
    ? `
You are operating in AUGMENTED mode for this query. This means:
- First answer using information found in the ${sourceDescription}
- Then expand with your own knowledge to give a fuller, more helpful answer
- Clearly separate the two with a heading like "## 📚 From the Document" and "## 🌐 Additional Context"
- The additional context should be directly relevant to the document's topic and the user's question
`
    : `
You are operating in DOCUMENT-ONLY mode for this query. 
- Answer strictly using the provided context
- If the answer cannot be found, say: "I cannot find this information in the provided ${sourceDescription}."
`;

  let sourceTypeSpecific = "";
  if (sourceType === "youtube") {
    sourceTypeSpecific = `
YouTube-specific instructions:
- When summarizing, create a section-by-section breakdown with timestamps
- Format: **[MM:SS] Topic Title** followed by 2-3 sentence description
- Highlight the key topics covered and the main takeaways
- If asked about a specific topic, point to the exact timestamp where it's discussed
`;
  } else if (sourceType === "website") {
    sourceTypeSpecific = `
Website-specific instructions:
- When answering, cite the specific section or URL of the page
- Add relevant related context that would be useful to someone reading this page
- If the page covers a technical topic, explain it clearly with examples
`;
  } else {
    sourceTypeSpecific = `
Document-specific instructions:
- When asked to improve or recommend, analyze the actual content and give actionable, specific advice
- Reference specific details from the document to make your answer relevant
- For resumes: suggest concrete improvements, missing sections, stronger wording
`;
  }

  return `You are an expert AI assistant analyzing ${sourceDescription}. You give thorough, well-structured, insightful answers.
${augmentNote}
${sourceTypeSpecific}
Formatting rules:
- Use **bold** for key terms and important points
- Use bullet lists or numbered lists for multiple items
- Use headers (##) to organize long responses
- Use > blockquotes for direct quotes from the source
- Use code blocks for any code snippets
- ${citationInstruction}

Context from the ${sourceDescription}:
${formattedContext}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userQuery, collectionName, sourceType = "pdf", conversationHistory = [] } = body;

    console.log("Chat request received:", { userQuery, collectionName, sourceType });

    if (!collectionName) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

    // Embeddings for vector retrieval
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    console.log("Connecting to Qdrant collection:", collectionName);
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: collectionName,
      }
    );

    // Retrieve more chunks for better coverage
    const vectorSearcher = vectorStore.asRetriever({ k: 15 });
    const relevantChunk = await vectorSearcher.invoke(userQuery);
    console.log("Retrieved chunks:", relevantChunk.length);

    // Format context with rich source references based on source type
    const formattedContext = relevantChunk
      .map((doc, index) => {
        let reference = "";

        if (sourceType === "youtube") {
          const timestamp = doc.metadata?.timestamp || "00:00";
          const ytUrl = doc.metadata?.youtubeUrl || doc.metadata?.source || "";
          reference = `[${index + 1}] @${timestamp}${ytUrl ? ` (${ytUrl})` : ""}`;
        } else if (sourceType === "website") {
          const pageTitle = doc.metadata?.pageTitle || doc.metadata?.source || "Unknown";
          const srcUrl = doc.metadata?.source || "";
          reference = `[${index + 1}] ${pageTitle}${srcUrl ? ` — ${srcUrl}` : ""}`;
        } else {
          const pageNum = doc.metadata?.loc?.pageNumber || doc.metadata?.page || "?";
          reference = `[${index + 1}] Page ${pageNum}`;
        }

        return `${reference}:\n${doc.pageContent}\n`;
      })
      .join("\n---\n\n");

    // Source descriptions
    const sourceDescriptions = {
      youtube: "YouTube video transcript",
      website: "website content",
      pdf: "PDF document",
    };
    const sourceDescription = sourceDescriptions[sourceType] || "document";

    // Detect query intent
    const intent = detectIntent(userQuery);
    console.log("Detected intent:", intent);

    // Build the tailored system prompt
    const systemPrompt = buildSystemPrompt({
      sourceType,
      intent,
      formattedContext,
      sourceDescription,
    });

    // Build conversation history for multi-turn context
    const historyMessages = conversationHistory.slice(-6).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Final user message
    const contents = [
      ...historyMessages,
      {
        role: "user",
        parts: [{ text: systemPrompt + "\n\n---\nUser question: " + userQuery }],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        temperature: intent === "factual" ? 0.2 : 0.6, // Factual = precise; augmented = creative
        maxOutputTokens: 2048,
      },
    });

    const resultText = response.text;
    console.log(`Response generated (${resultText.length} chars)`);

    return NextResponse.json(
      {
        result: resultText,
        sources: relevantChunk.length,
        intent: intent,
        metadata: {
          model: "gemini-3.6-flash",
          chunksRetrieved: relevantChunk.length,
          sourceType,
          intent,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chat error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });

    const errorMessage = error.message || "Failed to process chat request";
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
