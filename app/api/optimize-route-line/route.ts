import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

export async function POST(req: Request) {
  try {
    const { imageData, routeId, originalWidth, originalHeight, tableType } =
      await req.json();

    // Determine folder name based on table type
    const folderName =
      tableType === "boulder" ? "boulders_lines" : "routes_lines";

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Create temp directory
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${tableType}-lines-`)
    );
    const tmpFilePath = path.join(tmpDir, `${routeId}.webp`);

    // Optimize the image with the line drawn on it
    await sharp(buffer)
      .resize({
        width: originalWidth,
        height: originalHeight,
        fit: "fill",
      })
      .webp({
        quality: 80,
        lossless: false,
        nearLossless: false,
        effort: 6,
      })
      .toFile(tmpFilePath);

    // Read the optimized file
    const optimizedBuffer = await fs.readFile(tmpFilePath);

    // Upload to Supabase Storage with a unique name to avoid caching issues
    const fileName = `${routeId}.webp`;
    const filePath = `${folderName}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("cactux")
      .upload(filePath, optimizedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("cactux").getPublicUrl(filePath);

    // Update record in the appropriate table
    const { error: updateError } = await supabase
      .from(tableType)
      .update({
        image_line: publicUrl,
      })
      .eq("id", routeId);

    if (updateError) throw updateError;

    // Clean up temp files
    await fs.rm(tmpDir, { recursive: true });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "Image with line saved successfully",
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
