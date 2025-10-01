import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <a className="font-bold">Conplexus</a>
          </Link>
          <Link href="/curriculogic">
            <a className="text-sm text-gray-700">CurricuLogic</a>
          </Link>
          <Link href="/conplexusedu">
            <a className="text-sm text-gray-700">ConplexusEdu</a>
          </Link>
        </div>
        <div>
          <a href="mailto:hello@conplexus.com" className="text-sm text-blue-600">Contact</a>
        </div>
      </div>
    </nav>
  )
}