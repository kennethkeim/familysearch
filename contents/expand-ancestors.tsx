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

enum Attr {
  CoupleID = "data-testid"
}

enum Selector {
  /** Container div for a couple */
  Couple = 'div[is-couple][data-testid^="couple-"]',
  /** Container div for a person */
  Person = "div[is-couple][slot]",
  /** Button to expand ancestors. Will NOT be present if already expanded. */
  ExpandUp = 'button[aria-label^="Expand Ancestors"]'
}

type GlobalState = {
  active: boolean
  newCouples: Set<string>
  observer?: MutationObserver
  stopOverlay?: HTMLDivElement
  stack: string[]
  queuedIds: Set<string>
  intervalId?: number
}

function getGlobal(): GlobalState {
  const w = window as unknown as { __fstools?: GlobalState }
  if (!w.__fstools) {
    w.__fstools = {
      active: false,
      newCouples: new Set<string>(),
      observer: undefined,
      stopOverlay: undefined,
      stack: [],
      queuedIds: new Set<string>(),
      intervalId: undefined
    }
  }
  return w.__fstools
}

// Note: extended below with queue-related fields

function getAllCoupleIds(): Set<string> {
  const set = new Set<string>()
  document.querySelectorAll(Selector.Couple).forEach((el) => {
    const id = (el as HTMLElement)?.getAttribute(Attr.CoupleID) || ""
    if (id) set.add(id)
  })
  return set
}

function diffNewCouples(before: Set<string>, after: Set<string>): string[] {
  const newlyAdded: string[] = []
  after.forEach((id) => {
    if (!before.has(id)) newlyAdded.push(id)
  })
  return newlyAdded
}

function rememberNewCouples(ids: string[]) {
  const w = window as unknown as { fstoolsNewCouples?: Set<string> }
  if (!w.fstoolsNewCouples) w.fstoolsNewCouples = new Set<string>()
  ids.forEach((id) => w.fstoolsNewCouples!.add(id))
}

function ensureStopOverlay() {
  const g = getGlobal()
  if (g.stopOverlay) return
  const container = document.createElement("div")
  container.style.position = "fixed"
  container.style.left = "50%"
  container.style.bottom = "16px"
  container.style.transform = "translateX(-50%)"
  container.style.zIndex = "2147483647"
  container.style.pointerEvents = "none"

  const btn = document.createElement("button")
  btn.textContent = "Stop Auto-Expand"
  btn.style.pointerEvents = "auto"
  btn.style.fontSize = "14px"
  btn.style.padding = "8px 12px"
  btn.style.borderRadius = "8px"
  btn.style.border = "1px solid rgba(0,0,0,0.2)"
  btn.style.background = "#fee2e2"
  btn.style.color = "#991b1b"
  btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)"
  btn.onclick = () => stopAutoExpand()

  container.appendChild(btn)
  document.body.appendChild(container)
  g.stopOverlay = container
}

function removeStopOverlay() {
  const g = getGlobal()
  if (g.stopOverlay?.parentElement) {
    g.stopOverlay.parentElement.removeChild(g.stopOverlay)
  }
  g.stopOverlay = undefined
}

function clickExpandUp(coupleEl: Element, slot: 1 | 2) {
  const g = getGlobal()
  if (!g.active) return

  // Get the right person within this couple container using slot attr
  const slotElement = coupleEl.querySelector(`[slot="${slot}"]`)
  if (!slotElement) return

  // Get person's expand up button (will not be present if already expanded)
  const expandBtn = slotElement.querySelector(
    Selector.ExpandUp
  ) as HTMLButtonElement | null

  // Click expand up
  if (expandBtn) {
    console.log(
      `Expanding slot "${slot}" for ${coupleEl.getAttribute(Attr.CoupleID)}`
    )
    expandBtn.click()
  }
}

function enqueueCoupleId(id: string) {
  const g = getGlobal()
  if (!id || g.queuedIds.has(id)) return
  g.stack.push(id)
  g.queuedIds.add(id)
}

function enqueueCoupleElement(el: Element) {
  const id = (el as HTMLElement)?.getAttribute(Attr.CoupleID) || null
  if (id) enqueueCoupleId(id)
}

function processQueueTick() {
  const g = getGlobal()
  if (!g.active) return
  const id = g.stack.pop()
  if (!id) return
  g.queuedIds.delete(id)
  const el = document.querySelector(`[${Attr.CoupleID}="${id}"]`)
  if (el) clickExpandUp(el, 1)
}

function initMutationObserver() {
  const g = getGlobal()
  if (g.observer) return

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          if (node.matches?.(Selector.Couple)) {
            enqueueCoupleElement(node)
          }
          node
            .querySelectorAll?.(Selector.Couple)
            .forEach((el) => enqueueCoupleElement(el))
        })
      }
    }
  })

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  })
  g.observer = observer
}

function startAutoExpand() {
  const g = getGlobal()
  if (g.active) return
  g.active = true
  ensureStopOverlay()
  initMutationObserver()
  if (!g.intervalId) {
    g.intervalId = window.setInterval(processQueueTick, 100)
  }
}

function stopAutoExpand() {
  const g = getGlobal()
  g.active = false
  removeStopOverlay()
  if (g.intervalId) {
    clearInterval(g.intervalId)
    g.intervalId = undefined
  }
}

export const getInlineAnchorList: PlasmoGetInlineAnchorList = () => {
  // Mount before each person-like container
  const nodeList = document.querySelectorAll(Selector.Person)
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

          const g = getGlobal()
          if (g.active) {
            // Ignore individual expand when auto-expand is active
            return
          }

          if (hostElement) {
            const prevOutline = hostElement.style.outline
            hostElement.style.outline = "2px solid #3b82f6"
            setTimeout(() => {
              hostElement.style.outline = prevOutline
            }, 500)

            const expandUpBtn = hostElement.querySelector(
              Selector.ExpandUp
            ) as HTMLButtonElement | null
            expandUpBtn?.click()

            startAutoExpand()
          } else {
            console.log("Host element not found for this button")
          }
        }}>
        Expand All
      </button>
    </div>
  )
}

// Initialize observer on page load (it will only act when active)
try {
  initMutationObserver()
} catch {}

export default ExpandAncestorsInline
