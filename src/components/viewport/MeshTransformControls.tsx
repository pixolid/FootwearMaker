import { useEffect, useRef } from 'react'
import { TransformControls as ThreeTransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface MeshTransformControlsProps {
  mesh: THREE.Mesh | null
  mode: 'translate' | 'rotate' | 'scale'
  enabled: boolean
  onTransform: (matrix: THREE.Matrix4) => void
  onDragStart?: () => void
  space: 'world' | 'local'
  size: number
  orbitControlsRef: React.RefObject<any>
}

export default function MeshTransformControls({
  mesh,
  mode,
  enabled,
  onTransform,
  onDragStart,
  space,
  size,
  orbitControlsRef,
}: MeshTransformControlsProps) {
  const transformRef = useRef<any>(null)
  const { camera } = useThree()
  const isDragging = useRef(false)

  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current

      const handleChange = () => {
        if (mesh && isDragging.current) {
          mesh.updateMatrix()
          mesh.updateMatrixWorld(true)
          const newMatrix = mesh.matrix.clone()
          onTransform(newMatrix)
        }
      }

      const handleDraggingChanged = (event: { value: boolean }) => {
        isDragging.current = event.value
        if (orbitControlsRef?.current) {
          orbitControlsRef.current.enabled = !event.value
        }
        if (event.value && onDragStart) {
          onDragStart()
        }
        if (!event.value && mesh) {
          mesh.updateMatrix()
          mesh.updateMatrixWorld(true)
          const finalMatrix = mesh.matrix.clone()
          onTransform(finalMatrix)
        }
      }

      controls.addEventListener('change', handleChange)
      controls.addEventListener('dragging-changed', handleDraggingChanged)

      return () => {
        controls.removeEventListener('change', handleChange)
        controls.removeEventListener('dragging-changed', handleDraggingChanged)
        if (orbitControlsRef?.current) {
          orbitControlsRef.current.enabled = true
        }
      }
    }
  }, [mesh, onTransform, onDragStart, orbitControlsRef])

  if (!mesh || !enabled) return null

  return (
    <ThreeTransformControls
      ref={transformRef}
      mode={mode}
      object={mesh}
      space={space}
      size={size}
      camera={camera}
      translationSnap={0.001}
      rotationSnap={Math.PI / 128}
      scaleSnap={0.001}
    />
  )
}
