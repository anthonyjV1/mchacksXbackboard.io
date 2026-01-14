"use client"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-32 pb-32 sm:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl relative">
        <div className="relative animate-fade-in">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 text-left">
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="inline-block mb-6">
                  <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border-2 border-[#FF6B35]/20 rounded-2xl px-6 py-3 shadow-lg shadow-[#FF6B35]/10">
                    <div className="flex -space-x-2">
                      {['#FF6B35', '#4ECDC4', '#FFE66D'].map((color, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-lg border-2 border-white shadow-md animate-bounce-subtle"
                          style={{ 
                            background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                            zIndex: 3 - i,
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                    <Sparkles className="h-5 w-5 text-[#FF6B35]" />
                    <span className="text-sm font-semibold text-slate-700">Block-Based Workflows</span>
                  </div>
                </div>
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <span className="block text-slate-900 mb-2">Build your startup</span>
                <span className="block relative">
                  <span className="relative inline-block">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B35] via-[#C44569] to-[#6C5CE7]">
                      one block at a time
                    </span>
                    <svg
                      className="absolute -bottom-3 left-0 w-full animate-draw-line"
                      height="12"
                      viewBox="0 0 300 12"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5 7 Q75 2, 150 7 T295 7"
                        stroke="url(#gradient)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.6" />
                          <stop offset="50%" stopColor="#C44569" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#6C5CE7" stopOpacity="0.6" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </span>
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed max-w-xl animate-slide-up" style={{ animationDelay: '0.3s' }}>
                Stop juggling spreadsheets and scattered docs. Transform your one-sentence idea into a clear, visual pipeline your entire team can follow.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <Button 
                  size="lg" 
                  className="h-16 rounded-2xl px-10 text-lg font-semibold bg-gradient-to-r from-[#FF6B35] to-[#C44569] hover:from-[#FF6B35] hover:to-[#FF6B35] shadow-xl shadow-[#FF6B35]/30 hover:shadow-2xl hover:shadow-[#FF6B35]/40 transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start building free
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-16 rounded-2xl px-10 text-lg font-semibold border-2 border-slate-300 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-[#FF6B35]/5 transition-all duration-200"
                >
                  Watch demo
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-4 animate-slide-up" style={{ animationDelay: '0.5s' }}>
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 border-2 border-white"
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">1,200+ founders</div>
                  <div className="text-slate-600">already building pipelines</div>
                </div>
              </div>
            </div>

            <div className="relative lg:ml-auto animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-r from-[#FF6B35]/20 via-[#6C5CE7]/20 to-[#4ECDC4]/20 rounded-3xl blur-3xl animate-pulse-slow" />
                
                <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Your Pipeline</div>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FF6B35]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#FFE66D]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#4ECDC4]"></div>
                    </div>
                  </div>

                  {[
                    { name: "Discovery", icon: "🔍", color: "#FF6B35", detail: "Market research, user interviews, competitive analysis" },
                    { name: "Build", icon: "⚡", color: "#6C5CE7", detail: "MVP development, core features, initial testing" },
                    { name: "Launch", icon: "🚀", color: "#4ECDC4", detail: "Beta release, gather feedback, iterate quickly" }
                  ].map((stage) => (
                    <div key={stage.name} className="group relative">
                      <div
                        className="relative rounded-2xl p-6 bg-white border-2 transition-all duration-200 cursor-pointer hover:translate-x-1"
                        style={{
                          borderColor: `${stage.color}30`,
                          boxShadow: `0 4px 20px ${stage.color}15`,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg transition-transform duration-200 group-hover:scale-105"
                            style={{
                              background: `linear-gradient(135deg, ${stage.color}, ${stage.color}dd)`,
                            }}
                          >
                            {stage.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-lg text-slate-900 mb-1">{stage.name}</div>
                            <div className="text-sm text-slate-600 leading-relaxed">{stage.detail}</div>
                          </div>
                        </div>
                        
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            →
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
