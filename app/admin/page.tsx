"use client";

import React, { useEffect, useMemo, useState } from "react";

type LeadStatus = "new" | "contacted" | "in_progress" | "won" | "lost";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
  machine_type: string | null;
  status: LeadStatus | null;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Ny",
  contacted: "Kontaktad",
  in_progress: "Pågående",
  won: "Vunnit",
  lost: "Ej aktuell",
};

function StatusPill({ status }: { status: LeadStatus }) {
  const cls =
    status === "new"
      ? "bg-blue-100 text-blue-800"
      : status === "contacted"
      ? "bg-amber-100 text-amber-800"
      : status === "in_progress"
      ? "bg-purple-100 text-purple-800"
      : status === "won"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-gray-200 text-gray-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [savedKey, setSavedKey] = useState<string>("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
const updateLeadStatus = async (id: string, status: LeadStatus) => {
  setError(null);
  setUpdatingId(id);

  const key = (savedKey || "").trim();
  if (!key) {
    setError("ADMIN_KEY saknas. Fyll i nyckeln och klicka Spara.");
    setUpdatingId(null);
    return;
  }

  try {
    const res = await fetch("/api/admin/leads/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": key,
      },
      body: JSON.stringify({ id, status }),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`API svarade inte JSON. Status ${res.status}. Body: ${text.slice(0, 160)}`);
    }

    if (!json.ok) throw new Error(json.error || "Kunde inte uppdatera status.");

    // uppdatera lokalt
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  } catch (e: any) {
    console.error(e);
    setError(e?.message || "Kunde inte uppdatera status.");
  } finally {
    setUpdatingId(null);
  }
};


  const keyPresent = useMemo(() => (savedKey || "").length > 0, [savedKey]);

  // Load key from localStorage once
  useEffect(() => {
    try {
      const k = localStorage.getItem("ADMIN_KEY") || "";
      setSavedKey(k);
      setAdminKey(k);
    } catch {
      // ignore
    }
  }, []);

  const saveKey = () => {
    const k = adminKey.trim();
    try {
      localStorage.setItem("ADMIN_KEY", k);
    } catch {
      // ignore
    }
    setSavedKey(k);
    setError(null);
  };

  const clearKey = () => {
    try {
      localStorage.removeItem("ADMIN_KEY");
    } catch {
      // ignore
    }
    setAdminKey("");
    setSavedKey("");
    setLeads([]);
    setError("Admin key borttagen. Sätt nyckeln igen för att hämta leads.");
  };

  const safeReadJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Admin API svarade inte JSON. Status ${res.status}. Body: ${text.slice(0, 160)}`
      );
    }
  };

  const fetchLeads = async () => {
    setFetching(true);
    setError(null);

    const key = (savedKey || "").trim();
    if (!key) {
      setError("ADMIN_KEY saknas. Fyll i nyckeln ovan och klicka Spara.");
      setFetching(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/leads", {
        headers: {
          "x-admin-key": key,
        },
      });

      const json = await safeReadJson(res);

      if (!json.ok) {
        throw new Error(json.error || "Kunde inte hämta leads.");
      }

      setLeads((json.leads || []) as Lead[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Kunde inte hämta leads.");
      setLeads([]);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  // auto-fetch when we have a key
  useEffect(() => {
    if (keyPresent) fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyPresent]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin – Leads</h1>
            <p className="text-sm text-gray-600">
              Hämtar leads via <code>/api/admin/leads</code> (server + service role).
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLeads}
              className="px-3 py-2 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
              disabled={fetching}
            >
              {fetching ? "Hämtar..." : "Uppdatera"}
            </button>
          </div>
        </header>

        {/* Admin key box */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Admin key</h2>
          <p className="text-xs text-gray-600 mb-3">
            Nyckeln sparas i din browser (localStorage) och skickas som header{" "}
            <code>x-admin-key</code>.
          </p>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Klistra in ADMIN_KEY…"
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveKey}
              className="px-3 py-2 rounded border border-slate-300 bg-white text-sm"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={clearKey}
              className="px-3 py-2 rounded border border-slate-300 bg-white text-sm"
            >
              Rensa
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-600">
            Status:{" "}
            {savedKey ? (
              <span>
                ✅ Sparad (prefix: <code>{savedKey.slice(0, 6)}</code>, längd:{" "}
                {savedKey.length})
              </span>
            ) : (
              <span>❌ Ingen nyckel sparad</span>
            )}
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Leads */}
        {loading ? (
          <p>Laddar…</p>
        ) : leads.length === 0 ? (
          <p>Inga leads ännu.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const status: LeadStatus = (lead.status as LeadStatus) || "new";

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-2">
  <p className="text-[11px] text-gray-500 mr-2">Uppdatera status:</p>

  {(["new","contacted","in_progress","won","lost"] as LeadStatus[]).map((s) => (
    <button
      key={s}
      type="button"
      onClick={() => updateLeadStatus(lead.id, s)}
      disabled={updatingId === lead.id}
      className={`text-[11px] px-2 py-1 rounded border ${
        (lead.status || "new") === s
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-gray-700 border-slate-300"
      } disabled:opacity-60`}
    >
      {STATUS_LABELS[s]}
    </button>
  ))}
</div>


              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-sm space-y-2"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {lead.name || "Ingen namn"}{" "}
                        <span className="text-xs text-gray-500">
                          ({lead.email || "ingen e-post"})
                        </span>
                      </p>
                      {lead.phone && (
                        <p className="text-xs text-gray-600">Tel: {lead.phone}</p>
                      )}
                      {lead.machine_type && (
                        <p className="text-xs text-gray-600 mt-1">
                          Maskintyp: {lead.machine_type}
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-[11px] text-gray-500">
                        {new Date(lead.created_at).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Källa: {lead.source || "-"}
                      </p>
                      <StatusPill status={status} />
                    </div>
                  </div>

                  {lead.message && (
                    <p className="mt-1 text-[13px] whitespace-pre-line text-gray-800">
                      {lead.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="text-[11px] text-gray-500">
          Tips: Vill du låsa hårdare sen kan vi byta admin-key till riktig Supabase Auth + RLS.
        </footer>
      </div>
    </main>
  );
}


