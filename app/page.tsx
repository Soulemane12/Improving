import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <main className="max-w-lg mx-auto px-6 text-center flex flex-col items-center gap-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Voice Coach
          </h1>
          <p className="text-neutral-400 text-lg leading-relaxed">
            Practice your listing opener with real-time voice analysis.
            Get instant feedback on pacing, confidence, stress, and more.
          </p>
        </div>

        <Link
          href="/practice"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors text-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8" />
          </svg>
          Start Practice Session
        </Link>

        <div className="grid grid-cols-3 gap-6 text-center mt-4">
          <div>
            <div className="text-2xl font-bold text-white">6+</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">
              Signal Types
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">9</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">
              Coaching Metrics
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">RT</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">
              Real-time
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
