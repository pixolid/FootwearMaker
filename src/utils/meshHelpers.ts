import * as THREE from 'three'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/**
 * Load a 3D model file (OBJ, GLB/GLTF, STL) and return its geometry.
 */
export async function loadModelFile(file: File): Promise<THREE.BufferGeometry> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const arrayBuffer = await file.arrayBuffer()

  switch (ext) {
    case 'obj': {
      const text = new TextDecoder().decode(arrayBuffer)
      const loader = new OBJLoader()
      const group = loader.parse(text)
      // Bake any node-level transforms into the geometry
      group.updateMatrixWorld(true)
      const mesh = group.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)
      if (!mesh) throw new Error('No mesh found in OBJ file')
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      return geo
    }
    case 'glb':
    case 'gltf': {
      return new Promise((resolve, reject) => {
        const loader = new GLTFLoader()
        loader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            // Ensure all world matrices are computed so we can bake
            // node-level transforms (rotations, scales, positions)
            // into the geometry — GLB files often include coordinate
            // system conversions (e.g. Z-up → Y-up) as node rotations.
            gltf.scene.updateMatrixWorld(true)
            let geometry: THREE.BufferGeometry | null = null
            gltf.scene.traverse((child) => {
              if (!geometry && child instanceof THREE.Mesh) {
                geometry = child.geometry.clone()
                geometry.applyMatrix4(child.matrixWorld)
              }
            })
            if (geometry) {
              resolve(geometry)
            } else {
              reject(new Error('No mesh found in GLB/GLTF file'))
            }
          },
          reject,
        )
      })
    }
    case 'stl': {
      const loader = new STLLoader()
      return loader.parse(arrayBuffer)
    }
    default:
      throw new Error(`Unsupported file format: ${ext}`)
  }
}

/**
 * Load a model from a URL.
 * Accepts an optional filename hint for reliable extension detection
 * (Firebase Storage download URLs encode the path and append query params,
 * so inferring the extension from the URL alone is unreliable).
 */
export async function loadModelFromURL(url: string, filename?: string): Promise<THREE.BufferGeometry> {
  const response = await fetch(url)
  const blob = await response.blob()

  let ext = 'glb'
  if (filename) {
    ext = filename.split('.').pop()?.toLowerCase() || 'glb'
  } else {
    // Decode the URL path (Firebase encodes slashes as %2F) and strip query params
    const urlPath = decodeURIComponent(new URL(url).pathname)
    ext = urlPath.split('.').pop()?.split('?')[0]?.toLowerCase() || 'glb'
  }

  const file = new File([blob], `model.${ext}`)
  return loadModelFile(file)
}

/**
 * Standardize geometry: center on X/Z, normalize scale, and sit the bottom
 * of the mesh exactly on Y=0 (the ground plane).
 */
export function standardizeMesh(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = geometry.clone()
  geo.computeBoundingBox()
  const bbox = geo.boundingBox!
  const center = bbox.getCenter(new THREE.Vector3())
  const size = bbox.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  // Center on X and Z, but keep Y as-is for now (will fix below)
  geo.translate(-center.x, -center.y, -center.z)

  // Normalize scale to fit within a reasonable size
  if (maxDim > 10) {
    const scale = 5 / maxDim
    geo.scale(scale, scale, scale)
  }

  // After scaling, recompute bounding box and lift mesh so its lowest
  // point sits exactly on Y=0 (the ground/reflector plane)
  geo.computeBoundingBox()
  const minY = geo.boundingBox!.min.y
  if (minY !== 0) {
    geo.translate(0, -minY, 0)
  }

  geo.computeVertexNormals()
  return geo
}

/**
 * Scale geometry B to match geometry A's bounding box dimensions,
 * then align both to sit on Y=0 (ground plane).
 */
export function scaleMeshToMatch(
  geoA: THREE.BufferGeometry,
  geoB: THREE.BufferGeometry,
): THREE.BufferGeometry {
  geoA.computeBoundingBox()
  geoB.computeBoundingBox()

  const sizeA = geoA.boundingBox!.getSize(new THREE.Vector3())
  const sizeB = geoB.boundingBox!.getSize(new THREE.Vector3())

  const scaleX = sizeA.x / sizeB.x
  const scaleY = sizeA.y / sizeB.y
  const scaleZ = sizeA.z / sizeB.z

  // Use uniform scale based on the average
  const avgScale = (scaleX + scaleY + scaleZ) / 3

  const result = geoB.clone()
  result.scale(avgScale, avgScale, avgScale)

  // Align X/Z centers with shoe, but keep bottom on Y=0
  result.computeBoundingBox()
  const centerA = geoA.boundingBox!.getCenter(new THREE.Vector3())
  const centerB = result.boundingBox!.getCenter(new THREE.Vector3())
  const minB = result.boundingBox!.min.y

  result.translate(
    centerA.x - centerB.x,
    -minB,               // lift last so its bottom sits on Y=0
    centerA.z - centerB.z,
  )

  return result
}

/**
 * Export a mesh to GLB format and trigger download.
 */
export async function exportToGLB(mesh: THREE.Mesh, filename: string = 'result.glb'): Promise<void> {
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        downloadBlob(blob, filename)
        resolve()
      },
      reject,
      { binary: true },
    )
  })
}

/**
 * Export a mesh to STL format and trigger download.
 * Handles both indexed and non-indexed BufferGeometry.
 */
export function exportToSTL(mesh: THREE.Mesh, filename: string = 'result.stl'): void {
  const geometry = mesh.geometry
  let stl = 'solid exported\n'

  const positions = geometry.attributes.position
  const index = geometry.index

  const writeTriangle = (a: number, b: number, c: number) => {
    const vA = new THREE.Vector3().fromBufferAttribute(positions, a)
    const vB = new THREE.Vector3().fromBufferAttribute(positions, b)
    const vC = new THREE.Vector3().fromBufferAttribute(positions, c)

    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(vB, vA),
        new THREE.Vector3().subVectors(vC, vA),
      )
      .normalize()

    stl += `facet normal ${normal.x} ${normal.y} ${normal.z}\n`
    stl += '  outer loop\n'
    stl += `    vertex ${vA.x} ${vA.y} ${vA.z}\n`
    stl += `    vertex ${vB.x} ${vB.y} ${vB.z}\n`
    stl += `    vertex ${vC.x} ${vC.y} ${vC.z}\n`
    stl += '  endloop\n'
    stl += 'endfacet\n'
  }

  if (index) {
    // Indexed geometry — look up vertex positions via index buffer
    for (let i = 0; i < index.count; i += 3) {
      writeTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2))
    }
  } else {
    // Non-indexed geometry — every 3 consecutive vertices form a triangle
    for (let i = 0; i < positions.count; i += 3) {
      writeTriangle(i, i + 1, i + 2)
    }
  }

  stl += 'endsolid exported\n'
  const blob = new Blob([stl], { type: 'application/sla' })
  downloadBlob(blob, filename)
}

/**
 * Export a mesh to OBJ format and trigger download.
 */
export async function exportToOBJ(mesh: THREE.Mesh, filename: string = 'result.obj'): Promise<void> {
  const { OBJExporter } = await import('three/addons/exporters/OBJExporter.js')
  const exporter = new OBJExporter()
  const result = exporter.parse(mesh)
  downloadBlob(new Blob([result], { type: 'text/plain' }), filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
