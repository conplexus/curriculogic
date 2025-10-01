```tsx
import Link from 'next/link'

export default function CurricuLogicLanding() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-3xl p-8 bg-white rounded shadow">
        <h1 className="text-3xl font-bold">CurricuLogic</h1>
        <p className="mt-4">Centralized curriculum mapping & accreditation analytics.</p>
        <ul className="mt-6 space-y-2">
          <li>CSV/Excel import for Canvas/D2L</li>
          <li>Role-based mapping & audit logs</li>
          <li>Exportable accreditor-ready reports</li>
        </ul>
        <div className="mt-6 flex gap-4">
          <a href="/demo" className="px-4 py-2 bg-blue-600 text-white rounded">Try demo</a>
          <a href="mailto:hello@conplexus.com" className="px-4 py-2 border rounded">Contact</a>
        </div>
        <p className="text-sm text-gray-500 mt-4">MVP avoids storing student-level PII. Pilot available 60–90 days.</p>
      </div>
    </main>
  )
}
```