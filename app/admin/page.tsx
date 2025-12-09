"use client";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
      <div className="w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Admin – Arctic Trace
        </h1>
        <p className="text-sm text-slate-600">
          Den här sidan är en enkel admin-vy placeholder. 
          Just nu testar vi bara att /admin fungerar utan fel (500).
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm">
          <p className="text-sm text-slate-700">
            ✅ Om du ser den här rutan betyder det att <code>/admin</code>-routen
            fungerar tekniskt.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Nästa steg blir att koppla in Supabase och visa riktiga leads här
            – men först måste vi bekräfta att felet verkligen sitter i
            databitan och inte i routing / rendering.
          </p>
        </div>
      </div>
    </main>
  );
}

