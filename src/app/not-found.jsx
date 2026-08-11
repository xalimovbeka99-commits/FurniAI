import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF9F5] to-[#F4F1E8] text-[#1C1E21] flex flex-col items-center justify-center px-6 text-center">
      <div className="brand font-light text-[120px] leading-none text-[#EDE8DC] select-none">
        404
      </div>
      <h1 className="brand text-3xl font-light tracking-tight mt-2 mb-3">
        Page not found
      </h1>
      <p className="text-[#5C626E] text-sm max-w-xs leading-relaxed mb-10">
        This URL does not exist. The configurator and gallery are just one click away.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="font-mono text-xs tracking-wider bg-[#1C1E21] text-[#FAF9F5] border border-[#1C1E21] px-6 py-3 rounded-full hover:bg-[#00B4D8] hover:border-[#00B4D8] transition-all duration-200"
        >
          ← Home
        </Link>
        <Link
          href="/builder"
          className="font-mono text-xs tracking-wider bg-transparent text-[#1C1E21] border border-[#1C1E21] px-6 py-3 rounded-full hover:bg-[#1C1E21] hover:text-[#FAF9F5] transition-all duration-200"
        >
          Open Configurator
        </Link>
      </div>
    </div>
  );
}
