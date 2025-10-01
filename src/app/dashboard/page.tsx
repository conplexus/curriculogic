import NavBar from '../../components/NavBar'

export default function Dashboard() {
  // TODO: replace with real API calls to fetch counts and metrics
  const metrics = {
    programs: 1,
    courses: 4,
    mappedPercent: 48,
    recentActivity: [
      'Admin imported sample dataset',
      'Editor mapped PHRM-101 to OUT-001',
      'Reviewer commented on PHRM-201 mapping'
    ]
  };

  return (
    <>
      <NavBar />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Programs</div>
            <div className="text-2xl font-semibold">{metrics.programs}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Courses</div>
            <div className="text-2xl font-semibold">{metrics.courses}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Percent mapped</div>
            <div className="text-2xl font-semibold">{metrics.mappedPercent}%</div>
          </div>
        </div>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Recent activity</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {metrics.recentActivity.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>
      </main>
    </>
  );
}