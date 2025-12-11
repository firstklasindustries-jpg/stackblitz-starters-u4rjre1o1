"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/leads");
      const data = await res.json();

      if (!res.ok || !data.ok) {
        console.error("Lead-API fel:", data);
        setError(data.error || "Kunde inte hämta leads.");
        setLeads([]);
        return;
      }

      setLeads((data.leads || []) as Lead[]);
    } catch (err: any) {
      console.error("Client-fel i admin-fetch:", err);
      setError(
        "Client-fel vid hämtning av leads: " +
          (err?.message || "okänt fel")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin – Leads</h1>
            <p className="text-sm text-gray-600">
              Alla värderingsförfrågningar från formuläret.
            </p>
          </div>
          <button
            onClick={fetchLeads}
            className="px-3 py-1 rounded bg-slate-900 text-white text-sm"
          >
            Uppdatera
          </button>
        </header>

        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}

        {loading ? (
          <p>Laddar leads...</p>
        ) : leads.length === 0 ? (
          <p>Inga leads ännu.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {lead.name || "Ingen namn"}{" "}
                      <span className="text-xs text-gray-500">
                        ({lead.email || "ingen e-post"})
                      </span>
                    </p>
                    {lead.phone && (
                      <p className="text-xs text-gray-600">
                        Tel: {lead.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">
                      {new Date(lead.created_at).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Källa: {lead.source || "-"}
                    </p>
                  </div>
                </div>

                {lead.message && (
                  <p className="mt-2 text-[13px] whitespace-pre-line text-gray-800">
                    {lead.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
