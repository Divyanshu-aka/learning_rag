import "dotenv/config";
import { YoutubeTranscript } from "youtube-transcript";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { NextResponse } from "next/server";
import { Document } from "@langchain/core/documents";

// Extract video ID from various YouTube URL formats
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { url } = body;

    console.log("YouTube processing request received:", url);

    if (!url) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL format" },
        { status: 400 }
      );
    }

    console.log("Extracted video ID:", videoId);

    // Fetch transcript
    let transcriptData;
    try {
      transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      return NextResponse.json(
        {
          error:
            "Could not fetch transcript. The video might not have captions available.",
          details: error.message,
        },
        { status: 400 }
      );
    }

    if (!transcriptData || transcriptData.length === 0) {
      return NextResponse.json(
        { error: "No transcript found for this video" },
        { status: 400 }
      );
    }

    // Combine transcript segments with timestamps
    const fullTranscript = transcriptData
      .map((segment) => {
        const timestamp = new Date(segment.offset).toISOString().substr(11, 8);
        return `[${timestamp}] ${segment.text}`;
      })
      .join(" ");

    console.log("Transcript length:", fullTranscript.length);

    // Create a document with the transcript
    const doc = new Document({
      pageContent: fullTranscript,
      metadata: {
        source: url,
        videoId: videoId,
        type: "youtube",
        segmentCount: transcriptData.length,
      },
    });

    // Split into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments([doc]);
    console.log("Split into chunks:", splitDocs.length);

    // Create embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // Generate collection name
    const collectionName = `youtube_${videoId}`.toLowerCase();

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

    console.log("Indexing completed for YouTube video");

    return NextResponse.json(
      {
        message: "YouTube video indexed successfully",
        collectionName: collectionName,
        chunksCount: splitDocs.length,
        videoId: videoId,
        url: url,
        transcriptLength: fullTranscript.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing YouTube video:", error);
    return NextResponse.json(
      {
        error: "Failed to process YouTube video",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
