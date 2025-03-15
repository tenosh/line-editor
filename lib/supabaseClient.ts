import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(process.env.NEXT_PUBLIC_SUPABASE_KEY);

export const supabase = createClient(
  supabaseUrl as string,
  supabaseKey as string
);
