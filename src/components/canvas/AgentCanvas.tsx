'use client'
import { useCallback, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  addEdge, useNodesState, useEdgesState, ReactFlowProvider,
  type Connection, type Node, type Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAgentStore } from '@/store/useAgentStore'
import { useAgentSync } from '@/hooks/useAgentMessages'
import { useSocket } from '@/hooks/useSocket'
import { AgentNode } from './AgentNode'
import { AgentEdge as AgentEdgeComponent } from './AgentEdge'
import { AgentToolbar } from './AgentToolbar'
import { AgentSidebar } from './AgentSidebar'
import { MessageFeed } from './MessageFeed'
import type { Agent, AgentEdge as AgentEdgeType } from '@/types/agent'
import { v4 as uuid } from 'uuid'

const nodeTypes = { agentNode: AgentNode }
const edgeTypes = { agentEdge: AgentEdgeComponent }

function Canvas() {
  useAgentSync()
  const socket = useSocket('agents')
  const { agents, edges: storeEdges, addEdge: storeAddEdge } = useAgentStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<Agent>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Sync store → React Flow nodes
  useEffect(() => {
    setNodes(
      agents.map((a) => ({
        id: a.id,
        type: 'agentNode',
        position: { x: a.canvasX, y: a.canvasY },
        data: a,
      })),
    )
  }, [agents, setNodes])

  // Sync store → React Flow edges
  useEffect(() => {
    setEdges(
      storeEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: 'agentEdge',
        animated: true,
        data: { label: e.label },
      })),
    )
  }, [storeEdges, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: uuid(),
        source: connection.source!,
        target: connection.target!,
        type: 'agentEdge',
        animated: true,
      }
      setEdges((eds) => addEdge(newEdge, eds))
      const agentEdge: AgentEdgeType = {
        id: newEdge.id,
        sourceId: connection.source!,
        targetId: connection.target!,
        edgeType: 'default',
        createdAt: new Date().toISOString(),
      }
      storeAddEdge(agentEdge)
      // Persist the new edge immediately
      socket.emit('canvas:update', { agents: [], edges: [agentEdge] })
    },
    [setEdges, storeAddEdge, socket],
  )

  // Persist canvas layout on node drag stop — send only the moved node
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only update the dragged node's position to avoid sending stale positions for others
      socket.emit('canvas:update', {
        agents: [{ id: node.id, canvasX: node.position.x, canvasY: node.position.y }],
        edges: storeEdges,
      })
    },
    [storeEdges, socket],
  )

  return (
    <div className="relative flex h-full">
      {/* Main canvas */}
      <div className="flex-1 relative">
        <AgentToolbar />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff08" />
          <Controls className="!bottom-4 !left-4" />
          <MiniMap
            className="!bottom-4 !right-4"
            nodeColor={(n) => (n.data as Agent).color ?? '#6366f1'}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
        <AgentSidebar />
      </div>

      {/* Message feed panel */}
      <div className="w-72 border-l border-border bg-card flex flex-col">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Message Feed
          </p>
        </div>
        <MessageFeed />
      </div>
    </div>
  )
}

export function AgentCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
