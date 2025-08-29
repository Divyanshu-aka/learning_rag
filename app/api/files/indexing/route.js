import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Received body:", body);

    const { filename , filepath } = body;
    console.log("uploadedFile path:", filename,filepath);
    const pdfFilePath = filepath;
    const loader = new PDFLoader(pdfFilePath);

    // Page by page load the PDF file
    const docs = await loader.load();

    // Ready the client OpenAI Embedding Model
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromDocuments(
      docs,
      embeddings,
      {
        url: process.env.QDRANT_URL ,
        collectionName: filename,
      }
    );

    console.log("Indexing of documents done...");
    return NextResponse.json(
      { message: "Indexing completed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error indexing documents:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
