"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

/**
 * A small "Upload" button that posts a chosen image file to /api/upload and
 * calls `onUploaded(url)` with the returned path.
 *
 * Pass `resize={300}` to automatically resize the image to 300×300 square
 * (cover-cropped, JPEG q85) — ideal for player avatars / headshots where you
 * don't need the full-resolution original.
 */
export function UploadButton({
  onUploaded,
  label = "Upload",
  resize,
  className,
}: {
  onUploaded: (url: string) => void
  label?: string
  resize?: number
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const endpoint = resize ? `/api/upload?resize=${resize}` : "/api/upload"
      const res = await fetch(endpoint, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || "Upload failed")
        return
      }
      onUploaded(data.url)
      toast.success("Photo uploaded")
    } catch (e) {
      toast.error("Upload failed", { description: String(e) })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
          if (fileRef.current) fileRef.current.value = ""
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
    </>
  )
}
