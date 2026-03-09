/**
 * stateSerializer.ts
 * ──────────────────
 * Utilities for serialising and deserialising a full FootwearMaker project
 * state so it can be saved to / loaded from Firebase Storage.
 *
 * Storage layout per state:
 *   users/{userId}/saved-states/{stateId}/
 *     ├── metadata.json   ← transforms, FFD data, settings, name, timestamp
 *     ├── shoe.glb        ← shoe mesh geometry (may be absent if no shoe)
 *     ├── last.glb        ← last mesh geometry (may be absent if no last)
 *     └── thumbnail.png   ← viewport screenshot
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FFD } from '@/utils/FFD'
import type { FFDSettings } from '@/types/footwear'

// ─── Plain-JSON helper types ───────────────────────────────────────────────────

interface SerializedVector3 {
    x: number
    y: number
    z: number
}

interface SerializedEuler {
    x: number
    y: number
    z: number
    order: string
}

// A THREE.Matrix4 is a flat array of 16 numbers (column-major)
type SerializedMatrix4 = number[]

// FFD control-point grid serialised as nested arrays of {x,y,z}
type SerializedControlPoints = SerializedVector3[][][]

interface SerializedMeshTransform {
    position: SerializedVector3
    rotation: SerializedEuler
    scale: SerializedVector3
}

interface SerializedFFDState {
    controlPoints: SerializedControlPoints
    originalControlPoints: SerializedControlPoints
    currentTransform: SerializedMatrix4
    settings: FFDSettings
}

// ─── Public metadata interface (stored as metadata.json) ──────────────────────

export interface SavedStateMetadata {
    /** Human-readable name given by the user */
    name: string
    /** Unix timestamp (ms) when the state was saved */
    savedAt: number
    /** Unique ID for this saved state (nanoid / Date.now based) */
    id: string
    /** Workflow step that was active when saved (1-4) */
    currentStep: number
    /** Original filename/label for the shoe model */
    shoeFileName: string | null
    /** Original filename/label for the last model */
    lastFileName: string | null
    /** Whether a shoe GLB was stored */
    hasShoe: boolean
    /** Whether a last GLB was stored */
    hasLast: boolean
    /** Shoe mesh object transform */
    shoeTransform: SerializedMeshTransform | null
    /** Last mesh object transform */
    lastTransform: SerializedMeshTransform | null
    /** FFD state for shoe (A) */
    ffdA: SerializedFFDState | null
    /** FFD state for last (B) */
    ffdB: SerializedFFDState | null
}

// ─── Input / output types for the public API ──────────────────────────────────

export interface SerializeInput {
    shoeMesh: THREE.Mesh | null
    lastMesh: THREE.Mesh | null
    ffdA: FFD | null
    ffdB: FFD | null
    ffdSettingsA: FFDSettings
    ffdSettingsB: FFDSettings
    shoeFileName: string | File | null
    lastFileName: string | File | null
    currentStep: number
    stateName: string
    stateId: string
}

export interface SerializeResult {
    metadata: SavedStateMetadata
    /** GLB binary for the shoe mesh, or null */
    shoeGlb: ArrayBuffer | null
    /** GLB binary for the last mesh, or null */
    lastGlb: ArrayBuffer | null
}

export interface DeserializeInput {
    metadata: SavedStateMetadata
    shoeGlb: ArrayBuffer | null
    lastGlb: ArrayBuffer | null
}

export interface DeserializeResult {
    shoeMesh: THREE.Mesh | null
    lastMesh: THREE.Mesh | null
    ffdA: FFD | null
    ffdB: FFD | null
    ffdSettingsA: FFDSettings
    ffdSettingsB: FFDSettings
    shoeFileName: string | null
    lastFileName: string | null
    currentStep: number
}

// ─── Helper: Vector / Euler / Matrix serialisation ────────────────────────────

function vecToJson(v: THREE.Vector3): SerializedVector3 {
    return { x: v.x, y: v.y, z: v.z }
}
function jsonToVec(o: SerializedVector3): THREE.Vector3 {
    return new THREE.Vector3(o.x, o.y, o.z)
}

function eulerToJson(e: THREE.Euler): SerializedEuler {
    return { x: e.x, y: e.y, z: e.z, order: e.order }
}
function jsonToEuler(o: SerializedEuler): THREE.Euler {
    return new THREE.Euler(o.x, o.y, o.z, o.order as THREE.EulerOrder)
}

function matToJson(m: THREE.Matrix4): SerializedMatrix4 {
    return Array.from(m.elements)
}
function jsonToMat(a: SerializedMatrix4): THREE.Matrix4 {
    const m = new THREE.Matrix4()
    m.elements = a as [
        number, number, number, number,
        number, number, number, number,
        number, number, number, number,
        number, number, number, number,
    ]
    return m
}

function cpToJson(pts: THREE.Vector3[][][]): SerializedControlPoints {
    return pts.map((plane) => plane.map((row) => row.map(vecToJson)))
}
function jsonToCp(arr: SerializedControlPoints): THREE.Vector3[][][] {
    return arr.map((plane) => plane.map((row) => row.map(jsonToVec)))
}

// ─── Export a single mesh to a GLB ArrayBuffer ────────────────────────────────

async function meshToGlb(mesh: THREE.Mesh): Promise<ArrayBuffer> {
    const { GLTFExporter: GE } = await import('three/addons/exporters/GLTFExporter.js')
    const exporter = new GE()
    return new Promise((resolve, reject) => {
        exporter.parse(
            mesh,
            (result) => resolve(result as ArrayBuffer),
            (error) => reject(error),
            { binary: true },
        )
    })
}

// ─── Load a GLB ArrayBuffer into a THREE.Mesh ─────────────────────────────────

async function glbToMesh(buffer: ArrayBuffer): Promise<THREE.Mesh> {
    const loader = new GLTFLoader()
    return new Promise((resolve, reject) => {
        loader.parse(
            buffer,
            '',
            (gltf) => {
                // Find the first Mesh in the loaded scene
                let found: THREE.Mesh | null = null
                gltf.scene.traverse((obj) => {
                    if (!found && obj instanceof THREE.Mesh) found = obj as THREE.Mesh
                })
                if (found) {
                    // Detach from the scene so it lives as a standalone mesh
                    ; (found as THREE.Mesh).removeFromParent()
                    resolve(found as THREE.Mesh)
                } else {
                    reject(new Error('No mesh found in GLB'))
                }
            },
            (error) => reject(error),
        )
    })
}

// ─── Filename helper ──────────────────────────────────────────────────────────

function fileLabel(f: string | File | null): string | null {
    if (!f) return null
    if (typeof f === 'string') return f
    return f.name
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialise the current FootwearMaker state into a metadata object and two
 * optional GLB binary blobs (shoe + last).
 */
export async function serializeState(input: SerializeInput): Promise<SerializeResult> {
    const {
        shoeMesh, lastMesh, ffdA, ffdB,
        ffdSettingsA, ffdSettingsB,
        shoeFileName, lastFileName,
        currentStep, stateName, stateId,
    } = input

    // Serialize shoe transform
    const shoeTransform: SerializedMeshTransform | null = shoeMesh
        ? {
            position: vecToJson(shoeMesh.position),
            rotation: eulerToJson(shoeMesh.rotation),
            scale: vecToJson(shoeMesh.scale),
        }
        : null

    // Serialize last transform
    const lastTransform: SerializedMeshTransform | null = lastMesh
        ? {
            position: vecToJson(lastMesh.position),
            rotation: eulerToJson(lastMesh.rotation),
            scale: vecToJson(lastMesh.scale),
        }
        : null

    // Serialize FFD A
    const ffdAState: SerializedFFDState | null =
        ffdA
            ? {
                controlPoints: cpToJson(ffdA.getControlPoints()),
                originalControlPoints: cpToJson(ffdA.getOriginalControlPoints()!),
                currentTransform: matToJson(ffdA.getCurrentTransform()),
                settings: { ...ffdSettingsA },
            }
            : null

    // Serialize FFD B
    const ffdBState: SerializedFFDState | null =
        ffdB
            ? {
                controlPoints: cpToJson(ffdB.getControlPoints()),
                originalControlPoints: cpToJson(ffdB.getOriginalControlPoints()!),
                currentTransform: matToJson(ffdB.getCurrentTransform()),
                settings: { ...ffdSettingsB },
            }
            : null

    // Export geometries to GLB
    const shoeGlb = shoeMesh ? await meshToGlb(shoeMesh) : null
    const lastGlb = lastMesh ? await meshToGlb(lastMesh) : null

    const metadata: SavedStateMetadata = {
        name: stateName,
        savedAt: Date.now(),
        id: stateId,
        currentStep,
        shoeFileName: fileLabel(shoeFileName),
        lastFileName: fileLabel(lastFileName),
        hasShoe: shoeMesh !== null,
        hasLast: lastMesh !== null,
        shoeTransform,
        lastTransform,
        ffdA: ffdAState,
        ffdB: ffdBState,
    }

    return { metadata, shoeGlb, lastGlb }
}

/**
 * Deserialise a saved state back into meshes, FFD instances, and settings.
 * Returns everything needed to restore the FootwearMaker component state.
 */
export async function deserializeState(input: DeserializeInput): Promise<DeserializeResult> {
    const { metadata, shoeGlb, lastGlb } = input

    // Reconstruct shoe mesh
    let shoeMesh: THREE.Mesh | null = null
    if (shoeGlb && metadata.hasShoe) {
        shoeMesh = await glbToMesh(shoeGlb)
    }

    // Reconstruct last mesh
    let lastMesh: THREE.Mesh | null = null
    if (lastGlb && metadata.hasLast) {
        lastMesh = await glbToMesh(lastGlb)
    }

    // Restore shoe transform
    if (shoeMesh && metadata.shoeTransform) {
        const t = metadata.shoeTransform
        shoeMesh.position.copy(jsonToVec(t.position))
        shoeMesh.rotation.copy(jsonToEuler(t.rotation))
        shoeMesh.scale.copy(jsonToVec(t.scale))
        shoeMesh.updateMatrix()
    }

    // Restore last transform
    if (lastMesh && metadata.lastTransform) {
        const t = metadata.lastTransform
        lastMesh.position.copy(jsonToVec(t.position))
        lastMesh.rotation.copy(jsonToEuler(t.rotation))
        lastMesh.scale.copy(jsonToVec(t.scale))
        lastMesh.updateMatrix()
    }

    // Reconstruct FFD A
    let ffdA: FFD | null = null
    const ffdSettingsA: FFDSettings = metadata.ffdA?.settings ?? {
        lengthSubdivisions: 3,
        widthSubdivisions: 3,
        heightSubdivisions: 3,
    }
    if (shoeMesh && metadata.ffdA) {
        const s = metadata.ffdA
        // Build a fresh FFD from the current geometry (already positional-transformed)
        ffdA = new FFD(shoeMesh.geometry, s.settings)
        // Restore the saved control-point positions and transform
        ffdA.restoreSnapshot(
            jsonToCp(s.controlPoints),
            jsonToCp(s.originalControlPoints),
            jsonToMat(s.currentTransform),
        )
        // Push the restored deformation onto the mesh geometry
        const deformed = ffdA.getDeformedGeometry()
        shoeMesh.geometry.dispose()
        shoeMesh.geometry = deformed
    }

    // Reconstruct FFD B
    let ffdB: FFD | null = null
    const ffdSettingsB: FFDSettings = metadata.ffdB?.settings ?? {
        lengthSubdivisions: 3,
        widthSubdivisions: 3,
        heightSubdivisions: 3,
    }
    if (lastMesh && metadata.ffdB) {
        const s = metadata.ffdB
        ffdB = new FFD(lastMesh.geometry, s.settings)
        ffdB.restoreSnapshot(
            jsonToCp(s.controlPoints),
            jsonToCp(s.originalControlPoints),
            jsonToMat(s.currentTransform),
        )
        const deformed = ffdB.getDeformedGeometry()
        lastMesh.geometry.dispose()
        lastMesh.geometry = deformed
    }

    return {
        shoeMesh,
        lastMesh,
        ffdA,
        ffdB,
        ffdSettingsA,
        ffdSettingsB,
        shoeFileName: metadata.shoeFileName,
        lastFileName: metadata.lastFileName,
        currentStep: metadata.currentStep,
    }
}
