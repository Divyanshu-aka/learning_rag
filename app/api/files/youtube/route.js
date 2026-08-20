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

// Convert seconds to HH:MM:SS or MM:SS
function formatTimestamp(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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

    // Fetch transcript with timestamps
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

    console.log(`Fetched ${transcriptData.length} transcript segments`);

    // Build per-segment documents with timestamp metadata
    // Group segments into ~1500 char topic windows, preserving start time of the window
    const segmentDocs = [];
    let buffer = "";
    let bufferStartTime = 0;
    let bufferStartFormatted = "00:00";

    for (let i = 0; i < transcriptData.length; i++) {
      const seg = transcriptData[i];
      // offset is in milliseconds
      const offsetSec = seg.offset / 1000;
      const formatted = formatTimestamp(offsetSec);
      const line = `[${formatted}] ${seg.text}`;

      if (buffer.length === 0) {
        bufferStartTime = offsetSec;
        bufferStartFormatted = formatted;
      }

      buffer += (buffer.length > 0 ? " " : "") + line;

      // Flush buffer when it reaches ~1500 chars or end of transcript
      if (buffer.length >= 1500 || i === transcriptData.length - 1) {
        segmentDocs.push(
          new Document({
            pageContent: buffer,
            metadata: {
              source: url,
              videoId: videoId,
              type: "youtube",
              startTime: bufferStartTime,
              timestamp: bufferStartFormatted,
              youtubeUrl: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(bufferStartTime)}s`,
            },
          })
        );
        buffer = "";
        bufferStartTime = 0;
        bufferStartFormatted = "00:00";
      }
    }

    console.log(`Created ${segmentDocs.length} timestamp-aware chunks`);

    // Further split very large chunks while preserving metadata
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(segmentDocs);
    console.log("Final split chunks:", splitDocs.length);

    // Create embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // Generate collection name
    const collectionName = `youtube_${videoId}`.toLowerCase();

    console.log("Creating vector store with collection:", collectionName);

    // Store in Qdrant
    await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: collectionName,
    });

    console.log("Indexing completed for YouTube video");

    return NextResponse.json(
      {
        message: "YouTube video indexed successfully",
        collectionName: collectionName,
        chunksCount: splitDocs.length,
        videoId: videoId,
        url: url,
        segmentCount: transcriptData.length,
        transcriptLength: transcriptData.reduce((acc, s) => acc + s.text.length, 0),
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
