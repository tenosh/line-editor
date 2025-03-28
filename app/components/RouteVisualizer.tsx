"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle } from "react-konva";
import React from "react";

// TypeScript interfaces
export interface Route {
  id: string;
  name: string;
  description?: string;
  grade?: string;
  image?: string;
  image_line?: string;
  line_data?: number[];
  areaId: string;
}

interface RouteVisualizerProps {
  routes: Route[];
  tableType: "route" | "boulder";
}

export default function RouteVisualizer({
  routes,
  tableType,
}: RouteVisualizerProps) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [lineSavedImage, setLineSavedImage] = useState<string | null>(null);
  const [lines, setLines] = useState<number[][]>([]);
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [points, setPoints] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [noImageAvailable, setNoImageAvailable] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lineFinished, setLineFinished] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | null;
  }>({ message: "", type: null });
  const stageRef = useRef<any>(null);
  const imageRef = useRef<any>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load the selected route and its saved line if available
  useEffect(() => {
    if (!selectedRoute) return;

    async function loadRoute() {
      setIsLoading(true);
      setNoImageAvailable(false);

      // Reset drawing state when route changes
      setDrawingMode(false);
      setPoints([]);
      setLines([]);
      setLineFinished(false);

      // Clear existing images before loading new ones
      setImage(null);
      setLineSavedImage(null);

      // Load main route image if available
      if (selectedRoute?.image) {
        setImageLoading(true);
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = selectedRoute.image;

        img.onload = () => {
          setImage(img);
          setImageLoading(false);
        };
        img.onerror = () => {
          setImageLoading(false);
          setNoImageAvailable(true);
          alert("Failed to load image");
        };
      } else {
        setNoImageAvailable(true);
      }

      // Just store the URL for the line image
      if (selectedRoute?.image_line) {
        // Add cache-busting parameter to the URL
        const cachebustedUrl = `${
          selectedRoute.image_line
        }?t=${new Date().getTime()}`;
        setLineSavedImage(cachebustedUrl);
        setIsLoading(false);
      } else {
        setIsLoading(false);
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
      // Clear both points and lines when exiting drawing mode
      setPoints([]);
      setLines([]);
      setLineFinished(false);
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
      setLineFinished(true);
    }
  };

  // Function to show toast notification
  const showToast = (message: string, type: "success" | "error") => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    // Set the toast message and type
    setToast({ message, type });

    // Auto-hide the toast after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ message: "", type: null });
    }, 3000);
  };

  // Clean up timeout on component unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Save line as SVG path data
  const saveLine = async () => {
    if (!selectedRoute || !lines.length || !stageRef.current) return;

    try {
      setIsSaving(true);

      // Make sure we're capturing the entire stage with all elements
      // Force a small delay to ensure rendering is complete
      setTimeout(async () => {
        try {
          // Get the stage as a data URL with pixelRatio: 1 to maintain original dimensions
          const dataURL = stageRef.current.toDataURL({
            pixelRatio: 1, // Changed from 2 to 1 to maintain original dimensions
            mimeType: "image/png",
          });

          // Send to our API endpoint
          const response = await fetch("/api/optimize-route-line", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageData: dataURL,
              routeId: selectedRoute.id,
              originalWidth: image?.width, // Send original dimensions
              originalHeight: image?.height,
              tableType: tableType, // Pass the table type to the API
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to optimize and save image");
          }

          // Get the response data which should include the saved image URL
          const data = await response.json();

          // Update our state with the URL returned from the API
          if (data.url) {
            const cachebustedUrl = `${data.url}?t=${new Date().getTime()}`;
            // Load the new image
            const lineImg = new window.Image();
            lineImg.crossOrigin = "Anonymous";
            lineImg.src = cachebustedUrl;
            lineImg.onload = () => {
              setLineSavedImage(data.url);
            };
          }

          // Replace alert with toast notification
          showToast("¡Línea de ruta guardada con éxito!", "success");
          setIsSaving(false);
        } catch (error) {
          console.error("Error saving line:", error);
          showToast("Error al guardar la línea", "error");
          setIsSaving(false);
        }
      }, 100); // Small delay to ensure rendering is complete
    } catch (error) {
      console.error("Error saving line:", error);
      showToast("Error al guardar la línea", "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 p-6 rounded-lg shadow-md relative">
      {/* Toast notification */}
      {toast.type && (
        <div
          className={`absolute top-4 right-4 px-4 py-2 rounded-md shadow-md text-white flex items-center ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          } transition-opacity duration-300 ease-in-out`}
        >
          {toast.type === "success" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="route-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {tableType === "route"
            ? "Selecciona una ruta:"
            : "Selecciona un boulder:"}
        </label>
        <select
          id="route-select"
          onChange={handleRouteSelect}
          value={selectedRoute?.id || ""}
          className="block w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium"
        >
          <option value="" className="text-gray-500">
            {tableType === "route"
              ? "-- Selecciona una ruta --"
              : "-- Selecciona un boulder --"}
          </option>
          {routes.map((route: any) => (
            <option key={route.id} value={route.id} className="text-gray-900">
              {route.name}
            </option>
          ))}
        </select>
      </div>

      {image && (
        <div className="flex flex-wrap gap-2.5 mb-5">
          <button
            onClick={toggleDrawingMode}
            disabled={isLoading || isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {drawingMode ? "Cancelar Dibujo" : "Dibujar Línea de Ruta"}
          </button>
          {drawingMode && (
            <>
              <button
                onClick={undoLastPoint}
                disabled={points.length < 2 || isLoading || isSaving}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Deshacer Último Punto
              </button>
              <button
                onClick={finishLine}
                disabled={points.length < 4 || isLoading || isSaving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Finalizar Línea
              </button>
            </>
          )}
          {lineFinished && (
            <button
              onClick={saveLine}
              disabled={!selectedRoute || isLoading || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Guardando...
                </span>
              ) : (
                "Guardar Línea"
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-5">
        {/* Drawing Canvas Section */}
        <div className="border border-gray-300 rounded-lg overflow-x-auto mb-5 relative md:flex-1">
          {isLoading || imageLoading ? (
            <div className="flex items-center justify-center h-[300px] bg-gray-100">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-10 w-10 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="mt-2 text-gray-600">Cargando imagen...</p>
              </div>
            </div>
          ) : image ? (
            <div
              style={{
                minWidth: `${image.width}px`,
                width: `${image.width}px`,
              }}
            >
              <Stage
                width={image.width}
                height={image.height}
                onMouseDown={handleMouseDown}
                ref={stageRef}
              >
                <Layer>
                  <KonvaImage image={image} ref={imageRef} />

                  {lines.map((line, i) => (
                    <React.Fragment key={`line-${i}`}>
                      {/* Background/border line (slightly thicker, different color) */}
                      <Line
                        key={`border-${i}`}
                        points={line}
                        stroke="#5b00d2" // Black border
                        strokeWidth={8} // Slightly wider than the main line
                        tension={0}
                        lineCap="round"
                        lineJoin="round"
                      />
                      {/* Main line */}
                      <Line
                        key={`main-${i}`}
                        points={line}
                        stroke="white" // Original orange color
                        strokeWidth={4}
                        tension={0}
                        lineCap="round"
                        lineJoin="round"
                      />
                    </React.Fragment>
                  ))}

                  {drawingMode && points.length > 0 && (
                    <>
                      {/* Border line */}
                      <Line
                        points={points}
                        stroke="#5b00d2"
                        strokeWidth={8} // Thicker for border effect
                        tension={0}
                        lineCap="round"
                        lineJoin="round"
                      />
                      {/* Main line */}
                      <Line
                        points={points}
                        stroke="white"
                        strokeWidth={4}
                        tension={0}
                        lineCap="round"
                        lineJoin="round"
                      />

                      {/* Points remain the same */}
                      {Array.from({ length: points.length / 2 }).map((_, i) => (
                        <Circle
                          key={i}
                          x={points[i * 2]}
                          y={points[i * 2 + 1]}
                          radius={6}
                          fill="#5b00d2"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </>
                  )}
                </Layer>
              </Stage>
            </div>
          ) : noImageAvailable && selectedRoute ? (
            <div className="flex items-center justify-center h-[300px] bg-gray-100">
              <div className="text-center p-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="mt-2 text-gray-600">
                  No hay imagen disponible para{" "}
                  {tableType === "route" ? "esta ruta" : "este boulder"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] bg-gray-100">
              <div className="text-center p-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2 text-gray-600">
                  Selecciona una ruta para ver su imagen
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Saved Line Image Section */}
        <div className="border border-gray-300 rounded-lg overflow-x-auto mb-5 relative md:flex-1">
          <div className="flex items-center justify-center h-full min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-10 w-10 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="mt-2 text-gray-600">
                  Cargando imagen guardada...
                </p>
              </div>
            ) : lineSavedImage ? (
              <div
                style={{
                  minWidth: image ? `${image.width}px` : "auto",
                  width: image ? `${image.width}px` : "auto",
                }}
              >
                <img
                  src={lineSavedImage}
                  alt="Línea de ruta guardada"
                  width={image?.width}
                  height={image?.height}
                  style={{
                    width: image ? `${image.width}px` : "auto",
                    height: image ? `${image.height}px` : "auto",
                  }}
                />
              </div>
            ) : selectedRoute ? (
              <div className="text-center p-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2 text-gray-600">
                  No hay línea guardada disponible para esta ruta
                </p>
              </div>
            ) : (
              <div className="text-center p-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2 text-gray-600">
                  Selecciona una ruta para ver su línea guardada
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRoute && (
        <div className="text-sm text-gray-600 mt-2">
          <p>
            <span className="font-medium">
              {tableType === "route" ? "Ruta:" : "Boulder:"}
            </span>{" "}
            {selectedRoute.name}
          </p>
          {selectedRoute.grade && (
            <p>
              <span className="font-medium">Grado:</span> {selectedRoute.grade}
            </p>
          )}
          {selectedRoute.description && (
            <p>
              <span className="font-medium">Descripción:</span>{" "}
              {selectedRoute.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
