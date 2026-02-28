import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from 'firebase/storage'
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { storage, db } from './config'

// Upload a file to Firebase Storage
export async function uploadFile(
  file: File | Blob,
  userId: string,
  category: string,
  filename?: string,
): Promise<string> {
  const name = filename || `${Date.now()}-${(file as File).name || 'file'}`
  const storageRef = ref(storage, `users/${userId}/${category}/${name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export interface StorageFile {
  name: string
  url: string
  fullPath: string
  createdAt: number
  thumbnailUrl?: string
}

const MODEL_EXTENSIONS = ['.obj', '.glb', '.gltf', '.stl']
const isModelFile = (name: string) =>
  MODEL_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))

/** Try to get a thumbnail URL for a model file. Returns undefined if none found. */
async function fetchThumbnailUrl(basePath: string, nameWithoutExt: string): Promise<string | undefined> {
  for (const ext of ['png', 'jpg']) {
    // Support both {name}.png and {name}_thumb.png naming conventions
    for (const suffix of ['', '_thumb']) {
      try {
        const thumbRef = ref(storage, `${basePath}/thumbnails/${nameWithoutExt}${suffix}.${ext}`)
        return await getDownloadURL(thumbRef)
      } catch {
        // try next
      }
    }
  }
  return undefined
}

// Get all 3D model files for a user in a category (private storage)
export async function getUserFiles(
  userId: string,
  category: string,
): Promise<StorageFile[]> {
  const listRef = ref(storage, `users/${userId}/${category}`)
  try {
    const result = await listAll(listRef)
    // Only process actual 3D model files (exclude images, thumbnails folder items)
    const modelItems = result.items.filter((item) => isModelFile(item.name))
    const files = await Promise.all(
      modelItems.map(async (item) => {
        const url = await getDownloadURL(item)
        const metadata = await getMetadata(item)
        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '')
        const thumbnailUrl = await fetchThumbnailUrl(
          `users/${userId}/${category}`,
          nameWithoutExt,
        )
        return {
          name: item.name,
          url,
          fullPath: item.fullPath,
          createdAt: new Date(metadata.timeCreated).getTime(),
          thumbnailUrl,
        }
      }),
    )
    return files.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

// Get public/shared 3D model files accessible by all users
// Public models live at users/public/{category}/
export async function getPublicFiles(category: string): Promise<StorageFile[]> {
  const basePath = `users/public/${category}`
  const listRef = ref(storage, basePath)
  try {
    const result = await listAll(listRef)
    // Only process actual 3D model files (listAll also returns items in root, not subfolders)
    const modelItems = result.items.filter((item) => isModelFile(item.name))
    const files = await Promise.all(
      modelItems.map(async (item) => {
        const url = await getDownloadURL(item)
        const metadata = await getMetadata(item)
        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '')
        const thumbnailUrl = await fetchThumbnailUrl(basePath, nameWithoutExt)
        return {
          name: item.name,
          url,
          fullPath: item.fullPath,
          createdAt: new Date(metadata.timeCreated).getTime(),
          thumbnailUrl,
        }
      }),
    )
    return files.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

// Delete a file
export async function deleteFile(fullPath: string): Promise<void> {
  const fileRef = ref(storage, fullPath)
  await deleteObject(fileRef)
}

// Get download URL for a file path
export async function getFileDownloadURL(path: string): Promise<string> {
  const fileRef = ref(storage, path)
  return getDownloadURL(fileRef)
}

// Upload a screenshot/thumbnail from canvas
export async function uploadScreenshot(
  canvas: HTMLCanvasElement,
  userId: string,
  category: string,
  filename: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'))
        return
      }
      try {
        const url = await uploadFile(blob, userId, `${category}/thumbnails`, filename)
        resolve(url)
      } catch (error) {
        reject(error)
      }
    }, 'image/png')
  })
}

// Get user credits from Pixogen-compatible `userCredits/{uid}` collection
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const userCreditsRef = doc(db, 'userCredits', userId)
    const userCreditsDoc = await getDoc(userCreditsRef)

    if (!userCreditsDoc.exists()) {
      // New user — create default credits document (matches Pixogen behavior)
      const defaultCredits = {
        coins: 100,
        subscriptionCredits: 100,
        purchasedCredits: 0,
        lastUpdated: new Date(),
        signupCreditsReceived: true,
        transactions: [{
          amount: 100,
          date: new Date(),
          description: 'One-time Signup Credits',
          subscriptionDetails: {
            credits: 100,
            interval: 'one-time',
            planType: 'basic(free)',
            priceId: '',
            subscriptionId: '',
          },
          type: 'signup',
        }],
      }
      await setDoc(userCreditsRef, defaultCredits)
      return 100
    }

    const data = userCreditsDoc.data()
    const subscriptionCredits = typeof data.subscriptionCredits === 'number' ? data.subscriptionCredits : 0
    const purchasedCredits = typeof data.purchasedCredits === 'number' ? data.purchasedCredits : 0
    return subscriptionCredits + purchasedCredits
  } catch (error) {
    console.error('Error getting user credits:', error)
    return 0
  }
}

// Update user credits using Pixogen-compatible atomic transaction
export async function updateUserCredits(
  userId: string,
  amount: number,
  type: 'purchase' | 'usage' | 'subscription' = 'usage',
  description: string = 'FootwearApp save',
): Promise<boolean> {
  const userCreditsRef = doc(db, 'userCredits', userId)

  try {
    await runTransaction(db, async (transaction) => {
      const userCreditsDoc = await transaction.get(userCreditsRef)
      const currentData = userCreditsDoc.exists()
        ? userCreditsDoc.data()
        : { subscriptionCredits: 0, purchasedCredits: 0, transactions: [], lastUpdated: new Date() }

      let newSubscriptionCredits = typeof currentData.subscriptionCredits === 'number'
        ? currentData.subscriptionCredits : 0
      let newPurchasedCredits = typeof currentData.purchasedCredits === 'number'
        ? currentData.purchasedCredits : 0

      if (type === 'usage') {
        const deductionAmount = Math.abs(amount)
        // Deduct from subscription credits first, then purchased
        if (newSubscriptionCredits >= deductionAmount) {
          newSubscriptionCredits -= deductionAmount
        } else {
          const remaining = deductionAmount - newSubscriptionCredits
          if (newPurchasedCredits >= remaining) {
            newPurchasedCredits -= remaining
            newSubscriptionCredits = 0
          } else {
            throw new Error('Insufficient credits')
          }
        }
      }

      const creditTransaction = {
        type,
        amount: type === 'usage' ? -Math.abs(amount) : amount,
        date: new Date(),
        description,
      }

      transaction.set(userCreditsRef, {
        ...currentData,
        subscriptionCredits: newSubscriptionCredits,
        purchasedCredits: newPurchasedCredits,
        coins: newSubscriptionCredits + newPurchasedCredits,
        lastUpdated: new Date(),
        transactions: [...(currentData.transactions || []), creditTransaction],
      }, { merge: true })
    })

    return true
  } catch (error) {
    console.error('Error updating user credits:', error)
    return false
  }
}
