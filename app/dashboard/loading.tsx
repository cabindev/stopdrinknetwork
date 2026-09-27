export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-orange-100">
            <div className="animate-pulse space-y-3">
              <div className="w-8 h-8 bg-orange-50 rounded-lg" />
              <div className="w-16 h-6 bg-orange-50 rounded" />
              <div className="w-24 h-3 bg-orange-50 rounded" />
            </div>
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-orange-100">
            <div className="animate-pulse">
              <div className="w-32 h-4 bg-orange-50 rounded mb-4" />
              <div className="w-full h-48 bg-orange-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
