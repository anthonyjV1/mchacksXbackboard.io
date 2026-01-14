"use client"

import { motion } from "framer-motion"
import { Lightbulb, Edit3, TrendingUp, Zap } from "lucide-react"

const features = [
  {
    icon: Lightbulb,
    title: "Opinionated starting point",
    description: "Begin with structure, not a blank canvas. Get a working pipeline instantly.",
    color: 'oklch(0.85 0.17 95)',
    shadow: 'rgba(250, 210, 80, 0.3)',
  },
  {
    icon: Edit3,
    title: "Editable, not locked-in",
    description: "Refine every stage to match your reality. Your workflow, your rules.",
    color: 'oklch(0.75 0.15 195)',
    shadow: 'rgba(70, 200, 230, 0.3)',
  },
  {
    icon: TrendingUp,
    title: "Built to scale with your company",
    description: "Evolve your workflow as you grow. From 2 to 200 people.",
    color: 'oklch(0.7 0.16 150)',
    shadow: 'rgba(70, 200, 130, 0.3)',
  },
]

export function WhyItWorks() {
  return (
    <section className="relative px-6 py-32 sm:px-12 lg:px-24 overflow-hidden">
      <div 
        className="absolute right-1/4 top-1/2 h-96 w-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--vibrant-yellow) 0%, transparent 70%)',
          opacity: 0.06,
          filter: 'blur(80px)',
        }}
      />

      <div className="mx-auto max-w-6xl relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--vibrant-yellow)] to-[var(--vibrant-coral)] px-4 py-1.5 text-xs font-semibold text-white">
            <Zap className="h-3.5 w-3.5" />
            WHY IT WORKS
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Built for how founders actually work
          </h2>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30, rotateX: -10 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.7, 
                delay: i * 0.15,
                ease: [0.16, 1, 0.3, 1]
              }}
              whileHover={{ 
                y: -8,
                transition: { duration: 0.3 }
              }}
              className="group relative"
              style={{
                transformStyle: "preserve-3d",
                perspective: "1000px",
              }}
            >
              <div
                className="relative rounded-3xl p-8 overflow-hidden h-full"
                style={{
                  background: 'white',
                  border: '2px solid rgba(0,0,0,0.06)',
                  boxShadow: `
                    0 4px 20px rgba(0,0,0,0.06),
                    0 0 0 1px rgba(255,255,255,0.5),
                    0 0 40px ${feature.shadow}
                  `,
                }}
              >
                <motion.div
                  className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${feature.color} 0%, transparent 70%)`,
                    opacity: 0.12,
                  }}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.12, 0.2, 0.12],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    delay: i * 0.8,
                  }}
                />

                <div 
                  className="mb-6 inline-flex rounded-2xl p-4 shadow-lg transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: feature.color,
                    boxShadow: `
                      0 8px 20px ${feature.shadow},
                      inset 0 2px 0 rgba(255,255,255,0.4),
                      inset 0 -2px 0 rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  <feature.icon className="h-7 w-7 text-white" />
                  <div 
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)',
                    }}
                  />
                </div>

                <h3 className="mb-4 text-xl font-bold text-foreground leading-snug">
                  {feature.title}
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>

                <div 
                  className="absolute bottom-0 left-0 right-0 h-1.5"
                  style={{
                    background: `linear-gradient(90deg, ${feature.color}, transparent)`,
                  }}
                />
              </div>

              <div
                className="absolute inset-0 -z-10 rounded-3xl transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                style={{
                  background: feature.color,
                  filter: 'blur(40px)',
                  transform: 'translateY(12px) scale(0.9)',
                  opacity: 0.3,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
