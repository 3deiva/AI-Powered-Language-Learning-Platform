import React, { useRef, useState, useEffect } from "react";

const DrawingCanvas = ({
  onSave,
  onConvertToText,
  canvasWidth = 400,
  canvasHeight = 300,
  allowResize = true,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [canvasSize, setCanvasSize] = useState("medium");
  const [isConverting, setIsConverting] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [lineThickness, setLineThickness] = useState(3);

  const sizeMappings = {
    small: { width: 300, height: 200 },
    medium: { width: 400, height: 300 },
    large: { width: 600, height: 350 },
    "full-width": { width: 0, height: 350 },
  };

  const getCanvasDimensions = () => {
    if (canvasSize === "full-width" && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      return {
        width: containerWidth - 20, // Account for padding
        height: sizeMappings["full-width"].height,
      };
    }
    return (
      sizeMappings[canvasSize] || { width: canvasWidth, height: canvasHeight }
    );
  };

  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const dimensions = getCanvasDimensions();
      initializeCanvas(dimensions.width, dimensions.height);
    }
  }, [canvasSize]);

  useEffect(() => {
    const dimensions = getCanvasDimensions();
    initializeCanvas(dimensions.width, dimensions.height);

    const handleResize = () => {
      if (
        canvasSize === "full-width" &&
        containerRef.current &&
        canvasRef.current
      ) {
        const dimensions = getCanvasDimensions();
        initializeCanvas(dimensions.width, dimensions.height, true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (context) {
      context.lineWidth = lineThickness;
    }
  }, [lineThickness, context]);

  const initializeCanvas = (width, height, keepContent = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Store the current image data if keeping content
    let imageData = null;
    if (keepContent && context && hasDrawing) {
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.lineWidth = lineThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
    setContext(ctx);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    // Restore the previous drawing if needed
    if (keepContent && imageData) {
      ctx.putImageData(imageData, 0, 0);
    }
  };

  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (event.touches && event.touches[0]) {
      return {
        x:
          (event.touches[0].clientX - rect.left) *
          (canvas.width / rect.width / window.devicePixelRatio),
        y:
          (event.touches[0].clientY - rect.top) *
          (canvas.height / rect.height / window.devicePixelRatio),
      };
    } else {
      return {
        x:
          (event.clientX - rect.left) *
          (canvas.width / rect.width / window.devicePixelRatio),
        y:
          (event.clientY - rect.top) *
          (canvas.height / rect.height / window.devicePixelRatio),
      };
    }
  };

  const startDrawing = (e) => {
    e.preventDefault();
    if (context) {
      const coords = getCoordinates(e);
      context.beginPath();
      context.moveTo(coords.x, coords.y);
      setIsDrawing(true);
      setHasDrawing(true);
    }
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !context) return;

    const coords = getCoordinates(e);
    context.lineTo(coords.x, coords.y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (context) {
      context.closePath();
      setIsDrawing(false);

      if (hasDrawing) {
        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];

        // Call the letter complete handler
        if (onSave) {
          onSave(base64Data);
        }
      }
    }
  };

  const handleClear = () => {
    if (context) {
      const dimensions = getCanvasDimensions();
      context.fillStyle = "white";
      context.fillRect(0, 0, dimensions.width, dimensions.height);
      setHasDrawing(false);
      if (onSave) {
        onSave(null);
      }
    }
  };

  const handleConvertToText = async () => {
    if (!canvasRef.current || !hasDrawing) return;

    setIsConverting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const base64Data = dataUrl.split(",")[1];

      if (onConvertToText) {
        const text = await onConvertToText(base64Data);
        return text;
      }
    } catch (error) {
      console.error("Conversion error:", error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSizeChange = (size) => {
    setCanvasSize(size);
    if (!hasDrawing) {
      handleClear();
    }
  };

  const handleLineThicknessChange = (e) => {
    setLineThickness(parseInt(e.target.value));
  };

  const styles = {
    container: {
      width: "100%",
      maxWidth: "100%",
      margin: "0 auto",
      padding: "10px",
      fontFamily: "Arial, sans-serif",
    },
    canvasSizeControls: {
      marginBottom: "15px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    controlGroup: {
      marginBottom: "10px",
    },
    label: {
      fontWeight: "bold",
      marginBottom: "5px",
      display: "block",
    },
    sizeButtons: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
    },
    button: {
      padding: "8px 12px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      cursor: "pointer",
      backgroundColor: "#3a3a3a", // Dark background
      color: "#ffffff", // White text
      transition: "all 0.2s ease",
    },
    activeButton: {
      backgroundColor: "#0056b3", // Darker blue for better contrast
      color: "#ffffff",
      border: "1px solid #003d80",
    },
    lineThicknessControl: {
      width: "100%",
    },
    rangeInput: {
      width: "100%",
      margin: "8px 0",
    },
    canvas: {
      border: "1px solid #ccc",
      borderRadius: "4px",
      touchAction: "none",
      cursor: "crosshair",
      backgroundColor: "white",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
    canvasControls: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "15px",
      gap: "10px",
    },
    clearButton: {
      padding: "8px 16px",
      backgroundColor: "#d32f2f", // Darker red
      color: "#ffffff", // White text
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontWeight: "bold",
      flexGrow: 1,
    },
    convertButton: {
      padding: "8px 16px",
      backgroundColor: "#2e7d32", // Darker green
      color: "#ffffff", // White text
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontWeight: "bold",
      flexGrow: 1,
    },
    disabledButton: {
      backgroundColor: "#666666", // Dark gray for disabled
      cursor: "not-allowed",
      color: "#cccccc", // Light gray text for disabled
    },
  };

  return (
    <div
      style={styles.container}
      ref={containerRef}
      className="drawing-canvas-container"
    >
      {allowResize && (
        <div style={styles.canvasSizeControls} className="canvas-size-controls">
          <div style={styles.controlGroup} className="control-group">
            <label style={styles.label}>Canvas Size:</label>
            <div style={styles.sizeButtons} className="size-buttons">
              <button
                style={
                  canvasSize === "small"
                    ? { ...styles.button, ...styles.activeButton }
                    : styles.button
                }
                onClick={() => handleSizeChange("small")}
                className={canvasSize === "small" ? "active" : ""}
              >
                Small
              </button>
              <button
                style={
                  canvasSize === "medium"
                    ? { ...styles.button, ...styles.activeButton }
                    : styles.button
                }
                onClick={() => handleSizeChange("medium")}
                className={canvasSize === "medium" ? "active" : ""}
              >
                Medium
              </button>
              <button
                style={
                  canvasSize === "large"
                    ? { ...styles.button, ...styles.activeButton }
                    : styles.button
                }
                onClick={() => handleSizeChange("large")}
                className={canvasSize === "large" ? "active" : ""}
              >
                Large
              </button>
              <button
                style={
                  canvasSize === "full-width"
                    ? { ...styles.button, ...styles.activeButton }
                    : styles.button
                }
                onClick={() => handleSizeChange("full-width")}
                className={canvasSize === "full-width" ? "active" : ""}
              >
                Full Width
              </button>
            </div>
          </div>

          <div
            style={styles.lineThicknessControl}
            className="line-thickness-control"
          >
            <label style={styles.label} htmlFor="thickness">
              Line Thickness: {lineThickness}px
            </label>
            <input
              style={styles.rangeInput}
              type="range"
              id="thickness"
              name="thickness"
              min="1"
              max="10"
              value={lineThickness}
              onChange={handleLineThicknessChange}
            />
          </div>
        </div>
      )}

      <canvas
        style={styles.canvas}
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />

      <div style={styles.canvasControls} className="canvas-controls">
        <button
          style={styles.clearButton}
          onClick={handleClear}
          className="clear-button"
        >
          Clear Canvas
        </button>
        {onConvertToText && (
          <button
            style={
              isConverting || !hasDrawing
                ? { ...styles.convertButton, ...styles.disabledButton }
                : styles.convertButton
            }
            onClick={handleConvertToText}
            disabled={isConverting || !hasDrawing}
            className="convert-button"
          >
            {isConverting ? "Converting..." : "Convert to Text"}
          </button>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;
