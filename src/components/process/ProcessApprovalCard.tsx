'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, User, AlertTriangle } from 'lucide-react'
import type { ProcessApproval } from '@/lib/process/types'

interface ProcessApprovalCardProps {
  approval: ProcessApproval
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

const DECISION_STYLES = {
  pending: { label: 'بإنتظار الموافقة', className: 'bg-warning/10 text-warning border-warning/20' },
  approved: { label: 'تمت الموافقة', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'مرفوض', className: 'bg-destructive/10 text-destructive border-destructive/20' },
}

export function ProcessApprovalCard({ approval, onApprove, onReject }: ProcessApprovalCardProps) {
  const decision = DECISION_STYLES[approval.decision]
  const isPending = approval.decision === 'pending'

  return (
    <div className={cn('rounded-lg border p-4', decision.className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">{approval.title}</h4>
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full font-medium',
          decision.className,
        )}>
          {decision.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3" />
          <span>من: {approval.requestedBy.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3" />
          <span>إلى: {approval.assignedTo.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>{new Date(approval.createdAt).toLocaleString('ar-SA')}</span>
        </div>
        {approval.respondedAt && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>{new Date(approval.respondedAt).toLocaleString('ar-SA')}</span>
          </div>
        )}
      </div>

      {approval.comments && (
        <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 mb-3">
          {approval.comments}
        </p>
      )}

      {isPending && (onApprove || onReject) && (
        <div className="flex gap-2 pt-2 border-t border-inherit">
          {onApprove && (
            <button
              onClick={() => onApprove(approval.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-success-foreground hover:bg-success/90 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              موافقة
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(approval.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              رفض
            </button>
          )}
        </div>
      )}
    </div>
  )
}
