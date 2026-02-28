import * as THREE from 'three'
import type { FFDSettings } from '@/types/footwear'

/**
 * Free-Form Deformation engine using Bernstein polynomials.
 * Ported from pixogen/utils/footwear/FFD.ts
 */
export class FFD {
  private controlPoints: THREE.Vector3[][][] = []
  private originalControlPoints: THREE.Vector3[][][] | null = null
  /** Immutable snapshot taken once at construction — used by reset() */
  private initialControlPoints: THREE.Vector3[][][] | null = null
  private bbox: THREE.Box3
  private geometry: THREE.BufferGeometry
  private originalPositions: Float32Array
  private subscribers: Set<() => void> = new Set()
  private l: number
  private m: number
  private n: number
  private size: THREE.Vector3
  private currentTransform: THREE.Matrix4
  private lastDeformedGeometry: THREE.BufferGeometry | null = null

  constructor(geometry: THREE.BufferGeometry, settings: FFDSettings) {
    this.currentTransform = new THREE.Matrix4()
    this.geometry = geometry.clone()
    this.originalPositions = new Float32Array(geometry.attributes.position.array)
    this.bbox = new THREE.Box3().setFromBufferAttribute(
      geometry.attributes.position as THREE.BufferAttribute,
    )
    this.size = new THREE.Vector3()
    this.bbox.getSize(this.size)

    this.l = Math.max(2, settings?.lengthSubdivisions || 2)
    this.m = Math.max(2, settings?.heightSubdivisions || 2)
    this.n = Math.max(2, settings?.widthSubdivisions || 2)

    this.initializeControlPoints()
    this.originalControlPoints = this.controlPoints.map((p) =>
      p.map((row) => row.map((pt) => pt.clone())),
    )
    // Immutable copy — never mutated, always reflects the undeformed grid
    this.initialControlPoints = this.controlPoints.map((p) =>
      p.map((row) => row.map((pt) => pt.clone())),
    )
  }

  private initializeControlPoints(): void {
    const size = this.size.clone()
    const paddedMin = this.bbox.min.clone()
    const stepX = size.x / this.l
    const stepY = size.y / this.m
    const stepZ = size.z / this.n

    this.controlPoints = []
    for (let i = 0; i <= this.l; i++) {
      this.controlPoints[i] = []
      for (let j = 0; j <= this.m; j++) {
        this.controlPoints[i][j] = []
        for (let k = 0; k <= this.n; k++) {
          this.controlPoints[i][j][k] = new THREE.Vector3(
            paddedMin.x + i * stepX,
            paddedMin.y + j * stepY,
            paddedMin.z + k * stepZ,
          )
        }
      }
    }
  }

  public updateTransform(matrix: THREE.Matrix4): void {
    this.currentTransform.copy(matrix)

    if (this.originalControlPoints) {
      this.controlPoints = this.originalControlPoints.map((plane) =>
        plane.map((row) => row.map((point) => point.clone())),
      )

      for (let i = 0; i <= this.l; i++) {
        for (let j = 0; j <= this.m; j++) {
          for (let k = 0; k <= this.n; k++) {
            this.controlPoints[i][j][k].applyMatrix4(this.currentTransform)
          }
        }
      }
    }

    this.deform()
    this.notifySubscribers()
  }

  public moveControlPoint(i: number, j: number, k: number, newPosition: THREE.Vector3): void {
    if (!this.controlPoints[i]?.[j]?.[k]) return

    try {
      this.controlPoints[i][j][k].copy(newPosition)

      if (this.originalControlPoints) {
        const localPosition = newPosition.clone()
        if (!this.currentTransform.equals(new THREE.Matrix4())) {
          const invTransform = this.currentTransform.clone().invert()
          localPosition.applyMatrix4(invTransform)
        }
        this.originalControlPoints[i][j][k].copy(localPosition)
      }

      this.deform()
      this.notifySubscribers()
    } catch (error) {
      console.error('FFD: Error moving control point:', error)
    }
  }

  public deform(): void {
    if (!this.geometry || !this.controlPoints.length) return

    const positions = this.geometry.attributes.position
    const deformedPositions = new Float32Array(this.originalPositions.length)
    const invTransform = this.currentTransform.clone().invert()

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        this.originalPositions[i * 3],
        this.originalPositions[i * 3 + 1],
        this.originalPositions[i * 3 + 2],
      )

      const local = this.calculateLocalCoordinates(vertex)
      const deformed = this.calculateDeformedPosition(local.s, local.t, local.u)
      deformed.applyMatrix4(invTransform)

      deformedPositions[i * 3] = deformed.x
      deformedPositions[i * 3 + 1] = deformed.y
      deformedPositions[i * 3 + 2] = deformed.z
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(deformedPositions, 3))
    this.geometry.computeVertexNormals()
    this.lastDeformedGeometry = this.geometry.clone()
  }

  public getControlPoints(): THREE.Vector3[][][] {
    return this.controlPoints.map((plane) =>
      plane.map((row) => row.map((point) => point.clone())),
    )
  }

  public getDeformedGeometry(): THREE.BufferGeometry {
    if (!this.lastDeformedGeometry) {
      this.deform()
    }
    return this.lastDeformedGeometry?.clone() || this.geometry.clone()
  }

  private calculateLocalCoordinates(vertex: THREE.Vector3): {
    s: number
    t: number
    u: number
  } {
    const local = vertex.clone().sub(this.bbox.min)
    const size = this.bbox.getSize(new THREE.Vector3())
    const epsilon = 1e-6

    let s = size.x !== 0 ? local.x / size.x : 0
    let t = size.y !== 0 ? local.y / size.y : 0
    let u = size.z !== 0 ? local.z / size.z : 0

    if (Math.abs(s) < epsilon) s = 0
    if (Math.abs(t) < epsilon) t = 0
    if (Math.abs(u) < epsilon) u = 0
    if (Math.abs(s - 1) < epsilon) s = 1
    if (Math.abs(t - 1) < epsilon) t = 1
    if (Math.abs(u - 1) < epsilon) u = 1

    if (!isFinite(s)) s = 0
    if (!isFinite(t)) t = 0
    if (!isFinite(u)) u = 0

    return { s, t, u }
  }

  private calculateDeformedPosition(s: number, t: number, u: number): THREE.Vector3 {
    const result = new THREE.Vector3(0, 0, 0)
    let totalWeight = 0

    for (let i = 0; i <= this.l; i++) {
      const bx = this.bernstein(this.l, i, s)
      for (let j = 0; j <= this.m; j++) {
        const by = this.bernstein(this.m, j, t)
        for (let k = 0; k <= this.n; k++) {
          const bz = this.bernstein(this.n, k, u)
          const weight = bx * by * bz
          const controlPoint = this.controlPoints[i][j][k].clone()
          result.add(controlPoint.multiplyScalar(weight))
          totalWeight += weight
        }
      }
    }

    if (totalWeight > 0) {
      result.divideScalar(totalWeight)
    }

    return result
  }

  private bernstein(n: number, i: number, t: number): number {
    return this.binomial(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i)
  }

  private binomial(n: number, k: number): number {
    let coeff = 1
    for (let i = n - k + 1; i <= n; i++) coeff *= i
    for (let i = 1; i <= k; i++) coeff /= i
    return coeff
  }

  public reset(): void {
    if (this.initialControlPoints) {
      // Restore vertex positions to the original undeformed state
      this.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(this.originalPositions.slice(), 3),
      )
      // Restore both working and local-space control point arrays from the
      // immutable initial snapshot so moveControlPoint mutations are undone
      this.controlPoints = this.initialControlPoints.map((p) =>
        p.map((row) => row.map((pt) => pt.clone())),
      )
      this.originalControlPoints = this.initialControlPoints.map((p) =>
        p.map((row) => row.map((pt) => pt.clone())),
      )
      this.currentTransform = new THREE.Matrix4() // clear any applied transform
      this.lastDeformedGeometry = null
      this.deform()
      this.notifySubscribers()
    }
  }

  public subscribe(callback: () => void) {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback())
  }

  public getControlPoint(i: number, j: number, k: number): THREE.Vector3 | null {
    if (i < 0 || i > this.l || j < 0 || j > this.m || k < 0 || k > this.n) {
      return null
    }
    return this.controlPoints[i][j][k].clone()
  }

  public getBoundingBox(): THREE.Box3 {
    const transformedBox = this.bbox.clone()

    if (!this.currentTransform.equals(new THREE.Matrix4())) {
      const corners = [
        new THREE.Vector3(this.bbox.min.x, this.bbox.min.y, this.bbox.min.z),
        new THREE.Vector3(this.bbox.min.x, this.bbox.min.y, this.bbox.max.z),
        new THREE.Vector3(this.bbox.min.x, this.bbox.max.y, this.bbox.min.z),
        new THREE.Vector3(this.bbox.min.x, this.bbox.max.y, this.bbox.max.z),
        new THREE.Vector3(this.bbox.max.x, this.bbox.min.y, this.bbox.min.z),
        new THREE.Vector3(this.bbox.max.x, this.bbox.min.y, this.bbox.max.z),
        new THREE.Vector3(this.bbox.max.x, this.bbox.max.y, this.bbox.min.z),
        new THREE.Vector3(this.bbox.max.x, this.bbox.max.y, this.bbox.max.z),
      ]
      corners.forEach((corner) => corner.applyMatrix4(this.currentTransform))
      transformedBox.makeEmpty()
      corners.forEach((corner) => transformedBox.expandByPoint(corner))
    }

    return transformedBox
  }

  public getCurrentTransform(): THREE.Matrix4 {
    return this.currentTransform.clone()
  }

  /** Deep clone of originalControlPoints (local-space) for undo snapshots */
  public getOriginalControlPoints(): THREE.Vector3[][][] | null {
    if (!this.originalControlPoints) return null
    return this.originalControlPoints.map((p) =>
      p.map((row) => row.map((pt) => pt.clone())),
    )
  }

  /**
   * Restore FFD state from an undo snapshot.
   * Replaces controlPoints, originalControlPoints, and currentTransform
   * then re-deforms geometry and notifies subscribers (ControlGrid/ControlPoints).
   */
  public restoreSnapshot(
    controlPoints: THREE.Vector3[][][],
    originalControlPoints: THREE.Vector3[][][],
    transform: THREE.Matrix4,
  ): void {
    this.controlPoints = controlPoints.map((p) =>
      p.map((row) => row.map((pt) => pt.clone())),
    )
    this.originalControlPoints = originalControlPoints.map((p) =>
      p.map((row) => row.map((pt) => pt.clone())),
    )
    this.currentTransform.copy(transform)
    this.lastDeformedGeometry = null
    this.deform()
    this.notifySubscribers()
  }
}
