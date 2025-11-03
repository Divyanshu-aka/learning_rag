import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { userQuery, collectionName } = body;

    console.log("Chat request received:", { userQuery, collectionName });

    if (!collectionName) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    // Ready the client OpenAI Embedding Model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
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

    const vectorSearcher = vectorStore.asRetriever({
      k: 10,
    });

    const relevantChunk = await vectorSearcher.invoke(userQuery);
    console.log("Retrieved chunks:", relevantChunk.length);

    // Format the context with better structure
    const formattedContext = relevantChunk
      .map((doc, index) => {
        const sourceType = doc.metadata?.type || "pdf";
        let reference = "";

        if (sourceType === "youtube") {
          // For YouTube, show timestamp if available
          const timestamp = doc.metadata?.timestamp || "Unknown time";
          reference = `[Source ${index + 1}] (YouTube - ${timestamp})`;
        } else if (sourceType === "website") {
          // For websites, show URL
          const url = doc.metadata?.source || "Unknown URL";
          reference = `[Source ${index + 1}] (Website: ${url})`;
        } else {
          // For PDFs, show page number
          const pageNum =
            doc.metadata?.loc?.pageNumber || doc.metadata?.page || "Unknown";
          reference = `[Source ${index + 1}] (Page ${pageNum})`;
        }

        return `${reference}:\n${doc.pageContent}\n`;
      })
      .join("\n---\n\n");

    // Detect source type from metadata
    const sourceType = relevantChunk[0]?.metadata?.type || "pdf";

    let sourceDescription = "documents";
    if (sourceType === "youtube") {
      sourceDescription = "YouTube video transcript";
    } else if (sourceType === "website") {
      sourceDescription = "website content";
    } else {
      sourceDescription = "PDF documents";
    }

    const SYSTEM_PROMPT = `You are an AI assistant specialized in analyzing and answering questions based on ${sourceDescription}.

Your role:
- Answer questions ONLY using the provided context from the ${sourceDescription}
- Be precise, clear, and well-structured in your responses
- Use markdown formatting for better readability:
  * Use **bold** for emphasis
  * Use bullet points or numbered lists for multiple items
  * Use code blocks with \`\`\` for code snippets
  * Use > for important quotes from the source
- If you reference specific information, ${
      sourceType === "youtube"
        ? "mention timestamps when relevant"
        : sourceType === "website"
        ? "cite the source URL"
        : "mention the page number in your response"
    }
- If the answer cannot be found in the context, clearly state: "I cannot find this information in the provided ${sourceDescription}."

Context from the ${sourceDescription}:
${formattedContext}

Instructions:
- Provide a well-formatted, comprehensive answer
- Include ${
      sourceType === "youtube"
        ? "timestamps"
        : sourceType === "website"
        ? "source references"
        : "page references"
    } when citing specific information
- Structure your response with clear headings or sections if needed`;

    const response = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuery },
      ],
    });

    console.log(`> ${response.choices[0].message.content}`);

    return NextResponse.json(
      {
        result: response.choices[0].message.content,
        sources: relevantChunk.length,
        metadata: {
          model: "gemini-2.5-flash",
          chunksRetrieved: relevantChunk.length,
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
