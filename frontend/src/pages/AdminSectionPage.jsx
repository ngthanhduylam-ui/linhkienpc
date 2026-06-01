export function AdminSectionPage({ title }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Skeleton layout only. API integration will be implemented in next phase.
      </p>
    </section>
  );
}
