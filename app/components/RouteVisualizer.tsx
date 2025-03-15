"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle } from "react-konva";
import { supabase } from "@/lib/supabaseClient";

// TypeScript interfaces
export interface Route {
  id: string;
  name: string;
  description?: string;
  grade?: string;
  image?: string;
  line_data?: number[];
  areaId: string;
}

interface RouteVisualizerProps {
  routes: Route[];
}

export default function RouteVisualizer({ routes }: RouteVisualizerProps) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [lines, setLines] = useState<number[][]>([]);
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [points, setPoints] = useState<number[]>([]);
  const [showLine, setShowLine] = useState<boolean>(true);
  const stageRef = useRef<any>(null);
  const imageRef = useRef<any>(null);

  // Load the selected route and its saved line if available
  useEffect(() => {
    if (!selectedRoute) return;

    async function loadRoute() {
      if (selectedRoute?.image) {
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = selectedRoute.image;
        img.onload = () => {
          setImage(img);
        };
      }
    }

    loadRoute();
  }, [selectedRoute]);

  const handleRouteSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const routeId = e.target.value;
    const route = routes.find((r: any) => r.id === routeId);
    setSelectedRoute(route || null);
  };

  const handleMouseDown = (e: any) => {
    if (!drawingMode || !image) return;

    const pos = e.target.getStage().getPointerPosition();

    // Add a new point to our points array
    setPoints([...points, pos.x, pos.y]);

    // If we have at least two points, update the line
    if (points.length >= 2) {
      setLines([points]);
    }
  };

  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    if (drawingMode) {
      // Clear the current points when exiting drawing mode
      setPoints([]);
    }
  };

  const undoLastPoint = () => {
    if (points.length >= 2) {
      const newPoints = points.slice(0, points.length - 2);
      setPoints(newPoints);
      if (newPoints.length >= 2) {
        setLines([newPoints]);
      } else {
        setLines([]);
      }
    }
  };

  const finishLine = () => {
    if (points.length >= 4) {
      // At least 2 points (4 coordinates)
      setLines([points]);
      setDrawingMode(false);
      setPoints([]);
    }
  };

  // Save line as SVG path data
  const saveLine = async () => {
    if (!selectedRoute || !lines.length || !stageRef.current) return;

    try {
      // Get the stage as a data URL
      const dataURL = stageRef.current.toDataURL();

      // Send to our API endpoint
      const response = await fetch("/api/optimize-route-line", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: dataURL,
          routeId: selectedRoute.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to optimize and save image");
      }

      alert("Route line saved successfully!");
    } catch (error) {
      console.error("Error saving line:", error);
      alert("Failed to save line");
    }
  };

  const toggleLineVisibility = () => {
    setShowLine(!showLine);
  };

  return (
    <>
      <div className="mb-5">
        <label htmlFor="route-select">Select a route: </label>
        <select
          id="route-select"
          onChange={handleRouteSelect}
          value={selectedRoute?.id || ""}
        >
          <option value="">-- Select a route --</option>
          {routes.map((route: any) => (
            <option key={route.id} value={route.id}>
              {route.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2.5 mb-5">
        <button
          onClick={toggleDrawingMode}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {drawingMode ? "Cancel Drawing" : "Draw Route Line"}
        </button>
        {drawingMode && (
          <>
            <button
              onClick={undoLastPoint}
              disabled={points.length < 2}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Undo Last Point
            </button>
            <button
              onClick={finishLine}
              disabled={points.length < 4}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Finish Line
            </button>
          </>
        )}
        <button
          onClick={toggleLineVisibility}
          disabled={!lines.length}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {showLine ? "Hide Line" : "Show Line"}
        </button>
        <button
          onClick={saveLine}
          disabled={!lines.length || !selectedRoute}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Save Line
        </button>
      </div>

      <div className="border border-gray-300 mb-5 relative">
        {image ? (
          <Stage
            width={image.width}
            height={image.height}
            onMouseDown={handleMouseDown}
            ref={stageRef}
          >
            <Layer>
              <KonvaImage image={image} ref={imageRef} />

              {showLine &&
                lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line}
                    stroke="#ff6600"
                    strokeWidth={4}
                    tension={0} // Changed from 0.5 to 0 for straight lines
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}

              {/* Draw the current line being created */}
              {drawingMode && points.length > 0 && (
                <>
                  <Line
                    points={points}
                    stroke="#ff6600"
                    strokeWidth={4}
                    tension={0} // Straight lines
                    lineCap="round"
                    lineJoin="round"
                  />

                  {/* Draw points as circles */}
                  {Array.from({ length: points.length / 2 }).map((_, i) => (
                    <Circle
                      key={i}
                      x={points[i * 2]}
                      y={points[i * 2 + 1]}
                      radius={6}
                      fill="#ff6600"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                </>
              )}
            </Layer>
          </Stage>
        ) : (
          <div className="p-[50px] text-center">
            {selectedRoute
              ? "Loading image..."
              : "Select a route to view its image"}
          </div>
        )}
      </div>
    </>
  );
}
