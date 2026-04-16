'use client'
import { useEffect, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useLLMStore } from '@/store/useLLMStore'
import { cn } from '@/lib/utils'
import type { LLMConfigSummary } from '@/types/llm'

function SortableItem({ item, onDelete }: { item: LLMConfigSummary; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-shadow',
        isDragging && 'shadow-xl z-50 border-primary/50',
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{item.label}</span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted rounded px-1">
            {item.modelId}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{item.platformId}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className={cn('h-2 w-2 rounded-full', item.enabled ? 'bg-green-400' : 'bg-red-400')} />
        <button
          onClick={() => onDelete(item.id)}
          className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function PriorityQueue() {
  const { queue, setQueue } = useLLMStore()
  const [items, setItems] = useState<LLMConfigSummary[]>([])

  useEffect(() => { setItems(queue) }, [queue])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      priority: idx + 1,
    }))
    setItems(reordered)
    setQueue(reordered)

    await fetch('/api/llm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered.map((i) => ({ id: i.id, priority: i.priority }))),
    })
  }

  async function deleteItem(id: string) {
    await fetch(`/api/llm/${id}`, { method: 'DELETE' })
    const updated = items.filter((i) => i.id !== id).map((item, idx) => ({ ...item, priority: idx + 1 }))
    setItems(updated)
    setQueue(updated)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No LLMs configured. Add platforms in the wizard.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Drag to reorder. OpenLina tries from top to bottom on failover.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{idx + 1}</span>
                <div className="flex-1">
                  <SortableItem item={item} onDelete={deleteItem} />
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
