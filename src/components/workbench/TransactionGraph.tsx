'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  GitBranch, ArrowLeft, ArrowRight, Plus, Minus,
  ZoomIn, ZoomOut, Maximize2, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GraphNode {
  id: string
  label: string
  balance: number
  type: string
  x: number
  y: number
}

interface GraphEdge {
  from: string
  to: string
  amount: number
  label: string
}

export interface TransactionGraphProps {
  entries: any[]
  centerEntityId?: string
  className?: string
}

function getNodeColor(type: string): string {
  switch (type) {
    case 'asset': return 'border-blue-400 bg-blue-50 text-blue-700'
    case 'liability': return 'border-red-400 bg-red-50 text-red-700'
    case 'equity': return 'border-purple-400 bg-purple-50 text-purple-700'
    case 'revenue': return 'border-green-400 bg-green-50 text-green-700'
    case 'expense': return 'border-orange-400 bg-orange-50 text-orange-700'
    default: return 'border-gray-400 bg-gray-50 text-gray-700'
  }
}

function formatBalance(n: number): string {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TransactionGraph({ entries, centerEntityId, className }: TransactionGraphProps) {
  const [zoom, setZoom] = useState(1)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [expandedEdges, setExpandedEdges] = useState<any[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>()
    const edgeList: GraphEdge[] = []

    if (!entries || entries.length === 0) return { nodes: [], edges: [] }

    const accountSet = new Set<string>()
    entries.forEach((entry: any) => {
      const fromId = entry.accountId || entry.from
      const toId = entry.to || entry.accountId
      if (fromId) accountSet.add(fromId)
      if (toId) accountSet.add(toId)
    })

    let idx = 0
    const cols = 4
    accountSet.forEach((id) => {
      const row = Math.floor(idx / cols)
      const col = idx % cols
      const entry = entries.find((e: any) => e.accountId === id || e.id === id)
      nodeMap.set(id, {
        id,
        label: entry?.accountName || id,
        balance: entry?.amount || 0,
        type: entry?.type || 'asset',
        x: 180 + col * 220,
        y: 80 + row * 160,
      })
      idx++
    })

    entries.forEach((entry: any) => {
      if (entry.accountId && entry.relatedAccountId) {
        edgeList.push({
          from: entry.accountId,
          to: entry.relatedAccountId,
          amount: entry.amount || 0,
          label: entry.description || '',
        })
      }
    })

    return { nodes: Array.from(nodeMap.values()), edges: edgeList }
  }, [entries])

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
    if (!expandedNodes.has(nodeId)) {
      const relatedEdges = edges.filter((e) => e.from === nodeId || e.to === nodeId).slice(0, 3)
      setExpandedEdges(relatedEdges)
    } else {
      setExpandedEdges([])
    }
  }

  const centerOnEntity = (nodeId?: string) => {
    if (!nodeId) return
    setSelectedNode(nodeId)
  }

  useEffect(() => {
    if (centerEntityId) {
      centerOnEntity(centerEntityId)
    }
  }, [centerEntityId])

  if (!entries || entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-muted-foreground', className)}>
        <div className="text-center">
          <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-40" />
          <p className="text-sm">لا توجد معاملات لعرضها في الرسم البياني</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)} dir="rtl">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center ltr" dir="ltr">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(1)}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto h-[500px] border rounded-xl bg-muted/20 relative"
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }}
          width={nodes.length > 0 ? Math.max(800, Math.ceil(nodes.length / 4) * 800) : 800}
          height={nodes.length > 0 ? Math.max(500, Math.ceil(nodes.length / 4) * 200 + 200) : 500}
        >
          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from)
            const toNode = nodes.find((n) => n.id === edge.to)
            if (!fromNode || !toNode) return null
            const isSelected = selectedNode === edge.from || selectedNode === edge.to
            return (
              <g key={`edge-${i}`}>
                <defs>
                  <marker
                    id={`arrowhead-${i}`}
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill={isSelected ? '#2563eb' : '#94a3b8'} />
                  </marker>
                </defs>
                <line
                  x1={fromNode.x + 60}
                  y1={fromNode.y + 25}
                  x2={toNode.x}
                  y2={toNode.y + 25}
                  stroke={isSelected ? '#2563eb' : '#94a3b8'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  markerEnd={`url(#arrowhead-${i})`}
                />
                <text
                  x={(fromNode.x + toNode.x) / 2 + 30}
                  y={(fromNode.y + toNode.y) / 2 - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="11"
                  opacity="0.6"
                  direction="rtl"
                >
                  {formatBalance(edge.amount)} ريال
                </text>
              </g>
            )
          })}
        </svg>

        <div
          className="relative"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }}
        >
          {nodes.map((node) => {
            const isSelected = selectedNode === node.id
            const isExpanded = expandedNodes.has(node.id)
            return (
              <div key={node.id} style={{ position: 'absolute', right: node.x, top: node.y }}>
                <button
                  type="button"
                  onClick={() => centerOnEntity(node.id)}
                  className={cn(
                    'rounded-xl border-2 px-4 py-3 min-w-[160px] text-right cursor-pointer transition-all',
                    'hover:shadow-md',
                    getNodeColor(node.type),
                    isSelected && 'ring-2 ring-primary ring-offset-2 scale-105',
                  )}
                >
                  <div className="text-xs font-medium mb-1 truncate">{node.label}</div>
                  <div className="text-sm font-bold">{formatBalance(node.balance)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => toggleExpand(node.id)}
                  className={cn(
                    'absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center',
                    'border bg-background shadow-sm hover:bg-accent transition-colors text-xs',
                  )}
                >
                  {isExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </button>

                {isSelected && (
                  <div className="absolute z-20 top-full mt-2 right-0 w-64 rounded-xl border bg-popover p-3 shadow-lg text-right">
                    <p className="text-xs font-semibold mb-2">{node.label}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>النوع</span>
                        <span>{node.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>الرصيد</span>
                        <span className="font-medium text-foreground">{formatBalance(node.balance)} ريال</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المعاملات</span>
                        <span>{edges.filter((e) => e.from === node.id || e.to === node.id).length}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1">
                        <Target className="h-3 w-3" />
                        عرض التفاصيل
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
