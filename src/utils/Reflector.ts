import * as THREE from 'three'

interface ReflectorOptions {
  mixStrength?: number
  resolution?: number
  color?: number
  multisample?: number
}

/**
 * Planar mirror reflection class.
 * Ported from robotics-pick-and-place Reflector.ts
 * Creates a ground plane that reflects the scene above it.
 */
export class Reflector extends THREE.Mesh {
  private reflectorCamera: THREE.PerspectiveCamera
  private renderTarget: THREE.WebGLRenderTarget
  private textureMatrix: THREE.Matrix4
  private clipPlane: THREE.Plane
  private clipVector: THREE.Vector4
  private mixStrength: number
  private reflectorWorldPosition: THREE.Vector3
  private cameraWorldPosition: THREE.Vector3
  private rotationMatrix: THREE.Matrix4
  private lookAtPosition: THREE.Vector3
  private normal: THREE.Vector3
  private view: THREE.Vector3
  private target: THREE.Vector3

  constructor(size: [number, number] = [50, 50], options: ReflectorOptions = {}) {
    const {
      mixStrength = 0.25,
      resolution = 512,
      color = 0x888888,
      multisample = 4,
    } = options

    const geometry = new THREE.PlaneGeometry(size[0], size[1])
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0,
    })

    super(geometry, material)

    this.mixStrength = mixStrength
    this.reflectorCamera = new THREE.PerspectiveCamera()
    this.textureMatrix = new THREE.Matrix4()
    this.clipPlane = new THREE.Plane()
    this.clipVector = new THREE.Vector4()
    this.reflectorWorldPosition = new THREE.Vector3()
    this.cameraWorldPosition = new THREE.Vector3()
    this.rotationMatrix = new THREE.Matrix4()
    this.lookAtPosition = new THREE.Vector3(0, 0, -1)
    this.normal = new THREE.Vector3(0, 0, 1)
    this.view = new THREE.Vector3()
    this.target = new THREE.Vector3()

    // Create render target
    this.renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      type: THREE.HalfFloatType,
      samples: multisample,
    })

    // Patch material shader to add reflection
    const scope = this
    material.onBeforeCompile = (shader) => {
      shader.uniforms.tDiffuse = { value: scope.renderTarget.texture }
      shader.uniforms.textureMatrix = { value: scope.textureMatrix }
      shader.uniforms.mixStrength = { value: scope.mixStrength }

      shader.vertexShader = `
        uniform mat4 textureMatrix;
        varying vec4 vUvReflect;
        ${shader.vertexShader}
      `.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vUvReflect = textureMatrix * vec4(position, 1.0);`,
      )

      shader.fragmentShader = `
        uniform sampler2D tDiffuse;
        uniform float mixStrength;
        varying vec4 vUvReflect;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec4 reflectColor = textureProj(tDiffuse, vUvReflect);
        gl_FragColor = mix(gl_FragColor, reflectColor, mixStrength);`,
      )
    }
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.reflectorWorldPosition.setFromMatrixPosition(this.matrixWorld)
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld)
    this.rotationMatrix.extractRotation(this.matrixWorld)

    this.normal.set(0, 0, 1)
    this.normal.applyMatrix4(this.rotationMatrix)

    this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition)
    // Reflect view vector
    this.view.reflect(this.normal).negate()
    this.view.add(this.reflectorWorldPosition)
    this.reflectorCamera.position.copy(this.view)

    this.lookAtPosition.set(0, 0, -1)
    this.lookAtPosition.applyMatrix4(this.rotationMatrix)
    this.lookAtPosition.add(this.reflectorWorldPosition)

    this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition)
    this.target.reflect(this.normal).negate()
    this.target.add(this.reflectorWorldPosition)
    this.reflectorCamera.up.set(0, 1, 0)
    this.reflectorCamera.up.applyMatrix4(this.rotationMatrix)
    this.reflectorCamera.up.reflect(this.normal)
    this.reflectorCamera.lookAt(this.target)

    if (camera instanceof THREE.PerspectiveCamera) {
      this.reflectorCamera.far = camera.far
      this.reflectorCamera.near = camera.near
      this.reflectorCamera.fov = camera.fov
      this.reflectorCamera.aspect = camera.aspect
    }
    this.reflectorCamera.updateProjectionMatrix()
    this.reflectorCamera.updateMatrixWorld()

    // Update texture matrix
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    )
    this.textureMatrix.multiply(this.reflectorCamera.projectionMatrix)
    this.textureMatrix.multiply(this.reflectorCamera.matrixWorldInverse)
    this.textureMatrix.multiply(this.matrixWorld)

    // Clip plane
    this.clipPlane.setFromNormalAndCoplanarPoint(this.normal, this.reflectorWorldPosition)
    this.clipPlane.applyMatrix4(this.reflectorCamera.matrixWorldInverse)
    this.clipVector.set(
      this.clipPlane.normal.x,
      this.clipPlane.normal.y,
      this.clipPlane.normal.z,
      this.clipPlane.constant,
    )

    const projectionMatrix = this.reflectorCamera.projectionMatrix
    const q = new THREE.Vector4()
    q.x = (Math.sign(this.clipVector.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0]
    q.y = (Math.sign(this.clipVector.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5]
    q.z = -1.0
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14]
    this.clipVector.multiplyScalar(2.0 / this.clipVector.dot(q))
    projectionMatrix.elements[2] = this.clipVector.x
    projectionMatrix.elements[6] = this.clipVector.y
    projectionMatrix.elements[10] = this.clipVector.z + 1.0
    projectionMatrix.elements[14] = this.clipVector.w

    // Render
    this.visible = false
    const currentRenderTarget = renderer.getRenderTarget()
    const currentXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    renderer.setRenderTarget(this.renderTarget)
    renderer.state.buffers.depth.setMask(true)
    renderer.clear()
    renderer.render(scene, this.reflectorCamera)
    renderer.xr.enabled = currentXrEnabled
    renderer.setRenderTarget(currentRenderTarget)
    this.visible = true
  }

  dispose() {
    this.renderTarget.dispose()
    ;(this.material as THREE.Material).dispose()
    this.geometry.dispose()
  }
}
