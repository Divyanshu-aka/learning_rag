import {NextResponse, NextRequest} from "next/server";

export async function DELETE(request) {
  try {
    const { id } = request.query;

    // Perform deletion logic here
    console.log(`Deleting file with ID: ${id}`);

    return NextResponse.json(
      { message: "File deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
