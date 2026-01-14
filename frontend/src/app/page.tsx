import { Navigation } from "@/components/Navigation"
import { Hero } from "@/components/Hero"
import { VisualExplanation } from "@/components/VisualExplanation"
import { WhyItWorks } from "@/components/WhyItWorks"
import { UseCases } from "@/components/UseCases"
import { Personality } from "@/components/Personality"
import { FinalCTA } from "@/components/FinalCTA"
import { FloatingBlocks } from "@/components/FloatingBlocks"

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <FloatingBlocks />
      <Navigation />
      <main>
        <Hero />
        <VisualExplanation />
        <WhyItWorks />
        <UseCases />
        <Personality />
        <FinalCTA />
      </main>
      <footer className="border-t border-border px-6 py-12 text-center sm:px-12 lg:px-24">
        <p className="text-sm text-muted-foreground">
          © 2024 Accelr Labs. Built for founders who think clearly.
        </p>
      </footer>
      
    </div>
  )
}
