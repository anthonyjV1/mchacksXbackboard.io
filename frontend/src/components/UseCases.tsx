"use client"

import { motion } from "framer-motion"
import { Users, Rocket, Code } from "lucide-react"

const useCases = [
  {
    icon: Rocket,
    type: "Early-stage startups",
    scenario: "Moving from idea to execution",
    benefit: "Structure without bureaucracy",
    color: 'oklch(0.72 0.19 35)',
    shadow: 'rgba(240, 90, 70, 0.2)',
  },
  {
    icon: Users,
    type: "Small teams",
    scenario: "Coordinating without meetings",
    benefit: "Shared clarity on what matters",
    color: 'oklch(0.65 0.22 290)',
    shadow: 'rgba(150, 70, 230, 0.2)',
  },
  {
    icon: Code,
    type: "Technical and non-technical founders",
    scenario: "Bridging vision and implementation",
    benefit: "A common language for everyone",
    color: 'oklch(0.75 0.15 195)',
    shadow: 'rgba(70, 200, 230, 0.2)',
  },
]

export function UseCases() {
  return (
    <section className="relative px-6 py-32 sm:px-12 lg:px-24 bg-gradient-to-b from-transparent via-[var(--vibrant-purple)]/[0.02] to-transparent">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--vibrant-purple)] to-[var(--vibrant-coral)] px-4 py-1.5 text-xs font-semibold text-white">
            <Users className="h-3.5 w-3.5" />
            WHO IT'S FOR
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
            Built for founders
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From solo founders to growing teams, Accelr Labs adapts to your needs
          </p>
        </motion.div>

        <div className="space-y-6">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.type}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.7, 
                delay: i * 0.15,
                ease: [0.16, 1, 0.3, 1]
              }}
              whileHover={{ 
                x: 8,
                transition: { duration: 0.3 }
              }}
              className="group relative"
            >
              <div
                className="relative grid gap-8 rounded-3xl p-10 overflow-hidden sm:grid-cols-[auto_1fr_1fr_1fr] items-center"
                style={{
                  background: 'white',
                  border: '2px solid rgba(0,0,0,0.06)',
                  boxShadow: `
                    0 4px 20px rgba(0,0,0,0.05),
                    0 0 0 1px rgba(255,255,255,0.5),
                    0 0 60px ${useCase.shadow}
                  `,
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, ${useCase.color} 1px, transparent 1px),
                      linear-gradient(to bottom, ${useCase.color} 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />

                <div 
                  className="flex-shrink-0 rounded-2xl p-5 shadow-lg relative"
                  style={{
                    background: useCase.color,
                    boxShadow: `
                      0 8px 24px ${useCase.shadow},
                      inset 0 2px 0 rgba(255,255,255,0.4),
                      inset 0 -2px 0 rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  <useCase.icon className="h-8 w-8 text-white" />
                  <div 
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)',
                    }}
                  />
                </div>

                <div className="relative">
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: useCase.color }}>
                    Who
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {useCase.type}
                  </div>
                </div>

                <div className="relative">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Context
                  </div>
                  <div className="text-lg text-foreground leading-snug">
                    {useCase.scenario}
                  </div>
                </div>

                <div className="relative">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Benefit
                  </div>
                  <div className="text-lg font-semibold text-foreground leading-snug">
                    {useCase.benefit}
                  </div>
                </div>

                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2"
                  style={{
                    background: useCase.color,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
