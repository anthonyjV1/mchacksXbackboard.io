"use client"

import { motion } from "framer-motion"

export function Personality() {
  return (
    <section className="relative px-6 py-32 sm:px-12 lg:px-24 overflow-hidden">
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--vibrant-cyan) 0%, transparent 70%)',
          opacity: 0.05,
          filter: 'blur(100px)',
        }}
      />

      <div className="mx-auto max-w-4xl relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div
            className="relative rounded-[2.5rem] p-16 text-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, white 0%, rgba(255,255,255,0.95) 100%)',
              border: '3px solid rgba(0,0,0,0.08)',
              boxShadow: `
                0 20px 60px rgba(0,0,0,0.08),
                0 0 0 1px rgba(255,255,255,0.5),
                inset 0 2px 0 rgba(255,255,255,0.9)
              `,
            }}
          >
            <div 
              className="absolute -left-24 -top-24 h-64 w-64 rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--vibrant-purple) 0%, transparent 70%)',
                opacity: 0.08,
              }}
            />
            <div 
              className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--vibrant-coral) 0%, transparent 70%)',
                opacity: 0.08,
              }}
            />

            <div className="relative">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                className="mx-auto mb-8 h-1 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--vibrant-coral), var(--vibrant-cyan), var(--vibrant-green))',
                  maxWidth: '200px',
                }}
              />

              <blockquote className="text-3xl font-bold leading-relaxed text-foreground sm:text-4xl lg:text-5xl">
                Most founders run their company{" "}
                <span 
                  className="relative inline-block"
                  style={{
                    background: 'linear-gradient(135deg, var(--vibrant-purple), var(--vibrant-cyan))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  in their head
                </span>
                .{" "}
                <br className="hidden sm:block" />
                We make it visible.
              </blockquote>

              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                className="mx-auto mt-8 h-1 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--vibrant-green), var(--vibrant-cyan), var(--vibrant-coral))',
                  maxWidth: '200px',
                }}
              />
            </div>

            <div
              className="absolute bottom-0 left-0 right-0 h-2"
              style={{
                background: 'linear-gradient(90deg, var(--vibrant-coral), var(--vibrant-purple), var(--vibrant-cyan), var(--vibrant-green))',
              }}
            />
          </div>

          <motion.div
            className="absolute -left-8 top-1/2 -translate-y-1/2 h-24 w-24 rounded-2xl shadow-2xl"
            style={{
              background: 'var(--vibrant-yellow)',
              boxShadow: '0 12px 40px rgba(250, 210, 80, 0.4), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
            animate={{
              y: [0, -20, 0],
              rotateZ: [0, 5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
          </motion.div>

          <motion.div
            className="absolute -right-8 top-1/4 h-16 w-16 rounded-xl shadow-2xl"
            style={{
              background: 'var(--vibrant-cyan)',
              boxShadow: '0 12px 40px rgba(70, 200, 230, 0.4), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
            animate={{
              y: [0, 15, 0],
              rotateZ: [0, -8, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            <div className="h-full w-full rounded-xl bg-gradient-to-br from-white/30 to-transparent" />
          </motion.div>

          <motion.div
            className="absolute -right-4 bottom-1/4 h-20 w-20 rounded-2xl shadow-2xl"
            style={{
              background: 'var(--vibrant-coral)',
              boxShadow: '0 12px 40px rgba(240, 90, 70, 0.4), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
            animate={{
              y: [0, -18, 0],
              rotateZ: [0, 10, 0],
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
