/**
 * Linear interpolation for smooth 60FPS camera and arcade motion
 */
export const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Normalizes pointer/touch coordinates to [0..1] device-independent space
 * so iPhone 11 (375x812) and Galaxy S24 Ultra (1440x3120) map identically.
 */
export const normalizeCanvasCoords = (clientX, clientY, canvasRect) => {
  if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
    return { nx: 0.5, ny: 0.5 };
  }
  const nx = clamp((clientX - canvasRect.left) / canvasRect.width, 0, 1);
  const ny = clamp((clientY - canvasRect.top) / canvasRect.height, 0, 1);
  return { nx, ny };
};

export const denormalizeCanvasCoords = (nx, ny, width, height) => ({
  x: nx * width,
  y: ny * height,
});

