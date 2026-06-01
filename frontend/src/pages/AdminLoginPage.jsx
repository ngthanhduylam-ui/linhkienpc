import { Link } from "react-router-dom";

export function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-brand-900">Admin Login</h1>
        <p className="mt-1 text-sm text-slate-600">LINHKIENPC inventory management</p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="button"
            className="h-11 w-full rounded-md bg-brand-700 text-sm font-medium text-white hover:bg-brand-900"
          >
            Login
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          <Link to="/" className="text-brand-700 hover:underline">
            Back to public search
          </Link>
        </div>
      </div>
    </div>
  );
}
