# FootwearMaker - Comprehensive Porting Plan

## Extraction of FootwearApp from Pixogen into a Standalone WebApp

---

## 1. Project Overview

### Goal
Extract the FootwearApp from the Pixogen platform and rebuild it as **FootwearMaker** - a standalone webapp with:
- New UI/UX based on the robotics-pick-and-place design language
- Reflector-based ground reflections (no HDRI/skybox)
- Shared Firebase backend (same database as Pixogen)
- Cloned login system for seamless user authentication

### Source Codebases
| Source | Path | Stack |
|--------|------|-------|
| FootwearApp | `PixogenApp/pixogen/components/apps/FootwearApp.tsx` | Next.js, React Three Fiber, Firebase |
| Footwear Components | `PixogenApp/pixogen/components/footwear/*` | R3F, Three.js, CSG, FFD |
| Robotics App (Design Ref) | `robotics-pick-and-place/` | Vite, React 19, raw Three.js |
| Pixogen Auth | `PixogenApp/pixogen/firebase/*`, `hooks/useAuth.ts` | Firebase Auth, Firestore |

---

## 2. Architecture Decisions

### 2.1 Tech Stack for FootwearMaker

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build Tool** | **Vite** | Matches robotics app, faster dev/build than Next.js, no SSR needed for a 3D SPA |
| **React Version** | **React 19** | Matches robotics app, latest features |
| **3D Rendering** | **React Three Fiber (R3F)** | Keep R3F from FootwearApp - rewriting 1800+ lines of R3F code to raw Three.js would be massive effort with no benefit. R3F works fine with Vite. |
| **Styling** | **Tailwind CSS** | Already used in both source apps |
| **Icons** | **lucide-react** | Matches robotics design, replaces emoji-based buttons |
| **State Management** | **React useState/useContext** | Keep simple, same as current |
| **Routing** | **React Router v7** (minimal) | Only 2 routes: `/login` and `/` (main app) |
| **Firebase** | **Same project** | Shared database, same env vars |
| **Deployment** | **Vercel / Firebase Hosting** | Static SPA, easy deploy |

### 2.2 Key Architectural Changes from Pixogen

1. **No Next.js** - Pure SPA with Vite (no SSR, no API routes)
2. **No `next/dynamic`** - Replace with React.lazy + Suspense
3. **No `next/image`** - Replace with standard `<img>` tags
4. **No `next-themes`** - Custom dark/light mode (like robotics app)
5. **API proxy needed** - For beta-code validation and user initialization (serverless functions or separate backend)
6. **Self-contained** - No dependency on Pixogen's component library (shadcn/ui)

---

## 3. Project Structure

```
FootwearMaker/
├── public/
│   ├── media/                    # Static assets (icons, mesh.png, etc.)
│   └── models/                   # Default shoe/last library files
├── src/
│   ├── main.tsx                  # React 19 root entry
│   ├── App.tsx                   # Main app with routing & auth guard
│   ├── index.css                 # Tailwind imports + glass-panel utilities
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthUI.tsx        # Google Sign-In (cloned from Pixogen)
│   │   │
│   │   ├── layout/
│   │   │   ├── Toolbar.tsx       # Floating glass-panel toolbar (from robotics)
│   │   │   ├── Sidebar.tsx       # Slide-in sidebar with step panels
│   │   │   └── ThemeProvider.tsx  # Dark/light mode context
│   │   │
│   │   ├── viewport/
│   │   │   ├── Viewport.tsx      # R3F Canvas + scene setup
│   │   │   ├── SceneContent.tsx  # Lights, camera, ground, meshes
│   │   │   ├── Reflector.tsx     # Ported from robotics (adapted for R3F)
│   │   │   ├── MeshLoader.tsx    # OBJ/GLB/STL loading component
│   │   │   ├── TransformControls.tsx
│   │   │   ├── ControlPoints.tsx # FFD control point spheres
│   │   │   └── ControlGrid.tsx   # FFD grid lines
│   │   │
│   │   ├── panels/               # Sidebar step panels
│   │   │   ├── WelcomePanel.tsx
│   │   │   ├── ShoePanel.tsx     # Step 1: Load Shoe
│   │   │   ├── LastPanel.tsx     # Step 2: Load Last
│   │   │   ├── ModifyPanel.tsx   # Step 3: Transform + FFD
│   │   │   └── ResultPanel.tsx   # Step 4: CSG result + Save
│   │   │
│   │   ├── modals/
│   │   │   ├── ShoeLibrary.tsx   # Firebase shoe gallery
│   │   │   ├── LastLibrary.tsx   # Firebase last gallery
│   │   │   └── ImageGallery.tsx  # 2D image gallery
│   │   │
│   │   └── ui/                   # Minimal UI primitives
│   │       ├── Button.tsx        # Glass-panel button (robotics style)
│   │       ├── Toast.tsx         # Toast notification
│   │       ├── Slider.tsx
│   │       ├── Switch.tsx
│   │       └── Select.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # Firebase auth hook (cloned)
│   │   ├── useTheme.ts           # Dark/light mode hook
│   │   └── useToast.ts           # Toast notification hook
│   │
│   ├── firebase/
│   │   ├── config.ts             # Firebase init (same env vars as Pixogen)
│   │   ├── auth.ts               # Auth functions (Google sign-in)
│   │   └── storage.ts            # Upload, download, gallery functions
│   │
│   ├── utils/
│   │   ├── FFD.ts                # Free-Form Deformation engine (direct port)
│   │   ├── meshHelpers.ts        # standardizeMesh, scaleMeshToMatch, etc.
│   │   └── exporters.ts          # GLB/STL export utilities
│   │
│   ├── types/
│   │   ├── ffd.ts                # FFDSettings interface
│   │   ├── footwear.ts           # App-specific types
│   │   └── firebase.ts           # User, storage types
│   │
│   └── config/
│       └── appCosts.ts           # Credit costs (FootwearApp = 10)
│
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.example                  # Firebase env template
└── README.md
```

---

## 4. Detailed Migration Plan

### Phase 1: Project Scaffolding & Infrastructure

#### 1.1 Initialize Vite + React 19 Project
```bash
npm create vite@latest FootwearMaker -- --template react-ts
```

#### 1.2 Core Dependencies
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "three": "^0.181.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "three-bvh-csg": "^0.0.16",
    "firebase": "^10.x",
    "lucide-react": "^0.500.0",
    "undo-manager": "^1.0.5",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

#### 1.3 Firebase Configuration
Copy environment variables from Pixogen (same Firebase project):
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> **Note**: Vite uses `VITE_` prefix instead of `NEXT_PUBLIC_`. All Firebase config references must be updated.

#### 1.4 Firebase Config Module
Port `firebase/firebase.ts` with env var prefix change:
```typescript
// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ... same fields, VITE_ prefix
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

---

### Phase 2: Authentication System

#### 2.1 Clone Auth Module
Port from `pixogen/firebase/auth.ts`:

**Functions to port:**
- `doSignInWithGoogle()` - Primary auth method (Google popup)
- `doSignOut()` - Sign out
- `onAuthStateChangedListener()` - Auth state observer

**Functions to simplify/skip initially:**
- `doCreateUserWithEmailAndPassword()` - Can add later
- `doSignInWithEmailAndPassword()` - Can add later
- `doSignInWithGithub()` - Can add later
- Beta code validation - Requires API endpoint (Phase 6)
- User initialization - Requires API endpoint (Phase 6)

#### 2.2 Clone useAuth Hook
Direct port of `pixogen/hooks/useAuth.ts` (17 lines, minimal changes):
```typescript
// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase/config';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
```

#### 2.3 Login Page
Clone from `pixogen/components/auth/AuthUI.tsx` and `app/login/page.tsx`:
- Redesign with robotics glass-panel aesthetic
- Full-screen dark background with centered glass card
- Google Sign-In button with robotics styling
- App branding: "FootwearMaker" instead of "Pixogen"

#### 2.4 Auth Guard
```typescript
// In App.tsx
function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  return <FootwearMaker />;
}
```

---

### Phase 3: UI Design System (Robotics Style)

#### 3.1 Theme System
Port from robotics App.tsx dark/light mode system:

```typescript
// Theme colors
const themes = {
  dark: {
    bg: 'bg-slate-950',
    text: 'text-slate-100',
    glass: 'bg-slate-900/80 border-white/10 backdrop-blur-xl',
    sceneBg: 0x020617,  // slate-950
  },
  light: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    glass: 'bg-white/70 border-white/80 backdrop-blur-xl',
    sceneBg: 0xdbeafe,  // blue-100
  }
};
```

#### 3.2 Glass Panel CSS Utilities
```css
/* index.css */
@layer utilities {
  .glass-panel {
    @apply backdrop-blur-xl border transition-all duration-300;
  }
  .glass-panel-dark {
    @apply bg-slate-900/80 border-white/10 text-slate-100;
  }
  .glass-panel-light {
    @apply bg-white/70 border-white/80 text-slate-800;
  }
}
```

#### 3.3 Floating Toolbar (Bottom)
Port from robotics `Toolbar.tsx`:
- **Position**: `absolute bottom-10 left-10` (desktop) / `left-1/2 -translate-x-1/2` (mobile)
- **Button size**: `w-14 h-14 rounded-2xl`
- **Style**: Glass panel + shadow-xl + hover:scale-105 + active:scale-95

**Toolbar Buttons for FootwearMaker:**
| Button | Icon (lucide) | Function |
|--------|--------------|----------|
| Dark/Light | `Moon` / `Sun` | Toggle theme |
| Sidebar | `PanelRight` | Toggle sidebar |
| Wireframe | `Box` | Toggle wireframe overlay |
| Transparency | `Eye` / `EyeOff` | Toggle shoe transparency |
| Camera Reset | `RotateCcw` | Reset camera to default |
| Camera Views | `Camera` | Dropdown for 7 views |
| Undo | `Undo2` | Undo transform |
| Redo | `Redo2` | Redo transform |

#### 3.4 Slide-in Sidebar (Right Side)
Redesign from robotics TabbedSidebar pattern:
- **Position**: Right side, slides in/out
- **Width**: ~320px (20rem)
- **Style**: Glass panel with blur
- **Content**: Step-based panels (no tabs, sequential workflow)

**Sidebar Layout:**
```
+-------------------------------------------+
| FootwearMaker                    [Close X] |
+-------------------------------------------+
| Step Indicator: 1 → 2 → 3 → 4            |
+-------------------------------------------+
|                                           |
| [Active Step Content Panel]               |
|   - Step 1: Shoe Selection               |
|   - Step 2: Last Selection               |
|   - Step 3: Modify / Transform / FFD     |
|   - Step 4: Result / Export / Save        |
|                                           |
+-------------------------------------------+
| [< Back]              [Next >]            |
+-------------------------------------------+
```

#### 3.5 Full-Viewport Layout
Match robotics layout:
```
+--------------------------------------------------+
|                                                  |
|           Full-Screen 3D Viewport                |
|         (fills entire browser window)            |
|                                                  |
|                                    +-----------+ |
|                                    |  Sidebar  | |
|                                    |  (glass)  | |
|                                    |           | |
|                                    |  Step N   | |
|                                    |  Content  | |
|                                    |           | |
|                                    +-----------+ |
|                                                  |
|  +--------+--------+-----+                       |
|  | Theme  | Sidebar| ... | <- Floating Toolbar   |
|  +--------+--------+-----+                       |
+--------------------------------------------------+
```

---

### Phase 4: 3D Viewport & Visualization

#### 4.1 Viewport Component (R3F)
Port from `pixogen/components/footwear/Viewport.tsx` (1784 lines) with major refactoring:

**What to keep:**
- R3F `<Canvas>` setup
- Model loading: `loadModelFile()` helper (OBJ, GLB, STL)
- Mesh standardization: `standardizeMesh()`, `scaleMeshToMatch()`
- CSG operations: `three-bvh-csg` (Brush, Evaluator, SUBTRACTION)
- Camera management with 7 views
- Keyboard shortcuts (m, r, s, f)
- FFD integration with ControlGrid/ControlPoints

**What to change:**
- Remove `next-themes` dependency, use custom ThemeProvider
- Remove duplicate code between Viewport.tsx and ViewportWrapper.tsx
- Replace HDRI/environment with Reflector-based ground
- Clean up console.log statements (debug artifacts)
- Split the 1784-line file into smaller components (<300 lines each)

**Refactoring Plan for Viewport.tsx:**
```
Viewport.tsx (1784 lines) → Split into:
├── Viewport.tsx          (~200 lines) - Canvas + scene config
├── SceneContent.tsx      (~200 lines) - Lights, camera, environment
├── MeshLoader.tsx        (~250 lines) - loadModelFile, standardize, scale
├── ShoeScene.tsx         (~200 lines) - Shoe + Last mesh rendering
├── CSGOperations.tsx     (~150 lines) - CSG subtraction logic
├── CameraManager.tsx     (~100 lines) - Camera views + orbit controls
└── KeyboardShortcuts.tsx (~80 lines)  - Keyboard event handlers
```

#### 4.2 Reflector Integration
Port `robotics-pick-and-place/Reflector.ts` and adapt for R3F:

The Reflector class is raw Three.js. For R3F integration, wrap it:

```typescript
// src/components/viewport/Reflector.tsx
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Reflector as ReflectorClass } from '../../utils/Reflector';

interface ReflectorProps {
  size?: [number, number];
  mixStrength?: number;
  resolution?: number;
  position?: [number, number, number];
}

export function GroundReflector({
  size = [50, 50],
  mixStrength = 0.25,
  resolution = 512,
  position = [0, -0.001, 0]
}: ReflectorProps) {
  const reflectorRef = useRef<ReflectorClass>(null);
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    const reflector = new ReflectorClass(size, {
      mixStrength,
      resolution,
      color: 0x888888,
    });
    reflector.position.set(...position);
    reflector.rotation.x = -Math.PI / 2;
    reflectorRef.current = reflector;

    return () => {
      reflector.dispose();
    };
  }, []);

  useFrame(() => {
    if (reflectorRef.current) {
      reflectorRef.current.update(gl, scene, camera);
    }
  });

  return reflectorRef.current ? (
    <primitive object={reflectorRef.current} />
  ) : null;
}
```

**Reflector Configuration for Shoe Visualization:**
- Resolution: 512x512 (performance) or 1024x1024 (quality)
- mixStrength: 0.25 (subtle reflection)
- Ground plane: Large enough to reflect shoe mesh (50x50 units)
- Material: MeshPhysicalMaterial base (roughness: 0.5, metalness: 0.1)
- Color: Theme-dependent (dark: 0x111827, light: 0xf8fafc)

#### 4.3 Scene Lighting (No HDRI)
Replace HDRI-based lighting with direct lights + Reflector ground:

```typescript
// Scene lighting setup
<>
  <ambientLight intensity={0.4} />
  <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
  <directionalLight position={[-3, 4, -3]} intensity={0.6} />
  <pointLight position={[0, 5, 0]} intensity={0.3} />
  <GroundReflector />
</>
```

#### 4.4 Background
Solid color backgrounds (matching robotics app):
- Dark mode: `0x020617` (slate-950)
- Light mode: `0xdbeafe` (blue-100)
- Applied via R3F `<Canvas>` `gl.setClearColor()`

#### 4.5 Remove LazyViewportWrapper
No need for `next/dynamic` in Vite. Use React.lazy if needed:
```typescript
const Viewport = React.lazy(() => import('./viewport/Viewport'));
```

---

### Phase 5: Core Footwear Logic

#### 5.1 FFD Engine (Direct Port)
Port `pixogen/utils/footwear/FFD.ts` (453 lines) as-is:
- Change import path alias `@/types/footwear/ffd` to relative
- No logic changes needed - pure Three.js, framework-agnostic
- Clean up excessive console.log statements

#### 5.2 FFD Types (Direct Port)
Port `pixogen/types/footwear/ffd.ts` (5 lines):
```typescript
export interface FFDSettings {
  lengthSubdivisions: number;
  widthSubdivisions: number;
  heightSubdivisions: number;
}
```

#### 5.3 ControlPoints Component (Minor Changes)
Port `pixogen/components/footwear/ControlPoints.tsx` (173 lines):
- Change `@/utils/footwear/FFD` to relative import
- Clean up console.log debug statements
- Keep R3F `<TransformControls>` from @react-three/drei

#### 5.4 ControlGrid Component (Minor Changes)
Port `pixogen/components/footwear/ControlGrid.tsx` (87 lines):
- Change imports to relative
- Clean up console.log debug statements

#### 5.5 TransformControls Component (Direct Port)
Port `pixogen/components/footwear/TransformControls.tsx` (86 lines):
- Change imports to relative
- Keep R3F integration

#### 5.6 CSG Operations
Extract from Viewport.tsx into dedicated module:
- `performCSGSubtraction(meshA, meshB)` - Pure function
- Uses `three-bvh-csg`: Brush, Evaluator, SUBTRACTION

#### 5.7 Mesh Helpers
Extract from Viewport.tsx:
- `loadModelFile(file)` - Load OBJ/GLB/STL file into BufferGeometry
- `standardizeMesh(geometry)` - Center and normalize geometry
- `scaleMeshToMatch(geoA, geoB)` - Scale B to match A's bounding box
- `exportToGLB(mesh)` - Export result mesh

---

### Phase 6: Firebase Storage & Gallery

#### 6.1 Storage Module
Port from `pixogen/firebase/storage.ts` (742 lines), keeping only footwear-relevant functions:

**Functions to port:**
- `uploadFile(file, userId, category, subcategory)` - Upload shoe/last/result
- `getUserFiles(userId, category)` - List user's files
- `deleteFile(userId, filePath)` - Delete a file
- `getFileDownloadURL(path)` - Get download URL
- `checkStorageLimit(userId)` - Check user's storage quota
- `uploadScreenshot(canvas, userId)` - Capture thumbnail

**Functions to skip:**
- History management (not needed for FootwearMaker)
- Video-specific functions
- Functions for other Pixogen apps

**Changes needed:**
- Replace `NEXT_PUBLIC_` env vars with `VITE_` prefix
- Remove dependency on Next.js API routes

#### 6.2 Shoe/Last Library
Port library modals from FootwearApp.tsx:
- `ShoeLibrary.tsx` - Browse/select shoes from user gallery or defaults
- `LastLibrary.tsx` - Browse/select lasts from user gallery or defaults
- Redesign with glass-panel aesthetic
- Use grid layout with thumbnails

#### 6.3 Credit System
Port from `pixogen/config/appCosts.ts`:
- `FootwearApp = 10 credits` per save operation
- `getUserCredits(userId)` - Check balance
- `updateUserCredits(userId, amount)` - Deduct credits

#### 6.4 API Endpoints (Serverless Functions)
Some Pixogen features rely on Next.js API routes. For the standalone app, create minimal serverless functions:

**Option A: Vite + Firebase Functions**
```
functions/
├── validate-beta-code.ts     # Beta code validation
├── initialize-user.ts        # New user setup (basic plan + credits)
└── update-credits.ts         # Credit operations (server-side validation)
```

**Option B: Direct Firestore (Client-Side)**
For MVP, credit operations can be done client-side with Firestore security rules:
```
// Firestore security rules ensure users can only modify their own credits
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId &&
    request.resource.data.credits >= 0;
}
```

> **Recommendation**: Start with Option B for MVP, add serverless functions in Phase 7 for security.

---

### Phase 7: Sidebar Workflow Panels

#### 7.1 Step Structure (Preserved from FootwearApp)
The 5-step workflow remains the same:

| Step | Name | Content |
|------|------|---------|
| 0 | Welcome | App intro, start button |
| 1 | Load Shoe | Upload or select from library, shoe types |
| 2 | Load Last | Upload or select from library, last types |
| 3 | Modify | Transform tools (Move/Rotate/Scale), FFD controls, Mirror, Rotate90 |
| 4 | Result | CSG result preview, save to library, export GLB/STL |

#### 7.2 Panel Component Mapping

**WelcomePanel.tsx** (New - simplified from FootwearApp)
- App logo + title
- "Start New Project" button
- Recent projects (optional, Phase 8)

**ShoePanel.tsx** (Port from Sidebar.tsx Step 1)
- File upload (OBJ, GLB, STL)
- Shoe type selector: Sneaker, Loafer, Sandal
- "Select from Library" button (opens ShoeLibrary modal)
- Default shoe thumbnails

**LastPanel.tsx** (Port from Sidebar.tsx Step 2)
- File upload (OBJ, GLB, STL)
- Last type selector: Standard, Sneaker, Traditional, High Heel
- "Select from Library" button (opens LastLibrary modal)
- Default last thumbnails

**ModifyPanel.tsx** (Port from Sidebar.tsx Step 3)
- **Transform Mode**: Move / Rotate / Scale buttons (lucide icons: `Move`, `RotateCw`, `Maximize2`)
- **FFD Controls**:
  - Subdivision sliders (length, width, height: 2-6)
  - "Show FFD Grid" toggle
  - "Reset FFD" button
- **Quick Tools**:
  - Mirror X/Y/Z buttons
  - Rotate 90 X/Y/Z buttons
- **Active Object** toggle: Shoe / Last

**ResultPanel.tsx** (Port from Sidebar.tsx Step 4)
- "Compute Result" button (runs CSG subtraction)
- Result preview info (vertex count, dimensions)
- "Save to Library" button (10 credits)
- "Export GLB" / "Export STL" download buttons
- "Start New" button

#### 7.3 Sidebar State Management

Currently FootwearApp.tsx has ~50 state variables. Consolidate into a context:

```typescript
interface FootwearState {
  // Workflow
  currentStep: number;

  // Files
  shoeFile: string | File | null;
  lastFile: string | File | null;

  // Meshes
  shoeMesh: THREE.Mesh | null;
  lastMesh: THREE.Mesh | null;
  resultMesh: THREE.Mesh | null;

  // Transforms
  transformMode: 'translate' | 'rotate' | 'scale';
  transformMatrixA: THREE.Matrix4;
  transformMatrixB: THREE.Matrix4;
  activeObject: 'A' | 'B';

  // FFD
  ffdSettingsA: FFDSettings;
  ffdSettingsB: FFDSettings;
  ffdA: FFD | null;
  ffdB: FFD | null;
  showFFDGrid: boolean;

  // Display
  showWireframe: boolean;
  isTransparent: boolean;
  showCSGResult: boolean;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
}
```

---

### Phase 8: Features NOT Ported (Scope Reduction)

These Pixogen-specific features will NOT be included in FootwearMaker v1:

| Feature | Reason |
|---------|--------|
| `InlineScribbleApp` | Pixogen-specific drawing tool |
| `ShoeDesignAssistant` (AI Chat) | Complex AI integration, add later |
| `ImageGalleryModal` | Not core to shoe making workflow |
| `ThreeDGalleryModal` | Can be added later |
| Cutting Plane tool | Optional, add in v2 |
| Beta code system | Simplify for standalone |
| Email/Password auth | Start with Google-only, add later |
| GitHub auth | Start with Google-only, add later |

---

## 5. Implementation Phases & Timeline

### Phase 1: Foundation (Week 1)
- [ ] Scaffold Vite + React 19 + TypeScript project
- [ ] Setup Tailwind CSS with glass-panel utilities
- [ ] Configure Firebase (shared project)
- [ ] Implement auth system (Google Sign-In)
- [ ] Create login page with robotics design
- [ ] Implement auth guard (redirect to login if not authenticated)
- [ ] Setup React Router (/ and /login routes)

### Phase 2: UI Shell (Week 1-2)
- [ ] Implement ThemeProvider (dark/light mode)
- [ ] Build Toolbar component (floating glass buttons)
- [ ] Build Sidebar component (slide-in, glass panel)
- [ ] Create full-viewport layout
- [ ] Build basic UI primitives (Button, Slider, Switch, Toast)
- [ ] Implement step indicator component

### Phase 3: 3D Viewport (Week 2-3)
- [ ] Setup R3F Canvas with proper configuration
- [ ] Port and adapt Reflector class for R3F
- [ ] Implement scene lighting (no HDRI)
- [ ] Port model loading (OBJ, GLB, STL)
- [ ] Port mesh standardization and scaling
- [ ] Implement camera management (7 views)
- [ ] Port TransformControls component
- [ ] Theme-aware background colors

### Phase 4: Core Features (Week 3-4)
- [ ] Port FFD engine (utils/FFD.ts)
- [ ] Port ControlPoints + ControlGrid components
- [ ] Implement FFD ↔ Viewport integration
- [ ] Port CSG operations (three-bvh-csg)
- [ ] Implement undo/redo system
- [ ] Port keyboard shortcuts

### Phase 5: Workflow Panels (Week 4-5)
- [ ] Build WelcomePanel
- [ ] Build ShoePanel (upload + library)
- [ ] Build LastPanel (upload + library)
- [ ] Build ModifyPanel (transform tools + FFD controls)
- [ ] Build ResultPanel (CSG result + export)
- [ ] Wire up step navigation

### Phase 6: Firebase Integration (Week 5)
- [ ] Port storage functions (upload, download, list)
- [ ] Implement ShoeLibrary modal
- [ ] Implement LastLibrary modal
- [ ] Implement save-to-library with credit deduction
- [ ] Implement GLB/STL export and download
- [ ] Add screenshot capture for thumbnails

### Phase 7: Polish & Deploy (Week 6)
- [ ] Responsive design (mobile viewport)
- [ ] Loading states and error handling
- [ ] Performance optimization (lazy loading, memoization)
- [ ] Remove all debug console.log statements
- [ ] Deploy to Vercel/Firebase Hosting
- [ ] Add Firebase authorized domains
- [ ] Test end-to-end workflow

---

## 6. File-by-File Migration Map

| Pixogen Source | FootwearMaker Target | Action |
|----------------|---------------------|--------|
| `firebase/firebase.ts` | `src/firebase/config.ts` | Port + change env prefix |
| `firebase/config.ts` | (merged into config.ts) | Eliminate duplicate |
| `firebase/auth.ts` | `src/firebase/auth.ts` | Port, Google-only initially |
| `firebase/storage.ts` | `src/firebase/storage.ts` | Port relevant functions only |
| `hooks/useAuth.ts` | `src/hooks/useAuth.ts` | Port + add loading state |
| `components/auth/AuthUI.tsx` | `src/components/auth/AuthUI.tsx` | Port + redesign |
| `app/login/page.tsx` | (integrated in App.tsx) | Redesign as SPA route |
| `config/appCosts.ts` | `src/config/appCosts.ts` | Port FootwearApp cost only |
| `types/footwear/ffd.ts` | `src/types/ffd.ts` | Direct copy |
| `utils/footwear/FFD.ts` | `src/utils/FFD.ts` | Port + clean up console.logs |
| `components/footwear/Viewport.tsx` | `src/components/viewport/*.tsx` | **Refactor into 6+ files** |
| `components/footwear/ViewportWrapper.tsx` | (eliminated) | Merge into Viewport |
| `components/footwear/LazyViewportWrapper.tsx` | (eliminated) | Use React.lazy |
| `components/footwear/ControlPoints.tsx` | `src/components/viewport/ControlPoints.tsx` | Port + clean up |
| `components/footwear/ControlGrid.tsx` | `src/components/viewport/ControlGrid.tsx` | Port + clean up |
| `components/footwear/TransformControls.tsx` | `src/components/viewport/TransformControls.tsx` | Direct port |
| `components/footwear/FileUpload.tsx` | `src/components/ui/FileUpload.tsx` | Port + redesign |
| `components/footwear/Sidebar.tsx` | `src/components/panels/*.tsx` | **Split into 5 panels** |
| `components/apps/FootwearApp.tsx` | `src/App.tsx` + Context | **Refactor: extract state** |
| `robotics/Reflector.ts` | `src/utils/Reflector.ts` | Port + R3F wrapper |
| `robotics/Toolbar.tsx` | `src/components/layout/Toolbar.tsx` | Adapt for footwear buttons |
| `robotics/App.tsx` (design only) | Various layout components | Design reference only |

---

## 7. Critical Integration Points

### 7.1 Firebase Auth Domain
FootwearMaker needs its own domain added to Firebase authorized domains:
```
Firebase Console → Authentication → Settings → Authorized domains
Add: footwearmaker.com (or whatever domain)
Add: localhost (for development)
```

### 7.2 Firebase Storage Rules
Ensure storage rules allow FootwearMaker users to access their files:
```
// Storage rules should work as-is since we use the same user UIDs
match /users/{userId}/{allPaths=**} {
  allow read, write: if request.auth.uid == userId;
}
```

### 7.3 CORS for Storage
If FootwearMaker is on a different domain than Pixogen, update Firebase Storage CORS:
```json
[
  {
    "origin": ["https://footwearmaker.com", "http://localhost:5173"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

### 7.4 Shared User Data
Both apps read from the same Firestore collections:
- `users/{uid}` - User profile, credits, subscription
- Storage paths: `users/{uid}/models/`, `users/{uid}/shoes/`, etc.

> **Important**: FootwearMaker should NOT modify user subscription data. Only read credits and deduct them for save operations.

---

## 8. Design Comparison: Before vs After

### Current FootwearApp (Pixogen)
- Sidebar: Fixed left, 20rem, traditional panel design
- Buttons: Emoji-based (e.g., "eye" emoji for transparency)
- Theme: Inherited from Pixogen platform
- Background: HDRI-based environment
- Layout: Sidebar + viewport (not full-screen)

### New FootwearMaker (Robotics Design)
- Sidebar: Slide-in right, glass panel, backdrop-blur
- Buttons: lucide-react icons in glass-panel rounded buttons
- Theme: Custom dark/light with slate color palette
- Background: Solid color + Reflector ground
- Layout: Full-viewport 3D with floating overlays
- Toolbar: Floating bottom-left glass panel
- Animations: hover:scale-105, active:scale-95, smooth transitions

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| R3F + Vite compatibility | Medium | R3F officially supports Vite; test early |
| Reflector + R3F integration | Medium | Create wrapper early, test with shoe meshes |
| Firebase auth on new domain | Low | Just add domain to authorized list |
| 3D performance (Reflector overhead) | Low | Use 512px resolution, conditional rendering |
| Storage CORS issues | Low | Configure CORS before launch |
| Viewport.tsx refactoring (1784 lines) | High | Careful splitting, test each extracted component |
| Console.log cleanup | Low | Search and remove all debug statements |
| Missing API endpoints | Medium | Start with client-side Firestore, add functions later |

---

## 10. Summary

The porting consists of **three main workstreams**:

1. **Infrastructure** (20%): Vite scaffold, Firebase config, auth system, routing
2. **UI Redesign** (30%): Robotics glass-panel design, floating toolbar, slide-in sidebar, theme system
3. **3D/Logic Port** (50%): Viewport refactoring, Reflector integration, FFD engine, CSG, mesh operations, storage

**Total estimated effort**: 6 weeks for a single developer
**Lines of code to migrate**: ~5,500 lines (with significant refactoring)
**Lines of new code**: ~2,000 lines (UI redesign, Reflector wrapper, state management)

The most critical and complex task is the **Viewport.tsx refactoring** (1784 lines into 6+ smaller components) combined with the **Reflector integration**. This should be tackled first after the foundation is set up.
