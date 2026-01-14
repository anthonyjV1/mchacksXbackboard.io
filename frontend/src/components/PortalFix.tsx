"use client"

import { useEffect } from "react"

/**
 * Fixes fractional pixel positioning in Next.js portal elements
 * This ensures all portal elements have rounded pixel values to prevent subpixel rendering issues
 */
export function PortalFix() {
  useEffect(() => {
    const roundPixelValue = (value: string | null): string | null => {
      if (!value) return value
      const match = value.match(/^([+-]?\d*\.?\d+)px$/)
      if (match) {
        const num = parseFloat(match[1])
        return `${Math.round(num)}px`
      }
      return value
    }

    const roundElementStyles = (element: HTMLElement) => {
      // Read the style attribute directly to ensure we catch all values
      const styleAttr = element.getAttribute('style')
      if (!styleAttr) return

      // Parse and round all positioning properties
      const properties = ['top', 'left', 'right', 'bottom']
      let updated = false
      let newStyle = styleAttr

      properties.forEach((prop) => {
        // Match the property in the style string (e.g., "top: 7113.55px;")
        const regex = new RegExp(`(${prop}\\s*:\\s*)([+-]?\\d*\\.?\\d+)px`, 'gi')
        newStyle = newStyle.replace(regex, (match, prefix, value) => {
          const num = parseFloat(value)
          if (!isNaN(num) && num % 1 !== 0) {
            // Only update if it's a fractional value
            updated = true
            return `${prefix}${Math.round(num)}px`
          }
          return match
        })
      })

      // Only update if we made changes
      if (updated) {
        element.setAttribute('style', newStyle)
      }
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const target = mutation.target as HTMLElement
          if (target.tagName === "NEXTJS-PORTAL" || target.hasAttribute("data-cursor-element-id")) {
            roundElementStyles(target)
          }
        }
        // Also check for newly added portal elements
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement
              if (element.tagName === "NEXTJS-PORTAL" || element.hasAttribute("data-cursor-element-id")) {
                roundElementStyles(element)
                // Also observe the new element
                observer.observe(element, {
                  attributes: true,
                  attributeFilter: ["style"],
                })
              }
            }
          })
        }
      })
    })

    // Observe the document body for portal elements
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    })

    // Round existing portal elements
    const existingPortals = document.querySelectorAll<HTMLElement>("nextjs-portal, [data-cursor-element-id]")
    existingPortals.forEach((portal) => {
      roundElementStyles(portal)
      observer.observe(portal, {
        attributes: true,
        attributeFilter: ["style"],
      })
    })

    // Also check on scroll/resize events for any missed portals (debounced to avoid performance issues)
    let timeoutId: NodeJS.Timeout | null = null
    let rafId: number | null = null
    
    const checkPortals = () => {
      const portals = document.querySelectorAll<HTMLElement>("nextjs-portal, [data-cursor-element-id]")
      portals.forEach((portal) => {
        roundElementStyles(portal)
      })
    }
    
    const scheduleCheck = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        timeoutId = setTimeout(checkPortals, 50)
      })
    }
    
    // Check on scroll/resize events
    window.addEventListener('scroll', scheduleCheck, { passive: true })
    window.addEventListener('resize', scheduleCheck, { passive: true })

    return () => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', scheduleCheck)
      window.removeEventListener('resize', scheduleCheck)
    }
  }, [])

  return null
}

