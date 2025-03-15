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
    const { imageData, routeId } = await req.json();

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Create temp directory
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "route-lines-"));
    const tmpFilePath = path.join(tmpDir, `${routeId}.webp`);

    // Optimize image using Sharp
    await sharp(buffer)
      .webp({ quality: 80 }) // Convert to WebP format with 80% quality
      .resize(1200, null, {
        // Max width 1200px, maintain aspect ratio
        withoutEnlargement: true,
        fit: "inside",
      })
      .toFile(tmpFilePath);

    // Read the optimized file
    const optimizedBuffer = await fs.readFile(tmpFilePath);

    // Upload to Supabase Storage
    const fileName = `${routeId}.webp`;
    const filePath = `routes_lines/${fileName}`;

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

    // Update route record
    const { error: updateError } = await supabase
      .from("route")
      .update({
        image_line: publicUrl,
      })
      .eq("id", routeId);

    if (updateError) throw updateError;

    // Clean up temp files
    await fs.rm(tmpDir, { recursive: true });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
