/**
 * Thickness Heatmap Analyzer
 *
 * Computes per-vertex distances from the shoe surface to the last surface.
 * Uses three-mesh-bvh for fast closest-point spatial queries.
 *
 * All distance computation is done in WORLD space (both geometries transformed
 * by their matrixWorld before BVH build / query), so mesh position/rotation/
 * scale and FFD deformations are all correctly accounted for.
 *  _   __  ____ ____  ____  _
 * | |  \ \/ ___| __ )|  _ \| |
 * | |   \  / __|  _ \| |_)   |
 * | |___/  \__ | |_)    _ <| |___
 * |______/\____/____/|_| \_______|
 * __________________________________
 * Project: FootwearMaker
 * Author: Alex Gabriel
 * Company: Pixolid UG
 * Date: 2026-03-02
 * __________________________________
 **/
import * as THREE from 'three'
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  type GeometryBVH,
  type HitPointInfo,
} from 'three-mesh-bvh'

// Extend Three.js prototypes once at module level (idempotent re-assignment)
;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
;(THREE.Mesh.prototype as any).raycast = acceleratedRaycast

// ── Color scale (distances in mm) ────────────────────────────────────────────
const COLOR_BANDS: Array<{ min: number; color: THREE.Color }> = [
  { min: 5.00, color: new THREE.Color('#00ff88') }, // ≥ 5 mm    → Bright Green
  { min: 4.01, color: new THREE.Color('#88ff00') }, // 4.01–4.99 → Lime
  { min: 3.01, color: new THREE.Color('#ffee00') }, // 3.01–4.00 → Bright Yellow
  { min: 2.01, color: new THREE.Color('#ff8800') }, // 2.01–3.00 → Bright Orange
  { min: 1.01, color: new THREE.Color('#ff2200') }, // 1.01–2.00 → Bright Red
  { min: 0.01, color: new THREE.Color('#ff0066') }, // 0.01–1.00 → Magenta
  { min: 0.00, color: new THREE.Color('#8800cc') }, // 0.00      → Purple
]

function distanceToColor(distanceMM: number): THREE.Color {
  for (const band of COLOR_BANDS) {
    if (distanceMM >= band.min) return band.color
  }
  return COLOR_BANDS[COLOR_BANDS.length - 1].color
}

/**
 * Compute per-vertex thickness colors for `shoeMesh` relative to `lastMesh`.
 *
 * Each shoe vertex is projected to world space, then the closest point on
 * the last surface (also in world space) is found via BVH. The distance
 * (in scene units) is multiplied by `sceneUnitToMM` to get millimetres and
 * then mapped to a color band.
 *
 * @param shoeMesh      Source mesh — distances are measured from each of its vertices
 * @param lastMesh      Target surface — shoe vertices are compared to this
 * @param sceneUnitToMM Conversion: how many mm equals 1 scene unit.
 *                      Use `estimateSceneUnitToMM()` from meshHelpers.ts.
 * @returns Float32Array of `vertexCount × 3` RGB values (each component 0–1).
 *          Pass directly to `THREE.BufferAttribute(colors, 3)`.
 */
export function computeThicknessColors(
  shoeMesh: THREE.Mesh,
  lastMesh: THREE.Mesh,
  sceneUnitToMM: number,
): Float32Array {
  // Ensure world matrices are current (same pattern as CSG computation)
  shoeMesh.updateMatrix()
  shoeMesh.updateMatrixWorld(true)
  lastMesh.updateMatrix()
  lastMesh.updateMatrixWorld(true)

  // ── Build world-space BVH on the last geometry ───────────────────────────
  // Clone and bake the last's world transform in so BVH operates in world
  // coordinates. This correctly handles position, rotation, scale, and FFD.
  const lastWorldGeo = lastMesh.geometry.clone()
  lastWorldGeo.applyMatrix4(lastMesh.matrixWorld)
  ;(lastWorldGeo as any).computeBoundsTree()
  const boundsTree = lastWorldGeo.boundsTree as GeometryBVH

  // ── Loop over shoe vertices ───────────────────────────────────────────────
  const shoePositions = shoeMesh.geometry.attributes.position
  const vertexCount = shoePositions.count
  const colors = new Float32Array(vertexCount * 3)

  const tempPoint = new THREE.Vector3()
  const hitTarget: HitPointInfo = {
    point: new THREE.Vector3(),
    distance: 0,
    faceIndex: 0,
  }

  for (let i = 0; i < vertexCount; i++) {
    // Shoe vertex → world space
    tempPoint.fromBufferAttribute(shoePositions, i).applyMatrix4(shoeMesh.matrixWorld)

    const hit = boundsTree.closestPointToPoint(tempPoint, hitTarget)
    const distanceMM = hit ? hit.distance * sceneUnitToMM : 0
    const color = distanceToColor(distanceMM)

    colors[i * 3]     = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  // Clean up the temporary world-space geometry
  ;(lastWorldGeo as any).disposeBoundsTree()
  lastWorldGeo.dispose()

  return colors
}
