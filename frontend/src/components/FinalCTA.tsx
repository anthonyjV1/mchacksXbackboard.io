"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export function FinalCTA() {
  return (
    <section className="relative px-6 py-32 sm:px-12 lg:px-24 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.5 0.1 250) 2px, transparent 2px),
            linear-gradient(to bottom, oklch(0.5 0.1 250) 2px, transparent 2px)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--vibrant-purple) 0%, var(--vibrant-coral) 50%, transparent 70%)',
          opacity: 0.08,
          filter: 'blur(120px)',
        }}
      />

      <div className="mx-auto max-w-5xl relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div
            className="relative rounded-[3rem] p-16 sm:p-20 text-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, white 0%, rgba(255,255,255,0.98) 100%)',
              border: '3px solid rgba(0,0,0,0.08)',
              boxShadow: `
                0 30px 80px rgba(0,0,0,0.12),
                0 0 0 1px rgba(255,255,255,0.5),
                inset 0 2px 0 rgba(255,255,255,0.9)
              `,
            }}
          >
            <motion.div
              className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--vibrant-yellow) 0%, transparent 70%)',
                opacity: 0.15,
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.15, 0.25, 0.15],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
              }}
            />

            <div className="relative">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--vibrant-coral)] via-[var(--vibrant-purple)] to-[var(--vibrant-cyan)] px-6 py-2.5 text-sm font-bold text-white shadow-2xl"
              >
                <Sparkles className="h-4 w-4" />
                READY TO START?
              </motion.div>

              <h2 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl mb-6">
                Start with{" "}
                <span 
                  className="relative inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--vibrant-coral), var(--vibrant-purple), var(--vibrant-cyan))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  one sentence
                </span>
              </h2>

              <p className="mx-auto max-w-2xl text-xl sm:text-2xl text-muted-foreground leading-relaxed font-normal mb-12">
                Describe your company and get a visual workflow pipeline in seconds.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Button 
                  size="lg" 
                  className="group h-16 rounded-2xl px-10 text-lg font-bold bg-gradient-to-r from-[var(--vibrant-coral)] via-[var(--vibrant-purple)] to-[var(--vibrant-cyan)] hover:shadow-2xl hover:shadow-[var(--vibrant-coral)]/30 transition-all duration-300 hover:scale-105"
                >
                  Generate my pipeline
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-8 text-sm text-muted-foreground"
              >
                No credit card required • Takes less than 30 seconds
              </motion.div>
            </div>

            <div
              className="absolute bottom-0 left-0 right-0 h-2"
              style={{
                background: 'linear-gradient(90deg, var(--vibrant-coral), var(--vibrant-yellow), var(--vibrant-green), var(--vibrant-cyan), var(--vibrant-purple))',
              }}
            />
          </div>

          <div className="absolute -left-12 top-1/3 h-28 w-28 rounded-2xl shadow-2xl hidden lg:block"
            style={{
              background: 'var(--vibrant-purple)',
              boxShadow: '0 16px 48px rgba(150, 70, 230, 0.4), inset 0 2px 0 rgba(255,255,255,0.4)',
              transform: 'rotate(-12deg)',
            }}
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
          </div>

          <div className="absolute -right-12 bottom-1/3 h-32 w-32 rounded-2xl shadow-2xl hidden lg:block"
            style={{
              background: 'var(--vibrant-green)',
              boxShadow: '0 16px 48px rgba(70, 200, 130, 0.4), inset 0 2px 0 rgba(255,255,255,0.4)',
              transform: 'rotate(15deg)',
            }}
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
