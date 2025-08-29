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

    const SYSTEM_PROMPT = `
    You are an AI assistant who helps resolving user query based on the
    context available to you from a PDF file with the content and page number.

    Only ans based on the available context from file only.

    Context:
    ${JSON.stringify(relevantChunk)}
  `;

    const response = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuery },
      ],
    });

    console.log(`> ${response.choices[0].message.content}`);

    return NextResponse.json(
      { result: response.choices[0].message.content },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chat error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      collectionName: body?.collectionName
    });
    
   
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
