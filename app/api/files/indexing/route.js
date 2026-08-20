import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Received body:", body);

    const { filename, filepath } = body;
    console.log("uploadedFile path:", filename, filepath);

    const pdfFilePath = filepath;
    const loader = new PDFLoader(pdfFilePath);

    // Load all pages of the PDF
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} pages from PDF`);

    // Split into proper semantic chunks — fixes "Retrieved chunks: 1" bug
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 300,
    });

    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks`);

    // Preserve page number metadata on each chunk
    splitDocs.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        type: "pdf",
        source: filename,
      };
    });

    // Ready the Google Embedding Model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromDocuments(
      splitDocs,
      embeddings,
      {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: filename,
      }
    );

    console.log("Indexing of documents done...");
    return NextResponse.json(
      {
        message: "Indexing completed successfully",
        chunksCount: splitDocs.length,
        pagesCount: docs.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error indexing documents:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
