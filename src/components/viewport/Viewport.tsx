import { useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GroundReflector } from './GroundReflector'
import MeshTransformControls from './MeshTransformControls'
import ControlPoints from './ControlPoints'
import ControlGrid from './ControlGrid'
import { useTheme, SCENE_COLORS } from '@/hooks/useTheme'
import type { TransformMode, ActiveObject, CameraView } from '@/types/footwear'
import type { FFD } from '@/utils/FFD'

interface ViewportProps {
  shoeMesh: THREE.Mesh | null
  lastMesh: THREE.Mesh | null
  resultMesh: THREE.Mesh | null
  transformMode: TransformMode
  activeObject: ActiveObject
  onTransformA: (matrix: THREE.Matrix4) => void
  onTransformB: (matrix: THREE.Matrix4) => void
  // Per-object display states
  isShoeTransparent: boolean
  isLastTransparent: boolean
  isShoeWireframe: boolean
  isLastWireframe: boolean
  isShoeHidden: boolean
  isLastHidden: boolean
  showGround: boolean
  showCSGResult: boolean
  isResultWireframe: boolean
  showVertexColors: boolean
  showFFDGrid: boolean
  /** Only show move/rotate/scale gimbal when in the Modify step */
  showTransformControls: boolean
  ffdA: FFD | null
  ffdB: FFD | null
  onFFDPointMoveA: (i: number, j: number, k: number, position: THREE.Vector3) => void
  onFFDPointMoveB: (i: number, j: number, k: number, position: THREE.Vector3) => void
  onDragStartA?: () => void
  onDragStartB?: () => void
  onFFDDragStartA?: () => void
  onFFDDragStartB?: () => void
  cameraViewRef: React.MutableRefObject<CameraView>
  orbitControlsRef: React.MutableRefObject<any>
  resetCameraTrigger: number
}

// ── Cursor controller ─────────────────────────────────────────────────────────
/**
 * Sets the canvas cursor to a grabbing hand while the right mouse button
 * is held (pan / drag with OrbitControls).
 */
function CursorController() {
  const { gl } = useThree()

  useEffect(() => {
    const el = gl.domElement

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        el.style.cursor = 'grabbing'
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        el.style.cursor = 'default'
      }
    }
    // Safety: restore if mouse leaves the canvas while button is held
    const onMouseLeave = () => {
      el.style.cursor = 'default'
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mouseleave', onMouseLeave)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [gl])

  return null
}

// ── Scene background ──────────────────────────────────────────────────────────
function SceneBackground() {
  const { scene } = useThree()
  const { isDark } = useTheme()

  useEffect(() => {
    const colors = isDark ? SCENE_COLORS.dark : SCENE_COLORS.light
    scene.background = new THREE.Color(colors.background)
  }, [isDark, scene])

  return null
}

// ── Camera controller ─────────────────────────────────────────────────────────
const DEFAULT_CAM_POS = new THREE.Vector3(-3, 2.5, -4)
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0.5, 0)
const ORTHO_DIST = 8
const ORTHO_FRUSTUM = 5 // half-size of orthographic frustum

const ORTHO_VIEWS = new Set<CameraView>(['top', 'bottom', 'front', 'back', 'left', 'right'])

function CameraController({
  cameraViewRef,
  orbitControlsRef,
  resetCameraTrigger,
}: {
  cameraViewRef: React.MutableRefObject<CameraView>
  orbitControlsRef: React.MutableRefObject<any>
  resetCameraTrigger: number
}) {
  const { camera, set, size } = useThree()
  const lastView = useRef<CameraView>('perspective')
  const lastReset = useRef(0)

  // Keep one persistent orthographic camera, reuse it across view switches
  const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null)
  const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null)

  // Capture the initial perspective camera on first render
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      perspCamRef.current = camera
    }
  }, [camera])

  // Pending rotate-lock: when switching from persp→ortho, OrbitControls with
  // makeDefault reinitialises after set({camera}) and resets enableRotate=true.
  // We store the desired state and enforce it for a few frames afterwards.
  const pendingRotateLock = useRef<{ enable: boolean; frames: number } | null>(null)

  const switchToView = (view: CameraView) => {
    const target = DEFAULT_CAM_TARGET.clone()
    const controls = orbitControlsRef.current

    if (view === 'perspective') {
      if (perspCamRef.current) {
        perspCamRef.current.position.copy(DEFAULT_CAM_POS)
        perspCamRef.current.lookAt(target)
        set({ camera: perspCamRef.current })
      }
      if (controls) {
        controls.target.copy(target)
        controls.update()
      }
      // Let OrbitControls reinitialise, then enable rotation after a few frames
      pendingRotateLock.current = { enable: true, frames: 4 }
      return
    }

    // Build or reuse the orthographic camera
    const aspect = size.width / size.height
    if (!orthoCamRef.current) {
      orthoCamRef.current = new THREE.OrthographicCamera(
        -ORTHO_FRUSTUM * aspect,
         ORTHO_FRUSTUM * aspect,
         ORTHO_FRUSTUM,
        -ORTHO_FRUSTUM,
        0.01,
        1000,
      )
    }
    const ortho = orthoCamRef.current
    ortho.left   = -ORTHO_FRUSTUM * aspect
    ortho.right  =  ORTHO_FRUSTUM * aspect
    ortho.top    =  ORTHO_FRUSTUM
    ortho.bottom = -ORTHO_FRUSTUM
    ortho.updateProjectionMatrix()

    switch (view) {
      case 'top':    ortho.position.set(target.x, target.y + ORTHO_DIST, target.z); break
      case 'bottom': ortho.position.set(target.x, target.y - ORTHO_DIST, target.z); break
      case 'front':  ortho.position.set(target.x, target.y, target.z + ORTHO_DIST); break
      case 'back':   ortho.position.set(target.x, target.y, target.z - ORTHO_DIST); break
      case 'left':   ortho.position.set(target.x - ORTHO_DIST, target.y, target.z); break
      case 'right':  ortho.position.set(target.x + ORTHO_DIST, target.y, target.z); break
    }

    ortho.lookAt(target)
    set({ camera: ortho })

    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
    // Disable rotation — enforce for several frames so OrbitControls
    // reinitialisation (triggered by camera swap) cannot undo it
    pendingRotateLock.current = { enable: false, frames: 4 }
  }

  useFrame(() => {
    // Enforce the pending rotate lock every frame until the counter runs out
    if (pendingRotateLock.current && pendingRotateLock.current.frames > 0) {
      const controls = orbitControlsRef.current
      if (controls) {
        controls.enableRotate = pendingRotateLock.current.enable
      }
      pendingRotateLock.current.frames--
    }

    // Handle reset trigger — always returns to perspective
    if (resetCameraTrigger !== lastReset.current) {
      lastReset.current = resetCameraTrigger
      cameraViewRef.current = 'perspective'
      lastView.current = 'perspective'
      switchToView('perspective')
      return
    }

    // Handle named view switches
    if (cameraViewRef.current !== lastView.current) {
      const view = cameraViewRef.current
      lastView.current = view
      switchToView(view)
    }
  })

  // Keep orthographic frustum in sync when window is resized
  useEffect(() => {
    if (orthoCamRef.current && ORTHO_VIEWS.has(lastView.current as CameraView)) {
      const aspect = size.width / size.height
      orthoCamRef.current.left   = -ORTHO_FRUSTUM * aspect
      orthoCamRef.current.right  =  ORTHO_FRUSTUM * aspect
      orthoCamRef.current.top    =  ORTHO_FRUSTUM
      orthoCamRef.current.bottom = -ORTHO_FRUSTUM
      orthoCamRef.current.updateProjectionMatrix()
    }
  }, [size])

  return null
}

// ── Wireframe overlay ────────────────────────────────────────────────────────
/** Adds a wireframe LineSegments overlay on top of the solid mesh. */
function WireframeOverlay({ mesh }: { mesh: THREE.Mesh }) {
  useEffect(() => {
    const wireGeo = new THREE.WireframeGeometry(mesh.geometry)
    const mat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
    })
    const wireframe = new THREE.LineSegments(wireGeo, mat)
    mesh.add(wireframe)

    return () => {
      mesh.remove(wireframe)
      wireGeo.dispose()
      mat.dispose()
    }
  }, [mesh])

  return null
}

// ── Main Viewport ─────────────────────────────────────────────────────────────
export function Viewport({
  shoeMesh,
  lastMesh,
  resultMesh,
  transformMode,
  activeObject,
  onTransformA,
  onTransformB,
  isShoeTransparent,
  isLastTransparent,
  isShoeWireframe,
  isLastWireframe,
  isShoeHidden,
  isLastHidden,
  showGround,
  showCSGResult,
  isResultWireframe,
  showVertexColors,
  showFFDGrid,
  showTransformControls,
  ffdA,
  ffdB,
  onFFDPointMoveA,
  onFFDPointMoveB,
  onDragStartA,
  onDragStartB,
  onFFDDragStartA,
  onFFDDragStartB,
  cameraViewRef,
  orbitControlsRef,
  resetCameraTrigger,
}: ViewportProps) {
  // ── Imperative materials ────────────────────────────────────────────────
  // Create materials via useMemo so vertexColors is set in the constructor,
  // guaranteeing the shader compiles with vertex-color support.
  const shoeHasVC = !!shoeMesh?.geometry?.attributes?.color
  const shoeMaterial = useMemo(() => {
    const useVC = showVertexColors && shoeHasVC
    return new THREE.MeshPhysicalMaterial({
      color: useVC ? 0xffffff : 0x7c8594,
      vertexColors: useVC,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
  }, [showVertexColors, shoeHasVC])

  // Update non-shader props synchronously (no recompilation needed)
  shoeMaterial.transparent = isShoeTransparent
  shoeMaterial.opacity = isShoeTransparent ? 0.35 : 1
  shoeMaterial.depthWrite = !isShoeTransparent
  shoeMaterial.wireframe = isShoeWireframe

  const resultHasVC = !!resultMesh?.geometry?.attributes?.color
  const resultMaterial = useMemo(() => {
    const useVC = showVertexColors && resultHasVC
    return new THREE.MeshPhysicalMaterial({
      color: useVC ? 0xffffff : 0xe8ddc8,
      vertexColors: useVC,
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.15,
      side: THREE.DoubleSide,
    })
  }, [showVertexColors, resultHasVC])

  // Dispose previous materials when they change
  useEffect(() => () => { shoeMaterial.dispose() }, [shoeMaterial])
  useEffect(() => () => { resultMaterial.dispose() }, [resultMaterial])

  return (
    <Canvas
      camera={{ position: [-3, 2.5, -4], fov: 50, near: 0.01, far: 1000 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      className="w-full h-full"
    >
      <SceneBackground />
      <CursorController />
      <CameraController
        cameraViewRef={cameraViewRef}
        orbitControlsRef={orbitControlsRef}
        resetCameraTrigger={resetCameraTrigger}
      />

      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.6} />
      <pointLight position={[0, 5, 0]} intensity={0.3} />

      {/* Ground plane with reflections */}
      <Suspense fallback={null}>
        <GroundReflector
          visible={showGround}
          shoeMesh={shoeMesh}
          lastMesh={lastMesh}
          resultMesh={resultMesh}
        />
      </Suspense>

      {/* Orbit Controls */}
      <OrbitControls
        ref={orbitControlsRef}
        target={[0, 0.5, 0]}
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={50}
        makeDefault
      />

      {/* ── Shoe Mesh (Object A) ─────────────────────────────────────── */}
      {shoeMesh && !showCSGResult && !isShoeHidden && (
        <>
          <primitive object={shoeMesh} material={shoeMaterial} />
          {showTransformControls && !showFFDGrid && activeObject === 'A' && (
            <MeshTransformControls
              mesh={shoeMesh}
              mode={transformMode}
              enabled={true}
              onTransform={onTransformA}
              onDragStart={onDragStartA}
              space="world"
              size={1}
              orbitControlsRef={orbitControlsRef}
            />
          )}
          {/* FFD grid for shoe — control points are already in world space
              because updateTransform() is called on every mesh transform */}
          {showFFDGrid && ffdA && activeObject === 'A' && (
            <>
              <ControlGrid ffdBox={ffdA} />
              <ControlPoints
                ffdBox={ffdA}
                onPointMove={onFFDPointMoveA}
                onDragStart={onFFDDragStartA}
                orbitControlsRef={orbitControlsRef}
              />
            </>
          )}
        </>
      )}

      {/* ── Last Mesh (Object B) ─────────────────────────────────────── */}
      {lastMesh && !showCSGResult && !isLastHidden && (
        <>
          {/*
            Last always has depthWrite=false + renderOrder=1 so it draws
            on top of the shoe's transparent fragments and stays visible
            through a transparent shoe from any camera angle.
          */}
          <primitive object={lastMesh} renderOrder={1}>
            <meshPhysicalMaterial
              color="#c4930a"
              roughness={0.55}
              metalness={0.05}
              transparent={true}
              opacity={isLastTransparent ? 0.35 : isShoeTransparent ? 1.0 : 0.6}
              depthWrite={false}
              wireframe={isLastWireframe}
              side={THREE.DoubleSide}
            />
          </primitive>
          {showTransformControls && !showFFDGrid && activeObject === 'B' && (
            <MeshTransformControls
              mesh={lastMesh}
              mode={transformMode}
              enabled={true}
              onTransform={onTransformB}
              onDragStart={onDragStartB}
              space="world"
              size={1}
              orbitControlsRef={orbitControlsRef}
            />
          )}
          {/* FFD grid for last — control points are already in world space
              because updateTransform() is called on every mesh transform */}
          {showFFDGrid && ffdB && activeObject === 'B' && (
            <>
              <ControlGrid ffdBox={ffdB} />
              <ControlPoints
                ffdBox={ffdB}
                onPointMove={onFFDPointMoveB}
                onDragStart={onFFDDragStartB}
                orbitControlsRef={orbitControlsRef}
              />
            </>
          )}
        </>
      )}

      {/* ── CSG Result Mesh ──────────────────────────────────────────── */}
      {resultMesh && showCSGResult && (
        <>
          <primitive object={resultMesh} material={resultMaterial} />
          {isResultWireframe && <WireframeOverlay mesh={resultMesh} />}
        </>
      )}
    </Canvas>
  )
}
