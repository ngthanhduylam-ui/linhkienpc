export function AdminSectionPage({ title }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Khung giao diện đã sẵn sàng. Kết nối API chi tiết sẽ triển khai ở bước tiếp theo.
      </p>
    </section>
  );
}
