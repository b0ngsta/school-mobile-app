// Projection of the baked Earth picture (pure math, no React). Must match
// tools/earth/render.py, which bakes src/assets/home/orbit_scene.webp:
//   body (X east, Y north, Z to the viewer on the central meridian)
//   → north pole tipped toward the viewer by BETA (about X)
//   → turned in the screen plane by TILT so the axis leans right.
// Used to place the text drawn over the picture (line names, the tilt).

export const TILT = 23.44; // Earth's axial tilt, degrees
export const BETA = 18; // north pole tipped toward the viewer, degrees

const RAD = Math.PI / 180;

/** Screen point (x right, y down, in Earth radii) of (lat, lon − central lon), plus depth. */
export function project(latDeg: number, lonRelDeg: number): { x: number; y: number; z: number } {
  const lat = latDeg * RAD;
  const lon = lonRelDeg * RAD;
  const X = Math.cos(lat) * Math.sin(lon);
  const Y = Math.sin(lat);
  const Z = Math.cos(lat) * Math.cos(lon);
  const Y2 = Y * Math.cos(BETA * RAD) - Z * Math.sin(BETA * RAD);
  const Z2 = Y * Math.sin(BETA * RAD) + Z * Math.cos(BETA * RAD);
  const ct = Math.cos(TILT * RAD);
  const st = Math.sin(TILT * RAD);
  return { x: X * ct + Y2 * st, y: X * st - Y2 * ct, z: Z2 };
}

/** Projected north pole (Earth radii). */
export function northPole(): { x: number; y: number } {
  const { x, y } = project(90, 0);
  return { x, y };
}

/**
 * Where to write a latitude line's name: the visible point of that line
 * nearest to `targetX` (Earth radii), and the line's slope there (degrees).
 */
export function latitudeLabel(latDeg: number, targetX: number): { x: number; y: number; angle: number } {
  let best = { x: 0, y: 0, angle: 0 };
  let bestD = Infinity;
  for (let lon = -179; lon <= 179; lon += 1) {
    const p = project(latDeg, lon);
    const dx = Math.abs(p.x - targetX);
    if (p.z < 0.35 || dx >= bestD) continue;
    const a = project(latDeg, lon - 2);
    const b = project(latDeg, lon + 2);
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    bestD = dx;
    best = { x: p.x, y: p.y, angle };
  }
  return best;
}
