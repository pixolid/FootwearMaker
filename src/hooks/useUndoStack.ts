import { useRef, useCallback, useState } from 'react'
import * as THREE from 'three'

/** Snapshot of a single mesh + its FFD state */
export interface MeshSnapshot {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
  ffd: {
    controlPoints: THREE.Vector3[][][]
    originalControlPoints: THREE.Vector3[][][]
    currentTransform: THREE.Matrix4
  } | null
}

/** Complete snapshot of both meshes at one point in time */
export interface UndoSnapshot {
  meshA: MeshSnapshot | null
  meshB: MeshSnapshot | null
}

const MAX_UNDO_STEPS = 100

export function useUndoStack() {
  const undoRef = useRef<UndoSnapshot[]>([])
  const redoRef = useRef<UndoSnapshot[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  const canUndo = undoCount > 0
  const canRedo = redoCount > 0

  /** Push a snapshot onto the undo stack. Clears the redo stack (new action branch). */
  const pushSnapshot = useCallback((snapshot: UndoSnapshot) => {
    undoRef.current.push(snapshot)
    if (undoRef.current.length > MAX_UNDO_STEPS) {
      undoRef.current.shift()
    }
    // New action invalidates redo history
    redoRef.current = []
    setUndoCount(undoRef.current.length)
    setRedoCount(0)
  }, [])

  /** Pop the last undo snapshot. Pass `currentState` to push it onto the redo stack. */
  const popSnapshot = useCallback((currentState?: UndoSnapshot): UndoSnapshot | null => {
    if (undoRef.current.length === 0) return null
    const snapshot = undoRef.current.pop()!
    if (currentState) {
      redoRef.current.push(currentState)
      if (redoRef.current.length > MAX_UNDO_STEPS) {
        redoRef.current.shift()
      }
    }
    setUndoCount(undoRef.current.length)
    setRedoCount(redoRef.current.length)
    return snapshot
  }, [])

  /** Pop the last redo snapshot. Pass `currentState` to push it back onto the undo stack. */
  const popRedo = useCallback((currentState?: UndoSnapshot): UndoSnapshot | null => {
    if (redoRef.current.length === 0) return null
    const snapshot = redoRef.current.pop()!
    if (currentState) {
      undoRef.current.push(currentState)
      if (undoRef.current.length > MAX_UNDO_STEPS) {
        undoRef.current.shift()
      }
    }
    setUndoCount(undoRef.current.length)
    setRedoCount(redoRef.current.length)
    return snapshot
  }, [])

  const clear = useCallback(() => {
    undoRef.current = []
    redoRef.current = []
    setUndoCount(0)
    setRedoCount(0)
  }, [])

  return { canUndo, canRedo, pushSnapshot, popSnapshot, popRedo, clear }
}
