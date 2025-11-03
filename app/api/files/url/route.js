import "dotenv/config";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { url } = body;

    console.log("URL processing request received:", url);

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    console.log("Loading content from URL:", url);

    // Load the web page
    const loader = new CheerioWebBaseLoader(url, {
      selector: "body", // Can be customized to target specific content
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      return NextResponse.json(
        { error: "No content could be extracted from the URL" },
        { status: 400 }
      );
    }

    console.log("Content loaded, length:", docs[0].pageContent.length);

    // Split the content into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log("Split into chunks:", splitDocs.length);

    // Add URL as metadata to each chunk
    splitDocs.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        source: url,
        type: "website",
      };
    });

    // Create embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // Generate a collection name from URL
    const collectionName = url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50)
      .toLowerCase();

    console.log("Creating vector store with collection:", collectionName);

    // Store in Qdrant
    const vectorStore = await QdrantVectorStore.fromDocuments(
      splitDocs,
      embeddings,
      {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: collectionName,
      }
    );

    console.log("Indexing completed for URL");

    return NextResponse.json(
      {
        message: "URL indexed successfully",
        collectionName: collectionName,
        chunksCount: splitDocs.length,
        url: url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing URL:", error);
    return NextResponse.json(
      {
        error: "Failed to process URL",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
