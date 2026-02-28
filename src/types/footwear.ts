import type * as THREE from 'three'

export interface FFDSettings {
  lengthSubdivisions: number
  widthSubdivisions: number
  heightSubdivisions: number
}

export type TransformMode = 'translate' | 'rotate' | 'scale'
export type ActiveObject = 'A' | 'B'
export type CameraView = 'perspective' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export const SHOE_TYPES = ['Sneaker', 'Loafer', 'Sandal'] as const
export type ShoeType = (typeof SHOE_TYPES)[number]

export const LAST_TYPES = ['Standard', 'Sneaker', 'Traditional', 'High Heel'] as const
export type LastType = (typeof LAST_TYPES)[number]

export interface FootwearState {
  currentStep: number
  shoeFile: string | File | null
  lastFile: string | File | null
  shoeMesh: THREE.Mesh | null
  lastMesh: THREE.Mesh | null
  resultMesh: THREE.Mesh | null
  transformMode: TransformMode
  transformMatrixA: THREE.Matrix4
  transformMatrixB: THREE.Matrix4
  activeObject: ActiveObject
  ffdSettingsA: FFDSettings
  ffdSettingsB: FFDSettings
  showFFDGrid: boolean
  showWireframe: boolean
  isTransparent: boolean
  showCSGResult: boolean
  canUndo: boolean
  canRedo: boolean
}

export interface LibraryItem {
  name: string
  url: string
  thumbnail?: string
  type: string
  createdAt: number
}
