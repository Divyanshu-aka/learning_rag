import { NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { filename } = body;

    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    console.log(`Deleting file: ${filename}`);

    await client.deleteCollection(filename);

    return NextResponse.json(
      { message: "Collection removed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing collection:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
