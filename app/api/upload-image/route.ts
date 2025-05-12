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
    const {
      imageData,
      routeId,
      originalWidth,
      originalHeight,
      tableType,
      hasLine,
    } = await req.json();

    // Determine folder name based on table type and whether it has a line
    const folderName = hasLine
      ? tableType === "boulder"
        ? "boulder_lines"
        : "routes_lines"
      : tableType === "boulder"
      ? "boulder"
      : "routes";

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Create temp directory
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${tableType}-image-`)
    );
    const tmpFilePath = path.join(tmpDir, `${routeId}.webp`);

    // Optimize the image
    // Create a processing loop to ensure file size is under 300KB
    const MAX_SIZE_KB = 300;
    let currentQuality = 80;
    let currentWidth = originalWidth;
    let currentHeight = originalHeight;
    let finalBuffer;

    while (true) {
      // Process image with current settings
      const processedImage = sharp(buffer)
        .resize({
          width: currentWidth,
          height: currentHeight,
          fit: "fill",
        })
        .webp({
          quality: currentQuality,
          lossless: false,
          nearLossless: false,
          effort: 6,
        });

      // Get buffer to check size
      finalBuffer = await processedImage.toBuffer();
      const fileSize = finalBuffer.length / 1024; // Size in KB

      if (fileSize <= MAX_SIZE_KB) {
        // Save to temp file if size is acceptable
        await fs.writeFile(tmpFilePath, finalBuffer);
        break;
      }

      if (currentQuality > 10) {
        // First try reducing quality
        currentQuality -= 10;
      } else {
        // Then try reducing dimensions
        currentWidth = Math.round(currentWidth * 0.9);
        currentHeight = Math.round(currentHeight * 0.9);
        currentQuality = 60; // Reset quality after resizing

        // Prevent images from becoming too small
        if (
          currentWidth < originalWidth * 0.5 ||
          currentHeight < originalHeight * 0.5
        ) {
          await fs.writeFile(tmpFilePath, finalBuffer);
          break;
        }
      }
    }

    // Upload to Supabase Storage with a unique name to avoid caching issues
    const fileName = `${routeId}.webp`;
    const filePath = `${folderName}/${fileName}`;

    // Use the optimized buffer directly instead of reading from file
    const { error: uploadError } = await supabase.storage
      .from("cactux")
      .upload(filePath, finalBuffer, {
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
        [hasLine ? "image_line" : "image"]: publicUrl,
      })
      .eq("id", routeId);

    if (updateError) throw updateError;

    // Clean up temp files
    await fs.rm(tmpDir, { recursive: true });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "Image saved successfully",
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
