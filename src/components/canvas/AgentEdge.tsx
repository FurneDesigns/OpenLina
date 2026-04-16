'use client'
import { getBezierPath, EdgeProps, EdgeLabelRenderer } from 'reactflow'

export function AgentEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return (
    <>
      <path
        id={id}
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeOpacity={0.7}
        strokeDasharray="6"
        style={{ animation: 'dash 0.8s linear infinite' }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground pointer-events-none"
          >
            {data.label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
