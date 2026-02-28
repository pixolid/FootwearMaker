import { useEffect, useState, useRef, useMemo } from 'react'
import { Vector3 } from 'three'
import * as THREE from 'three'
import { TransformControls } from '@react-three/drei'
import type { FFD } from '@/utils/FFD'

interface ControlPointsProps {
  ffdBox: FFD
  onPointMove: (i: number, j: number, k: number, position: Vector3) => void
  onDragStart?: () => void
  orbitControlsRef: React.RefObject<any>
}

export default function ControlPoints({
  ffdBox,
  onPointMove,
  onDragStart,
  orbitControlsRef,
}: ControlPointsProps) {
  const [points, setPoints] = useState<Vector3[][][]>([])
  const [selectedPoint, setSelectedPoint] = useState<{
    i: number
    j: number
    k: number
  } | null>(null)
  const transformRef = useRef<any>(null)
  const isDragging = useRef(false)
  const lastPosition = useRef<THREE.Vector3 | null>(null)
  const [transformScale, setTransformScale] = useState(new THREE.Vector3(1, 1, 1))

  const controlPointSize = useMemo(() => {
    const bbox = ffdBox.getBoundingBox()
    const size = new THREE.Vector3()
    bbox.getSize(size)

    const currentTransform = ffdBox.getCurrentTransform()
    const newTransformScale = new THREE.Vector3()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    currentTransform.decompose(position, quaternion, newTransformScale)

    if (newTransformScale.x > 10) {
      newTransformScale.divideScalar(100)
    }
    setTransformScale(newTransformScale)

    const scaledSize = size.clone()
    const maxDimension = Math.max(scaledSize.x, scaledSize.y, scaledSize.z)
    return maxDimension * 0.025
  }, [ffdBox])

  useEffect(() => {
    if (ffdBox) {
      setPoints(ffdBox.getControlPoints())
      const unsubscribe = ffdBox.subscribe(() => {
        setPoints(ffdBox.getControlPoints())
      })
      return unsubscribe
    }
  }, [ffdBox])

  const handleTransformStart = () => {
    isDragging.current = true
    lastPosition.current = null
    if (onDragStart) onDragStart()
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = false
    }
  }

  const handleTransformChange = () => {
    if (selectedPoint && transformRef.current && isDragging.current) {
      const worldPosition = new THREE.Vector3()
      transformRef.current.object.getWorldPosition(worldPosition)

      if (lastPosition.current) {
        const delta = worldPosition.clone().sub(lastPosition.current)
        if (delta.length() > 0.001) {
          onPointMove(selectedPoint.i, selectedPoint.j, selectedPoint.k, worldPosition)

          const newPoints = points.map((plane, i) =>
            plane.map((row, j) =>
              row.map((point, k) =>
                i === selectedPoint.i && j === selectedPoint.j && k === selectedPoint.k
                  ? worldPosition.clone()
                  : point.clone(),
              ),
            ),
          )
          setPoints(newPoints)
        }
      }
      lastPosition.current = worldPosition.clone()
    }
  }

  const handleTransformEnd = () => {
    isDragging.current = false
    lastPosition.current = null
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = true
    }
  }

  return (
    <group>
      {points.map((plane, i) =>
        plane.map((row, j) =>
          row.map((point, k) => (
            <group key={`${i}-${j}-${k}`}>
              <mesh
                position={point}
                scale={controlPointSize}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPoint({ i, j, k })
                }}
              >
                <sphereGeometry />
                <meshStandardMaterial
                  color={
                    selectedPoint?.i === i && selectedPoint?.j === j && selectedPoint?.k === k
                      ? 'red'
                      : 'yellow'
                  }
                  emissive={
                    selectedPoint?.i === i && selectedPoint?.j === j && selectedPoint?.k === k
                      ? 'red'
                      : 'yellow'
                  }
                  emissiveIntensity={0.5}
                />
              </mesh>
              {selectedPoint?.i === i &&
                selectedPoint?.j === j &&
                selectedPoint?.k === k && (
                  <TransformControls
                    ref={transformRef}
                    position={point}
                    onMouseDown={handleTransformStart}
                    onChange={handleTransformChange}
                    onMouseUp={handleTransformEnd}
                    size={1}
                    mode="translate"
                    showX={true}
                    showY={true}
                    showZ={true}
                    translationSnap={0.1}
                    scale={transformScale}
                  />
                )}
            </group>
          )),
        ),
      )}
    </group>
  )
}
