"use client"

import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useSidebarBlocks } from "@/lib/use-data"
import { SidebarWidget } from "@/components/site/inner-layout"
import { Camera } from "lucide-react"
import type { SidebarBlock } from "@/lib/types"

/**
 * Renders the admin-managed custom sidebar blocks for a given page type.
 * A block shows when its placement is "all" or includes the page type.
 * Rendered at the bottom of the inner-page sidebar, after the auto widgets.
 */
export function CustomSidebarBlocks({ placement }: { placement: string }) {
  const { data } = useSidebarBlocks(placement)
  if (!data || data.length === 0) return null
  return (
    <>
      {data.map((b) => (
        <BlockCard key={b.id} block={b} />
      ))}
    </>
  )
}

function BlockCard({ block }: { block: SidebarBlock }) {
  return (
    <SidebarWidget title={block.title}>
      <div className="prose-sidebar text-sm text-foreground/90">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-red-600 underline underline-offset-2 hover:text-red-700"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
            img: ({ src, alt }) => {
              const caption = alt && alt.trim() ? alt : ""
              return (
                <figure className="mb-2">
                  <img
                    src={typeof src === "string" ? src : undefined}
                    alt={caption}
                    className="block w-full rounded-md"
                  />
                  {caption ? (
                    <figcaption className="mt-0.5 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground">
                      <Camera className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
                      <span>{caption}</span>
                    </figcaption>
                  ) : null}
                </figure>
              )
            },
          }}
        >
          {block.content}
        </ReactMarkdown>
      </div>
    </SidebarWidget>
  )
}
