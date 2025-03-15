import { supabase } from "@/lib/supabaseClient";
import RouteVisualizer from "@/app/components/RouteVisualizer";
import { Route } from "@/app/components/RouteVisualizer";

export default async function Home() {
  // Fetch routes server-side
  const { data: routes, error } = await supabase
    .from("route")
    .select("id, name, image, image_line")
    .order("name");

  if (error) {
    console.error("Error fetching routes:", error);
    // Handle error appropriately
    return <div>Error loading routes</div>;
  }

  return (
    <div className="flex flex-col p-5 mx-auto">
      <RouteVisualizer routes={(routes as Route[]) || []} />
    </div>
  );
}
