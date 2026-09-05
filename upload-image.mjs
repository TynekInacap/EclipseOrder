import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function uploadImage() {
  try {
    const imagePath = path.join(process.cwd(), "src/imports/server-guide.png");
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = "server-guide.png";
    const bucketName = "public";

    console.log(`Uploading ${fileName} to Supabase Storage...`);

    const { data, error } = await supabase.storage
      .from("publico")
      .upload(fileName, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      process.exit(1);
    }

    const { data: publicUrl } = supabase.storage
      .from("publico")
      .getPublicUrl(fileName);

    console.log("Upload successful!");
    console.log("Public URL:", publicUrl.publicUrl);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

uploadImage();
