import { useEffect, useState, useMemo, type JSX } from 'react'
import { Vector3, BufferGeometry, Line as ThreeLine, LineBasicMaterial } from 'three'
import type { FFD } from '@/utils/FFD'

interface ControlGridProps {
  ffdBox: FFD
}

export default function ControlGrid({ ffdBox }: ControlGridProps) {
  const [points, setPoints] = useState<Vector3[][][]>([])

  useEffect(() => {
    if (ffdBox) {
      setPoints(ffdBox.getControlPoints())
      const unsubscribe = ffdBox.subscribe(() => {
        setPoints(ffdBox.getControlPoints())
      })
      return unsubscribe
    }
  }, [ffdBox])

  const lines = useMemo(() => {
    const lineElements: JSX.Element[] = []

    points.forEach((plane, i) => {
      plane.forEach((row, j) => {
        row.forEach((point, k) => {
          if (k < row.length - 1) {
            const geometry = new BufferGeometry().setFromPoints([point, row[k + 1]])
            const material = new LineBasicMaterial({ color: 'gray', transparent: true, opacity: 0.4 })
            lineElements.push(
              <primitive key={`x-${i}-${j}-${k}`} object={new ThreeLine(geometry, material)} />,
            )
          }
          if (j < plane.length - 1) {
            const geometry = new BufferGeometry().setFromPoints([point, plane[j + 1][k]])
            const material = new LineBasicMaterial({ color: 'gray', transparent: true, opacity: 0.4 })
            lineElements.push(
              <primitive key={`y-${i}-${j}-${k}`} object={new ThreeLine(geometry, material)} />,
            )
          }
          if (i < points.length - 1) {
            const geometry = new BufferGeometry().setFromPoints([point, points[i + 1][j][k]])
            const material = new LineBasicMaterial({ color: 'gray', transparent: true, opacity: 0.4 })
            lineElements.push(
              <primitive key={`z-${i}-${j}-${k}`} object={new ThreeLine(geometry, material)} />,
            )
          }
        })
      })
    })

    return lineElements
  }, [points])

  useEffect(() => {
    return () => {
      lines.forEach((line) => {
        const primitive = line.props.object
        if (primitive) {
          primitive.geometry.dispose()
          primitive.material.dispose()
        }
      })
    }
  }, [lines])

  return <>{lines}</>
}
