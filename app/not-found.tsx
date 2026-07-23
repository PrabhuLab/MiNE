import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#141414] text-[#E4E3E0]">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4">404 - Not Found</h2>
        <p className="mb-6 font-mono">Could not find requested resource</p>
        <Link href="/" className="border border-[#E4E3E0] px-4 py-2 hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors uppercase text-xs font-bold tracking-widest">
          Return Home
        </Link>
      </div>
    </div>
  );
}
