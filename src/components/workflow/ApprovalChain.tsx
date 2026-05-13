'use client'

import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Clock, User, ChevronLeft, ChevronRight,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import type { ApprovalRequest, ApprovalDecision } from '@/lib/workflow/types'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import { SLAIndicator } from './SLAIndicator'

const DECISION_ICONS: Record<ApprovalDecision, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  conditional: AlertTriangle,
  delegated: User,
}

const DECISION_COLORS: Record<ApprovalDecision, string> = {
  pending: 'text-warning',
  approved: 'text-success',
  rejected: 'text-destructive',
  conditional: 'text-orange-500',
  delegated: 'text-primary',
}

interface ApprovalChainProps {
  requests: ApprovalRequest[]
  currentUserId?: string
  onApprove?: (requestId: string) => void
  onReject?: (requestId: string) => void
  onDelegate?: (requestId: string) => void
  compact?: boolean
}

export function ApprovalChain({ requests, currentUserId, onApprove, onReject, onDelegate, compact = false }: ApprovalChainProps) {
  const sorted = [...requests].sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="space-y-1">
      {/* Sequential chain visualization */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {sorted.map((req, idx) => {
          const isPending = req.decision === 'pending'
          const isCurrentAssignee = req.assignedTo.some(a => a.id === currentUserId)
          return (
            <div key={req.id} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronLeft className="h-4 w-4 text-muted-foreground/50" />}
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                isPending && isCurrentAssignee ? 'border-primary bg-primary/5 text-primary font-medium' :
                isPending ? 'border-muted-foreground/30 text-muted-foreground' :
                req.decision === 'approved' ? 'border-success/30 bg-success/5 text-success' :
                req.decision === 'rejected' ? 'border-destructive/30 bg-destructive/5 text-destructive' :
                'border-muted text-muted-foreground'
              )}>
                {req.assignedTo.map(a => (
                  <span key={a.id} className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="hidden sm:inline">{a.name}</span>
                  </span>
                ))}
                {req.decision !== 'pending' && (
                  <span className={DECISION_COLORS[req.decision]}>
                    {req.decision === 'approved' ? '✓' : req.decision === 'rejected' ? '✗' : '→'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Approval cards */}
      {!compact && sorted.map(req => {
        const isCurrentAssignee = req.assignedTo.some(a => a.id === currentUserId)
        const isPending = req.decision === 'pending'
        const slaDisplay = calculateSLADisplay(req.slaMinutes, req.createdAt)

        return (
          <div
            key={req.id}
            className={cn(
              'p-3 rounded-xl border transition-all',
              isPending && isCurrentAssignee ? 'border-primary bg-primary/5 shadow-sm' :
              isPending ? 'border-muted bg-card' :
              req.decision === 'approved' ? 'border-success/20 bg-success/5' :
              req.decision === 'rejected' ? 'border-destructive/20 bg-destructive/5' :
              'border-muted bg-muted/20'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{req.title}</span>
                  <SLAIndicator sla={slaDisplay} size="sm" />
                </div>
                {req.description && (
                  <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                )}
              </div>

              {/* Decision indicator */}
              <div className={cn('flex items-center gap-1 text-sm', DECISION_COLORS[req.decision])}>
                {React.createElement(DECISION_ICONS[req.decision], { className: 'h-4 w-4' })}
                <span className="text-xs">
                  {req.decision === 'pending' ? 'بإنتظار الموافقة' :
                   req.decision === 'approved' ? 'تمت الموافقة' :
                   req.decision === 'rejected' ? 'مرفوض' :
                   req.decision === 'delegated' ? 'تم التفويض' : 'مشروط'}
                </span>
              </div>
            </div>

            {/* Assignees */}
            {isPending && (
              <div className="flex items-center gap-2 mt-2">
                {req.assignedTo.map(a => (
                  <div key={a.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            {isPending && isCurrentAssignee && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                <button
                  onClick={() => onApprove?.(req.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-success text-white rounded-lg hover:bg-success/90 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                </button>
                <button
                  onClick={() => onReject?.(req.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" /> رفض
                </button>
                <button
                  onClick={() => onDelegate?.(req.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-accent transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> تفويض
                </button>
              </div>
            )}

            {/* Comments */}
            {req.comments && (
              <p className="text-xs text-muted-foreground mt-2 italic">"{req.comments}"</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

import React from 'react'
