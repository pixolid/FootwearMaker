import { useState, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthUI } from '@/components/auth/AuthUI'
import { Toolbar } from '@/components/layout/Toolbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { GallerySidebar } from '@/components/layout/GallerySidebar'
import { Viewport } from '@/components/viewport/Viewport'
import { ToastContainer } from '@/components/ui/Toast'
import { LibraryModal } from '@/components/modals/LibraryModal'
import { WelcomePanel } from '@/components/panels/WelcomePanel'
import { ShoePanel } from '@/components/panels/ShoePanel'
import { LastPanel } from '@/components/panels/LastPanel'
import { ModifyPanel } from '@/components/panels/ModifyPanel'
import { ResultPanel } from '@/components/panels/ResultPanel'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useUndoStack } from '@/hooks/useUndoStack'
import type { MeshSnapshot, UndoSnapshot } from '@/hooks/useUndoStack'
import { FFD } from '@/utils/FFD'
import {
  loadModelFile,
  loadModelFromURL,
  standardizeMesh,
  scaleMeshToMatch,
  exportToGLB,
  exportToSTL,
  exportToOBJ,
} from '@/utils/meshHelpers'
import { uploadFile, getUserCredits, updateUserCredits } from '@/firebase/storage'
import { generateFilename } from '@/utils/filename'
import { smoothSeam } from '@/utils/seamSmoothing'
import { APP_COSTS } from '@/config/appCosts'
import type {
  TransformMode,
  ActiveObject,
  CameraView,
  FFDSettings,
} from '@/types/footwear'
import { Loader2 } from 'lucide-react'

function App() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthUI />
  }

  return (
    <ThemeProvider>
      <FootwearMaker userId={user.uid} />
    </ThemeProvider>
  )
}

interface FootwearMakerProps {
  userId: string
}

function FootwearMaker({ userId }: FootwearMakerProps) {
  const { toasts, toast, dismiss } = useToast()

  // Workflow state
  const [currentStep, setCurrentStep] = useState(0)
  // Track how far the user has progressed — controls which tabs are visible
  const [maxReachedStep, setMaxReachedStep] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [gallerySidebarOpen, setGallerySidebarOpen] = useState(false)
  const [galleryRefreshTrigger, setGalleryRefreshTrigger] = useState(0)

  // Library modal state
  const [libraryModal, setLibraryModal] = useState<'shoe' | 'last' | null>(null)

  // Files
  const [shoeFile, setShoeFile] = useState<string | File | null>(null)
  const [lastFile, setLastFile] = useState<string | File | null>(null)

  // 3D Meshes
  const [shoeMesh, setShoeMesh] = useState<THREE.Mesh | null>(null)
  const [lastMesh, setLastMesh] = useState<THREE.Mesh | null>(null)
  const [resultMesh, setResultMesh] = useState<THREE.Mesh | null>(null)

  // Transform
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [activeObject, setActiveObject] = useState<ActiveObject>('A')

  // FFD
  const [ffdA, setFfdA] = useState<FFD | null>(null)
  const [ffdB, setFfdB] = useState<FFD | null>(null)
  const [showFFDGrid, setShowFFDGrid] = useState(false)
  const [ffdSettingsA, setFfdSettingsA] = useState<FFDSettings>({
    lengthSubdivisions: 3,
    widthSubdivisions: 3,
    heightSubdivisions: 3,
  })
  const [ffdSettingsB, setFfdSettingsB] = useState<FFDSettings>({
    lengthSubdivisions: 3,
    widthSubdivisions: 3,
    heightSubdivisions: 3,
  })

  // Display — all per-object, ground toggle
  const [isShoeWireframe, setIsShoeWireframe] = useState(false)
  const [isLastWireframe, setIsLastWireframe] = useState(false)
  const [isShoeTransparent, setIsShoeTransparent] = useState(false)
  const [isLastTransparent, setIsLastTransparent] = useState(false)
  const [isShoeHidden, setIsShoeHidden] = useState(false)
  const [isLastHidden, setIsLastHidden] = useState(false)
  const [showGround, setShowGround] = useState(true)
  const [showCSGResult, setShowCSGResult] = useState(false)
  const [isComputing, setIsComputing] = useState(false)
  const [isResultWireframe, setIsResultWireframe] = useState(false)
  const [showVertexColors, setShowVertexColors] = useState(false)

  // Smoothing
  const [rawResultGeometry, setRawResultGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [toolGeometryRef] = useState<{ current: THREE.BufferGeometry | null }>({ current: null })
  const [isSmoothing, setIsSmoothing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [smoothRadius, setSmoothRadius] = useState(0.5)
  const [smoothStrength, setSmoothStrength] = useState(0.5)

  // Credits
  const [credits, setCredits] = useState(0)

  // Refs
  const cameraViewRef = useRef<CameraView>('perspective')
  const orbitControlsRef = useRef<any>(null)
  // Ref that always points to the latest handleComputeCSG so goToStep
  // can call it without a circular useCallback dependency
  const computeCSGRef = useRef<() => void>(() => { })
  // Incrementing this number triggers an imperative camera reset in the viewport
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0)

  // ─── Undo system ──────────────────────────────────────────────────────────
  const { canUndo, canRedo, pushSnapshot, popSnapshot, popRedo, clear: clearUndo } = useUndoStack()

  /** Capture a full snapshot of both meshes + FFD state for undo */
  const captureSnapshot = useCallback((): UndoSnapshot => {
    const snapMesh = (
      mesh: THREE.Mesh | null,
      ffd: FFD | null,
    ): MeshSnapshot | null => {
      if (!mesh) return null
      return {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        scale: mesh.scale.clone(),
        ffd: ffd
          ? {
            controlPoints: ffd.getControlPoints(),
            originalControlPoints: ffd.getOriginalControlPoints()!,
            currentTransform: ffd.getCurrentTransform(),
          }
          : null,
      }
    }
    return {
      meshA: snapMesh(shoeMesh, ffdA),
      meshB: snapMesh(lastMesh, ffdB),
    }
  }, [shoeMesh, lastMesh, ffdA, ffdB])

  /** Restore a single mesh + FFD from a snapshot */
  const restoreMesh = useCallback(
    (
      snap: MeshSnapshot | null,
      mesh: THREE.Mesh | null,
      ffd: FFD | null,
    ) => {
      if (!snap || !mesh) return
      mesh.position.copy(snap.position)
      mesh.rotation.copy(snap.rotation)
      mesh.scale.copy(snap.scale)
      mesh.updateMatrix()
      if (ffd && snap.ffd) {
        ffd.restoreSnapshot(
          snap.ffd.controlPoints,
          snap.ffd.originalControlPoints,
          snap.ffd.currentTransform,
        )
        const deformed = ffd.getDeformedGeometry()
        mesh.geometry.dispose()
        mesh.geometry = deformed
      }
    },
    [],
  )

  const handleUndo = useCallback(() => {
    const current = captureSnapshot()
    const snapshot = popSnapshot(current)
    if (!snapshot) return
    restoreMesh(snapshot.meshA, shoeMesh, ffdA)
    restoreMesh(snapshot.meshB, lastMesh, ffdB)
  }, [captureSnapshot, popSnapshot, restoreMesh, shoeMesh, lastMesh, ffdA, ffdB])

  const handleRedo = useCallback(() => {
    const current = captureSnapshot()
    const snapshot = popRedo(current)
    if (!snapshot) return
    restoreMesh(snapshot.meshA, shoeMesh, ffdA)
    restoreMesh(snapshot.meshB, lastMesh, ffdB)
  }, [captureSnapshot, popRedo, restoreMesh, shoeMesh, lastMesh, ffdA, ffdB])

  // Refs for keyboard shortcut (avoids stale closures in the [] effect)
  const handleUndoRef = useRef(handleUndo)
  useEffect(() => {
    handleUndoRef.current = handleUndo
  }, [handleUndo])
  const handleRedoRef = useRef(handleRedo)
  useEffect(() => {
    handleRedoRef.current = handleRedo
  }, [handleRedo])
  const canUndoRef = useRef(canUndo)
  useEffect(() => {
    canUndoRef.current = canUndo
  }, [canUndo])
  const canRedoRef = useRef(canRedo)
  useEffect(() => {
    canRedoRef.current = canRedo
  }, [canRedo])
  const currentStepRef = useRef(currentStep)
  useEffect(() => {
    currentStepRef.current = currentStep
  }, [currentStep])

  // Clear undo stack only when going back to an earlier editing stage (steps 0-2).
  // Going forward to step 4 (Result) must NOT clear history — the user should be
  // able to preview the CSG and return to Modify with their full undo history intact.
  useEffect(() => {
    if (currentStep < 3) clearUndo()
  }, [currentStep, clearUndo])

  // Load credits on mount
  useEffect(() => {
    getUserCredits(userId).then(setCredits)
  }, [userId])

  // Step navigation helper — also updates maxReachedStep.
  // When advancing to step 4 (Result), automatically triggers CSG computation.
  // When navigating back from step 4, restore original mesh visibility.
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 4) {
      if (step === 4) {
        // Trigger CSG — handleComputeCSG will call goToStep(4) again once done
        computeCSGRef.current()
        return
      }
      // Going back from Result → Modify: hide CSG result, show original meshes
      if (step === 3) {
        setShowCSGResult(false)
      }
      // Going back to Shoe step: remove last from scene
      if (step === 1) {
        setLastMesh(null)
        setLastFile(null)
        setFfdB(null)
        clearUndo()
      }
      setCurrentStep(step)
      setMaxReachedStep((prev) => Math.max(prev, step))
    }
  }, [clearUndo])

  // ─── Shoe loading ──────────────────────────────────────────────────────────

  const loadShoeGeometry = useCallback(
    async (geo: THREE.BufferGeometry, name: string) => {
      const standardized = standardizeMesh(geo)
      const mesh = new THREE.Mesh(standardized)
      setShoeMesh(mesh)
      setShoeFile(name as any)
      setFfdA(new FFD(standardized, ffdSettingsA))
      toast({ title: 'Shoe loaded', type: 'success' })
      goToStep(2) // advance to Last step
    },
    [ffdSettingsA, toast, goToStep],
  )

  const handleShoeFileChange = useCallback(
    async (file: File) => {
      try {
        const geo = await loadModelFile(file)
        await loadShoeGeometry(geo, file.name)
      } catch {
        toast({ title: 'Failed to load shoe model', type: 'error' })
      }
    },
    [loadShoeGeometry, toast],
  )

  const handleShoeFromLibrary = useCallback(
    async (url: string, name: string) => {
      try {
        toast({ title: 'Loading from library…', type: 'info' })
        const geo = await loadModelFromURL(url)
        await loadShoeGeometry(geo, name)
      } catch {
        toast({ title: 'Failed to load shoe from library', type: 'error' })
      }
    },
    [loadShoeGeometry, toast],
  )

  // ─── Last loading ──────────────────────────────────────────────────────────

  const loadLastGeometry = useCallback(
    async (geo: THREE.BufferGeometry, name: string) => {
      let standardized = standardizeMesh(geo)
      if (shoeMesh) {
        standardized = scaleMeshToMatch(shoeMesh.geometry, standardized)
      }
      const mesh = new THREE.Mesh(standardized)
      setLastMesh(mesh)
      setLastFile(name as any)
      setFfdB(new FFD(standardized, ffdSettingsB))
      toast({ title: 'Last loaded', type: 'success' })
      goToStep(3) // advance to Modify step
    },
    [ffdSettingsB, shoeMesh, toast, goToStep],
  )

  const handleLastFileChange = useCallback(
    async (file: File) => {
      try {
        const geo = await loadModelFile(file)
        await loadLastGeometry(geo, file.name)
      } catch {
        toast({ title: 'Failed to load last model', type: 'error' })
      }
    },
    [loadLastGeometry, toast],
  )

  const handleLastFromLibrary = useCallback(
    async (url: string, name: string) => {
      try {
        toast({ title: 'Loading from library…', type: 'info' })
        const geo = await loadModelFromURL(url)
        await loadLastGeometry(geo, name)
      } catch {
        toast({ title: 'Failed to load last from library', type: 'error' })
      }
    },
    [loadLastGeometry, toast],
  )

  // ─── Transform handlers ────────────────────────────────────────────────────

  const handleTransformA = useCallback(
    (matrix: THREE.Matrix4) => {
      if (ffdA) ffdA.updateTransform(matrix)
    },
    [ffdA],
  )

  const handleTransformB = useCallback(
    (matrix: THREE.Matrix4) => {
      if (ffdB) ffdB.updateTransform(matrix)
    },
    [ffdB],
  )

  // ─── FFD point move ────────────────────────────────────────────────────────

  const handleFFDPointMoveA = useCallback(
    (i: number, j: number, k: number, position: THREE.Vector3) => {
      if (ffdA) {
        ffdA.moveControlPoint(i, j, k, position)
        if (shoeMesh) {
          const deformed = ffdA.getDeformedGeometry()
          shoeMesh.geometry.dispose()
          shoeMesh.geometry = deformed
        }
      }
    },
    [ffdA, shoeMesh],
  )

  const handleFFDPointMoveB = useCallback(
    (i: number, j: number, k: number, position: THREE.Vector3) => {
      if (ffdB) {
        ffdB.moveControlPoint(i, j, k, position)
        if (lastMesh) {
          const deformed = ffdB.getDeformedGeometry()
          lastMesh.geometry.dispose()
          lastMesh.geometry = deformed
        }
      }
    },
    [ffdB, lastMesh],
  )

  // ─── CSG ──────────────────────────────────────────────────────────────────

  const handleComputeCSG = useCallback(async () => {
    if (!shoeMesh || !lastMesh) {
      toast({ title: 'Both shoe and last models are required', type: 'error' })
      return
    }

    setIsComputing(true)
    try {
      // Yield to the browser so the spinner renders before the heavy computation
      await new Promise((r) => setTimeout(r, 50))

      // Force matrix updates — matrixAutoUpdate only runs before rendering
      shoeMesh.updateMatrix()
      shoeMesh.updateMatrixWorld(true)
      lastMesh.updateMatrix()
      lastMesh.updateMatrixWorld(true)

      // Clone geometries and ensure vertex normals are present
      const geoA = shoeMesh.geometry.clone()
      const geoB = lastMesh.geometry.clone()
      geoA.computeVertexNormals()
      geoB.computeVertexNormals()

      // Build brushes — copy position/rotation/scale so the Brush world
      // matrix matches the mesh exactly (same pattern as original Pixogen)
      const brushA = new Brush(geoA)
      brushA.position.copy(shoeMesh.position)
      brushA.rotation.copy(shoeMesh.rotation)
      brushA.scale.copy(shoeMesh.scale)
      brushA.updateMatrix()
      brushA.updateMatrixWorld()

      const brushB = new Brush(geoB)
      brushB.position.copy(lastMesh.position)
      brushB.rotation.copy(lastMesh.rotation)
      brushB.scale.copy(lastMesh.scale)
      brushB.updateMatrix()
      brushB.updateMatrixWorld()

      const evaluator = new Evaluator()
      evaluator.useGroups = false
      evaluator.attributes = ['position', 'normal']

      const result = evaluator.evaluate(brushA, brushB, SUBTRACTION)

      // Capture the tool geometry in world space for seam detection
      const toolGeo = geoB.clone()
      toolGeo.applyMatrix4(brushB.matrixWorld)
      toolGeometryRef.current = toolGeo

      // Clean up intermediate geometry
      geoA.dispose()
      geoB.dispose()

      // Store raw CSG geometry for re-smoothing on demand
      const rawGeo = result.geometry.clone()
      rawGeo.computeVertexNormals()
      setRawResultGeometry(rawGeo)

      const mesh = new THREE.Mesh(result.geometry)
      setResultMesh(mesh)
      setShowCSGResult(true)
      // Directly set step 4 — bypasses the goToStep guard that would re-trigger CSG
      setCurrentStep(4)
      setMaxReachedStep((prev) => Math.max(prev, 4))
      toast({ title: 'Result computed', type: 'success' })
    } catch (err) {
      console.error('CSG computation failed:', err)
      toast({ title: 'CSG computation failed', type: 'error' })
    } finally {
      setIsComputing(false)
    }
  }, [shoeMesh, lastMesh, toolGeometryRef, toast])

  // Keep the ref in sync so goToStep can call the latest version
  // without creating a circular dependency
  useEffect(() => {
    computeCSGRef.current = handleComputeCSG
  }, [handleComputeCSG])

  // ─── Apply seam smoothing on demand ───────────────────────────────────────

  const handleApplySmoothing = useCallback(async () => {
    if (!rawResultGeometry) return
    const toolGeo = toolGeometryRef.current
    if (!toolGeo) {
      toast({ title: 'Tool geometry not available', type: 'error' })
      return
    }

    setIsSmoothing(true)
    // Yield to browser so the spinner renders before the heavy computation
    await new Promise((r) => setTimeout(r, 50))

    try {
      const smoothed = smoothSeam(rawResultGeometry, toolGeo, {
        strength: smoothStrength,
        radius: smoothRadius,
      })
      setResultMesh(new THREE.Mesh(smoothed))
      toast({ title: 'Edge smoothing applied', type: 'success' })
    } catch (err) {
      console.error('Smoothing computation failed:', err)
      toast({ title: 'Smoothing failed — showing raw result', type: 'error' })
    } finally {
      setIsSmoothing(false)
    }
  }, [rawResultGeometry, toolGeometryRef, toast, smoothRadius, smoothStrength])

  // ─── Save to library ───────────────────────────────────────────────────────

  const handleSaveToLibrary = useCallback(async () => {
    if (!resultMesh) return
    const cost = APP_COSTS.FootwearApp

    if (credits < cost) {
      toast({ title: 'Not enough credits', type: 'error' })
      return
    }

    setIsSaving(true)

    try {
      // 1. Generate Pixogen-compatible base filename
      const baseFilename = generateFilename('footwearapp', 'shoe')

      // 2. Frame the shoe in the camera, capture thumbnail, then restore
      const canvas = document.querySelector('canvas')
      if (!canvas) throw new Error('Canvas not found')

      const controls = orbitControlsRef.current
      const camera = controls?.object as THREE.PerspectiveCamera | undefined
      let origCamPos: THREE.Vector3 | null = null
      let origTarget: THREE.Vector3 | null = null

      if (camera && controls) {
        origCamPos = camera.position.clone()
        origTarget = controls.target.clone()

        const box = new THREE.Box3().setFromObject(resultMesh)
        const center = new THREE.Vector3()
        box.getCenter(center)
        const sphere = new THREE.Sphere()
        box.getBoundingSphere(sphere)
        const fovRad = THREE.MathUtils.degToRad(camera.fov)
        const dist = (sphere.radius / Math.sin(fovRad / 2)) * 1.4
        const direction = new THREE.Vector3(-1, 0.6, -1).normalize()
        camera.position.copy(center).addScaledVector(direction, dist)
        controls.target.copy(center)
        controls.update()
      }

      // Wait two frames for the renderer to catch up
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      const thumbBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create thumbnail'))),
          'image/png',
          1.0,
        )
      })

      // Restore original camera position
      if (origCamPos && origTarget && camera && controls) {
        camera.position.copy(origCamPos)
        controls.target.copy(origTarget)
        controls.update()
      }

      // 3. Export result mesh to GLB
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
      const exporter = new GLTFExporter()
      const glbBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          resultMesh,
          (result) => resolve(result as ArrayBuffer),
          (error) => reject(error),
          { binary: true },
        )
      })

      // 4. Upload thumbnail + model to Pixogen-compatible paths
      const thumbFile = new File([thumbBlob], `${baseFilename}_thumb.png`, { type: 'image/png' })
      const modelFile = new File(
        [new Blob([glbBuffer], { type: 'model/gltf-binary' })],
        `${baseFilename}.glb`,
      )
      await uploadFile(thumbFile, userId, 'models/thumbnails', `${baseFilename}_thumb.png`)
      await uploadFile(modelFile, userId, 'models', `${baseFilename}.glb`)

      // 5. Deduct credits (atomic transaction, only after successful upload)
      const success = await updateUserCredits(userId, cost, 'usage', 'Saved footwear model to gallery')
      if (!success) {
        toast({ title: 'Failed to deduct credits', type: 'error' })
        return
      }

      setCredits((prev) => prev - cost)
      setGalleryRefreshTrigger((n) => n + 1)
      toast({ title: 'Saved to Gallery', type: 'success' })
    } catch (error) {
      console.error('Save failed:', error)
      toast({ title: 'Failed to save to Gallery', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }, [resultMesh, userId, credits, toast])

  // ─── Export ────────────────────────────────────────────────────────────────

  const handleExportGLB = useCallback(() => {
    if (resultMesh) exportToGLB(resultMesh, 'footwear-result.glb')
  }, [resultMesh])

  const handleExportSTL = useCallback(() => {
    if (resultMesh) exportToSTL(resultMesh, 'footwear-result.stl')
  }, [resultMesh])

  const handleExportOBJ = useCallback(() => {
    if (resultMesh) exportToOBJ(resultMesh, 'footwear-result.obj')
  }, [resultMesh])

  // ─── Camera ────────────────────────────────────────────────────────────────

  const handleCameraView = useCallback((view: CameraView) => {
    cameraViewRef.current = view
  }, [])

  // Increment the trigger counter — the viewport's useFrame watches this and
  // immediately resets camera position + OrbitControls target
  const handleResetCamera = useCallback(() => {
    setResetCameraTrigger((n) => n + 1)
  }, [])

  // ─── Quick tools ───────────────────────────────────────────────────────────

  const handleMirror = useCallback(
    (axis: 'x' | 'y' | 'z') => {
      const mesh = activeObject === 'A' ? shoeMesh : lastMesh
      const ffd = activeObject === 'A' ? ffdA : ffdB
      if (!mesh) return
      pushSnapshot(captureSnapshot())
      // Mirror via the mesh object's scale — keeps geometry and FFD in sync
      if (axis === 'x') mesh.scale.x *= -1
      if (axis === 'y') mesh.scale.y *= -1
      if (axis === 'z') mesh.scale.z *= -1
      mesh.updateMatrix()
      if (ffd) ffd.updateTransform(mesh.matrix)
    },
    [activeObject, shoeMesh, lastMesh, ffdA, ffdB, pushSnapshot, captureSnapshot],
  )

  const handleRotate90 = useCallback(
    (axis: 'x' | 'y' | 'z') => {
      const mesh = activeObject === 'A' ? shoeMesh : lastMesh
      const ffd = activeObject === 'A' ? ffdA : ffdB
      if (!mesh) return
      pushSnapshot(captureSnapshot())
      const angle = Math.PI / 2
      // Rotate via the mesh object's rotation — keeps geometry and FFD in sync
      if (axis === 'x') mesh.rotation.x += angle
      if (axis === 'y') mesh.rotation.y += angle
      if (axis === 'z') mesh.rotation.z += angle
      mesh.updateMatrix()
      if (ffd) ffd.updateTransform(mesh.matrix)
    },
    [activeObject, shoeMesh, lastMesh, ffdA, ffdB, pushSnapshot, captureSnapshot],
  )

  // ─── FFD Settings ──────────────────────────────────────────────────────────

  const handleFFDSettingsChangeA = useCallback(
    (settings: FFDSettings) => {
      setFfdSettingsA(settings)
      if (shoeMesh) setFfdA(new FFD(shoeMesh.geometry, settings))
      clearUndo()
    },
    [shoeMesh, clearUndo],
  )

  const handleFFDSettingsChangeB = useCallback(
    (settings: FFDSettings) => {
      setFfdSettingsB(settings)
      if (lastMesh) setFfdB(new FFD(lastMesh.geometry, settings))
      clearUndo()
    },
    [lastMesh, clearUndo],
  )

  const handleResetFFDGrid = useCallback(() => {
    pushSnapshot(captureSnapshot())
    if (activeObject === 'A' && shoeMesh) {
      const newFFD = new FFD(shoeMesh.geometry, ffdSettingsA)
      // Re-apply the current mesh transform so the grid stays aligned
      shoeMesh.updateMatrix()
      newFFD.updateTransform(shoeMesh.matrix)
      setFfdA(newFFD)
    }
    if (activeObject === 'B' && lastMesh) {
      const newFFD = new FFD(lastMesh.geometry, ffdSettingsB)
      lastMesh.updateMatrix()
      newFFD.updateTransform(lastMesh.matrix)
      setFfdB(newFFD)
    }
  }, [activeObject, shoeMesh, lastMesh, ffdSettingsA, ffdSettingsB, pushSnapshot, captureSnapshot])

  const handleResetFFD = useCallback(() => {
    pushSnapshot(captureSnapshot())
    if (activeObject === 'A' && ffdA && shoeMesh) {
      // Reset the FFD (control points + internal geometry back to initial)
      ffdA.reset()
      // Reset the mesh object transform (undo moves, mirrors, rotations)
      shoeMesh.position.set(0, 0, 0)
      shoeMesh.rotation.set(0, 0, 0)
      shoeMesh.scale.set(1, 1, 1)
      shoeMesh.updateMatrix()
      // Push the original geometry back onto the live mesh
      const reset = ffdA.getDeformedGeometry()
      shoeMesh.geometry.dispose()
      shoeMesh.geometry = reset
    }
    if (activeObject === 'B' && ffdB && lastMesh) {
      ffdB.reset()
      lastMesh.position.set(0, 0, 0)
      lastMesh.rotation.set(0, 0, 0)
      lastMesh.scale.set(1, 1, 1)
      lastMesh.updateMatrix()
      const reset = ffdB.getDeformedGeometry()
      lastMesh.geometry.dispose()
      lastMesh.geometry = reset
    }
  }, [activeObject, ffdA, ffdB, shoeMesh, lastMesh, pushSnapshot, captureSnapshot])

  // ─── Start new project ─────────────────────────────────────────────────────

  const handleStartNew = useCallback(() => {
    setShoeMesh(null)
    setLastMesh(null)
    setResultMesh(null)
    setShoeFile(null)
    setLastFile(null)
    setFfdA(null)
    setFfdB(null)
    setShowCSGResult(false)
    setShowFFDGrid(false)
    setIsShoeTransparent(false)
    setIsLastTransparent(false)
    setIsShoeWireframe(false)
    setIsLastWireframe(false)
    setIsShoeHidden(false)
    setIsLastHidden(false)
    setIsResultWireframe(false)
    setShowVertexColors(false)
    setRawResultGeometry(null)
    toolGeometryRef.current = null
    setIsSmoothing(false)
    setSmoothRadius(0.5)
    setSmoothStrength(0.5)
    setCurrentStep(0)
    setMaxReachedStep(0)
    clearUndo()
  }, [clearUndo])

  // ─── Step navigation ───────────────────────────────────────────────────────

  const canGoNext =
    currentStep === 0 ||
    (currentStep === 1 && !!shoeMesh) ||
    (currentStep === 2 && !!lastMesh) ||
    currentStep === 3

  const canGoPrev = currentStep > 0

  // ─── Undo drag-start callbacks (capture snapshot once per drag) ─────────
  const captureRef = useRef(captureSnapshot)
  useEffect(() => { captureRef.current = captureSnapshot }, [captureSnapshot])
  const pushRef = useRef(pushSnapshot)
  useEffect(() => { pushRef.current = pushSnapshot }, [pushSnapshot])

  const handleDragStartA = useCallback(() => {
    pushRef.current(captureRef.current())
  }, [])
  const handleDragStartB = useCallback(() => {
    pushRef.current(captureRef.current())
  }, [])
  const handleFFDDragStartA = useCallback(() => {
    pushRef.current(captureRef.current())
  }, [])
  const handleFFDDragStartB = useCallback(() => {
    pushRef.current(captureRef.current())
  }, [])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Cmd+Shift+Z / Ctrl+Shift+Z — redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (canRedoRef.current && currentStepRef.current === 3) {
          handleRedoRef.current()
        }
        return
      }
      // Cmd+Z / Ctrl+Z — undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (canUndoRef.current && currentStepRef.current === 3) {
          handleUndoRef.current()
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case 'm': setTransformMode('translate'); break
        case 'r': setTransformMode('rotate'); break
        case 's': setTransformMode('scale'); break
        case 'f': setShowFFDGrid((prev) => !prev); break
        case 'tab':
          e.preventDefault()
          setActiveObject((prev) => (prev === 'A' ? 'B' : 'A'))
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─── Render panel ──────────────────────────────────────────────────────────

  const renderPanel = () => {
    switch (currentStep) {
      case 0:
        return <WelcomePanel onStart={() => goToStep(1)} />
      case 1:
        return (
          <ShoePanel
            shoeFile={shoeFile}
            onFileChange={handleShoeFileChange}
            onOpenLibrary={() => setLibraryModal('shoe')}
          />
        )
      case 2:
        return (
          <LastPanel
            lastFile={lastFile}
            onFileChange={handleLastFileChange}
            onOpenLibrary={() => setLibraryModal('last')}
          />
        )
      case 3:
        return (
          <ModifyPanel
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            activeObject={activeObject}
            onActiveObjectChange={setActiveObject}
            showFFDGrid={showFFDGrid}
            onToggleFFDGrid={() => setShowFFDGrid((p) => !p)}
            ffdSettingsA={ffdSettingsA}
            ffdSettingsB={ffdSettingsB}
            onFFDSettingsChangeA={handleFFDSettingsChangeA}
            onFFDSettingsChangeB={handleFFDSettingsChangeB}
            onResetFFDGrid={handleResetFFDGrid}
            onResetFFD={handleResetFFD}
            onMirrorX={() => handleMirror('x')}
            onMirrorY={() => handleMirror('y')}
            onMirrorZ={() => handleMirror('z')}
            onRotate90X={() => handleRotate90('x')}
            onRotate90Y={() => handleRotate90('y')}
            onRotate90Z={() => handleRotate90('z')}
          />
        )
      case 4:
        return (
          <ResultPanel
            onSaveToLibrary={handleSaveToLibrary}
            onStartNew={handleStartNew}
            resultMesh={resultMesh}
            isComputing={isComputing}
            credits={credits}
            costPerSave={APP_COSTS.FootwearApp}
            onApplySmoothing={handleApplySmoothing}
            isSmoothing={isSmoothing}
            isSaving={isSaving}
            smoothRadius={smoothRadius}
            onSmoothRadiusChange={setSmoothRadius}
            smoothStrength={smoothStrength}
            onSmoothStrengthChange={setSmoothStrength}
          />
        )
      default:
        return null
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Full-viewport 3D Canvas */}
      <Viewport
        shoeMesh={shoeMesh}
        lastMesh={lastMesh}
        resultMesh={resultMesh}
        transformMode={transformMode}
        activeObject={activeObject}
        onTransformA={handleTransformA}
        onTransformB={handleTransformB}
        isShoeTransparent={isShoeTransparent}
        isLastTransparent={isLastTransparent}
        isShoeWireframe={isShoeWireframe}
        isLastWireframe={isLastWireframe}
        isShoeHidden={isShoeHidden}
        isLastHidden={isLastHidden}
        showGround={showGround}
        showCSGResult={showCSGResult}
        isResultWireframe={isResultWireframe}
        showVertexColors={showVertexColors}
        showFFDGrid={showFFDGrid}
        showTransformControls={currentStep === 3}
        ffdA={ffdA}
        ffdB={ffdB}
        onFFDPointMoveA={handleFFDPointMoveA}
        onFFDPointMoveB={handleFFDPointMoveB}
        onDragStartA={handleDragStartA}
        onDragStartB={handleDragStartB}
        onFFDDragStartA={handleFFDDragStartA}
        onFFDDragStartB={handleFFDDragStartB}
        cameraViewRef={cameraViewRef}
        orbitControlsRef={orbitControlsRef}
        resetCameraTrigger={resetCameraTrigger}
      />

      {/* Floating Toolbar — centered bottom */}
      <Toolbar
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        sidebarOpen={sidebarOpen}
        activeObject={activeObject}
        isActiveWireframe={currentStep === 4 ? isResultWireframe : activeObject === 'A' ? isShoeWireframe : isLastWireframe}
        onToggleWireframe={() => {
          if (currentStep === 4) setIsResultWireframe((p) => !p)
          else if (activeObject === 'A') setIsShoeWireframe((p) => !p)
          else setIsLastWireframe((p) => !p)
        }}
        isActiveTransparent={activeObject === 'A' ? isShoeTransparent : isLastTransparent}
        onToggleTransparency={() => {
          if (activeObject === 'A') setIsShoeTransparent((p) => !p)
          else setIsLastTransparent((p) => !p)
        }}
        isActiveHidden={activeObject === 'A' ? isShoeHidden : isLastHidden}
        onToggleVisibility={() => {
          if (activeObject === 'A') setIsShoeHidden((p) => !p)
          else setIsLastHidden((p) => !p)
        }}
        showVertexColors={showVertexColors}
        onToggleVertexColors={() => setShowVertexColors((p) => !p)}
        showGround={showGround}
        onToggleGround={() => setShowGround((p) => !p)}
        onResetCamera={handleResetCamera}
        onCameraView={handleCameraView}
        canUndo={canUndo && currentStep === 3}
        canRedo={canRedo && currentStep === 3}
        onUndo={handleUndo}
        onRedo={handleRedo}
        gallerySidebarOpen={gallerySidebarOpen}
        onToggleGallerySidebar={() => setGallerySidebarOpen((p) => !p)}
        showActiveObjectControls={currentStep === 3}
      />

      {/* Slide-in Sidebar — left side */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentStep={currentStep}
        maxReachedStep={maxReachedStep}
        onStepChange={goToStep}
        canGoNext={canGoNext}
        canGoPrev={canGoPrev}
        credits={credits}
        onOpenGallery={() => setGallerySidebarOpen(true)}
      >
        {renderPanel()}
      </Sidebar>

      {/* Library Modals
          category is used as:
            public  → users/public/{category}/
            private → users/{uid}/{category}/
          Matches the existing Pixogen Firebase Storage structure.
      */}
      <LibraryModal
        open={libraryModal === 'shoe'}
        onClose={() => setLibraryModal(null)}
        userId={userId}
        category="shoes"
        title="Shoe Library"
        onSelect={handleShoeFromLibrary}
        onUpload={handleShoeFileChange}
      />
      <LibraryModal
        open={libraryModal === 'last'}
        onClose={() => setLibraryModal(null)}
        userId={userId}
        category="lasts"
        title="Last Library"
        onSelect={handleLastFromLibrary}
        onUpload={handleLastFileChange}
      />

      {/* Gallery Sidebar — right side */}
      <GallerySidebar
        open={gallerySidebarOpen}
        onClose={() => setGallerySidebarOpen(false)}
        userId={userId}
        refreshTrigger={galleryRefreshTrigger}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default App
