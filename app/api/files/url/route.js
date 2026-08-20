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

    // Try smart content selectors first, fall back to body
    // This avoids pulling in navbars, footers, ads, etc.
    let docs = [];
    const smartSelectors = ["article", "main", ".content", ".post-content", "#content"];

    for (const selector of smartSelectors) {
      try {
        const loader = new CheerioWebBaseLoader(url, { selector });
        const loaded = await loader.load();
        if (loaded?.[0]?.pageContent?.trim().length > 200) {
          docs = loaded;
          console.log(`Content loaded with selector "${selector}", length: ${docs[0].pageContent.length}`);
          break;
        }
      } catch (_) {
        // Try next selector
      }
    }

    // Fallback to full body
    if (docs.length === 0) {
      const loader = new CheerioWebBaseLoader(url, { selector: "body" });
      docs = await loader.load();
      console.log("Fell back to body selector, length:", docs[0]?.pageContent?.length);
    }

    if (!docs || docs.length === 0 || !docs[0].pageContent.trim()) {
      return NextResponse.json(
        { error: "No content could be extracted from the URL" },
        { status: 400 }
      );
    }

    // Extract page title from metadata if available
    const pageTitle = docs[0]?.metadata?.title || url;

    // Enrich metadata on all docs
    docs.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        source: url,
        pageTitle: pageTitle,
        type: "website",
      };
    });

    // Larger chunks — websites need more context per chunk than PDFs
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 400,
    });

    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log("Split into chunks:", splitDocs.length);

    // Create embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
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
    await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: collectionName,
    });

    console.log("Indexing completed for URL");

    return NextResponse.json(
      {
        message: "URL indexed successfully",
        collectionName: collectionName,
        chunksCount: splitDocs.length,
        pageTitle: pageTitle,
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
