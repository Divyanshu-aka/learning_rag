import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Use temporary directory instead of uploads directory
    const tmpDir = os.tmpdir();
    const uploadsDir = path.join(tmpDir, "uploads");

    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save the file to temporary directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    // Return the file information
    return NextResponse.json({
      message: "File uploaded successfully",
      filename,
      filepath,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      cwd: process.cwd(),
      tmpdir: os.tmpdir(),
    });
    return NextResponse.json(
      { error: "Failed to upload file", details: error.message },
      { status: 500 }
    );
  }
}
