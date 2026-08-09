import { useState, useRef, useCallback } from "react";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { parseSvgMarkup } from "../../lib/importSvg";

export interface SvgImportParams {
  saveToHistory: () => void;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  setElementProperties: React.Dispatch<React.SetStateAction<Record<string, ElementProperties>>>;
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLayerId: (id: string | null) => void;
}

export function useSvgImport(params: SvgImportParams) {
  const {
    saveToHistory,
    setLayers,
    setElementProperties,
    setSelectedLayerIds,
    setSelectedLayerId,
  } = params;

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const svgFiles = files.filter((f) => f.name.endsWith(".svg") || f.type === "image/svg+xml");
      if (svgFiles.length === 0) return;

      for (const file of svgFiles) {
        try {
          const text = await file.text();
          const result = parseSvgMarkup(text);

          if (result.layers.length > 0) {
            saveToHistory();
            setLayers((prev) => [
              ...prev.map((l) => ({ ...l, active: false })),
              ...result.layers.map((l) => ({ ...l, active: false })),
            ]);
            setElementProperties((prev) => ({ ...prev, ...result.elementProperties }));
            const firstId = result.layers[0].id;
            setSelectedLayerIds([firstId]);
            setSelectedLayerId(firstId);
          }
        } catch (err) {
          console.error("Failed to import SVG:", err);
        }
      }
    },
    [saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  return {
    isDragOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  };
}
