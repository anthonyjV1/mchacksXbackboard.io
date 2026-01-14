"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"

const blockColors = [
  { bg: 'oklch(0.65 0.22 290)', shadow: 'rgba(150, 70, 230, 0.3)' },
  { bg: 'oklch(0.7 0.16 150)', shadow: 'rgba(70, 200, 130, 0.3)' },
  { bg: 'oklch(0.75 0.15 195)', shadow: 'rgba(70, 200, 230, 0.3)' },
  { bg: 'oklch(0.85 0.17 95)', shadow: 'rgba(250, 210, 80, 0.3)' },
]

export function VisualExplanation() {
  return (
    <section className="relative px-6 py-32 sm:px-12 lg:px-24">
      <div 
        className="absolute left-1/4 top-20 h-64 w-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--vibrant-purple) 0%, transparent 70%)',
          opacity: 0.08,
          filter: 'blur(60px)',
        }}
      />

      <div className="mx-auto max-w-6xl relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--vibrant-cyan)] to-[var(--vibrant-green)] px-4 py-1.5 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            HOW IT WORKS
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            One sentence → Structured pipeline
          </h2>
        </motion.div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_auto_1.5fr]">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative group"
            style={{
              transformStyle: "preserve-3d",
              perspective: "1000px",
            }}
          >
            <div
              className="relative rounded-3xl p-10 overflow-hidden"
              style={{
                background: 'white',
                border: '2px solid rgba(0,0,0,0.06)',
                boxShadow: `
                  0 8px 32px rgba(0,0,0,0.06),
                  0 0 0 1px rgba(255,255,255,0.5),
                  inset 0 2px 0 rgba(255,255,255,0.9)
                `,
              }}
            >
              <div 
                className="absolute -right-12 -top-12 h-40 w-40 rounded-full"
                style={{
                  background: 'radial-gradient(circle, var(--vibrant-coral) 0%, transparent 70%)',
                  opacity: 0.12,
                }}
              />
              
              <div className="relative">
                <div className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--vibrant-coral)]">
                  Input
                </div>
                <div className="text-2xl font-semibold leading-relaxed text-foreground">
                  "We help remote teams stay connected through async video updates"
                </div>
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center lg:px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-full p-4"
              style={{
                background: 'linear-gradient(135deg, var(--vibrant-coral), var(--vibrant-cyan))',
                boxShadow: '0 8px 24px rgba(240, 90, 70, 0.3)',
              }}
            >
              <ArrowRight className="h-6 w-6 text-white" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {[
              { name: "User Recording", desc: "Capture video messages" },
              { name: "Video Processing", desc: "Optimize & compress" },
              { name: "Distribution", desc: "Share with team" },
              { name: "Analytics", desc: "Track engagement" },
            ].map((step, i) => (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, y: 20, rotateY: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ 
                  duration: 0.6, 
                  delay: 0.4 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1]
                }}
                whileHover={{ 
                  x: 8,
                  transition: { duration: 0.2 }
                }}
                className="group/item relative"
                style={{
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  className="relative rounded-2xl px-6 py-5 overflow-hidden"
                  style={{
                    background: 'white',
                    border: '2px solid rgba(0,0,0,0.06)',
                    boxShadow: `
                      0 4px 12px rgba(0,0,0,0.04),
                      0 0 0 1px rgba(255,255,255,0.5),
                      0 0 30px ${blockColors[i].shadow}
                    `,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{
                      background: blockColors[i].bg,
                    }}
                  />

                  <div className="relative flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-lg flex-shrink-0 shadow-lg"
                      style={{
                        background: blockColors[i].bg,
                        boxShadow: `
                          0 4px 12px ${blockColors[i].shadow},
                          inset 0 1px 0 rgba(255,255,255,0.4)
                        `,
                      }}
                    >
                      <div className="h-full w-full rounded-lg bg-gradient-to-br from-white/30 to-transparent" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold text-foreground">
                        {step.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {step.desc}
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${blockColors[i].bg}05, transparent)`,
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
