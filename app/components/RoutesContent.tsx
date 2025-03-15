"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import RouteVisualizer from "@/app/components/RouteVisualizer";
import { Route } from "@/app/components/RouteVisualizer";

export default function RoutesContent() {
  const [tableType, setTableType] = useState<"route" | "boulder">("route");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from(tableType)
        .select("id, name, image, image_line")
        .order("name");

      if (error) {
        console.error(`Error fetching ${tableType}s:`, error);
        setError(`Error loading ${tableType}s`);
        setRoutes([]);
      } else {
        setRoutes(data as Route[]);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [tableType]);

  return (
    <div className="space-y-4">
      <div className="mb-5">
        <label
          htmlFor="table-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Seleccionar Tipo:
        </label>
        <select
          id="table-select"
          value={tableType}
          onChange={(e) => setTableType(e.target.value as "route" | "boulder")}
          className="block w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium"
        >
          <option value="route">Rutas</option>
          <option value="boulder">Boulders</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <RouteVisualizer routes={routes} tableType={tableType} />
      )}
    </div>
  );
}
