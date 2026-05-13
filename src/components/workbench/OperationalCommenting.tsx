'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  MessageSquare, Send, Paperclip, CheckCircle2,
  X, MoreHorizontal, User, Clock, Pin, PinOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { OperationalComment, DocumentAttachment } from '@/lib/workbench/types'

export interface OperationalCommentingProps {
  comments: OperationalComment[]
  onAddComment?: (text: string) => void
  onResolve?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days < 30) return `منذ ${days} يوم`
  return `منذ ${Math.floor(days / 30)} شهر`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OperationalCommenting({
  comments: externalComments,
  onAddComment,
  onResolve,
  onDelete,
  className,
}: OperationalCommentingProps) {
  const [newComment, setNewComment] = useState('')
  const [localComments, setLocalComments] = useState<OperationalComment[] | null>(null)

  const comments = localComments ?? externalComments

  const handleSend = () => {
    const text = newComment.trim()
    if (!text) return
    if (onAddComment) {
      onAddComment(text)
    } else {
      const newEntry: OperationalComment = {
        id: `temp-${Date.now()}`,
        text,
        author: 'أحمد محمد',
        timestamp: Date.now(),
        resolved: false,
      }
      setLocalComments([newEntry, ...(localComments ?? externalComments)])
    }
    setNewComment('')
  }

  const handleResolve = (id: string) => {
    if (onResolve) {
      onResolve(id)
    } else {
      setLocalComments((prev) =>
        (prev ?? externalComments).map((c) =>
          c.id === id ? { ...c, resolved: !c.resolved } : c,
        ),
      )
    }
  }

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id)
    } else {
      setLocalComments((prev) =>
        (prev ?? externalComments).filter((c) => c.id !== id),
      )
    }
  }

  const sortedComments = [...comments].sort((a, b) => b.timestamp - a.timestamp)
  const unresolvedCount = comments.filter((c) => !c.resolved).length

  return (
    <div className={cn('flex flex-col h-full bg-background', className)} dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">التعليقات</span>
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        </div>
        {unresolvedCount > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            {unresolvedCount} غير محلول
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد تعليقات بعد، كن أول من يعلق</p>
          </div>
        ) : (
          sortedComments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                'group relative rounded-lg border p-3 transition-colors',
                comment.resolved ? 'bg-muted/30 border-muted' : 'bg-card',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  comment.resolved ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                )}>
                  {comment.author[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'text-sm font-medium',
                      comment.resolved && 'text-muted-foreground line-through',
                    )}>
                      {comment.author}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(comment.timestamp)}
                    </span>
                    {comment.resolved && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        محلول
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm leading-relaxed',
                    comment.resolved && 'text-muted-foreground',
                  )}>
                    {comment.text}
                  </p>

                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {comment.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs cursor-pointer hover:bg-accent transition-colors">
                          <Paperclip className="h-3 w-3" />
                          <span>{att.name}</span>
                          <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleResolve(comment.id)}
                    title={comment.resolved ? 'إعادة فتح' : 'تحديد كمحلول'}
                  >
                    <CheckCircle2 className={cn('h-3.5 w-3.5', comment.resolved ? 'text-green-600' : 'text-muted-foreground')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(comment.id)}
                    title="حذف"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="أكتب تعليقاً..."
              rows={2}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" disabled title="إرفاق ملف">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9"
              disabled={!newComment.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
          >
            @ذكر
          </button>
        </div>
      </div>
    </div>
  )
}
