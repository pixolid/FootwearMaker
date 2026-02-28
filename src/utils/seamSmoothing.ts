import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// ── Public API ──────────────────────────────────────────────────────────────

export interface SmoothingOptions {
  /** Smoothing intensity per iteration. 0–1. Default: 0.8 */
  strength: number
  /** Override iteration count. 0 = auto-compute from radius. Default: 0 */
  iterations: number
  /** Fillet width in world units — how far from the seam the rounding extends. Default: 0.02 */
  radius: number
}

const DEFAULT_OPTIONS: SmoothingOptions = {
  strength: 0.8,
  iterations: 0,
  radius: 0.02,
}

/**
 * Smooth the CSG cut-seam edges to produce a CAD-like fillet.
 *
 * Pipeline:
 * 1.  Merge coincident vertices (position-only) to build adjacency
 * 1b. Iterative weld boundary vertices + remove degenerate/duplicate faces
 * 2.  Identify sharp seam edges via dihedral angle + tool surface proximity
 * 3.  Collect seam edge segments for distance computation
 * 3b. Bridge split for gap bridging (small radius only — creates midpoints)
 * 4.  Fine split in fillet zone (radius-dependent, T-junction free)
 * 4b. Iterative re-weld + remove degenerate/duplicate faces
 * 5-7. Distance field, falloff weights, Laplacian smoothing
 * 8b. Remove degenerate + duplicate faces (area + index based)
 * 8c. Close remaining boundary holes (safety net, cap 200)
 * 9.  De-index to non-indexed geometry with recomputed normals
 */
export function smoothSeam(
  resultGeometry: THREE.BufferGeometry,
  toolGeometry: THREE.BufferGeometry,
  options?: Partial<SmoothingOptions>,
): THREE.BufferGeometry {
  const opts: SmoothingOptions = { ...DEFAULT_OPTIONS, ...options }

  if (opts.strength <= 0) {
    const clone = resultGeometry.clone()
    clone.computeVertexNormals()
    return clone
  }

  // ── Step 1: Merge vertices (position-only) ──────────────────────────────
  const posOnly = resultGeometry.clone()
  for (const name of Object.keys(posOnly.attributes)) {
    if (name !== 'position') posOnly.deleteAttribute(name)
  }

  // Adaptive tolerance based on mesh scale — catches CSG floating-point gaps
  posOnly.computeBoundingBox()
  const meshBBox = posOnly.boundingBox!
  const meshScale = Math.max(
    meshBBox.max.x - meshBBox.min.x,
    meshBBox.max.y - meshBBox.min.y,
    meshBBox.max.z - meshBBox.min.z,
  )
  const mergeTolerance = Math.max(1e-4, meshScale * 2e-4)
  const indexed = mergeVertices(posOnly, mergeTolerance)
  if (!indexed.index) {
    const clone = resultGeometry.clone()
    clone.computeVertexNormals()
    return clone
  }

  const indexArr = indexed.index.array
  const posAttr = indexed.attributes.position

  // Copy into mutable JS arrays for the splitting step
  const positions: number[] = []
  for (let i = 0; i < posAttr.count; i++) {
    positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
  }
  const indices: number[] = Array.from(indexArr)

  // ── Step 1b: Iterative weld boundary vertices + degenerate removal ────
  // Catches CSG float gaps that mergeVertices missed — targets ONLY boundary
  // vertices so the tolerance doesn't over-merge interior vertices.
  // Iterative: after degenerate removal, new boundary vertices may appear
  // (previously interior, now exposed). Each pass catches them.
  const weldTolerance = Math.max(5e-4, meshScale * 3e-3)
  for (let pass = 0; pass < 3; pass++) {
    if (!weldBoundaryVertices(positions, indices, weldTolerance)) break
    removeDegenerateFaces(indices)
  }

  // ── Step 2: Find sharp edges → seam vertices ───────────────────────────
  const seamVerts = findSeamVertices(positions, indices, toolGeometry)

  if (seamVerts.size === 0) {
    const clone = resultGeometry.clone()
    clone.computeVertexNormals()
    return clone
  }

  // ── Step 3: Collect seam edge segments ─────────────────────────────────
  const seamSegments = collectSeamEdgeSegments(positions, indices, seamVerts)

  // Fallback: if no edge segments, use seam vertex positions as point targets
  if (seamSegments.length === 0) {
    for (const vi of seamVerts) {
      const p = new THREE.Vector3(
        positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2],
      )
      seamSegments.push({ p0: p, p1: p.clone() })
    }
  }

  // ── Step 3b: Bridge split for gap bridging at small radius ─────────
  // At small fillet radius, step 4 covers a narrow zone and creates few
  // midpoints. This leaves CSG seam gaps un-bridged. A coarse split over
  // a wider zone creates midpoints that weldBoundaryVertices can merge.
  // Only activates when the fillet zone would be too narrow.
  const minSplitRadius = meshScale * 0.15
  if (opts.radius < minSplitRadius) {
    const bridgeTarget = Math.max(meshScale * 0.01, 0.005)
    splitSeamEdges(positions, indices, seamVerts, seamSegments, minSplitRadius, bridgeTarget, 2)
    weldBoundaryVertices(positions, indices, weldTolerance)
    removeDegenerateFaces(indices)
  }

  // ── Step 4: Split long edges in fillet zone (T-junction free) ──────────
  const targetLength = Math.max(opts.radius / 12, 0.003)
  splitSeamEdges(positions, indices, seamVerts, seamSegments, opts.radius, targetLength, 8)

  // ── Step 4b: Iterative re-weld boundary vertices after splitting ───────
  // Edge splitting may create duplicate midpoints at unmerged boundary edges.
  // Iterative to catch cascading boundary exposure from degenerate removal.
  for (let pass = 0; pass < 3; pass++) {
    if (!weldBoundaryVertices(positions, indices, weldTolerance)) break
    removeDegenerateFaces(indices)
  }

  // ── Step 5: Build adjacency ────────────────────────────────────────────
  const vertCount = positions.length / 3
  const adjacency = buildAdjacency(indices, vertCount)

  // ── Step 6: Compute distance field from seam edge segments ─────────────
  const distField = computeDistanceField(
    positions, vertCount, seamSegments, opts.radius * 1.3,
  )

  // ── Step 7: Compute smoothstep falloff weights ─────────────────────────
  const weights = computeSmoothstepWeights(distField, opts.radius, vertCount)

  // ── Step 8: Pure weighted Laplacian smoothing ──────────────────────────
  const numIterations = opts.iterations > 0
    ? opts.iterations
    : Math.max(20, Math.min(150, Math.floor(opts.radius * 120)))

  const lambda = 0.4 + 0.4 * opts.strength
  const maxStep = targetLength * 0.4

  const pos = new Float64Array(vertCount * 3)
  for (let i = 0; i < vertCount * 3; i++) {
    pos[i] = positions[i]
  }

  for (let iter = 0; iter < numIterations; iter++) {
    applyLaplacianStep(pos, adjacency, weights, vertCount, lambda, maxStep)
  }

  // ── Step 8b: Remove degenerate + duplicate faces BEFORE hole closing ──
  // Must happen BEFORE closeBoundaryHoles so that boundary edges exposed
  // by removing degenerate faces are visible to the hole-filling algorithm.
  // Degenerate faces come from: (a) welding collapsing face indices,
  // (b) smoothing collapsing face geometry to zero area.
  // Duplicate faces come from: (c) welding two vertices that shared an
  // adjacent face, creating two faces with identical vertex sets.
  {
    const AREA_SQ_THRESHOLD = 1e-10
    const seen = new Set<string>()
    let write = 0
    for (let f = 0; f < indices.length / 3; f++) {
      const a = indices[f * 3], b = indices[f * 3 + 1], c = indices[f * 3 + 2]
      // Skip faces with duplicate indices (from welding)
      if (a === b || b === c || a === c) continue
      // Skip duplicate faces (same 3 vertices in any winding order)
      const s0 = Math.min(a, b, c)
      const s2 = Math.max(a, b, c)
      const s1 = a + b + c - s0 - s2
      const fKey = `${s0}_${s1}_${s2}`
      if (seen.has(fKey)) continue
      seen.add(fKey)
      // Skip zero-area faces (from smoothing collapse)
      const abx = pos[b * 3] - pos[a * 3]
      const aby = pos[b * 3 + 1] - pos[a * 3 + 1]
      const abz = pos[b * 3 + 2] - pos[a * 3 + 2]
      const acx = pos[c * 3] - pos[a * 3]
      const acy = pos[c * 3 + 1] - pos[a * 3 + 1]
      const acz = pos[c * 3 + 2] - pos[a * 3 + 2]
      const cx = aby * acz - abz * acy
      const cy = abz * acx - abx * acz
      const cz = abx * acy - aby * acx
      if (cx * cx + cy * cy + cz * cz <= AREA_SQ_THRESHOLD) continue
      indices[write] = a; indices[write + 1] = b; indices[write + 2] = c
      write += 3
    }
    indices.length = write
  }

  // ── Step 8c: Close boundary holes (safety net) ─────────────────────────
  // Now that ALL degenerate faces are removed, boundary edges are correctly
  // exposed and closeBoundaryHoles can detect and fill them.
  const finalPos = closeBoundaryHoles(pos, indices, meshScale)

  // ── Step 9: De-index to non-indexed geometry ───────────────────────────
  const faceCount = indices.length / 3
  const outPos = new Float32Array(faceCount * 9)
  for (let f = 0; f < faceCount; f++) {
    for (let v = 0; v < 3; v++) {
      const vi = indices[f * 3 + v]
      outPos[(f * 3 + v) * 3] = finalPos[vi * 3]
      outPos[(f * 3 + v) * 3 + 1] = finalPos[vi * 3 + 1]
      outPos[(f * 3 + v) * 3 + 2] = finalPos[vi * 3 + 2]
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3))
  geo.computeVertexNormals()
  return geo
}

// ── Seam detection ────────────────────────────────────────────────────────

function findSeamVertices(
  positions: number[],
  indices: number[],
  toolGeometry: THREE.BufferGeometry,
): Set<number> {
  const faceCount = indices.length / 3

  // Face normals
  const faceNormals: THREE.Vector3[] = []
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3()
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
    tA.set(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2])
    tB.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2])
    tC.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2])
    faceNormals.push(
      new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(tB, tA),
        new THREE.Vector3().subVectors(tC, tA),
      ).normalize(),
    )
  }

  // Edge map for dihedral angle detection
  const edgeMap = new Map<string, { v0: number; v1: number; faces: number[] }>()
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
    for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]]) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!edgeMap.has(key)) edgeMap.set(key, { v0: Math.min(a, b), v1: Math.max(a, b), faces: [] })
      edgeMap.get(key)!.faces.push(f)
    }
  }

  const ANGLE_THRESHOLD = 25 * (Math.PI / 180)
  const sharpVerts = new Set<number>()
  for (const edge of edgeMap.values()) {
    if (edge.faces.length !== 2) {
      sharpVerts.add(edge.v0); sharpVerts.add(edge.v1)
      continue
    }
    const dot = THREE.MathUtils.clamp(
      faceNormals[edge.faces[0]].dot(faceNormals[edge.faces[1]]), -1, 1,
    )
    if (Math.acos(dot) > ANGLE_THRESHOLD) {
      sharpVerts.add(edge.v0); sharpVerts.add(edge.v1)
    }
  }

  if (sharpVerts.size === 0) return sharpVerts

  // Filter to only those near the tool surface
  const toolTris = buildTriangleList(toolGeometry)
  const toolBBox = new THREE.Box3()
  toolGeometry.computeBoundingBox()
  if (toolGeometry.boundingBox) toolBBox.copy(toolGeometry.boundingBox)
  toolBBox.expandByScalar(0.03)

  const seamVerts = new Set<number>()
  const tv = new THREE.Vector3()
  for (const vi of sharpVerts) {
    tv.set(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2])
    if (!toolBBox.containsPoint(tv)) continue
    if (pointNearAnyTriangle(tv, toolTris, 0.015)) seamVerts.add(vi)
  }
  return seamVerts.size > 0 ? seamVerts : sharpVerts
}

// ── Seam edge segment collection ─────────────────────────────────────────

interface SeamSegment {
  p0: THREE.Vector3
  p1: THREE.Vector3
}

function collectSeamEdgeSegments(
  positions: number[],
  indices: number[],
  seamVerts: Set<number>,
): SeamSegment[] {
  const seen = new Set<string>()
  const segments: SeamSegment[] = []
  const faceCount = indices.length / 3

  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
    for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]]) {
      if (!seamVerts.has(a) || !seamVerts.has(b)) continue
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (seen.has(key)) continue
      seen.add(key)
      segments.push({
        p0: new THREE.Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]),
        p1: new THREE.Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]),
      })
    }
  }
  return segments
}

// ── Point-to-segment distance ────────────────────────────────────────────

function pointToSegmentDistance(
  px: number, py: number, pz: number,
  s0x: number, s0y: number, s0z: number,
  s1x: number, s1y: number, s1z: number,
): number {
  const abx = s1x - s0x, aby = s1y - s0y, abz = s1z - s0z
  const apx = px - s0x, apy = py - s0y, apz = pz - s0z
  const abLenSq = abx * abx + aby * aby + abz * abz

  // Degenerate segment (zero length) → point-to-point distance
  if (abLenSq < 1e-12) {
    return Math.sqrt(apx * apx + apy * apy + apz * apz)
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq))
  const cx = s0x + t * abx - px
  const cy = s0y + t * aby - py
  const cz = s0z + t * abz - pz
  return Math.sqrt(cx * cx + cy * cy + cz * cz)
}

// ── Distance field computation ───────────────────────────────────────────

function computeDistanceField(
  positions: number[],
  vertCount: number,
  seamSegments: SeamSegment[],
  maxDistance: number,
): Float32Array {
  const dist = new Float32Array(vertCount).fill(Infinity)

  // Build AABB around all seam segments for early rejection
  const bbox = new THREE.Box3()
  for (const seg of seamSegments) {
    bbox.expandByPoint(seg.p0)
    bbox.expandByPoint(seg.p1)
  }
  bbox.expandByScalar(maxDistance)

  const p = new THREE.Vector3()
  for (let vi = 0; vi < vertCount; vi++) {
    const px = positions[vi * 3]
    const py = positions[vi * 3 + 1]
    const pz = positions[vi * 3 + 2]

    // Quick AABB rejection
    p.set(px, py, pz)
    if (!bbox.containsPoint(p)) continue

    let minD = Infinity
    for (const seg of seamSegments) {
      const d = pointToSegmentDistance(
        px, py, pz,
        seg.p0.x, seg.p0.y, seg.p0.z,
        seg.p1.x, seg.p1.y, seg.p1.z,
      )
      if (d < minD) minD = d
      if (minD < 1e-8) break // on the seam, no need to check more
    }
    dist[vi] = minD
  }

  return dist
}

// ── Smoothstep falloff weights ───────────────────────────────────────────

function computeSmoothstepWeights(
  distField: Float32Array,
  radius: number,
  vertCount: number,
): Float32Array {
  const weights = new Float32Array(vertCount)
  for (let i = 0; i < vertCount; i++) {
    const d = distField[i]
    if (d >= radius) {
      weights[i] = 0
      continue
    }
    // t = 1.0 at seam (dist=0), 0.0 at radius boundary
    const t = 1 - d / radius
    // Cubic Hermite smoothstep: zero-derivative at both endpoints
    weights[i] = t * t * (3 - 2 * t)
  }
  return weights
}

// ── T-junction-free edge splitting ────────────────────────────────────────

/**
 * Splits long edges within the fillet zone. Processes ALL edges in a face
 * atomically to avoid T-junctions. Uses distance to seam segments to
 * determine which edges are in the fillet zone.
 */
function splitSeamEdges(
  positions: number[],
  indices: number[],
  seamVerts: Set<number>,
  seamSegments: SeamSegment[],
  radius: number,
  targetLength: number,
  maxPasses: number,
): void {
  const initialVertCount = positions.length / 3
  const maxVertCount = initialVertCount * 5
  const splitZone = radius * 1.2

  for (let pass = 0; pass < maxPasses; pass++) {
    if (positions.length / 3 >= maxVertCount) break

    const faceCount = indices.length / 3
    const currentVertCount = positions.length / 3

    // Pre-cache which vertices are near the seam
    const nearSeam = new Uint8Array(currentVertCount)
    for (let vi = 0; vi < currentVertCount; vi++) {
      const px = positions[vi * 3], py = positions[vi * 3 + 1], pz = positions[vi * 3 + 2]
      for (const seg of seamSegments) {
        const d = pointToSegmentDistance(
          px, py, pz,
          seg.p0.x, seg.p0.y, seg.p0.z,
          seg.p1.x, seg.p1.y, seg.p1.z,
        )
        if (d < splitZone) { nearSeam[vi] = 1; break }
      }
    }

    // Identify edges to split and create midpoints upfront
    const edgeMidpoints = new Map<string, number>()

    for (let f = 0; f < faceCount; f++) {
      const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
      for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]]) {
        // At least one endpoint must be in the fillet zone
        if (!nearSeam[a] && !nearSeam[b]) continue
        const key = a < b ? `${a}_${b}` : `${b}_${a}`
        if (edgeMidpoints.has(key)) continue

        const dx = positions[b * 3] - positions[a * 3]
        const dy = positions[b * 3 + 1] - positions[a * 3 + 1]
        const dz = positions[b * 3 + 2] - positions[a * 3 + 2]
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (len <= targetLength) continue
        if (positions.length / 3 >= maxVertCount) break

        // Create midpoint vertex
        const midIdx = positions.length / 3
        positions.push(
          (positions[a * 3] + positions[b * 3]) / 2,
          (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2,
          (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2,
        )
        edgeMidpoints.set(key, midIdx)

        // Mark midpoint as seam if both endpoints are seam
        if (seamVerts.has(a) && seamVerts.has(b)) {
          seamVerts.add(midIdx)
        }
      }
    }

    if (edgeMidpoints.size === 0) break // converged

    // Rebuild ALL faces atomically: handle 0/1/2/3 split edges per face
    const newIndices: number[] = []

    for (let f = 0; f < faceCount; f++) {
      const v0 = indices[f * 3]
      const v1 = indices[f * 3 + 1]
      const v2 = indices[f * 3 + 2]

      const k01 = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`
      const k12 = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`
      const k20 = v2 < v0 ? `${v2}_${v0}` : `${v0}_${v2}`

      const m01 = edgeMidpoints.get(k01)
      const m12 = edgeMidpoints.get(k12)
      const m20 = edgeMidpoints.get(k20)

      const splitCount = (m01 !== undefined ? 1 : 0)
        + (m12 !== undefined ? 1 : 0)
        + (m20 !== undefined ? 1 : 0)

      if (splitCount === 0) {
        newIndices.push(v0, v1, v2)
      } else if (splitCount === 1) {
        if (m01 !== undefined) {
          newIndices.push(v0, m01, v2)
          newIndices.push(m01, v1, v2)
        } else if (m12 !== undefined) {
          newIndices.push(v0, v1, m12)
          newIndices.push(v0, m12, v2)
        } else {
          newIndices.push(v0, v1, m20!)
          newIndices.push(m20!, v1, v2)
        }
      } else if (splitCount === 2) {
        if (m01 !== undefined && m12 !== undefined) {
          newIndices.push(v0, m01, m12)
          newIndices.push(v0, m12, v2)
          newIndices.push(m01, v1, m12)
        } else if (m12 !== undefined && m20 !== undefined) {
          newIndices.push(v0, v1, m12)
          newIndices.push(v0, m12, m20)
          newIndices.push(m20, m12, v2)
        } else {
          newIndices.push(v0, m01!, m20!)
          newIndices.push(m01!, v1, v2)
          newIndices.push(m20!, m01!, v2)
        }
      } else {
        // All three edges split → 4 faces (Loop-style subdivision)
        newIndices.push(v0, m01!, m20!)
        newIndices.push(m01!, v1, m12!)
        newIndices.push(m20!, m12!, v2)
        newIndices.push(m01!, m12!, m20!)
      }
    }

    // Replace indices
    indices.length = 0
    for (let i = 0; i < newIndices.length; i++) {
      indices.push(newIndices[i])
    }
  }
}

// ── Adjacency builder ─────────────────────────────────────────────────────

function buildAdjacency(indices: number[], vertCount: number): number[][] {
  const adjSets: Set<number>[] = Array.from({ length: vertCount }, () => new Set())
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2]
    adjSets[a].add(b); adjSets[a].add(c)
    adjSets[b].add(a); adjSets[b].add(c)
    adjSets[c].add(a); adjSets[c].add(b)
  }
  return adjSets.map(s => Array.from(s))
}

// ── Pure uniform Laplacian step ──────────────────────────────────────────

/**
 * Uniform Laplacian displacement with per-step clamping.
 * Each vertex moves toward the average of its neighbors, weighted by the
 * per-vertex falloff weight. Displacement is clamped to maxStep to prevent
 * face inversions (vertices overshooting past their neighbors).
 * Pure shrinking (no Taubin mu step) — correct for fillet creation.
 */
function applyLaplacianStep(
  pos: Float64Array,
  adjacency: number[][],
  weights: Float32Array,
  vertCount: number,
  lambda: number,
  maxStep: number,
): void {
  const prev = new Float64Array(pos)

  for (let vi = 0; vi < vertCount; vi++) {
    const w = weights[vi]
    if (w <= 0) continue
    const nbrs = adjacency[vi]
    if (nbrs.length === 0) continue

    const vx = prev[vi * 3], vy = prev[vi * 3 + 1], vz = prev[vi * 3 + 2]
    let ax = 0, ay = 0, az = 0

    for (const ni of nbrs) {
      ax += prev[ni * 3]
      ay += prev[ni * 3 + 1]
      az += prev[ni * 3 + 2]
    }

    // Uniform Laplacian: average of neighbors
    const n = nbrs.length
    ax /= n; ay /= n; az /= n

    // Displacement toward neighbor average, modulated by falloff weight and lambda
    const f = w * lambda
    let dx = (ax - vx) * f
    let dy = (ay - vy) * f
    let dz = (az - vz) * f

    // Clamp displacement magnitude to prevent face inversions
    const dispLen = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dispLen > maxStep) {
      const scale = maxStep / dispLen
      dx *= scale; dy *= scale; dz *= scale
    }

    pos[vi * 3] += dx
    pos[vi * 3 + 1] += dy
    pos[vi * 3 + 2] += dz
  }
}

// ── Targeted boundary vertex welding ──────────────────────────────────────

/**
 * Targeted merge of boundary vertices only. Finds boundary edges
 * (face count = 1), collects their vertices, and merges pairs that
 * are within tolerance. Uses union-find for transitive closure.
 *
 * Much more aggressive tolerance than the global merge — safe because
 * only boundary-to-boundary vertex pairs are considered.
 *
 * This is the primary fix for CSG seam holes: boundary vertices that
 * should be the same but weren't merged by mergeVertices() get welded
 * here, eliminating boundary edges at their source.
 */
function weldBoundaryVertices(
  positions: number[],
  indices: number[],
  tolerance: number,
): boolean {
  // 1. Find boundary edges (edge face count = 1)
  const edgeFaceCount = new Map<string, number>()
  const faceCount = indices.length / 3
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
    for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]]) {
      const key = Math.min(a, b) + '_' + Math.max(a, b)
      edgeFaceCount.set(key, (edgeFaceCount.get(key) ?? 0) + 1)
    }
  }

  // 2. Collect boundary vertex indices
  const boundaryVerts: number[] = []
  const isBoundary = new Set<number>()
  for (const [key, count] of edgeFaceCount) {
    if (count !== 1) continue
    const sep = key.indexOf('_')
    const a = parseInt(key.substring(0, sep))
    const b = parseInt(key.substring(sep + 1))
    if (!isBoundary.has(a)) { isBoundary.add(a); boundaryVerts.push(a) }
    if (!isBoundary.has(b)) { isBoundary.add(b); boundaryVerts.push(b) }
  }

  if (boundaryVerts.length === 0) return false

  // 3. Union-find: merge boundary vertices within tolerance
  const parent = new Map<number, number>()

  function find(x: number): number {
    if (!parent.has(x)) parent.set(x, x)
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!) // path compression
      x = parent.get(x)!
    }
    return x
  }

  function union(a: number, b: number): void {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(rb, ra) // merge b's root into a's root
  }

  const tolSq = tolerance * tolerance
  let mergeCount = 0

  for (let i = 0; i < boundaryVerts.length; i++) {
    const vi = boundaryVerts[i]
    const px = positions[vi * 3], py = positions[vi * 3 + 1], pz = positions[vi * 3 + 2]

    for (let j = i + 1; j < boundaryVerts.length; j++) {
      const vj = boundaryVerts[j]
      if (find(vi) === find(vj)) continue // already in same group

      const dx = px - positions[vj * 3]
      const dy = py - positions[vj * 3 + 1]
      const dz = pz - positions[vj * 3 + 2]

      if (dx * dx + dy * dy + dz * dz < tolSq) {
        union(vi, vj)
        mergeCount++
      }
    }
  }

  if (mergeCount === 0) return false

  // 4. Update indices: replace each boundary vertex with its union-find root
  for (let i = 0; i < indices.length; i++) {
    if (isBoundary.has(indices[i])) {
      indices[i] = find(indices[i])
    }
  }

  return true
}

/**
 * Remove faces where two or more vertex indices are identical.
 * These degenerate faces are created when weldBoundaryVertices merges
 * two vertices that belong to the same face (e.g., face (A,B,C) becomes
 * (B,B,C) after A→B welding). They must be removed immediately because
 * they over-inflate edge counts and mask real boundary edges.
 */
function removeDegenerateFaces(indices: number[]): void {
  const seen = new Set<string>()
  let write = 0
  for (let f = 0; f < indices.length / 3; f++) {
    const a = indices[f * 3], b = indices[f * 3 + 1], c = indices[f * 3 + 2]
    // Skip faces with duplicate indices (collapsed by welding)
    if (a === b || b === c || a === c) continue
    // Skip duplicate faces (same 3 vertices in any winding order)
    // Canonical key via min/max avoids array allocation
    const s0 = Math.min(a, b, c)
    const s2 = Math.max(a, b, c)
    const s1 = a + b + c - s0 - s2
    const key = `${s0}_${s1}_${s2}`
    if (seen.has(key)) continue
    seen.add(key)
    indices[write] = a
    indices[write + 1] = b
    indices[write + 2] = c
    write += 3
  }
  indices.length = write
}

// ── Boundary hole closing ────────────────────────────────────────────────

/**
 * Detects boundary edges (edges with only 1 adjacent face) and fills
 * the resulting holes with new triangles. This fixes gaps left by
 * imperfect vertex merging of the CSG output.
 *
 * Key design decisions:
 * - Uses EDGE-level visitation (not vertex-level) so junction vertices
 *   shared by multiple boundary loops can participate in all of them.
 * - Uses angular sorting at junction vertices to follow the correct
 *   boundary loop instead of jumping to a different hole.
 * - Validates fill face normals against adjacent existing faces as a
 *   safety net for correct winding order.
 *
 * Returns a (potentially larger) position array if centroid vertices
 * were added for hole filling.
 */
function closeBoundaryHoles(
  pos: Float64Array,
  indices: number[],
  meshScale: number,
): Float64Array {
  // 1. Build edge → face count + directed edge traversal map
  const edgeFaceCount = new Map<string, number>()
  // For each edge, store the directed traversal from the FIRST face that
  // registers it. For boundary edges (count=1), this is the only face.
  const edgeDirected = new Map<string, [number, number]>()

  const faceCount = indices.length / 3
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]
    // The 3 directed edges of this face: i0→i1, i1→i2, i2→i0
    const dirEdges: [number, number][] = [[i0, i1], [i1, i2], [i2, i0]]
    for (const [a, b] of dirEdges) {
      const key = Math.min(a, b) + '_' + Math.max(a, b)
      const count = (edgeFaceCount.get(key) ?? 0) + 1
      edgeFaceCount.set(key, count)
      if (count === 1) {
        // First face to register this edge — store its directed traversal
        edgeDirected.set(key, [a, b])
      }
    }
  }

  // 2. Collect boundary edges (count === 1) and build adjacency
  const boundaryEdgeKeys: string[] = []
  const boundaryAdj = new Map<number, number[]>()

  for (const [key, count] of edgeFaceCount) {
    if (count !== 1) continue
    boundaryEdgeKeys.push(key)
    const sep = key.indexOf('_')
    const a = parseInt(key.substring(0, sep))
    const b = parseInt(key.substring(sep + 1))
    if (!boundaryAdj.has(a)) boundaryAdj.set(a, [])
    if (!boundaryAdj.has(b)) boundaryAdj.set(b, [])
    boundaryAdj.get(a)!.push(b)
    boundaryAdj.get(b)!.push(a)
  }

  if (boundaryEdgeKeys.length === 0) return pos // already watertight

  // 3. Chain boundary edges into ordered loops using EDGE-LEVEL visitation
  const visitedEdges = new Set<string>()
  const loops: number[][] = []

  for (const startKey of boundaryEdgeKeys) {
    if (visitedEdges.has(startKey)) continue

    // Parse the starting edge
    const sep = startKey.indexOf('_')
    const startA = parseInt(startKey.substring(0, sep))
    const startB = parseInt(startKey.substring(sep + 1))

    const loop = [startA]
    visitedEdges.add(startKey)
    let current = startB
    let prev = startA
    let closed = false

    for (let safety = 0; safety < 1000; safety++) {
      if (current === startA) { closed = true; break } // completed loop

      loop.push(current)
      if (loop.length > 200) break // cap to avoid filling non-seam holes

      // Find the next unvisited boundary edge from 'current'
      const neighbors = boundaryAdj.get(current) ?? []

      // Collect unvisited candidate neighbors
      const candidates: number[] = []
      for (const n of neighbors) {
        const eKey = Math.min(current, n) + '_' + Math.max(current, n)
        if (!visitedEdges.has(eKey)) candidates.push(n)
      }

      if (candidates.length === 0) break // dead end

      let next: number
      if (candidates.length === 1) {
        next = candidates[0]
      } else {
        // Junction vertex: pick the candidate that continues most smoothly
        next = pickNextByAngle(pos, prev, current, candidates)
      }

      const eKey = Math.min(current, next) + '_' + Math.max(current, next)
      visitedEdges.add(eKey)
      prev = current
      current = next
    }

    // Fallback: if chain didn't close topologically but endpoints are
    // spatially close (same position, different index), treat as closed
    if (!closed && loop.length >= 3) {
      const dx = pos[current * 3] - pos[startA * 3]
      const dy = pos[current * 3 + 1] - pos[startA * 3 + 1]
      const dz = pos[current * 3 + 2] - pos[startA * 3 + 2]
      const nearTolSq = (meshScale * 3e-3) * (meshScale * 3e-3)
      if (dx * dx + dy * dy + dz * dz < nearTolSq) {
        closed = true // endpoints are at the same position
      }
    }

    // Only accept properly closed loops with 3+ vertices
    if (closed && loop.length >= 3 && loop.length <= 200) {
      loops.push(loop)
    }
  }

  if (loops.length === 0) return pos

  // 4. Fill each loop with triangles
  const extraPositions: number[] = []
  let nextVertIdx = pos.length / 3
  const originalFaceCount = indices.length / 3 // track where fill faces start

  for (const loop of loops) {
    if (loop.length === 3) {
      // Simple triangle — determine winding from boundary edge direction
      const [a, b, c] = loop
      const winded = getWindingFromEdge(a, b, c, edgeDirected)
      indices.push(winded[0], winded[1], winded[2])
    } else {
      // Fan triangulation from centroid
      let cx = 0, cy = 0, cz = 0
      for (const vi of loop) {
        if (vi < pos.length / 3) {
          cx += pos[vi * 3]
          cy += pos[vi * 3 + 1]
          cz += pos[vi * 3 + 2]
        } else {
          const off = (vi - pos.length / 3) * 3
          cx += extraPositions[off]
          cy += extraPositions[off + 1]
          cz += extraPositions[off + 2]
        }
      }
      cx /= loop.length; cy /= loop.length; cz /= loop.length

      // Add centroid vertex
      const centroidIdx = nextVertIdx
      extraPositions.push(cx, cy, cz)
      nextVertIdx++

      // Create fan triangles
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]
        const b = loop[(i + 1) % loop.length]
        const winded = getWindingFromEdge(a, b, centroidIdx, edgeDirected)
        indices.push(winded[0], winded[1], winded[2])
      }
    }
  }

  // Build the final position array (original + any centroid vertices)
  let finalPos: Float64Array
  if (extraPositions.length === 0) {
    finalPos = pos
  } else {
    finalPos = new Float64Array(pos.length + extraPositions.length)
    finalPos.set(pos)
    for (let i = 0; i < extraPositions.length; i++) {
      finalPos[pos.length + i] = extraPositions[i]
    }
  }

  // 5. Validate fill face winding via normal comparison
  // For each fill face, check its normal against the adjacent existing face.
  // If they point in opposite directions, flip the winding.
  const totalFaces = indices.length / 3
  for (let f = originalFaceCount; f < totalFaces; f++) {
    const ia = indices[f * 3], ib = indices[f * 3 + 1], ic = indices[f * 3 + 2]

    // Compute fill face normal
    const fillNx = (finalPos[ib * 3 + 1] - finalPos[ia * 3 + 1]) * (finalPos[ic * 3 + 2] - finalPos[ia * 3 + 2])
      - (finalPos[ib * 3 + 2] - finalPos[ia * 3 + 2]) * (finalPos[ic * 3 + 1] - finalPos[ia * 3 + 1])
    const fillNy = (finalPos[ib * 3 + 2] - finalPos[ia * 3 + 2]) * (finalPos[ic * 3] - finalPos[ia * 3])
      - (finalPos[ib * 3] - finalPos[ia * 3]) * (finalPos[ic * 3 + 2] - finalPos[ia * 3 + 2])
    const fillNz = (finalPos[ib * 3] - finalPos[ia * 3]) * (finalPos[ic * 3 + 1] - finalPos[ia * 3 + 1])
      - (finalPos[ib * 3 + 1] - finalPos[ia * 3 + 1]) * (finalPos[ic * 3] - finalPos[ia * 3])

    // Find an adjacent original face via any shared boundary edge
    const adjNormal = findAdjacentFaceNormal(
      finalPos, indices, originalFaceCount, ia, ib, ic,
    )
    if (adjNormal === null) continue

    // Dot product: if negative, the fill face normal is flipped
    const dot = fillNx * adjNormal[0] + fillNy * adjNormal[1] + fillNz * adjNormal[2]
    if (dot < 0) {
      // Flip winding: swap ib and ic
      indices[f * 3 + 1] = ic
      indices[f * 3 + 2] = ib
    }
  }

  return finalPos
}

/**
 * At a junction vertex with multiple unvisited boundary edges, pick the
 * candidate that continues most smoothly (smallest deflection from the
 * incoming direction). This prevents loops from jumping between holes.
 */
function pickNextByAngle(
  pos: Float64Array,
  prev: number,
  current: number,
  candidates: number[],
): number {
  // Incoming direction: prev → current
  const ix = pos[current * 3] - pos[prev * 3]
  const iy = pos[current * 3 + 1] - pos[prev * 3 + 1]
  const iz = pos[current * 3 + 2] - pos[prev * 3 + 2]

  let bestDot = -Infinity
  let best = candidates[0]

  for (const n of candidates) {
    // Outgoing direction: current → candidate
    const ox = pos[n * 3] - pos[current * 3]
    const oy = pos[n * 3 + 1] - pos[current * 3 + 1]
    const oz = pos[n * 3 + 2] - pos[current * 3 + 2]

    // Normalize and dot with incoming direction
    const iLen = Math.sqrt(ix * ix + iy * iy + iz * iz)
    const oLen = Math.sqrt(ox * ox + oy * oy + oz * oz)
    if (iLen < 1e-12 || oLen < 1e-12) continue

    const dot = (ix * ox + iy * oy + iz * oz) / (iLen * oLen)
    if (dot > bestDot) {
      bestDot = dot
      best = n
    }
  }

  return best
}

/**
 * Determine the correct winding for a fill face triangle (a, b, third)
 * based on the directed edge traversal stored for boundary edge (a, b).
 *
 * The existing face traverses the boundary edge in one direction.
 * The fill face must traverse it in the OPPOSITE direction to maintain
 * consistent outward normals.
 */
function getWindingFromEdge(
  a: number, b: number, third: number,
  edgeDirected: Map<string, [number, number]>,
): [number, number, number] {
  const key = Math.min(a, b) + '_' + Math.max(a, b)
  const dir = edgeDirected.get(key)
  if (dir) {
    // Existing face traverses as dir[0] → dir[1]
    // Fill face must go dir[1] → dir[0] → third
    if (dir[0] === a && dir[1] === b) {
      // Existing goes a→b, fill needs b→a→third
      return [b, a, third]
    } else {
      // Existing goes b→a, fill needs a→b→third
      return [a, b, third]
    }
  }
  // Fallback
  return [a, b, third]
}

/**
 * Find the normal of an original (non-fill) face adjacent to a fill face.
 * Searches for an original face that shares an edge with the fill face.
 */
function findAdjacentFaceNormal(
  pos: Float64Array,
  indices: number[],
  originalFaceCount: number,
  fa: number, fb: number, fc: number,
): [number, number, number] | null {
  // Check edges of the fill face against original faces
  const fillEdges: [number, number][] = [[fa, fb], [fb, fc], [fc, fa]]

  for (const [ea, eb] of fillEdges) {
    const eKey = Math.min(ea, eb) + '_' + Math.max(ea, eb)

    // Search original faces for a matching edge
    for (let f = 0; f < originalFaceCount; f++) {
      const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2]

      // Check if this face contains the edge
      let hasEdge = false
      for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]]) {
        const k = Math.min(a, b) + '_' + Math.max(a, b)
        if (k === eKey) { hasEdge = true; break }
      }
      if (!hasEdge) continue

      // Compute this face's normal
      const abx = pos[i1 * 3] - pos[i0 * 3]
      const aby = pos[i1 * 3 + 1] - pos[i0 * 3 + 1]
      const abz = pos[i1 * 3 + 2] - pos[i0 * 3 + 2]
      const acx = pos[i2 * 3] - pos[i0 * 3]
      const acy = pos[i2 * 3 + 1] - pos[i0 * 3 + 1]
      const acz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2]
      const nx = aby * acz - abz * acy
      const ny = abz * acx - abx * acz
      const nz = abx * acy - aby * acx
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len < 1e-12) continue
      return [nx / len, ny / len, nz / len]
    }
  }

  return null
}

// ── Triangle proximity helpers ────────────────────────────────────────────

interface Tri3 { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }

function buildTriangleList(geo: THREE.BufferGeometry): Tri3[] {
  const p = geo.attributes.position
  const idx = geo.index
  const tris: Tri3[] = []
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      tris.push({
        a: new THREE.Vector3().fromBufferAttribute(p, idx.getX(i)),
        b: new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 1)),
        c: new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 2)),
      })
    }
  } else {
    for (let i = 0; i < p.count; i += 3) {
      tris.push({
        a: new THREE.Vector3().fromBufferAttribute(p, i),
        b: new THREE.Vector3().fromBufferAttribute(p, i + 1),
        c: new THREE.Vector3().fromBufferAttribute(p, i + 2),
      })
    }
  }
  return tris
}

function pointNearAnyTriangle(pt: THREE.Vector3, tris: Tri3[], tol: number): boolean {
  const tolSq = tol * tol
  const tgt = new THREE.Vector3()
  for (const t of tris) {
    closestPtOnTri(pt, t.a, t.b, t.c, tgt)
    if (pt.distanceToSquared(tgt) <= tolSq) return true
  }
  return false
}

function closestPtOnTri(
  p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const ap = new THREE.Vector3().subVectors(p, a)
  const d1 = ab.dot(ap), d2 = ac.dot(ap)
  if (d1 <= 0 && d2 <= 0) return out.copy(a)
  const bp = new THREE.Vector3().subVectors(p, b)
  const d3 = ab.dot(bp), d4 = ac.dot(bp)
  if (d3 >= 0 && d4 <= d3) return out.copy(b)
  const cp = new THREE.Vector3().subVectors(p, c)
  const d5 = ab.dot(cp), d6 = ac.dot(cp)
  if (d6 >= 0 && d5 <= d6) return out.copy(c)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return out.copy(a).addScaledVector(ab, d1 / (d1 - d3))
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return out.copy(a).addScaledVector(ac, d2 / (d2 - d6))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
    return out.copy(b).addScaledVector(new THREE.Vector3().subVectors(c, b), w)
  }
  const den = 1 / (va + vb + vc)
  return out.copy(a).addScaledVector(ab, vb * den).addScaledVector(ac, vc * den)
}
