"use client";

import { useEffect, useState } from "react";

type MachineSummary = {
  id: string;
  name: string | null;
  model: string | null;
  year: number | null;
  hours: number | null;
};

type LeadWithMachine = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
  machines: MachineSummary[] | null;
};

type ApiResponse = {
  ok: boolean;
  leads?: LeadWithMachine[];
  error?: string;
};

export default function AdminPage() {
  const [leads, setLeads] = useState<LeadWithMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

const fetchLeads = async () => {
  try {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/leads");
    const text = await res.text();

    let data: ApiResponse;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Admin API svarade inte med JSON:", text);
      setError(
        "Servern svarade inte med JSON. Första raden: " +
          text.slice(0, 80)
      );
      setLeads([]);
      setLoading(false);
      return;
    }

    if (!res.ok || !data.ok) {
      setError(data.error || "Kunde inte hämta leads.");
      setLeads([]);
      setLoading(false);
      return;
    }

    setLeads(data.leads || []);
    setLoading(false);
  } catch (err: any) {
    console.error(err);
    setError(
      "Fel vid hämtning av leads: " + (err?.message || "okänt fel")
    );
    setLoading(false);
  }
};


  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter((lead) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const machineName =
      lead.machines?.[0]?.name || lead.machines?.[0]?.model || "";
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      machineName.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
      <div className="w-full max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Admin – leads &amp; maskiner
            </h1>
            <p className="text-sm text-slate-600">
              Senaste förfrågningar från värderingsformuläret, kopplat till
              maskiner i Arctic Trace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Sök på namn, e-post eller maskin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-300 rounded-full px-4 py-2 text-sm bg-white shadow-sm min-w-[240px]"
            />
            <button
              type="button"
              onClick={fetchLeads}
              className="text-sm rounded-full px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              Uppdatera
            </button>
          </div>
        </header>

        {/* Status / fel */}
        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Lista */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              {loading
                ? "Laddar leads..."
                : `Leads: ${filteredLeads.length} st`}
            </p>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              Hämtar data från servern...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              Inga leads ännu. Skicka en testförfrågan från startsidan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-500">
                      Datum
                    </th>
                    <th className="px-4 py-2 font-medium text-slate-500">
                      Kontakt
                    </th>
                    <th className="px-4 py-2 font-medium text-slate-500">
                      Maskin
                    </th>
                    <th className="px-4 py-2 font-medium text-slate-500">
                      Källa
                    </th>
                    <th className="px-4 py-2 font-medium text-slate-500">
                      Meddelande
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const m = lead.machines?.[0] || null;
                    const date = new Date(
                      lead.created_at
                    ).toLocaleString("sv-SE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    });

                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-2 align-top text-slate-700 whitespace-nowrap">
                          {date}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="font-semibold text-slate-900">
                            {lead.name}
                          </div>
                          <div className="text-xs text-slate-600">
                            {lead.email}
                            {lead.phone && ` · ${lead.phone}`}
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {m ? (
                            <>
                              <div className="font-medium text-slate-900">
                                {m.name || m.model || "Maskin"}
                              </div>
                              <div className="text-xs text-slate-600">
                                {m.model && `${m.model} · `}
                                {m.year && `År ${m.year} · `}
                                {typeof m.hours === "number" &&
                                  `${m.hours} h`}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Ingen maskin kopplad
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-600 whitespace-nowrap">
                          {lead.source || "okänd"}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-700 max-w-xs">
                          {lead.message || (
                            <span className="text-slate-400">
                              Inget meddelande
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
