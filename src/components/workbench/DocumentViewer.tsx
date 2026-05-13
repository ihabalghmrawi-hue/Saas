'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText, Download, Printer, ZoomIn, ZoomOut,
  RotateCw, Search, Share2, Trash2, X,
  ChevronLeft, ChevronRight, Maximize2,
  FileImage, File, FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DocumentAttachment } from '@/lib/workbench/types'

export interface DocumentViewerProps {
  document: DocumentAttachment
  onClose?: () => void
  onDownload?: () => void
  onPrint?: () => void
  fullScreen?: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string) {
  switch (type) {
    case 'pdf': return FileText
    case 'image': return FileImage
    case 'docx': return FileText
    case 'xlsx': return FileSpreadsheet
    default: return File
  }
}

function getFileColor(type: string): string {
  switch (type) {
    case 'pdf': return 'text-red-500 bg-red-50 border-red-200'
    case 'image': return 'text-blue-500 bg-blue-50 border-blue-200'
    case 'docx': return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'xlsx': return 'text-green-600 bg-green-50 border-green-200'
    default: return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}

export function DocumentViewer({
  document,
  onClose,
  onDownload,
  onPrint,
  fullScreen: initialFullScreen = false,
  className,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [fullScreen, setFullScreen] = useState(initialFullScreen)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = document.type === 'pdf' ? Math.max(1, Math.floor(document.size / 50000) + 1) : 1

  const FileIcon = getFileIcon(document.type)
  const fileColors = getFileColor(document.type)
  const uploadedDate = new Date(document.uploadedAt).toLocaleDateString('ar-SA')

  return (
    <div className={cn('flex flex-col h-full bg-background', fullScreen && 'fixed inset-0 z-50', className)} dir="rtl">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn('p-1.5 rounded-lg', fileColors)}>
            <FileIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium">{document.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {formatFileSize(document.size)} - {document.type.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(zoom + 25, 300))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(zoom - 25, 25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrint}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullScreen(!fullScreen)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-auto p-6 flex items-start justify-center bg-muted/10"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
      >
        <div className={cn('w-full max-w-3xl rounded-xl border shadow-sm p-8 bg-white', fileColors)}>
          <div className="flex items-center gap-4 mb-6 pb-4 border-b">
            <div className={cn('p-3 rounded-xl', fileColors)}>
              <FileIcon className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{document.name}</h2>
              <p className="text-sm text-muted-foreground">
                {document.type.toUpperCase()} - {formatFileSize(document.size)}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">اسم الملف</span>
                <p className="font-medium">{document.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">نوع الملف</span>
                <p className="font-medium">{document.type.toUpperCase()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">الحجم</span>
                <p className="font-medium">{formatFileSize(document.size)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">تاريخ الرفع</span>
                <p className="font-medium">{uploadedDate}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">تم الرفع بواسطة</span>
                <p className="font-medium">{document.uploadedBy}</p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-muted-foreground text-xs mb-2">معاينة المستند</p>
              <div className="rounded-lg border-2 border-dashed p-8 bg-muted/20 text-center">
                {document.type === 'image' ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileImage className="h-16 w-16 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">معاينة الصورة غير متوفرة</p>
                  </div>
                ) : document.type === 'pdf' ? (
                  <div className="space-y-4">
                    <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto" />
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4 mx-auto" />
                      <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                      <div className="h-3 bg-muted rounded w-5/6 mx-auto" />
                      <div className="h-3 bg-muted rounded w-2/3 mx-auto" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      الصفحة {currentPage} من {totalPages}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <File className="h-16 w-16 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">معاينة غير متوفرة لهذا النوع من الملفات</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 border-t bg-muted/30 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            صفحة {currentPage} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
