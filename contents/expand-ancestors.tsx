import type {
  PlasmoCSConfig,
  PlasmoCSUIProps,
  PlasmoGetInlineAnchorList
} from "plasmo"
import React from "react"

export const config: PlasmoCSConfig = {
  matches: ["https://www.familysearch.org/*/tree/pedigree/*"],
  run_at: "document_idle"
}

const candidateSelector = ["div[is-couple][slot]"].join(",")

export const getInlineAnchorList: PlasmoGetInlineAnchorList = () => {
  // Mount before each person-like container
  const nodeList = document.querySelectorAll(candidateSelector)
  return Array.from(nodeList).map((element) => ({
    element,
    insertPosition: "afterbegin"
  }))
}

const ExpandAncestorsInline = ({ anchor }: PlasmoCSUIProps) => {
  const hostElement = anchor?.element as HTMLElement | undefined

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0
      }}>
      <button
        type="button"
        style={{
          fontSize: 12,
          lineHeight: 1,
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "linear-gradient(#fff,#f6f6f6)",
          color: "#222",
          cursor: "pointer",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05)"
        }}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()

          if (hostElement) {
            const prevOutline = hostElement.style.outline
            hostElement.style.outline = "2px solid #3b82f6"
            setTimeout(() => {
              hostElement.style.outline = prevOutline
            }, 500)

            const expandAncestorsBtn = hostElement.querySelector(
              'button[aria-label^="Expand Ancestors"]'
            ) as HTMLButtonElement | null
            expandAncestorsBtn?.click()
          } else {
            console.log("Host element not found for this button")
          }
        }}>
        Expand All
      </button>
    </div>
  )
}

export default ExpandAncestorsInline
