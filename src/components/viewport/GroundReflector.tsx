import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { Reflector } from '@/utils/Reflector'
import { useTheme, SCENE_COLORS } from '@/hooks/useTheme'

/** Stable default so the useEffect dependency doesn't change on every render. */
const DEFAULT_SIZE: [number, number] = [50, 50]

interface GroundReflectorProps {
  size?: [number, number]
  mixStrength?: number
  resolution?: number
  visible?: boolean
  shoeMesh?: THREE.Mesh | null
  lastMesh?: THREE.Mesh | null
  resultMesh?: THREE.Mesh | null
}

/**
 * R3F wrapper for the Reflector class.
 * Creates a ground plane with planar mirror reflections.
 * The `visible` prop toggles the plane without destroying/recreating it.
 * When mesh refs are provided, the ground Y auto-aligns to the lowest
 * visible mesh each frame (uses mesh.parent to detect scene membership).
 */
export function GroundReflector({
  size = DEFAULT_SIZE,
  mixStrength = 0.25,
  resolution = 512,
  visible = true,
  shoeMesh,
  lastMesh,
  resultMesh,
}: GroundReflectorProps) {
  const reflectorRef = useRef<Reflector | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { gl, scene, camera } = useThree()
  const { isDark } = useTheme()
  const _box = useRef(new THREE.Box3())

  useEffect(() => {
    const colors = isDark ? SCENE_COLORS.dark : SCENE_COLORS.light
    const reflector = new Reflector(size, {
      mixStrength,
      resolution,
      color: colors.ground,
    })
    reflector.rotation.x = -Math.PI / 2
    reflector.position.y = -0.001
    // Respect current visibility so a recreated reflector doesn't flash on
    reflector.visible = visible

    reflectorRef.current = reflector

    if (groupRef.current) {
      groupRef.current.add(reflector)
    }

    return () => {
      if (groupRef.current) {
        groupRef.current.remove(reflector)
      }
      reflector.dispose()
    }
  }, [isDark, size, mixStrength, resolution])

  // Toggle visibility without re-creating the reflector
  useEffect(() => {
    if (reflectorRef.current) {
      reflectorRef.current.visible = visible
    }
  }, [visible])

  useFrame(() => {
    // Only update reflection render when visible
    if (reflectorRef.current && visible) {
      reflectorRef.current.update(gl, scene, camera)
    }

    // Auto-align ground to the lowest point of whichever meshes are in the scene.
    // mesh.parent !== null means R3F has added it via <primitive> — the reliable
    // visibility check without needing to pass extra boolean props.
    if (!groupRef.current) return
    let minY = 0
    let found = false
    for (const mesh of [shoeMesh, lastMesh, resultMesh]) {
      if (!mesh || !mesh.parent) continue
      _box.current.setFromObject(mesh)
      if (!found || _box.current.min.y < minY) {
        minY = _box.current.min.y
        found = true
      }
    }
    groupRef.current.position.y = found ? minY : 0
  })

  return <group ref={groupRef} />
}
