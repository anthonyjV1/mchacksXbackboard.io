"use client"

import { useState, useEffect } from "react"

export function FloatingBlocks() {
  // Only render after hydration to avoid mismatch between server and client
  const [isMounted, setIsMounted] = useState(false)
  const [blocks, setBlocks] = useState<Array<{
    id: number
    x: number
    y: number
    size: number
    color: string
    rotation: number
    delay: number
  }>>([])
  const [splashes, setSplashes] = useState<Array<{
    id: number
    x: number
    y: number
    size: number
    color: string
    delay: number
  }>>([])

  useEffect(() => {
    setIsMounted(true)
    
    // Generate random values only on client side
    const colors = [
      { main: '#FF6B35', glow: 'rgba(255, 107, 53, 0.3)' },
      { main: '#4ECDC4', glow: 'rgba(78, 205, 196, 0.3)' },
      { main: '#FFE66D', glow: 'rgba(255, 230, 109, 0.3)' },
      { main: '#C44569', glow: 'rgba(196, 69, 105, 0.3)' },
      { main: '#6C5CE7', glow: 'rgba(108, 92, 231, 0.3)' },
    ]

    const generatedBlocks = Array.from({ length: 8 }, (_, i) => {
      const colorPair = colors[i % colors.length]
      return {
        id: i,
        x: -5 + Math.random() * 105,
        y: -5 + (i * 12),
        size: 40 + Math.random() * 60,
        color: colorPair.main,
        rotation: Math.random() * 360,
        delay: i * 0.4,
      }
    })

    const generatedSplashes = Array.from({ length: 4 }, (_, i) => {
      const colorPair = colors[i % colors.length]
      return {
        id: i,
        x: (i % 2) * 70 + 10,
        y: Math.floor(i / 2) * 50 + 15,
        size: 350 + Math.random() * 200,
        color: colorPair.glow,
        delay: i * 1.5,
      }
    })

    setBlocks(generatedBlocks)
    setSplashes(generatedSplashes)
  }, [])

  // Don't render anything on server or before hydration to avoid mismatch
  if (!isMounted) {
    return null
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-60">
        {splashes.map((splash) => (
          <div
            key={`splash-${splash.id}`}
            className="absolute rounded-full blur-3xl animate-pulse-slow"
            style={{
              left: `${splash.x}%`,
              top: `${splash.y}%`,
              width: `${splash.size}px`,
              height: `${splash.size}px`,
              background: `radial-gradient(circle, ${splash.color} 0%, transparent 65%)`,
              animationDelay: `${splash.delay}s`,
              animationDuration: '8s',
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="absolute will-change-transform"
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.size}px`,
              height: `${block.size}px`,
              animation: `float-simple 12s ease-in-out infinite`,
              animationDelay: `${block.delay}s`,
            }}
          >
            <div
              className="h-full w-full rounded-xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${block.color}cc, ${block.color}ee)`,
                transform: `rotate(${block.rotation}deg)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
